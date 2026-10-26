import * as THREE from '../vendor/three.module.min.js';
import { createWorld } from './world.js';
import { Kart, KART_COLORS, randomBotName } from './kart.js';
import { Projectile, Pickup } from './projectiles.js';
import { SoundEngine } from './audio.js';

const TAU = Math.PI * 2;

// ---------- state ----------
const state = {
  mode: 'menu', // menu | playing | paused | results
  running: false,
  timeLeft: 150,
  targetSmashes: 15,
  karts: [],
  projectiles: [],
  pickups: [],
  particles: [],
  floatingTexts: [],
  player: null,
  world: null,
  scene: null,
  camera: null,
  renderer: null,
  clock: null,
  raf: null,
  input: {
    moveX: 0, moveZ: 0,
    aimX: 0, aimZ: 0,
    shoot: false,
    boost: false,
    pointerLocked: false
  },
  mouse: { x: 0, y: 0 },
  clock: new THREE.Clock(),
  isTouch: false,
  sound: new SoundEngine(),
  settings: { sound: true },
  lastHudUpdate: 0,
  killfeed: [],
  respawnQueue: [],
  autoStartFired: false
};

const $ = (id) => document.getElementById(id);

// ---------- init ----------
function init() {
  detectTouch();
  setupRenderer();
  setupScene();
  setupCamera();
  setupLights();
  state.world = createWorld(state.scene);
  setupPickups();
  setupEventListeners();
  setupMenu();
  hideLoading();
  animate();
  state.sound.init();
}

function detectTouch() {
  state.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (state.isTouch) document.body.classList.add('is-touch');
}

function setupRenderer() {
  const canvas = $('game');
  state.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  state.renderer.shadowMap.enabled = true;
  state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  state.renderer.outputColorSpace = THREE.SRGBColorSpace;
  state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  state.renderer.toneMappingExposure = 1.05;
}

function setupScene() {
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color('#b8f1ff');
}

function setupCamera() {
  state.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 400);
  state.camera.position.set(0, 14, 18);
}

function setupLights() {
  // world handles lights
}

function setupPickups() {
  state.pickups = state.world.pickupSpots.map((s, i) => new Pickup({ x: s.x, z: s.z, index: i }));
  for (const p of state.pickups) state.scene.add(p.mesh);
}

function hideLoading() {
  setTimeout(() => {
    const l = $('loading');
    l.classList.add('is-hidden');
  }, 300);
}

// ---------- menu ----------
function setupMenu() {
  // sound toggle
  const soundBtn = $('menuSound');
  soundBtn.addEventListener('click', () => {
    state.settings.sound = !state.settings.sound;
    state.sound.setEnabled(state.settings.sound);
    soundBtn.classList.toggle('is-muted', !state.settings.sound);
  });

  // swatches
  const swatches = $('swatches');
  swatches.addEventListener('click', (e) => {
    const btn = e.target.closest('.swatch');
    if (!btn) return;
    swatches.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
    btn.classList.add('selected');
    state.sound.ui();
  });

  // random name
  $('randomName').addEventListener('click', () => {
    const names = ['ROOKIE', 'ACE', 'BLAZE', 'NOVA', 'REX', 'VOLT', 'ZERO', 'ECHO', 'ION', 'KIT'];
    $('playerName').value = names[Math.floor(Math.random() * names.length)];
    state.sound.ui();
  });

  // play
  $('playButton').addEventListener('click', startGame);
}

function getPlayerColor() {
  const sel = document.querySelector('.swatch.selected');
  return sel ? sel.dataset.color : '#ff4d7d';
}

function getPlayerName() {
  let v = $('playerName').value.trim().toUpperCase();
  if (!v) v = 'ROOKIE';
  return v.slice(0, 12);
}

// ---------- game flow ----------
function startGame() {
  state.sound.resume();
  state.sound.ui();
  // clear previous
  clearGameObjects();
  state.karts = [];
  state.projectiles = [];
  state.particles = [];
  state.floatingTexts = [];
  state.killfeed = [];
  state.aimOffset = 0;
  state.mouseDeltaX = 0;
  pressed.clear();
  state.timeLeft = 150;
  state.mode = 'playing';
  document.body.classList.add('is-game');

  // player
  const color = getPlayerColor();
  const name = getPlayerName();
  const player = new Kart({ name, color, isPlayer: true, index: 0 });
  player.reset(state.world.spawnPoints[0]);
  state.karts.push(player);
  state.player = player;
  state.scene.add(player.group);

  // bots
  const usedNames = new Set([name]);
  for (let i = 1; i < 8; i++) {
    const botName = randomBotName(usedNames);
    usedNames.add(botName);
    const botColor = KART_COLORS[i % KART_COLORS.length];
    const bot = new Kart({ name: botName, color: botColor, isPlayer: false, index: i });
    bot.reset(state.world.spawnPoints[i % state.world.spawnPoints.length]);
    state.karts.push(bot);
    state.scene.add(bot.group);
  }

  // reset pickups
  for (const p of state.pickups) {
    p.active = true;
    p.mesh.visible = true;
    p.respawnTimer = 0;
  }

  // hide menu, show hud
  $('menu').classList.add('is-hidden');
  $('hud').classList.remove('is-hidden');
  $('mobileControls').classList.remove('is-hidden');
  $('mobileControls').setAttribute('aria-hidden', 'false');

  // pointer lock for desktop
  if (!state.isTouch) {
    requestPointerLock();
  }

  state.sound.startMusic();
  state.sound.startEngine();
  updateHud(true);
  updateLeaderboard();
  state.autoStartFired = true;
}

