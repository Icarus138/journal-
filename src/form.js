import { state } from './state.js'
import { GRADE_VAL, ICONS, MONTH_FR } from './config.js'
import { $, $$, pad, todayISO, nowTime, showToast, getToggleVal, setToggleVal } from './utils.js'
import { loadSettings, getConfluenceLabel, isConfluenceVisible, getActiveConfluenceDefs } from './user_settings.js'
import { renderConfluenceGroups, getConfluences } from './confluence.js'
import { saveTrades, loadTrades } from './storage.js'
import { calcStats, signedR, computeUserStats, computeUserProfile } from './stats.js'
import { refreshSetupDisplay, updateSetupScore, getSetupFeedback, getActionableFeedback } from './setup.js'
import { updateTiltDisplay, computeTiltScore } from './tilt.js'
import { computeRealizedR, normalizePartials, finalizeTrade, updateTradeDates } from './stats.js'

/* ============================================================
   PSYCHO SCORE
============================================================ */
export function computePsycho(){
  const emotion  = getToggleVal('emotion');
  const plan     = getToggleVal('plan');
  const quality  = getToggleVal('quality'); // qualité perçue — impact limité
  let s = 50;

  // Émotion — impact principal
  const em = {Calme:20,Confiance:15,FOMO:-25,Stress:-15,Fatigue:-15,Revenge:-30};
  if(emotion) s += (em[emotion] || 0);

  // Plan — impact fort
  if(plan==='Oui') s += 15;
  if(plan==='Non') s -= 20;

  // Qualité perçue — impact réduit (instinct, pas discipline)
  // A+/A : +3 max · B : 0 · C/D : -3 max
  const qm = {'A+':3,'A':3,'B':0,'C':-3,'D':-3};
  if(quality) s += (qm[quality] || 0);

  return Math.max(0, Math.min(100, s));
}

export function updatePsychoScore(){
  const score = computePsycho();
  const fill = $('psycho-fill');
  const val  = $('psycho-val');
  if(!fill || !val) return;
  fill.style.width = score + '%';
  let color, label;
  if(score >= 75){ color='var(--win)'; label=score+'% OK'; }
  else if(score >= 50){ color='var(--be)'; label=score+'% ~'; }
  else{ color='var(--loss)'; label=score+'% KO'; }
  fill.style.background = color;
  val.style.color = color;
  val.textContent = label;
}

/* ============================================================
   RESET FORMULAIRE
============================================================ */
export function resetForm(){
  $('f-date').value       = todayISO();
  $('f-time').value       = nowTime();
  $('f-asset').value      = '';
  $('f-setup').value      = '';
  $('f-rr-plan').value    = '';
  $('f-risk').value       = '';
  $('f-rr-real').value    = '';
  $('f-pnl').value        = '';
  $('f-note').value       = '';

  // Remet tous les toggles à zéro, sauf status qui revient à "open"
  $$('[data-group] .tgl').forEach(b => b.classList.remove('active'));
  setToggleVal('status', 'open');

  // Réinitialiser les confluences
  renderConfluenceGroups([]);

  // Reset bars
  $('psycho-fill').style.width = '0%';
  $('psycho-val').textContent  = '—';
  $('psycho-val').style.color  = 'var(--t3)';
  $('setup-fill').style.width  = '0%';
  $('setup-val').textContent   = '—';
  $('setup-val').style.color   = 'var(--t3)';

  updateStatusSection();
  displayWarning(null);
  setToggleVal('emotionExit', '');
  clearPartials();
  refreshSetupDisplay();
  const tm = $('tilt-monitor'); if(tm) tm.style.display = 'none';
  // Fermer l'accordéon au reset
  const tog = $('advanced-toggle');
  const cnt = $('advanced-content');
  if(tog && cnt){ tog.classList.remove('open'); cnt.classList.remove('open'); }
}

