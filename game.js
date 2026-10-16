'use strict';
// 픽셀 전선 — 도트 샌드박스 전쟁 게임
// 셀룰러 오토마타(모래/물/불...) + 파편 입자 물리 + 병사/전차 AI + 투사체 탄도 물리
(() => {
const W = 320, H = 180, N = W * H;
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const off = document.createElement('canvas');
off.width = W; off.height = H;
const octx = off.getContext('2d');
const img = octx.createImageData(W, H);
const buf = new Uint32Array(img.data.buffer);

const rgb = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = Math.random;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

// ───────────── 재료 정의 ─────────────
const T = { EMPTY: 0, SAND: 1, DIRT: 2, STONE: 3, METAL: 4, WATER: 5, OIL: 6, LAVA: 7, ACID: 8, WOOD: 9,
  FIRE: 10, SMOKE: 11, STEAM: 12, POWDER: 13, TNT: 14, GRASS: 15, BLOOD: 16, GRAVEL: 17, ASH: 18, SOIL: 19, LEAF: 20 };
const SOLID = 1, POWD = 2, LIQ = 3, GAS = 4, FIR = 5;
const KIND = new Uint8Array(32), DENS = new Uint8Array(32), FLAM = new Float32Array(32),
  HARD = new Float32Array(32), BURN = new Uint8Array(32);
const PAL = [];
function def(t, kind, dens, flam, hard, burn, cols) {
  KIND[t] = kind; DENS[t] = dens; FLAM[t] = flam; HARD[t] = hard; BURN[t] = burn; PAL[t] = cols;
}
def(T.SAND, POWD, 20, 0, .08, 0, [[219, 193, 121], [208, 181, 110], [228, 204, 136]]);
def(T.DIRT, SOLID, 30, 0, .18, 0, [[121, 85, 53], [107, 74, 45], [133, 95, 61]]);
def(T.STONE, SOLID, 30, 0, .55, 0, [[120, 120, 128], [106, 106, 114], [132, 132, 140]]);
def(T.METAL, SOLID, 30, 0, .9, 0, [[165, 172, 182], [146, 153, 163], [178, 185, 194]]);
def(T.WATER, LIQ, 10, 0, 0, 0, [[44, 112, 214], [50, 122, 226], [40, 104, 204]]);
def(T.OIL, LIQ, 8, .5, 0, 45, [[58, 44, 36], [66, 50, 40], [52, 40, 34]]);
def(T.LAVA, LIQ, 15, 0, .3, 0, [[255, 96, 24], [240, 66, 14], [255, 136, 36]]);
def(T.ACID, LIQ, 11, 0, 0, 0, [[128, 240, 64], [104, 222, 44], [150, 250, 90]]);
def(T.WOOD, SOLID, 30, .05, .22, 160, [[132, 88, 48], [116, 76, 40], [144, 98, 56]]);
def(T.FIRE, FIR, 0, 0, 0, 0, [[255, 214, 80], [255, 140, 30], [255, 84, 22]]);
def(T.SMOKE, GAS, 1, 0, 0, 0, [[72, 72, 78], [88, 88, 94], [62, 62, 68]]);
def(T.STEAM, GAS, 1, 0, 0, 0, [[196, 206, 222], [216, 224, 236]]);
def(T.POWDER, POWD, 19, 1, .05, 0, [[62, 60, 60], [48, 47, 50], [78, 74, 70]]);
def(T.TNT, SOLID, 30, 1, .2, 0, [[204, 44, 40], [186, 34, 32], [222, 62, 52]]);
def(T.GRASS, SOLID, 30, .2, .12, 16, [[72, 162, 60], [60, 142, 50], [88, 178, 72]]);
def(T.BLOOD, LIQ, 10, 0, 0, 0, [[150, 12, 18], [128, 6, 12], [164, 20, 24]]);
def(T.GRAVEL, POWD, 21, 0, .3, 0, [[112, 112, 118], [96, 96, 102], [126, 124, 122]]);
def(T.ASH, POWD, 18, 0, .02, 0, [[92, 90, 88], [112, 110, 106], [80, 78, 76]]);
def(T.SOIL, POWD, 20, 0, .1, 0, [[121, 85, 53], [107, 74, 45], [133, 95, 61]]);
def(T.LEAF, SOLID, 30, .25, .05, 20, [[46, 120, 52], [56, 136, 60], [38, 104, 46]]);

function makeColor(t) {
  const p = PAL[t], c = p[(rnd() * p.length) | 0], j = ((rnd() * 14) | 0) - 7;
  return rgb(clamp(c[0] + j, 0, 255), clamp(c[1] + j, 0, 255), clamp(c[2] + j, 0, 255));
}

// ───────────── 격자 ─────────────
const type = new Uint8Array(N), col = new Uint32Array(N), life = new Uint8Array(N),
  aux = new Uint8Array(N), stamp = new Uint8Array(N);
let frame = 1, tick = 0;

function clearCell(i) { type[i] = 0; col[i] = 0; life[i] = 0; aux[i] = 0; }
function setCell(i, t) {
  type[i] = t; col[i] = t ? makeColor(t) : 0; aux[i] = 0; stamp[i] = frame;
  life[i] = t === T.SMOKE ? ri(40, 110) : t === T.STEAM ? ri(60, 160) : t === T.FIRE ? ri(10, 30) : 0;
}
function setFire(i, l, src) {
  type[i] = T.FIRE; col[i] = makeColor(T.FIRE); life[i] = clamp(l | 0, 1, 255); aux[i] = src || 0; stamp[i] = frame;
}
function swap(i, j) {
  let a = type[i]; type[i] = type[j]; type[j] = a;
  a = col[i]; col[i] = col[j]; col[j] = a;
  a = life[i]; life[i] = life[j]; life[j] = a;
  a = aux[i]; aux[i] = aux[j]; aux[j] = a;
  stamp[i] = stamp[j] = frame;
}
const isSolidT = t => { const k = KIND[t]; return k === SOLID || k === POWD; };
function solidAt(x, y) {
  if (x < 0 || x >= W || y >= H) return true;
  if (y < 0) return false;
  return isSolidT(type[y * W + x]);
}

// ───────────── 폭발 대기열 ─────────────
let pending = [];
function queueBoom(x, y, r, delay, o) {
  if (pending.length < 90) pending.push({ x, y, r, t: delay, o: o || {} });
}
function ignite(i) {
  const t = type[i], x = i % W, y = (i / W) | 0;
  if (t === T.POWDER) { clearCell(i); queueBoom(x, y, 3, ri(1, 4)); return; }
  if (t === T.TNT) { clearCell(i); queueBoom(x, y, 8, ri(4, 10)); return; }
  if (FLAM[t] > 0) setFire(i, BURN[t] * (.6 + rnd() * .8), t);
}

// ───────────── 셀 시뮬레이션 ─────────────
function displaceable(t, o) {
  return o === 0 || (KIND[o] >= LIQ && DENS[o] < DENS[t]);
}
function updPowder(x, y, i, t) {
  if (y >= H - 1) return;
  let j = i + W, o = type[j];
  if (o === 0 || (KIND[o] >= LIQ && DENS[o] < DENS[t] && rnd() < .6)) { swap(i, j); return; }
  const slide = t === T.SOIL ? .3 : t === T.GRAVEL ? .55 : 1;
  if (rnd() > slide) return;
  const d = rnd() < .5 ? -1 : 1;
  for (let k = 0; k < 2; k++) {
    const dd = k ? -d : d, nx = x + dd;
    if (nx < 0 || nx >= W) continue;
    j = i + W + dd; o = type[j];
    if (o === 0 || (KIND[o] >= LIQ && DENS[o] < DENS[t] && rnd() < .5)) { swap(i, j); return; }
  }
}
function randNeighbor(x, y) {
  const nx = x + ri(-1, 1), ny = y + ri(-1, 1);
  if (nx < 0 || nx >= W || ny < 0 || ny >= H) return -1;
  return ny * W + nx;
}
function updLiquid(x, y, i, t) {
  if (t === T.LAVA) {
    const j = randNeighbor(x, y);
    if (j >= 0) {
      const o = type[j];
      if (o === T.WATER) { setCell(i, T.STONE); setCell(j, T.STEAM); return; }
      if (FLAM[o] > 0) ignite(j);
      else if (o === 0 && j < i && rnd() < .01) setFire(j, ri(3, 8), 0);
    }
    if (rnd() < .55) return;
  } else if (t === T.ACID) {
    const j = randNeighbor(x, y);
    if (j >= 0) {
      const o = type[j];
      if (o && o !== T.ACID && o !== T.WATER && KIND[o] !== GAS && KIND[o] !== FIR &&
          (o !== T.METAL || rnd() < .06) && rnd() < .2) {
        if (o === T.TNT || o === T.POWDER) ignite(j);
        else setCell(j, rnd() < .25 ? T.SMOKE : T.EMPTY);
        if (rnd() < .3) { clearCell(i); return; }
      }
    }
  }
  if (y < H - 1) {
    let j = i + W, o = type[j];
    if (o === 0 || (KIND[o] >= LIQ && o !== t && DENS[o] < DENS[t])) { swap(i, j); return; }
    const d = rnd() < .5 ? -1 : 1;
    for (let k = 0; k < 2; k++) {
      const dd = k ? -d : d, nx = x + dd;
      if (nx < 0 || nx >= W) continue;
      j = i + W + dd; o = type[j];
      if (o === 0 || KIND[o] === GAS) { swap(i, j); return; }
    }
  }
  const disp = t === T.WATER || t === T.BLOOD ? 4 : t === T.LAVA ? 1 : 3;
  const d = rnd() < .5 ? -1 : 1;
  for (let k = 0; k < 2; k++) {
    const dd = k ? -d : d;
    let last = -1;
    for (let s = 1; s <= disp; s++) {
      const nx = x + dd * s;
      if (nx < 0 || nx >= W) break;
      const o = type[i + dd * s];
      if (o === 0 || KIND[o] === GAS) last = i + dd * s; else break;
    }
    if (last >= 0) { swap(i, last); return; }
  }
}
function updGas(x, y, i, t) {
  life[i]--;
  if (life[i] === 0) {
    if (t === T.STEAM && rnd() < .2) setCell(i, T.WATER); else clearCell(i);
    return;
  }
  if (rnd() < .35) return;
  const d = rnd() < .5 ? -1 : 1;
  if (y > 0) {
    let j = i - W, o = type[j];
    if (o === 0 || (KIND[o] === LIQ && rnd() < .3)) { swap(i, j); return; }
    const nx = x + d;
    if (nx >= 0 && nx < W) { j = i - W + d; if (type[j] === 0) { swap(i, j); return; } }
  } else if (rnd() < .08) { clearCell(i); return; }
  const nx = x + d;
  if (nx >= 0 && nx < W && type[i + d] === 0) swap(i, i + d);
}
function updFire(x, y, i) {
  const l = life[i] - 1;
  life[i] = l;
  if (l <= 0) {
    if (aux[i] === T.WOOD && rnd() < .3) setCell(i, T.ASH);
    else if (rnd() < .35) setCell(i, T.SMOKE);
    else clearCell(i);
    return;
  }
  if ((tick & 1) === 0) col[i] = makeColor(T.FIRE);
  for (let k = 0; k < 2; k++) {
    const j = randNeighbor(x, y);
    if (j < 0) continue;
    const o = type[j];
    if (o === T.WATER) { setCell(i, T.STEAM); if (rnd() < .3) setCell(j, T.STEAM); return; }
    if (FLAM[o] > 0 && rnd() < FLAM[o]) ignite(j);
  }
  if (y > 0) {
    const j = i - W;
    if (type[j] === 0) {
      if (rnd() < (aux[i] ? .3 : .1)) setFire(j, ri(2, 7), 0);
      else if (aux[i] && rnd() < .02) setCell(j, T.SMOKE);
      else if (!aux[i] && rnd() < .3) swap(i, j);
    }
  }
}
function stepGrid() {
  frame = (frame + 1) & 255; if (frame === 0) frame = 1;
  for (let y = H - 1; y >= 0; y--) {
    const ltr = rnd() < .5, row = y * W;
    for (let k = 0; k < W; k++) {
      const x = ltr ? k : W - 1 - k, i = row + x, t = type[i];
      if (t === 0 || stamp[i] === frame) continue;
      switch (KIND[t]) {
        case POWD: updPowder(x, y, i, t); break;
        case LIQ: updLiquid(x, y, i, t); break;
        case GAS: updGas(x, y, i, t); break;
        case FIR: updFire(x, y, i); break;
      }
    }
  }
}

// ───────────── 파편 입자 ─────────────
const MAXP = 9000;
const px = new Float32Array(MAXP), py = new Float32Array(MAXP), pvx = new Float32Array(MAXP), pvy = new Float32Array(MAXP);
const ptype = new Uint8Array(MAXP), pcol = new Uint32Array(MAXP), plife = new Int16Array(MAXP);
let np = 0;
const SPARK = 250;
function addParticle(x, y, vx, vy, t, c, l) {
  if (np >= MAXP) return;
  px[np] = x; py[np] = y; pvx[np] = vx; pvy[np] = vy; ptype[np] = t;
  pcol[np] = c || (t === SPARK ? 0 : makeColor(t)); plife[np] = l || 0; np++;
}
function killParticle(i) {
  np--;
  px[i] = px[np]; py[i] = py[np]; pvx[i] = pvx[np]; pvy[i] = pvy[np];
  ptype[i] = ptype[np]; pcol[i] = pcol[np]; plife[i] = plife[np];
}
function deposit(t, c, x, y) {
  const ix = Math.floor(x);
  let iy = Math.floor(y);
  if (ix < 0 || ix >= W) return;
  for (let k = 0; k < 6 && iy >= 0; k++, iy--) {
    if (iy >= H) continue;
    const i = iy * W + ix, o = type[i];
    if (o === 0 || KIND[o] === GAS) {
      if (t === T.FIRE) setFire(i, ri(15, 50), T.OIL);
      else { type[i] = t; col[i] = c; life[i] = 0; aux[i] = 0; stamp[i] = frame; }
      return;
    }
  }
}
function updParticles() {
  for (let i = 0; i < np; i++) {
    const t = ptype[i];
    let vx = pvx[i], vy = pvy[i] + (t === SPARK ? .06 : .15);
    vx *= .995;
    let ghost = false;
    if (bh) {
      const dx = bh.x - px[i], dy = bh.y - py[i], d = Math.hypot(dx, dy) || 1;
      if (d < bh.R * 1.7) {
        const a = .9 / (d * .06 + 1);
        vx = (vx + dx / d * a) * .96; vy = (vy + dy / d * a - .15) * .96;
        ghost = true;
        if (d < 2.5) { killParticle(i); i--; continue; }
      }
    }
    if (t === SPARK) {
      plife[i]--;
      px[i] += vx; py[i] += vy; pvx[i] = vx; pvy[i] = vy;
      const ix = px[i] | 0, iy = py[i] | 0;
      if (plife[i] <= 0 || px[i] < 0 || px[i] >= W || py[i] >= H) { killParticle(i); i--; continue; }
      if (iy >= 0) {
        const o = type[iy * W + ix];
        if (o && KIND[o] !== GAS && KIND[o] !== FIR) {
          if (FLAM[o] > 0 && rnd() < .15) ignite(iy * W + ix);
          killParticle(i); i--; continue;
        }
      }
      continue;
    }
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(vx), Math.abs(vy))));
    let x = px[i], y = py[i], dead = false;
    for (let s = 0; s < n; s++) {
      const nx = x + vx / n, ny = y + vy / n;
      if (nx < 0 || nx >= W || ny >= H) { dead = true; break; }
      if (ny >= 0 && !ghost) {
        const o = type[Math.floor(ny) * W + Math.floor(nx)];
        if (o !== 0 && KIND[o] !== GAS && KIND[o] !== FIR) {
          if (t === T.FIRE && FLAM[o] > 0) ignite(Math.floor(ny) * W + Math.floor(nx));
          deposit(t, pcol[i], x, y); dead = true; break;
        }
      }
      x = nx; y = ny;
    }
    if (dead) { killParticle(i); i--; continue; }
    px[i] = x; py[i] = y; pvx[i] = vx; pvy[i] = vy;
  }
}

