'use strict';
// ─────────────────────────────────────────────────────────────
//  카메라와 입력
//  · 클릭 = 도구 사용, 드래그 = 시점 이동 (붓/선/잡기 도구는 드래그로 그림)
//  · 우클릭/Alt + 드래그 = 회전, 휠 = 커서 기준 확대
//  · 터치: 한 손가락 이동, 두 손가락 확대·회전, 두 손가락 위아래 = 기울기
// ─────────────────────────────────────────────────────────────
const CAMR = { minD: 8, maxD: 300, minP: .2, maxP: 1.45, fMinD: 4, fMaxD: 60, fMinP: .04 };
const VIEW0 = { yaw: -Math.PI * .78, pitch: .62, dist: 165 };
const cam = { tx: SX / 2, ty: 16, tz: SZ / 2, yaw: VIEW0.yaw, pitch: VIEW0.pitch, dist: VIEW0.dist,
  c: null, lift: 0, eff: 0, boost: 0, lastRot: -1e9 };
let followUnit = null;

// 카메라 회전 중심용 높이: 나무·건물을 무시하고 흐리게 만든 지형 높이
const camH = new Float32Array(SX * SZ);
function rebuildCamHeight() {
  const tmp = new Float32Array(SX * SZ), r = 6, n = r * 2 + 1;
  for (let z = 0; z < SZ; z++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += heightMap[z * SX + Math.max(0, Math.min(SX - 1, k))];
    for (let x = 0; x < SX; x++) {
      tmp[z * SX + x] = s / n;
      s += heightMap[z * SX + Math.min(SX - 1, x + r + 1)] - heightMap[z * SX + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < SX; x++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += tmp[Math.max(0, Math.min(SZ - 1, k)) * SX + x];
    for (let z = 0; z < SZ; z++) {
      camH[z * SX + x] = Math.max(WATER_Y, s / n);
      s += tmp[Math.min(SZ - 1, z + r + 1) * SX + x] - tmp[Math.max(0, z - r) * SX + x];
    }
  }
}
function groundAt(x, z) {
  x = Math.max(0, Math.min(SX - 1.001, x)); z = Math.max(0, Math.min(SZ - 1.001, z));
  const x0 = Math.floor(x), z0 = Math.floor(z), fx = x - x0, fz = z - z0;
  const a = camH[z0 * SX + x0], b = camH[z0 * SX + x0 + 1], c = camH[(z0 + 1) * SX + x0], d = camH[(z0 + 1) * SX + x0 + 1];
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
}
function camInit() {
  cam.ty = groundAt(cam.tx, cam.tz);
  cam.c = { tx: cam.tx, ty: cam.ty, tz: cam.tz, yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist };
  cam.eff = cam.dist; cam.lift = 0; cam.boost = 0;
}
function camReset(instant) {
  stopFollow(true);
  cam.tx = SX / 2; cam.tz = SZ / 2; cam.ty = groundAt(cam.tx, cam.tz);
  cam.yaw = VIEW0.yaw; cam.pitch = VIEW0.pitch; cam.dist = window.innerWidth < 720 ? 210 : VIEW0.dist;
  if (instant) camInit();
}
function camFocus(x, z, dist) {
  stopFollow(true);
  cam.tx = x; cam.tz = z;
  if (dist) cam.dist = dist;
}
function syncCam() {
  const c = cam.c;
  c.tx = cam.tx; c.tz = cam.tz; c.yaw = cam.yaw; c.pitch = cam.pitch; c.dist = cam.dist;
  cam.eff = Math.min(cam.eff, c.dist);
  applyCamera(0);
}
function clampCam() {
  const f = !!followUnit;
  cam.pitch = Math.max(f ? CAMR.fMinP : CAMR.minP, Math.min(CAMR.maxP, cam.pitch));
  cam.dist = Math.max(f ? CAMR.fMinD : CAMR.minD, Math.min(f ? CAMR.fMaxD : CAMR.maxD, cam.dist));
  if (!f) { cam.tx = Math.max(6, Math.min(SX - 6, cam.tx)); cam.tz = Math.max(6, Math.min(SZ - 6, cam.tz)); }
}

// ───────────── 관전 ─────────────
function startFollow(u) {
  followUnit = u;
  cam.dist = u.type === 'tank' ? 24 : u.type === 'heli' ? 26 : u.type === 'dog' ? 9 : 14;
  cam.pitch = .3;
  cam.yaw = u.yaw + Math.PI;
  cam.lastRot = -1e9;
  $('followName').textContent = `${TEAM[u.team].name} ${UT[u.type].name}`;
  $('followChip').dataset.team = u.team;
  $('followChip').hidden = false;
}
function stopFollow(silent) {
  if (!followUnit) return;
  followUnit = null;
  $('followChip').hidden = true;
  cam.ty = groundAt(cam.tx, cam.tz);
  if (cam.dist < 40) cam.dist = 55;
  if (cam.pitch < .35) cam.pitch = .45;
}

// ───────────── 매 프레임 ─────────────
const _cd = new THREE.Vector3();
function updateCamera(dt) {
  const u = followUnit;
  if (u && (u.removed || (u.dead && u.deadT > 3))) stopFollow(true);
  if (followUnit) {
    cam.tx = u.x; cam.tz = u.z; cam.ty = u.y + u.ryo + u.h * .8;
    // 사용자가 한동안 돌리지 않았고 유닛이 움직이면 뒤쪽으로 천천히 돌아감
    const sp = Math.hypot(u.vx, u.vz);
    if (!u.dead && sp > 1.2 && performance.now() - cam.lastRot > 2500) {
      const want = Math.atan2(-u.vx, -u.vz);
      cam.yaw += Math.max(-1, Math.min(1, angDiff(cam.yaw, want))) * Math.min(1, dt * 1.1);
    }
  } else if (!drag.panning) cam.ty = groundAt(cam.tx, cam.tz);
  clampCam();
  const c = cam.c;
  const kp = 1 - Math.exp(-dt * (followUnit ? 10 : 12)), kh = 1 - Math.exp(-dt * (followUnit ? 10 : 4));
  const kr = 1 - Math.exp(-dt * 16), kd = 1 - Math.exp(-dt * 10);
  c.tx += (cam.tx - c.tx) * kp; c.tz += (cam.tz - c.tz) * kp; c.ty += (cam.ty - c.ty) * kh;
  c.yaw += angDiff(c.yaw, cam.yaw) * kr; c.pitch += (cam.pitch - c.pitch) * kr;
  c.dist += (cam.dist - c.dist) * kd;
  applyCamera(dt);
  shakeAmt *= Math.exp(-dt * 6);
  updateCompass();
}
function applyCamera(dt) {
  const c = cam.c;
  const cp = Math.cos(c.pitch);
  _cd.set(Math.sin(c.yaw) * cp, Math.sin(c.pitch), Math.cos(c.yaw) * cp);
  let d = c.dist;
  if (followUnit) {
    // 관전 중 벽이 가리면 부드럽게 다가감 (빨리 다가가고 천천히 물러남)
    const h = raycast(c.tx, c.ty, c.tz, _cd.x, _cd.y, _cd.z, d);
    const want = h ? Math.max(2, h.t - .6) : d;
    cam.eff = want < cam.eff ? want : cam.eff + (want - cam.eff) * Math.min(1, dt * 2.5);
    d = Math.min(d, cam.eff);
  } else cam.eff = d;
  const px = c.tx + _cd.x * d, pz = c.tz + _cd.z * d;
  let py = c.ty + _cd.y * d;
  // 지면·나무 위로 띄우기 (갑자기 튀지 않게 부드럽게)
  let ground = -1e9;
  if (px > -1 && px < SX + 1 && pz > -1 && pz < SZ + 1)
    for (const [ox, oz] of [[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]]) ground = Math.max(ground, surfaceY(px + ox, pz + oz));
  const need = Math.max(0, ground + 1.6 - py);
  if (dt === 0) cam.lift = Math.max(cam.lift, need);
  else cam.lift += (need - cam.lift) * Math.min(1, dt * (need > cam.lift ? 18 : 3));
  py += cam.lift;
  // 흔들림: 매 프레임 무작위로 튀지 않도록 부드러운 진동으로
  const sh = shakeAmt * .32, t = performance.now() * .001;
  const ox = (Math.sin(t * 29) + Math.sin(t * 13.7)) * sh, oy = (Math.sin(t * 31.3) + Math.sin(t * 17.1)) * sh * .7, oz = (Math.sin(t * 23.9) + Math.sin(t * 11.3)) * sh;
  camera.position.set(px + ox, py + oy, pz + oz);
  camera.lookAt(c.tx + ox * .4, c.ty + oy * .4, c.tz + oz * .4);
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
function rayPlane(cx, cy, py) {
  const r = screenRay(cx, cy), o = r.origin, d = r.direction;
  if (d.y > -1e-4) return null;
  const t = (py - o.y) / d.y;
  if (t <= 0 || t > 4000) return null;
  return { x: o.x + d.x * t, y: py, z: o.z + d.z * t };
}
function pickGround(cx, cy) {
  const ray = screenRay(cx, cy), o = ray.origin, d = ray.direction;
  const h = raycast(o.x, o.y, o.z, d.x, d.y, d.z, 1500);
  if (h) return { x: o.x + d.x * h.t, y: o.y + d.y * h.t, z: o.z + d.z * h.t, vx: h.x, vy: h.y, vz: h.z, nx: h.nx, ny: h.ny, nz: h.nz };
  const p = rayPlane(cx, cy, WATER_Y);
  if (p && p.x >= 0 && p.x < SX && p.z >= 0 && p.z < SZ) return { x: p.x, y: WATER_Y, z: p.z, vx: p.x | 0, vy: Math.floor(WATER_Y), vz: p.z | 0, nx: 0, ny: 1, nz: 0 };
  return null;
}
function pickUnit(cx, cy) {
  const ray = screenRay(cx, cy), o = ray.origin, d = ray.direction;
  let best = null, bt = 1e9;
  for (const u of units) {
    if (u.dead) continue;
    const hw = u.hw + .5, hh = u.h + .4;
    const t = segAABB(o.x, o.y, o.z, d.x * 1500, d.y * 1500, d.z * 1500, u.x - hw, u.y - .3, u.z - hw, u.x + hw, u.y + hh, u.z + hw);
    if (t >= 0 && t < bt) { bt = t; best = u; }
  }
  return best;
}

// ───────────── 직접 조작 ─────────────
function beginPan(x, y) {
  drag.active = true; drag.mode = 'pan'; drag.panning = true;
  if (followUnit) stopFollow(true), syncCam();
  drag.panY = cam.c.ty;
  drag.anchor = rayPlane(x, y, drag.panY);
  drag.px = x; drag.py = y;
}
function panTo(x, y) {
  const P = drag.anchor ? rayPlane(x, y, drag.panY) : null;
  let dx, dz;
  if (P) { dx = drag.anchor.x - P.x; dz = drag.anchor.z - P.z; }
  else {
    // 지평선 근처라 평면 교차가 없으면 화면 기준 이동
    const k = cam.dist * .0016, s = Math.sin(cam.yaw), cc = Math.cos(cam.yaw), mx = x - drag.px, my = y - drag.py;
    dx = (-mx * cc - my * s) * k; dz = (mx * s - my * cc) * k;
  }
  const lim = Math.max(10, cam.c.dist * .6), m = Math.hypot(dx, dz);
  if (m > lim) { dx *= lim / m; dz *= lim / m; }
  cam.tx += dx; cam.tz += dz;
  clampCam();
  syncCam();
  drag.px = x; drag.py = y;
  if (!drag.anchor) drag.anchor = rayPlane(x, y, drag.panY);
}
function orbitBy(dx, dy) {
  cam.yaw -= dx * .0055;
  cam.pitch += dy * .0045;
  cam.lastRot = performance.now();
  clampCam();
  cam.c.yaw = cam.yaw; cam.c.pitch = cam.pitch;
  applyCamera(0);
}

// ───────────── 포인터 ─────────────
const pointers = new Map();
const drag = { id: -1, active: false, mode: null, x: 0, y: 0, sx: 0, sy: 0, type: 'mouse', start: null, last: null, lastPaint: null,
  held: null, ghist: [], touchT: 0, panning: false, anchor: null, panY: 0, px: 0, py: 0 };
let gesture = null;
let hover = null;
let lastClick = { t: 0, x: 0, y: 0 };
const isDraggyTool = t => t.mode === 'paint' || t.mode === 'line' || t.mode === 'grab';
function endDrag() {
  drag.active = false; drag.mode = null; drag.panning = false; drag.anchor = null; drag.id = -1;
}
function bindInput() {
  const el = renderer.domElement;
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });
  el.addEventListener('pointerdown', e => {
    try { el.setPointerCapture(e.pointerId); } catch (_) { }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === 'mouse') hover = { x: e.clientX, y: e.clientY };
    if (pointers.size === 2) { cancelToolDrag(); endDrag(); startGesture(); return; }
    if (pointers.size > 2 || gesture) return;
    drag.id = e.pointerId; drag.type = e.pointerType;
    drag.x = drag.sx = e.clientX; drag.y = drag.sy = e.clientY;
    const mac = /Mac/.test(navigator.platform);
    if (e.button === 2 || (e.button === 0 && (e.altKey || (mac && e.ctrlKey)))) { drag.active = true; drag.mode = 'orbit'; return; }
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) { beginPan(e.clientX, e.clientY); return; }
    if (e.button !== 0) return;
    if (!isDraggyTool(ui.tool)) { drag.active = true; drag.mode = 'press'; return; }
    if (e.pointerType === 'touch') { drag.active = true; drag.mode = 'pendingTouch'; drag.touchT = performance.now(); return; }
    startTool(e.clientX, e.clientY);
  });
  el.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (p) { p.x = e.clientX; p.y = e.clientY; }
    if (e.pointerType === 'mouse') hover = { x: e.clientX, y: e.clientY };
    if (gesture) { moveGesture(); return; }
    if (!drag.active || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    const moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
    switch (drag.mode) {
      case 'press':
        if (moved > (drag.type === 'touch' ? 10 : 5)) { beginPan(drag.sx, drag.sy); panTo(e.clientX, e.clientY); }
        break;
      case 'pan': panTo(e.clientX, e.clientY); break;
      case 'orbit': orbitBy(dx, dy); break;
      case 'pendingTouch':
        if (moved > 10 || performance.now() - drag.touchT > 120) { startTool(drag.sx, drag.sy); toolMove(e.clientX, e.clientY); }
        break;
      case 'tool': toolMove(e.clientX, e.clientY); break;
    }
  });
  const finish = (e, cancel) => {
    pointers.delete(e.pointerId);
    if (gesture) { if (pointers.size < 2) gesture = null, drag.panning = false; return; }
    if (!drag.active || e.pointerId !== drag.id) return;
    if (!cancel) {
      if (drag.mode === 'press') clickAt(e.clientX, e.clientY);
      else if (drag.mode === 'pendingTouch') { startTool(drag.sx, drag.sy); toolUp(e.clientX, e.clientY); }
      else if (drag.mode === 'tool') toolUp(e.clientX, e.clientY);
    } else cancelToolDrag();
    endDrag();
  };
  el.addEventListener('pointerup', e => finish(e, false));
  el.addEventListener('pointercancel', e => finish(e, true));
  el.addEventListener('lostpointercapture', e => { if (pointers.has(e.pointerId)) finish(e, false); });
  el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !drag.active) hover = null; });
  el.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); if (drag.active) { cancelToolDrag(); endDrag(); } pointers.clear(); gesture = null; });
  bindCamButtons();
}
function clickAt(x, y) {
  const t = ui.tool;
  const now = performance.now(), dbl = now - lastClick.t < 320 && Math.hypot(x - lastClick.x, y - lastClick.y) < 20;
  lastClick = { t: now, x, y };
  if (t.mode === 'camera') {
    if (dbl) { const h = pickGround(x, y); if (h) camFocus(h.x, h.z, Math.min(cam.dist, 60)); }
    return;
  }
  if (t.mode === 'follow') {
    const u = pickUnit(x, y);
    if (u) startFollow(u); else toast('따라갈 유닛을 직접 클릭하세요');
    return;
  }
  const h = pickGround(x, y);
  if (!h) return;
  if (t.unit) placeUnits(h, true);
  else if (t.mode === 'click') useWeapon(t.id, h, cam.c.yaw + Math.PI);
}
function onWheel(e) {
  e.preventDefault();
  let dy = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
  if (e.ctrlKey) dy *= 4; // 트랙패드 핀치
  // 가로 스크롤(트랙패드 좌우)은 회전
  if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5) {
    cam.yaw -= e.deltaX * (e.deltaMode === 1 ? 33 : 1) * .003; cam.lastRot = performance.now(); return;
  }
  const f = Math.min(1.6, Math.max(.62, Math.exp(dy * .0012)));
  const old = cam.dist;
  cam.dist *= f;
  clampCam();
  if (!followUnit) {
    // 회전 중심과 같은 높이의 평면에서 커서 지점을 잡아야 확대해도 커서 아래가 고정됨
    const A = rayPlane(e.clientX, e.clientY, cam.c.ty) || pickGround(e.clientX, e.clientY);
    if (A) { const k = 1 - cam.dist / old; cam.tx += (A.x - cam.tx) * k; cam.tz += (A.z - cam.tz) * k; clampCam(); }
  }
}
// 두 손가락
function twoPts() { const [a, b] = [...pointers.values()]; return { a, b, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), ang: Math.atan2(b.y - a.y, b.x - a.x) }; }
function startGesture() {
  const p = twoPts();
  if (followUnit) stopFollow(true), syncCam();
  drag.panning = true;
  gesture = { mode: null, p0: p, a0: { ...p.a }, b0: { ...p.b }, dist0: cam.dist, yaw0: cam.yaw, pitch0: cam.pitch, panY: cam.c.ty, anchor: rayPlane(p.mx, p.my, cam.c.ty) };
}
function moveGesture() {
  if (pointers.size < 2) return;
  const g = gesture, p = twoPts();
  if (!g.mode) {
    const dmx = p.mx - g.p0.mx, dmy = p.my - g.p0.my, dd = p.d - g.p0.d, da = angDiff(g.p0.ang, p.ang);
    // 손가락 이벤트는 하나씩 들어오므로 두 손가락이 모두 움직인 뒤에 판정
    const ma = Math.hypot(p.a.x - g.a0.x, p.a.y - g.a0.y), mb = Math.hypot(p.b.x - g.b0.x, p.b.y - g.b0.y);
    if (Math.min(ma, mb) < 5 && Math.max(ma, mb) < 36) return;
    const ay = p.a.y - g.a0.y, by = p.b.y - g.b0.y;
    g.mode = (ay * by > 0 && Math.abs(dmy) > 2.2 * Math.abs(dmx) && Math.abs(dd) < g.p0.d * .12 && Math.abs(da) < .12) ? 'tilt' : 'xf';
  }
  if (g.mode === 'tilt') {
    cam.pitch = g.pitch0 + (p.my - g.p0.my) * .006;
    clampCam(); syncCam();
    return;
  }
  cam.dist = g.dist0 * g.p0.d / p.d;
  cam.yaw = g.yaw0 + angDiff(g.p0.ang, p.ang);
  cam.lastRot = performance.now();
  clampCam(); syncCam();
  if (g.anchor) {
    const P = rayPlane(p.mx, p.my, g.panY);
    if (P) { cam.tx += g.anchor.x - P.x; cam.tz += g.anchor.z - P.z; clampCam(); syncCam(); }
  }
}

