'use strict';
// ─────────────────────────────────────────────────────────────
//  복셀 월드: 데이터, 지형 생성, 청크 메싱(AO), 레이캐스트, 구조 붕괴
// ─────────────────────────────────────────────────────────────
const SX = 192, SY = 64, SZ = 192, CS = 16;
const CX = SX / CS, CY = SY / CS, CZ = SZ / CS;
const WATER_Y = 11.6;
const GRAV = 26;
const vox = new Uint8Array(SX * SY * SZ);
const vtint = new Uint8Array(SX * SY * SZ);
const vidx = (x, y, z) => (y * SZ + z) * SX + x;

const M = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WOOD: 5, LEAF: 6, BRICK: 7, CONCRETE: 8,
  METAL: 9, TNT: 10, BEDROCK: 11, SANDBAG: 12, PLANK: 13, ROOF: 14 };
const MAT = [];
function defMat(id, name, col, hard, flam, jit) { MAT[id] = { id, name, col, hard, flam, jit }; }
defMat(0, '공기', [0, 0, 0], 0, 0, 0);
defMat(1, '풀', [94, 138, 60], .12, 0, .08);
defMat(2, '흙', [120, 86, 58], .15, 0, .06);
defMat(3, '바위', [124, 124, 128], .55, 0, .07);
defMat(4, '모래', [214, 190, 132], .06, 0, .05);
defMat(5, '나무', [98, 66, 40], .25, .03, .06);
defMat(6, '잎', [58, 112, 50], .04, .07, .13);
defMat(7, '벽돌', [156, 76, 58], .38, 0, .05);
defMat(8, '콘크리트', [170, 168, 160], .5, 0, .035);
defMat(9, '강철', [92, 100, 112], .85, 0, .03);
defMat(10, 'TNT', [200, 42, 36], .05, 1, .03);
defMat(11, '기반암', [48, 46, 50], 9, 0, .05);
defMat(12, '모래주머니', [168, 150, 106], .3, 0, .07);
defMat(13, '판자', [150, 108, 64], .2, .03, .06);
defMat(14, '지붕', [132, 56, 44], .3, 0, .05);

const S2L = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; S2L[i] = c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }

function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let wrand = Math.random;

// 물리용: 맵 밖(수평)과 바닥 아래는 막힘
function solidAt(x, y, z) {
  if (y < 0) return true;
  if (x < 0 || x >= SX || z < 0 || z >= SZ) return true;
  if (y >= SY) return false;
  return vox[vidx(x, y, z)] !== 0;
}
function getV(x, y, z) {
  if (x < 0 || x >= SX || z < 0 || z >= SZ || y < 0 || y >= SY) return 0;
  return vox[vidx(x, y, z)];
}
function surfaceY(x, z) {
  x = Math.max(0, Math.min(SX - 1, Math.floor(x))); z = Math.max(0, Math.min(SZ - 1, Math.floor(z)));
  for (let y = SY - 1; y >= 0; y--) if (vox[vidx(x, y, z)]) return y + 1;
  return 0;
}

// (x,z) 열에서 y 아래로 처음 만나는 땅 높이
function groundBelow(x, y, z) {
  x = Math.floor(x); z = Math.floor(z);
  if (x < 0 || x >= SX || z < 0 || z >= SZ) return 0;
  for (let yy = Math.min(SY - 1, Math.floor(y)); yy >= 0; yy--) if (vox[vidx(x, yy, z)]) return yy + 1;
  return 0;
}
const NATURAL = new Set([1, 2, 3, 4]);
function naturalTop(x, z) {
  const y = surfaceY(x, z);
  return NATURAL.has(getV(Math.floor(x), y - 1, Math.floor(z)));
}

// ───────────── 청크 ─────────────
const chunkDirty = new Uint8Array(CX * CY * CZ);
const chunkMeshes = new Array(CX * CY * CZ).fill(null);
let dirtyCount = 0;
function markChunk(cx, cy, cz) {
  if (cx < 0 || cx >= CX || cy < 0 || cy >= CY || cz < 0 || cz >= CZ) return;
  const i = (cy * CZ + cz) * CX + cx;
  if (!chunkDirty[i]) { chunkDirty[i] = 1; dirtyCount++; }
}
const colDirty = new Uint8Array(SX * SZ).fill(1);
function markDirty(x, y, z) {
  colDirty[z * SX + x] = 1;
  const cx = (x / CS) | 0, cy = (y / CS) | 0, cz = (z / CS) | 0;
  markChunk(cx, cy, cz);
  const lx = x - cx * CS, ly = y - cy * CS, lz = z - cz * CS;
  if (lx === 0) markChunk(cx - 1, cy, cz); else if (lx === CS - 1) markChunk(cx + 1, cy, cz);
  if (ly === 0) markChunk(cx, cy - 1, cz); else if (ly === CS - 1) markChunk(cx, cy + 1, cz);
  if (lz === 0) markChunk(cx, cy, cz - 1); else if (lz === CS - 1) markChunk(cx, cy, cz + 1);
}
function setVox(x, y, z, t) {
  if (x < 0 || x >= SX || y < 0 || y >= SY || z < 0 || z >= SZ) return;
  const i = vidx(x, y, z);
  if (vox[i] === t) return;
  vox[i] = t;
  if (t === 0) { vtint[i] = 0; if (y + 1 < SY && vox[i + SX * SZ] === M.SAND) sandQueue.add(i + SX * SZ); }
  else if (t === M.SAND) sandQueue.add(i);
  markDirty(x, y, z);
}

