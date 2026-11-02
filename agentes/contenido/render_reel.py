# Renderiza un reel de Küme: reel.html (window.REEL) → reel.mp4 (1080×1920, 30 fps, con música y diseño sonoro) + portada.png
# Uso: python render_reel.py salidas/AAAA-MM-DD-slug-reel/reel.html [--muestras] [--rapido]
#   --muestras: solo saca 3 cuadros por escena en muestras/ para revisar el diseño antes de renderizar todo.
# Tarda ~10 min. Si se corta, volvé a correr el mismo comando: sigue donde quedó.
#   --rapido:   sin motion blur; sirve para probar, no para entregar.
# El motion blur es adaptativo: 3 subcuadros en transiciones y recorridos, 2 cuando entra el texto, 1 en lo quieto (ver MUESTRAS en reel-motor.js).
import sys, os, asyncio, subprocess, pathlib, shutil, wave, io, hashlib
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

FPS, SR = 30, 48000
MOTOR = pathlib.Path(__file__).resolve().parent / "assets"


# ------------------------------------------------------------------ audio (todo sintetizado, sin derechos)
def lp(x, fc):
    """Pasabajos de un polo; fc puede variar en el tiempo (array)."""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); v = 0.0
    for i in range(len(x)):
        v += a[i] * (x[i] - v); y[i] = v
    return y


def reverb(x, seg=1.6, decae=.45, seed=7):
    n = int(SR * seg); tt = np.arange(n) / SR
    ir = np.random.default_rng(seed).standard_normal(n) * np.exp(-tt / decae)
    ir[:int(SR * .012)] = 0  # pre-delay
    ir /= np.sqrt((ir ** 2).sum())
    m = 1 << int(np.ceil(np.log2(len(x) + n)))
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[:len(x)]


def nota(n): return 440.0 * 2 ** ((n - 69) / 12)


def poner(dst, src, t0, gan=1.0):
    i = int(t0 * SR)
    if i >= len(dst): return
    a = max(0, i); s = src[a - i:]; s = s[:len(dst) - a]
    dst[a:a + len(s)] += s * gan


