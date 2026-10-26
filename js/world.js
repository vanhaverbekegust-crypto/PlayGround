import * as THREE from '../vendor/three.module.min.js';

const TAU = Math.PI * 2;

function standard(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.72,
    metalness: options.metalness ?? 0.04,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 1,
    flatShading: options.flatShading ?? false,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1
  });
}

function mesh(geometry, material, castShadow = true, receiveShadow = true) {
  const value = new THREE.Mesh(geometry, material);
  value.castShadow = castShadow;
  value.receiveShadow = receiveShadow;
  return value;
}

function createGroundTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#39c7cf');
  gradient.addColorStop(0.5, '#54d4d5');
  gradient.addColorStop(1, '#2db6c9');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#0b5f7a';
  for (let y = 0; y < size; y += 128) {
    for (let x = 0; x < size; x += 128) {
      if ((x / 128 + y / 128) % 2 === 0) ctx.fillRect(x, y, 128, 128);
    }
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(255,255,255,.11)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= size; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#ffe14f';
  ctx.fillRect(0, 0, size, 28);
  ctx.fillRect(0, size - 28, size, 28);
  ctx.fillRect(0, 0, 28, size);
  ctx.fillRect(size - 28, 0, 28, size);
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(512, 512);
  ctx.strokeStyle = 'rgba(255,249,236,.65)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(0, 0, 284, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,225,79,.52)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 248, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,77,125,.4)';
  ctx.lineWidth = 28;
  ctx.setLineDash([64, 44]);
  ctx.beginPath();
  ctx.arc(0, 0, 204, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = 'rgba(255,249,236,.13)';
  for (let i = -4; i <= 4; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(-30, 320);
    ctx.lineTo(0, 392);
    ctx.lineTo(30, 320);
    ctx.lineTo(10, 320);
    ctx.lineTo(10, 275);
    ctx.lineTo(-10, 275);
    ctx.lineTo(-10, 320);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(512, 512);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = 'rgba(22,19,49,.10)';
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI / 3);
    ctx.fillRect(180, -16, 90, 32);
    ctx.restore();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.35;
  const splats = [
    [154, 226, 58, '#ffe14f'],
    [864, 176, 39, '#ff4d7d'],
    [818, 790, 74, '#a77bff'],
    [198, 824, 46, '#51e6a4'],
    [688, 138, 27, '#ff8b3d']
  ];
  for (const [x, y, r, color] of splats) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      const angle = i / 5 * TAU;
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * r * 1.8, y + Math.sin(angle) * r * 1.8, r * 0.17, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#0a3551';
    const r = Math.random() * 2.1 + 0.4;
    ctx.fillRect(Math.random() * size, Math.random() * size, r, r);
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createPadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 192, 256);
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const y = 58 + i * 55;
    ctx.strokeStyle = i === 2 ? 'rgba(255,255,255,.98)' : 'rgba(93,231,255,.9)';
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(40, y + 28);
    ctx.lineTo(96, y - 16);
    ctx.lineTo(152, y + 28);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(93,231,255,.32)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 172, 236);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createNameSpriteTexture() {
  return null;
}

