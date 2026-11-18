// The story of Solmara: Dario "Dash" Cole, new in town and broke, works for Vera Solano,
// who runs Solano Motors and knows everyone worth knowing; Kane Mercer and his crew run
// the docks and want Vera's garage gone. Six missions, each a list of steps the manager
// walks through: reach a place, drive somewhere, fight a crew, or lose the heat. The
// manager only talks to the world through the small `world` interface (player position,
// car state, enemy spawning, wanted level), so the story logic stays in one place.
export const STORY_INTRO =
  'Solmara. Sun, sea, and everybody owes somebody. Dario "Dash" Cole came here with a ' +
  'duffel bag and a debt. Vera Solano runs the garage on the north side and she needs a ' +
  'driver who asks no questions. Kane Mercer runs the docks, and he does not like new faces.';

export const MISSIONS = [
  {
    id: 1, title: 'First Wheels', reward: 400,
    intro: 'Vera: "I need wheels, Dash. Any car on the street will do. Bring it to my garage."',
    steps: [
      { kind: 'enter-car', label: 'Steal a car (walk up to one and press E)' },
      { kind: 'drive', x: -84, z: -117, radius: 9, label: 'Drive to Solano Motors' },
    ],
  },
  {
    id: 2, title: 'The Drop', reward: 600,
    intro: 'Vera: "Three packages, three corners of town. Fast and quiet. The meter is running."',
    unlock: 'Pistol unlocked — press 2 or right-click to aim, left-click to shoot.',
    steps: [
      { kind: 'deliver', points: [[78, 78], [-156, 78], [156, -78]], radius: 8, timeLimit: 150,
        label: 'Deliver the packages' },
    ],
  },
  {
    id: 3, title: 'Collecting Debts', reward: 800,
    intro: 'Vera: "Mercer\'s boys owe me for three engines. Go to the Mercado and collect. They will argue."',
    steps: [
      { kind: 'goto', x: 78, z: -78, radius: 10, label: 'Go to the Mercado' },
      { kind: 'fight', x: 78, z: -78, count: 3, label: 'Deal with Mercer\'s thugs' },
      { kind: 'goto', x: -84, z: -117, radius: 9, label: 'Bring the cash back to Vera' },
    ],
  },
  {
    id: 4, title: 'Heat Wave', reward: 1000,
    intro: 'Vera: "That last job went loud, Dash. The whole force is looking for you. Lose them and get to the safehouse."',
    steps: [
      { kind: 'goto', x: 78, z: -78, radius: 10, label: 'Meet Vera\'s contact at the Mercado' },
      { kind: 'escape', x: 117, z: 117, radius: 9, label: 'Reach the safehouse with the heat on' },
    ],
  },
  {
    id: 5, title: 'Dockside War', reward: 1500,
    intro: 'Vera: "Mercer is moving on the docks tonight. Take his crew apart and the docks are ours."',
    steps: [
      { kind: 'goto', x: 218, z: 0, radius: 12, label: 'Go to the Solmara Docks' },
      { kind: 'fight', x: 218, z: 10, count: 6, label: 'Clear the docks of Mercer\'s crew' },
    ],
  },
  {
    id: 6, title: 'The Miramar Score', reward: 3000,
    intro: 'Vera: "One last job. Kane\'s Comet GT is parked at the Hotel Miramar. Take it, outrun the whole city, and bring it to the marina yacht. Then we are done."',
    steps: [
      { kind: 'goto', x: -156, z: 78, radius: 10, label: 'Go to the Hotel Miramar' },
      { kind: 'enter-car', label: 'Take the Comet GT' },
      { kind: 'chase', x: -140, z: 215, radius: 10, label: 'Outrun the police — deliver the Comet to the marina' },
    ],
  },
];

