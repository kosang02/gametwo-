'use strict';
// ─────────────────────────────────────────────────────────────
//  유닛: 종류, 생성, 이동 물리, 래그돌, AI, 박스 렌더링
// ─────────────────────────────────────────────────────────────
const UT = {
  rifle:     { name: '소총병',   hp: 100,  speed: 4.4, range: 46,  wpn: 'rifle',   cd: .95, dmg: 16,  spread: .034 },
  mg:        { name: '기관총병', hp: 130,  speed: 3.5, range: 40,  wpn: 'mg',      cd: .09, dmg: 7, spread: .07, burst: 14, reload: 2.6 },
  sniper:    { name: '저격병',   hp: 80,   speed: 3.9, range: 105, wpn: 'sniper',  cd: 3.2, dmg: 130, spread: .004 },
  rocket:    { name: '로켓병',   hp: 100,  speed: 3.9, range: 62,  wpn: 'rocket',  cd: 4.8 },
  grenadier: { name: '척탄병',   hp: 100,  speed: 4.2, range: 34,  wpn: 'grenade', cd: 3.4 },
  medic:     { name: '의무병',   hp: 90,   speed: 4.9, range: 26,  wpn: 'pistol',  cd: .7,  dmg: 10,  spread: .045 },
  flame:     { name: '화염방사병', hp: 120, speed: 4.1, range: 12,  wpn: 'flame',   cd: .06 },
  shotgun:   { name: '돌격병',   hp: 125,  speed: 5.0, range: 14,  wpn: 'shotgun', cd: 1.15, dmg: 13, spread: .13 },
  mortar:    { name: '박격포병', hp: 80,   speed: 3.4, range: 125, wpn: 'mortar',  cd: 5.5, minR: 18 },
  sapper:    { name: '폭파병',   hp: 95,   speed: 5.3, range: 3.4, wpn: 'charge',  cd: 7 },
  engineer:  { name: '공병',     hp: 100,  speed: 4.4, range: 28,  wpn: 'pistol',  cd: .7,  dmg: 10,  spread: .045 },
  dog:       { name: '군견',     hp: 70,   speed: 9.5, range: 2.4, wpn: 'bite',    cd: .75, dmg: 26, hw: .3, h: 1.1 },
  tank:      { name: '전차',     hp: 1300, speed: 3.3, range: 92,  wpn: 'cannon',  cd: 5.2, hw: 2.3, h: 2.7, veh: true },
  heli:      { name: '공격 헬기', hp: 650, speed: 10,  range: 70,  wpn: 'heli',    cd: 3.4, hw: 1.6, h: 2.2, veh: true, air: true },
};
// 헬기를 노릴 수 있는 병과
const AA = { rifle: 1, mg: 1, sniper: 1, rocket: 1, medic: 1, engineer: 1, shotgun: 1, heli: 1 };
const TEAM = [
  { name: '레드', team: [178, 58, 46], dark: [116, 38, 32], pants: [96, 50, 42] },
  { name: '블루', team: [52, 98, 182], dark: [32, 60, 122], pants: [40, 56, 92] },
];
const PALC = {};
function lin(rgb) { return new THREE.Color().setRGB(S2L[rgb[0]], S2L[rgb[1]], S2L[rgb[2]]); }
function initPalette() {
  for (let t = 0; t < 2; t++) {
    PALC['team' + t] = lin(TEAM[t].team); PALC['dark' + t] = lin(TEAM[t].dark); PALC['pants' + t] = lin(TEAM[t].pants);
  }
  const add = (k, c) => PALC[k] = lin(c);
  add('skin0', [232, 184, 146]); add('skin1', [196, 140, 100]); add('skin2', [150, 102, 70]);
  add('boot', [38, 34, 32]); add('gun', [40, 42, 46]); add('pack', [86, 92, 60]); add('tube', [74, 88, 52]);
  add('white', [232, 232, 226]); add('red', [210, 40, 36]); add('track', [44, 44, 46]); add('trackHi', [80, 80, 82]);
  add('steel', [110, 116, 124]); add('plane', [96, 108, 92]); add('planeDark', [64, 72, 60]); add('glass', [150, 200, 230]);
  add('shell', [196, 170, 92]); add('rocketBody', [80, 92, 60]); add('nuke', [60, 64, 58]); add('yellow', [236, 200, 60]);
  add('flash', [255, 255, 255]); add('mine', [58, 64, 48]); add('hardhat', [240, 196, 40]);
  add('fuel', [176, 74, 40]); add('visor', [30, 34, 36]); add('fur0', [128, 88, 52]); add('fur1', [44, 40, 38]); add('fur2', [196, 160, 110]);
  add('rotor', [52, 54, 56]);
}

let units = [];
let nextUnitId = 1;
const stats = { kills: [0, 0], lost: [0, 0] };
let phase = 'setup';   // setup | battle | over

function spawnUnit(type, team, x, z, yaw) {
  const T = UT[type];
  const tank = type === 'tank';
  x = Math.max(3, Math.min(SX - 3, x)); z = Math.max(3, Math.min(SZ - 3, z));
  const u = {
    id: nextUnitId++, type, team, x, y: surfaceY(x, z), z, vx: 0, vy: 0, vz: 0,
    yaw: yaw != null ? yaw : (team === 0 ? Math.PI / 2 : -Math.PI / 2),
    hp: T.hp, maxhp: T.hp, hw: T.hw || .38, h: T.h || 2.6,
    dead: false, deadT: 0, stun: 0, tilt: 0, tiltV: 0, fallYaw: 0, grounded: false, ryo: 0,
    walk: Math.random() * 6, moving: false, target: null, los: false, think: Math.random() * .3,
    cd: 1 + Math.random() * 1.5, burst: 0, stuckT: 0, detourT: 0, detourYaw: 0, jumpCd: 0,
    burn: 0, lastHit: -1, flash: 0, wantMove: false, moveYaw: 0, aimYaw: 0, aimPitch: 0, shooting: false,
    turret: 0, barrel: 0, recoil: 0, mgCd: 0, mgBurst: 0, lastX: x, lastZ: z, progT: 0, skin: (Math.random() * 3) | 0,
    healFx: 0, panicYaw: 0, panicT: 0, airT: 0,
  };
  u.turret = u.yaw;
  if (T.air) u.y += 10;
  // 빈 공간까지 끌어올림
  for (let k = 0; k < 40 && boxHits(u.x, u.y, u.z, u.hw, u.h); k++) u.y += 1;
  units.push(u);
  return u;
}
function boxHits(x, y, z, hw, h) {
  const x0 = Math.floor(x - hw), x1 = Math.floor(x + hw - 1e-4);
  const y0 = Math.floor(y + 1e-3), y1 = Math.floor(y + h - 1e-3);
  const z0 = Math.floor(z - hw), z1 = Math.floor(z + hw - 1e-4);
  for (let yy = y0; yy <= y1; yy++) for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++)
    if (solidAt(xx, yy, zz)) return true;
  return false;
}

