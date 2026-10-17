'use strict';
// ─────────────────────────────────────────────────────────────
//  UI: 카메라, 입력, 도구, 서랍식 병기고, HUD, 전체화면, 썸네일
// ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const ICON = {
  grenade: '<circle cx="11" cy="14" r="6"/><path d="M9 8h4V6H9zM13 7l4-3"/>',
  cluster: '<circle cx="7" cy="16" r="3"/><circle cx="17" cy="16" r="3"/><circle cx="12" cy="8" r="3"/>',
  napalm: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1 1 1.5 2 2 3 1-2 1-4 1-7z"/>',
  arty: '<path d="M6 3v9M12 3v13M18 3v9"/><path d="M4 10l2 3 2-3M10 14l2 3 2-3M16 10l2 3 2-3"/><path d="M3 21h18"/>',
  air: '<path d="M12 2c1 0 1.5 1 1.5 2.5V9l7 4v2l-7-2v5l2 1.5V21L12 20l-3.5 1v-1.5l2-1.5v-5l-7 2v-2l7-4V4.5C10.5 3 11 2 12 2z"/>',
  missile: '<path d="M12 2c2 2 3 5 3 8v6l2 3H7l2-3v-6c0-3 1-6 3-8z"/><path d="M10 21l2 2 2-2"/>',
  nuke: '<circle cx="12" cy="12" r="1.8"/><path d="M10.6 9.6 7.5 4.2A9 9 0 0 0 3 12h6.2M14.8 12H21a9 9 0 0 0-4.5-7.8l-3.1 5.4M10.6 14.4l-3.1 5.4a9 9 0 0 0 9 0l-3.1-5.4"/>',
  bh: '<path d="M12 12m-1.5 0a1.5 1.5 0 1 0 3 0a3.5 3.5 0 1 0-7 0a5.5 5.5 0 1 0 11 0a7.5 7.5 0 1 0-15 0"/>',
  raise: '<path d="M2 20h20M5 20c2-6 4-8.5 7-8.5s5 2.5 7 8.5"/><path d="M12 3v6M9 6l3-3 3 3"/>',
  dig: '<path d="M14 3l7 7M17.5 6.5 9.5 14.5"/><path d="M9.5 14.5 5 19c-1 1-2.6.2-2.2-1.2l1-3.6 3.7-1.2z"/>',
  wall: '<rect x="3" y="6" width="18" height="12"/><path d="M3 10h18M3 14h18M9 6v4M15 6v4M6 10v4M12 10v4M18 10v4M9 14v4M15 14v4"/>',
  sandbag: '<rect x="2.5" y="13" width="9" height="5.5" rx="2.7"/><rect x="12.5" y="13" width="9" height="5.5" rx="2.7"/><rect x="7.5" y="6.5" width="9" height="5.5" rx="2.7"/>',
  tnt: '<rect x="4" y="9" width="4.5" height="12" rx="1"/><rect x="9.75" y="9" width="4.5" height="12" rx="1"/><rect x="15.5" y="9" width="4.5" height="12" rx="1"/><path d="M12 9V6c0-1.5 1-3 3.5-3"/>',
  tree: '<path d="M12 2l6 8h-3l4 6H5l4-6H6z"/><path d="M12 16v6"/>',
  house: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  sand: '<path d="M3 20h18"/><path d="M5 20c1.2-4 4-6.5 7-6.5s5.8 2.5 7 6.5"/><circle cx="12" cy="4.5" r=".9"/><circle cx="9.5" cy="8" r=".9"/><circle cx="14.5" cy="8" r=".9"/>',
  move: '<path d="M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5"/>',
  grab: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v7c0 4-3 8-7 8-3 0-4.5-1.5-6-4l-2-3.5a1.5 1.5 0 0 1 2.5-1.5L8 15"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  trash: '<path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13"/>',
  full: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  unfull: '<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>',
  gfx: '<rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="M8 21h8M12 17v4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17h.01"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  reset: '<path d="M4 4v6h6"/><path d="M4.6 10A8 8 0 1 1 6 17"/>',
  swords: '<path d="M4 4l9.5 9.5M4 4h4.5M4 4v4.5M20 4l-9.5 9.5M20 4h-4.5M20 4v4.5M8 16l-4 4M16 16l4 4M10 14l-3 3M14 14l3 3"/>',
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  army: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2c3 .3 5.5 2.5 5.5 5.8"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  kit: '<rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M9 7V4h6v3M3 12h18M10 12v2h4v-2"/>',
};
const svg = (k, cls) => `<svg class="${cls || 'ic'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

const TOOLSET = {
  units: [
    { id: 'rifle', name: '소총병', desc: '균형 잡힌 기본 보병', unit: 'rifle' },
    { id: 'mg', name: '기관총병', desc: '연사로 보병을 제압', unit: 'mg' },
    { id: 'sniper', name: '저격병', desc: '먼 거리에서 한 방', unit: 'sniper' },
    { id: 'rocket', name: '로켓병', desc: '전차와 벽을 부숨', unit: 'rocket' },
    { id: 'grenadier', name: '척탄병', desc: '엄폐물 너머로 수류탄', unit: 'grenadier' },
    { id: 'medic', name: '의무병', desc: '아군을 치료', unit: 'medic' },
    { id: 'tank', name: '전차', desc: '포격과 동축 기관총', unit: 'tank' },
  ],
  fire: [
    { id: 'grenade', name: '수류탄', desc: '시점에서 던지기', icon: 'grenade', mode: 'click', r: 3 },
    { id: 'cluster', name: '집속탄', desc: '12개의 자탄으로 분열', icon: 'cluster', mode: 'click', r: 9 },
    { id: 'arty', name: '포격', desc: '포탄 7발이 쏟아짐', icon: 'arty', mode: 'click', r: 12 },
    { id: 'air', name: '폭격기', desc: '보는 방향으로 융단폭격', icon: 'air', mode: 'click', r: 8, line: true },
    { id: 'napalm', name: '네이팜', desc: '불바다를 만든다', icon: 'napalm', mode: 'click', r: 9, line: true },
    { id: 'missile', name: '미사일', desc: '대형 폭발', icon: 'missile', mode: 'click', r: 7 },
    { id: 'nuke', name: '핵폭탄', desc: '낙하산 투하 후 섬광', icon: 'nuke', mode: 'click', r: 19 },
    { id: 'bh', name: '블랙홀', desc: '모든 것을 빨아들임', icon: 'bh', mode: 'click', r: 9 },
  ],
  terrain: [
    { id: 'raise', name: '흙 쌓기', desc: '드래그해서 언덕', icon: 'raise', mode: 'paint', brush: true },
    { id: 'dig', name: '파기', desc: '드래그해서 참호', icon: 'dig', mode: 'paint', brush: true },
    { id: 'wall', name: '콘크리트 벽', desc: '드래그로 벽 세우기', icon: 'wall', mode: 'line' },
    { id: 'sandbag', name: '모래주머니', desc: '드래그로 방어선', icon: 'sandbag', mode: 'line' },
    { id: 'tnt', name: 'TNT', desc: '총알·불에 터짐', icon: 'tnt', mode: 'click' },
    { id: 'sand', name: '모래 뿌리기', desc: '쌓이면서 흘러내림', icon: 'sand', mode: 'paint', brush: true },
    { id: 'tree', name: '나무 심기', desc: '불에 탄다', icon: 'tree', mode: 'click' },
    { id: 'house', name: '건물 짓기', desc: '무너뜨릴 수 있는 집', icon: 'house', mode: 'click' },
  ],
  tools: [
    { id: 'camera', name: '시점 이동', desc: '드래그로 회전', icon: 'move', mode: 'camera' },
    { id: 'grab', name: '잡아 던지기', desc: '유닛을 들어 던짐', icon: 'grab', mode: 'grab' },
    { id: 'follow', name: '관전', desc: '유닛을 따라가며 보기', icon: 'eye', mode: 'follow' },
    { id: 'remove', name: '유닛 제거', desc: '드래그해서 삭제', icon: 'trash', mode: 'paint', brush: true },
  ],
};
const TABS = [['units', '병력'], ['fire', '화력'], ['terrain', '지형'], ['tools', '도구']];
const ui = { tab: 'units', tool: TOOLSET.units[0], team: 0, count: 5, brush: 3, drawer: true, timeScale: 1, paused: false,
  gfx: 'high', auto: false, help: false };
let followUnit = null;

// ───────────── 카메라 ─────────────
const cam = { tx: SX / 2, ty: 16, tz: SZ / 2, yaw: -Math.PI * .78, pitch: .62, dist: 165,
  c: null };
function camInit() { cam.c = { tx: cam.tx, ty: cam.ty, tz: cam.tz, yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist }; }
function updateCamera(dt) {
  const k = 1 - Math.exp(-dt * 9);
  if (followUnit && (followUnit.dead && followUnit.deadT > 3)) followUnit = null;
  if (followUnit) {
    const u = followUnit;
    cam.tx = u.x; cam.tz = u.z; cam.ty = u.y + (u.type === 'tank' ? 3.5 : 2.6);
    if (!drag.active) cam.yaw += angDiff(cam.yaw, u.yaw + Math.PI) * Math.min(1, dt * 2.5);
  } else {
    cam.tx = Math.max(-20, Math.min(SX + 20, cam.tx)); cam.tz = Math.max(-20, Math.min(SZ + 20, cam.tz));
    const s = surfaceY(cam.tx, cam.tz);
    cam.ty += (Math.max(WATER_Y, s) - cam.ty) * Math.min(1, dt * 3);
  }
  cam.pitch = Math.max(.08, Math.min(1.5, cam.pitch));
  cam.dist = Math.max(6, Math.min(320, cam.dist));
  const c = cam.c;
  c.tx += (cam.tx - c.tx) * k; c.ty += (cam.ty - c.ty) * k; c.tz += (cam.tz - c.tz) * k;
  c.yaw += angDiff(c.yaw, cam.yaw) * k; c.pitch += (cam.pitch - c.pitch) * k; c.dist += (cam.dist - c.dist) * k;
  let px = c.tx + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist;
  let py = c.ty + Math.sin(c.pitch) * c.dist;
  let pz = c.tz + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist;
  // 카메라와 목표 사이를 지형이 가리면 앞으로 당김
  {
    const dx = px - c.tx, dy = py - c.ty, dz = pz - c.tz, dl = Math.hypot(dx, dy, dz) || 1;
    const h = raycast(c.tx, c.ty + .5, c.tz, dx / dl, dy / dl, dz / dl, dl);
    if (h && h.t > 1.5 && (followUnit || h.t < dl * .6)) {
      const k = Math.max(2.5, h.t - .8) / dl;
      px = c.tx + dx * k; py = c.ty + .5 + dy * k; pz = c.tz + dz * k;
    }
  }
  const gy = surfaceY(px, pz) + 1.5;
  if (px > 0 && px < SX && pz > 0 && pz < SZ && py < gy) py = gy;
  const sh = shakeAmt;
  camera.position.set(px + R(sh) * .6, py + R(sh) * .6, pz + R(sh) * .6);
  camera.lookAt(c.tx + R(sh) * .3, c.ty, c.tz + R(sh) * .3);
  shakeAmt *= Math.exp(-dt * 6);
  camera.updateMatrixWorld();
}

// ───────────── 피킹 ─────────────
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();
function screenRay(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect();
  _ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  _ray.setFromCamera(_ndc, camera);
  return _ray.ray;
}
function pickGround(cx, cy) {
  const ray = screenRay(cx, cy), o = ray.origin, d = ray.direction;
  const h = raycast(o.x, o.y, o.z, d.x, d.y, d.z, 900);
  if (h) return { x: o.x + d.x * h.t, y: o.y + d.y * h.t, z: o.z + d.z * h.t, vx: h.x, vy: h.y, vz: h.z, nx: h.nx, ny: h.ny, nz: h.nz };
  // 맵 밖이면 지면 평면과 교차
  if (d.y < -1e-3) {
    const t = (WATER_Y - o.y) / d.y;
    const x = o.x + d.x * t, z = o.z + d.z * t;
    if (x >= 0 && x < SX && z >= 0 && z < SZ) return { x, y: WATER_Y, z, vx: x | 0, vy: Math.floor(WATER_Y), vz: z | 0, nx: 0, ny: 1, nz: 0 };
  }
  return null;
}
function pickUnit(cx, cy) {
  const ray = screenRay(cx, cy), o = ray.origin, d = ray.direction;
  let best = null, bt = 1e9;
  for (const u of units) {
    if (u.dead) continue;
    const hw = u.type === 'tank' ? 2.6 : .8, hh = u.type === 'tank' ? 3.2 : 3;
    const t = segAABB(o.x, o.y, o.z, d.x * 900, d.y * 900, d.z * 900, u.x - hw, u.y - .3, u.z - hw, u.x + hw, u.y + hh, u.z + hw);
    if (t >= 0 && t < bt) { bt = t; best = u; }
  }
  return best;
}

// ───────────── 입력 ─────────────
const pointers = new Map();
const drag = { active: false, mode: null, x: 0, y: 0, sx: 0, sy: 0, start: null, last: null, lastPaint: null, moved: 0, pinch: 0, cx: 0, cy: 0, held: null, hist: [], touchT: 0 };
let hover = null;
function bindInput() {
  const el = renderer.domElement;
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => {
    initAudio();
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (pointers.size === 2) {
      // 두 손가락: 진행 중인 도구 동작 취소하고 화면 조작
      cancelToolDrag();
      const [a, b] = [...pointers.values()];
      drag.active = true; drag.mode = 'pinch';
      drag.pinch = Math.hypot(a.x - b.x, a.y - b.y); drag.cx = (a.x + b.x) / 2; drag.cy = (a.y + b.y) / 2;
      drag.ang = Math.atan2(b.y - a.y, b.x - a.x);
      return;
    }
    if (pointers.size > 2) return;
    drag.x = drag.sx = e.clientX; drag.y = drag.sy = e.clientY; drag.moved = 0; drag.hist = [];
    if (e.button === 2 || (e.button === 0 && ui.tool.mode === 'camera' && !e.shiftKey)) { drag.active = true; drag.mode = 'orbit'; return; }
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) { drag.active = true; drag.mode = 'pan'; return; }
    if (e.button !== 0) return;
    if (e.pointerType === 'touch') {
      // 두 번째 손가락을 잠깐 기다린 뒤 도구 시작
      drag.active = true; drag.mode = 'pendingTouch'; drag.touchT = performance.now();
      return;
    }
    startTool(e.clientX, e.clientY);
  });
  el.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (p) { p.x = e.clientX; p.y = e.clientY; }
    hover = { x: e.clientX, y: e.clientY };
    if (!drag.active) return;
    if (drag.mode === 'pinch') {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, ang = Math.atan2(b.y - a.y, b.x - a.x);
      cam.dist *= drag.pinch / Math.max(20, d);
      panBy(cx - drag.cx, cy - drag.cy);
      cam.yaw -= angDiff(drag.ang, ang);
      drag.pinch = Math.max(20, d); drag.cx = cx; drag.cy = cy; drag.ang = ang;
      return;
    }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    drag.x = e.clientX; drag.y = e.clientY;
    drag.hist.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (drag.hist.length > 6) drag.hist.shift();
    if (drag.mode === 'pendingTouch') {
      if (drag.moved > 8 || performance.now() - drag.touchT > 140) { startTool(drag.sx, drag.sy); }
      return;
    }
    if (drag.mode === 'orbit') { cam.yaw -= dx * .006; cam.pitch += dy * .005; if (followUnit) followUnit = null, toastFollow(); }
    else if (drag.mode === 'pan') panBy(dx, dy);
    else toolMove(e.clientX, e.clientY);
  });
  const up = e => {
    pointers.delete(e.pointerId);
    if (drag.mode === 'pinch') { if (pointers.size === 0) drag.active = false; return; }
    if (!drag.active) return;
    if (drag.mode === 'pendingTouch') startTool(drag.sx, drag.sy);
    if (drag.mode === 'tool') toolUp(e.clientX, e.clientY);
    drag.active = false; drag.mode = null;
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', () => { hover = null; });
  el.addEventListener('wheel', e => {
    e.preventDefault();
    const f = Math.exp(e.deltaY * .0011);
    const old = cam.dist;
    cam.dist *= f;
    if (f < 1 && !followUnit) {
      const h = pickGround(e.clientX, e.clientY);
      if (h) { const k = (1 - Math.max(6, Math.min(320, cam.dist)) / old) * .9; cam.tx += (h.x - cam.tx) * k; cam.tz += (h.z - cam.tz) * k; }
    }
  }, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
}
const keys = new Set();
function onKey(e) {
  if (e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  switch (e.code) {
    case 'Space': togglePause(); e.preventDefault(); break;
    case 'KeyB': case 'Tab': setDrawer(!ui.drawer); e.preventDefault(); break;
    case 'KeyF': toggleFullscreen(); break;
    case 'KeyH': toggleHelp(); break;
    case 'Enter': if (phase === 'setup') startBattle(); break;
    case 'Escape':
      if (ui.help) toggleHelp(); else if (followUnit) { followUnit = null; toastFollow(); } else if (ui.drawer) setDrawer(false);
      break;
    case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': setTab(TABS[+e.code.slice(5) - 1][0]); break;
    case 'KeyT': setTeam(1 - ui.team); break;
  }
}
function updateKeys(dt) {
  const sp = cam.dist * .9 * dt;
  let fx = 0, fz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) fz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) fz += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) fx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) fx += 1;
  if (fx || fz) {
    if (followUnit) { followUnit = null; toastFollow(); }
    const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
    cam.tx += (fx * c + fz * s) * sp; cam.tz += (-fx * s + fz * c) * sp;
  }
  if (keys.has('KeyQ')) cam.yaw += dt * 1.6;
  if (keys.has('KeyE')) cam.yaw -= dt * 1.6;
  if (keys.has('KeyZ')) cam.dist *= 1 - dt * 1.2;
  if (keys.has('KeyX')) cam.dist *= 1 + dt * 1.2;
}
function panBy(dx, dy) {
  if (followUnit) { followUnit = null; toastFollow(); }
  const k = cam.dist * .0016;
  const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
  cam.tx += (-dx * c - dy * s) * k;
  cam.tz += (dx * s - dy * c) * k;
}

// ───────────── 도구 동작 ─────────────
function startTool(cx, cy) {
  drag.active = true; drag.mode = 'tool';
  const t = ui.tool;
  const h = pickGround(cx, cy);
  drag.start = h; drag.last = h; drag.lastPaint = null;
  if (t.mode === 'grab') {
    const u = pickUnit(cx, cy);
    if (u) { drag.held = u; u.held = true; u.stun = 99; u.tiltV = 0; drag.ghist = []; drag.grabY = u.y + 5; sfxUI('place'); }
    return;
  }
  if (t.mode === 'follow') {
    const u = pickUnit(cx, cy);
    if (u) { followUnit = u; cam.dist = u.type === 'tank' ? 22 : 13; cam.pitch = .28; toast(`${TEAM[u.team].name} ${UT[u.type].name} 관전 중 · 화면을 끌거나 Esc로 종료`); }
    drag.active = false; return;
  }
  if (!h) return;
  if (t.unit) { placeUnits(h, true); return; }
  if (t.mode === 'paint') { paintAt(h); drag.lastPaint = h; return; }
  if (t.mode === 'click') { if (!t.line) { useWeapon(t.id, h); drag.active = false; } return; }
}
function cancelToolDrag() {
  if (drag.held) { drag.held.held = false; drag.held.stun = 1; drag.held = null; }
  drag.start = null;
}
function toolMove(cx, cy) {
  const t = ui.tool;
  if (drag.held) {
    const u = drag.held, ray = screenRay(cx, cy);
    const ty = Math.max(surfaceY(u.x, u.z) + 3, drag.grabY);
    if (Math.abs(ray.direction.y) > 1e-3) {
      const k = (ty - ray.origin.y) / ray.direction.y;
      if (k > 0) {
        const nx = Math.max(2, Math.min(SX - 2, ray.origin.x + ray.direction.x * k)), nz = Math.max(2, Math.min(SZ - 2, ray.origin.z + ray.direction.z * k));
        drag.ghist.push({ x: nx, y: ty, z: nz, t: performance.now() });
        if (drag.ghist.length > 6) drag.ghist.shift();
      }
    }
    return;
  }
  const h = pickGround(cx, cy);
  if (!h) return;
  drag.last = h;
  if (t.unit && ui.count === 1 && drag.start) {
    const lp = drag.lastPaint || drag.start;
    if (Math.hypot(h.x - lp.x, h.z - lp.z) > (t.unit === 'tank' ? 6.5 : 1.7)) { placeUnits(h, false); drag.lastPaint = h; }
  } else if (t.mode === 'paint') {
    const lp = drag.lastPaint;
    if (!lp || Math.hypot(h.x - lp.x, h.z - lp.z) > Math.max(.8, ui.brush * .5) || t.id === 'raise' || t.id === 'sand') { paintAt(h); drag.lastPaint = h; }
  }
}
function toolUp(cx, cy) {
  const t = ui.tool;
  if (drag.held) {
    const u = drag.held, h = drag.ghist || [];
    u.held = false;
    if (h.length >= 2) {
      const a = h[0], b = h[h.length - 1], dt = Math.max(.016, (b.t - a.t) / 1000);
      u.vx = Math.max(-45, Math.min(45, (b.x - a.x) / dt * 1.5)); u.vz = Math.max(-45, Math.min(45, (b.z - a.z) / dt * 1.5));
      u.vy = 4 + Math.min(10, Math.hypot(u.vx, u.vz) * .15);
    }
    u.stun = u.type === 'tank' ? 0 : 1.6; u.tiltV = 8 * (Math.random() < .5 ? 1 : -1); u.fallYaw = Math.atan2(u.vx, u.vz);
    if (u.type === 'tank') u.tilt = 0;
    drag.held = null;
    return;
  }
  if (t.mode === 'line' && drag.start && drag.last) buildLine(t.id, drag.start, drag.last);
  if (t.mode === 'click' && t.line && drag.start) {
    const a = drag.start, b = drag.last || a;
    const yaw = Math.hypot(b.x - a.x, b.z - a.z) > 4 ? Math.atan2(b.x - a.x, b.z - a.z) : cam.c.yaw + Math.PI;
    useWeapon(t.id, a, yaw);
  }
}
function updateHeld(dt) {
  const u = drag.held;
  if (!u) return;
  const p = drag.ghist && drag.ghist[drag.ghist.length - 1];
  if (!p) { u.vx = u.vz = 0; u.vy = Math.max(u.vy, 0); return; }
  // 스프링으로 따라감
  u.vx = (p.x - u.x) * 14; u.vz = (p.z - u.z) * 14; u.vy = (p.y - u.y) * 14 + GRAV * dt;
  u.stun = 99;
  u.tilt = Math.sin(performance.now() * .006) * .25; u.fallYaw = u.yaw;
}
function placeUnits(h, formation) {
  const t = ui.tool.unit, n = formation ? ui.count : 1;
  const tank = t === 'tank';
  const yaw = ui.team === 0 ? Math.PI / 2 : -Math.PI / 2;
  const cols = Math.ceil(Math.sqrt(n)), sp = tank ? 6.5 : 1.7;
  // 적 방향을 앞으로 하는 대형
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = fz, rz = -fx;
  let placed = 0;
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const ox = (c - (cols - 1) / 2) * sp, oz = -r * sp;
    const x = h.x + rx * ox + fx * oz + R(.3), z = h.z + rz * ox + fz * oz + R(.3);
    if (x < 2 || x > SX - 2 || z < 2 || z > SZ - 2) continue;
    if (units.length > 900) break;
    const u = spawnUnit(t, ui.team, x, z, yaw);
    u.y = Math.max(u.y, surfaceY(x, z));
    placed++;
    if (placed < 6) dustBurst(x, u.y, z, .8, 2);
  }
  if (placed) sfxUI('place');
}
function paintAt(h) {
  const t = ui.tool, r = ui.brush;
  if (t.id === 'remove') {
    for (const u of units) if (Math.hypot(u.x - h.x, u.z - h.z) < r + 1) u.removed = true;
    units = units.filter(u => !u.removed);
    if (followUnit && followUnit.removed) followUnit = null;
    return;
  }
  if (t.id === 'dig') {
    const cx = Math.floor(h.x), cy = Math.floor(h.y), cz = Math.floor(h.z), R2 = r + .5;
    for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy + dz * dz > R2 * R2) continue;
      const X = cx + dx, Y = cy + dy, Z = cz + dz;
      if (Y < 1) continue;
      const v = getV(X, Y, Z);
      if (!v || v === M.BEDROCK) continue;
      setVox(X, Y, Z, 0);
      if (Math.random() < .04) spawnDebrisVoxel(X, Y, Z, v, R(3), 3, R(3));
    }
    queueCollapseCheck(cx, cy, cz, r + 1);
    if (Math.random() < .5) dustBurst(h.x, h.y, h.z, r, 3);
    return;
  }
  if (t.id === 'raise') {
    if (drag.raiseT && performance.now() - drag.raiseT < 70) return;
    drag.raiseT = performance.now();
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const d = Math.hypot(dx, dz);
      if (d > r + .3) continue;
      const X = Math.floor(h.x) + dx, Z = Math.floor(h.z) + dz;
      if (X < 0 || X >= SX || Z < 0 || Z >= SZ) continue;
      if (d > r * .6 && Math.random() < .5) continue;
      const y = surfaceY(X, Z);
      if (y >= SY - 2) continue;
      const below = getV(X, y - 1, Z);
      if (below === M.GRASS) setVox(X, y - 1, Z, M.DIRT);
      setVox(X, y, Z, M.GRASS);
      liftUnitsAt(X, y, Z);
    }
    return;
  }
  if (t.id === 'sand') {
    for (let k = 0; k < r * r * 2 + 2; k++) {
      const X = Math.floor(h.x + R(r * 2)), Z = Math.floor(h.z + R(r * 2)), Y = Math.min(SY - 1, Math.floor(h.y) + 6 + ((Math.random() * 4) | 0));
      if (!getV(X, Y, Z)) setVox(X, Y, Z, M.SAND);
    }
  }
}
function liftUnitsAt(x, y, z) {
  for (const u of units) if (Math.abs(u.x - x - .5) < u.hw + .5 && Math.abs(u.z - z - .5) < u.hw + .5 && u.y <= y + 1 && u.y > y - 3) u.y = y + 1;
}
function buildLine(id, a, b) {
  const x0 = Math.floor(a.x), z0 = Math.floor(a.z), x1 = Math.floor(b.x), z1 = Math.floor(b.z);
  const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0), 1);
  const H = id === 'wall' ? 5 : 2, mat = id === 'wall' ? M.CONCRETE : M.SANDBAG;
  const seen = new Set();
  for (let s = 0; s <= n; s++) {
    const x = Math.round(x0 + (x1 - x0) * s / n), z = Math.round(z0 + (z1 - z0) * s / n);
    const cells = id === 'sandbag' ? [[0, 0], [1, 0], [0, 1]] : [[0, 0]];
    for (const [ox, oz] of cells) {
      const X = x + ox, Z = z + oz, key = X * 1000 + Z;
      if (seen.has(key) || X < 0 || X >= SX || Z < 0 || Z >= SZ) continue;
      seen.add(key);
      const base = surfaceY(X, Z);
      for (let y = base; y < base + H && y < SY; y++) setVox(X, y, Z, mat);
      liftUnitsAt(X, base + H - 1, Z);
    }
  }
  dustBurst((a.x + b.x) / 2, Math.max(a.y, b.y), (a.z + b.z) / 2, 3, 8);
  sfxUI('place');
}
function markBoxDirty(x0, y0, z0, x1, y1, z1) {
  for (let y = Math.max(0, y0); y <= Math.min(SY - 1, y1); y += 4) for (let z = Math.max(0, z0); z <= Math.min(SZ - 1, z1); z += 4) for (let x = Math.max(0, x0); x <= Math.min(SX - 1, x1); x += 4) markDirty(x, y, z);
  for (const [x, y, z] of [[x1, y1, z1], [x0, y1, z1], [x1, y0, z1], [x1, y1, z0]]) markDirty(Math.max(0, Math.min(SX - 1, x)), Math.max(0, Math.min(SY - 1, y)), Math.max(0, Math.min(SZ - 1, z)));
}
function useWeapon(id, h, yaw) {
  const x = h.x, y = h.y, z = h.z;
  switch (id) {
    case 'grenade': throwFromCamera('grenade', x, y, z); break;
    case 'cluster': throwFromCamera('cluster', x, y + 6, z); break;
    case 'arty': callArtillery(x, z); toast('포격 요청: 곧 포탄이 떨어집니다'); break;
    case 'air': callAirstrike(x, z, yaw); toast('폭격기 진입 중'); break;
    case 'napalm': callNapalm(x, z, yaw); toast('네이팜 폭격기 진입 중'); break;
    case 'missile': callMissile(x, y, z); break;
    case 'nuke': callNuke(x, z); toast('핵폭탄 투하. 멀리서 보세요'); break;
    case 'bh': spawnBlackhole(x, y, z); break;
    case 'tnt': {
      const bx = h.vx + h.nx, by = h.vy + h.ny, bz = h.vz + h.nz;
      for (let dy = 0; dy < 3; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) setVox(bx + dx, by + dy, bz + dz, M.TNT);
      sfxUI('place'); break;
    }
    case 'tree': {
      const X = Math.floor(x), Z = Math.floor(z), Y = surfaceY(X, Z);
      buildTree(X, Y, Z); markBoxDirty(X - 4, Y - 1, Z - 4, X + 4, Y + 13, Z + 4); sfxUI('place'); break;
    }
    case 'house': {
      const X = Math.floor(x), Z = Math.floor(z);
      buildHouse(X, Z, 11, 11, Math.random);
      markBoxDirty(X - 8, surfaceY(X, Z) - 6, Z - 8, X + 8, SY - 1, Z + 8);
      for (const u of units) if (Math.abs(u.x - X) < 7 && Math.abs(u.z - Z) < 7) { for (let k = 0; k < 30 && boxHits(u.x, u.y, u.z, u.hw, u.h); k++) u.y++; }
      dustBurst(X, surfaceY(X, Z), Z, 6, 14); sfxUI('place'); break;
    }
  }
}

// ───────────── 미리보기 (커서 고리, 선) ─────────────
let ringMesh, lineMesh;
function initPreview() {
  const g = new THREE.RingGeometry(.86, 1, 64); g.rotateX(-Math.PI / 2);
  ringMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .75, depthTest: false, depthWrite: false }));
  ringMesh.renderOrder = 10; scene.add(ringMesh);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  lineMesh = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, depthTest: false }));
  lineMesh.renderOrder = 10; scene.add(lineMesh);
}
const TEAMHEX = [0xff6a5a, 0x6aa8ff];
function updatePreview() {
  ringMesh.visible = false; lineMesh.visible = false;
  if (!hover || (drag.active && (drag.mode === 'orbit' || drag.mode === 'pan' || drag.mode === 'pinch'))) return;
  const t = ui.tool;
  if (t.mode === 'camera' || t.mode === 'follow' || t.mode === 'grab') return;
  const h = drag.active && drag.mode === 'tool' && drag.last ? drag.last : pickGround(hover.x, hover.y);
  if (!h) return;
  let r = 1, col = 0xffffff;
  if (t.unit) { const n = ui.count, sp = t.unit === 'tank' ? 6.5 : 1.7; r = Math.max(1.2, Math.ceil(Math.sqrt(n)) * sp * .6); col = TEAMHEX[ui.team]; }
  else if (t.brush) { r = ui.brush + .5; col = t.id === 'remove' ? 0xff5040 : 0xffe0a0; }
  else if (t.r) { r = t.r; col = 0xff7050; }
  else if (t.mode === 'line') { r = 1; col = 0xffd27a; }
  ringMesh.visible = true;
  ringMesh.position.set(h.x, h.y + .15, h.z);
  ringMesh.scale.setScalar(r);
  ringMesh.material.color.setHex(col);
  if ((t.mode === 'line' || t.line) && drag.active && drag.mode === 'tool' && drag.start) {
    const a = lineMesh.geometry.attributes.position.array, s = drag.start;
    a[0] = s.x; a[1] = s.y + .3; a[2] = s.z; a[3] = h.x; a[4] = h.y + .3; a[5] = h.z;
    lineMesh.geometry.attributes.position.needsUpdate = true;
    lineMesh.geometry.computeBoundingSphere();
    lineMesh.visible = true;
  }
}

// ───────────── 오버레이: 체력바 ─────────────
let octx, ocv;
function drawOverlay() {
  const w = ocv.width, h = ocv.height, dpr = ocv.width / ocv.clientWidth;
  octx.clearRect(0, 0, w, h);
  const v = new THREE.Vector3();
  for (const u of units) {
    if (u.dead) continue;
    const tank = u.type === 'tank';
    if (u.hp >= u.maxhp && !(tank && phase !== 'setup')) continue;
    const d = Math.hypot(camera.position.x - u.x, camera.position.y - u.y, camera.position.z - u.z);
    if (d > (tank ? 220 : 120)) continue;
    v.set(u.x, u.y + (tank ? 4.2 : 3.2), u.z).project(camera);
    if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) continue;
    const sx = (v.x + 1) / 2 * w, sy = (1 - v.y) / 2 * h;
    const bw = (tank ? 46 : 26) * dpr * Math.max(.5, Math.min(1.2, 60 / d)), bh = Math.max(2, 3.5 * dpr * Math.max(.6, Math.min(1, 60 / d)));
    const f = Math.max(0, u.hp / u.maxhp);
    octx.fillStyle = 'rgba(10,12,10,.75)';
    octx.fillRect(sx - bw / 2 - 1, sy - 1, bw + 2, bh + 2);
    octx.fillStyle = f > .5 ? (u.team ? '#6aa8ff' : '#ff6a5a') : f > .25 ? '#f2c14e' : '#ff3b30';
    octx.fillRect(sx - bw / 2, sy, bw * f, bh);
  }
}

// ───────────── HUD / 상태 ─────────────
function buildUI() {
  // 탭
  const tabs = $('tabs');
  tabs.innerHTML = '';
  for (const [id, name] of TABS) {
    const b = document.createElement('button');
    b.className = 'tab'; b.id = 'tab-' + id; b.textContent = name; b.setAttribute('role', 'tab');
    b.onclick = () => setTab(id);
    tabs.appendChild(b);
  }
  $('teamRed').onclick = () => setTeam(0);
  $('teamBlue').onclick = () => setTeam(1);
  $('drawerTab').onclick = () => setDrawer(!ui.drawer);
  $('drawerClose').onclick = () => setDrawer(false);
  $('count').oninput = e => { ui.count = +e.target.value; $('countV').textContent = ui.count; };
  $('brush').oninput = e => { ui.brush = +e.target.value; $('brushV').textContent = ui.brush; };
  $('btnStart').onclick = startBattle;
  $('btnPause').onclick = togglePause;
  for (const s of [.35, 1, 2]) $('spd' + String(s).replace('.', '')).onclick = () => { ui.timeScale = s; ui.paused = false; refreshHUD(); };
  $('btnReset').onclick = resetToSetup;
  $('btnFull').onclick = toggleFullscreen;
  $('btnSound').onclick = () => { initAudio(); setMuted(!AU.muted); refreshHUD(); };
  $('btnGfx').onclick = () => { setGfx(ui.gfx === 'high' ? 'low' : 'high'); };
  $('btnHelp').onclick = toggleHelp;
  $('helpClose').onclick = toggleHelp;
  $('btnArmy').onclick = () => { clearUnits(); placeDefaultArmies(); toast('기본 군대를 배치했습니다'); };
  $('btnClear').onclick = () => { clearUnits(); toast('모든 병력을 제거했습니다'); };
  $('btnMap').onclick = newMap;
  $('btnAuto').onclick = () => { ui.auto = !ui.auto; refreshHUD(); toast(ui.auto ? '자동 증원 켜짐: 양측에 계속 병력이 투입됩니다' : '자동 증원 꺼짐'); };
  $('bAgain').onclick = () => { hideBanner(); resetToSetup(); };
  $('bWatch').onclick = hideBanner;
  $('bNew').onclick = () => { hideBanner(); newMap(); };
  document.addEventListener('fullscreenchange', refreshHUD);
  document.addEventListener('webkitfullscreenchange', refreshHUD);
  setTab('units');
  setTeam(0);
  refreshHUD();
}
function setTab(id) {
  ui.tab = id;
  for (const [t] of TABS) $('tab-' + t).classList.toggle('on', t === id);
  const list = TOOLSET[id];
  if (!list.includes(ui.tool)) ui.tool = list[0];
  renderCards();
  $('cards').scrollTop = 0;
  $('optCount').hidden = id !== 'units';
  $('optBrush').hidden = !(id === 'terrain' || id === 'tools');
}
function renderCards() {
  const box = $('cards');
  box.innerHTML = '';
  for (const t of TOOLSET[ui.tab]) {
    const b = document.createElement('button');
    b.className = 'card' + (t === ui.tool ? ' on' : '') + (t.unit ? ' unit' : '');
    b.id = 'card-' + t.id;
    const pic = t.unit ? `<img alt="" src="${thumbs[ui.team + ':' + t.unit] || ''}">` : svg(t.icon, 'cic');
    b.innerHTML = `<span class="pic">${pic}</span><span class="nm">${t.name}</span><span class="ds">${t.desc}</span>`;
    b.onclick = () => { ui.tool = t; renderCards(); hint(); sfxUI('tap'); if (matchMedia('(max-width: 720px)').matches) setDrawer(false); };
    box.appendChild(b);
  }
  hint();
}
function setTeam(t) {
  ui.team = t;
  $('teamRed').classList.toggle('on', t === 0);
  $('teamBlue').classList.toggle('on', t === 1);
  document.body.dataset.team = t;
  if (ui.tab === 'units') renderCards();
}
function setDrawer(open) {
  ui.drawer = open;
  $('drawer').classList.toggle('open', open);
  $('drawerTab').setAttribute('aria-expanded', open);
}
function hint() {
  const t = ui.tool;
  let s;
  if (t.unit) s = `클릭해서 ${UT[t.unit].name} ${ui.count}명 배치${ui.count === 1 ? ' · 드래그하면 줄지어 배치' : ''}`;
  else if (t.mode === 'line') s = '드래그해서 시작점과 끝점 지정';
  else if (t.line) s = '클릭하면 보는 방향으로 진입 · 드래그로 방향 지정';
  else if (t.mode === 'paint') s = '드래그해서 칠하기 · 붓 크기는 병기고에서';
  else if (t.mode === 'camera') s = '드래그로 회전 · 휠로 확대 · Shift+드래그로 이동';
  else if (t.mode === 'grab') s = '유닛을 잡고 휘둘러 던지기';
  else if (t.mode === 'follow') s = '따라갈 유닛을 클릭';
  else s = '목표 지점을 클릭';
  $('hint').innerHTML = `<b>${t.name}</b> ${s}<span class="keys"> · 우클릭 회전 · 휠 확대 · WASD 이동</span>`;
  $('dtabTool').textContent = t.name;
}
let toastT = 0;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg; el.classList.add('show');
  toastT = 2.6;
}
function toastFollow() { toast('관전을 종료했습니다'); }
function togglePause() { ui.paused = !ui.paused; refreshHUD(); }
function toggleHelp() { ui.help = !ui.help; $('help').hidden = !ui.help; }
function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
function toggleFullscreen() {
  const el = document.documentElement;
  if (isFull()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) { toast('이 브라우저는 전체 화면을 지원하지 않습니다'); return; }
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.catch) p.catch(() => toast('전체 화면이 차단됐습니다. 페이지를 새 탭에서 열거나 F11을 눌러 주세요'));
  } catch (e) { toast('전체 화면이 차단됐습니다. 페이지를 새 탭에서 열거나 F11을 눌러 주세요'); }
}
function refreshHUD() {
  $('btnFull').innerHTML = svg(isFull() ? 'unfull' : 'full');
  $('btnFull').title = isFull() ? '전체 화면 끝내기 (F)' : '전체 화면 (F)';
  $('btnSound').innerHTML = svg(AU.muted ? 'mute' : 'sound');
  $('btnGfx').classList.toggle('on', ui.gfx === 'high');
  $('btnGfx').title = ui.gfx === 'high' ? '그래픽: 높음 (그림자 켜짐)' : '그래픽: 낮음 (그림자 꺼짐)';
  $('btnPause').innerHTML = svg(ui.paused ? 'play' : 'pause');
  $('btnPause').classList.toggle('on', ui.paused);
  for (const s of [.35, 1, 2]) $('spd' + String(s).replace('.', '')).classList.toggle('on', !ui.paused && ui.timeScale === s);
  $('btnAuto').classList.toggle('on', ui.auto);
  $('setupBar').hidden = phase !== 'setup';
  $('battleBar').hidden = phase === 'setup';
  $('phase').textContent = phase === 'setup' ? '배치 단계' : phase === 'battle' ? (ui.paused ? '일시정지' : '전투 중') : '전투 종료';
  $('phase').dataset.state = phase;
}
let hudT = 0, battleTime = 0;
function updateHUD(dt) {
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('show'); }
  hudT -= dt;
  if (hudT > 0) return;
  hudT = .2;
  let a = [0, 0];
  for (const u of units) if (!u.dead) a[u.team]++;
  $('rN').textContent = a[0]; $('bN').textContent = a[1];
  const tot = a[0] + a[1] || 1;
  $('barR').style.width = (a[0] / tot * 100) + '%';
  $('rK').textContent = stats.kills[0]; $('bK').textContent = stats.kills[1];
  $('rL').textContent = stats.lost[0]; $('bL').textContent = stats.lost[1];
  if (phase === 'battle') {
    const m = Math.floor(battleTime / 60), s = Math.floor(battleTime % 60);
    $('clock').textContent = `${m}:${String(s).padStart(2, '0')}`;
  } else $('clock').textContent = '';
  checkVictory(a);
}
let victoryT = -1;
function checkVictory(a) {
  if (phase !== 'battle' || ui.auto) { victoryT = -1; return; }
  if ((a[0] === 0) !== (a[1] === 0)) {
    if (victoryT < 0) victoryT = 1.6;
  } else if (a[0] === 0 && a[1] === 0 && units.length) { if (victoryT < 0) victoryT = 1.6; }
  else victoryT = -1;
}
function updateVictory(dt) {
  if (victoryT < 0) return;
  victoryT -= dt;
  if (victoryT > 0) return;
  victoryT = -1;
  let a = [0, 0];
  for (const u of units) if (!u.dead) a[u.team]++;
  const w = a[0] > 0 ? 0 : a[1] > 0 ? 1 : -1;
  phase = 'over';
  const b = $('banner');
  $('bTitle').textContent = w < 0 ? '무승부' : `${TEAM[w].name} 승리`;
  b.dataset.win = w;
  const m = Math.floor(battleTime / 60), s = Math.floor(battleTime % 60);
  $('bStats').innerHTML = `<div><span>전투 시간</span><b>${m}:${String(s).padStart(2, '0')}</b></div>` +
    `<div><span>레드 처치 / 손실</span><b>${stats.kills[0]} / ${stats.lost[0]}</b></div>` +
    `<div><span>블루 처치 / 손실</span><b>${stats.kills[1]} / ${stats.lost[1]}</b></div>` +
    (w >= 0 ? `<div><span>생존 병력</span><b>${a[w]}</b></div>` : '');
  b.hidden = false;
  sfxUI('win');
  refreshHUD();
}
function hideBanner() { $('banner').hidden = true; }

// ───────────── 유닛 썸네일 ─────────────
const thumbs = {};
function makeThumbs() {
  try {
    const S = 112;
    const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setSize(S, S); r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xdde8ff, 0x55483a, .9));
    const sun = new THREE.DirectionalLight(0xfff2dc, 1.6); sun.position.set(3, 6, 4); sc.add(sun);
    const cam2 = new THREE.PerspectiveCamera(30, 1, .1, 100);
    const saved = boxMesh;
    const tmp = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), 200);
    tmp.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(600), 3);
    sc.add(tmp);
    boxMesh = tmp;
    for (const team of [0, 1]) for (const type of Object.keys(UT)) {
      const tank = type === 'tank';
      const u = { type, team, x: 0, y: 0, z: 0, yaw: .55, tilt: 0, ryo: 0, flash: 0, moving: false, walk: 0, dead: false, stun: 0,
        shooting: false, aimPitch: 0, skin: 0, turret: .2, barrel: .06, recoil: 0, deadT: 0, fallYaw: 0 };
      boxN = 0;
      if (tank) drawTank(u); else drawSoldier(u);
      tmp.count = boxN; tmp.instanceMatrix.needsUpdate = true; tmp.instanceColor.needsUpdate = true;
      if (tank) { cam2.position.set(7.6, 5.2, 9.2); cam2.lookAt(0, 1.5, .3); }
      else { cam2.position.set(2.5, 2.1, 3.6); cam2.lookAt(0, 1.3, 0); }
      r.render(sc, cam2);
      thumbs[team + ':' + type] = r.domElement.toDataURL();
    }
    boxMesh = saved;
    tmp.geometry.dispose(); r.dispose(); r.forceContextLoss && r.forceContextLoss();
  } catch (e) { console.warn('thumb', e); }
}
