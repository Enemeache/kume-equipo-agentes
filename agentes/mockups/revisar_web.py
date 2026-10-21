# -*- coding: utf-8 -*-
"""Revisa una web como la vería un cliente desde el celular.
Uso: python revisar_web.py https://ejemplo.com salidas/<negocio>/
Guarda captura (web-celular.png) y datos (web.json) en la carpeta indicada."""
import asyncio
import json
import re
import sys
import time
from pathlib import Path

from playwright.async_api import async_playwright


async def revisar(url: str, out: Path) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    total_bytes = 0
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(**p.devices["iPhone 13"])
        page = await ctx.new_page()

        def contar(resp):
            nonlocal total_bytes
            try:
                total_bytes += int(resp.headers.get("content-length", 0))
            except ValueError:
                pass
        page.on("response", contar)

        t0 = time.time()
        resp = await page.goto(url, wait_until="load", timeout=60000)
        carga = round(time.time() - t0, 1)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(out / "web-celular.png"))

        datos = await page.evaluate("""() => {
          const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.content || "";
          const links = [...document.querySelectorAll('a[href]')].map(a => a.href);
          const vw = document.documentElement.clientWidth;
          const anchoReal = document.documentElement.scrollWidth;
          const h1 = document.querySelector('h1')?.innerText?.trim() || "";
          return {
            titulo: document.title,
            descripcion: meta("description"),
            viewport_mobile: !!document.querySelector('meta[name="viewport"]'),
            scroll_horizontal: anchoReal > vw + 5,
            h1,
            whatsapp: links.some(l => /wa\\.me|whatsapp/i.test(l)),
            instagram: links.some(l => /instagram\\.com/i.test(l)),
            telefono: links.some(l => l.startsWith('tel:')),
            email: links.some(l => l.startsWith('mailto:')),
            formulario: !!document.querySelector('form'),
            imagenes: document.images.length,
            imagenes_sin_alt: [...document.images].filter(i => !i.alt).length,
            anio_copyright: (document.body.innerText.match(/©\\s*(\\d{4})/) || [])[1] || "",
            texto_visible_arriba: document.body.innerText.slice(0, 300),
          };
        }""")
        await browser.close()

    datos.update({
        "url_final": url if resp is None else resp.url,
        "https": url.startswith("https") or (resp is not None and resp.url.startswith("https")),
        "estado_http": None if resp is None else resp.status,
        "segundos_hasta_carga": carga,
        "peso_aprox_mb": round(total_bytes / 1e6, 1),
        "captura": "web-celular.png",
    })
    (out / "web.json").write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")
    return datos


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Uso: python revisar_web.py <url> <carpeta-salida>")
    try:
        print(json.dumps(asyncio.run(revisar(sys.argv[1], Path(sys.argv[2]))), ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
