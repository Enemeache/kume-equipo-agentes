// Oficina 3D isométrica de Küme HQ (estilo Habbo / The Office).
// Uso: const of = createOffice(el, { agents, onAgent(id), onInbox() });
//      of.setBusy(id, true|false)  of.setInbox(n)  of.say(id, texto)  of.portrait(id) -> dataURL
import * as THREE from "three";

// ---------- Aspecto de cada persona ----------
// Inspirados en los personajes de The Office.
const LOOKS = {
  prospectos:  { name: "Dwight", skin: "#EAC2A0", hair: "#5A3A22", hairStyle: "side",  shirt: "#C9A227", pants: "#3A3226", shoes: "#2A1A10", extras: ["glasses", "tie"], tie: "#6B4423" },
  diagnostico: { name: "Angela", skin: "#F2D3B8", hair: "#E2C27A", hairStyle: "bun",   shirt: "#E9D8A6", pants: "#5B5F6B", shoes: "#3A2618", extras: [], scale: 0.9 },
  propuestas:  { name: "Jim",    skin: "#EDC6A6", hair: "#6B4A2E", hairStyle: "short", shirt: "#DCE6F0", pants: "#2E3440", shoes: "#1A1A1A", extras: ["tie"], tie: "#2B3A55", scale: 1.1 },
  contenido:   { name: "Pam",    skin: "#F0C7A4", hair: "#A0603A", hairStyle: "long",  shirt: "#E7A7B5", pants: "#3D4A5C", shoes: "#5A2A1A", extras: ["earrings"] },
  reportes:    { name: "Oscar",  skin: "#C68E62", hair: "#1A1410", hairStyle: "short", shirt: "#5B7FA6", pants: "#2A2F36", shoes: "#1A1A1A", extras: ["tie"], tie: "#1E2A3A" },
  vos:         { name: "Vos",    skin: "#E6B994", hair: "#3A2A1E", hairStyle: "side",  shirt: "#F2F2F2", pants: "#20262C", shoes: "#111111", extras: ["tie"], tie: "#1E2F55" },
};
// frases de cada personaje cuando están sin trabajar
const QUIPS = {
  prospectos: ["🥬 Dato: la remolacha es el mejor vegetal", "📌 Tengo 3 zonas nuevas", "🧐 Pregunta: ¿quién llamó a ese cliente?", "🥋 Cinturón negro en ventas"],
  diagnostico: ["🐈 Mis gatos me esperan", "😒 Eso no está bien hecho", "📋 Lo revisé dos veces", "🧹 Orden, por favor"],
  propuestas: ["👀 (mira a cámara)", "😏", "🏀 ¿Un tirito?", "🍮 ¿Quién puso mi abrochadora en gelatina?"],
  contenido: ["🎨 Dibujando ideas", "📸 ¿Foto para el feed?", "💛 ¡Qué lindo quedó!", "☎️ Küme, buen día"],
  reportes: ["🤓 En realidad…", "📊 Los números no mienten", "🧾 Cierra perfecto", "🍷 Esto merece un brindis"],
  vos: ["😏 Eso dijo ella", "☕ Mejor Jefe del Mundo", "🎬 ¿Hacemos una reunión?", "📧 Leyendo mails"],
};

// ---------- Plano de la oficina ----------
const CZ = -2.2; // pasillo central
const DESKS = {
  prospectos:  { x: -8.5, z: -5.5, row: "back",  sector: "Prospección" },
  diagnostico: { x: -4.0, z: -5.5, row: "back",  sector: "Diagnósticos" },
  propuestas:  { x:  0.5, z: -5.5, row: "back",  sector: "Propuestas" },
  contenido:   { x: -8.5, z:  1.8, row: "front", sector: "Estudio de contenido" },
  reportes:    { x: -3.5, z:  1.8, row: "front", sector: "Métricas" },
};
const SPOTS = {
  cafe:     { pos: [7.0, 5.9],  face: 0,  door: [7, CZ], inner: [[7, 1.0]],  say: ["☕ Un cafecito", "☕ ¿Alguien quiere?", "☕"] },
  agua:     { pos: [5.6, 5.4],  face: 0,  door: [6, CZ], inner: [[6, 1.0]],  say: ["💧 Hidratación", "💧"] },
  mesa:     { pos: [9.5, 2.5],  face: 0,  door: [7, CZ], inner: [[7, 1.0], [8.6, 2.5]], say: ["🥐 Medialuna break", "😄 jaja"] },
  ventana:  { pos: [-1.8, -7.2], face: Math.PI, door: [-1.8, CZ], inner: [], say: ["☀️ Qué lindo día", "🌇", "🤔 Pensando ideas"] },
  impresora:{ pos: [3.0, -6.1], face: Math.PI, door: [3, CZ], inner: [], say: ["🖨️ Imprimiendo…", "🖨️ ¡Otra vez se trabó!"] },
  bandeja:  { pos: [8.5, -4.9], face: Math.PI, door: [7, CZ], inner: [[7, -3.6], [8.5, -3.9]], say: ["📄 Te lo dejo acá"] },
  pizarra:  { pos: [-10.6, -3.4], face: -Math.PI / 2, door: [-10.6, CZ], inner: [], say: ["🗺️ Marcando zonas", "📌"] },
};