// ───────────── 피해 ─────────────
function damageUnit(u, dmg, team, dirx, dirz) {
  if (u.dead || dmg <= 0) return;
  u.hp -= dmg;
  if (dmg >= (UT[u.type].veh ? 30 : 8)) u.flash = .07;
  if (team != null && team >= 0) u.lastHit = team;
  if (dirx != null) { u.lastDx = dirx; u.lastDz = dirz; }
  if (u.hp <= 0) killUnit(u);
}
function killUnit(u) {
  if (u.dead) return;
  u.dead = true; u.deadT = 0; u.hp = 0;
  stats.lost[u.team]++;
  if (u.lastHit >= 0 && u.lastHit !== u.team) stats.kills[u.lastHit]++;
  if (u.type === 'heli') {
    // 회전하며 추락, 땅에 닿으면 폭발
    u.spin = 4 + Math.random() * 3; u.burn = 30;
    smokePuff(u.x, u.y + 1, u.z, 1.5, 10, true);
  } else if (u.type === 'tank') {
    queueExplosion(u.x, u.y + 1.5, u.z, 3.6, { power: 300, team: -1, fire: true }, .05);
    for (let k = 0; k < 18; k++) spawnDebris(u.x + R(3), u.y + 2, u.z + R(4), R(14), 6 + Math.random() * 12, R(14), .5 + Math.random() * .6,
      PALC['dark' + u.team].r, PALC['dark' + u.team].g, PALC['dark' + u.team].b, 8);
    u.burn = 30;
  } else {
    bloodBurst(u.x, u.y + 1.4, u.z, u.lastDx || 0, u.lastDz || 0, 22);
    stainGround(u.x, u.y, u.z);
    u.fallYaw = u.lastDx != null ? Math.atan2(u.lastDx, u.lastDz) : u.yaw + Math.PI;
    if (!u.stun) u.tiltV = 3.5;
    if (u.type === 'flame') queueExplosion(u.x, u.y + 1.3, u.z, 2.4, { power: 110, team: -1, fire: true }, .15);
  }
}
function stainGround(x, y, z) {
  for (let k = 0; k < 2; k++) {
    const X = Math.floor(x + R(2)), Z = Math.floor(z + R(2.2)), Y = Math.floor(y) - 1;
    if (Y >= 0 && X >= 0 && X < SX && Z >= 0 && Z < SZ && vox[vidx(X, Y, Z)] && vtint[vidx(X, Y, Z)] < 200) {
      vtint[vidx(X, Y, Z)] = 200; markDirty(X, Y, Z);
    }
  }
}

// ───────────── 공간 해시 ─────────────
const GC = 8, GW = Math.ceil(SX / GC), GD = Math.ceil(SZ / GC);
const grid = Array.from({ length: GW * GD }, () => []);
function rebuildGrid() {
  for (const c of grid) c.length = 0;
  for (const u of units) {
    if (u.dead) continue;
    const gx = Math.max(0, Math.min(GW - 1, (u.x / GC) | 0)), gz = Math.max(0, Math.min(GD - 1, (u.z / GC) | 0));
    grid[gz * GW + gx].push(u);
  }
}
function unitsNear(x, z, r, fn) {
  const gx0 = Math.max(0, ((x - r) / GC) | 0), gx1 = Math.min(GW - 1, ((x + r) / GC) | 0);
  const gz0 = Math.max(0, ((z - r) / GC) | 0), gz1 = Math.min(GD - 1, ((z + r) / GC) | 0);
  for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) for (const u of grid[gz * GW + gx]) fn(u);
}

