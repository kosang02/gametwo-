'use strict';
// ─────────────────────────────────────────────────────────────
//  메인: 렌더러/씬 구성, 게임 흐름(배치 → 전투 → 결과), 루프
// ─────────────────────────────────────────────────────────────
let sun, hemi, waterMesh, waterNormal, skyMesh, baseMesh;
let seed = (Math.random() * 1e9) | 0;
let snapshot = null;

function initRenderer() {
  THREE.ColorManagement.legacyMode = false;
  const canvas = $('gl');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  const horizon = new THREE.Color(0xc7d3dc);
  scene.fog = new THREE.Fog(horizon, 230, 640);
  camera = new THREE.PerspectiveCamera(48, 1, .3, 2400);

  hemi = new THREE.HemisphereLight(0xd4e4ff, 0x6a5a44, .72);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffeedd, 1.9);
  sun.position.set(SX / 2 - 110, 170, SZ / 2 - 70);
  sun.target.position.set(SX / 2, 0, SZ / 2);
  scene.add(sun); scene.add(sun.target);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -150; sc.right = 150; sc.top = 150; sc.bottom = -150; sc.near = 20; sc.far = 480;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .35;

  // 하늘 돔
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x3f74b8) }, mid: { value: new THREE.Color(0x9cbad6) }, bot: { value: horizon },
      sunDir: { value: sun.position.clone().sub(sun.target.position).normalize() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top, mid, bot, sunDir; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h*1.6,0.0,1.0), .8)) : bot;
        c = mix(bot, c, smoothstep(-0.02, 0.18, h));
        float s = max(dot(normalize(vP), sunDir), 0.0); c += vec3(1.0,.85,.6) * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * .18);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  skyMesh = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), skyMat);
  skyMesh.renderOrder = -1;
  scene.add(skyMesh);

  // 바깥 바닥(디오라마 받침대)
  const base = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0x5d6a5a }));
  base.rotation.x = -Math.PI / 2; base.position.set(SX / 2, -.05, SZ / 2);
  base.receiveShadow = true;
  scene.add(base);
  baseMesh = base;

  // 물
  waterNormal = makeWaterNormal();
  const wmat = new THREE.MeshPhongMaterial({ color: 0x1f5f7c, specular: 0x9fc8dd, shininess: 120, transparent: true, opacity: .8,
    normalMap: waterNormal, normalScale: new THREE.Vector2(.55, .55), depthWrite: false });
  waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(SX, SZ), wmat);
  waterMesh.rotation.x = -Math.PI / 2; waterMesh.position.set(SX / 2, WATER_Y, SZ / 2);
  waterMesh.renderOrder = 1; waterMesh.receiveShadow = true;
  scene.add(waterMesh);

  voxMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  worldGroup = new THREE.Group();
  scene.add(worldGroup);
}
function makeWaterNormal() {
  const S = 128, data = new Uint8Array(S * S * 4);
  const hgt = new Float32Array(S * S);
  const waves = [];
  for (let k = 0; k < 14; k++) waves.push([((Math.random() * 6) | 0) + 1, ((Math.random() * 6) | 0) - 3, Math.random() * 6.28, .3 + Math.random()]);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let h = 0;
    for (const [a, b, p, amp] of waves) h += Math.sin((a * x + b * y) / S * Math.PI * 2 + p) * amp / Math.hypot(a, b);
    hgt[y * S + x] = h;
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = hgt[y * S + (x + 1) % S] - hgt[y * S + (x + S - 1) % S], dy = hgt[((y + 1) % S) * S + x] - hgt[((y + S - 1) % S) * S + x];
    const n = new THREE.Vector3(-dx * 2, -dy * 2, 1).normalize();
    const o = (y * S + x) * 4;
    data[o] = (n.x * .5 + .5) * 255; data[o + 1] = (n.y * .5 + .5) * 255; data[o + 2] = (n.z * .5 + .5) * 255; data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); t.needsUpdate = true;
  return t;
}
function setGfx(level) {
  ui.gfx = level;
  const high = level === 'high';
  sun.castShadow = high;
  renderer.shadowMap.enabled = high;
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 1.75 : 1));
  onResize();
  refreshHUD();
}
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const scale = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
  fire.mat.uniforms.uScale.value = scale; smoke.mat.uniforms.uScale.value = scale;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ocv.width = Math.round(w * dpr); ocv.height = Math.round(h * dpr);
}