// ───────────── 키보드 ─────────────
const keys = new Set();
function onKey(e) {
  if (e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  switch (e.code) {
    case 'Space': togglePause(); e.preventDefault(); break;
    case 'KeyB': case 'Tab': setDrawer(!ui.drawer); e.preventDefault(); break;
    case 'KeyF': toggleFullscreen(); break;
    case 'KeyH': toggleHelp(); break;
    case 'KeyR': case 'Home': camReset(false); break;
    case 'Enter': if (phase === 'setup') startBattle(); break;
    case 'Escape':
      if (ui.help) toggleHelp(); else if (followUnit) stopFollow(); else if (ui.drawer) setDrawer(false);
      break;
    case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': setTab(TABS[+e.code.slice(5) - 1][0]); break;
    case 'KeyT': setTeam(1 - ui.team); break;
  }
}
function updateKeys(dt) {
  const fast = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 2.2 : 1;
  const sp = Math.max(25, cam.dist) * 1.1 * dt * fast;
  let fx = 0, fz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) fz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) fz += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) fx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) fx += 1;
  if (fx || fz) {
    if (followUnit) stopFollow(true);
    const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw), n = Math.hypot(fx, fz);
    cam.tx += (fx * c + fz * s) / n * sp; cam.tz += (-fx * s + fz * c) / n * sp;
  }
  if (keys.has('KeyQ')) { cam.yaw += dt * 1.8; cam.lastRot = performance.now(); }
  if (keys.has('KeyE')) { cam.yaw -= dt * 1.8; cam.lastRot = performance.now(); }
  if (keys.has('KeyZ') || keys.has('Equal') || keys.has('NumpadAdd')) cam.dist *= 1 - dt * 1.4;
  if (keys.has('KeyX') || keys.has('Minus') || keys.has('NumpadSubtract')) cam.dist *= 1 + dt * 1.4;
  if (keys.has('PageUp')) cam.pitch += dt * .9;
  if (keys.has('PageDown')) cam.pitch -= dt * .9;
}