// ───────────── AI ─────────────
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const eyeY = u => u.y + (u.type === 'tank' ? 2.7 : u.type === 'heli' ? .8 : u.type === 'dog' ? .8 : 2.2);
const aimH = v => v.type === 'tank' ? 1.6 : v.type === 'heli' ? 1.1 : v.type === 'dog' ? .6 : 1.4;
function findTarget(u) {
  let best = null, bd = 1e9;
  for (const v of units) {
    if (v.dead || v.team === u.team) continue;
    if (UT[v.type].air && !AA[u.type]) continue;
    let d = Math.hypot(v.x - u.x, v.z - u.z);
    const veh = UT[v.type].veh;
    if ((u.type === 'rocket' || u.type === 'sapper') && veh) d *= .5;
    if (u.type === 'rocket' && v.type === 'heli') d *= .6;
    if ((u.type === 'sniper' || u.type === 'dog' || u.type === 'shotgun') && veh) d *= 3;
    if (u.type === 'tank' && v.type === 'heli') continue;
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}
function think(u) {
  const T = UT[u.type];
  u.shooting = false;
  if (phase !== 'battle') { u.wantMove = false; u.target = null; return; }
  if (u.burn > 0 && u.type !== 'tank') {
    // 불붙은 병사는 공포에 질려 뛰어다닌다
    if (u.panicT <= 0) { u.panicYaw = Math.random() * Math.PI * 2; u.panicT = .6 + Math.random() * .6; }
    u.wantMove = true; u.moveYaw = u.panicYaw; return;
  }
  if (u.type === 'medic' && medicThink(u)) return;
  if (u.type === 'engineer' && engineerThink(u)) return;
  if (u.fleeT > 0) { u.wantMove = true; u.moveYaw = u.fleeYaw; return; }
  let tg = u.target;
  if (!tg || tg.dead || Math.random() < .25) tg = findTarget(u);
  u.target = tg;
  if (!tg) { u.wantMove = false; return; }
  const dx = tg.x - u.x, dz = tg.z - u.z, d = Math.hypot(dx, dz);
  const ty = tg.y + aimH(tg);
  u.los = d < T.range * 1.1 ? lineClear(u.x + Math.sin(u.yaw) * (u.type === 'tank' ? 3.4 : .6), eyeY(u), u.z + Math.cos(u.yaw) * (u.type === 'tank' ? 3.4 : .6), tg.x, ty, tg.z) : false;
  u.aimYaw = Math.atan2(dx, dz);
  u.aimPitch = Math.atan2(ty - eyeY(u), d);
  const lobber = u.type === 'grenadier' || u.type === 'mortar';
  const melee = u.type === 'dog' || u.type === 'sapper';
  if (u.type === 'mortar' && d < T.minR) {
    // 너무 가까우면 물러남
    u.wantMove = true; u.moveYaw = u.aimYaw + Math.PI;
  } else if (d <= T.range && (u.los || (lobber && d > 6) || (melee && Math.abs(tg.y - u.y) < 2.5))) {
    u.shooting = true;
    u.wantMove = u.type === 'tank' ? d > T.range * .65 && !u.los : false;
    if (u.type === 'grenadier' && d < 10) { u.wantMove = true; u.moveYaw = u.aimYaw + Math.PI; }
    if (u.type === 'sapper') { u.fleeYaw = u.aimYaw + Math.PI + R(1); }
  } else {
    u.wantMove = true;
    u.moveYaw = u.aimYaw;
    // 시야가 없으면 지형을 돌아가는 길로
    if (d > 8 && !u.los) { const ny = navYaw(u); if (ny != null) u.moveYaw = ny; }
  }
  if (u.detourT > 0) u.moveYaw = u.detourYaw;
}
function engineerThink(u) {
  // 1) 적이 멀 때 엄폐물과 지뢰 설치 (한 번)
  if (!u.built) {
    let near = 1e9, ex = 0, ez = 0;
    for (const v of units) if (!v.dead && v.team !== u.team) { const d = Math.hypot(v.x - u.x, v.z - u.z); if (d < near) { near = d; ex = v.x; ez = v.z; } }
    if (near > 30 && near < 1e9 && u.grounded) { buildCover(u, Math.atan2(ex - u.x, ez - u.z)); u.built = true; u.wantMove = false; u.cd = 1.2; return true; }
  }
  // 2) 다친 차량 수리
  let best = null, bd = 50;
  for (const v of units) {
    if (v.dead || v.team !== u.team || v.type !== 'tank' || v.hp >= v.maxhp * .85) continue;
    const d = Math.hypot(v.x - u.x, v.z - u.z);
    if (d < bd) { bd = d; best = v; }
  }
  if (!best) return false;
  u.healTarget = best;
  u.aimYaw = Math.atan2(best.x - u.x, best.z - u.z);
  if (bd > 3.6) { u.wantMove = true; u.moveYaw = u.detourT > 0 ? u.detourYaw : u.aimYaw; }
  else u.wantMove = false;
  return true;
}
function buildCover(u, yaw) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = fz, rz = -fx;
  const cx = u.x + fx * 3, cz = u.z + fz * 3;
  for (let w = -3; w <= 3; w++) {
    const X = Math.floor(cx + rx * w), Z = Math.floor(cz + rz * w), b = surfaceY(X, Z);
    if (Math.abs(b - u.y) > 2) continue;
    for (let y = b; y < b + 2; y++) setVox(X, y, Z, M.SANDBAG);
  }
  dustBurst(cx, u.y, cz, 3, 8);
  for (const [a, dd] of [[-2.5, 8], [2.5, 9.5]]) placeMine(u.x + fx * dd + rx * a, u.z + fz * dd + rz * a, u.team);
  sfxShot('wrench', u.x, u.y, u.z);
}
function medicThink(u) {
  let best = null, bd = 60;
  for (const v of units) {
    if (v.dead || v.team !== u.team || v === u || UT[v.type].veh || v.hp >= v.maxhp * .85) continue;
    const d = Math.hypot(v.x - u.x, v.z - u.z);
    if (d < bd) { bd = d; best = v; }
  }
  if (!best) return false;
  u.healTarget = best;
  u.aimYaw = Math.atan2(best.x - u.x, best.z - u.z);
  if (bd > 2.2) { u.wantMove = true; u.moveYaw = u.detourT > 0 ? u.detourYaw : u.aimYaw; }
  else u.wantMove = false;
  return true;
}
function updateUnitAI(u, dt) {
  const T = UT[u.type];
  u.think -= dt;
  if (u.think <= 0) { u.think = .22 + Math.random() * .12; think(u); }
  if (u.panicT > 0) u.panicT -= dt;
  if (u.detourT > 0) u.detourT -= dt;
  if (u.jumpCd > 0) u.jumpCd -= dt;
  if (u.cd > 0) u.cd -= dt;
  if (u.mgCd > 0) u.mgCd -= dt;
  if (u.fleeT > 0) u.fleeT -= dt;
  if (u.bite > 0) u.bite -= dt;
  const tank = u.type === 'tank';
  if (u.type === 'heli') { heliAI(u, dt); return; }
  if (u.stun > 0) return;
  // 회전
  const want = u.shooting && !u.wantMove ? u.aimYaw : (u.wantMove ? u.moveYaw : u.yaw);
  const rate = tank ? 1.3 : u.type === 'dog' ? 10 : 7;
  const da = angDiff(u.yaw, want);
  u.yaw += Math.max(-rate * dt, Math.min(rate * dt, da));
  // 전차 포탑
  if (tank) {
    const tw = u.target && !u.target.dead ? u.aimYaw : u.yaw;
    const td = angDiff(u.turret, tw);
    u.turret += Math.max(-1.6 * dt, Math.min(1.6 * dt, td));
    u.recoil = Math.max(0, u.recoil - dt * 2.5);
  }
  // 이동
  if (u.wantMove && !u.grounded && !u.inWater && u.vy > 0 && !tank) {
    // 점프 중 공중 제어: 벽 위로 넘어가도록 앞으로 밀어줌
    const sp = T.speed;
    u.vx += (Math.sin(u.moveYaw) * sp - u.vx) * Math.min(1, dt * 6);
    u.vz += (Math.cos(u.moveYaw) * sp - u.vz) * Math.min(1, dt * 6);
  }
  if (u.wantMove && (u.grounded || u.inWater)) {
    let sp = T.speed * (u.inWater ? .55 : 1) * (u.burn > 0 && !tank ? 1.5 : 1);
    if (tank && Math.abs(da) > .6) sp *= .3;
    const tx = Math.sin(u.type === 'tank' ? u.yaw : u.moveYaw) * sp, tz = Math.cos(u.type === 'tank' ? u.yaw : u.moveYaw) * sp;
    const k = Math.min(1, dt * 10);
    u.vx += (tx - u.vx) * k; u.vz += (tz - u.vz) * k;
    u.moving = true;
    // 진척 감시 → 막힘 처리
    u.progT += dt;
    if (u.progT > .5) {
      const moved = Math.hypot(u.x - u.lastX, u.z - u.lastZ);
      u.lastX = u.x; u.lastZ = u.z; u.progT = 0;
      if (moved < sp * .5 * .35) u.stuckT += .5; else u.stuckT = Math.max(0, u.stuckT - .5);
    }
    if (u.blocked && u.grounded && !tank && u.jumpCd <= 0) {
      // 앞의 벽 높이가 2칸 이하면 점프
      const fx = Math.floor(u.x + Math.sin(u.moveYaw) * .9), fz = Math.floor(u.z + Math.cos(u.moveYaw) * .9), fy = Math.floor(u.y);
      if (!solidAt(fx, fy + 2, fz) && !solidAt(fx, fy + 3, fz)) { u.vy = 10.5; u.jumpCd = .6; }
    }
    // 군견은 가까운 적에게 달려들어 도약
    if (u.type === 'dog' && u.target && !u.target.dead && u.grounded && u.jumpCd <= 0) {
      const d = Math.hypot(u.target.x - u.x, u.target.z - u.z);
      if (d > 2.5 && d < 6) { u.vy = 7; u.vx = Math.sin(u.aimYaw) * 11; u.vz = Math.cos(u.aimYaw) * 11; u.jumpCd = 1.2; }
    }
    if (u.stuckT > 1.5) {
      u.stuckT = 0;
      const breach = tank || u.type === 'rocket' || u.type === 'grenadier' || u.type === 'sapper';
      if (breach && u.cd <= 0) {
        u.aimYaw = u.moveYaw; u.turret = u.moveYaw;
        breachObstacle(u);
      } else {
        u.detourYaw = u.moveYaw + (Math.random() < .5 ? 1 : -1) * (1.1 + Math.random() * .8);
        u.detourT = 1 + Math.random();
      }
    }
  } else {
    u.moving = false;
    if (u.grounded) { const k = Math.max(0, 1 - dt * 12); u.vx *= k; u.vz *= k; }
  }
  // 사격
  if (u.shooting && u.target && !u.target.dead) {
    const facing = tank ? Math.abs(angDiff(u.turret, u.aimYaw)) < .08 : Math.abs(angDiff(u.yaw, u.aimYaw)) < .3;
    const tg = u.target;
    if (facing && u.cd <= 0 && (u.grounded || u.inWater || u.type === 'dog')) {
      fireWeapon(u, tg.x + tg.vx * .15, tg.y + aimH(tg), tg.z + tg.vz * .15, false);
    }
  }
  // 전차 동축 기관총: 가까운 보병에게
  if (tank && u.target && !u.target.dead && u.target.type !== 'tank' && u.los && u.mgCd <= 0) {
    const d = Math.hypot(u.target.x - u.x, u.target.z - u.z);
    if (d < 40 && Math.abs(angDiff(u.turret, u.aimYaw)) < .25) {
      const tg = u.target;
      fireBullet(u, u.x + Math.sin(u.turret) * 2.2, u.y + 2.5, u.z + Math.cos(u.turret) * 2.2, tg.x, tg.y + 1.3, tg.z, 8, .05, 150, false, 'mg');
      u.mgBurst++;
      u.mgCd = u.mgBurst % 10 === 0 ? 1.6 : .1;
    }
  }
  // 의무병 치료 / 공병 수리
  if ((u.type === 'medic' || u.type === 'engineer') && u.healTarget && !u.healTarget.dead) {
    const h = u.healTarget, d = Math.hypot(h.x - u.x, h.z - u.z), eng = u.type === 'engineer';
    if (d < (eng ? 4 : 2.6) && h.hp < h.maxhp) {
      h.hp = Math.min(h.maxhp, h.hp + (eng ? 45 : 32) * dt);
      if (eng) { u.shooting = false; if (Math.random() < dt * 12) sparks(h.x + R(2), h.y + 1.5, h.z + R(2), 2, 4); }
      if (h.burn > 0) h.burn = 0;
      u.healFx -= dt;
      if (u.healFx <= 0) {
        u.healFx = .5;
        if (!eng) for (let k = 0; k < 5; k++) fire.spawn(h.x + R(1), h.y + 1 + Math.random() * 1.5, h.z + R(1), 0, 1.5, 0, .7, .45, .15, C.heal0, C.heal1, 1, -1);
        sfxShot(eng ? 'wrench' : 'heal', h.x, h.y, h.z);
      }
    }
    if (u.healTarget.hp >= u.healTarget.maxhp * .99) u.healTarget = null;
  }
}

