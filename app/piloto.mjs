// Piloto automático de Küme HQ: corre las rutinas de los agentes en su horario
// y carga lo que producen en Notion. Nunca envía ni publica nada.
import { readFile, writeFile, readdir, rename, stat } from "node:fs/promises";
import path from "node:path";

const PROSPECTOS_DS = "634cf749-0bd2-4a14-85d9-e1860b74b3a8";
const CONTENIDO_DS = "44c012bc-47a0-4561-8f63-62f0065cdb8a";
const RUBROS = ["Gastronomía", "Fitness / bienestar", "Servicios / tecnología", "Inmobiliaria", "Retail", "Otro"];
const PUNTAJES = ["5 · Ideal", "4 · Muy bueno", "3 · Bueno", "2 · Dudoso", "1 · No encaja"];
const SERVICIOS = ["Redes", "Web", "Branding", "Automatización", "Consultoría"];
const FORMATOS = ["Carrusel", "Reel", "Post único", "Stories"];
const PILARES = ["Educativo", "Detrás de escena", "Resultados", "Opinión", "Comunidad"];

const hoy = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const rt = (s) => [{ type: "text", text: { content: String(s ?? "").slice(0, 1990) } }];
const txt = (p) => (p?.rich_text || p?.title || []).map((t) => t.plain_text).join("");
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const oneOf = (v, list, def) => list.find((x) => norm(x) === norm(v)) || list.find((x) => norm(v) && (norm(x).includes(norm(v)) || norm(v).includes(norm(x)))) || def;

