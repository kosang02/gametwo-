'use strict';
// ─────────────────────────────────────────────────────────────
//  전투: 투사체, 폭발, 화재, 지원 화력(포격/공습/미사일/핵/블랙홀)
// ─────────────────────────────────────────────────────────────
let projs = [];
const pendingBooms = [];
let bhole = null, bholeMesh = null, bholeRing = null;
const planes = [];
const emitters = [];
let nukeFlash = 0;

const PK = {
  bullet:  { g: .04, box: null },
  rocket:  { g: .08, r: 3.2, power: 200, at: 2.1, box: [.22, .22, .9], col: 'rocketBody' },
  grenade: { g: 1, r: 3, power: 150, bounce: true, box: [.3, .3, .3], col: 'tube' },
  cluster: { g: 1, r: 2.6, power: 140, box: [.5, .5, .5], col: 'yellow' },
  bomblet: { g: 1, r: 2.4, power: 100, bounce: true, box: [.25, .25, .25], col: 'yellow' },
  napalm:  { g: 1, r: 2, power: 60, box: [.5, .5, .9], col: 'red' },
  shell:   { g: .35, r: 4.2, power: 240, at: 1.9, box: [.28, .28, .7], col: 'shell' },
  arty:    { g: 0, r: 4.6, power: 320, box: [.35, .35, 1.2], col: 'shell' },
  bomb:    { g: 1, r: 5.2, power: 400, box: [.6, .6, 1.6], col: 'nuke' },
  missile: { g: 0, r: 7, power: 900, at: 1.3, box: [.6, .6, 2.6], col: 'steel' },
  nuke:    { g: .3, r: 19, power: 6000, box: [1.4, 1.4, 2.6], col: 'nuke' },
  mortar:  { g: 1, r: 3.6, power: 230, box: [.3, .3, .6], col: 'shell' },
  charge:  { g: 1, r: 5, power: 380, at: 2.2, bounce: true, sticky: true, box: [.55, .4, .55], col: 'red' },
};
function addProj(kind, x, y, z, vx, vy, vz, team, opt) {
  const p = { kind, x, y, z, vx, vy, vz, team, life: 0, fuse: 0, dmg: 0, pierce: 0, owner: null, bounces: 0, trail: 0 };
  if (opt) Object.assign(p, opt);
  projs.push(p);
  return p;
}
const _spread = (a) => (Math.random() - .5) * 2 * a;
function fireBullet(u, sx, sy, sz, tx, ty, tz, dmg, spread, speed, pierce, snd) {
  let dx = tx - sx, dy = ty - sy, dz = tz - sz;
  const d = Math.hypot(dx, dy, dz) || 1;
  dx = dx / d + _spread(spread); dy = dy / d + _spread(spread) * .6; dz = dz / d + _spread(spread);
  const n = Math.hypot(dx, dy, dz);
  const p = addProj('bullet', sx, sy, sz, dx / n * speed, dy / n * speed, dz / n * speed, u.team, { dmg, pierce: pierce ? 2 : 0, owner: u, sniper: snd === 'sniper' });
  if (snd) { muzzleFlash(sx, sy, sz, snd === 'sniper' || snd === 'shotgun'); sfxShot(snd, sx, sy, sz); }
  return p;
}
// 탄도 계산: 속도 v로 (dx,dz 수평거리 d, 높이차 h) 맞히는 발사각 (낮은 궤적)
function ballisticAngle(d, h, v, g, high) {
  const v2 = v * v, disc = v2 * v2 - g * (g * d * d + 2 * h * v2);
  if (disc < 0) return Math.PI / 4;
  const s = Math.sqrt(disc);
  return Math.atan((v2 + (high ? s : -s)) / (g * d));
}
function fireWeapon(u, tx, ty, tz, breach) {
  const T = UT[u.type];
  const fwd = u.type === 'tank' ? u.turret : u.yaw;
  const td = Math.hypot(tx - u.x, tz - u.z);
  const mx = u.x + Math.sin(fwd) * .9, mz = u.z + Math.cos(fwd) * .9, my = u.y + 1.55;
  switch (T.wpn) {
    case 'rifle':
      fireBullet(u, mx, my, mz, tx, ty, tz, T.dmg + Math.random() * 8, T.spread + (u.moving ? .02 : 0), 150, false, 'rifle');
      u.cd = T.cd + Math.random() * .35; break;
    case 'pistol':
      fireBullet(u, mx, my, mz, tx, ty, tz, T.dmg, T.spread, 120, false, 'rifle');
      u.cd = T.cd + Math.random() * .3; break;
    case 'mg':
      fireBullet(u, mx, my - .05, mz, tx, ty, tz, T.dmg, T.spread, 150, false, 'mg');
      u.burst++;
      u.cd = u.burst % T.burst === 0 ? T.reload + Math.random() * .6 : T.cd; break;
    case 'sniper':
      fireBullet(u, mx + Math.sin(fwd) * .5, my, mz + Math.cos(fwd) * .5, tx, ty, tz, T.dmg, T.spread, 320, true, 'sniper');
      u.cd = T.cd + Math.random() * .8; break;
    case 'rocket': {
      const sx = u.x + Math.sin(fwd) * .9 + Math.cos(fwd) * .28, sz = u.z + Math.cos(fwd) * .9 - Math.sin(fwd) * .28, sy = u.y + 1.98;
      let dx = tx - sx, dy = ty - sy, dz = tz - sz; const d = Math.hypot(dx, dy, dz) || 1;
      dx = dx / d + _spread(.03); dy = dy / d + _spread(.02); dz = dz / d + _spread(.03);
      addProj('rocket', sx, sy, sz, dx * 26, dy * 26, dz * 26, u.team, { owner: u });
      smokePuff(sx - Math.sin(fwd) * 1.4, sy, sz - Math.cos(fwd) * 1.4, .8, 6, false);
      muzzleFlash(sx - Math.sin(fwd) * 1, sy, sz - Math.cos(fwd) * 1, true);
      sfxShot('rocket', sx, sy, sz);
      u.cd = T.cd + Math.random() * 1.2; break;
    }
    case 'grenade': {
      const sx = mx, sy = u.y + 2.3, sz = mz;
      const dx = tx - sx, dz = tz - sz, d = Math.hypot(dx, dz), v = Math.min(26, Math.sqrt(GRAV * Math.max(d, 4) * 1.15) + 1);
      const a = ballisticAngle(d, ty - .8 - sy, v, GRAV, false);
      const yawj = Math.atan2(dx, dz) + _spread(.06), vh = Math.cos(a) * v * (.94 + Math.random() * .1);
      addProj('grenade', sx, sy, sz, Math.sin(yawj) * vh, Math.sin(a) * v, Math.cos(yawj) * vh, u.team, { fuse: Math.max(1.3, d / vh + .5), owner: u });
      sfxShot('throw', sx, sy, sz);
      u.cd = T.cd + Math.random() * 1; break;
    }
    case 'shotgun':
      for (let k = 0; k < 8; k++) {
        const p = fireBullet(u, mx, my, mz, tx, ty, tz, T.dmg, T.spread, 115, false, k ? null : 'shotgun');
        p.knock = 2.6; p.maxLife = .2;
      }
      u.cd = T.cd + Math.random() * .3; break;
    case 'flame': fireFlame(u, tx, ty, tz); break;
    case 'mortar': {
      const sx = u.x + Math.sin(fwd) * .8, sy = u.y + .9, sz = u.z + Math.cos(fwd) * .8;
      const err = 1.5 + td * .035;
      const ex = tx + _spread(err), ez = tz + _spread(err);
      const dx = ex - sx, dz = ez - sz, X = Math.hypot(dx, dz), Y = ty - 1 - sy, th = 1.15, c2 = Math.cos(th) ** 2;
      const den = Math.max(1, 2 * c2 * (X * Math.tan(th) - Y)), v = Math.min(62, Math.sqrt(GRAV * X * X / den));
      const yj = Math.atan2(dx, dz);
      addProj('mortar', sx, sy, sz, Math.sin(yj) * Math.cos(th) * v, Math.sin(th) * v, Math.cos(yj) * Math.cos(th) * v, u.team, { owner: u });
      smokePuff(sx, sy + .5, sz, .7, 6, false); muzzleFlash(sx, sy + .6, sz, true);
      sfxShot('mortar', sx, sy, sz);
      u.cd = T.cd + Math.random() * 1.5; break;
    }
    case 'charge':
      addProj('charge', u.x + Math.sin(fwd) * .7, u.y + .6, u.z + Math.cos(fwd) * .7, Math.sin(fwd) * 3, 2, Math.cos(fwd) * 3, u.team, { fuse: 3.2, owner: u });
      sfxShot('throw', u.x, u.y, u.z);
      u.cd = T.cd; u.fleeT = 3.4; break;
    case 'bite': {
      const tg = u.target;
      if (tg && !tg.dead && Math.hypot(tg.x - u.x, tg.z - u.z) < 2.9 && Math.abs(tg.y - u.y) < 2.2) {
        const veh = UT[tg.type].veh, dl = Math.hypot(tg.x - u.x, tg.z - u.z) || 1;
        damageUnit(tg, T.dmg * (veh ? .12 : 1), u.team, (tg.x - u.x) / dl, (tg.z - u.z) / dl);
        if (!veh) { knockUnit(tg, (tg.x - u.x) / dl * 4, 2, (tg.z - u.z) / dl * 4); bloodBurst(tg.x, tg.y + 1.2, tg.z, 0, 0, 6); }
        sfxShot('bark', u.x, u.y, u.z);
      }
      u.bite = .25; u.cd = T.cd + Math.random() * .3; break;
    }
    case 'heli': {
      const side = (u.burst++ & 1) ? 1 : -1, c = Math.cos(u.yaw), sn = Math.sin(u.yaw);
      const lx = 1.2 * side, lz = .9;
      const sx = u.x + c * lx + sn * lz, sy = u.y + .9, sz = u.z - sn * lx + c * lz;
      let dx = tx - sx, dy = ty - sy, dz = tz - sz; const d = Math.hypot(dx, dy, dz) || 1;
      dx = dx / d + _spread(.035); dy = dy / d + _spread(.03); dz = dz / d + _spread(.035);
      addProj('rocket', sx, sy, sz, dx * 32, dy * 32, dz * 32, u.team, { owner: u });
      smokePuff(sx, sy, sz, .6, 4, false); sfxShot('rocket', sx, sy, sz);
      u.cd = u.burst & 1 ? .22 : T.cd + Math.random() * 1.2; break;
    }
    case 'cannon': {
      const v = 85, g = GRAV * PK.shell.g;
      const bx = u.x + Math.sin(u.turret) * 4.6, bz = u.z + Math.cos(u.turret) * 4.6, by = u.y + 2.45;
      const dx = tx - bx, dz = tz - bz, d = Math.hypot(dx, dz);
      let a = breach ? -.05 : ballisticAngle(d, ty - by, v, g, false);
      a += _spread(.012 + d * .0002);
      u.barrel = Math.max(-.1, Math.min(.5, a));
      const yawj = u.turret + _spread(.015 + d * .00025);
      addProj('shell', bx, by, bz, Math.sin(yawj) * Math.cos(a) * v, Math.sin(a) * v, Math.cos(yawj) * Math.cos(a) * v, u.team, { owner: u });
      fireBurst(bx, by, bz, .9, 10); smokePuff(bx, by, bz, 1.2, 10, false);
      flashLight(bx, by, bz, 1.2, 16, .12);
      u.recoil = 1; u.vx -= Math.sin(u.turret) * 2; u.vz -= Math.cos(u.turret) * 2;
      sfxShot('cannon', bx, by, bz); addShake(.25, bx, by, bz);
      u.cd = T.cd + Math.random() * 1.4; break;
    }
  }
}

