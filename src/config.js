import Chart from 'chart.js/auto'
import { state } from './state.js'


/* ============================================================
   CHART.JS — CONFIG COSMIQUE GLOBALE
   Palette : accent #4F46E5 · win #5a9e7a · loss #9e5a5a · be #b8923a
============================================================ */
export const C = {
  win:    { line:'rgba(90,158,122,.9)',  fill:'rgba(90,158,122,.08)',  bar:'rgba(90,158,122,.55)',  glow:'rgba(90,158,122,.35)'  },
  loss:   { line:'rgba(158,90,90,.85)', fill:'rgba(158,90,90,.07)',  bar:'rgba(158,90,90,.45)',   glow:'rgba(158,90,90,.3)'   },
  accent: { line:'rgba(79,70,229,.9)',  fill:'rgba(79,70,229,.07)',  bar:'rgba(79,70,229,.55)',   glow:'rgba(79,70,229,.4)'   },
  be:     { line:'rgba(184,146,58,.8)', fill:'rgba(184,146,58,.06)', bar:'rgba(184,146,58,.45)',  glow:'rgba(184,146,58,.3)'  },
  muted:  { line:'rgba(107,114,128,.5)',fill:'rgba(107,114,128,.04)',bar:'rgba(107,114,128,.3)',  glow:'rgba(107,114,128,.2)' },
  grid:   'rgba(255,255,255,.035)',
  tick:   'rgba(107,114,128,.55)',
  font:   { size:10, family:"'DM Mono','SF Mono','Consolas',monospace" },
};

/* Plugin : glow subtil sur les lignes et barres */
export const glowPlugin = {
  id:'cosmicGlow',
  beforeDatasetDraw(chart, args) {
    const ds = chart.data.datasets[args.index];
    if(!ds) return;
    const ctx = chart.ctx;
    const col = ds._glowColor || (Array.isArray(ds.borderColor) ? 'rgba(79,70,229,.3)' : (ds.borderColor||'rgba(79,70,229,.3)'));
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur  = ds._glowBlur || 10;
  },
  afterDatasetDraw(chart) {
    chart.ctx.restore();
  }
};
Chart.register(glowPlugin);

/* Defaults globaux */
Chart.defaults.color             = C.tick;
Chart.defaults.font.family       = C.font.family;
Chart.defaults.font.size         = C.font.size;
Chart.defaults.scale.grid.color  = C.grid;
Chart.defaults.scale.border.color= 'transparent';
Chart.defaults.scale.border.dash = [3,4];
Chart.defaults.scale.ticks.color = C.tick;
Chart.defaults.plugins.legend.labels.color  = 'rgba(107,114,128,.7)';
Chart.defaults.plugins.legend.labels.font   = C.font;
Chart.defaults.plugins.legend.labels.padding= 16;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(8,10,16,.92)';
Chart.defaults.plugins.tooltip.borderColor     = 'rgba(79,70,229,.2)';
Chart.defaults.plugins.tooltip.borderWidth     = 1;
Chart.defaults.plugins.tooltip.titleColor      = 'rgba(230,230,230,.85)';
Chart.defaults.plugins.tooltip.bodyColor       = 'rgba(107,114,128,.8)';
Chart.defaults.plugins.tooltip.padding         = 10;
Chart.defaults.plugins.tooltip.cornerRadius    = 8;
Chart.defaults.plugins.tooltip.titleFont       = { ...C.font, weight:'500' };
Chart.defaults.plugins.tooltip.bodyFont        = C.font;

/* ============================================================
   CONSTANTES & ÉTAT
============================================================ */

export const MONTH_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

// Score max pour la barre visuelle (A+ cible ≈ 14pts)
export const SETUP_SCORE_MAX = 10;

/* ── Icônes SVG globales ──────────────────────────────────────── */
export const ICONS = {
  warning: `<svg viewBox="0 0 24 24" class="icon icon-warning"><path d="M12 2L2 20h20L12 2z"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="17" r="1"/></svg>`,
  error:   `<svg viewBox="0 0 24 24" class="icon icon-error"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  success: `<svg viewBox="0 0 24 24" class="icon icon-success"><polyline points="20 6 9 17 4 12"/></svg>`,
  brain:   `<svg viewBox="0 0 24 24" class="icon icon-brain"><path d="M12 3a4 4 0 00-4 4v1a3 3 0 00-2 3v2a3 3 0 003 3h6a3 3 0 003-3v-2a3 3 0 00-2-3V7a4 4 0 00-4-4z"/></svg>`,
  gear:    `<svg viewBox="0 0 24 24" class="icon icon-gear"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
  info:    `<svg viewBox="0 0 24 24" class="icon icon-info"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="8" r="1" fill="currentColor"/></svg>`,
  fire:    `<svg viewBox="0 0 24 24" class="icon icon-fire"><path d="M12 22c5 0 9-4 9-9 0-4-2-7-5-9 1 3-1 6-3 7 0-3-2-5-4-7-1 4-4 6-4 9a8 8 0 008 9z"/></svg>`,
  close:   `<svg viewBox="0 0 24 24" class="icon icon-error"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
};

// Conversion grade → valeur numérique pour le gap
export const GRADE_VAL = {'A+':5,'A':4,'B':3,'C':2,'D':1};

// Score émotionnel — positif = état favorable, négatif = dégradé
export const EMOTION_SCORE = {
  'Calme'     :  2,
  'Confiance' :  2,
  'Neutre'    :  1,
  'Stress'    : -1,
  'Fatigue'   : -1,
  'FOMO'      : -2,
  'Revenge'   : -3,
};

/**
 * getEmotionDelta(trade)
 * Retourne la variation d'état émotionnel entre entrée et sortie.
 * Positif = amélioration, négatif = dégradation.
 * Ex : Calme→Stress = -3 · Stress→Calme = +3
 */
export function getEmotionDelta(trade){
  const entry = EMOTION_SCORE[trade.emotionEntry] ?? EMOTION_SCORE[trade.emotion] ?? 0;
  const exit  = EMOTION_SCORE[trade.emotionExit]  ?? 0;
  return exit - entry;
}

