'use strict';
// ─────────────────────────────────────────────────────────────
//  이펙트: 파편 물리, 파티클(불/연기/먼지), 예광탄, 섬광, 충격파, 사운드
// ─────────────────────────────────────────────────────────────
let scene, camera, renderer;
const _dummy = new THREE.Object3D();
const _col = new THREE.Color();

// ───────────── 파편 (물리 큐브) ─────────────
const DMAX = 3500;
const dP = new Float32Array(DMAX * 3), dV = new Float32Array(DMAX * 3), dR = new Float32Array(DMAX * 3),
  dW = new Float32Array(DMAX * 3), dS = new Float32Array(DMAX), dL = new Float32Array(DMAX), dC = new Float32Array(DMAX * 3);
const dSleep = new Uint8Array(DMAX);
let dN = 0, debrisMesh;
function initDebris() {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshLambertMaterial();
  debrisMesh = new THREE.InstancedMesh(geo, mat, DMAX);
  debrisMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(DMAX * 3), 3);
  debrisMesh.castShadow = true; debrisMesh.receiveShadow = true;
  debrisMesh.frustumCulled = false; debrisMesh.count = 0;
  scene.add(debrisMesh);
}
function spawnDebris(x, y, z, vx, vy, vz, size, r, g, b, life) {
  let i = dN;
  if (dN >= DMAX) i = (Math.random() * DMAX) | 0; else dN++;
  const o = i * 3;
  dP[o] = x; dP[o + 1] = y; dP[o + 2] = z;
  dV[o] = vx; dV[o + 1] = vy; dV[o + 2] = vz;
  dR[o] = Math.random() * 6; dR[o + 1] = Math.random() * 6; dR[o + 2] = Math.random() * 6;
  const sp = Math.min(14, Math.hypot(vx, vy, vz)) * 1.4;
  dW[o] = (Math.random() - .5) * sp; dW[o + 1] = (Math.random() - .5) * sp; dW[o + 2] = (Math.random() - .5) * sp;
  dS[i] = size; dL[i] = life; dSleep[i] = 0;
  dC[o] = r; dC[o + 1] = g; dC[o + 2] = b;
}
function spawnDebrisVoxel(x, y, z, t, vx, vy, vz) {
  const c = voxColor(t, x, y, z, 2, 0);
  spawnDebris(x + .5, y + .5, z + .5, vx, vy, vz, .55 + Math.random() * .4, c[0], c[1], c[2], 5 + Math.random() * 6);
}
function pushDebris(cx, cy, cz, r, power) {
  for (let i = 0; i < dN; i++) {
    const o = i * 3, dx = dP[o] - cx, dy = dP[o + 1] - cy, dz = dP[o + 2] - cz, d = Math.hypot(dx, dy, dz);
    if (d > r || d < .01) continue;
    const f = (1 - d / r) * power;
    dV[o] += dx / d * f; dV[o + 1] += dy / d * f + f * .5; dV[o + 2] += dz / d * f; dSleep[i] = 0;
  }
}
function updateDebris(dt) {
  for (let i = 0; i < dN; i++) {
    dL[i] -= dt;
    if (dL[i] <= 0) {
      dN--;
      if (i !== dN) {
        const a = i * 3, b = dN * 3;
        for (let k = 0; k < 3; k++) { dP[a + k] = dP[b + k]; dV[a + k] = dV[b + k]; dR[a + k] = dR[b + k]; dW[a + k] = dW[b + k]; dC[a + k] = dC[b + k]; }
        dS[i] = dS[dN]; dL[i] = dL[dN]; dSleep[i] = dSleep[dN];
      }
      i--; continue;
    }
    const o = i * 3;
    if (dSleep[i]) {
      if (!solidAt(Math.floor(dP[o]), Math.floor(dP[o + 1] - dS[i] * .5 - .05), Math.floor(dP[o + 2]))) dSleep[i] = 0;
      else continue;
    }
    let x = dP[o], y = dP[o + 1], z = dP[o + 2], vx = dV[o], vy = dV[o + 1] - GRAV * dt, vz = dV[o + 2];
    if (bhole) {
      const ax = bhole.x - x, ay = bhole.y - y, az = bhole.z - z, d = Math.hypot(ax, ay, az) + .1;
      if (d < bhole.r * 2.6) {
        const f = 70 / (d + 2) * dt;
        vx += ax / d * f; vy += ay / d * f + GRAV * dt * .9; vz += az / d * f;
        vx *= .985; vy *= .985; vz *= .985;
        if (d < 1.6) { dL[i] = 0; continue; }
        x += vx * dt; y += vy * dt; z += vz * dt;
        dP[o] = x; dP[o + 1] = y; dP[o + 2] = z; dV[o] = vx; dV[o + 1] = vy; dV[o + 2] = vz;
        dR[o] += dW[o] * dt; dR[o + 1] += dW[o + 1] * dt;
        continue;
      }
    }
    if (y < WATER_Y) { const k = Math.max(0, 1 - 3 * dt); vx *= k; vy = vy * k + GRAV * dt * .6; vz *= k; }
    const hs = dS[i] * .45;
    let nx = x + vx * dt;
    if (solidAt(Math.floor(nx + Math.sign(vx) * hs), Math.floor(y), Math.floor(z))) { vx = -vx * .3; nx = x; }
    let nz = z + vz * dt;
    if (solidAt(Math.floor(nx), Math.floor(y), Math.floor(nz + Math.sign(vz) * hs))) { vz = -vz * .3; nz = z; }
    let ny = y + vy * dt;
    if (solidAt(Math.floor(nx), Math.floor(ny - hs), Math.floor(nz))) {
      if (vy < 0) {
        ny = Math.floor(ny - hs) + 1 + hs;
        if (vy < -3) { vy = -vy * .28; vx *= .55; vz *= .55; dW[o] *= .5; dW[o + 1] *= .5; dW[o + 2] *= .5; }
        else { vy = 0; vx *= .7; vz *= .7; if (Math.abs(vx) + Math.abs(vz) < .4) { dSleep[i] = 1; vx = vz = 0; } }
      } else { vy = 0; ny = y; }
    }
    dP[o] = nx; dP[o + 1] = ny; dP[o + 2] = nz; dV[o] = vx; dV[o + 1] = vy; dV[o + 2] = vz;
    dR[o] += dW[o] * dt; dR[o + 1] += dW[o + 1] * dt; dR[o + 2] += dW[o + 2] * dt;
  }
}
function drawDebris() {
  for (let i = 0; i < dN; i++) {
    const o = i * 3, s = dS[i] * Math.min(1, dL[i] / 1.2);
    _dummy.position.set(dP[o], dP[o + 1], dP[o + 2]);
    _dummy.rotation.set(dR[o], dR[o + 1], dR[o + 2]);
    _dummy.scale.set(s, s, s);
    _dummy.updateMatrix();
    debrisMesh.setMatrixAt(i, _dummy.matrix);
    debrisMesh.instanceColor.setXYZ(i, dC[o], dC[o + 1], dC[o + 2]);
  }
  debrisMesh.count = dN;
  debrisMesh.instanceMatrix.needsUpdate = true;
  debrisMesh.instanceColor.needsUpdate = true;
}

