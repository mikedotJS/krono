// Local persistence. Everything stays on the device (localStorage).

const KEYS = {
  sessions: 'krono.v1.sessions',
  history: 'krono.v1.history',
  settings: 'krono.v1.settings',
};

let memory = {};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return key in memory ? memory[key] : fallback;
  }
}

function write(key, value) {
  memory[key] = value;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or quota: keep it in memory for this visit */
  }
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Standard formats offered on first launch. They are regular sessions: editable and deletable.
function defaultSessions() {
  const mk = (nom, prep, rounds, round, repos) => ({
    id: uid(),
    nom,
    prep,
    alerte: 10,
    blocs: [{ id: uid(), nom, rounds, round, repos }],
  });
  return [
    mk('Amateur', 10, 3, 180, 60),
    mk('Professionnel', 10, 12, 180, 60),
  ];
}

export const DEFAULT_SETTINGS = {
  cloche: 'classique', // classique | gong | bip
  alerteSon: 'claquette', // claquette | bip
  volume: 80,
  ecranAllume: true,
};

export function loadSessions() {
  const s = read(KEYS.sessions, null);
  if (Array.isArray(s)) return s;
  const d = defaultSessions();
  write(KEYS.sessions, d);
  return d;
}

export function saveSessions(list) {
  write(KEYS.sessions, list);
}

export function loadHistory() {
  const h = read(KEYS.history, []);
  return Array.isArray(h) ? h : [];
}

export function addHistory(entry) {
  const h = loadHistory();
  h.unshift(entry);
  write(KEYS.history, h.slice(0, 500));
}

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };
}

export function saveSettings(s) {
  write(KEYS.settings, s);
}

/** Wipes everything the app stored on this device. */
export function resetAll() {
  memory = {};
  for (const k of Object.values(KEYS)) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
}