// ───────────── 효과: 화면 흔들림, 섬광, 사운드 ─────────────
let shake = 0, whiteFlash = 0;
const flashes = [];
let AC = null, master = null, noiseB = null, muted = false, shotBudget = 0, boomBudget = 0;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = .45; master.connect(AC.destination);
    const len = AC.sampleRate * 3;
    noiseB = AC.createBuffer(1, len, AC.sampleRate);
    const d = noiseB.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = rnd() * 2 - 1;
  } catch (e) { AC = null; }
}
function noise(dur, ftype, freq, vol, attack) {
  const t = AC.currentTime, s = AC.createBufferSource();
  s.buffer = noiseB;
  const f = AC.createBiquadFilter(); f.type = ftype; f.frequency.value = freq;
  const g = AC.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + (attack || .002));
  g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t, rnd() * .3); s.stop(t + dur + .05);
  return f;
}
function sfxShot(heavy) {
  if (!AC || muted || shotBudget <= 0) return;
  shotBudget--;
  noise(heavy ? .2 : .07, 'bandpass', heavy ? 800 : 2400 + rnd() * 600, heavy ? .35 : .16);
}
function sfxBoom(r) {
  if (!AC || muted || boomBudget <= 0) return;
  boomBudget--;
  const t = AC.currentTime, dur = Math.min(2.8, .35 + r * .055);
  const f = noise(dur, 'lowpass', 1600, Math.min(1, .3 + r * .03), .004);
  f.frequency.setValueAtTime(2000, t);
  f.frequency.exponentialRampToValueAtTime(70, t + dur);
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(28, t + .4 + r * .02);
  g.gain.setValueAtTime(Math.min(.9, .2 + r * .04), t);
  g.gain.exponentialRampToValueAtTime(.001, t + .5 + r * .03);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + 1 + r * .03);
}
function sfxWhoosh() { if (AC && !muted) noise(.25, 'highpass', 2500, .07, .05); }