function clearGameObjects() {
  for (const k of state.karts) if (k.group) state.scene.remove(k.group);
  for (const p of state.projectiles) if (p.mesh) state.scene.remove(p.mesh);
  for (const p of state.particles) if (p.mesh) state.scene.remove(p.mesh);
  for (const t of state.floatingTexts) if (t.el) t.el.remove();
  state.particles = [];
  state.floatingTexts = [];
}

function endGame() {
  state.mode = 'results';
  state.sound.stopMusic();
  state.sound.stopEngine();
  // determine winner
  const sorted = [...state.karts].sort((a, b) => b.score - a.score || a.deaths - b.deaths);
  const winner = sorted[0];
  const playerPlace = sorted.indexOf(state.player) + 1;
  const isWin = winner === state.player;
  $('resultKicker').textContent = isWin ? 'CHAMPION' : (playerPlace <= 3 ? 'PODIUM FINISH' : 'MATCH COMPLETE');
  $('resultTitle').textContent = isWin ? 'VICTORY!' : (playerPlace === 2 ? 'SO CLOSE!' : 'DEFEAT');
  $('resultSubtitle').textContent = isWin
    ? 'You wrecked the competition.'
    : (winner.name + ' takes the crown.');
  $('resultScore').textContent = state.player.score;

  const list = $('finalStandings');
  list.innerHTML = '';
  sorted.forEach((k, i) => {
    const li = document.createElement('li');
    li.style.setProperty('--kart', k.color);
    if (k === state.player) li.classList.add('is-you');
    li.innerHTML = `<span class="place">${i + 1}</span><span class="dot"></span><span class="name">${k.name}${k === state.player ? ' (YOU)' : ''}</span><span class="score">${k.score}</span>`;
    list.appendChild(li);
  });

  $('results').classList.remove('is-hidden');
  if (isWin) triggerSmashText('VICTORY');
}

function quitToMenu() {
  state.mode = 'menu';
  document.body.classList.remove('is-game');
  state.sound.stopMusic();
  state.sound.stopEngine();
  // remove pointer lock
  if (document.pointerLockElement) document.exitPointerLock();
  $('hud').classList.add('is-hidden');
  $('mobileControls').classList.add('is-hidden');
  $('pause').classList.add('is-hidden');
  $('results').classList.add('is-hidden');
  $('menu').classList.remove('is-hidden');
  clearGameObjects();
  state.karts = [];
  state.projectiles = [];
}

// ---------- input ----------
function setupEventListeners() {
  window.addEventListener('resize', onResize);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  // (listeners replaced below with kd/ku)
  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('pointerlockerror', () => {});

  // mobile sticks
  setupTouchSticks();

  // pause modal buttons
  $('resumeButton').addEventListener('click', resumeGame);
  $('quitButton').addEventListener('click', quitToMenu);
  $('againButton').addEventListener('click', () => { $('results').classList.add('is-hidden'); startGame(); });
  $('menuButton').addEventListener('click', () => { $('results').classList.add('is-hidden'); quitToMenu(); });
}

function onResize() {
  if (!state.renderer) return;
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
}

function requestPointerLock() {
  const canvas = $('game');
  try { canvas.requestPointerLock(); } catch (e) {}
}

function onPointerLockChange() {
  state.input.pointerLocked = document.pointerLockElement === $('game');
}

function onMouseMove(e) {
  if (state.mode !== 'playing') return;
  if (state.input.pointerLocked) {
    state.mouseDeltaX = (state.mouseDeltaX || 0) + e.movementX;
  } else {
    state.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    state.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }
}

// We'll handle aim angle in update: if pointer locked, aimAngle = player.angle + aimOffset; else raycast.
let aimOffset = 0;
// patch: track aimOffset variable via state
state.aimOffset = 0;

