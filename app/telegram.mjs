// Bot de Telegram de Küme HQ: la oficina te va contando lo que hace y podés aprobar desde ahí.
// - Se prende con TELEGRAM_TOKEN=<token de @BotFather> en .env.
// - Usa "long polling": la compu le pregunta a Telegram, no abre ningún puerto.
// - Solo atiende al chat que se vinculó con el código que muestra la app (☀️ Hoy).
// - Aprobar y descartar pasan por el servidor local, igual que desde la app (incluida la cola de mails).
import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const corto = (s, n) => (String(s ?? "").length > n ? String(s).slice(0, n - 1) + "…" : String(s ?? ""));
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export function iniciarTelegram({ DATA, agents, agentDir, PORT, suscriptores }) {
  const TOKEN = process.env.TELEGRAM_TOKEN;
  if (!TOKEN) return null;
  const API = `${process.env.TELEGRAM_API || "https://api.telegram.org"}/bot${TOKEN}`; // TELEGRAM_API solo para pruebas
  const LOCAL = `http://127.0.0.1:${PORT}`;
  const archivo = path.join(DATA, "telegram.json");
  let est = { chatId: null, codigo: null, offset: 0, avisados: [], resumenDia: null };
  let bot = null; // {username}

  const guardar = () => writeFile(archivo, JSON.stringify(est, null, 2));
  const agente = (id) => agents.find((a) => a.id === id) || { nombre: id, rol: "" };
  const local = (url, opt) => fetch(LOCAL + url, opt).then((r) => r.json()).catch(() => ({}));

  // ---------- llamadas a Telegram, en fila para no pasar el límite ----------
  let fila = Promise.resolve();
  function tg(metodo, cuerpo, esArchivo = false) {
    const tarea = fila.then(async () => {
      for (let intento = 0; intento < 3; intento++) {
        const r = await fetch(`${API}/${metodo}`, esArchivo ? { method: "POST", body: cuerpo } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) }).then((x) => x.json()).catch((e) => ({ ok: false, description: e.message }));
        if (r.ok) { await dormir(350); return r.result; }
        if (r.parameters?.retry_after) { await dormir(r.parameters.retry_after * 1000 + 200); continue; }
        if (!/message is not modified/.test(r.description || "")) console.log(`Telegram ${metodo}: ${r.description}`);
        return null;
      }
    });
    fila = tarea.catch(() => {});
    return tarea;
  }
  const decir = (texto, extra = {}) => est.chatId && tg("sendMessage", { chat_id: est.chatId, text: corto(texto, 4000), parse_mode: "HTML", disable_web_page_preview: true, ...extra });

  async function mandarFotos(rutas, caption) {
    if (!est.chatId || !rutas.length) return;
    for (let i = 0; i < rutas.length; i += 10) {
      const grupo = rutas.slice(i, i + 10), fd = new FormData();
      fd.append("chat_id", est.chatId);
      const media = [];
      for (const [k, f] of grupo.entries()) {
        fd.append(`f${k}`, new Blob([await readFile(f)]), path.basename(f));
        media.push({ type: "photo", media: `attach://f${k}`, ...(i === 0 && k === 0 && caption ? { caption: corto(caption, 1000), parse_mode: "HTML" } : {}) });
      }
      if (grupo.length === 1) {
        const f1 = new FormData(); f1.append("chat_id", est.chatId); f1.append("photo", new Blob([await readFile(grupo[0])]), path.basename(grupo[0]));
        if (i === 0 && caption) { f1.append("caption", corto(caption, 1000)); f1.append("parse_mode", "HTML"); }
        await tg("sendPhoto", f1, true);
      } else { fd.append("media", JSON.stringify(media)); await tg("sendMediaGroup", fd, true); }
    }
  }
  async function mandarDoc(ruta, caption) {
    if (!est.chatId || !existsSync(ruta)) return;
    const fd = new FormData(); fd.append("chat_id", est.chatId);
    fd.append("document", new Blob([await readFile(ruta)]), path.basename(ruta));
    if (caption) { fd.append("caption", corto(caption, 1000)); fd.append("parse_mode", "HTML"); }
    await tg("sendDocument", fd, true);
  }
  // todas las slides de la carpeta de un carrusel, en orden
  async function slidesDe(dir) {
    return (await readdir(dir).catch(() => [])).filter((f) => /^slide-\d+\.png$/i.test(f)).sort().map((f) => path.join(dir, f));
  }

  // ---------- Tarjetas para aprobar ----------
  const botones = (filas) => ({ reply_markup: { inline_keyboard: filas } });
  async function tarjetaProspecto(p, tipo) {
    const seg = tipo === "seguimiento", txt = seg ? p.seguimiento : p.mensaje;
    const cab = `${seg ? "🔁 <b>2º mensaje de Andy</b>" : "🔎 <b>Dwight encontró un prospecto</b>"}\n<b>${esc(p.negocio)}</b> · ${esc(p.rubro)} · ${esc(p.zona)} · ${esc(p.puntaje)}\n${p.instagram ? `<a href="${esc(p.instagram)}">Instagram</a> ` : ""}${p.web ? `<a href="${esc(p.web)}">Web</a> ` : ""}${p.email ? "✉️ tiene mail" : "sin mail"}\n\n<i>${esc(corto(p.oportunidad, 400))}</i>\n\n<b>Mensaje:</b>\n${esc(corto(txt, 2500))}`;
    await decir(cab, botones([[{ text: seg ? "✅ Aprobar y enviado" : "✅ Aprobar", callback_data: `a:${seg ? "s" : "p"}:${p.id}` }, { text: "🗑️ Descartar", callback_data: `d:p:${p.id}` }]]));
    const diag = (p.fuentes.match(/diagnostico\/salidas\/([^/\s]+)\/diagnostico\.pdf/) || [])[1];
    if (diag && !seg) await mandarDoc(path.join(agentDir(agente("diagnostico")), "salidas", diag, "diagnostico.pdf"), `📄 Diagnóstico de Angela para ${esc(p.negocio)}`);
  }
  async function tarjetaContenido(c) {
    const dir = c.carpeta ? path.join(agentDir(agente("contenido")), "salidas", c.carpeta) : null;
    const slides = dir ? await slidesDe(dir) : [];
    if (slides.length) await mandarFotos(slides, `🎨 <b>${esc(c.pieza)}</b> · ${esc(c.formato)} · ${esc(c.fecha)}`);
    await decir(`🎨 <b>Pam: pieza para aprobar</b>\n<b>${esc(c.pieza)}</b> · ${esc(c.formato)} · ${esc(c.fecha)} · ${esc(c.pilar)}\n${slides.length ? "" : `\n<b>Guion:</b>\n${esc(corto(c.guion, 1500))}\n`}\n<b>Caption:</b>\n${esc(corto(c.caption, 1800))}\n\n${esc(c.hashtags)}`,
      botones([[{ text: "✅ Aprobar", callback_data: `a:c:${c.id}` }, { text: "✏️ Pedir cambios", callback_data: `d:c:${c.id}` }]]));
  }
  async function pendientes() {
    const [p, c] = await Promise.all([local("/api/prospectos"), local("/api/contenido")]);
    const pros = p.items || [], cont = c.items || [];
    return [
      ...pros.filter((x) => x.estado === "Mensaje listo").map((x) => ({ k: `p:${x.id}`, f: () => tarjetaProspecto(x, "mensaje") })),
      ...pros.filter((x) => x.estado === "Seguimiento listo").map((x) => ({ k: `s:${x.id}`, f: () => tarjetaProspecto(x, "seguimiento") })),
      ...cont.filter((x) => x.estado === "Para aprobar").map((x) => ({ k: `c:${x.id}`, f: () => tarjetaContenido(x) })),
    ];
  }
  // cada 3 minutos: lo nuevo para aprobar llega solo
  async function revisarNuevos() {
    if (!est.chatId) return;
    const lista = await pendientes(), nuevos = lista.filter((x) => !est.avisados.includes(x.k));
    if (!nuevos.length) return;
    await decir(`📥 <b>${nuevos.length} cosa${nuevos.length > 1 ? "s" : ""} nueva${nuevos.length > 1 ? "s" : ""} para aprobar</b>`);
    for (const n of nuevos.slice(0, 8)) { await n.f(); est.avisados.push(n.k); }
    if (nuevos.length > 8) await decir(`…y ${nuevos.length - 8} más. Mandá /pendientes para verlas.`);
    est.avisados = est.avisados.slice(-500); await guardar();
  }

  async function resumen() {
    const [p, c, ag, env] = await Promise.all([local("/api/prospectos"), local("/api/contenido"), local("/api/agents"), local("/api/envios")]);
    const pros = p.items || [], cont = c.items || [];
    const cuenta = (e) => pros.filter((x) => x.estado === e).length;
    const trabajando = (Array.isArray(ag) ? ag : []).filter((a) => a.ocupado).map((a) => a.nombre);
    return decir(`☀️ <b>Resumen de Küme HQ</b>
📥 Para aprobar: <b>${cuenta("Mensaje listo")}</b> mensajes · <b>${cuenta("Seguimiento listo")}</b> seguimientos · <b>${cont.filter((x) => x.estado === "Para aprobar").length}</b> piezas
🎉 Respondieron: <b>${cuenta("Respondió") + cuenta("Consulta agendada")}</b> · Clientes: <b>${cuenta("Cliente")}</b>
📈 Prospectos: ${pros.length} encontrados · ${cuenta("Contactado")} contactados
✉️ Mails: ${env.cola?.length || 0} en cola · ${env.enviadosHoy || 0} enviados hoy${env.activa ? "" : " (envío automático apagado)"}
💻 Trabajando ahora: ${trabajando.length ? esc(trabajando.join(", ")) : "nadie"}

/pendientes para aprobar · /oficina para ver a todos`);
  }
  async function oficina() {
    const ag = await local("/api/agents");
    return decir(`🏢 <b>La oficina</b>\n${(Array.isArray(ag) ? ag : []).map((a) => `${a.ocupado ? "💻" : "🟢"} <b>${esc(a.nombre)}</b> · ${esc(a.rol)}${a.ocupado ? " · <i>trabajando</i>" : ""}`).join("\n")}`);
  }

  // ---------- Lo que hacen los agentes, en vivo ----------
  const vivos = new Map(); // agente → {msgId, pasos, ultimaEdicion, pedido, origen}
  async function editarVivo(id, final) {
    const v = vivos.get(id); if (!v?.msgId) return;
    const a = agente(id);
    const texto = `${final ? final.icono : "⏳"} <b>${esc(a.nombre)}</b> (${esc(a.rol)})${v.origen === "rutina" ? " · rutina automática" : ""}\n<b>Pedido:</b> <i>${esc(corto(v.pedido, 300))}</i>\n\n<b>Cómo lo está armando:</b>\n${v.pasos.slice(-12).map((t) => "• " + esc(t)).join("\n") || "• Arrancando…"}${final ? `\n\n${final.texto}` : ""}`;
    v.ultimaEdicion = Date.now();
    await tg("editMessageText", { chat_id: est.chatId, message_id: v.msgId, text: corto(texto, 4000), parse_mode: "HTML", disable_web_page_preview: true });
  }
  async function alEvento(ev) {
    if (!est.chatId) return;
    if (ev.tipo === "inicio") {
      const v = { pasos: [], pedido: ev.pedido || "", origen: ev.origen, ultimaEdicion: 0, msgId: null };
      vivos.set(ev.agente, v);
      const m = await decir(`⏳ <b>${esc(ev.nombre)}</b> empezó${ev.origen === "rutina" ? " (rutina automática)" : ""}\n<b>Pedido:</b> <i>${esc(corto(ev.pedido, 300))}</i>`);
      v.msgId = m?.message_id;
    }
    if (ev.tipo === "progreso") {
      const v = vivos.get(ev.agente); if (!v) return;
      v.pasos.push(ev.texto);
      // como mucho una edición cada 4 segundos por agente
      if (Date.now() - v.ultimaEdicion > 4000) await editarVivo(ev.agente);
    }
    if (ev.tipo === "fin") {
      await editarVivo(ev.agente, { icono: ev.ok ? "✅" : "⚠️", texto: ev.ok ? `<b>Terminó.</b> ${esc(corto(ev.resumen, 140))}` : `<b>No pudo terminar:</b> ${esc(corto(ev.resumen, 200))}` });
      vivos.delete(ev.agente);
      await mandarEntregas(ev.agente, ev.archivos || []);
      setTimeout(revisarNuevos, 15000); // lo que dejó para aprobar llega enseguida
    }
    if (ev.tipo === "envio") {
      const t = { encolado: `✉️ En cola: ${esc(ev.negocio)} (sale en 10 minutos)`, enviado: `✅ Mail enviado a <b>${esc(ev.negocio)}</b>`, error: `⚠️ No se pudo mandar el mail a ${esc(ev.negocio)}: ${esc(ev.error)}` }[ev.accion];
      if (t) await decir(t);
    }
  }
  // muestra lo que armó: carruseles como álbum, PDF como documento
  async function mandarEntregas(id, archivos) {
    const base = path.join(agentDir(agente(id)), "salidas"), carpetas = new Set();
    for (const r of archivos.slice(0, 12)) {
      const full = path.join(base, r);
      if (/\.png$/i.test(r)) {
        const dir = path.dirname(full); if (carpetas.has(dir)) continue; carpetas.add(dir);
        if (carpetas.size > 3) continue;
        const slides = await slidesDe(dir);
        await mandarFotos(slides.length ? slides : [full], `🖼️ ${esc(agente(id).nombre)}: <b>${esc(path.basename(dir))}</b>`);
      } else if (/\.pdf$/i.test(r)) await mandarDoc(full, `📄 ${esc(agente(id).nombre)}: ${esc(r)}`);
    }
  }

  // ---------- Comandos y botones ----------
  async function alMensaje(msg) {
    const texto = (msg.text || "").trim(), chat = msg.chat.id;
    if (!est.chatId) {
      const cod = texto.replace(/^\/start\s*/, "").trim().toUpperCase();
      if (cod && cod === est.codigo) {
        est.chatId = chat; est.codigo = null; await guardar();
        await decir(`👋 ¡Listo! Este chat quedó vinculado a Küme HQ.\n\nTe voy a contar qué hace el equipo mientras trabaja, te mando lo que hay para aprobar (con las imágenes) y un resumen cada mañana.\n\n/resumen · /pendientes · /oficina · /ayuda`);
        await revisarNuevos();
      } else await tg("sendMessage", { chat_id: chat, text: "Este bot es privado. Para vincularlo, abrí ☀️ Hoy en Küme HQ y usá el enlace o el código que aparece ahí." });
      return;
    }
    if (chat !== est.chatId) return; // cualquier otro chat se ignora
    const cmd = texto.split(/[\s@]/)[0].toLowerCase();
    if (cmd === "/resumen" || cmd === "/start") return resumen();
    if (cmd === "/oficina") return oficina();
    if (cmd === "/pendientes") {
      const lista = await pendientes();
      if (!lista.length) return decir("🎉 No hay nada pendiente.");
      await decir(`📥 <b>${lista.length} para aprobar</b>`);
      for (const n of lista.slice(0, 10)) { await n.f(); if (!est.avisados.includes(n.k)) est.avisados.push(n.k); }
      await guardar(); return;
    }
    if (cmd === "/envios") {
      const e = await local("/api/envios");
      return decir(`✉️ <b>Mails</b> ${e.activa ? "(automático prendido)" : "(automático apagado)"}\nEn cola: ${(e.cola || []).map((c) => esc(c.negocio)).join(", ") || "nada"}\nÚltimos enviados: ${(e.enviados || []).slice(0, 5).map((c) => esc(c.negocio)).join(", ") || "ninguno"}`);
    }
    return decir(`Comandos:\n/resumen — cómo viene todo\n/pendientes — lo que hay para aprobar, con botones\n/oficina — quién está trabajando\n/envios — mails en cola y enviados\n\nPara pedirle algo a un agente, usá la app en la compu.`);
  }
  async function alBoton(q) {
    if (q.message?.chat?.id !== est.chatId) return tg("answerCallbackQuery", { callback_query_id: q.id, text: "Bot privado" });
    const [acc, tipo, id] = String(q.data || "").split(":");
    const estado = { "a:p": "Aprobado", "a:s": "Contactado", "d:p": "Descartado", "a:c": "Aprobado", "d:c": "Borrador" }[`${acc}:${tipo}`];
    if (!estado || !/^[\w-]{32,36}$/.test(id || "")) return tg("answerCallbackQuery", { callback_query_id: q.id, text: "Botón no válido" });
    const url = tipo === "c" ? `/api/contenido/${id}` : `/api/prospectos/${id}`;
    const r = await local(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado }) });
    const ok = r.ok;
    const etiqueta = !ok ? `⚠️ No se pudo: ${r.error || "error"}` : estado === "Borrador" ? "✏️ Pedido de cambios. Contale a Pam qué cambiar desde la app." : estado === "Descartado" ? "🗑️ Descartado" : r.envio?.encolado ? "✅ Aprobado · ✉️ sale por mail en 10 min" : r.envio?.motivo === "sin mail" ? "✅ Aprobado · sin mail: mandalo a mano" : "✅ Aprobado";
    await tg("answerCallbackQuery", { callback_query_id: q.id, text: corto(etiqueta, 190) });
    if (ok) await tg("editMessageReplyMarkup", { chat_id: est.chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [[{ text: etiqueta.slice(0, 60), callback_data: "x:x:x" }]] } });
  }

  async function escuchar() {
    for (;;) {
      const r = await fetch(`${API}/getUpdates?timeout=50&offset=${est.offset}&allowed_updates=${encodeURIComponent('["message","callback_query"]')}`).then((x) => x.json()).catch(() => null);
      if (!r?.ok) { if (r?.error_code === 401) { console.log("Telegram: el TELEGRAM_TOKEN no es válido."); return; } await dormir(5000); continue; }
      for (const u of r.result) {
        est.offset = u.update_id + 1;
        try { if (u.message) await alMensaje(u.message); if (u.callback_query) await alBoton(u.callback_query); } catch (e) { console.log("Telegram:", e.message); }
      }
      if (r.result.length) await guardar();
    }
  }

  // resumen diario a las 9
  async function relojDiario() {
    const ahora = new Date(), hoy = ahora.toLocaleDateString("sv-SE");
    if (est.chatId && ahora.getHours() >= 9 && est.resumenDia !== hoy) { est.resumenDia = hoy; await guardar(); await resumen(); }
  }

  (async () => {
    try { est = { ...est, ...JSON.parse(await readFile(archivo, "utf8")) }; } catch {}
    if (!est.chatId && !est.codigo) { est.codigo = randomBytes(3).toString("hex").toUpperCase(); await guardar(); }
    bot = await tg("getMe", {});
    if (!bot) return;
    console.log(`Telegram: @${bot.username} ${est.chatId ? "vinculado" : "esperando vinculación"}`);
    suscriptores.add((ev) => { alEvento(ev).catch(() => {}); });
    escuchar();
    setInterval(revisarNuevos, 3 * 60e3);
    setInterval(relojDiario, 5 * 60e3); relojDiario();
  })();

  return {
    estado: () => ({ activo: !!bot, usuario: bot?.username || null, vinculado: !!est.chatId, codigo: est.chatId ? null : est.codigo }),
    async desvincular() { est.chatId = null; est.avisados = []; est.codigo = randomBytes(3).toString("hex").toUpperCase(); await guardar(); },
  };
}
