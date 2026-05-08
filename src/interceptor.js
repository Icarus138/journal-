import { state } from './state.js'
import { GRADE_VAL, ICONS } from './config.js'
import { $, $$, showToast } from './utils.js'
import { saveTrades, updateTrade } from './storage.js'
import { calcStats, signedR, computeUserStats, computeUserProfile, finalizeTrade, normalizePartials, computeRealizedR } from './stats.js'
import { computeTiltScore, getTiltState } from './tilt.js'
import { getConfluences, renderConfluenceGroups } from './confluence.js'
import { buildTradeFromForm, resetForm } from './form.js'
import { renderHistory } from './history.js'
import { renderDashboard } from './dashboard.js'
import { refreshUserStats } from './stats.js'

/* ============================================================
   PRE-TRADE INTERCEPTOR
   S'active uniquement avant validation, jamais après.
   Conditions d'activation : même que isTiltReady()
============================================================ */

/**
 * detectRisk(trade, closedTrades)
 * Analyse le trade en cours + l'historique récent.
 * Retourne { score:0–100, reasons:[{text,severity}] }
 */
export function detectRisk(trade, closedTrades){
  let score = 0;
  const reasons = [];

  // ── Psychologie ────────────────────────────────────────────
  const badEmotions = {
    Revenge   : { pts:35, label:'État Revenge — state.trades pris par réaction émotionnelle',   sev:'high' },
    FOMO      : { pts:30, label:'État FOMO — entrée précipitée hors confirmation',         sev:'high' },
    Stress    : { pts:20, label:'État Stress — performance dégradée sous pression',       sev:'warn' },
    Fatigue   : { pts:20, label:'État Fatigue — jugement altéré, réflexes lents',         sev:'warn' },
  };
  const emotRisk = badEmotions[trade.emotion];
  if(emotRisk){
    score += emotRisk.pts;
    reasons.push({ text: emotRisk.label, sev: emotRisk.sev });
  }

  // ── RR prévu trop faible ───────────────────────────────────
  const rr = trade.rrPlan || 0;
  if(rr > 0 && rr < 1.5){
    score += 25;
    reasons.push({ text:`RR prévu ${rr} — ratio risque/récompense insuffisant (< 1.5)`, sev:'high' });
  } else if(rr >= 1.5 && rr < 2){
    score += 10;
    reasons.push({ text:`RR prévu ${rr} — borderline, préférable ≥ 2`, sev:'warn' });
  }

  // ── Comportement récent — 3 derniers state.trades ────────────────
  const last3 = closedTrades.slice(0, 3);
  const recentLosses = last3.filter(t => signedR(t) < 0).length;
  if(recentLosses >= 3){
    score += 35;
    reasons.push({ text:`3 pertes consécutives — stop-loss journée recommandé`, sev:'high' });
  } else if(recentLosses >= 2){
    score += 20;
    reasons.push({ text:`2 pertes sur les 3 derniers state.trades — dérive possible`, sev:'warn' });
  }

  // ── Hors plan ──────────────────────────────────────────────
  if(trade.plan === 'Non'){
    score += 20;
    reasons.push({ text:'Trade hors plan — déviation du process validé', sev:'warn' });
  }

  // ── Setup grade faible ─────────────────────────────────────
  if(['C','D'].includes(trade.setupGrade)){
    score += 15;
    reasons.push({ text:`Setup ${trade.setupGrade} — statistiquement sous-performant sur ton historique`, sev:'warn' });
  }

  // ── Overtrading aujourd'hui ────────────────────────────────
  const todayCount = state.trades.filter(t => t.date === todayISO()).length;
  if(todayCount >= 5){
    score += 15;
    reasons.push({ text:`${todayCount} state.trades aujourd'hui — overtrading détecté`, sev:'warn' });
  }

  // ── Setup haute probabilité — signal positif (non bloquant) ─
  if(isHighProbabilitySetup(trade.conf || [])){
    const rrOpt = getRRRecommendation(trade.setupGrade, state.USER_STATS);
    if((trade.rrPlan || 0) < rrOpt - 0.2){
      score += 15;
      reasons.push({ text:`Setup haute proba (HTF+MSS+Displ.) — RR ${trade.rrPlan} sous-exploite l'edge (optimal : ${rrOpt}R)`, sev:'warn' });
    }
  }

  // ── Pattern émotionnel perdant basé sur historique ─────────
  if(state.USER_STATS?.emotions?.[trade.emotion]?.total >= 5){
    const eWR = state.USER_STATS.emotions[trade.emotion].winrate;
    if(eWR < 35){
      score += 20;
      reasons.push({ text:`${trade.emotion} = pattern perdant sur tes données (${eWR.toFixed(0)}% WR)`, sev:'high' });
    }
  }

  return { score: Math.min(100, score), reasons };
}

/**
 * buildInterceptorStats(closedTrades, grade, emotion)
 * Construit les stats rapides pour le popup — globales + setup + émotion.
 */

/**
 * getSetupStats(closedTrades, setupGrade)
 * Stats de performance réelle pour un grade de setup.
 * Requiert ≥ 5 state.trades pour être significatif.
 */
