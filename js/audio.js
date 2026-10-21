// Synthesised signals (Web Audio), so the app ships with no sound files.

let ctx = null;
let master = null;

export function unlockAudio() {
  try {
    // iOS 17+: play even when the ring/silent switch is on silent.
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch { /* ignore */ }
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setVolume(percent) {
  if (master) master.gain.value = Math.max(0, Math.min(1, percent / 100)) ** 1.5;
}

function partial(t, freq, gain, decay, type = 'sine') {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + decay + 0.05);
}

function ding(t, kind) {
  if (kind === 'gong') {
    [[110, 0.5, 3.2], [220, 0.25, 2.6], [331, 0.18, 2.2], [447, 0.12, 1.6], [612, 0.06, 1.2]].forEach(([f, g, d]) => partial(t, f, g, d));
  } else if (kind === 'bip') {
    partial(t, 1046, 0.35, 0.22, 'square');
  } else {
    // classic boxing bell: bright, inharmonic partials
    [[1180, 0.5, 1.6], [2440, 0.22, 1.1], [3550, 0.12, 0.7], [590, 0.14, 1.9]].forEach(([f, g, d]) => partial(t, f, g, d));
  }
}

function clap(t) {
  const len = Math.floor(ctx.sampleRate * 0.05);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2200;
  bp.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.value = 1.6;
  src.connect(bp).connect(g).connect(master);
  src.start(t);
}

/**
 * cue: roundStart | roundEnd | warning | end
 */
export function play(cue, settings) {
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  setVolume(settings.volume);
  const t = ctx.currentTime + 0.02;
  const bell = settings.cloche;
  if (cue === 'roundStart') ding(t, bell);
  else if (cue === 'roundEnd') [0, 0.32, 0.64].forEach((d) => ding(t + d, bell));
  else if (cue === 'end') [0, 0.28, 0.56, 0.84, 1.12].forEach((d) => ding(t + d, bell));
  else if (cue === 'warning') {
    if (settings.alerteSon === 'bip') [0, 0.18, 0.36].forEach((d) => partial(t + d, 1568, 0.3, 0.12, 'square'));
    else [0, 0.13, 0.26].forEach((d) => clap(t + d));
  }
}