function fireFlame(u, tx, ty, tz) {
  const fwd = u.yaw, sx = u.x + Math.sin(fwd) * .95, sy = u.y + 1.4, sz = u.z + Math.cos(fwd) * .95;
  let dx = tx - sx, dy = ty - sy, dz = tz - sz;
  const d = Math.hypot(dx, dy, dz) || 1; dx /= d; dy /= d; dz /= d;
  for (let k = 0; k < 3; k++) {
    const sp = 15 + Math.random() * 6;
    fire.spawn(sx, sy, sz, (dx + R(.24)) * sp, (dy + R(.16)) * sp + 1, (dz + R(.24)) * sp, .45 + Math.random() * .25, .3, 2.3, C.hot0, C.fire1, 1.7, -2.5);
  }
  if (Math.random() < .15) smoke.spawn(sx + dx * 8, sy + 1, sz + dz * 8, R(1), 2, R(1), 2, 1.2, 3.5, C.dark0, C.dark1, .8, -.8);
  const range = 12.5;
  unitsNear(u.x, u.z, range + 2, v => {
    if (v.dead || v.team === u.team || UT[v.type].air) return;
    const ox = v.x - u.x, oz = v.z - u.z, dist = Math.hypot(ox, oz);
    if (dist > range || Math.abs(v.y - u.y) > 4) return;
    if (Math.abs(angDiff(fwd, Math.atan2(ox, oz))) > .32 + 1 / (dist + 1)) return;
    damageUnit(v, UT[v.type].veh ? 1.2 : 3.4, u.team, ox / (dist || 1), oz / (dist || 1));
    v.burn = Math.max(v.burn, 3.5); v.burnTeam = u.team;
  });
  if (Math.random() < .35) { const h = raycast(sx, sy, sz, dx, dy, dz, range); if (h) igniteVoxel(h.x, h.y, h.z); }
  u.sndT = (u.sndT || 0) - UT.flame.cd;
  if (u.sndT <= 0) { u.sndT = .3; sfxShot('flame', sx, sy, sz); }
  u.cd = UT.flame.cd;
}

