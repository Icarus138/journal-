import { state } from './state.js'
import { GRADE_VAL, EMOTION_SCORE, SETUP_SCORE_MAX, ICONS, MONTH_FR } from './config.js'
import { $, $$, showToast, fmtDate } from './utils.js'
import { loadSettings, getConfluenceLabel, isConfluenceVisible, getActiveConfluenceDefs } from './user_settings.js'
import { getConfluences, renderConfluenceGroups } from './confluence.js'
import { calcStats, signedR } from './stats.js'

/* ============================================================
   SCORE SETUP AUTOMATIQUE
============================================================ */

/**
 * calculateSetupScore(trade)
 * v4 — Distribution cible : A+ 5–10% · A 20–30% · B majorité · C/D minorité
 *
 * Changements vs v3 :
 *  - Plan malus SUPPRIMÉ du setup score (appartient au discipline score / psycho)
 *  - Cap majeures relevé 4→6 : 3 majeures bien différenciées de 2
 *  - RR rewards rééquilibrés : ≥3→+3, ≥2→+2, ≥1.5→+1, <1.5→0 (plus de malus)
 *  - isPremium assoupli : MSS OU Displacement (pas obligatoirement les deux)
 *  - Seuils grades abaissés d'un cran
 */
export function calculateSetupScore(trade){
  const conf = Array.isArray(trade.conf) ? trade.conf : [];
  const rr   = trade.rrPlan || 0;

  // Coverage des catégories
  const coverage = checkCategoryCoverage(conf);

  // ── Score /10 — structure prioritaire ────────────────────────
  // Max = 2+3+2+1+2 = 10
  let score = 0;

  if(coverage.CONTEXT)   score += 2; // Contexte HTF + liquidité
  if(coverage.STRUCTURE) score += 3; // Structure marché (poids élevé)
  if(coverage.ENTRY)     score += 2; // Zone d'entrée précise
  if(coverage.SESSION)   score += 1; // Session active (bonus)
  if(rr >= 2)            score += 2; // RR optimal
  else if(rr >= 1.5)     score += 1; // RR acceptable

  // ── Détection des conditions ───────────────────────────────
  const hasContext      = coverage.CONTEXT;
  const hasStructure    = coverage.STRUCTURE;
  const hasEntry        = coverage.ENTRY;
  const hasSession      = coverage.SESSION;
  const hasMSS          = conf.includes('MSS');
  const hasDisplacement = conf.includes('Displacement');

  // ── Grade — logique trading (hiérarchique, jamais score pur) ─
  let grade;

  // [▲] A+ → sniper : MSS + Displacement + contexte + entrée + RR
  //    SESSION non obligatoire — la structure prime
  if(hasMSS && hasDisplacement && hasContext && hasEntry && rr >= 1.5){
    grade = 'A+';
  }
  //  A → setup discipliné complet : contexte + structure + entrée + session
  //    RR ne donne pas le A — c'est la couverture qui le valide
  else if(hasContext && hasStructure && hasEntry && hasSession){
    grade = 'A';
  }
  //  B → structuré mais incomplet (pas de contexte ou pas de session)
  else if(hasStructure && hasEntry){
    grade = 'B';
  }
  //  C / D
  else if(score >= 4){
    grade = 'C';
  }
  else{
    grade = 'D';
  }

  // ── Message d'optimisation A+ ─────────────────────────────
  let optimizationMessage = null;
  if(grade === 'A+'){
    optimizationMessage = ' Setup sniper validé (structure + contexte) — envisage de laisser courir ou d\'augmenter ton TP';

    // Confirmation par stats personnelles si disponibles
    if(typeof computeUserStats === 'function' && typeof state.trades !== 'undefined'){
      const setupKey  = trade.setup || null;
      const gradeKey  = 'A+';
      const s = state.USER_STATS?.grades?.[gradeKey];
      if(s && s.total >= 5 && s.winrate > 60){
        optimizationMessage += `\n Confirmé par tes stats : WR ${s.winrate.toFixed(0)}%`;
      }
    }
  }

  // Soft calibration flag
  let evaluationFlag = null;
  if(trade.result === 'Win' && (trade.rrReal||0) >= 1.5 && ['C','D'].includes(grade))
    evaluationFlag = 'under-evaluated';
  if(trade.result === 'Loss' && ['A+','A'].includes(grade))
    evaluationFlag = 'over-evaluated';

  return { setupScore: score, setupGrade: grade, optimizationMessage, evaluationFlag, coverage };
}

