import {
  fmt, fmtLong, buildPhases, sessionDuration, countRounds, locate, roundsCompleted,
  createClock, clockElapsed, clockPause, clockResume, clockSeek, cuesBetween, blockDuration,
} from './engine.js';
import {
  uid, loadSessions, saveSessions, loadHistory, addHistory, loadSettings, saveSettings, resetAll,
} from './store.js';
import { unlockAudio, play } from './audio.js';

const app = document.getElementById('app');

const state = {
  view: 'home', // home | edit | run | done | history | settings
  sessions: loadSessions(),
  history: loadHistory(),
  settings: loadSettings(),
  draft: null,
  undo: null,
  run: null,
  done: null,
};

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const ICON = {
  plus: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C6FF3D" stroke-width="1.6" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  minus: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5F5F4" stroke-width="1.6" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  plusW: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5F5F4" stroke-width="1.6" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  arrow: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6FF3D" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>',
  check: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6FF3D" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  back: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5F5F4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  chevDown: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(245,245,244,0.7)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  trash: (c) => `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/></svg>`,
  replay: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C6FF3D" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>',
  timer: (c) => `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M10 2h4"/></svg>`,
  chart: (c) => `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M21 19H3"/></svg>`,
  sliders: (c) => `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h4"/><path d="M12 17h8"/><circle cx="10" cy="17" r="2"/></svg>`,
  pause: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#050505" stroke-width="1.8" stroke-linecap="round"><path d="M9 6v12"/><path d="M15 6v12"/></svg>',
  left: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#050505" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/></svg>',
  play: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="#C6FF3D"><path d="M8 5.5v13l11-6.5z"/></svg>',
};

function summary(s) {
  const blocs = s.blocs || [];
  if (blocs.length === 1) {
    const b = blocs[0];
    return `${b.rounds} round${b.rounds > 1 ? 's' : ''} · ${fmt(b.round)} · repos ${fmt(b.repos)}`;
  }
  const n = countRounds(s);
  return `${blocs.length} blocs · ${n} round${n > 1 ? 's' : ''}`;
}

function shortSummary(s) {
  const blocs = s.blocs || [];
  if (blocs.length === 1) {
    const b = blocs[0];
    return `${b.rounds} × ${fmt(b.round)} · ${fmt(b.repos)}`;
  }
  return `${blocs.length} blocs · ${countRounds(s)} rounds`;
}

function timeline(s) {
  const phases = buildPhases(s).filter((p) => p.kind !== 'prep');
  if (!phases.length) return '';
  const max = 60;
  const step = phases.length > max ? Math.ceil(phases.length / max) : 1;
  return `<div class="timeline" aria-hidden="true">${phases
    .filter((_, i) => i % step === 0)
    .map((p) => `<i class="${p.kind === 'round' ? 'r' : 'p'}" style="flex:${p.dur} 1 0"></i>`)
    .join('')}</div>`;
}

function nav(current) {
  const item = (view, label, icon) => {
    const on = current === view;
    return `<button data-action="go" data-view="${view}" ${on ? 'aria-current="page"' : `aria-label="${label}"`}>${icon(on ? '#C6FF3D' : 'rgba(245,245,244,0.75)')}${on ? label : ''}</button>`;
  };
  return `<nav class="island" aria-label="Navigation principale">${item('home', 'Séances', ICON.timer)}${item('history', 'Historique', ICON.chart)}${item('settings', 'Réglages', ICON.sliders)}</nav>`;
}