// ───────────── 폭발 ─────────────
const emitters = [];
function explode(cx, cy, r, o) {
  o = o || {};
  cx = Math.round(cx); cy = Math.round(cy);
  const nuke = !!o.nuke;
  // 범위 안의 폭약은 흡수해서 폭발 반경을 키운다 (연쇄 폭발)
  let bonus = 0;
  const r0 = Math.ceil(r);
  for (let dy = -r0; dy <= r0; dy++) for (let dx = -r0; dx <= r0; dx++) {
    if (dx * dx + dy * dy > r * r) continue;
    const x = cx + dx, y = cy + dy;
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const i = y * W + x, t = type[i];
    if (t === T.TNT) { bonus += 1; clearCell(i); } else if (t === T.POWDER) { bonus += .35; clearCell(i); }
  }
  r = Math.min(nuke ? 52 : 42, r + Math.sqrt(bonus) * 1.6);
  const R = Math.ceil(r), r2 = r * r;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    const x = cx + dx, y = cy + dy;
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const i = y * W + x, t = type[i], d = Math.sqrt(d2), f = 1 - d / r;
    if (t === 0) { if (f > .3 && rnd() < .07) setFire(i, ri(4, 16), 0); continue; }
    if (t === T.TNT || t === T.POWDER) { clearCell(i); if (rnd() < .05) queueBoom(x, y, 4 + rnd() * 3, ri(3, 20), o); continue; }
    const k = KIND[t];
    if (k === GAS || k === FIR) { if (f > .5) clearCell(i); continue; }
    if (rnd() < HARD[t] * (nuke ? .8 : 1.25) - f * .5) { if (FLAM[t] > 0 && rnd() < .3) ignite(i); continue; }
    if (t === T.WATER && f > .45 && rnd() < .5) { setCell(i, T.STEAM); continue; }
    if ((f > .6 && rnd() < .7) || (nuke && rnd() < .55)) {
      if (k !== LIQ && rnd() < .22) setFire(i, ri(3, 14), 0); else clearCell(i);
      continue;
    }
    const ang = Math.atan2(dy, dx), sp = (1.2 + f * 4.5) * (o.power || 1) * (.6 + rnd() * .7);
    let pt = t === T.STONE ? T.GRAVEL : (t === T.DIRT || t === T.GRASS) ? T.SOIL : t === T.LEAF ? T.ASH : t;
    if (FLAM[t] > 0 && rnd() < .35) pt = T.FIRE;
    addParticle(x + .5, y + .5, Math.cos(ang) * sp, Math.sin(ang) * sp - rnd() * 1.4 - f * 1.4, pt,
      pt === t || pt === T.SOIL ? col[i] : makeColor(pt));
    clearCell(i);
  }
  for (let k = 0; k < r * 3; k++) {
    const a = rnd() * Math.PI * 2, s = 1 + rnd() * 3.5;
    addParticle(cx, cy, Math.cos(a) * s, Math.sin(a) * s - 1, SPARK, 0, ri(8, 28));
  }
  for (let k = 0; k < r * 2; k++) {
    const a = rnd() * Math.PI * 2, d = rnd() * r * .8;
    const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
    if (x >= 0 && x < W && y >= 0 && y < H && type[y * W + x] === 0) setCell(y * W + x, T.SMOKE);
  }
  // 유닛 피해와 넉백
  const rr = r * 1.8;
  for (const u of units) {
    if (u.dead) continue;
    const dx = u.x - cx, dy = (u.y - u.h / 2) - cy, d = Math.hypot(dx, dy);
    if (d > rr) continue;
    const f = 1 - d / rr;
    hurt(u, Math.pow(f, 1.4) * r * 10 * (nuke ? 2 : 1), o.team);
    const imp = f * r * .42 / (u.kind === 'tank' ? 4 : 1), nx = dx / (d || 1), ny = dy / (d || 1);
    u.vx += nx * imp; u.vy += ny * imp - imp * .6;
    u.stun = Math.max(u.stun, u.kind === 'tank' ? 8 : (30 + f * 40) | 0);
    if (f > .5 && rnd() < .5) u.burn = 140;
  }
  for (const p of projs) {
    if (p.kind !== 'grenade' && p.kind !== 'bomblet') continue;
    const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
    if (d < rr && d > 0) { const f = (1 - d / rr) * r * .3; p.vx += dx / d * f; p.vy += dy / d * f - f * .5; }
  }
  shake = Math.max(shake, Math.min(r * .55, 24));
  flashes.push({ x: cx, y: cy, r: r * 2.8, a: nuke ? 1.4 : 1 });
  if (nuke) { whiteFlash = 1; emitters.push({ x: cx, y: cy, t: 170 }); }
  sfxBoom(r);
}
function updEmitters() {
  for (let k = emitters.length - 1; k >= 0; k--) {
    const e = emitters[k];
    e.t--;
    const age = 170 - e.t, top = Math.max(4, e.y - 55);
    for (let n = 0; n < 8; n++) {
      const x = e.x + ri(-4, 4), y = e.y - ri(0, Math.min(age, 50));
      if (x >= 0 && x < W && y >= 0 && y < H && type[y * W + x] === 0) {
        if (rnd() < .3) setFire(y * W + x, ri(4, 12), 0); else { setCell(y * W + x, T.SMOKE); life[y * W + x] = ri(150, 255); }
      }
    }
    if (age > 15) for (let n = 0; n < 10; n++) {
      const a = rnd() * Math.PI * 2, rx = ri(4, 26), ry = ri(2, 9);
      const x = Math.round(e.x + Math.cos(a) * rx), y = Math.round(top + Math.sin(a) * ry);
      if (x >= 0 && x < W && y >= 0 && y < H && type[y * W + x] === 0) {
        setCell(y * W + x, rnd() < .2 ? T.FIRE : T.SMOKE); life[y * W + x] = ri(120, 255);
      }
    }
    if (e.t <= 0) emitters.splice(k, 1);
  }
}

