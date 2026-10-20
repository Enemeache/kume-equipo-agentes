// Küme HQ — servidor local (sin dependencias). Uso: node server.mjs
import http from "node:http";
import { readFile, writeFile, readdir, stat, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPiloto } from "./piloto.mjs";

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

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".pdf": "application/pdf", ".png": "image/png", ".md": "text/plain; charset=utf-8" };

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

function runClaude(agent, message, sessionId) {
  const args = [
    "-p", message,
    "--output-format", "json",
    "--permission-mode", "acceptEdits",
    "--allowedTools", "Read,Write,Edit,Glob,Grep,WebSearch,WebFetch,Bash(python generar_pdf.py:*),Bash(python render_piezas.py:*),Bash(python revisar_web.py:*),Bash(python pagespeed.py:*)",
  ];
  if (sessionId) args.push("--resume", sessionId);
  return new Promise((resolve) => {
    // Cada agente corre como un Claude Code normal: sin variables heredadas de otra sesión de Claude.
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CLAUDE|ANTHROPIC_BASE_URL)/.test(k)));
    const p = spawn("claude", args, { cwd: agentDir(agent), windowsHide: true, env });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => resolve({ ok: false, text: `No pude abrir Claude Code: ${e.message}` }));
    p.on("close", () => {
      try {
        const r = JSON.parse(out.trim().split(/\r?\n/).pop());
        if (/not logged in|invalid api key|please run \/login/i.test(r.result || "")) {
          return resolve({ ok: false, text: "Claude Code no tiene sesión iniciada en esta computadora. Abrí una terminal, escribí `claude` y después `/login`. Es una sola vez." });
        }
        resolve({ ok: !r.is_error, text: r.result || "(sin respuesta)", sessionId: r.session_id });
      } catch {
        resolve({ ok: false, text: `Error al correr el agente.\n${(err || out).slice(-800)}` });
      }
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
    web: pr["Web"]?.url || "", instagram: pr["Instagram"]?.url || "",
    puntaje: pr["Puntaje"]?.select?.name || "", estado: pr["Estado"]?.select?.name || "",
    oportunidad: txt(pr["Oportunidad"]), mensaje: txt(pr["Mensaje propuesto"]),
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
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const p = decodeURIComponent(u.pathname);

  try {
    if (p === "/api/agents") {
      const list = await Promise.all(agents.map(async (a) => ({ ...a, ocupado: running.has(a.id), mensajes: (await loadChat(a.id)).messages.length })));
      return json(res, 200, list);
    }

    let m;
    if ((m = p.match(/^\/api\/chat\/([\w-]+)$/))) {
      const agent = agents.find((a) => a.id === m[1]);
      if (!agent) return json(res, 404, { error: "Agente no encontrado" });
      if (req.method === "GET") return json(res, 200, await loadChat(agent.id));
      if (req.method === "DELETE") { await saveChat(agent.id, { sessionId: null, messages: [] }); return json(res, 200, { ok: true }); }
      if (req.method === "POST") {
        const { message } = await readBody(req);
        if (!message?.trim()) return json(res, 400, { error: "Mensaje vacío" });
        if (running.has(agent.id)) return json(res, 409, { error: `${agent.nombre} todavía está trabajando en el pedido anterior.` });
        running.add(agent.id);
        const chat = await loadChat(agent.id);
        chat.messages.push({ de: "vos", texto: message, fecha: new Date().toISOString() });
        await saveChat(agent.id, chat);
        try {
          const r = await runClaude(agent, message, chat.sessionId);
          if (r.sessionId) chat.sessionId = r.sessionId;
          chat.messages.push({ de: "agente", texto: r.text, error: !r.ok, fecha: new Date().toISOString() });
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
      const permitidos = ["Aprobado", "Contactado", "Respondió", "Consulta agendada", "Descartado", "Mensaje listo"];
      if (!permitidos.includes(estado)) return json(res, 400, { error: "Estado no válido" });
      const r = await notion("PATCH", `pages/${m[1]}`, { properties: { Estado: { select: { name: estado } } } });
      return json(res, r.error ? 500 : 200, r.error ? { error: r.error } : { ok: true });
    }

    if (p === "/api/propuestas") return json(res, 200, await listPropuestas());

    // ---------- Piloto automático ----------
    if (p === "/api/rutinas") return json(res, 200, await piloto.listar());
    if ((m = p.match(/^\/api\/rutinas\/([\w-]+)$/)) && req.method === "PATCH") {
      const { activa } = await readBody(req);
      return json(res, (await piloto.activar(m[1], activa)) ? 200 : 404, { ok: true });
    }
    if ((m = p.match(/^\/api\/rutinas\/([\w-]+)\/correr$/)) && req.method === "POST") return json(res, 200, await piloto.correrAhora(m[1]));
    if (p === "/api/reportes") return json(res, 200, await listReportes());
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

    // Archivos de salida de cualquier agente: /files/<agente>/<ruta>
    if ((m = p.match(/^\/files\/([\w-]+)\/(.+)$/)) && agents.some((a) => a.id === m[1])) {
      const base = salidasDe(m[1]);
      const file = path.resolve(base, m[2]);
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

const piloto = createPiloto({ DIR, DATA, agents, agentDir, runClaude, notion, running, loadChat, saveChat });
piloto.iniciar();

server.requestTimeout = 0; // los agentes pueden tardar varios minutos
server.listen(PORT, "127.0.0.1", () => console.log(`Küme HQ en http://localhost:${PORT}`));