export function getSetupStats(closedTrades, setupGrade){
  const filtered = closedTrades.filter(t =>
    t.setupGrade === setupGrade && t.result
  );
  if(filtered.length < 5) return null;
  const decisive = filtered.filter(t => t.result === 'Win' || t.result === 'Loss');
  const wins     = filtered.filter(t => t.result === 'Win').length;
  const avgR     = filtered.reduce((sum, t) => sum + signedR(t), 0) / filtered.length;
  return {
    count   : filtered.length,
    winRate : decisive.length ? Math.round(wins / decisive.length * 100) : 0,
    avgR    : parseFloat(avgR.toFixed(2)),
  };
}

/**
 * getEmotionStats(closedTrades, emotion)
 * Stats de performance par état émotionnel.
 * Requiert ≥ 5 state.trades pour être significatif.
 */
export function getEmotionStats(closedTrades, emotion){
  if(!emotion) return null;
  const filtered = closedTrades.filter(t => t.emotion === emotion && t.result);
  if(filtered.length < 5) return null;
  const decisive = filtered.filter(t => t.result === 'Win' || t.result === 'Loss');
  const wins     = filtered.filter(t => t.result === 'Win').length;
  const avgR     = filtered.reduce((sum, t) => sum + signedR(t), 0) / filtered.length;
  return {
    count   : filtered.length,
    winRate : decisive.length ? Math.round(wins / decisive.length * 100) : 0,
    avgR    : parseFloat(avgR.toFixed(2)),
  };
}

export function buildInterceptorStats(closedTrades, grade, emotion){
  const rFmt = v => v != null ? (v >= 0 ? '+' : '') + v.toFixed(2) + 'R' : '--';

  // Retourne des sections structurées pour l'affichage
  const sections = [];

  // ── Section 1 : Performance globale ───────────────────────
  const st = calcStats(closedTrades);
  if(st){
    const globalRows = [
      { label:'Winrate global', val: st.wr.toFixed(0) + '%',  color: st.wr >= 50 ? 'var(--win)' : 'var(--loss)' },
      { label:'Expectancy',     val: rFmt(st.exp),             color: st.exp >= 0  ? 'var(--win)' : 'var(--loss)' },
      { label:'R moyen',        val: rFmt(st.avgR),            color: st.avgR >= 0 ? 'var(--win)' : 'var(--loss)' },
    ];
    if(st.maxL >= 2) globalRows.push({ label:'Série pertes max', val: st.maxL + ' state.trades', color:'var(--loss)' });
    sections.push({ title: 'Performances globales', rows: globalRows });
  }

  // ── Section 2 : Setup actuel ───────────────────────────────
  if(grade){
    const ss = getSetupStats(closedTrades, grade);
    if(ss){
      const setupRows = [
        { label:`Trades setup ${grade}`, val: ss.count + ' state.trades',          color:'var(--t2)' },
        { label:'Winrate',               val: ss.winRate + '%',               color: ss.winRate >= 50 ? 'var(--win)' : 'var(--loss)' },
        { label:'R moyen',               val: rFmt(ss.avgR),                   color: ss.avgR >= 0     ? 'var(--win)' : 'var(--loss)' },
      ];
      sections.push({ title: `Setup ${grade} — historique réel`, rows: setupRows });
    }
  }

  // ── Section 3 : État émotionnel ────────────────────────────
  if(emotion){
    const es = getEmotionStats(closedTrades, emotion);
    if(es){
      const emotRows = [
        { label:`Trades en ${emotion}`, val: es.count + ' state.trades',           color:'var(--t2)' },
        { label:'Winrate',              val: es.winRate + '%',                color: es.winRate >= 50 ? 'var(--win)' : 'var(--loss)' },
        { label:'R moyen',              val: rFmt(es.avgR),                    color: es.avgR >= 0     ? 'var(--win)' : 'var(--loss)' },
      ];
      sections.push({ title: `État ${emotion} — historique réel`, rows: emotRows });
    }
  }

  return sections;
}

/**
/**
 * getTriggerLevel(score, tiltState, grade)
 * Détermine le niveau visuel du modal — par défaut WARNING, jamais ERROR.
 */
export function getTriggerLevel(score, tiltState, grade){
  if(tiltState === 'HIGH_RISK' || grade === 'D' || score >= 75) return 'high';
  if(score >= 45 || tiltState === 'WARNING' || grade === 'C')   return 'warning';
  return 'info';
}


/**
 * showInterceptor(riskData, statsData, tiltData)
 * Modal HTML natif — zéro confirm()/alert().
 * - score < 70 : bouton "Continuer" direct
 * - score >= 70 : justification obligatoire (min 10 chars) avant de procéder
 * - tiltData optionnel : si tilt WARNING ou HIGH_RISK, affiché dans le modal
 * Retourne Promise<{proceed:bool, justification:string|null}>
 */