function addSky(scene) {
  const skyGeometry = new THREE.SphereGeometry(280, 32, 20);
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color('#4fc4ff') },
      midColor: { value: new THREE.Color('#a8edff') },
      bottomColor: { value: new THREE.Color('#fff5c9') }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      void main() {
        float h = normalize(vWorldPosition).y;
        vec3 color = mix(bottomColor, midColor, smoothstep(-0.02, 0.3, h));
        color = mix(color, topColor, smoothstep(0.24, 0.82, h));
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  scene.add(new THREE.Mesh(skyGeometry, skyMaterial));

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(11, 20, 14),
    new THREE.MeshBasicMaterial({ color: '#fff7ce' })
  );
  sun.position.set(94, 92, -160);
  scene.add(sun);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(19, 20, 14),
    new THREE.MeshBasicMaterial({ color: '#fff2ad', transparent: true, opacity: 0.14, depthWrite: false })
  );
  halo.position.copy(sun.position);
  scene.add(halo);

  const cloudMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.82 });
  const cloudGeometry = new THREE.SphereGeometry(1, 10, 8);
  const clouds = new THREE.Group();
  const cloudData = [
    [-80, 58, -130, 1.1],
    [30, 66, -155, 1.5],
    [140, 52, -90, .9],
    [-150, 48, -50, 1.2],
    [115, 44, 70, 1.15],
    [-58, 52, 132, 1.0]
  ];
  for (const [x, y, z, scale] of cloudData) {
    const cloud = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const puff = new THREE.Mesh(cloudGeometry, cloudMaterial);
      puff.position.set((i - 2) * 5.2 + Math.random() * 2, Math.random() * 2, Math.random() * 4);
      puff.scale.set(5.5 + Math.random() * 2.5, 3.5 + Math.random() * 1.5, 4.5);
      cloud.add(puff);
    }
    cloud.position.set(x, y, z);
    cloud.scale.setScalar(scale);
    clouds.add(cloud);
  }
  scene.add(clouds);

  return clouds;
}

function buildOuterGround(group) {
  const outer = mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: '#8fe3a5', roughness: 1 }),
    false,
    true
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.06;
  group.add(outer);

  const path = mesh(
    new THREE.RingGeometry(44, 68, 64),
    new THREE.MeshStandardMaterial({ color: '#f1dfb3', roughness: 0.95 }),
    false,
    true
  );
  path.rotation.x = -Math.PI / 2;
  path.position.y = -0.04;
  group.add(path);

  const rim = mesh(
    new THREE.RingGeometry(42.5, 44.2, 64),
    new THREE.MeshBasicMaterial({ color: '#fff2ad' }),
    false,
    false
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = -0.02;
  group.add(rim);
}

function buildFloor(group) {
  const texture = createGroundTexture();
  const floor = mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.82, metalness: 0.02 }),
    false,
    true
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  group.add(floor);

  const underlay = mesh(
    new THREE.BoxGeometry(80.6, 0.32, 80.6),
    new THREE.MeshStandardMaterial({ color: '#176a7a', roughness: 0.9 }),
    false,
    true
  );
  underlay.position.y = -0.18;
  group.add(underlay);

  for (const side of [-1, 1]) {
    const stripe = mesh(
      new THREE.PlaneGeometry(80, 1.1),
      new THREE.MeshBasicMaterial({ color: side > 0 ? '#ffe14f' : '#ff4d7d' }),
      false,
      false
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(0, 0.022, side * 37.8);
    group.add(stripe);
  }
  return texture;
}

function addPanelDetails(group, wall) {
  const colors = ['#ffe14f', '#ff4d7d', '#51e6a4', '#a77bff', '#ff8b3d', '#55e6ff'];
  const horizontal = wall.userData.horizontal;
  const side = wall.userData.side;
  for (let i = -4; i <= 4; i++) {
    const panel = mesh(
      new THREE.BoxGeometry(horizontal ? 6.2 : 0.08, 1.05, horizontal ? 0.08 : 6.2),
      new THREE.MeshBasicMaterial({ color: colors[(i + 9) % colors.length] }),
      false,
      false
    );
    if (horizontal) {
      panel.position.set(i * 8, 1.15, side * 38.92);
    } else {
      panel.position.set(side * 38.92, 1.15, i * 8);
    }
    group.add(panel);
  }
}