/* ============================================================
============================================================ */
export function enterEditMode(trade, mode = 'edit'){
  state.editingTradeId = trade.id;
  state.formMode = mode;

  // Switch vers la page formulaire
  switchToTab('page-log');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Remplir les champs texte/select
  $('f-date').value        = trade.date        || todayISO();
  $('f-time').value        = trade.time        || nowTime();
  $('f-asset').value       = trade.asset       || '';
  $('f-setup').value       = trade.setup       || '';
  $('f-rr-plan').value     = trade.rrPlan      != null ? trade.rrPlan : '';
  $('f-risk').value        = trade.risk        != null ? trade.risk   : '';
  $('f-rr-real').value     = trade.rrReal      != null ? trade.rrReal : '';
  $('f-pnl').value         = trade.pnl         != null ? trade.pnl   : '';
  $('f-note').value        = trade.note        || '';

  // Toggles
  setToggleVal('type',        trade.type          || '');
  setToggleVal('dir',         trade.dir           || '');
  setToggleVal('quality',     trade.quality       || '');
  setToggleVal('result',      trade.result        || '');
  setToggleVal('plan',        trade.plan          || '');
  setToggleVal('emotion',     trade.emotionEntry  || trade.emotion || '');
  setToggleVal('emotionExit', trade.emotionExit   || '');

  // Statut
  if(mode === 'close'){
    setToggleVal('status', 'closed'); // force clôture
  } else {
    setToggleVal('status', trade.status || 'closed');
  }

  // Confluences — rendu avec les valeurs du trade
  renderConfluenceGroups(trade.conf || []);

  // Partiels TP — restaurer si présents
  clearPartials();
  if(trade.partials && trade.partials.length){
    trade.partials.forEach(p => addPartialRow(p));
  }

  // Auto-ouvrir l'accordéon si le trade a des données avancées
  const tog = $('advanced-toggle');
  const cnt = $('advanced-content');
  if(tog && cnt){
    const hasAdvanced = (trade.emotionExit) || (trade.partials && trade.partials.length);
    if(hasAdvanced && !tog.classList.contains('open')){
      tog.classList.add('open');
      cnt.classList.add('open');
      if($('partials-list') && $('partials-list').children.length === 0 && !trade.partials?.length){
        addPartialRow();
      }
    }
  }
  const ICON_PENCIL = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:5px;opacity:.7"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const ICON_LOCK   = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:5px;opacity:.7"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`;
  const ICON_PLUS   = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-right:5px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  const ICON_CHECK  = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-right:5px"><polyline points="20 6 9 17 4 12"/></svg>`;
  const labels = { edit: `${ICON_PENCIL}Modifier le trade`, close: `${ICON_LOCK}Clôturer le trade` };
  $('edit-banner-text').innerHTML = labels[mode] || labels.edit;
  $('form-panel-title').innerHTML = mode === 'close' ? `${ICON_LOCK}Clôturer le trade` : `${ICON_PENCIL}Modifier le trade`;
  $('btn-submit').innerHTML = mode === 'close' ? `${ICON_LOCK}Clôturer le trade` : `${ICON_CHECK}Mettre à jour`;

  // UX uniquement — le scoring se fait au submit
  updateStatusSection();

  if(mode === 'close'){
    // Ouvrir l'accordéon en mode clôture
    const tog = $('advanced-toggle');
    const cnt = $('advanced-content');
    if(tog && cnt && !tog.classList.contains('open')){
      tog.classList.add('open');
      cnt.classList.add('open');
    }
    setTimeout(() => {
      $('emotion-exit-block')?.scrollIntoView({ behavior:'smooth', block:'center' });
    }, 200);
  }
}

