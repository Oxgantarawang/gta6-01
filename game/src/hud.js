// The HUD: DOM panels for cash, wanted stars, health, speed and the mission objective,
// a 2D canvas minimap (roads, beach, player arrow, cars, police, mission marker, north),
// a message feed, a crosshair, and the menu screens (title, pause, busted, wasted, story
// complete). The 3D renderer never touches the DOM; this file owns all of it.
import { CITY, WANTED } from './config.js';

const MAP_SIZE = 184;
const WORLD_SPAN = 520; // world units the minimap covers, centred on (0, 0)

function toMap(x, z) {
  return {
    x: ((x + WORLD_SPAN / 2) / WORLD_SPAN) * MAP_SIZE,
    y: ((z + WORLD_SPAN / 2) / WORLD_SPAN) * MAP_SIZE,
  };
}

export function createHUD() {
  const el = (id) => document.getElementById(id);
  const cashEl = el('hud-cash');
  const starsEl = el('hud-stars');
  const healthFill = el('hud-health-fill');
  const healthText = el('hud-health-text');
  const speedEl = el('hud-speed');
  const objectiveEl = el('hud-objective-text');
  const objectiveTime = el('hud-objective-time');
  const feedEl = el('hud-feed');
  const crosshair = el('hud-crosshair');
  const weaponEl = el('hud-weapon');
  const vignette = el('hud-vignette');
  const minimap = el('hud-minimap');
  const mapCtx = minimap.getContext('2d');
  const screens = {
    title: el('screen-title'),
    pause: el('screen-pause'),
    busted: el('screen-busted'),
    wasted: el('screen-wasted'),
    story: el('screen-story'),
  };
  const titleContinue = el('btn-continue');
  const titleNew = el('btn-new');
  const pauseResume = el('btn-resume');
  const pauseMission = el('btn-mission');
  const pauseQuit = el('btn-quit');
  const bustedRespawn = el('btn-busted');
  const wastedRespawn = el('btn-wasted');
  const storyContinue = el('btn-story');
  const missionList = el('mission-list');
  const saveNote = el('save-note');

  let feedTimer = null;

  function showScreen(name) {
    for (const key of Object.keys(screens)) {
      screens[key].classList.toggle('hidden', key !== name);
    }
    document.getElementById('hud').classList.toggle('hidden', name === 'title');
  }

  function hideScreens() { showScreen(null); }

  function message(text, ms = 5200) {
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.textContent = text;
    feedEl.appendChild(item);
    while (feedEl.children.length > 4) feedEl.removeChild(feedEl.firstChild);
    window.clearTimeout(feedTimer);
    feedTimer = window.setTimeout(() => { feedEl.innerHTML = ''; }, ms);
  }

  function drawMinimap(state) {
    const g = mapCtx;
    g.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    // Sea and sand at the south edge.
    g.fillStyle = '#2f7fb8';
    g.fillRect(0, toMap(0, CITY.waterZ).y, MAP_SIZE, MAP_SIZE);
    g.fillStyle = '#e8d29a';
    g.fillRect(0, toMap(0, CITY.beachZ).y, MAP_SIZE, toMap(0, CITY.waterZ).y - toMap(0, CITY.beachZ).y);
    g.fillStyle = '#5d7a4a';
    g.fillRect(0, 0, MAP_SIZE, toMap(0, CITY.beachZ).y);
    // Roads.
    g.strokeStyle = '#3a3f46';
    g.lineWidth = 5;
    for (const c of CITY.roads) {
      const p = toMap(c * CITY.pitch, 0);
      g.beginPath(); g.moveTo(p.x, 0); g.lineTo(p.x, MAP_SIZE); g.stroke();
      const q = toMap(0, c * CITY.pitch);
      g.beginPath(); g.moveTo(0, q.y); g.lineTo(MAP_SIZE, q.y); g.stroke();
    }
    // Docks.
    g.fillStyle = '#5a6b7a';
    g.fillRect(toMap(200, -55).x, toMap(200, -55).y, 14, 18);
    // Mission marker.
    if (state.marker) {
      const m = toMap(state.marker.x, state.marker.z);
      const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.25;
      g.fillStyle = '#ffd23e';
      g.beginPath();
      g.arc(m.x, m.y, 6 * pulse, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#7a5c00'; g.lineWidth = 2; g.stroke();
    }
    // Cars and police.
    for (const car of state.cars) {
      const p = toMap(car.x, car.z);
      g.fillStyle = car.isPolice ? '#3a86ff' : '#ffe9a8';
      g.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    // Player arrow (north is up, -z).
    const p = toMap(state.player.x, state.player.z);
    g.save();
    g.translate(p.x, p.y);
    g.rotate(Math.PI - state.player.heading);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2); g.lineTo(-5, 5); g.closePath();
    g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 1; g.stroke();
    g.restore();
    // North.
    g.fillStyle = '#ffffff';
    g.font = 'bold 13px system-ui, sans-serif';
    g.fillText('N', MAP_SIZE - 14, 15);
  }

  return {
    showScreen, hideScreens, message,
    setCash(value) { cashEl.textContent = `$${Math.floor(value).toLocaleString('en-US')}`; },
    setStars(n) {
      starsEl.textContent = '★'.repeat(n) + '☆'.repeat(WANTED.maxStars - n);
      starsEl.classList.toggle('hot', n > 0);
    },
    setHealth(hp, max) {
      const pct = Math.max(0, Math.round((hp / max) * 100));
      healthFill.style.width = `${pct}%`;
      healthText.textContent = `${pct}`;
      healthFill.classList.toggle('low', pct <= 30);
    },
    setSpeed(kmh, inCar) {
      speedEl.textContent = inCar ? `${Math.round(kmh)} km/h` : '';
    },
    setObjective(text, timeLeft) {
      objectiveEl.textContent = text || '';
      objectiveTime.textContent = timeLeft > 0 ? `${Math.ceil(timeLeft)}s` : '';
    },
    setWeapon(name) { weaponEl.textContent = name; },
    setCrosshair(visible) { crosshair.classList.toggle('hidden', !visible); },
    flashDamage() {
      vignette.classList.remove('flash');
      void vignette.offsetWidth;
      vignette.classList.add('flash');
    },
    drawMinimap,
    setContinueVisible(visible) { titleContinue.classList.toggle('hidden', !visible); },
    setSaveNote(text) { saveNote.textContent = text; },
    renderMissionList(missions, completed) {
      missionList.innerHTML = '';
      missions.forEach((m, i) => {
        const row = document.createElement('div');
        row.className = 'mission-row' + (i < completed ? ' done' : i === completed ? ' next' : '');
        row.textContent = `${i < completed ? '✓' : i === completed ? '▶' : '·'} ${m.id}. ${m.title} — $${m.reward}`;
        missionList.appendChild(row);
      });
    },
    onNewGame(fn) { titleNew.addEventListener('click', fn); },
    onContinue(fn) { titleContinue.addEventListener('click', fn); },
    onResume(fn) { pauseResume.addEventListener('click', fn); },
    onStartMission(fn) { pauseMission.addEventListener('click', fn); },
    onQuit(fn) { pauseQuit.addEventListener('click', fn); },
    onRespawn(fn) {
      bustedRespawn.addEventListener('click', fn);
      wastedRespawn.addEventListener('click', fn);
      storyContinue.addEventListener('click', fn);
    },
  };
}
