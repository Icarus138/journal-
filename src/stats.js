import { state } from './state.js'
import { GRADE_VAL, EMOTION_SCORE, ICONS, SETUP_SCORE_MAX } from './config.js'
import { $, $$, showToast, fmtDate } from './utils.js'
import { loadSettings } from './user_settings.js'

/* ============================================================
   EXECUTION ANALYSIS & JOURNAL ANALYSIS
============================================================ */

/**
 * evaluateExecution(trade)
 * Compare le R réalisé vs le RR prévu.
 * Retourne un label d'exécution textuel.
 */
export function evaluateExecution(trade){
  const realized = Math.abs(trade.rrReal || 0) * (trade.result === 'Loss' ? -1 : 1);
  const planned  = trade.rrPlan || 0;
  if(trade.result === 'Loss' || realized < 0) return '[×] Trade perdant';
  const diff = realized - planned;
  if(diff < -1)                    return '[!] Exécution faible (edge non capturé)';
  if(diff >= -0.5 && diff <= 0.5)  return ' Exécution correcte';
  if(diff > 0.5)                   return '[▲] Exécution forte';
  return '[!] Exécution incertaine';
}

/**
 * analyzeJournal(tradeSet)
 * Détecte les problèmes structurels du journal.
 * Retourne un array d'issues { color, text }.
 */
export function analyzeJournal(tradeSet){
  const issues = [];
  if(!tradeSet || !tradeSet.length) return issues;

  const closed = tradeSet.filter(t => t.status === 'closed' && t.result);
  if(!closed.length) return issues;

  const avgR = closed.reduce((a,t) => a + signedR(t), 0) / closed.length;

  if(avgR < 0)
    issues.push({ color:'var(--loss)', text:`<strong>Trading globalement perdant : R moyen ${avgR.toFixed(2)}R.</strong> Stop et analyse structurelle avant de reprendre.` });

  const todayTrades = closed.filter(t => t.date === todayISO());
  if(todayTrades.length > 5)
    issues.push({ color:'var(--be)', text:`<strong>Overtrading détecté : ${todayTrades.length} state.trades aujourd'hui.</strong> Au-delà de 5, la qualité de décision décline.` });

  const noPlan = closed.filter(t => t.plan === 'Non');
  if(noPlan.length > closed.length * 0.3)
    issues.push({ color:'var(--loss)', text:`<strong>${noPlan.length} state.trades hors plan (${(noPlan.length/closed.length*100).toFixed(0)}%).</strong> Trop de déviation — revoir le process de validation pré-trade.` });

  return issues;
}

/* ============================================================
   SETUP GRADE STATS & SMART WARNING
============================================================ */

/**
 * getStatsBySetupGrade(tradeSet)
 * Retourne pour chaque grade A+/A/B/C/D :
 *   { n, winrate, avgR } — sur state.trades clôturés uniquement.
 */
export function getStatsBySetupGrade(tradeSet){
  const closed = tradeSet.filter(t => t.status === 'closed' && t.setupGrade && t.result);
  const result = {};
  ['A+','A','B','C','D'].forEach(g => {
    const grp = closed.filter(t => t.setupGrade === g);
    if(!grp.length){ result[g] = null; return; }
    const wins = grp.filter(t => t.result === 'Win').length;
    const losses = grp.filter(t => t.result === 'Loss').length;
    const decisive = wins + losses;
    const rSum = grp.reduce((a,t) => a + signedR(t), 0);
    result[g] = {
      n       : grp.length,
      winrate : decisive === 0 ? 0 : wins / decisive * 100,
      avgR    : rSum / grp.length,
    };
  });
  return result;
}

/**
 * generateSmartWarning(trade, tradeSet)
 * Compare le grade du trade en cours avec les stats historiques réelles.
 * Retourne { message, level } où level = 'good' | 'bad' | 'uncertain'
 * N'effectue AUCUN blocage — information uniquement.
 */
/* ============================================================
   ADAPTIVE STATS — Couche d'intelligence utilisateur
   Analyse l'historique pour adapter les feedbacks en temps réel.
============================================================ */

/**
 * computeUserStats(tradeSet, filters = {})
 * Analyse les state.trades clôturés et retourne des stats par grade, émotion,
 * type de setup (t.setup), et globales.
 *
 * filters : { setup, emotionEntry } — optionnel, filtre avant calcul.
 * Ignore les state.trades ouverts et ceux sans rrReal.
 */
