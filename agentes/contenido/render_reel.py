# Renderiza un reel de Küme: reel.html (window.REEL) → reel.mp4 (1080×1920, 30 fps, con música) + portada.png
# Uso: python render_reel.py salidas/AAAA-MM-DD-slug-reel/reel.html [--muestras]
#   --muestras: solo saca 1 cuadro por escena en muestras/ para revisar el diseño antes de renderizar todo.
import sys, asyncio, subprocess, pathlib, shutil, wave
import numpy as np
from playwright.async_api import async_playwright

FPS, SR = 30, 48000


def musica(destino, dur, cortes, estilo):
    """Banda sonora original (sin derechos): ritmo + bajo + pad, con golpe en cada corte de escena."""
    t = np.arange(int(SR * dur)) / SR
    nota = lambda n: 440.0 * 2 ** ((n - 69) / 12)
    L = np.zeros_like(t); R = np.zeros_like(t)
    bpm = 118 if estilo == "beat" else 84
    pulso = 60 / bpm
    acordes = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G
    compas = pulso * 4
    for i in range(int(dur / compas) + 1):
        a = i * compas; ac = acordes[i % 4]
        m = (t >= a) & (t < a + compas + .5); tt = t[m] - a
        env = np.minimum(tt / .25, 1) * np.exp(-tt * (.35 if estilo == "suave" else .6))
        for k, n in enumerate(ac):
            L[m] += .16 * env * np.sin(2 * np.pi * nota(n) * tt + k)
            R[m] += .16 * env * np.sin(2 * np.pi * nota(n) * 1.003 * tt + k * 1.3)
        # bajo
        b = nota(ac[0] - 24)
        bajo = .5 * np.sin(2 * np.pi * b * tt) * np.exp(-tt * 1.2)
        L[m] += bajo; R[m] += bajo
    if estilo == "beat":
        n_pulsos = int(dur / pulso) + 1
        for i in range(n_pulsos):
            a = i * pulso
            m = (t >= a) & (t < a + .35); tt = t[m] - a
            kick = np.sin(2 * np.pi * (45 + 90 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 9) * .9
            L[m] += kick; R[m] += kick
            # hi-hat a contratiempo
            h = a + pulso / 2
            m = (t >= h) & (t < h + .06); tt = t[m] - h
            hat = np.random.default_rng(i).uniform(-1, 1, m.sum()) * np.exp(-tt * 70) * .18
            L[m] += hat; R[m] += hat * .8
    # golpe en cada corte
    for c in cortes[1:]:
        m = (t >= c) & (t < c + 1.2); tt = t[m] - c
        boom = np.sin(2 * np.pi * (40 + 40 * np.exp(-tt * 8)) * tt) * np.exp(-tt * 3.5) * .8
        swoosh = np.random.default_rng(int(c * 100)).uniform(-1, 1, m.sum()) * np.exp(-tt * 18) * .12
        L[m] += boom + swoosh; R[m] += boom - swoosh
    fade = np.clip(t / .05, 0, 1) * np.clip((dur - t) / .4, 0, 1)
    L *= fade; R *= fade
    pico = max(abs(L).max(), abs(R).max(), 1e-6)
    datos = (np.stack([L, R], 1) / pico * .85 * 32767).astype(np.int16)
    with wave.open(str(destino), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(datos.tobytes())


async def main():
    html = pathlib.Path(sys.argv[1]).resolve(); carpeta = html.parent
    muestras = "--muestras" in sys.argv
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1080, "height": 1920})
        await pg.goto(html.as_uri())
        await pg.wait_for_function("window.LISTO === true", timeout=30000)
        await pg.wait_for_timeout(600)
        dur, cortes, audio, portada = await pg.evaluate("[window.DUR, window.CORTES, window.AUDIO, window.PORTADA]")
        if muestras:
            out = carpeta / "muestras"; shutil.rmtree(out, ignore_errors=True); out.mkdir()
            fin = cortes[1:] + [dur]
            for i, (a, z) in enumerate(zip(cortes, fin)):
                await pg.evaluate(f"render({a + (z - a) * .8})")
                await pg.screenshot(path=str(out / f"escena-{i + 1:02d}.png"))
            print(f"Muestras en {out} ({len(cortes)} escenas, {dur:.1f} s). Revisalas antes de renderizar.")
            await b.close(); return
        await pg.evaluate(f"render({portada})"); await pg.screenshot(path=str(carpeta / "portada.png"))
        cuadros = carpeta / "_cuadros"; shutil.rmtree(cuadros, ignore_errors=True); cuadros.mkdir()
        n = int(round(dur * FPS))
        for i in range(n):
            await pg.evaluate(f"render({i / FPS})")
            await pg.screenshot(path=str(cuadros / f"{i:05d}.jpg"), type="jpeg", quality=92)
        await b.close()
    entrada_audio = []
    if audio != "ninguno":
        musica(carpeta / "_musica.wav", dur, cortes, audio)
        entrada_audio = ["-i", str(carpeta / "_musica.wav")]
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", str(cuadros / "%05d.jpg"), *entrada_audio,
           # tope de bitrate: el grano cambia en cada cuadro y sin tope el archivo pasa los 50 MB (límite de Telegram)
           "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-maxrate", "9M", "-bufsize", "18M", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
    cmd += ["-c:a", "aac", "-b:a", "160k", "-shortest"] if entrada_audio else []
    subprocess.run(cmd + [str(carpeta / "reel.mp4")], check=True)
    shutil.rmtree(cuadros, ignore_errors=True)
    (carpeta / "_musica.wav").unlink(missing_ok=True)
    mb = (carpeta / "reel.mp4").stat().st_size / 1e6
    print(f"Listo: {carpeta / 'reel.mp4'} ({dur:.1f} s, {mb:.1f} MB) + portada.png")


asyncio.run(main())