function buildWalls(group) {
  const wallColor = '#ff775e';
  const wallTop = '#fff2c7';
  const sides = [
    { x: 0, z: -40, w: 80, d: 2, horizontal: true, side: 1 },
    { x: 0, z: 40, w: 80, d: 2, horizontal: true, side: -1 },
    { x: -40, z: 0, w: 2, d: 80, horizontal: false, side: 1 },
    { x: 40, z: 0, w: 2, d: 80, horizontal: false, side: -1 }
  ];
  for (const data of sides) {
    const wall = mesh(
      new THREE.BoxGeometry(data.w, 2.8, data.d),
      new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.7 }),
      true,
      true
    );
    wall.position.set(data.x, 1.4, data.z);
    wall.userData = data;
    group.add(wall);
    addPanelDetails(group, wall);

    const cap = mesh(
      new THREE.BoxGeometry(data.w + 0.02, 0.2, data.d + 0.02),
      new THREE.MeshStandardMaterial({ color: wallTop, roughness: 0.55, emissive: '#5b3f00', emissiveIntensity: 0.12 }),
      false,
      false
    );
    cap.position.set(data.x, 2.86, data.z);
    group.add(cap);

    const glow = mesh(
      new THREE.BoxGeometry(data.horizontal ? data.w : 0.1, 0.08, data.horizontal ? 0.1 : data.d),
      new THREE.MeshBasicMaterial({ color: '#5ce8ff' }),
      false,
      false
    );
    glow.position.set(
      data.horizontal ? data.x : data.x + data.side * 0.99,
      data.horizontal ? 2.2 : 2.2,
      data.horizontal ? data.z + data.side * 0.99 : data.z
    );
    group.add(glow);
  }
}

function addBoxObstacle(group, obstacles, options) {
  const { x, z, w, d, h = 2.2, color = '#ff4d7d', accent = '#fff2c7', kind = 'barrier', rotation = 0 } = options;
  const wrapper = new THREE.Group();
  wrapper.position.set(x, 0, z);
  wrapper.rotation.y = rotation;

  const body = mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.68, metalness: 0.03 }),
    true,
    true
  );
  body.position.y = h / 2;
  wrapper.add(body);

  const cap = mesh(
    new THREE.BoxGeometry(w + 0.12, 0.16, d + 0.12),
    new THREE.MeshStandardMaterial({ color: accent, roughness: 0.55 }),
    false,
    false
  );
  cap.position.y = h + 0.06;
  wrapper.add(cap);

  const sideStripeMaterial = new THREE.MeshBasicMaterial({ color: accent });
  if (w > d) {
    const stripe = mesh(new THREE.BoxGeometry(w * 0.72, 0.12, 0.04), sideStripeMaterial, false, false);
    stripe.position.set(0, h * 0.58, d / 2 + 0.025);
    wrapper.add(stripe);
    const stripeBack = stripe.clone();
    stripeBack.position.z = -d / 2 - 0.025;
    wrapper.add(stripeBack);
  } else {
    const stripe = mesh(new THREE.BoxGeometry(0.04, 0.12, d * 0.72), sideStripeMaterial, false, false);
    stripe.position.set(w / 2 + 0.025, h * 0.58, 0);
    wrapper.add(stripe);
    const stripeBack = stripe.clone();
    stripeBack.position.x = -w / 2 - 0.025;
    wrapper.add(stripeBack);
  }

  if (kind === 'crate') {
    const bandMaterial = new THREE.MeshStandardMaterial({ color: '#fff2c7', roughness: 0.65 });
    for (const offset of [-w * 0.24, w * 0.24]) {
      const band = mesh(new THREE.BoxGeometry(0.18, h * 0.96, d + 0.05), bandMaterial, false, false);
      band.position.set(offset, h / 2, 0);
      wrapper.add(band);
    }
    const lid = mesh(new THREE.BoxGeometry(w * 1.02, 0.15, d * 1.02), new THREE.MeshStandardMaterial({ color, roughness: 0.65 }), false, false);
    lid.position.y = h + 0.01;
    wrapper.add(lid);
  }

  group.add(wrapper);
  obstacles.push({ kind: 'box', x, z, w, d, h, mesh: wrapper, rotation: 0, color });
}

