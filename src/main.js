import * as THREE from 'three';
import { gsap } from 'gsap';
import './style.css';

const root = document.querySelector('#game-root');
const scoreEl = document.querySelector('#score');
const coinsEl = document.querySelector('#coins');
const levelEl = document.querySelector('#level');
const bestEl = document.querySelector('#best');
const menuBestEl = document.querySelector('#menu-best');
const overlay = document.querySelector('#overlay');
const panel = document.querySelector('#menu-panel');
const startBtn = document.querySelector('#start-btn');
const pauseBtn = document.querySelector('#pause-btn');
const soundBtn = document.querySelector('#sound-btn');
const toast = document.querySelector('#toast');

const LANES = [-2.35, 0, 2.35];
const ROAD_LENGTH = 120;
const clock = new THREE.Clock();
const palette = {
  sky: 0xf4dca7,
  skyDeep: 0xdcbf82,
  fog: 0xe7d9b9,
  road: 0xb6b0a7,
  roadDark: 0x8c8775,
  sidewalk: 0xe7d9bc,
  fence: 0xf5f3eb,
  blue: 0x57c8ff,
  pink: 0xff7fb2,
  gold: 0xf8d95d,
  green: 0x67d9a8,
  orange: 0xf29c6b,
  magenta: 0xff58b7,
};

let scene, camera, renderer, player, roadSegments = [], obstacles = [], coinItems = [], decorations = [];
let state = 'menu';
let lane = 1, targetX = 0, jumpVelocity = 0, grounded = true, playerY = 0;
let speed = 19, distance = 0, score = 0, coins = 0, level = 1;
let best = Number(localStorage.getItem('neonRushBest') || 0);
let spawnTimer = 0, coinTimer = 0, soundOn = true;
let audioCtx = null;
let lastHudScore = -1;
let shake = 0;

bestEl.textContent = menuBestEl.textContent = formatScore(best);

function formatScore(n) { return Math.floor(n).toString().padStart(6, '0'); }

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.sky);
  scene.fog = new THREE.Fog(palette.fog, 28, 105);

  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 180);
  camera.position.set(0, 6.8, 10.8);
  camera.lookAt(0, 1, -7);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  root.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0x9bdcff, 0x17142d, 1.65));
  const key = new THREE.DirectionalLight(0xeffaff, 2.2);
  key.position.set(-5, 13, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -14; key.shadow.camera.right = 14;
  key.shadow.camera.top = 18; key.shadow.camera.bottom = -18;
  scene.add(key);
  const cyan = new THREE.PointLight(0x22dfff, 22, 34);
  cyan.position.set(-7, 5, -15); scene.add(cyan);
  const pink = new THREE.PointLight(0xff3eaa, 18, 30);
  pink.position.set(8, 4, -25); scene.add(pink);

  createWorld();
  createPlayer();
  createRoad();
  bindEvents();
  animateUiEntry();
  animate();
}