export function showInterceptor(riskData, statsData, tiltData = null){
  return new Promise(resolve => {
    const existing = document.getElementById('interceptor-overlay');
    if(existing) existing.remove();

    const { score, reasons } = riskData;
    const tState   = tiltData?.state || 'STABLE';
    const grade    = riskData._grade || '';
    const level    = getTriggerLevel(score, tState, grade);
    const isHigh   = level === 'high';

    const levelColors = {
      info    : { color:'var(--blue)', icon:ICONS.info,    title:'Vérification avant trade'      },
      warning : { color:'var(--be)',   icon:ICONS.warning, title:'Attention — point de contrôle' },
      high    : { color:'var(--loss)', icon:ICONS.warning, title:'Risque élevé — confirmation requise' },
    };
    const { color: headerColor, icon, title } = levelColors[level];

    // Enrichissement : grade + feedback depuis les stats
    const currentGrade   = riskData._grade || '';
    const { feedbackText, statsLine } = currentGrade
      ? buildTriggerMessage(currentGrade, riskData, statsData)
      : { feedbackText: '', statsLine: '' };

    const gradeHeader = currentGrade && feedbackText
      ? `<div style="font-family:var(--mono);font-size:.65rem;color:${isHigh?'var(--t2)':'var(--t2)'};margin-top:2px">`+
        `Qualité détectée : <strong style="color:${headerColor}">${currentGrade}</strong>`+
        `${statsLine ? ` · ${statsLine}` : ''}</div>`
      : '';

    // ── Risques + état mental fusionnés dans un seul bloc ─────
    const allReasonsHTML = [
      ...reasons.map(r =>
        `<div class="interceptor-reason ${r.sev === 'warn' ? 'reason-warn' : ''}">
          <span>${r.sev === 'high' ? ICONS.error : ICONS.warning}</span><span>${r.text}</span>
        </div>`
      ),
      ...(tiltData ? [`<div class="interceptor-reason reason-warn">
          <span>${ICONS.warning}</span><span>${tiltData.message.replace(/^[!x[!!]]+\s*/,'')}</span>
        </div>`] : [])
    ].join('') || `<div style="font-family:var(--mono);font-size:.65rem;color:var(--t3)">Aucun risque critique isolé.</div>`;

    // ── Stats : sous-titres = titre de section, pas de doublon ──
    const statsHTML = statsData.length
      ? statsData.map(sec => `
          <div style="margin-bottom:10px">
            <div style="font-family:var(--mono);font-size:.57rem;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid rgba(255,255,255,.04)">${sec.title}</div>
            ${sec.rows.map(s => `
              <div class="interceptor-stat-row">
                <span class="interceptor-stat-label">${s.label}</span>
                <span class="interceptor-stat-val" style="color:${s.color}">${s.val}</span>
              </div>`).join('')}
          </div>`).join('')
      : `<div style="font-family:var(--mono);font-size:.65rem;color:var(--t4)">Pas encore assez de données (min. 5 state.trades).</div>`;

    const proceedLabel = level === 'warning' ? '→ Continuer' : '→ Confirmer';

    const noteHTML = `<div class="interceptor-justif" id="justif-block">
           <div class="interceptor-justif-label">Note rapide (optionnel)</div>
           <textarea id="justif-input" placeholder="Observation sur ce trade..."></textarea>
         </div>`;

    document.body.insertAdjacentHTML('beforeend', `
      <div class="interceptor-overlay" id="interceptor-overlay">
        <div class="interceptor-modal">
          <div class="interceptor-header level-${level}">
            <span class="interceptor-icon">${icon}</span>
            <span class="interceptor-title" style="color:${headerColor}">${title}</span>
            <span class="interceptor-score">Score : ${score}/100</span>
          </div>
          <div class="interceptor-body">
            <div class="interceptor-section">
              <div class="interceptor-section-title">Risques détectés</div>
              ${allReasonsHTML}
            </div>
            <div class="interceptor-section">
              <div class="interceptor-section-title">Tes performances réelles</div>
              ${statsHTML}
            </div>
          </div>
          ${noteHTML}
          <div class="interceptor-footer">
            <button class="interceptor-btn interceptor-btn-cancel" id="interceptor-cancel">${ICONS.close} Annuler</button>
            <button class="interceptor-btn interceptor-btn-proceed level-${level}" id="interceptor-proceed">${proceedLabel}</button>
          </div>
        </div>
      </div>`);

    // Fermeture overlay
    document.getElementById('interceptor-overlay').addEventListener('click', function(e){
      if(e.target === this){ this.remove(); resolve({ proceed:false, justification:null }); }
    });

    document.getElementById('interceptor-cancel').addEventListener('click', () => {
      document.getElementById('interceptor-overlay').remove();
      resolve({ proceed:false, justification:null });
    });

    document.getElementById('interceptor-proceed').addEventListener('click', () => {
      const ji = document.getElementById('justif-input');
      const justification = ji ? ji.value.trim() || null : null;
      document.getElementById('interceptor-overlay').remove();
      resolve({ proceed: true, justification });
    });
  });
}

/**
 * showConfirmModal(message, confirmLabel, destructive)
 * Remplace confirm() natif pour les actions système (suppression, import, etc.)
 * Retourne Promise<boolean>
 */
