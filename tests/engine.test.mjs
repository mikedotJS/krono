import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fmt, fmtLong, buildPhases, sessionDuration, locate, roundsCompleted,
  createClock, clockElapsed, clockPause, clockResume, clockSeek, cuesBetween, countRounds,
} from '../js/engine.js';

const pro = { nom: 'Pro', prep: 0, alerte: 10, blocs: [{ nom: 'Pro', rounds: 12, round: 180, repos: 60 }] };
const twoBlocks = {
  nom: 'Deux blocs', prep: 10, alerte: 10,
  blocs: [
    { nom: 'Échauffement', rounds: 3, round: 120, repos: 30 },
    { nom: 'Sparring', rounds: 6, round: 180, repos: 60 },
  ],
};

test('formats', () => {
  assert.equal(fmt(0), '0:00');
  assert.equal(fmt(9), '0:09');
  assert.equal(fmt(167), '2:47');
  assert.equal(fmtLong(47 * 60), '47 min');
  assert.equal(fmtLong(30 * 60 + 10), '30 min 10');
  assert.equal(fmtLong(3 * 3600 + 5 * 60), '3 h 05');
});

test('12 x 3:00 / 1:00 lasts 47 minutes, no rest after the last round', () => {
  const phases = buildPhases(pro);
  assert.equal(phases.length, 23);
  assert.equal(phases.at(-1).kind, 'round');
  assert.equal(sessionDuration(pro), 47 * 60);
});

test('rest of the finished block is used between blocks, prep comes first', () => {
  const phases = buildPhases(twoBlocks);
  assert.equal(phases[0].kind, 'prep');
  // prep + 3 rounds + 2 rests + 1 rest between blocks + 6 rounds + 5 rests
  assert.equal(phases.length, 1 + 3 + 2 + 1 + 6 + 5);
  const between = phases[6];
  assert.equal(between.kind, 'rest');
  assert.equal(between.dur, 30);
  assert.equal(sessionDuration(twoBlocks), 10 + (3 * 120 + 3 * 30) + (6 * 180 + 5 * 60));
  assert.equal(countRounds(twoBlocks), 9);
});

test('empty or invalid blocks produce no phases', () => {
  assert.deepEqual(buildPhases({ prep: 10, blocs: [] }), []);
  assert.deepEqual(buildPhases({ prep: 10, blocs: [{ rounds: 0, round: 60, repos: 10 }] }), []);
  assert.equal(locate([], 5).done, true);
});

test('locate and rounds completed', () => {
  const phases = buildPhases(pro);
  const at = locate(phases, 13);
  assert.equal(at.index, 0);
  assert.equal(Math.round(at.remaining), 167);
  assert.equal(locate(phases, 185).index, 1); // first rest
  assert.equal(roundsCompleted(phases, 185), 1);
  assert.equal(locate(phases, 47 * 60).done, true);
  assert.equal(roundsCompleted(phases, 47 * 60), 12);
});

test('clock keeps wall time, pauses and seeks', () => {
  const c = createClock(1000);
  assert.equal(clockElapsed(c, 6000), 5);
  clockPause(c, 6000);
  assert.equal(clockElapsed(c, 60000), 5);
  clockResume(c, 60000);
  assert.equal(clockElapsed(c, 61000), 6);
  clockSeek(c, 180, 61000);
  assert.equal(clockElapsed(c, 61000), 180);
  clockPause(c, 62000);
  clockSeek(c, 240, 99000);
  assert.equal(clockElapsed(c, 99000), 240);
  clockResume(c, 100000);
  assert.equal(clockElapsed(c, 101000), 241);
});

test('cues: round start, warning once, round end, end', () => {
  const phases = buildPhases(pro);
  const a = locate(phases, 169.5);
  const b = locate(phases, 170.2);
  assert.deepEqual(cuesBetween(phases, a, b, 10), ['warning']);
  assert.deepEqual(cuesBetween(phases, b, locate(phases, 171), 10), []);
  assert.deepEqual(cuesBetween(phases, b, locate(phases, 180.1), 10), ['roundEnd']);
  assert.deepEqual(cuesBetween(phases, locate(phases, 239.9), locate(phases, 240.1), 10), ['roundStart']);
  assert.deepEqual(cuesBetween(phases, null, locate(phases, 0), 10), ['roundStart']);
  assert.deepEqual(cuesBetween(phases, locate(phases, 2819), locate(phases, 2821), 10), ['end']);
  assert.deepEqual(cuesBetween(phases, a, b, 0), []);
});

test('no warning replayed when landing inside the window after a suspension', () => {
  const phases = buildPhases(pro);
  assert.deepEqual(cuesBetween(phases, locate(phases, 100), locate(phases, 235), 10), ['roundEnd']);
});