// ───────────── 포인트 파티클 ─────────────
const P_VS = `
attribute float psize; attribute vec4 pcolor; varying vec4 vC; uniform float uScale;
void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = min(512.0, psize * uScale / max(0.1,-mv.z)); gl_Position = projectionMatrix * mv; vC = pcolor; }`;
const P_FS = `
varying vec4 vC; uniform float uSoft;
void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if(d > 0.5) discard;
  float a = pow(1.0 - d * 2.0, uSoft); gl_FragColor = vec4(vC.rgb, vC.a * a); }`;
class PSys {
  constructor(max, additive, soft) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.ml = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 4); this.c1 = new Float32Array(max * 4);
    this.drag = new Float32Array(max); this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('pcolor', this.aCol); g.setAttribute('psize', this.aSize);
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: P_VS, fragmentShader: P_FS, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 400 }, uSoft: { value: soft } },
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 3 : 2;
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, drag, grav) {
    let i = this.n;
    if (i >= this.max) i = (Math.random() * this.max) | 0; else this.n++;
    const o = i * 3, q = i * 4;
    this.p[o] = x; this.p[o + 1] = y; this.p[o + 2] = z;
    this.v[o] = vx; this.v[o + 1] = vy; this.v[o + 2] = vz;
    this.life[i] = life; this.ml[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    for (let k = 0; k < 4; k++) { this.c0[q + k] = c0[k]; this.c1[q + k] = c1[k]; }
    this.drag[i] = drag; this.grav[i] = grav;
  }
  update(dt) {
    const P = this.p, V = this.v;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --this.n;
        if (i !== j) {
          for (let k = 0; k < 3; k++) { P[i * 3 + k] = P[j * 3 + k]; V[i * 3 + k] = V[j * 3 + k]; }
          for (let k = 0; k < 4; k++) { this.c0[i * 4 + k] = this.c0[j * 4 + k]; this.c1[i * 4 + k] = this.c1[j * 4 + k]; }
          this.life[i] = this.life[j]; this.ml[i] = this.ml[j]; this.s0[i] = this.s0[j]; this.s1[i] = this.s1[j];
          this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j];
        }
        i--; continue;
      }
      const o = i * 3, k = Math.max(0, 1 - this.drag[i] * dt);
      V[o] *= k; V[o + 1] = V[o + 1] * k - this.grav[i] * dt; V[o + 2] *= k;
      if (bhole) {
        const ax = bhole.x - P[o], ay = bhole.y - P[o + 1], az = bhole.z - P[o + 2], d = Math.hypot(ax, ay, az) + .5;
        if (d < bhole.r * 3) { const f = 40 / d * dt; V[o] += ax / d * f; V[o + 1] += ay / d * f; V[o + 2] += az / d * f; }
      }
      P[o] += V[o] * dt; P[o + 1] += V[o + 1] * dt; P[o + 2] += V[o + 2] * dt;
    }
    const ap = this.aPos.array, ac = this.aCol.array, as = this.aSize.array;
    for (let i = 0; i < this.n; i++) {
      const t = 1 - this.life[i] / this.ml[i], o = i * 3, q = i * 4;
      ap[o] = P[o]; ap[o + 1] = P[o + 1]; ap[o + 2] = P[o + 2];
      as[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      for (let k = 0; k < 4; k++) ac[q + k] = this.c0[q + k] + (this.c1[q + k] - this.c0[q + k]) * t;
    }
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = true;
    this.points.geometry.setDrawRange(0, this.n);
  }
}
let fire, smoke;
const C = {
  fire0: [1.0, .82, .42, 1], fire1: [.7, .12, .02, 0],
  hot0: [1, .95, .75, 1], hot1: [1, .35, .05, 0],
  spark0: [1, .9, .55, 1], spark1: [1, .4, .1, 0],
  smoke0: [.22, .21, .2, .62], smoke1: [.42, .41, .4, 0],
  dark0: [.08, .07, .07, .75], dark1: [.25, .24, .23, 0],
  dust0: [.55, .47, .36, .5], dust1: [.62, .56, .48, 0],
  blood0: [.5, .02, .03, .95], blood1: [.32, .01, .02, 0],
  steam0: [.85, .88, .92, .5], steam1: [.9, .92, .95, 0],
  heal0: [.45, 1, .55, 1], heal1: [.2, .8, .3, 0],
  muzzle0: [1, .92, .6, 1], muzzle1: [1, .6, .2, 0],
  purple0: [.7, .4, 1, 1], purple1: [.2, .05, .5, 0],
};
const R = (a) => (Math.random() - .5) * a;