// ───────────── 게임 흐름 ─────────────
function clearBattleState() {
  mines.length = 0;
  projs = []; pendingBooms.length = 0; strikes.length = 0; planes.length = 0; emitters.length = 0; groundFires.length = 0;
  burning.clear();
  if (bhole) { bhole = null; bholeMesh.visible = bholeRing.visible = false; }
  dN = 0; fire.n = 0; smoke.n = 0;
  stats.kills[0] = stats.kills[1] = stats.lost[0] = stats.lost[1] = 0;
  battleTime = 0; victoryT = -1; nukeFlash = 0;
}
function clearUnits() {
  units = []; stopFollow(true);
  stats.kills[0] = stats.kills[1] = stats.lost[0] = stats.lost[1] = 0;
}
// ───────────── 맵 분위기 ─────────────
const THEMES = {
  village: { top: 0x3f74b8, mid: 0x9cbad6, bot: 0xc7d3dc, fog: [230, 640], sun: 0xffeedd, sunI: 1.9, sunPos: [-110, 170, -70],
    hemi: [0xd4e4ff, 0x6a5a44, .72], base: 0x5d6a5a, water: 0x1f5f7c, exp: 1 },
  canyon: { top: 0x3a6fb5, mid: 0xd9c6a2, bot: 0xe6cfa6, fog: [210, 600], sun: 0xffe0b0, sunI: 2.1, sunPos: [-130, 120, -40],
    hemi: [0xfff0d6, 0x8a6440, .7], base: 0xa07a52, water: 0x2f7f86, exp: 1 },
  snow: { top: 0x7d93ad, mid: 0xc4cfdb, bot: 0xdde4ea, fog: [150, 480], sun: 0xeef3ff, sunI: 1.35, sunPos: [-90, 160, -110],
    hemi: [0xe8f0ff, 0x7a8696, 1.0], base: 0xc4ccd4, water: 0x22536a, exp: .95 },
  city: { top: 0x24345f, mid: 0xd98f66, bot: 0xeeb58c, fog: [200, 560], sun: 0xffb27a, sunI: 1.8, sunPos: [-150, 85, 40],
    hemi: [0x9fb2dc, 0x4a3a30, .62], base: 0x3a3a3e, water: 0x1f5f7c, exp: 1.05 },
};
function applyTheme(id) {
  const t = THEMES[id];
  const u = skyMesh.material.uniforms;
  u.top.value.setHex(t.top); u.mid.value.setHex(t.mid); u.bot.value.setHex(t.bot);
  scene.fog.color.setHex(t.bot); scene.fog.near = t.fog[0]; scene.fog.far = t.fog[1];
  sun.color.setHex(t.sun); sun.intensity = t.sunI;
  sun.position.set(SX / 2 + t.sunPos[0], t.sunPos[1], SZ / 2 + t.sunPos[2]);
  u.sunDir.value.copy(sun.position).sub(sun.target.position).normalize();
  hemi.color.setHex(t.hemi[0]); hemi.groundColor.setHex(t.hemi[1]); hemi.intensity = t.hemi[2];
  baseMesh.material.color.setHex(t.base);
  waterMesh.material.color.setHex(t.water);
  waterMesh.position.y = WATER_Y; waterMesh.visible = WATER_Y > 0;
  renderer.toneMappingExposure = t.exp;
  $('mapName').textContent = MAPS[id].name;
}
let weatherT = 0;
function updateWeather(dt) {
  if (mapId !== 'snow') return;
  weatherT += dt * 70;
  const c = cam.c;
  while (weatherT > 1) {
    weatherT--;
    const r = Math.min(110, c.dist * 1.1 + 20);
    smoke.spawn(c.tx + R(r * 2), c.ty + 25 + Math.random() * 25, c.tz + R(r * 2), R(1.5) + 1, -5 - Math.random() * 3, R(1.5),
      8, .4, .4, [1, 1, 1, .9], [1, 1, 1, .7], 0, 0);
  }
}
function placeDefaultArmies() {
  const comp = [['dog', 3], ['shotgun', 3], ['flame', 2], ['rifle', 8], ['mg', 2], ['sapper', 2], ['grenadier', 2], ['rocket', 3],
    ['engineer', 2], ['medic', 2], ['mortar', 2], ['sniper', 2]];
  for (const team of [0, 1]) {
    const b = BASES[team], yaw = team === 0 ? Math.PI / 2 : -Math.PI / 2;
    const front = team === 0 ? b.x1 - 2 : b.x0 + 2, dir = team === 0 ? -1 : 1;
    let i = 0;
    const list = [];
    for (const [t, n] of comp) for (let k = 0; k < n; k++) list.push(t);
    // 앞줄부터 돌격 병과, 뒤로 갈수록 지원 병과 (comp 순서 그대로)
    const perRow = 9;
    for (const t of list) {
      const row = Math.floor(i / perRow), col = i % perRow;
      const x = front + dir * row * 3.2 + R(.6);
      let z = SZ / 2 + (col - (perRow - 1) / 2) * 5.5 + R(1);
      // 건물 지붕 위가 아닌 맨땅을 찾음
      for (let k = 0; k < 30 && !naturalTop(x, z); k++) z += (k % 2 ? -1 : 1) * (k + 1) * .9;
      spawnUnit(t, team, x, z, yaw);
      i++;
    }
    for (const oz of [-16, 16]) {
      let z = SZ / 2 + oz;
      for (let k = 0; k < 30 && !naturalTop(front + dir * 14, z); k++) z += (k % 2 ? -1 : 1) * (k + 1) * 1.5;
      spawnUnit('tank', team, front + dir * 14, z, yaw);
    }
    spawnUnit('heli', team, front + dir * 20, SZ / 2 + (team ? 6 : -6), yaw);
  }
}
function takeSnapshot() {
  snapshot = { units: units.filter(u => !u.dead).map(u => [u.type, u.team, u.x, u.z, u.yaw]), vox: vox.slice(), tint: vtint.slice() };
}
function startBattle() {
  if (phase !== 'setup') return;
  let a = [0, 0];
  for (const u of units) if (!u.dead) a[u.team]++;
  if (!a[0] && !a[1]) { toast('먼저 병기고에서 병력을 배치하세요'); setDrawer(true); setTab('units'); return; }
  takeSnapshot();
  stats.kills[0] = stats.kills[1] = stats.lost[0] = stats.lost[1] = 0;
  phase = 'battle'; battleTime = 0;
  ui.paused = false;
  // 멀리서 보고 있었다면 전선 쪽으로 카메라를 당김
  if (!followUnit && cam.dist > 130) {
    let sx = 0, sz = 0, n = 0;
    for (const u of units) if (!u.dead) { sx += u.x; sz += u.z; n++; }
    camFocus(sx / n, sz / n, 115); cam.pitch = Math.min(cam.pitch, .6);
  }
  sfxUI('go');
  toast(!a[0] || !a[1] ? '한쪽 병력만 있습니다. 반대 팀도 배치해 보세요' : '전투 개시!');
  refreshHUD();
}
function resetToSetup() {
  clearBattleState();
  if (snapshot) {
    vox.set(snapshot.vox); vtint.set(snapshot.tint);
    sandQueue.clear();
    for (const B of fallingBodies) { worldGroup.remove(B.mesh); B.mesh.geometry.dispose(); }
    fallingBodies.length = 0;
    rebuildAll();
    units = []; stopFollow(true);
    for (const [t, team, x, z, yaw] of snapshot.units) spawnUnit(t, team, x, z, yaw);
  }
  phase = 'setup';
  hideBanner();
  refreshHUD();
  toast('배치 단계로 돌아왔습니다. 병력을 바꾸고 다시 전투를 시작하세요');
}
function newMap(id) {
  clearBattleState(); clearUnits();
  seed = (Math.random() * 1e9) | 0;
  if (id === 'random') { const ids = Object.keys(MAPS).filter(k => k !== mapId); id = ids[(Math.random() * ids.length) | 0]; }
  showLoading(true);
  setTimeout(() => {
    genWorld(seed, id || mapId);
    applyTheme(mapId);
    rebuildCamHeight();
    camReset(true);
    placeDefaultArmies();
    phase = 'setup'; snapshot = null;
    hideBanner(); refreshHUD(); showLoading(false);
  }, 30);
}
function showLoading(on) { $('loading').hidden = !on; }
// ───────────── 지도 선택 ─────────────
const MAP_SWATCH = {
  village: 'linear-gradient(135deg,#5e8f45 0%,#5e8f45 45%,#2f6f8f 46%,#2f6f8f 58%,#9c4a36 59%)',
  canyon: 'linear-gradient(160deg,#e6cfa6 0%,#d29a5e 40%,#b9774a 70%,#2f7f86 71%,#2f7f86 78%,#d8b07a 79%)',
  snow: 'linear-gradient(150deg,#f2f5f8 0%,#dfe7ee 45%,#9fc6da 46%,#9fc6da 62%,#8a8884 63%)',
  city: 'linear-gradient(160deg,#24345f 0%,#d98f66 45%,#3e4044 46%,#6b6d72 70%,#a8a59c 71%)',
};
function buildMapPicker() {
  const box = $('mapList');
  box.innerHTML = '';
  for (const id of Object.keys(MAPS)) {
    const b = document.createElement('button');
    b.className = 'mapitem' + (id === mapId ? ' on' : ''); b.id = 'map-' + id;
    b.innerHTML = `<span class="msw" style="background:${MAP_SWATCH[id]}"></span><span class="mn">${MAPS[id].name}</span><span class="md">${MAPS[id].desc}</span>`;
    b.onclick = () => { $('mapPick').hidden = true; newMap(id); };
    box.appendChild(b);
  }
  $('mapRandom').onclick = () => { $('mapPick').hidden = true; newMap('random'); };
  $('mapClose').onclick = () => { $('mapPick').hidden = true; };
}
function openMapPicker() {
  for (const id of Object.keys(MAPS)) $('map-' + id).classList.toggle('on', id === mapId);
  $('mapPick').hidden = false;
}
let reinforceT = 0;
function reinforce(dt) {
  if (!ui.auto || phase !== 'battle') return;
  reinforceT -= dt;
  if (reinforceT > 0) return;
  reinforceT = 4;
  const a = [0, 0];
  for (const u of units) if (!u.dead) a[u.team]++;
  const pool = ['rifle', 'rifle', 'rifle', 'mg', 'rocket', 'grenadier', 'sniper', 'medic', 'shotgun', 'flame', 'dog', 'dog', 'sapper', 'mortar', 'engineer'];
  for (const team of [0, 1]) {
    if (a[team] >= 45) continue;
    const b = BASES[team], z = 20 + Math.random() * (SZ - 40);
    const x = team === 0 ? b.x0 + 2 : b.x1 - 2;
    if (!naturalTop(x, z)) continue;
    const q = Math.random();
    if (q < .1) spawnUnit('tank', team, x, z);
    else if (q < .16) spawnUnit('heli', team, x, z);
    else for (let k = 0; k < 3; k++) spawnUnit(pool[(Math.random() * pool.length) | 0], team, x + R(3), z + R(4));
  }
}

