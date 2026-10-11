const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s) => document.querySelector(s);

// keep the top bar readable once the page scrolls over dark sections
const bar = document.querySelector('.bar');
const onScroll = () => bar.classList.toggle('scrolled', scrollY > 40);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const GROUPS = [
  ['Instruction', ['11', '12', '13', '95']],
  ['Instructional support', ['23', '31', '36', '21', '33', '32']],
  ['Administration', ['41']],
  ['Operations', ['51', '34', '53', '52', '35']],
  ['Other', ['97', '91', '99', '61']],
];
const SHORT = {
  '11': 'Instruction', '12': 'Libraries and media', '13': 'Curriculum and staff development',
  '95': 'Juvenile justice programs', '21': 'Instructional leadership', '23': 'School leadership',
  '31': 'Counseling and evaluation', '32': 'Social work', '33': 'Health services',
  '36': 'Cocurricular and extracurricular', '41': 'General administration', '34': 'Transportation',
  '35': 'Food services', '51': 'Maintenance and operations', '52': 'Security and monitoring',
  '53': 'Data processing', '61': 'Community services', '91': 'Payments to other districts',
  '97': 'Tax increment fund', '99': 'Other intergovernmental charges',
};

const money = (n) => {
  const a = Math.abs(n);
  const s = a >= 1e9 ? (a / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1e3 ? Math.round(a / 1e3) + 'K' : String(a);
  return (n < 0 ? '−$' : '$') + s;
};
const full = (n) => (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US');
const pretty = (y) => y.replace('-', '–');

const data = await fetch('/budget.json').then((r) => r.json());
const Y = data.years;
let yi = Y.length - 1;
let selected = null;

/* ---------- table ---------- */
function buildTable() {
  const t = $('#ledger');
  let h = '<thead><tr><th scope="col">Function</th>' + Y.map((y) => `<th scope="col">${pretty(y)}</th>`).join('') + '</tr></thead><tbody>';
  for (const [, codes] of GROUPS) for (const c of codes) {
    h += `<tr data-code="${c}"><th scope="row"><span class="code">${c}</span>${SHORT[c]}</th>` +
      data.values[c].map((v) => `<td>${v ? money(v) : '–'}</td>`).join('') + '</tr>';
  }
  h += '</tbody><tfoot><tr><th scope="row">Planned spending</th>' + Y.map((y) => `<td>${money(data.total[y])}</td>`).join('') + '</tr>' +
    '<tr class="gap"><th scope="row">Planned revenue</th>' + Y.map((y) => `<td>${money(data.revenue[y])}</td>`).join('') + '</tr>' +
    '<tr class="gap"><th scope="row">Revenue minus spending</th>' + Y.map((y) => `<td>${money(data.revenue[y] - data.total[y])}</td>`).join('') + '</tr></tfoot>';
  t.insertAdjacentHTML('beforeend', h);
}
buildTable();

/* ---------- readout and year buttons ---------- */
function readout() {
  const y = Y[yi];
  if (!selected) {
    $('#ro-name').textContent = `General Fund, ${pretty(y)}`;
    $('#ro-amt').textContent = money(data.total[y]);
    const n = Object.values(data.values).filter((v) => v[yi] > 0).length;
    const gap = data.revenue[y] - data.total[y];
    $('#ro-sub').textContent = gap === 0
      ? `Planned spending across ${n} functions, matched by planned revenue`
      : `Planned spending across ${n} functions. Planned revenue was ${money(data.revenue[y])}, a gap of ${money(gap)}.`;
  } else {
    const v = data.values[selected][yi];
    const prev = yi > 0 ? data.values[selected][yi - 1] : null;
    const share = ((v / data.total[y]) * 100).toFixed(1);
    $('#ro-name').textContent = `${SHORT[selected]}, function ${selected}, ${pretty(y)}`;
    $('#ro-amt').textContent = v ? money(v) : 'Not budgeted';
    let sub = v ? `${share}% of the General Fund. ${full(v)}.` : '';
    if (prev && v) {
      const ch = ((v - prev) / prev) * 100;
      sub += ` ${ch >= 0 ? 'Up' : 'Down'} ${Math.abs(ch).toFixed(1)}% from ${pretty(Y[yi - 1])}.`;
    }
    $('#ro-sub').textContent = sub.trim();
  }
  document.querySelectorAll('#ledger tbody tr').forEach((r) => r.classList.toggle('sel', r.dataset.code === selected));
}
const yearsEl = $('#years');
Y.forEach((y, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = pretty(y);
  b.setAttribute('aria-pressed', i === yi);
  b.addEventListener('click', () => setYear(i));
  yearsEl.append(b);
});
function setYear(i) {
  yi = i;
  yearsEl.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', j === i));
  readout();
  if (scene) scene.setYear(i);
}
readout();

/* ---------- signup ---------- */
$('#signup').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const st = $('#form-status');
  const fd = new FormData(f);
  const name = String(fd.get('name') || '').trim();
  const email = String(fd.get('email') || '').trim();
  if (!name) { st.textContent = 'Enter your name.'; f.name.focus(); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { st.textContent = 'Enter a valid email address.'; f.email.focus(); return; }
  const btn = f.querySelector('button[type=submit]');
  btn.disabled = true; st.textContent = 'Sending…';
  try {
    const r = await fetch('/api/signup', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, email, zip: fd.get('zip'), help: fd.getAll('help'), company: fd.get('company') }),
    });
    if (!r.ok) throw new Error();
    f.reset();
    st.textContent = `Thanks, ${name.split(' ')[0]}. You're on the list.`;
  } catch {
    st.textContent = 'That didn\u2019t go through. Try again, or email srjordan@gmail.com.';
  } finally { btn.disabled = false; }
});

