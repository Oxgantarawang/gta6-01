// Solmara: a sun-soaked coastal grid city, built procedurally from one seed. Roads run
// north-south and east-west on a fixed pitch; blocks hold varied buildings with lit-window
// canvas textures; the south edge is sand, sea and a pier; the east edge is the container
// docks. Everything static is built once here; the returned object is what the simulation
// needs (building footprints for collision, road lines for traffic, named places for missions).
import { CITY, PALETTE } from './config.js';
import { createRandom } from './rng.js';

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

function buildingTexture(rng, base) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, w, 10);
    const cols = 5, rows = 12;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const lit = rng.chance(0.28);
        g.fillStyle = lit ? '#ffd98a' : '#22384f';
        g.fillRect(10 + x * 23, 20 + y * 19, 14, 11);
      }
    }
  });
}

function roadTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#3a3f46'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c8ccd2';
    g.fillRect(4, 0, 2, h); g.fillRect(w - 6, 0, 2, h);
    g.fillStyle = '#e8d44f';
    for (let y = 0; y < h; y += 32) g.fillRect(w / 2 - 2, y + 4, 4, 18);
  });
}

function signTexture(text, bg, fg) {
  return canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = 'bold 64px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

export function createCity(scene, seed) {
  const rng = createRandom(seed);
  const colliders = [];   // {minX, maxX, minZ, maxZ} building footprints
  const palms = [];
  const lamps = [];

  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 180, 520);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.15);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -240; sun.shadow.camera.right = 240;
  sun.shadow.camera.top = 240; sun.shadow.camera.bottom = -240;
  sun.shadow.camera.far = 520;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x6f9e52 });
  const sandMat = new THREE.MeshLambertMaterial({ color: PALETTE.sand });
  const seaMat = new THREE.MeshLambertMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.92 });
  const asphaltMat = new THREE.MeshLambertMaterial({ map: roadTexture() });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });

  function addBox(mat, x, y, z, sx, sy, sz, shadow = true) {
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  // Ground, sand, sea.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY.extent * 2 + 120, CITY.extent * 2 + 120), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 20);
  ground.receiveShadow = true; scene.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(CITY.extent * 2 + 120, 90), sandMat);
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.05, CITY.beachZ + 42);
  sand.receiveShadow = true; scene.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(CITY.extent * 2 + 260, 220), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.12, CITY.waterZ + 105);
  scene.add(sea);

  // Roads: asphalt strips both ways, with sidewalks beside them.
  const roadLen = CITY.extent * 2;
  for (const c of CITY.roads) {
    const x = c * CITY.pitch;
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadHalf * 2, roadLen), asphaltMat);
    ns.rotation.x = -Math.PI / 2; ns.position.set(x, 0.03, 0);
    ns.material.map.repeat.set(1, 14);
    ns.receiveShadow = true; scene.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, CITY.roadHalf * 2), asphaltMat);
    ew.rotation.x = -Math.PI / 2; ew.rotation.z = Math.PI / 2; ew.position.set(0, 0.03, x);
    ew.receiveShadow = true; scene.add(ew);
    for (const side of [-1, 1]) {
      const sw1 = new THREE.Mesh(new THREE.PlaneGeometry(4, roadLen), walkMat);
      sw1.rotation.x = -Math.PI / 2; sw1.position.set(x + side * (CITY.roadHalf + 2.5), 0.06, 0);
      sw1.receiveShadow = true; scene.add(sw1);
      const sw2 = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, 4), walkMat);
      sw2.rotation.x = -Math.PI / 2; sw2.position.set(0, 0.06, x + side * (CITY.roadHalf + 2.5));
      sw2.receiveShadow = true; scene.add(sw2);
    }
  }

  // Buildings, one block at a time. Blocks sit BETWEEN the roads, so their centres are
  // half a pitch off the road grid; a building never touches asphalt or sidewalk.
  const buildingMats = PALETTE.building.map((c) => {
    const tex = buildingTexture(createRandom(seed + c), `#${c.toString(16).padStart(6, '0')}`);
    return new THREE.MeshLambertMaterial({ map: tex });
  });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4a52 });
  const glassMat = new THREE.MeshLambertMaterial({ color: PALETTE.glass });

  for (let bx = -2; bx <= 1; bx += 1) {
    for (let bz = -2; bz <= 1; bz += 1) {
      if (bx === -2 && bz === -2) continue; // Solano Motors garage
      if (bx === 1 && bz === 1) continue;   // the safehouse
      const cx = (bx + 0.5) * CITY.pitch, cz = (bz + 0.5) * CITY.pitch;
      const count = rng.int(1, 3);
      for (let i = 0; i < count; i += 1) {
        const w = rng.range(14, 26), d = rng.range(14, 26);
        const h = rng.pick([8, 10, 12, 16, 20, 26, 34, 44]);
        const span = 27 - w / 2 - 1;
        const ox = cx + rng.range(-span, span);
        const oz = cz + rng.range(-span, span);
        const mat = buildingMats[rng.int(0, buildingMats.length - 1)];
        addBox(mat, ox, h / 2, oz, w, h, d);
        addBox(roofMat, ox, h + 0.4, oz, w * 0.9, 0.8, d * 0.9);
        if (rng.chance(0.5)) addBox(glassMat, ox + w * 0.2, h + 1.1, oz, 3, 1.4, 3);
        colliders.push({ minX: ox - w / 2, maxX: ox + w / 2, minZ: oz - d / 2, maxZ: oz + d / 2 });
      }
    }
  }

  // Central plaza: fountain, benches, palms.
  const fountainMat = new THREE.MeshLambertMaterial({ color: 0x8a8f96 });
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.8, 0.9, 24), fountainMat);
  fountain.position.set(0, 0.45, 0); fountain.castShadow = true; fountain.receiveShadow = true; scene.add(fountain);
  const fountainWater = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.3, 24), seaMat);
  fountainWater.position.set(0, 0.85, 0); scene.add(fountainWater);
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    addBox(benchMat, Math.cos(a) * 11, 0.5, Math.sin(a) * 11, 3, 0.5, 1.2);
  }

  // Named places.
  const locations = {
    garage: { x: -117, z: -117, label: 'Solano Motors' },
    safehouse: { x: 117, z: 117, label: 'Safehouse' },
    docks: { x: 218, z: 0, label: 'Solmara Docks' },
    marina: { x: -140, z: 215, label: 'Marina' },
    plaza: { x: 0, z: 0, label: 'Plaza del Sol' },
    beach: { x: 40, z: 214, label: 'Solmara Beach' },
    market: { x: 78, z: -78, label: 'Mercado' },
    hotel: { x: -156, z: 78, label: 'Hotel Miramar' },
  };

  // Garage: low wide building with a big sign facing the road east of it.
  const garageMat = new THREE.MeshLambertMaterial({ color: 0xc96a3b });
  addBox(garageMat, locations.garage.x, 3, locations.garage.z, 18, 6, 26);
  const garageSign = new THREE.Mesh(new THREE.PlaneGeometry(22, 5.5),
    new THREE.MeshBasicMaterial({ map: signTexture('SOLANO MOTORS', '#1c2b3a', '#ffd23e') }));
  garageSign.position.set(locations.garage.x + 9.2, 5.2, locations.garage.z);
  garageSign.rotation.y = Math.PI / 2; scene.add(garageSign);
  colliders.push({ minX: locations.garage.x - 9, maxX: locations.garage.x + 9, minZ: locations.garage.z - 13, maxZ: locations.garage.z + 13 });

  // Safehouse: small house with a warm roof.
  const houseMat = new THREE.MeshLambertMaterial({ color: 0xe8dcc0 });
  const roofRed = new THREE.MeshLambertMaterial({ color: 0xa34a3a });
  addBox(houseMat, locations.safehouse.x, 2.5, locations.safehouse.z, 12, 5, 10);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(9, 3.5, 4), roofRed);
  roof.position.set(locations.safehouse.x, 6.6, locations.safehouse.z);
  roof.rotation.y = Math.PI / 4; roof.castShadow = true; scene.add(roof);
  colliders.push({ minX: locations.safehouse.x - 6, maxX: locations.safehouse.x + 6, minZ: locations.safehouse.z - 5, maxZ: locations.safehouse.z + 5 });

  // Docks: warehouse + stacked containers on the east edge.
  const wareMat = new THREE.MeshLambertMaterial({ color: 0x5a6b7a });
  addBox(wareMat, 214, 7, -40, 24, 14, 30);
  colliders.push({ minX: 202, maxX: 226, minZ: -55, maxZ: -25 });
  const containerCols = [0xc94f3d, 0x3d7ac9, 0x4fae5a, 0xd8a13c, 0x8a5fc9];
  for (let i = 0; i < 14; i += 1) {
    const cx = 206 + rng.range(0, 26), cz = -10 + rng.range(0, 60);
    if (Math.hypot(cx - 218, cz - 10) < 13) continue; // keep the fight yard open
    const stack = rng.int(1, 3);
    const col = containerCols[i % containerCols.length];
    for (let s = 0; s < stack; s += 1) {
      addBox(new THREE.MeshLambertMaterial({ color: col }), cx, 1.3 + s * 2.6, cz, 7, 2.6, 2.6);
    }
    colliders.push({ minX: cx - 3.5, maxX: cx + 3.5, minZ: cz - 1.3, maxZ: cz + 1.3 });
  }

  // Marina: pier into the sea, two yachts, beach umbrellas.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a5c38 });
  addBox(pierMat, locations.marina.x, 0.7, 216, 4, 1.2, 26);
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xf2f2ee });
  for (const [hx, hz, s] of [[-152, 228, 1], [-128, 232, 1.2]]) {
    addBox(hullMat, hx, 1.2, hz, 4, 2, 10 * s);
    addBox(new THREE.MeshLambertMaterial({ color: 0x2b3f55 }), hx, 2.8, hz, 3, 1.6, 5 * s);
  }
  const umbrellaMat = new THREE.MeshLambertMaterial({ color: 0xe85d75 });
  for (let i = 0; i < 6; i += 1) {
    const ux = 10 + i * 16 + rng.range(-3, 3);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), pierMat);
    pole.position.set(ux, 1.2, 208 + rng.range(-2, 4)); scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1, 8), umbrellaMat);
    top.position.set(ux, 2.6, pole.position.z); scene.add(top);
  }

  // Billboards with the city's own names.
  const billboards = [
    { x: -89, z: -10, text: 'SOLMARA', bg: '#123a5c', fg: '#ffd23e', ry: Math.PI / 2 },
    { x: 89, z: 66, text: 'VISIT SOLMARA BAY', bg: '#0f5c46', fg: '#ffffff', ry: -Math.PI / 2 },
    { x: -10, z: 167, text: 'HOTEL MIRAMAR', bg: '#7a2e4d', fg: '#ffe9a8', ry: Math.PI },
  ];
  for (const b of billboards) {
    addBox(roofMat, b.x, 9, b.z, 1, 18, 1);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(20, 5),
      new THREE.MeshBasicMaterial({ map: signTexture(b.text, b.bg, b.fg) }));
    sign.position.set(b.x, 17, b.z); sign.rotation.y = b.ry; scene.add(sign);
  }

  // Palms along the beach and plaza, lamps along every road.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5c38 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f3a });
  function palm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 5, 6), trunkMat);
    trunk.position.set(x, 2.5, z); trunk.castShadow = true; scene.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.2, 7), leafMat);
    crown.position.set(x, 5.8, z); crown.castShadow = true; scene.add(crown);
    palms.push({ x, z });
  }
  for (let i = 0; i < 14; i += 1) palm(-190 + i * 29 + rng.range(-4, 4), CITY.beachZ + 8 + rng.range(0, 10));
  for (let i = 0; i < 6; i += 1) palm(Math.cos(i * 1.05) * 16, Math.sin(i * 1.05) * 16);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2f3338 });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const c of CITY.roads) {
    for (const d of [-150, -70, 10, 90, 170]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), lampMat);
      pole.position.set(c * CITY.pitch + 10, 3, d); scene.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampHeadMat);
      head.position.set(c * CITY.pitch + 10, 6.1, d); scene.add(head);
      lamps.push({ x: c * CITY.pitch + 10, z: d });
    }
  }

  // A few parked benches and hydrants as small props.
  const hydrantMat = new THREE.MeshLambertMaterial({ color: 0xc93a3a });
  for (let i = 0; i < 10; i += 1) {
    const hx = rng.pick(CITY.roads) * CITY.pitch + rng.pick([-11, 11]);
    const hz = rng.range(-170, 170);
    const hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.8, 8), hydrantMat);
    hyd.position.set(hx, 0.4, hz); hyd.castShadow = true; scene.add(hyd);
  }

  function isBlocked(x, z, r) {
    if (z > CITY.waterZ - 1 || z < -CITY.extent || x < -CITY.extent || x > 246) return true;
    for (const c of colliders) {
      if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
    }
    return false;
  }

  /** Push a circle out of every building it overlaps; returns true when a hit happened. */
  function resolveCollision(pos, r) {
    let hit = false;
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * r;
          pos.z = cz + (dz / d) * r;
        } else {
          pos.x = c.maxX + r;
        }
      }
    }
    return hit;
  }

  function randomRoadPoint() {
    const vertical = rng.chance(0.5);
    const road = rng.pick(CITY.roads) * CITY.pitch;
    const along = rng.range(-170, 170);
    return vertical ? { x: road + rng.pick([-3.5, 3.5]), z: along } : { x: along, z: road + rng.pick([-3.5, 3.5]) };
  }

  function randomSidewalkPoint() {
    const vertical = rng.chance(0.5);
    const road = rng.pick(CITY.roads) * CITY.pitch;
    const along = rng.range(-170, 170);
    const side = rng.pick([-10.5, 10.5]);
    return vertical ? { x: road + side, z: along } : { x: along, z: road + side };
  }

  return { colliders, locations, palms, lamps, isBlocked, resolveCollision, randomRoadPoint, randomSidewalkPoint };
}