// ───────────── 유닛 ─────────────
const KINDS = {
  rifle:     { name: '소총병', hp: 60,  w: 3,  h: 7, speed: .32, range: 120, cd: 26,  step: 2 },
  sniper:    { name: '저격병', hp: 45,  w: 3,  h: 7, speed: .26, range: 240, cd: 100, step: 2 },
  bazooka:   { name: '바주카병', hp: 60, w: 3,  h: 7, speed: .28, range: 150, cd: 120, step: 2 },
  grenadier: { name: '척탄병', hp: 60,  w: 3,  h: 7, speed: .3,  range: 105, cd: 110, step: 2 },
  tank:      { name: '전차',   hp: 480, w: 13, h: 7, speed: .2,  range: 210, cd: 150, step: 3 },
};
let units = [], uid = 0;
const kills = [0, 0];
function rectBlocked(l, t, w, h) {
  for (let y = t; y < t + h; y++) for (let x = l; x < l + w; x++) if (solidAt(x, y)) return true;
  return false;
}
function uBlocked(u, x, y) { return rectBlocked(Math.round(x - u.w / 2), Math.round(y) - u.h + 1, u.w, u.h); }
function spawnUnit(kind, team, x, y) {
  const s = KINDS[kind];
  const u = { id: uid++, kind, team, x, y, vx: 0, vy: 0, hp: s.hp, maxhp: s.hp, w: s.w, h: s.h,
    face: team === 0 ? 1 : -1, cd: ri(10, 60), stun: 0, burn: 0, breath: 300, grounded: false,
    target: null, stuck: 0, walk: 0, dead: false, lastHit: -1, aim: team === 0 ? -.15 : Math.PI + .15,
    inLiq: false, panic: 0 };
  let tries = 0;
  while (uBlocked(u, u.x, u.y) && u.y > u.h && tries++ < 200) u.y--;
  if (uBlocked(u, u.x, u.y)) return null;
  units.push(u);
  return u;
}
function hurt(u, d, team) {
  if (u.dead || d <= 0) return;
  u.hp -= d;
  if (team != null && team >= 0) u.lastHit = team;
  if (u.hp <= 0) die(u);
}
function die(u) {
  u.dead = true;
  const k = u.lastHit;
  if (k >= 0 && k !== u.team) kills[k]++;
  if (grab.unit === u) grab.unit = null;
  if (u.kind === 'tank') {
    queueBoom(u.x, u.y - 3, 9, 2, {});
    for (let n = 0; n < 24; n++)
      addParticle(u.x + ri(-6, 6), u.y - ri(1, 6), (rnd() - .5) * 5, -rnd() * 4, T.METAL,
        rnd() < .5 ? TEAMC[u.team][1] : makeColor(T.METAL));
  } else {
    for (let n = 0; n < 14; n++)
      addParticle(u.x, u.y - 3, (rnd() - .5) * 3 + u.vx * .5, -rnd() * 2.5 + u.vy * .3, T.BLOOD);
    for (let n = 0; n < 3; n++)
      addParticle(u.x, u.y - 3, (rnd() - .5) * 2.5, -rnd() * 2, T.BLOOD, TEAMC[u.team][1]);
  }
}
function lineClear(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
  for (let s = 2; s < n - 2; s++) {
    if (solidAt(Math.round(x0 + dx * s / n), Math.round(y0 + dy * s / n))) return false;
  }
  return true;
}
function findTarget(u) {
  let best = null, bd = 1e9;
  for (const v of units) {
    if (v.dead || v.team === u.team) continue;
    const d = Math.abs(v.x - u.x) + Math.abs(v.y - u.y) * .5;
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}
// 45도/30도 탄도 계산
function lob(dx, dy, g, deg, vmax) {
  const X = Math.abs(dx), Y = -dy, th = deg * Math.PI / 180, tn = Math.tan(th), c2 = Math.cos(th) ** 2;
  let den = 2 * c2 * (X * tn - Y);
  if (den < 6) den = 6;
  const v = Math.min(Math.sqrt(g * X * X / den), vmax) * (.93 + rnd() * .14);
  return [Math.sign(dx || 1) * v * Math.cos(th), -v * Math.sin(th)];
}
function shoot(u, dx, dy) {
  const s = KINDS[u.kind], f = u.face;
  const ex = u.x + f * 2, ey = u.y - 4;
  const a = Math.atan2(dy, dx);
  switch (u.kind) {
    case 'rifle': {
      const b = a + (rnd() - .5) * .1;
      addProj('bullet', ex, ey, Math.cos(b) * 7, Math.sin(b) * 7, u.team, { dmg: ri(9, 14) });
      addParticle(ex + f, ey, 0, 0, SPARK, 0, 2);
      u.cd = s.cd + ri(0, 14); sfxShot(false);
      break;
    }
    case 'sniper': {
      const b = a + (rnd() - .5) * .02;
      addProj('bullet', ex, ey, Math.cos(b) * 11, Math.sin(b) * 11, u.team, { dmg: 48, pierce: true });
      addParticle(ex + f * 3, ey, 0, 0, SPARK, 0, 3);
      u.cd = s.cd + ri(0, 30); sfxShot(true);
      break;
    }
    case 'bazooka': {
      const b = a + (rnd() - .5) * .06;
      addProj('rocket', ex, ey - 1, Math.cos(b) * 2.5, Math.sin(b) * 2.5, u.team);
      for (let n = 0; n < 5; n++) addParticle(ex - f * 3, ey - 1, -f * rnd() * 2, (rnd() - .5), SPARK, 0, ri(4, 10));
      u.cd = s.cd + ri(0, 40); sfxShot(true);
      break;
    }
    case 'grenadier': {
      const [vx, vy] = lob(dx, dy, G.grenade, 45, 6.5);
      addProj('grenade', ex, ey - 2, vx, vy, u.team, { fuse: 75 });
      u.cd = s.cd + ri(0, 30); sfxWhoosh();
      break;
    }
    case 'tank': {
      const [vx, vy] = lob(dx, dy, G.shell, 28, 8.5);
      u.aim = Math.atan2(vy, vx);
      const tx = u.x + Math.cos(u.aim) * 9, ty = u.y - 6 + Math.sin(u.aim) * 9;
      addProj('shell', tx, ty, vx, vy, u.team);
      for (let n = 0; n < 8; n++) addParticle(tx, ty, Math.cos(u.aim) * rnd() * 3, Math.sin(u.aim) * rnd() * 3, SPARK, 0, ri(4, 10));
      u.vx -= Math.cos(u.aim) * .5;
      u.cd = s.cd + ri(0, 50); sfxShot(true); shake = Math.max(shake, 2);
      break;
    }
  }
}
function think(u) {
  const s = KINDS[u.kind];
  if (u.stun > 0) return;
  if (u.burn > 0 && u.kind !== 'tank') {
    // 불붙은 병사는 이리저리 뛰어다닌다
    if (u.panic-- <= 0) { u.face = rnd() < .5 ? -1 : 1; u.panic = ri(15, 40); }
    if (u.grounded) { u.vx = u.face * s.speed * 1.8; u.walk += .5; if (u.stuck > 6) { u.vy = -1.9; u.stuck = 0; } }
    return;
  }
  if ((tick + u.id) % 15 === 0 || (u.target && u.target.dead)) u.target = findTarget(u);
  const tg = u.target;
  let move = !!tg, dir = u.face;
  if (tg) {
    const ex = u.x, ey = u.y - u.h + 2, tx = tg.x, ty = tg.y - tg.h * .5;
    const dx = tx - ex, dy = ty - ey, d = Math.hypot(dx, dy);
    dir = dx > 0 ? 1 : -1; u.face = dir;
    if (u.kind === 'tank' && u.cd > 20) u.aim += (Math.atan2(dy, dx) - u.aim) * .05;
    if (d < s.range) {
      const needLos = u.kind === 'rifle' || u.kind === 'sniper' || u.kind === 'bazooka';
      const los = !needLos || lineClear(ex + dir * 2, ey, tx, ty);
      if (los) {
        move = u.kind === 'tank' ? d > s.range * .7 : false;
        if (u.cd === 0 && (u.grounded || u.inLiq)) shoot(u, dx, dy);
      } else if (u.stuck > 40 && u.cd === 0 && (u.kind === 'bazooka' || u.kind === 'rifle')) {
        // 벽에 막히면 벽을 쏴서 뚫는다
        shoot(u, dir * 20, -2);
      }
    }
  }
  if (move) {
    if (u.grounded) {
      u.vx = dir * s.speed;
      u.walk += s.speed * .5;
      if (u.stuck > 12 && u.kind !== 'tank') { u.vy = -1.9; u.stuck = 0; }
      if (u.kind === 'tank' && u.stuck > 60 && u.cd === 0) { shoot(u, dir * 30, 0); u.stuck = 0; }
    } else if (u.inLiq) {
      u.vx = dir * s.speed * .6;
      if (u.stuck > 5) u.vy = -1.2;
    }
  } else if (u.grounded) u.vx = 0;
}
function moveUnit(u) {
  const s = KINDS[u.kind];
  let n = Math.ceil(Math.abs(u.vx));
  if (n > 0) {
    const sx = u.vx / n;
    for (let k = 0; k < n; k++) {
      const nx = u.x + sx;
      if (!uBlocked(u, nx, u.y)) { u.x = nx; u.stuck = Math.max(0, u.stuck - .5); continue; }
      let ok = false;
      if (u.grounded || u.inLiq) for (let up = 1; up <= s.step; up++) {
        if (!uBlocked(u, nx, u.y - up)) { u.x = nx; u.y -= up; ok = true; break; }
      }
      if (!ok) {
        if (Math.abs(u.vx) > 3.5) hurt(u, (Math.abs(u.vx) - 3.5) * (u.kind === 'tank' ? 2 : 9), u.lastHit);
        u.vx = u.stun ? -u.vx * .3 : 0;
        u.stuck++;
        break;
      }
    }
  }
  n = Math.ceil(Math.abs(u.vy));
  u.grounded = false;
  if (n > 0) {
    const sy = u.vy / n;
    for (let k = 0; k < n; k++) {
      const ny = u.y + sy;
      if (!uBlocked(u, u.x, ny)) { u.y = ny; continue; }
      if (u.vy > 0) {
        if (u.vy > 4.2) hurt(u, (u.vy - 4.2) * (u.kind === 'tank' ? 4 : 14), u.lastHit);
        u.grounded = true;
      }
      u.vy = 0;
      break;
    }
  }
  if (!u.grounded) u.grounded = uBlocked(u, u.x, u.y + 1);
  if (u.grounded) { if (u.stun > 0) u.vx *= .8; } else u.vx *= .995;
  // 모래 등에 파묻히면 위로 밀어낸다
  if (uBlocked(u, u.x, u.y)) {
    let freed = false;
    for (let up = 1; up <= 3; up++) if (!uBlocked(u, u.x, u.y - up)) { u.y -= up; freed = true; break; }
    if (!freed) { u.y -= .5; hurt(u, .4, -1); }
  }
}
function updUnit(u) {
  if (u.cd > 0) u.cd--;
  if (u.stun > 0 && (u.grounded || u.stun > 1)) u.stun--;
  const cx = Math.round(u.x);
  const samples = [Math.round(u.y), Math.round(u.y - u.h / 2), Math.round(u.y - u.h + 1)];
  let liq = 0, water = false;
  for (let k = 0; k < 3; k++) {
    const y = samples[k];
    if (cx < 0 || cx >= W || y < 0 || y >= H) continue;
    const t = type[y * W + cx];
    if (t === T.FIRE) u.burn = Math.max(u.burn, 90);
    else if (t === T.LAVA) { hurt(u, u.kind === 'tank' ? 1.5 : 2.5, -1); u.burn = 160; }
    else if (t === T.ACID) hurt(u, u.kind === 'tank' ? .6 : 1.2, -1);
    if (KIND[t] === LIQ) { liq++; if (t === T.WATER) water = true; }
    if (k === 2) {
      if (KIND[t] === LIQ) { if (--u.breath < 0) hurt(u, .4, -1); }
      else u.breath = Math.min(u.breath + 2, 300);
    }
  }
  u.inLiq = liq > 0;
  if (u.burn > 0) {
    u.burn--;
    if (water) u.burn = 0;
    hurt(u, u.kind === 'tank' ? .08 : .2, -1);
    if (rnd() < .3) addParticle(u.x + (rnd() - .5) * u.w, u.y - u.h, (rnd() - .5) * .4, -.5 - rnd(), SPARK, 0, ri(5, 12));
    const fy = Math.round(u.y) + 1;
    if (rnd() < .05 && fy < H && cx >= 0 && cx < W && FLAM[type[fy * W + cx]] > 0) ignite(fy * W + cx);
  }
  u.vy += .16;
  if (u.inLiq) { u.vx *= .9; u.vy *= .88; if (u.kind !== 'tank') u.vy -= .2 * Math.min(liq, 2) / 2 + .02; }
  u.vy = clamp(u.vy, -9, 7);
  if (grab.unit === u) return;
  think(u);
  moveUnit(u);
  if (u.dead) return;
}

// ───────────── 투사체 ─────────────
const G = { bullet: .01, rocket: .015, grenade: .15, bomblet: .15, cluster: .15, napalm: .15, shell: .08, bomb: .18, missile: 0, nuke: .06 };
let projs = [];
function addProj(kind, x, y, vx, vy, team, ext) {
  const p = { kind, x, y, vx, vy, team: team == null ? -1 : team, age: 0, fuse: -1, dmg: 0 };
  if (ext) Object.assign(p, ext);
  projs.push(p);
  return p;
}
function unitAt(x, y, team) {
  for (const u of units) {
    if (u.dead || u.team === team) continue;
    if (x >= u.x - u.w / 2 - .5 && x <= u.x + u.w / 2 + .5 && y >= u.y - u.h + .5 && y <= u.y + 1) return u;
  }
  return null;
}
function boomProj(p) {
  const o = { team: p.team };
  switch (p.kind) {
    case 'rocket': explode(p.x, p.y, 6, o); break;
    case 'grenade': explode(p.x, p.y, 7, o); break;
    case 'bomblet': explode(p.x, p.y, 4.5, o); break;
    case 'shell': explode(p.x, p.y, 8, o); break;
    case 'bomb': explode(p.x, p.y, 9, o); break;
    case 'missile': explode(p.x, p.y, 13, o); break;
    case 'nuke': explode(p.x, p.y, 36, { team: p.team, nuke: true }); break;
    case 'cluster':
      explode(p.x, p.y, 5, o);
      for (let k = 0; k < 12; k++) {
        const a = -Math.PI / 2 + (rnd() - .5) * 2.4, s = 2 + rnd() * 2.5;
        addProj('bomblet', p.x, p.y - 2, Math.cos(a) * s, Math.sin(a) * s, p.team, { fuse: ri(30, 70) });
      }
      break;
    case 'napalm':
      explode(p.x, p.y, 4, o);
      for (let k = 0; k < 90; k++) {
        const a = -Math.PI / 2 + (rnd() - .5) * 2.8, s = 1 + rnd() * 3.5;
        addParticle(p.x, p.y - 2, Math.cos(a) * s, Math.sin(a) * s, rnd() < .55 ? T.FIRE : T.OIL);
      }
      break;
  }
}
function updProj(p) {
  p.age++;
  p.vy += G[p.kind];
  if (p.kind === 'rocket') {
    if (Math.hypot(p.vx, p.vy) < 6) { p.vx *= 1.05; p.vy *= 1.05; }
    addParticle(p.x - p.vx * .3, p.y - p.vy * .3, (rnd() - .5) * .3, (rnd() - .5) * .3, SPARK, 0, ri(3, 7));
    const ix = Math.floor(p.x - p.vx), iy = Math.floor(p.y - p.vy);
    if (rnd() < .5 && ix >= 0 && ix < W && iy >= 0 && iy < H && type[iy * W + ix] === 0) setCell(iy * W + ix, T.SMOKE);
  } else if (p.kind === 'missile' || p.kind === 'nuke') {
    addParticle(p.x, p.y - 2, (rnd() - .5) * .5, -rnd(), SPARK, 0, ri(4, 10));
  }
  if (bh) {
    const dx = bh.x - p.x, dy = bh.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (d < bh.R * 2) { const a = .6 / (d * .05 + 1); p.vx += dx / d * a; p.vy += dy / d * a; }
  }
  if (p.fuse > 0 && --p.fuse === 0) { boomProj(p); return false; }
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy))));
  const sx = p.vx / n, sy = p.vy / n;
  const bouncy = p.kind === 'grenade' || p.kind === 'bomblet';
  for (let s = 0; s < n; s++) {
    const nx = p.x + sx, ny = p.y + sy, ix = Math.floor(nx), iy = Math.floor(ny);
    if (ix < 0 || ix >= W || iy >= H) {
      if (bouncy && iy < H) { p.vx = -p.vx * .5; return true; }
      if (p.kind !== 'bullet' && iy >= H) boomProj(p);
      return false;
    }
    if (iy >= 0) {
      if (!bouncy) {
        const u = unitAt(nx, ny, p.team);
        if (u) {
          if (p.kind === 'bullet') {
            hurt(u, p.dmg, p.team);
            u.vx += p.vx * .04;
            for (let k = 0; k < 4; k++) addParticle(nx, ny, p.vx * .15 + (rnd() - .5), -rnd() * 1.5, T.BLOOD);
            if (!p.pierce || u.kind === 'tank') return false;
            p.pierce = false;
          } else { p.x = nx; p.y = ny; boomProj(p); return false; }
        }
      }
      const i = iy * W + ix, t = type[i], k = KIND[t];
      if (k === SOLID || k === POWD) {
        if (bouncy) {
          const bx = solidAt(Math.floor(p.x + sx), Math.floor(p.y)), by = solidAt(Math.floor(p.x), Math.floor(p.y + sy));
          if (bx) p.vx = -p.vx * .45;
          if (by) p.vy = -p.vy * .4;
          if (!bx && !by) { p.vx = -p.vx * .45; p.vy = -p.vy * .4; }
          p.vx *= .85;
          return true;
        }
        if (p.kind === 'bullet') {
          if (t === T.TNT || t === T.POWDER) ignite(i);
          else if (HARD[t] < .35 && rnd() < (p.dmg > 30 ? .9 : .4)) {
            const pt = (t === T.DIRT || t === T.GRASS) ? T.SOIL : t;
            addParticle(ix + .5, iy - .5, -sx * .15 + (rnd() - .5), -rnd() * 1.5, pt, col[i]);
            clearCell(i);
          }
          addParticle(p.x, p.y, -sx * .2 + (rnd() - .5), -rnd(), SPARK, 0, ri(2, 5));
          return false;
        }
        boomProj(p);
        return false;
      }
      if (k === LIQ) {
        p.vx *= .9; p.vy *= .9;
        if (p.kind === 'bullet' && Math.abs(p.vx) + Math.abs(p.vy) < 1) return false;
      }
    }
    p.x = nx; p.y = ny;
  }
  if (p.y < -400 || p.age > 1500) return false;
  return true;
}