// ───────────── 헬기 ─────────────
function heliAI(u, dt) {
  const T = UT.heli;
  const tg = u.target;
  let dvx = 0, dvz = 0;
  if (phase === 'battle' && tg && !tg.dead) {
    const dx = tg.x - u.x, dz = tg.z - u.z, d = Math.hypot(dx, dz) || 1;
    if (d > T.range * .75) { dvx = dx / d * T.speed; dvz = dz / d * T.speed; }
    else {
      // 사거리 안: 옆으로 선회하며 사격
      const side = (u.id & 1) ? 1 : -1, back = d < 25 ? -.6 : 0;
      dvx = (dz / d * side + dx / d * back) * 4; dvz = (-dx / d * side + dz / d * back) * 4;
    }
    const want = Math.atan2(dx, dz);
    u.yaw += Math.max(-1.6 * dt, Math.min(1.6 * dt, angDiff(u.yaw, want)));
    if (u.shooting && u.los && u.cd <= 0 && Math.abs(angDiff(u.yaw, want)) < .2) fireWeapon(u, tg.x + tg.vx * .4, tg.y + aimH(tg), tg.z + tg.vz * .4, false);
    if (u.los && u.mgCd <= 0 && d < 60 && Math.abs(angDiff(u.yaw, want)) < .4) {
      fireBullet(u, u.x + Math.sin(u.yaw) * 2.2, u.y + .5, u.z + Math.cos(u.yaw) * 2.2, tg.x, tg.y + aimH(tg), tg.z, 9, .05, 160, false, 'mg');
      u.mgBurst++; u.mgCd = u.mgBurst % 12 === 0 ? 1.8 : .09;
    }
  }
  const k = Math.min(1, dt * 1.6);
  u.vx += (dvx - u.vx) * k; u.vz += (dvz - u.vz) * k;
  u.moving = Math.hypot(u.vx, u.vz) > 1;
}
function physHeli(u, dt) {
  u.walk += dt * 30;
  if (u.dead) {
    u.vy -= GRAV * .8 * dt; u.yaw += (u.spin || 4) * dt;
    if (Math.random() < dt * 25) smoke.spawn(u.x + R(1), u.y + 1.2, u.z + R(1), R(1), 2, R(1), 3, 1.5, 5, C.dark0, C.dark1, .6, -.6);
  } else {
    // 지형 위 일정 고도 유지
    let gh = 0;
    for (let ox = -6; ox <= 6; ox += 3) for (let oz = -6; oz <= 6; oz += 3) gh = Math.max(gh, surfaceY(u.x + ox, u.z + oz));
    const ty = Math.max(gh, WATER_Y) + 14 + Math.sin(u.walk * .03 + u.id) * .6;
    u.vy += ((ty - u.y) * 1.8 - u.vy) * Math.min(1, dt * 2.5);
  }
  const nx = u.x + u.vx * dt, nz = u.z + u.vz * dt, ny = u.y + u.vy * dt;
  if (!boxHits(nx, u.y, u.z, u.hw, u.h)) u.x = Math.max(4, Math.min(SX - 4, nx)); else u.vx *= -.3;
  if (!boxHits(u.x, u.y, nz, u.hw, u.h)) u.z = Math.max(4, Math.min(SZ - 4, nz)); else u.vz *= -.3;
  if (!boxHits(u.x, ny, u.z, u.hw, u.h)) u.y = ny;
  else {
    if (u.dead && !u.crashed) {
      u.crashed = true;
      explode(u.x, u.y + 1, u.z, 4, { power: 320, team: -1, fire: true });
      for (let k = 0; k < 14; k++) spawnDebris(u.x + R(2), u.y + 1.5, u.z + R(3), R(12), 5 + Math.random() * 9, R(12), .4 + Math.random() * .5, PALC['dark' + u.team].r, PALC['dark' + u.team].g, PALC['dark' + u.team].b, 8);
    }
    if (u.vy < 0) u.y = Math.floor(ny) + 1;
    u.vy = 0; u.vx *= .7; u.vz *= .7; u.spin = (u.spin || 0) * .9;
  }
  u.grounded = false;
  // 기울기: 진행 방향으로 숙임
  const c = Math.cos(u.yaw), s = Math.sin(u.yaw);
  u.hpitch = Math.max(-.35, Math.min(.35, (u.vx * s + u.vz * c) * .03));
  u.hroll = Math.max(-.35, Math.min(.35, -(u.vx * c - u.vz * s) * .04));
}

