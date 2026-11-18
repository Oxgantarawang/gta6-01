# Solmara — Street Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Oxgantarawang/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Oxgantarawang/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in the browser, built for the make.fun **gta6-01**
bounty ("Make GTA 6"). No Rockstar names, characters, maps, art or music — everything
here is invented: the sun-soaked coastal city of **Solmara**, the driver **Dario "Dash"
Cole**, the fixer **Vera Solano** who runs Solano Motors, and her rival **Kane Mercer**
of the docks.

## Play

Serve `game/` with any static server (`node serve.ts` → http://localhost:8080) and open
`game/index.html` in desktop Chrome. It plays fully offline — every file it loads lives
under `game/`, including the vendored three.js r128 build.

- **The city**: a procedural grid of roads, sidewalks, varied buildings with lit windows,
  a central plaza with a fountain, the Solano Motors garage, the Hotel Miramar, the
  container docks, a marina with yachts, and a beach where the grid meets the sea.
- **On foot and by car**: third-person character (WASD + mouse orbit, run, jump), cars to
  enter, steal and drive (E, W/S, Space handbrake) — Comet GT sports cars, Bison sedans,
  Mule vans, Sol Cabs, and police Interceptors, each with its own speed and handling.
  Damaged cars smoke.
- **A living city**: traffic AI cruising the road grid, pedestrians strolling the
  sidewalks who flee from gunfire and speeding cars.
- **Wanted system**: 0–5 stars. Steal a car, hurt a civilian or shoot a cop and the
  Solmara PD responds — Interceptors chase and ram, officers get out on foot and bust
  you up close. Lose them and the heat decays; get caught and you pay a fine.
- **Story**: six missions with an arc — steal your first wheels, run deliveries against
  the clock, collect debts from Mercer's thugs, escape a three-star manhunt, take the
  docks, and pull the Miramar Score. Objective markers, a waypoint beam, minimap markers
  and cash rewards; finishing "The Drop" unlocks the pistol.
- **Combat**: fists and a pistol (click to shoot, 1/2 to switch), mission enemies who
  shoot back, tracers and muzzle flash.
- **Feel**: HUD with cash, wanted stars, health, speed, mission objective, message feed
  and a 2D minimap (roads, player, cars, police, mission marker, north). Procedural
  WebAudio sound — engine, sirens, gunshots, pickups and an ambient A-minor groove
  (M mutes). Title screen with story intro, pause (Esc), busted/wasted screens, and
  save/load via localStorage.

## Screenshots

Deterministic scenes staged by `game/src/shots.js` (`?shot=cover|drive|chase|mission`
with a fixed seed — the same seed always gives the same frame):

1. `1-cover.jpg` — on foot in the plaza, the city and the sea ahead.
2. `2-drive.jpg` — driving the Comet GT through traffic.
3. `3-chase.jpg` — a three-star police chase.
4. `4-mission.jpg` — "Dockside War" in progress at the docks.

## Files

| File | Job |
| --- | --- |
| `game/index.html` | Page, HUD DOM, menu screens, loads three.js then the game |
| `game/src/main.js` | Boot, the fixed-step loop, screen flow |
| `game/src/world.js` | The game: player, cars, police, wanted, save, camera |
| `game/src/city.js` | Procedural Solmara: roads, buildings, beach, docks, marina |
| `game/src/vehicles.js` | Car models, traffic AI, arcade driving |
| `game/src/people.js` | Pedestrians, police on foot, mission enemies |
| `game/src/missions.js` | The six-mission story and its state machine |
| `game/src/combat.js` | Pistol, fists, tracers, muzzle flash |
| `game/src/hud.js` | HUD, minimap, menus, message feed |
| `game/src/audio.js` | Procedural WebAudio: engine, sirens, music |
| `game/src/input.js` | Keyboard + mouse-drag camera |
| `game/src/shots.js` | Deterministic screenshot staging |
| `game/src/config.js` | Tuning numbers and city layout |
| `game/src/rng.js` | Seeded random numbers |
| `game/vendor/three.min.js` | three.js r128 (vendored) |
