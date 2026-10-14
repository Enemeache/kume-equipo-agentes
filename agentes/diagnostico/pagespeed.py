# -*- coding: utf-8 -*-
"""Mide una web con Google PageSpeed Insights (celular). Uso: python pagespeed.py https://ejemplo.com
Devuelve puntajes 0-100 y los tiempos clave en lenguaje simple. No necesita clave para uso ocasional."""
import json
import sys
import urllib.parse
import urllib.request

API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"


def medir(url: str) -> dict:
    q = urllib.parse.urlencode([("url", url), ("strategy", "mobile"),
                                ("category", "performance"), ("category", "seo"),
                                ("category", "accessibility"), ("category", "best-practices")])
    with urllib.request.urlopen(f"{API}?{q}", timeout=120) as r:
        d = json.load(r)
    lh = d["lighthouseResult"]
    cats = {k: round(v["score"] * 100) for k, v in lh["categories"].items() if v.get("score") is not None}
    a = lh["audits"]
    return {
        "url": lh.get("finalDisplayedUrl", url),
        "puntajes_celular": cats,
        "primer_contenido_seg": round(a["first-contentful-paint"]["numericValue"] / 1000, 1),
        "carga_principal_seg": round(a["largest-contentful-paint"]["numericValue"] / 1000, 1),
        "tiene_viewport_mobile": a.get("viewport", {}).get("score") == 1,
        "fecha": lh.get("fetchTime"),
    }


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Uso: python pagespeed.py <url>")
    try:
        print(json.dumps(medir(sys.argv[1]), ensure_ascii=False, indent=2))
    except Exception as e:  # sin conexión, cuota o web caída
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