// ───────────── 지뢰 ─────────────
const mines = [];
function placeMine(x, z, team) {
  const y = surfaceY(x, z);
  if (y <= WATER_Y + .2) return;
  mines.push({ x, y, z, team, arm: 1.5, t: Math.random() * 2, boom: false });
}
function updateMines(dt) {
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i];
    m.t += dt;
    if (!solidAt(Math.floor(m.x), Math.floor(m.y - .5), Math.floor(m.z))) { m.y -= dt * 12; if (m.y < 0) mines.splice(i, 1); continue; }
    if (m.arm > 0) { m.arm -= dt; continue; }
    let hit = m.boom;
    if (!hit) unitsNear(m.x, m.z, 3, u => {
      if (!hit && !u.dead && u.team !== m.team && !UT[u.type].air && Math.hypot(u.x - m.x, u.z - m.z) < u.hw + .7 && Math.abs(u.y - m.y) < 1.5) hit = true;
    });
    if (hit) { mines.splice(i, 1); explode(m.x, m.y + .3, m.z, 3, { power: 280, team: m.team, at: 1.8 }); }
  }
}
function drawMines() {
  for (const m of mines) {
    _B.makeTranslation(m.x, m.y, m.z);
    part(_B, 0, 0, 0, 0, 0, .07, 0, .9, .14, .9, PALC.mine, 0);
    part(_B, 0, 0, 0, 0, 0, .18, 0, .18, .1, .18, (m.t % 1) < .5 && m.arm <= 0 ? PALC['team' + m.team] : PALC.boot, 0);
  }
}

