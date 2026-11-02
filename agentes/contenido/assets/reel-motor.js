// Motor de reels de Küme: arma un reel vertical (1080×1920) a partir de window.REEL (escenas)
// y expone render(t) para que render_reel.py lo grabe cuadro por cuadro.
// Pam solo edita el bloque REEL de reel.html; acá no hace falta tocar nada.
(function () {
  const R = window.REEL;
  const $ = (s, el = document) => el.querySelector(s);
  const cl = (x) => Math.max(0, Math.min(1, x));
  const seg = (t, a, b) => cl((t - a) / (b - a));
  const eo = (x) => 1 - Math.pow(1 - x, 3);
  const eback = (x) => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const lerp = (a, b, x) => a + (b - a) * x;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // "Tu comida está *buenísima*." → palabras sueltas; las de *asteriscos* van en dorado
  // Las palabras doradas seguidas van juntas en un solo bloque, y la puntuación suelta (". ? !") se pega a lo anterior.
  function palabras(texto) {
    // 1) fichas: {txt, oro} o salto de línea
    const fichas = []; let oro = false;
    for (const parte of String(texto).split(/(\*)/)) {
      if (parte === "*") { oro = !oro; continue; }
      for (const w of parte.split(/(\n|[ \t]+)/)) {
        if (w === "\n") fichas.push({ br: true });
        else if (!w.trim()) continue;
        else if (/^[.,;:!?…)]+$/.test(w) && fichas.length && !fichas.at(-1).br) fichas.at(-1).txt += w; // puntuación pegada
        else fichas.push({ txt: w, oro });
      }
    }
    // 2) HTML: las doradas seguidas comparten un solo bloque
    let html = "", grupo = false;
    for (const f of fichas) {
      if (f.br) { if (grupo) { html += "</span>"; grupo = false; } html += "<br>"; continue; }
      if (f.oro && !grupo) { html += ' <span class="oro">'; grupo = true; }
      if (!f.oro && grupo) { html += "</span>"; grupo = false; }
      html += ` <span class="w">${esc(f.txt)}</span>`;
    }
    return (html + (grupo ? "</span>" : "")).trim();
  }

  // ---------- línea de tiempo ----------
  let t0 = 0;
  const FONDOS = ["verde", "crema", "tierra", "verde", "crema"];
  R.escenas.forEach((e, i) => {
    e.dur = e.dur || 2.5; e.a = t0; t0 += e.dur; e.b = t0;
    if (!e.fondo) e.fondo = i === 0 ? (R.foto_gancho ? "foto:" + R.foto_gancho : "verde") : e.tipo === "cierre" ? "verde" : FONDOS[i % FONDOS.length];
  });
  window.DUR = t0;
  window.CORTES = R.escenas.map((e) => e.a);
  window.AUDIO = R.audio || "beat";
  window.PORTADA = R.portada ?? Math.min(0.8, R.escenas[0].dur * .6);

  // ---------- escenas ----------
  const lienzo = $("#lienzo");
  const html = (e) => {
    const sub = e.sub ? `<div class="sub">${palabras(e.sub)}</div>` : "";
    const pre = e.pre ? `<div class="pre">${esc(e.pre)}</div>` : "";
    switch (e.tipo) {
      case "lista": return `${pre}<div class="titulo chico">${palabras(e.titulo || "")}</div><div class="items">${(e.items || []).map((it, k) => `<div class="item"><span class="n">${k + 1}</span><span>${palabras(it)}</span></div>`).join("")}</div>${sub}`;
      case "vs": return `<div class="mitad arriba"><div class="etq mal">${esc(e.etiqueta_izq || "Lo que creés")}</div><div class="titulo chico">${palabras(e.izq)}</div></div><div class="mitad abajo"><div class="etq bien">${esc(e.etiqueta_der || "Lo que es")}</div><div class="titulo chico">${palabras(e.der)}</div></div>`;
      case "numero": return `${pre}<div class="numero" data-valor="${Number(e.valor) || 0}">0</div><div class="titulo chico">${palabras(e.texto || "")}</div>${sub}`;
      case "pantalla": return `${pre}<div class="titulo chico">${palabras(e.texto || "")}</div><div class="celu"><div class="pant"><img src="${esc(e.img)}" alt=""></div></div>`;
      case "ojitos": return `<img class="mascota" src="${esc(R.ojitos)}" alt=""><div class="titulo">${palabras(e.texto || "")}</div>${sub}`;
      case "cierre": return `<img class="mascota chica" src="${esc(R.ojitos)}" alt="">${pre}<div class="titulo">${palabras(e.texto || "")}</div>${sub}<img class="logo-cierre" src="${esc(R.logo)}" alt="küme.">`;
      default: return `${pre}<div class="titulo${e.tipo === "gancho" ? " grande" : ""}">${palabras(e.texto || "")}</div>${sub}`;
    }
  };
  R.escenas.forEach((e, i) => {
    const s = document.createElement("section");
    const [fondo, foto] = e.fondo.split(/:(.+)/);
    s.className = `esc tipo-${e.tipo || "texto"} fondo-${fondo}`;
    s.innerHTML = (fondo === "foto" ? `<div class="foto" style="background-image:url('${esc(foto)}')"></div>` : "") + `<div class="caja">${html(e)}</div>`;
    lienzo.insertBefore(s, $("#capa"));
    e.el = s; e.ws = [...s.querySelectorAll(".w")]; e.itemEls = s.querySelectorAll(".item"); e.idx = i;
  });

  // ---------- grano ----------
  const cv = $("#grano"); cv.width = 360; cv.height = 640; const cx = cv.getContext("2d"); const img = cx.createImageData(360, 640);
  function grano(f) { let s = (f * 7919 + 104729) % 233280; for (let i = 0; i < img.data.length; i += 4) { s = (s * 9301 + 49297) % 233280; const v = s / 233280 * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; } cx.putImageData(img, 0, 0); }

  window.render = function (t) {
    grano(Math.round(t * 30));
    $("#barra").style.width = (t / window.DUR * 100) + "%";
    let actual = R.escenas[R.escenas.length - 1];
    for (const e of R.escenas) {
      const on = t >= e.a && t < e.b; e.el.style.display = on ? "" : "none";
      if (on) actual = e;
    }
    const e = actual, lt = t - e.a, p = lt / e.dur;
    e.el.style.display = "";
    // golpe de entrada: zoom que rebota (en el gancho ya arranca visible en el cuadro 0)
    const caja = $(".caja", e.el);
    const golpe = e.idx === 0 ? lerp(1.06, 1, eo(seg(lt, 0, .35))) : lerp(1.18, 1, eback(seg(lt, 0, .32)));
    const tiembla = e.tipo === "gancho" ? Math.sin(t * 60) * 3 * (1 - seg(lt, 0, .4)) : 0;
    caja.style.transform = `translateX(${tiembla}px) scale(${golpe})`;
    const foto = $(".foto", e.el); if (foto) foto.style.transform = `scale(${lerp(1.12, 1.0, p)})`;
    // palabras: entran de a una (el gancho, todo junto)
    const ritmo = e.tipo === "gancho" ? 0 : Math.min(.11, (e.dur * .45) / Math.max(1, e.ws.length));
    e.ws.forEach((w, k) => {
      const a = (e.tipo === "lista" || e.tipo === "vs" || e.tipo === "pantalla" ? .05 : .08) + k * ritmo;
      const x = e.idx === 0 ? 1 : eback(seg(lt, a, a + .22));
      w.style.opacity = cl(x * 1.4); w.style.transform = `translateY(${(1 - x) * 36}px) scale(${lerp(.7, 1, cl(x))})`;
    });
    // lista: un ítem por vez
    e.itemEls.forEach((it, k) => {
      const a = .45 + k * Math.max(.45, (e.dur - .9) / Math.max(1, e.itemEls.length));
      const x = eback(seg(lt, a, a + .3)); it.style.opacity = cl(x * 1.3); it.style.transform = `translateX(${(1 - cl(x)) * -120}px)`;
      it.querySelectorAll(".w").forEach((w) => { w.style.opacity = cl(x * 1.3); w.style.transform = "none"; });
    });
    // versus: la segunda mitad entra a mitad de escena
    if (e.tipo === "vs") {
      const ab = $(".abajo", e.el), x = eback(seg(lt, e.dur * .42, e.dur * .42 + .3));
      ab.style.opacity = cl(x * 1.3); ab.style.transform = `translateY(${(1 - cl(x)) * 80}px)`;
      ab.querySelectorAll(".w").forEach((w) => { w.style.opacity = cl(x * 1.3); w.style.transform = "none"; });
    }
    if (e.tipo === "numero") { const n = $(".numero", e.el); n.textContent = Math.round(lerp(0, Number(n.dataset.valor), eo(seg(lt, .1, Math.min(1.4, e.dur * .6))))) + (e.sufijo || ""); }
    if (e.tipo === "pantalla") { const im = $(".pant img", e.el); im.style.transform = `translateY(${-lerp(0, Math.max(0, (im.naturalHeight * 600 / (im.naturalWidth || 600)) - 1080), eo(seg(lt, .4, e.dur)))}px)`; }
    // mascota: parpadea y mira a los costados
    e.el.querySelectorAll(".mascota").forEach((m) => {
      const parpadeo = (lt % 1.6) > 1.48 ? .15 : 1, mira = Math.sin(lt * 2.4) * 18;
      m.style.transform = `translateX(${mira}px) scaleY(${parpadeo}) rotate(${Math.sin(lt * 3) * 4}deg)`;
    });
    // destello en cada corte (menos el primero) y ojitos chicos en la esquina
    $("#flash").style.opacity = e.idx === 0 ? 0 : (1 - seg(lt, 0, .12)) * .55;
    $("#vineta").style.opacity = e.fondo === "crema" ? 0 : 1;
    $("#marca").style.opacity = e.tipo === "cierre" || e.tipo === "ojitos" ? 0 : .9;
    $("#marca").style.transform = `scaleY(${(t % 2.2) > 2.08 ? .15 : 1})`;
  };
  document.fonts.ready.then(() => { window.LISTO = true; window.render(0); });
})();
