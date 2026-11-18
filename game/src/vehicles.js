// Cars: a boxy low-poly builder shared by traffic, parked cars, the player's rides and the
// police, plus the arcade driving model (accelerate, brake, steer, handbrake) and the traffic
// AI that cruises the road grid, turns at intersections and slows for the car ahead.
import { CITY, CAR_TYPES } from './config.js';
import { clamp, angleDelta } from './rng.js';

const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3aa655, 0xe8e8e8, 0x22242a, 0xc26a2e, 0x7a3ec2, 0x39a8a0];

/** Build a car mesh. `type` picks the body shape; police cars get a light bar. */
export function buildCarMesh(type, color) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2a38 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const box = (mat, x, y, z, sx, sy, sz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x, y, z); m.castShadow = true; group.add(m); return m;
  };
  const tall = type === 'mule';
  const long = type === 'mule' ? 5.2 : 4.2;
  const wide = 1.9;
  box(bodyMat, 0, 0.65, 0, wide, 0.7, long);
  box(glassMat, 0, 1.2, tall ? -0.4 : -0.2, wide * 0.86, tall ? 1.1 : 0.55, tall ? 3.4 : 2.0);
  box(darkMat, 0, 0.35, long / 2 + 0.05, wide * 0.9, 0.3, 0.15); // front bumper
  box(darkMat, 0, 0.35, -long / 2 - 0.05, wide * 0.9, 0.3, 0.15); // rear bumper
  // Headlights and tail lights (emissive so they read at a glance).
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a22 });
  box(headMat, -0.6, 0.7, long / 2 + 0.02, 0.35, 0.18, 0.06);
  box(headMat, 0.6, 0.7, long / 2 + 0.02, 0.35, 0.18, 0.06);
  box(tailMat, -0.6, 0.7, -long / 2 - 0.02, 0.35, 0.18, 0.06);
  box(tailMat, 0.6, 0.7, -long / 2 - 0.02, 0.35, 0.18, 0.06);
  if (type === 'cruiser') {
    const barMat = new THREE.MeshBasicMaterial({ color: 0x2266ff });
    box(barMat, 0, 1.62, -0.2, 1.1, 0.18, 0.4);
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    box(redMat, -0.28, 1.72, -0.2, 0.5, 0.12, 0.42);
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x2266ff });
    box(blueMat, 0.28, 1.72, -0.2, 0.5, 0.12, 0.42);
  }
  if (type === 'cab') {
    box(new THREE.MeshBasicMaterial({ color: 0xffd23e }), 0, 1.62, -0.2, 0.9, 0.18, 0.4);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheels = [];
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  group.userData.wheels = wheels;
  group.userData.length = long;
  return group;
}

export function createCar(scene, type, color, x, z, heading) {
  const spec = CAR_TYPES[type];
  const mesh = buildCarMesh(type, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    type, spec, mesh,
    x, z, heading,
    speed: 0,
    damage: 0,       // 0..1, smoke and sputter as it grows
    isPolice: type === 'cruiser',
    isPlayer: false,
    parked: false,
    // Traffic AI state:
    axis: 'z', lane: 1, dir: 1, cruise: spec.topSpeed * 0.55, stuck: 0,
    smoke: null,
  };
}

/** Remove a car from the scene. */
export function removeCar(scene, car) {
  scene.remove(car.mesh);
  if (car.smoke) scene.remove(car.smoke);
}

function nearIntersection(v) {
  // Distance to the nearest road centre on the axis the car travels across.
  const p = CITY.pitch;
  const along = v.axis === 'z' ? v.x : v.z;
  const rem = ((along % p) + p) % p;
  return Math.min(rem, p - rem) < 4;
}