function addCircleObstacle(group, obstacles, options) {
  const { x, z, r, h = 2.2, color = '#a77bff', accent = '#5ce8ff' } = options;
  const wrapper = new THREE.Group();
  wrapper.position.set(x, 0, z);
  const body = mesh(
    new THREE.CylinderGeometry(r, r * 1.03, h, 24),
    new THREE.MeshStandardMaterial({ color, roughness: 0.62 }),
    true,
    true
  );
  body.position.y = h / 2;
  wrapper.add(body);
  const ring = mesh(
    new THREE.TorusGeometry(r + 0.06, 0.09, 8, 32),
    new THREE.MeshBasicMaterial({ color: accent }),
    false,
    false
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = h * 0.72;
  wrapper.add(ring);
  const cap = mesh(
    new THREE.CylinderGeometry(r * 1.04, r * 1.04, 0.16, 24),
    new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }),
    false,
    false
  );
  cap.position.y = h + 0.04;
  wrapper.add(cap);
  group.add(wrapper);
  obstacles.push({ kind: 'circle', x, z, r, h, mesh: wrapper, color });
}

function buildObstacles(group) {
  const obstacles = [];
  addCircleObstacle(group, obstacles, { x: 0, z: 0, r: 5.05, h: 3.5, color: '#4e438c', accent: '#ffe14f' });
  addBoxObstacle(group, obstacles, { x: -15, z: -11, w: 8, d: 2.2, color: '#ff5d8f', accent: '#ffe14f' });
  addBoxObstacle(group, obstacles, { x: 15, z: 11, w: 8, d: 2.2, color: '#ff5d8f', accent: '#ffe14f' });
  addBoxObstacle(group, obstacles, { x: -11, z: 15, w: 2.2, d: 8, color: '#4be5b1', accent: '#39b5ff' });
  addBoxObstacle(group, obstacles, { x: 11, z: -15, w: 2.2, d: 8, color: '#4be5b1', accent: '#39b5ff' });
  addBoxObstacle(group, obstacles, { x: -27, z: 0, w: 2.2, d: 9, color: '#ff9a45', accent: '#fff2c7' });
  addBoxObstacle(group, obstacles, { x: 27, z: 0, w: 2.2, d: 9, color: '#ff9a45', accent: '#fff2c7' });
  addBoxObstacle(group, obstacles, { x: 0, z: -28, w: 9, d: 2.2, color: '#9b78ff', accent: '#ffe14f' });
  addBoxObstacle(group, obstacles, { x: 0, z: 28, w: 9, d: 2.2, color: '#9b78ff', accent: '#ffe14f' });
  addBoxObstacle(group, obstacles, { x: -24, z: -23, w: 4.2, d: 4.2, h: 2.3, color: '#ff7f45', accent: '#ffe14f', kind: 'crate' });
  addBoxObstacle(group, obstacles, { x: 24, z: 23, w: 4.2, d: 4.2, h: 2.3, color: '#ff7f45', accent: '#ffe14f', kind: 'crate' });
  addBoxObstacle(group, obstacles, { x: -23, z: 23, w: 3.2, d: 3.2, h: 2.0, color: '#4fb7ff', accent: '#fff2c7', kind: 'crate' });
  addBoxObstacle(group, obstacles, { x: 23, z: -23, w: 3.2, d: 3.2, h: 2.0, color: '#4fb7ff', accent: '#fff2c7', kind: 'crate' });
  addBoxObstacle(group, obstacles, { x: -18, z: 4, w: 2.1, d: 2.1, h: 1.55, color: '#72df7b', accent: '#fff2c7', kind: 'crate' });
  addBoxObstacle(group, obstacles, { x: 18, z: -4, w: 2.1, d: 2.1, h: 1.55, color: '#72df7b', accent: '#fff2c7', kind: 'crate' });
  addBoxObstacle(group, obstacles, { x: 4, z: 18, w: 1.8, d: 1.8, h: 1.45, color: '#ffcf4d', accent: '#ff4d7d', kind: 'crate' });
  addBoxObstacle(group, obstacles, { x: -4, z: -18, w: 1.8, d: 1.8, h: 1.45, color: '#ffcf4d', accent: '#ff4d7d', kind: 'crate' });
  addCircleObstacle(group, obstacles, { x: -30, z: 22, r: 1.35, h: 2.6, color: '#ff6d9f', accent: '#fff2c7' });
  addCircleObstacle(group, obstacles, { x: 30, z: -22, r: 1.35, h: 2.6, color: '#ff6d9f', accent: '#fff2c7' });
  return obstacles;
}