export function computeUserStats(tradeSet, filters = {}){
  const stats = {
    grades  : {},
    emotions: {},
    setups  : {},
    global  : { total:0, wins:0, losses:0, totalR:0, winrate:0, avgR:0 },
  };

  const addBucket = (map, key) => {
    if(!map[key]) map[key] = { total:0, wins:0, losses:0, totalR:0 };
  };

  let usedFallback = false; // true si au moins un trade filtré via quality (ancien trade)

  tradeSet.forEach(t => {
    if(t.status !== 'closed' || !t.result) return;
    if(t.rrReal == null) return; // ignorer state.trades sans RR réel

    // Appliquer filtres optionnels
    // IMPORTANT : hiérarchie setupGrade > quality > skip
    // setupGrade = logique système (fiable) · quality = ressenti utilisateur (fallback uniquement)
    if(filters.setup && t.setup !== filters.setup) return;
    if(filters.emotionEntry && (t.emotionEntry || t.emotion) !== filters.emotionEntry) return;
    if(filters.grade){
      if(t.setupGrade){
        // setupGrade prioritaire — source de vérité système
        if(t.setupGrade !== filters.grade) return;
      } else if(t.quality){
        // Fallback anciens trades : quality utilisée en remplacement
        usedFallback = true;
        if(t.quality !== filters.grade) return;
      } else {
        // Ni setupGrade ni quality → trade inexploitable pour ce filtre
        return;
      }
    }

    const grade   = t.setupGrade || t.quality;
    const emotion = t.emotionEntry || t.emotion;
    const setup   = t.setup || null;
    const r       = signedR(t);
    const isWin   = t.result === 'Win';
    const isLoss  = t.result === 'Loss';

    // Global
    stats.global.total++;
    if(isWin)  stats.global.wins++;
    if(isLoss) stats.global.losses++;
    stats.global.totalR += r;

    // Par grade
    if(grade){
      addBucket(stats.grades, grade);
      stats.grades[grade].total++;
      if(isWin)  stats.grades[grade].wins++;
      if(isLoss) stats.grades[grade].losses++;
      stats.grades[grade].totalR += r;
    }

    // Par émotion
    if(emotion){
      addBucket(stats.emotions, emotion);
      stats.emotions[emotion].total++;
      if(isWin)  stats.emotions[emotion].wins++;
      if(isLoss) stats.emotions[emotion].losses++;
      stats.emotions[emotion].totalR += r;
    }

    // Par type de setup
    if(setup){
      addBucket(stats.setups, setup);
      stats.setups[setup].total++;
      if(isWin)  stats.setups[setup].wins++;
      if(isLoss) stats.setups[setup].losses++;
      stats.setups[setup].totalR += r;
    }
  });

  // Dérivés — winrate + avgR (basé sur décisifs uniquement pour WR)
  const deriveWR = set => {
    const dec = set.wins + set.losses;
    set.winrate = dec > 0 ? (set.wins / dec * 100) : 0;
    set.avgR    = set.total > 0 ? set.totalR / set.total : 0;
  };

  const decisive = stats.global.wins + stats.global.losses;
  stats.global.winrate = decisive > 0 ? stats.global.wins / decisive * 100 : 0;
  stats.global.avgR    = stats.global.total > 0 ? stats.global.totalR / stats.global.total : 0;

  Object.values(stats.grades).forEach(deriveWR);
  Object.values(stats.emotions).forEach(deriveWR);
  Object.values(stats.setups).forEach(deriveWR);

  stats.fallback = usedFallback; // true = anciens state.trades (quality) inclus dans le filtre grade
  return stats;
}

/**
 * computeUserProfile(tradeSet)
 * Identifie les forces et faiblesses par type de setup (t.setup).
 * Requiert ≥ 5 state.trades par setup pour être inclus.
 *
 * Force    : winrate > 60% ET avgR > 1.5
 * Faiblesse: winrate < 40% OU avgR < 1
 *
 * Retourne { strengths:[{setup,winrate,avgR}], weaknesses:[{setup,winrate,avgR}] }
 */
