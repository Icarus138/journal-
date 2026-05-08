// Pure functions — no DOM, no state, fully testable

const pad = n => String(n).padStart(2,'0');
function todayISO(){
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

const GRADE_VAL = {'A+':5,'A':4,'B':3,'C':2,'D':1};

const EMOTION_SCORE = {
  'Calme'     :  2,
  'Confiance' :  2,
  'Neutre'    :  1,
  'Stress'    : -1,
  'Fatigue'   : -1,
  'FOMO'      : -2,
  'Revenge'   : -3,
};

const SETUP_SCORE_MAX = 10;

function signedR(t){
  // Priorité : realizedR calculé depuis les partiels
  if(t.realizedR != null) return t.realizedR;
  // Fallback : rrReal signé par le résultat
  const abs = Math.abs(t.rrReal || 0);
  if(t.result === 'Win')  return abs > 0 ? abs : 1;
  if(t.result === 'Loss') return abs > 0 ? -abs : -1;
  return 0;
}

function calcStats(tradeSet){
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

function computeRealizedR(partials){
  if(!partials || !partials.length) return null;
  const total = partials.reduce((sum, p) => sum + (p.size || 0) * (p.R || 0), 0);
  return parseFloat(total.toFixed(2));
}

function normalizePartials(partials){
  const totalSize = partials.reduce((s, p) => s + (p.size || 0), 0);
  if(totalSize === 0) return partials;
  return partials.map(p => ({ ...p, size: parseFloat((p.size / totalSize).toFixed(4)) }));
}

function fmtDate(iso){
  if(!iso) return '--';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function getEmotionDelta(trade){
  const entry = EMOTION_SCORE[trade.emotionEntry] ?? EMOTION_SCORE[trade.emotion] ?? 0;
  const exit  = EMOTION_SCORE[trade.emotionExit]  ?? 0;
  return exit - entry;
}

function computeTiltScore(tradeSet){
  const closed = tradeSet
    .filter(t => t.status === 'closed' && t.result)
    .slice(0, 3); // 3 plus récents (array trié newest-first)

  let tilt = 0;

  // Pertes récentes (R signé)
  const losses = closed.filter(t => signedR(t) < 0).length;
  if(losses >= 2) tilt += 2;

  // Mauvaise discipline récente
  const badDiscipline = closed.filter(t => t.plan === 'Non').length;
  if(badDiscipline >= 1) tilt += 2;

  // Overtrading aujourd'hui
  const todayAll = tradeSet.filter(t => t.date === todayISO());
  if(todayAll.length >= 5) tilt += 1;

  return Math.min(5, tilt);
}

function getTiltState(tiltScore){
  if(tiltScore <= 1) return 'STABLE';
  if(tiltScore <= 3) return 'WARNING';
  return 'HIGH_RISK';
}

function calculateSetupScore(trade){
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
    if(typeof computeUserStats === 'function' && typeof trades !== 'undefined'){
      const setupKey  = trade.setup || null;
      const gradeKey  = 'A+';
      const s = USER_STATS?.grades?.[gradeKey];
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

export { signedR, calcStats, computeRealizedR, normalizePartials, fmtDate, getEmotionDelta, computeTiltScore, getTiltState, calculateSetupScore, GRADE_VAL, EMOTION_SCORE, SETUP_SCORE_MAX }
