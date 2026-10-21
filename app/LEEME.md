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

## Mails automáticos a prospectos
Cuando aprobás un mensaje (o el 2º mensaje de Andy) y el prospecto tiene **Email público** en Notion, sale solo por mail.
1. Activá la verificación en 2 pasos de tu Gmail y creá una contraseña de aplicación en https://myaccount.google.com/apppasswords
2. En `app/.env` agregá (completalo vos, no lo pegues en ningún chat):
   ```
   SMTP_USER=tu-mail@gmail.com
   SMTP_PASS=la contraseña de aplicación
   ENVIO_AUTO=1
   ```
   Opcional: `ENVIO_MAX_DIA=20` (tope de mails por día).
3. Reabrí la app. En ✉️ Envíos tiene que decir "Envío automático prendido".

Cómo se cuida:
- Solo sale lo que aprobaste vos.
- Cada mail espera 10 minutos y lo podés cancelar.
- Sale uno cada 2 minutos como mínimo, con un tope diario.
- Nunca se manda dos veces lo mismo.
- Si tiene diagnóstico de Angela, va adjunto.
- Al pie va "si no te interesa, respondé no".
- Los que ya estaban aprobados antes de prenderlo no salen solos: hay un botón aparte.
- Los que no tienen mail quedan en la lista para mandarlos a mano por Instagram o WhatsApp. Esos no se automatizan, por las reglas de esas plataformas.

## Aprobar desde el celu (solo en tu WiFi)
1. En `app/.env` agregá una línea `MOVIL_PIN=` seguida de 6 números o más (inventalos vos).
2. Reabrí la app. En ☀️ Hoy aparece la dirección para el celu (algo como `http://192.168.1.5:4748`).
3. La primera vez, Windows puede preguntar si Node.js puede usar la red: elegí **solo redes privadas**.
4. En el celu, conectado al mismo WiFi, abrí esa dirección y poné el PIN.

Desde el celu solo se puede ver y aprobar o descartar lo pendiente. El chat con los agentes queda solo en la compu.
Fuera de tu WiFi no funciona, y después de 5 PIN mal se bloquea 10 minutos.

## Atajos de la Bandeja
`A` aprobar · `D` descartar o pedir cambios · `E` editar el texto · `→` / `←` siguiente / anterior.

## Sumar un agente nuevo
1. Crealo como los otros (Paso 4/5 de la guía): carpeta en `agentes/<nombre>/` con su `CLAUDE.md`.
2. Agregalo a `agents.json` con nombre, rol, descripción, carpeta, avatar (SVG en `public/avatars/`) y atajos.
3. Reabrí la app.

## Apagar
El servidor queda corriendo en segundo plano. Para cortarlo: Administrador de tareas → "Node.js" → Finalizar tarea. Se vuelve a prender solo al abrir el acceso directo.
