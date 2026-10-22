// Küme HQ — servidor local (sin dependencias). Uso: node server.mjs
import http from "node:http";
import { readFile, writeFile, readdir, stat, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPiloto } from "./piloto.mjs";
import { zip } from "./zip.mjs";
import { iniciarMovil } from "./movil.mjs";
import { crearCola } from "./cola.mjs";
import { iniciarTelegram } from "./telegram.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4747;
const PUBLIC = path.join(DIR, "public");
const DATA = path.join(DIR, "data");
const PROSPECTOS_DS = "634cf749-0bd2-4a14-85d9-e1860b74b3a8";
const NOTION_VERSION = "2025-09-03";

// .env mínimo (NOTION_TOKEN=...)
const envPath = path.join(DIR, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const agents = JSON.parse(await readFile(path.join(DIR, "agents.json"), "utf8"));
const agentDir = (a) => path.resolve(DIR, a.carpeta);
await mkdir(path.join(DATA, "chats"), { recursive: true });

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4", ".mov": "video/quicktime", ".md": "text/plain; charset=utf-8" };

const json = (res, code, body) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((ok) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch { ok({}); } }); });

async function sendFile(res, file) {
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404); res.end("No encontrado"); }
}

// ---------- Chats (un chat por agente, como recomienda la guía) ----------
const chatFile = (id) => path.join(DATA, "chats", `${id}.json`);
async function loadChat(id) {
  try { return JSON.parse(await readFile(chatFile(id), "utf8")); } catch { return { sessionId: null, messages: [] }; }
}
const saveChat = (id, chat) => writeFile(chatFile(id), JSON.stringify(chat, null, 2));
const running = new Set();

// ---------- Eventos en vivo (Server-Sent Events) para la app ----------
const oyentes = new Set(), suscriptores = new Set();
function emitir(ev) {
  for (const f of suscriptores) { try { f(ev); } catch {} }
  const data = `data: ${JSON.stringify({ ...ev, fecha: new Date().toISOString() })}\n\n`;
  for (const res of oyentes) { try { res.write(data); } catch {} }
}

// Traduce lo que hace el agente a una frase entendible
function describir(tool, input = {}) {
  const base = (f) => String(f || "").split(/[\/]/).pop();
  switch (tool) {
    case "WebSearch": return `🔎 Buscando "${String(input.query || "").slice(0, 60)}"`;
    case "WebFetch": try { return `🌐 Leyendo ${new URL(input.url).hostname}`; } catch { return "🌐 Leyendo una página"; }
    case "Read": return `📖 Leyendo ${base(input.file_path)}`;
    case "Write": return `✍️ Escribiendo ${base(input.file_path)}`;
    case "Edit": return `✏️ Corrigiendo ${base(input.file_path)}`;
    case "Glob": case "Grep": return "🗂️ Revisando archivos";
    case "Bash": {
      const c = String(input.command || "");
      if (c.includes("generar_pdf")) return "📄 Armando el PDF";
      if (c.includes("render_piezas")) return "🎨 Exportando las imágenes";
      if (c.includes("revisar_web")) return "📱 Abriendo la web como un celular";
      if (c.includes("pagespeed")) return "⏱️ Midiendo la velocidad de la web";
      return "⚙️ Corriendo una herramienta";
    }
    default: return `⚙️ ${tool}`;
  }
}

// Archivos que el agente creó o cambió durante el pedido
async function archivosNuevos(agent, desde) {
  const base = path.join(agentDir(agent), "salidas"), out = [];
  async function walk(dir, rel = "", depth = 0) {
    for (const f of await readdir(dir).catch(() => [])) {
      const full = path.join(dir, f), st = await stat(full).catch(() => null); if (!st) continue;
      const r = rel ? `${rel}/${f}` : f;
      if (st.isDirectory()) { if (depth < 2) await walk(full, r, depth + 1); }
      else if (st.mtimeMs >= desde && /\.(md|html|pdf|png|csv|json)$/i.test(f) && !/importado/.test(f)) out.push(r);
    }
  }
  await walk(base);
  // si hay muchas PNG de un mismo carrusel, mostramos solo la primera
  const vistos = new Set();
  return out.sort().filter((r) => { const k = r.replace(/slide-\d+\.png$/, "slide"); if (/slide-\d+\.png$/.test(r)) { if (vistos.has(k)) return false; vistos.add(k); } return true; }).slice(0, 12);
}

