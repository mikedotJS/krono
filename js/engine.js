// Session engine: pure functions, no DOM. Times are in seconds unless noted.

export function fmt(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

export function fmtLong(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const sec = r ? ` ${r < 10 ? '0' : ''}${r}` : '';
  if (h) return `${h} h ${m < 10 ? '0' : ''}${m}`;
  return `${m} min${sec}`;
}

export function blockDuration(b) {
  return b.rounds * b.round + Math.max(0, b.rounds - 1) * b.repos;
}

/**
 * Turns a session into an ordered list of phases.
 * A rest follows every round except the very last one of the session;
 * between two blocks the rest of the finished block is used.
 */
export function buildPhases(session) {
  const phases = [];
  const blocks = (session.blocs || []).filter((b) => b.rounds > 0 && b.round > 0);
  const totalRounds = blocks.reduce((n, b) => n + b.rounds, 0);
  if (session.prep > 0 && totalRounds > 0) {
    phases.push({ kind: 'prep', dur: session.prep });
  }
  let roundIndex = 0;
  blocks.forEach((b, bi) => {
    for (let r = 1; r <= b.rounds; r++) {
      roundIndex++;
      phases.push({
        kind: 'round',
        dur: b.round,
        block: bi,
        blockName: b.nom,
        roundNo: r,
        rounds: b.rounds,
        roundIndex,
        totalRounds,
      });
      const lastOfSession = bi === blocks.length - 1 && r === b.rounds;
      if (!lastOfSession && b.repos > 0) {
        phases.push({ kind: 'rest', dur: b.repos, block: bi, blockName: b.nom, after: roundIndex, totalRounds });
      }
    }
  });
  let t = 0;
  for (const p of phases) {
    p.start = t;
    t += p.dur;
    p.end = t;
  }
  return phases;
}

export function sessionDuration(session) {
  const phases = buildPhases(session);
  return phases.length ? phases[phases.length - 1].end : 0;
}

export function countRounds(session) {
  return (session.blocs || []).reduce((n, b) => n + (b.rounds > 0 && b.round > 0 ? b.rounds : 0), 0);
}

/** Where we are after `elapsed` seconds. */
export function locate(phases, elapsed) {
  if (!phases.length) return { done: true, index: phases.length, remaining: 0, phaseElapsed: 0 };
  const total = phases[phases.length - 1].end;
  if (elapsed >= total) return { done: true, index: phases.length, remaining: 0, phaseElapsed: 0 };
  const e = Math.max(0, elapsed);
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    if (e < p.end) {
      return { done: false, index: i, phaseElapsed: e - p.start, remaining: p.end - e };
    }
  }
  return { done: true, index: phases.length, remaining: 0, phaseElapsed: 0 };
}

/** Rounds fully completed after `elapsed` seconds. */
export function roundsCompleted(phases, elapsed) {
  return phases.filter((p) => p.kind === 'round' && p.end <= elapsed).length;
}

// Wall-clock based clock so time keeps counting even if the page is suspended.
export function createClock(nowMs) {
  return { startMs: nowMs, pausedAtMs: null, pausedTotalMs: 0 };
}

export function clockElapsed(clock, nowMs) {
  const ref = clock.pausedAtMs ?? nowMs;
  return (ref - clock.startMs - clock.pausedTotalMs) / 1000;
}

export function clockPause(clock, nowMs) {
  if (clock.pausedAtMs == null) clock.pausedAtMs = nowMs;
}

export function clockResume(clock, nowMs) {
  if (clock.pausedAtMs != null) {
    clock.pausedTotalMs += nowMs - clock.pausedAtMs;
    clock.pausedAtMs = null;
  }
}

/** Jump so that the clock reads exactly `seconds`. Works while paused too. */
export function clockSeek(clock, seconds, nowMs) {
  const ref = clock.pausedAtMs ?? nowMs;
  clock.startMs = ref - clock.pausedTotalMs - seconds * 1000;
}

/** Sound cues to play when moving from `prev` to `cur` (results of locate). */
export function cuesBetween(phases, prev, cur, alertSeconds) {
  const cues = [];
  if (cur.done) {
    if (!prev || !prev.done) cues.push('end');
    return cues;
  }
  const p = phases[cur.index];
  if (!prev || prev.index !== cur.index) {
    if (p.kind === 'round') cues.push('roundStart');
    else if (p.kind === 'rest') cues.push('roundEnd');
    // Entering a phase never plays its warning retroactively (e.g. after the page was suspended).
    return cues;
  }
  if (alertSeconds > 0 && p.dur > alertSeconds && p.kind !== 'prep') {
    if (prev.remaining > alertSeconds && cur.remaining <= alertSeconds) cues.push('warning');
  }
  return cues;
}