// ───────────── 공습 비행기, 블랙홀 ─────────────
let planes = [], bh = null;
function callAirstrike(tx) {
  const dir = tx < W / 2 ? 1 : -1;
  planes.push({ x: dir > 0 ? -20 : W + 20, y: ri(10, 18), vx: dir * 2.4, tx, bombs: 7 });
  sfxWhoosh();
}
function updPlanes() {
  for (let k = planes.length - 1; k >= 0; k--) {
    const p = planes[k];
    p.x += p.vx;
    if (p.bombs > 0 && Math.abs(p.x - p.tx) < 32 && tick % 5 === 0) {
      addProj('bomb', p.x, p.y + 3, p.vx * .6, .5, -1); p.bombs--;
    }
    if (p.x < -40 || p.x > W + 40) planes.splice(k, 1);
  }
}
function updBlackhole() {
  if (!bh) return;
  bh.t--;
  for (let k = 0; k < 45; k++) {
    const a = rnd() * Math.PI * 2, d = rnd() * bh.R;
    const x = Math.round(bh.x + Math.cos(a) * d), y = Math.round(bh.y + Math.sin(a) * d);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const i = y * W + x, t = type[i];
    if (!t || (t === T.METAL && rnd() < .8)) continue;
    if (KIND[t] === GAS || KIND[t] === FIR) { clearCell(i); continue; }
    if (t === T.TNT || t === T.POWDER) { ignite(i); continue; }
    addParticle(x + .5, y + .5, -Math.sin(a) * .8, Math.cos(a) * .8, t, col[i]);
    clearCell(i);
  }
  for (const u of units) {
    if (u.dead) continue;
    const dx = bh.x - u.x, dy = bh.y - (u.y - u.h / 2), d = Math.hypot(dx, dy) || 1;
    if (d > bh.R * 2.2) continue;
    const a = 1.1 / (d * .08 + 1);
    u.vx += dx / d * a; u.vy += dy / d * a - .16; u.stun = Math.max(u.stun, 20);
    if (d < 5) { u.lastHit = -1; hurt(u, 999, -1); }
  }
  shake = Math.max(shake, 1.5);
  if (bh.t <= 0) { const b = bh; bh = null; explode(b.x, b.y, 14, {}); }
}

// ───────────── 맵 생성 ─────────────
const bg = new Uint32Array(N);
function makeBg() {
  const a = rnd() * 9, b = rnd() * 9, c = rnd() * 9;
  for (let x = 0; x < W; x++) {
    const m1 = H * .42 + Math.sin(x * .03 + a) * 10 + Math.sin(x * .011 + b) * 14;
    const m2 = H * .55 + Math.sin(x * .021 + c) * 9 + Math.sin(x * .07 + a) * 3;
    for (let y = 0; y < H; y++) {
      const t = y / H;
      let r = 20 + t * 110, g = 24 + t * 72, bl = 50 + t * 58;
      if (y < H * .35 && rnd() < .004) { r = g = bl = 200 + rnd() * 55; }
      if (y > m1) { r = 46; g = 46; bl = 70; }
      if (y > m2) { r = 34; g = 35; bl = 52; }
      bg[y * W + x] = rgb(r | 0, g | 0, bl | 0);
    }
  }
}
function clearWorld() {
  type.fill(0); col.fill(0); life.fill(0); aux.fill(0);
  np = 0; projs = []; units = []; planes = []; bh = null; pending = []; emitters.length = 0;
  kills[0] = kills[1] = 0; hadBoth = false;
}
function fillRect(x0, y0, w, h, t) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++)
    if (x >= 0 && x < W && y >= 0 && y < H) setCell(y * W + x, t);
}
function fillEllipse(cx, cy, rx, ry, t, onlyOver) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    if (dx * dx + dy * dy > 1) continue;
    const i = y * W + x;
    if (onlyOver != null && type[i] !== onlyOver) continue;
    if (t === 0) clearCell(i); else setCell(i, t);
  }
}
function genMap() {
  clearWorld();
  makeBg();
  const p0 = rnd() * 9, p1 = rnd() * 9, p2 = rnd() * 9;
  const hgt = new Float32Array(W);
  const basinX = ri(W * .42 | 0, W * .58 | 0), basinW = ri(18, 28), basinD = ri(8, 13);
  for (let x = 0; x < W; x++) {
    let h = H * .62 + Math.sin(x * .019 + p0) * 11 + Math.sin(x * .047 + p1) * 6 + Math.sin(x * .11 + p2) * 2;
    const bd = Math.abs(x - basinX) / basinW;
    if (bd < 1) h += (Math.cos(bd * Math.PI) + 1) / 2 * basinD;
    const edge = Math.min(x, W - 1 - x);
    if (edge < 80) h = h + (H * .6 - h) * (1 - edge / 80) * .8;
    hgt[x] = h;
  }
  for (let x = 0; x < W; x++) {
    const h = hgt[x], dirtD = 10 + Math.sin(x * .2) * 3;
    for (let y = Math.max(0, Math.floor(h)); y < H; y++) {
      const d = y - h;
      setCell(y * W + x, d < 1.5 ? T.GRASS : d < dirtD ? T.DIRT : T.STONE);
    }
  }
  // 동굴, 기름층, 용암 주머니, 모래층
  for (let k = 0; k < 3; k++) fillEllipse(ri(60, W - 60), ri(H * .8 | 0, H - 12), ri(8, 18), ri(4, 7), 0, T.STONE);
  const oilX = ri(90, W - 90), oilY = H - ri(14, 20);
  fillEllipse(oilX, oilY, 14, 5, 0, T.STONE);
  fillEllipse(oilX, oilY + 2, 14, 3, T.OIL, 0);
  fillEllipse(ri(30, W - 30), H - 4, ri(12, 22), 4, T.LAVA, T.STONE);
  for (let k = 0; k < 4; k++) fillEllipse(ri(20, W - 20), hgt[0] + ri(4, 12), ri(5, 10), ri(2, 4), T.SAND, T.DIRT);
  // 중앙 지하 TNT 저장고
  const tx = W / 2 + ri(-30, 30), ty = Math.floor(hgt[tx | 0] + 9);
  fillRect(tx - 4, ty, 8, 4, T.TNT);
  for (let x = tx - 4; x < tx + 4; x++) if (x % 3 === 0) for (let y = ty; y < ty + 4; y++) col[y * W + x] = rgb(240, 220, 200);
  // 호수
  const lvl = Math.min(hgt[basinX - basinW], hgt[basinX + basinW]) + 2;
  for (let x = basinX - basinW; x <= basinX + basinW; x++)
    for (let y = Math.ceil(lvl); y < H; y++) { const i = y * W + x; if (type[i] === 0) setCell(i, T.WATER); }
  // 벙커
  for (const team of [0, 1]) {
    const bx = team === 0 ? 34 : W - 34, gy = Math.floor(Math.min(hgt[bx - 12], hgt[bx], hgt[bx + 12]));
    const left = bx - 12, top = gy - 12, w = 24;
    fillRect(left, gy, w, 12, T.STONE);
    fillRect(left, top, w, 12, 0);
    fillRect(left, top, w, 2, T.METAL);
    const back = team === 0 ? left : left + w - 2, front = team === 0 ? left + w - 2 : left;
    fillRect(back, top, 2, 12, T.STONE);
    fillRect(front, top, 2, 3, T.STONE);
    fillRect(left + 4, top - 3, w - 8, 1, T.SAND);
  }
  // 무인지대 목재 바리케이드와 나무
  for (let k = 0; k < 4; k++) {
    const x = ri(95, W - 95);
    if (Math.abs(x - basinX) < basinW + 4) continue;
    const y = Math.floor(hgt[x]);
    fillRect(x, y - 6, 2, 6, T.WOOD);
  }
  for (let k = 0; k < 5; k++) {
    const x = ri(70, W - 70);
    if (Math.abs(x - basinX) < basinW + 6) continue;
    const y = Math.floor(hgt[x]), th = ri(8, 13);
    fillRect(x, y - th, 2, th, T.WOOD);
    fillEllipse(x + 1, y - th - 2, ri(4, 6), 3, T.LEAF, 0);
  }
  // 양측 군대
  for (const team of [0, 1]) {
    for (let k = 0; k < 11; k++) {
      const r = rnd(), kind = r < .5 ? 'rifle' : r < .65 ? 'grenadier' : r < .85 ? 'bazooka' : 'sniper';
      const x = team === 0 ? ri(8, 76) : W - ri(8, 76);
      spawnAtSurface(kind, team, x);
    }
    spawnAtSurface('tank', team, team === 0 ? 62 : W - 62);
  }
}
function spawnAtSurface(kind, team, x) {
  for (let y = 0; y < H; y++) if (solidAt(x, y)) return spawnUnit(kind, team, x, y - 1);
  return null;
}

