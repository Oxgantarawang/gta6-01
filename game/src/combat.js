// Combat: the player's pistol and fists, and the hit effects that make them read.
// Shooting is a cone test from the camera direction against people in range; a tracer
// line and a muzzle flash sell the shot, and a hit ped or cop raises the wanted level.
import { PLAYER } from './config.js';
import { distance2D } from './rng.js';

export function createCombat(scene) {
  const tracers = [];
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), flashMat);
  flash.visible = false;
  scene.add(flash);
  let flashTimer = 0;

  function addTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    scene.add(line);
    tracers.push({ line, life: 0.09 });
  }

  /** Fire the pistol from `origin` along `dir`. Returns { hit, kind, target } or null. */
  function shoot(origin, dir, people, range) {
    let best = null;
    let bestDist = range;
    // Aim in the ground plane: normalize the camera direction's XZ part first, or a
    // pitched-down camera would shrink the aim vector and miss dead-on shots.
    const len = Math.hypot(dir.x, dir.z);
    if (len < 0.001) return { hit: false };
    const dxn = dir.x / len, dzn = dir.z / len;
    for (const person of people) {
      if (person.state === 'down') continue;
      const dx = person.x - origin.x, dz = person.z - origin.z;
      const dist = Math.hypot(dx, dz);
      if (dist > range || dist < 0.5) continue;
      // Angle between the shot and the person, in the ground plane.
      const dot = (dx * dxn + dz * dzn) / dist;
      if (dot < 0.985) continue; // outside a ~10 degree cone
      if (dist < bestDist) { bestDist = dist; best = person; }
    }
    const end = best
      ? { x: best.x, y: 1.3, z: best.z }
      : { x: origin.x + dir.x * range, y: origin.y + dir.y * range, z: origin.z + dir.z * range };
    addTracer(origin, end);
    flash.position.set(origin.x + dir.x * 0.7, origin.y, origin.z + dir.z * 0.7);
    flash.visible = true;
    flashTimer = 0.06;
    if (!best) return { hit: false };
    return { hit: true, target: best, dist: bestDist };
  }

  /** A punch at the nearest person within arm's reach. Returns the victim or null. */
  function punch(origin, heading, people) {
    let best = null;
    let bestDist = 2.1;
    for (const person of people) {
      if (person.state === 'down') continue;
      const d = distance2D(origin.x, origin.z, person.x, person.z);
      if (d > bestDist) continue;
      const dx = (person.x - origin.x) / d, dz = (person.z - origin.z) / d;
      const dot = dx * Math.sin(heading) + dz * Math.cos(heading);
      if (dot < 0.3) continue;
      bestDist = d; best = person;
    }
    return best;
  }

  /** Lay a person down: rotate the mesh flat and mark them out of the fight. */
  function layDown(person) {
    person.state = 'down';
    person.mesh.rotation.x = -Math.PI / 2;
    person.mesh.position.y = 0.25;
  }

  function update(dt) {
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) flash.visible = false;
    }
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      const t = tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
      if (t.life <= 0) {
        scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        tracers.splice(i, 1);
      }
    }
  }

  return { shoot, punch, layDown, update };
}