function createWorld() {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ color: 0xead7bb, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.12; floor.position.z = -40;
  floor.receiveShadow = true; scene.add(floor);

  const fenceMaterial = new THREE.MeshStandardMaterial({ color: palette.fence, flatShading: true, roughness: 1 });
  for (let side of [-1, 1]) {
    for (let i = 0; i < 18; i++) {
      const h = 3 + Math.random() * 11;
      const w = 2.4 + Math.random() * 3.2;
      const color = i % 4 === 0 ? 0xf5d9a7 : i % 4 === 1 ? 0xf2b37c : i % 4 === 2 ? 0xf6e7bb : 0xe7c4a7;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, 3 + Math.random() * 4),
        new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 })
      );
      mesh.position.set(side * (7 + Math.random() * 10), h / 2 - .1, -i * 6 - 12);
      mesh.receiveShadow = true; scene.add(mesh); decorations.push(mesh);

      if (i % 2 === 0) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(.12, .35, .08), new THREE.MeshBasicMaterial({ color: side === -1 ? 0x4fd7ff : 0xff5eb8 }));
        win.position.set(mesh.position.x - side * .5, 1.1 + Math.random() * Math.max(1, h - 2), mesh.position.z + 1.6);
        scene.add(win); decorations.push(win);
      }
    }

    for (let i = 0; i < 14; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(.16, 1.5, .16), fenceMaterial);
      post.position.set(side * 6.4, .75, -i * 6 - 6);
      post.castShadow = true; scene.add(post); decorations.push(post);
    }
  }

  for (let i = 0; i < 5; i++) {
    const balloon = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(.9, 10, 10), new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? palette.pink : palette.green, emissive: i % 2 === 0 ? 0x4d0c29 : 0x0b3d1f, emissiveIntensity: .22, roughness: .65 }));
    body.scale.set(1, 1.2, 1);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0xfef6da, roughness: 1 }));
    string.position.y = -1.1;
    balloon.add(body); balloon.add(string);
    balloon.position.set(5 + i * 2.5, 7 + (i % 2) * 1.4, -12 - i * 7);
    scene.add(balloon); decorations.push(balloon);
  }
}

function createRoad() {
  const roadMat = new THREE.MeshStandardMaterial({ color: palette.road, roughness: .82, metalness: .15 });
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: palette.sidewalk, roughness: .9 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf7f3e9 });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xf4b55d });
  for (let i = 0; i < 6; i++) {
    const group = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(8.2, .22, ROAD_LENGTH / 5 + .1), roadMat);
    slab.position.y = -.12; slab.receiveShadow = true; group.add(slab);
    const sidewalkLeft = new THREE.Mesh(new THREE.BoxGeometry(1.6, .16, ROAD_LENGTH / 5), sidewalkMat);
    sidewalkLeft.position.set(-4.9, .02, 0); group.add(sidewalkLeft);
    const sidewalkRight = sidewalkLeft.clone();
    sidewalkRight.position.x = 4.9; group.add(sidewalkRight);
    for (let x of [-1.18, 1.18]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(.055, .02, ROAD_LENGTH / 5 - 1), lineMat);
      line.position.set(x, .02, 0); group.add(line);
    }
    for (let x of [-4.05, 4.05]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(.08, .06, ROAD_LENGTH / 5), edgeMat);
      edge.position.set(x, .02, 0); group.add(edge);
    }
    group.position.z = -i * (ROAD_LENGTH / 5);
    scene.add(group); roadSegments.push(group);
  }
}

function createPlayer() {
  player = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x43e7ff, flatShading: true, roughness: .4, metalness: .2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x172d52, flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xb4fbff });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(.72, 1.05, .48), bodyMat);
  torso.position.y = 1.05; torso.castShadow = true; player.add(torso);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(.38, 1), darkMat);
  head.position.y = 1.82; head.castShadow = true; player.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(.42, .12, .04), glowMat);
  visor.position.set(0, 1.87, -.36); player.add(visor);
  for (let x of [-.23, .23]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.22, .58, .28), darkMat);
    leg.position.set(x, .29, 0); leg.castShadow = true; player.add(leg);
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.62, 16), new THREE.MeshBasicMaterial({ color: 0x071020, transparent: true, opacity: .55 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .015; player.add(shadow);
  player.position.set(0, 0, 3.1);
  scene.add(player);
}

function makeObstacle(x, z, type = 'block') {
  const group = new THREE.Group();
  if (type === 'barrier') {
    const color = 0xffc85a;
    const mat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: .55, emissive: 0xff9a00, emissiveIntensity: .15 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.7, .72, .18), mat);
    sign.position.y = .95; sign.castShadow = true; group.add(sign);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.45, .12, .02), new THREE.MeshBasicMaterial({ color: 0xff5ea8 }));
    stripe.position.set(0, .95, .11); group.add(stripe);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(.12, 1.6, .12), new THREE.MeshStandardMaterial({ color: 0xf5efe4, flatShading: true }));
    pole.position.set(0, .5, -.25); group.add(pole);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(1.2, .24, .52), new THREE.MeshStandardMaterial({ color: 0xf5efe4, flatShading: true }));
    stand.position.set(0, .12, -.2); group.add(stand);
    group.position.set(x, 0, z);
  } else {
    const carMat = new THREE.MeshStandardMaterial({ color: palette.blue, flatShading: true, roughness: .5, metalness: .1 });
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x7ed6ff, flatShading: true, roughness: .5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, .68, 1.05), carMat);
    body.position.y = .5; body.castShadow = true; group.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.05, .52, .82), cabinMat);
    cabin.position.set(0, .9, 0); cabin.castShadow = true; group.add(cabin);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.2, .18, .92), new THREE.MeshBasicMaterial({ color: 0xfaf6de }));
    hood.position.set(0, .74, .03); group.add(hood);
    const wheelGeo = new THREE.CylinderGeometry(.27, .27, .18, 12);
    for (const px of [-.65, .65]) {
      for (const pz of [-.42, .42]) {
        const wheel = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color: 0x292d33, roughness: .9 }));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(px, .2, pz);
        wheel.castShadow = true; group.add(wheel);
      }
    }
    group.position.set(x, 0, z);
  }
  scene.add(group);
  obstacles.push({ group, type, passed: false });
}