// 면 정의: 법선, 꼭짓점(바깥에서 봤을 때 반시계)
const FACES = [
  { n: [1, 0, 0], v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], v: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], v: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], v: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 0, -1], v: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];
const FACE_SHADE = [.86, .86, 1, .55, .93, .93];
for (const f of FACES) {
  f.ao = f.v.map(c => {
    const s = [];
    for (let a = 0; a < 3; a++) if (f.n[a] === 0) { const o = [0, 0, 0]; o[a] = c[a] ? 1 : -1; s.push(o); }
    return [
      [f.n[0] + s[0][0], f.n[1] + s[0][1], f.n[2] + s[0][2]],
      [f.n[0] + s[1][0], f.n[1] + s[1][1], f.n[2] + s[1][2]],
      [f.n[0] + s[0][0] + s[1][0], f.n[1] + s[0][1] + s[1][1], f.n[2] + s[0][2] + s[1][2]],
    ];
  });
}
const AO_CURVE = [.42, .62, .82, 1];

// 복셀 색 (선형 RGB를 out에 기록)
const _c = [0, 0, 0];
function voxColor(t, x, y, z, face, tint) {
  const m = MAT[t];
  let r = m.col[0], g = m.col[1], b = m.col[2];
  const h = hash3(x, y, z);
  if (t === M.GRASS) {
    if (face !== 2) {
      const d = MAT[M.DIRT].col;
      const k = face === 3 ? 1 : .55;
      r = r + (d[0] - r) * k; g = g + (d[1] - g) * k; b = b + (d[2] - b) * k;
    } else if (h > .93) { r = 126; g = 148; b = 70; } else if (h < .08) { r = 82; g = 118; b = 54; }
  } else if (t === M.BRICK) {
    const row = y & 1, brick = ((x + z + row * 2) >> 1) & 1;
    if (brick) { r *= .9; g *= .9; b *= .9; }
  } else if (t === M.TNT) {
    if (face === 2 || face === 3) { r = 70; g = 46; b = 34; }
    else if (y % 3 === 1) { r = 232; g = 224; b = 204; }
  } else if (t === M.CONCRETE) {
    if (y % 4 === 0) { r *= .9; g *= .9; b *= .9; }
  } else if (t === M.PLANK) {
    if (((face < 2 ? z : x) + y) % 3 === 0) { r *= .86; g *= .86; b *= .86; }
  } else if (t === M.LEAF && h > .8) { r = 74; g = 140; b = 58; }
  const j = 1 + (h - .5) * 2 * m.jit;
  r *= j; g *= j; b *= j;
  if (tint) {
    if (tint >= 200) { r = r * .55 + 92 * .45; g = g * .55 + 22 * .45; b = b * .55 + 18 * .45; }
    else { const k = 1 - Math.min(tint, 120) / 120 * .62; r = r * k + 6 * (1 - k); g = g * k * .97 + 5 * (1 - k); b = b * k * .93 + 4 * (1 - k); }
  }
  _c[0] = S2L[Math.max(0, Math.min(255, r | 0))];
  _c[1] = S2L[Math.max(0, Math.min(255, g | 0))];
  _c[2] = S2L[Math.max(0, Math.min(255, b | 0))];
  return _c;
}

// 메싱 버퍼 (재사용)
const MAXF = 60000;
const mPos = new Float32Array(MAXF * 12), mNor = new Float32Array(MAXF * 12), mCol = new Float32Array(MAXF * 12);
const mIdx = new Uint32Array(MAXF * 6);

