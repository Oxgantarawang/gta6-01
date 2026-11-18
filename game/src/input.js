// Input: keyboard state plus mouse-drag camera orbit and click actions. Keys are read as
// a live set each frame; edge-triggered actions (interact, shoot, pause, weapon switch,
// mute) are queued and taken once by the game loop.
export const ACTION = {
  INTERACT: 1,
  SHOOT: 2,
  PAUSE: 4,
  WEAPON: 8,
  MUTE: 16,
  RESTART: 32,
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let yawDelta = 0;
  let pitchDelta = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let mouseDown = false;
  let mouseDownAt = 0;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyE') actions |= ACTION.INTERACT;
    if (e.code === 'Escape') actions |= ACTION.PAUSE;
    if (e.code === 'Digit1' || e.code === 'Digit2') actions |= ACTION.WEAPON;
    if (e.code === 'KeyM') actions |= ACTION.MUTE;
    if (e.code === 'Enter') actions |= ACTION.RESTART;
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    dragging = true; mouseDown = true; mouseDownAt = performance.now();
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', (e) => {
    dragging = false;
    // A short click (not a drag) on the canvas fires the weapon.
    if (mouseDown && performance.now() - mouseDownAt < 220 && Math.hypot(e.clientX - lastX, e.clientY - lastY) < 6) {
      actions |= ACTION.SHOOT;
    }
    mouseDown = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    yawDelta += (e.clientX - lastX) * 0.005;
    pitchDelta += (e.clientY - lastY) * 0.004;
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    /** Movement keys as -1..1 axes plus drive modifiers. */
    move() {
      return {
        forward: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0),
        strafe: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
        run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        jump: keys.has('Space'),
        handbrake: keys.has('Space'),
        left: keys.has('KeyA') || keys.has('ArrowLeft'),
        right: keys.has('KeyD') || keys.has('ArrowRight'),
      };
    },
    has(code) { return keys.has(code); },
    takeActions() { const a = actions; actions = 0; return a; },
    /** Camera orbit deltas since the last read, in radians. */
    takeOrbit() {
      const out = { yaw: yawDelta, pitch: pitchDelta };
      yawDelta = 0; pitchDelta = 0;
      return out;
    },
  };
}