function onMouseDown(e) {
  if (state.mode !== 'playing') return;
  if (e.button === 0) state.input.shoot = true;
  if (!state.isTouch && !state.input.pointerLocked) requestPointerLock();
}

function onMouseUp(e) {
  if (e.button === 0) state.input.shoot = false;
}

function onKeyUp(e) {}
function onKeyDown(e) {
  if (state.mode === 'playing') {
    switch (e.code) {
      case 'KeyW': state.input.moveZ = -1; break; // z forward negative? We'll use: forward is -z? Need consistency.
      case 'KeyS': state.input.moveZ = 1; break;
      case 'KeyA': state.input.moveX = -1; break;
      case 'KeyD': state.input.moveX = 1; break;
      case 'ShiftLeft':
      case 'ShiftRight': state.input.boost = true; break;
      case 'Escape':
        pauseGame(); break;
    }
  } else if (state.mode === 'paused') {
    if (e.code === 'Escape') resumeGame();
  }
  // movement keys may be held; handle via keydown/keyup with additive not enough for diagonals. Use pressed set instead.
}

// Better: track pressed keys
const pressed = new Set();
function handlePressedKeys() {
  let mx = 0, mz = 0;
  if (pressed.has('KeyA')) mx -= 1;
  if (pressed.has('KeyD')) mx += 1;
  if (pressed.has('KeyW')) mz += 1;
  if (pressed.has('KeyS')) mz -= 1;
  // normalize
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  state.input.moveX = mx;
  state.input.moveZ = mz;
  state.input.boost = pressed.has('ShiftLeft') || pressed.has('ShiftRight');
}

// override key handlers to use pressed set
function kd(e) {
  if (state.mode === 'playing' || state.mode === 'paused') {
    pressed.add(e.code);
    handlePressedKeys();
    if (e.code === 'Escape') {
      if (state.mode === 'playing') pauseGame(); else if (state.mode === 'paused') resumeGame();
    }
    if (e.code === 'Space') state.input.shoot = true;
  }
}
function ku(e) {
  pressed.delete(e.code);
  handlePressedKeys();
  if (e.code === 'Space') state.input.shoot = false;
}
// replace
document.removeEventListener('keydown', onKeyDown);
document.removeEventListener('keyup', onKeyUp);
document.addEventListener('keydown', kd);
document.addEventListener('keyup', ku);

function pauseGame() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  state.sound.stopMusic();
  state.sound.stopEngine();
  if (document.pointerLockElement) document.exitPointerLock();
  $('pause').classList.remove('is-hidden');
}

function resumeGame() {
  if (state.mode !== 'paused') return;
  state.mode = 'playing';
  $('pause').classList.add('is-hidden');
  state.sound.startMusic();
  state.sound.startEngine();
  if (!state.isTouch) requestPointerLock();
}

// ---------- touch sticks ----------
function setupTouchSticks() {
  const moveStick = $('moveStick');
  const aimStick = $('aimStick');
  setupStick(moveStick, (x, y) => {
    state.input.moveX = x;
    state.input.moveZ = y;
  });
  setupStick(aimStick, (x, y) => {
    state.touchAimX = x;
    state.touchAimY = y;
    const len = Math.hypot(x, y);
    state.input.shoot = len > 0.55;
  });
}

function setupStick(el, cb) {
  let active = false;
  let pointerId = null;
  const knob = el.querySelector('.stick-knob');
  const base = el.querySelector('.stick-base');
  const radius = 46;
  function update(clientX, clientY) {
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) { dx = dx / dist * radius; dy = dy / dist * radius; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    cb(dx / radius, dy / radius);
  }
  function reset() {
    knob.style.transform = '';
    cb(0, 0);
    active = false;
    pointerId = null;
    el.classList.remove('is-active');
  }
  el.addEventListener('pointerdown', (e) => {
    active = true;
    pointerId = e.pointerId;
    el.setPointerCapture(e.pointerId);
    el.classList.add('is-active');
    update(e.clientX, e.clientY);
  });
  el.addEventListener('pointermove', (e) => {
    if (!active || e.pointerId !== pointerId) return;
    update(e.clientX, e.clientY);
  });
  el.addEventListener('pointerup', (e) => { if (e.pointerId === pointerId) reset(); });
  el.addEventListener('pointercancel', (e) => { if (e.pointerId === pointerId) reset(); });
}