function seatOf(id) {
  const d = DESKS[id];
  if (d.row === "back") return { pos: [d.x, d.z - 0.95], door: [d.x + 1.5, CZ], inner: [[d.x + 1.5, d.z - 0.95]] };
  return { pos: [d.x, d.z - 0.95], door: [d.x, CZ], inner: [] };
}

// ---------- Utilidades ----------
const M = new Map();
function mat(color, opts = {}) {
  const k = color + JSON.stringify(opts);
  if (!M.has(k)) M.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...opts }));
  return M.get(k);
}
function box(w, h, d, color, x = 0, y = 0, z = 0, parent, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === "string" ? mat(color, opts) : color);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  parent && parent.add(m); return m;
}
function cyl(rt, rb, h, color, x, y, z, parent, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent && parent.add(m); return m;
}
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------- Personaje (estilo bloque, tipo Habbo) ----------
function buildPerson(look) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const L = look, X = new Set(L.extras || []);
  if (L.scale) g.scale.setScalar(L.scale);
  // piernas (pivote en la cadera)
  const legs = [-0.13, 0.13].map((x) => {
    const p = new THREE.Group(); p.position.set(x, 0.62, 0); body.add(p);
    box(0.2, 0.5, 0.22, L.pants, 0, -0.27, 0, p);
    box(0.22, 0.1, 0.3, L.shoes, 0, -0.56, 0.04, p);
    return p;
  });
  // torso
  const torso = box(0.56, 0.55, 0.32, L.shirt, 0, 0.92, 0, body);
  if (X.has("tie")) { box(0.08, 0.36, 0.02, L.tie || "#9B3B2E", 0, 0.95, 0.17, body); box(0.2, 0.06, 0.02, "#FFFFFF", 0, 1.17, 0.165, body); }
  // brazos (pivote en el hombro)
  const arms = [-0.36, 0.36].map((x) => {
    const p = new THREE.Group(); p.position.set(x, 1.16, 0); body.add(p);
    box(0.16, 0.46, 0.2, L.shirt, 0, -0.2, 0, p);
    box(0.14, 0.12, 0.16, L.skin, 0, -0.48, 0, p);
    return p;
  });
  // cabeza
  const head = new THREE.Group(); head.position.set(0, 1.47, 0); body.add(head);
  box(0.46, 0.46, 0.42, L.skin, 0, 0, 0, head);
  // ojos y boca
  [-0.1, 0.1].forEach((x) => box(0.06, 0.08, 0.02, "#1A1A1A", x, 0.03, 0.215, head));
  box(0.14, 0.03, 0.02, "#8A4A3A", 0, -0.11, 0.215, head);
  // pelo
  const H = L.hair;
  if (L.hairStyle === "short") { box(0.5, 0.14, 0.46, H, 0, 0.25, 0, head); box(0.5, 0.3, 0.1, H, 0, 0.1, -0.2, head); }
  if (L.hairStyle === "curly") { box(0.56, 0.2, 0.5, H, 0, 0.26, -0.01, head); box(0.56, 0.36, 0.14, H, 0, 0.06, -0.2, head); [-0.27, 0.27].forEach((x) => box(0.06, 0.24, 0.4, H, x, 0.12, -0.02, head)); }
  if (L.hairStyle === "long") { box(0.5, 0.14, 0.46, H, 0, 0.25, 0, head); box(0.52, 0.72, 0.14, H, 0, -0.06, -0.2, head); [-0.25, 0.25].forEach((x) => box(0.05, 0.5, 0.36, H, x, 0.02, -0.03, head)); }
  if (L.hairStyle === "bun") { box(0.5, 0.12, 0.46, H, 0, 0.25, 0, head); box(0.5, 0.26, 0.1, H, 0, 0.1, -0.2, head); box(0.22, 0.2, 0.2, H, 0, 0.4, -0.08, head); }
  if (L.hairStyle === "side") { box(0.5, 0.1, 0.46, H, 0, 0.25, 0, head); [-0.25, 0.25].forEach((x) => box(0.05, 0.2, 0.36, H, x, 0.08, -0.03, head)); box(0.5, 0.22, 0.08, H, 0, 0.08, -0.2, head); }
  // accesorios
  if (X.has("glasses")) { [-0.1, 0.1].forEach((x) => box(0.13, 0.11, 0.02, "#111", x, 0.03, 0.225, head, { roughness: 0.3 })); box(0.08, 0.02, 0.02, "#111", 0, 0.05, 0.225, head); }
  if (X.has("earrings")) [-0.24, 0.24].forEach((x) => box(0.04, 0.06, 0.04, "#C4973A", x, -0.1, 0.02, head, { metalness: 0.6, roughness: 0.3 }));
  // papel en la mano (para entregar)
  const paper = box(0.26, 0.02, 0.34, "#FFFFFF", 0, -0.52, 0.12, arms[1]); paper.visible = false;
  g.userData.parts = { body, legs, arms, head, torso, paper };
  return g;
}