function makeCoin(x, z) {
  const group = new THREE.Group();
  const coin = new THREE.Mesh(new THREE.TorusGeometry(.32, .105, 7, 12), new THREE.MeshStandardMaterial({ color: 0xffd84a, emissive: 0xffa900, emissiveIntensity: .5, metalness: .65, roughness: .25 }));
  coin.rotation.y = Math.PI / 2; coin.position.y = 1.05; coin.castShadow = true; group.add(coin);
  const sparkle = new THREE.PointLight(0xffc94a, 1.4, 3); sparkle.position.y = 1; group.add(sparkle);
  group.position.set(x, 0, z); scene.add(group); coinItems.push({ group, coin });
}

function clearRunObjects() {
  for (const item of obstacles) scene.remove(item.group);
  for (const item of coinItems) scene.remove(item.group);
  obstacles = []; coinItems = [];
}

function startGame() {
  clearRunObjects();
  state = 'running'; lane = 1; targetX = 0; player.position.set(0, 0, 3.1);
  playerY = 0; jumpVelocity = 0; grounded = true;
  speed = 19; distance = 0; score = 0; coins = 0; level = 1;
  spawnTimer = .8; coinTimer = .3; shake = 0;
  updateHud();
  overlay.classList.add('hidden');
  toastMessage('RUN STARTED');
  ensureAudio();
}