// ---------- aim handling in update ----------
function updateAim(player) {
  if (state.isTouch) {
    // aimX/aimZ already set as normalized stick; convert to world angle
    const ax = state.input.aimX;
    const az = state.input.aimZ;
    if (Math.hypot(ax, az) > 0.15) {
      // stick y is screen vertical -> map to world? Use camera-relative? Simpler: aim relative to player facing + stick
      const a = Math.atan2(ax, az);
      player.aimAngle = player.angle + a;
      state.input.aimX = ax; // keep
      state.input.aimZ = az;
    }
    // For Kart.update, aimX/aimZ expected as world-space vector? Our Kart uses input.aimX/aimZ as raw and computes aimAngle = atan2(aimX, aimZ). 
    // To make desktop mouse work, we instead set player.aimAngle directly and pass 0 to input? Let's adjust: Kart.update reads input.aimX/Z and sets aimAngle. 
    // So for touch, pass stick as aimX/Z but that's player-relative not world. Mismatch.
    // Solution: in game update, compute aimVector and write to state.input.aimX/Z in world space.
  }
}

// Rework: We'll handle aim in main update loop before kart update, writing world-space aim vector to input.
function computeInputForPlayer(player) {
  // move vector is already in world space? For desktop WASD, moveX/Z are camera-relative? We'll make them world-relative based on camera yaw.
  // Simpler: keep WASD as world axes (W = -z). Camera follows player, so okay-ish. But nicer: camera-relative. Let's do camera-relative.
  const camYaw = state.cameraYaw || 0;
  // convert input.moveX/Z (local) to world
  const lx = state.input.moveX;
  const lz = state.input.moveZ;
  const wx = lx * Math.cos(camYaw) + lz * Math.sin(camYaw);
  const wz = -lx * Math.sin(camYaw) + lz * Math.cos(camYaw);
  state.input.moveX = wx;
  state.input.moveZ = wz;

  // aim
  if (state.isTouch) {
    const ax = state.touchAimX || 0;
    const az = state.touchAimY || 0;
    // not used; handled below
  }
}

// This is getting messy. Let's simplify: keep input.moveX/Z as world-space after conversion in update loop. And aim as world angle.

// ---------- main update ----------
let cameraYaw = 0;
let cameraPitch = 0.7;
const cameraDistance = 16;
let cameraTarget = new THREE.Vector3();

function update(dt) {
  if (state.mode !== 'playing') {
    // still animate world
    state.world.update(dt);
    return;
  }

  // time
  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    endGame();
    return;
  }

  // check win
  for (const k of state.karts) {
    if (k.score >= state.targetSmashes) { endGame(); return; }
  }

  // camera yaw from player? We'll compute camera follow.
  const player = state.player;

  // aim handling
  if (player.alive) handleAim(player, dt);
  else { state.input.aimX = Math.sin(player.angle); state.input.aimZ = Math.cos(player.angle); }

  // move vector camera-relative
  // Convert pressed-based move (which is in screen/local) to world using camera yaw
  // state.input.moveX/Z currently set by keyboard as world axes (a/d, w/s). Convert:
  const mx = state.input.moveX;
  const mz = state.input.moveZ;
  // treat as camera-local: x right, z forward (negative forward). Convert to world:
  const cy = cameraYaw;
  const worldMx = mx * Math.cos(cy) + mz * Math.sin(cy);
  const worldMz = -mx * Math.sin(cy) + mz * Math.cos(cy);
  // write back temporarily? Kart reads state.input.moveX/Z. We'll set a separate for kart.
  // Instead, set state.input.moveX/Z to world for this frame, then next frame keyboard resets? Keyboard sets raw each key event, not per frame. 
  // So we need to keep raw input separate. Let's restructure: keep rawInput.

  // We'll instead not convert; keep WASD world axes. Camera yaw initialized 0 and follows loosely. Simpler and acceptable.
  // (No conversion.)

  // update karts
  for (const kart of state.karts) {
    const inp = (kart === player) ? state.input : getAIInput(kart, dt);
    // For player aim, ensure input.aimX/Z reflect aim vector world space
    if (kart === player) {
      // aim vector already set in handleAim into state.input.aimX/Z
    }
    kart.update(dt, inp, state.world, state);
  }

  // update projectiles
  for (const proj of state.projectiles) {
    if (proj.alive) proj.update(dt, state);
  }
  state.projectiles = state.projectiles.filter(p => {
    if (!p.alive) { state.scene.remove(p.mesh); return false; }
    return true;
  });

  // pickups
  const time = performance.now() / 1000;
  for (const pickup of state.pickups) {
    pickup.update(dt, time);
    if (pickup.active) {
      for (const kart of state.karts) {
        if (!kart.alive) continue;
        const dx = kart.position.x - pickup.position.x;
        const dz = kart.position.z - pickup.position.z;
        if (Math.hypot(dx, dz) < 1.9) {
          kart.collectPickup(pickup, state);
          break;
        }
      }
    }
  }

  // particles
  updateParticles(dt);

  // floating texts
  updateFloatingTexts(dt);

  // world
  state.world.update(dt);

  // camera
  updateCamera(dt, player);

  // hud
  state.lastHudUpdate += dt;
  if (state.lastHudUpdate > 0.1) {
    state.lastHudUpdate = 0;
    updateHud(false);
    updateLeaderboard();
    updateMinimap();
  }
}