// ───────────── 물리 ─────────────
function physUnit(u, dt) {
  if (u.type === 'heli') { physHeli(u, dt); return; }
  const tank = u.type === 'tank';
  u.vy -= GRAV * dt;
  u.inWater = u.y + 1.1 < WATER_Y;
  if (u.inWater) {
    const k = Math.max(0, 1 - 2.2 * dt);
    u.vx *= k; u.vz *= k; u.vy *= Math.max(0, 1 - 1.5 * dt);
    if (!tank) { const depth = WATER_Y - (u.y + 1.5); u.vy += GRAV * dt * (1 + Math.max(-1, Math.min(1.2, depth * 1.4))); }
    if (u.burn > 0) { u.burn = 0; smokePuff(u.x, u.y + 1.5, u.z, .6, 4, false); }
  }
  u.blocked = false;
  const sp = Math.max(Math.abs(u.vx), Math.abs(u.vy), Math.abs(u.vz)) * dt;
  const n = Math.max(1, Math.ceil(sp / .35));
  const sdt = dt / n;
  const preVy = u.vy;
  for (let s = 0; s < n; s++) {
    moveH(u, 0, u.vx * sdt);
    moveH(u, 1, u.vz * sdt);
    const ny = u.y + u.vy * sdt;
    if (!boxHits(u.x, ny, u.z, u.hw, u.h)) { u.y = ny; }
    else {
      if (u.vy < 0) {
        u.y = Math.floor(ny) + 1;
        if (boxHits(u.x, u.y, u.z, u.hw, u.h)) u.y = Math.ceil(u.y - 1e-3);
        const impact = -preVy;
        if (impact > 17 && !u.dead) damageUnit(u, (impact - 17) * (tank ? 6 : 9), u.lastHit);
        if (impact > 8 && u.stun > 0) { u.vx *= .5; u.vz *= .5; dustBurst(u.x, u.y, u.z, 1, 4); }
      }
      u.vy = 0;
      break;
    }
  }
  u.grounded = boxHits(u.x, u.y - .06, u.z, u.hw, .05);
  // 공중에 걸린 채 멈춰 있으면(모서리 등) 착지한 것으로 간주
  if (!u.grounded && Math.abs(u.vy) < .01 && preVy <= 0 && !u.inWater) u.grounded = true;
  if (u.y < -10) { u.y = surfaceY(u.x, u.z); }
  // 다른 블록에 끼었으면 위로 밀어냄 (모래, 무너진 건물 등)
  if (boxHits(u.x, u.y + .1, u.z, u.hw * .8, u.h * .8)) {
    let freed = false;
    for (let up = 1; up <= 3; up++) if (!boxHits(u.x, u.y + up, u.z, u.hw, u.h)) { u.y += up; u.ryo -= up; freed = true; break; }
    if (!freed && !u.dead) damageUnit(u, 40 * dt, -1);
  }
  u.ryo *= Math.max(0, 1 - dt * 14);
}
function moveH(u, axis, d) {
  if (d === 0) return;
  const nx = axis === 0 ? u.x + d : u.x, nz = axis === 1 ? u.z + d : u.z;
  if (!boxHits(nx, u.y, nz, u.hw, u.h)) { u.x = nx; u.z = nz; return; }
  // 한 칸 올라가기 (걷는 중)
  if ((u.grounded || u.inWater) && !u.dead && u.stun <= 0) {
    const maxUp = u.type === 'tank' ? 2 : 1;
    for (let up = 1; up <= maxUp; up++) if (!boxHits(nx, u.y + up, nz, u.hw, u.h)) { u.x = nx; u.z = nz; u.y += up; u.ryo -= up; return; }
  }
  // 전차는 나무/잎을 밀어 부숨
  if (u.type === 'tank' && !u.dead) {
    let crushed = 0;
    const x0 = Math.floor(nx - u.hw), x1 = Math.floor(nx + u.hw), z0 = Math.floor(nz - u.hw), z1 = Math.floor(nz + u.hw);
    for (let y = Math.floor(u.y); y < u.y + u.h; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const t = getV(x, y, z);
      if (t === M.LEAF || t === M.WOOD || t === M.PLANK || t === M.SANDBAG) {
        setVox(x, y, z, 0); crushed++;
        if (Math.random() < .5) spawnDebrisVoxel(x, y, z, t, R(4), 3, R(4));
      }
    }
    if (crushed) { queueCollapseCheck(Math.floor(nx), Math.floor(u.y + 2), Math.floor(nz), 4); return; }
  }
  const v = axis === 0 ? u.vx : u.vz;
  if (Math.abs(v) > 15 && !u.dead) damageUnit(u, (Math.abs(v) - 15) * 6, u.lastHit);
  if (axis === 0) u.vx = u.stun > 0 ? -u.vx * .3 : 0; else u.vz = u.stun > 0 ? -u.vz * .3 : 0;
  u.blocked = true;
}
function separate(dt) {
  for (const u of units) {
    if (u.dead || u.type === 'heli') continue;
    const tank = u.type === 'tank';
    unitsNear(u.x, u.z, 3, v => {
      if (v === u || v.dead || v.type === 'heli' || v.id < u.id && !tank && v.type !== 'tank') return;
      const dx = v.x - u.x, dz = v.z - u.z, d = Math.hypot(dx, dz) + 1e-4;
      if (Math.abs(v.y - u.y) > 2.5) return;
      const min = u.hw + v.hw + .25;
      if (d >= min) return;
      if (tank && v.type !== 'tank') {
        // 적 보병은 깔아뭉갠다
        if (v.team !== u.team && Math.hypot(u.vx, u.vz) > 1.2) { v.lastDx = dx / d; v.lastDz = dz / d; damageUnit(v, 999, u.team); return; }
        const p = (min - d) * Math.min(1, dt * 10);
        if (!boxHits(v.x + dx / d * p, v.y, v.z + dz / d * p, v.hw, v.h)) { v.x += dx / d * p; v.z += dz / d * p; }
        return;
      }
      const p = (min - d) * .5 * Math.min(1, dt * 8);
      const ux = u.x - dx / d * p, uz = u.z - dz / d * p, vx = v.x + dx / d * p, vz = v.z + dz / d * p;
      if (!boxHits(ux, u.y, uz, u.hw, u.h)) { u.x = ux; u.z = uz; }
      if (!boxHits(vx, v.y, vz, v.hw, v.h)) { v.x = vx; v.z = vz; }
    });
  }
}