function buildCenterpiece(group) {
  const spinner = new THREE.Group();
  spinner.position.y = 4.6;
  const starShape = new THREE.Shape();
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? 1.85 : 0.82;
    const angle = (i / (points * 2)) * TAU + Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  starShape.closePath();
  const starGeometry = new THREE.ExtrudeGeometry(starShape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelSize: 0.12,
    bevelThickness: 0.12,
    bevelSegments: 1
  });
  starGeometry.center();
  const star = mesh(
    starGeometry,
    new THREE.MeshStandardMaterial({ color: '#ffe14f', emissive: '#ffb31f', emissiveIntensity: 0.45, roughness: 0.35, metalness: 0.1 }),
    true,
    false
  );
  star.position.z = 0.1;
  spinner.add(star);
  const backStar = star.clone();
  backStar.rotation.y = Math.PI;
  backStar.position.z = -0.1;
  spinner.add(backStar);

  const halo = mesh(
    new THREE.TorusGeometry(2.65, 0.09, 8, 32),
    new THREE.MeshBasicMaterial({ color: '#5ce8ff' }),
    false,
    false
  );
  halo.rotation.x = Math.PI / 2;
  spinner.add(halo);

  const orb = mesh(
    new THREE.SphereGeometry(0.5, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#fff7ce' }),
    false,
    false
  );
  spinner.add(orb);

  group.add(spinner);

  const towerBase = mesh(
    new THREE.CylinderGeometry(5.18, 5.32, 0.8, 40),
    new THREE.MeshStandardMaterial({ color: '#2c255d', roughness: 0.55, metalness: 0.1 }),
    true,
    true
  );
  towerBase.position.y = 0.4;
  group.add(towerBase);

  const towerRing = mesh(
    new THREE.TorusGeometry(5.22, 0.13, 10, 48),
    new THREE.MeshBasicMaterial({ color: '#ffe14f' }),
    false,
    false
  );
  towerRing.rotation.x = Math.PI / 2;
  towerRing.position.y = 0.82;
  group.add(towerRing);

  const towerTop = mesh(
    new THREE.CylinderGeometry(1.25, 1.65, 1.4, 24),
    new THREE.MeshStandardMaterial({ color: '#ff5d8f', roughness: 0.6 }),
    true,
    true
  );
  towerTop.position.y = 3.7;
  group.add(towerTop);

  const towerCap = mesh(
    new THREE.CylinderGeometry(1.45, 1.25, 0.26, 24),
    new THREE.MeshStandardMaterial({ color: '#fff2c7', roughness: 0.5 }),
    false,
    false
  );
  towerCap.position.y = 4.53;
  group.add(towerCap);

  const light = new THREE.PointLight('#ffe14f', 18, 22, 2);
  light.position.y = 4.8;
  group.add(light);

  return spinner;
}

