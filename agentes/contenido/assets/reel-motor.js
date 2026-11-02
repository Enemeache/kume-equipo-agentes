// Motor de reels de Küme (v2, edición profesional): arma un reel vertical (1080×1920) a partir de window.REEL
// y expone render(t) para que render_reel.py lo grabe cuadro por cuadro.
// Pam solo edita el bloque REEL de reel.html; acá no hace falta tocar nada.
//
// Qué hace distinto a una plantilla:
//  - Los cortes caen en el beat (las duraciones se ajustan al tempo de la música).
//  - Transiciones reales entre escenas (empuje, lateral, zoom, máscara) con desenfoque direccional y
//    aberración cromática solo durante el movimiento; el render además promedia subcuadros (motion blur).
//  - Cámara virtual: empuje lento en cada escena, sacudón corto en los cortes, paralaje del número de fondo.
//  - Tipografía editorial: líneas con máscara, palabras que suben con curva expo, acentos en serif itálica
//    con subrayado dibujado a mano, y cada línea se ajusta sola al ancho (nunca se corta una frase).
//  - Escenas con material real: recorrido de cámara por Küme HQ, captura en un celu en 3D.
//  - Diseño sonoro: window.SFX lista cada golpe, whoosh, click y tecla para que el audio quede sincronizado.
(function () {
  const R = window.REEL;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const cl = (x) => Math.max(0, Math.min(1, x));
  const seg = (t, a, b) => (b <= a ? (t >= a ? 1 : 0) : cl((t - a) / (b - a)));
  const lerp = (a, b, x) => a + (b - a) * x;
  // curvas: expo para entradas (frenan seco, como en After Effects), inOut para cámara
  const oExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
  const ioExpo = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2);
  const oCubic = (x) => 1 - Math.pow(1 - x, 3);
  const ioCubic = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const iCubic = (x) => x * x * x;
  const oBack = (x) => { const c = 1.5; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const azar = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }; // estable entre renders
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const nn = (i) => String(i + 1).padStart(2, "0");

  // ---------- texto: "No son personas.\nSon *agentes de IA*." → líneas con máscara ----------
  function lineas(texto) {
    const L = [[]]; let oro = false;
    for (const parte of String(texto ?? "").split(/(\*)/)) {
      if (parte === "*") { oro = !oro; continue; }
      for (const w of parte.split(/(\n|[ \t]+)/)) {
        if (w === "\n") L.push([]);
        else if (!w.trim()) continue;
        else { const l = L.at(-1); if (/^[.,;:!?…)]+$/.test(w) && l.length) l.at(-1).txt += w; else l.push({ txt: w, oro }); }
      }
    }
    return L.filter((l) => l.length);
  }
  const TRAZO = '<svg class="trazo" viewBox="0 0 100 10" preserveAspectRatio="none"><path pathLength="100" d="M1 6.5 C 18 3.5, 34 8, 52 5.5 S 84 3, 99 5"/></svg>';
  function texto(t, { tipeo = false } = {}) {
    return lineas(t).map((l) => {
      const partes = [];
      for (const f of l) {
        const ult = partes.at(-1);
        if (f.oro && ult && ult.oro) ult.txt.push(f.txt); else partes.push({ oro: f.oro, txt: [f.txt] });
      }
      return `<span class="lin">${partes.map((p) => {
        if (!p.oro) return p.txt.map((w) => `<span class="w">${esc(w)}</span>`).join(" ");
        if (tipeo) return `<span class="oro chip"><span class="tt">${[...p.txt.join(" ")].map((c) => `<span class="l">${c === " " ? "&nbsp;" : esc(c)}</span>`).join("")}</span><span class="caret"></span></span>`;
        return `<span class="oro">${p.txt.map((w) => `<span class="w">${esc(w)}</span>`).join(" ")}${TRAZO}</span>`;
      }).join(" ")}</span>`;
    }).join("");
  }

  // ---------- línea de tiempo (ajustada al beat) ----------
  const BPM = R.bpm || (R.audio === "suave" ? 96 : 120), PULSO = 60 / BPM;
  const E = R.escenas;
  const ROTA = ["empuje", "zoom", "lateral", "empuje", "mascara", "zoom", "lateral"];
  const HT = { empuje: .17, lateral: .17, zoom: .2, mascara: .3, corte: 0 };
  const FONDOS = ["crema", "verde", "tierra", "crema", "negro", "verde"];
  let t0 = 0;
  E.forEach((e, i) => {
    e.idx = i; e.tipo = e.tipo || "texto";
    e.dur = Math.max(2, Math.round((e.dur || 2.5) / PULSO)) * PULSO;
    e.a = t0; t0 += e.dur; e.b = t0;
    e.trans = i === 0 ? null : (e.trans || (e.tipo === "cierre" ? "mascara" : e.tipo === "numero" ? "zoom" : ROTA[(i - 1) % ROTA.length]));
    e.H = i === 0 ? 0 : (HT[e.trans] ?? .17);
    if (!e.fondo) e.fondo = i === 0 ? (R.foto_gancho ? "foto:" + R.foto_gancho : "verde") : e.tipo === "cierre" || e.tipo === "recorrido" ? "verde" : FONDOS[(i - 1) % FONDOS.length];
  });
  window.DUR = t0;
  window.BPM = BPM;
  window.CORTES = E.map((e) => e.a);
  window.AUDIO = R.audio || "beat";
  window.PORTADA = R.portada ?? .8;
  window.CIERRE = (E.find((e) => e.tipo === "cierre") || {}).a ?? null;

  // ---------- armado de escenas ----------
  const lienzo = $("#lienzo");
  lienzo.innerHTML = `<div id="cam"></div><div id="capa"><div id="leak"></div><canvas id="grano"></canvas><div id="vineta"></div><div id="flash"></div><img id="marca" src="${esc(R.ojitos)}" alt=""></div>`;
  document.body.insertAdjacentHTML("beforeend", `<svg width="0" height="0" style="position:absolute"><filter id="fx" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
    <feGaussianBlur id="fx-b" in="SourceGraphic" stdDeviation="0 0" result="b"/>
    <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/><feOffset id="fx-r" in="r" dx="0" dy="0" result="ro"/>
    <feColorMatrix in="b" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb"/><feOffset id="fx-g" in="gb" dx="0" dy="0" result="gbo"/>
    <feBlend in="ro" in2="gbo" mode="screen"/></filter></svg>`);
  const cam = $("#cam");

  const kicker = (e) => `<div class="kick"><span class="raya"></span><span class="kmask"><span class="ktxt">${nn(e.idx)} — ${esc(e.pre || R.serie || "Küme")}</span></span></div>`;
  const odo = (v, suf) => `<div class="odo">${String(v).split("").map((d) => /\d/.test(d)
    ? `<span class="col" data-d="${d}">${Array.from({ length: 30 }, (_, k) => `<span>${k % 10}</span>`).join("")}</span>`
    : `<span class="sig">${esc(d)}</span>`).join("")}${suf ? `<span class="suf">${esc(suf)}</span>` : ""}</div>`;
  const sub = (e) => (e.sub ? `<div class="sub">${texto(e.sub)}</div>` : "");

  function html(e) {
    switch (e.tipo) {
      case "lista": return `${kicker(e)}<div class="titulo chico">${texto(e.titulo)}</div><div class="items">${(e.items || []).map((it, k) =>
        `<div class="fila"><span class="linea"></span><span class="lin num"><span class="w">${nn(k)}</span></span><span class="txt">${texto(it)}</span></div>`).join("")}</div>${sub(e)}`;
      case "vs": return `<div class="vs-bloque arr"><div class="etq mal"><span class="lin"><span class="w">${esc(e.etiqueta_izq || "Lo que creés")}</span></span></div><div class="titulo chico tachable">${texto(e.izq)}</div></div>
        <div class="divisor"></div><div class="vs-bloque ab"><div class="etq bien"><span class="lin"><span class="w">${esc(e.etiqueta_der || "Lo que es")}</span></span></div><div class="titulo chico">${texto(e.der)}</div></div>`;
      case "numero": return `${kicker(e)}${odo(Number(e.valor) || 0, e.sufijo)}<div class="titulo chico">${texto(e.texto)}</div>${sub(e)}`;
      case "pantalla": return `${kicker(e)}<div class="titulo chico">${texto(e.texto)}</div><div class="celu"><div class="pant"><img src="${esc(e.img)}" alt=""></div></div>`;
      case "recorrido": return `${e.titulo ? kicker(e) + `<div class="titulo chico">${texto(e.titulo)}</div>` : ""}`;
      case "ojitos": return `<img class="mascota" src="${esc(R.ojitos)}" alt=""><div class="titulo">${texto(e.texto)}</div>${sub(e)}`;
      case "cierre": return `<img class="mascota chica" src="${esc(R.ojitos)}" alt=""><div class="titulo">${texto(e.texto, { tipeo: true })}</div>${sub(e)}<img class="logo-cierre" src="${esc(R.logo)}" alt="küme.">`;
      default: return `${kicker(e)}<div class="titulo${e.tipo === "gancho" ? " grande" : ""}">${texto(e.texto)}</div>${sub(e)}`;
    }
  }

  E.forEach((e) => {
    const s = document.createElement("section");
    const [fondo, foto] = e.fondo.split(/:(.+)/);
    s.className = `esc tipo-${e.tipo} fondo-${fondo}`;
    let extra = fondo === "foto" ? `<div class="foto" style="background-image:url('${esc(foto)}')"></div>` : "";
    if (e.tipo === "recorrido") {
      extra += `<img class="plano" src="${esc(e.img)}" alt=""><div class="sombra"></div><svg class="foco" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" pathLength="100"/></svg>` +
        (e.paradas || []).map((p) => `<div class="etiqueta"><span class="lin"><span class="w nom">${esc(p.nombre)}</span></span><span class="lin"><span class="w rol">${esc(p.rol || "")}</span></span></div>`).join("");
    }
    const numf = ["gancho", "cierre", "recorrido", "ojitos", "vs"].includes(e.tipo) ? "" : `<div class="numfondo">${nn(e.idx)}</div>`;
    s.innerHTML = `<div class="mundo">${extra}${numf}<div class="caja">${html(e)}</div></div>`;
    cam.appendChild(s);
    e.el = s; e.mundo = $(".mundo", s); e.foto = $(".foto", s); e.numf = $(".numfondo", s);
    e.kraya = $(".kick .raya", s); e.ktxt = $(".kick .ktxt", s);
    e.tws = $$(".caja > .titulo .w, .caja > .titulo.w", s);
    e.sws = $$(".caja > .sub .w", s);
    e.oroEls = $$(".oro:not(.chip)", s).map((o) => ({ el: o, w0: $(".w", o) }));
    if (e.tipo === "lista") e.filas = $$(".fila", s).map((f) => ({ el: f, linea: $(".linea", f), ws: $$(".w", f) }));
    if (e.tipo === "numero") { e.odo = $(".odo", s); e.cols = $$(".col", s).map((c, j) => ({ el: c, d: +c.dataset.d, j })); }
    if (e.tipo === "vs") { e.arr = $(".arr", s); e.ab = $(".ab", s); e.wa = $$(".arr .w", s); e.wb = $$(".ab .w", s); e.div = $(".divisor", s); e.tws = []; }
    if (e.tipo === "recorrido") { e.plano = $(".plano", s); e.foco = $(".foco", s); e.etqs = $$(".etiqueta", s).map((x) => ({ el: x, ws: $$(".w", x) })); }
    if (e.tipo === "cierre") { e.letras = $$(".chip .l", s); e.chip = $(".chip", s); e.caret = $(".caret", s); e.logo = $(".logo-cierre", s); }
    e.masc = $$(".mascota", s);
    e.celu = $(".celu", s);
  });

  // ---------- tiempos internos de cada escena (los usan render y el diseño sonoro) ----------
  const alBeat = (x) => Math.ceil(x / (PULSO / 2) - 1e-6) * (PULSO / 2);
  E.forEach((e) => {
    e.paso = Math.min(PULSO / 4, e.dur * .4 / Math.max(1, e.tws.length));
    e.t0 = e.tipo === "numero" ? .55 : .12;
    e.finTit = e.t0 + e.tws.length * e.paso;
    if (e.tipo === "lista") {
      const s0 = alBeat(e.finTit + .1), n = e.filas.length;
      const paso = Math.max(PULSO / 2, Math.floor((e.dur - s0 - .5) / n / (PULSO / 2)) * (PULSO / 2));
      e.filasT = e.filas.map((_, k) => s0 + k * paso);
    }
    if (e.tipo === "vs") { e.s1 = alBeat(Math.max(.9, e.dur * .34)); e.s2 = e.s1 + PULSO; }
    if (e.tipo === "recorrido") {
      const n = (e.paradas || []).length, s0 = e.titulo ? .55 : .3, tramo = (e.dur - s0 - .15) / Math.max(1, n);
      e.mv = Math.min(.75, tramo * .45);
      e.paradasT = (e.paradas || []).map((_, k) => s0 + k * tramo);
    }
    if (e.tipo === "cierre") {
      e.tipeo0 = e.finTit + .2; e.tipeoFin = e.tipeo0 + e.letras.length * .075;
    }
  });

  // ---------- diseño sonoro: cada evento con su tiempo ----------
  const SFX = [{ t: 0, tipo: "golpe", v: .8 }];
  E.forEach((e, i) => {
    if (i > 0) {
      if (e.H > 0) SFX.push({ t: e.a - e.H - .04, tipo: "whoosh", dur: 2 * e.H + .18, v: e.trans === "mascara" ? .55 : 1 });
      SFX.push({ t: e.a, tipo: "golpe", v: i === 1 ? 1 : e.trans === "mascara" ? .45 : .7 });
    }
    (e.filasT || []).forEach((x) => SFX.push({ t: e.a + x, tipo: "click", v: .8 }));
    if (e.tipo === "vs") { SFX.push({ t: e.a + e.s1, tipo: "tachon", v: .8 }); SFX.push({ t: e.a + e.s2, tipo: "golpe", v: .5 }); }
    if (e.tipo === "numero") {
      let prev = -1; const c = e.cols.at(-1);
      for (let x = 0; x < 1.6; x += 1 / 120) { const p = Math.floor(posCol(c, x)); if (p !== prev && x > .1) { SFX.push({ t: e.a + x, tipo: "tick", v: .5 }); prev = p; } }
      SFX.push({ t: e.a + .1 + c.j * .1 + 1.05, tipo: "golpe", v: .55 });
    }
    (e.paradasT || []).forEach((x, k) => { if (k > 0 || e.titulo) SFX.push({ t: e.a + x, tipo: "whoosh", dur: e.mv, v: .4 }); SFX.push({ t: e.a + x + e.mv, tipo: "click", v: .6 }); });
    if (e.tipo === "cierre") {
      e.letras.forEach((_, k) => SFX.push({ t: e.a + e.tipeo0 + k * .075, tipo: "tecla", v: .6 }));
      SFX.push({ t: e.a + e.tipeoFin + .05, tipo: "pop", v: .8 });
      SFX.push({ t: e.a - 1.6, tipo: "riser", dur: 1.6, v: .7 });
    }
  });
  window.SFX = SFX.filter((s) => s.t >= 0 && s.t < window.DUR).sort((a, b) => a.t - b.t);

  // ---------- grano ----------
  const cv = $("#grano"); cv.width = 360; cv.height = 640; const cx = cv.getContext("2d"); const img = cx.createImageData(360, 640);
  function grano(f) { let s = (f * 7919 + 104729) % 233280; for (let i = 0; i < img.data.length; i += 4) { s = (s * 9301 + 49297) % 233280; const v = s / 233280 * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; } cx.putImageData(img, 0, 0); }

  // ---------- animaciones ----------
  function revelar(ws, lt, d0, paso, quieto) {
    ws.forEach((w, k) => {
      const d = d0 + k * paso; w._d = quieto ? 0 : d;
      const x = quieto ? 1 : oExpo(seg(lt, d, d + .6));
      w.style.transform = x >= 1 ? "none" : `translateY(${(1 - x) * 115}%) rotate(${(1 - x) * 7}deg)`;
    });
    return d0 + ws.length * paso;
  }
  function oros(e, lt, quieto) {
    const crema = e.fondo === "crema";
    for (const o of e.oroEls) {
      const d = o.w0 ? (o.w0._d ?? 0) : 0;
      const r = quieto && crema ? 1 : quieto ? oExpo(seg(lt, .15, .75)) : crema ? oExpo(seg(lt, d - .05, d + .35)) : oExpo(seg(lt, d + .3, d + .85));
      o.el.style.setProperty("--r", r.toFixed(4));
    }
  }
  function posCol(c, lt) { const a = .1 + c.j * .1; return lerp(0, 20 + c.d, oExpo(seg(lt, a, a + 1.3))); }
  function camRecorrido(e, lt) {
    const P = e.paradas || [], T = e.paradasT;
    let A = { x: .5, y: .5, z: .62 }, B = A, q = 1;
    for (let k = 0; k < P.length; k++) {
      if (lt >= T[k]) { A = k ? P[k - 1] : { x: .5, y: .5, z: .62 }; B = P[k]; q = seg(lt, T[k], T[k] + e.mv); }
    }
    if (lt < (T[0] ?? 0)) { B = A; q = 1; }
    const k = ioCubic(q), z0 = A.z || 2.2, z1 = B.z || 2.2;
    return { x: lerp(A.x, B.x, k), y: lerp(A.y, B.y, k), z: lerp(z0, z1, k) * (1 - .22 * Math.sin(Math.PI * k)) };
  }
  function ponerCam(e, c, lt) {
    const W = e.plano.naturalWidth || 2400, Hh = e.plano.naturalHeight || 1350, s = 1920 / Hh * c.z;
    const tx = 540 - c.x * W * s, ty = 860 - c.y * Hh * s;
    e.plano.style.transform = `translate(${tx}px,${ty}px) scale(${s}) rotate(${Math.sin(lt * .7) * .4}deg)`;
    return { tx, ty, s };
  }

  function pintar(e, lt) {
    const p = cl(lt / e.dur), g = e.idx === 0;
    let vel = 0; // velocidad de cámara propia de la escena (px/cuadro) para el desenfoque
    e.mundo.style.transform = e.tipo === "recorrido" ? "none" : `scale(${1 + .045 * ioCubic(p)})`;
    if (e.foto) e.foto.style.transform = `scale(${lerp(1.18, 1.05, oCubic(p))}) translateY(${lerp(-24, 24, p)}px)`;
    if (e.numf) { e.numf.style.transform = `translateY(${lerp(90, -90, p)}px)`; e.numf.style.opacity = (.075 * oCubic(seg(lt, 0, .7))).toFixed(3); }
    if (e.kraya) { e.kraya.style.transform = `scaleX(${g ? 1 : oExpo(seg(lt, 0, .55))})`; e.ktxt.style.transform = `translateY(${g ? 0 : (1 - oExpo(seg(lt, .06, .6))) * 115}%)`; }
    const tit = $(".caja > .titulo", e.el);
    if (g && tit) tit.style.transform = `scale(${lerp(1.045, 1, oExpo(seg(lt, 0, .9)))})`;
    revelar(e.tws, lt, e.t0, e.paso, g);
    revelar(e.sws, lt, e.finTit + .12, Math.min(.06, e.paso), false);

    if (e.tipo === "lista") {
      e.filas.forEach((f, k) => {
        const s = e.filasT[k];
        f.linea.style.transform = `scaleX(${oExpo(seg(lt, s - .05, s + .6))})`;
        revelar(f.ws, lt, s, .05, false);
        const sig = e.filasT[k + 1];
        f.el.style.opacity = sig == null ? 1 : (1 - .62 * oCubic(seg(lt, sig, sig + .35))).toFixed(3);
      });
    }
    if (e.tipo === "numero") {
      e.odo.style.transform = `scale(${lerp(1.14, 1, oExpo(seg(lt, 0, 1)))})`;
      e.cols.forEach((c) => { c.el.style.transform = `translateY(${-posCol(c, lt)}em)`; });
    }
    if (e.tipo === "vs") {
      revelar(e.wa, lt, .1, e.paso, false);
      $$(".tachado", e.arr).forEach((x, j) => { x.style.transform = `scaleX(${oExpo(seg(lt, e.s1 + j * .09, e.s1 + j * .09 + .4))})`; });
      e.arr.style.opacity = (1 - .5 * oCubic(seg(lt, e.s1 + .3, e.s1 + .8))).toFixed(3);
      e.div.style.transform = `scaleX(${oExpo(seg(lt, e.s1 + .15, e.s2 + .35))})`;
      revelar(e.wb, lt, e.s2, e.paso, false);
    }
    if (e.celu) {
      const im = $(".pant img", e.el), alto = im.naturalHeight * 568 / (im.naturalWidth || 568);
      im.style.transform = `translateY(${-lerp(0, Math.max(0, alto - 1048), ioCubic(seg(lt, .5, e.dur - .2)))}px)`;
      e.celu.style.transform = `perspective(1800px) translateY(${(1 - oExpo(seg(lt, 0, .8))) * 420}px) rotateX(${lerp(14, 6, p)}deg) rotateY(${lerp(-18, 10, ioCubic(p))}deg)`;
    }
    if (e.tipo === "recorrido") {
      const c = camRecorrido(e, lt), a = ponerCam(e, c, lt), b = ponerCam(e, camRecorrido(e, lt - 1 / 30), lt - 1 / 30);
      ponerCam(e, c, lt);
      vel = Math.hypot(a.tx - b.tx, a.ty - b.ty);
      const T = e.paradasT;
      let actual = -1; T.forEach((x, k) => { if (lt >= x) actual = k; });
      const llega = actual >= 0 ? T[actual] + e.mv : 0, sig = T[actual + 1] ?? e.dur + 1;
      const rr = actual < 0 ? 0 : oExpo(seg(lt, llega - .08, llega + .45)) * (1 - seg(lt, sig - .12, sig));
      e.foco.style.setProperty("--r", rr.toFixed(4));
      e.foco.style.transform = `scale(${lerp(1.35, 1, oBack(seg(lt, llega - .08, llega + .4)))}) rotate(${-90 + lt * 20}deg)`;
      e.foco.style.opacity = actual < 0 ? 0 : 1;
      e.etqs.forEach((x, k) => {
        const on = k === actual; x.el.style.opacity = on ? (1 - seg(lt, sig - .14, sig - .02)).toFixed(3) : 0;
        if (on) revelar(x.ws, lt, llega - .05, .09, false);
      });
    }
    e.masc.forEach((m, k) => {
      const parpa = (lt % 1.7) > 1.56 && (lt % 1.7) < 1.66 ? .12 : 1, mira = Math.sin(lt * 2.1 + k) * 22;
      m.style.transform = `translate(${mira}px, ${Math.sin(lt * 2.6) * 12}px) scale(${oBack(seg(lt, 0, .55))}) scaleY(${parpa}) rotate(${Math.sin(lt * 1.7) * 3}deg)`;
    });
    if (e.tipo === "cierre") {
      e.letras.forEach((l, k) => { l.style.opacity = lt >= e.tipeo0 + k * .075 ? 1 : 0; });
      const listo = lt >= e.tipeoFin;
      e.caret.style.opacity = !listo || Math.floor(lt * 2.4) % 2 === 0 ? 1 : 0;
      e.chip.style.opacity = oCubic(seg(lt, e.tipeo0 - .3, e.tipeo0)).toFixed(3);
      e.chip.style.transform = `scale(${listo ? lerp(1.12, 1, oExpo(seg(lt, e.tipeoFin, e.tipeoFin + .35))) : lerp(.9, 1, oExpo(seg(lt, e.tipeo0 - .3, e.tipeo0)))})`;
      e.chip.classList.toggle("lleno", listo);
      e.logo.style.opacity = oCubic(seg(lt, e.tipeoFin + .25, e.tipeoFin + .7)).toFixed(3);
      e.logo.style.transform = `translateY(${(1 - oExpo(seg(lt, e.tipeoFin + .25, e.tipeoFin + .9))) * 60}px)`;
    }
    oros(e, lt, g);
    return vel;
  }

  // ---------- transiciones ----------
  function limpiar(e) { const s = e.el.style; s.display = "none"; s.transform = ""; s.clipPath = ""; s.opacity = ""; s.zIndex = ""; }
  const vel = (f, q, d) => Math.abs(f(cl(q + .01)) - f(cl(q - .01))) / .02 / (d * 30); // fracción de pantalla por cuadro

  window.render = function (t) {
    grano(Math.round(t * 90));
    E.forEach(limpiar);
    let k = -1;
    for (let i = 1; i < E.length; i++) if (E[i].H > 0 && t >= E[i].a - E[i].H && t < E[i].a + E[i].H) { k = i; break; }
    let bx = 0, by = 0, ca = 0, flare = 0, fondo;
    if (k > 0) {
      const out = E[k - 1], inn = E[k], d = 2 * inn.H, q = seg(t, inn.a - inn.H, inn.a + inn.H);
      const o = out.el.style, n = inn.el.style; o.display = n.display = "";
      pintar(out, t - out.a); pintar(inn, t - inn.a);
      if (inn.trans === "empuje" || inn.trans === "lateral") {
        const x = ioExpo(q), v = vel(ioExpo, q, d) * (inn.trans === "empuje" ? 1920 : 1080);
        const eje = inn.trans === "empuje" ? "Y" : "X", L = inn.trans === "empuje" ? 1920 : -1080;
        o.transform = `translate${eje}(${-x * L}px)`; n.transform = `translate${eje}(${(1 - x) * L}px)`;
        if (eje === "Y") by = Math.min(70, v * .45); else bx = Math.min(70, v * .45);
        ca = Math.min(16, v * .06);
      } else if (inn.trans === "zoom") {
        if (q < .5) { const x = iCubic(q * 2); o.transform = `scale(${1 + x * 1.7})`; n.display = "none"; }
        else { const x = oExpo((q - .5) * 2); n.transform = `scale(${lerp(1.9, 1, x)})`; o.display = "none"; }
        bx = by = Math.sin(Math.PI * q) * 16; ca = Math.sin(Math.PI * q) * 14;
      } else if (inn.trans === "mascara") {
        n.zIndex = 2; n.clipPath = `circle(${ioCubic(q) * 135}% at 50% 112%)`; o.transform = `scale(${1 + ioCubic(q) * .08})`;
        ca = Math.sin(Math.PI * q) * 4;
      }
      flare = Math.sin(Math.PI * q);
      fondo = q < .5 ? out.fondo : inn.fondo;
    } else {
      let e = E[E.length - 1]; for (const x of E) if (t >= x.a && t < x.b) { e = x; break; }
      e.el.style.display = "";
      const v = pintar(e, t - e.a);
      if (v > 2) { bx = by = Math.min(30, v * .22); ca = Math.min(10, v * .05); }
      fondo = e.fondo;
      // sacudón corto después de cada corte (y al arrancar el gancho)
      const lt = t - e.a, f = 1 - seg(lt, 0, .22);
      if (f > 0) { const amp = (e.idx === 0 ? 9 : 7) * f * f; e.el.style.transform = `translate(${(azar(t * 97) - .5) * amp}px, ${(azar(t * 61 + 3) - .5) * amp}px)`; }
    }
    // filtro de cámara: solo cuando hay movimiento (es caro)
    if (bx > .3 || by > .3 || ca > .3) {
      $("#fx-b").setAttribute("stdDeviation", `${bx.toFixed(2)} ${by.toFixed(2)}`);
      $("#fx-r").setAttribute("dx", ca.toFixed(2)); $("#fx-g").setAttribute("dx", (-ca * .6).toFixed(2));
      cam.style.filter = "url(#fx)";
    } else cam.style.filter = "none";
    const oscuro = fondo !== "crema";
    const leak = $("#leak");
    leak.style.opacity = ((oscuro ? .2 : .05) + flare * .55).toFixed(3);
    leak.style.transform = `translate(${Math.sin(t * .35) * 260 + flare * 200}px, ${Math.cos(t * .23) * 380}px) scale(${1 + flare * .4})`;
    $("#flash").style.opacity = (flare * flare * .22).toFixed(3);
    $("#vineta").style.opacity = oscuro ? 1 : .35;
    const cur = E.find((x) => t >= x.a && t < x.b) || E.at(-1);
    $("#marca").style.opacity = cur.tipo === "cierre" || cur.tipo === "ojitos" ? 0 : .85;
    $("#marca").style.transform = `scaleY(${(t % 2.3) > 2.18 ? .15 : 1})`;
  };

  // subcuadros de motion blur que necesita el instante t: 3 en transiciones y recorridos, 2 mientras entra el texto, 1 quieto
  window.MUESTRAS = function (t) {
    if (E.some((e) => e.H > 0 && Math.abs(t - e.a) < e.H + .04)) return 3;
    const e = E.find((x) => t >= x.a && t < x.b) || E.at(-1);
    if (e.tipo === "recorrido") return 3;
    return t - e.a < Math.min(1.2, e.finTit + .7) ? 2 : 1;
  };

  // ---------- cada línea se ajusta al ancho disponible (nunca se corta una frase) ----------
  function anchoLinea(l) { const r = document.createRange(); r.selectNodeContents(l); return r.getBoundingClientRect().width; }
  function encajar(el, max) {
    const lins = $$(":scope > .lin", el); if (!lins.length) return;
    const base = parseFloat(getComputedStyle(el).fontSize), ancho = Math.max(...lins.map(anchoLinea));
    if (ancho > max) el.style.fontSize = (base * max / ancho * .98) + "px";
  }
  function preparar() {
    E.forEach((e) => {
      $$(".caja > .titulo", e.el).forEach((x) => encajar(x, 868));
      $$(".vs-bloque .titulo", e.el).forEach((x) => encajar(x, 868));
      $$(".fila .txt", e.el).forEach((x) => encajar(x, 740));
      $$(".tachable > .lin", e.el).forEach((l) => { const s = document.createElement("span"); s.className = "tachado"; s.style.width = anchoLinea(l) + "px"; l.appendChild(s); });
    });
  }
  const imgs = [...document.images].map((i) => (i.complete ? Promise.resolve() : new Promise((ok) => { i.onload = i.onerror = ok; })));
  Promise.all([document.fonts.ready, ...imgs]).then(() => { preparar(); window.render(0); window.LISTO = true; });
})();