export function createPiloto({ DIR, DATA, agents, agentDir, runClaude, notion, running, loadChat, saveChat, log = console.log }) {
  const cfgPath = path.join(DIR, "rutinas.json");
  const statePath = path.join(DATA, "rutinas-estado.json");
  let state = { ultima: {}, historial: [], zona: 0 };

  const loadCfg = async () => JSON.parse(await readFile(cfgPath, "utf8"));
  const saveCfg = (c) => writeFile(cfgPath, JSON.stringify(c, null, 2) + "\n");
  async function loadState() { try { state = { ...state, ...JSON.parse(await readFile(statePath, "utf8")) }; } catch {} }
  const saveState = () => writeFile(statePath, JSON.stringify(state, null, 2));
  const salidas = (id) => path.join(agentDir(agents.find((a) => a.id === id)), "salidas");

  async function notionAll(ds) {
    const r = await notion("POST", `data_sources/${ds}/query`, { page_size: 100 });
    return r.error ? [] : r.results;
  }

  // ---------- Prompts de cada rutina ----------
  async function promptProspeccion(cfg) {
    const z = cfg.zonas_prospeccion[state.zona % cfg.zonas_prospeccion.length];
    state.zona++;
    const existentes = (await notionAll(PROSPECTOS_DS)).map((p) => txt(p.properties["Negocio"])).filter(Boolean);
    const archivo = `salidas/prospectos-${hoy()}.json`;
    return {
      texto: `MODO AUTOMÁTICO (rutina diaria, nadie está mirando en vivo: no preguntes nada, decidí vos con tus reglas).
Buscame 5 ${z.rubro} en ${z.zona}, CABA. Seguí todos tus pasos: investigá, puntuá y escribí el primer mensaje de cada uno.
NO repitas estos negocios que ya están cargados: ${existentes.join(", ") || "(ninguno)"}.
Descartá cadenas y franquicias. Solo negocios con un canal de contacto público (Instagram, web o WhatsApp comercial).
Al terminar, guardá el resultado en ${archivo} con este formato exacto (un array JSON, sin texto alrededor):
[{"negocio":"","rubro":"${RUBROS.join("|")}","zona":"","web":"","instagram":"","email":"","puntaje":"${PUNTAJES.join("|")}","oportunidad":"","servicios":["${SERVICIOS.join('","')}"],"mensaje":"","fuentes":""}]
No uses Notion: la app lo carga sola desde ese archivo. Respondé con un resumen de 3 líneas.`,
      meta: z,
    };
  }
  async function promptDiagnostico() {
    const pros = await notionAll(PROSPECTOS_DS);
    const cand = pros
      .filter((p) => p.properties["Estado"]?.select?.name === "Mensaje listo")
      .filter((p) => !/DIAGN[ÓO]STICO/i.test(txt(p.properties["Fuentes"])))
      .sort((a, b) => (a.properties["Puntaje"]?.select?.name || "9").localeCompare(b.properties["Puntaje"]?.select?.name || "9")).reverse()[0];
    if (!cand) return null;
    const pr = cand.properties, negocio = txt(pr["Negocio"]);
    const slug = negocio.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return {
      texto: `MODO AUTOMÁTICO (rutina diaria, nadie está mirando en vivo: no esperes OK para el resumen, armá el PDF directamente; Ignacio lo revisa antes de enviarlo).
Diagnóstico gratis de ${negocio} (${pr["Rubro"]?.select?.name || ""}, ${txt(pr["Zona"])}).
Instagram: ${pr["Instagram"]?.url || "—"} · Web: ${pr["Web"]?.url || "—"}
Lo que ya vio Dwight: ${txt(pr["Oportunidad"])}
Guardá todo en salidas/${slug}/ (hallazgos.md, diagnostico.html y diagnostico.pdf). No uses Notion. Respondé con el semáforo y las 3 mejoras en 5 líneas.`,
      meta: { pageId: cand.id, negocio, slug },
    };
  }
  async function promptContenido() {
    const cont = await notionAll(CONTENIDO_DS);
    const recientes = cont.map((c) => `${c.properties["Fecha"]?.date?.start || ""} ${txt(c.properties["Pieza"])}`).sort().slice(-12);
    const lunes = new Date(); lunes.setDate(lunes.getDate() + ((8 - lunes.getDay()) % 7 || 7));
    return {
      texto: `MODO AUTOMÁTICO (rutina semanal, nadie está mirando en vivo: no esperes OK del plan, seguí directo; Ignacio aprueba cada pieza después).
Armá la semana que arranca el lunes ${hoy(lunes)}: 4 piezas (2 carruseles, 1 reel, 1 post único) respetando los pilares.
No repitas temas de estas piezas recientes: ${recientes.join(" | ") || "(ninguna)"}.
Diseñá los 2 carruseles con tu plantilla y exportá las PNG (python render_piezas.py ...). Cada pieza va en salidas/AAAA-MM-DD-slug/ y dentro de cada carpeta dejá un pieza.json con este formato exacto:
{"pieza":"","fecha":"AAAA-MM-DD","formato":"${FORMATOS.join("|")}","pilar":"${PILARES.join("|")}","gancho":"","caption":"","guion":"","hashtags":""}
Los hechos de "Detrás de escena" o "Resultados" que no conozcas van como pregunta para Ignacio dentro del guion: no inventes.
No uses Notion: la app lo carga sola. Respondé con la tabla de la semana.`,
      meta: {},
    };
  }

  // ---------- Importar lo producido a Notion ----------
  async function importarProspectos() {
    const dir = salidas("prospectos"); let n = 0;
    for (const f of (await readdir(dir).catch(() => [])).filter((f) => /^prospectos-.*\.json$/.test(f))) {
      let list; try { list = JSON.parse((await readFile(path.join(dir, f), "utf8")).replace(/^[^[]*/, "").replace(/[^\]]*$/, "")); } catch (e) { log("No pude leer", f, e.message); continue; }
      const ya = new Set((await notionAll(PROSPECTOS_DS)).map((p) => txt(p.properties["Negocio"]).toLowerCase()));
      for (const p of list) {
        if (!p?.negocio || ya.has(p.negocio.toLowerCase())) continue;
        const puntaje = PUNTAJES.find((x) => x[0] === String(p.puntaje || "").trim()[0]) || "3 · Bueno";
        const props = {
          Negocio: { title: rt(p.negocio) },
          Rubro: { select: { name: oneOf(p.rubro, RUBROS, "Otro") } },
          Zona: { rich_text: rt(p.zona) },
          Puntaje: { select: { name: puntaje } },
          Oportunidad: { rich_text: rt(p.oportunidad) },
          "Mensaje propuesto": { rich_text: rt(p.mensaje) },
          Fuentes: { rich_text: rt(p.fuentes) },
          Estado: { select: { name: puntaje.startsWith("1") ? "Descartado" : "Mensaje listo" } },
          Fecha: { date: { start: hoy() } },
          "Servicio sugerido": { multi_select: (p.servicios || []).map((s) => oneOf(s, SERVICIOS, null)).filter(Boolean).map((name) => ({ name })) },
        };
        if (/^https?:\/\//.test(p.web || "")) props.Web = { url: p.web };
        if (/^https?:\/\//.test(p.instagram || "")) props.Instagram = { url: p.instagram };
        if (/@/.test(p.email || "")) props["Email público"] = { email: p.email };
        const r = await notion("POST", "pages", { parent: { type: "data_source_id", data_source_id: PROSPECTOS_DS }, properties: props });
        if (r.error) log("Notion (prospecto):", r.error); else { n++; ya.add(p.negocio.toLowerCase()); }
      }
      await rename(path.join(dir, f), path.join(dir, f.replace(/\.json$/, ".importado.json")));
    }
    return n;
  }
  async function importarContenido() {
    const base = salidas("contenido"); let n = 0;
    for (const d of await readdir(base).catch(() => [])) {
      const f = path.join(base, d, "pieza.json");
      let c; try { c = JSON.parse(await readFile(f, "utf8")); } catch { continue; }
      const props = {
        Pieza: { title: rt(c.pieza) },
        Formato: { select: { name: oneOf(c.formato, FORMATOS, "Carrusel") } },
        Pilar: { select: { name: oneOf(c.pilar, PILARES, "Educativo") } },
        Estado: { select: { name: /reel/i.test(c.formato) ? "Grabar (humano)" : "Para aprobar" } },
        Gancho: { rich_text: rt(c.gancho) }, Caption: { rich_text: rt(c.caption) },
        "Guión o slides": { rich_text: rt(c.guion) }, Hashtags: { rich_text: rt(c.hashtags) },
        Archivos: { rich_text: rt(`Kume/agentes/contenido/salidas/${d}/`) },
      };
      if (/^\d{4}-\d{2}-\d{2}$/.test(c.fecha || "")) props.Fecha = { date: { start: c.fecha } };
      const r = await notion("POST", "pages", { parent: { type: "data_source_id", data_source_id: CONTENIDO_DS }, properties: props });
      if (r.error) { log("Notion (contenido):", r.error); continue; }
      await rename(f, path.join(base, d, "pieza.importado.json")); n++;
    }
    return n;
  }
  async function marcarDiagnostico(meta) {
    const pdf = path.join(salidas("diagnostico"), meta.slug, "diagnostico.pdf");
    try { await stat(pdf); } catch { return false; }
    const page = await notion("GET", `pages/${meta.pageId}`);
    const prev = page.error ? "" : txt(page.properties["Fuentes"]);
    await notion("PATCH", `pages/${meta.pageId}`, { properties: { Fuentes: { rich_text: rt(`${prev} · DIAGNÓSTICO GRATIS LISTO (borrador): Kume/agentes/diagnostico/salidas/${meta.slug}/diagnostico.pdf`) } } });
    return true;
  }

  // ---------- Correr una rutina ----------
  async function correr(rut, motivo = "horario") {
    const agent = agents.find((a) => a.id === rut.agente);
    if (!agent || running.has(agent.id)) return { ok: false, texto: "El agente ya está trabajando." };
    const cfg = await loadCfg();
    const p = rut.agente === "prospectos" ? await promptProspeccion(cfg) : rut.agente === "diagnostico" ? await promptDiagnostico() : await promptContenido();
    state.ultima[rut.id] = hoy(); await saveState();
    if (!p) { registrar(rut, true, "No había prospectos nuevos para diagnosticar."); return { ok: true, texto: "Nada para hacer hoy." }; }
    running.add(agent.id);
    const chat = await loadChat(agent.id);
    chat.messages.push({ de: "vos", texto: `🤖 Rutina automática: ${rut.nombre}${p.meta?.rubro ? ` (${p.meta.rubro}, ${p.meta.zona})` : p.meta?.negocio ? ` (${p.meta.negocio})` : ""}`, fecha: new Date().toISOString(), auto: true });
    await saveChat(agent.id, chat);
    let r;
    try { r = await runClaude(agent, p.texto, null); } finally { running.delete(agent.id); }
    let extra = "";
    if (r.ok && rut.agente === "prospectos") extra = `\n\n📥 ${await importarProspectos()} prospectos nuevos cargados en "Para aprobar".`;
    if (r.ok && rut.agente === "contenido") extra = `\n\n📥 ${await importarContenido()} piezas cargadas en "Contenido".`;
    if (r.ok && rut.agente === "diagnostico") extra = (await marcarDiagnostico(p.meta)) ? `\n\n📄 Diagnóstico de ${p.meta.negocio} listo en "Diagnósticos".` : "\n\n⚠️ No encontré el PDF del diagnóstico.";
    const chat2 = await loadChat(agent.id);
    chat2.messages.push({ de: "agente", texto: r.text + extra, error: !r.ok, fecha: new Date().toISOString(), auto: true });
    await saveChat(agent.id, chat2);
    registrar(rut, r.ok, (r.ok ? "" : "Error: ") + (r.text || "").slice(0, 280) + extra);
    log(`[piloto] ${rut.id} (${motivo}) → ${r.ok ? "ok" : "error"}`);
    return { ok: r.ok, texto: r.text + extra };
  }
  function registrar(rut, ok, resumen) {
    state.historial.unshift({ id: rut.id, agente: rut.agente, fecha: new Date().toISOString(), ok, resumen });
    state.historial = state.historial.slice(0, 60); saveState();
  }

  // ---------- Reloj: cada minuto revisa qué toca (y recupera lo que se perdió hoy) ----------
  async function revisar() {
    const cfg = await loadCfg(), now = new Date(), hhmm = now.toTimeString().slice(0, 5);
    for (const rut of cfg.rutinas) {
      if (!rut.activa || !rut.dias.includes(now.getDay()) || state.ultima[rut.id] === hoy()) continue;
      if (hhmm >= rut.hora) correr(rut).catch((e) => log("[piloto]", e.message));
    }
  }
  function proxima(rut) {
    const now = new Date(), [h, m] = rut.hora.split(":").map(Number);
    for (let i = 0; i < 8; i++) {
      const c = new Date(now); c.setDate(now.getDate() + i); c.setHours(h, m, 0, 0);
      if (!rut.dias.includes(c.getDay())) continue;
      if (i === 0 && state.ultima[rut.id] === hoy()) continue; // ya corrió hoy
      return (c < now ? now : c).toISOString(); // si hoy ya pasó la hora y no corrió, corre ahora
    }
    return null;
  }

  async function iniciar() {
    await loadState();
    // importa lo que haya quedado sin cargar (por ejemplo si la app se cerró en el medio)
    importarProspectos().catch(() => {}); importarContenido().catch(() => {});
    setTimeout(revisar, 20000); setInterval(revisar, 60000);
  }

  return {
    iniciar,
    async listar() {
      const cfg = await loadCfg();
      return { rutinas: cfg.rutinas.map((r) => ({ ...r, ultima: state.ultima[r.id] || null, proxima: r.activa ? proxima(r) : null, trabajando: running.has(r.agente) })), historial: state.historial.slice(0, 15) };
    },
    async activar(id, activa) { const cfg = await loadCfg(); const r = cfg.rutinas.find((x) => x.id === id); if (!r) return false; r.activa = !!activa; await saveCfg(cfg); return true; },
    async correrAhora(id) { const cfg = await loadCfg(); const r = cfg.rutinas.find((x) => x.id === id); if (!r) return { ok: false, texto: "Rutina no encontrada" }; correr(r, "manual"); return { ok: true, texto: "Arrancó" }; },
  };
}