function buildBoostPads(group) {
  const texture = createPadTexture();
  const pads = [];
  const layouts = [
    { x: 0, z: -15.5, rotation: 0 },
    { x: 15.5, z: 0, rotation: Math.PI / 2 },
    { x: 0, z: 15.5, rotation: Math.PI },
    { x: -15.5, z: 0, rotation: -Math.PI / 2 }
  ];
  for (const layout of layouts) {
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const pad = mesh(new THREE.PlaneGeometry(4.2, 6.2), material, false, false);
    pad.rotation.x = -Math.PI / 2;
    pad.rotation.z = layout.rotation;
    pad.position.set(layout.x, 0.035, layout.z);
    group.add(pad);

    const base = mesh(
      new THREE.PlaneGeometry(4.8, 6.8),
      new THREE.MeshBasicMaterial({ color: '#173155', transparent: true, opacity: 0.22, depthWrite: false }),
      false,
      false
    );
    base.rotation.x = -Math.PI / 2;
    base.rotation.z = layout.rotation;
    base.position.set(layout.x, 0.028, layout.z);
    group.add(base);
    pads.push({ ...layout, mesh: pad, material, base, cooldown: 0 });
  }
  return pads;
}

function buildDecor(group) {
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#8b5a3f', roughness: 0.95 });
  const leafMaterials = [
    new THREE.MeshStandardMaterial({ color: '#48b86f', roughness: 0.92 }),
    new THREE.MeshStandardMaterial({ color: '#5acb79', roughness: 0.92 }),
    new THREE.MeshStandardMaterial({ color: '#39a362', roughness: 0.92 })
  ];
  const trees = new THREE.Group();
  const positions = [
    [-58, -56], [-66, -24], [-58, 24], [-62, 58],
    [58, 58], [66, 24], [58, -24], [62, -58],
    [-38, -65], [38, -66], [-70, 3], [70, -4]
  ];
  for (const [x, z] of positions) {
    const tree = new THREE.Group();
    const height = 3.4 + Math.random() * 3.8;
    const trunk = mesh(new THREE.CylinderGeometry(0.3, 0.45, height, 6), trunkMaterial, true, true);
    trunk.position.y = height / 2;
    tree.add(trunk);
    const leaf = leafMaterials[Math.floor(Math.random() * leafMaterials.length)];
    for (let i = 0; i < 3; i++) {
      const crown = mesh(new THREE.ConeGeometry(2.5 - i * 0.55, 3.2, 7), leaf, true, true);
      crown.position.y = height + i * 1.0;
      crown.rotation.y = Math.random() * TAU;
      tree.add(crown);
    }
    tree.position.set(x, 0, z);
    tree.rotation.y = Math.random() * TAU;
    trees.add(tree);
  }
  group.add(trees);

  const balloonColors = ['#ff4d7d', '#ffe14f', '#55e6ff', '#a77bff', '#51e6a4', '#ff8b3d'];
  const balloons = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const balloon = new THREE.Group();
    const sphere = mesh(
      new THREE.SphereGeometry(1.2, 12, 9),
      new THREE.MeshStandardMaterial({ color: balloonColors[i % balloonColors.length], roughness: 0.4 }),
      false,
      false
    );
    balloon.add(sphere);
    const string = mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 4.5, 4),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.38 }),
      false,
      false
    );
    string.position.y = -3.1;
    balloon.add(string);
    const angle = (i / 12) * TAU + Math.random() * 0.4;
    const radius = 47 + Math.random() * 19;
    balloon.position.set(Math.cos(angle) * radius, 11 + Math.random() * 12, Math.sin(angle) * radius);
    balloon.userData.baseY = balloon.position.y;
    balloon.userData.phase = Math.random() * TAU;
    balloons.add(balloon);
  }
  group.add(balloons);

  const stand = new THREE.Group();
  stand.position.set(0, 0, -50);
  const standMaterials = [
    new THREE.MeshStandardMaterial({ color: '#f1e5c5', roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: '#ffba76', roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: '#ff8e91', roughness: 0.9 })
  ];
  for (let row = 0; row < 4; row++) {
    const tier = mesh(new THREE.BoxGeometry(54 - row * 4, 1.1 + row * 0.9, 2.5), standMaterials[row % 3], true, true);
    tier.position.set(0, (1.1 + row * 0.9) / 2, row * 2.3);
    stand.add(tier);
  }
  const crowdGeometry = new THREE.SphereGeometry(0.24, 7, 5);
  const crowdMaterial = new THREE.MeshStandardMaterial({ roughness: 0.65 });
  const crowd = new THREE.InstancedMesh(crowdGeometry, crowdMaterial, 96);
  const dummy = new THREE.Object3D();
  const crowdColors = ['#ffe14f', '#ff4d7d', '#55e6ff', '#a77bff', '#51e6a4', '#ff8b3d', '#fff9ec'];
  for (let i = 0; i < 96; i++) {
    const row = i % 4;
    dummy.position.set((Math.floor(i / 4) - 12) * 2.05 + Math.random() * 0.6, 1.18 + row * 0.9, -1.3 + row * 2.3 + Math.random() * 0.35);
    dummy.scale.setScalar(0.8 + Math.random() * 0.5);
    dummy.updateMatrix();
    crowd.setMatrixAt(i, dummy.matrix);
    crowd.setColorAt(i, new THREE.Color(crowdColors[i % crowdColors.length]));
  }
  crowd.instanceMatrix.needsUpdate = true;
  if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
  stand.add(crowd);
  group.add(stand);

  const cornerTowers = [
    [-45, -45, '#ff4d7d'],
    [45, -45, '#55e6ff'],
    [-45, 45, '#ffe14f'],
    [45, 45, '#a77bff']
  ];
  for (const [x, z, color] of cornerTowers) {
    const pole = mesh(
      new THREE.CylinderGeometry(0.25, 0.38, 9.5, 8),
      new THREE.MeshStandardMaterial({ color: '#3d356e', roughness: 0.65 }),
      true,
      true
    );
    pole.position.set(x, 4.75, z);
    group.add(pole);
    const bulb = mesh(
      new THREE.SphereGeometry(0.8, 11, 8),
      new THREE.MeshBasicMaterial({ color }),
      false,
      false
    );
    bulb.position.set(x, 9.75, z);
    group.add(bulb);
    const glow = mesh(
      new THREE.SphereGeometry(1.4, 11, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, depthWrite: false }),
      false,
      false
    );
    glow.position.copy(bulb.position);
    group.add(glow);
  }
  return balloons;
}