// get(x,y,z) → 타입, 범위 [x0,x1) …에 대해 메시 생성. offset은 정점 좌표에 더함
function meshRegion(get, tintGet, x0, y0, z0, x1, y1, z1, ox, oy, oz, edgeOpaqueBottom) {
  let nf = 0;
  for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
    const t = get(x, y, z);
    if (!t) continue;
    const tint = tintGet ? tintGet(x, y, z) : 0;
    for (let f = 0; f < 6; f++) {
      const F = FACES[f];
      const nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2];
      if (edgeOpaqueBottom && ny < 0) continue;
      if (get(nx, ny, nz)) continue;
      if (nf >= MAXF) break;
      const col = voxColor(t, x, y, z, f, tint);
      const cr = col[0] * FACE_SHADE[f], cg = col[1] * FACE_SHADE[f], cb = col[2] * FACE_SHADE[f];
      const base = nf * 12;
      let a0 = 0, a1 = 0, a2 = 0, a3 = 0;
      for (let k = 0; k < 4; k++) {
        const vv = F.v[k], ao = F.ao[k];
        const s1 = get(x + ao[0][0], y + ao[0][1], z + ao[0][2]) ? 1 : 0;
        const s2 = get(x + ao[1][0], y + ao[1][1], z + ao[1][2]) ? 1 : 0;
        const cc = get(x + ao[2][0], y + ao[2][1], z + ao[2][2]) ? 1 : 0;
        const a = s1 && s2 ? 0 : 3 - s1 - s2 - cc;
        if (k === 0) a0 = a; else if (k === 1) a1 = a; else if (k === 2) a2 = a; else a3 = a;
        const sh = AO_CURVE[a], o = base + k * 3;
        mPos[o] = x + vv[0] + ox; mPos[o + 1] = y + vv[1] + oy; mPos[o + 2] = z + vv[2] + oz;
        mNor[o] = F.n[0]; mNor[o + 1] = F.n[1]; mNor[o + 2] = F.n[2];
        mCol[o] = cr * sh; mCol[o + 1] = cg * sh; mCol[o + 2] = cb * sh;
      }
      const vi = nf * 4, ii = nf * 6;
      if (a0 + a2 < a1 + a3) {
        mIdx[ii] = vi + 1; mIdx[ii + 1] = vi + 2; mIdx[ii + 2] = vi + 3;
        mIdx[ii + 3] = vi + 1; mIdx[ii + 4] = vi + 3; mIdx[ii + 5] = vi;
      } else {
        mIdx[ii] = vi; mIdx[ii + 1] = vi + 1; mIdx[ii + 2] = vi + 2;
        mIdx[ii + 3] = vi; mIdx[ii + 4] = vi + 2; mIdx[ii + 5] = vi + 3;
      }
      nf++;
    }
  }
  if (!nf) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mPos.slice(0, nf * 12), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(mNor.slice(0, nf * 12), 3));
  g.setAttribute('color', new THREE.BufferAttribute(mCol.slice(0, nf * 12), 3));
  g.setIndex(new THREE.BufferAttribute(mIdx.slice(0, nf * 6), 1));
  g.computeBoundingSphere();
  return g;
}
const worldGet = (x, y, z) => {
  if (y < 0) return 11;
  if (x < 0 || x >= SX || z < 0 || z >= SZ || y >= SY) return 0;
  return vox[vidx(x, y, z)];
};
const worldTint = (x, y, z) => vtint[vidx(x, y, z)];
let voxMaterial = null, worldGroup = null;
function buildChunk(ci) {
  const cx = ci % CX, cz = ((ci / CX) | 0) % CZ, cy = (ci / (CX * CZ)) | 0;
  const g = meshRegion(worldGet, worldTint, cx * CS, cy * CS, cz * CS, cx * CS + CS, cy * CS + CS, cz * CS + CS, 0, 0, 0, true);
  let m = chunkMeshes[ci];
  if (!g) {
    if (m) { worldGroup.remove(m); m.geometry.dispose(); chunkMeshes[ci] = null; }
    return;
  }
  if (!m) {
    m = new THREE.Mesh(g, voxMaterial);
    m.castShadow = true; m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    worldGroup.add(m);
    chunkMeshes[ci] = m;
  } else { m.geometry.dispose(); m.geometry = g; }
}
function rebuildDirty(budgetMs) {
  if (!dirtyCount) return;
  const t0 = performance.now();
  for (let i = 0; i < chunkDirty.length; i++) {
    if (!chunkDirty[i]) continue;
    chunkDirty[i] = 0; dirtyCount--;
    buildChunk(i);
    if (performance.now() - t0 > budgetMs) break;
  }
}
function rebuildAll() {
  colDirty.fill(1);
  for (let i = 0; i < chunkDirty.length; i++) { chunkDirty[i] = 0; buildChunk(i); }
  dirtyCount = 0;
}

// ───────────── 레이캐스트 (DDA) ─────────────
const _hit = { x: 0, y: 0, z: 0, t: 0, nx: 0, ny: 0, nz: 0, v: 0 };
function raycast(ox, oy, oz, dx, dy, dz, maxT) {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity, tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tmx = dx > 0 ? (x + 1 - ox) * tdx : dx < 0 ? (ox - x) * tdx : Infinity;
  let tmy = dy > 0 ? (y + 1 - oy) * tdy : dy < 0 ? (oy - y) * tdy : Infinity;
  let tmz = dz > 0 ? (z + 1 - oz) * tdz : dz < 0 ? (oz - z) * tdz : Infinity;
  let t = 0, nx = 0, ny = 0, nz = 0;
  for (let it = 0; it < 1200; it++) {
    if (x >= 0 && x < SX && z >= 0 && z < SZ && y >= 0 && y < SY) {
      const v = vox[vidx(x, y, z)];
      if (v) { _hit.x = x; _hit.y = y; _hit.z = z; _hit.t = t; _hit.nx = nx; _hit.ny = ny; _hit.nz = nz; _hit.v = v; return _hit; }
    } else if (y < 0) {
      if (x >= 0 && x < SX && z >= 0 && z < SZ) { _hit.x = x; _hit.y = 0; _hit.z = z; _hit.t = t; _hit.nx = 0; _hit.ny = 1; _hit.nz = 0; _hit.v = 11; return _hit; }
      return null;
    }
    if (tmx < tmy && tmx < tmz) { t = tmx; tmx += tdx; x += sx; nx = -sx; ny = 0; nz = 0; }
    else if (tmy < tmz) { t = tmy; tmy += tdy; y += sy; nx = 0; ny = -sy; nz = 0; }
    else { t = tmz; tmz += tdz; z += sz; nx = 0; ny = 0; nz = -sz; }
    if (t > maxT) return null;
  }
  return null;
}
function lineClear(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz);
  if (d < .01) return true;
  return !raycast(ax, ay, az, dx / d, dy / d, dz / d, d - .3);
}