/**
 * calculateSetupEvaluationGap(trade)
 * Compare la qualité perçue (quality) vs calculée (setupGrade).
 * Retourne : 'aligned' | 'overestimated' | 'underestimated' | null
 */
export function calculateSetupEvaluationGap(trade){
  const perceived   = trade.quality;
  const calculated  = trade.setupGrade;
  if(!perceived || !calculated) return null;
  const pv = GRADE_VAL[perceived]  || 0;
  const cv = GRADE_VAL[calculated] || 0;
  if(pv > cv) return 'overestimated';
  if(pv < cv) return 'underestimated';
  return 'aligned';
}

/* Mise à jour live dans le formulaire */
export function updateSetupScore(){
  const tmp = {
    conf   : getConfluences(),
    rrPlan : parseFloat($('f-rr-plan').value) || 0,
  };
  const { setupScore, setupGrade, optimizationMessage } = calculateSetupScore(tmp);

  const fill = $('setup-fill');
  const val  = $('setup-val');
  if(!fill || !val) return;

  // ── Score bar ────────────────────────────────────────────────
  const pct = Math.min(100, Math.round(setupScore / SETUP_SCORE_MAX * 100));
  fill.style.width = pct + '%';
  const colors = {'A+':'var(--violet)','A':'var(--blue)','B':'var(--be)','C':'var(--loss)','D':'#7f2020'};
  fill.style.background = colors[setupGrade] || 'var(--t3)';
  val.style.color = '';
  const gradeClass = setupGrade === 'A+' ? 'grade-Aplus' : `grade-${setupGrade}`;
  val.innerHTML = `<span class="grade-hero ${gradeClass}">${setupGrade}</span> <span style="font-size:.62rem;color:var(--t3);font-weight:400">${setupScore}pts</span>`;

  // ── Stats — calculées une seule fois, partagées ──────────────
  const setupKey = $('f-setup') ? $('f-setup').value : '';
  const tpStats  = computeUserStats(state.trades, { setup: setupKey, grade: setupGrade });
  const globalS  = tpStats?.global?.total >= 5 ? { ...tpStats.global, fallback: tpStats.fallback } : null;

  // ── Decision paths ───────────────────────────────────────────
  displayDecisionPaths(getDecisionPaths(
    { setup: setupKey, setupGrade, rrPlan: tmp.rrPlan },
    tpStats
  ));

  // ── Suggestion TP ────────────────────────────────────────────
  displayTPSuggestion(getTPSuggestion({ setupGrade, rrPlan: tmp.rrPlan }, globalS));

  // ── Warning / feedback adaptatif ─────────────────────────────
  if(optimizationMessage){
    displayWarning({ level:'good', message: optimizationMessage });
  } else {
    const tmpTrade    = { conf:tmp.conf, rrPlan:tmp.rrPlan, setupScore, setupGrade };
    const baseWarning = generateSmartWarning(tmpTrade, state.trades);
    const adaptFeedback = getAdaptiveFeedback({
      grade  : setupGrade,
      rr     : tmp.rrPlan,
      emotion: getToggleVal('emotion'),
      conf   : tmp.conf,
      setup  : setupKey,
    });
    displayWarning(adaptFeedback && !baseWarning ? adaptFeedback : baseWarning);
  }

  updateTiltDisplay();
}

/* ============================================================
   SUGGESTION TP — Recommandation dynamique basée sur setup + stats
============================================================ */

/**
 * getTPSuggestion(trade, stats)
 * Retourne une suggestion de TP : { type, message, suggestedRR }
 * Ne bloque jamais l'utilisateur — information uniquement.
 */