function animateUiEntry() {
  const panelEl = panel;
  gsap.fromTo(panelEl, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power3.out' });
  gsap.fromTo(panelEl.querySelector('.primary-btn'), { scale: 0.92, y: 10 }, { scale: 1, y: 0, duration: 0.7, ease: 'back.out(1.7)' });
  gsap.fromTo(panelEl.querySelectorAll('.menu-stats > div'), { y: 10, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.4 });
}

function showMenu(title, description, buttonText, action) {
  panel.innerHTML = `
    <div class="eyebrow"><span class="pulse"></span> NEON RUSH / ARCADE SYSTEM</div>
    <h1>${title}</h1>
    <p class="lead">${description}</p>
    <div class="menu-stats">
      <div><small>FINAL SCORE</small><b>${formatScore(score)}</b></div>
      <div><small>COINS</small><b>${coins}</b></div>
      <div><small>BEST</small><b>${formatScore(best)}</b></div>
    </div>
    <button id="overlay-action" class="primary-btn">${buttonText} <span>→</span></button>
    <p class="hint">← → or A / D to switch lanes · ↑ / SPACE to jump</p>`;
  overlay.classList.remove('hidden');
  const actionBtn = document.querySelector('#overlay-action');
  actionBtn.addEventListener('click', action);
  gsap.fromTo('.panel', { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out' });
  gsap.fromTo(actionBtn, { scale: 0.92, y: 12 }, { scale: 1, y: 0, duration: 0.7, ease: 'back.out(1.7)' });
}

function endGame() {
  if (state !== 'running') return;
  state = 'over';
  if (score > best) {
    best = score;
    localStorage.setItem('neonRushBest', String(best));
  }
  bestEl.textContent = menuBestEl.textContent = formatScore(best);
  playTone(130, .35, 'sawtooth');
  showMenu('GAME<br><span>OVER</span>', 'The grid got you this time. Ready for another run?', 'TRY AGAIN', startGame);
}

function pauseGame() {
  if (state === 'running') {
    state = 'paused';
    showMenu('PAUSE<br><span>MODE</span>', 'Take a breath. Your run is waiting.', 'RESUME RUN', () => { state = 'running'; overlay.classList.add('hidden'); clock.getDelta(); });
  } else if (state === 'paused') {
    state = 'running'; overlay.classList.add('hidden');
  }
}

function moveLane(direction) {
  if (state !== 'running') return;
  lane = THREE.MathUtils.clamp(lane + direction, 0, 2);
  targetX = LANES[lane];
  playTone(360, .055, 'sine');
}

function jump() {
  if (state !== 'running' || !grounded) return;
  grounded = false; jumpVelocity = 9.4;
  playTone(520, .09, 'triangle');
}

function bindEvents() {
  window.addEventListener('keydown', e => {
    if (['ArrowLeft','ArrowRight','ArrowUp',' '].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') moveLane(-1);
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') moveLane(1);
    if (e.key === 'ArrowUp' || e.key === ' ' || e.key.toLowerCase() === 'w') jump();
    if (e.key.toLowerCase() === 'p' || e.key === 'Escape') pauseGame();
  });
  document.querySelectorAll('.touch-controls button').forEach(btn => {
    const act = () => {
      if (btn.dataset.action === 'left') moveLane(-1);
      if (btn.dataset.action === 'right') moveLane(1);
      if (btn.dataset.action === 'jump') jump();
    };
    btn.addEventListener('pointerdown', e => { e.preventDefault(); act(); });
  });
  startBtn.addEventListener('click', startGame);
  pauseBtn.addEventListener('click', pauseGame);
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn; soundBtn.textContent = soundOn ? '♫' : '♪̸';
    toastMessage(soundOn ? 'SOUND ON' : 'SOUND OFF');
  });
  window.addEventListener('resize', onResize);
  // Swipe gestures for phones/tablets.
  let touchStart = null;
  renderer.domElement.addEventListener('touchstart', e => { touchStart = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }; }, { passive: true });
  renderer.domElement.addEventListener('touchend', e => {
    if (!touchStart || state !== 'running') return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1);
    else if (dy < -30) jump();
    touchStart = null;
  }, { passive: true });
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
}

function updateHud() {
  scoreEl.textContent = formatScore(score);
  coinsEl.textContent = String(coins);
  levelEl.textContent = String(level).padStart(2, '0');
}

function toastMessage(message) {
  toast.textContent = message; toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 1100);
}

function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { audioCtx = null; }
  }
  if (audioCtx?.state === 'suspended') audioCtx.resume();
}
function playTone(freq, duration, type = 'sine') {
  if (!soundOn) return;
  ensureAudio();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type; osc.frequency.value = freq;
  gain.gain.setValueAtTime(.055, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + duration);
}

function spawnWave() {
  const laneIndex = Math.floor(Math.random() * 3);
  const type = Math.random() < .3 ? 'barrier' : 'block';
  makeObstacle(LANES[laneIndex], -62, type);
  if (Math.random() < .55) {
    const coinLane = (laneIndex + 1 + Math.floor(Math.random() * 2)) % 3;
    for (let i = 0; i < 4; i++) makeCoin(LANES[coinLane], -69 - i * 2.2);
  }
}