function updateUnits(dt) {
  rebuildGrid();
  if (phase === 'battle') updateNav(dt);
  for (const u of units) {
    if (u.flash > 0) u.flash -= dt;
    if (u.dead) {
      u.deadT += dt;
      if (u.type === 'heli') {
        // 추락 중
      } else if (u.type !== 'tank') {
        u.tiltV = u.tiltV || 3;
        u.tilt = Math.min(Math.PI / 2, u.tilt + u.tiltV * dt);
        u.tiltV += dt * 6;
      } else if (u.deadT < 12 && Math.random() < dt * 12) {
        smoke.spawn(u.x + R(1.5), u.y + 2.5, u.z + R(1.5), R(1), 3 + Math.random() * 2, R(1), 4, 2, 6, C.dark0, C.dark1, .5, -.5);
        if (Math.random() < .5) fire.spawn(u.x + R(1.5), u.y + 2.2, u.z + R(1.5), 0, 2, 0, .5, 1.2, .4, C.fire0, C.fire1, 1, -2);
      }
      physUnit(u, dt);
      continue;
    }
    if (u.stun > 0) {
      u.stun -= dt;
      if (!u.grounded) { u.tilt += u.tiltV * dt; u.airT += dt; }
      else {
        // 착지 후 누워 있다가 일어남
        const target = u.stun > .5 ? Math.PI / 2 : 0;
        const cur = ((u.tilt % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        u.tilt = cur > Math.PI ? cur - Math.PI * 2 : cur;
        u.tilt += (target * Math.sign(u.tilt || 1) - u.tilt) * Math.min(1, dt * 8);
      }
      if (u.stun <= 0) { u.stun = 0; u.tilt = 0; u.airT = 0; }
    }
    if (u.burn > 0 && u.type === 'heli') u.burn = 0;
    if (u.burn > 0) {
      u.burn -= dt;
      damageUnit(u, (u.type === 'tank' ? 4 : 14) * dt, u.burnTeam != null ? u.burnTeam : -1);
      if (Math.random() < dt * 30) fire.spawn(u.x + R(.8), u.y + .5 + Math.random() * 2, u.z + R(.8), R(1), 3, R(1), .45, .9, .3, C.fire0, C.fire1, 1, -3);
      if (Math.random() < dt * 4) {
        const X = Math.floor(u.x), Y = Math.floor(u.y) - 1, Z = Math.floor(u.z);
        if (MAT[getV(X, Y, Z)] && MAT[getV(X, Y, Z)].flam > 0) igniteVoxel(X, Y, Z);
      }
    }
    if (!UT[u.type].veh && u.y + u.h * .85 < WATER_Y) damageUnit(u, 6 * dt, -1);
    updateUnitAI(u, dt);
    physUnit(u, dt);
    if (u.moving && u.grounded) u.walk += Math.hypot(u.vx, u.vz) * dt * 2.2;
  }
  separate(dt);
  // 시체 정리
  let corpses = 0;
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    if (!u.dead) continue;
    corpses++;
    if (u.deadT > 40 || corpses > 160) units.splice(i, 1);
  }
}

// 폭발 넉백 → 래그돌
function knockUnit(u, ix, iy, iz) {
  const tank = !!UT[u.type].veh;
  const m = u.type === 'tank' ? .12 : u.type === 'heli' ? .2 : 1;
  u.vx += ix * m; u.vy += iy * m; u.vz += iz * m;
  const imp = Math.hypot(ix, iy, iz) * m;
  if (!tank && imp > 5 && !u.dead) {
    u.stun = Math.max(u.stun, .9 + Math.min(1.6, imp / 14));
    u.fallYaw = Math.atan2(ix, iz);
    u.tiltV = (4 + Math.random() * 6) * (Math.random() < .3 ? -1 : 1);
    u.grounded = false;
  } else if (!tank && u.dead) { u.fallYaw = Math.atan2(ix, iz); }
}

// ───────────── 렌더링 (인스턴스 박스 하나로 전부 그림) ─────────────
const BOX_MAX = 16000;
let boxMesh, boxN = 0;
const _B = new THREE.Matrix4(), _P = new THREE.Matrix4(), _M = new THREE.Matrix4(), _T = new THREE.Matrix4(), _BT = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _pos = new THREE.Vector3(), _scl = new THREE.Vector3(1, 1, 1);
const _white = new THREE.Color(1, 1, 1), _tmpC = new THREE.Color();
function initBoxes() {
  boxMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), BOX_MAX);
  boxMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BOX_MAX * 3), 3);
  boxMesh.castShadow = true; boxMesh.receiveShadow = true; boxMesh.frustumCulled = false;
  scene.add(boxMesh);
}
// 부품 행렬: 기준행렬 base * T(pivot) * Rx(a) * T(off) * S(size)
function part(base, px, py, pz, a, ox, oy, oz, sx, sy, sz, color, flash) {
  if (boxN >= BOX_MAX) return;
  const c = Math.cos(a), s = Math.sin(a);
  _P.set(sx, 0, 0, px + ox,
    0, c * sy, -s * sz, py + c * oy - s * oz,
    0, s * sy, c * sz, pz + s * oy + c * oz,
    0, 0, 0, 1);
  _M.multiplyMatrices(base, _P);
  boxMesh.setMatrixAt(boxN, _M);
  if (flash > 0) boxMesh.setColorAt(boxN, _tmpC.copy(color).lerp(_white, .4));
  else boxMesh.setColorAt(boxN, color);
  boxN++;
}
function unitBase(u, out) {
  const ry = u.y + u.ryo;
  if (u.tilt !== 0) {
    // T(pos) * Ry(fall) * Rx(tilt) * Ry(yaw - fall)
    _e.set(0, u.fallYaw, 0); _q.setFromEuler(_e); _T.makeRotationFromQuaternion(_q);
    out.makeTranslation(u.x, ry + Math.abs(Math.sin(u.tilt)) * .22, u.z).multiply(_T);
    _T.makeRotationX(u.tilt); out.multiply(_T);
    _T.makeRotationY(u.yaw - u.fallYaw); out.multiply(_T);
  } else {
    out.makeRotationY(u.yaw);
    out.setPosition(u.x, ry, u.z);
  }
  if (u.dead && u.deadT > 34) {
    const k = (u.deadT - 34) / 6;
    _T.makeTranslation(0, -k * 1.5, 0); out.premultiply(_T);
  }
}
function drawSoldier(u) {
  unitBase(u, _B);
  const team = u.team, f = u.flash;
  const cT = PALC['team' + team], cD = PALC['dark' + team], cP = PALC['pants' + team], skin = PALC['skin' + u.skin];
  const sw = u.moving && !u.dead && u.stun <= 0 ? Math.sin(u.walk) * .75 : 0;
  const armed = (u.type !== 'medic' && !(u.type === 'mortar' && u.shooting)) || (u.type === 'medic' && u.shooting);
  const aim = armed && !u.dead ? -1.45 - (u.shooting ? u.aimPitch : 0) : 0;
  const armSw = u.dead ? .3 : 0;
  // 다리 + 군화
  part(_B, -.16, 1.0, 0, sw, 0, -.48, 0, .25, .96, .3, cP, f);
  part(_B, .16, 1.0, 0, -sw, 0, -.48, 0, .25, .96, .3, cP, f);
  part(_B, -.16, 1.0, 0, sw, 0, -.92, .06, .27, .16, .42, PALC.boot, f);
  part(_B, .16, 1.0, 0, -sw, 0, -.92, .06, .27, .16, .42, PALC.boot, f);
  // 몸통
  part(_B, 0, 1.0, 0, 0, 0, .45, 0, .62, .9, .38, cT, f);
  part(_B, 0, 1.0, 0, 0, 0, .04, 0, .64, .1, .4, PALC.boot, f);
  if (u.type === 'medic') {
    part(_B, 0, 1.0, 0, 0, 0, .5, -.28, .46, .55, .22, PALC.white, f);
    part(_B, 0, 1.0, 0, 0, 0, .55, -.4, .26, .08, .02, PALC.red, f);
    part(_B, 0, 1.0, 0, 0, 0, .55, -.4, .08, .26, .02, PALC.red, f);
  } else if (u.type === 'flame') {
    part(_B, 0, 1.0, 0, 0, -.13, .5, -.33, .2, .7, .24, PALC.fuel, f);
    part(_B, 0, 1.0, 0, 0, .13, .5, -.33, .2, .7, .24, PALC.fuel, f);
  } else if (u.type === 'sapper') {
    part(_B, 0, 1.0, 0, 0, 0, .5, -.3, .5, .5, .26, PALC.pack, f);
    part(_B, 0, 1.0, 0, 0, -.12, .6, -.45, .16, .3, .08, PALC.red, f);
    part(_B, 0, 1.0, 0, 0, .12, .6, -.45, .16, .3, .08, PALC.red, f);
  } else if (u.type === 'mortar') {
    part(_B, 0, 1.0, 0, 0, 0, .55, -.3, .4, .5, .22, PALC.pack, f);
    if (!u.shooting) part(_B, 0, 1.0, 0, -.3, .1, .9, -.38, .16, 1.0, .16, PALC.tube, f);
  } else part(_B, 0, 1.0, 0, 0, 0, .5, -.28, .46, .55, .22, PALC.pack, f);
  // 머리, 철모
  part(_B, 0, 1.9, 0, 0, 0, .22, 0, .38, .4, .38, skin, f);
  const hat = u.type === 'medic' ? PALC.white : u.type === 'engineer' ? PALC.hardhat : cD;
  if (u.type === 'shotgun') part(_B, 0, 1.9, 0, 0, .05, .44, -.02, .44, .12, .46, cD, f);
  else part(_B, 0, 1.9, 0, 0, 0, .46, 0, .5, .16, .52, hat, f);
  if (u.type === 'flame') part(_B, 0, 1.9, 0, 0, 0, .22, .2, .32, .18, .04, PALC.visor, f);
  // 팔
  const al = u.type === 'medic' && !armed ? sw * .8 : aim;
  const ar = u.type === 'medic' && !armed ? -sw * .8 : aim;
  part(_B, -.41, 1.8, 0, al + armSw, 0, -.35, 0, .18, .72, .2, cT, f);
  part(_B, .41, 1.8, 0, ar - armSw, 0, -.35, 0, .18, .72, .2, cT, f);
  // 무기
  const wp = u.shooting ? -u.aimPitch : 0;
  if (u.dead) return;
  switch (u.type) {
    case 'rifle': part(_B, .1, 1.55, 0, wp, 0, 0, .45, .1, .14, .95, PALC.gun, 0); break;
    case 'mg':
      part(_B, .12, 1.5, 0, wp, 0, 0, .45, .16, .22, 1.15, PALC.gun, 0);
      part(_B, .12, 1.5, 0, wp, 0, -.18, .2, .2, .18, .22, PALC.pack, 0); break;
    case 'sniper':
      part(_B, .1, 1.55, 0, wp, 0, 0, .55, .09, .12, 1.45, PALC.gun, 0);
      part(_B, .1, 1.55, 0, wp, 0, .12, .4, .07, .08, .35, PALC.gun, 0); break;
    case 'rocket': part(_B, .28, 1.98, 0, wp, 0, 0, .15, .22, .22, 1.45, PALC.tube, 0); break;
    case 'grenadier':
      part(_B, .1, 1.55, 0, wp, 0, 0, .35, .12, .16, .7, PALC.gun, 0);
      part(_B, 0, 1.0, 0, 0, 0, .04, .2, .5, .14, .06, PALC.tube, 0); break;
    case 'medic': if (armed) part(_B, .1, 1.55, 0, wp, 0, 0, .3, .08, .12, .3, PALC.gun, 0); break;
    case 'engineer':
      part(_B, .1, 1.55, 0, wp, 0, 0, .3, .08, .12, .3, PALC.gun, 0);
      part(_B, -.1, 1.55, 0, 0, 0, 0, .35, .07, .07, .45, PALC.steel, 0); break;
    case 'flame':
      part(_B, .1, 1.5, 0, wp, 0, 0, .45, .12, .14, .9, PALC.gun, 0);
      if (u.shooting) part(_B, .1, 1.5, 0, wp, 0, 0, .95, .1, .1, .1, PALC.yellow, 0); break;
    case 'shotgun':
      part(_B, .1, 1.55, 0, wp, 0, 0, .4, .14, .16, .8, PALC.gun, 0);
      part(_B, .1, 1.55, 0, wp, 0, -.1, .45, .1, .06, .4, PALC.fur0, 0); break;
    case 'sapper': part(_B, .1, 1.55, 0, wp, 0, 0, .3, .08, .12, .5, PALC.gun, 0); break;
    case 'mortar':
      if (u.shooting) {
        part(_B, 0, .05, .9, -1.15, 0, .5, 0, .2, 1.0, .2, PALC.tube, 0);
        part(_B, 0, 0, 0, 0, 0, .05, .9, .6, .08, .6, PALC.gun, 0);
      } else part(_B, .1, 1.55, 0, wp, 0, 0, .3, .08, .12, .3, PALC.gun, 0);
      break;
  }
}
function drawTank(u) {
  unitBase(u, _B);
  const team = u.team, f = u.flash;
  const cT = u.dead ? PALC.track : PALC['team' + team], cD = u.dead ? PALC.boot : PALC['dark' + team];
  const tr = PALC.track, tw = (u.walk * .35) % 1;
  part(_B, -1.72, 0, 0, 0, 0, .55, 0, .86, 1.1, 5.6, tr, f);
  part(_B, 1.72, 0, 0, 0, 0, .55, 0, .86, 1.1, 5.6, tr, f);
  for (let k = 0; k < 5; k++) {
    const z = -2.4 + ((k + tw) % 5) * 1.2;
    part(_B, -1.72, 0, 0, 0, -.44, .55, z, .02, .5, .5, PALC.trackHi, 0);
    part(_B, 1.72, 0, 0, 0, .44, .55, z, .02, .5, .5, PALC.trackHi, 0);
  }
  part(_B, 0, 0, 0, 0, 0, 1.25, 0, 3.0, .95, 5.0, cD, f);
  part(_B, 0, 0, 0, 0, 0, 1.82, -.2, 3.3, .22, 4.8, cT, f);
  part(_B, 0, 0, 0, 0, 0, 1.2, 2.55, 2.9, .7, .35, cD, f);
  // 포탑: base * T(0,1.95,-.3) * Ry(turret - yaw)
  _T.makeRotationY(u.turret - u.yaw); _T.setPosition(0, 1.95, -.3);
  _BT.multiplyMatrices(_B, _T);
  part(_BT, 0, 0, 0, 0, 0, .45, 0, 2.2, .9, 2.5, cT, f);
  part(_BT, 0, 0, 0, 0, 0, .45, 1.35, .8, .6, .35, cD, f);
  part(_BT, 0, 0, 0, 0, .45, 1.0, -.4, .7, .18, .7, cD, f);
  part(_BT, 0, 0, 0, 0, -.6, .55, -1.35, 1.0, .5, .3, PALC.pack, f);
  part(_BT, 0, .5, 1.45, -u.barrel, 0, 0, 1.65 - u.recoil * .8, .26, .26, 3.3, PALC.gun, f);
  part(_BT, 0, .5, 1.45, -u.barrel, 0, 0, 3.2 - u.recoil * .8, .36, .36, .4, PALC.gun, f);
}
function drawUnit(u) {
  if (u.type === 'tank') drawTank(u);
  else if (u.type === 'heli') drawHeli(u);
  else if (u.type === 'dog') drawDog(u);
  else drawSoldier(u);
}
function drawUnits() { for (const u of units) drawUnit(u); }
function drawHeli(u) {
  _e.set(u.hpitch || 0, u.yaw, u.hroll || 0, 'YXZ'); _q.setFromEuler(_e);
  _pos.set(u.x, u.y + u.ryo, u.z); _B.compose(_pos, _q, _scl);
  const f = u.flash, cT = u.dead ? PALC.track : PALC['team' + u.team], cD = u.dead ? PALC.boot : PALC['dark' + u.team];
  part(_B, 0, 0, 0, 0, 0, 1.2, 0, 1.7, 1.5, 3.6, cT, f);
  part(_B, 0, 0, 0, 0, 0, 1.35, 1.95, 1.3, 1.0, .8, PALC.glass, f);
  part(_B, 0, 0, 0, 0, 0, .55, 2.1, .26, .26, .8, PALC.gun, f);
  part(_B, 0, 0, 0, 0, 0, 1.45, -2.9, .5, .5, 3.2, cD, f);
  part(_B, 0, 0, 0, 0, 0, 2.1, -4.3, .12, 1.2, .8, cD, f);
  part(_B, .3, 2.0, -4.35, u.walk * 1.3, 0, 0, 0, .05, 1.7, .22, PALC.rotor, 0);
  part(_B, 0, 0, 0, 0, 0, 1.0, .3, 2.7, .12, .7, cD, f);
  for (const sx of [-1, 1]) {
    part(_B, 0, 0, 0, 0, sx * 1.25, .85, .4, .38, .38, 1.3, PALC.gun, f);
    part(_B, 0, 0, 0, 0, sx * .75, .12, 0, .12, .12, 3.2, PALC.boot, f);
    part(_B, 0, 0, 0, 0, sx * .75, .35, .9, .1, .45, .1, PALC.boot, f);
    part(_B, 0, 0, 0, 0, sx * .75, .35, -.9, .1, .45, .1, PALC.boot, f);
  }
  part(_B, 0, 0, 0, 0, 0, 2.15, 0, .22, .45, .22, PALC.rotor, f);
  if (u.crashed) return;
  _T.makeRotationY(u.walk); _T.setPosition(0, 2.4, 0); _BT.multiplyMatrices(_B, _T);
  part(_BT, 0, 0, 0, 0, 0, 0, 0, 9.5, .06, .32, PALC.rotor, 0);
  part(_BT, 0, 0, 0, 0, 0, 0, 0, .32, .06, 9.5, PALC.rotor, 0);
}
function drawDog(u) {
  unitBase(u, _B);
  const f = u.flash, fur = PALC['fur' + u.skin], dk = PALC.boot;
  const sw = u.moving && !u.dead && u.stun <= 0 ? Math.sin(u.walk * 1.6) * .8 : 0;
  const lunge = u.bite > 0 ? .25 : 0;
  for (const [lx, lz, ph] of [[-.13, .36, 1], [.13, .36, -1], [-.13, -.36, -1], [.13, -.36, 1]])
    part(_B, lx, .58, lz, sw * ph, 0, -.29, 0, .12, .58, .14, fur, f);
  part(_B, 0, 0, 0, 0, 0, .7, 0, .36, .34, .95, fur, f);
  part(_B, 0, 0, 0, 0, 0, .74, .42, .38, .4, .3, fur, f);
  part(_B, 0, .98, .6 + lunge, -.15, 0, 0, .1, .3, .3, .36, fur, f);
  part(_B, 0, .98, .6 + lunge, -.15, 0, -.06, .36, .18, .15, .2, dk, f);
  part(_B, 0, .98, .6 + lunge, -.15, -.1, .2, 0, .07, .14, .07, dk, f);
  part(_B, 0, .98, .6 + lunge, -.15, .1, .2, 0, .07, .14, .07, dk, f);
  part(_B, 0, 0, 0, 0, 0, .9, .5, .34, .08, .1, PALC['team' + u.team], f);
  part(_B, 0, .85, -.48, -.7 + Math.sin(u.walk * 3) * .3, 0, 0, -.2, .07, .07, .42, fur, f);
}