export function computeUserProfile(tradeSet){
  const stats = computeUserStats(tradeSet);
  const strengths  = [];
  const weaknesses = [];

  Object.entries(stats.setups).forEach(([setup, s]) => {
    if(s.total < 5) return;
    const entry = { setup, count: s.total, winrate: parseFloat(s.winrate.toFixed(1)), avgR: parseFloat(s.avgR.toFixed(2)) };
    if(s.winrate > 60 && s.avgR > 1.5){
      strengths.push(entry);
    } else if(s.winrate < 40 || s.avgR < 1){
      weaknesses.push(entry);
    }
  });

  // Tri : faiblesses par winrate croissant, forces par avgR décroissant
  weaknesses.sort((a,b) => a.winrate - b.winrate);
  strengths.sort((a,b)  => b.avgR    - a.avgR);

  return { strengths, weaknesses };
}

/**
 * refreshUserStats()
 * Point d'entrée unique — appelé après chaque mutation de `state.trades`.
 */
export function refreshUserStats(){
  state.USER_STATS   = computeUserStats(state.trades);
  state.USER_PROFILE = computeUserProfile(state.trades);
}

/**
/**
 * isHighProbabilitySetup(conf)
 * Détecte la synergie ICT maximale : HTF bias + MSS + Displacement.
 * Ces 3 ensemble = structure de marché la plus forte possible.
 */
export function isHighProbabilitySetup(conf){
  return Array.isArray(conf)
    && (conf.includes('HTF') || conf.includes('Liquidity') || conf.includes('Sweep'))
    && conf.includes('MSS')
    && conf.includes('Displacement');
}

/**
 * getRRRecommendation(grade, userStats)
 * Retourne le RR optimal basé sur tes données historiques pour ce grade.
 * Fallback : seuils antifragiles standard.
 */
export function getRRRecommendation(grade, userStats){
  const fallbacks = { 'A+':3, 'A':2.5, 'B':2, 'C':1.5, 'D':1.5 };
  if(!userStats?.grades?.[grade] || userStats.grades[grade].total < 5)
    return fallbacks[grade] || 2;
  const avgR = userStats.grades[grade].avgR;
  // Recommande légèrement au-dessus de la moyenne historique (antifragile)
  return parseFloat(Math.max(avgR * 1.1, fallbacks[grade] || 2).toFixed(2));
}


/**
 * getAdaptiveFeedback({ grade, rr, emotion, conf, setup })
 * Génère un feedback personnalisé basé sur l'historique réel.
 *
 * Priorités :
 *  1. Combo dangereux : setup-type + émotion → WR < 35%
 *  2. Setup-type faible (t.setup) depuis state.USER_PROFILE
 *  3. Grade faible/fort  (setupGrade)
 *  4. État émotionnel
 *  5. Setup haute probabilité
 *  6. Réduction risk auto si setup faible
 *
 * Requiert ≥ 5 state.trades par catégorie (bruit limité).
 */