def musica(dur, cortes, cierre, bpm, estilo):
    n = int(SR * dur); L = np.zeros(n); Rr = np.zeros(n); t = np.arange(n) / SR
    pulso = 60 / bpm; compas = pulso * 4
    entra = cortes[1] if len(cortes) > 1 else 0          # la batería entra en el primer corte (el "drop")
    corte_bat = (cierre - 4 * pulso) if cierre else None  # un compás sin batería antes del cierre (con riser)
    acordes = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]]  # Am7 Fmaj7 Cmaj7 G(add#11)
    # --- pad: armónicos que se abren con un filtro (cerrado en el gancho, abierto en el drop)
    pad = np.zeros(n)
    for i in range(int(dur / compas) + 1):
        a = i * compas; ac = acordes[i % 4]; m = (t >= a) & (t < a + compas + .6); tt = t[m] - a
        env = np.minimum(tt / .3, 1) * np.exp(-tt * .25)
        for k, nn in enumerate(ac):
            f = nota(nn)
            for h in range(1, 6):
                pad[m] += env * np.sin(2 * np.pi * f * h * tt * (1 + .0015 * k) + k + h) / h * .07
    corte_f = np.interp(t, [0, max(.01, entra - .05), entra, dur], [450, 900, 3200, 2600])
    if corte_bat: corte_f = np.where((t >= corte_bat) & (t < cierre), np.interp(t, [corte_bat, cierre], [2600, 700]), corte_f)
    pad = lp(pad, corte_f)
    # --- bajo y arpegio (pluck)
    bajo = np.zeros(n); pluck_L = np.zeros(n); pluck_R = np.zeros(n)
    paso_b = pulso / 2
    for i in range(int(dur / paso_b) + 1):
        a = i * paso_b
        if a < entra or (corte_bat and corte_bat <= a < cierre): continue
        ac = acordes[int(a // compas) % 4]; f = nota(ac[0] - 24); m = (t >= a) & (t < a + paso_b); tt = t[m] - a
        bajo[m] += (np.sin(2 * np.pi * f * tt) + .3 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt * 5) * .42
    paso_p = pulso / (4 if estilo == "beat" else 2)
    for i in range(int(dur / paso_p) + 1):
        a = i * paso_p
        if a < (entra if estilo == "beat" else 0) or (corte_bat and corte_bat <= a < cierre): continue
        ac = acordes[int(a // compas) % 4]; nn = ac[[0, 2, 1, 3, 2, 1][i % 6]] + 12
        f = nota(nn); m = (t >= a) & (t < a + .45); tt = t[m] - a
        s = sum(np.sin(2 * np.pi * f * h * tt) * np.exp(-tt * (6 + h * 5)) / h for h in range(1, 7)) * .11
        if i % 2: pluck_L[m] += s * .55; pluck_R[m] += s
        else: pluck_L[m] += s; pluck_R[m] += s * .55
    # --- batería
    bat = np.zeros(n); cadena = np.ones(n)
    for i in range(int(dur / pulso) + 1):
        a = i * pulso
        if a < entra - 1e-6 or (corte_bat and corte_bat <= a < cierre - 1e-6): continue
        beat = i % 4
        if estilo == "beat" or beat in (0, 2):
            m = (t >= a) & (t < a + .4); tt = t[m] - a
            bat[m] += np.sin(2 * np.pi * (48 + 110 * np.exp(-tt * 28)) * tt) * np.exp(-tt * 8) * (.95 if estilo == "beat" else .6)
            cadena[m] = np.minimum(cadena[m], 1 - .6 * np.exp(-tt * 9))  # sidechain: todo "respira" con el bombo
        if estilo == "beat" and beat in (1, 3):  # palmas
            m = (t >= a) & (t < a + .25); tt = t[m] - a
            ru = np.random.default_rng(i).standard_normal(m.sum())
            ru = np.diff(ru, prepend=0)
            bat[m] += ru * (np.exp(-tt * 30) + .5 * np.exp(-np.maximum(tt - .012, 0) * 26) * (tt > .012)) * .16
        if estilo == "suave" and beat == 2:  # aro
            m = (t >= a) & (t < a + .08); tt = t[m] - a
            bat[m] += np.sin(2 * np.pi * 1700 * tt) * np.exp(-tt * 60) * .12
        for k, sub in enumerate((.5, .25, .75) if estilo == "beat" else (.5,)):  # platillos
            h = a + pulso * sub
            m = (t >= h) & (t < h + .07); tt = t[m] - h
            ru = np.diff(np.random.default_rng(i * 7 + k).standard_normal(m.sum()), prepend=0)
            bat[m] += ru * np.exp(-tt * (55 if sub == .5 else 90)) * (.1 if sub == .5 else .045)
    L += (pad + bajo) * cadena + pluck_L * cadena + bat
    Rr += (pad + bajo) * cadena + pluck_R * cadena + bat
    env_rev = reverb((pluck_L + pluck_R) * .5, 2.2, .7)
    L += env_rev * .35; Rr += env_rev * .35
    return L, Rr


def efectos(dur, sfx):
    n = int(SR * dur); L = np.zeros(n); Rr = np.zeros(n); rng = np.random.default_rng(3)
    for s in sfx:
        tipo, t0, v = s["tipo"], s["t"], s.get("v", 1)
        if tipo == "golpe":
            tt = np.arange(int(SR * 1.2)) / SR
            sub = np.sin(2 * np.pi * (36 + 34 * np.exp(-tt * 9)) * tt) * np.exp(-tt * 3.2)
            cuerpo = np.sin(2 * np.pi * 120 * tt) * np.exp(-tt * 18) * .5
            clic = rng.standard_normal(len(tt)) * np.exp(-tt * 260) * .6
            x = (sub + cuerpo + clic) * .75 * v; poner(L, x, t0); poner(Rr, x, t0)
        elif tipo in ("whoosh", "riser"):
            d = max(.12, s.get("dur", .4)); tt = np.arange(int(SR * d)) / SR; q = tt / d
            ru = rng.standard_normal(len(tt))
            if tipo == "whoosh":
                env = np.sin(np.pi * np.clip(q, 0, 1) ** .8) ** 2
                fc = 300 + 5200 * np.sin(np.pi * q) ** 1.5
                x = lp(lp(ru, fc), fc) * env * 1.6 * v
                pan = np.clip(q, 0, 1)
                poner(L, x * (1 - .6 * pan), t0); poner(Rr, x * (.4 + .6 * pan), t0)
            else:
                env = q ** 2
                x = lp(ru, 400 + 7000 * q ** 2) * env * .9 + np.sin(2 * np.pi * np.cumsum(180 + 720 * q ** 2) / SR) * env * .12
                x *= v; poner(L, x, t0); poner(Rr, x, t0)
        elif tipo in ("click", "tick", "tecla"):
            f, d, g = {"click": (2300, .03, .35), "tick": (3600, .012, .14), "tecla": (1300, .025, .22)}[tipo]
            if tipo == "tecla": f *= 1 + (rng.random() - .5) * .3
            tt = np.arange(int(SR * d)) / SR
            x = (np.sin(2 * np.pi * f * tt) * np.exp(-tt * 180) + rng.standard_normal(len(tt)) * np.exp(-tt * 600) * .5) * g * v
            pan = rng.random() * .4 + .3; poner(L, x * (1 - pan) * 2, t0); poner(Rr, x * pan * 2, t0)
        elif tipo == "tachon":
            d = .3; tt = np.arange(int(SR * d)) / SR
            ru = np.diff(rng.standard_normal(len(tt)), prepend=0)
            x = lp(ru, 2500 + 6000 * tt / d) * np.sin(np.pi * tt / d) * .5 * v
            poner(L, x, t0); poner(Rr, x, t0)
        elif tipo == "pop":
            tt = np.arange(int(SR * .25)) / SR
            x = np.sin(2 * np.pi * (520 + 500 * (1 - np.exp(-tt * 40))) * tt) * np.exp(-tt * 22) * .35 * v
            poner(L, x, t0); poner(Rr, x, t0)
    rev = reverb((L + Rr) * .5, 1.8, .5, 11)
    return L + rev * .28, Rr + rev * .28


def banda(destino, dur, cortes, cierre, bpm, estilo, sfx):
    L = np.zeros(int(SR * dur)); Rr = np.zeros_like(L)
    if estilo != "ninguno":
        mL, mR = musica(dur, cortes, cierre, bpm, estilo); L += mL * .62; Rr += mR * .62
    eL, eR = efectos(dur, sfx); L += eL * .9; Rr += eR * .9
    t = np.arange(len(L)) / SR
    fade = np.clip(t / .01, 0, 1) * np.clip((dur - t) / .25, 0, 1)
    L = np.tanh(L * fade * 1.1); Rr = np.tanh(Rr * fade * 1.1)
    pico = max(abs(L).max(), abs(Rr).max(), 1e-6)
    datos = (np.stack([L, Rr], 1) / pico * .89 * 32767).astype(np.int16)
    with wave.open(str(destino), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(datos.tobytes())


# ------------------------------------------------------------------ video
async def cuadro(pg, t):
    await pg.evaluate(f"render({max(0.0, t):.5f})")
    return np.asarray(Image.open(io.BytesIO(await pg.screenshot(type="jpeg", quality=95))), dtype=np.uint16)


async def main():
    html = pathlib.Path(sys.argv[1]).resolve(); carpeta = html.parent
    muestras, rapido = "--muestras" in sys.argv, "--rapido" in sys.argv
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1080, "height": 1920})
        await pg.goto(html.as_uri())
        await pg.wait_for_function("window.LISTO === true", timeout=30000)
        await pg.wait_for_timeout(500)
        dur, cortes, audio, portada, bpm, cierre, sfx = await pg.evaluate(
            "[window.DUR, window.CORTES, window.AUDIO, window.PORTADA, window.BPM, window.CIERRE, window.SFX]")
        if muestras:
            out = carpeta / "muestras"; shutil.rmtree(out, ignore_errors=True); out.mkdir()
            fin = cortes[1:] + [dur]
            for i, (a, z) in enumerate(zip(cortes, fin)):
                for j, f in enumerate((.3, .65, .95)):
                    await pg.evaluate(f"render({a + (z - a) * f})")
                    await pg.screenshot(path=str(out / f"escena-{i + 1:02d}-{j + 1}.png"))
            print(f"Muestras en {out} ({len(cortes)} escenas, {dur:.1f} s, cortes al beat de {bpm} bpm). Revisalas antes de renderizar.")
            await b.close(); return
        await pg.evaluate(f"render({portada})"); await pg.screenshot(path=str(carpeta / "portada.png"))
        # reanudable: si el comando se corta (límite de tiempo del agente), volver a correrlo sigue donde quedó.
        # La firma invalida los cuadros viejos si cambió el reel o el motor.
        cuadros = carpeta / "_cuadros"
        firma = hashlib.md5(b"".join(f.read_bytes() for f in (html, MOTOR / "reel-motor.js", MOTOR / "reel-motor.css")) + (b"r" if rapido else b"")).hexdigest()
        if not (cuadros / "firma.txt").exists() or (cuadros / "firma.txt").read_text() != firma:
            shutil.rmtree(cuadros, ignore_errors=True); cuadros.mkdir(); (cuadros / "firma.txt").write_text(firma)
        n = int(round(dur * FPS))
        hechos = [0]

        async def obrero(w, nw):
            # cada obrero es un navegador aparte (un proceso por núcleo): el render pesado va en paralelo
            ctx = await b.new_context(viewport={"width": 1080, "height": 1920})
            pw = await ctx.new_page(); await pw.goto(html.as_uri())
            await pw.wait_for_function("window.LISTO === true", timeout=30000)
            for i in range(w, n, nw):
                if (cuadros / f"{i:05d}.jpg").exists(): hechos[0] += 1; continue
                acc = None
                k = 1 if rapido else await pw.evaluate(f"MUESTRAS({i / FPS:.5f})")
                for o in ([0.0] if k == 1 else [(j / (k - 1) - .5) * .5 / FPS for j in range(k)]):  # obturador 180°
                    f = await cuadro(pw, i / FPS + o)
                    acc = f if acc is None else acc + f
                tmp = cuadros / f"{i:05d}.tmp.jpg"
                Image.fromarray((acc // k).astype(np.uint8)).save(tmp, quality=93); tmp.replace(cuadros / f"{i:05d}.jpg")
                hechos[0] += 1
                if hechos[0] % 60 == 0: print(f"  cuadro {hechos[0]}/{n}", flush=True)
            await ctx.close()

        nw = max(1, min(6, (os.cpu_count() or 2) - 2))
        await asyncio.gather(*(obrero(w, nw) for w in range(nw)))
        await b.close()
    banda(carpeta / "_audio.wav", dur, cortes, cierre, bpm, audio, sfx)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", str(cuadros / "%05d.jpg"), "-i", str(carpeta / "_audio.wav"),
           # tope de bitrate: el grano cambia en cada cuadro y sin tope el archivo pasa los 50 MB (límite de Telegram)
           "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-maxrate", "10M", "-bufsize", "20M", "-pix_fmt", "yuv420p",
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart",
           "-c:a", "aac", "-b:a", "192k", "-shortest", str(carpeta / "reel.mp4")]
    subprocess.run(cmd, check=True)
    shutil.rmtree(cuadros, ignore_errors=True)
    (carpeta / "_audio.wav").unlink(missing_ok=True)
    mb = (carpeta / "reel.mp4").stat().st_size / 1e6
    print(f"Listo: {carpeta / 'reel.mp4'} ({dur:.1f} s, {mb:.1f} MB, {len(sfx)} efectos de sonido) + portada.png")


asyncio.run(main())
