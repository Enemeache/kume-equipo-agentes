// Mejoras de experiencia de Küme HQ:
// Hoy · Bandeja única · Feed · Calendario · Editor de diseño · Progreso en vivo · Avisos · Embudo · Uso · Oficina (tarjeta, reunión, día/noche)
(function () {
  const H = (s) => esc(s);
  const nombreDe = (id) => (AGENTS.find((a) => a.id === id) || {}).nombre || id;
  const fotoDe = (id) => (AGENTS.find((a) => a.id === id) || {}).avatar || "avatars/persona.svg";
  const hoyISO = () => new Date().toLocaleDateString("sv-SE");

  // ---------- Estilos ----------
  const css = document.createElement("style");
  css.textContent = `
  .grid2{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
  .tile{background:#fff;border-radius:12px;padding:18px 20px;border-top:3px solid var(--dorado)}
  .tile h3{font-size:20px;margin-bottom:6px}.tile .big{font-family:'Cormorant Garamond',serif;font-size:44px;color:var(--verde);line-height:1}
  .tile ul{list-style:none;margin-top:8px}.tile li{font-size:13px;padding:6px 0;border-bottom:1px solid var(--crema2);line-height:1.45}
  .chip{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;background:var(--crema);border-radius:12px;padding:3px 9px;margin:2px 4px 2px 0}
  .chip img{width:18px;height:18px;border-radius:50%}
  /* Bandeja */
  .bandeja-wrap{max-width:860px;margin:0 auto}
  .bandeja-card{background:#fff;border-radius:16px;padding:26px 28px;box-shadow:0 10px 30px rgba(0,0,0,.08);animation:entra .2s ease}
  @keyframes entra{from{transform:translateX(24px);opacity:.3}}
  .bandeja-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;font-size:13px;color:var(--verde2)}
  .bandeja-tipo{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--dorado);font-weight:500}
  .bandeja-acc{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}
  .kbd{display:inline-block;font-size:11px;border:1px solid rgba(27,58,45,.3);border-bottom-width:2px;border-radius:5px;padding:0 6px;margin-left:6px;font-family:monospace;opacity:.75}
  .bandeja-prev{display:flex;gap:6px;overflow-x:auto;margin:10px 0}
  .bandeja-prev img{height:230px;border-radius:6px;cursor:zoom-in}
  .editarea{width:100%;min-height:140px;border:1px solid rgba(27,58,45,.25);border-radius:10px;padding:12px;font-family:inherit;font-size:14px;line-height:1.5}
  .barra-prog{height:6px;background:var(--crema2);border-radius:4px;overflow:hidden;margin-bottom:16px}.barra-prog i{display:block;height:100%;background:var(--dorado);transition:width .3s}
  /* Feed */
  .feed{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;max-width:720px;margin:0 auto;background:#fff;padding:4px;border-radius:12px}
  .feed .p{position:relative;aspect-ratio:4/5;background:#eee;overflow:hidden;cursor:pointer}
  .feed .p img{width:100%;height:100%;object-fit:cover;display:block}
  .feed .p .tag{position:absolute;top:6px;left:6px;font-size:10.5px;padding:2px 8px;border-radius:10px;background:var(--dorado);color:var(--verde);font-weight:500}
  .feed .p .tag.real{background:rgba(255,255,255,.9);color:#333}
  .feed .p .reel{position:absolute;inset:0;display:grid;place-items:center;background:#2B2723;color:#fff;font-size:13px;text-align:center;padding:10px}
  .feed-head{display:flex;gap:18px;align-items:center;max-width:720px;margin:0 auto 14px;background:#fff;border-radius:12px;padding:16px}
  .feed-head img{width:64px;height:64px;border-radius:50%;border:1px solid #eee}
  /* Calendario */
  .cal{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
  .cal .dia{background:#fff;border-radius:8px;min-height:118px;padding:6px;border:2px solid transparent}
  .cal .dia.otro{opacity:.4}.cal .dia.hoy{border-color:var(--dorado)}.cal .dia.sobre{border-color:var(--verde);background:#F2F7F3}
  .cal .num{font-size:11px;color:var(--verde2);margin-bottom:4px}
  .cal .pz{display:flex;gap:6px;align-items:center;background:var(--crema);border-radius:6px;padding:4px;margin-bottom:4px;font-size:11px;cursor:grab;line-height:1.25}
  .cal .pz img{width:30px;height:38px;object-fit:cover;border-radius:3px}
  .cal .pz .e{font-size:9.5px;color:var(--verde2)}
  .cal-h{font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--verde2);text-align:center}
  /* Editor */
  .editor{position:fixed;inset:0;z-index:32;background:rgba(10,18,14,.85);display:none;flex-direction:column}
  .editor.on{display:flex}
  .editor .bar{display:flex;gap:10px;align-items:center;padding:12px 18px;background:var(--verde);color:var(--crema)}
  .editor .bar b{font-family:'Cormorant Garamond',serif;font-size:22px;margin-right:auto}
  .editor iframe{flex:1;border:0;background:#555}
  /* Progreso y archivos en el chat */
  .pasos{align-self:flex-start;font-size:12px;color:var(--verde2);display:flex;flex-direction:column;gap:3px}
  .pasos span{display:flex;gap:6px;align-items:center}.pasos span:last-child{color:var(--verde);font-weight:500}
  .archivos{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
  .archivo{display:flex;flex-direction:column;width:132px;background:#fff;border:1px solid var(--crema2);border-radius:10px;overflow:hidden;text-decoration:none;color:var(--verde);font-size:11px}
  .archivo img{width:100%;height:150px;object-fit:cover;background:#eee}
  .archivo .ico{height:90px;display:grid;place-items:center;font-size:34px;background:var(--crema)}
  .archivo span{padding:6px 8px;word-break:break-all;line-height:1.3}
  /* Toasts y tarjeta flotante */
  .toasts{position:fixed;right:16px;bottom:64px;z-index:40;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
  .toast{background:var(--verde);color:var(--crema);border-radius:12px;padding:10px 14px;font-size:13px;box-shadow:0 8px 20px rgba(0,0,0,.25);max-width:360px;display:flex;gap:10px;align-items:center;animation:entra .2s;cursor:pointer}
  .toast img{width:30px;height:30px;border-radius:50%}
  .ficha{position:fixed;z-index:9;pointer-events:none;background:#fff;border-radius:12px;padding:12px 14px;box-shadow:0 10px 26px rgba(0,0,0,.2);width:250px;font-size:12.5px;display:none}
  .ficha b{font-size:15px;font-family:'Cormorant Garamond',serif}.ficha .st{font-size:11.5px;color:var(--verde2);margin:4px 0}
  .hud-acc{position:fixed;top:16px;left:272px;z-index:6;display:flex;gap:8px}
  .hud-acc button{background:rgba(255,255,255,.9);border:0;border-radius:10px;padding:8px 12px;font-size:12px;color:#1B3A2D;box-shadow:0 3px 10px rgba(0,0,0,.12)}
  /* Barras (embudo y uso) */
  .barras .fila{display:grid;grid-template-columns:190px 1fr 90px;gap:12px;align-items:center;padding:7px 0;font-size:13px}
  .barras .b{height:26px;background:var(--crema2);border-radius:6px;overflow:hidden}.barras .b i{display:block;height:100%;background:var(--verde);border-radius:6px}
  .barras .b i.d{background:var(--dorado)}
  @media (max-width:820px){.hud-acc{left:16px;top:64px}.cal .dia{min-height:80px}.barras .fila{grid-template-columns:110px 1fr 60px}}`;
  document.head.appendChild(css);

  // ---------- Navegación: botones y secciones nuevas ----------
  const nav = document.querySelector("aside nav");
  const nuevos = [["hoy", "☀️ Hoy"], ["bandeja", "📥 Bandeja <span class=\"count\" id=\"c-bandeja\" hidden>0</span>"], ["feed", "📱 Feed"], ["calendario", "🗓️ Calendario"], ["envios", "✉️ Envíos <span class=\"count\" id=\"c-envios\" hidden>0</span>"], ["embudo", "📈 Embudo"], ["uso", "⚡ Uso de Claude"]];
  nuevos.reverse().forEach(([v, label]) => {
    const b = document.createElement("button"); b.dataset.view = v; b.innerHTML = label; b.onclick = () => show(v);
    nav.insertBefore(b, nav.children[1]);
  });
  const main = document.querySelector("main");
  const sec = (id, html) => { const s = document.createElement("section"); s.className = "view"; s.id = "v-" + id; s.innerHTML = html; main.appendChild(s); return s; };
  sec("hoy", `<div class="head"><div><div class="kicker" id="hoy-fecha"></div><h1 id="hoy-saludo">Hoy en Küme</h1><p>Lo que pasó y lo que te toca.</p></div><button class="btn ghost" id="btn-avisos">🔔 Activar avisos</button></div><div id="hoy"></div>`);
  sec("bandeja", `<div class="head"><div><div class="kicker">Todo lo pendiente en un solo lugar</div><h1>Bandeja</h1><p>Usá el teclado: <span class="kbd">A</span> aprobar · <span class="kbd">D</span> descartar · <span class="kbd">E</span> editar · <span class="kbd">→</span> siguiente</p></div><button class="btn ghost" onclick="KUMEUX.bandeja()">Actualizar</button></div><div class="bandeja-wrap" id="bandeja"></div>`);
  sec("feed", `<div class="head"><div><div class="kicker">Así va a quedar tu perfil</div><h1>Vista del feed</h1><p>Arriba lo que viene (aprobado o por aprobar), abajo lo que ya publicaste.</p></div><label style="font-size:13px"><input type="checkbox" id="feed-pend" checked> Incluir lo que falta aprobar</label></div><div id="feed"></div>`);
  sec("calendario", `<div class="head"><div><div class="kicker">Contenido de Küme</div><h1 id="cal-titulo">Calendario</h1><p>Arrastrá una pieza a otro día para cambiarle la fecha.</p></div><div style="display:flex;gap:8px"><button class="btn ghost" id="cal-prev">‹ Mes anterior</button><button class="btn ghost" id="cal-hoy">Hoy</button><button class="btn ghost" id="cal-next">Mes siguiente ›</button></div></div><div id="calendario"></div>`);
  sec("envios", `<div class="head"><div><div class="kicker">Mails a prospectos</div><h1>Envíos</h1><p>Lo que aprobás sale solo por mail, 10 minutos después. Hasta entonces lo podés cancelar.</p></div><button class="btn ghost" onclick="KUMEUX.envios()">Actualizar</button></div><div id="envios"></div>`);
  sec("embudo", `<div class="head"><div><div class="kicker">Ventas</div><h1>Embudo</h1><p>De los negocios que encuentra Dwight a los que se vuelven clientes.</p></div></div><div id="embudo"></div>`);
  sec("uso", `<div class="head"><div><div class="kicker">Para cuidar tu plan</div><h1>Uso de Claude</h1><p>Cuánto trabajó cada agente. El costo es una referencia de cuánto pesa cada pedido.</p></div><select id="uso-rango" style="padding:9px 12px;border-radius:8px;border:1px solid rgba(27,58,45,.25)"><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="1">Hoy</option></select></div><div id="uso"></div>`);
  document.body.insertAdjacentHTML("beforeend", `
    <div class="editor" id="editor"><div class="bar"><b id="ed-titulo">Editar diseño</b><span style="font-size:12.5px;opacity:.85">Hacé clic en cualquier texto y escribí.</span><button class="btn gold" id="ed-guardar">💾 Guardar y regenerar</button><button class="btn ghost" style="color:var(--crema);border-color:rgba(245,239,224,.4)" onclick="KUMEUX.cerrarEditor()">Cancelar</button></div><iframe id="ed-frame"></iframe></div>
    <div class="toasts" id="toasts"></div><div class="ficha" id="ficha"></div>
    <div class="hud-acc"><button id="btn-reunion">📣 Reunión</button><button id="btn-noche">🌙 Noche</button></div>`);

  const ganchos = { envios: () => KUMEUX.envios(), hoy: pintarHoy, bandeja: () => KUMEUX.bandeja(), feed: pintarFeed, calendario: pintarCal, embudo: pintarEmbudo, uso: pintarUso };
  const showOrig = show;
  window.show = show = function (v) { showOrig(v); ganchos[v] && ganchos[v](); };

  // ---------- Datos ----------
  async function datos() {
    const [pros, cont, prop, diag] = await Promise.all([
      fetch("/api/prospectos").then((r) => r.json()).catch(() => ({ items: [] })),
      fetch("/api/contenido").then((r) => r.json()).catch(() => ({ items: [] })),
      fetch("/api/propuestas").then((r) => r.json()).catch(() => []),
      fetch("/api/diagnosticos").then((r) => r.json()).catch(() => []),
    ]);
    PROS = pros.items || []; CONT = cont.items || [];
    return { pros: PROS, cont: CONT, prop, diag };
  }

  // ---------- 1) BANDEJA ÚNICA ----------
  let B = { items: [], i: 0, editando: false };
  function armarBandeja({ pros, cont }) {
    const items = [];
    pros.filter((p) => p.estado === "Mensaje listo").forEach((p) => items.push({ tipo: "prospecto", p }));
    pros.filter((p) => p.estado === "Seguimiento listo").forEach((p) => items.push({ tipo: "seguimiento", p }));
    cont.filter((c) => c.estado === "Para aprobar").forEach((c) => items.push({ tipo: "contenido", c }));
    return items;
  }
  async function bandeja() {
    const d = await datos(); B = { items: armarBandeja(d), i: 0, editando: false, hechos: 0 };
    pintarBandeja(); contar(d);
  }
  function pintarBandeja() {
    const el = $("#bandeja"), n = B.items.length;
    if (B.i >= n) { el.innerHTML = `<div class="bandeja-card" style="text-align:center;padding:50px"><div style="font-size:48px">🎉</div><h2 style="font-size:34px">¡Bandeja vacía!</h2><p style="color:var(--verde2);margin-top:8px">${B.hechos ? `Despachaste ${B.hechos} ${B.hechos === 1 ? "cosa" : "cosas"}. ` : ""}No hay nada pendiente.</p><button class="btn" style="margin-top:18px" onclick="show('oficina')">Volver a la oficina</button></div>`; return; }
    const it = B.items[B.i], pct = Math.round((B.i / n) * 100);
    let cuerpo = "", acc = "";
    if (it.tipo === "prospecto" || it.tipo === "seguimiento") {
      const p = it.p, txt = it.tipo === "seguimiento" ? p.seguimiento : p.mensaje;
      const diagPdf = (p.fuentes.match(/diagnostico\/salidas\/([^/\s]+)\/diagnostico\.pdf/) || [])[1];
      cuerpo = `<div class="bandeja-tipo">${it.tipo === "seguimiento" ? "2º mensaje · Andy" : "Prospecto nuevo · Dwight"}</div>
        <h2 style="font-size:34px;margin:4px 0">${H(p.negocio)}</h2>
        <div class="meta">${H(p.rubro)} · ${H(p.zona)} · <b>${H(p.puntaje)}</b> ${p.instagram ? ` · <a href="${H(p.instagram)}" target="_blank">Instagram ↗</a>` : ""}${p.web ? ` · <a href="${H(p.web)}" target="_blank">Web ↗</a>` : ""}</div>
        <p class="op" style="margin:8px 0 14px">${H(p.oportunidad)}</p>
        ${diagPdf ? `<p style="margin-bottom:10px"><a href="/files/diagnostico/${encodeURIComponent(diagPdf)}/diagnostico.pdf" target="_blank">📄 Diagnóstico gratis de Angela (PDF)</a></p>` : ""}
        ${B.editando ? `<textarea class="editarea" id="b-txt">${H(txt)}</textarea>` : `<div class="msg">${H(txt)}</div>`}`;
      acc = B.editando
        ? `<button class="btn gold" onclick="KUMEUX.guardarTexto()">💾 Guardar</button><button class="btn ghost" onclick="KUMEUX.editar(false)">Cancelar</button>`
        : (it.tipo === "seguimiento"
          ? `<button class="btn gold" onclick="KUMEUX.accion('a')">📋 Copiar y marcar enviado<span class="kbd">A</span></button>`
          : `<button class="btn gold" onclick="KUMEUX.accion('a')">✅ Aprobar<span class="kbd">A</span></button><button class="btn ghost" onclick="navigator.clipboard.writeText(KUMEUX.texto());this.textContent='Copiado ✓'">📋 Copiar</button>`)
          + `<button class="btn ghost" onclick="KUMEUX.editar(true)">✏️ Editar<span class="kbd">E</span></button><button class="btn red" onclick="KUMEUX.accion('d')">Descartar<span class="kbd">D</span></button><button class="btn ghost" onclick="KUMEUX.mover(1)">Saltar<span class="kbd">→</span></button>`;
    } else {
      const c = it.c;
      cuerpo = `<div class="bandeja-tipo">Contenido · Pam · ${H(fechaLinda(c.fecha))} · ${H(c.formato)}</div>
        <h2 style="font-size:32px;margin:4px 0">${H(c.pieza)}</h2>
        ${c.imagenes.length ? `<div class="bandeja-prev">${c.imagenes.map((src, k) => `<img src="${src}" onclick="abrirVista('${c.id}', ${k})" alt="">`).join("")}</div>` : `<p class="op">${H(c.guion)}</p>`}
        ${B.editando ? `<textarea class="editarea" id="b-txt">${H(c.caption)}</textarea><textarea class="editarea" id="b-tags" style="min-height:60px;margin-top:8px">${H(c.hashtags)}</textarea>` : `<div class="msg" style="background:var(--crema)">${H(c.caption)}\n\n${H(c.hashtags)}</div>`}`;
      acc = B.editando
        ? `<button class="btn gold" onclick="KUMEUX.guardarTexto()">💾 Guardar caption</button><button class="btn ghost" onclick="KUMEUX.editar(false)">Cancelar</button>`
        : `<button class="btn gold" onclick="KUMEUX.accion('a')">✅ Aprobar<span class="kbd">A</span></button><button class="btn ghost" onclick="KUMEUX.editar(true)">✏️ Editar caption<span class="kbd">E</span></button>${c.carpeta ? `<button class="btn ghost" onclick="KUMEUX.abrirEditor('${H(c.carpeta)}')">🎨 Editar diseño</button>` : ""}<button class="btn red" onclick="KUMEUX.accion('d')">Pedir cambios<span class="kbd">D</span></button><button class="btn ghost" onclick="KUMEUX.mover(1)">Saltar<span class="kbd">→</span></button>`;
    }
    el.innerHTML = `<div class="barra-prog"><i style="width:${pct}%"></i></div><div class="bandeja-top"><span>${B.i + 1} de ${n}</span><span>${B.hechos || 0} despachados</span></div><div class="bandeja-card">${cuerpo}<div class="bandeja-acc">${acc}</div></div>`;
    if (B.editando) setTimeout(() => $("#b-txt")?.focus(), 30);
  }
  async function accion(k) {
    const it = B.items[B.i]; if (!it) return;
    const patch = (url, body) => fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    let envio = null;
    if (it.tipo === "prospecto") envio = (await (await patch("/api/prospectos/" + it.p.id, { estado: k === "a" ? "Aprobado" : "Descartado" })).json()).envio;
    if (it.tipo === "seguimiento") { if (k === "a") navigator.clipboard.writeText(it.p.seguimiento).catch(() => {}); envio = (await (await patch("/api/prospectos/" + it.p.id, { estado: k === "a" ? "Contactado" : "Descartado" })).json()).envio; }
    if (envio) toast(envio.encolado ? `✉️ ${it.p.negocio}: sale por mail en 10 minutos` : envio.motivo === "sin mail" ? `📋 ${it.p.negocio} no tiene mail: mandalo a mano (ya está copiado)` : `✉️ No se encoló: ${envio.motivo}`, null, () => show("envios"));
    if (it.tipo === "contenido") {
      await patch("/api/contenido/" + it.c.id, { estado: k === "a" ? "Aprobado" : "Borrador" });
      if (k === "d") { openChat("contenido").then(() => { $("#txt").value = `Cambios para "${it.c.pieza}" (${it.c.fecha}): `; $("#txt").focus(); }); }
    }
    toast(k === "a" ? "✅ Listo" : "🗑️ Hecho", null);
    B.items.splice(B.i, 1); B.hechos = (B.hechos || 0) + 1; B.editando = false; pintarBandeja(); refrescarContadores();
  }
  async function guardarTexto() {
    const it = B.items[B.i], txt = $("#b-txt").value;
    if (it.tipo === "contenido") {
      await fetch(`/api/contenido/${it.c.id}/campos`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caption: txt, hashtags: $("#b-tags").value }) });
      it.c.caption = txt; it.c.hashtags = $("#b-tags").value;
    } else {
      const campo = it.tipo === "seguimiento" ? "seguimiento" : "mensaje";
      await fetch(`/api/prospectos/${it.p.id}/texto`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campo, texto: txt }) });
      it.p[campo] = txt;
    }
    B.editando = false; pintarBandeja(); toast("💾 Guardado en Notion", null);
  }
  document.addEventListener("keydown", (e) => {
    if (!$("#v-bandeja").classList.contains("on") || !document.body.classList.contains("panel") || window.VISTA || $("#editor").classList.contains("on")) return;
    if (/TEXTAREA|INPUT|SELECT/.test(document.activeElement.tagName)) { if (e.key === "Escape") KUMEUX.editar(false); return; }
    const k = e.key.toLowerCase();
    if (k === "a") accion("a"); else if (k === "d") accion("d"); else if (k === "e") { e.preventDefault(); KUMEUX.editar(true); }
    else if (e.key === "ArrowRight") KUMEUX.mover(1); else if (e.key === "ArrowLeft") KUMEUX.mover(-1);
  });

  // ---------- 2) FEED ----------
  async function pintarFeed() {
    const d = await datos(), conPend = $("#feed-pend").checked;
    const real = await fetch("/api/feed-real").then((r) => r.json()).catch(() => []);
    const vienen = d.cont.filter((c) => ["Aprobado", "Programado", "Grabar (humano)"].concat(conPend ? ["Para aprobar"] : []).includes(c.estado))
      .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    const celda = (c) => c.imagenes.length
      ? `<div class="p" onclick="abrirVista('${c.id}',0)"><img src="${c.imagenes[0]}" alt=""><span class="tag">${H(c.estado === "Para aprobar" ? "por aprobar" : c.estado.toLowerCase())} · ${H((c.fecha || "").slice(5).split("-").reverse().join("/"))}</span></div>`
      : `<div class="p"><div class="reel">🎬 ${H(c.formato)}<br>${H(c.pieza)}</div><span class="tag">${H((c.fecha || "").slice(5).split("-").reverse().join("/"))}</span></div>`;
    $("#feed").innerHTML = `<div class="feed-head"><img src="avatars/kume.png" alt=""><div><b>kume.agencia</b><div class="meta" style="margin:2px 0 0">${vienen.length} piezas que vienen · ${real.length} últimas publicadas</div></div></div>
      <div class="feed">${vienen.map(celda).join("")}${real.map((src) => `<div class="p"><img src="${src}" alt=""><span class="tag real">publicado</span></div>`).join("")}</div>`;
  }
  document.addEventListener("change", (e) => { if (e.target.id === "feed-pend") pintarFeed(); });

  // ---------- 3) CALENDARIO ----------
  let mes = new Date(); mes.setDate(1);
  async function pintarCal() {
    const d = await datos(), y = mes.getFullYear(), m = mes.getMonth();
    $("#cal-titulo").textContent = mes.toLocaleDateString("es-AR", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
    const inicio = new Date(y, m, 1); inicio.setDate(1 - ((inicio.getDay() + 6) % 7));
    const porDia = {}; d.cont.forEach((c) => { if (c.fecha) (porDia[c.fecha] = porDia[c.fecha] || []).push(c); });
    let html = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].map((x) => `<div class="cal-h">${x}</div>`).join("");
    for (let i = 0; i < 42; i++) {
      const dd = new Date(inicio); dd.setDate(inicio.getDate() + i); const iso = dd.toLocaleDateString("sv-SE");
      html += `<div class="dia ${dd.getMonth() !== m ? "otro" : ""} ${iso === hoyISO() ? "hoy" : ""}" data-fecha="${iso}"><div class="num">${dd.getDate()}</div>${(porDia[iso] || []).map((c) => `<div class="pz" draggable="true" data-id="${c.id}" title="${H(c.pieza)}" ondblclick="${c.imagenes.length ? `abrirVista('${c.id}',0)` : ""}">${c.imagenes.length ? `<img src="${c.imagenes[0]}" alt="">` : "🎬"}<div>${H(c.pieza.slice(0, 38))}${c.pieza.length > 38 ? "…" : ""}<div class="e">${H(c.estado)}</div></div></div>`).join("")}</div>`;
    }
    $("#calendario").innerHTML = `<div class="cal">${html}</div>`;
  }
  $("#cal-prev").onclick = () => { mes.setMonth(mes.getMonth() - 1); pintarCal(); };
  $("#cal-next").onclick = () => { mes.setMonth(mes.getMonth() + 1); pintarCal(); };
  $("#cal-hoy").onclick = () => { mes = new Date(); mes.setDate(1); pintarCal(); };
  document.addEventListener("dragstart", (e) => { const pz = e.target.closest?.(".pz"); if (pz) e.dataTransfer.setData("text/plain", pz.dataset.id); });
  document.addEventListener("dragover", (e) => { const d = e.target.closest?.(".cal .dia"); if (d) { e.preventDefault(); document.querySelectorAll(".cal .sobre").forEach((x) => x.classList.remove("sobre")); d.classList.add("sobre"); } });
  document.addEventListener("drop", async (e) => {
    const d = e.target.closest?.(".cal .dia"); if (!d) return; e.preventDefault();
    const id = e.dataTransfer.getData("text/plain"); if (!id) return;
    await fetch(`/api/contenido/${id}/campos`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fecha: d.dataset.fecha }) });
    toast(`🗓️ Movida al ${d.dataset.fecha.split("-").reverse().join("/")}`, null); pintarCal();
  });

  // ---------- 4) EDITOR DE DISEÑO ----------
  let edCarpeta = null;
  const EDITABLES = ".titulo,.pre,.sub,.etiqueta,.titulo-verde,.pildora,.texto-gris,.desliza,.contador,.meme,.nota,.cta,.sticker,.num,h1,h2,p";
  function abrirEditor(carpeta) {
    edCarpeta = carpeta; $("#ed-titulo").textContent = "Editar diseño · " + carpeta;
    const fr = $("#ed-frame"); fr.src = `/files/contenido/${encodeURIComponent(carpeta)}/piezas.html?t=${Date.now()}`;
    fr.onload = () => {
      const doc = fr.contentDocument;
      const st = doc.createElement("style"); st.id = "kume-editor";
      st.textContent = `body{zoom:.5} [contenteditable]{outline:2px dashed rgba(227,168,58,.0);cursor:text} [contenteditable]:hover{outline-color:rgba(227,168,58,.9)} [contenteditable]:focus{outline:3px solid #E3A83A}`;
      doc.head.appendChild(st);
      doc.querySelectorAll(EDITABLES).forEach((n) => n.setAttribute("contenteditable", "true"));
    };
    $("#editor").classList.add("on");
  }
  function cerrarEditor() { $("#editor").classList.remove("on"); $("#ed-frame").src = "about:blank"; }
  $("#ed-guardar").onclick = async () => {
    const doc = $("#ed-frame").contentDocument; if (!doc) return;
    const copia = doc.documentElement.cloneNode(true);
    copia.querySelectorAll("#kume-editor, .escena, .fondo-foto").forEach((n) => n.remove());
    copia.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
    copia.querySelectorAll("[data-g]").forEach((n) => (n.innerHTML = ""));
    const html = "<!doctype html>\n" + copia.outerHTML;
    $("#ed-guardar").textContent = "⏳ Regenerando…"; $("#ed-guardar").disabled = true;
    const r = await fetch(`/api/contenido-guardar/${encodeURIComponent(edCarpeta)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html }) });
    $("#ed-guardar").textContent = "💾 Guardar y regenerar"; $("#ed-guardar").disabled = false;
    if (!r.ok) return alert((await r.json()).error);
    cerrarEditor(); toast("🎨 Diseño guardado y regenerado", null);
    // forzar que se vean las imágenes nuevas
    CONT.forEach((c) => (c.imagenes = c.imagenes.map((s) => s.split("?")[0] + "?v=" + Date.now())));
    if ($("#v-contenido").classList.contains("on")) loadContenido(); if ($("#v-bandeja").classList.contains("on")) pintarBandeja();
  };

  // ---------- 5) PROGRESO EN VIVO + archivos en el chat ----------
  const pasos = {}; // agente → [textos]
  const iconoArchivo = (f) => /\.pdf$/i.test(f) ? "📄" : /\.html$/i.test(f) ? "🌐" : /\.csv$/i.test(f) ? "📊" : "📝";
  const tarjetas = (agente, archivos = []) => archivos.length ? `<div class="archivos">${archivos.map((f) => { const url = `/files/${agente}/${f.split("/").map(encodeURIComponent).join("/")}`; return `<a class="archivo" href="${url}" target="_blank">${/\.png$/i.test(f) ? `<img src="${url}" alt="">` : `<div class="ico">${iconoArchivo(f)}</div>`}<span>${H(f)}</span></a>`; }).join("")}</div>` : "";
  window.renderChat = renderChat = function (chat, busy) {
    const list = chat.messages.map((m) => `<div class="bubble ${m.de} ${m.error ? "error" : ""}">${md(m.texto)}${m.de === "agente" ? tarjetas(current?.id, m.archivos) : ""}</div>`);
    if (!chat.messages.length) list.push(`<div class="typing">Todavía no hablaron. Probá con uno de los atajos de abajo.</div>`);
    if (busy) list.push(`<div class="pasos" id="pasos-vivo">${(pasos[current?.id] || ["⏳ Arrancando…"]).slice(-6).map((t) => `<span>${H(t)}</span>`).join("")}</div>`);
    $("#msgs").innerHTML = list.join(""); $("#msgs").scrollTop = 1e9; $("#btn-send").disabled = !!busy;
  };
  const es = new EventSource("/api/eventos");
  es.onmessage = (m) => {
    let ev; try { ev = JSON.parse(m.data); } catch { return; }
    if (ev.tipo === "inicio") { pasos[ev.agente] = ["⏳ Arrancando…"]; window.OF && OF.setBusy(ev.agente, true); }
    if (ev.tipo === "progreso") {
      (pasos[ev.agente] = pasos[ev.agente] || []).push(ev.texto);
      if (current?.id === ev.agente && $("#pasos-vivo")) { $("#pasos-vivo").innerHTML = pasos[ev.agente].slice(-6).map((t) => `<span>${H(t)}</span>`).join(""); $("#msgs").scrollTop = 1e9; }
      window.OF && OF.say(ev.agente, ev.texto, 5);
    }
    if (ev.tipo === "envio") {
      const t = { encolado: `✉️ En cola: ${ev.negocio}`, enviado: `✅ Mail enviado a ${ev.negocio}`, error: `⚠️ No se pudo mandar a ${ev.negocio}: ${ev.error}` }[ev.accion];
      toast(t, null, () => show("envios")); if (ev.accion !== "encolado") avisar(t);
      if ($("#v-envios").classList.contains("on")) KUMEUX.envios(); contarEnvios();
    }
    if (ev.tipo === "fin") {
      delete pasos[ev.agente];
      const txt = `${ev.ok ? "✅" : "⚠️"} ${ev.nombre} terminó${ev.origen === "rutina" ? " (rutina)" : ""}${ev.archivos?.length ? ` · ${ev.archivos.length} archivo${ev.archivos.length > 1 ? "s" : ""}` : ""}`;
      toast(txt, ev.agente, () => openChat(ev.agente)); avisar(txt, ev.resumen); refrescarContadores();
    }
  };

  // ---------- 7) AVISOS: notificación, sonido y contador en la pestaña ----------
  function sonido() { try { const ctx = new AudioContext(), o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.setValueAtTime(880, ctx.currentTime); o.frequency.setValueAtTime(1320, ctx.currentTime + 0.12); g.gain.setValueAtTime(0.08, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4); o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.42); } catch {} }
  function avisar(titulo, cuerpo) {
    sonido();
    if ("Notification" in window && Notification.permission === "granted" && document.hidden) new Notification(titulo, { body: cuerpo || "", icon: "avatars/kume.png" });
  }
  function toast(texto, agente, onclick) {
    const t = document.createElement("div"); t.className = "toast";
    t.innerHTML = `${agente ? `<img src="${fotoDe(agente)}" alt="">` : ""}<span>${H(texto)}</span>`;
    if (onclick) t.onclick = onclick;
    $("#toasts").appendChild(t); setTimeout(() => t.remove(), 6000);
  }
  async function refrescarContadores() {
    const d = await datos(); contar(d);
    if ($("#v-contenido").classList.contains("on")) loadContenido();
  }
  let ultimoPend = null;
  function contar({ pros, cont }) {
    const n = armarBandeja({ pros, cont }).length;
    $("#c-bandeja").hidden = !n; $("#c-bandeja").textContent = n;
    document.title = n ? `(${n}) Küme HQ` : "Küme HQ";
    if (ultimoPend !== null && n > ultimoPend) avisar(`📥 ${n - ultimoPend} cosa${n - ultimoPend > 1 ? "s" : ""} nueva${n - ultimoPend > 1 ? "s" : ""} para aprobar`, "Abrí la Bandeja en Küme HQ");
    ultimoPend = n;
  }
  $("#btn-avisos").onclick = async () => {
    if (!("Notification" in window)) return alert("Este navegador no permite avisos.");
    const r = await Notification.requestPermission();
    $("#btn-avisos").textContent = r === "granted" ? "🔔 Avisos activados" : "🔕 Avisos bloqueados"; if (r === "granted") sonido();
  };

  // ---------- 6) HOY ----------
  async function pintarHoy() {
    const h = new Date().getHours();
    $("#hoy-saludo").textContent = (h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches") + ", Ignacio";
    $("#hoy-fecha").textContent = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
    if ("Notification" in window && Notification.permission === "granted") $("#btn-avisos").textContent = "🔔 Avisos activados";
    const [d, rut, uso, cob] = await Promise.all([datos(), fetch("/api/rutinas").then((r) => r.json()).catch(() => ({ rutinas: [], historial: [] })), fetch("/api/uso").then((r) => r.json()).catch(() => []), fetch("/api/salidas/cobros").then((r) => r.json()).catch(() => [])]);
    const movil = await fetch("/api/movil").then((r) => r.json()).catch(() => ({ activo: false }));
    const desde = Date.now() - 36 * 3600e3;
    const pend = armarBandeja(d), respondieron = d.pros.filter((p) => p.estado === "Respondió" || p.estado === "Consulta agendada");
    const hechos = uso.filter((u) => Date.parse(u.fecha) > desde);
    const porAgente = {}; hechos.forEach((u) => (porAgente[u.agente] = (porAgente[u.agente] || 0) + 1));
    const proximas = rut.rutinas.filter((r) => r.activa && r.proxima).sort((a, b) => a.proxima.localeCompare(b.proxima)).slice(0, 4);
    const estadoCobros = cob.find((f) => /^estado-/.test(f.ruta));
    $("#hoy").innerHTML = `<div class="grid2">
      <div class="tile"><h3>Para aprobar</h3><div class="big">${pend.length}</div><p class="meta">${d.pros.filter((p) => p.estado === "Mensaje listo").length} mensajes · ${d.pros.filter((p) => p.estado === "Seguimiento listo").length} seguimientos · ${d.cont.filter((c) => c.estado === "Para aprobar").length} piezas</p>${pend.length ? `<button class="btn gold" onclick="show('bandeja')">Abrir la bandeja</button>` : ""}</div>
      <div class="tile"><h3>Respondieron 🎉</h3><div class="big">${respondieron.length}</div><ul>${respondieron.slice(0, 5).map((p) => `<li><b>${H(p.negocio)}</b> · ${H(p.estado)}</li>`).join("") || `<li class="meta">Nadie todavía. Andy se encarga de insistir.</li>`}</ul></div>
      <div class="tile"><h3>Lo que hizo el equipo</h3><div class="big">${hechos.length}</div><p class="meta">pedidos en las últimas 36 horas</p><div>${Object.entries(porAgente).map(([id, n]) => `<span class="chip"><img src="${fotoDe(id)}" alt="">${H(nombreDe(id))} · ${n}</span>`).join("") || `<span class="meta">Sin actividad.</span>`}</div></div>
      <div class="tile"><h3>Lo que viene</h3><ul>${proximas.map((r) => `<li><b>${H(nombreDe(r.agente))}</b> · ${H(r.nombre)}<br><span class="meta">${new Date(r.proxima).toLocaleString("es-AR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span></li>`).join("") || `<li class="meta">No hay rutinas activas. Prendelas en 🤖 Piloto automático.</li>`}</ul></div>
      <div class="tile"><h3>Cobros</h3>${estadoCobros ? `<p>Kevin dejó el estado del mes.</p><a class="btn ghost" style="display:inline-block;margin-top:8px;text-decoration:none" href="/files/cobros/${estadoCobros.ruta}" target="_blank">Ver estado de cobros</a>` : `<p class="meta">Kevin todavía no tiene datos. Pasale los cobros por el chat.</p>`}</div>
      <div class="tile"><h3>📱 Aprobar desde el celu</h3>${movil.activo ? `<p>Con el celu en tu mismo WiFi, escaneá con la cámara:</p><div id="movil-qr" style="margin:8px 0;width:150px;height:150px;background:#fff"></div><p><b>${movil.urls.map(H).join("<br>")}</b></p><p style="margin-top:6px">PIN: <b id="movil-pin" style="letter-spacing:.2em;filter:blur(5px);cursor:pointer" title="Clic para ver" onclick="this.style.filter=''">${H(movil.pin)}</b> <span class="meta">(clic para ver)</span></p><p class="meta" style="margin-top:6px">Solo funciona dentro de tu red.</p>` : `<p class="meta">Apagado. Para prenderlo, agregá <code>MOVIL_PIN=</code> y 6 números en <code>app/.env</code> y reiniciá la app.</p>`}</div>
      <div class="tile"><h3>Atajos</h3><ul><li><a href="#" onclick="show('feed');return false">📱 Ver cómo queda el feed</a></li><li><a href="#" onclick="show('calendario');return false">🗓️ Calendario de contenido</a></li><li><a href="#" onclick="show('embudo');return false">📈 Embudo de ventas</a></li><li><a href="#" onclick="OF&&OF.reunion();show('oficina');return false">📣 Llamar a reunión</a></li></ul></div>
    </div>`;
    if (movil.activo && movil.urls[0]) pintarQR(movil.urls[0]);
  }

  // QR de la dirección del celu (librería qrcode-generator, se carga solo cuando hace falta)
  function pintarQR(url) {
    const dibujar = () => { const q = qrcode(0, "M"); q.addData(url); q.make(); const el = $("#movil-qr"); if (el) el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); };
    if (window.qrcode) return dibujar();
    const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"; sc.onload = dibujar; document.head.appendChild(sc);
  }

  // ---------- 9) EMBUDO ----------
  async function pintarEmbudo() {
    const d = await datos(), P = d.pros, total = P.length || 1;
    const en = (...e) => P.filter((p) => e.includes(p.estado)).length;
    const contact = en("Contactado", "Seguimiento listo", "Respondió", "Consulta agendada", "Cliente");
    const etapas = [
      ["Encontrados por Dwight", P.length],
      ["Aprobados o enviados", en("Aprobado") + contact],
      ["Contactados", contact],
      ["Respondieron", en("Respondió", "Consulta agendada", "Cliente")],
      ["Consulta agendada", en("Consulta agendada", "Cliente")],
      ["Propuestas armadas (Jim)", d.prop.filter((x) => !/demo/.test(x.cliente)).length],
      ["Clientes 🎉", en("Cliente")],
    ];
    const grupo = (campo) => {
      const g = {};
      P.forEach((p) => { const k = p[campo] || "—"; g[k] = g[k] || { tot: 0, cont: 0, resp: 0 }; g[k].tot++; if (["Contactado", "Seguimiento listo", "Respondió", "Consulta agendada", "Cliente"].includes(p.estado)) g[k].cont++; if (["Respondió", "Consulta agendada", "Cliente"].includes(p.estado)) g[k].resp++; });
      return Object.entries(g).sort((a, b) => b[1].tot - a[1].tot).map(([k, v]) => `<div class="fila"><span>${H(k)}</span><div class="b"><i style="width:${v.cont ? Math.round((v.resp / v.cont) * 100) : 0}%" class="d"></i></div><span>${v.resp}/${v.cont} resp.</span></div>`).join("");
    };
    $("#embudo").innerHTML = `<div class="tile barras">${etapas.map(([n, v], i) => `<div class="fila"><span>${H(n)}</span><div class="b"><i style="width:${Math.max(2, Math.round((v / total) * 100))}%"></i></div><span><b>${v}</b>${i ? ` · ${etapas[i - 1][1] ? Math.round((v / etapas[i - 1][1]) * 100) : 0}%` : ""}</span></div>`).join("")}
      <p class="meta" style="margin-top:10px">El % es contra la etapa anterior. Para marcar un cliente: en Para aprobar → "Consulta agendada" → "¡Cerramos!".</p></div>
      <div class="grid2" style="margin-top:14px"><div class="tile barras"><h3>Respuesta por rubro</h3>${grupo("rubro") || `<p class="meta">Sin datos.</p>`}</div><div class="tile barras"><h3>Respuesta por zona</h3>${grupo("zona") || `<p class="meta">Sin datos.</p>`}</div></div>`;
  }

  // ---------- 10) USO DE CLAUDE ----------
  async function pintarUso() {
    const dias = Number($("#uso-rango").value), desde = Date.now() - dias * 86400e3;
    const uso = (await fetch("/api/uso").then((r) => r.json()).catch(() => [])).filter((u) => Date.parse(u.fecha) > desde);
    const g = {}; uso.forEach((u) => { const k = u.agente; g[k] = g[k] || { n: 0, seg: 0, costo: 0, tok: 0, rut: 0 }; g[k].n++; g[k].seg += u.segundos; g[k].costo += u.costo || 0; g[k].tok += (u.entrada || 0) + (u.salida || 0); if (u.origen === "rutina") g[k].rut++; });
    const filas = Object.entries(g).sort((a, b) => b[1].costo - a[1].costo), max = Math.max(...filas.map(([, v]) => v.costo), 0.0001);
    const tot = filas.reduce((s, [, v]) => s + v.costo, 0), totN = filas.reduce((s, [, v]) => s + v.n, 0);
    $("#uso").innerHTML = `<div class="grid2"><div class="tile"><h3>Pedidos</h3><div class="big">${totN}</div><p class="meta">${uso.filter((u) => u.origen === "rutina").length} de rutinas automáticas</p></div><div class="tile"><h3>Peso total</h3><div class="big">US$ ${tot.toFixed(2)}</div><p class="meta">Equivalente en API, como referencia. Con tu plan no se cobra aparte, pero muestra quién consume más.</p></div></div>
      <div class="tile barras" style="margin-top:14px">${filas.map(([id, v]) => `<div class="fila"><span><img src="${fotoDe(id)}" style="width:22px;height:22px;border-radius:50%;vertical-align:middle;margin-right:6px">${H(nombreDe(id))}</span><div class="b"><i style="width:${Math.round((v.costo / max) * 100)}%" class="${v.rut > v.n / 2 ? "d" : ""}"></i></div><span>${v.n} · ${Math.round(v.seg / 60)} min</span></div>`).join("") || `<p class="meta">Todavía no hay registros. Se empiezan a guardar desde ahora.</p>`}
      <p class="meta" style="margin-top:8px">Barra dorada = la mayoría de sus pedidos vienen del piloto automático.</p></div>`;
  }
  document.addEventListener("change", (e) => { if (e.target.id === "uso-rango") pintarUso(); });

  // ---------- 8) OFICINA: tarjeta al pasar el mouse, reunión y día/noche ----------
  const ficha = $("#ficha"); let fichaId = null;
  async function mostrarFicha(id, x, y) {
    fichaId = id; if (!id) { ficha.style.display = "none"; return; }
    const a = AGENTS.find((q) => q.id === id); if (!a) return;
    ficha.style.left = Math.min(x + 18, innerWidth - 270) + "px"; ficha.style.top = Math.min(y + 12, innerHeight - 160) + "px";
    ficha.innerHTML = `<b>${H(a.nombre)}</b> · ${H(a.rol)}<div class="st">${a.ocupado ? "💻 Trabajando ahora" : "🟢 Disponible"}</div><div>${H(a.descripcion)}</div><div class="st" id="ficha-ult">Última entrega: …</div><div class="st">Clic para hablarle</div>`;
    ficha.style.display = "block";
    const ult = (await fetch("/api/salidas/" + id).then((r) => r.json()).catch(() => []))[0];
    if (fichaId === id && $("#ficha-ult")) $("#ficha-ult").textContent = ult ? `Última entrega: ${ult.ruta.split("/")[0]} (${new Date(ult.fecha).toLocaleDateString("es-AR")})` : "Todavía no entregó nada";
  }
  document.addEventListener("mousemove", (e) => { if (fichaId) { ficha.style.left = Math.min(e.clientX + 18, innerWidth - 270) + "px"; ficha.style.top = Math.min(e.clientY + 12, innerHeight - 160) + "px"; } });
  $("#btn-reunion").onclick = () => { window.OF && OF.reunion(); toast("📣 Todos a la reunión", null); };
  let noche = null;
  $("#btn-noche").onclick = () => { if (!window.OF) return; noche = !(noche ?? OF.esNoche); OF.setNoche(noche); $("#btn-noche").textContent = noche ? "☀️ Día" : "🌙 Noche"; try { localStorage.setItem("kume-noche", noche ? "1" : "0"); } catch {} };

  // ---------- 12) ENVÍOS POR MAIL ----------
  async function contarEnvios() {
    const e = await fetch("/api/envios").then((r) => r.json()).catch(() => null); if (!e) return;
    $("#c-envios").hidden = !e.cola.length; $("#c-envios").textContent = e.cola.length;
  }
  async function envios() {
    const e = await fetch("/api/envios").then((r) => r.json());
    const aprob = (await datos()).pros.filter((p) => p.estado === "Aprobado");
    const pend = aprob.filter((p) => p.email && !e.enviados.some((x) => x.id === p.id && x.tipo === "mensaje") && !e.cola.some((x) => x.id === p.id));
    const hora = (f) => new Date(f).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const aviso = e.activa
      ? `<div class="tile" style="border-top-color:var(--verde)"><h3>🟢 Envío automático prendido</h3><p class="meta">${e.enviadosHoy} de ${e.maxDia} mails hoy · uno cada 2 minutos como mínimo · cada mail lleva al pie "si no te interesa, respondé no".</p></div>`
      : `<div class="tile"><h3>⚪ Envío automático apagado</h3><p>Para prenderlo, en <code>app/.env</code> tienen que estar estas tres líneas (las completás vos, no las pegues en el chat):</p><pre style="background:var(--crema);padding:10px;border-radius:8px;margin:8px 0;font-size:12.5px">SMTP_USER=tu-mail@gmail.com
SMTP_PASS=la contraseña de aplicación de Google
ENVIO_AUTO=1</pre><p class="meta">La contraseña de aplicación se crea en myaccount.google.com/apppasswords (hace falta tener la verificación en 2 pasos). Después reabrí la app. ${e.smtp ? "El mail ya está configurado: falta ENVIO_AUTO=1." : ""}</p></div>`;
    $("#envios").innerHTML = aviso + `
      ${e.activa && pend.length ? `<div class="tile" style="margin-top:14px"><h3>Aprobados de antes</h3><p>${pend.length} prospecto${pend.length > 1 ? "s" : ""} ya aprobado${pend.length > 1 ? "s" : ""} con mail que todavía no salieron. No se mandan solos.</p><button class="btn gold" style="margin-top:8px" onclick="KUMEUX.mandarAprobados(${pend.length})">✉️ Mandarlos también</button></div>` : ""}
      <div class="grid2" style="margin-top:14px">
        <div class="tile"><h3>En cola (${e.cola.length})</h3><ul>${e.cola.map((c) => `<li><b>${H(c.negocio)}</b> · ${c.tipo === "seguimiento" ? "2º mensaje" : "1er mensaje"}${c.adjunto ? " + diagnóstico" : ""}<br><span class="meta">${H(c.para)} · sale ${c.sale > Date.now() ? "en " + Math.ceil((c.sale - Date.now()) / 60e3) + " min" : "en breve"}</span> <button class="btn red" style="padding:3px 10px;font-size:11px" onclick="KUMEUX.cancelarEnvio('${c.id}')">Cancelar</button></li>`).join("") || `<li class="meta">Nada en cola.</li>`}</ul></div>
        <div class="tile"><h3>Enviados (${e.enviados.length})</h3><ul>${e.enviados.slice(0, 15).map((x) => `<li><b>${H(x.negocio)}</b> · ${x.tipo === "seguimiento" ? "2º" : "1er"} mensaje<br><span class="meta">${H(x.para)} · ${hora(x.fecha)}</span></li>`).join("") || `<li class="meta">Todavía no salió ninguno.</li>`}</ul></div>
        <div class="tile"><h3>Sin mail (${aprob.filter((p) => !p.email).length})</h3><p class="meta">Aprobados que hay que mandar a mano por Instagram o WhatsApp.</p><ul>${aprob.filter((p) => !p.email).slice(0, 12).map((p) => `<li><b>${H(p.negocio)}</b> ${p.instagram ? `· <a href="${H(p.instagram)}" target="_blank">Instagram ↗</a>` : ""}</li>`).join("") || `<li class="meta">Ninguno.</li>`}</ul></div>
        ${e.errores.length ? `<div class="tile" style="border-top-color:#A33"><h3>Errores</h3><ul>${e.errores.slice(0, 8).map((x) => `<li><b>${H(x.negocio)}</b><br><span class="meta">${H(x.error)} · ${hora(x.fecha)}</span></li>`).join("")}</ul></div>` : ""}
      </div>`;
    contarEnvios();
  }

  // ---------- Arranque ----------
  window.KUMEUX = {
    envios,
    async cancelarEnvio(id) { await fetch("/api/envios/" + id, { method: "DELETE" }); toast("🛑 Envío cancelado", null); envios(); },
    async mandarAprobados(n) {
      if (!confirm(`¿Mandar el mail a los ${n} prospectos que ya estaban aprobados? Salen de a uno, con 10 minutos para cancelar.`)) return;
      const r = await (await fetch("/api/envios/aprobados", { method: "POST" })).json();
      toast(r.error ? "⚠️ " + r.error : `✉️ ${r.encolados} en cola`, null); envios();
    },
    bandeja, accion, guardarTexto, abrirEditor, cerrarEditor, mostrarFicha,
    editar(v) { B.editando = v; pintarBandeja(); },
    mover(d) { B.i = Math.max(0, Math.min(B.items.length, B.i + d)); B.editando = false; pintarBandeja(); },
    texto() { const it = B.items[B.i]; return it?.p ? it.p.mensaje : ""; },
    alListarOficina(of) {
      try { const n = localStorage.getItem("kume-noche"); if (n !== null) { noche = n === "1"; of.setNoche(noche); $("#btn-noche").textContent = noche ? "☀️ Día" : "🌙 Noche"; } } catch {}
    },
  };
  // "Editar diseño" también en la sección Contenido
  const loadContOrig = loadContenido;
  window.loadContenido = loadContenido = async function () {
    await loadContOrig();
    document.querySelectorAll("#contenido .card").forEach((card, i) => {
      const btn = card.querySelector('button[onclick^="abrirVista"]'); if (!btn) return;
      const id = (btn.getAttribute("onclick").match(/abrirVista\('([^']+)'/) || [])[1]; const c = CONT.find((x) => x.id === id);
      if (c?.carpeta && !card.querySelector(".btn-editar-diseno")) btn.insertAdjacentHTML("afterend", `<button class="btn ghost btn-editar-diseno" onclick="KUMEUX.abrirEditor('${H(c.carpeta)}')">🎨 Editar diseño</button>`);
    });
  };
  datos().then(contar); contarEnvios();
  setInterval(refrescarContadores, 60000);
  // el panel "Hoy" se abre solo la primera vez de cada día
  try { if (localStorage.getItem("kume-hoy") !== hoyISO()) { localStorage.setItem("kume-hoy", hoyISO()); setTimeout(() => show("hoy"), 600); } } catch {}
})();