// ───────────── 입력 ─────────────
const TOOLS = [
  { group: '재료', items: [
    { id: 'sand', name: '모래', mat: T.SAND }, { id: 'dirt', name: '흙', mat: T.DIRT },
    { id: 'stone', name: '돌', mat: T.STONE }, { id: 'metal', name: '강철', mat: T.METAL },
    { id: 'wood', name: '나무', mat: T.WOOD }, { id: 'water', name: '물', mat: T.WATER },
    { id: 'oil', name: '기름', mat: T.OIL }, { id: 'lava', name: '용암', mat: T.LAVA },
    { id: 'acid', name: '산성액', mat: T.ACID }, { id: 'powder', name: '화약', mat: T.POWDER },
    { id: 'tnt', name: 'TNT', mat: T.TNT }, { id: 'fire', name: '불', mat: T.FIRE },
    { id: 'erase', name: '지우개', mat: 0, sw: '#000' },
  ] },
  { group: '병력', items: [
    { id: 'rifle', name: '소총병', unit: 'rifle' }, { id: 'sniper', name: '저격병', unit: 'sniper' },
    { id: 'bazooka', name: '바주카병', unit: 'bazooka' }, { id: 'grenadier', name: '척탄병', unit: 'grenadier' },
    { id: 'tank', name: '전차', unit: 'tank' }, { id: 'grab', name: '잡아 던지기', sw: '#f2b33d' },
  ] },
  { group: '지원 화력', items: [
    { id: 'grenade', name: '수류탄', sling: 'grenade', sw: '#4c5a2a' },
    { id: 'cluster', name: '집속탄', sling: 'cluster', sw: '#7b6a3a' },
    { id: 'napalm', name: '네이팜', sling: 'napalm', sw: '#ff7a1e' },
    { id: 'missile', name: '미사일', click: 'missile', sw: '#c9c9c9' },
    { id: 'air', name: '공습', click: 'air', sw: '#8899aa' },
    { id: 'nuke', name: '핵폭탄', click: 'nuke', sw: '#f4e04d' },
    { id: 'bh', name: '블랙홀', click: 'bh', sw: '#6a3fd0' },
  ] },
];
const HINTS = {
  mat: '드래그해서 칠하기 · 우클릭으로 지우기 · [ ] 붓 크기',
  fire: '불을 붙이기 · 나무·기름·풀은 타고, 화약·TNT는 터진다',
  unit: '클릭하면 배치, 누르고 있으면 계속 배치 · 우클릭은 반대 팀',
  grab: '병사나 전차를 잡아서 던지기 · 세게 던지면 낙하 피해',
  sling: '누른 채 뒤로 당겼다 놓으면 발사 (새총 방식)',
  missile: '클릭한 곳에 미사일이 떨어진다',
  air: '클릭한 지점 위로 폭격기가 지나가며 폭탄을 떨어뜨린다',
  nuke: '클릭한 곳에 핵폭탄 투하 · 반경 안 모든 것이 증발한다',
  bh: '클릭한 곳에 블랙홀 생성 · 지형과 병사를 빨아들이고 붕괴한다',
};
let tool = TOOLS[1].items[0], team = 0, brush = 4, paused = false, slow = false, auto = true;
const mouse = { x: 0, y: 0, lx: 0, ly: 0, down: false, btn: 0, sx: 0, sy: 0, inside: false, hold: 0, hist: [] };
const grab = { unit: null };

function toolHint() {
  if (tool.mat === T.FIRE) return HINTS.fire;
  if (tool.mat != null) return HINTS.mat;
  if (tool.unit) return HINTS.unit;
  if (tool.id === 'grab') return HINTS.grab;
  if (tool.sling) return HINTS.sling;
  return HINTS[tool.click];
}
function buildUI() {
  const nav = document.getElementById('tools');
  nav.innerHTML = '';
  for (const g of TOOLS) {
    const gr = document.createElement('div'); gr.className = 'group';
    const h = document.createElement('h2'); h.textContent = g.group; gr.appendChild(h);
    const row = document.createElement('div'); row.className = 'row';
    for (const it of g.items) {
      const b = document.createElement('button'); b.className = 'tool'; b.id = 'tool-' + it.id;
      const sw = document.createElement('span'); sw.className = 'sw';
      if (it.sw) sw.style.background = it.sw;
      else if (it.mat != null) { const c = PAL[it.mat][0]; sw.style.background = `rgb(${c[0]},${c[1]},${c[2]})`; }
      else if (it.unit) sw.style.background = 'var(--red)';
      b.append(sw, document.createTextNode(it.name));
      b.onclick = () => { tool = it; refreshUI(); };
      row.appendChild(b);
    }
    gr.appendChild(row);
    if (g.group === '재료') {
      const s = document.createElement('label'); s.className = 'size';
      s.innerHTML = '붓 <input id="brush" type="range" min="1" max="14" value="4">';
      gr.appendChild(s);
    }
    if (g.group === '병력') {
      const r2 = document.createElement('div'); r2.className = 'row';
      for (const [t, n] of [[0, '레드 팀'], [1, '블루 팀']]) {
        const b = document.createElement('button'); b.id = 'team-' + t; b.textContent = n;
        b.onclick = () => { team = t; refreshUI(); };
        r2.appendChild(b);
      }
      gr.appendChild(r2);
    }
    nav.appendChild(gr);
  }
  document.getElementById('brush').oninput = e => { brush = +e.target.value; };
  refreshUI();
}
function refreshUI() {
  document.querySelectorAll('.tool').forEach(b => b.classList.toggle('on', b.id === 'tool-' + tool.id));
  for (const t of [0, 1]) document.getElementById('team-' + t).classList.toggle('on', team === t);
  for (const it of TOOLS[1].items) if (it.unit)
    document.querySelector('#tool-' + it.id + ' .sw').style.background = team === 0 ? 'var(--red)' : 'var(--blue)';
  document.getElementById('btnPause').classList.toggle('on', paused);
  document.getElementById('btnPause').textContent = paused ? '계속' : '일시정지';
  document.getElementById('btnSlow').classList.toggle('on', slow);
  document.getElementById('btnAuto').classList.toggle('on', auto);
  document.getElementById('btnSound').textContent = muted ? '소리 꺼짐' : '소리 켜짐';
  document.getElementById('hint').textContent = toolHint();
  const bi = document.getElementById('brush'); if (bi) bi.value = brush;
}
function toGrid(e) {
  const r = cv.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) / r.width * W;
  mouse.y = (e.clientY - r.top) / r.height * H;
}
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  initAudio();
  cv.setPointerCapture(e.pointerId);
  toGrid(e);
  mouse.down = true; mouse.btn = e.button; mouse.sx = mouse.x; mouse.sy = mouse.y;
  mouse.lx = mouse.x; mouse.ly = mouse.y; mouse.hold = 0; mouse.hist = [];
  onDown();
  e.preventDefault();
});
cv.addEventListener('pointermove', e => { toGrid(e); mouse.inside = true; });
cv.addEventListener('pointerleave', () => { mouse.inside = false; });
const endPointer = e => { if (!mouse.down) return; toGrid(e); onUp(); mouse.down = false; };
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);

