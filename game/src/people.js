// People: the low-poly humanoid every walker shares, pedestrians who stroll the sidewalks
// and flee from danger, police officers on foot who chase and bust, and mission enemies who
// shoot back. Movement is all on the ground plane; collision is a circle against buildings.
import { CITY, PLAYER } from './config.js';
import { clamp, angleDelta, distance2D } from './rng.js';

const SHIRT_COLORS = [0xd84f4f, 0x4f7ad8, 0x4fae5a, 0xd8c84f, 0xe8e8e8, 0x8a5fc9, 0x39a8a0, 0xc26a2e];
const SKIN_COLORS = [0xe8b98a, 0xc98d5f, 0x8a5a3a, 0xf0c8a0];

/** A simple humanoid: torso, head, two legs, two arms. `pose` is set by the walk cycle. */
export function buildPersonMesh(shirt, skin, pants = 0x2a3242) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const box = (mat, x, y, z, sx, sy, sz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x, y, z); m.castShadow = true; group.add(m); return m;
  };
  const torso = box(shirtMat, 0, 1.15, 0, 0.62, 0.7, 0.34);
  const head = box(skinMat, 0, 1.72, 0, 0.34, 0.34, 0.32);
  box(new THREE.MeshLambertMaterial({ color: 0x1c1c22 }), 0, 1.9, 0, 0.36, 0.12, 0.34); // hair
  const legL = box(pantsMat, -0.16, 0.45, 0, 0.24, 0.9, 0.26);
  const legR = box(pantsMat, 0.16, 0.45, 0, 0.24, 0.9, 0.26);
  const armL = box(shirtMat, -0.42, 1.15, 0, 0.18, 0.62, 0.2);
  const armR = box(shirtMat, 0.42, 1.15, 0, 0.18, 0.62, 0.2);
  group.userData = { torso, head, legL, legR, armL, armR, walkPhase: 0 };
  return group;
}

/** Swing the limbs for a walk cycle; `amount` 0 when standing still. */
export function animateWalk(mesh, dt, speed, amount = 1) {
  const u = mesh.userData;
  u.walkPhase += dt * speed * 2.4;
  const swing = Math.sin(u.walkPhase) * 0.55 * amount;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8;
  u.armR.rotation.x = swing * 0.8;
  u.torso.position.y = 1.15 + Math.abs(Math.sin(u.walkPhase)) * 0.03 * amount;
}

/** A pedestrian: strolls a sidewalk, pauses, and runs from gunfire, speeding cars and cops. */
export function createPedestrian(scene, rng, x, z) {
  const mesh = buildPersonMesh(rng.pick(SHIRT_COLORS), rng.pick(SKIN_COLORS));
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    kind: 'ped',
    mesh, x, z, heading: rng.range(0, Math.PI * 2),
    health: 30,
    speed: rng.range(1.0, 1.7),
    state: 'walk',       // walk | flee | down
    target: null,
    pause: rng.range(0, 4),
    fleeUntil: 0,
  };
}

export function updatePedestrian(ped, dt, time, city, danger) {
  if (ped.state === 'down') return;
  if (danger && ped.state !== 'flee') {
    const d = distance2D(ped.x, ped.z, danger.x, danger.z);
    if (d < 16) { ped.state = 'flee'; ped.fleeUntil = time + 5; }
  }
  if (ped.state === 'flee') {
    if (time > ped.fleeUntil) { ped.state = 'walk'; ped.pause = 1; }
    else {
      const dx = ped.x - danger.x, dz = ped.z - danger.z;
      const d = Math.hypot(dx, dz) || 1;
      ped.heading = Math.atan2(dx / d, dz / d);
      movePerson(ped, dt, 4.2, city);
      animateWalk(ped.mesh, dt, 4.2);
      return;
    }
  }
  if (ped.pause > 0) {
    ped.pause -= dt;
    animateWalk(ped.mesh, dt, 0, 0);
    return;
  }
  if (!ped.target || distance2D(ped.x, ped.z, ped.target.x, ped.target.z) < 2) {
    ped.target = city.randomSidewalkPoint();
  }
  const dx = ped.target.x - ped.x, dz = ped.target.z - ped.z;
  ped.heading = Math.atan2(dx, dz);
  movePerson(ped, dt, ped.speed, city);
  animateWalk(ped.mesh, dt, ped.speed);
}