export function createOffice(el, opts = {}) {
  const agentsMeta = opts.agents || [];
  const W = () => el.clientWidth, Hh = () => el.clientHeight;
  const night = (() => { const h = new Date().getHours(); return h >= 20 || h < 7; })();

  // ---------- Escena ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(night ? "#18241E" : "#E7DFCB");

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const target = new THREE.Vector3(0, 0, -0.5);
  let zoom = 1, VIEW = 10.5;
  function placeCamera() {
    camera.position.set(target.x + 22, 20, target.z + 22);
    camera.lookAt(target);
  }
  function resize() {
    const w = W(), h = Hh(); if (!w || !h) return;
    renderer.setSize(w, h);
    const a = w / h, v = VIEW / zoom * (a < 1 ? 1.6 : 1);
    // corre la escena hacia la derecha para que no quede tapada por el menú lateral
    const shift = (typeof opts.shiftPx === "function" ? opts.shiftPx() : opts.shiftPx || 0) * (2 * v * a) / w;
    camera.left = -v * a - shift; camera.right = v * a - shift; camera.top = v; camera.bottom = -v;
    camera.updateProjectionMatrix();
  }

  scene.add(new THREE.HemisphereLight(0xffffff, night ? 0x223028 : 0xb9a98a, night ? 0.55 : 0.95));
  const sun = new THREE.DirectionalLight(night ? 0xbcd0ff : 0xfff1d6, night ? 0.55 : 1.5);
  sun.position.set(12, 22, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 60 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // ---------- Piso y paredes ----------
  const floorTex = canvasTex(512, 512, (c, w, h) => {
    const n = 8, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      c.fillStyle = (i + j) % 2 ? (night ? "#5A4E3E" : "#D9CBB0") : (night ? "#625545" : "#E2D5BB"); c.fillRect(i * s, j * s, s, s);
    }
    c.strokeStyle = "rgba(0,0,0,.06)"; c.lineWidth = 2;
    for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(i * s, 0); c.lineTo(i * s, h); c.stroke(); c.beginPath(); c.moveTo(0, i * s); c.lineTo(w, i * s); c.stroke(); }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(3, 2);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(24, 0.3, 16), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }));
  floor.position.set(0, -0.15, 0); floor.receiveShadow = true; scene.add(floor);
  box(24.3, 0.3, 0.3, "#1B3A2D", 0, -0.15, 8.15, scene); box(0.3, 0.3, 16.3, "#1B3A2D", 12.15, -0.15, 0, scene);

  const wallCol = night ? "#3B4A41" : "#F1E9D6";
  box(24.4, 3.4, 0.3, wallCol, 0, 1.7, -8.15, scene);
  box(0.3, 3.4, 16.3, wallCol, -12.15, 1.7, 0, scene);
  box(24.4, 0.18, 0.34, "#1B3A2D", 0, 0.09, -8.1, scene); box(0.34, 0.18, 16.3, "#1B3A2D", -12.1, 0.09, 0, scene);
  // ventanas
  const glass = new THREE.MeshStandardMaterial({ color: night ? "#22365A" : "#BFE0EA", emissive: night ? "#0E1A33" : "#8FC6D8", emissiveIntensity: night ? 0.6 : 0.35, roughness: 0.2 });
  [-6.2, -1.8, 2.6].forEach((x) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 0.05), glass); w.position.set(x, 1.95, -7.98); scene.add(w);
    box(2.75, 0.08, 0.1, "#1B3A2D", x, 2.78, -7.96, scene); box(2.75, 0.08, 0.1, "#1B3A2D", x, 1.12, -7.96, scene);
    box(0.06, 1.7, 0.08, "#1B3A2D", x, 1.95, -7.95, scene);
  });
  // logo en la pared
  const logoTex = canvasTex(1024, 256, (c, w, h) => {
    c.fillStyle = night ? "#3B4A41" : "#F1E9D6"; c.fillRect(0, 0, w, h);
    c.fillStyle = night ? "#E8DCC0" : "#1B3A2D"; c.font = "500 150px 'Cormorant Garamond', Georgia, serif"; c.textBaseline = "middle"; c.fillText("küme", 40, 120);
    c.fillStyle = "#C4973A"; c.font = "500 34px 'DM Sans', sans-serif"; c.fillText("RAÍZ · EQUILIBRIO · RESULTADOS", 380, 128);
  });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshStandardMaterial({ map: logoTex, roughness: 1 }));
  logo.rotation.y = Math.PI / 2; logo.position.set(-11.98, 2.2, 3.4); scene.add(logo);
  // pizarra con mapa (Prospección)
  const mapTex = canvasTex(512, 320, (c, w, h) => {
    c.fillStyle = "#FBFAF5"; c.fillRect(0, 0, w, h);
    c.strokeStyle = "#B8C7BB"; c.lineWidth = 6; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(0, 30 + i * 36); c.lineTo(w, 10 + i * 40); c.stroke(); }
    for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(30 + i * 70, 0); c.lineTo(10 + i * 66, h); c.stroke(); }
    [["#9B3B2E", 120, 90], ["#C4973A", 300, 170], ["#2D5A42", 210, 240], ["#9B3B2E", 420, 110], ["#C4973A", 380, 260]].forEach(([col, x, y]) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, 14, 0, 7); c.fill(); });
    c.fillStyle = "#1B3A2D"; c.font = "bold 30px sans-serif"; c.fillText("ZONAS", 18, 300);
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshStandardMaterial({ map: mapTex, roughness: 0.9 }));
  board.rotation.y = Math.PI / 2; board.position.set(-11.9, 1.9, -3.4); scene.add(board);
  box(0.05, 1.75, 2.75, "#1B3A2D", -11.96, 1.9, -3.4, scene);

  // ---------- Muebles ----------
  const clickables = [];
  const screens = {};
  function plant(x, z, s = 1) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); scene.add(g);
    cyl(0.32, 0.26, 0.5, "#B5693F", 0, 0.25, 0, g);
    [[0, 0.9, 0, 0.42], [0.18, 1.2, 0.1, 0.3], [-0.16, 1.15, -0.1, 0.32]].forEach(([a, b, c, r]) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat("#3E7A4E")); m.position.set(a, b, c); m.castShadow = true; g.add(m);
    });
  }
  function chair(x, z, rot, parent = scene) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g);
    cyl(0.04, 0.04, 0.42, "#333", 0, 0.21, 0, g); cyl(0.3, 0.3, 0.05, "#333", 0, 0.03, 0, g, 5);
    box(0.62, 0.1, 0.6, "#2D5A42", 0, 0.47, 0, g); box(0.62, 0.7, 0.1, "#2D5A42", 0, 0.85, -0.28, g);
    return g;
  }
  function desk(id) {
    const d = DESKS[id];
    const g = new THREE.Group(); g.position.set(d.x, 0, d.z); scene.add(g);
    // alfombra del sector
    const rug = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.02, 3.4), mat({ prospectos: "#CFE0D2", diagnostico: "#EAD9B4", propuestas: "#E9DDD0", contenido: "#F0CDBA", reportes: "#D3DDE6" }[id]));
    rug.position.set(0, 0.01, -0.5); rug.receiveShadow = true; g.add(rug);
    const top = box(2.3, 0.1, 1.1, "#B98A5E", 0, 0.78, 0, g);
    [[-1.05, -0.45], [1.05, -0.45], [-1.05, 0.45], [1.05, 0.45]].forEach(([x, z]) => box(0.08, 0.74, 0.08, "#7A5638", x, 0.37, z, g));
    box(2.2, 0.5, 0.04, "#A47A50", 0, 0.5, 0.5, g); // panel frontal
    // monitor girado hacia la silla y un poco a la cámara
    const mon = new THREE.Group(); mon.position.set(-0.35, 0.83, 0.05); mon.rotation.y = Math.PI + 0.55; g.add(mon);
    box(0.08, 0.3, 0.08, "#222", 0, 0.15, 0, mon); box(0.3, 0.03, 0.2, "#222", 0, 0.01, 0, mon);
    box(0.95, 0.58, 0.06, "#1D1D1D", 0, 0.58, 0, mon);
    const scrMat = new THREE.MeshStandardMaterial({ color: "#20302A", emissive: "#20302A", emissiveIntensity: 0.6 });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.5), scrMat); scr.position.set(0, 0.58, 0.035); mon.add(scr);
    screens[id] = scrMat;
    box(0.55, 0.03, 0.2, "#EDEDED", 0.15, 0.845, -0.25, g); // teclado
    cyl(0.07, 0.06, 0.14, "#C4973A", 0.85, 0.9, 0.1, g); // taza
    box(0.3, 0.05, 0.4, "#FFFFFF", 0.6, 0.85, -0.05, g); // papeles
    chair(0, -0.95, 0, g);
    // extras por sector
    if (id === "contenido") {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 32), new THREE.MeshStandardMaterial({ color: "#FFF6E0", emissive: "#FFF1CC", emissiveIntensity: 0.9 }));
      ring.position.set(1.75, 1.75, -1.3); ring.rotation.y = -0.9; g.add(ring); cyl(0.03, 0.03, 1.6, "#222", 1.75, 0.8, -1.3, g);
      cyl(0.02, 0.02, 1.3, "#222", -1.7, 0.65, 0.7, g); box(0.34, 0.24, 0.24, "#222", -1.7, 1.38, 0.7, g); cyl(0.08, 0.08, 0.14, "#444", -1.7, 1.38, 0.86, g).rotation.x = Math.PI / 2;
    }
    if (id === "reportes") {
      const tv = canvasTex(512, 300, (c, w, h) => {
        c.fillStyle = "#13231B"; c.fillRect(0, 0, w, h);
        const v = [40, 70, 55, 95, 120, 150, 140, 190]; c.fillStyle = "#C4973A";
        v.forEach((n, i) => c.fillRect(40 + i * 56, h - 40 - n, 34, n));
        c.strokeStyle = "#7FD0A0"; c.lineWidth = 6; c.beginPath(); v.forEach((n, i) => { const X = 57 + i * 56, Y = h - 60 - n; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.stroke();
        c.fillStyle = "#F5EFE0"; c.font = "bold 28px sans-serif"; c.fillText("+64% alcance", 30, 44);
      });
      const st = new THREE.Group(); st.position.set(1.85, 0, -0.9); st.rotation.y = -0.5; g.add(st);
      cyl(0.04, 0.04, 1.3, "#222", 0, 0.65, 0, st); box(0.5, 0.04, 0.4, "#222", 0, 0.02, 0, st);
      box(1.5, 0.92, 0.06, "#111", 0, 1.6, 0, st);
      const tvm = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.82), new THREE.MeshStandardMaterial({ map: tv, emissive: "#ffffff", emissiveMap: tv, emissiveIntensity: 0.55 }));
      tvm.position.set(0, 1.6, 0.035); st.add(tvm);
    }
    if (id === "diagnostico") { const lamp = new THREE.Group(); lamp.position.set(0.9, 0.83, -0.35); g.add(lamp); cyl(0.12, 0.12, 0.03, "#222", 0, 0.01, 0, lamp); cyl(0.02, 0.02, 0.5, "#222", 0, 0.26, 0, lamp); const sh = cyl(0.05, 0.16, 0.16, "#C4973A", 0.08, 0.52, 0.05, lamp); sh.rotation.z = 0.6; }
    if (id === "propuestas") { box(0.5, 0.42, 0.34, "#2A2A2A", 1.65, 0.21, -0.6, g); box(0.4, 0.05, 0.3, "#FFFFFF", 1.65, 0.45, -0.6, g); }
    g.traverse((o) => { if (o.isMesh) { o.userData.agentId = id; clickables.push(o); } });
    return g;
  }
  Object.keys(DESKS).forEach(desk);

  // impresora y archivo
  box(0.9, 0.85, 0.7, "#ECECEC", 3.0, 0.42, -7.4, scene); box(0.7, 0.18, 0.5, "#3A3A3A", 3.0, 0.94, -7.4, scene);
  box(0.8, 1.3, 0.6, "#8C8C84", 4.2, 0.65, -7.5, scene);

  // tu oficina (vidriada) con la bandeja de entrada
  const glassWall = new THREE.MeshStandardMaterial({ color: "#CFE7EE", transparent: true, opacity: 0.28, roughness: 0.1 });
  const gw1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.4, 5), glassWall); gw1.position.set(4.8, 1.2, -5.5); scene.add(gw1);
  const gw2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.06), glassWall); gw2.position.set(5.5, 1.2, -3.0); scene.add(gw2);
  const gw3 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.4, 0.06), glassWall); gw3.position.set(10.2, 1.2, -3.0); scene.add(gw3);
  [[4.8, -3.0], [4.8, -8], [12, -3.0], [6.2, -3.0], [8.4, -3.0]].forEach(([x, z]) => box(0.1, 2.45, 0.1, "#1B3A2D", x, 1.22, z, scene));
  box(7.2, 0.08, 0.1, "#1B3A2D", 8.4, 2.42, -3.0, scene); box(0.1, 0.08, 5, "#1B3A2D", 4.8, 2.42, -5.5, scene);
  const bossRug = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.02, 4.4), mat("#E6D3A8")); bossRug.position.set(8.4, 0.01, -5.6); bossRug.receiveShadow = true; scene.add(bossRug);
  const bossDesk = new THREE.Group(); bossDesk.position.set(8.5, 0, -6.0); scene.add(bossDesk);
  box(2.8, 0.12, 1.2, "#6E4A2E", 0, 0.8, 0, bossDesk);
  box(2.7, 0.75, 1.1, "#7E5636", 0, 0.38, 0.0, bossDesk);
  chair(0, -0.95, 0, bossDesk);
  // taza "Mejor Jefe del Mundo"
  const mugTex = canvasTex(256, 128, (c, w, h) => { c.fillStyle = "#FFFFFF"; c.fillRect(0, 0, w, h); c.fillStyle = "#1A1A1A"; c.textAlign = "center"; c.font = "bold 26px Georgia, serif"; c.fillText("MEJOR JEFE", w / 2, 52); c.fillText("DEL MUNDO", w / 2, 88); });
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.22, 20), [new THREE.MeshStandardMaterial({ map: mugTex }), mat("#FFFFFF"), mat("#3A2010")]);
  mug.position.set(-0.8, 0.97, 0.25); mug.rotation.y = 0.6; mug.castShadow = true; bossDesk.add(mug);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12), mat("#FFFFFF")); handle.position.set(-0.68, 0.97, 0.18); handle.rotation.y = 0.6; bossDesk.add(handle);
  // bandeja con papeles
  const inbox = new THREE.Group(); inbox.position.set(9.4, 0.86, -5.8); scene.add(inbox);
  box(0.6, 0.06, 0.45, "#C4973A", 0, 0, 0, inbox, { metalness: 0.4, roughness: 0.4 });
  [[-0.3, 0], [0.3, 0], [0, -0.22], [0, 0.22]].forEach(([x, z], i) => box(i < 2 ? 0.04 : 0.6, 0.12, i < 2 ? 0.45 : 0.04, "#C4973A", x, 0.06, z, inbox));
  const paperStack = new THREE.Group(); inbox.add(paperStack);
  inbox.traverse((o) => { if (o.isMesh) { o.userData.inbox = true; clickables.push(o); } });
  const bossTag = new THREE.Vector3(9.4, 1.4, -5.8);
  plant(11.3, -7.3, 1.1); plant(5.4, -7.3, 0.9);

  // cocina
  box(5.6, 0.95, 0.8, "#F1E9D6", 8.6, 0.47, 6.9, scene); box(5.7, 0.08, 0.86, "#1B3A2D", 8.6, 0.98, 6.9, scene);
  box(0.5, 0.55, 0.45, "#2A2A2A", 7.0, 1.3, 6.85, scene); box(0.12, 0.08, 0.12, "#C4973A", 7.0, 1.05, 7.2, scene);
  cyl(0.05, 0.05, 0.1, "#FFFFFF", 6.6, 1.08, 6.7, scene); cyl(0.05, 0.05, 0.1, "#C4973A", 6.4, 1.08, 6.75, scene);
  box(0.9, 2.1, 0.8, "#DCDCDC", 11.4, 1.05, 6.9, scene, { roughness: 0.4 });
  cyl(0.24, 0.24, 1.0, "#FFFFFF", 5.6, 0.5, 6.5, scene); cyl(0.2, 0.2, 0.5, "#9ED3EA", 5.6, 1.25, 6.5, scene);
  const table = new THREE.Group(); table.position.set(9.5, 0, 3.5); scene.add(table);
  cyl(0.85, 0.85, 0.08, "#B98A5E", 0, 0.76, 0, table, 24); cyl(0.07, 0.07, 0.74, "#333", 0, 0.37, 0, table);
  [[0, -1.05], [1.05, 0], [-1.05, 0.2]].forEach(([x, z]) => cyl(0.25, 0.25, 0.5, "#2D5A42", x, 0.25, z, table));
  plant(11.3, 1.6, 1.2); plant(-11.2, 7.2, 1.3); plant(-11.2, -7.3, 1.0); plant(-6.2, 5.6, 0.9);
  // sillón de espera
  box(2.4, 0.45, 0.9, "#2D5A42", -1.5, 0.3, 6.6, scene); box(2.4, 0.6, 0.25, "#2D5A42", -1.5, 0.75, 7.05, scene);
  box(1.1, 0.05, 0.6, "#B98A5E", -1.5, 0.45, 5.5, scene); [[-0.45, -0.22], [0.45, -0.22], [-0.45, 0.22], [0.45, 0.22]].forEach(([x, z]) => box(0.05, 0.42, 0.05, "#7A5638", -1.5 + x, 0.21, 5.5 + z, scene));

  // ---------- Personas ----------
  const people = {};
  const labelLayer = document.createElement("div");
  labelLayer.className = "of-labels"; el.appendChild(labelLayer);
  function mkLabel(cls, html) { const d = document.createElement("div"); d.className = cls; d.innerHTML = html; labelLayer.appendChild(d); return d; }

  function addPerson(id, meta) {
    const look = LOOKS[id] || LOOKS.vos;
    const g = buildPerson(look);
    const seat = id === "vos" ? { pos: [8.5, -6.95], door: [7, CZ], inner: [[7, -3.6]] } : seatOf(id);
    g.position.set(seat.pos[0], 0, seat.pos[1]);
    scene.add(g);
    g.traverse((o) => { if (o.isMesh) { o.userData.agentId = id; if (id !== "vos") clickables.push(o); } });
    const tag = mkLabel("of-tag", `<b>${meta.nombre}</b><span>${meta.rol || ""}</span>`);
    const bub = mkLabel("of-bubble", ""); bub.style.display = "none";
    const p = { id, g, seat, at: "seat", path: [], state: "sit", busy: false, timer: rnd(3, 9), bubbleT: 0, yaw: 0, wantYaw: 0, phase: Math.random() * 6, tag, bub, carrying: false, after: null, meta };
    people[id] = p; sit(p);
    return p;
  }
  function sit(p) { p.state = "sit"; p.wantYaw = 0; p.g.position.set(p.seat.pos[0], 0, p.seat.pos[1]); }
  function say(id, text, secs = 3.2) {
    const p = people[id]; if (!p) return;
    p.bub.innerHTML = `<span class="b">${text}</span>`; p.bub.style.display = "block"; p.bubbleT = secs;
  }
  function routeFrom(p) {
    // salir del lugar actual hasta el pasillo
    const from = p.at === "seat" ? p.seat : SPOTS[p.at] || p.seat;
    const pts = [...from.inner].reverse().map((v) => v.slice()); pts.push(from.door.slice());
    return pts;
  }
  function go(p, dest, name, after) {
    const pts = routeFrom(p);
    pts.push(dest.door.slice(), ...dest.inner.map((v) => v.slice()), dest.pos.slice());
    p.path = pts; p.state = "walk"; p.at = name; p.after = after; p.dest = dest;
  }
  function goSeat(p, after) { go(p, p.seat, "seat", () => { sit(p); after && after(); }); }

  agentsMeta.forEach((a) => DESKS[a.id] && addPerson(a.id, a));
  addPerson("vos", { nombre: "Vos", rol: "Aprobás todo" });
  people.vos.tag.classList.add("me");

  // carteles de sector
  const signs = Object.entries(DESKS).map(([id, d]) => ({ v: new THREE.Vector3(d.x, 0.05, d.z + (d.row === "back" ? 1.25 : 1.4)), el: mkLabel("of-sign", d.sector) }));
  signs.push({ v: new THREE.Vector3(8.4, 0.05, -3.4), el: mkLabel("of-sign", "Tu oficina") });
  signs.push({ v: new THREE.Vector3(8.6, 0.05, 5.3), el: mkLabel("of-sign", "Cocina") });
  const inboxBadge = mkLabel("of-inbox", "📥 <b>0</b> para aprobar");
  inboxBadge.onclick = () => opts.onInbox && opts.onInbox();

  // ---------- Bandeja ----------
  let inboxN = 0;
  function setInbox(n) {
    inboxN = n; paperStack.clear();
    for (let i = 0; i < Math.min(n, 12); i++) { const s = box(0.5, 0.025, 0.36, "#FFFFFF", rnd(-0.03, 0.03), 0.05 + i * 0.03, rnd(-0.02, 0.02), paperStack); s.rotation.y = rnd(-0.12, 0.12); s.userData.inbox = true; clickables.push(s); }
    inboxBadge.innerHTML = `📥 <b>${n}</b> para aprobar`;
    inboxBadge.classList.toggle("has", n > 0);
  }

  // ---------- Comportamiento ----------
  const others = (id) => Object.keys(people).filter((k) => k !== id && k !== "vos");
  function idleAction(p) {
    if (p.id === "vos") { if (Math.random() < 0.4) say("vos", pick(QUIPS.vos)); p.timer = rnd(10, 18); return; }
    const opts2 = ["cafe", "agua", "ventana", "visita", "visita", "mesa", "frase", "frase"];
    if (["propuestas", "diagnostico", "reportes"].includes(p.id)) opts2.push("impresora", "impresora");
    if (p.id === "prospectos") opts2.push("pizarra", "pizarra");
    const a = pick(opts2);
    if (a === "frase") { say(p.id, pick(QUIPS[p.id] || ["💭"]), 3.6); p.timer = rnd(6, 12); return; }
    if (a === "visita") {
      const o = people[pick(others(p.id))]; const d = DESKS[o.id];
      const spot = d.row === "back"
        ? { pos: [d.x + 0.4, d.z + 1.0], face: Math.PI, door: [d.x + 0.4, CZ], inner: [] }
        : { pos: [d.x + 1.6, d.z - 0.95], face: -Math.PI / 2, door: [d.x + 1.6, CZ], inner: [] };
      SPOTS["v_" + p.id] = spot;
      go(p, spot, "v_" + p.id, () => {
        p.wantYaw = spot.face; say(p.id, pick(["💬 ¿Viste esto?", "💬 Che, una pregunta…", "🙌 ¡Buenísimo!"]));
        setTimeout(() => o.state === "sit" && say(o.id, pick(["😄 Jaja sí", "👍 Dale", "🤓 Mirá acá"])), 1300);
        p.state = "stay"; p.stay = rnd(3.5, 5.5);
      });
      return;
    }
    const s = SPOTS[a];
    const dest = { ...s, pos: [s.pos[0] + rnd(-0.3, 0.3), s.pos[1] + rnd(-0.2, 0.2)] };
    go(p, dest, a, () => { p.wantYaw = s.face; say(p.id, pick(s.say)); p.state = "stay"; p.stay = rnd(3, 5); });
  }
  function setBusy(id, b) {
    const p = people[id]; if (!p || p.busy === b) return;
    p.busy = b;
    if (b) {
      say(id, "💻 Trabajando…", 9999);
      if (p.state !== "sit") goSeat(p, () => say(id, "💻 Trabajando…", 9999));
    } else {
      p.bubbleT = 0.01;
      // terminó: festeja y te lleva el papel
      p.jump = 0.6; say(id, "✅ ¡Listo!", 2);
      setTimeout(() => {
        p.carrying = true; p.g.userData.parts.paper.visible = true;
        go(p, SPOTS.bandeja, "bandeja", () => {
          p.wantYaw = Math.PI; say(id, "📄 Te lo dejo acá", 2.5);
          p.carrying = false; p.g.userData.parts.paper.visible = false;
          setInbox(inboxN + 1); say("vos", "📥 ¡Gracias!", 2);
          opts.onDelivered && opts.onDelivered(id);
          p.state = "stay"; p.stay = 1.6; p.returnSeat = true;
        });
      }, 900);
    }
  }

  // ---------- Bucle ----------
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  function project(v, elx, dy = 0) {
    tmp.copy(v).project(camera);
    const x = (tmp.x + 1) / 2 * W(), y = (1 - tmp.y) / 2 * Hh() + dy;
    elx.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }
  let raf = 0, hoverId = null;
  function tick() {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    for (const p of Object.values(people)) {
      const P = p.g.userData.parts;
      // caminar
      if (p.state === "walk") {
        const [tx, tz] = p.path[0];
        const dx = tx - p.g.position.x, dz = tz - p.g.position.z, d = Math.hypot(dx, dz);
        const sp = 2.3 * dt;
        if (d < sp) { p.g.position.x = tx; p.g.position.z = tz; p.path.shift(); if (!p.path.length) { p.state = "idle"; p.after && p.after(); } }
        else { p.g.position.x += dx / d * sp; p.g.position.z += dz / d * sp; p.wantYaw = Math.atan2(dx, dz); }
        const s = Math.sin(t * 11);
        P.legs[0].rotation.x = s * 0.6; P.legs[1].rotation.x = -s * 0.6;
        P.arms[0].rotation.x = -s * 0.5; P.arms[1].rotation.x = p.carrying ? -1.2 : s * 0.5;
        P.body.position.y = Math.abs(Math.cos(t * 11)) * 0.06;
      } else if (p.state === "sit") {
        P.body.position.y = -0.17;
        P.legs.forEach((l) => (l.rotation.x = -1.45));
        const typing = p.busy || p.id === "vos";
        P.arms[0].rotation.x = typing ? -1.05 + Math.sin(t * 18 + p.phase) * 0.08 : -0.15 + Math.sin(t + p.phase) * 0.05;
        P.arms[1].rotation.x = typing ? -1.05 + Math.cos(t * 17 + p.phase) * 0.08 : -0.15;
        P.head.rotation.y = p.busy ? Math.sin(t * 0.8) * 0.15 : Math.sin(t * 0.5 + p.phase) * 0.35;
        P.head.rotation.x = p.busy ? 0.12 : 0;
        p.g.position.set(p.seat.pos[0], 0, p.seat.pos[1]);
      } else {
        P.body.position.y = 0;
        P.legs.forEach((l) => (l.rotation.x *= 0.8));
        P.arms[0].rotation.x = Math.sin(t * 2 + p.phase) * 0.08;
        P.arms[1].rotation.x = p.carrying ? -1.2 : -Math.sin(t * 2 + p.phase) * 0.08;
        P.head.rotation.y = Math.sin(t * 1.2 + p.phase) * 0.25;
      }
      if (p.jump > 0) { p.jump -= dt; P.body.position.y += Math.sin((0.6 - p.jump) / 0.6 * Math.PI) * 0.45; P.arms.forEach((a) => (a.rotation.z = (a === P.arms[0] ? -1 : 1) * 2.4)); }
      else P.arms.forEach((a) => (a.rotation.z *= 0.85));
      // girar suave
      let dy = p.wantYaw - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); p.yaw += dy * Math.min(1, dt * 10); p.g.rotation.y = p.yaw;
      // estados
      if (p.state === "stay") { p.stay -= dt; if (p.stay <= 0) { if (p.returnSeat) p.returnSeat = false; goSeat(p); } }
      if (p.state === "sit" && !p.busy) { p.timer -= dt; if (p.timer <= 0) { p.timer = rnd(8, 18); idleAction(p); } }
      // hover
      const sc = hoverId === p.id ? 1.08 : 1; p.g.scale.lerp(tmp.set(sc, sc, sc), 0.2);
      // globos y nombres
      if (p.bubbleT > 0) { p.bubbleT -= dt; if (p.bubbleT <= 0) p.bub.style.display = "none"; }
      const head = new THREE.Vector3(p.g.position.x, 2.35 + P.body.position.y, p.g.position.z);
      project(head, p.bub);
      project(new THREE.Vector3(p.g.position.x, 0, p.g.position.z), p.tag, 26);
      p.tag.classList.toggle("hover", hoverId === p.id);
    }
    for (const s of Object.values(screens)) s.emissiveIntensity = 0.6;
    for (const [id, s] of Object.entries(screens)) {
      const busy = people[id]?.busy;
      s.color.set(busy ? "#C4973A" : "#20302A"); s.emissive.set(busy ? "#E6B04A" : "#2D5A42");
      s.emissiveIntensity = busy ? 0.7 + Math.sin(t * 6) * 0.25 : 0.5;
    }
    signs.forEach((s) => project(s.v, s.el, 10));
    project(bossTag.clone().setY(1.3 + Math.min(inboxN, 12) * 0.03), inboxBadge);
    renderer.render(scene, camera);
  }

  // ---------- Interacción: clic, hover, arrastrar, zoom ----------
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  function hit(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    return ray.intersectObjects(clickables, false)[0]?.object?.userData || null;
  }
  let down = null, dragging = false;
  const cv = renderer.domElement;
  cv.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, tx: target.x, tz: target.z }; dragging = false; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) > 5) dragging = true;
      if (dragging) {
        const k = (camera.right - camera.left) / W();
        // derecha de pantalla = (1,0,-1)/√2 ; arriba de pantalla en el piso = (-1,0,-1)/√2
        const rx = -dx * k, uy = dy * k * 1.4;
        target.x = THREE.MathUtils.clamp(down.tx + (rx - uy) / Math.SQRT2, -10, 10);
        target.z = THREE.MathUtils.clamp(down.tz + (-rx - uy) / Math.SQRT2, -7, 7);
        placeCamera();
      }
      return;
    }
    const u = hit(e); const id = u?.agentId && u.agentId !== "vos" ? u.agentId : null;
    hoverId = id; cv.style.cursor = id || u?.inbox ? "pointer" : "grab";
  });
  cv.addEventListener("pointerup", (e) => {
    const wasDrag = dragging; down = null; dragging = false;
    if (wasDrag) return;
    const u = hit(e); if (!u) return;
    if (u.inbox) return opts.onInbox && opts.onInbox();
    if (u.agentId && u.agentId !== "vos") { say(u.agentId, pick(["👋 ¡Hola!", "🙋 ¿En qué te ayudo?", "😊 Decime"]), 2); opts.onAgent && opts.onAgent(u.agentId); }
  });
  cv.addEventListener("wheel", (e) => { e.preventDefault(); zoom = THREE.MathUtils.clamp(zoom * (1 - e.deltaY * 0.0012), 0.7, 2.4); resize(); }, { passive: false });
  new ResizeObserver(resize).observe(el);
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancelAnimationFrame(raf); else { clock.getDelta(); tick(); } });

  placeCamera(); resize(); tick();

  // ---------- Retratos para el chat ----------
  function portrait(id) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(160, 160); r.outputColorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Scene(); s.background = new THREE.Color("#F5EFE0");
    s.add(new THREE.HemisphereLight(0xffffff, 0xb9a98a, 1.2)); const dl = new THREE.DirectionalLight(0xffffff, 1.2); dl.position.set(2, 3, 4); s.add(dl);
    const pp = buildPerson(LOOKS[id] || LOOKS.vos); s.add(pp);
    const c = new THREE.PerspectiveCamera(30, 1, 0.1, 50); c.position.set(0.9, 1.65, 2.6); c.lookAt(0, 1.32, 0);
    r.render(s, c); const url = r.domElement.toDataURL("image/png"); r.dispose(); return url;
  }

  return { setBusy, setInbox, say, portrait, people };
}