function onDown() {
  const x = mouse.x, y = mouse.y;
  if (tool.unit) { placeUnit(); return; }
  if (tool.id === 'grab') {
    let best = null, bd = 12;
    for (const u of units) {
      if (u.dead) continue;
      const d = Math.hypot(u.x - x, (u.y - u.h / 2) - y);
      if (d < bd) { bd = d; best = u; }
    }
    grab.unit = best;
    return;
  }
  if (tool.click === 'missile') {
    const sx = x + ri(-50, 50), sy = -8, dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy);
    addProj('missile', sx, sy, dx / d * 5, dy / d * 5, -1); sfxWhoosh();
  } else if (tool.click === 'air') callAirstrike(x);
  else if (tool.click === 'nuke') { addProj('nuke', x, -10, 0, 1.5, -1); sfxWhoosh(); }
  else if (tool.click === 'bh') { if (bh) { const b = bh; bh = null; explode(b.x, b.y, 14, {}); } bh = { x, y, t: 330, R: 30 }; }
}
function slingVel() {
  let vx = (mouse.sx - mouse.x) * .1, vy = (mouse.sy - mouse.y) * .1;
  const s = Math.hypot(vx, vy);
  if (s > 8) { vx *= 8 / s; vy *= 8 / s; }
  return [vx, vy];
}
function onUp() {
  if (tool.sling) {
    const [vx, vy] = slingVel();
    addProj(tool.sling, mouse.sx, mouse.sy, vx, vy, -1, tool.sling === 'grenade' ? { fuse: 110 } : null);
    sfxWhoosh();
  }
  if (tool.id === 'grab' && grab.unit) {
    const u = grab.unit, h = mouse.hist, a = h[0] || { x: mouse.x, y: mouse.y }, n = Math.max(1, h.length - 1);
    u.vx = clamp((mouse.x - a.x) / n * 1.2, -9, 9);
    u.vy = clamp((mouse.y - a.y) / n * 1.2, -9, 9);
    u.stun = 60;
    grab.unit = null;
  }
}
function placeUnit() {
  const t = mouse.btn === 2 ? 1 - team : team;
  const x = clamp(mouse.x, 4, W - 5), y = clamp(mouse.y, 8, H - 1);
  spawnUnit(tool.unit, t, x, y);
}
function paintCircle(cx, cy, r, mat) {
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dy * dy > r * r) continue;
    const x = Math.floor(cx + dx), y = Math.floor(cy + dy);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const i = y * W + x;
    if (mat === 0) { clearCell(i); continue; }
    if (mat === T.FIRE) {
      if (FLAM[type[i]] > 0) ignite(i);
      else if (type[i] === 0 && rnd() < .25) setFire(i, ri(10, 30), 0);
      continue;
    }
    if (type[i] !== 0 && KIND[type[i]] !== GAS) continue;
    const k = KIND[mat];
    if ((k === POWD || k === LIQ) && rnd() > .4) continue;
    setCell(i, mat);
    if (mat === T.TNT && x % 3 === 0) col[i] = rgb(236, 220, 200);
  }
}
function handleInput() {
  if (!mouse.down) return;
  mouse.hist.push({ x: mouse.x, y: mouse.y });
  if (mouse.hist.length > 5) mouse.hist.shift();
  mouse.hold++;
  if (tool.mat != null) {
    const mat = mouse.btn === 2 ? 0 : tool.mat;
    const dx = mouse.x - mouse.lx, dy = mouse.y - mouse.ly, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / Math.max(1, brush * .5)));
    for (let s = 1; s <= n; s++) paintCircle(mouse.lx + dx * s / n, mouse.ly + dy * s / n, brush, mat);
  } else if (tool.unit && mouse.hold > 20 && mouse.hold % (tool.unit === 'tank' ? 40 : 10) === 0) {
    placeUnit();
  } else if (grab.unit) {
    const u = grab.unit;
    u.x = clamp(mouse.x, 1, W - 2); u.y = clamp(mouse.y + u.h / 2, u.h, H - 1);
    u.vx = u.vy = 0; u.stun = 30;
  }
  mouse.lx = mouse.x; mouse.ly = mouse.y;
}
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { paused = !paused; e.preventDefault(); }
  else if (e.key === 's' || e.key === 'S') slow = !slow;
  else if (e.key === 'a' || e.key === 'A') auto = !auto;
  else if (e.key === 'r' || e.key === 'R') genMap();
  else if (e.key === '[') brush = Math.max(1, brush - 1);
  else if (e.key === ']') brush = Math.min(14, brush + 1);
  else return;
  refreshUI();
});
document.getElementById('btnPause').onclick = () => { paused = !paused; refreshUI(); };
document.getElementById('btnSlow').onclick = () => { slow = !slow; refreshUI(); };
document.getElementById('btnAuto').onclick = () => { auto = !auto; refreshUI(); };
document.getElementById('btnNew').onclick = () => { genMap(); };
document.getElementById('btnEmpty').onclick = () => {
  clearWorld(); makeBg();
  for (let x = 0; x < W; x++) for (let y = H - 6; y < H; y++) setCell(y * W + x, y === H - 6 ? T.GRASS : T.DIRT);
};
document.getElementById('btnSound').onclick = () => { initAudio(); muted = !muted; refreshUI(); };

// ───────────── HUD / 증원 / 승리 ─────────────
let hadBoth = false, bannerT = 0;
const $ = id => document.getElementById(id);
function hud() {
  let r = 0, b = 0;
  for (const u of units) if (!u.dead) { if (u.team === 0) r++; else b++; }
  $('rAlive').textContent = r; $('bAlive').textContent = b;
  $('rKills').textContent = kills[0]; $('bKills').textContent = kills[1];
  if (r > 0 && b > 0) hadBoth = true;
  else if (hadBoth && !auto && (r > 0 || b > 0)) {
    hadBoth = false;
    const ban = $('banner');
    ban.textContent = r > 0 ? '레드 승리' : '블루 승리';
    ban.style.color = r > 0 ? 'var(--red)' : 'var(--blue)';
    ban.hidden = false; bannerT = 200;
  }
  return [r, b];
}
function reinforce() {
  const [r, b] = hud();
  for (const t of [0, 1]) {
    if ((t === 0 ? r : b) >= 22) continue;
    const q = rnd(), kind = q < .08 ? 'tank' : q < .5 ? 'rifle' : q < .65 ? 'grenadier' : q < .85 ? 'bazooka' : 'sniper';
    spawnAtSurface(kind, t, t === 0 ? ri(4, 24) : W - ri(5, 25));
  }
}

// ───────────── 메인 스텝 ─────────────
function step() {
  tick++;
  shotBudget = 2; boomBudget = 3;
  for (let k = pending.length - 1; k >= 0; k--) {
    const p = pending[k];
    if (--p.t <= 0) { pending.splice(k, 1); explode(p.x, p.y, p.r, p.o); }
  }
  stepGrid();
  updParticles();
  const cur = projs; projs = [];
  for (const p of cur) if (updProj(p)) projs.push(p);
  for (const u of units) if (!u.dead) updUnit(u);
  units = units.filter(u => !u.dead);
  updPlanes();
  updBlackhole();
  updEmitters();
  if (auto && tick % 150 === 0) reinforce();
  if (tick % 15 === 0) hud();
}

// ───────────── 렌더링 ─────────────
const TEAMC = [[rgb(214, 62, 52), rgb(140, 34, 28)], [rgb(64, 118, 226), rgb(34, 66, 146)]];
const SKIN = rgb(236, 190, 150), BOOT = rgb(36, 32, 30), GUN = rgb(44, 44, 48), OLIVE = rgb(84, 100, 52),
  YEL = rgb(255, 236, 140), TRACK = rgb(40, 40, 44), WHEEL = rgb(96, 96, 100);