// 선분-AABB 교차 (slab)
function segAABB(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let tmin = 0, tmax = 1;
  const o = [ox, oy, oz], d = [dx, dy, dz], a = [x0, y0, z0], b = [x1, y1, z1];
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) < 1e-9) { if (o[k] < a[k] || o[k] > b[k]) return -1; continue; }
    let t1 = (a[k] - o[k]) / d[k], t2 = (b[k] - o[k]) / d[k];
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  return tmin;
}
function hitUnitOnSeg(p, x, y, z, dx, dy, dz) {
  let best = null, bt = 2;
  const len = Math.hypot(dx, dz);
  unitsNear(x + dx / 2, z + dz / 2, len / 2 + 4, u => {
    if (u.dead || u === p.owner || (p.team >= 0 && u.team === p.team) || p.hitSet && p.hitSet.has(u)) return;
    const hw = u.hw + .08, hh = u.stun > 0 && !UT[u.type].veh ? 1.4 : u.h;
    const t = segAABB(x, y, z, dx, dy, dz, u.x - hw, u.y, u.z - hw, u.x + hw, u.y + hh, u.z + hw);
    if (t >= 0 && t < bt) { bt = t; best = u; }
  });
  return best ? [best, bt] : null;
}
function updateProjectiles(dt) {
  const cur = projs; projs = [];
  for (const p of cur) if (stepProj(p, dt)) projs.push(p);
}
function stepProj(p, dt) {
  const K = PK[p.kind];
  p.life += dt;
  if (p.kind === 'rocket') {
    const s = Math.hypot(p.vx, p.vy, p.vz);
    if (s < 75) { const k = 1 + dt * 1.6; p.vx *= k; p.vy *= k; p.vz *= k; }
    p.trail += dt;
    while (p.trail > .016) {
      p.trail -= .016;
      smoke.spawn(p.x, p.y, p.z, R(.6), R(.6) + .5, R(.6), 1.6 + Math.random(), .5, 2.4, C.smoke0, C.smoke1, 1, -.6);
    }
    fire.spawn(p.x, p.y, p.z, -p.vx * .05, -p.vy * .05, -p.vz * .05, .08, .9, .3, C.hot0, C.fire1, 0, 0);
  } else if (p.kind === 'missile' || p.kind === 'arty' || p.kind === 'nuke' || p.kind === 'bomb') {
    if (p.kind === 'missile' || Math.random() < dt * 30) {
      smoke.spawn(p.x, p.y, p.z, R(1), R(1), R(1), 2.5, p.kind === 'missile' ? 1.2 : .6, 4, C.smoke0, C.smoke1, .6, -.3);
      if (p.kind === 'missile') fire.spawn(p.x, p.y, p.z, 0, 0, 0, .1, 2, .5, C.hot0, C.fire1, 0, 0);
    }
    if (p.kind === 'nuke') { p.vy = Math.max(p.vy, -16); }
  } else if (p.kind === 'shell' && Math.random() < dt * 40) {
    smoke.spawn(p.x, p.y, p.z, 0, 0, 0, .6, .3, 1, C.steam0, C.steam1, 0, 0);
  } else if (p.kind === 'napalm' && Math.random() < dt * 40) {
    fire.spawn(p.x, p.y, p.z, 0, 0, 0, .3, .8, .3, C.fire0, C.fire1, 0, 0);
  }
  if (p.kind === 'mortar' && p.vy < 0 && !p.whistled) { p.whistled = true; sfxWhistle(p.x, p.y, p.z, .9); }
  if (p.maxLife && p.life > p.maxLife) return false;
  if (p.fuse > 0) {
    p.fuse -= dt;
    if (p.fuse <= 0) { detonate(p, p.x, p.y, p.z); return false; }
  }
  if (p.stuck) {
    // 붙어 있던 벽이 사라지면 다시 떨어짐
    if (!solidAt(Math.floor(p.x + p.sx), Math.floor(p.y + p.sy), Math.floor(p.z + p.sz))) p.stuck = false;
    else return true;
  }
  p.vy -= GRAV * K.g * dt;
  if (bhole) {
    const ax = bhole.x - p.x, ay = bhole.y - p.y, az = bhole.z - p.z, d = Math.hypot(ax, ay, az) + .5;
    if (d < bhole.r * 3) { const f = 120 / d * dt; p.vx += ax / d * f; p.vy += ay / d * f; p.vz += az / d * f; }
  }
  let dx = p.vx * dt, dy = p.vy * dt, dz = p.vz * dt;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return true;
  // 유닛 / 지형 교차
  const uh = (K.bounce) ? null : hitUnitOnSeg(p, p.x, p.y, p.z, dx, dy, dz);
  const vh = raycast(p.x, p.y, p.z, dx / len, dy / len, dz / len, len);
  const tv = vh ? vh.t / len : 2;
  if (uh && uh[1] <= tv) {
    const u = uh[0], t = uh[1];
    const hx = p.x + dx * t, hy = p.y + dy * t, hz = p.z + dz * t;
    if (p.kind === 'bullet') {
      const tank = !!UT[u.type].veh;
      const dl = Math.hypot(p.vx, p.vz) || 1;
      const armor = u.type === 'tank' ? .06 : u.type === 'heli' ? (p.sniper ? .5 : .25) : 1;
      damageUnit(u, p.dmg * armor, p.team, p.vx / dl, p.vz / dl);
      if (p.knock && !tank) knockUnit(u, p.vx / dl * p.knock, .9, p.vz / dl * p.knock);
      if (tank) sparks(hx, hy, hz, 5, 8);
      else {
        bloodBurst(hx, hy, hz, p.vx / dl, p.vz / dl, 6);
        u.vx += p.vx / dl * (p.sniper ? 3 : .4); u.vz += p.vz / dl * (p.sniper ? 3 : .4);
        if (p.sniper && u.dead) knockUnit(u, p.vx / dl * 6, 3, p.vz / dl * 6);
      }
      if (p.pierce > 0 && !tank) {
        p.pierce--; p.dmg *= .6;
        (p.hitSet || (p.hitSet = new Set())).add(u);
      } else return false;
    } else { detonate(p, hx, hy, hz, u); return false; }
  } else if (vh) {
    const hx = p.x + dx * tv, hy = p.y + dy * tv, hz = p.z + dz * tv;
    if (p.kind === 'bullet') { bulletHitVoxel(p, vh, hx, hy, hz); return false; }
    if (K.sticky) {
      p.x = hx - dx / len * .2; p.y = hy - dy / len * .2; p.z = hz - dz / len * .2;
      p.vx = p.vy = p.vz = 0; p.stuck = true; p.sx = -vh.nx * .6; p.sy = -vh.ny * .6; p.sz = -vh.nz * .6;
      sfxShot('clink', p.x, p.y, p.z);
      return true;
    }
    if (K.bounce && p.bounces < 6) {
      // 반사
      const nx = vh.nx, ny = vh.ny, nz = vh.nz;
      const vn = p.vx * nx + p.vy * ny + p.vz * nz;
      p.vx = (p.vx - 2 * vn * nx) * .45; p.vy = (p.vy - 2 * vn * ny) * .38; p.vz = (p.vz - 2 * vn * nz) * .45;
      p.x = hx + nx * .2; p.y = hy + ny * .2; p.z = hz + nz * .2;
      if (ny > 0 && Math.abs(p.vy) < 2) { p.vy = 0; p.vx *= .6; p.vz *= .6; }
      if (p.bounces++ < 3 && Math.abs(vn) > 3) sfxShot('clink', p.x, p.y, p.z);
      return true;
    }
    detonate(p, hx - dx / len * .3, hy - dy / len * .3, hz - dz / len * .3);
    return false;
  }
  p.x += dx; p.y += dy; p.z += dz;
  if (p.x < -40 || p.x > SX + 40 || p.z < -40 || p.z > SZ + 40 || p.y < -5 || p.life > 14) {
    if (p.y < -5 && p.kind !== 'bullet') detonate(p, p.x, 0, p.z);
    return false;
  }
  return true;
}
function bulletHitVoxel(p, vh, hx, hy, hz) {
  const t = vh.v, m = MAT[t];
  if (EXPLOSIVE[t]) { igniteTNT(vh.x, vh.y, vh.z); return; }
  if (vh.y > 0 && m.hard < .35 && Math.random() < (m.hard < .03 ? 1 : p.sniper ? .9 : .28)) {
    setVox(vh.x, vh.y, vh.z, 0);
    spawnDebrisVoxel(vh.x, vh.y, vh.z, t, vh.nx * 4 + R(3), 3 + Math.random() * 3, vh.nz * 4 + R(3));
    if (m.flam > 0 && Math.random() < .03) igniteVoxel(vh.x, vh.y, vh.z);
    queueCollapseCheck(vh.x, vh.y, vh.z, 1);
  }
  const c = voxColor(t, vh.x, vh.y, vh.z, 2, 0);
  for (let k = 0; k < 2; k++) spawnDebris(hx, hy, hz, vh.nx * 4 + R(4), 2 + Math.random() * 4, vh.nz * 4 + R(4), .12, c[0], c[1], c[2], 1.2);
  smoke.spawn(hx, hy, hz, vh.nx, .8, vh.nz, .7, .3, 1.2, C.dust0, C.dust1, 2, 0);
  if (m.hard > .5) sparks(hx, hy, hz, 2, 6);
}
function detonate(p, x, y, z, directUnit) {
  const K = PK[p.kind];
  switch (p.kind) {
    case 'cluster':
      explode(x, y, z, K.r, { power: K.power, team: p.team });
      for (let k = 0; k < 12; k++) {
        const a = Math.random() * Math.PI * 2, s = 7 + Math.random() * 8;
        addProj('bomblet', x, y + 1, z, Math.cos(a) * s, 9 + Math.random() * 8, Math.sin(a) * s, p.team, { fuse: .9 + Math.random() * 1.2 });
      }
      break;
    case 'napalm':
      explode(x, y, z, K.r, { power: K.power, team: p.team, fire: true });
      napalmCarpet(x, y, z, 9, p.team);
      break;
    case 'nuke':
      explode(x, y, z, K.r, { power: K.power, team: p.team, nuke: true });
      break;
    default:
      explode(x, y, z, K.r, { power: K.power, team: p.team, at: K.at, direct: directUnit });
  }
}

