// Garabatos blancos "dibujados a mano", como los del feed de @kume.agencia, y fotos de fondo.
// Uso:  <span class="garabato" data-g="flecha" style="left:..;top:..;width:180px"></span>
//       <section class="slide foto" data-foto="../../assets/fotos/escritorio-laptop.jpg">
(function () {
  const S = (vb, d, extra = "") => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">${d}${extra}</svg>`;
  const G = {
    flecha: S("0 0 220 80", `<path d="M8 50 C 60 30, 120 30, 196 42"/><path d="M168 18 L198 42 L166 64"/>`),
    flechaCurva: S("0 0 200 160", `<path d="M20 20 C 30 110, 90 140, 170 120"/><path d="M140 96 L172 120 L136 140"/>`),
    rulo: S("0 0 240 70", `<path d="M8 50 C 30 10, 52 10, 50 40 C 48 66, 26 52, 44 30 C 62 8, 86 12, 84 40 C 82 66, 60 52, 78 30 C 96 8, 120 12, 118 40 C 116 66, 94 52, 112 30 C 130 8, 156 12, 154 40 C 152 62, 132 54, 150 32 C 168 12, 196 20, 230 30"/>`),
    exclamacion: S("0 0 150 150", `<path d="M40 20 L58 92"/><path d="M78 10 L84 86"/><path d="M118 22 L104 92"/><circle cx="62" cy="118" r="5" fill="currentColor"/><circle cx="86" cy="114" r="5" fill="currentColor"/><circle cx="102" cy="118" r="5" fill="currentColor"/>`),
    destello: S("0 0 100 100", `<path d="M50 6 C 54 40, 60 46, 94 50 C 60 54, 54 60, 50 94 C 46 60, 40 54, 6 50 C 40 46, 46 40, 50 6 Z"/>`),
    destellos: S("0 0 160 120", `<path d="M50 10 C 53 38, 58 42, 86 46 C 58 50, 53 54, 50 82 C 47 54, 42 50, 14 46 C 42 42, 47 38, 50 10 Z"/><path d="M122 64 C 124 80, 127 82, 143 84 C 127 86, 124 88, 122 104 C 120 88, 117 86, 101 84 C 117 82, 120 80, 122 64 Z"/>`),
    espiral: S("0 0 140 140", `<path d="M70 70 m-6 0 a 6 6 0 1 1 12 0 a 14 14 0 1 1 -26 0 a 24 24 0 1 1 46 0 a 34 34 0 1 1 -66 0 a 46 46 0 1 1 90 4"/>`),
    subrayado: S("0 0 300 40", `<path d="M8 26 C 80 8, 160 30, 292 12"/><path d="M40 34 C 110 22, 190 34, 270 24"/>`),
    hashtag: S("0 0 110 110", `<path d="M36 12 L28 98"/><path d="M76 12 L68 98"/><path d="M14 38 L98 34"/><path d="M10 72 L94 68"/>`),
    circulo: S("0 0 320 140", `<path d="M40 70 C 40 20, 280 10, 290 66 C 300 120, 60 132, 30 86 C 18 60, 80 36, 160 30"/>`),
    rayitos: S("0 0 120 120", `<path d="M20 40 L46 56"/><path d="M58 14 L64 44"/><path d="M100 26 L80 50"/>`),
    corazon: S("0 0 120 110", `<path d="M60 98 C 10 64, 8 30, 30 18 C 46 10, 58 22, 60 34 C 62 22, 74 10, 90 18 C 112 30, 110 64, 60 98 Z"/>`),
  };
  function montar() {
    document.querySelectorAll("[data-g]").forEach((el) => { if (G[el.dataset.g]) el.innerHTML = G[el.dataset.g]; });
    document.querySelectorAll("[data-foto]").forEach((el) => {
      if (el.querySelector(".fondo-foto")) return;
      const f = document.createElement("div"); f.className = "fondo-foto"; f.style.backgroundImage = `url("${el.dataset.foto}")`;
      if (el.dataset.focus) f.style.backgroundPosition = el.dataset.focus;
      el.prepend(f);
    });
  }
  window.KUME_G = { G, montar };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", montar) : montar();
})();