/* ---------- 3D model ---------- */
let scene = null;
try { scene = await buildScene(); } catch (err) {
  console.warn('3D model unavailable', err);
  document.documentElement.classList.add('nogl');
  $('#hint').textContent = 'Your browser can\u2019t show the 3D model. The same numbers are in the table below.';
}

async function buildScene() {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const canvas = $('#model');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const SKY = 0xE7EBEE;
  const sc = new THREE.Scene();
  sc.background = new THREE.Color(SKY);
  sc.fog = new THREE.Fog(SKY, 50, 140);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  cam.position.set(26, 17, 30);

  sc.add(new THREE.HemisphereLight(0xF4F7FA, 0xB3BDC5, 1.25));
  const sun = new THREE.DirectionalLight(0xFFF4E2, 2.4);
  sun.position.set(-14, 26, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 });
  sun.shadow.bias = -0.0004;
  sun.shadow.radius = 4;
  sc.add(sun);

  // ground: a survey plate with fine grid
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: SKY, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.36;
  ground.receiveShadow = true;
  sc.add(ground);

  // layout
  const S = 1.7, GAP = 0.45, STREET = 2.2, COLS = 2;
  const MAXV = 432e6, H = 11;
  const hOf = (v) => (v > 0 ? Math.max(0.06, (v / MAXV) * H) : 0.015);
  const blocks = [];
  const groupInfo = [];
  let x = 0;
  for (const [gname, codes] of GROUPS) {
    const cols = Math.min(COLS, codes.length);
    const rows = Math.ceil(codes.length / cols);
    const w = cols * S + (cols - 1) * GAP;
    const d = rows * S + (rows - 1) * GAP;
    codes.forEach((c, i) => {
      const cx = x + (i % cols) * (S + GAP) + S / 2;
      const cz = Math.floor(i / cols) * (S + GAP) + S / 2;
      blocks.push({ code: c, cx, cz });
    });
    groupInfo.push({ gname, x, w, d });
    x += w + STREET;
  }
  const totalW = x - STREET;
  const maxD = Math.max(...groupInfo.map((g) => g.d));
  const offX = -totalW / 2, offZ = -maxD / 2 - 0.6;

  // the maquette base board, with a survey grid scored into it
  const PAD = 1.6;
  const boardW = totalW + PAD * 2, boardD = maxD + PAD * 2 + 1.4;
  const board = new THREE.Mesh(new THREE.BoxGeometry(boardW, 0.36, boardD), new THREE.MeshStandardMaterial({ color: 0xFAFBFB, roughness: 0.9 }));
  board.position.set(0, -0.18, offZ + maxD / 2 + 0.7);
  board.receiveShadow = true; board.castShadow = true;
  sc.add(board);
  const grid = new THREE.GridHelper(boardW - 0.2, Math.round(boardW), 0xD5DBDF, 0xE2E6E9);
  grid.scale.z = (boardD - 0.2) / (boardW - 0.2);
  grid.position.set(0, 0.003, board.position.z);
  sc.add(grid);

  const base = new THREE.MeshStandardMaterial({ color: 0xF3F5F6, roughness: 0.82, metalness: 0 });
  const geo = new THREE.BoxGeometry(S, 1, S);
  geo.translate(0, 0.5, 0);
  const edgeGeo = new THREE.EdgesGeometry(geo);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x8A97A2, transparent: true, opacity: 0.55 });
  const meshes = [];
  for (const b of blocks) {
    const m = new THREE.Mesh(geo, base.clone());
    m.position.set(b.cx + offX, 0, b.cz + offZ);
    m.castShadow = true; m.receiveShadow = true;
    m.add(new THREE.LineSegments(edgeGeo, edgeMat));
    m.userData = { code: b.code, h: hOf(data.values[b.code][yi]), target: 0 };
    m.scale.y = reduce ? m.userData.h : 0.001;
    m.userData.target = m.userData.h;
    sc.add(m); meshes.push(m);
  }

  // group labels painted on the ground
  await document.fonts.load('700 64px "Big Shoulders Display"').catch(() => {});
  for (const g of groupInfo) {
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#3B4956';
    ctx.font = '700 92px "Big Shoulders Display", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(g.gname, 8, 64);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const pw = 7.2, ph = 0.9;
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    lab.rotation.x = -Math.PI / 2;
    lab.position.set(g.x + offX + pw / 2, 0.01, offZ + maxD + 0.85);
    sc.add(lab);
  }

  const controls = new OrbitControls(cam, canvas);
  controls.target.set(0, 2.4, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 18; controls.maxDistance = 60;
  controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.32;
  controls.autoRotate = !reduce;
  controls.autoRotateSpeed = 0.35;
  controls.enableZoom = false;
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (coarse) {
    controls.enableRotate = false; // keep page scrolling on phones; tap still selects
    $('#hint').textContent = 'Tap a block to read it.';
  }
  controls.update();
  let idle;
  controls.addEventListener('start', () => { controls.autoRotate = false; clearTimeout(idle); });
  controls.addEventListener('end', () => { clearTimeout(idle); if (!reduce) idle = setTimeout(() => (controls.autoRotate = true), 6000); });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    const wide = w > 820;
    // fit the whole board in frame for this aspect ratio
    const hfov = 2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * cam.aspect);
    const need = (boardW * (wide ? 0.82 : 0.5)) / Math.tan(hfov / 2);
    const dist = Math.max(wide ? 34 : 24, need);
    const dir = cam.position.clone().sub(controls.target).normalize();
    cam.position.copy(controls.target).addScaledVector(dir, dist);
    controls.minDistance = dist * 0.7; controls.maxDistance = dist * 1.3;
    sc.fog.near = dist * 1.3; sc.fog.far = dist * 3.2;
    // on wide screens, shift the model right so the headline has room
    if (wide) cam.setViewOffset(w, h, -w * 0.13, -h * 0.06, w, h); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // picking
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  const tag = $('#tag');
  let hover = null, downAt = null;
  const HOVER = new THREE.Color(0xF6D86A), SEL = new THREE.Color(0xF2C230), BASE = new THREE.Color(0xF3F5F6);
  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, cam);
    const hit = ray.intersectObjects(meshes, false)[0];
    return hit ? hit.object : null;
  }
  function paint() {
    for (const m of meshes) m.material.color.copy(m.userData.code === selected ? SEL : m === hover ? HOVER : BASE);
  }
  canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse') return;
    hover = pick(ev);
    canvas.style.cursor = hover ? 'pointer' : 'grab';
    if (hover) {
      const c = hover.userData.code, v = data.values[c][yi];
      tag.textContent = `${SHORT[c]}: ${v ? money(v) : 'not budgeted'}`;
      tag.style.left = ev.clientX + 'px'; tag.style.top = ev.clientY + 'px';
      tag.classList.add('on');
    } else tag.classList.remove('on');
    paint();
  });
  canvas.addEventListener('pointerleave', () => { hover = null; tag.classList.remove('on'); paint(); });
  canvas.addEventListener('pointerdown', (ev) => (downAt = [ev.clientX, ev.clientY]));
  canvas.addEventListener('pointerup', (ev) => {
    if (!downAt || Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 6) return;
    const m = pick(ev);
    selected = m && m.userData.code !== selected ? m.userData.code : null;
    readout(); paint();
  });

  // intro: rise in order of size
  if (!reduce) {
    const order = [...meshes].sort((a, b) => b.userData.h - a.userData.h);
    order.forEach((m, i) => (m.userData.delay = 250 + i * 55));
  }
  const t0 = performance.now();
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    for (const m of meshes) {
      const u = m.userData;
      if (u.delay && now - t0 < u.delay) continue;
      const k = reduce ? 1 : 0.085;
      m.scale.y += (u.target - m.scale.y) * k;
    }
    controls.update();
    renderer.render(sc, cam);
  }
  requestAnimationFrame(frame);

  return {
    setYear(i) {
      for (const m of meshes) {
        m.userData.target = hOf(data.values[m.userData.code][i]);
        m.userData.delay = 0;
        if (reduce) m.scale.y = m.userData.target;
      }
    },
  };
}