// ───────────── 모래 낙하 ─────────────
const sandQueue = new Set();
function updateSand() {
  if (!sandQueue.size) return;
  const list = Array.from(sandQueue).slice(0, 600);
  for (const i of list) sandQueue.delete(i);
  const L = SX * SZ;
  for (const i of list) {
    if (vox[i] !== M.SAND) continue;
    const y = (i / L) | 0, r = i - y * L, z = (r / SX) | 0, x = r - z * SX;
    if (y === 0) continue;
    let tx = x, tz = z;
    if (vox[i - L] !== 0) {
      const o = [[1, 0], [-1, 0], [0, 1], [0, -1]][(Math.random() * 4) | 0];
      tx = x + o[0]; tz = z + o[1];
      if (tx < 0 || tx >= SX || tz < 0 || tz >= SZ || vox[vidx(tx, y - 1, tz)] || vox[vidx(tx, y, tz)]) continue;
    }
    const tint = vtint[i];
    setVox(x, y, z, 0);
    setVox(tx, y - 1, tz, M.SAND);
    vtint[vidx(tx, y - 1, tz)] = tint;
  }
}

// ───────────── 구조 붕괴 (떠 있는 덩어리 감지) ─────────────
const visitGen = new Uint32Array(SX * SY * SZ), groundGen = new Uint32Array(SX * SY * SZ);
let gen = 1;
const stack = new Int32Array(SX * SY * SZ / 4);
const collapseQueue = [];
const fallingBodies = [];
function queueCollapseCheck(x, y, z, r) { collapseQueue.push([x, y, z, r]); }
function processCollapse() {
  if (!collapseQueue.length) return;
  const jobs = collapseQueue.splice(0, collapseQueue.length);
  gen++;
  const L = SX * SZ, LIMIT = 9000;
  for (const [cx, cy, cz, r] of jobs) {
    const RC = Math.ceil(r + 2);
    for (let y = Math.max(1, cy - RC); y <= Math.min(SY - 1, cy + RC); y++)
      for (let z = Math.max(0, cz - RC); z <= Math.min(SZ - 1, cz + RC); z++)
        for (let x = Math.max(0, cx - RC); x <= Math.min(SX - 1, cx + RC); x++) {
          const s = vidx(x, y, z);
          if (!vox[s] || visitGen[s] === gen) continue;
          // DFS (아래 방향 우선)로 땅에 닿는지 확인
          let sp = 0, grounded = false;
          const comp = [];
          stack[sp++] = s; visitGen[s] = gen;
          outer: while (sp > 0) {
            const i = stack[--sp];
            comp.push(i);
            const iy = (i / L) | 0;
            if (iy <= 1 || vox[i] === M.BEDROCK || comp.length > LIMIT) { grounded = true; break; }
            const rr = i - iy * L, iz = (rr / SX) | 0, ix = rr - iz * SX;
            // 스택이므로 마지막에 넣은 것이 먼저 처리된다 → 아래 방향을 마지막에
            for (let k = 0; k < 6; k++) {
              let j;
              if (k === 0) { if (iy + 1 >= SY) continue; j = i + L; }
              else if (k === 1) { if (ix + 1 >= SX) continue; j = i + 1; }
              else if (k === 2) { if (ix === 0) continue; j = i - 1; }
              else if (k === 3) { if (iz + 1 >= SZ) continue; j = i + SX; }
              else if (k === 4) { if (iz === 0) continue; j = i - SX; }
              else j = i - L;
              if (!vox[j]) continue;
              if (visitGen[j] === gen) { if (groundGen[j] === gen) { grounded = true; break outer; } continue; }
              visitGen[j] = gen; stack[sp++] = j;
            }
          }
          if (grounded) {
            for (const i of comp) groundGen[i] = gen;
            // 스택에 남은 것도 땅과 연결된 것
            for (let k = 0; k < sp; k++) groundGen[stack[k]] = gen;
          } else detachBody(comp);
        }
  }
}
function detachBody(comp) {
  const L = SX * SZ;
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1, y1 = -1, z1 = -1;
  const cells = new Int32Array(comp.length * 5);
  let n = 0;
  for (const i of comp) {
    const y = (i / L) | 0, r = i - y * L, z = (r / SX) | 0, x = r - z * SX;
    cells[n * 5] = x; cells[n * 5 + 1] = y; cells[n * 5 + 2] = z; cells[n * 5 + 3] = vox[i]; cells[n * 5 + 4] = vtint[i];
    n++;
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z;
    if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z;
  }
  for (const i of comp) {
    const y = (i / L) | 0, r = i - y * L, z = (r / SX) | 0, x = r - z * SX;
    vox[i] = 0; vtint[i] = 0; markDirty(x, y, z);
    if (y + 1 < SY && vox[i + L] === M.SAND) sandQueue.add(i + L);
  }
  // 아주 작은 조각은 그냥 파편으로
  if (n < 6) {
    for (let k = 0; k < n; k++) spawnDebrisVoxel(cells[k * 5], cells[k * 5 + 1], cells[k * 5 + 2], cells[k * 5 + 3], 0, 0, 0);
    return;
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, d = z1 - z0 + 1;
  const local = new Uint8Array(w * h * d), ltint = new Uint8Array(w * h * d);
  for (let k = 0; k < n; k++) {
    const li = ((cells[k * 5 + 1] - y0) * d + (cells[k * 5 + 2] - z0)) * w + (cells[k * 5] - x0);
    local[li] = cells[k * 5 + 3]; ltint[li] = cells[k * 5 + 4];
  }
  const get = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= w || y >= h || z >= d) ? 0 : local[(y * d + z) * w + x];
  const tget = (x, y, z) => ltint[(y * d + z) * w + x];
  const g = meshRegion(get, tget, 0, 0, 0, w, h, d, 0, 0, 0, false);
  if (!g) return;
  const mesh = new THREE.Mesh(g, voxMaterial);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.position.set(x0, y0, z0);
  worldGroup.add(mesh);
  // 바닥 접촉 검사용: 아래가 비어 있는 셀
  const bottoms = [];
  for (let k = 0; k < n; k++) {
    const lx = cells[k * 5] - x0, ly = cells[k * 5 + 1] - y0, lz = cells[k * 5 + 2] - z0;
    if (!get(lx, ly - 1, lz)) bottoms.push(lx, ly, lz);
  }
  let mass = 0;
  for (let k = 0; k < n; k++) { const t = cells[k * 5 + 3]; mass += t === M.LEAF ? .08 : t === M.WOOD || t === M.PLANK ? .4 : 1; }
  fallingBodies.push({ mass, x0, y0, z0, w, h, d, local, ltint, n, mesh, off: 0, vy: 0, bottoms, age: 0,
    tilt: 0, tiltV: (Math.random() - .5) * .3, tiltAxis: Math.random() < .5 ? 'x' : 'z' });
  sfxCrumble(x0 + w / 2, y0, z0 + d / 2, Math.min(1, n / 400));
}
function updateFalling(dt) {
  for (let b = fallingBodies.length - 1; b >= 0; b--) {
    const B = fallingBodies[b];
    B.age += dt;
    B.vy = Math.min(B.vy + GRAV * dt, 40);
    let move = B.vy * dt, landed = false;
    while (move > 0) {
      const step = Math.min(move, .5);
      const noff = B.off - step;
      // 충돌 검사
      let hit = false;
      const by = Math.floor(B.y0 + noff);
      for (let k = 0; k < B.bottoms.length; k += 3) {
        const x = B.x0 + B.bottoms[k], y = by + B.bottoms[k + 1], z = B.z0 + B.bottoms[k + 2];
        if (y < 0 || (x >= 0 && x < SX && z >= 0 && z < SZ && y < SY && vox[vidx(x, y, z)])) { hit = true; break; }
      }
      if (hit) { landed = true; break; }
      B.off = noff; move -= step;
    }
    // 아래 유닛 깔기
    crushUnits(B);
    B.tilt += B.tiltV * dt * Math.min(1, B.vy / 10);
    B.mesh.position.y = B.y0 + B.off;
    B.mesh.rotation[B.tiltAxis] = B.tilt * .05;
    if (landed || B.age > 12) landBody(B), fallingBodies.splice(b, 1);
  }
}
function landBody(B) {
  const dy = Math.ceil(B.off - 1e-6);
  const speed = B.vy;
  const shatter = speed > 9 ? Math.min(.75, (speed - 9) / 18 + .2) : 0;
  const { w, h, d, local, ltint } = B;
  let cnt = 0;
  for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
    const li = (y * d + z) * w + x, t = local[li];
    if (!t) continue;
    const wx = B.x0 + x, wy = B.y0 + y + dy, wz = B.z0 + z;
    if (wx < 0 || wx >= SX || wz < 0 || wz >= SZ || wy < 0 || wy >= SY) continue;
    const i = vidx(wx, wy, wz);
    if (vox[i]) continue;
    if (shatter && Math.random() < shatter) {
      if (cnt++ < 260) spawnDebrisVoxel(wx, wy, wz, t, (Math.random() - .5) * speed * .5, Math.random() * speed * .3, (Math.random() - .5) * speed * .5);
      continue;
    }
    vox[i] = t; vtint[i] = ltint[li]; markDirty(wx, wy, wz);
    if (t === M.SAND) sandQueue.add(i);
  }
  worldGroup.remove(B.mesh); B.mesh.geometry.dispose();
  if (speed > 6) {
    const cx = B.x0 + w / 2, cz = B.z0 + d / 2, cy = B.y0 + dy;
    dustBurst(cx, cy, cz, Math.max(w, d) * .6, Math.min(80, B.n / 6 + 10));
    addShake(Math.min(1.2, B.n / 600 + .2), cx, cy, cz);
    sfxCrumble(cx, cy, cz, Math.min(1, B.n / 300) + .3);
  }
  queueCollapseCheck(B.x0 + (w >> 1), B.y0 + dy + (h >> 1), B.z0 + (d >> 1), Math.max(w, h, d) / 2 + 1);
}