// Registro de uso (para el medidor)
const usoFile = path.join(DATA, "uso.json");
async function registrarUso(entry) {
  let uso = []; try { uso = JSON.parse(await readFile(usoFile, "utf8")); } catch {}
  uso.unshift(entry); await writeFile(usoFile, JSON.stringify(uso.slice(0, 2000)));
}

function runClaude(agent, message, sessionId, origen = "chat") {
  const args = [
    "-p", message,
    "--output-format", "stream-json", "--verbose",
    "--permission-mode", "acceptEdits",
    "--allowedTools", "Read,Write,Edit,Glob,Grep,WebSearch,WebFetch,Bash(python generar_pdf.py:*),Bash(python render_piezas.py:*),Bash(python revisar_web.py:*),Bash(python pagespeed.py:*)",
    // pueden leer y escribir en todo el equipo (Kume/) y leer la web de Küme (para el blog)
    "--add-dir", path.resolve(DIR, ".."), "--add-dir", path.resolve(DIR, "../../web"),
  ];
  if (sessionId) args.push("--resume", sessionId);
  const t0 = Date.now();
  emitir({ tipo: "inicio", agente: agent.id, nombre: agent.nombre, origen, pedido: String(message).split("\n\nArchivos adjuntos")[0].slice(0, 300) });
  return new Promise((resolve) => {
    // Cada agente corre como un Claude Code normal: sin variables heredadas de otra sesión de Claude.
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CLAUDE|ANTHROPIC_BASE_URL)/.test(k)));
    const p = spawn("claude", args, { cwd: agentDir(agent), windowsHide: true, env });
    let buf = "", err = "", final = null, ultimo = "";
    p.stdout.on("data", (d) => {
      buf += d; let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === "assistant") {
          for (const c of ev.message?.content || []) {
            if (c.type === "tool_use") { const txt = describir(c.name, c.input); if (txt !== ultimo) { ultimo = txt; emitir({ tipo: "progreso", agente: agent.id, texto: txt }); } }
          }
        }
        if (ev.type === "result") final = ev;
      }
    });
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => resolve({ ok: false, text: `No pude abrir Claude Code: ${e.message}` }));
    p.on("close", async () => {
      if (!final && buf.trim()) { try { final = JSON.parse(buf.trim()); } catch {} }
      const archivos = await archivosNuevos(agent, t0 - 2000);
      let r;
      if (!final) r = { ok: false, text: `Error al correr el agente.\n${(err || buf).slice(-800)}` };
      else if (/not logged in|invalid api key|please run \/login/i.test(final.result || "")) r = { ok: false, text: "Claude Code no tiene sesión iniciada en esta computadora. Abrí una terminal, escribí `claude` y después `/login`. Es una sola vez." };
      else if (/session limit|usage limit|hit your/i.test(final.result || "")) r = { ok: false, text: `Se terminó el uso de Claude por ahora: ${final.result}`, limite: true };
      else r = { ok: !final.is_error, text: final.result || "(sin respuesta)", sessionId: final.session_id };
      r.archivos = archivos;
      const u = final?.usage || {};
      registrarUso({ fecha: new Date().toISOString(), agente: agent.id, origen, segundos: Math.round((Date.now() - t0) / 1000), costo: final?.total_cost_usd || 0,
        entrada: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), salida: u.output_tokens || 0, ok: r.ok }).catch(() => {});
      emitir({ tipo: "fin", agente: agent.id, nombre: agent.nombre, ok: r.ok, origen, archivos, resumen: String(r.text).slice(0, 140) });
      resolve(r);
    });
  });
}

