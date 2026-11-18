// The game itself: one class owns the renderer, the city, the player, traffic, pedestrians,
// police, missions, combat and the save, and advances them all in fixed 1/60 s steps. The
// menu screens live in hud.js; main.js only feeds it input and asks it to paint.
import { STEP, SAVE_KEY, CITY, PLAYER, CAR_TYPES, WANTED, START_CASH } from './config.js';
import { createRandom, clamp, angleDelta, distance2D } from './rng.js';
import { createCity } from './city.js';
import { createCar, removeCar, updateTrafficCar, driveCar, updateCarSmoke, CAR_COLORS } from './vehicles.js';
import { buildPersonMesh, animateWalk, createPedestrian, updatePedestrian, createOfficer, updateOfficer, createEnemy, updateEnemy } from './people.js';
import { createMissionManager, MISSIONS, STORY_INTRO } from './missions.js';
import { createCombat } from './combat.js';
import { createHUD } from './hud.js';
import { createAudio } from './audio.js';
import { ACTION } from './input.js';

const TRAFFIC_COUNT = 14;
const PARKED_COUNT = 7;
const PED_COUNT = 16;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
    this.hud = createHUD();
    this.audio = createAudio();
    this.combat = createCombat(this.scene);
    this.missions = createMissionManager();
    this.rng = createRandom(1337);
    this.city = null;
    this.player = null;
    this.cars = [];
    this.peds = [];
    this.officers = [];
    this.enemies = [];
    this.policeCars = [];
    this.screen = 'title'; // title | play | paused | busted | wasted | story
    this.time = 0;
    this.cash = START_CASH;
    this.wanted = 0;
    this.wantedTimer = 0;
    this.lastDamageAt = -99;
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camDist = 8;
    this.camInit = false;
    this.markerMesh = null;
    this.markerBeam = null;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- setup ----------

  reset(seed) {
    for (const car of this.cars) removeCar(this.scene, car);
    for (const ped of this.peds) this.scene.remove(ped.mesh);
    for (const off of this.officers) this.scene.remove(off.mesh);
    for (const en of this.enemies) this.scene.remove(en.mesh);
    this.cars = []; this.peds = []; this.officers = []; this.enemies = []; this.policeCars = [];
    this.scene.clear();
    this.rng = createRandom(seed);
    this.city = createCity(this.scene, seed);
    this.time = 0;
    this.cash = START_CASH;
    this.wanted = 0;
    this.wantedTimer = 0;
    this.lastDamageAt = -99;
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camInit = false;
    this.missions = createMissionManager();
    this.player = {
      mesh: buildPersonMesh(0xe8a33d, 0xe8b98a, 0x2a3242),
      x: 12, z: 18, y: 0, vy: 0, heading: Math.PI,
      health: PLAYER.maxHealth, car: null,
      weapon: 'fists', hasPistol: false,
      shootCooldown: 0, punchCooldown: 0,
      grounded: true,
    };
    this.player.mesh.position.set(12, 0, 18);
    this.scene.add(this.player.mesh);
    this.spawnTraffic();
    this.spawnParked();
    this.spawnPeds();
    // The hero car for mission 6, parked at the Hotel Miramar from the start.
    const hero = createCar(this.scene, 'comet', 0xffd23e, -150, 66, Math.PI / 2);
    hero.parked = true;
    this.cars.push(hero);
    this.buildMarker();
  }

  buildMarker() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
    this.markerMesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), mat);
    this.scene.add(this.markerMesh);
    this.markerBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 60, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
    );
    this.scene.add(this.markerBeam);
  }

  spawnTraffic() {
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) this.spawnTrafficCar(true);
  }

  spawnTrafficCar(anywhere) {
    const type = this.rng.pick(['bison', 'bison', 'comet', 'mule', 'cab']);
    let x, z;
    if (anywhere) {
      const p = this.city.randomRoadPoint();
      x = p.x; z = p.z;
    } else {
      // Spawn on a road near the player but out of sight.
      const a = this.rng.range(0, Math.PI * 2);
      const d = this.rng.range(70, 110);
      x = clamp(this.player.x + Math.sin(a) * d, -180, 180);
      z = clamp(this.player.z + Math.cos(a) * d, -180, 180);
      x = Math.round(x / CITY.pitch) * CITY.pitch + this.rng.pick([-3.5, 3.5]);
    }
    const car = createCar(this.scene, type, this.rng.pick(CAR_COLORS), x, z, 0);
    car.axis = this.rng.chance(0.5) ? 'z' : 'x';
    car.dir = this.rng.chance(0.5) ? 1 : -1;
    car.lane = this.rng.chance(0.5) ? 1 : -1;
    car.cruise = car.spec.topSpeed * this.rng.range(0.4, 0.65);
    car.heading = car.axis === 'z' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    this.cars.push(car);
    return car;
  }

  spawnParked() {
    for (let i = 0; i < PARKED_COUNT; i += 1) {
      const type = this.rng.pick(['bison', 'comet', 'mule', 'cab']);
      const vertical = this.rng.chance(0.5);
      const road = this.rng.pick(CITY.roads) * CITY.pitch;
      const along = this.rng.range(-160, 160);
      const side = this.rng.pick([-10.5, 10.5]);
      const x = vertical ? road + side : along;
      const z = vertical ? along : road + side;
      const car = createCar(this.scene, type, this.rng.pick(CAR_COLORS), x, z, vertical ? 0 : Math.PI / 2);
      car.parked = true;
      this.cars.push(car);
    }
  }

  spawnPeds() {
    for (let i = 0; i < PED_COUNT; i += 1) {
      const p = this.city.randomSidewalkPoint();
      this.peds.push(createPedestrian(this.scene, this.rng, p.x, p.z));
    }
  }

  // ---------- missions interface ----------

  missionsListForHud() { return MISSIONS; }

  playerInCar() { return !!this.player.car; }
  enemiesAlive() { return this.enemies.filter((e) => e.state !== 'down').length; }
  addCash(n) { this.cash += n; this.audio.cash(); }
  setWanted(n) { this.wanted = clamp(n, 0, WANTED.maxStars); this.wantedTimer = 0; }
  spawnEnemies(x, z, count) {
    for (let i = 0; i < count; i += 1) {
      const ex = x + this.rng.range(-8, 8), ez = z + this.rng.range(-8, 8);
      this.enemies.push(createEnemy(this.scene, this.rng, ex, ez));
    }
  }
  onMissionComplete(completed) {
    if (completed === 2) { this.player.hasPistol = true; }
    this.save();
  }

  startNextMission() {
    const next = this.missions.nextMission();
    if (!next) return false;
    if (this.missions.start(next.id - 1, this)) {
      this.hud.message(next.intro, 7000);
      this.audio.missionDone();
      return true;
    }
    return false;
  }

  // ---------- crime & wanted ----------

  addWanted(n, reason) {
    const before = this.wanted;
    this.wanted = clamp(this.wanted + n, 0, WANTED.maxStars);
    if (this.wanted > before) {
      this.wantedTimer = 0;
      if (reason) this.hud.message(reason);
    }
  }

  damagePlayer(amount) {
    if (this.screen !== 'play' || this.player.health <= 0) return;
    this.player.health -= amount;
    this.lastDamageAt = this.time;
    this.hud.flashDamage();
    if (this.player.health <= 0) {
      this.player.health = 0;
      this.screen = 'wasted';
      this.audio.busted();
      this.hud.showScreen('wasted');
      if (this.missions.active >= 0) this.missions.abort();
    }
  }

  // ---------- cars: enter / exit / steal ----------

  nearestCar(maxDist) {
    let best = null, bestD = maxDist;
    for (const car of this.cars) {
      if (car.isPlayer || car.isPolice) continue;
      const d = distance2D(this.player.x, this.player.z, car.x, car.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  enterCar(car) {
    const wasTraffic = !car.parked && !car.isPolice;
    if (wasTraffic) {
      // The driver bails and runs; stealing in front of the law is a crime.
      const driver = createPedestrian(this.scene, this.rng, car.x + 2, car.z);
      driver.state = 'flee'; driver.fleeUntil = this.time + 6;
      this.peds.push(driver);
      this.addWanted(1, 'Car stolen! The owner called the cops.');
    }
    car.parked = false;
    car.isPlayer = true;
    car.speed = 0;
    this.player.car = car;
    this.player.mesh.visible = false;
    this.audio.click();
  }

  exitCar() {
    const car = this.player.car;
    if (!car) return;
    car.isPlayer = false;
    car.parked = true;
    car.speed = 0;
    this.player.x = car.x + Math.cos(car.heading) * 2.4;
    this.player.z = car.z - Math.sin(car.heading) * 2.4;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.player.mesh.visible = true;
    this.player.car = null;
  }

  /** Spawn a police cruiser at an exact spot (used by the chase screenshot). */
  spawnPoliceCarAt(x, z, heading = 0) {
    const car = createCar(this.scene, 'cruiser', 0x1c2a3a, x, z, heading);
    car.isPolice = true;
    car.cruise = 30;
    this.cars.push(car);
    this.policeCars.push(car);
    return car;
  }

  // ---------- police ----------

  updatePolice(dt) {
    // The heat is off: clear parked ex-chasers as well as the active ones.
    if (this.wanted === 0) {
      for (let i = this.cars.length - 1; i >= 0; i -= 1) {
        const car = this.cars[i];
        if (car.isPolice && car.parked && !car.isPlayer) {
          removeCar(this.scene, car);
          this.cars.splice(i, 1);
        }
      }
    }
    const want = WANTED.policeCars[this.wanted];
    while (this.policeCars.length < want) {
      const a = this.rng.range(0, Math.PI * 2);
      const d = this.rng.range(70, 100);
      const x = clamp(this.player.x + Math.sin(a) * d, -180, 180);
      const z = clamp(this.player.z + Math.cos(a) * d, -180, 180);
      const car = createCar(this.scene, 'cruiser', 0x1c2a3a, x, z, 0);
      car.isPolice = true;
      car.cruise = 30;
      this.cars.push(car);
      this.policeCars.push(car);
    }
    for (let i = this.policeCars.length - 1; i >= 0; i -= 1) {
      const car = this.policeCars[i];
      if (car.isPlayer) { this.policeCars.splice(i, 1); continue; } // the player took it
      const d = distance2D(car.x, car.z, this.player.x, this.player.z);
      if (this.wanted === 0 || d > 170) {
        removeCar(this.scene, car);
        this.cars.splice(this.cars.indexOf(car), 1);
        this.policeCars.splice(i, 1);
        continue;
      }
      const desired = Math.atan2(this.player.x - car.x, this.player.z - car.z);
      car.heading += clamp(angleDelta(car.heading, desired), -2.6 * dt, 2.6 * dt);
      const targetSpeed = d > 8 ? 30 : (this.player.car ? 12 : 0);
      car.speed += clamp(targetSpeed - car.speed, -18 * dt, 12 * dt);
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      const pos = { x: nx, z: nz };
      this.city.resolveCollision(pos, 1.5);
      car.x = pos.x; car.z = pos.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      if (this.player.car && d < 4.2 && Math.abs(car.speed) > 4) {
        this.player.car.damage = Math.min(1, this.player.car.damage + 0.05);
        this.player.car.speed *= 0.7;
        this.audio.crash();
      }
      if (!this.player.car && d < 7 && this.officers.length < 2 && car.speed < 1) {
        this.officers.push(createOfficer(this.scene, car.x + 2, car.z + 2));
        car.parked = true;
        this.policeCars.splice(i, 1);
      }
      updateCarSmoke(this.scene, car, dt);
    }
    for (let i = this.officers.length - 1; i >= 0; i -= 1) {
      const result = updateOfficer(this.officers[i], dt, this.player, this.city);
      if (result === 'gone') {
        this.scene.remove(this.officers[i].mesh);
        this.officers.splice(i, 1);
      } else if (result === 'busted') {
        this.busted();
        return;
      }
    }
    const nearestCop = Math.min(
      ...this.policeCars.map((c) => distance2D(c.x, c.z, this.player.x, this.player.z)),
      ...this.officers.map((o) => distance2D(o.x, o.z, this.player.x, this.player.z)),
      999,
    );
    if (this.wanted > 0 && nearestCop > 55) {
      this.wantedTimer += dt;
      if (this.wantedTimer > WANTED.decayDelay) {
        this.wanted -= 1;
        this.wantedTimer = 0;
        this.hud.message(this.wanted === 0 ? 'You lost the heat.' : `Wanted level dropped to ${this.wanted} star${this.wanted === 1 ? '' : 's'}.`);
      }
    } else {
      this.wantedTimer = 0;
    }
  }

  busted() {
    if (this.screen !== 'play') return;
    const fine = Math.min(this.cash, 200);
    this.cash -= fine;
    this.setWanted(0);
    this.screen = 'busted';
    this.audio.busted();
    this.hud.showScreen('busted');
    if (this.missions.active >= 0) this.missions.abort();
  }

  respawn() {
    if (this.player.car) this.exitCar();
    this.player.x = 117; this.player.z = 100;
    this.player.y = 0; this.player.vy = 0;
    this.player.health = PLAYER.maxHealth;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.setWanted(0);
    for (const off of this.officers) this.scene.remove(off.mesh);
    this.officers = [];
    this.screen = 'play';
    this.hud.hideScreens();
    this.hud.message('Back on the street. Stay out of trouble — or don\'t.');
    this.save();
  }

  // ---------- save / load ----------

  save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.cash,
        health: this.player.health,
        missions: this.missions.completed,
        hasPistol: this.player.hasPistol,
        x: this.player.x, z: this.player.z,
      }));
      this.hud.setSaveNote('Progress saved.');
    } catch { /* storage can be off; the game still plays */ }
  }

  static hasSave() {
    try { return !!window.localStorage.getItem(SAVE_KEY); } catch { return false; }
  }

  load() {
    try {
      const data = JSON.parse(window.localStorage.getItem(SAVE_KEY) || 'null');
      if (!data) return false;
      this.cash = data.cash ?? START_CASH;
      this.player.health = data.health ?? PLAYER.maxHealth;
      this.missions.setCompleted(data.missions ?? 0);
      this.player.hasPistol = !!data.hasPistol;
      if (this.player.hasPistol) this.player.weapon = 'pistol';
      this.player.x = data.x ?? 12;
      this.player.z = data.z ?? 18;
      this.player.mesh.position.set(this.player.x, 0, this.player.z);
      return true;
    } catch { return false; }
  }

  // ---------- flow ----------

  newGame() {
    this.reset(1337 + Math.floor(Math.random() * 100000));
    this.screen = 'play';
    this.hud.hideScreens();
    this.hud.message(STORY_INTRO, 9000);
    this.missions.start(0, this);
    this.hud.message(MISSIONS[0].intro, 8000);
    this.hud.setWeapon('Fists');
    this.audio.unlock();
  }

  continueGame() {
    this.reset(1337 + Math.floor(Math.random() * 100000));
    const ok = this.load();
    this.screen = 'play';
    this.hud.hideScreens();
    this.hud.message(ok ? 'Welcome back to Solmara.' : 'No save found — starting fresh.');
    if (this.missions.completed > 0 && this.missions.completed < MISSIONS.length) {
      this.hud.message(`Next mission: ${MISSIONS[this.missions.completed].title}. Follow the yellow marker.`);
    }
    this.hud.setWeapon(this.player.hasPistol ? 'Pistol' : 'Fists');
    this.audio.unlock();
  }

  // ---------- main step ----------

  step(dt, move, actions, orbit) {
    if (this.screen !== 'play') return;
    this.time += dt;
    this.camYaw -= orbit.yaw;
    this.camPitch = clamp(this.camPitch + orbit.pitch, -0.1, 0.9);

    if (actions & ACTION.WEAPON) {
      if (this.player.hasPistol) {
        this.player.weapon = this.player.weapon === 'pistol' ? 'fists' : 'pistol';
        this.hud.setWeapon(this.player.weapon === 'pistol' ? 'Pistol' : 'Fists');
        this.audio.click();
      } else {
        this.hud.message('No gun yet — finish "The Drop" to unlock the pistol.');
      }
    }
    if (actions & ACTION.MUTE) {
      const muted = this.audio.toggleMute();
      this.hud.message(muted ? 'Sound off.' : 'Sound on.');
    }

    if (actions & ACTION.INTERACT) {
      if (this.player.car) this.exitCar();
      else {
        const car = this.nearestCar(4);
        if (car) this.enterCar(car);
        else if (this.missions.active < 0) this.startNextMission();
      }
    }

    this.player.shootCooldown -= dt;
    this.player.punchCooldown -= dt;
    if (actions & ACTION.SHOOT && this.player.shootCooldown <= 0) {
      if (this.player.weapon === 'pistol' && this.player.hasPistol) {
        this.player.shootCooldown = PLAYER.pistolCooldown;
        this.shoot();
      } else if (this.player.punchCooldown <= 0) {
        this.player.punchCooldown = 0.45;
        this.punch();
      }
    }

    if (this.player.car) {
      // The camera recentres behind the car; a mouse drag still offsets it for a while.
      this.camYaw += angleDelta(this.camYaw, this.player.car.heading) * Math.min(1, dt * 0.9);
      const hardHit = driveCar(this.player.car, {
        forward: move.forward > 0, back: move.forward < 0,
        left: move.left, right: move.right, handbrake: move.handbrake,
      }, dt, this.city, this.cars);
      if (hardHit) this.audio.crash();
      updateCarSmoke(this.scene, this.player.car, dt);
      this.audio.setEngine(Math.abs(this.player.car.speed) / this.player.car.spec.topSpeed, true);
    } else {
      this.moveOnFoot(dt, move);
      this.audio.setEngine(0, false);
    }

    for (const car of this.cars) {
      if (!car.isPlayer && !car.parked) updateTrafficCar(car, dt, this.rng, this.cars, this.city);
      if (!car.isPlayer) updateCarSmoke(this.scene, car, dt);
    }
    this.maintainTraffic();
    const danger = this.player.shootCooldown > PLAYER.pistolCooldown - 0.1
      ? { x: this.player.x, z: this.player.z } : null;
    for (const ped of this.peds) updatePedestrian(ped, dt, this.time, this.city, danger);
    this.maintainPeds();
    this.updatePolice(dt);
    for (const enemy of this.enemies) {
      updateEnemy(enemy, dt, this.player, this.rng, (en, hit) => {
        this.audio.gunshot();
        if (hit) this.damagePlayer(this.rng.int(6, 12));
      });
    }
    this.combat.update(dt);

    if (this.time - this.lastDamageAt > 8 && this.player.health > 0 && this.player.health < PLAYER.maxHealth) {
      this.player.health = Math.min(PLAYER.maxHealth, this.player.health + 3 * dt);
    }

    for (const event of this.missions.update(dt, this)) {
      if (event.type === 'complete') { this.hud.message(event.text, 6000); this.audio.missionDone(); }
      else if (event.type === 'story') { this.screen = 'story'; this.hud.showScreen('story'); }
      else this.hud.message(event.text, event.type === 'failed' ? 7000 : 5200);
    }

    // Auto-start the next mission at its marker.
    if (this.missions.active < 0 && !this.missions.storyDone) {
      const start = this.missions.nextStartPoint();
      if (start && distance2D(this.player.x, this.player.z, start.x, start.z) < 8) {
        this.startNextMission();
      }
    }

    const nearestCop = this.policeCars.length
      ? Math.min(...this.policeCars.map((c) => distance2D(c.x, c.z, this.player.x, this.player.z)))
      : 999;
    this.audio.setSiren(this.wanted > 0, nearestCop < 40);

    this.updateMarker(dt);
    this.updateHUD();
  }

  moveOnFoot(dt, move) {
    const p = this.player;
    const fwd = move.forward;
    const str = move.strafe;
    if (fwd !== 0 || str !== 0) {
      // Camera-relative movement: W walks away from the camera, D strafes screen-right.
      const sy = Math.sin(this.camYaw), cy = Math.cos(this.camYaw);
      const mx = fwd * sy - str * cy;
      const mz = fwd * cy + str * sy;
      const moveAngle = Math.atan2(mx, mz);
      const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      p.heading += angleDelta(p.heading, moveAngle) * Math.min(1, dt * 12);
      const nx = p.x + Math.sin(moveAngle) * speed * dt;
      const nz = p.z + Math.cos(moveAngle) * speed * dt;
      const pos = { x: nx, z: nz };
      this.city.resolveCollision(pos, PLAYER.radius);
      p.x = clamp(pos.x, -CITY.extent, 244);
      p.z = clamp(pos.z, -CITY.extent, CITY.waterZ - 2);
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.rotation.y = p.heading;
      animateWalk(p.mesh, dt, speed);
    } else {
      animateWalk(p.mesh, dt, 0, 0);
    }
    if (move.jump && p.grounded) {
      p.vy = PLAYER.jumpSpeed;
      p.grounded = false;
    }
    if (!p.grounded) {
      p.vy -= PLAYER.gravity * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; }
      p.mesh.position.y = p.y;
    }
  }

  shoot() {
    const p = this.player;
    this.audio.gunshot();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const origin = { x: p.x, y: p.y + 1.4, z: p.z };
    const people = [...this.enemies, ...this.officers, ...this.peds];
    const result = this.combat.shoot(origin, dir, people, PLAYER.pistolRange);
    if (!result.hit) return;
    const target = result.target;
    if (target.kind === 'ped') {
      this.combat.layDown(target);
      this.addWanted(1, 'You shot a civilian! Wanted level up.');
    } else if (target.kind === 'officer') {
      target.health -= PLAYER.pistolDamage;
      if (target.health <= 0) {
        this.combat.layDown(target);
        this.addWanted(2, 'You shot a cop! The whole city is coming.');
      }
    } else {
      target.health -= PLAYER.pistolDamage;
      if (target.health <= 0) this.combat.layDown(target);
    }
  }

  punch() {
    const p = this.player;
    this.audio.punch();
    const people = [...this.enemies, ...this.officers, ...this.peds];
    const victim = this.combat.punch({ x: p.x, z: p.z }, p.heading, people);
    if (!victim) return;
    if (victim.kind === 'ped') {
      victim.health -= PLAYER.punchDamage;
      if (victim.health <= 0) {
        this.combat.layDown(victim);
        this.addWanted(1, 'You beat up a civilian! Wanted level up.');
      }
    } else if (victim.kind === 'officer') {
      victim.health -= PLAYER.punchDamage;
      if (victim.health <= 0) {
        this.combat.layDown(victim);
        this.addWanted(2, 'You knocked out a cop!');
      }
    } else {
      victim.health -= PLAYER.punchDamage;
      if (victim.health <= 0) this.combat.layDown(victim);
    }
  }

  maintainTraffic() {
    let count = 0;
    for (let i = this.cars.length - 1; i >= 0; i -= 1) {
      const car = this.cars[i];
      if (car.isPlayer || car.parked || car.isPolice) continue;
      count += 1;
      if (distance2D(car.x, car.z, this.player.x, this.player.z) > 230) {
        removeCar(this.scene, car);
        this.cars.splice(i, 1);
      }
    }
    while (count < TRAFFIC_COUNT) {
      this.spawnTrafficCar(false);
      count += 1;
    }
  }

  maintainPeds() {
    for (let i = this.peds.length - 1; i >= 0; i -= 1) {
      const ped = this.peds[i];
      if (ped.state === 'down') continue;
      if (distance2D(ped.x, ped.z, this.player.x, this.player.z) > 160) {
        this.scene.remove(ped.mesh);
        this.peds.splice(i, 1);
        const p = this.city.randomSidewalkPoint();
        this.peds.push(createPedestrian(this.scene, this.rng, p.x, p.z));
      }
    }
  }

  updateMarker(dt) {
    if (!this.markerMesh) return;
    let target = null;
    if (this.missions.active >= 0) target = this.missions.marker();
    else if (!this.missions.storyDone) target = this.missions.nextStartPoint();
    if (!target) {
      this.markerMesh.visible = false;
      this.markerBeam.visible = false;
      return;
    }
    this.markerMesh.visible = true;
    this.markerBeam.visible = true;
    this.markerMesh.position.set(target.x, 6 + Math.sin(this.time * 2.4) * 0.6, target.z);
    this.markerMesh.rotation.y += dt * 1.5;
    this.markerBeam.position.set(target.x, 30, target.z);
  }

  updateHUD() {
    this.hud.setCash(this.cash);
    this.hud.setStars(this.wanted);
    this.hud.setHealth(this.player.health, PLAYER.maxHealth);
    this.hud.setSpeed(this.player.car ? Math.abs(this.player.car.speed) * 3.6 : 0, !!this.player.car);
    const objective = this.missions.active >= 0
      ? `${MISSIONS[this.missions.active].title}: ${this.missions.objectiveText()}`
      : this.missions.storyDone
        ? 'Story complete — Solmara is yours. Free roam.'
        : `Next: ${this.missions.nextMission().title} — follow the yellow marker`;
    this.hud.setObjective(objective, this.missions.timeLeft());
    this.hud.setCrosshair(this.player.weapon === 'pistol' && !this.player.car);
    this.hud.drawMinimap({
      player: this.player,
      cars: this.cars.filter((c) => !c.parked || c.isPolice),
      marker: this.missions.active >= 0 ? this.missions.marker() : null,
    });
  }

  // ---------- camera & render ----------

  render() {
    const p = this.player;
    const anchor = p.car
      ? { x: p.car.x, z: p.car.z, h: 1.8 }
      : { x: p.x, z: p.z, h: 1.6 + p.y };
    const dist = p.car ? 10.5 : this.camDist;
    const yaw = this.camYaw;
    const cx = anchor.x - Math.sin(yaw) * Math.cos(this.camPitch) * dist;
    const cz = anchor.z - Math.cos(yaw) * Math.cos(this.camPitch) * dist;
    const cy = anchor.h + Math.sin(this.camPitch) * dist + 1.2;
    if (!this.camInit) {
      this.camera.position.set(cx, cy, cz);
      this.camInit = true;
    } else {
      this.camera.position.x += (cx - this.camera.position.x) * 0.18;
      this.camera.position.y += (cy - this.camera.position.y) * 0.18;
      this.camera.position.z += (cz - this.camera.position.z) * 0.18;
    }
    this.camera.lookAt(anchor.x + Math.sin(yaw) * 2, anchor.h + 0.6, anchor.z + Math.cos(yaw) * 2);
    this.renderer.render(this.scene, this.camera);
  }
}