// ---------- views ----------
function viewHome() {
  const { sessions, history } = state;
  if (!sessions.length) {
    return `<section class="screen">
      <span class="eyebrow">Séances</span>
      <div class="head"><h1 class="title">Choisis ta séance</h1>
        <button class="icon-btn" data-action="new" aria-label="Nouvelle séance">${ICON.plus}</button></div>
      <div class="bezel"><div class="core empty">
        <p style="margin:0;font-size:18px;font-weight:600">Aucune séance</p>
        <button class="pill" data-action="new">Créer une séance<span class="knob">${ICON.plus}</span></button>
      </div></div>
    </section>${nav('home')}`;
  }
  const lastId = history.find((h) => sessions.some((s) => s.id === h.sessionId))?.sessionId;
  const featured = sessions.find((s) => s.id === lastId) || sessions[0];
  const others = sessions.filter((s) => s !== featured);
  const cards = others.map((s, i) => {
    const wide = others.length % 2 === 1 && i === others.length - 1;
    return `<div class="bezel ${wide ? 'wide' : ''}" style="border-radius:28px">
      <button class="unset card-btn" data-action="start" data-press="${s.id}" data-id="${s.id}" style="${wide ? 'min-height:84px' : ''}">
        <span class="card-name">${esc(s.nom)}</span>
        <span class="stack" style="gap:3px"><span class="card-meta num">${shortSummary(s)}</span><span class="card-meta num">${fmtLong(sessionDuration(s))}</span></span>
      </button></div>`;
  }).join('');
  return `<section class="screen">
    <span class="eyebrow">Séances</span>
    <div class="head"><h1 class="title">Choisis ta séance</h1>
      <button class="icon-btn" data-action="new" aria-label="Nouvelle séance">${ICON.plus}</button></div>
    <div class="bezel" data-press="${featured.id}" style="user-select:none;-webkit-user-select:none;-webkit-touch-callout:none">
      <div class="core hero">
        <div class="row between"><h2 style="margin:0;font-size:26px;font-weight:600;letter-spacing:-0.03em;overflow-wrap:anywhere">${esc(featured.nom)}</h2>
          ${lastId ? '<span class="badge">Dernière</span>' : ''}</div>
        <p class="num" style="margin:-10px 0 0;font-size:15px;color:var(--muted)">${summary(featured)}</p>
        ${timeline(featured)}
        <div class="row between">
          <div class="stack" style="gap:2px"><span style="font-size:12px;color:var(--faint)">Durée totale</span>
            <span class="num" style="font-size:30px;font-weight:700;letter-spacing:-0.03em">${fmtLong(sessionDuration(featured))}</span></div>
          <button class="pill" data-action="start" data-id="${featured.id}">Lancer<span class="knob">${ICON.arrow}</span></button>
        </div>
      </div>
    </div>
    ${others.length ? `<div class="grid2">${cards}</div>` : ''}
  </section>${nav('home')}`;
}

function blankBloc(n) {
  return { id: uid(), nom: `Bloc ${n}`, rounds: 3, round: 180, repos: 60 };
}

function openEditor(session) {
  state.draft = session
    ? { ...structuredClone(session), existing: true, ouvert: 0 }
    : { id: uid(), nom: '', prep: 10, alerte: 10, blocs: [blankBloc(1)], existing: false, ouvert: 0 };
  clearUndo();
  state.view = 'edit';
  render();
  window.scrollTo(0, 0);
}

function stepper(label, value, field, bloc, canDown, canUp) {
  const b = bloc == null ? '' : `data-bloc="${bloc}"`;
  return `<div class="stepper">
    <button class="step" data-action="step" data-field="${field}" ${b} data-delta="-1" aria-label="${label} : moins" ${canDown ? '' : 'disabled'}>${ICON.minus}</button>
    <span class="step-val" aria-live="polite">${value}</span>
    <button class="step" data-action="step" data-field="${field}" ${b} data-delta="1" aria-label="${label} : plus" ${canUp ? '' : 'disabled'}>${ICON.plusW}</button>
  </div>`;
}

const LIMITS = {
  prep: { min: 0, max: 120, step: 5 },
  rounds: { min: 1, max: 30, step: 1 },
  round: { min: 15, max: 900, step: 15 },
  repos: { min: 0, max: 600, step: 15 },
};