/** One traffic car: cruise its lane, turn at intersections, slow for the car ahead. */
export function updateTrafficCar(car, dt, rng, cars, city) {
  if (car.parked || car.isPlayer) return;
  // Slow for the car ahead on the same lane.
  let target = car.cruise;
  for (const other of cars) {
    if (other === car || other.parked) continue;
    const dx = other.x - car.x, dz = other.z - car.z;
    const ahead = car.axis === 'z' ? dz * car.dir : dx * car.dir;
    const lateral = car.axis === 'z' ? Math.abs(dx) : Math.abs(dz);
    if (ahead > 0 && ahead < 9 && lateral < 2.4) { target = 0; break; }
  }
  car.speed += clamp(target - car.speed, -14 * dt, 8 * dt);
  const step = car.speed * car.dir * dt;
  if (car.axis === 'z') car.z += step; else car.x += step;
  // Turn at an intersection, sometimes; never turn off the grid edge.
  if (nearIntersection(car) && rng.chance(dt * 0.35)) {
    const along = car.axis === 'z' ? car.x : car.z;
    const snapped = Math.round(along / CITY.pitch) * CITY.pitch;
    if (Math.abs(snapped) <= CITY.pitch * 2) {
      if (car.axis === 'z') { car.x = snapped; car.axis = 'x'; }
      else { car.z = snapped; car.axis = 'z'; }
      car.dir = rng.chance(0.5) ? 1 : -1;
      car.lane = rng.chance(0.5) ? 1 : -1;
    }
  }
  // Keep on the grid: at the edge, turn around.
  const lim = CITY.extent - 12;
  if (car.axis === 'z' && (car.z > lim || car.z < -lim)) { car.dir *= -1; car.z = clamp(car.z, -lim, lim); }
  if (car.axis === 'x' && (car.x > lim || car.x < -lim)) { car.dir *= -1; car.x = clamp(car.x, -lim, lim); }
  // Lane offset: right-hand traffic.
  if (car.axis === 'z') car.x = Math.round(car.x / CITY.pitch) * CITY.pitch + car.lane * 3.5 * car.dir;
  else car.z = Math.round(car.z / CITY.pitch) * CITY.pitch + car.lane * 3.5 * car.dir;
  const targetHeading = car.axis === 'z' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  car.heading += angleDelta(car.heading, targetHeading) * Math.min(1, dt * 6);
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  spinWheels(car, dt);
}

export function spinWheels(car, dt) {
  const wheels = car.mesh.userData.wheels;
  if (!wheels) return;
  for (const w of wheels) w.rotation.x += car.speed * dt * 2.2;
}

/**
 * Arcade driving for the player's car. `input` has forward/back/left/right/handbrake.
 * Collides with buildings (push-out) and other cars (bounce + damage). Returns true on a
 * hard hit (for the crash sound and wanted heat).
 */
export function driveCar(car, input, dt, city, cars) {
  const spec = car.spec;
  const damaged = car.damage > 0.55;
  const top = spec.topSpeed * (damaged ? 0.6 : 1);
  if (input.forward) car.speed += spec.accel * dt * (car.speed < 0 ? 2.2 : 1);
  else if (input.back) car.speed -= spec.accel * 0.8 * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  if (input.handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
  car.speed = clamp(car.speed, -top * 0.45, top);
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const grip = input.handbrake ? 0.55 : 1;
  car.heading += steer * spec.turn * grip * dt * clamp(Math.abs(car.speed) / 6, 0, 1) * (car.speed < 0 ? -1 : 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const pos = { x: nx, z: nz };
  const hitWall = city.resolveCollision(pos, 1.5);
  // Beach is drivable; the sea is not.
  if (pos.z > CITY.waterZ - 3) { pos.z = CITY.waterZ - 3; car.speed *= 0.4; }
  if (pos.x > 244) { pos.x = 244; car.speed *= 0.4; }
  if (pos.x < -CITY.extent || pos.z < -CITY.extent) { pos.x = clamp(pos.x, -CITY.extent, 244); pos.z = clamp(pos.z, -CITY.extent, CITY.waterZ - 3); }
  let hardHit = hitWall;
  for (const other of cars) {
    if (other === car || other.parked) continue;
    const dx = pos.x - other.x, dz = pos.z - other.z;
    const d = Math.hypot(dx, dz);
    if (d < 3.4 && d > 0.01) {
      pos.x = other.x + (dx / d) * 3.4;
      pos.z = other.z + (dz / d) * 3.4;
      if (Math.abs(car.speed) > 8) {
        other.speed = car.speed * 0.5;
        car.damage = Math.min(1, car.damage + 0.08);
        hardHit = true;
      }
      car.speed *= 0.55;
    }
  }
  if (hitWall && Math.abs(car.speed) > 10) {
    car.damage = Math.min(1, car.damage + 0.06);
    car.speed *= 0.45;
  }
  car.x = pos.x; car.z = pos.z;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  spinWheels(car, dt);
  return hardHit;
}

/** A smoke puff that follows a damaged car; created lazily. */
export function updateCarSmoke(scene, car, dt) {
  if (car.damage < 0.35) return;
  if (!car.smoke) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.55 });
    car.smoke = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), mat);
    scene.add(car.smoke);
  }
  car.smoke.visible = true;
  car.smoke.position.set(car.x + Math.sin(car.heading) * 1.2, 1.4 + Math.sin(performance.now() * 0.004) * 0.2, car.z + Math.cos(car.heading) * 1.2);
  const s = 0.7 + car.damage * 0.9;
  car.smoke.scale.set(s, s, s);
}

export { CAR_COLORS };
