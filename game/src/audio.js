// Procedural sound: everything is synthesized with WebAudio (oscillators and filtered
// noise), so the game ships no audio files. Music is a small scheduled bass-and-pad loop
// in A minor; effects are one-shot envelopes. All of it is silent until the first user
// gesture creates the AudioContext, and M toggles mute.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;
  let nextNoteTime = 0;

  // A-minor groove: bass roots per bar, pad chords, a sparse hat tick.
  const BASS = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
  const CHORDS = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 220, 261.63]];

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: two detuned saws through a low-pass, gain follows speed.
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
      engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'square'; engineOsc2.frequency.value = 25;
      engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(engineFilter); engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain); engineGain.connect(master);
      engineOsc.start(); engineOsc2.start();
      // Siren: a triangle that wails between two tones.
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
      startMusic();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function scheduleMusic() {
    if (!ctx) return;
    const stepDur = 0.24;
    while (nextNoteTime < ctx.currentTime + 0.35) {
      const bar = Math.floor(musicStep / 8) % 4;
      const beat = musicStep % 8;
      const t = nextNoteTime;
      // Bass on every beat, octave hop on the off-beats.
      const bassFreq = BASS[bar] * (beat % 2 === 1 ? 2 : 1);
      const bass = ctx.createOscillator(); bass.type = 'triangle'; bass.frequency.value = bassFreq;
      const bassGain = ctx.createGain();
      bassGain.gain.setValueAtTime(0.16, t);
      bassGain.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.9);
      bass.connect(bassGain); bassGain.connect(master);
      bass.start(t); bass.stop(t + stepDur);
      // Pad chord at the top of each bar.
      if (beat === 0) {
        for (const freq of CHORDS[bar]) {
          const pad = ctx.createOscillator(); pad.type = 'sine'; pad.frequency.value = freq;
          const padGain = ctx.createGain();
          padGain.gain.setValueAtTime(0.0001, t);
          padGain.gain.linearRampToValueAtTime(0.045, t + 0.4);
          padGain.gain.linearRampToValueAtTime(0.0001, t + stepDur * 8);
          pad.connect(padGain); padGain.connect(master);
          pad.start(t); pad.stop(t + stepDur * 8);
        }
      }
      // Hat tick on off-beats.
      if (beat % 2 === 1) {
        const hat = ctx.createBufferSource(); hat.buffer = noiseBuffer(0.05);
        const hatFilter = ctx.createBiquadFilter(); hatFilter.type = 'highpass'; hatFilter.frequency.value = 6000;
        const hatGain = ctx.createGain(); hatGain.gain.value = 0.05;
        hat.connect(hatFilter); hatFilter.connect(hatGain); hatGain.connect(master);
        hat.start(t);
      }
      musicStep += 1;
      nextNoteTime += stepDur;
    }
  }

  function startMusic() {
    nextNoteTime = ctx.currentTime + 0.1;
    musicTimer = window.setInterval(scheduleMusic, 120);
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator(); osc.type = type; osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  return {
    unlock() { ensure(); },
    isMuted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** speed 0..1 and whether the engine should be audible at all. */
    setEngine(speed, audible) {
      if (!ctx) return;
      const target = audible ? 0.05 + speed * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(46 + speed * 130, ctx.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(23 + speed * 65, ctx.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(380 + speed * 1400, ctx.currentTime, 0.1);
    },
    setSiren(on, near) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? (near ? 0.045 : 0.02) : 0, ctx.currentTime, 0.2);
      if (on) sirenOsc.frequency.setTargetAtTime((Math.floor(ctx.currentTime * 1.6) % 2 === 0) ? 720 : 960, ctx.currentTime, 0.05);
    },
    gunshot() {
      if (!ctx) return;
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.16);
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 2400;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      src.connect(filter); filter.connect(gain); gain.connect(master);
      src.start();
      blip(120, 0.12, 'sine', 0.4);
    },
    punch() {
      if (!ctx) return;
      blip(90, 0.1, 'sine', 0.35);
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.08);
      const gain = ctx.createGain(); gain.gain.value = 0.25;
      src.connect(gain); gain.connect(master); src.start();
    },
    pickup() { blip(660, 0.12, 'sine', 0.22); blip(990, 0.18, 'sine', 0.22, 0.09); },
    cash() { blip(880, 0.1, 'triangle', 0.2); blip(1174, 0.14, 'triangle', 0.2, 0.08); blip(1568, 0.2, 'triangle', 0.2, 0.16); },
    crash() {
      if (!ctx) return;
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.3);
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 700;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.55, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      src.connect(filter); filter.connect(gain); gain.connect(master);
      src.start();
      blip(70, 0.25, 'sine', 0.4);
    },
    busted() { blip(392, 0.3, 'square', 0.15); blip(311, 0.5, 'square', 0.15, 0.25); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.22, 'triangle', 0.22, i * 0.11)); },
    click() { blip(1200, 0.05, 'sine', 0.15); },
  };
}
