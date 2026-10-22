// Modo celular: aprobar desde el teléfono, SOLO dentro de tu WiFi y con PIN.
// Se prende si en .env hay MOVIL_PIN=<6+ dígitos>. Escucha en el puerto 4748 y reenvía
// al servidor principal (127.0.0.1:4747) únicamente las rutas de aprobación.
// Nunca expone el chat ni los agentes: eso sigue accesible solo desde esta compu.
import http from "node:http";
import os from "node:os";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const PERMITIDAS = [
  ["GET", /^\/api\/prospectos$/],
  ["GET", /^\/api\/contenido$/],
  ["PATCH", /^\/api\/prospectos\/[\w-]+$/],
  ["PATCH", /^\/api\/contenido\/[\w-]+$/],
  ["GET", /^\/files\/contenido\/[^?]+\.png$/],
  ["GET", /^\/files\/diagnostico\/[^?]+\.pdf$/],
];
// estados que se pueden poner desde el celu
const ESTADOS_OK = new Set(["Aprobado", "Descartado", "Contactado", "Borrador"]);

// solo direcciones de red local (192.168.x, 10.x, 172.16-31.x, loopback)
const esLocal = (ip) => /^(::ffff:)?(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip || "") || ip === "::1";
const ipsLan = () => Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal && esLocal(i.address)).map((i) => i.address);

export function iniciarMovil({ DIR, PORT_PRINCIPAL = 4747, PORT = 4748 }) {
  const PIN = process.env.MOVIL_PIN || "";
  if (!/^\d{6,}$/.test(PIN)) { if (PIN) console.log("MOVIL_PIN tiene que tener 6 dígitos o más. Modo celular apagado."); return; }
  const sesiones = new Set();
  // enlaces de un solo uso para el QR: entran sin escribir el PIN, vencen a los 10 minutos
  const enlaces = new Map(); // token → vence
  const crearEnlace = () => {
    for (const [t, v] of enlaces) if (v < Date.now()) enlaces.delete(t);
    const t = randomBytes(24).toString("hex"); enlaces.set(t, Date.now() + 10 * 60e3); return t;
  };
  const nuevaSesion = () => { const tok = randomBytes(24).toString("hex"); sesiones.add(tok); return `kume_m=${tok}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`; };
  const intentos = new Map(); // ip → {n, hasta}

  const server = http.createServer(async (req, res) => {
    const ip = req.socket.remoteAddress;
    if (!esLocal(ip)) { res.writeHead(403); return res.end("Solo red local"); }
    const u = new URL(req.url, "http://x");
    const cookie = (req.headers.cookie || "").match(/kume_m=([a-f0-9]{48})/)?.[1];
    const logueado = cookie && sesiones.has(cookie);

    if (u.pathname === "/" || u.pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(await readFile(path.join(DIR, "public", "movil.html")));
    }
    if (u.pathname === "/avatars/kume.png") { res.writeHead(200, { "Content-Type": "image/png" }); return res.end(await readFile(path.join(DIR, "public", "avatars", "kume.png"))); }

    if (u.pathname === "/m/entrar") {
      const t = u.searchParams.get("t") || "", vence = enlaces.get(t);
      if (vence && vence > Date.now()) { enlaces.delete(t); res.writeHead(302, { "Set-Cookie": nuevaSesion(), Location: "/" }); return res.end(); }
      res.writeHead(302, { Location: "/?vencido=1" }); return res.end();
    }

    if (u.pathname === "/m/login" && req.method === "POST") {
      const it = intentos.get(ip) || { n: 0, hasta: 0 };
      if (Date.now() < it.hasta) { res.writeHead(429, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: "Demasiados intentos. Esperá 10 minutos." })); }
      let b = ""; for await (const c of req) { b += c; if (b.length > 200) break; }
      let pin = ""; try { pin = String(JSON.parse(b).pin || ""); } catch {}
      const ok = pin.length === PIN.length && timingSafeEqual(Buffer.from(pin), Buffer.from(PIN));
      if (!ok) {
        it.n++; if (it.n >= 5) { it.hasta = Date.now() + 10 * 60e3; it.n = 0; }
        intentos.set(ip, it);
        res.writeHead(401, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: "PIN incorrecto" }));
      }
      intentos.delete(ip);
      res.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": nuevaSesion() });
      return res.end(JSON.stringify({ ok: true }));
    }

    if (!logueado) { res.writeHead(401, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: "login" })); }
    if (!PERMITIDAS.some(([m, re]) => m === req.method && re.test(u.pathname))) { res.writeHead(403); return res.end(); }

    let body = "";
    if (req.method === "PATCH") {
      for await (const c of req) { body += c; if (body.length > 2000) break; }
      let est = ""; try { est = JSON.parse(body).estado; } catch {}
      if (!ESTADOS_OK.has(est)) { res.writeHead(400, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: "Estado no permitido desde el celu" })); }
    }
    const fw = http.request({ host: "127.0.0.1", port: PORT_PRINCIPAL, path: u.pathname, method: req.method, headers: { "Content-Type": "application/json" } }, (r) => {
      res.writeHead(r.statusCode, { "Content-Type": r.headers["content-type"] || "application/octet-stream" }); r.pipe(res);
    });
    fw.on("error", () => { res.writeHead(502); res.end(); });
    fw.end(body || undefined);
  });

  server.listen(PORT, "0.0.0.0", () => {
    const ips = ipsLan();
    console.log(`Modo celular (solo tu WiFi, con PIN): ${ips.map((i) => `http://${i}:${PORT}`).join("  ") || `puerto ${PORT}`}`);
  });
  return { ips: ipsLan, PORT, crearEnlace };
}