function fireBurst(x, y, z, r, n) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * 6.283, e = Math.random() * 1.4 - .2, s = r * (2 + Math.random() * 4);
    fire.spawn(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 2, Math.sin(a) * Math.cos(e) * s,
      .35 + Math.random() * .5, r * .9, r * 2.4, C.hot0, C.fire1, 3.5, -4);
  }
}
function sparks(x, y, z, n, sp) {
  for (let k = 0; k < n; k++)
    fire.spawn(x, y, z, R(sp), Math.random() * sp * .7, R(sp), .3 + Math.random() * .6, .35, .1, C.spark0, C.spark1, .5, GRAV * .8);
}
function smokePuff(x, y, z, r, n, dark) {
  for (let k = 0; k < n; k++)
    smoke.spawn(x + R(r), y + Math.random() * r * .6, z + R(r), R(3), 2 + Math.random() * 4, R(3),
      2.5 + Math.random() * 3.5, r * .8 + 1, r * 2.2 + 3, dark ? C.dark0 : C.smoke0, dark ? C.dark1 : C.smoke1, 1.2, -1.2);
}
function dustBurst(x, y, z, r, n) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * 6.283, s = 3 + Math.random() * 8;
    smoke.spawn(x + Math.cos(a) * r * .5, y + .5, z + Math.sin(a) * r * .5, Math.cos(a) * s, Math.random() * 2.5, Math.sin(a) * s,
      1.5 + Math.random() * 2, 1.5 + r * .3, 4 + r * .8, C.dust0, C.dust1, 2.2, -.3);
  }
}
function bloodBurst(x, y, z, dx, dz, n) {
  for (let k = 0; k < n; k++)
    smoke.spawn(x, y, z, dx * 3 + R(3), Math.random() * 3, dz * 3 + R(3), .4 + Math.random() * .4, .35, .9, C.blood0, C.blood1, 2, GRAV * .6);
  for (let k = 0; k < (n >> 2); k++)
    spawnDebris(x, y, z, dx * 4 + R(4), Math.random() * 4, dz * 4 + R(4), .12 + Math.random() * .12, .3, .01, .015, 3 + Math.random() * 3);
}
function muzzleFlash(x, y, z, big) {
  fire.spawn(x, y, z, 0, 0, 0, .06, big ? 2.2 : 1.1, big ? .6 : .3, C.muzzle0, C.muzzle1, 0, 0);
  if (big) smokePuff(x, y, z, .6, 3, false);
}