function handleAim(player, dt) {
  if (state.isTouch) {
    const ax = state.touchAimX || 0;
    const az = state.touchAimY || 0;
    const len = Math.hypot(ax, az);
    if (len > 0.15) {
      // aim stick: x right, y down (screen). Map to world relative to camera yaw.
      const a = Math.atan2(ax, az);
      const worldA = cameraYaw + a;
      state.input.aimX = Math.sin(worldA);
      state.input.aimZ = Math.cos(worldA);
    } else {
      state.input.aimX = Math.sin(player.angle);
      state.input.aimZ = Math.cos(player.angle);
    }
    return;
  }
  if (state.input.pointerLocked) {
    const delta = state.mouseDeltaX || 0;
    state.mouseDeltaX = 0;
    state.aimOffset = (state.aimOffset || 0) + delta * 0.0035;
    state.aimOffset = Math.max(-Math.PI * 0.85, Math.min(Math.PI * 0.85, state.aimOffset));
    const a = player.angle + state.aimOffset;
    state.input.aimX = Math.sin(a);
    state.input.aimZ = Math.cos(a);
  } else {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(state.mouse.x, state.mouse.y), state.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, target);
    if (target) {
      const dx = target.x - player.position.x;
      const dz = target.z - player.position.z;
      const a = Math.atan2(dx, dz);
      state.input.aimX = Math.sin(a);
      state.input.aimZ = Math.cos(a);
    }
  }
}

// Wait: onMouseMove for pointer locked added to state.input.aimX. But state.input.aimX is also used as aim vector. Conflict. Let's handle separately: use state.mouseDeltaX.
// Redo: I'll adjust onMouseMove to add to state.mouseDeltaX instead.

// ---------- AI ----------
function getAIInput(kart, dt) {
  kart.aiTimer -= dt;
  // find target
  let target = null;
  // prefer nearest enemy
  let bestDist = Infinity;
  for (const other of state.karts) {
    if (other === kart || !other.alive) continue;
    const d = Math.hypot(other.position.x - kart.position.x, other.position.z - kart.position.z);
    if (d < bestDist) { bestDist = d; target = other; }
  }
  // maybe pickup
  let pickupTarget = null;
  let bestP = Infinity;
  for (const p of state.pickups) {
    if (!p.active) continue;
    const d = Math.hypot(p.position.x - kart.position.x, p.position.z - kart.position.z);
    if (d < bestP && d < 22) { bestP = d; pickupTarget = p; }
  }

  const inp = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 0, shoot: false, boost: false };

  // decide
  let desiredAngle = kart.aiWander;
  let speed = 1;

  const toTargetDist = target ? Math.hypot(target.position.x - kart.position.x, target.position.z - kart.position.z) : 99;
  if (target && toTargetDist < 26) {
    // aim at target
    const a = Math.atan2(target.position.x - kart.position.x, target.position.z - kart.position.z);
    inp.aimX = Math.sin(a);
    inp.aimZ = Math.cos(a);
    // move: approach if far, strafe if close
    if (toTargetDist > 12) {
      desiredAngle = a;
      speed = 1;
    } else if (toTargetDist < 6) {
      // strafe
      desiredAngle = a + Math.PI / 2;
      speed = 0.9;
    } else {
      desiredAngle = a;
      speed = 0.6;
    }
    // shoot if aligned
    const aimDiff = Math.abs(normalizeAngle(a - kart.angle));
    if (aimDiff < 0.35 && toTargetDist < 28) {
      inp.shoot = true;
    }
    // boost occasionally
    if (toTargetDist > 16 && kart.boost > 0.6 && Math.random() < 0.02) inp.boost = true;
  } else if (pickupTarget) {
    const a = Math.atan2(pickupTarget.position.x - kart.position.x, pickupTarget.position.z - kart.position.z);
    desiredAngle = a;
    speed = 1;
    inp.aimX = Math.sin(kart.angle);
    inp.aimZ = Math.cos(kart.angle);
  } else {
    // wander
    if (kart.aiTimer <= 0) {
      kart.aiWander = Math.random() * TAU;
      kart.aiTimer = 1.5 + Math.random() * 2;
    }
    desiredAngle = kart.aiWander;
    speed = 0.7;
    inp.aimX = Math.sin(kart.angle);
    inp.aimZ = Math.cos(kart.angle);
  }

  // obstacle avoidance: if blocked ahead, turn
  const forward = { x: Math.sin(desiredAngle), z: Math.cos(desiredAngle) };
  const aheadX = kart.position.x + forward.x * 4;
  const aheadZ = kart.position.z + forward.z * 4;
  if (state.world.isBlocked(aheadX, aheadZ, 1.2)) {
    desiredAngle += Math.PI / 2;
  }

  // convert desiredAngle to move vector relative to kart? Kart.update expects moveX/Z as world-space desired direction? 
  // In Kart.update, inputAngle = atan2(moveX, moveZ) and turns toward it. So pass world desired direction.
  inp.moveX = Math.sin(desiredAngle) * speed;
  inp.moveZ = Math.cos(desiredAngle) * speed;

  // shoot cooldown managed by kart
  return inp;
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