export function createMissionManager() {
  let active = -1;        // index into MISSIONS, or -1
  let stepIndex = 0;
  let stepTimer = 0;
  let deliverIndex = 0;
  let completed = 0;      // missions finished this save
  let storyDone = false;
  let failed = false;

  function currentDef() { return active >= 0 ? MISSIONS[active] : null; }
  function currentStep() { const def = currentDef(); return def ? def.steps[stepIndex] : null; }

  function setupStep(world) {
    const step = currentStep();
    if (!step) return;
    stepTimer = step.timeLimit || 0;
    deliverIndex = 0;
    if (step.kind === 'fight') world.spawnEnemies(step.x, step.z, step.count);
    if (step.kind === 'escape') world.setWanted(3);
    if (step.kind === 'chase') world.setWanted(4);
  }

  function advance(world, events) {
    stepIndex += 1;
    const def = currentDef();
    if (stepIndex >= def.steps.length) {
      completed += 1;
      world.addCash(def.reward);
      events.push({ type: 'complete', text: `Mission complete: ${def.title} — +$${def.reward}` });
      if (def.unlock) events.push({ type: 'message', text: def.unlock });
      active = -1;
      if (completed >= MISSIONS.length) {
        storyDone = true;
        events.push({ type: 'story', text: 'SOLMARA IS YOURS. Vera owns the docks, Mercer is finished, and the Comet GT is yours. Story complete — keep driving, the city is open.' });
      } else {
        events.push({ type: 'message', text: `Next mission available: ${MISSIONS[completed].title}. Press M to open the mission list, or walk to the yellow marker.` });
      }
      world.onMissionComplete(completed);
    } else {
      setupStep(world);
      events.push({ type: 'step', text: currentStep().label });
    }
  }

  return {
    get active() { return active; },
    get completed() { return completed; },
    get storyDone() { return storyDone; },
    get failed() { return failed; },
    setCompleted(value) { completed = value; storyDone = completed >= MISSIONS.length; },

    /** The next mission the player can start, or null when the story is done. */
    nextMission() { return completed < MISSIONS.length ? MISSIONS[completed] : null; },

    /** Where the next mission begins (first step's place, or its first drop point). */
    nextStartPoint() {
      const next = this.nextMission();
      if (!next) return null;
      const first = next.steps[0];
      if (first.points) return { x: first.points[0][0], z: first.points[0][1] };
      if (first.x !== undefined) return { x: first.x, z: first.z };
      return null;
    },

    start(index, world) {
      return this.startAt(index, 0, world);
    },

    /** Start a mission at a later step (used by the chase screenshot). */
    startAt(index, step, world) {
      if (index < 0 || index >= MISSIONS.length) return false;
      active = index; stepIndex = step; failed = false;
      setupStep(world);
      return true;
    },

    abort() { active = -1; stepIndex = 0; },

    objectiveText() {
      const step = currentStep();
      if (!step) return '';
      if (step.kind === 'deliver') return `${step.label} (${deliverIndex}/${step.points.length})`;
      return step.label;
    },

    /** The world-space waypoint for the HUD arrow and minimap, or null. */
    marker() {
      const step = currentStep();
      if (!step) return null;
      if (step.kind === 'deliver') {
        const p = step.points[deliverIndex];
        return p ? { x: p[0], z: p[1] } : null;
      }
      if (step.kind === 'enter-car') return null;
      return { x: step.x, z: step.z };
    },

    update(dt, world) {
      const events = [];
      const step = currentStep();
      if (!step) return events;
      if (step.timeLimit) {
        stepTimer -= dt;
        if (stepTimer <= 0) {
          failed = true; active = -1;
          events.push({ type: 'failed', text: 'Mission failed — out of time. Talk to Vera to try again.' });
          return events;
        }
      }
      const px = world.player.x, pz = world.player.z;
      const near = (x, z, r) => Math.hypot(px - x, pz - z) < r;
      switch (step.kind) {
        case 'enter-car':
          if (world.playerInCar()) advance(world, events);
          break;
        case 'goto':
        case 'drive':
          if (near(step.x, step.z, step.radius)) advance(world, events);
          break;
        case 'deliver': {
          const p = step.points[deliverIndex];
          if (p && near(p[0], p[1], step.radius)) {
            deliverIndex += 1;
            world.addCash(100);
            events.push({ type: 'message', text: `Package delivered (+$100). ${step.points.length - deliverIndex} left.` });
            if (deliverIndex >= step.points.length) advance(world, events);
          }
          break;
        }
        case 'fight':
          if (world.enemiesAlive() === 0) advance(world, events);
          break;
        case 'escape':
          if (near(step.x, step.z, step.radius)) advance(world, events);
          break;
        case 'chase':
          if (near(step.x, step.z, step.radius)) advance(world, events);
          break;
        default:
          break;
      }
      return events;
    },

    /** Seconds left on a timed step, or 0. */
    timeLeft() {
      const step = currentStep();
      return step && step.timeLimit ? Math.max(0, stepTimer) : 0;
    },
  };
}
