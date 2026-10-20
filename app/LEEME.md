# Küme HQ — la app del equipo de agentes

Abrila con el acceso directo **"Küme HQ"** del Escritorio (o doble clic en `abrir-kume-hq.vbs`).
Se abre en su propia ventana en `http://localhost:4747`. Solo funciona en esta computadora.

## Qué tiene
- **Oficina**: los escritorios de cada agente (Dwight y Jim), su estado y los números del día.
- **Chat con cada agente**: un chat por agente. Por detrás corre Claude Code dentro de la carpeta del agente, así que lee su `CLAUDE.md` y `NEGOCIO.md`. "Chat nuevo" ahorra uso cuando la conversación se hace larga.
- **Para aprobar**: los prospectos de Notion con su mensaje. Aprobar → copiar → enviarlo vos → "Ya lo envié". Nada se envía solo.
- **Propuestas**: cada carpeta de `agentes/propuestas/salidas/`, en qué fase está y sus archivos.

## Configuración (una sola vez)
1. **Iniciar sesión en Claude Code** (para que los agentes respondan desde la app):
   abrí una terminal, escribí `claude`, después `/login`, y seguí los pasos.
2. **Conectar Notion** (para ver y aprobar prospectos):
   - Entrá a https://www.notion.so/profile/integrations → "Nueva integración" (interna) → copiá la clave.
   - Copiá `.env.example` como `.env` y pegá la clave en `NOTION_TOKEN=`.
   - En Notion, abrí "Küme — Equipo de agentes" → `···` → Conexiones → agregá tu integración.
   - Cerrá y volvé a abrir la app.

> ⚠️ El `.env` tiene una clave: no lo compartas ni lo muestres al compartir pantalla.

## Sumar un agente nuevo
1. Crealo como los otros (Paso 4/5 de la guía): carpeta en `agentes/<nombre>/` con su `CLAUDE.md`.
2. Agregalo a `agents.json` con nombre, rol, descripción, carpeta, avatar (SVG en `public/avatars/`) y atajos.
3. Reabrí la app.

## Apagar
El servidor queda corriendo en segundo plano. Para cortarlo: Administrador de tareas → "Node.js" → Finalizar tarea. Se vuelve a prender solo al abrir el acceso directo.