// ---------- particles ----------
function spawnExplosion(position, color, count = 24) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TAU;
    const speed = 2 + Math.random() * 6;
    const size = 0.12 + Math.random() * 0.22;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 6, 5),
      new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? color : '#ffe14f' })
    );
    mesh.position.copy(position);
    mesh.position.y += 0.6;
    state.scene.add(mesh);
    state.particles.push({
      mesh,
      velocity: new THREE.Vector3(Math.cos(angle) * speed, 2 + Math.random() * 4, Math.sin(angle) * speed),
      life: 0.7 + Math.random() * 0.5,
      maxLife: 1.2
    });
  }
  // smoke
  for (let i = 0; i < 8; i++) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.4 + Math.random() * 0.5, 6, 5),
      new THREE.MeshBasicMaterial({ color: '#888', transparent: true, opacity: 0.35 })
    );
    mesh.position.copy(position);
    mesh.position.y += 0.5;
    state.scene.add(mesh);
    state.particles.push({
      mesh,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2),
      life: 1.2,
      maxLife: 1.2,
      smoke: true
    });
  }
}

function updateParticles(dt) {
  for (const p of state.particles) {
    p.life -= dt;
    p.mesh.position.addScaledVector(p.velocity, dt);
    p.velocity.y -= 9.8 * dt * 0.6;
    p.velocity.multiplyScalar(0.96);
    const t = Math.max(0, p.life / p.maxLife);
    p.mesh.scale.setScalar(0.6 + (1 - t) * 0.6);
    if (p.mesh.material.transparent) p.mesh.material.opacity = t * 0.35;
    else p.mesh.material.opacity = t;
  }
  state.particles = state.particles.filter(p => {
    if (p.life <= 0) { state.scene.remove(p.mesh); return false; }
    return true;
  });
}

function spawnFloatingText(text, position, color = '#ffe14f') {
  const el = document.createElement('div');
  el.className = 'floating-text';
  el.textContent = text;
  el.style.color = color;
  document.body.appendChild(el);
  state.floatingTexts.push({ el, position: position.clone(), life: 1.1, maxLife: 1.1 });
}