export function exitEditMode(){
  state.editingTradeId = null;
  state.formMode = 'create';
  $('edit-banner-container').style.display = 'none';
  $('form-panel-title').innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:5px;opacity:.7"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Nouveau trade`;
  $('btn-submit').innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-right:5px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Enregistrer le trade`;
  resetForm();
}

$('cancel-edit-btn').addEventListener('click', exitEditMode);

/* ============================================================
   PARTIAL TP — Fonctions pures
============================================================ */

/**
 * computeRealizedR(partials)
 * Calcule le R pondéré depuis les sorties partielles.
 * Chaque partiel : { size, R, date }
 */
export function computeRealizedR(partials){
  if(!partials || !partials.length) return null;
  const total = partials.reduce((sum, p) => sum + (p.size || 0) * (p.R || 0), 0);
  return parseFloat(total.toFixed(2));
}

/**
 * normalizePartials(partials)
 * Normalise les tailles pour qu'elles somment à 1.
 */
export function normalizePartials(partials){
  const totalSize = partials.reduce((s, p) => s + (p.size || 0), 0);
  if(totalSize === 0) return partials;
  return partials.map(p => ({ ...p, size: parseFloat((p.size / totalSize).toFixed(4)) }));
}

/**
 * updateTradeDates(trade)
 * Dérive entryDate / exitDate depuis les partiels.
 */
export function updateTradeDates(trade){
  if(!trade.partials || !trade.partials.length) return trade;
  const dates = trade.partials.map(p => new Date(p.date)).filter(d => !isNaN(d));
  if(!dates.length) return trade;
  trade.entryDate = new Date(Math.min(...dates)).toISOString().slice(0,10);
  trade.exitDate  = new Date(Math.max(...dates)).toISOString().slice(0,10);
  return trade;
}

/**
 * finalizeTrade(trade)
 * Applique les partiels : normalisation → R pondéré → dates.
 * Appelé dans buildTradeFromForm avant l'enregistrement.
 */
export function finalizeTrade(trade){
  if(trade.partials && trade.partials.length >= 2){
    trade.partials  = normalizePartials(trade.partials);
    trade.realizedR = computeRealizedR(trade.partials);
    // Synchroniser rrReal pour les fonctions existantes (signedR fallback)
    trade.rrReal    = Math.abs(trade.realizedR);
    trade = updateTradeDates(trade);
  } else {
    trade.partials  = [];
    trade.realizedR = null; // signedR utilisera rrReal + result
  }
  return trade;
}

/**
 * analyzeEmotionShift(state.trades)
 * Retourne les glissements émotionnels entrée→sortie sur state.trades clôturés.
 * Utilisé dans generateInsights pour détecter les dérives.
 */
export function analyzeEmotionShift(trades){
  return state.trades
    .filter(t => t.status === 'closed' && t.emotionEntry && t.emotionExit && t.result)
    .map(t => ({
      entry  : t.emotionEntry,
      exit   : t.emotionExit,
      R      : signedR(t),
      shifted: t.emotionEntry !== t.emotionExit,
    }));
}

/* ── Gestion UI partiels ──────────────────────────────────── */


export function addPartialRow(data = {}){
  const idx  = state.partialRows.length;
  const id   = `partial-${idx}`;
  const list = $('partials-list');
  if(!list) return;

  const row = document.createElement('div');
  row.className = 'partial-row';
  row.dataset.idx = idx;
  row.innerHTML = `
    <div class="field">
      ${idx === 0 ? '<div class="field-label" style="font-size:.55rem">Taille (ex: 0.5)</div>' : ''}
      <input type="number" class="partial-size" placeholder="0.5" step="0.1" min="0" max="1" value="${data.size || ''}"/>
    </div>
    <div class="field">
      ${idx === 0 ? '<div class="field-label" style="font-size:.55rem">R réalisé</div>' : ''}
      <input type="number" class="partial-r" placeholder="1.5" step="0.1" value="${data.R || ''}"/>
    </div>
    <div class="field">
      ${idx === 0 ? '<div class="field-label" style="font-size:.55rem">Date sortie</div>' : ''}
      <input type="date" class="partial-date" value="${data.date || todayISO()}"/>
    </div>
    <button class="btn-remove-partial" type="button" data-idx="${idx}">×</button>`;

  list.appendChild(row);
  state.partialRows.push(row);

  // Listener suppression
  row.querySelector('.btn-remove-partial').addEventListener('click', function(){
    row.remove();
    state.partialRows = state.partialRows.filter(r => r !== row);
    updatePartialComputed();
  });

  // Listener recalcul live
  row.querySelectorAll('input').forEach(inp =>
    inp.addEventListener('input', updatePartialComputed)
  );

  updatePartialComputed();
}

export function updatePartialComputed(){
  const rows = $$('#partials-list .partial-row');
  const el   = $('partial-computed');
  const rEl  = $('partial-r-result');
  const sEl  = $('partial-size-total');

  if(!rows.length){ if(el) el.style.display='none'; return; }

  let totalSize = 0, totalR = 0, valid = true;
  rows.forEach(row => {
    const s = parseFloat(row.querySelector('.partial-size').value) || 0;
    const r = parseFloat(row.querySelector('.partial-r').value);
    totalSize += s;
    if(!isNaN(r)) totalR += s * r;
    else valid = false;
  });

  if(el) el.style.display = '';
  const normalized = totalSize > 0 ? (totalR / totalSize).toFixed(2) : '--';
  if(rEl) {
    rEl.textContent = valid && totalSize > 0 ? normalized + 'R' : '--';
    rEl.style.color = parseFloat(normalized) >= 0 ? 'var(--win)' : 'var(--loss)';
  }
  if(sEl) {
    sEl.textContent = totalSize.toFixed(2);
    sEl.style.color = Math.abs(totalSize - 1) < 0.01 ? 'var(--win)' : 'var(--be)';
  }
}

export function getPartialsFromForm(){
  const rows = $$('#partials-list .partial-row');
  if(!rows.length) return [];
  const partials = [];
  rows.forEach(row => {
    const size = parseFloat(row.querySelector('.partial-size').value);
    const R    = parseFloat(row.querySelector('.partial-r').value);
    const date = row.querySelector('.partial-date').value;
    if(!isNaN(size) && !isNaN(R)) partials.push({ size, R, date: date || todayISO() });
  });
  return partials;
}

export function clearPartials(){
  const list = $('partials-list');
  if(list) list.innerHTML = '';
  state.partialRows = [];
  const el = $('partial-computed');
  if(el) el.style.display = 'none';
}

// Listener accordéon options avancées
document.addEventListener('DOMContentLoaded', () => {
  const tog = $('advanced-toggle');
  const cnt = $('advanced-content');
  if(tog && cnt){
    tog.addEventListener('click', () => {
      const isOpening = !tog.classList.contains('open');
      tog.classList.toggle('open');
      cnt.classList.toggle('open');
      // Auto-insère le premier partial si la liste est vide à l'ouverture
      if(isOpening && $('partials-list') && $('partials-list').children.length === 0){
        addPartialRow();
      }
    });
  }
});
if(document.readyState !== 'loading'){
  const tog = $('advanced-toggle');
  const cnt = $('advanced-content');
  if(tog && cnt){
    tog.addEventListener('click', () => {
      const isOpening = !tog.classList.contains('open');
      tog.classList.toggle('open');
      cnt.classList.toggle('open');
      if(isOpening && $('partials-list') && $('partials-list').children.length === 0){
        addPartialRow();
      }
    });
  }
}

// Listener bouton ajouter partiel
document.addEventListener('DOMContentLoaded', () => {
  const btn = $('btn-add-partial');
  if(btn) btn.addEventListener('click', () => addPartialRow());
});
// Fallback si DOMContentLoaded déjà passé
if(document.readyState !== 'loading'){
  const btn = $('btn-add-partial');
  if(btn) btn.addEventListener('click', () => addPartialRow());
}

/* ============================================================
   CONSTRUCTION DU TRADE DEPUIS LE FORMULAIRE
============================================================ */
export function buildTradeFromForm(existingId = null){
  const status = getToggleVal('status') || 'closed';
  const result = getToggleVal('result');

  // Résultat requis uniquement si clôturé
  if(status === 'closed' && !result){
    showToast('Résultat requis pour un trade clôturé', 2200);
    return null;
  }

  const trade = {
    date       : $('f-date').value       || todayISO(),
    time       : $('f-time').value       || nowTime(),
    asset      : $('f-asset').value,
    type       : getToggleVal('type'),
    dir        : getToggleVal('dir'),
    setup      : $('f-setup').value,
    quality    : getToggleVal('quality'), // conservé pour compatibilité
    conf       : getConfluences(),
    rrPlan     : parseFloat($('f-rr-plan').value)     || 0,
    risk       : parseFloat($('f-risk').value)        || 0,
    result     : result || '',
    rrReal     : Math.abs(parseFloat($('f-rr-real').value) || 0),
    pnl        : parseFloat($('f-pnl').value)         || 0,
    plan       : getToggleVal('plan'),
    emotion    : getToggleVal('emotion'),
    note       : $('f-note').value,
    psycho     : computePsycho(),
    // Émotion entrée (champ existant 'emotion' conservé pour compatibilité)
    emotion      : getToggleVal('emotion'),        // alias historique
    emotionEntry : getToggleVal('emotion'),        // nouveau champ explicite
    emotionExit  : getToggleVal('emotionExit'),    // nouveau — émotion à la sortie
    status     : status,
    isOpen     : status === 'open',
    updatedAt  : new Date().toISOString(),
  };

  // Partiels TP
  const partials = getPartialsFromForm();
  trade.partials = partials;

  // finalizeTrade : normalise partiels + calcule realizedR si partiels présents
  Object.assign(trade, finalizeTrade({ ...trade }));


  // Score setup automatique — v3
  const { setupScore, setupGrade } = calculateSetupScore(trade);
  trade.setupScore      = setupScore;
  trade.setupGrade      = setupGrade;
  trade.scoringVersion  = 6;

  // Feedback d'exécution (comparaison RR prévu vs réel)
  trade.executionFeedback = evaluateExecution(trade);

  // Tilt au moment du trade — deux couches
  const tiltAnalytic = calculateTiltScore(state.trades);  // 0–100 pour dashboard
  const tiltBehav    = computeTiltScore(state.trades);     // 0–5 pour décision
  trade.tiltScore  = tiltAnalytic;
  trade.tiltLevel  = getTiltLevel(tiltAnalytic).level;
  trade.tiltState  = getTiltState(tiltBehav);        // STABLE/WARNING/HIGH_RISK

  // Écart perçu vs calculé
  trade.setupEvaluationGap = calculateSetupEvaluationGap(trade);

  // Smart warning basé sur les stats historiques réelles
  trade.warning = generateSmartWarning(trade, state.trades);

  if(!existingId){
    trade.id        = Date.now();
    trade.createdAt = new Date().toISOString();
  }

  return trade;
}

/* ============================================================
   MINI STATS (page log)
============================================================ */
export function updateMiniStats(){
  const closedTrades = state.trades.filter(t => t.status === 'closed');
  const openCount    = state.trades.filter(t => t.status === 'open').length;
  const st = calcStats(closedTrades);
  if(!st){
    $('s-total').textContent    = '0';
    $('s-total-sub').textContent = openCount > 0 ? `+${openCount} en cours` : 'enregistrés';
    $('s-wr').textContent       = '—';
    $('s-wr-sub').textContent   = 'W / L / BE';
    $('s-totalr').textContent   = '0.00';
    $('s-avgr').textContent     = '—';
    $('s-exp').textContent      = '—';
    return;
  }
  $('s-total').textContent     = st.total;
  $('s-total-sub').textContent = openCount > 0 ? `+${openCount} en cours` : 'clôturés';
  $('s-total-sub').style.color = openCount > 0 ? 'var(--be)' : '';
  $('s-wr').textContent        = st.wr.toFixed(0) + '%';
  $('s-wr-sub').textContent    = `${st.wins}W / ${st.losses}L / ${st.bes}BE`;
  $('s-totalr').textContent    = (st.totalR>=0?'+':'') + st.totalR.toFixed(2) + 'R';
  $('s-totalr').style.color    = st.totalR >= 0 ? 'var(--win)' : 'var(--loss)';
  $('s-avgr').textContent      = (st.avgR>=0?'+':'') + st.avgR.toFixed(2) + 'R';
  $('s-avgr').style.color      = st.avgR >= 0 ? 'var(--win)' : 'var(--loss)';
  $('s-exp').textContent       = (st.exp>=0?'+':'') + st.exp.toFixed(2) + 'R';
  $('s-exp').style.color       = st.exp >= 0 ? 'var(--win)' : 'var(--loss)';
}