function viewEdit() {
  const d = state.draft;
  const alertes = [[0, 'Aucun'], [5, '5 s'], [10, '10 s'], [15, '15 s']];
  const blocs = d.blocs.map((b, i) => {
    const dur = fmtLong(blockDuration(b));
    if (d.ouvert === i) {
      return `<div class="bezel hot"><div class="core pad stack" style="gap:12px">
        <div class="row" style="gap:14px">
          <span class="num-badge" aria-hidden="true">${i + 1}</span>
          <label class="sr" for="bn-${b.id}">Nom du bloc ${i + 1}</label>
          <input class="bloc-name" id="bn-${b.id}" data-input="bloc-name" data-bloc="${i}" value="${esc(b.nom)}" maxlength="40" autocomplete="off">
          <span class="num muted" style="flex-shrink:0;font-size:13px">${dur}</span>
          <button class="unset" data-action="del-bloc" data-bloc="${i}" aria-label="Supprimer ${esc(b.nom)}" style="flex-shrink:0;width:44px;height:44px;margin:-6px -8px -6px 0;border-radius:50%;display:flex;align-items:center;justify-content:center">${ICON.trash('#FF5B2E')}</button>
        </div>
        <div class="row between"><span style="font-size:15px;color:rgba(245,245,244,0.82)">Rounds</span>${stepper('Rounds', b.rounds, 'rounds', i, b.rounds > LIMITS.rounds.min, b.rounds < LIMITS.rounds.max)}</div>
        <div class="row between"><span style="font-size:15px;color:rgba(245,245,244,0.82)">Durée du round</span>${stepper('Durée du round', fmt(b.round), 'round', i, b.round > LIMITS.round.min, b.round < LIMITS.round.max)}</div>
        <div class="row between"><span style="font-size:15px;color:rgba(245,245,244,0.82)">Repos</span>${stepper('Repos', fmt(b.repos), 'repos', i, b.repos > LIMITS.repos.min, b.repos < LIMITS.repos.max)}</div>
      </div></div>`;
    }
    return `<div class="swipe-wrap">
      <button class="swipe-del" data-action="del-bloc" data-bloc="${i}" tabindex="-1" aria-hidden="true">${ICON.trash('#050505')}Supprimer</button>
      <div class="swipe-layer bezel" data-swipe="${i}">
        <button class="unset core pad row" data-action="open-bloc" data-bloc="${i}" aria-label="Modifier ${esc(b.nom)}" style="width:100%;gap:14px">
          <span class="num-badge" aria-hidden="true">${i + 1}</span>
          <span class="grow stack" style="gap:2px"><span style="font-size:16px;font-weight:600;overflow-wrap:anywhere">${esc(b.nom)}</span>
            <span class="num muted" style="font-size:13px">${b.rounds} × ${fmt(b.round)} · repos ${fmt(b.repos)} · ${dur}</span></span>
          ${ICON.chevDown}
        </button>
      </div></div>`;
  }).join('');
  const total = sessionDuration(d);
  return `<section class="screen" style="padding-bottom:calc(var(--safe-b) + 150px)">
    <div class="row between">
      <button class="icon-btn" data-action="go" data-view="home" aria-label="Retour aux séances" style="width:44px;height:44px">${ICON.back}</button>
      <span class="eyebrow" style="align-self:center">${d.existing ? 'Modifier la séance' : 'Nouvelle séance'}</span>
      <span style="width:44px" aria-hidden="true"></span>
    </div>
    <div class="stack" style="gap:6px;margin-top:6px">
      <label for="nom" style="font-size:12px;color:var(--faint)">Nom de la séance</label>
      <input class="name-input" id="nom" data-input="nom" value="${esc(d.nom)}" placeholder="Nouvelle séance" maxlength="40" autocomplete="off">
    </div>
    <div class="bezel" style="margin-top:6px"><div class="core pad stack" style="gap:14px">
      <div class="row between">
        <span class="stack" style="gap:2px"><span class="label-main">Préparation</span><span class="label-sub">Avant le 1er round</span></span>
        ${stepper('Préparation', fmt(d.prep), 'prep', null, d.prep > LIMITS.prep.min, d.prep < LIMITS.prep.max)}
      </div>
      <div class="sep"></div>
      <div class="stack" style="gap:10px">
        <span class="stack" style="gap:2px"><span class="label-main" id="lbl-alerte">Signal avant la fin</span><span class="label-sub">Rounds et repos</span></span>
        <div class="seg" role="radiogroup" aria-labelledby="lbl-alerte">
          ${alertes.map(([v, l]) => `<button role="radio" aria-checked="${d.alerte === v}" data-action="alerte" data-value="${v}">${l}</button>`).join('')}
        </div>
      </div>
    </div></div>
    <div class="row between" style="align-items:baseline"><h2 class="h2">Blocs</h2><span class="label-sub">Enchaînés dans l'ordre</span></div>
    ${blocs}
    <button class="unset ghost" data-action="add-bloc">${ICON.plus}Ajouter un bloc</button>
    ${d.existing ? `<button class="unset ghost danger" data-action="del-session" style="margin-top:12px">${ICON.trash('#FF5B2E')}Supprimer la séance</button>` : ''}
  </section>
  ${state.undo ? `<div class="toast" role="status"><span>« ${esc(state.undo.bloc.nom)} » supprimé</span><button data-action="undo">Annuler</button></div>` : ''}
  <div class="bar">
    <span class="stack" style="gap:1px"><span style="font-size:11px;color:var(--faint)">Total</span><span class="num" style="font-size:20px;font-weight:700;letter-spacing:-0.02em">${fmtLong(total)}</span></span>
    <button class="pill" data-action="save" ${d.blocs.length ? '' : 'aria-disabled="true"'}>Enregistrer<span class="knob" style="width:40px;height:40px">${ICON.check}</span></button>
  </div>`;
}

function weekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
function niceDate(iso) {
  const s = dateFmt.format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function viewHistory() {
  const h = state.history;
  let body;
  if (!h.length) {
    body = `<div class="bezel"><div class="core empty"><p style="margin:0;font-size:18px;font-weight:600">Aucune séance pour l'instant</p>
      <button class="pill" data-action="go" data-view="home">Voir les séances<span class="knob">${ICON.arrow}</span></button></div></div>`;
  } else {
    const thisWeek = weekStart(Date.now());
    const lastWeek = thisWeek - 7 * 86400000;
    const groups = [['Cette semaine', []], ['Semaine dernière', []], ['Plus tôt', []]];
    h.forEach((e, i) => {
      const t = new Date(e.date).getTime();
      groups[t >= thisWeek ? 0 : t >= lastWeek ? 1 : 2][1].push([e, i]);
    });
    body = groups.filter(([, l]) => l.length).map(([title, list]) => `
      <h2 class="section-label">${title}</h2>
      <div class="bezel"><div class="core stack divided">
        ${list.map(([e, i]) => {
          const ok = !e.arretee;
          const pct = e.roundsPrevus ? Math.round((e.roundsFaits / e.roundsPrevus) * 100) : 0;
          return `<div class="hist-row">
            <div class="grow stack" style="gap:6px">
              <span style="font-size:12px;color:var(--faint)">${niceDate(e.date)}</span>
              <span style="font-size:17px;font-weight:600;letter-spacing:-0.02em;overflow-wrap:anywhere">${esc(e.nom)}</span>
              <div class="row" style="gap:10px"><div class="prog" aria-hidden="true"><i style="width:${pct}%;background:${ok ? 'var(--lime)' : 'var(--rest)'}"></i></div>
              <span class="num" style="font-size:13px;color:rgba(245,245,244,0.72)">${e.roundsFaits}/${e.roundsPrevus} rounds · ${fmtLong(e.duree)}${ok ? '' : ' · arrêtée'}</span></div>
            </div>
            <button class="icon-btn" data-action="replay" data-index="${i}" aria-label="Relancer ${esc(e.nom)}" style="width:48px;height:48px">${ICON.replay}</button>
          </div>`;
        }).join('')}
      </div></div>`).join('');
  }
  return `<section class="screen"><span class="eyebrow">Historique</span><h1 class="title" style="margin-bottom:6px">Tes séances</h1>${body}</section>${nav('history')}`;
}

function viewSettings() {
  const s = state.settings;
  const opt = (v, cur, l) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`;
  return `<section class="screen">
    <span class="eyebrow">Réglages</span>
    <h1 class="title" style="margin-bottom:6px">Ta salle, tes signaux</h1>
    <h2 class="section-label">Sons</h2>
    <div class="bezel"><div class="core stack divided">
      <label class="set-row"><span class="grow label-main" style="font-weight:500">Cloche de round</span>
        <select data-setting="cloche">${opt('classique', s.cloche, 'Cloche classique')}${opt('gong', s.cloche, 'Gong')}${opt('bip', s.cloche, 'Bip')}</select></label>
      <label class="set-row"><span class="grow label-main" style="font-weight:500">Signal d'alerte</span>
        <select data-setting="alerteSon">${opt('claquette', s.alerteSon, 'Triple claquette')}${opt('bip', s.alerteSon, 'Triple bip')}</select></label>
      <div style="padding:14px 18px 16px" class="stack">
        <div class="row between"><label for="volume" class="label-main" style="font-weight:500">Volume des signaux</label><span class="num muted" style="font-size:14px" id="vol-val">${s.volume} %</span></div>
        <input id="volume" type="range" min="0" max="100" step="5" value="${s.volume}" data-setting="volume" style="margin-top:10px">
      </div>
      <button class="unset set-row" data-action="test-sound" style="width:100%"><span class="grow label-main" style="font-weight:500">Écouter les signaux</span>${ICON.play}</button>
    </div></div>
    <h2 class="section-label">Enceinte et musique</h2>
    <div class="bezel"><div class="core stack">
      <div class="set-row"><span class="grow stack" style="gap:2px"><span class="label-main" style="font-weight:500">Sortie audio</span><span class="label-sub">Choisie depuis le Centre de contrôle de l'iPhone</span></span></div>
    </div></div>
    <h2 class="section-label">Affichage et gestes</h2>
    <div class="bezel"><div class="core stack divided">
      <div class="set-row"><span class="grow label-main" style="font-weight:500" id="lbl-ecran">Écran toujours allumé</span>
        <button class="switch" role="switch" aria-checked="${s.ecranAllume}" aria-labelledby="lbl-ecran" data-action="toggle" data-setting="ecranAllume"></button></div>
      <div class="set-row"><span class="grow label-main" style="font-weight:500">Toucher l'écran</span><span class="muted" style="font-size:14px">Pause</span></div>
      <div class="set-row"><span class="grow label-main" style="font-weight:500">Glisser vers la gauche</span><span class="muted" style="font-size:14px">Phase suivante</span></div>
    </div></div>
    <h2 class="section-label">Données</h2>
    <div class="bezel"><div class="core stack">
      <button class="unset set-row danger" data-action="reset" style="width:100%"><span class="grow label-main" style="font-weight:500">Réinitialiser l'app</span>${ICON.trash('#FF5B2E')}</button>
    </div></div>
  </section>${nav('settings')}`;
}

function viewDone() {
  const d = state.done;
  return `<section class="screen" style="justify-content:center;min-height:100dvh">
    <span class="eyebrow">${d.arretee ? 'Séance arrêtée' : 'Séance terminée'}</span>
    <h1 class="title" style="overflow-wrap:anywhere">${esc(d.nom)}</h1>
    <div class="bezel"><div class="core hero">
      <span class="done-time num">${fmt(d.duree)}</span>
      <span class="num muted" style="font-size:16px">${d.roundsFaits}/${d.roundsPrevus} rounds</span>
    </div></div>
    <div class="row" style="gap:12px;flex-wrap:wrap">
      <button class="pill" data-action="replay-done">Relancer<span class="knob">${ICON.replay}</span></button>
      <button class="unset ghost" data-action="go" data-view="home" style="width:auto;padding:0 22px">Retour aux séances</button>
    </div>
  </section>`;
}

// ---------- rendering ----------
function render() {
  if (state.view === 'run') return; // the run screen manages its own DOM
  const html = { home: viewHome, edit: viewEdit, history: viewHistory, settings: viewSettings, done: viewDone }[state.view]();
  app.innerHTML = html;
}

function go(view) {
  if (view !== 'edit') { state.draft = null; clearUndo(); }
  state.view = view;
  render();
  window.scrollTo(0, 0);
}

// ---------- editor actions ----------
function clearUndo() {
  if (state.undo?.timer) clearTimeout(state.undo.timer);
  state.undo = null;
}

function deleteBloc(i) {
  const d = state.draft;
  const bloc = d.blocs[i];
  if (!bloc) return;
  clearUndo();
  const prevOpen = d.ouvert;
  d.blocs.splice(i, 1);
  d.ouvert = prevOpen === i ? -1 : prevOpen > i ? prevOpen - 1 : prevOpen;
  state.undo = { bloc, index: i, ouvert: prevOpen, timer: setTimeout(() => { state.undo = null; if (state.view === 'edit') render(); }, 5000) };
  render();
}

function undoDelete() {
  const u = state.undo;
  if (!u || !state.draft) return;
  clearTimeout(u.timer);
  state.draft.blocs.splice(u.index, 0, u.bloc);
  state.draft.ouvert = u.ouvert;
  state.undo = null;
  render();
}

function saveDraft() {
  const d = state.draft;
  if (!d.blocs.length) return;
  const session = {
    id: d.id,
    nom: d.nom.trim() || 'Nouvelle séance',
    prep: d.prep,
    alerte: d.alerte,
    blocs: d.blocs.map((b, i) => ({ ...b, nom: (b.nom || '').trim() || `Bloc ${i + 1}` })),
  };
  const i = state.sessions.findIndex((s) => s.id === d.id);
  if (i >= 0) state.sessions[i] = session;
  else state.sessions.unshift(session);
  saveSessions(state.sessions);
  go('home');
}

// ---------- run ----------
let wakeLock = null;
async function lockScreen() {
  if (!state.settings.ecranAllume || !('wakeLock' in navigator)) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch { wakeLock = null; }
}
function unlockScreen() {
  try { wakeLock?.release(); } catch { /* ignore */ }
  wakeLock = null;
}

function startSession(session) {
  const snapshot = structuredClone(session);
  const phases = buildPhases(snapshot);
  if (!phases.length) return;
  unlockAudio();
  state.run = { session: snapshot, phases, clock: createClock(Date.now()), last: null, renderedIndex: -1, paused: false, raf: 0 };
  state.view = 'run';
  lockScreen();
  app.innerHTML = '<div class="run" id="run"><div class="fill" id="fill"></div><div class="content" id="run-content"></div></div>';
  attachRunGestures(document.getElementById('run'));
  tick();
}

function phaseLabel(p, phases, idx) {
  const next = phases[idx + 1];
  let after;
  if (!next) after = 'Ensuite : fin de séance';
  else if (next.kind === 'rest') after = `Ensuite : repos ${fmt(next.dur)}`;
  else after = `Ensuite : round ${next.roundIndex}${next.block !== p.block && next.blockName ? ` · ${esc(next.blockName)}` : ''} · ${fmt(next.dur)}`;
  return after;
}

function renderRunPhase(run, at) {
  const p = run.phases[at.index];
  const multi = (run.session.blocs || []).length > 1;
  const content = document.getElementById('run-content');
  const runEl = document.getElementById('run');
  runEl.classList.remove('round', 'rest', 'prep', 'alert');
  runEl.classList.add(p.kind);
  let top;
  if (p.kind === 'round') {
    const showDots = p.rounds <= 18;
    const dots = showDots ? Array.from({ length: p.rounds }, (_, k) => `<i class="${k + 1 < p.roundNo ? 'done' : k + 1 === p.roundNo ? 'now' : ''}"></i>`).join('') : '';
    top = `<div class="row between" style="align-items:flex-end;gap:16px">
      <div class="stack" style="gap:2px">${multi ? `<span class="block-name">${esc(p.blockName)}</span>` : ''}<span class="kicker">Round</span>
        <span class="big-count">${p.roundIndex}<small>/${p.totalRounds}</small></span></div>
      ${showDots ? `<div class="dots" aria-hidden="true">${dots}</div>` : ''}</div>`;
  } else {
    const next = run.phases[at.index + 1];
    const nextTxt = next ? `Round ${next.roundIndex} sur ${next.totalRounds}` : 'Fin de séance';
    top = `<div class="stack" style="gap:6px"><span class="kicker">${p.kind === 'prep' ? 'Préparation' : 'Repos'}</span>
      <span class="next-title">${p.kind === 'prep' ? 'Premier : ' : 'Prochain : '}${nextTxt.toLowerCase()}</span></div>`;
  }
  content.innerHTML = `${top}
    <div class="stack" style="gap:14px">
      <span class="alert-pill" id="alert-pill" hidden>${run.session.alerte} dernières secondes</span>
      <span class="time" id="time" role="timer" aria-live="off">${fmt(Math.ceil(at.remaining))}</span>
      <span class="after">${phaseLabel(p, run.phases, at.index)}</span>
    </div>
    <div class="chips"><span class="chip">${ICON.pause}Touche : pause</span><span class="chip">${ICON.left}Glisse : phase suivante</span></div>
    ${run.paused ? pauseOverlay(at) : ''}`;
  run.renderedIndex = at.index;
  run.renderedPaused = run.paused;
}

function pauseOverlay(at) {
  return `<div class="pause" id="pause" role="dialog" aria-label="Séance en pause">
    <span class="kicker" style="color:var(--faint)">En pause</span>
    <span class="time-p">${fmt(Math.ceil(at.remaining))}</span>
    <div class="actions">
      <button class="pill" data-action="resume">Reprendre<span class="knob">${ICON.play}</span></button>
      <button class="stop-btn" data-action="stop">Arrêter la séance</button>
    </div></div>`;
}

function tick() {
  const run = state.run;
  if (!run) return;
  const now = Date.now();
  const elapsed = clockElapsed(run.clock, now);
  const at = locate(run.phases, elapsed);
  for (const cue of cuesBetween(run.phases, run.last, at, run.session.alerte)) play(cue, state.settings);
  run.last = at;
  if (at.done) return finishRun(false);
  if (at.index !== run.renderedIndex || run.paused !== run.renderedPaused) renderRunPhase(run, at);
  const p = run.phases[at.index];
  const ratio = clamp(at.remaining / p.dur, 0, 1);
  const alerting = run.session.alerte > 0 && p.kind !== 'prep' && p.dur > run.session.alerte && at.remaining <= run.session.alerte;
  const runEl = document.getElementById('run');
  runEl.classList.toggle('alert', alerting);
  document.getElementById('alert-pill').hidden = !alerting;
  document.getElementById('fill').style.transform = `translateY(${alerting ? 0 : (1 - ratio) * 100}%)`;
  const t = fmt(Math.ceil(at.remaining));
  const timeEl = document.getElementById('time');
  if (timeEl.textContent !== t) timeEl.textContent = t;
  run.raf = requestAnimationFrame(tick);
}

function togglePause() {
  const run = state.run;
  if (!run) return;
  const now = Date.now();
  if (run.paused) { clockResume(run.clock, now); run.paused = false; unlockAudio(); }
  else { clockPause(run.clock, now); run.paused = true; }
}

function skipPhase() {
  const run = state.run;
  if (!run || run.paused) return;
  const now = Date.now();
  const at = locate(run.phases, clockElapsed(run.clock, now));
  if (at.done) return;
  clockSeek(run.clock, run.phases[at.index].end + 0.001, now);
}

function finishRun(stopped) {
  const run = state.run;
  if (!run) return;
  cancelAnimationFrame(run.raf);
  const elapsed = Math.min(clockElapsed(run.clock, Date.now()), run.phases.at(-1).end);
  const entry = {
    id: uid(),
    sessionId: run.session.id,
    nom: run.session.nom,
    date: new Date().toISOString(),
    roundsFaits: stopped ? roundsCompleted(run.phases, elapsed) : countRounds(run.session),
    roundsPrevus: countRounds(run.session),
    duree: Math.round(stopped ? elapsed : run.phases.at(-1).end),
    arretee: stopped,
    session: run.session,
  };
  state.run = null;
  unlockScreen();
  const worthLogging = !stopped || entry.roundsFaits > 0 || elapsed >= 30;
  if (worthLogging) {
    addHistory(entry);
    state.history = loadHistory();
  }
  state.done = entry;
  state.view = 'done';
  render();
}

function attachRunGestures(el) {
  let start = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#pause')) return;
    start = { x: e.clientX, y: e.clientY };
  });
  el.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (dx < -60 && Math.abs(dy) < 90) skipPhase();
    else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) togglePause();
  });
  el.addEventListener('pointercancel', () => { start = null; });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.run) lockScreen();
});

// ---------- long press on session cards ----------
let press = null;
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-press]');
  if (!el || state.view !== 'home') return;
  press = {
    id: el.dataset.press, x: e.clientX, y: e.clientY, fired: false,
    timer: setTimeout(() => {
      press.fired = true;
      const s = state.sessions.find((x) => x.id === press.id);
      if (s) openEditor(s);
    }, 550),
  };
});
document.addEventListener('pointermove', (e) => {
  if (press && !press.fired && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) { clearTimeout(press.timer); press = null; }
});
['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, () => {
  if (!press) return;
  if (!press.fired) { clearTimeout(press.timer); press = null; return; }
  // Let the click that follows this pointerup be swallowed, then forget the long press.
  setTimeout(() => { press = null; }, 0);
}));
document.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-press]')) e.preventDefault(); });

// ---------- swipe to delete a collapsed block ----------
let drag = null;
let openSwipe = null;
document.addEventListener('pointerdown', (e) => {
  const layer = e.target.closest('[data-swipe]');
  if (!layer || state.view !== 'edit') return;
  const i = Number(layer.dataset.swipe);
  drag = { layer, i, x0: e.clientX, y0: e.clientY, base: openSwipe === i ? -96 : 0, moved: false, dx: 0 };
});
document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x0;
  const dy = e.clientY - drag.y0;
  if (!drag.moved) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
    if (Math.abs(dx) < 8) return;
    drag.moved = true;
    drag.layer.classList.add('dragging');
  }
  drag.dx = clamp(drag.base + dx, -140, 0);
  drag.layer.style.transform = `translateX(${drag.dx}px)`;
});
['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, () => {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!d.moved) return;
  d.layer.classList.remove('dragging');
  const open = d.dx < -48;
  d.layer.style.transform = `translateX(${open ? -96 : 0}px)`;
  openSwipe = open ? d.i : null;
  d.layer.dataset.justDragged = '1';
  setTimeout(() => { delete d.layer.dataset.justDragged; }, 50);
}));

// ---------- clicks ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  if (press?.fired) { press = null; e.preventDefault(); return; }
  const a = el.dataset.action;
  const d = state.draft;
  switch (a) {
    case 'go': go(el.dataset.view); break;
    case 'new': openEditor(null); break;
    case 'start': {
      const s = state.sessions.find((x) => x.id === el.dataset.id);
      if (s) startSession(s);
      break;
    }
    case 'replay': {
      const entry = state.history[Number(el.dataset.index)];
      if (entry?.session) startSession(entry.session);
      break;
    }
    case 'replay-done': if (state.done?.session) startSession(state.done.session); break;
    case 'resume': togglePause(); break;
    case 'stop': finishRun(true); break;
    case 'step': {
      const field = el.dataset.field;
      const lim = LIMITS[field];
      const delta = Number(el.dataset.delta) * lim.step;
      if (field === 'prep') d.prep = clamp(d.prep + delta, lim.min, lim.max);
      else {
        const b = d.blocs[Number(el.dataset.bloc)];
        b[field] = clamp(b[field] + delta, lim.min, lim.max);
      }
      render();
      document.querySelector(`[data-action="step"][data-field="${field}"]${el.dataset.bloc != null ? `[data-bloc="${el.dataset.bloc}"]` : ''}[data-delta="${el.dataset.delta}"]`)?.focus({ preventScroll: true });
      break;
    }
    case 'alerte': d.alerte = Number(el.dataset.value); render(); break;
    case 'add-bloc':
      d.blocs.push(blankBloc(d.blocs.length + 1));
      d.ouvert = d.blocs.length - 1;
      openSwipe = null;
      render();
      document.getElementById(`bn-${d.blocs[d.ouvert].id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      break;
    case 'open-bloc': {
      const layer = el.closest('[data-swipe]');
      if (layer?.dataset.justDragged) break;
      const i = Number(el.dataset.bloc);
      if (openSwipe === i) { openSwipe = null; layer.style.transform = 'translateX(0px)'; break; }
      d.ouvert = i;
      openSwipe = null;
      render();
      break;
    }
    case 'del-bloc': openSwipe = null; deleteBloc(Number(el.dataset.bloc)); break;
    case 'undo': undoDelete(); break;
    case 'save': saveDraft(); break;
    case 'del-session':
      if (confirm(`Supprimer « ${d.nom || 'cette séance'} » ?`)) {
        state.sessions = state.sessions.filter((s) => s.id !== d.id);
        saveSessions(state.sessions);
        go('home');
      }
      break;
    case 'toggle': {
      const k = el.dataset.setting;
      state.settings[k] = !state.settings[k];
      saveSettings(state.settings);
      el.setAttribute('aria-checked', String(state.settings[k]));
      break;
    }
    case 'test-sound':
      unlockAudio();
      play('roundStart', state.settings);
      setTimeout(() => play('warning', state.settings), 1400);
      break;
    case 'reset':
      if (confirm("Effacer toutes tes séances, ton historique et tes réglages sur cet appareil ?")) {
        resetAll();
        state.sessions = loadSessions();
        state.history = loadHistory();
        state.settings = loadSettings();
        go('home');
      }
      break;
    default: break;
  }
});

// ---------- inputs ----------
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.input === 'nom' && state.draft) state.draft.nom = t.value;
  if (t.dataset.input === 'bloc-name' && state.draft) state.draft.blocs[Number(t.dataset.bloc)].nom = t.value;
  if (t.dataset.setting === 'volume') {
    state.settings.volume = Number(t.value);
    const v = document.getElementById('vol-val');
    if (v) v.textContent = `${t.value} %`;
    saveSettings(state.settings);
  }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.tagName === 'SELECT' && t.dataset.setting) {
    state.settings[t.dataset.setting] = t.value;
    saveSettings(state.settings);
    unlockAudio();
    play(t.dataset.setting === 'cloche' ? 'roundStart' : 'warning', state.settings);
  }
});

render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
