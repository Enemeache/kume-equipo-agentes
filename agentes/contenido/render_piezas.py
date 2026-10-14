# -*- coding: utf-8 -*-
"""Exporta cada elemento .slide de un HTML a PNG. Uso: python render_piezas.py salidas/<carpeta>/piezas.html"""
import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright


async def main(html: Path):
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1200, "height": 2000})
        await page.goto(html.resolve().as_uri(), wait_until="networkidle")
        await page.evaluate("document.fonts.ready")
        slides = await page.query_selector_all(".slide")
        for i, s in enumerate(slides, 1):
            out = html.parent / f"slide-{i:02d}.png"
            await s.screenshot(path=str(out))
            print(f"OK {out.name}")
        await browser.close()
    print(f"{len(slides)} piezas exportadas en {html.parent}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Uso: python render_piezas.py <archivo.html>")
    asyncio.run(main(Path(sys.argv[1])))