// ───────────── 폭발 ─────────────
function queueExplosion(x, y, z, r, opt, delay) { pendingBooms.push({ x, y, z, r, opt, t: delay }); }
function updatePending(dt) {
  for (let i = pendingBooms.length - 1; i >= 0; i--) {
    const b = pendingBooms[i];
    b.t -= dt;
    if (b.t <= 0) { pendingBooms.splice(i, 1); explode(b.x, b.y, b.z, b.r, b.opt); }
  }
}
function explode(x, y, z, r, o) {
  o = o || {};
  const power = o.power || r * 80, nuke = !!o.nuke;
  const cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z);
  const RR = Math.ceil(r + 1.5);
  let tnt = 0, removed = 0;
  const vol = 4.19 * r * r * r;
  const debrisP = Math.min(.6, (nuke ? 900 : 320) / vol);
  for (let dy = -RR; dy <= RR; dy++) for (let dz = -RR; dz <= RR; dz++) for (let dx = -RR; dx <= RR; dx++) {
    const X = cx + dx, Y = cy + dy, Z = cz + dz;
    if (X < 0 || X >= SX || Y < 1 || Y >= SY || Z < 0 || Z >= SZ) continue;
    const d = Math.sqrt(dx * dx + dy * dy * 1.15 + dz * dz);
    const i = vidx(X, Y, Z), t = vox[i];
    const rr = r * (.86 + hash3(X, Y, Z) * .28);
    if (d > rr) {
      // 그을음
      if (t && d < rr + 1.8 && vtint[i] < 200) { vtint[i] = Math.min(120, vtint[i] + 70 + ((d - rr) < 1 ? 40 : 0)); markDirty(X, Y, Z); }
      if (t && d < rr + 2.2 && MAT[t].flam > 0 && Math.random() < (o.fire ? .6 : .25)) igniteVoxel(X, Y, Z);
      continue;
    }
    if (!t) continue;
    if (EXPLOSIVE[t]) { tnt += t === M.TNT ? 1 : .55; vox[i] = 0; vtint[i] = 0; markDirty(X, Y, Z); continue; }
    const f = 1 - d / r;
    const hard = MAT[t].hard * (nuke ? .25 : 1);
    if (Math.random() < hard * 1.5 - f * .9) {
      if (vtint[i] < 200) { vtint[i] = 110; markDirty(X, Y, Z); }
      continue;
    }
    vox[i] = 0; vtint[i] = 0; markDirty(X, Y, Z); removed++;
    if (Y + 1 < SY && vox[i + SX * SZ] === M.SAND) sandQueue.add(i + SX * SZ);
    if (Math.random() < debrisP) {
      const dl = d || 1, sp = (6 + f * 16) * (.5 + Math.random() * .8) * (nuke ? 2 : 1);
      const ux = dx / dl, uy = dy / dl, uz = dz / dl;
      spawnDebrisVoxel(X, Y, Z, t, ux * sp, (uy * .6 + .7) * sp + 4, uz * sp);
    }
  }
  if (tnt) queueExplosion(x, y, z, Math.min(14, r * .4 + 2.4 + Math.cbrt(tnt) * 1.55), { power: 220 + tnt * 25, team: o.team, fire: true }, .06);
  if (removed || tnt) queueCollapseCheck(cx, cy, cz, r + 1);

  // 유닛
  const reach = r * 2.1;
  unitsNear(x, z, reach + 3, u => {
    const ux = u.x, uy = u.y + u.h * .5, uz = u.z;
    let dx = ux - x, dy = uy - y, dz = uz - z;
    const d = Math.hypot(dx, dy, dz);
    if (d > reach) return;
    let f = Math.max(0, 1 - d / reach);
    if (u === o.direct) f = 1;
    const cover = d > r * .9 && !lineClear(x, y + .2, z, ux, uy, uz) ? .3 : 1;
    const tank = !!UT[u.type].veh;
    let dmg = power * Math.pow(f, 1.5) * cover;
    if (tank) dmg *= (o.at || 1) * (nuke ? 1 : .8);
    const dl = d || 1;
    if (!u.dead) damageUnit(u, dmg, o.team != null ? o.team : -1, dx / dl, dz / dl);
    const imp = Math.min(nuke ? 60 : 32, power / 16 * f * cover);
    dy = Math.max(dy / dl, .25);
    knockUnit(u, dx / dl * imp, (dy * .7 + .55) * imp, dz / dl * imp);
    if ((o.fire || nuke) && f > .3) { u.burn = Math.max(u.burn, 3 + Math.random() * 2); u.burnTeam = o.team; }
  });
  pushDebris(x, y, z, r * 2.5, Math.min(40, power / 14));
  for (const m of mines) if (Math.hypot(m.x - x, m.y - y, m.z - z) < r * 1.3) m.boom = true;

  // 시각/청각 효과
  const big = Math.min(1, r / 8);
  boomFX(x, y, z, r, nuke);
  const gy = groundBelow(x, y + 1, z);
  if (gy > y - r) dustBurst(x, Math.max(y - r * .5, gy - 1), z, r, Math.min(60, 6 + r * 4));
  if (y < WATER_Y + 2 && y > WATER_Y - r && isWaterArea(x, z)) splash(x, z, r);
  flashLight(x, y + 1, z, 1.6 + big * 3, r * 8 + 10, .25 + big * .3);
  if (r >= 2.5) shockRing(x, Math.max(y - r * .3, gy), z, r * (nuke ? 9 : 3.4), nuke ? 1.8 : .45 + big * .3);
  addShake(Math.min(2.4, r * .13 + (nuke ? 2 : 0)), x, y, z);
  sfxBoom(r, x, y, z);
  if (nuke) startMushroom(x, y, z);
}
function boomFX(x, y, z, r, nuke) {
  const rr = Math.min(r, 9);
  // 순간 섬광
  fire.spawn(x, y, z, 0, 0, 0, .12, rr * 1.7, rr * 1.1, C.flash0, C.hot1, 0, 0);
  // 화구
  const nf = Math.min(130, 14 + r * 7);
  for (let k = 0; k < nf; k++) {
    const a = Math.random() * 6.283, e = Math.random() * 2 - 1, q = Math.sqrt(1 - e * e), d = Math.random() * rr * .45;
    const ux = Math.cos(a) * q, uy = e * .8 + .25, uz = Math.sin(a) * q, sp = rr * (1.2 + Math.random() * 2.6);
    fire.spawn(x + ux * d, y + uy * d, z + uz * d, ux * sp, uy * sp + 2.5, uz * sp,
      .45 + Math.random() * .65, rr * (.7 + Math.random() * .5), rr * (1.5 + Math.random() * .8), C.hot0, C.fire1, 3.2, -3.5);
  }
  // 연기 기둥
  const ns = Math.min(90, 8 + r * 5);
  for (let k = 0; k < ns; k++) {
    const a = Math.random() * 6.283, d = Math.random() * rr * .7;
    smoke.spawn(x + Math.cos(a) * d, y + Math.random() * rr * .5, z + Math.sin(a) * d,
      Math.cos(a) * rr * .9, 2 + Math.random() * 4 + rr * .3, Math.sin(a) * rr * .9,
      3 + Math.random() * 4, rr * .9 + 1, rr * 2.6 + 3, C.dark0, C.dark1, 1.1, -1.1);
  }
  sparks(x, y, z, Math.min(90, 8 + r * 6), 10 + r * 3);
}
function isWaterArea(x, z) { return surfaceY(x, z) < WATER_Y; }
function splash(x, z, r) {
  for (let k = 0; k < 20 + r * 8; k++)
    smoke.spawn(x + R(r), WATER_Y, z + R(r), R(4), 8 + Math.random() * 14, R(4), 1 + Math.random(), .8, 2.5, C.steam0, C.steam1, .8, GRAV * .7);
}
function igniteTNT(x, y, z) {
  const i = vidx(x, y, z), t = vox[i];
  if (!EXPLOSIVE[t]) return;
  vox[i] = 0; markDirty(x, y, z);
  if (t === M.TNT) queueExplosion(x + .5, y + .5, z + .5, 3, { power: 220, team: -1, fire: true }, .05);
  else queueExplosion(x + .5, y + .5, z + .5, 2.6, { power: 170, team: -1, fire: true }, .08 + Math.random() * .12);
}