export function showConfirmModal(message, confirmLabel = 'Confirmer', destructive = false){
  return new Promise(resolve => {
    const existing = document.getElementById('mini-confirm-overlay');
    if(existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', `
      <div class="mini-confirm-overlay" id="mini-confirm-overlay">
        <div class="mini-confirm-box">
          <div class="mini-confirm-msg">${message}</div>
          <div class="mini-confirm-actions">
            <button class="mini-confirm-btn" id="mini-confirm-cancel" style="background:transparent;color:var(--t3);border:1px solid rgba(255,255,255,.07)">Annuler</button>
            <button class="mini-confirm-btn mini-confirm-ok ${destructive ? 'destructive' : ''}" id="mini-confirm-ok">${confirmLabel}</button>
          </div>
        </div>
      </div>`);

    document.getElementById('mini-confirm-cancel').addEventListener('click', () => {
      document.getElementById('mini-confirm-overlay').remove();
      resolve(false);
    });
    document.getElementById('mini-confirm-ok').addEventListener('click', () => {
      document.getElementById('mini-confirm-overlay').remove();
      resolve(true);
    });
    document.getElementById('mini-confirm-overlay').addEventListener('click', function(e){
      if(e.target === this){ this.remove(); resolve(false); }
    });
  });
}

/**
 * buildTriggerMessage(grade, riskData, statsData)
 * Construit l'en-tête du modal interceptor — court, factuel, actionnable.
 */
export function buildTriggerMessage(grade, riskData, statsData){
  const { score, reasons } = riskData;
  const { text: feedbackText } = getSetupFeedback(grade);

  // Extraire les stats setup depuis statsData
  const setupSection = statsData.find(s => s.title && s.title.includes('Setup'));
  let statsLine = '';
  if(setupSection && setupSection.rows.length){
    const wr   = setupSection.rows.find(r => r.label === 'Winrate');
    const avgR = setupSection.rows.find(r => r.label === 'R moyen');
    if(wr && avgR) statsLine = `${wr.val} WR · ${avgR.val}`;
  }

  return { feedbackText, statsLine };
}

/**
 * shouldTrigger(grade, coverage, rr, riskScore, tiltState)
 * Décide si l'interceptor doit s'activer.
 * Critères : grade faible OU structure incomplète OU RR insuffisant OU risque/tilt élevé.
 */
/**
 * shouldTrigger(grade, coverage, rr, riskScore, tiltState, conf, emotion)
 * N'intercepte QUE si une faiblesse récurrente ET négative est détectée.
 * Principe : pas de spam — uniquement quand les données montrent un pattern.
 */
export function shouldTrigger(grade, coverage, rr, riskScore, tiltState, conf = [], emotion = ''){
  // ── Tilt avancé — protection immédiate ────────────────────
  if(tiltState === 'HIGH_RISK') return true;

  // ── Pattern émotionnel perdant récurrent ──────────────────
  // Déclenche uniquement si historique suffisant (≥8 state.trades) ET WR < 35%
  if(emotion && state.USER_STATS?.emotions?.[emotion]){
    const es = state.USER_STATS.emotions[emotion];
    if(es.total >= 8 && es.winrate < 35) return true;
  }

  // ── Grade récurrément perdant ─────────────────────────────
  // Uniquement si ≥10 state.trades sur ce grade ET R moyen négatif
  if(grade && state.USER_STATS?.grades?.[grade]){
    const gs = state.USER_STATS.grades[grade];
    if(gs.total >= 10 && gs.avgR < -0.2) return true;
  }

  // ── Tilt WARNING + setup faible ──────────────────────────
  if(tiltState === 'WARNING' && grade === 'D') return true;

  return false;
  // Grade D seul, structure incomplète, RR faible → feedback visuel uniquement
}

/* ============================================================
   SETUP PERFORMANCE HELPERS — utilisés par le Decision Gate
============================================================ */

/**
 * computeSetupPerfByType(state.trades, setup)
 * Stats de performance réelle pour un type de setup (t.setup).
 * Retourne { count, totalR } ou null si < 5 state.trades.
 */
export function computeSetupPerfByType(trades, setup){
  const filtered = state.trades.filter(t =>
    t.setup === setup &&
    t.status === 'closed' &&
    t.rrReal != null
  );
  if(filtered.length < 5) return null;
  const totalR = filtered.reduce((acc, t) => acc + t.rrReal, 0);
  return { count: filtered.length, totalR: parseFloat(totalR.toFixed(2)) };
}

/**
 * computePnLWithoutSetup(state.trades, setup)
 * Calcule le PnL total avec vs sans ce type de setup.
 * Retourne { with, without } ou null si < 5 state.trades fermés.
 */
export function computePnLWithoutSetup(trades, setup){
  const closedTrades = state.trades.filter(t =>
    t.status === 'closed' &&
    t.rrReal != null
  );
  if(closedTrades.length < 5) return null;
  const withoutSetup = closedTrades.filter(t => t.setup !== setup);
  const totalWith    = closedTrades.reduce((acc, t) => acc + t.rrReal, 0);
  const totalWithout = withoutSetup.reduce((acc, t) => acc + t.rrReal, 0);
  return {
    with   : parseFloat(totalWith.toFixed(1)),
    without: parseFloat(totalWithout.toFixed(1)),
  };
}

/* ============================================================
   DECISION GATE — validateTradeBeforeSubmit
   Analyse le trade AVANT enregistrement selon des règles fixes.
   Indépendant du tilt/historique — toujours actif.
============================================================ */

/**
 * validateTradeBeforeSubmit(trade)
 * Retourne Promise<boolean> — true = enregistrer, false = annuler.
 *
 * HIGH RISK  : setupGrade C/D · rrPlan < 1.5 · emotion FOMO/Revenge · plan Non
 * MEDIUM RISK: setupGrade B   · rrPlan 1.5–2  · emotion Stress/Fatigue
 */
async function validateTradeBeforeSubmit(trade){
  const highReasons = [];
  const medReasons  = [];

  const rr = trade.rrPlan || 0;

  // ── HIGH RISK ────────────────────────────────────────────
  if(['C','D'].includes(trade.setupGrade)){
    highReasons.push({ text:`Setup ${trade.setupGrade} — qualité insuffisante`, sev:'high' });
  }
  if(rr > 0 && rr < 1.5){
    highReasons.push({ text:`RR ${rr} — ratio risque/récompense trop faible (< 1.5)`, sev:'high' });
  }
  if(['FOMO','Revenge'].includes(trade.emotion)){
    highReasons.push({ text:`Émotion ${trade.emotion} — état émotionnel à haut risque`, sev:'high' });
  }
  if(trade.plan === 'Non'){
    highReasons.push({ text:'Trade hors plan — déviation du process validé', sev:'high' });
  }

  // ── MEDIUM RISK ──────────────────────────────────────────
  if(trade.setupGrade === 'B' && !highReasons.some(r => r.text.startsWith('Setup'))){
    medReasons.push({ text:'Setup B — qualité borderline, confluence à surveiller', sev:'warn' });
  }
  if(rr >= 1.5 && rr < 2){
    medReasons.push({ text:`RR ${rr} — borderline, préférable ≥ 2R`, sev:'warn' });
  }
  if(['Stress','Fatigue'].includes(trade.emotion)){
    medReasons.push({ text:`Émotion ${trade.emotion} — performance potentiellement dégradée`, sev:'warn' });
  }

  // ── Performance réelle du setup (données utilisateur) ───────
  if(trade.setup){
    const setupPerf = computeSetupPerfByType(state.trades, trade.setup);
    const impact    = computePnLWithoutSetup(state.trades, trade.setup);

    if(setupPerf){
      if(setupPerf.totalR < 0){
        const targetList = highReasons.length > 0 ? highReasons : medReasons;
        targetList.push({
          text: `-${Math.abs(setupPerf.totalR).toFixed(1)}R sur ${setupPerf.count} state.trades avec ce setup`,
          sev : 'warn',
        });
      }

      if(impact){
        const targetList = highReasons.length > 0 ? highReasons : medReasons;
        targetList.push({
          text: `Sans ce setup : ${impact.without.toFixed(1)}R vs ${impact.with.toFixed(1)}R actuellement`,
          sev : 'warn',
        });
      }

      if(!['A','A+'].includes(trade.setup)){
        const targetList = highReasons.length > 0 ? highReasons : medReasons;
        targetList.push({ text: '→ Priorise les setups A / A+', sev: 'warn' });
      }
    }
  }

  if(highReasons.length === 0 && medReasons.length === 0) return true;

  if(highReasons.length > 0){
    return showDecisionGate('high', [...highReasons, ...medReasons]);
  }
  return showDecisionGate('medium', medReasons);
}

/**
 * showDecisionGate(level, reasons)
 * level : 'high' | 'medium'
 * Affiche le modal Decision Gate, retourne Promise<boolean>.
 * HIGH : bouton Confirmer verrouillé 3 secondes.
 */
export function showDecisionGate(level, reasons){
  return new Promise(resolve => {
    const existing = document.getElementById('decision-gate-overlay');
    if(existing) existing.remove();

    const isHigh  = level === 'high';
    const DELAY   = isHigh ? 3 : 0;

    const reasonsHTML = reasons.map(r =>
      `<div class="interceptor-reason ${r.sev === 'warn' ? 'reason-warn' : ''}">
         <span>${r.sev === 'high' ? ICONS.error : ICONS.warning}</span><span>${r.text}</span>
       </div>`
    ).join('');

    const patternBlock = isHigh
      ? `<div class="interceptor-section">
           <div class="dg-pattern-msg">${ICONS.warning} Ce trade correspond à tes patterns de perte fréquents</div>
         </div>`
      : '';

    const proceedInner = isHigh
      ? `${ICONS.success} Confirmer&nbsp;<span id="dg-countdown">(${DELAY}s)</span>`
      : `${ICONS.success} Confirmer`;

    document.body.insertAdjacentHTML('beforeend', `
      <div class="interceptor-overlay" id="decision-gate-overlay">
        <div class="interceptor-modal">
          <div class="interceptor-header level-${isHigh ? 'high' : 'warning'}">
            <span class="interceptor-icon">${isHigh ? ICONS.warning : ICONS.warning}</span>
            <span class="interceptor-title">${isHigh
              ? 'Risque élevé — confirmation requise'
              : 'Attention — point de contrôle'}</span>
          </div>
          <div class="interceptor-body">
            <div class="interceptor-section">
              <div class="interceptor-section-title">Risques détectés</div>
              ${reasonsHTML}
            </div>
            ${patternBlock}
          </div>
          <div class="interceptor-footer">
            <button class="interceptor-btn interceptor-btn-cancel" id="dg-cancel">${ICONS.close} Annuler</button>
            <button class="interceptor-btn interceptor-btn-proceed level-${isHigh ? 'high' : 'warning'}"
                    id="dg-proceed" ${isHigh ? 'disabled' : ''}>${proceedInner}</button>
          </div>
        </div>
      </div>`);

    // Fermeture backdrop
    document.getElementById('decision-gate-overlay').addEventListener('click', function(e){
      if(e.target === this){ this.remove(); resolve(false); }
    });

    document.getElementById('dg-cancel').addEventListener('click', () => {
      document.getElementById('decision-gate-overlay').remove();
      resolve(false);
    });

    document.getElementById('dg-proceed').addEventListener('click', () => {
      document.getElementById('decision-gate-overlay').remove();
      resolve(true);
    });

    // Countdown HIGH RISK
    if(isHigh && DELAY > 0){
      let remaining  = DELAY;
      const proceedBtn = document.getElementById('dg-proceed');
      const countEl    = document.getElementById('dg-countdown');
      const timer = setInterval(() => {
        remaining -= 1;
        if(remaining <= 0){
          clearInterval(timer);
          if(proceedBtn){ proceedBtn.disabled = false; }
          if(countEl)   { countEl.textContent = ''; }
        } else {
          if(countEl) countEl.textContent = `(${remaining}s)`;
        }
      }, 1000);
    }
  });
}

/* ============================================================
   MODULE ANTIFRAGILE — Comportemental pre-trade v1
   Règles :
   - Ne modifie aucune fonction existante
   - S'injecte AVANT l'intercepteur tilt existant
   - Données réelles uniquement (aucune projection)
   - localStorage clé séparée tj_af_v1
============================================================ */
export const AF_KEY = 'tj_af_v1';

export function _afLoad()  { try { return JSON.parse(localStorage.getItem(AF_KEY)) || {ignored:0}; } catch { return {ignored:0}; } }
export function _afSave(s) { try { localStorage.setItem(AF_KEY, JSON.stringify(s)); } catch {} }
export function _afGetIgnored()    { return _afLoad().ignored; }
export function _afIncIgnored()    { const s=_afLoad(); s.ignored++; _afSave(s); }
export function _afResetIgnored()  { _afSave({ignored:0}); }

/**
 * getRecentMistakeImpact(type, limit = 5)
 * type examples: 'emotion:FOMO' | 'emotion:Revenge' | 'grade:D' | 'plan:Non'
 * Retourne {totalTrades, winrate, totalR, avgR} ou null si données insuffisantes.
 */
export function getRecentMistakeImpact(type, limit = 5) {
  const [key, val] = type.split(':');
  const closed = state.trades.filter(t => {
    if(t.status !== 'closed' || !t.result) return false;
    if(key === 'emotion') return (t.emotion === val || t.emotionEntry === val);
    if(key === 'grade')   return t.setupGrade === val;
    if(key === 'plan')    return t.plan === val;
    return false;
  }).slice(0, limit);

  if(!closed.length) return null;
  const decisive = closed.filter(t => t.result==='Win'||t.result==='Loss');
  const wins     = closed.filter(t => t.result==='Win').length;
  const totalR   = closed.reduce((s,t) => s + signedR(t), 0);
  return {
    totalTrades : closed.length,
    winrate     : decisive.length ? Math.round(wins/decisive.length*100) : 0,
    totalR      : parseFloat(totalR.toFixed(2)),
    avgR        : parseFloat((totalR/closed.length).toFixed(2)),
  };
}

/* Analyse les déclencheurs antifragiles pour un trade en cours */
export function _afAnalyze(emotion, grade, plan) {
  const ignored  = _afGetIgnored();
  const triggers = [];

  // ── 1. Accumulation d'alertes ignorées ──────────────────────
  if(ignored >= 3) {
    const recent = state.trades.filter(t=>t.status==='closed').slice(0,5);
    const tR     = parseFloat(recent.reduce((s,t)=>s+signedR(t),0).toFixed(2));
    triggers.push({ type:'accumulation', priority:4, ignored, totalR:tR, count:recent.length });
  }

  // ── 2. Émotions à risque + stats réelles ────────────────────
  const riskEmotions = ['FOMO','Revenge','Stress'];
  if(riskEmotions.includes(emotion)) {
    const imp = getRecentMistakeImpact(`emotion:${emotion}`, 5);
    if(imp && imp.totalTrades >= 2)
      triggers.push({ type:'emotion', priority: imp.winrate<35?3:2, emotion, impact:imp });
  }

  // ── 3. Grade setup faible ───────────────────────────────────
  if(['C','D'].includes(grade)) {
    const imp = getRecentMistakeImpact(`grade:${grade}`, 5);
    if(imp && imp.totalTrades >= 2)
      triggers.push({ type:'grade', priority:2, grade, impact:imp });
  }

  // ── 4. Hors plan répété ─────────────────────────────────────
  if(plan === 'Non') {
    const imp = getRecentMistakeImpact('plan:Non', 5);
    if(imp && imp.totalTrades >= 2 && imp.winrate < 45)
      triggers.push({ type:'plan', priority:1, impact:imp });
  }

  // ── 5. Signal POSITIF — bon pattern confirmé ────────────────
  if(!triggers.length && ['Calme','Confiance'].includes(emotion) && ['A+','A'].includes(grade)) {
    const imp = getRecentMistakeImpact(`emotion:${emotion}`, 5);
    if(imp && imp.totalTrades >= 2 && imp.winrate >= 55 && imp.avgR > 0)
      triggers.push({ type:'positive', priority:0, emotion, grade, impact:imp });
  }

  return triggers.sort((a,b) => b.priority - a.priority);
}

/* ── Friction timer sur le bouton procéder ─────────────────── */
export function _afDisableWithCountdown(btn, ms, finalLabel) {
  if(ms <= 0) { btn.textContent = finalLabel; btn.disabled = false; btn.style.opacity='1'; btn.style.cursor='pointer'; return; }
  btn.disabled = true; btn.style.cursor='not-allowed'; btn.style.opacity='.4';
  // Barre de friction
  const bar  = btn.closest('.af-modal')?.querySelector('.af-friction-fill');
  let   rem  = Math.ceil(ms/1000);
  btn.textContent = `Lecture en cours... (${rem}s)`;
  if(bar) { bar.style.transitionDuration = ms+'ms'; requestAnimationFrame(()=>{ bar.style.width='0%'; }); }
  const iv = setInterval(() => {
    rem--;
    if(rem <= 0) {
      clearInterval(iv);
      btn.disabled = false; btn.style.opacity='1'; btn.style.cursor='pointer';
      btn.textContent = finalLabel;
    } else {
      btn.textContent = `Lecture en cours... (${rem}s)`;
    }
  }, 1000);
}

/**
 * showAntifragilePanel(trigger)
 * Retourne Promise<{proceed:bool}>
 */
export function showAntifragilePanel(trigger) {
  return new Promise(resolve => {
    const existing = document.getElementById('af-overlay');
    if(existing) existing.remove();

    const isPositive = trigger.type === 'positive';
    const isHigh     = trigger.priority >= 3;
    const FRICTION   = isHigh ? 3500 : trigger.priority >= 2 ? 2000 : 0;

    // ── Contenu selon type ──────────────────────────────────
    let title, subtitle, rows = [];
    const rFmt = v => (v>=0?'+':'')+v.toFixed(2)+'R';

    if(trigger.type === 'accumulation') {
      title    = `${trigger.ignored} alertes ignorées`;
      subtitle = `${trigger.count} derniers state.trades · résultat cumulé`;
      rows = [
        { text:`Résultat cumulé : ${rFmt(trigger.totalR)}`, hl: trigger.totalR < 0 },
        { text:'Tu continues malgré les signaux répétés.', hl: false },
        { text:'Ce comportement amplifie les pertes évitables.', hl: true },
      ];
    } else if(trigger.type === 'emotion') {
      const {emotion,impact:i} = trigger;
      title    = `${emotion} détecté`;
      subtitle = `${i.totalTrades} derniers state.trades en état ${emotion}`;
      rows = [
        { text:`Winrate : ${i.winrate}%`,    hl: i.winrate < 45 },
        { text:`Total : ${rFmt(i.totalR)}`,  hl: i.totalR < 0  },
        { text:`R moyen : ${rFmt(i.avgR)}`,  hl: i.avgR < 0    },
      ];
      if(i.winrate < 35) rows.push({ text:'Pattern perdant confirmé sur ton historique.', hl:true });
    } else if(trigger.type === 'grade') {
      const {grade,impact:i} = trigger;
      title    = `Setup ${grade} — edge faible`;
      subtitle = `${i.totalTrades} derniers state.trades en grade ${grade}`;
      rows = [
        { text:`Winrate : ${i.winrate}%`,   hl: i.winrate < 45 },
        { text:`Total : ${rFmt(i.totalR)}`, hl: i.totalR < 0   },
        { text:`R moyen : ${rFmt(i.avgR)}`, hl: i.avgR < 0     },
      ];
    } else if(trigger.type === 'plan') {
      const {impact:i} = trigger;
      title    = 'Trade hors plan';
      subtitle = `${i.totalTrades} derniers state.trades hors plan`;
      rows = [
        { text:`Winrate : ${i.winrate}%`,   hl: i.winrate < 45 },
        { text:`Total : ${rFmt(i.totalR)}`, hl: i.totalR < 0   },
      ];
    } else if(isPositive) {
      const {emotion,grade,impact:i} = trigger;
      title    = 'Pattern aligné';
      subtitle = `${i.totalTrades} state.trades · ${emotion} · Grade ${grade}`;
      rows = [
        { text:`Winrate : ${i.winrate}%`,   hl:false, pos:true },
        { text:`R moyen : ${rFmt(i.avgR)}`, hl:false, pos:true },
        { text:'Ce pattern est rentable sur ton historique.', hl:false, pos:true },
      ];
    }

    // ── Couleurs selon niveau ────────────────────────────────
    const borderC  = isPositive ? 'rgba(90,158,122,.2)' : isHigh ? 'rgba(158,90,90,.28)' : 'rgba(184,146,58,.22)';
    const accentC  = isPositive ? 'var(--win)' : isHigh ? 'var(--loss)' : 'var(--be)';
    const headerBg = isPositive ? 'rgba(90,158,122,.04)' : isHigh ? 'rgba(158,90,90,.05)' : 'rgba(184,146,58,.04)';
    const proceedLvl = isPositive ? 'level-positive' : isHigh ? 'level-high' : 'level-warning';
    const ignored  = _afGetIgnored();

    // ── Lignes stats ─────────────────────────────────────────
    const rowsHTML = rows.map(r => `
      <div class="af-stat-row ${r.hl?'af-highlight':''} ${r.pos?'af-positive':''}">
        <span class="af-stat-text" style="color:${r.hl?accentC:r.pos?'var(--win)':'var(--t2)'}">${r.text}</span>
      </div>`).join('');

    // ── Render ───────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.id    = 'af-overlay';
    overlay.className = 'af-overlay';
    overlay.innerHTML = `
      <div class="af-modal" style="border:1px solid ${borderC}">
        ${FRICTION > 0 ? `<div class="af-friction-bar"><div class="af-friction-fill"></div></div>` : ''}
        <div class="af-header" style="background:${headerBg};border-bottom-color:${isPositive?'rgba(90,158,122,.15)':isHigh?'rgba(158,90,90,.18)':'rgba(184,146,58,.16)'}">
          <div>
            <div class="af-title" style="color:${accentC}">${title}</div>
            <div class="af-subtitle">${subtitle}</div>
          </div>
          ${!isPositive?`<div class="af-badge">${ignored} ignoré${ignored>1?'s':''}</div>`:''}
        </div>
        <div class="af-body">${rowsHTML}</div>
        <div class="af-footer">
          ${!isPositive?`<button class="af-btn af-btn-cancel" id="af-cancel">Annuler</button>`:''}
          <button class="af-btn af-btn-proceed ${proceedLvl}" id="af-proceed" disabled style="opacity:.4;cursor:not-allowed">
            ${FRICTION>0 ? `Lecture en cours...` : isPositive ? 'Continuer' : 'Je comprends'}
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const proceedBtn = overlay.querySelector('#af-proceed');
    const cancelBtn  = overlay.querySelector('#af-cancel');

    _afDisableWithCountdown(proceedBtn, FRICTION, isPositive ? 'Continuer' : 'Je comprends — continuer');

    cancelBtn?.addEventListener('click', () => { overlay.remove(); resolve({proceed:false}); });

    proceedBtn.addEventListener('click', () => {
      if(proceedBtn.disabled) return;
      overlay.remove();
      if(isPositive) _afResetIgnored();
      else           _afIncIgnored();
      resolve({proceed:true});
    });

    overlay.addEventListener('click', e => {
      if(e.target === overlay) { overlay.remove(); resolve({proceed:false}); }
    });
  });
}

/* ============================================================
   ENREGISTREMENT / MISE À JOUR
============================================================ */
$('btn-submit').addEventListener('click', async () => {
  let _overrideReason = null;

  // ── ANTIFRAGILE — confrontation comportementale pre-trade ──
  if(state.formMode === 'create'){
    const _afConf    = getConfluences();
    const _afRR      = parseFloat($('f-rr-plan').value) || 0;
    const { setupGrade: _afGrade } = calculateSetupScore({ conf:_afConf, rrPlan:_afRR });
    const _afTriggers = _afAnalyze(
      getToggleVal('emotion'),
      _afGrade,
      getToggleVal('plan')
    );
    if(_afTriggers.length > 0){
      const _afResult = await showAntifragilePanel(_afTriggers[0]);
      if(!_afResult.proceed) return;
    }
  }

  // ── PRE-TRADE INTERCEPTOR + TILT — un seul modal, zéro confirm() ──
  if(state.formMode === 'create' && isTiltReady()){
    const closedTrades = state.trades.filter(t => t.status === 'closed');

    const partialTrade = {
      emotion   : getToggleVal('emotion'),
      rrPlan    : parseFloat($('f-rr-plan').value) || 0,
      plan      : getToggleVal('plan'),
      conf      : getConfluences(),
    };
    const { setupGrade, coverage } = calculateSetupScore(partialTrade);
    partialTrade.setupGrade = setupGrade;

    const riskData  = detectRisk(partialTrade, closedTrades);
    riskData._grade = setupGrade;
    const tiltNow   = computeTiltScore(state.trades);
    const tiltState = getTiltState(tiltNow);
    const tiltData  = tiltState !== 'STABLE'
      ? { state: tiltState, message: getTiltMessage(tiltNow, state.trades) }
      : null;

    // Trigger unifié — structure + grade + RR + risque + tilt
    if(shouldTrigger(setupGrade, coverage, partialTrade.rrPlan, riskData.score, tiltState, partialTrade.conf, partialTrade.emotion)){
      const displayScore = Math.max(riskData.score,
        tiltState === 'HIGH_RISK' ? 75 : tiltState === 'WARNING' ? 45 : 0);
      const displayRisk = displayScore !== riskData.score
        ? { ...riskData, score: displayScore }
        : riskData;

      const statsData = buildInterceptorStats(closedTrades, setupGrade, partialTrade.emotion);
      const result    = await showInterceptor(displayRisk, statsData, tiltData);

      if(!result.proceed) return;
      _overrideReason = result.justification;
    }
  }

  if(state.formMode === 'create'){
    const trade = buildTradeFromForm();
    if(!trade) return;
    if(_overrideReason) trade.overrideReason = _overrideReason;
    const gateApproved = await validateTradeBeforeSubmit(trade);
    if(!gateApproved) return;
    state.trades.unshift(trade);
    saveTrades();
    updateMiniStats();
    updatePeriodSelectors();
    resetForm();
    showToast('Trade #' + state.trades.length + ' enregistré');
  } else {
    const fields = buildTradeFromForm(state.editingTradeId);
    if(!fields) return;
    if(!updateTrade(state.editingTradeId, fields)){
      showToast('Erreur : trade introuvable'); return;
    }
    const msg = state.formMode === 'close' ? 'Trade clôturé' : 'Trade mis à jour';
    exitEditMode();
    updateMiniStats();
    updatePeriodSelectors();
    showToast(msg);
  }
});