function put(x, y, c) { x |= 0; y |= 0; if (x >= 0 && x < W && y >= 0 && y < H) buf[y * W + x] = c; }
function hpBar(u, x, y, w) {
  if (u.hp >= u.maxhp) return;
  const f = clamp(u.hp / u.maxhp, 0, 1), fill = Math.round(f * w);
  for (let k = 0; k < w; k++) put(x + k, y, k < fill ? rgb(90, 220, 90) : rgb(90, 24, 24));
}
function drawSoldier(u) {
  const x = Math.round(u.x), y = Math.round(u.y), f = u.face, c = TEAMC[u.team][0], cd = TEAMC[u.team][1];
  const X = dx => f === 1 ? x + dx : x - 1 - dx;
  if (u.stun > 0 && (!u.grounded || u.stun > 15)) {
    // 넉백 중: 누운 자세
    const dir = u.vx >= 0 ? 1 : -1, seq = [BOOT, BOOT, cd, c, c, c, SKIN, cd];
    for (let k = 0; k < 8; k++) { put(x - 4 * dir + k * dir, y - 1, seq[k]); if (k > 1 && k < 6) put(x - 4 * dir + k * dir, y - 2, c); }
  } else {
    put(X(-1), y - 6, cd); put(X(0), y - 6, cd);
    put(X(-1), y - 5, cd); put(X(0), y - 5, SKIN);
    for (let r = 4; r >= 2; r--) { put(X(-1), y - r, c); put(X(0), y - r, c); }
    put(X(-1), y - 1, cd); put(X(0), y - 1, cd);
    const stride = u.vx !== 0 && ((u.walk * 2) | 0) & 1;
    if (stride) { put(X(-2), y, BOOT); put(X(1), y, BOOT); } else { put(X(-1), y, BOOT); put(X(0), y, BOOT); }
    if (u.kind === 'rifle') { put(X(1), y - 4, GUN); put(X(2), y - 4, GUN); }
    else if (u.kind === 'sniper') { for (let k = 1; k <= 4; k++) put(X(k), y - 4, GUN); put(X(2), y - 5, GUN); }
    else if (u.kind === 'bazooka') { for (let k = -2; k <= 2; k++) put(X(k), y - 5, OLIVE); put(X(-1), y - 6, cd); }
    else if (u.kind === 'grenadier') { put(X(1), y - 3, OLIVE); put(X(1), y - 4, SKIN); }
  }
  if (u.burn > 0 && rnd() < .7) put(x + ri(-1, 1), y - 7 - ri(0, 1), makeColor(T.FIRE));
  hpBar(u, x - 2, y - 8, 4);
}
function drawTank(u) {
  const x = Math.round(u.x), y = Math.round(u.y), c = TEAMC[u.team][0], cd = TEAMC[u.team][1];
  const wo = (u.walk * 3) | 0;
  for (let dx = -5; dx <= 5; dx++) put(x + dx, y, TRACK);
  for (let dx = -6; dx <= 6; dx++) put(x + dx, y - 1, ((dx + wo) % 3 + 3) % 3 === 0 ? WHEEL : TRACK);
  for (let dx = -6; dx <= 6; dx++) { put(x + dx, y - 2, cd); put(x + dx, y - 3, c); }
  for (let dx = -5; dx <= 5; dx++) put(x + dx, y - 4, c);
  for (let dx = -2; dx <= 2; dx++) put(x + dx, y - 5, cd);
  for (let dx = -1; dx <= 2; dx++) put(x + dx * u.face, y - 6, cd);
  const ca = Math.cos(u.aim), sa = Math.sin(u.aim);
  for (let s = 2; s <= 8; s++) put(Math.round(x + ca * s), Math.round(y - 6 + sa * s), GUN);
  if (u.burn > 0 && rnd() < .7) put(x + ri(-5, 5), y - 7, makeColor(T.FIRE));
  hpBar(u, x - 5, y - 9, 11);
}
function drawProj(p) {
  const x = Math.floor(p.x), y = Math.floor(p.y);
  switch (p.kind) {
    case 'bullet': put(x, y, YEL); put(x - p.vx * .4, y - p.vy * .4, rgb(255, 190, 80)); break;
    case 'rocket': case 'missile': {
      const s = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / s, uy = p.vy / s;
      put(x, y, rgb(210, 210, 210)); put(x - ux, y - uy, GUN); put(x - ux * 2, y - uy * 2, GUN);
      put(x - ux * 3, y - uy * 3, makeColor(T.FIRE));
      if (p.kind === 'missile') { put(x - ux * 4, y - uy * 4, GUN); put(x + 1, y - 2, GUN); put(x - 1, y - 2, GUN); }
      break;
    }
    case 'grenade': case 'bomblet':
      put(x, y, p.fuse < 30 && tick % 6 < 3 ? rgb(255, 60, 40) : OLIVE);
      if (p.kind === 'grenade') put(x, y - 1, GUN);
      break;
    case 'cluster': case 'napalm': {
      const c = p.kind === 'napalm' ? rgb(255, 122, 30) : rgb(123, 106, 58);
      put(x, y, c); put(x + 1, y, c); put(x, y - 1, c); put(x + 1, y - 1, GUN);
      break;
    }
    case 'shell': put(x, y, rgb(230, 226, 200)); break;
    case 'bomb': for (let k = 0; k < 3; k++) { put(x, y - k, GUN); put(x + 1, y - k, GUN); } put(x, y - 3, OLIVE); break;
    case 'nuke':
      for (let dy = 0; dy < 5; dy++) for (let dx = -1; dx <= 1; dx++) put(x + dx, y - dy, dy === 2 ? rgb(244, 224, 77) : rgb(60, 60, 50));
      put(x - 2, y - 4, GUN); put(x + 2, y - 4, GUN);
      break;
  }
}
function drawPlane(p) {
  const x = Math.round(p.x), y = Math.round(p.y), d = Math.sign(p.vx), c = rgb(150, 160, 172), dk = rgb(90, 98, 110);
  for (let k = -7; k <= 6; k++) put(x + k * d, y, c);
  for (let k = -6; k <= 5; k++) put(x + k * d, y - 1, c);
  put(x - 7 * d, y - 2, dk); put(x - 7 * d, y - 3, dk); put(x - 6 * d, y - 2, dk);
  for (let k = -1; k <= 2; k++) put(x + k * d, y + 1, dk);
  put(x + 4 * d, y - 2, rgb(120, 200, 240)); put(x + 7 * d, y, dk);
}
let sc = 2, cssW = 0;
function resize() {
  const st = document.getElementById('stage');
  const dpr = window.devicePixelRatio || 1;
  const cw = st.clientWidth * dpr, ch = st.clientHeight * dpr;
  const fit = Math.min(cw / W, ch / H);
  sc = Math.max(1, fit);
  cv.width = Math.round(W * sc); cv.height = Math.round(H * sc);
  cv.style.width = (W * sc / dpr) + 'px'; cv.style.height = (H * sc / dpr) + 'px';
  cssW = W * sc / dpr;
}
window.addEventListener('resize', resize);
function render() {
  for (let i = 0; i < N; i++) buf[i] = type[i] ? col[i] : bg[i];
  for (let i = 0; i < np; i++) {
    const x = px[i] | 0, y = py[i] | 0;
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    if (ptype[i] === SPARK) {
      const l = plife[i];
      buf[y * W + x] = l > 14 ? rgb(255, 250, 200) : l > 7 ? rgb(255, 190, 60) : rgb(230, 90, 30);
    } else buf[y * W + x] = pcol[i];
  }
  for (const p of projs) drawProj(p);
  for (const u of units) if (u.kind === 'tank') drawTank(u); else drawSoldier(u);
  for (const p of planes) drawPlane(p);
  octx.putImageData(img, 0, 0);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.imageSmoothingEnabled = false;
  const sx = shake > .3 ? (rnd() - .5) * shake * sc : 0, sy = shake > .3 ? (rnd() - .5) * shake * sc : 0;
  ctx.drawImage(off, sx, sy, W * sc, H * sc);

  if (bh) {
    const x = bh.x * sc, y = bh.y * sc, r = bh.R * sc;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.18, 'rgba(0,0,0,1)');
    g.addColorStop(.25, 'rgba(160,110,255,.8)'); g.addColorStop(.5, 'rgba(90,40,180,.25)'); g.addColorStop(1, 'rgba(40,0,80,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let k = flashes.length - 1; k >= 0; k--) {
    const f = flashes[k], x = f.x * sc, y = f.y * sc, r = f.r * sc, a = Math.min(1, f.a);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,236,170,${.85 * a})`); g.addColorStop(.4, `rgba(255,140,50,${.35 * a})`); g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    f.a -= .07;
    if (f.a <= 0) flashes.splice(k, 1);
  }
  ctx.globalCompositeOperation = 'source-over';
  if (whiteFlash > 0) { ctx.fillStyle = `rgba(255,252,235,${whiteFlash})`; ctx.fillRect(0, 0, cv.width, cv.height); whiteFlash -= .025; }

  // 커서 오버레이
  ctx.lineWidth = Math.max(1, sc / 2);
  if (tool.sling && mouse.down) {
    const [vx0, vy0] = slingVel(), g = G[tool.sling];
    let x = mouse.sx, y = mouse.sy, vx = vx0, vy = vy0;
    ctx.fillStyle = 'rgba(242,179,61,.9)';
    for (let k = 0; k < 90; k++) {
      vy += g; x += vx; y += vy;
      if (x < 0 || x >= W || y >= H || solidAt(x | 0, y | 0)) break;
      if (k % 3 === 0) ctx.fillRect(x * sc - sc / 2, y * sc - sc / 2, sc, sc);
    }
    ctx.strokeStyle = 'rgba(242,179,61,.5)';
    ctx.beginPath(); ctx.moveTo(mouse.sx * sc, mouse.sy * sc); ctx.lineTo(mouse.x * sc, mouse.y * sc); ctx.stroke();
  } else if (mouse.inside && tool.mat != null) {
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.arc(mouse.x * sc, mouse.y * sc, brush * sc, 0, Math.PI * 2); ctx.stroke();
  } else if (mouse.inside && (tool.click || tool.id === 'grab')) {
    ctx.strokeStyle = tool.id === 'grab' ? 'rgba(242,179,61,.8)' : 'rgba(255,80,60,.8)';
    const x = mouse.x * sc, y = mouse.y * sc, r = 4 * sc;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.moveTo(x - r * 1.6, y); ctx.lineTo(x + r * 1.6, y); ctx.moveTo(x, y - r * 1.6); ctx.lineTo(x, y + r * 1.6); ctx.stroke();
  }
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, cv.width, 14 * sc);
    ctx.fillStyle = '#f2b33d'; ctx.font = `${8 * sc}px "Black Han Sans", sans-serif`; ctx.textBaseline = 'top';
    ctx.fillText('일시정지', 6 * sc, 3 * sc);
  }
}

// ───────────── 루프 ─────────────
let last = performance.now(), acc = 0;
const DT = 1000 / 60;
function loop(now) {
  let dt = now - last; last = now;
  if (dt > 100) dt = 100;
  handleInput();
  if (!paused) {
    acc += dt * (slow ? .3 : 1);
    let n = 0;
    while (acc >= DT && n < 3) { step(); acc -= DT; n++; }
    if (n === 3) acc = 0;
  }
  shake *= .88;
  if (bannerT > 0 && --bannerT === 0) document.getElementById('banner').hidden = true;
  render();
  requestAnimationFrame(loop);
}

buildUI();
resize();
genMap();
hud();
requestAnimationFrame(t => { last = t; loop(t); });
// 디버그/테스트용
window.__pf = { get units() { return units; }, get np() { return np; }, explode, step, kills };
})();