// ───────────── 화재 ─────────────
const burning = new Map();
let fireTick = 0;
function igniteVoxel(x, y, z) {
  if (x < 0 || x >= SX || y < 1 || y >= SY || z < 0 || z >= SZ) return;
  const i = vidx(x, y, z), t = vox[i];
  if (EXPLOSIVE[t]) { igniteTNT(x, y, z); return; }
  if (!t || MAT[t].flam <= 0 || burning.has(i) || burning.size > 2200) return;
  burning.set(i, 3 + Math.random() * 5);
}
const groundFires = [];
function napalmCarpet(x, y, z, r, team) {
  for (let k = 0; k < 26; k++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
    const fx = x + Math.cos(a) * d, fz = z + Math.sin(a) * d, fy = surfaceY(fx, fz);
    groundFires.push({ x: fx, y: fy, z: fz, t: 6 + Math.random() * 6, team });
  }
  for (let k = 0; k < 80; k++) fire.spawn(x, y + 1, z, R(30), 4 + Math.random() * 14, R(30), .8 + Math.random() * .6, 2, 4, C.hot0, C.fire1, 2.5, GRAV * .3);
  flashLight(x, y + 2, z, 6, 50, 1.2);
}
function updateFire(dt) {
  fireTick += dt;
  // 지면 화염 (네이팜)
  for (let k = groundFires.length - 1; k >= 0; k--) {
    const g = groundFires[k];
    g.t -= dt;
    if (Math.random() < dt * 14) fire.spawn(g.x + R(1.6), g.y + .3, g.z + R(1.6), R(.6), 2 + Math.random() * 3, R(.6), .6 + Math.random() * .5, 1.6, .5, C.fire0, C.fire1, 1, -3);
    if (Math.random() < dt * 2) smoke.spawn(g.x, g.y + 2, g.z, R(1), 3, R(1), 3, 2, 6, C.dark0, C.dark1, .5, -.6);
    if (Math.random() < dt * 2) {
      unitsNear(g.x, g.z, 2.6, u => { if (Math.hypot(u.x - g.x, u.z - g.z) < 2.2 && Math.abs(u.y - g.y) < 2) { u.burn = Math.max(u.burn, 3); u.burnTeam = g.team; } });
      for (let j = 0; j < 3; j++) igniteVoxel(Math.floor(g.x + R(3)), Math.floor(g.y + R(2)), Math.floor(g.z + R(3)));
    }
    if (g.t <= 0) groundFires.splice(k, 1);
  }
  if (fireTick < .1) return;
  const step = fireTick; fireTick = 0;
  if (!burning.size) return;
  const L = SX * SZ;
  let budget = 140;
  for (const [i, t0] of burning) {
    const t = t0 - step;
    const y = (i / L) | 0, r = i - y * L, z = (r / SX) | 0, x = r - z * SX;
    if (!vox[i]) { burning.delete(i); continue; }
    if (budget > 0 && Math.random() < .55) {
      budget--;
      fire.spawn(x + Math.random(), y + 1, z + Math.random(), R(.4), 2 + Math.random() * 2, R(.4), .5 + Math.random() * .5, 1.4, .4, C.fire0, C.fire1, 1, -2.5);
      if (Math.random() < .15) smoke.spawn(x + .5, y + 2, z + .5, R(.6), 2.5, R(.6), 3, 1.5, 5, C.dark0, C.dark1, .4, -.5);
    }
    // 번짐
    if (Math.random() < .4) {
      const o = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]][(Math.random() * 7) | 0];
      const nx = x + o[0], ny = y + o[1], nz = z + o[2], nt = getV(nx, ny, nz);
      if (nt && MAT[nt].flam > 0 && Math.random() < MAT[nt].flam * 9) igniteVoxel(nx, ny, nz);
    }
    if (Math.random() < .2) unitsNear(x, z, 2, u => { if (Math.abs(u.x - x - .5) < 1.4 && Math.abs(u.z - z - .5) < 1.4 && u.y - y < 2.5 && y - u.y < 3) u.burn = Math.max(u.burn, 2.5); });
    if (t <= 0) {
      burning.delete(i);
      vox[i] = 0; vtint[i] = 0; markDirty(x, y, z);
      if (Math.random() < .3) spawnDebris(x + .5, y + .5, z + .5, R(2), 1, R(2), .4, .05, .045, .04, 3);
      if (Math.random() < .25) queueCollapseCheck(x, y, z, 2);
    } else {
      burning.set(i, t);
      if (vtint[i] < 100) { vtint[i] = Math.min(120, vtint[i] + 15); markDirty(x, y, z); }
    }
  }
}