export function getAdaptiveFeedback({ grade, rr, emotion, conf = [], setup = '' }){
  if(!state.USER_STATS) return null;
  // A+ : pas de warning générique — feedback data-driven uniquement
  if(grade === 'A+'){
    const filteredStats = computeUserStats(state.trades, { setup, grade: 'A+' });
    const gradeS = filteredStats?.global?.total >= 5 ? filteredStats.global : null;
    if(gradeS){
      const wr      = gradeS.winrate.toFixed(0);
      const avg     = gradeS.avgR >= 0 ? '+' + gradeS.avgR.toFixed(2) : gradeS.avgR.toFixed(2);
      const caveat  = filteredStats.fallback ? '\n[!] Basé partiellement sur anciens state.trades' : '';
      if(gradeS.winrate < 40){
        return {
          level  : 'bad',
          message: `[!] Setup A+ mais historique défavorable\nWR : ${wr}% · R moyen : ${avg}R\n→ Setup valide techniquement, mais peu performant pour toi${caveat}`,
        };
      }
      if(gradeS.winrate > 65){
        return {
          level  : 'good',
          message: ` Setup A+ confirmé par tes données\nWR : ${wr}% · R moyen : ${avg}R\n→ Setup à fort edge — envisage de laisser courir${caveat}`,
        };
      }
    }
    // Fallback neutre — données insuffisantes, pas de bruit
    return null;
  }

  const MIN_SAMPLE = 5;
  const messages   = [];
  let   level      = 'uncertain';

  const gradeStats   = grade   ? state.USER_STATS.grades[grade]     : null;
  const emotionStats = emotion ? state.USER_STATS.emotions[emotion] : null;
  const setupStats   = setup   ? state.USER_STATS.setups[setup]     : null;

  // ── 1. Combo dangereux : setup-type + émotion ─────────────
  // Ex : "Breakout + FOMO → WR 20%"
  if(setup && emotion){
    const comboStats = computeUserStats(state.trades, { setup, emotionEntry: emotion });
    if(comboStats.global.total >= MIN_SAMPLE && comboStats.global.winrate < 35){
      const wr  = comboStats.global.winrate.toFixed(0);
      const avg = comboStats.global.avgR.toFixed(2);
      messages.push(
        `[!!] Combo dangereux : ${setup} + ${emotion}\n` +
        `   WR : ${wr}% · R moyen : ${avg}R sur ${comboStats.global.total} state.trades\n` +
        `   → Pattern de perte récurrent sur tes données`
      );
      level = 'bad';
    }
  }

  // ── 2. Setup-type faible/fort (state.USER_PROFILE) ──────────────
  if(setup && state.USER_PROFILE){
    const isWeak   = state.USER_PROFILE.weaknesses.find(s => s.setup === setup);
    const isStrong = state.USER_PROFILE.strengths.find(s  => s.setup === setup);
    if(isWeak){
      messages.push(
        `[!] Setup ${setup} à éviter\n` +
        `   WR : ${isWeak.winrate}% · R moyen : ${isWeak.avgR}R\n` +
        `   Historique défavorable · Réduis ton risk de 50%`
      );
      level = 'bad';
    } else if(isStrong && level !== 'bad'){
      messages.push(
        ` Setup ${setup} intéressant\n` +
        `   WR : ${isStrong.winrate}% · R moyen : ${isStrong.avgR}R\n` +
        `   Edge potentiel`
      );
      level = 'good';
    }
  }

  // ── 3. Grade faible/fort ──────────────────────────────────
  if(gradeStats && gradeStats.total >= MIN_SAMPLE){
    const wr  = gradeStats.winrate.toFixed(0);
    const avg = gradeStats.avgR.toFixed(2);
    if(gradeStats.winrate < 40){
      messages.push(
        `[!] Setup ${grade} à éviter\n` +
        `   WR : ${wr}% · R moyen : ${avg}R\n` +
        `   Historique défavorable`
      );
      level = 'bad';
    } else if(gradeStats.winrate > 65 && level !== 'bad'){
      messages.push(
        ` Setup ${grade} intéressant\n` +
        `   WR : ${wr}% · R moyen : ${avg}R\n` +
        `   Edge potentiel`
      );
      if(level !== 'bad') level = 'good';
    } else {
      // RR sous-optimal
      const rrOpt = getRRRecommendation(grade, state.USER_STATS);
      if(rr > 0 && rr < rrOpt - 0.3 && !isHighProbabilitySetup(conf)){
        messages.push(`[!] RR ${rr} < ton optimal sur ${grade} (${rrOpt}R)`);
        if(level === 'uncertain') level = 'bad';
      }
    }
  }

  // ── 4. État émotionnel ────────────────────────────────────
  if(emotionStats && emotionStats.total >= MIN_SAMPLE){
    if(emotionStats.winrate < 35){
      messages.push(`[!!] ${emotion} = pattern perdant (${emotionStats.winrate.toFixed(0)}% WR)`);
      level = 'bad';
    } else if(emotionStats.winrate >= 65 && level !== 'bad'){
      messages.push(` ${emotion} = état optimal (${emotionStats.winrate.toFixed(0)}% WR)`);
      if(level !== 'bad') level = 'good';
    }
  }

  // ── 5. Setup haute probabilité ────────────────────────────
  if(isHighProbabilitySetup(conf)){
    const rrOpt = getRRRecommendation(grade, state.USER_STATS);
    if(rr > 0 && rr < rrOpt - 0.2){
      messages.push(`[▲] Setup haute proba — vise ${rrOpt}R (ton optimal ${grade})`);
    } else {
      messages.push(`[▲] Setup haute probabilité — HTF + MSS + Displacement`);
    }
    if(level === 'uncertain') level = 'good';
  }

  // ── 6. Réduction risk auto — setup-type ou grade faible ───
  if(level === 'bad' && (setupStats || gradeStats)){
    const s = setupStats || gradeStats;
    if(s.total >= MIN_SAMPLE && s.winrate < 40){
      messages.push(` Réduis ton risk de 50% sur ce setup (edge négatif détecté)`);
    }
  }

  // ── Fallback global ───────────────────────────────────────
  if(messages.length === 0 && state.USER_STATS.global.total >= 10 && state.USER_STATS.global.winrate < 40){
    messages.push(` Winrate global bas (${state.USER_STATS.global.winrate.toFixed(0)}%) — attends les A+/A`);
    level = 'bad';
  }

  return messages.length > 0 ? { level, message: messages.join('\n') } : null;
}

