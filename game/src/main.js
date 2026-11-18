// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the game paints what is there. The game moves between title, play, paused,
// busted, wasted and story screens.
//
// ?seed=N fixes the world. ?shot=cover|drive|chase|mission stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { Game } from './world.js';
import { ACTION, createInput } from './input.js';
import { stageShot } from './shots.js';
import { MISSIONS } from './missions.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = new Game(canvas);
window.__game = game; // handy for debugging and automated smoke tests

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  stageShot(name, game);
  let painted = 0;
  function paint() {
    game.render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  game.reset(seed);
  game.hud.showScreen('title');
  game.hud.setContinueVisible(Game.hasSave());
  game.hud.renderMissionList(MISSIONS, 0);
  announce('Solmara. Press New Game to start.');

  function showTitle() {
    game.screen = 'title';
    game.hud.showScreen('title');
    game.hud.setContinueVisible(Game.hasSave());
    game.hud.renderMissionList(MISSIONS, game.missions.completed);
    announce('Solmara. Title screen.');
  }

  function pauseGame() {
    if (game.screen !== 'play') return;
    game.screen = 'paused';
    game.save();
    game.hud.renderMissionList(game.missionsListForHud(), game.missions.completed);
    game.hud.showScreen('pause');
    announce('Paused.');
  }

  function resumeGame() {
    if (game.screen !== 'paused') return;
    game.screen = 'play';
    game.hud.hideScreens();
    announce('Playing.');
  }

  game.hud.onNewGame(() => { game.audio.unlock(); game.newGame(); announce('Playing. Mission 1: First Wheels.'); });
  game.hud.onContinue(() => { game.audio.unlock(); game.continueGame(); announce('Welcome back to Solmara.'); });
  game.hud.onResume(resumeGame);
  game.hud.onQuit(() => { showTitle(); });
  game.hud.onRespawn(() => { game.respawn(); announce('Back on the street.'); });
  game.hud.onStartMission(() => {
    if (game.startNextMission()) {
      game.screen = 'play';
      game.hud.hideScreens();
      announce('Mission started.');
    }
  });

  function handleActions(actions) {
    if (actions & ACTION.PAUSE) {
      if (game.screen === 'play') pauseGame();
      else if (game.screen === 'paused') resumeGame();
    }
    if (actions & ACTION.RESTART && (game.screen === 'busted' || game.screen === 'wasted')) {
      game.respawn();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Edge-triggered actions are taken once per frame: the pause handler reads them,
    // and the first simulation step gets them (later steps in the same frame get none,
    // so one press never fires twice).
    let frameActions = input.takeActions();
    handleActions(frameActions);
    if (game.screen === 'play') {
      while (accumulator >= STEP) {
        game.step(STEP, input.move(), frameActions, input.takeOrbit());
        frameActions = 0;
        accumulator -= STEP;
      }
    } else if (game.screen === 'title') {
      // Slow orbit around the plaza behind the title screen.
      game.camYaw += 0.0004;
      accumulator = 0;
    } else {
      accumulator = 0;
    }
    game.render();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') pauseGame();
  });

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
