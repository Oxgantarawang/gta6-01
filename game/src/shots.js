// The screenshot scenes behind ?shot=cover|drive|chase|mission. Each one plays the real
// simulation forward from a fresh world with a fixed seed, steered by a tiny scripted
// driver (hold W, follow the car heading with the camera), so the frame is what a short
// game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';

const SEED = 7;
const IDLE = { forward: 0, strafe: 0, run: false, jump: false, handbrake: false, left: false, right: false };
const DRIVE = { forward: 1, strafe: 0, run: false, jump: false, handbrake: false, left: false, right: false };
const NO_ORBIT = { yaw: 0, pitch: 0 };

function stepFor(game, seconds, move, followCar) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.step(STEP, move, 0, NO_ORBIT);
    if (followCar && game.player.car) game.camYaw = game.player.car.heading;
    // Software rendering is slow: paint every 10th step and once at the end.
    if (i % 10 === 0 || i === steps - 1) game.render();
  }
}

/** Put the player in a parked Comet and start driving it. */
function takeComet(game, x, z, heading) {
  const car = game.cars.find((c) => c.type === 'comet' && c.parked && Math.abs(c.x - x) < 40 && Math.abs(c.z - z) < 40)
    || game.cars.find((c) => c.parked);
  car.x = x; car.z = z; car.heading = heading;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading;
  game.player.x = x; game.player.z = z;
  game.enterCar(car);
  game.camYaw = heading;
}

/**
 * Set the game to the named scene (cover, drive, chase or mission; any other name is
 * cover) and leave it rendered, HUD and all, ready for a screenshot.
 */
export function stageShot(name, game) {
  game.reset(SEED);
  game.screen = 'play';
  game.hud.hideScreens();
  game.hud.setContinueVisible(false);

  if (name === 'drive' || name === 'chase') {
    if (name === 'drive') {
      game.missions.start(0, game);
      takeComet(game, 0, -140, 0);
      game.cash = 1250;
      game.hud.message('Cruising Avenida del Sol — traffic, palms, the whole city.');
      stepFor(game, 4.5, DRIVE, true);
    } else {
      // Heat Wave, mid-escape: three stars, cruisers closing in from up the road.
      game.missions.setCompleted(3);
      game.missions.startAt(3, 1, game);
      takeComet(game, 0, -140, 0);
      game.spawnPoliceCarAt(3.5, -100, Math.PI);
      game.spawnPoliceCarAt(-3.5, -75, Math.PI);
      game.spawnPoliceCarAt(-3.5, -165, 0);
      game.cash = 1250;
      game.hud.message('3 stars! The Solmara PD is on your tail.');
      stepFor(game, 4, DRIVE, true);
      // Put the nearest cruiser where the camera can see it: alongside, ahead-right.
      const cop = game.policeCars[0];
      if (cop && game.player.car) {
        cop.x = game.player.car.x + 7;
        cop.z = game.player.car.z + 9;
        cop.heading = game.player.car.heading;
        cop.speed = game.player.car.speed;
        cop.mesh.position.set(cop.x, 0, cop.z);
        cop.mesh.rotation.y = cop.heading;
      }
      // Swing the camera to a three-quarter rear view so the chasing cruisers read.
      game.camYaw = game.player.car.heading + 0.55;
      game.camInit = false;
      game.render();
    }
    return;
  }

  if (name === 'mission') {
    // Dockside War, mid-fight: pistol out, Mercer's crew in front of the player.
    game.player.hasPistol = true;
    game.player.weapon = 'pistol';
    game.hud.setWeapon('Pistol');
    game.missions.setCompleted(4);
    // Start straight at the fight step so the crew is in the frame.
    game.missions.startAt(4, 1, game);
    // Stand just inside the docks waypoint, facing the crew.
    game.player.x = 208; game.player.z = 6;
    game.player.heading = 1.19;
    game.player.mesh.position.set(208, 0, 6);
    game.player.mesh.rotation.y = game.player.heading;
    game.camYaw = 1.19;
    game.camPitch = 0.3;
    game.cash = 2350;
    game.hud.message('Dockside War: clear the docks of Mercer\'s crew!');
    stepFor(game, 2.5, IDLE, false);
    return;
  }

  // Cover: on foot on the north road, looking south across the plaza fountain to the
  // beach and sea, mission 1 live, the city behind and around.
  game.player.x = 0; game.player.z = -40;
  game.player.heading = 0;
  game.player.mesh.position.set(0, 0, -40);
  game.player.mesh.rotation.y = 0;
  game.camYaw = 0;
  game.camPitch = 0.16;
  game.cash = 250;
  game.missions.start(0, game);
  game.hud.message('Welcome to Solmara. Steal a car and bring it to Solano Motors.');
  stepFor(game, 3, IDLE, false);
}