function buildPickupSpots() {
  return [
    { x: -8, z: -30 },
    { x: 8, z: -30 },
    { x: -30, z: -8 },
    { x: 30, z: -8 },
    { x: -8, z: 30 },
    { x: 8, z: 30 },
    { x: -30, z: 8 },
    { x: 30, z: 8 }
  ];
}

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  scene.fog = new THREE.Fog('#b8f1ff', 92, 260);

  const hemisphere = new THREE.HemisphereLight('#dff8ff', '#557aa2', 1.65);
  scene.add(hemisphere);

  const sunLight = new THREE.DirectionalLight('#fff4dc', 2.5);
  sunLight.position.set(26, 48, 22);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -58;
  sunLight.shadow.camera.right = 58;
  sunLight.shadow.camera.top = 58;
  sunLight.shadow.camera.bottom = -58;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 130;
  sunLight.shadow.bias = -0.00025;
  sunLight.shadow.normalBias = 0.025;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const fill = new THREE.DirectionalLight('#84d6ff', 0.8);
  fill.position.set(-30, 18, -20);
  scene.add(fill);

  const clouds = addSky(scene);
  buildOuterGround(group);
  const groundTexture = buildFloor(group);
  buildWalls(group);
  const obstacles = buildObstacles(group);
  const centerpiece = buildCenterpiece(group);
  const boostPads = buildBoostPads(group);
  const balloons = buildDecor(group);
  const pickupSpots = buildPickupSpots();

  const time = { value: 0 };

  function update(dt) {
    time.value += dt;
    centerpiece.rotation.y = Math.sin(time.value * 0.55) * 0.18;
    centerpiece.rotation.z = time.value * 0.16;
    centerpiece.position.y = 4.6 + Math.sin(time.value * 1.5) * 0.16;
    clouds.rotation.y += dt * 0.003;
    for (const balloon of balloons.children) {
      balloon.position.y = balloon.userData.baseY + Math.sin(time.value * 0.8 + balloon.userData.phase) * 0.9;
      balloon.rotation.z = Math.sin(time.value * 0.4 + balloon.userData.phase) * 0.08;
    }
    for (const pad of boostPads) {
      pad.material.opacity = 0.68 + Math.sin(time.value * 4 + pad.x + pad.z) * 0.2;
      pad.mesh.scale.y = 1 + Math.sin(time.value * 4 + pad.x) * 0.035;
    }
  }

  function isBlocked(x, z, padding = 0.1) {
    for (const obstacle of obstacles) {
      if (obstacle.kind === 'circle') {
        const dx = x - obstacle.x;
        const dz = z - obstacle.z;
        if (dx * dx + dz * dz < (obstacle.r + padding) ** 2) return true;
      } else {
        if (Math.abs(x - obstacle.x) < obstacle.w / 2 + padding && Math.abs(z - obstacle.z) < obstacle.d / 2 + padding) return true;
      }
    }
    return Math.abs(x) > 38.4 - padding || Math.abs(z) > 38.4 - padding;
  }

  function segmentBlocked(ax, az, bx, bz, padding = 0.15) {
    const dx = bx - ax;
    const dz = bz - az;
    const lengthSq = dx * dx + dz * dz;
    if (lengthSq < 0.0001) return isBlocked(ax, az, padding);
    for (const obstacle of obstacles) {
      if (obstacle.kind === 'circle') {
        const t = Math.max(0, Math.min(1, ((obstacle.x - ax) * dx + (obstacle.z - az) * dz) / lengthSq));
        const px = ax + dx * t;
        const pz = az + dz * t;
        const distSq = (px - obstacle.x) ** 2 + (pz - obstacle.z) ** 2;
        if (distSq < (obstacle.r + padding) ** 2) return true;
      } else {
        const minX = obstacle.x - obstacle.w / 2 - padding;
        const maxX = obstacle.x + obstacle.w / 2 + padding;
        const minZ = obstacle.z - obstacle.d / 2 - padding;
        const maxZ = obstacle.z + obstacle.d / 2 + padding;
        let tMin = 0;
        let tMax = 1;
        let blocked = true;
        const tests = [
          [-dx, ax - minX],
          [dx, maxX - ax],
          [-dz, az - minZ],
          [dz, maxZ - az]
        ];
        for (const [p, q] of tests) {
          if (Math.abs(p) < 0.00001) {
            if (q < 0) { blocked = false; break; }
          } else {
            const r = q / p;
            if (p < 0) {
              if (r > tMax) { blocked = false; break; }
              if (r > tMin) tMin = r;
            } else {
              if (r < tMin) { blocked = false; break; }
              if (r < tMax) tMax = r;
            }
          }
        }
        if (blocked) return true;
      }
    }
    return false;
  }

  return {
    group,
    obstacles,
    boostPads,
    pickupSpots,
    bounds: 38.2,
    spawnPoints: [
      { x: -30, z: -30, angle: Math.PI * 0.25 },
      { x: 0, z: -33, angle: 0 },
      { x: 30, z: -30, angle: -Math.PI * 0.25 },
      { x: -33, z: 0, angle: Math.PI * 0.5 },
      { x: 33, z: 0, angle: -Math.PI * 0.5 },
      { x: -30, z: 30, angle: Math.PI * 0.75 },
      { x: 0, z: 33, angle: Math.PI },
      { x: 30, z: 30, angle: -Math.PI * 0.75 }
    ],
    groundTexture,
    update,
    isBlocked,
    segmentBlocked
  };
}
