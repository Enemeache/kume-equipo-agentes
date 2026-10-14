# -*- coding: utf-8 -*-
"""Exporta una propuesta HTML a PDF A4. Uso: python generar_pdf.py salidas/<cliente>/propuesta.html"""
import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright


async def main(html: Path):
    pdf = html.with_suffix(".pdf")
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto(html.resolve().as_uri(), wait_until="networkidle")
        await page.pdf(path=str(pdf), format="A4", print_background=True,
                       margin={"top": "0", "right": "0", "bottom": "0", "left": "0"})
        await browser.close()
    print(f"OK - PDF generado: {pdf}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Uso: python generar_pdf.py <archivo.html>")
    asyncio.run(main(Path(sys.argv[1])))