// ───────────── 예광탄 ─────────────
const TR_MAX = 600;
let tracerLines;
function initTracers() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TR_MAX * 6), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TR_MAX * 6), 3).setUsage(THREE.DynamicDrawUsage));
  tracerLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  tracerLines.frustumCulled = false;
  tracerLines.renderOrder = 4;
  scene.add(tracerLines);
}

// ───────────── 섬광 조명, 충격파 ─────────────
const lights = [];
const rings = [];
function initFlashLights() {
  for (let i = 0; i < 6; i++) {
    const l = new THREE.PointLight(0xffa860, 0, 40, 2);
    l.castShadow = false;
    scene.add(l);
    lights.push({ l, t: 0, d: 1, I: 0 });
  }
  const rg = new THREE.RingGeometry(.82, 1, 64);
  rg.rotateX(-Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.visible = false; m.renderOrder = 5;
    scene.add(m);
    rings.push({ m, t: 0, d: 1, R: 10 });
  }
}
function flashLight(x, y, z, I, dist, dur) {
  let best = lights[0];
  for (const L of lights) if (L.t <= 0 || L.I * L.t / L.d < best.I * best.t / best.d) best = L;
  best.l.position.set(x, y, z); best.l.distance = dist; best.I = I; best.t = dur; best.d = dur;
}
function shockRing(x, y, z, R, dur) {
  let best = rings[0];
  for (const r of rings) if (r.t <= 0) { best = r; break; }
  best.m.position.set(x, y + .3, z); best.t = dur; best.d = dur; best.R = R; best.m.visible = true;
}
function updateFlash(dt) {
  for (const L of lights) {
    if (L.t > 0) { L.t -= dt; L.l.intensity = Math.max(0, L.I * Math.pow(L.t / L.d, 1.6)); }
    else L.l.intensity = 0;
  }
  for (const r of rings) {
    if (r.t <= 0) continue;
    r.t -= dt;
    const k = 1 - r.t / r.d;
    const s = r.R * (1 - Math.pow(1 - k, 3));
    r.m.scale.set(s, 1, s);
    r.m.material.opacity = Math.max(0, (1 - k) * .8);
    if (r.t <= 0) r.m.visible = false;
  }
}