export function getTPSuggestion(trade, stats){
  const rrPlan = trade.rrPlan || 0;

  // CAS 1 — A+ confirmé avec edge fort et données fiables
  if(
    trade.setupGrade === 'A+' &&
    stats && stats.total >= 5 &&
    stats.winrate > 60 &&
    stats.avgR > 1.5 &&
    !stats.fallback
  ){
    return {
      type       : 'extend',
      message    : 'Edge confirmé — laisse courir ton trade',
      suggestedRR: parseFloat(Math.max(rrPlan, 2.5).toFixed(1)),
    };
  }

  // CAS 2 — A+ mais edge faible ou données défavorables
  if(
    trade.setupGrade === 'A+' &&
    stats && stats.total >= 5 &&
    (stats.winrate < 45 || stats.avgR < 1)
  ){
    return {
      type       : 'reduce',
      message    : '[!] Setup valide mais edge faible — sécurise plus tôt',
      suggestedRR: parseFloat(Math.min(rrPlan || 1.5, 1.5).toFixed(1)),
    };
  }

  // CAS 3 — Grade A standard
  if(trade.setupGrade === 'A'){
    return {
      type       : 'standard',
      message    : ' Setup propre — TP standard recommandé',
      suggestedRR: 2,
    };
  }

  // CAS 4 — B ou inférieur
  if(['B','C','D'].includes(trade.setupGrade)){
    return {
      type       : 'conservative',
      message    : '[!] Setup moyen — prends des profits rapides',
      suggestedRR: 1.2,
    };
  }

  return null;
}

/**
 * displayTPSuggestion(suggestion)
 * Affiche la suggestion TP dans #tp-suggestion.
 */
export function displayTPSuggestion(suggestion){
  const el = $('tp-suggestion');
  if(!el) return;
  if(!suggestion){ el.style.display = 'none'; return; }

  el.style.display = '';
  el.innerHTML = `
    <div class="tp-box tp-${suggestion.type}">
      ${suggestion.message}
      <div class="tp-rr">RR suggéré : ${suggestion.suggestedRR}R</div>
    </div>`;
}

/* ============================================================
   DECISION PATHS — Options décisionnelles basées sur données
============================================================ */

/**
 * getDecisionPaths(trade, tpStats)
 * Retourne des options actionnables ou null si aucune action requise.
 * Basé uniquement sur données réelles (min 5 state.trades).
 */
export function getDecisionPaths(trade, tpStats){
  const global  = tpStats?.global;
  const count   = global?.total   || 0;
  const winrate = global?.winrate || 0;
  const avgR    = global?.avgR    || 0;

  // CAS 1 — setup faible confirmé par historique
  if(count >= 5 && winrate < 40){
    return {
      type: 'danger',
      message: `${trade.setup || 'Ce setup'} — ${winrate.toFixed(0)}% de réussite sur ${count} state.trades`,
      options: [
        { label:'Skip le trade',                 impact:'Préserve ton capital',          action:'skip'              },
        { label:'Réduire le risque (−50%)',       impact:'Limiter la perte potentielle',  action:'reduce_risk'       },
        { label:'Trader uniquement si RR > 2.5',  impact:'Compense le faible winrate',    action:'conditional_trade' },
      ]
    };
  }

  // CAS 2 — A+ avec edge solide confirmé
  if(trade.setupGrade === 'A+' && count >= 5 && winrate > 60 && avgR > 1.5){
    return {
      type: 'opportunity',
      message: `A+ confirmé — ${winrate.toFixed(0)}% WR · ${avgR >= 0 ? '+' : ''}${avgR.toFixed(2)}R moyen`,
      options: [
        { label:'Laisser courir (TP étendu)',  impact:'Maximise ton edge',   action:'extend_tp'  },
        { label:'Partial + runner',            impact:'Sécurise + profite',  action:'partial_tp' },
      ]
    };
  }

  // CAS 3 — A+ mais edge faible sur cet historique
  if(trade.setupGrade === 'A+' && count >= 5 && (winrate < 45 || avgR < 1)){
    return {
      type: 'warning',
      message: `A+ — edge faible sur cet historique`,
      options: [
        { label:'TP rapide',           impact:'Sécurise le gain',  action:'fast_tp'    },
        { label:'Réduire exposition',  impact:'Moins de drawdown', action:'reduce_risk' },
      ]
    };
  }

  return null;
}