// ───────────── 지원 화력 ─────────────
function throwFromCamera(kind, tx, ty, tz) {
  const cp = camera.position;
  let dx = tx - cp.x, dy = ty - cp.y, dz = tz - cp.z;
  const d = Math.hypot(dx, dy, dz);
  const sx = cp.x + dx / d * 4, sy = cp.y + dy / d * 4 - 1.5, sz = cp.z + dz / d * 4;
  const T = Math.max(.9, Math.min(2.4, d / 45));
  const g = GRAV * PK[kind].g;
  const vx = (tx - sx) / T, vz = (tz - sz) / T, vy = (ty + .5 - sy) / T + .5 * g * T;
  addProj(kind, sx, sy, sz, vx, vy, vz, -1, { fuse: kind === 'grenade' ? T + 1.4 : 0 });
  sfxShot('throw', tx, ty, tz);
}
const strikes = [];
function callArtillery(tx, tz) {
  for (let k = 0; k < 7; k++) strikes.push({ t: .5 + k * .32 + Math.random() * .2, fn: () => {
    const x = tx + R(16), z = tz + R(16), y = surfaceY(x, z);
    const sx = x - 30, sy = 95, sz = z - 10, T = 1.25;
    addProj('arty', sx, sy, sz, (x - sx) / T, (y - sy) / T, (z - sz) / T, -1);
    sfxWhistle(x, y, z, 1.2);
  } });
}
function callMissile(tx, ty, tz) {
  const a = Math.random() * Math.PI * 2;
  const sx = tx + Math.cos(a) * 60, sy = 110, sz = tz + Math.sin(a) * 60;
  const dx = tx - sx, dy = ty - sy, dz = tz - sz, d = Math.hypot(dx, dy, dz), v = 95;
  addProj('missile', sx, sy, sz, dx / d * v, dy / d * v, dz / d * v, -1);
  sfxWhistle(tx, ty, tz, 1.3);
}
function callNuke(tx, tz) {
  addProj('nuke', tx, 105, tz, 0, -4, 0, -1);
  sfxWhistle(tx, 0, tz, 4.5);
}
function callAirstrike(tx, tz, yaw) {
  const dx = Math.sin(yaw), dz = Math.cos(yaw), speed = 58, alt = 52;
  planes.push({ x: tx - dx * 190, y: alt, z: tz - dz * 190, dx, dz, speed, tx, tz, drop: 0, dropped: 0, yaw, kind: 'bomber' });
  sfxPlane();
}
function callNapalm(tx, tz, yaw) {
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  planes.push({ x: tx - dx * 190, y: 44, z: tz - dz * 190, dx, dz, speed: 62, tx, tz, drop: 0, dropped: 0, yaw, kind: 'napalm' });
  sfxPlane();
}
function updatePlanes(dt) {
  for (let i = planes.length - 1; i >= 0; i--) {
    const P = planes[i];
    P.x += P.dx * P.speed * dt; P.z += P.dz * P.speed * dt;
    const along = (P.x - P.tx) * P.dx + (P.z - P.tz) * P.dz;
    const vh = P.speed * .4, fall = Math.sqrt(2 * (P.y - surfaceY(P.tx, P.tz)) / GRAV);
    const lead = -vh * fall;
    if (along > lead - 22 && along < lead + 22 && P.dropped < 9) {
      P.drop -= dt;
      if (P.drop <= 0) {
        P.drop = .09; P.dropped++;
        addProj(P.kind === 'napalm' ? 'napalm' : 'bomb', P.x, P.y - 1.5, P.z, P.dx * vh, -2, P.dz * vh, -1);
      }
    }
    if (along > 220) planes.splice(i, 1);
  }
}
function drawPlanes() {
  for (const P of planes) {
    _B.makeRotationY(P.yaw); _B.setPosition(P.x, P.y, P.z);
    const c = PALC.plane, d = PALC.planeDark;
    part(_B, 0, 0, 0, 0, 0, 0, 0, 1.6, 1.6, 10, c, 0);
    part(_B, 0, 0, 0, 0, 0, .1, .8, 13, .25, 2.2, c, 0);
    part(_B, 0, 0, 0, 0, 0, .2, -4.3, 5, .2, 1.2, d, 0);
    part(_B, 0, 0, 0, 0, 0, 1.3, -4.3, .25, 2, 1.4, d, 0);
    part(_B, 0, 0, 0, 0, 0, .7, 3, .9, .5, 1.6, PALC.glass, 0);
    part(_B, 0, 0, 0, 0, -3.5, -.3, 1.2, .9, .9, 2.4, d, 0);
    part(_B, 0, 0, 0, 0, 3.5, -.3, 1.2, .9, .9, 2.4, d, 0);
  }
}
function drawProjectiles() {
  const pos = tracerLines.geometry.attributes.position.array, col = tracerLines.geometry.attributes.color.array;
  let nt = 0;
  for (const p of projs) {
    const K = PK[p.kind];
    if (p.kind === 'bullet') {
      if (nt >= TR_MAX) continue;
      const s = Math.hypot(p.vx, p.vy, p.vz), L = p.sniper ? 7 : 2.6, o = nt * 6;
      pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z;
      pos[o + 3] = p.x - p.vx / s * L; pos[o + 4] = p.y - p.vy / s * L; pos[o + 5] = p.z - p.vz / s * L;
      const b = p.sniper ? [1, 1, .9] : [1, .62, .18];
      col[o] = b[0] * 2; col[o + 1] = b[1] * 2; col[o + 2] = b[2] * 2; col[o + 3] = b[0] * .1; col[o + 4] = b[1] * .05; col[o + 5] = 0;
      nt++;
      continue;
    }
    const s = Math.hypot(p.vx, p.vy, p.vz) || 1;
    const yaw = Math.atan2(p.vx, p.vz), pitch = -Math.asin(Math.max(-1, Math.min(1, p.vy / s)));
    _e.set(pitch, yaw, 0, 'YXZ'); _q.setFromEuler(_e);
    _pos.set(p.x, p.y, p.z); _B.compose(_pos, _q, _scl);
    const b = K.box;
    if (K.bounce) _B.makeTranslation(p.x, p.y, p.z);
    part(_B, 0, 0, 0, 0, 0, 0, 0, b[0], b[1], b[2], PALC[K.col], 0);
    if (p.kind === 'charge') {
      const blink = Math.floor(p.life * (p.fuse < 1 ? 12 : 4)) & 1;
      part(_B, 0, 0, 0, 0, 0, .28, 0, .16, .12, .16, blink ? PALC.yellow : PALC.boot, 0);
    }
    if (p.kind === 'nuke') {
      // 낙하산
      _B.makeTranslation(p.x, p.y, p.z);
      part(_B, 0, 0, 0, 0, 0, 4.5, 0, 6, .5, 6, PALC.white, 0);
      part(_B, 0, 0, 0, 0, 0, 2.3, 0, .06, 4, .06, PALC.boot, 0);
    } else if (p.kind === 'bomb' || p.kind === 'missile') {
      part(_B, 0, 0, 0, 0, 0, 0, -b[2] * .5, b[0] * 1.8, .08, .5, PALC.planeDark, 0);
    }
  }
  tracerLines.geometry.attributes.position.needsUpdate = true;
  tracerLines.geometry.attributes.color.needsUpdate = true;
  tracerLines.geometry.setDrawRange(0, nt * 2);
}

