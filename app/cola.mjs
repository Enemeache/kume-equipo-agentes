// Cola de envío de mails: manda SOLO lo que Ignacio o Delfi aprobaron en la app.
// - Se prende con ENVIO_AUTO=1 + SMTP_USER/SMTP_PASS en .env.
// - Cada mail espera 10 minutos antes de salir (se puede cancelar desde la app).
// - Máximo ENVIO_MAX_DIA por día (20 por defecto) y al menos 2 minutos entre mails.
// - Nunca manda dos veces lo mismo, y todo queda anotado en data/envios.json.
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { sendMail, smtpConfig } from "./envio.mjs";

const ESPERA_MS = 10 * 60e3, ENTRE_MS = 2 * 60e3;
const PIE = "\n\n—\nIgnacio · Küme, agencia creativa\nhttps://kume-website.vercel.app/\n\nSi no te interesa, respondé \"no\" y no te volvemos a escribir.";

export function crearCola({ DATA, notion, agentDir, agents, emitir }) {
  const archivo = path.join(DATA, "envios.json");
  let estado = { cola: [], enviados: [], errores: [] };
  const cargar = async () => { try { estado = JSON.parse(await readFile(archivo, "utf8")); } catch {} };
  const guardar = () => writeFile(archivo, JSON.stringify(estado, null, 2));
  const activa = () => process.env.ENVIO_AUTO === "1" && !!smtpConfig();
  const maxDia = () => Number(process.env.ENVIO_MAX_DIA || 20);
  const hoy = () => new Date().toLocaleDateString("sv-SE");
  const yaEnviado = (id, tipo) => estado.enviados.some((e) => e.id === id && e.tipo === tipo);

  // p = prospecto ya mapeado (con email); tipo = "mensaje" | "seguimiento"
  async function encolar(p, tipo) {
    if (!activa()) return { encolado: false, motivo: "envío automático apagado" };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email || "")) return { encolado: false, motivo: "sin mail" };
    const texto = tipo === "seguimiento" ? p.seguimiento : p.mensaje;
    if (!texto) return { encolado: false, motivo: "sin texto" };
    if (yaEnviado(p.id, tipo) || estado.cola.some((c) => c.id === p.id && c.tipo === tipo)) return { encolado: false, motivo: "ya estaba" };
    const diag = (p.fuentes.match(/diagnostico\/salidas\/([^/\s]+)\/diagnostico\.pdf/) || [])[1];
    estado.cola.push({
      id: p.id, tipo, negocio: p.negocio, para: p.email, texto,
      asunto: (tipo === "seguimiento" ? "Re: " : "") + `Una idea para ${p.negocio}`,
      adjunto: diag && tipo === "mensaje" ? diag : null,
      sale: Date.now() + ESPERA_MS, creado: new Date().toISOString(),
    });
    await guardar(); emitir({ tipo: "envio", accion: "encolado", negocio: p.negocio });
    return { encolado: true };
  }

  async function cancelar(id, tipo) {
    const n = estado.cola.length;
    estado.cola = estado.cola.filter((c) => !(c.id === id && (!tipo || c.tipo === tipo)));
    await guardar(); return n !== estado.cola.length;
  }

  let trabajando = false, ultimo = 0;
  async function tick() {
    if (trabajando || !activa()) return;
    const listo = estado.cola.find((c) => c.sale <= Date.now());
    if (!listo || Date.now() - ultimo < ENTRE_MS) return;
    if (estado.enviados.filter((e) => e.fecha.startsWith(hoy())).length >= maxDia()) return;
    trabajando = true;
    try {
      const attachments = [];
      if (listo.adjunto) {
        const f = path.join(agentDir(agents.find((a) => a.id === "diagnostico")), "salidas", listo.adjunto, "diagnostico.pdf");
        if (existsSync(f)) attachments.push({ path: f, name: `Diagnóstico ${listo.negocio}.pdf` });
      }
      await sendMail({ to: listo.para, subject: listo.asunto, text: listo.texto + PIE, attachments });
      estado.cola = estado.cola.filter((c) => c !== listo);
      estado.enviados.unshift({ id: listo.id, tipo: listo.tipo, negocio: listo.negocio, para: listo.para, asunto: listo.asunto, fecha: new Date().toISOString() });
      ultimo = Date.now();
      await guardar();
      await notion("PATCH", `pages/${listo.id}`, { properties: { Estado: { select: { name: "Contactado" } } } });
      emitir({ tipo: "envio", accion: "enviado", negocio: listo.negocio });
    } catch (e) {
      // se saca de la cola para no reintentar en loop; queda el error a la vista
      estado.cola = estado.cola.filter((c) => c !== listo);
      estado.errores.unshift({ id: listo.id, tipo: listo.tipo, negocio: listo.negocio, error: e.message, fecha: new Date().toISOString() });
      await guardar(); emitir({ tipo: "envio", accion: "error", negocio: listo.negocio, error: e.message });
    } finally { trabajando = false; }
  }

  cargar().then(() => setInterval(tick, 20000));
  return {
    encolar, cancelar,
    estado: () => ({ activa: activa(), smtp: !!smtpConfig(), maxDia: maxDia(), enviadosHoy: estado.enviados.filter((e) => e.fecha.startsWith(hoy())).length, ...estado }),
  };
}