export function movePerson(person, dt, speed, city) {
  const nx = person.x + Math.sin(person.heading) * speed * dt;
  const nz = person.z + Math.cos(person.heading) * speed * dt;
  const pos = { x: nx, z: nz };
  city.resolveCollision(pos, PLAYER.radius);
  person.x = clamp(pos.x, -CITY.extent, 244);
  person.z = clamp(pos.z, -CITY.extent, CITY.waterZ - 2);
  person.mesh.position.set(person.x, 0, person.z);
  person.mesh.rotation.y = person.heading;
}

/** A police officer on foot: runs at the player, and busts them up close. */
export function createOfficer(scene, x, z) {
  const mesh = buildPersonMesh(0x1c3a5c, 0xe8b98a, 0x1c2a3a);
  // Police cap.
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.36),
    new THREE.MeshLambertMaterial({ color: 0x14243a }));
  cap.position.set(0, 1.92, 0); mesh.add(cap);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return { kind: 'officer', mesh, x, z, heading: 0, health: 50, speed: 6.4, bustTimer: 0, state: 'chase' };
}

export function updateOfficer(officer, dt, player, city) {
  const d = distance2D(officer.x, officer.z, player.x, player.z);
  if (d > 90) return 'gone'; // too far: the cop gives up and despawns
  const dx = player.x - officer.x, dz = player.z - officer.z;
  officer.heading = Math.atan2(dx, dz);
  if (d > 2.0) {
    movePerson(officer, dt, officer.speed, city);
    animateWalk(officer.mesh, dt, officer.speed);
    officer.bustTimer = 0;
  } else {
    officer.bustTimer += dt;
    animateWalk(officer.mesh, dt, 0, 0);
  }
  return officer.bustTimer > 1.6 ? 'busted' : 'chase';
}

/** A mission enemy: stands its ground, shoots at the player in range, and can be shot. */
export function createEnemy(scene, rng, x, z, health = 60) {
  const mesh = buildPersonMesh(0x8a2a2a, rng.pick(SKIN_COLORS), 0x1c1c22);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    kind: 'enemy',
    mesh, x, z, heading: rng.range(0, Math.PI * 2),
    health, maxHealth: health,
    shootCooldown: rng.range(0.5, 1.5),
    state: 'fight', // fight | down
    strafe: 0,
  };
}

export function updateEnemy(enemy, dt, player, rng, onShoot) {
  if (enemy.state === 'down') return;
  const d = distance2D(enemy.x, enemy.z, player.x, player.z);
  const dx = player.x - enemy.x, dz = player.z - enemy.z;
  enemy.heading = Math.atan2(dx, dz);
  enemy.mesh.rotation.y = enemy.heading;
  if (d < 26 && d > 6) {
    // Close in a little, strafing side to side.
    enemy.strafe += dt;
    const side = Math.sin(enemy.strafe * 1.4) > 0 ? 1 : -1;
    const moveHeading = enemy.heading + side * 0.5;
    enemy.x += Math.sin(moveHeading) * 2.6 * dt;
    enemy.z += Math.cos(moveHeading) * 2.6 * dt;
    enemy.mesh.position.set(enemy.x, 0, enemy.z);
    animateWalk(enemy.mesh, dt, 2.6);
  } else {
    animateWalk(enemy.mesh, dt, 0, 0);
  }
  enemy.shootCooldown -= dt;
  if (enemy.shootCooldown <= 0 && d < 30) {
    enemy.shootCooldown = rng.range(1.1, 2.2);
    // Enemies miss often; closer shots are likelier to land.
    const hitChance = clamp(0.42 - d * 0.01, 0.08, 0.4);
    onShoot(enemy, rng.next() < hitChance);
  }
}