// ---------- Notion ----------
async function notion(method, url, body) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return { error: "sin_token" };
  const r = await fetch(`https://api.notion.com/v1/${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) return { error: data.message || `Notion ${r.status}` };
  return data;
}
const txt = (p) => (p?.rich_text || p?.title || []).map((t) => t.plain_text).join("");
function mapProspecto(pg) {
  const pr = pg.properties;
  return {
    id: pg.id, url: pg.url,
    negocio: txt(pr["Negocio"]), rubro: pr["Rubro"]?.select?.name || "", zona: txt(pr["Zona"]),
    web: pr["Web"]?.url || "", instagram: pr["Instagram"]?.url || "", email: pr["Email público"]?.email || "",
    puntaje: pr["Puntaje"]?.select?.name || "", estado: pr["Estado"]?.select?.name || "",
    oportunidad: txt(pr["Oportunidad"]), mensaje: txt(pr["Mensaje propuesto"]), seguimiento: txt(pr["Seguimiento"]), fuentes: txt(pr["Fuentes"]),
    servicios: (pr["Servicio sugerido"]?.multi_select || []).map((s) => s.name),
  };
}

// ---------- Propuestas (carpetas en salidas/) ----------
async function listPropuestas() {
  const base = path.join(agentDir(agents.find((a) => a.id === "propuestas")), "salidas");
  const out = [];
  for (const name of await readdir(base).catch(() => [])) {
    const d = path.join(base, name);
    if (!(await stat(d)).isDirectory()) continue;
    const files = await readdir(d);
    const fase = files.includes("propuesta.pdf") ? "Lista para revisar"
      : files.includes("propuesta.html") ? "Diseñando"
      : files.includes("respuestas.md") ? "Diagnóstico"
      : files.includes("preguntas.md") ? "Esperando respuestas" : "Análisis";
    out.push({ cliente: name, fase, files, actualizado: (await stat(d)).mtime });
  }
  return out.sort((a, b) => b.actualizado - a.actualizado);
}

// ---------- Contenido (Notion + PNG en salidas/) ----------
const CONTENIDO_DS = "44c012bc-47a0-4561-8f63-62f0065cdb8a";
const salidasDe = (id) => path.join(agentDir(agents.find((a) => a.id === id)), "salidas");
async function mapContenido(pg) {
  const pr = pg.properties;
  const archivos = txt(pr["Archivos"]);
  const carpeta = (archivos.match(/salidas\/([^/\s]+)/) || [])[1] || "";
  const imagenes = carpeta ? (await readdir(path.join(salidasDe("contenido"), carpeta)).catch(() => [])).filter((f) => /\.png$/i.test(f)).sort() : [];
  return {
    id: pg.id, url: pg.url, pieza: txt(pr["Pieza"]), fecha: pr["Fecha"]?.date?.start || "",
    formato: pr["Formato"]?.select?.name || "", pilar: pr["Pilar"]?.select?.name || "", estado: pr["Estado"]?.select?.name || "",
    gancho: txt(pr["Gancho"]), caption: txt(pr["Caption"]), guion: txt(pr["Guión o slides"]), hashtags: txt(pr["Hashtags"]),
    carpeta,
    imagenes: imagenes.map((f) => `/files/contenido/${encodeURIComponent(carpeta)}/${encodeURIComponent(f)}`),
  };
}

// ---------- Reportes (salidas/<cliente>/<AAAA-MM>/) ----------
async function listReportes() {
  const base = salidasDe("reportes");
  const out = [];
  for (const cliente of await readdir(base).catch(() => [])) {
    for (const mes of await readdir(path.join(base, cliente)).catch(() => [])) {
      const d = path.join(base, cliente, mes);
      if (!(await stat(d)).isDirectory()) continue;
      const files = await readdir(d);
      out.push({ cliente, mes, files, listo: files.includes("reporte.pdf") });
    }
  }
  return out.sort((a, b) => b.mes.localeCompare(a.mes));
}

// ---------- Router ----------
let MOVIL = null, TELEGRAM = null;
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const p = decodeURIComponent(u.pathname);

  try {
    if (p === "/api/agents") {
      const list = await Promise.all(agents.map(async (a) => ({ ...a, ocupado: running.has(a.id), mensajes: (await loadChat(a.id)).messages.length })));
      return json(res, 200, list);
    }

    let m;
    if (p === "/api/telegram") return json(res, 200, TELEGRAM ? TELEGRAM.estado() : { activo: false });
    if (p === "/api/telegram/desvincular" && req.method === "POST" && TELEGRAM) { await TELEGRAM.desvincular(); return json(res, 200, { ok: true }); }
    if (p === "/api/movil")return json(res, 200, MOVIL ? { activo: true, pin: process.env.MOVIL_PIN, enlace: MOVIL.crearEnlace(), urls: MOVIL.ips().map((i) => `http://${i}:${MOVIL.PORT}`) } : { activo: false });
    if ((m = p.match(/^\/api\/chat\/([\w-]+)$/))) {
      const agent = agents.find((a) => a.id === m[1]);
      if (!agent) return json(res, 404, { error: "Agente no encontrado" });
      if (req.method === "GET") return json(res, 200, await loadChat(agent.id));
      if (req.method === "DELETE") { await saveChat(agent.id, { sessionId: null, messages: [] }); return json(res, 200, { ok: true }); }
      if (req.method === "POST") {
        const { message: texto = "", adjuntos = [] } = await readBody(req);
        // solo se aceptan adjuntos que ya estén en entradas/ de este agente
        const adj = (Array.isArray(adjuntos) ? adjuntos : []).filter((r) => typeof r === "string" && /^entradas\/\d{4}-\d{2}-\d{2}\/[\w.-]+$/.test(r) && existsSync(path.join(agentDir(agent), r)));
        if (!texto.trim() && !adj.length) return json(res, 400, { error: "Mensaje vacío" });
        const message = (texto.trim() || "Te mandé estos archivos.") + (adj.length ? "\n\nArchivos adjuntos (los subió Ignacio, están en tu carpeta; abrilos con Read antes de usarlos):\n" + adj.map((r) => "- " + r).join("\n") : "");
        if (running.has(agent.id)) return json(res, 409, { error: `${agent.nombre} todavía está trabajando en el pedido anterior.` });
        running.add(agent.id);
        const chat = await loadChat(agent.id);
        chat.messages.push({ de: "vos", texto: texto.trim(), adjuntos: adj, fecha: new Date().toISOString() });
        await saveChat(agent.id, chat);
        try {
          const r = await runClaude(agent, message, chat.sessionId);
          if (r.sessionId) chat.sessionId = r.sessionId;
          chat.messages.push({ de: "agente", texto: r.text, error: !r.ok, archivos: r.archivos || [], fecha: new Date().toISOString() });
          await saveChat(agent.id, chat);
          return json(res, 200, chat);
        } finally { running.delete(agent.id); }
      }
    }

    if (p === "/api/prospectos") {
      const r = await notion("POST", `data_sources/${PROSPECTOS_DS}/query`, { page_size: 100, sorts: [{ timestamp: "created_time", direction: "descending" }] });
      if (r.error) return json(res, 200, { error: r.error, items: [] });
      return json(res, 200, { items: r.results.map(mapProspecto) });
    }

    if ((m = p.match(/^\/api\/prospectos\/([\w-]+)$/)) && req.method === "PATCH") {
      const { estado } = await readBody(req);
      const permitidos = ["Aprobado", "Contactado", "Respondió", "Consulta agendada", "Descartado", "Mensaje listo", "Seguimiento listo", "Cliente"];
      if (!permitidos.includes(estado)) return json(res, 400, { error: "Estado no válido" });
      const antes = await notion("GET", `pages/${m[1]}`);
      const r = await notion("PATCH", `pages/${m[1]}`, { properties: { Estado: { select: { name: estado } } } });
      if (r.error) return json(res, 500, { error: r.error });
      // aprobar el 1er mensaje o el seguimiento lo pone en la cola de mails (si el envío automático está prendido)
      let envio = null;
      if (!antes.error) {
        const pr = mapProspecto(antes);
        if (pr.estado === "Mensaje listo" && estado === "Aprobado") envio = await cola.encolar(pr, "mensaje");
        if (pr.estado === "Seguimiento listo" && estado === "Contactado") envio = await cola.encolar(pr, "seguimiento");
      }
      return json(res, 200, { ok: true, envio });
    }

    if (p === "/api/propuestas") return json(res, 200, await listPropuestas());

    // ---------- Adjuntos del chat: se guardan en agentes/<agente>/entradas/<fecha>/ ----------
    if ((m = p.match(/^\/api\/adjuntos\/([\w-]+)$/)) && req.method === "POST" && agents.some((a) => a.id === m[1])) {
      const nombreOrig = decodeURIComponent(req.headers["x-nombre"] || "archivo");
      const ext = (path.extname(nombreOrig) || "").toLowerCase();
      const OK = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".heic", ".mp4", ".mov", ".pdf", ".txt", ".md", ".csv", ".docx", ".xlsx", ".svg", ".ttf", ".otf"];
      if (!OK.includes(ext)) return json(res, 400, { error: `No acepto archivos ${ext || "sin extensión"}` });
      const MAX = 60 * 1024 * 1024, partes = []; let tam = 0;
      for await (const c of req) { tam += c.length; if (tam > MAX) return json(res, 413, { error: "El archivo pasa los 60 MB" }); partes.push(c); }
      const base = path.basename(nombreOrig, path.extname(nombreOrig)).normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "archivo";
      const dia = new Date().toLocaleDateString("sv-SE"), dir = path.join(agentDir(agents.find((a) => a.id === m[1])), "entradas", dia);
      await mkdir(dir, { recursive: true });
      let nombre = base + ext, n = 2;
      while (existsSync(path.join(dir, nombre))) nombre = `${base}-${n++}${ext}`;
      await writeFile(path.join(dir, nombre), Buffer.concat(partes));
      return json(res, 200, { ruta: `entradas/${dia}/${nombre}`, nombre, tam });
    }
    if ((m = p.match(/^\/entradas\/([\w-]+)\/(.+)$/)) && agents.some((a) => a.id === m[1])) {
      const base = path.join(agentDir(agents.find((a) => a.id === m[1])), "entradas"), file = path.resolve(base, m[2]);
      if (!file.startsWith(base + path.sep)) { res.writeHead(403); return res.end(); }
      return sendFile(res, file);
    }

    // ---------- Cola de mails ----------
    if (p === "/api/envios" && req.method === "GET") return json(res, 200, cola.estado());
    if ((m = p.match(/^\/api\/envios\/([\w-]+)$/)) && req.method === "DELETE") return json(res, 200, { ok: await cola.cancelar(m[1]) });
    if (p === "/api/envios/aprobados" && req.method === "POST") {
      // los que ya estaban en "Aprobado" antes de prender el envío: solo se mandan si tocás este botón
      const r = await notion("POST", `data_sources/${PROSPECTOS_DS}/query`, { filter: { property: "Estado", select: { equals: "Aprobado" } }, page_size: 100 });
      if (r.error) return json(res, 500, { error: r.error });
      const out = { encolados: 0, sinMail: 0 };
      for (const pg of r.results) { const x = await cola.encolar(mapProspecto(pg), "mensaje"); if (x.encolado) out.encolados++; else if (x.motivo === "sin mail") out.sinMail++; }
      return json(res, 200, out);
    }

    // ---------- Eventos en vivo ----------
    if (p === "/api/eventos") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      res.write(": hola\n\n"); oyentes.add(res);
      const ping = setInterval(() => { try { res.write(": ping\n\n"); } catch {} }, 25000);
      req.on("close", () => { clearInterval(ping); oyentes.delete(res); });
      return;
    }
    // ---------- Medidor de uso ----------
    if (p === "/api/uso") { try { return json(res, 200, JSON.parse(await readFile(path.join(DATA, "uso.json"), "utf8"))); } catch { return json(res, 200, []); } }

    // ---------- Editar textos de prospectos y contenido ----------
    if ((m = p.match(/^\/api\/prospectos\/([\w-]+)\/texto$/)) && req.method === "PATCH") {
      const { campo, texto } = await readBody(req);
      const prop = { mensaje: "Mensaje propuesto", seguimiento: "Seguimiento" }[campo];
      if (!prop) return json(res, 400, { error: "Campo no válido" });
      const r = await notion("PATCH", `pages/${m[1]}`, { properties: { [prop]: { rich_text: [{ text: { content: String(texto).slice(0, 1990) } }] } } });
      return json(res, r.error ? 500 : 200, r.error ? { error: r.error } : { ok: true });
    }
    if ((m = p.match(/^\/api\/contenido\/([\w-]+)\/campos$/)) && req.method === "PATCH") {
      const b = await readBody(req), props = {};
      if (typeof b.caption === "string") props.Caption = { rich_text: [{ text: { content: b.caption.slice(0, 1990) } }] };
      if (typeof b.hashtags === "string") props.Hashtags = { rich_text: [{ text: { content: b.hashtags.slice(0, 1990) } }] };
      if (/^\d{4}-\d{2}-\d{2}$/.test(b.fecha || "")) props.Fecha = { date: { start: b.fecha } };
      const r = await notion("PATCH", `pages/${m[1]}`, { properties: props });
      return json(res, r.error ? 500 : 200, r.error ? { error: r.error } : { ok: true });
    }
    // Guardar el diseño editado en la app y volver a exportar las imágenes
    if ((m = p.match(/^\/api\/contenido-guardar\/([^/]+)$/)) && req.method === "POST") {
      const base = salidasDe("contenido"), dir = path.resolve(base, m[1]);
      if (!dir.startsWith(base + path.sep) || !existsSync(path.join(dir, "piezas.html"))) return json(res, 404, { error: "No encontré la pieza" });
      const { html } = await readBody(req);
      if (!html || !/class="slide/.test(html)) return json(res, 400, { error: "El diseño vino vacío" });
      const orig = path.join(dir, "piezas.html");
      await writeFile(path.join(dir, "piezas.anterior.html"), await readFile(orig));
      await writeFile(orig, html);
      const ok = await new Promise((resolve) => {
        const pr = spawn("python", ["render_piezas.py", orig], { cwd: agentDir(agents.find((a) => a.id === "contenido")), windowsHide: true });
        let e = ""; pr.stderr.on("data", (d) => (e += d)); pr.on("close", (code) => resolve(code === 0 ? true : e.slice(-400)));
      });
      return json(res, ok === true ? 200 : 500, ok === true ? { ok: true } : { error: "No pude exportar las imágenes: " + ok });
    }
    // Últimos posts publicados en @kume.agencia (copia guardada en data/ig/)
    if (p === "/api/feed-real") {
      const fs = (await readdir(path.join(DATA, "ig")).catch(() => [])).filter((f) => /\.(jpg|png|webp)$/i.test(f)).sort();
      return json(res, 200, fs.map((f) => `/data-ig/${encodeURIComponent(f)}`));
    }
    if ((m = p.match(/^\/data-ig\/([^/]+)$/))) {
      const base = path.join(DATA, "ig"), file = path.resolve(base, m[1]);
      if (!file.startsWith(base + path.sep)) { res.writeHead(403); return res.end(); }
      return sendFile(res, file);
    }

    // ---------- Piloto automático ----------
    if (p === "/api/rutinas") return json(res, 200, await piloto.listar());
    if ((m = p.match(/^\/api\/rutinas\/([\w-]+)$/)) && req.method === "PATCH") {
      const { activa } = await readBody(req);
      return json(res, (await piloto.activar(m[1], activa)) ? 200 : 404, { ok: true });
    }
    if ((m = p.match(/^\/api\/rutinas\/([\w-]+)\/correr$/)) && req.method === "POST") return json(res, 200, await piloto.correrAhora(m[1]));
    if (p === "/api/reportes") return json(res, 200, await listReportes());
    // Entregables de cualquier agente: lo último que dejó en salidas/
    if ((m = p.match(/^\/api\/salidas\/([\w-]+)$/)) && agents.some((a) => a.id === m[1])) {
      const base = salidasDe(m[1]), out = [];
      async function walk(dir, rel = "", depth = 0) {
        for (const f of await readdir(dir).catch(() => [])) {
          const full = path.join(dir, f), st = await stat(full), r = rel ? `${rel}/${f}` : f;
          if (st.isDirectory()) { if (depth < 2) await walk(full, r, depth + 1); }
          else if (/\.(md|html|pdf|png|csv|json)$/i.test(f) && !/importado/.test(f)) out.push({ ruta: r, fecha: st.mtime });
        }
      }
      await walk(base);
      return json(res, 200, out.sort((a, b) => b.fecha - a.fecha).slice(0, 60));
    }
    if (p === "/api/diagnosticos") {
      const base = salidasDe("diagnostico");
      const out = [];
      for (const negocio of await readdir(base).catch(() => [])) {
        const d = path.join(base, negocio);
        if (!(await stat(d)).isDirectory()) continue;
        const files = await readdir(d);
        out.push({ negocio, files, listo: files.includes("diagnostico.pdf"), actualizado: (await stat(d)).mtime });
      }
      return json(res, 200, out.sort((a, b) => b.actualizado - a.actualizado));
    }

    if (p === "/api/contenido") {
      const r = await notion("POST", `data_sources/${CONTENIDO_DS}/query`, { page_size: 100, sorts: [{ property: "Fecha", direction: "ascending" }] });
      if (r.error) return json(res, 200, { error: r.error, items: [] });
      return json(res, 200, { items: await Promise.all(r.results.map(mapContenido)) });
    }
    if ((m = p.match(/^\/api\/contenido\/([\w-]+)$/)) && req.method === "PATCH") {
      const { estado } = await readBody(req);
      const permitidos = ["Borrador", "Para aprobar", "Aprobado", "Grabar (humano)", "Programado", "Publicado"];
      if (!permitidos.includes(estado)) return json(res, 400, { error: "Estado no válido" });
      const r = await notion("PATCH", `pages/${m[1]}`, { properties: { Estado: { select: { name: estado } } } });
      return json(res, r.error ? 500 : 200, r.error ? { error: r.error } : { ok: true });
    }

    // Descargar todas las imágenes de una pieza en un ZIP: /api/contenido-zip/<carpeta>
    if ((m = p.match(/^\/api\/contenido-zip\/([^/]+)$/))) {
      const base = salidasDe("contenido"), dir = path.resolve(base, m[1]);
      if (!dir.startsWith(base + path.sep)) { res.writeHead(403); return res.end(); }
      const pngs = (await readdir(dir).catch(() => [])).filter((f) => /\.png$/i.test(f)).sort();
      if (!pngs.length) return json(res, 404, { error: "Esta pieza no tiene imágenes" });
      const buf = zip(await Promise.all(pngs.map(async (f) => ({ name: f, data: await readFile(path.join(dir, f)) }))));
      res.writeHead(200, { "Content-Type": "application/zip", "Content-Length": buf.length, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(m[1])}.zip` });
      return res.end(buf);
    }
    // Abrir la carpeta de una pieza en el Explorador de Windows
    if ((m = p.match(/^\/api\/abrir-carpeta\/([\w-]+)\/([^/]+)$/)) && req.method === "POST" && agents.some((a) => a.id === m[1])) {
      const base = salidasDe(m[1]), dir = path.resolve(base, m[2]);
      if (!dir.startsWith(base + path.sep) || !existsSync(dir)) return json(res, 404, { error: "No encontré la carpeta" });
      spawn("explorer.exe", [dir], { detached: true, stdio: "ignore" }).unref();
      return json(res, 200, { ok: true });
    }

    // Archivos de salida de cualquier agente: /files/<agente>/<ruta>
    // los diseños abiertos desde /files/contenido/<carpeta>/ piden ../../assets/ → /files/assets/
    if ((m = p.match(/^\/files\/(assets|entradas)\/(.+)$/))) {
      const base = path.join(agentDir(agents.find((a) => a.id === "contenido")), m[1]), file = path.resolve(base, m[2]);
      if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
      return sendFile(res, file);
    }
    if ((m = p.match(/^\/files\/([\w-]+)\/(.+)$/)) && agents.some((a) => a.id === m[1])) {
      // los diseños usan ../../assets/ → se sirven desde la carpeta del agente
      const base = m[2].startsWith("assets/") ? path.join(agentDir(agents.find((a) => a.id === m[1])), "assets") : salidasDe(m[1]);
      const file = path.resolve(base, m[2].replace(/^assets\//, ""));
      if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
      return sendFile(res, file);
    }

    if (p.startsWith("/salidas/")) {
      const base = path.join(agentDir(agents.find((a) => a.id === "propuestas")), "salidas");
      const file = path.resolve(base, "." + p.slice("/salidas".length));
      if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
      return sendFile(res, file);
    }

    const file = path.resolve(PUBLIC, "." + (p === "/" ? "/index.html" : p));
    if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
    return sendFile(res, file);
  } catch (e) {
    return json(res, 500, { error: e.message });
  }
});

const cola = crearCola({ DATA, notion, agentDir, agents, emitir });
const piloto = createPiloto({ DIR, DATA, agents, agentDir, runClaude, notion, running, loadChat, saveChat });
piloto.iniciar();

server.requestTimeout = 0; // los agentes pueden tardar varios minutos
server.listen(PORT, "127.0.0.1", () => { console.log(`Küme HQ en http://localhost:${PORT}`); MOVIL = iniciarMovil({ DIR, PORT_PRINCIPAL: PORT }); TELEGRAM = iniciarTelegram({ DATA, agents, agentDir, PORT, suscriptores }); });