// ───────────── 지형 생성 ─────────────
function makeNoise(rng) {
  const P = new Uint8Array(512), G = new Float32Array(256);
  for (let i = 0; i < 256; i++) { P[i] = i; G[i] = rng(); }
  for (let i = 255; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = P[i]; P[i] = P[j]; P[j] = t; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const fade = t => t * t * (3 - 2 * t);
  const n2 = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = G[P[(xi & 255) + P[yi & 255]]], b = G[P[((xi + 1) & 255) + P[yi & 255]]];
    const c = G[P[(xi & 255) + P[(yi + 1) & 255]]], d = G[P[((xi + 1) & 255) + P[(yi + 1) & 255]]];
    const u = fade(xf), v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y, oct) => {
    let s = 0, amp = 1, f = 1, tot = 0;
    for (let o = 0; o < (oct || 4); o++) { s += n2(x * f, y * f) * amp; tot += amp; amp *= .5; f *= 2.03; }
    return s / tot;
  };
}
const heightMap = new Float32Array(SX * SZ);
let riverCenter = null;
const BASES = [{ x0: 10, x1: 48 }, { x0: SX - 48, x1: SX - 10 }];
function fillBox(x0, y0, z0, x1, y1, z1, t) {
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++)
    if (x >= 0 && x < SX && y >= 0 && y < SY && z >= 0 && z < SZ) vox[vidx(x, y, z)] = t;
}
function genWorld(seed) {
  const rng = mulberry32(seed);
  wrand = rng;
  vox.fill(0); vtint.fill(0); sandQueue.clear();
  for (const B of fallingBodies) { worldGroup.remove(B.mesh); B.mesh.geometry.dispose(); }
  fallingBodies.length = 0;
  const noise = makeNoise(rng), noise2 = makeNoise(rng);
  const p1 = rng() * 10, p2 = rng() * 10;
  riverCenter = z => SX / 2 + Math.sin(z * .026 + p1) * 13 + Math.sin(z * .071 + p2) * 4;
  for (let z = 0; z < SZ; z++) {
    const rc = riverCenter(z);
    for (let x = 0; x < SX; x++) {
      let h = 15 + noise(x * .018, z * .018, 4) * 13;
      const edge = Math.min(x, z, SX - 1 - x, SZ - 1 - z);
      if (edge < 22) h += Math.pow(1 - edge / 22, 2) * (8 + noise2(x * .05, z * .05) * 16);
      // 기지 주변은 평평하게
      for (const b of BASES) {
        const dx = x < b.x0 ? b.x0 - x : x > b.x1 ? x - b.x1 : 0;
        if (dx < 14) { const k = 1 - dx / 14; h = h + (19 - h) * k * .75; }
      }
      const dr = Math.abs(x - rc);
      if (dr < 16) { const k = Math.min(1, Math.max(0, (16 - dr) / 10)); const s = k * k * (3 - 2 * k); h = h + (WATER_Y - 4.5 - h) * s; }
      heightMap[z * SX + x] = h;
    }
  }
  for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
    const h = Math.floor(heightMap[z * SX + x]);
    const rock = noise2(x * .09, z * .09, 2);
    const beach = h <= WATER_Y + .6;
    for (let y = 0; y <= h && y < SY; y++) {
      let t;
      if (y === 0) t = M.BEDROCK;
      else if (y < h - 4 - rock * 3) t = M.STONE;
      else if (y < h) t = beach ? M.SAND : M.DIRT;
      else t = beach ? M.SAND : (h > 30 && rock > .55 ? M.STONE : M.GRASS);
      vox[vidx(x, y, z)] = t;
    }
  }
  // 바위
  for (let k = 0; k < 18; k++) {
    const x = (rng() * SX) | 0, z = (rng() * SZ) | 0, y = surfaceY(x, z);
    if (Math.abs(x - riverCenter(z)) < 14) continue;
    const r = 1.5 + rng() * 2.5;
    for (let dy = -2; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++)
      if (dx * dx + dz * dz + dy * dy * 1.6 < r * r && rng() > .1) {
        const X = x + Math.round(dx), Y = y + dy, Z = z + Math.round(dz);
        if (X >= 0 && X < SX && Z >= 0 && Z < SZ && Y > 0 && Y < SY) vox[vidx(X, Y, Z)] = M.STONE;
      }
  }
  // 다리 2개
  for (const bz of [Math.round(SZ * .3), Math.round(SZ * .72)]) buildBridge(bz);
  // 마을
  const spots = [];
  const tryHouse = (x, z, w, d) => {
    for (const s of spots) if (Math.abs(s[0] - x) < s[2] / 2 + w / 2 + 3 && Math.abs(s[1] - z) < s[3] / 2 + d / 2 + 3) return false;
    for (let zz = z - (d >> 1); zz <= z + (d >> 1); zz++) {
      if (Math.abs(x - riverCenter(zz)) < 20 + w / 2) return false;
    }
    spots.push([x, z, w, d]);
    buildHouse(x, z, w, d, rng);
    return true;
  };
  let houses = 0;
  for (let k = 0; k < 120 && houses < 9; k++) {
    const side = k % 2;
    const x = side ? SX / 2 + 22 + rng() * 40 : SX / 2 - 22 - rng() * 40;
    const z = 28 + rng() * (SZ - 56);
    if (tryHouse(Math.round(x), Math.round(z), 9 + ((rng() * 3) | 0) * 2, 9 + ((rng() * 3) | 0) * 2)) houses++;
  }
  // 감시탑
  for (const side of [0, 1]) {
    const x = side ? BASES[1].x0 - 6 : BASES[0].x1 + 6, z = Math.round(SZ / 2 + (rng() - .5) * 60);
    buildTower(x, z);
  }
  // 모래주머니 진지
  for (const side of [0, 1]) for (let k = 0; k < 4; k++) {
    const x = side ? BASES[1].x0 - 3 : BASES[0].x1 + 3, z = Math.round(30 + k * (SZ - 60) / 3 + (rng() - .5) * 10);
    for (let dz = -6; dz <= 6; dz++) {
      const xx = x + Math.round(Math.cos(dz / 6 * 1.2) * 3) * (side ? -1 : 1), zz = z + dz;
      if (zz < 0 || zz >= SZ) continue;
      for (let t = 0; t < 2; t++) {
        const X = xx + t, base = surfaceY(X, zz);
        for (let dy = 0; dy < 2; dy++) if (base + dy < SY) vox[vidx(X, base + dy, zz)] = M.SANDBAG;
      }
    }
  }
  // 나무
  for (let k = 0; k < 140; k++) {
    const x = 4 + ((rng() * (SX - 8)) | 0), z = 4 + ((rng() * (SZ - 8)) | 0);
    if (noise(x * .03 + 7, z * .03) < .45 && rng() < .7) continue;
    if (Math.abs(x - riverCenter(z)) < 13) continue;
    let ok = true;
    for (const s of spots) if (Math.abs(s[0] - x) < s[2] / 2 + 4 && Math.abs(s[1] - z) < s[3] / 2 + 4) ok = false;
    if (!ok) continue;
    const y = surfaceY(x, z);
    if (vox[vidx(x, y - 1, z)] !== M.GRASS) continue;
    buildTree(x, y, z, rng);
  }
  rebuildAll();
}
function buildBridge(bz) {
  const rc = Math.round(riverCenter(bz));
  const xa = rc - 15, xb = rc + 15;
  const ya = surfaceY(xa, bz), yb = surfaceY(xb, bz);
  const deck = Math.max(ya, yb, Math.ceil(WATER_Y) + 3);
  for (let x = xa - 3; x <= xb + 3; x++) {
    for (let z = bz - 2; z <= bz + 2; z++) {
      vox[vidx(x, deck - 1, z)] = M.PLANK;
      for (let y = deck; y < deck + 4; y++) vox[vidx(x, y, z)] = 0;
    }
    vox[vidx(x, deck, bz - 3)] = (x % 3 === 0) ? M.WOOD : 0;
    vox[vidx(x, deck, bz + 3)] = (x % 3 === 0) ? M.WOOD : 0;
    if (x % 3 === 0) { vox[vidx(x, deck + 1, bz - 3)] = M.WOOD; vox[vidx(x, deck + 1, bz + 3)] = M.WOOD; }
    vox[vidx(x, deck - 1, bz - 3)] = M.PLANK; vox[vidx(x, deck - 1, bz + 3)] = M.PLANK;
    if (x % 6 === 0) for (const z of [bz - 3, bz + 3]) for (let y = 1; y < deck - 1; y++) if (!vox[vidx(x, y, z)]) vox[vidx(x, y, z)] = M.WOOD;
  }
  // 램프 부분 흙 채움
  for (let x = xa - 6; x <= xb + 6; x++) for (let z = bz - 2; z <= bz + 2; z++) {
    if (x > xa - 3 && x < xb + 3) continue;
    const s = surfaceY(x, z);
    for (let y = s; y < deck - 1; y++) vox[vidx(x, y, z)] = M.DIRT;
  }
}
function buildHouse(cx, cz, w, d, rng) {
  const x0 = cx - (w >> 1), z0 = cz - (d >> 1), x1 = x0 + w - 1, z1 = z0 + d - 1;
  let base = 0;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) base = Math.max(base, surfaceY(x, z));
  const brick = rng() < .6;
  const wallT = brick ? M.BRICK : M.CONCRETE;
  const floors = rng() < .45 ? 2 : 1, fh = 5;
  // 기초
  for (let z = z0 - 1; z <= z1 + 1; z++) for (let x = x0 - 1; x <= x1 + 1; x++) {
    const s = surfaceY(x, z);
    for (let y = Math.max(1, s - 1); y < base; y++) vox[vidx(x, y, z)] = M.CONCRETE;
  }
  fillBox(x0, base, z0, x1, base, z1, M.CONCRETE);
  for (let f = 0; f < floors; f++) {
    const yb = base + 1 + f * fh;
    for (let y = yb; y < yb + fh - 1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      if (!edge) { vox[vidx(x, y, z)] = 0; continue; }
      const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
      const along = (x === x0 || x === x1) ? z - z0 : x - x0;
      const win = !corner && y - yb >= 1 && y - yb <= 2 && along % 3 === 2;
      const door = f === 0 && !corner && y - yb <= 2 && ((z === z0 || z === z1) && Math.abs(x - cx) <= 0);
      vox[vidx(x, y, z)] = win || door ? 0 : wallT;
    }
    // 바닥판
    fillBox(x0, yb + fh - 1, z0, x1, yb + fh - 1, z1, M.CONCRETE);
    if (f < floors - 1) { vox[vidx(x0 + 1, yb + fh - 1, z0 + 1)] = 0; vox[vidx(x0 + 2, yb + fh - 1, z0 + 1)] = 0; }
  }
  const top = base + 1 + floors * fh - 1;
  if (rng() < .5) {
    // 박공지붕
    const along = w >= d;
    const span = along ? d : w;
    for (let k = 0; k <= (span >> 1); k++) {
      for (let a = (along ? x0 - 1 : z0 - 1); a <= (along ? x1 + 1 : z1 + 1); a++) {
        for (const s of [k, span - 1 - k]) {
          const x = along ? a : x0 + s, z = along ? z0 + s : a, y = top + 1 + k;
          if (y < SY && x >= 0 && x < SX && z >= 0 && z < SZ) vox[vidx(x, y, z)] = M.ROOF;
        }
        const gable = along ? (a === x0 || a === x1) : (a === z0 || a === z1);
        if (gable) for (let s = k + 1; s < span - 1 - k; s++) {
          const x = along ? a : x0 + s, z = along ? z0 + s : a;
          vox[vidx(x, top + 1 + k, z)] = wallT;
        }
      }
    }
  } else {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++)
      if (x === x0 || x === x1 || z === z0 || z === z1) vox[vidx(x, top + 1, z)] = wallT;
  }
}
function buildTower(x, z) {
  const base = surfaceY(x, z), H = 11;
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]])
    for (let y = base - 1; y < base + H; y++) vox[vidx(x + dx, y, z + dz)] = M.WOOD;
  for (let y = base + 2; y < base + H; y += 4) for (let k = -2; k <= 2; k++) {
    vox[vidx(x + k, y, z - 2)] = M.WOOD; vox[vidx(x + k, y, z + 2)] = M.WOOD;
  }
  fillBox(x - 3, base + H, z - 3, x + 3, base + H, z + 3, M.PLANK);
  for (let k = -3; k <= 3; k++) {
    vox[vidx(x + k, base + H + 1, z - 3)] = M.PLANK; vox[vidx(x + k, base + H + 1, z + 3)] = M.PLANK;
    vox[vidx(x - 3, base + H + 1, z + k)] = M.PLANK; vox[vidx(x + 3, base + H + 1, z + k)] = M.PLANK;
  }
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]])
    for (let y = base + H + 1; y < base + H + 4; y++) vox[vidx(x + dx, y, z + dz)] = M.WOOD;
  fillBox(x - 3, base + H + 4, z - 3, x + 3, base + H + 4, z + 3, M.ROOF);
}
function buildTree(x, y, z, rng) {
  rng = rng || Math.random;
  const h = 5 + ((rng() * 4) | 0);
  for (let k = 0; k < h; k++) if (y + k < SY) vox[vidx(x, y + k, z)] = M.WOOD;
  const r = 2.4 + rng() * 1.3, cy = y + h - 1;
  for (let dy = -2; dy <= Math.ceil(r); dy++) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
    const dd = dx * dx + dz * dz + (dy * 1.3) * (dy * 1.3);
    if (dd > r * r || rng() < .08) continue;
    const X = x + dx, Y = cy + dy, Z = z + dz;
    if (X < 0 || X >= SX || Z < 0 || Z >= SZ || Y >= SY) continue;
    const i = vidx(X, Y, Z);
    if (!vox[i]) vox[i] = M.LEAF;
  }
}