// ───────────── 화면 카메라 버튼 ─────────────
function bindCamButtons() {
  const hold = (id, fn) => {
    const b = $(id);
    let t = null;
    const stop = () => { if (t) cancelAnimationFrame(t); t = null; };
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      let last = performance.now();
      fn(.12);
      const tick = now => { fn(Math.min(.05, (now - last) / 1000)); last = now; t = requestAnimationFrame(tick); };
      t = requestAnimationFrame(tick);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
  };
  hold('camRotL', dt => { cam.yaw += dt * 2; cam.lastRot = performance.now(); });
  hold('camRotR', dt => { cam.yaw -= dt * 2; cam.lastRot = performance.now(); });
  hold('camIn', dt => { cam.dist *= 1 - dt * 1.8; });
  hold('camOut', dt => { cam.dist *= 1 + dt * 1.8; });
  hold('camUp', dt => { cam.pitch += dt * 1.1; });
  hold('camDown', dt => { cam.pitch -= dt * 1.1; });
  $('camHome').onclick = () => camReset(false);
  $('followExit').onclick = () => stopFollow();
}
function updateCompass() {
  const n = $('compassNeedle');
  if (n) n.style.transform = `rotate(${(cam.c.yaw * 180 / Math.PI).toFixed(1)}deg)`;
}