function updateFloatingTexts(dt) {
  for (const t of state.floatingTexts) {
    t.life -= dt;
    t.position.y += dt * 2.2;
    const v = t.position.clone().project(state.camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    t.el.style.left = x + 'px';
    t.el.style.top = y + 'px';
    t.el.style.opacity = Math.max(0, t.life / t.maxLife);
    t.el.style.transform = `translate(-50%, -50%) scale(${1 + (1 - t.life / t.maxLife) * 0.4})`;
  }
  state.floatingTexts = state.floatingTexts.filter(t => {
    if (t.life <= 0) { t.el.remove(); return false; }
    return true;
  });
}

// ---------- camera ----------
function updateCamera(dt, player) {
  if (!player) return;
  const targetPos = new THREE.Vector3(player.position.x, 0, player.position.z);
  // camera yaw follows player movement? Use player angle for yaw offset.
  const desiredYaw = player.angle;
  // smooth
  let diff = desiredYaw - cameraYaw;
  while (diff > Math.PI) diff -= TAU;
  while (diff < -Math.PI) diff += TAU;
  cameraYaw += diff * Math.min(1, dt * 3.5);

  const distance = cameraDistance;
  const height = 9;
  const camX = player.position.x - Math.sin(cameraYaw) * distance;
  const camZ = player.position.z - Math.cos(cameraYaw) * distance;
  const camY = player.position.y + height;
  state.camera.position.x += (camX - state.camera.position.x) * Math.min(1, dt * 6);
  state.camera.position.y += (camY - state.camera.position.y) * Math.min(1, dt * 6);
  state.camera.position.z += (camZ - state.camera.position.z) * Math.min(1, dt * 6);
  state.camera.lookAt(player.position.x, player.position.y + 1.2, player.position.z);
}

// ---------- HUD ----------
function updateHud(force) {
  const player = state.player;
  if (!player) return;
  // timer
  const t = Math.ceil(state.timeLeft);
  const m = Math.floor(t / 60);
  const s = t % 60;
  const timerEl = $('timer');
  timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
  $('timer').parentElement.classList.toggle('is-low', t <= 20);

  // score
  const ps = $('playerScore');
  ps.querySelector('b').textContent = player.score;

  // health
  $('playerTag').textContent = player.name;
  $('healthValue').textContent = Math.ceil(player.health);
  const bar = $('healthBar');
  const segments = 10;
  const filled = Math.ceil((player.health / player.maxHealth) * segments);
  // rebuild i elements
  bar.innerHTML = '';
  for (let i = 0; i < segments; i++) {
    const seg = document.createElement('i');
    if (i >= filled) seg.classList.add('empty');
    bar.appendChild(seg);
  }
  bar.classList.toggle('is-low', player.health < 35);

  // powerups
  const pu = $('powerups');
  pu.innerHTML = '';
  const powerLabels = { rapid: ['RAPID', '#55e6ff'], triple: ['TRIPLE', '#a77bff'], shield: ['SHIELD', '#51e6a4'], speed: ['TURBO', '#ff8b3d'] };
  for (const [key, [label, color]] of Object.entries(powerLabels)) {
    if (player.powerups[key] > 0) {
      const chip = document.createElement('div');
      chip.className = 'power-chip';
      chip.style.setProperty('--power', color);
      const time = key === 'shield' ? '∞' : Math.ceil(player.powerups[key]);
      chip.innerHTML = `<i></i>${label}<span>${time}</span>`;
      pu.appendChild(chip);
    }
  }

  // boost meter
  const boost = $('boostMeter');
  if (player.boost < 0.98 || player.boosting) {
    boost.classList.add('is-active');
  } else {
    boost.classList.remove('is-active');
  }
  boost.style.setProperty('--boost', (player.boost * 100) + '%');

  // weapon name
  const wn = $('weaponName');
  if (player.powerups.triple > 0) wn.textContent = 'TRIPLE';
  else if (player.powerups.rapid > 0) wn.textContent = 'RAPID';
  else wn.textContent = 'BLASTER';

  // crosshair visibility
  const ch = $('crosshair');
  ch.classList.toggle('is-visible', state.mode === 'playing');

  // respawn
  const respawn = $('respawn');
  if (!player.alive) {
    respawn.classList.remove('is-hidden');
    $('respawnCount').textContent = Math.ceil(player.respawnTimer);
  } else {
    respawn.classList.add('is-hidden');
  }

  // damage flash handled in events
}

function updateLeaderboard() {
  const list = $('leaderboard');
  const sorted = [...state.karts].sort((a, b) => b.score - a.score);
  list.innerHTML = '';
  sorted.slice(0, 8).forEach((k, i) => {
    const li = document.createElement('li');
    li.style.setProperty('--kart', k.color);
    if (k === state.player) li.classList.add('is-you');
    li.innerHTML = `<span class="rank">${i + 1}</span><span class="dot"></span><span class="name">${k.name}</span><span class="score">${k.score}</span>`;
    list.appendChild(li);
  });
}

function updateMinimap() {
  const canvas = $('minimap');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(18,15,42,0.7)';
  ctx.fillRect(0, 0, w, h);

  // arena circle
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 6, 0, TAU);
  ctx.stroke();

  const scale = (w / 2 - 8) / 40;
  function toCanvas(x, z) {
    return { x: w / 2 + x * scale, y: h / 2 + z * scale };
  }

  // obstacles
  ctx.fillStyle = 'rgba(255,120,94,0.5)';
  for (const o of state.world.obstacles) {
    if (o.kind === 'circle') {
      const c = toCanvas(o.x, o.z);
      ctx.beginPath();
      ctx.arc(c.x, c.y, o.r * scale, 0, TAU);
      ctx.fill();
    } else {
      const c = toCanvas(o.x, o.z);
      ctx.fillRect(c.x - o.w * scale / 2, c.y - o.d * scale / 2, o.w * scale, o.d * scale);
    }
  }

  // pickups
  ctx.fillStyle = '#ffe14f';
  for (const p of state.pickups) {
    if (!p.active) continue;
    const c = toCanvas(p.position.x, p.position.z);
    ctx.beginPath();
    ctx.arc(c.x, c.y, 2.5, 0, TAU);
    ctx.fill();
  }

  // karts
  for (const k of state.karts) {
    if (!k.alive) continue;
    const c = toCanvas(k.position.x, k.position.z);
    ctx.fillStyle = k.color;
    ctx.beginPath();
    ctx.arc(c.x, c.y, k === state.player ? 5 : 3.5, 0, TAU);
    ctx.fill();
    if (k === state.player) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // direction
    ctx.strokeStyle = k.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + Math.sin(k.angle) * 8, c.y + Math.cos(k.angle) * 8);
    ctx.stroke();
  }
}