function updateGame(dt) {
  if (state !== 'running') return;
  distance += speed * dt;
  speed = Math.min(34, 19 + distance * .012);
  const nextLevel = Math.floor(distance / 250) + 1;
  if (nextLevel !== level) { level = nextLevel; toastMessage(`LEVEL ${String(level).padStart(2,'0')}`); playTone(740, .15, 'triangle'); }
  score = Math.floor(distance * 10) + coins * 50;

  // Recycle road segments for endless movement.
  for (const seg of roadSegments) {
    seg.position.z += speed * dt;
    if (seg.position.z > ROAD_LENGTH / 5) seg.position.z -= ROAD_LENGTH / 5 * roadSegments.length;
  }
  // Buildings drift subtly for parallax.
  for (const deco of decorations) {
    if (deco.position.z !== undefined) {
      deco.position.z += speed * dt * .35;
      if (deco.position.z > 12) deco.position.z -= 145;
    }
  }

  player.position.x = THREE.MathUtils.damp(player.position.x, targetX, 13, dt);
  if (!grounded) {
    playerY += jumpVelocity * dt;
    jumpVelocity -= 24 * dt;
    if (playerY <= 0) { playerY = 0; grounded = true; jumpVelocity = 0; }
  }
  player.position.y = playerY;
  player.rotation.z = THREE.MathUtils.damp(player.rotation.z, (targetX - player.position.x) * -.13, 9, dt);
  player.rotation.x = grounded ? Math.sin(distance * .07) * .025 : -.08;

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnWave();
    spawnTimer = Math.max(.72, 1.42 - (speed - 19) * .035) + Math.random() * .3;
  }
  // Obstacles and coins move toward the player.
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const item = obstacles[i];
    item.group.position.z += speed * dt;
    if (!item.passed && item.group.position.z > 2.25) {
      item.passed = true;
      const sameLane = Math.abs(item.group.position.x - player.position.x) < .78;
      const verticalClear = item.type === 'barrier' ? playerY > .88 : playerY > 1.45;
      if (sameLane && !verticalClear) { shake = .22; endGame(); return; }
    }
    if (item.group.position.z > 13) { scene.remove(item.group); obstacles.splice(i, 1); }
  }
  for (let i = coinItems.length - 1; i >= 0; i--) {
    const item = coinItems[i];
    item.group.position.z += speed * dt;
    item.coin.rotation.z += dt * 3.2;
    item.group.position.y = Math.sin(distance * .08 + item.group.position.z) * .08;
    if (!item.collected && Math.abs(item.group.position.z - 3.1) < .8 && Math.abs(item.group.position.x - player.position.x) < .85 && playerY < 1.8) {
      item.collected = true; coins++; playTone(850, .07, 'sine'); scene.remove(item.group);
      score = Math.floor(distance * 10) + coins * 50;
    }
    if (item.group.position.z > 13) { scene.remove(item.group); coinItems.splice(i, 1); }
  }
  if (score !== lastHudScore) { updateHud(); lastHudScore = score; }
  if (shake > 0) shake -= dt;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .04);
  if (state === 'running') updateGame(dt);
  const t = performance.now() * .001;
  if (player) {
    player.children[0].position.y = 1.05 + (grounded ? Math.sin(t * 10) * .035 : 0);
    player.children[1].rotation.y = Math.sin(t * 2) * .08;
  }
  camera.position.x = THREE.MathUtils.damp(camera.position.x, player ? player.position.x * .22 : 0, 3, dt);
  camera.position.y = 6.8 + (playerY > 0 ? playerY * .12 : 0);
  camera.lookAt(player ? player.position.x * .12 : 0, 1.0, -7);
  if (shake > 0) camera.position.x += (Math.random() - .5) * shake * 2;
  renderer.render(scene, camera);
}

init();
