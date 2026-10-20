# Küme — Equipo de agentes de IA

El equipo de agentes de [Küme](https://kume-website.vercel.app/), armado con Claude Code siguiendo los 6 pasos de la guía *"Crea tu equipo de agentes con IA"*.
Demo pública: **https://kume-website.vercel.app/hq/**

## El equipo
| Agente | Rol | Carpeta |
|---|---|---|
| **Dwight** | Busca prospectos, los investiga y escribe el primer mensaje | `agentes/prospectos/` |
| **Angela** | Diagnóstico gratis de presencia digital (PDF de 2 páginas) | `agentes/diagnostico/` |
| **Jim** | Propuestas comerciales 100% a medida (HTML + PDF) | `agentes/propuestas/` |
| **Pam** | Calendario, textos y diseño del Instagram de Küme | `agentes/contenido/` |
| **Oscar** | Reporte mensual de métricas por cliente | `agentes/reportes/` |

Regla de oro: **ningún agente publica ni envía nada sin aprobación de Ignacio o Delfi.**

## Estructura
```
NEGOCIO.md        contexto del negocio que leen todos los agentes
CLAUDE.md         carga NEGOCIO.md en cada agente
MAPA.md           resumen del equipo (el mapa completo vive en Notion)
agentes/<rol>/    CLAUDE.md con las instrucciones de cada agente + scripts + salidas/
app/              Küme HQ: app local para hablar con los agentes y aprobar (Node, sin dependencias)
demo-venta/       demo interactiva para mostrar a clientes (HTML único)
```

## Usar un agente
Abrí Claude Code dentro de la carpeta del agente (por ejemplo `agentes/propuestas/`) o usá la app.

## App Küme HQ
```bash
node app/server.mjs
```
Se abre en http://localhost:4747. Necesita:
1. Claude Code con sesión iniciada (`claude` → `/login`).
2. `app/.env` con `NOTION_TOKEN=` de una integración interna de Notion conectada a la página "Küme — Equipo de agentes" (ver `app/LEEME.md`). El `.env` **no se sube** al repositorio.

Los scripts de PDF e imágenes usan Python + Playwright (`pip install playwright` y `playwright install chromium`).
