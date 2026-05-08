import { state, LS_KEY } from './state.js'
import { $, showToast } from './utils.js'
import { MONTH_FR } from './config.js'

/* ============================================================
   STOCKAGE
============================================================ */
export function saveTrades(){
  localStorage.setItem(LS_KEY, JSON.stringify(state.trades));
  refreshUserStats(); // recalcul adaptatif après chaque mutation
}

export function loadTrades(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    const parsed = JSON.parse(raw);
    state.trades = Array.isArray(parsed) ? parsed : [];
  } catch(e){ state.trades = []; }

  // S'assurer que tous les champs de base sont présents (sans migration forcée)
  state.trades = state.trades.map(t => ({
    id      : t.id || Date.now() + Math.random(),
    date    : t.date    || '',
    time    : t.time    || '',
    asset   : t.asset   || '',
    type    : t.type    || '',
    dir     : t.dir     || '',
    setup   : t.setup   || '',
    quality : t.quality || '',
    conf    : Array.isArray(t.conf) ? t.conf : [],
    rrPlan  : t.rrPlan  != null ? t.rrPlan : 0,
    risk    : t.risk    != null ? t.risk   : 0,
    result  : t.result  || '',
    rrReal  : t.rrReal  != null ? t.rrReal : 0,
    pnl     : t.pnl     != null ? t.pnl    : 0,
    plan    : t.plan    || '',
    emotion      : t.emotion      || '',
    emotionEntry : t.emotionEntry || t.emotion || '',
    emotionExit  : t.emotionExit  || '',
    partials     : Array.isArray(t.partials) ? t.partials : [],
    realizedR    : t.realizedR    != null ? t.realizedR : null,
    note    : t.note    || '',
    psycho  : t.psycho  != null ? t.psycho : 50,
    // Champs v2
    status      : t.status     || 'closed',
    isOpen      : t.isOpen     || false,
    createdAt   : t.createdAt  || (t.date ? t.date + 'T' + (t.time || '00:00') : new Date().toISOString()),
    updatedAt   : t.updatedAt  || new Date().toISOString(),
    entryPrice  : t.entryPrice != null ? t.entryPrice : 0,
    stopLoss    : t.stopLoss   != null ? t.stopLoss   : 0,
    takeProfit  : t.takeProfit != null ? t.takeProfit : 0,
    exitPrice   : t.exitPrice  != null ? t.exitPrice  : 0,
    setupScore  : t.setupScore != null ? t.setupScore : null, // calculé par migration
    setupGrade  : t.setupGrade || null,
  }));

  // Migration conditionnelle — uniquement si des champs v2 manquent
  migrateTradesData();
}

/* ============================================================
   MIGRATION SÉCURISÉE
============================================================ */
export function migrateTradesData(){
  if(!state.trades.length) return;

  // Version du scoring actuel — incrémenter à chaque changement de logique
  const SCORING_VERSION = 6; // v6 = modèle /10 par catégorie

  // Migration nécessaire si : score manquant, gap manquant, OU version de scoring obsolète
  const needsMigration = state.trades.some(t =>
    t.setupScore === null ||
    t.setupScore === undefined ||
    t.setupGrade === null ||
    t.setupGrade === undefined ||
    (t.quality && t.setupGrade && t.setupEvaluationGap === undefined) ||
    (t.scoringVersion === undefined || t.scoringVersion < SCORING_VERSION)
  );
  if(!needsMigration) return;

  // Backup AVANT migration (une seule fois)
  localStorage.setItem(
    'backup_trades_before_migration_' + Date.now(),
    JSON.stringify(state.trades)
  );

  let migratedCount = 0;
  state.trades = state.trades.map(t => {
    const needsRecalc =
      t.setupScore === null || t.setupScore === undefined ||
      t.setupGrade === null || t.setupGrade === undefined ||
      (t.scoringVersion === undefined || t.scoringVersion < SCORING_VERSION);
    const needsGap = t.setupEvaluationGap === undefined;

    if(!needsRecalc && !needsGap) return t;

    // Recalcul 100% technique (plan/emotion ignorés par calculateSetupScore v2)
    const { setupScore, setupGrade } = calculateSetupScore(t);
    const tWithGrade = { ...t, setupScore, setupGrade };
    const setupEvaluationGap = calculateSetupEvaluationGap(tWithGrade);

    migratedCount++;
    return {
      ...t,
      status             : t.status  || 'closed',
      isOpen             : t.isOpen  !== undefined ? t.isOpen : false,
      createdAt          : t.createdAt || (t.date ? t.date + 'T' + (t.time || '00:00') : new Date().toISOString()),
      updatedAt          : t.updatedAt || new Date().toISOString(),
      setupScore,
      setupGrade,
      setupEvaluationGap,
      scoringVersion     : SCORING_VERSION,
    };
  });

  saveTrades();
  if(migratedCount > 0){
    showToast(`Recalcul scoring v4 — ${migratedCount} trade(s) mis à jour`, 3000);
  }
}

/* ============================================================
   CRUD TRADES
============================================================ */

/**
 * updateTrade(id, fields)
 * Merge partiel — préserve tous les champs existants (y compris inconnus)
 * Ne crée jamais de doublon. Garde l'id identique.
 */
export function updateTrade(id, fields){
  const numId = Number(id);
  const idx = state.trades.findIndex(t => Number(t.id) === numId);
  if(idx === -1) return false;

  // Merge : les nouveaux champs écrasent les anciens, l'id est préservé
  state.trades[idx] = {
    ...state.trades[idx],    // tous les champs existants préservés
    ...fields,         // nouveaux champs / valeurs modifiées
    id        : state.trades[idx].id,  // id immuable
    createdAt : state.trades[idx].createdAt, // date de création immuable
    updatedAt : new Date().toISOString(),
  };
  saveTrades();
  return true;
}

async function deleteTrade(id){
  const ok = await showConfirmModal('Supprimer ce trade définitivement ?', 'Supprimer', true);
  if(!ok) return;
  state.trades = state.trades.filter(t => Number(t.id) !== Number(id));
  saveTrades();
  updateMiniStats();
  updatePeriodSelectors();
  renderHistory();
  showToast('Trade supprimé');
}