// ───────────── 루프 ─────────────
let last = performance.now(), acc = 0, frameN = 0;
const STEP = 1 / 60;
function simulate(dt) {
  AU.shots = 3; AU.booms = 4;
  updateCombat(dt);
  updateUnits(dt);
  processCollapse();
  updateFalling(dt);
  if (frameN % 2 === 0) updateSand();
  updateWeather(dt);
  updateFX(dt);
  reinforce(dt);
  if (phase === 'battle') battleTime += dt;
}
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(.1, (now - last) / 1000);
  last = now; frameN++;
  updateKeys(dt);
  updateHeld(dt);
  if (!ui.paused) {
    acc += dt * ui.timeScale;
    let n = 0;
    while (acc >= STEP && n < 4) { simulate(STEP); acc -= STEP; n++; }
    if (n === 4) acc = 0;
  } else {
    // 일시정지 중에도 붕괴 메시 갱신은 계속
    processCollapse();
  }
  rebuildDirty(10);
  updateCamera(dt);
  updatePreview();
  updateVictory(dt);
  updateHUD(dt);
  // 그리기
  boxN = 0;
  drawUnits(); drawProjectiles(); drawPlanes(); drawMines();
  boxMesh.count = boxN;
  boxMesh.instanceMatrix.needsUpdate = true;
  if (boxMesh.instanceColor) boxMesh.instanceColor.needsUpdate = true;
  drawDebris();
  if (waterNormal) { waterNormal.offset.x = now * .000012; waterNormal.offset.y = now * .000008; }
  if (nukeFlash > 0) { nukeFlash = Math.max(0, nukeFlash - dt * .8); }
  $('flash').style.opacity = Math.min(1, nukeFlash * 1.3);
  renderer.render(scene, camera);
  drawOverlay();
}

function boot() {
  initRenderer();
  initPalette();
  initFX();
  initBoxes();
  initPreview();
  ocv = $('overlay'); octx = ocv.getContext('2d');
  makeThumbs();
  buildUI();
  bindInput();
  window.addEventListener('resize', onResize);
  const mobile = matchMedia('(max-width: 720px)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
  setGfx(mobile ? 'low' : 'high');
  setDrawer(!mobile);
  genWorld(seed, 'village');
  applyTheme(mapId);
  rebuildCamHeight();
  camReset(true);
  buildMapPicker();
  placeDefaultArmies();
  refreshHUD();
  showLoading(false);
  requestAnimationFrame(t => { last = t; loop(t); });
}
window.addEventListener('load', boot);
window.addEventListener('pointerdown', () => initAudio(), { capture: true });
window.addEventListener('keydown', () => initAudio(), { capture: true });
window.__pf = { get units() { return units; }, simulate, explode, startBattle, useWeapon, cam, get followUnit() { return followUnit; }, drag, ui, get phase() { return phase; }, stats,
  get dN() { return dN; }, get fallingBodies() { return fallingBodies; }, setTab, setDrawer, resetToSetup };