// ───────────── 핵 버섯구름 ─────────────
function startMushroom(x, y, z) {
  emitters.push({ x, y, z, t: 0, dur: 9 });
  nukeFlash = 1;
  // 넓은 범위 화재
  for (let k = 0; k < 220; k++) {
    const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * 32;
    const X = Math.floor(x + Math.cos(a) * d), Z = Math.floor(z + Math.sin(a) * d);
    const Y = surfaceY(X, Z) - 1;
    igniteVoxel(X, Y, Z); igniteVoxel(X, Y + 1, Z); igniteVoxel(X, Y + 3, Z);
  }
  unitsNear(x, z, 70, u => {
    const d = Math.hypot(u.x - x, u.z - z);
    if (d < 70 && d > 1) { knockUnit(u, (u.x - x) / d * 22 * (1 - d / 70), 10 * (1 - d / 70), (u.z - z) / d * 22 * (1 - d / 70)); if (d < 50) { u.burn = 4; } }
  });
}
function updateEmitters(dt) {
  for (let i = emitters.length - 1; i >= 0; i--) {
    const E = emitters[i];
    E.t += dt;
    const k = E.t / E.dur, top = E.y + Math.min(48, E.t * 22);
    const n = Math.round(dt * 160 * (1 - k * .7));
    for (let j = 0; j < n; j++) {
      // 기둥
      const h = E.y + Math.random() * (top - E.y);
      smoke.spawn(E.x + R(5), h, E.z + R(5), R(2), 6 + Math.random() * 6, R(2), 4 + Math.random() * 3, 5, 11, C.dark0, C.smoke1, .4, 0);
      // 갓
      const a = Math.random() * Math.PI * 2, rr = 6 + Math.random() * (10 + E.t * 3);
      const hot = k < .35;
      (hot ? fire : smoke).spawn(E.x + Math.cos(a) * rr * .6, top + R(5), E.z + Math.sin(a) * rr * .6, Math.cos(a) * 6, 2 + Math.random() * 3, Math.sin(a) * 6,
        3 + Math.random() * 3, hot ? 8 : 7, hot ? 14 : 16, hot ? C.fire0 : C.smoke0, hot ? C.fire1 : C.smoke1, .3, 0);
      if (Math.random() < .3) fire.spawn(E.x + R(4), E.y + Math.random() * (top - E.y), E.z + R(4), 0, 8, 0, 1, 4, 2, C.fire0, C.fire1, .5, 0);
    }
    if (k < .5 && Math.random() < dt * 4) flashLight(E.x, top, E.z, 5 * (1 - k * 2), 120, .5);
    if (E.t > E.dur) emitters.splice(i, 1);
  }
}

// ───────────── 블랙홀 ─────────────
function spawnBlackhole(x, y, z) {
  if (bhole) endBlackhole();
  bhole = { x, y: y + 7, z, r: 2, t: 0, dur: 7.5 };
  if (!bholeMesh) {
    bholeMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    bholeRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeDiskTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    bholeRing.renderOrder = 6;
    scene.add(bholeMesh); scene.add(bholeRing);
  }
  bholeMesh.visible = bholeRing.visible = true;
}
function makeDiskTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, S * .1, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(.2, 'rgba(255,240,255,.95)'); grd.addColorStop(.28, 'rgba(190,130,255,.7)');
  grd.addColorStop(.55, 'rgba(110,50,220,.25)'); grd.addColorStop(1, 'rgba(40,0,90,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 7; k++) {
    g.beginPath();
    const a0 = k / 7 * Math.PI * 2;
    for (let t = 0; t < 1; t += .02) {
      const a = a0 + t * 4.2, r = S * (.12 + t * .36);
      const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
      t === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.strokeStyle = 'rgba(220,180,255,.35)'; g.lineWidth = 5; g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}
function endBlackhole() {
  const b = bhole; bhole = null;
  bholeMesh.visible = bholeRing.visible = false;
  explode(b.x, b.y, b.z, 6, { power: 400, team: -1 });
  for (let k = 0; k < 120; k++) fire.spawn(b.x, b.y, b.z, R(40), R(40), R(40), 1, 2, .5, C.purple0, C.purple1, 1.5, 0);
}
function updateBlackhole(dt) {
  if (!bhole) return;
  const b = bhole;
  b.t += dt;
  b.r = Math.min(9, 2 + b.t * 1.4);
  bholeMesh.position.set(b.x, b.y, b.z); bholeMesh.scale.setScalar(b.r * .32 + .6);
  bholeRing.position.copy(bholeMesh.position); bholeRing.scale.setScalar(b.r * 2.6 + 4);
  bholeRing.material.rotation = -b.t * 2.2;
  bholeRing.material.opacity = Math.min(1, b.t * 2) * Math.min(1, (b.dur - b.t) * 2);
  // 지형을 뜯어냄
  const n = Math.round(dt * 900);
  for (let k = 0; k < n; k++) {
    const rr = b.r * 1.6 * Math.cbrt(Math.random());
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    const X = Math.floor(b.x + rr * Math.sin(ph) * Math.cos(th)), Y = Math.floor(b.y + rr * Math.cos(ph) * 1.3), Z = Math.floor(b.z + rr * Math.sin(ph) * Math.sin(th));
    if (X < 0 || X >= SX || Y < 1 || Y >= SY || Z < 0 || Z >= SZ) continue;
    const t = vox[vidx(X, Y, Z)];
    if (!t) continue;
    if (EXPLOSIVE[t]) { igniteTNT(X, Y, Z); continue; }
    setVox(X, Y, Z, 0);
    if (Math.random() < .5) {
      const ax = b.x - X, az = b.z - Z, d = Math.hypot(ax, az) + .1;
      spawnDebrisVoxel(X, Y, Z, t, -az / d * 6, 4, ax / d * 6);
    }
  }
  if (Math.random() < dt * 3) queueCollapseCheck(Math.floor(b.x), Math.floor(b.y), Math.floor(b.z), b.r * 1.6 + 2);
  for (let k = 0; k < 6; k++) {
    const a = Math.random() * Math.PI * 2, d = b.r * 2 + Math.random() * 6;
    fire.spawn(b.x + Math.cos(a) * d, b.y + R(2), b.z + Math.sin(a) * d, -Math.sin(a) * 12, 0, Math.cos(a) * 12, .8, 1, .2, C.purple0, C.purple1, 0, 0);
  }
  // 유닛 흡입
  unitsNear(b.x, b.z, b.r * 4 + 4, u => {
    const ax = b.x - u.x, ay = b.y - (u.y + 1.2), az = b.z - u.z, d = Math.hypot(ax, ay, az) + .3;
    if (d > b.r * 4) return;
    const f = (UT[u.type].veh ? 18 : 55) / (d + 2) * dt * 4;
    u.vx += ax / d * f; u.vy += ay / d * f + GRAV * dt * .8; u.vz += az / d * f;
    if (!UT[u.type].veh) { u.stun = Math.max(u.stun, .6); u.grounded = false; u.tiltV = u.tiltV || 6; }
    if (d < b.r * .45 + .8 && !u.dead) { damageUnit(u, 9999, -1, 0, 0); }
  });
  if (b.t > b.dur) endBlackhole();
}

function updateStrikes(dt) {
  for (let i = strikes.length - 1; i >= 0; i--) {
    strikes[i].t -= dt;
    if (strikes[i].t <= 0) { const s = strikes[i]; strikes.splice(i, 1); s.fn(); }
  }
}
function updateCombat(dt) {
  updateMines(dt);
  updatePending(dt);
  updateStrikes(dt);
  updateProjectiles(dt);
  updatePlanes(dt);
  updateFire(dt);
  updateEmitters(dt);
  updateBlackhole(dt);
}