/**
 * displayDecisionPaths(decision)
 * Affiche les options dans #decision-box.
 */
export function displayDecisionPaths(decision){
  const el = $('decision-box');
  if(!el) return;
  if(!decision){ el.style.display = 'none'; return; }

  el.style.display = '';
  el.innerHTML =
    `<div class="decision-card type-${decision.type}">` +
      `<div class="decision-title">${decision.message}</div>` +
      `<div class="decision-options">` +
        decision.options.map(opt =>
          `<div class="decision-option">` +
            `<div class="decision-option-label">${opt.label}</div>` +
            `<div class="decision-option-impact">${opt.impact}</div>` +
          `</div>`
        ).join('') +
      `</div>` +
    `</div>`;
}

/* ============================================================
   LIVE SETUP DISPLAY — Score auto + coverage catégories
   Informationnel uniquement — pas de warning, pas de blocage
============================================================ */

// Mapping confluence → catégorie
export const CATEGORY_MAP = {
  // CONTEXTE — biais HTF et liquidité identifiée
  HTF         : 'CONTEXT',
  Liquidity   : 'CONTEXT',
  Sweep       : 'CONTEXT',   // sweep = purge de liquidité, confirme le biais
  // STRUCTURE — changement de structure du marché
  MSS         : 'STRUCTURE',
  Displacement: 'STRUCTURE',
  // ENTRÉE — zone de trade précise
  OB          : 'ENTRY',
  FVG         : 'ENTRY',
  BPR         : 'ENTRY',
  'Prem/Disc' : 'ENTRY',
  Confirmation: 'ENTRY',
  // SESSION — session de trading active
  Asia        : 'SESSION',
  London      : 'SESSION',
  NY          : 'SESSION',
};

/**
 * checkCategoryCoverage(conf)
 * Retourne quelles catégories sont couvertes.
 */
export function checkCategoryCoverage(conf){
  const cov = { CONTEXT:false, STRUCTURE:false, ENTRY:false, SESSION:false };
  conf.forEach(c => { if(CATEGORY_MAP[c]) cov[CATEGORY_MAP[c]] = true; });
  return cov;
}

/**
 * getMissingCategories(coverage)
 * Retourne les catégories manquantes.
 */
export function getMissingCategories(coverage){
  return Object.entries(coverage).filter(([,v]) => !v).map(([k]) => k);
}

/**
 * getSetupFeedback(grade)
 * Retourne un message court et une classe CSS pour le feedback visuel.
 */
export function getSetupFeedback(grade){
  if(grade === 'A+') return { text:' Setup premium — conditions optimales',  cls:'feedback-good' };
  if(grade === 'A')  return { text:' Conditions favorables',                  cls:'feedback-good' };
  if(grade === 'B')  return { text:'[!] Conditions moyennes — setup acceptable', cls:'feedback-med'  };
  if(grade === 'C')  return { text:'[!] Setup moyen — manque de confluence',     cls:'feedback-med'  };
  return                   { text:'[×] Setup insuffisant — risque élevé',         cls:'feedback-bad'  };
}

/**
 * getActionableFeedback(grade, rr)
 * Retourne un message uniquement s'il influence une décision.
 * Règle : si le message n'apporte pas d'action concrète → null.
 */
export function getActionableFeedback(grade, rr){
  if(grade === 'A+') return null; // géré en amont dans le bloc A+
  if(grade === 'A'  && rr < 1.5) return { text:'[!] Bon setup mais ratio faible — améliore ton entrée', cls:'feedback-med' };
  if(grade === 'B'  && rr < 2)   return { text:'[!] Setup moyen — évite ou réduis ton risque',          cls:'feedback-med' };
  if(grade === 'C')               return { text:'[×] Setup faible — attends une meilleure configuration', cls:'feedback-bad' };
  if(grade === 'D')               return { text:'[×] Setup insuffisant — ne trade pas',                   cls:'feedback-bad' };
  // A (RR ok) ou B (RR ok) : setup valide, rien à signaler
  return null;
}