// 무너지는 덩어리에 깔리는 유닛
function crushUnits(B) {
  if (B.vy < 4) return;
  const by = Math.floor(B.y0 + B.off);
  for (const u of units) {
    if (u.dead) continue;
    if (u.x < B.x0 - 1 || u.x > B.x0 + B.w + 1 || u.z < B.z0 - 1 || u.z > B.z0 + B.d + 1) continue;
    if (u.y > by + B.h || u.y + u.h < by - 1) continue;
    for (let k = 0; k < B.bottoms.length; k += 3) {
      const x = B.x0 + B.bottoms[k] + .5, y = by + B.bottoms[k + 1], z = B.z0 + B.bottoms[k + 2] + .5;
      if (Math.abs(x - u.x) < u.hw + .5 && Math.abs(z - u.z) < u.hw + .5 && y <= u.y + u.h && y >= u.y - .5) {
        const dmg = Math.min(999, B.mass * B.vy * .9);
        damageUnit(u, u.type === 'tank' ? dmg * .3 : dmg, -1, 0, 0);
        if (!u.dead && u.type !== 'tank') knockUnit(u, R(6), 2, R(6));
        if (u.type === 'tank') { u.vy = -B.vy; }
        break;
      }
    }
  }
}

// ───────────── 길찾기: 적을 향한 흐름장(BFS) ─────────────
const navH = new Int16Array(SX * SZ);
const navF = [new Int32Array(SX * SZ), new Int32Array(SX * SZ)];
const navQ = new Int32Array(SX * SZ);
let navT = 0, navTeam = 0;
const NAV_INF = 1 << 30;
function updateNav(dt) {
  navT -= dt;
  if (navT > 0) return;
  navT = .5;
  navTeam = 1 - navTeam;
  for (let i = 0; i < SX * SZ; i++) {
    if (!colDirty[i]) continue;
    colDirty[i] = 0;
    const x = i % SX, z = (i / SX) | 0;
    let y = SY - 1;
    while (y >= 0 && !vox[vidx(x, y, z)]) y--;
    navH[i] = y + 1;
  }
  for (let t = navTeam; t === navTeam; t++) {
    const F = navF[t];
    F.fill(NAV_INF);
    let qh = 0, qt = 0;
    for (const u of units) {
      if (u.dead || u.team === t) continue;
      const i = Math.floor(u.z) * SX + Math.floor(u.x);
      if (i >= 0 && i < F.length && F[i] !== 0) { F[i] = 0; navQ[qt++] = i; }
    }
    while (qh < qt) {
      const c = navQ[qh++], cx = c % SX, cz = (c / SX) | 0, hc = navH[c], dc = F[c] + 1;
      for (let k = 0; k < 8; k++) {
        const nx = cx + NB8[k * 2], nz = cz + NB8[k * 2 + 1];
        if (nx < 0 || nx >= SX || nz < 0 || nz >= SZ) continue;
        const n = nz * SX + nx;
        if (F[n] <= dc) continue;
        // n에 있는 유닛이 c로 갈 수 있나: 2칸까지 오르기, 8칸까지 내려가기
        const up = hc - navH[n];
        if (up > 2 || up < -8) continue;
        if (k >= 4) {
          // 대각선은 양옆이 막히지 않을 때만
          const a = cz * SX + nx, b = nz * SX + cx;
          if (Math.abs(navH[a] - hc) > 2 || Math.abs(navH[b] - hc) > 2) continue;
        }
        F[n] = dc; navQ[qt++] = n;
      }
    }
  }
}
const NB8 = [1, 0, -1, 0, 0, 1, 0, -1, 1, 1, 1, -1, -1, 1, -1, -1];
// 흐름장을 따라 다음 방향 (없으면 null)
function navYaw(u) {
  const F = navF[u.team];
  const cx = Math.floor(u.x), cz = Math.floor(u.z);
  if (cx < 0 || cx >= SX || cz < 0 || cz >= SZ) return null;
  const here = F[cz * SX + cx];
  if (here >= NAV_INF) return null;
  let best = here, bx = 0, bz = 0;
  for (let k = 0; k < 8; k++) {
    const nx = cx + NB8[k * 2], nz = cz + NB8[k * 2 + 1];
    if (nx < 0 || nx >= SX || nz < 0 || nz >= SZ) continue;
    const f = F[nz * SX + nx];
    if (f < best) { best = f; bx = NB8[k * 2]; bz = NB8[k * 2 + 1]; }
  }
  if (!bx && !bz) return null;
  // 두 칸 앞까지 보고 부드럽게
  const nx2 = cx + bx * 2, nz2 = cz + bz * 2;
  let tx = cx + bx + .5, tz = cz + bz + .5;
  if (nx2 >= 0 && nx2 < SX && nz2 >= 0 && nz2 < SZ && F[nz2 * SX + nx2] < best) { tx = nx2 + .5; tz = nz2 + .5; }
  return Math.atan2(tx - u.x, tz - u.z);
}

// 앞을 막는 지형을 근접 사격으로 폭파
function breachObstacle(u) {
  const tank = u.type === 'tank';
  const dx = Math.sin(u.moveYaw), dz = Math.cos(u.moveYaw);
  let hit = null;
  for (const hy of [1.2, 2.2, .4]) {
    hit = raycast(u.x, u.y + hy, u.z, dx, 0, dz, tank ? 7 : 5);
    if (hit) { hit = { x: u.x + dx * hit.t, y: u.y + hy, z: u.z + dz * hit.t }; break; }
  }
  if (!hit) { u.detourYaw = u.moveYaw + (Math.random() < .5 ? 1 : -1) * 1.4; u.detourT = 1.2; return; }
  if (tank) {
    u.barrel = 0; u.recoil = 1;
    const bx = u.x + dx * 3, bz = u.z + dz * 3, by = u.y + 2.45;
    fireBurst(bx, by, bz, .9, 10); smokePuff(bx, by, bz, 1.2, 8, false);
    sfxShot('cannon', bx, by, bz);
    explode(hit.x, hit.y, hit.z, 3.4, { power: 120, team: u.team });
    u.cd = UT.tank.cd;
  } else fireWeapon(u, hit.x, hit.y, hit.z, true);
}