// ---------- game events ----------
state.onShoot = function (kart) {
  state.sound.shoot(0, kart.powerups.rapid > 0 || kart.powerups.triple > 0);
  // muzzle flash particle
};
state.onHit = function (kart, attacker) {
  state.sound.hit();
  spawnFloatingText('-' + 22, kart.position, '#ff6b6b');
  const ch = $('crosshair');
  if (attacker === state.player) {
    ch.classList.remove('is-hit');
    void ch.offsetWidth;
    ch.classList.add('is-hit');
  }
  if (kart === state.player) {
    const flash = $('damageFlash');
    flash.style.opacity = '1';
    setTimeout(() => { flash.style.opacity = '0'; }, 180);
  }
};
state.onSmash = function (attacker, victim) {
  state.sound.smash();
  spawnExplosion(victim.position, victim.color, 30);
  spawnFloatingText('SMASH!', victim.position, '#ffe14f');
  // smash text big
  triggerSmashText(attacker === state.player ? 'SMASH!' : attacker.name);
  // killfeed
  addKillfeed(attacker, victim);
  // camera shake? no
  if (attacker === state.player) {
    const flash = $('damageFlash');
    // not damage; use boost flash
  }
};
state.onDeath = function (victim, attacker) {
  state.sound.smash();
};
state.onRespawn = function (kart) {
  if (kart === state.player) {
    state.sound.ui();
  }
};
state.onPickup = function (kart, type) {
  state.sound.pickup(type);
  spawnFloatingText(type.toUpperCase(), kart.position, '#51e6a4');
};
state.onShieldBlock = function (kart) {
  state.sound.hit();
  spawnFloatingText('BLOCKED', kart.position, '#55e6ff');
  spawnExplosion(kart.position, '#55e6ff', 12);
};
state.onBoostPad = function (kart) {
  state.sound.boost();
  if (kart === state.player) {
    const bf = $('boostFlash');
    bf.style.opacity = '0.6';
    setTimeout(() => { bf.style.opacity = '0'; }, 200);
  }
};
state.onProjectileHit = function (projectile, kart, type) {
  if (type === 'kart' && kart) {
    kart.takeDamage(projectile.damage, projectile.owner, state);
    spawnExplosion(projectile.position, kart.color, 8);
  } else {
    spawnExplosion(projectile.position, '#ffe14f', 6);
  }
};
state.spawnProjectile = function (origin, dir, owner, rapid) {
  const proj = new Projectile({ origin, dir, owner, rapid });
  state.projectiles.push(proj);
  state.scene.add(proj.mesh);
};

function addKillfeed(attacker, victim) {
  const feed = $('killfeed');
  const item = document.createElement('div');
  item.className = 'kill-item' + (attacker === state.player || victim === state.player ? ' is-you' : '');
  item.style.setProperty('--kart', attacker.color);
  item.innerHTML = `<span class="kill-icon"><svg viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg></span><b>${attacker.name}</b> smashed <b style="--kart:${victim.color}">${victim.name}</b>`;
  // fix second color
  const bs = item.querySelectorAll('b');
  if (bs[1]) bs[1].style.color = victim.color;
  feed.prepend(item);
  setTimeout(() => {
    item.classList.add('is-out');
    setTimeout(() => item.remove(), 300);
  }, 4500);
  // limit
  while (feed.children.length > 5) feed.lastChild.remove();
}

function triggerSmashText(text) {
  const el = $('smashText');
  el.textContent = text;
  el.classList.remove('is-on');
  void el.offsetWidth;
  el.classList.add('is-on');
  setTimeout(() => el.classList.remove('is-on'), 850);
}

// ---------- animate ----------
function animate() {
  state.raf = requestAnimationFrame(animate);
  const delta = Math.min(0.05, state.clock.getDelta());
  if (state.mode === 'menu') {
    state.world?.update(delta);
    render();
    return;
  }
  update(delta);
  render();
}

function render() {
  state.renderer.render(state.scene, state.camera);
}

// ---------- floating text css injection ----------
const style = document.createElement('style');
style.textContent = `
.floating-text {
  position: fixed;
  pointer-events: none;
  font-family: "Bungee", Impact, sans-serif;
  font-size: 22px;
  text-shadow: 2px 2px 0 rgba(0,0,0,0.5);
  z-index: 15;
  white-space: nowrap;
}
`;
document.head.appendChild(style);

// ---------- start ----------
window.addEventListener('DOMContentLoaded', init);
window.addEventListener('load', () => { if (!state.renderer) init(); });

// Expose for debugging
window.state = state;