/**
 * refreshSetupDisplay()
 * Met à jour en live :
 *  - barre score setup + grade
 *  - coverage dots (CORE/STRUCTURE/EXECUTION/CONTEXT)
 *  - feedback texte
 * Appelé sur chaque changement de confluence ou de RR.
 * N'appelle PAS displayWarning ni updateTiltDisplay (réservés au submit).
 */
export function refreshSetupDisplay(){
  const conf = getConfluences();
  const rr   = parseFloat($('f-rr-plan').value) || 0;

  const { setupScore, setupGrade, coverage } = calculateSetupScore({ conf, rrPlan: rr });
  const fullCov  = coverage.CONTEXT && coverage.STRUCTURE && coverage.ENTRY && coverage.SESSION;
  const validRR  = rr >= 2;
  const isAPlus  = setupGrade === 'A+';
  // Pour A+, SESSION n'est pas requise — ne pas l'inclure dans les manques signalés
  const missing  = getMissingCategories(coverage).filter(cat => !(isAPlus && cat === 'SESSION'));

  // ── Barre score setup ──────────────────────────────────────
  const fill = $('setup-fill');
  const val  = $('setup-val');
  if(fill && val){
    const pct   = Math.min(100, Math.round(setupScore / SETUP_SCORE_MAX * 100));
    const colors = {'A+':'var(--violet)','A':'var(--blue)','B':'var(--be)','C':'var(--loss)','D':'#7f2020'};
    const color  = colors[setupGrade] || 'var(--t3)';
    fill.style.width      = pct + '%';
    fill.style.background = color;
    val.style.color       = '';
    const gradeClass = setupGrade === 'A+' ? 'grade-Aplus' : `grade-${setupGrade}`;
    val.innerHTML = `<span class="grade-hero ${gradeClass}">${setupGrade}</span> <span style="font-size:.62rem;color:var(--t3);font-weight:400">${setupScore}pts</span>`;
  }

  // ── Hint texte catégories manquantes ──────────────────────
  const missingHint = $('cov-missing-hint');
  if(missingHint){
    if(conf.length === 0 || isAPlus){
      missingHint.textContent = '';
    } else if(missing.length > 0){
      missingHint.textContent = `Manque : ${missing.join(', ')}`;
      missingHint.style.color = missing.length >= 2 ? 'var(--loss)' : 'var(--be)';
    } else {
      missingHint.textContent = '';
    }
  }

  // ── Feedback — message structurel clair ────────────────────
  const fb = $('setup-feedback');
  const ft = $('setup-feedback-text');
  if(fb && ft){
    if(conf.length === 0){
      fb.style.display = 'none';
    } else if(isAPlus){
      fb.style.display = 'flex';
      fb.className     = 'setup-feedback feedback-good';
      ft.textContent   = !coverage.SESSION
        ? '[▲] Setup A+ validé — Setup sniper détecté (hors session)'
        : '[▲] Setup A+ validé — Structure complète';
    } else if(missing.length >= 2){
      fb.style.display = 'flex';
      fb.className     = 'setup-feedback feedback-bad';
      ft.textContent   = `[!] Setup incomplet — Manque : ${missing.join(' / ')}`;
    } else if(missing.length === 1){
      fb.style.display = 'flex';
      fb.className     = 'setup-feedback feedback-med';
      // SESSION manquante sur un setup non-A+ : message adouci
      ft.textContent   = missing[0] === 'SESSION'
        ? '[!] Setup valide — Session non confirmée'
        : `[!] Presque complet — Manque : ${missing[0]}`;
    } else {
      // Couverture complète — message actionnable uniquement, sinon rien
      const actionMsg = getActionableFeedback(setupGrade, rr);
      if(actionMsg){
        fb.style.display = 'flex';
        fb.className     = `setup-feedback ${actionMsg.cls}`;
        ft.textContent   = actionMsg.text;
      } else {
        fb.style.display = 'none';
      }
    }
  }
}

