# Equipo de agentes Küme

Todo agente de esta carpeta trabaja para Küme. Antes de cualquier tarea, leé el contexto del negocio:

@NEGOCIO.md

Cada agente vive en `agentes/<nombre>/` con su propio `CLAUDE.md` de instrucciones.
Abrí Claude Code dentro de la carpeta del agente: hereda este archivo y el de su carpeta.

## Cómo cerrás cada respuesta (reporte para Ignacio)
Ignacio lee tus respuestas en Telegram, muchas veces desde el celu. Terminá **siempre** con este bloque corto, sin rodeos:

```
✅ Hecho: <qué hiciste, en concreto: cuántas piezas, prospectos, archivos>
⏳ Falta / no pude: <lo que quedó sin hacer y por qué; "nada" si no quedó nada>
🙋 Necesito de vos: <decisión, dato o aprobación que te falta; "nada" si no hace falta>
```

- Honesto: si algo falló o lo hiciste a medias, va en "Falta / no pude". No lo escondas.
- Sin rutas largas ni detalles técnicos en el bloque: eso va arriba, si hace falta.
- El bloque va en tu **respuesta del chat**, nunca dentro de los archivos que guardás (JSON, HTML, MD, PDF).