export function generateSmartWarning(trade, tradeSet){
  // A+ = aucun warning : le setup est validé, pas de bruit
  if(trade.setupGrade === 'A+') return null;

  const stats   = getStatsBySetupGrade(tradeSet);
  const grade   = trade.setupGrade;
  const current = stats[grade];

  const rFmt  = v => (v >= 0 ? '+' : '') + v.toFixed(2) + 'R';
  const wrFmt = v => v.toFixed(0) + '%';

  // ── Cas 3 : données insuffisantes ──────────────────────────
  if(!current || current.n < 3){
    // Cherche le meilleur grade disponible pour comparaison indicative
    const best = ['A+','A','B'].find(g => stats[g] && stats[g].n >= 3);
    const bestStr = best && stats[best]
      ? ` Référence : Setup ${best} → ${wrFmt(stats[best].winrate)} WR / ${rFmt(stats[best].avgR)}`
      : '';
    return {
      level  : 'uncertain',
      message: `[!] Setup ${grade} — pas encore assez de données (${current ? current.n : 0} trade${(current?.n||0)>1?'s':''} enregistré${(current?.n||0)>1?'s':''}).${bestStr}`,
    };
  }

  // ── Trouver le meilleur grade de référence (A+ ou A) ───────
  const refGrade = ['A+','A'].find(g => stats[g] && stats[g].n >= 3 && g !== grade);
  const ref      = refGrade ? stats[refGrade] : null;

  // ── Cas 1 : setup faible (C ou D, ou avgR négatif) ─────────
  const isWeak = ['C','D'].includes(grade) || current.avgR < -0.1;
  if(isWeak){
    let msg = `[!] Setup ${grade} → WR historique : ${wrFmt(current.winrate)} · R moyen : ${rFmt(current.avgR)}`;
    if(ref) msg += `\nComparaison : Setup ${refGrade} → ${wrFmt(ref.winrate)} WR / ${rFmt(ref.avgR)}`;
    msg += `\n→ Tu state.trades un setup statistiquement sous-performant sur tes données.`;
    return { level:'bad', message:msg };
  }

  // ── Cas 2 : bon setup (A+ ou A, avgR positif) ──────────────
  const isStrong = ['A+','A'].includes(grade) && current.avgR > 0.2 && current.winrate >= 50;
  if(isStrong){
    let msg = ` Setup ${grade} → WR : ${wrFmt(current.winrate)} · R moyen : ${rFmt(current.avgR)}`;
    if(current.n < 10) msg += ` (${current.n} state.trades — sample limité)`;
    msg += `\n→ Conditions favorables selon tes données.`;
    return { level:'good', message:msg };
  }

  // ── Cas intermédiaire : setup B ou résultats mitigés ───────
  let msg = ` Setup ${grade} → WR : ${wrFmt(current.winrate)} · R moyen : ${rFmt(current.avgR)} (${current.n} state.trades)`;
  if(ref) msg += `\nMeilleur référence : Setup ${refGrade} → ${wrFmt(ref.winrate)} / ${rFmt(ref.avgR)}`;
  return { level:'uncertain', message:msg };
}

/**
 * displayWarning(warning)
 * Affiche le smart warning sous le bouton submit.
 */
