// Escenas ilustradas ORIGINALES "estilo sitcom" para los carruseles de Küme + stickers.
// No usan imágenes de las series: son dibujos propios que evocan el ambiente.
// Uso en una slide:  <section class="slide" data-escena="oficina"> ... </section>
//                    <span class="sticker" data-sticker="pivot"></span>
(function () {
  const W = 1080, H = 1350;
  const rect = (x, y, w, h, f, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" ${extra}/>`;
  const circ = (x, y, r, f, extra = "") => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${extra}/>`;
  const grain = `<filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .08 0"/></filter><rect width="${W}" height="${H}" filter="url(#g)"/>`;
  const svg = (inner) => `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">${inner}${grain}</svg>`;
  const mug = (x, y, c) => rect(x, y, 46, 56, c, 'rx="8"') + `<path d="M${x + 46} ${y + 14} q22 0 22 18 q0 18 -22 18" stroke="${c}" stroke-width="9" fill="none"/>`;

  const ESCENAS = {
    // Oficina de una empresa de papel: techo de placas, tubos de luz, cubículos
    oficina: () => svg(
      rect(0, 0, W, H, "#D9DCD3") +
      rect(0, 0, W, 210, "#ECEDE6") + [...Array(6)].map((_, i) => `<line x1="${i * 216}" y1="0" x2="${i * 216}" y2="210" stroke="#C9CBC2" stroke-width="4"/>`).join("") +
      `<line x1="0" y1="105" x2="${W}" y2="105" stroke="#C9CBC2" stroke-width="4"/>` +
      [100, 640].map((x) => rect(x, 38, 340, 44, "#FFFFF4", 'rx="6" opacity=".95"')).join("") +
      rect(0, 210, W, 20, "#BFC3B8") +
      // ventana con persianas
      rect(690, 300, 300, 330, "#A9C4CF") + [...Array(11)].map((_, i) => rect(690, 300 + i * 30, 300, 14, "#E4E6DE")).join("") + rect(680, 290, 320, 350, "none", 'stroke="#8E948A" stroke-width="12"') +
      // cubículos
      rect(0, 760, W, 590, "#8A9196") + rect(0, 700, 520, 360, "#7B8A99") + rect(560, 720, 520, 340, "#6E7E8E") + rect(0, 690, 520, 18, "#5B6670") + rect(560, 710, 520, 18, "#5B6670") +
      // escritorio, monitor viejo, taza y pila de papeles
      rect(80, 990, 860, 40, "#A57C55") + rect(170, 810, 260, 190, "#D8D2BE", 'rx="14"') + rect(195, 832, 210, 140, "#2F3B39", 'rx="6"') + rect(270, 995, 60, 14, "#BDB5A0") +
      mug(520, 930, "#FFFFFF") + `<text x="526" y="965" font-family="Arial" font-weight="700" font-size="11" fill="#1B3A2D">#1</text>` +
      [...Array(7)].map((_, i) => rect(660 + (i % 2) * 6, 975 - i * 9, 170, 9, i % 2 ? "#FFFFFF" : "#F0EEE6")).join("") +
      rect(0, 1030, W, 320, "#7D8389") + [...Array(30)].map((_, i) => circ((i * 97) % W, 1070 + ((i * 53) % 260), 3, "#6F757B")).join("")
    ),
    // Café con sillón naranja, pared de ladrillo y lámpara de pie
    cafe: () => svg(
      rect(0, 0, W, H, "#B5583E") +
      [...Array(26)].map((_, r) => [...Array(9)].map((_, c) => rect(c * 130 + (r % 2 ? -65 : 0), r * 46, 122, 38, ["#A94E36", "#BC6146", "#B05540"][(r + c) % 3])).join("")).join("") +
      // ventana con cartel
      rect(620, 160, 380, 420, "#F3D9A8", 'rx="10"') + rect(640, 180, 340, 380, "#8FB3B5") + `<text x="810" y="400" text-anchor="middle" font-family="Georgia" font-style="italic" font-size="84" fill="#F7E6B5" opacity=".9">café</text>` +
      // lámpara de pie
      rect(110, 340, 12, 560, "#3A2A20") + `<path d="M40 340 L192 340 L160 250 L72 250 Z" fill="#F2C76B"/>` + `<ellipse cx="116" cy="905" rx="70" ry="14" fill="#3A2A20"/>` +
      // sillón naranja
      rect(160, 760, 760, 210, "#D9762B", 'rx="40"') + rect(130, 700, 820, 140, "#E5853A", 'rx="50"') + rect(110, 760, 120, 260, "#C96A24", 'rx="40"') + rect(850, 760, 120, 260, "#C96A24", 'rx="40"') +
      rect(240, 800, 270, 120, "#EE9447", 'rx="26"') + rect(540, 800, 270, 120, "#EE9447", 'rx="26"') +
      // mesa ratona con tazas grandes
      rect(0, 1020, W, 330, "#6B4A32") + rect(300, 1050, 480, 40, "#4A3222", 'rx="10"') + rect(330, 1090, 24, 120, "#4A3222") + rect(730, 1090, 24, 120, "#4A3222") +
      mug(400, 990, "#F6EFDC") + mug(600, 990, "#C4973A")
    ),
    // Depto con pared violeta y marco amarillo en la mirilla de la puerta
    depto: () => svg(
      rect(0, 0, W, H, "#7E6AA8") + rect(0, 0, W, 60, "#6C5994") +
      // puerta blanca con marco dorado alrededor de la mirilla
      rect(330, 210, 420, 820, "#F2EFE7", 'rx="6"') + rect(310, 190, 460, 20, "#E6E1D3") +
      `<g transform="translate(540 420)"><path d="M0 -95 C40 -95 95 -40 95 0 C95 40 40 95 0 95 C-40 95 -95 40 -95 0 C-95 -40 -40 -95 0 -95 Z" fill="none" stroke="#E8C547" stroke-width="22"/>` +
      [...Array(12)].map((_, i) => `<circle cx="${Math.cos(i * Math.PI / 6) * 110}" cy="${Math.sin(i * Math.PI / 6) * 110}" r="13" fill="#E8C547"/>`).join("") + `<circle r="16" fill="#3A3A3A"/></g>` +
      circ(700, 650, 14, "#C9A227") + rect(330, 1030, 420, 14, "#D8D2C2") +
      // cocina: mesada y heladera
      rect(0, 760, 250, 290, "#EDE7D6") + rect(0, 740, 260, 30, "#C9B99A") + rect(840, 420, 240, 630, "#E7E3D8", 'rx="14"') + rect(840, 610, 240, 8, "#CFC9BA") +
      // piso
      rect(0, 1044, W, 306, "#C8A877") + [...Array(8)].map((_, i) => `<line x1="${i * 160}" y1="1044" x2="${i * 160 - 120}" y2="1350" stroke="#B89668" stroke-width="5"/>`).join("")
    ),
    // Living con pizarra llena de ecuaciones y comida para llevar
    pizarra: () => svg(
      rect(0, 0, W, H, "#C9B48F") + rect(0, 0, W, 40, "#B9A37E") +
      rect(120, 150, 840, 520, "#FBFBF7", 'rx="10"') + rect(110, 140, 860, 540, "none", 'stroke="#8A8F94" stroke-width="16" rx="14"') +
      ["E = mc² · ∇×B = μ₀J", "ψ(x,t) = Ae^{i(kx−ωt)}", "∫₀^∞ e^{−x²} dx = √π/2", "ħ ≈ 1.054 × 10⁻³⁴", "Δx·Δp ≥ ħ/2", "S = k ln Ω  →  ¿marketing?"].map((t, i) =>
        `<text x="${160 + (i % 2) * 40}" y="${230 + i * 76}" font-family="'Comic Sans MS', 'Segoe Print', cursive" font-size="${40 - (i % 3) * 3}" fill="${i === 5 ? "#C0392B" : "#2B4C7E"}" transform="rotate(${(i % 2 ? -1 : 1.2)} 540 400)">${t}</text>`).join("") +
      // sillón marrón y cajitas de comida
      rect(0, 830, W, 520, "#7A5C44") + rect(90, 760, 900, 200, "#8D5F3C", 'rx="34"') + rect(60, 820, 140, 220, "#7C5232", 'rx="34"') + rect(880, 820, 140, 220, "#7C5232", 'rx="34"') +
      rect(0, 1060, W, 290, "#5E4634") + rect(260, 1090, 560, 34, "#3E2C20", 'rx="8"') +
      [330, 470, 610].map((x, i) => `<path d="M${x} 1090 l12 -86 h86 l12 86 z" fill="#FFFFFF"/><path d="M${x + 14} 1004 l34 -24 l34 24" stroke="#B0B0B0" stroke-width="6" fill="none"/>` + (i === 1 ? `<line x1="${x + 70}" y1="990" x2="${x + 120}" y2="930" stroke="#3E2C20" stroke-width="6"/><line x1="${x + 80}" y1="994" x2="${x + 135}" y2="940" stroke="#3E2C20" stroke-width="6"/>` : "")).join("")
    ),
    // Bar de barrio: madera oscura, boxes y lámparas colgantes
    bar: () => svg(
      rect(0, 0, W, H, "#3B2418") + [...Array(12)].map((_, i) => rect(i * 90, 0, 6, 760, "#2E1B12")).join("") +
      // cuadros
      [[90, 180, 200, 150], [330, 140, 160, 210], [540, 200, 230, 160], [820, 160, 170, 200]].map(([x, y, w, h]) => rect(x, y, w, h, "#C9A15E") + rect(x + 14, y + 14, w - 28, h - 28, ["#5F7D6E", "#8C6A4A", "#6B5B8A", "#A06A4A"][x % 4])).join("") +
      // lámparas
      [270, 810].map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="380" stroke="#1A0F09" stroke-width="5"/><path d="M${x - 90} 470 L${x + 90} 470 L${x + 40} 380 L${x - 40} 380 Z" fill="#2F5D45"/><ellipse cx="${x}" cy="470" rx="90" ry="16" fill="#F7D98B"/><path d="M${x - 90} 470 L${x - 230} 900 L${x + 230} 900 L${x + 90} 470 Z" fill="#F7D98B" opacity=".12"/>`).join("") +
      // box de cuero y mesa con pintas
      rect(0, 720, W, 630, "#5A1F1F") + rect(0, 700, W, 40, "#2E1B12") + [...Array(8)].map((_, i) => rect(i * 140 + 20, 760, 110, 220, "#6E2626", 'rx="20"')).join("") +
      rect(140, 1000, 800, 60, "#7A4A2A", 'rx="10"') + rect(500, 1060, 80, 290, "#4E2E18") +
      [260, 420, 600, 760].map((x, i) => rect(x, 870, 80, 130, i % 2 ? "#E1A93C" : "#D4902A", 'rx="8" opacity=".95"') + rect(x, 860, 80, 26, "#FFF6DD", 'rx="10"')).join("")
    ),
    // Fondos lisos de la marca, para slides de texto
    verde: () => svg(rect(0, 0, W, H, "#1B3A2D") + circ(980, 120, 260, "#24493A") + circ(60, 1280, 220, "#24493A")),
    crema: () => svg(rect(0, 0, W, H, "#F5EFE0") + circ(980, 1230, 280, "#EFE3C8") + circ(80, 90, 160, "#EFE3C8")),
    dorado: () => svg(rect(0, 0, W, H, "#C4973A") + circ(940, 160, 240, "#D1A64B") + circ(120, 1250, 260, "#B78A30")),
  };

  // Stickers: texto en burbuja con borde blanco, como recortado
  const STICKERS = {
    pivot: ["¡PIVOT!", "#F07F2E", "#FFFFFF"],
    camara: ["👀 mirada a cámara", "#1B3A2D", "#F5EFE0"],
    comoteva: ["¿cómo te va? 😏", "#7E6AA8", "#FFFFFF"],
    bazinga: ["¡JA! te la creíste", "#2B4C7E", "#FFFFFF"],
    legendario: ["leeeegendario ✨", "#C4973A", "#1B3A2D"],
    ojo: ["¡OJO!", "#E8C547", "#1B3A2D"],
    real: ["100% real, no fake", "#F5EFE0", "#1B3A2D"],
    guardalo: ["📌 guardalo", "#FFFFFF", "#1B3A2D"],
    desliza: ["deslizá →", "#C4973A", "#1B3A2D"],
    plot: ["plot twist 🌀", "#F07FA0", "#FFFFFF"],
    jefe: ["☕ mejor jefe del mundo", "#FFFFFF", "#1B3A2D"],
  };

  function montar() {
    document.querySelectorAll("[data-escena]").forEach((el) => {
      const f = ESCENAS[el.dataset.escena]; if (!f) return;
      const bg = document.createElement("div"); bg.className = "escena"; bg.innerHTML = f(); el.prepend(bg);
    });
    document.querySelectorAll("[data-sticker]").forEach((el) => {
      const s = STICKERS[el.dataset.sticker]; if (!s) return;
      if (!el.textContent.trim()) el.textContent = s[0];
      el.style.setProperty("--st-bg", s[1]); el.style.setProperty("--st-fg", s[2]);
    });
  }
  window.KUME = { ESCENAS, STICKERS, montar };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", montar) : montar();
})();