// ───────────── 화면 흔들림 ─────────────
let shakeAmt = 0;
function addShake(a, x, y, z) {
  const d = camera ? Math.hypot(camera.position.x - x, camera.position.y - y, camera.position.z - z) : 50;
  shakeAmt = Math.min(2.5, shakeAmt + a * Math.max(0, 1 - d / 220) * 1.5);
}

// ───────────── 사운드 (WebAudio 합성, 거리 감쇠 + 스테레오) ─────────────
const AU = { ctx: null, master: null, noise: null, muted: false, shots: 0, booms: 0 };
function initAudio() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    AU.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    AU.master = ctx.createGain(); AU.master.gain.value = AU.muted ? 0 : .7;
    AU.master.connect(comp); comp.connect(ctx.destination);
    const len = ctx.sampleRate * 3;
    AU.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = AU.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = b * .4 + w * .6; d[i] = b; }
    // 바람 소리 앰비언스
    const src = ctx.createBufferSource(); src.buffer = AU.noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    const g = ctx.createGain(); g.gain.value = .035;
    src.connect(f); f.connect(g); g.connect(AU.master); src.start();
  } catch (e) { AU.ctx = null; }
}
function setMuted(m) { AU.muted = m; if (AU.master) AU.master.gain.value = m ? 0 : .7; }
const _v3 = new THREE.Vector3();
function spatial(x, y, z) {
  if (!camera) return [1, 0];
  const d = Math.hypot(camera.position.x - x, camera.position.y - y, camera.position.z - z);
  const g = 1 / (1 + d * d / 3500);
  _v3.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
  const pan = Math.max(-.85, Math.min(.85, _v3.x / (Math.abs(_v3.z) + 12)));
  return [g, pan, d];
}
function out(gainNode, pan) {
  const ctx = AU.ctx;
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; gainNode.connect(p); p.connect(AU.master); }
  else gainNode.connect(AU.master);
}
function noiseHit(t, dur, type, f0, f1, vol, pan, q, attack) {
  const ctx = AU.ctx, s = ctx.createBufferSource();
  s.buffer = AU.noise;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); if (q) f.Q.value = q;
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (attack || .003));
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); out(g, pan);
  s.start(t, Math.random() * 2); s.stop(t + dur + .05);
}
function tone(t, type, f0, f1, dur, vol, pan) {
  const ctx = AU.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); out(g, pan); o.start(t); o.stop(t + dur + .05);
}
function sfxShot(kind, x, y, z) {
  if (!AU.ctx || AU.muted || AU.shots <= 0) return;
  const [g, pan] = spatial(x, y, z);
  if (g < .02) return;
  AU.shots--;
  const t = AU.ctx.currentTime;
  if (kind === 'rifle') { noiseHit(t, .12, 'bandpass', 1800, 600, .5 * g, pan, .8); tone(t, 'square', 180, 60, .05, .08 * g, pan); }
  else if (kind === 'mg') noiseHit(t, .08, 'bandpass', 1400, 500, .42 * g, pan, .9);
  else if (kind === 'sniper') { noiseHit(t, .5, 'lowpass', 3000, 200, .8 * g, pan); tone(t, 'sawtooth', 120, 40, .15, .2 * g, pan); }
  else if (kind === 'rocket') { noiseHit(t, .7, 'bandpass', 500, 2400, .45 * g, pan, .6, .05); }
  else if (kind === 'cannon') { noiseHit(t, .9, 'lowpass', 1600, 90, 1 * g, pan); tone(t, 'sine', 90, 30, .5, .5 * g, pan); }
  else if (kind === 'throw') noiseHit(t, .25, 'highpass', 2000, 4000, .12 * g, pan, 0, .06);
  else if (kind === 'clink') tone(t, 'triangle', 1800 + Math.random() * 500, 900, .08, .1 * g, pan);
  else if (kind === 'heal') tone(t, 'sine', 660, 990, .2, .06 * g, pan);
}
function sfxBoom(r, x, y, z) {
  if (!AU.ctx || AU.muted || AU.booms <= 0) return;
  const [g, pan, d] = spatial(x, y, z);
  AU.booms--;
  const t = AU.ctx.currentTime + d / 900;
  const big = Math.min(1, r / 10);
  const dur = .7 + r * .14;
  noiseHit(t, dur, 'lowpass', 2600 - big * 1400, 60, Math.min(1.4, .55 + big * .9) * Math.max(g, .15), pan, 0, .004);
  tone(t, 'sine', 120, 26, .5 + r * .06, Math.min(1, .4 + big * .7) * Math.max(g, .2), pan);
  noiseHit(t + .05, dur * 1.4, 'bandpass', 900, 200, .18 * g, pan, .5, .2);
}
function sfxCrumble(x, y, z, s) {
  if (!AU.ctx || AU.muted || AU.booms <= 0) return;
  const [g, pan] = spatial(x, y, z);
  const t = AU.ctx.currentTime;
  noiseHit(t, 1.2 + s, 'lowpass', 700, 120, (.25 + s * .5) * Math.max(g, .1), pan, 0, .1);
  for (let k = 0; k < 4; k++) noiseHit(t + Math.random() * .8, .12, 'bandpass', 900 + Math.random() * 800, 0, .12 * g, pan, 2);
}
function sfxWhistle(x, y, z, dur) {
  if (!AU.ctx || AU.muted) return;
  const [g, pan] = spatial(x, y, z);
  tone(AU.ctx.currentTime, 'sine', 1500, 500, dur, .07 * Math.max(.4, g), pan);
}
function sfxPlane() {
  if (!AU.ctx || AU.muted) return;
  const t = AU.ctx.currentTime;
  noiseHit(t, 4, 'bandpass', 300, 160, .35, 0, 1.2, 1.4);
  tone(t, 'sawtooth', 95, 70, 4, .05, 0);
}
function sfxUI(kind) {
  if (!AU.ctx || AU.muted) return;
  const t = AU.ctx.currentTime;
  if (kind === 'place') tone(t, 'triangle', 520, 380, .07, .07, 0);
  else if (kind === 'go') { tone(t, 'square', 330, 330, .12, .07, 0); tone(t + .14, 'square', 494, 494, .3, .07, 0); }
  else if (kind === 'win') { [523, 659, 784, 1046].forEach((f, i) => tone(t + i * .13, 'triangle', f, f, .4, .09, 0)); }
  else tone(t, 'sine', 700, 600, .05, .05, 0);
}

function initFX() {
  initDebris();
  fire = new PSys(5000, true, 1.6);
  smoke = new PSys(4500, false, 1.4);
  initTracers();
  initFlashLights();
}
function updateFX(dt) {
  updateDebris(dt);
  fire.update(dt); smoke.update(dt);
  updateFlash(dt);
}