export function displayWarning(warning){
  let el = $('smart-warning');
  if(!el){
    el = document.createElement('div');
    el.id = 'smart-warning';
    $('btn-submit').insertAdjacentElement('afterend', el);
  }
  if(!warning){ el.style.display='none'; return; }

  const colors = {
    good     : { bg:'rgba(90,158,122,.08)',  border:'rgba(90,158,122,.2)',  text:'var(--win)' },
    bad      : { bg:'rgba(158,90,90,.07)',  border:'rgba(158,90,90,.2)',  text:'var(--loss)' },
    uncertain: { bg:'rgba(184,146,58,.06)', border:'rgba(184,146,58,.18)', text:'var(--be)' },
  };
  const c = colors[warning.level] || colors.uncertain;

  el.style.cssText = [
    `background:${c.bg}`, `border:1px solid ${c.border}`, `color:${c.text}`,
    `border-radius:var(--r)`, `padding:10px 14px`, `margin-top:8px`,
    `font-family:var(--mono)`, `font-size:.68rem`, `line-height:1.55`,
    `white-space:pre-line`, `display:block`,
  ].join(';');
  el.textContent = warning.message;
}
/* ============================================================
   SIGNED R — priorité à realizedR (partials)
============================================================ */
export function signedR(t){
  // Priorité : realizedR calculé depuis les partiels
  if(t.realizedR != null) return t.realizedR;
  // Fallback : rrReal signé par le résultat
  const abs = Math.abs(t.rrReal || 0);
  if(t.result === 'Win')  return abs > 0 ? abs : 1;
  if(t.result === 'Loss') return abs > 0 ? -abs : -1;
  return 0;
}

/* ============================================================
   CALCULS STATS
============================================================ */
export function calcStats(tradeSet){
  if(!tradeSet || !tradeSet.length) return null;
  const wins   = tradeSet.filter(t => t.result === 'Win');
  const losses = tradeSet.filter(t => t.result === 'Loss');
  const bes    = tradeSet.filter(t => t.result === 'BE');

  const totalDecisive = wins.length + losses.length;
  const wr     = totalDecisive === 0 ? 0 : wins.length / totalDecisive * 100;
  const beRate = tradeSet.length   === 0 ? 0 : bes.length / tradeSet.length * 100;

  const rValues = tradeSet.map(signedR);
  const totalR  = rValues.reduce((a,b) => a+b, 0);
  const avgR    = totalR / tradeSet.length;
  const avgW    = wins.length   ? wins.reduce((a,t)   => a + Math.abs(signedR(t)), 0) / wins.length   : 0;
  const avgL    = losses.length ? losses.reduce((a,t) => a + Math.abs(signedR(t)), 0) / losses.length : 0;

  const wrDec = wr / 100;
  const exp   = totalDecisive === 0 ? 0 : wrDec * avgW - (1 - wrDec) * avgL;

  let maxW=0, maxL=0, curW=0, curL=0;
  [...tradeSet].reverse().forEach(t => {
    if(t.result==='Win')       { curW++; curL=0; maxW=Math.max(maxW,curW); }
    else if(t.result==='Loss') { curL++; curW=0; maxL=Math.max(maxL,curL); }
    else                       { curW=0; curL=0; }
  });

  const best  = rValues.length ? Math.max(...rValues) : 0;
  const worst = rValues.length ? Math.min(...rValues) : 0;

  const setupR = {};
  tradeSet.forEach(t => {
    if(!t.setup) return;
    if(!setupR[t.setup]) setupR[t.setup] = {r:0,n:0};
    setupR[t.setup].r += signedR(t); setupR[t.setup].n++;
  });
  const bestSetup = Object.entries(setupR).sort((a,b) => b[1].r - a[1].r)[0];

  const assetR = {};
  tradeSet.forEach(t => {
    if(!t.asset) return;
    if(!assetR[t.asset]) assetR[t.asset] = {r:0,n:0};
    assetR[t.asset].r += signedR(t); assetR[t.asset].n++;
  });
  const bestAsset = Object.entries(assetR).sort((a,b) => b[1].r - a[1].r)[0];

  const offPlan = tradeSet.filter(t => t.plan === 'Non');
  const onPlan  = tradeSet.filter(t => t.plan === 'Oui');
  const wrOnPlan = onPlan.length
    ? onPlan.filter(t => t.result === 'Win').length /
      Math.max(1, onPlan.filter(t => t.result === 'Win' || t.result === 'Loss').length) * 100
    : null;

  return {
    total:tradeSet.length, wins:wins.length, losses:losses.length, bes:bes.length,
    wr, beRate, totalR, avgR, avgW, avgL, exp, best, worst, maxW, maxL,
    bestSetup : bestSetup ? bestSetup[0] : '--',
    bestAsset : bestAsset ? bestAsset[0] : '--',
    offPlan   : offPlan.length,
    wrOnPlan,
    rValues
  };
}

