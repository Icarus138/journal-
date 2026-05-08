import { state } from './state.js'
import { ICONS } from './config.js'
import { $, $$ } from './utils.js'
import { calcStats, signedR } from './stats.js'

/* ============================================================
   TILT DETECTION — Dérive mentale en temps réel
============================================================ */

/* ============================================================
   TILT SYSTEM — Décision & Protection comportementale
   ─────────────────────────────────────────────────────────────
   Deux couches séparées :
   1. computeTiltScore (0–5, 3 derniers state.trades) → décision temps réel
   2. calculateTiltScore (0–100, 10 derniers state.trades) → dashboard analytique
============================================================ */

/* ── COUCHE 1 : Comportemental — rapide, actionnable ──────── */

/**
 * computeTiltScore(tradeSet)
 * Score 0–5 basé sur les 3 derniers state.trades clôturés.
 * Rapide à déclencher — détecte la dérive en cours, pas historique.
 */
export function computeTiltScore(tradeSet){
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

/**
 * getTiltState(tiltScore)
 * Interprète le score comportemental.
 * Retourne : 'STABLE' | 'WARNING' | 'HIGH_RISK'
 */
export function getTiltState(tiltScore){
  if(tiltScore <= 1) return 'STABLE';
  if(tiltScore <= 3) return 'WARNING';
  return 'HIGH_RISK';
}

/**
 * getTiltMessage(tiltScore, tradeSet)
 * Message court et actionnable selon l'état.
 */
export function getTiltMessage(tiltScore, tradeSet){
  const closed = tradeSet.filter(t => t.status === 'closed' && t.result).slice(0, 3);

  // Causes détectées
  const losses      = closed.filter(t => signedR(t) < 0).length;
  const offPlan     = closed.filter(t => t.plan === 'Non').length;
  const todayCount  = tradeSet.filter(t => t.date === todayISO()).length;

  const causes = [];
  if(losses >= 2)    causes.push(`${losses} pertes récentes`);
  if(offPlan >= 1)   causes.push('hors plan');
  if(todayCount >= 5) causes.push(`${todayCount} state.trades aujourd'hui`);
  const causeStr = causes.join(' · ');

  if(tiltScore >= 4){
    return `[×] HIGH RISK${causeStr ? ' — ' + causeStr : ''} → STOP recommandé`;
  }
  if(tiltScore >= 2){
    return `[!] WARNING${causeStr ? ' — ' + causeStr : ''} → Réduis le risque`;
  }
  return ' Mindset stable';
}

/**
 * displayTilt(tiltScore, state, message)
 * Met à jour le bloc tilt monitor dans le formulaire.
 * Utilise le nouveau système 0–5 / STABLE–WARNING–HIGH_RISK.
 */
export function displayTilt(tiltScore, state, message){
  const monitor = $('tilt-monitor');
  if(!monitor) return;

  // Rendu — la décision d'afficher/cacher est dans updateTiltDisplay/isTiltReady
  monitor.style.display = '';

  const wrap = $('tilt-monitor-inner');
  if(wrap){
    const cls = { STABLE:'tilt-stable', WARNING:'tilt-warning', HIGH_RISK:'tilt-highrisk' };
    wrap.className = `tilt-monitor-wrap ${cls[state] || 'tilt-stable'}`;
  }

  const colors = { STABLE:'var(--win)', WARNING:'var(--be)', HIGH_RISK:'var(--loss)' };
  const color  = colors[state] || 'var(--win)';

  const sv = $('tilt-score-val');
  if(sv){ sv.textContent = state.replace('_',' '); sv.style.color = color; }

  const badge = $('tilt-level-badge');
  if(badge){
    const labels = { STABLE:'Discipline OK', WARNING:'[!] Surveiller', HIGH_RISK:'[!!] Stop recommandé' };
    badge.textContent = labels[state] || '';
    badge.style.color = color;
  }

  const fill = $('tilt-bar-fill');
  if(fill){
    fill.style.width      = (tiltScore / 5 * 100) + '%';
    fill.style.background = color;
  }

  const msg = $('tilt-monitor-msg');
  if(msg){
    // Afficher uniquement la partie après les icônes
    msg.textContent = message.replace(/^[!x]+\s*\w+\s*—?\s*/, '').trim() || '';
    msg.style.color = color;
  }
}

/**
 * isTiltReady()
 * Vérifie si le formulaire est suffisamment rempli pour afficher le TILT.
 * Conditions : RR prévu défini + au moins 1 confluence + état émotionnel.
 */
export function isTiltReady(){
  const rr       = parseFloat($('f-rr-plan').value) || 0;
  const conf     = getConfluences();
  const emotion  = getToggleVal('emotion');
  return rr > 0 && conf.length > 0 && emotion !== '';
}

/**
 * updateTiltDisplay()
 * Point d'entrée unique — appelé à chaque interaction formulaire.
 * Affiche le TILT uniquement si les conditions contextuelles sont remplies.
 */
export function updateTiltDisplay(){
  const monitor = $('tilt-monitor');
  if(!monitor) return;

  // Conditions non remplies → cacher sans calcul
  if(!isTiltReady()){
    monitor.style.display = 'none';
    return;
  }

  // Conditions remplies → calculer et afficher
  const score   = computeTiltScore(state.trades);
  const state   = getTiltState(score);
  const message = getTiltMessage(score, state.trades);
  displayTilt(score, state, message);
}

/* ── COUCHE 2 : Analytique — historique, dashboard ────────── */

/**
 * calculateTiltScore(tradeSet) — conservé pour le dashboard
 * Score 0–100 sur les 10 derniers state.trades — corrélation tilt vs R.
 */
export function calculateTiltScore(tradeSet){
  const closed = tradeSet
    .filter(t => t.status === 'closed' && t.result)
    .slice(0, 10);

  if(!closed.length) return 0;

  let score = 0;

  let lossStreak = 0;
  for(const t of closed){
    if(t.result === 'Loss') lossStreak++;
    else break;
  }
  if(lossStreak >= 4)       score += 50;
  else if(lossStreak === 3) score += 30;
  else if(lossStreak === 2) score += 15;

  const emotScore = { FOMO:15, Revenge:25, Stress:10, Fatigue:10 };
  closed.forEach(t => { score += emotScore[t.emotion] || 0; });

  const gradeScore = { C:10, D:20 };
  closed.forEach(t => { score += gradeScore[t.setupGrade] || gradeScore[t.quality] || 0; });

  closed.forEach(t => { if(t.plan === 'Non') score += 20; });

  const byDay = {};
  closed.forEach(t => { const d = t.date || '?'; byDay[d] = (byDay[d] || 0) + 1; });
  if(Object.values(byDay).some(n => n > 5)) score += 20;

  return Math.min(100, Math.max(0, score));
}

/**
 * getTiltLevel(score) — conservé pour le dashboard
 */
export function getTiltLevel(score){
  if(score >= 80) return { level:'Tilt',   cls:'tilt-tilt',   color:'var(--loss)' };
  if(score >= 60) return { level:'Danger', cls:'tilt-danger',  color:'var(--loss-l)'     };
  if(score >= 30) return { level:'Dérive', cls:'tilt-derive',  color:'var(--be)'   };
  return           { level:'Clean',  cls:'tilt-clean',  color:'var(--win)'  };
}

/**
 * generateTiltWarning(score, tiltObj, tradeSet) — conservé pour le dashboard
 */
export function generateTiltWarning(score, tiltObj, tradeSet){
  const closed = tradeSet.filter(t => t.status === 'closed' && t.result).slice(0, 10);
  const level  = tiltObj.level;

  let lossStreak = 0;
  for(const t of closed){ if(t.result==='Loss') lossStreak++; else break; }
  const hasFomo    = closed.some(t => t.emotion === 'FOMO');
  const hasRevenge = closed.some(t => t.emotion === 'Revenge');
  const hasFatigue = closed.some(t => t.emotion === 'Fatigue');
  const hasOffPlan = closed.some(t => t.plan === 'Non');
  const hasWeak    = closed.some(t => ['C','D'].includes(t.setupGrade || t.quality));

  const causes = [];
  if(lossStreak >= 2) causes.push(`${lossStreak} pertes consécutives`);
  if(hasRevenge)      causes.push('revenge trade');
  if(hasFomo)         causes.push('FOMO');
  if(hasFatigue)      causes.push('fatigue');
  if(hasOffPlan)      causes.push('hors plan');
  if(hasWeak)         causes.push('setups faibles');
  const causeStr = causes.slice(0,3).join(' + ');

  const actions = {
    Clean  : '— discipline OK',
    Dérive : `→ ${causeStr || 'légère dérive'} · Réduis le risque de 50%`,
    Danger : `→ ${causeStr || 'dérive avancée'} · Arrête de trader 1h minimum`,
    Tilt   : `→ ${causeStr || 'tilt avancé'} · STOP session immédiatement`,
  };
  const icons = { Clean:'[·]', Dérive:'!', Danger:'[!!]', Tilt:'[×]' };
  return `${icons[level]} ${level.toUpperCase()} [${score}/100] ${actions[level] || ''}`;
}

