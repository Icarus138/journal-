import Chart from 'chart.js/auto'

/* ============================================================
   CHART.JS — CONFIG COSMIQUE GLOBALE
   Palette : accent #4F46E5 · win #5a9e7a · loss #9e5a5a · be #b8923a
============================================================ */
const C = {
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
const glowPlugin = {
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
import { state, LS_KEY } from './state.js'

const MONTH_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

// Score max pour la barre visuelle (A+ cible ≈ 14pts)
const SETUP_SCORE_MAX = 10;

/* ── Icônes SVG globales ──────────────────────────────────────── */
const ICONS = {
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
const GRADE_VAL = {'A+':5,'A':4,'B':3,'C':2,'D':1};

// Score émotionnel — positif = état favorable, négatif = dégradé
const EMOTION_SCORE = {
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
function getEmotionDelta(trade){
  const entry = EMOTION_SCORE[trade.emotionEntry] ?? EMOTION_SCORE[trade.emotion] ?? 0;
  const exit  = EMOTION_SCORE[trade.emotionExit]  ?? 0;
  return exit - entry;
}

/* ============================================================
   UTILITAIRES
============================================================ */
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const pad = n => String(n).padStart(2,'0');

function todayISO(){
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function nowTime(){
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDate(iso){
  if(!iso) return '--';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtDateLong(iso){
  if(!iso || iso === '?') return 'Date inconnue';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
}
function showToast(msg, ms=2200){
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms);
}

/* ============================================================
   HORLOGE
============================================================ */
function updateClock(){
  const n = new Date();
  $('nav-time').textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
  $('nav-date').textContent = n.toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short'});
}
updateClock();
setInterval(updateClock, 1000);

/* ============================================================
   NAVIGATION
============================================================ */
function switchToTab(pageId){
  $$('.nav-tab').forEach(t => t.classList.remove('active'));
  $$('.page').forEach(p => p.classList.remove('active'));
  const tab = document.querySelector(`.nav-tab[data-page="${pageId}"]`);
  if(tab) tab.classList.add('active');
  const page = $(pageId);
  if(page) page.classList.add('active');
}

$$('.nav-tab').forEach(tab => {
  tab.addEventListener('click', function(){
    switchToTab(this.dataset.page);
    if(this.dataset.page === 'page-dashboard') renderDashboard();
    if(this.dataset.page === 'page-history')  renderHistory();
  });
});

/* ============================================================
   TOGGLE GROUPS — helpers
============================================================ */
function getToggleVal(group){
  const active = document.querySelector(`[data-group="${group}"] .tgl.active`);
  return active ? active.dataset.val : '';
}

function setToggleVal(group, val){
  document.querySelectorAll(`[data-group="${group}"] .tgl`).forEach(b => {
    b.classList.toggle('active', b.dataset.val === val);
  });
}

// Initialisation des listeners toggle groups
$$('[data-group]').forEach(group => {
  group.querySelectorAll('.tgl').forEach(btn => {
    btn.addEventListener('click', function(){
      group.querySelectorAll('.tgl').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const g = group.dataset.group;
      if(g === 'status') updateStatusSection();
      // Score mental mis à jour live sur les champs qui l'influencent
      if(['emotion','emotionExit','result','quality','plan'].includes(g)){
        updatePsychoScore();
      }
    });
  });
});

/* ============================================================
   USER SETTINGS — Labels et visibilité des confluences
   Les IDs internes ne changent jamais. Seuls labels + visibilité.
============================================================ */

const DEFAULT_CONFLUENCE_DEFS = [
  { id:'HTF',          label:'HTF',          group:'CONTEXTE'  },
  { id:'Liquidity',    label:'Liquidity',     group:'CONTEXTE'  },
  { id:'Sweep',        label:'Sweep',         group:'CONTEXTE'  },
  { id:'MSS',          label:'MSS',           group:'STRUCTURE' },
  { id:'Displacement', label:'Displacement',  group:'STRUCTURE' },
  { id:'OB',           label:'OB',            group:'ENTRÉE'    },
  { id:'FVG',          label:'FVG',           group:'ENTRÉE'    },
  { id:'BPR',          label:'BPR',           group:'ENTRÉE'    },
  { id:'Prem/Disc',    label:'Prem/Disc',     group:'ENTRÉE'    },
  { id:'Confirmation', label:'Confirmation',  group:'ENTRÉE'    },
  { id:'London',       label:'London',        group:'SESSION'   },
  { id:'NY',           label:'NY',            group:'SESSION'   },
  { id:'Asia',         label:'Asia',          group:'SESSION'   },
];

const SETTINGS_KEY = 'tj_user_settings_v1';

function loadSettings(){
  try{ return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch(e){ return {}; }
}

function saveSettings(settings){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * getConfluenceLabel(id, settings)
 * Retourne le label personnalisé ou le défaut.
 */
function getConfluenceLabel(id, settings){
  return settings?.confluences?.[id]?.label || id;
}

/**
 * isConfluenceVisible(id, settings)
 * Retourne true sauf si l'utilisateur l'a désactivé.
 */
function isConfluenceVisible(id, settings){
  return settings?.confluences?.[id]?.hidden !== true;
}

/**
 * getActiveConfluenceDefs(settings)
 * Retourne les defs filtrées + labels personnalisés.
 */
function getActiveConfluenceDefs(settings = {}){
  return DEFAULT_CONFLUENCE_DEFS
    .filter(d => isConfluenceVisible(d.id, settings))
    .map(d => ({ ...d, label: getConfluenceLabel(d.id, settings) }));
}

// ── Groupes dynamiques issus des settings ───────────────────
// Calculé au chargement, mis à jour si settings changent
state.activeDefs = getActiveConfluenceDefs(loadSettings());

/* ============================================================
   CONFLUENCE UI
============================================================ */

// Groupes de confluences par catégorie — ordre lecture trader
const CONFLUENCE_GROUPS = {
  CONTEXTE  : ['HTF', 'Liquidity', 'Sweep'],
  STRUCTURE : ['MSS', 'Displacement'],
  'ENTRÉE'  : ['OB', 'FVG', 'BPR', 'Prem/Disc', 'Confirmation'],
  SESSION   : ['London', 'NY', 'Asia'],
};

// Mapping catégorie → classe CSS (couleur active)
const GROUP_CSS = {
  CONTEXTE  : 'cat-context',
  STRUCTURE : 'cat-structure',
  'ENTRÉE'  : 'cat-entry',
  SESSION   : 'cat-timing',
};

/**
 * renderConfluenceGroups(selected)
 * Construit le UI confluence structuré par catégorie.
 * Appelé à l'init, au reset et à l'ouverture en mode édition.
 */
function renderConfluenceGroups(selected = [], settings = null){
  const defs = settings
    ? getActiveConfluenceDefs(settings)
    : state.activeDefs;

  // Reconstruire les groupes depuis les defs actives
  const groups = {};
  defs.forEach(d => {
    if(!groups[d.group]) groups[d.group] = [];
    groups[d.group].push(d);
  });

  const container = $('confluence-container');
  if(!container) return;
  container.innerHTML = '';

  Object.entries(groups).forEach(([group, items]) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'confluence-group';

    const title = document.createElement('div');
    title.className = 'confluence-group-title';
    title.textContent = group;

    const row = document.createElement('div');
    row.className = 'confluence-row';

    items.forEach(def => {
      const btn = document.createElement('button');
      btn.className = `confluence-btn ${GROUP_CSS[group] || ''}`;
      btn.textContent = def.label;   // label personnalisé
      btn.dataset.name = def.id;     // ID interne immuable
      btn.type = 'button';
      if(selected.includes(def.id)) btn.classList.add('active');

      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        refreshSetupDisplay();
      });

      row.appendChild(btn);
    });

    groupEl.appendChild(title);
    groupEl.appendChild(row);
    container.appendChild(groupEl);
  });
}

/**
 * getConfluences()
 * Lit les confluences actives depuis les boutons rendus dynamiquement.
 */
function getConfluences(){
  return [...$$('#confluence-container .confluence-btn.active')].map(b => b.dataset.name);
}

// RR prévu → mise à jour du score setup en live
$('f-rr-plan').addEventListener('input', refreshSetupDisplay);
function updateStatusSection(){
  const isOpen = getToggleVal('status') === 'open';
  const rs = $('result-section');
  if(rs) rs.classList.toggle('result-dim', isOpen);
  const ol = $('result-optional-label');
  if(ol) ol.style.display = isOpen ? 'inline' : 'none';
}

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
function calculateSetupEvaluationGap(trade){
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
function updateSetupScore(){
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
function getTPSuggestion(trade, stats){
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
function displayTPSuggestion(suggestion){
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
function getDecisionPaths(trade, tpStats){
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
function displayDecisionPaths(decision){
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
   PSYCHO SCORE
============================================================ */
function computePsycho(){
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

function updatePsychoScore(){
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
function resetForm(){
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
function enterEditMode(trade, mode = 'edit'){
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

function exitEditMode(){
  state.editingTradeId = null;
  state.formMode = 'create';
  $('edit-banner-container').style.display = 'none';
  $('form-panel-title').innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:5px;opacity:.7"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Nouveau trade`;
  $('btn-submit').innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-right:5px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Enregistrer le trade`;
  resetForm();
}

$('cancel-edit-btn').addEventListener('click', exitEditMode);

/* ============================================================
   STOCKAGE
============================================================ */
function saveTrades(){
  localStorage.setItem(LS_KEY, JSON.stringify(state.trades));
  refreshUserStats(); // recalcul adaptatif après chaque mutation
}

function loadTrades(){
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
function migrateTradesData(){
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
function updateTrade(id, fields){
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

/* ============================================================
   EXECUTION ANALYSIS & JOURNAL ANALYSIS
============================================================ */

/**
 * evaluateExecution(trade)
 * Compare le R réalisé vs le RR prévu.
 * Retourne un label d'exécution textuel.
 */
function evaluateExecution(trade){
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
function analyzeJournal(tradeSet){
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

/**
 * getTiltState(tiltScore)
 * Interprète le score comportemental.
 * Retourne : 'STABLE' | 'WARNING' | 'HIGH_RISK'
 */
function getTiltState(tiltScore){
  if(tiltScore <= 1) return 'STABLE';
  if(tiltScore <= 3) return 'WARNING';
  return 'HIGH_RISK';
}

/**
 * getTiltMessage(tiltScore, tradeSet)
 * Message court et actionnable selon l'état.
 */
function getTiltMessage(tiltScore, tradeSet){
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
function displayTilt(tiltScore, state, message){
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
function isTiltReady(){
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
function updateTiltDisplay(){
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
function calculateTiltScore(tradeSet){
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
function getTiltLevel(score){
  if(score >= 80) return { level:'Tilt',   cls:'tilt-tilt',   color:'var(--loss)' };
  if(score >= 60) return { level:'Danger', cls:'tilt-danger',  color:'var(--loss-l)'     };
  if(score >= 30) return { level:'Dérive', cls:'tilt-derive',  color:'var(--be)'   };
  return           { level:'Clean',  cls:'tilt-clean',  color:'var(--win)'  };
}

/**
 * generateTiltWarning(score, tiltObj, tradeSet) — conservé pour le dashboard
 */
function generateTiltWarning(score, tiltObj, tradeSet){
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

/* ============================================================
   LIVE SETUP DISPLAY — Score auto + coverage catégories
   Informationnel uniquement — pas de warning, pas de blocage
============================================================ */

// Mapping confluence → catégorie
const CATEGORY_MAP = {
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
function checkCategoryCoverage(conf){
  const cov = { CONTEXT:false, STRUCTURE:false, ENTRY:false, SESSION:false };
  conf.forEach(c => { if(CATEGORY_MAP[c]) cov[CATEGORY_MAP[c]] = true; });
  return cov;
}

/**
 * getMissingCategories(coverage)
 * Retourne les catégories manquantes.
 */
function getMissingCategories(coverage){
  return Object.entries(coverage).filter(([,v]) => !v).map(([k]) => k);
}

/**
 * getSetupFeedback(grade)
 * Retourne un message court et une classe CSS pour le feedback visuel.
 */
function getSetupFeedback(grade){
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
function getActionableFeedback(grade, rr){
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
function refreshSetupDisplay(){
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

/* ============================================================
   SETUP GRADE STATS & SMART WARNING
============================================================ */

/**
 * getStatsBySetupGrade(tradeSet)
 * Retourne pour chaque grade A+/A/B/C/D :
 *   { n, winrate, avgR } — sur state.trades clôturés uniquement.
 */
function getStatsBySetupGrade(tradeSet){
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
function computeUserStats(tradeSet, filters = {}){
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
        // Fallback anciens state.trades : quality utilisée en remplacement
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
function computeUserProfile(tradeSet){
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
function refreshUserStats(){
  state.USER_STATS   = computeUserStats(state.trades);
  state.USER_PROFILE = computeUserProfile(state.trades);
}

/**
/**
 * isHighProbabilitySetup(conf)
 * Détecte la synergie ICT maximale : HTF bias + MSS + Displacement.
 * Ces 3 ensemble = structure de marché la plus forte possible.
 */
function isHighProbabilitySetup(conf){
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
function getRRRecommendation(grade, userStats){
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
function getAdaptiveFeedback({ grade, rr, emotion, conf = [], setup = '' }){
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

function generateSmartWarning(trade, tradeSet){
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
function displayWarning(warning){
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
   PARTIAL TP — Fonctions pures
============================================================ */

/**
 * computeRealizedR(partials)
 * Calcule le R pondéré depuis les sorties partielles.
 * Chaque partiel : { size, R, date }
 */
function computeRealizedR(partials){
  if(!partials || !partials.length) return null;
  const total = partials.reduce((sum, p) => sum + (p.size || 0) * (p.R || 0), 0);
  return parseFloat(total.toFixed(2));
}

/**
 * normalizePartials(partials)
 * Normalise les tailles pour qu'elles somment à 1.
 */
function normalizePartials(partials){
  const totalSize = partials.reduce((s, p) => s + (p.size || 0), 0);
  if(totalSize === 0) return partials;
  return partials.map(p => ({ ...p, size: parseFloat((p.size / totalSize).toFixed(4)) }));
}

/**
 * updateTradeDates(trade)
 * Dérive entryDate / exitDate depuis les partiels.
 */
function updateTradeDates(trade){
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
function finalizeTrade(trade){
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
function analyzeEmotionShift(state.trades){
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


function addPartialRow(data = {}){
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

function updatePartialComputed(){
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

function getPartialsFromForm(){
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

function clearPartials(){
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
function buildTradeFromForm(existingId = null){
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
   PRE-TRADE INTERCEPTOR
   S'active uniquement avant validation, jamais après.
   Conditions d'activation : même que isTiltReady()
============================================================ */

/**
 * detectRisk(trade, closedTrades)
 * Analyse le trade en cours + l'historique récent.
 * Retourne { score:0–100, reasons:[{text,severity}] }
 */
function detectRisk(trade, closedTrades){
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
function getSetupStats(closedTrades, setupGrade){
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
function getEmotionStats(closedTrades, emotion){
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

function buildInterceptorStats(closedTrades, grade, emotion){
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
function getTriggerLevel(score, tiltState, grade){
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
function showInterceptor(riskData, statsData, tiltData = null){
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
function showConfirmModal(message, confirmLabel = 'Confirmer', destructive = false){
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
function buildTriggerMessage(grade, riskData, statsData){
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
function shouldTrigger(grade, coverage, rr, riskScore, tiltState, conf = [], emotion = ''){
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
function computeSetupPerfByType(state.trades, setup){
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
function computePnLWithoutSetup(state.trades, setup){
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
function showDecisionGate(level, reasons){
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
const AF_KEY = 'tj_af_v1';

function _afLoad()  { try { return JSON.parse(localStorage.getItem(AF_KEY)) || {ignored:0}; } catch { return {ignored:0}; } }
function _afSave(s) { try { localStorage.setItem(AF_KEY, JSON.stringify(s)); } catch {} }
function _afGetIgnored()    { return _afLoad().ignored; }
function _afIncIgnored()    { const s=_afLoad(); s.ignored++; _afSave(s); }
function _afResetIgnored()  { _afSave({ignored:0}); }

/**
 * getRecentMistakeImpact(type, limit = 5)
 * type examples: 'emotion:FOMO' | 'emotion:Revenge' | 'grade:D' | 'plan:Non'
 * Retourne {totalTrades, winrate, totalR, avgR} ou null si données insuffisantes.
 */
function getRecentMistakeImpact(type, limit = 5) {
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
function _afAnalyze(emotion, grade, plan) {
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
function _afDisableWithCountdown(btn, ms, finalLabel) {
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
function showAntifragilePanel(trigger) {
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


/* ============================================================
   CALIBRATION CHARTS — Psychologie & Setup Visualisation
============================================================ */

/* Références des 3 charts calibration */

function destroyCalibrationCharts(){
  [state.cCalBar, state.cCalScatter, state.cCalEquity].forEach(c => { if(c){ c.destroy(); } });
  state.cCalBar = null; state.cCalScatter = null; state.cCalEquity = null;
}

/**
 * Calcule les stats par catégorie de calibration.
 * Entrée : array de state.trades clôturés avec quality + setupGrade + setupEvaluationGap.
 */
function calculateCalibrationStats(calTrades){
  const groups = { aligned:[], overestimated:[], underestimated:[] };
  calTrades.forEach(t => {
    const g = t.setupEvaluationGap;
    if(groups[g]) groups[g].push(t);
  });

  const stat = set => {
    if(!set.length) return null;
    const rs   = set.map(signedR);
    const avgR = rs.reduce((a,b)=>a+b,0) / rs.length;
    const pnls = set.map(t=>t.pnl||0).filter(v=>v!==0);
    const avgP = pnls.length ? pnls.reduce((a,b)=>a+b,0)/pnls.length : null;
    const decisive = set.filter(t => t.result === 'Win' || t.result === 'Loss').length;
    const wr   = decisive === 0 ? 0 : set.filter(t=>t.result==='Win').length / decisive * 100;
    return { n: set.length, avgR, avgP, wr, state.trades: set };
  };

  return {
    aligned       : stat(groups.aligned),
    overestimated : stat(groups.overestimated),
    underestimated: stat(groups.underestimated),
  };
}

/**
 * generateCalibrationInsights(calStats, filtered)
 * Hiérarchisation : 1. Dominant (fréquence) · 2. Leak (R le plus négatif)
 *                   3. Modèle (R le plus positif) · 4. Psycho
 * Ne conclut jamais "tu te surestime" uniquement parce que des surévalués existent.
 * Lecture = fréquence ET impact combinés.
 */
function generateCalibrationInsights(calStats, filtered){
  const rFmt = v => v != null ? (v >= 0 ? '+' : '') + v.toFixed(2) + 'R' : '--';
  const insightItems = [];
  const rules        = [];

  /* Catégories disponibles */
  const cats = [
    { key:'aligned',        label:'alignés',      color:'var(--win)',  icon:'·' },
    { key:'overestimated',  label:'surévalués',   color:'var(--loss)', icon:'↓' },
    { key:'underestimated', label:'sous-évalués', color:'var(--blue)', icon:'↑' },
  ].map(def => {
    const s = calStats[def.key];
    return s && s.n > 0 ? { ...def, n:s.n, avgR:s.avgR, avgP:s.avgP ?? null, wr:s.wr } : null;
  }).filter(Boolean);

  if(!cats.length){
    const ie = $('cal-chart-insights'); if(ie) ie.innerHTML = '';
    const re = $('cal-rules');          if(re) re.innerHTML = '';
    return;
  }

  const total = cats.reduce((a,c) => a + c.n, 0);
  const pct   = n => Math.round(n / total * 100);
  const withR = cats.filter(c => c.avgR !== null);

  /* ── 1. Catégorie dominante (la plus fréquente) ──────────────── */
  const dominant      = cats.reduce((a, b) => b.n > a.n ? b : a);
  const domPct        = pct(dominant.n);
  const domIsPositive = dominant.avgR > 0.05;
  const domIsNegative = dominant.avgR < -0.1;

  let domText = `<strong>Ta catégorie la plus fréquente : setups ${dominant.label} (${domPct}%, ${dominant.n} state.trades · R moyen ${rFmt(dominant.avgR)}).</strong> `;

  if(dominant.key === 'underestimated' && domIsPositive)
    domText += `Ces state.trades sont positifs mais potentiellement sous-exploités — manque de conviction ou prudence excessive sur des setups objectivement solides.`;
  else if(dominant.key === 'underestimated' && domIsNegative)
    domText += `Malgré la fréquence, ces state.trades sont négatifs : le scoring calcule mieux la réalité que ton instinct ici.`;
  else if(dominant.key === 'overestimated' && domIsNegative)
    domText += `Signal d'alerte : tu state.trades trop souvent des setups que le scoring ne valide pas, avec un impact négatif. Filtrer en priorité.`;
  else if(dominant.key === 'overestimated' && domIsPositive)
    domText += `L'impact reste positif sur cette période, mais surveille la tendance — la surévaluation peut créer un biais de confiance à terme.`;
  else if(dominant.key === 'aligned' && domIsPositive)
    domText += `Bonne cohérence : quand instinct et scoring sont en phase, tes résultats sont solides.`;
  else if(dominant.key === 'aligned' && domIsNegative)
    domText += `Même alignés, tes résultats sont négatifs — revoir la qualité des confluences sélectionnées.`;
  else
    domText += `Continue à documenter pour affiner cette analyse.`;

  insightItems.push({ color: dominant.color, text: domText });

  /* ── 2. Leak prioritaire (R le plus négatif, si clairement < −0.1) ── */
  const mostDestruct = withR.length ? withR.reduce((a,b) => b.avgR < a.avgR ? b : a) : null;
  if(mostDestruct && mostDestruct.avgR < -0.1 && mostDestruct.key !== dominant.key){
    const dPct = pct(mostDestruct.n);
    let leakText = `<strong>Leak prioritaire : setups ${mostDestruct.label} (${dPct}%, ${mostDestruct.n} state.trades · R moyen ${rFmt(mostDestruct.avgR)}).</strong> `;
    if(mostDestruct.key === 'overestimated')
      leakText += `Quand perception > scoring, les résultats sont négatifs. Ces state.trades doivent être filtrés ou tradés en taille réduite.`;
    else if(mostDestruct.key === 'underestimated')
      leakText += `Tu entres sur des setups que toi-même tu juges insuffisants — l'instinct te freine mais tu state.trades quand même.`;
    else
      leakText += `Même alignés, ces state.trades détruisent de la valeur — revoir les critères de confluence.`;
    insightItems.push({ color: 'var(--loss)', text: leakText });
    if(mostDestruct.key === 'overestimated')
      rules.push({ color:'var(--loss)', icon:'!', text:'Si qualité perçue > qualité calculée : trade interdit ou taille ×0.5.' });
    else if(mostDestruct.key === 'aligned')
      rules.push({ color:'var(--loss)', icon:'!', text:'Même les setups alignés sont négatifs — revoir la grille de confluences.' });
  } else if(mostDestruct && mostDestruct.avgR < -0.1 && mostDestruct.key === dominant.key){
    // dominant ET destructeur → règle sans répéter l'insight
    if(mostDestruct.key === 'overestimated')
      rules.push({ color:'var(--loss)', icon:'!', text:'Si qualité perçue > qualité calculée : trade interdit ou taille ×0.5.' });
    else if(mostDestruct.key === 'aligned')
      rules.push({ color:'var(--loss)', icon:'!', text:'Même les setups alignés sont négatifs — revoir la grille de confluences.' });
  }

  /* ── 3. Modèle à reproduire (R le plus positif) ──────────────── */
  const mostProfit = withR.length ? withR.reduce((a,b) => b.avgR > a.avgR ? b : a) : null;
  if(mostProfit && mostProfit.avgR > 0.1){
    const prPct = pct(mostProfit.n);
    let profitText = `<strong>Meilleure performance : setups ${mostProfit.label} (${prPct}%, ${mostProfit.n} state.trades · R moyen ${rFmt(mostProfit.avgR)}).</strong> `;
    if(mostProfit.key === 'aligned')
      profitText += `Quand perception et scoring sont cohérents, tes résultats sont nettement supérieurs. Ce pattern est à reproduire systématiquement.`;
    else if(mostProfit.key === 'underestimated')
      profitText += `Tes meilleurs state.trades sont ceux que tu sous-estimes. Travailler la conviction et le sizing sur ces setups — tu pourrais en extraire bien plus.`;
    else if(mostProfit.key === 'overestimated')
      profitText += `Tes surévaluations restent positives sur cette période — surveille si c'est structurel ou un effet statistique court terme.`;
    insightItems.push({ color: mostProfit.color, text: profitText });
    if(mostProfit.key === 'aligned')
      rules.push({ color:'var(--win)', icon:'·', text:'Priorité absolue aux state.trades où perception et scoring sont alignés.' });
    else if(mostProfit.key === 'underestimated')
      rules.push({ color:'var(--blue)', icon:'↑', text:'Sur les sous-évalués positifs : travailler la conviction et le sizing progressif.' });
  }

  /* ── 4. Score mental ─────────────────────────────────────────── */
  const hasPsycho  = filtered.filter(t => t.psycho != null && t.result);
  if(hasPsycho.length >= 5){
    const lowPsycho  = hasPsycho.filter(t => t.psycho < 50);
    const highPsycho = hasPsycho.filter(t => t.psycho >= 65);
    if(lowPsycho.length >= 2){
      const rLow  = lowPsycho.reduce((a,t)  => a + signedR(t), 0) / lowPsycho.length;
      const rHigh = highPsycho.length
        ? highPsycho.reduce((a,t) => a + signedR(t), 0) / highPsycho.length
        : null;
      const lossPct = Math.round(lowPsycho.filter(t => t.result === 'Loss').length / lowPsycho.length * 100);
      insightItems.push({
        color: rLow < 0 ? 'var(--loss)' : 'var(--be)',
        text : `<strong>Score mental < 50 : ${lowPsycho.length} state.trades, R moyen ${rFmt(rLow)}</strong>` +
          (rHigh !== null ? ` vs ${rFmt(rHigh)} quand score ≥ 65.` : '.') +
          (rLow < 0
            ? ` L'état mental influence directement la performance — ${lossPct}% de pertes dans cet état.`
            : ` Impact limité sur cette période.`)
      });
      if(rLow < 0) rules.push({ color:'var(--loss)', icon:'!', text:'Aucun trade si score mental < 50.' });
    }
  }

  /* ── Rendu HTML ──────────────────────────────────────────────── */
  const insEl = $('cal-chart-insights');
  if(insEl) insEl.innerHTML = insightItems.map(i =>
    `<div class="insight-item" style="margin-bottom:6px">` +
    `<div class="insight-dot" style="background:${i.color}"></div>` +
    `<div class="insight-text">${i.text}</div></div>`
  ).join('');

  const rulesEl = $('cal-rules');
  if(rulesEl && rules.length){
    rulesEl.innerHTML =
      `<div style="border:1px solid rgba(255,255,255,.09);border-radius:var(--r);overflow:hidden;margin-top:4px">` +
      `<div style="padding:8px 14px;background:rgba(255,255,255,.03);border-bottom:1px solid rgba(255,255,255,.07)">` +
      `<span style="font-family:var(--mono);font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:var(--t2)">` +
      `&#9654; Règles issues de tes données</span></div>` +
      `<div style="padding:10px 14px;display:flex;flex-direction:column;gap:7px">` +
      rules.map(r =>
        `<div style="display:flex;align-items:center;gap:10px">` +
        `<span style="font-size:1rem;flex-shrink:0">${r.icon}</span>` +
        `<span style="font-family:var(--mono);font-size:.72rem;color:var(--t1);` +
        `border-left:2px solid ${r.color};padding-left:10px">${r.text}</span></div>`
      ).join('') +
      `</div></div>`;
  } else if(rulesEl){ rulesEl.innerHTML = ''; }
}

/**
 * Construit les 3 charts calibration. Détruit les instances précédentes d'abord.
 * N'affiche le panel que si assez de données exploitables.
 */
function renderCalibrationCharts(filtered){
  destroyCalibrationCharts();

  // Trades exploitables : clôturés, avec psycho valide OU gap valide
  const calTrades = filtered.filter(t =>
    t.quality && t.setupGrade && t.setupEvaluationGap && t.result
  );
  const scatterTrades = filtered.filter(t =>
    t.psycho != null && t.result && (t.result === 'Win' || t.result === 'Loss' || t.result === 'BE')
  );

  const hasEnough = calTrades.length >= 2 || scatterTrades.length >= 3;
  const panel = $('panel-cal-charts');
  if(panel) panel.style.display = hasEnough ? '' : 'none';
  if(!hasEnough) return;

  const calStats = calculateCalibrationStats(calTrades);
  const CHART_OPTS_BASE = {
    responsive:true, maintainAspectRatio:false,
    animation:{duration:500,easing:'easeOutQuart'},
    plugins:{ legend:{ labels:{ color:'rgba(107,114,128,.7)', font:C.font, boxWidth:8, padding:12 }, position:'bottom' } },
    scales:{
      x:{ ticks:{color:C.tick,font:C.font}, grid:{color:C.grid} },
      y:{ ticks:{color:C.tick,font:C.font}, grid:{color:C.grid} },
    }
  };

  /* ── Chart 1 : Bar — R moyen par calibration ───────────────────────────── */
  if(calTrades.length >= 2){
    const cats = [
      { key:'aligned',        label:'Alignés',      color:C.win.bar,   border:C.win.line,    glow:C.win.glow   },
      { key:'overestimated',  label:'Surévalués',   color:C.loss.bar,  border:C.loss.line,   glow:C.loss.glow  },
      { key:'underestimated', label:'Sous-évalués', color:C.accent.bar,border:C.accent.line, glow:C.accent.glow},
    ];
    const labels   = cats.map(c => c.label);
    const rValues  = cats.map(c => calStats[c.key] ? parseFloat(calStats[c.key].avgR.toFixed(2)) : 0);
    const nValues  = cats.map(c => calStats[c.key]?.n || 0);
    const pnlVals  = cats.map(c => calStats[c.key]?.avgP != null ? parseFloat(calStats[c.key].avgP.toFixed(0)) : null);

    state.cCalBar = new Chart($('chart-cal-bar'), {
      type:'bar',
      data:{
        labels,
        datasets:[{
          label:'R moyen',
          data: rValues,
          backgroundColor: cats.map(c => c.color),
          borderColor:     cats.map(c => c.border),
          borderWidth:1.5, borderRadius:4, borderSkipped:false,
          _glowBlur:10,_glowColor:'rgba(79,70,229,.2)',
        }]
      },
      options:{
        ...CHART_OPTS_BASE,
        plugins:{
          ...CHART_OPTS_BASE.plugins,
          legend:{ display:false },
          tooltip:{
            callbacks:{
              label: ctx => {
                const i = ctx.dataIndex;
                const rv = rValues[i];
                const n  = nValues[i];
                const p  = pnlVals[i];
                const lines = [`R moyen : ${rv >= 0?'+':''}${rv}R`, `Trades : ${n}`];
                if(p != null) lines.push(`PnL moyen : ${p >= 0?'+':''}${p}$`);
                return lines;
              }
            }
          }
        },
        scales:{
          x:{ ticks:{color:C.tick,font:C.font}, grid:{color:C.grid} },
          y:{ ticks:{color:C.tick,font:C.font, callback: v => (v>=0?'+':'')+v+'R'}, grid:{color:C.grid} }
        }
      }
    });
  }

  /* ── Chart 2 : Scatter — Score mental vs R réel ────────────────────────── */
  if(scatterTrades.length >= 3){
    const emotColors = {
      Calme:'rgba(90,158,122,.85)', Confiance:'rgba(79,70,229,.85)',
      FOMO:'rgba(158,90,90,.85)',  Stress:'rgba(184,146,58,.8)',
      Fatigue:'rgba(107,114,128,.7)', Revenge:'rgba(158,90,90,.9)',
    };
    const points = scatterTrades.map(t => ({
      x    : t.psycho,
      y    : parseFloat(signedR(t).toFixed(2)),
      _t   : t,
      color: emotColors[t.emotion] || 'rgba(107,114,128,.6)',
    }));

    state.cCalScatter = new Chart($('chart-cal-scatter'), {
      type:'scatter',
      data:{
        datasets:[{
          label:'Trades',
          data: points,
          backgroundColor: points.map(p => p.color),
          pointRadius:5, pointHoverRadius:7,
        }]
      },
      options:{
        ...CHART_OPTS_BASE,
        plugins:{
          legend:{ display:false },
          tooltip:{
            callbacks:{
              label: ctx => {
                const t = ctx.raw._t;
                return [
                  `${t.asset||'--'} · ${t.date||'--'}`,
                  `Émotion : ${t.emotion||'--'}`,
                  `Grade calc. : ${t.setupGrade||'--'} · Perçue : ${t.quality||'--'}`,
                  `R réel : ${ctx.raw.y >= 0?'+':''}${ctx.raw.y}R`,
                  t.pnl ? `PnL : ${t.pnl >= 0?'+':''}${t.pnl}$` : '',
                ].filter(Boolean);
              },
              title: () => ''
            }
          }
        },
        scales:{
          x:{
            title:{ display:true, text:'Score mental', color:C.tick, font:C.font },
            min:0, max:100,
            ticks:{color:C.tick,font:C.font}, grid:{color:C.grid},
          },
          y:{
            title:{ display:true, text:'R signé', color:C.tick, font:C.font },
            ticks:{color:C.tick,font:C.font, callback: v => (v>=0?'+':'')+v+'R'},
            grid:{color:C.grid},
          }
        }
      }
    });
  }

  /* ── Chart 3 : Multi-line equity par calibration ───────────────────────── */
  if(calTrades.length >= 2){
    // Ordonner tous les state.trades clôturés chronologiquement
    const chrono = sortedByDateTime(filtered, true);

    const buildEquity = (set) => {
      // Recalcule le R cumulé dans l'ordre chronologique global
      // On inclut un point pour chaque trade de `set` dans l'ordre
      const pts = []; let cum = 0;
      chrono.forEach(t => {
        if(set.some(s => Number(s.id) === Number(t.id))){
          cum += signedR(t);
          pts.push(parseFloat(cum.toFixed(2)));
        }
      });
      return pts;
    };

    const alignedSet  = calTrades.filter(t => t.setupEvaluationGap === 'aligned');
    const overSet     = calTrades.filter(t => t.setupEvaluationGap === 'overestimated');
    const underSet    = calTrades.filter(t => t.setupEvaluationGap === 'underestimated');

    // Labels = index trade global
    const maxLen = Math.max(filtered.length, 1);
    const globalLabels = filtered.map((_,i) => '#'+(i+1));
    const globalEquity = []; let gc = 0;
    sortedByDateTime(filtered, true).forEach(t => { gc += signedR(t); globalEquity.push(parseFloat(gc.toFixed(2))); });

    const datasets = [
      { label:'Global',     data:globalEquity,         borderColor:C.muted.line, fill:false, borderWidth:1.5, borderDash:[4,3], pointRadius:0, tension:.3 },
      { label:'Alignés',    data:buildEquity(alignedSet),  borderColor:C.win.line,    fill:false, borderWidth:2, pointRadius:0, tension:.3, _glowColor:C.win.glow,    _glowBlur:8 },
      { label:'Surévalués', data:buildEquity(overSet),     borderColor:C.loss.line,   fill:false, borderWidth:2, pointRadius:0, tension:.3, _glowColor:C.loss.glow,   _glowBlur:8 },
      { label:'Sous-éval.', data:buildEquity(underSet),    borderColor:C.accent.line, fill:false, borderWidth:2, pointRadius:0, tension:.3, _glowColor:C.accent.glow, _glowBlur:8 },
    ].filter(d => d.data.length > 0);

    state.cCalEquity = new Chart($('chart-cal-equity'), {
      type:'line',
      data:{ labels: globalLabels, datasets },
      options:{
        ...CHART_OPTS_BASE,
        plugins:{
          ...CHART_OPTS_BASE.plugins,
          legend:{ ...CHART_OPTS_BASE.plugins.legend, display:true },
        },
        scales:{
          x:{ ticks:{color:C.tick,font:C.font,maxTicksLimit:12}, grid:{color:C.grid} },
          y:{
            ticks:{color:C.tick,font:C.font, callback: v => (v>=0?'+':'')+v+'R'},
            grid:{color:C.grid},
          }
        }
      }
    });
  }

  /* Insights + règles */
  generateCalibrationInsights(calStats, filtered);
}

/* ============================================================
   TILT DASHBOARD — Corrélation tilt vs performance
============================================================ */
function renderTiltDashboard(filtered){
  // Trades clôturés avec tiltScore enregistré
  const withTilt = filtered.filter(t => t.tiltScore != null && t.result);

  const panel = $('panel-tilt-dash');
  if(!withTilt.length){
    if(panel) panel.style.display = 'none';
    return;
  }
  if(panel) panel.style.display = '';

  // Stats globales
  const avgScore   = withTilt.reduce((a,t) => a+t.tiltScore, 0) / withTilt.length;
  const dangerN    = withTilt.filter(t => t.tiltScore >= 60).length;
  const cleanSet   = withTilt.filter(t => t.tiltScore <= 30);
  const tiltedSet  = withTilt.filter(t => t.tiltScore > 30);
  const avgR       = set => set.length ? set.reduce((a,t)=>a+signedR(t),0)/set.length : null;
  const rFmt       = v  => v != null ? (v>=0?'+':'')+v.toFixed(2)+'R' : '--';

  const rClean = avgR(cleanSet);
  const rTilt  = avgR(tiltedSet);

  $('td-avg-score').textContent   = avgScore.toFixed(0);
  $('td-avg-score').style.color   = avgScore >= 60 ? 'var(--loss)' : avgScore >= 30 ? 'var(--be)' : 'var(--win)';
  $('td-danger-count').textContent = dangerN;
  $('td-danger-count').style.color = dangerN > 0 ? 'var(--loss)' : 'var(--t3)';

  $('td-r-clean').textContent  = rFmt(rClean);
  $('td-r-clean').style.color  = rClean != null ? (rClean>=0?'var(--win)':'var(--loss)') : 'var(--t3)';
  $('td-r-tilt').textContent   = rFmt(rTilt);
  $('td-r-tilt').style.color   = rTilt  != null ? (rTilt>=0?'var(--win)':'var(--loss)') : 'var(--t3)';

  // Tableau par niveau
  const levels = [
    { key:'Clean',  label:'[·] Clean',  min:0,  max:30,  color:'var(--win)'  },
    { key:'Dérive', label:'[!] Dérive', min:31, max:59,  color:'var(--be)'   },
    { key:'Danger', label:'[!!] Danger', min:60, max:79,  color:'var(--loss-l)'     },
    { key:'Tilt',   label:'[×] Tilt',   min:80, max:100, color:'var(--loss)' },
  ];
  $('tilt-level-tbody').innerHTML = levels.map(lv => {
    const set = withTilt.filter(t => t.tiltScore >= lv.min && t.tiltScore <= lv.max);
    if(!set.length) return `<tr><td style="color:${lv.color}">${lv.label}</td><td style="color:var(--t4)">0</td><td>--</td><td>--</td></tr>`;
    const r   = avgR(set);
    const dec = set.filter(t => t.result === 'Win' || t.result === 'Loss').length;
    const wr  = dec === 0 ? 0 : set.filter(t=>t.result==='Win').length / dec * 100;
    return `<tr>
      <td style="color:${lv.color};font-weight:600">${lv.label}</td>
      <td style="font-family:var(--mono)">${set.length}</td>
      <td style="font-family:var(--mono);color:${r>=0?'var(--win)':'var(--loss)'}">${rFmt(r)}</td>
      <td style="font-family:var(--mono)">${wr.toFixed(0)}%</td>
    </tr>`;
  }).join('');

  // Scatter tilt score vs R réel
  if(state.chartTiltScatter){ state.chartTiltScatter.destroy(); state.chartTiltScatter = null; }
  const scatterEl = $('chart-tilt-scatter');
  if(scatterEl && withTilt.length >= 3){
    const points = withTilt.map(t => ({
      x   : t.tiltScore,
      y   : parseFloat(signedR(t).toFixed(2)),
      _t  : t,
      col : t.tiltScore >= 80 ? 'rgba(158,90,90,.85)'  :
            t.tiltScore >= 60 ? 'rgba(158,90,90,.5)'   :
            t.tiltScore >= 30 ? 'rgba(184,146,58,.75)'  :
                                'rgba(90,158,122,.75)',
    }));
    state.chartTiltScatter = new Chart(scatterEl, {
      type:'scatter',
      data:{ datasets:[{
        label:'Trades', data:points,
        backgroundColor: points.map(p=>p.col),
        pointRadius:5, pointHoverRadius:7,
        pointBorderColor:'transparent',
        _glowBlur:8,_glowColor:'rgba(79,70,229,.15)',
      }]},
      options:{
        responsive:true, maintainAspectRatio:false,
        animation:{duration:400,easing:'easeOutQuart'},
        plugins:{
          legend:{ display:false },
          tooltip:{
            callbacks:{
              label: ctx => {
                const t = ctx.raw._t;
                return [
                  `${t.asset||'--'} · ${t.date||'--'}`,
                  `Tilt : ${t.tiltScore} [${t.tiltLevel||'--'}]`,
                  `Émotion : ${t.emotion||'--'}`,
                  `R réel : ${ctx.raw.y >= 0?'+':''}${ctx.raw.y}R`,
                  t.pnl ? `PnL : ${t.pnl>=0?'+':''}${t.pnl}$` : '',
                ].filter(Boolean);
              },
              title: ()=>''
            }
          }
        },
        scales:{
          x:{
            title:{ display:true, text:'Tilt Score', color:C.tick, font:C.font },
            min:0, max:100,
            ticks:{color:C.tick,font:C.font}, grid:{color:C.grid},
          },
          y:{
            title:{ display:true, text:'R signé', color:C.tick, font:C.font },
            ticks:{color:C.tick,font:C.font,callback:v=>(v>=0?'+':'')+v+'R'},
            grid:{color:C.grid},
          }
        }
      }
    });
  }
}

/* ============================================================
   EDGE DETECTION — Setups profitables vs à éviter
   Basé uniquement sur state.trades clôturés, ≥ 5 par grade.
============================================================ */

/**
 * computeSetupPerformance(closedTrades)
 * Groupe les state.trades par setupGrade, calcule les stats.
 * Ignore les grades avec < 5 state.trades.
 */
function computeSetupPerformance(closedTrades){
  const groups = {};
  closedTrades.forEach(t => {
    const key = t.setupGrade;
    if(!key) return;
    if(!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  const results = {};
  for(const grade in groups){
    const list = groups[grade];
    if(list.length < 5) continue;
    const decisive = list.filter(t => t.result === 'Win' || t.result === 'Loss');
    const wins     = list.filter(t => t.result === 'Win').length;
    const avgR     = list.reduce((sum, t) => sum + signedR(t), 0) / list.length;
    results[grade] = {
      count  : list.length,
      winRate: decisive.length ? Math.round(wins / decisive.length * 100) : 0,
      avgR   : parseFloat(avgR.toFixed(2)),
    };
  }
  return results;
}

/**
 * detectEdge(performance)
 * Classifie chaque setup en EDGE (profitable) ou AVOID (perdant).
 */
function detectEdge(performance){
  const edges = [];
  for(const grade in performance){
    const d = performance[grade];
    if(d.winRate >= 55 && d.avgR > 0)
      edges.push({ grade, type:'EDGE',  ...d });
    else if(d.winRate < 40 && d.avgR < 0)
      edges.push({ grade, type:'AVOID', ...d });
  }
  return edges;
}

/**
 * generateEdgeInsights(closedTrades)
 * Retourne les edges détectés à partir des données réelles.
 */
function generateEdgeInsights(closedTrades){
  const perf  = computeSetupPerformance(closedTrades);
  return detectEdge(perf);
}

/**
 * renderEdgeInsights(filtered)
 * Affiche le panel edge detection dans le dashboard.
 */
/**
 * computeEmotionShiftStats(state.trades)
 * Analyse l'impact de l'évolution émotionnelle (entrée→sortie) sur le R réel.
 * Requiert emotionEntry + emotionExit + rrReal sur au moins 5 state.trades clôturés.
 */
function computeEmotionShiftStats(state.trades){
  const closed = state.trades.filter(t =>
    t.status === 'closed' &&
    t.emotionEntry &&
    t.emotionExit &&
    t.rrReal != null
  );
  if(closed.length < 5) return null;

  const improved = [];
  const degraded = [];

  closed.forEach(t => {
    const delta = getEmotionDelta(t);
    if(delta > 0) improved.push(t.rrReal);
    if(delta < 0) degraded.push(t.rrReal);
  });

  const avg = arr => arr.length ? arr.reduce((a,b) => a+b, 0) / arr.length : 0;

  // Détection patterns destructeurs (paires entrée→sortie fréquentes et négatives)
  const pairMap = {};
  closed.forEach(t => {
    const delta = getEmotionDelta(t);
    if(delta >= 0) return; // n'analyser que les dégradations
    const key = `${t.emotionEntry}→${t.emotionExit}`;
    if(!pairMap[key]) pairMap[key] = { count:0, totalR:0 };
    pairMap[key].count++;
    pairMap[key].totalR += t.rrReal;
  });

  const destructivePatterns = Object.entries(pairMap)
    .filter(([,v]) => v.count >= 3 && (v.totalR / v.count) < -0.5)
    .sort((a,b) => (a[1].totalR/a[1].count) - (b[1].totalR/b[1].count))
    .slice(0, 3)
    .map(([pair, v]) => ({
      pair,
      count   : v.count,
      avgR    : parseFloat((v.totalR / v.count).toFixed(2)),
    }));

  return {
    improvedAvg      : parseFloat(avg(improved).toFixed(2)),
    degradedAvg      : parseFloat(avg(degraded).toFixed(2)),
    improvedCount    : improved.length,
    degradedCount    : degraded.length,
    destructivePatterns,
  };
}

/**
 * renderEmotionShiftPanel(filtered)
 * Affiche le panel Évolution Émotionnelle dans le dashboard.
 */
function renderEmotionShiftPanel(filtered){
  const panel = $('panel-emotion-shift');
  if(!panel) return;

  const stats = computeEmotionShiftStats(filtered);
  if(!stats || (stats.improvedCount + stats.degradedCount) < 5){
    panel.style.display = 'none';
    return;
  }
  panel.style.display = '';

  const rFmt = v => (v >= 0 ? '+' : '') + v.toFixed(2) + 'R';

  // Carte amélioration
  const impAvgEl  = $('es-improved-avg');
  const impCntEl  = $('es-improved-count');
  if(impAvgEl){
    impAvgEl.textContent = stats.improvedCount > 0 ? rFmt(stats.improvedAvg) : '--';
    impAvgEl.style.color = stats.improvedCount > 0
      ? (stats.improvedAvg >= 0 ? 'var(--win)' : 'var(--loss)')
      : 'var(--t3)';
  }
  if(impCntEl) impCntEl.textContent = stats.improvedCount + ' trade' + (stats.improvedCount !== 1 ? 's' : '');

  // Carte dégradation
  const degAvgEl  = $('es-degraded-avg');
  const degCntEl  = $('es-degraded-count');
  if(degAvgEl){
    degAvgEl.textContent = stats.degradedCount > 0 ? rFmt(stats.degradedAvg) : '--';
    degAvgEl.style.color = stats.degradedCount > 0
      ? (stats.degradedAvg >= 0 ? 'var(--win)' : 'var(--loss)')
      : 'var(--t3)';
  }
  if(degCntEl) degCntEl.textContent = stats.degradedCount + ' trade' + (stats.degradedCount !== 1 ? 's' : '');

  // Verdict
  const verdictEl = $('es-verdict');
  if(verdictEl){
    const gap = stats.improvedAvg - stats.degradedAvg;
    if(stats.degradedCount >= 3 && stats.degradedAvg < 0){
      verdictEl.textContent  = '[!] Tu perds en moyenne quand ton mental se détériore';
      verdictEl.style.background = 'rgba(158,90,90,.06)';
      verdictEl.style.borderColor = 'rgba(158,90,90,.16)';
      verdictEl.style.color       = 'var(--loss)';
    } else if(stats.improvedCount >= 3 && gap > 0.5){
      verdictEl.textContent  = ' Ton mental stable ou en progression = meilleurs résultats';
      verdictEl.style.background = 'rgba(90,158,122,.06)';
      verdictEl.style.borderColor = 'rgba(90,158,122,.14)';
      verdictEl.style.color       = 'var(--win)';
    } else {
      verdictEl.textContent  = ' Impact émotionnel faible — données insuffisantes pour conclure';
      verdictEl.style.background = 'rgba(184,146,58,.06)';
      verdictEl.style.borderColor = 'rgba(245,158,11,.18)';
      verdictEl.style.color       = 'var(--be)';
    }
  }

  // Patterns destructeurs
  const patternsEl = $('es-patterns');
  if(patternsEl){
    if(stats.destructivePatterns.length > 0){
      patternsEl.innerHTML =
        `<div style="font-family:var(--mono);font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);margin-bottom:6px">Patterns destructeurs détectés</div>` +
        stats.destructivePatterns.map(p =>
          `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;margin-bottom:4px;background:rgba(255,255,255,.02);border-radius:6px;border-left:2px solid var(--loss)">
            <span style="font-family:var(--mono);font-size:.68rem;color:var(--t2)">${p.pair} <span style="color:var(--t4)">(${p.count}×)</span></span>
            <span style="font-family:var(--mono);font-size:.72rem;font-weight:700;color:var(--loss)">${(p.avgR >= 0 ? '+' : '') + p.avgR}R</span>
          </div>`
        ).join('');
    } else {
      patternsEl.innerHTML = '';
    }
  }
}

function renderEdgeInsights(filtered){
  const panel = $('panel-edge');
  if(!panel) return;

  const edges = generateEdgeInsights(filtered);
  const perf  = computeSetupPerformance(filtered);
  const rFmt  = v => (v >= 0 ? '+' : '') + v.toFixed(2) + 'R';

  const edgeList  = edges.filter(e => e.type === 'EDGE').sort((a,b) => b.avgR - a.avgR);
  const avoidList = edges.filter(e => e.type === 'AVOID').sort((a,b) => a.avgR - b.avgR);

  // Masquer si pas assez de données
  const hasSufficientData = Object.keys(perf).length > 0;
  panel.style.display = hasSufficientData ? '' : 'none';
  if(!hasSufficientData) return;

  const gradeBadgeMap = {'A+':'badge-ap','A':'badge-a','B':'badge-b','C':'badge-c','D':'badge-d'};

  const renderEdgeItem = (e, isEdge) => {
    const color = isEdge ? 'var(--win)' : 'var(--loss)';
    const bg    = isEdge ? 'rgba(34,197,94,.06)' : 'rgba(158,90,90,.06)';
    const border= isEdge ? 'rgba(90,158,122,.14)'  : 'rgba(158,90,90,.16)';
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:${bg};border:1px solid ${border};border-radius:var(--r);margin-bottom:6px">
        <span class="badge ${gradeBadgeMap[e.grade]||''}">${e.grade}</span>
        <span style="font-family:var(--mono);font-size:.68rem;color:${color};font-weight:700">${e.winRate}% WR</span>
        <span style="font-family:var(--mono);font-size:.68rem;color:${color}">${rFmt(e.avgR)}</span>
        <span style="font-family:var(--mono);font-size:.62rem;color:var(--t3);margin-left:auto">${e.count} state.trades</span>
      </div>`;
  };

  // Stats complètes de tous les grades analysés
  const allGrades = Object.entries(perf).sort((a,b) => b[1].avgR - a[1].avgR);
  const allHTML = allGrades.map(([grade, d]) => {
    const col = d.avgR >= 0 ? 'var(--win)' : 'var(--loss)';
    return `<tr>
      <td><span class="badge ${gradeBadgeMap[grade]||''}">${grade}</span></td>
      <td style="font-family:var(--mono)">${d.count}</td>
      <td style="font-family:var(--mono);color:${d.winRate>=50?'var(--win)':'var(--loss)'}">${d.winRate}%</td>
      <td style="font-family:var(--mono);color:${col}">${rFmt(d.avgR)}</td>
    </tr>`;
  }).join('');

  $('edge-edge-list').innerHTML  = edgeList.length
    ? edgeList.map(e => renderEdgeItem(e, true)).join('')
    : `<div style="font-family:var(--mono);font-size:.65rem;color:var(--t4)">Pas encore d'edge détecté (WR≥55% & R>0).</div>`;

  $('edge-avoid-list').innerHTML = avoidList.length
    ? avoidList.map(e => renderEdgeItem(e, false)).join('')
    : `<div style="font-family:var(--mono);font-size:.65rem;color:var(--t4)">Pas de setup à éviter identifié.</div>`;

  $('edge-all-tbody').innerHTML = allHTML ||
    `<tr><td colspan="4" style="text-align:center;color:var(--t4)">Minimum 5 state.trades par grade requis.</td></tr>`;
}


/* ============================================================
   SIGNED R — priorité à realizedR (partials)
============================================================ */
function signedR(t){
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

/* ============================================================
   MINI STATS (page log)
============================================================ */
function updateMiniStats(){
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

/* ============================================================
   HISTORIQUE
============================================================ */
function sortedByDateTime(tradeSet, asc){
  return [...tradeSet].sort((a,b) => {
    const da = (a.date||'0000-00-00')+'T'+(a.time||'00:00');
    const db = (b.date||'0000-00-00')+'T'+(b.time||'00:00');
    return asc ? da.localeCompare(db) : db.localeCompare(da);
  });
}

function renderHistory(){
  const filterResult = $('f-filter-result').value;
  const filterAsset  = $('f-filter-asset').value;
  const filterType   = $('f-filter-type').value;
  const filterStatus = $('f-filter-status').value;
  const filterGrade  = $('f-filter-grade').value;

  let filtered = state.trades.filter(t => {
    if(filterResult && t.result !== filterResult) return false;
    if(filterAsset  && t.asset  !== filterAsset)  return false;
    if(filterType   && t.type   !== filterType)   return false;
    if(filterStatus && t.status !== filterStatus) return false;
    if(filterGrade){
      const g = t.setupGrade || t.quality || '';
      if(g !== filterGrade) return false;
    }
    return true;
  });

  filtered = sortedByDateTime(filtered, state.historySortAsc);

  $('hist-count').textContent = filtered.length + ' trade' + (filtered.length !== 1 ? 's' : '');

  const sortBtn = $('btn-sort-dir');
  if(sortBtn){
    sortBtn.textContent = state.historySortAsc ? '↑ Ancien → Récent' : '↓ Récent → Ancien';
    sortBtn.classList.toggle('sort-asc', state.historySortAsc);
  }

  const assets = [...new Set(state.trades.map(t => t.asset).filter(Boolean))];
  const sel = $('f-filter-asset');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Tous actifs</option>' +
    assets.map(a => `<option${a===cur?' selected':''}>${a}</option>`).join('');

  if(!filtered.length){
    $('history-container').innerHTML = '<div class="empty-state">Aucun trade correspondant.</div>';
    return;
  }

  const rBadge = {Win:'badge-win',Loss:'badge-loss',BE:'badge-be'};
  const dBadge = {Long:'badge-long',Short:'badge-short'};
  const gMap   = {'A+':'badge-ap','A':'badge-a','B':'badge-b','C':'badge-c','D':'badge-d'};
  const emotIcons = {Calme:'○',Confiance:'▲',FOMO:'!',Stress:'!',Fatigue:'○',Revenge:'!!'};

  const gradeBadge = g => g ? `<span class="badge ${gMap[g]||''}">${g}</span>` : '<span style="color:var(--t4)">--</span>';
  const gapIcon    = {aligned:'<span class="badge-aligned">·</span>',overestimated:'<span class="badge-over">↓</span>',underestimated:'<span class="badge-under">↑</span>'};

  const calCell = t => {
    const pB = t.quality    ? gradeBadge(t.quality)    : '<span style="color:var(--t4)">--</span>';
    const cB = t.setupGrade ? gradeBadge(t.setupGrade) : '<span style="color:var(--t4)">--</span>';
    const gap = t.setupEvaluationGap ? (gapIcon[t.setupEvaluationGap]||'') : '';
    if(!t.quality && !t.setupGrade) return '--';
    if(!t.quality) return cB;
    return `${pB}<span style="color:var(--t4);font-size:.65rem;margin:0 2px">→</span>${cB} ${gap}`;
  };

  const formatR = t => {
    if(t.status === 'open') return '<span style="color:var(--be);font-family:var(--mono);font-size:.68rem">EN COURS</span>';
    const rv = signedR(t);
    if(rv === 0 && t.result !== 'BE') return '--';
    const v = rv > 0 ? '+'+rv.toFixed(2) : rv.toFixed(2);
    const c = rv > 0 ? 'var(--win)' : rv < 0 ? 'var(--loss)' : 'var(--be)';
    const partialBadge = t.partials && t.partials.length > 1
      ? ` <span style="font-family:var(--mono);font-size:.58rem;color:var(--t3)">${t.partials.length}×TP</span>` : '';
    return `<span style="color:${c};font-family:var(--mono);font-weight:700">${v}R</span>${partialBadge}`;
  };

  const byDay = {};
  const dayOrder = [];
  filtered.forEach(t => {
    const d = t.date || '?';
    if(!byDay[d]){ byDay[d] = []; dayOrder.push(d); }
    byDay[d].push(t);
  });

  let rows = '';
  dayOrder.forEach(d => {
    const dt = byDay[d];
    const dtClosed = dt.filter(t => t.status === 'closed');
    const dayR     = dtClosed.reduce((a,t) => a + signedR(t), 0);
    const dayPnl   = dtClosed.reduce((a,t) => a + (t.pnl||0), 0);
    const dayWins  = dtClosed.filter(t => t.result === 'Win').length;
    const dayLoss  = dtClosed.filter(t => t.result === 'Loss').length;
    const dayOpen  = dt.filter(t => t.status === 'open').length;
    const rStr     = dtClosed.length ? (dayR>=0?'+':'')+dayR.toFixed(2)+'R' : '';
    const rClass   = dayR >= 0 ? 'ds-r-pos' : 'ds-r-neg';
    const pnlStr   = dayPnl !== 0 ? ` · ${dayPnl>=0?'+':''}${dayPnl.toFixed(0)}$` : '';
    const openStr  = dayOpen > 0 ? ` · <span style="color:var(--be)">${dayOpen} en cours</span>` : '';

    rows += `<tr class="day-sep-row"><td colspan="13">
      <span class="day-sep-label">${fmtDateLong(d)}</span>
      <span class="day-sep-stats">
        ${dt.length} trade${dt.length>1?'s':''}
        ${rStr ? `· <span class="${rClass}">${rStr}</span>` : ''}${pnlStr}
        ${dtClosed.length ? `· ${dayWins}W&thinsp;/&thinsp;${dayLoss}L` : ''}${openStr}
      </span>
    </td></tr>`;

    dt.forEach(t => {
      const isOpen = t.status === 'open';
      const resultCell = isOpen
        ? `<span class="badge badge-open">&#9679; En cours</span>`
        : `<span class="badge ${rBadge[t.result]||''}">${t.result||'--'}</span>`;

      // Émotion : entrée → sortie si les deux existent
      const eEntry = t.emotionEntry || t.emotion;
      const eExit  = t.emotionExit;
      const emotCell = eExit && eExit !== eEntry
        ? `${emotIcons[eEntry]||''}→${emotIcons[eExit]||''}`
        : (emotIcons[eEntry] || (eEntry ? eEntry.slice(0,4) : '--'));

      rows += `<tr>
        <td style="font-family:var(--mono);font-size:.7rem">${fmtDate(t.date)}</td>
        <td style="font-family:var(--mono);font-size:.7rem;color:var(--t3)">${t.time||'--'}</td>
        <td style="font-weight:600;color:var(--t1)">${t.asset||'--'}</td>
        <td><span class="badge ${dBadge[t.dir]||''}">${t.dir||'--'}</span></td>
        <td>${resultCell}</td>
        <td style="font-size:.74rem;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.setup||'--'}</td>
        <td style="white-space:nowrap">${calCell(t)}</td>
        <td style="font-family:var(--mono);font-size:.72rem">${t.rrPlan ? t.rrPlan+'R' : '--'}</td>
        <td>${formatR(t)}</td>
        <td style="font-size:.85rem">${emotCell}</td>
        <td style="font-size:.73rem;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--t3)">${t.note||''}</td>
        <td>
          <div class="action-btns">
            <button class="btn-edit" data-id="${t.id}" title="Modifier">&#9998;</button>
            ${isOpen ? `<button class="btn-close-trade" data-id="${t.id}" title="Clôturer"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></button>` : ''}
            <button class="btn-del" data-id="${t.id}" title="Supprimer">&#10005;</button>
          </div>
        </td>
      </tr>`;
    });
  });

  $('history-container').innerHTML = `
    <table class="trade-table">
      <thead><tr>
        <th>Date</th><th>Heure</th><th>Actif</th><th>Dir</th>
        <th>Statut</th><th>Setup</th><th>Perçue → Calc.</th><th>RR plan</th>
        <th>R réel</th><th>Émo.</th><th>Note</th><th style="min-width:70px">Actions</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  $$('.btn-edit').forEach(btn => {
    btn.addEventListener('click', function(){
      const t = state.trades.find(x => Number(x.id) === Number(this.dataset.id));
      if(t) enterEditMode(t, 'edit');
    });
  });
  $$('.btn-close-trade').forEach(btn => {
    btn.addEventListener('click', function(){
      const t = state.trades.find(x => Number(x.id) === Number(this.dataset.id));
      if(t) enterEditMode(t, 'close');
    });
  });
  $$('.btn-del').forEach(btn => {
    btn.addEventListener('click', function(){ deleteTrade(this.dataset.id); });
  });
}

['f-filter-result','f-filter-asset','f-filter-type','f-filter-status','f-filter-grade'].forEach(id => {
  $(id).addEventListener('change', renderHistory);
});
$('btn-sort-dir').addEventListener('click', function(){
  state.historySortAsc = !state.historySortAsc;
  renderHistory();
});

/* ============================================================
   EXPORT CSV
============================================================ */
$('btn-export-csv').addEventListener('click', () => {
  if(!state.trades.length){ showToast('Aucun trade à exporter'); return; }
  const headers = ['Date','Heure','Actif','Type','Direction','Setup','Qualité','SetupGrade','SetupScore',
                   'RR Prévu','Risque%','Statut','Résultat','RR Réel','R signé','PnL',
                   'Plan','Émotion entrée','Émotion sortie','Psycho%','Confluences','Note','Override Reason'];
  const rows = state.trades.map(t => [
    t.date, t.time, t.asset, t.type, t.dir, t.setup, t.quality, t.setupGrade, t.setupScore,
    t.rrPlan, t.risk, t.status, t.result, t.rrReal, signedR(t).toFixed(2), t.pnl,
    t.plan, t.emotionEntry||t.emotion, t.emotionExit||'', t.psycho,
    (t.conf||[]).join(';'), t.note, t.overrideReason||''
  ].map(v => '"'+(v!=null?v.toString():'').replace(/"/g,'""')+'"').join(','));
  const csv = [headers.join(','),...rows].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);
  a.download = 'trading-journal-'+todayISO()+'.csv';
  a.click();
  showToast('CSV exporté');
});

$('btn-export-json').addEventListener('click', () => {
  if(!state.trades.length){ showToast('Aucun trade à exporter'); return; }
  const data = { version:2, exportedAt:new Date().toISOString(), count:state.trades.length, state.trades };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'trading-journal-backup-'+todayISO()+'.json';
  a.click();
  showToast('Backup JSON exporté ('+state.trades.length+' state.trades)');
});

$('btn-import-json').addEventListener('click', () => {
  $('file-import-json').value = '';
  $('file-import-json').click();
});

$('file-import-json').addEventListener('change', function(){
  if(!this.files||!this.files[0]) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try{
      const raw = JSON.parse(e.target.result);
      let imp = Array.isArray(raw) ? raw : raw.state.trades;
      if(!imp||!imp.length){ showToast('Fichier vide ou invalide'); return; }
      const ok = await showConfirmModal(
        `Importer ${imp.length} trade(s) ? Un backup sera créé. Cette action REMPLACE l'historique actuel.`,
        'Importer', true
      );
      if(!ok) return;
      localStorage.setItem('backup_trades_before_migration_'+Date.now(), JSON.stringify(state.trades));
      state.trades = imp;
      saveTrades();
      migrateTradesData();
      updateMiniStats();
      updatePeriodSelectors();
      renderHistory();
      showToast(`Import OK — ${state.trades.length} state.trades chargés`, 3000);
    } catch(err){ showToast('Fichier JSON invalide'); }
  };
  reader.readAsText(this.files[0]);
});

$('btn-restore-backup').addEventListener('click', async () => {
  const backups = [];
  for(let i=0; i<localStorage.length; i++){
    const key = localStorage.key(i);
    if(key&&key.startsWith('backup_trades_before_migration_')){
      const ts = parseInt(key.replace('backup_trades_before_migration_',''));
      try{
        const arr = JSON.parse(localStorage.getItem(key));
        const data = Array.isArray(arr) ? arr : (typeof arr==='string'?JSON.parse(arr):[]);
        backups.push({key,ts,count:data.length,data});
      } catch(e){}
    }
  }
  if(!backups.length){ showToast('Aucun backup disponible'); return; }
  backups.sort((a,b)=>b.ts-a.ts);
  const opts = backups.map((b,i)=>`${i+1}. ${new Date(b.ts).toLocaleString('fr-FR')} — ${b.count} trade(s)`).join('\n');
  const choice = prompt(`${backups.length} backup(s) :\n\n${opts}\n\nNuméro à restaurer :`);
  if(!choice) return;
  const idx = parseInt(choice)-1;
  if(isNaN(idx)||idx<0||idx>=backups.length){ showToast('Numéro invalide'); return; }
  const ok = await showConfirmModal(
    `Restaurer ce backup (${backups[idx].count} state.trades) ? L'état actuel sera sauvegardé d'abord.`,
    'Restaurer', false
  );
  if(!ok) return;
  localStorage.setItem('backup_trades_before_migration_'+Date.now(), JSON.stringify(state.trades));
  state.trades = backups[idx].data;
  saveTrades(); migrateTradesData(); updateMiniStats(); updatePeriodSelectors(); renderHistory();
  showToast(`Backup restauré — ${state.trades.length} state.trades`, 3000);
});

$('btn-clear-all').addEventListener('click', async () => {
  const ok = await showConfirmModal('Effacer TOUS les state.trades ? Un backup sera créé.', 'Effacer', true);
  if(!ok) return;
  localStorage.setItem('backup_trades_before_migration_'+Date.now(), JSON.stringify(state.trades));
  state.trades = []; saveTrades(); updateMiniStats(); updatePeriodSelectors(); renderHistory();
  showToast('Historique effacé (backup créé)');
});

/* ============================================================
   PÉRIODE DASHBOARD
============================================================ */
function updatePeriodSelectors(){
  const mSel = $('period-month-sel');
  const ySel = $('period-year-sel');
  if(!mSel||!ySel) return;
  const months = [...new Set(state.trades.map(t=>t.date?t.date.slice(0,7):null).filter(Boolean))].sort().reverse();
  const years  = [...new Set(state.trades.map(t=>t.date?t.date.slice(0,4):null).filter(Boolean))].sort().reverse();
  mSel.innerHTML = '<option value="">Mois...</option>' + months.map(m=>{
    const [y,mo] = m.split('-');
    return `<option value="${m}"${m===state.periodMonthSel?' selected':''}>${MONTH_FR[parseInt(mo)-1]} ${y}</option>`;
  }).join('');
  ySel.innerHTML = '<option value="">Année...</option>' + years.map(y=>
    `<option value="${y}"${y===state.periodYearSel?' selected':''}>${y}</option>`
  ).join('');
}

function setPeriodActiveState(){
  $$('.period-btn').forEach(b=>b.classList.remove('active'));
  const mSel=$('period-month-sel'), ySel=$('period-year-sel');
  const pFrom=$('period-from'), pTo=$('period-to');
  [mSel,ySel,pFrom,pTo].forEach(el=>el&&el.classList.remove('sel-active'));
  if(state.periodMode==='preset'){
    const btn=document.querySelector(`.period-btn[data-period="${state.periodPreset}"]`);
    if(btn) btn.classList.add('active');
  } else if(state.periodMode==='month'&&mSel) mSel.classList.add('sel-active');
  else if(state.periodMode==='year'&&ySel)    ySel.classList.add('sel-active');
  else if(state.periodMode==='custom'){
    if(state.periodCustomFrom&&pFrom) pFrom.classList.add('sel-active');
    if(state.periodCustomTo&&pTo)     pTo.classList.add('sel-active');
  }
}

function getWeekBounds(){
  const now=new Date(), day=now.getDay()||7;
  const mon=new Date(now); mon.setDate(now.getDate()-day+1); mon.setHours(0,0,0,0);
  const sun=new Date(mon); sun.setDate(mon.getDate()+6); sun.setHours(23,59,59,999);
  return {from:mon,to:sun};
}

function filterByActivePeriod(tradeSet){
  if(!tradeSet||!tradeSet.length) return [];
  if(state.periodMode==='preset'){
    if(state.periodPreset==='all') return tradeSet;
    const now=new Date();
    return tradeSet.filter(t=>{
      if(!t.date) return false;
      const d=new Date(t.date+'T12:00:00');
      if(state.periodPreset==='day')   return t.date===todayISO();
      if(state.periodPreset==='week')  { const {from,to}=getWeekBounds(); return d>=from&&d<=to; }
      if(state.periodPreset==='month') return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
      if(state.periodPreset==='year')  return d.getFullYear()===now.getFullYear();
      return true;
    });
  }
  if(state.periodMode==='month') return state.periodMonthSel?tradeSet.filter(t=>t.date&&t.date.slice(0,7)===state.periodMonthSel):tradeSet;
  if(state.periodMode==='year')  return state.periodYearSel ?tradeSet.filter(t=>t.date&&t.date.slice(0,4)===state.periodYearSel) :tradeSet;
  if(state.periodMode==='custom'){
    return tradeSet.filter(t=>{
      if(!t.date) return false;
      if(state.periodCustomFrom&&t.date<state.periodCustomFrom) return false;
      if(state.periodCustomTo  &&t.date>state.periodCustomTo)   return false;
      return true;
    });
  }
  return tradeSet;
}

function periodLabel(){
  if(state.periodMode==='preset'){ const l={all:'total',day:"aujourd'hui",week:'cette semaine',month:'ce mois',year:'cette année'}; return l[state.periodPreset]||''; }
  if(state.periodMode==='month'&&state.periodMonthSel){ const [y,mo]=state.periodMonthSel.split('-'); return MONTH_FR[parseInt(mo)-1]+' '+y; }
  if(state.periodMode==='year'&&state.periodYearSel) return state.periodYearSel;
  if(state.periodMode==='custom') return (state.periodCustomFrom?fmtDate(state.periodCustomFrom):'...')+' → '+(state.periodCustomTo?fmtDate(state.periodCustomTo):'...');
  return '';
}

$$('.period-btn').forEach(btn=>{
  btn.addEventListener('click',function(){
    state.periodMode='preset'; state.periodPreset=this.dataset.period;
    state.periodMonthSel=''; state.periodYearSel=''; state.periodCustomFrom=''; state.periodCustomTo='';
    [$('period-month-sel'),$('period-year-sel'),$('period-from'),$('period-to')].forEach(el=>el&&(el.value=''));
    setPeriodActiveState(); renderDashboard();
  });
});
$('period-month-sel').addEventListener('change',function(){
  if(this.value){ state.periodMode='month';state.periodMonthSel=this.value;state.periodYearSel='';state.periodCustomFrom='';state.periodCustomTo='';$('period-year-sel').value='';$('period-from').value='';$('period-to').value=''; }
  else{ state.periodMode='preset';state.periodPreset='all';state.periodMonthSel=''; }
  setPeriodActiveState(); renderDashboard();
});
$('period-year-sel').addEventListener('change',function(){
  if(this.value){ state.periodMode='year';state.periodYearSel=this.value;state.periodMonthSel='';state.periodCustomFrom='';state.periodCustomTo='';$('period-month-sel').value='';$('period-from').value='';$('period-to').value=''; }
  else{ state.periodMode='preset';state.periodPreset='all';state.periodYearSel=''; }
  setPeriodActiveState(); renderDashboard();
});
function onCustomDateChange(){
  state.periodCustomFrom=$('period-from').value; state.periodCustomTo=$('period-to').value;
  if(!state.periodCustomFrom&&!state.periodCustomTo){ state.periodMode='preset';state.periodPreset='all'; }
  else{ state.periodMode='custom';state.periodMonthSel='';state.periodYearSel='';$('period-month-sel').value='';$('period-year-sel').value=''; }
  setPeriodActiveState(); renderDashboard();
}
$('period-from').addEventListener('change',onCustomDateChange);
$('period-to').addEventListener('change',onCustomDateChange);

/* ============================================================
   GRAPHIQUES — variables globales
============================================================ */

/* ============================================================
   GENERATE INSIGHTS
============================================================ */
function generateInsights(st, tradeSet, calTrades = []){
  const insights = [];
  if(!tradeSet||!tradeSet.length){ $('insight-list').innerHTML='<div class="empty-state" style="padding:20px 0">Pas assez de données.</div>'; return; }

  const avgR  = set => set.length ? set.reduce((a,t)=>a+signedR(t),0)/set.length : null;
  const rFmt  = v  => v!=null?(v>=0?'+':'')+v.toFixed(2)+'R':'--';

  /* Journal issues */
  const journalIssues = analyzeJournal(tradeSet);
  journalIssues.forEach(issue => insights.push(issue));

  /* FOMO vs calme */
  const fomoT  = tradeSet.filter(t=>t.emotion==='FOMO');
  const calmeT = tradeSet.filter(t=>t.emotion==='Calme'||t.emotion==='Confiance');
  if(fomoT.length>=2&&calmeT.length>=2){
    const rF=avgR(fomoT), rC=avgR(calmeT);
    insights.push({ color:rF<rC?'var(--loss)':'var(--be)', text:`<strong>FOMO (${fomoT.length} state.trades) : ${rFmt(rF)}</strong> vs calme : ${rFmt(rC)}.`+(rF<rC?` -${(rC-rF).toFixed(2)}R/trade en FOMO.`:' Impact FOMO limité.') });
  }

  /* Emotion shift — entrée vs sortie */
  const shifts = analyzeEmotionShift(tradeSet);
  if(shifts.length >= 3){
    const degraded = shifts.filter(s => {
      const badExit = ['FOMO','Revenge','Stress'].includes(s.exit);
      const goodEntry = ['Calme','Confiance'].includes(s.entry);
      return goodEntry && badExit;
    });
    if(degraded.length >= 2){
      const rDeg = avgR(tradeSet.filter(t => degraded.some(d => d.R === signedR(t))));
      insights.push({ color:'var(--be)', text:`<strong>Dégradation émotionnelle sur ${degraded.length} state.trades</strong> : état positif à l'entrée → négatif à la sortie. Gestion de position à revoir.` });
    }
  }

  /* Revenge */
  const revengeT = tradeSet.filter(t=>t.emotion==='Revenge');
  if(revengeT.length>=1){
    insights.push({ color:'var(--loss)', text:`<strong>Revenge : ${revengeT.length} trade(s), R moyen ${rFmt(avgR(revengeT))}.</strong> Pause obligatoire après tout trade revenge.` });
  }

  /* Plan */
  const onPlanT=tradeSet.filter(t=>t.plan==='Oui'), offPlanT=tradeSet.filter(t=>t.plan==='Non');
  if(onPlanT.length>=3&&offPlanT.length>=2){
    const wOn=onPlanT.filter(t=>t.result==='Win').length/onPlanT.length*100;
    const wOff=offPlanT.filter(t=>t.result==='Win').length/offPlanT.length*100;
    insights.push({ color:wOn>wOff?'var(--blue)':'var(--be)', text:`<strong>Sur plan : ${wOn.toFixed(0)}% WR (${rFmt(avgR(onPlanT))})</strong> vs hors plan : ${wOff.toFixed(0)}% WR (${rFmt(avgR(offPlanT))}).`+(wOn>wOff+10?' Plan fonctionne.':' Peu de différence.') });
  }

  /* A+ vs C/D */
  const apT=tradeSet.filter(t=>(t.setupGrade||t.quality)==='A+');
  const cdT=tradeSet.filter(t=>['C','D'].includes(t.setupGrade||t.quality));
  if(apT.length>=2){ const s=calcStats(apT); insights.push({color:s.wr>=60?'var(--violet)':'var(--be)',text:`<strong>A+ : ${s.wr.toFixed(0)}% WR, ${rFmt(s.avgR)}</strong> sur ${apT.length} state.trades.`}); }
  if(cdT.length>=2){ const r=avgR(cdT); insights.push({color:'var(--loss)',text:`<strong>C/D : ${(cdT.length/tradeSet.length*100).toFixed(0)}% des state.trades, R moyen ${rFmt(r)}.</strong>`+(r<0?' Ces setups coûtent de l\'argent.':'')}); }

  /* WR */
  if(st.wr>=65&&st.total>=8) insights.push({color:'var(--win)',text:`<strong>Winrate solide à ${st.wr.toFixed(0)}%</strong> — sélection de setups excellente.`});
  else if(st.wr<40&&st.total>=10) insights.push({color:'var(--loss)',text:`<strong>Winrate faible (${st.wr.toFixed(0)}%)</strong> — attends les setups A/A+.`});

  /* Expectancy */
  if(st.exp>0.5) insights.push({color:'var(--win)',text:`<strong>Expectancy positive à ${rFmt(st.exp)}</strong> — edge confirmé.`});
  else if(st.exp<-0.1&&st.total>=10) insights.push({color:'var(--loss)',text:`<strong>Expectancy négative (${rFmt(st.exp)})</strong> — pause obligatoire.`});

  /* W/L ratio */
  if(st.avgW>0&&st.avgL>0){
    if(st.avgW<st.avgL) insights.push({color:'var(--loss)',text:`<strong>Ratio W/L : ${(st.avgW/st.avgL).toFixed(2)}</strong> — tu coupes trop tôt ou laisses courir les pertes.`});
    else if(st.avgW>st.avgL*1.5) insights.push({color:'var(--win)',text:`<strong>Ratio W/L : ${(st.avgW/st.avgL).toFixed(2)}</strong> — excellent rapport.`});
  }

  /* Série perdante */
  if(st.maxL>=4) insights.push({color:'var(--loss)',text:`<strong>Série de ${st.maxL} pertes.</strong> Pause obligatoire.`});
  else if(st.maxL>=3) insights.push({color:'var(--be)',text:`<strong>${st.maxL} pertes consécutives max.</strong> Réduis le risque.`});

  /* Partials insight */
  const withPartials = tradeSet.filter(t=>t.partials&&t.partials.length>1);
  if(withPartials.length>=3){
    const rPart = avgR(withPartials);
    insights.push({color:'var(--t2)',text:`<strong>${withPartials.length} state.trades avec TP partiels — R moyen : ${rFmt(rPart)}.</strong>`});
  }

  /* Calibration */
  if(calTrades.length>=3){
    const over=calTrades.filter(t=>t.setupEvaluationGap==='overestimated');
    const under=calTrades.filter(t=>t.setupEvaluationGap==='underestimated');
    const align=calTrades.filter(t=>t.setupEvaluationGap==='aligned');
    if(over.length>=2){
      const rO=avgR(over);
      insights.push({color:'var(--loss)',text:`<strong>Surévaluation : ${over.length} state.trades, R moyen ${rFmt(rO)}.</strong>`+(rO<0?' Ces state.trades coûtent.':'')});
    }
    if(align.length>=2){ const s=calcStats(align); if(s) insights.push({color:s.exp>=0?'var(--win)':'var(--be)',text:`<strong>Alignés (${align.length} state.trades) : ${s.wr.toFixed(0)}% WR, ${rFmt(s.exp)} expectancy.</strong>`}); }
  }

  /* ── Glissement émotionnel entrée → sortie ──────────────── */
  if(!insights.length) insights.push({color:'var(--t3)',text:'Continue à enregistrer — les insights s\'affinent avec les données.'});

  $('insight-list').innerHTML = insights.slice(0,8).map(i=>
    `<div class="insight-item"><div class="insight-dot" style="background:${i.color}"></div><div class="insight-text">${i.text}</div></div>`
  ).join('');
}

/* ============================================================
   DASHBOARD
============================================================ */
function renderDashboard(){
  updatePeriodSelectors();
  setPeriodActiveState();

  const chronoTrades = sortedByDateTime(state.trades, true);
  const allFiltered  = filterByActivePeriod(chronoTrades);
  const filtered     = allFiltered.filter(t=>t.status==='closed');
  const openFiltered = allFiltered.filter(t=>t.status==='open');
  const openCount    = openFiltered.length;

  const pLabel = periodLabel();
  const countEl = $('period-count');
  if(countEl) countEl.innerHTML = `<span>${allFiltered.length}</span> trade${allFiltered.length!==1?'s':''}${pLabel?' · '+pLabel:''}`;

  $('d-open-count').textContent = openCount;
  $('d-open-count').style.color = openCount>0?'var(--be)':'var(--t3)';
  $('d-open-sub').textContent   = openCount>0?`${openCount} actif${openCount>1?'s':''}`:'aucun actif';

  if(!filtered.length){
    ['d-total','d-wr','d-tr','d-exp'].forEach(id=>{const el=$(id);if(el){el.textContent='--';el.style.color='';}});
    $('d-total-sub').textContent = openCount>0?`+${openCount} en cours`:'--';
    $('d-wr-sub').textContent='--';
    $('quality-tbody').innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--t4)">Aucun trade clôturé sur cette période</td></tr>';
    $('insight-list').innerHTML='<div class="empty-state" style="padding:20px 0">Aucun trade clôturé sur cette période.</div>';
    ['d-best','d-worst','d-streak-w','d-streak-l','d-avgw','d-avgloss','d-best-setup','d-best-asset','d-off-plan','d-wr-plan'].forEach(id=>{const el=$(id);if(el){el.textContent='--';el.style.color='';}});
    if(state.chartPie){state.chartPie.destroy();state.chartPie=null;}
    if(state.chartBar){state.chartBar.destroy();state.chartBar=null;}
    if(state.chartEquity){state.chartEquity.destroy();state.chartEquity=null;}
    ['pnl-total','pnl-avg','pnl-best-trade','pnl-worst-trade'].forEach(id=>{const el=$(id);if(el){el.textContent='--';el.style.color='';}});
    ['pnl-best-trade-info','pnl-worst-trade-info'].forEach(id=>{const el=$(id);if(el)el.textContent='--';});
    if(window._chartPnlEq){window._chartPnlEq.destroy();window._chartPnlEq=null;}
    if(window._chartPnlBar){window._chartPnlBar.destroy();window._chartPnlBar=null;}
    destroyCalibrationCharts();
    const pcc=$('panel-cal-charts');if(pcc)pcc.style.display='none';
    const pe=$('panel-edge');if(pe)pe.style.display='none';
    const pes=$('panel-emotion-shift');if(pes)pes.style.display='none';
    return;
  }

  const st = calcStats(filtered);
  if(!st) return;

  $('d-total').textContent     = st.total;
  $('d-total-sub').textContent = openCount>0?`+${openCount} en cours`:`${st.wins}W / ${st.losses}L / ${st.bes}BE`;
  $('d-total-sub').style.color = openCount>0?'var(--be)':'';
  $('d-wr').textContent        = st.wr.toFixed(0)+'%';
  $('d-wr-sub').textContent    = st.wins+' victoires';
  $('d-tr').textContent        = (st.totalR>=0?'+':'')+st.totalR.toFixed(2)+'R';
  $('d-tr').style.color        = st.totalR>=0?'var(--win)':'var(--loss)';
  $('d-exp').textContent       = (st.exp>=0?'+':'')+st.exp.toFixed(2)+'R';
  $('d-exp').style.color       = st.exp>=0?'var(--win)':'var(--loss)';

  $('d-best').textContent       = (st.best>=0?'+':'')+st.best.toFixed(2)+'R'; $('d-best').style.color='var(--win)';
  $('d-worst').textContent      = st.worst.toFixed(2)+'R'; $('d-worst').style.color='var(--loss)';
  $('d-streak-w').textContent   = st.maxW+' state.trades';
  $('d-streak-l').textContent   = st.maxL+' state.trades'; $('d-streak-l').style.color=st.maxL>=3?'var(--loss)':'var(--t1)';
  $('d-avgw').textContent       = '+'+st.avgW.toFixed(2)+'R'; $('d-avgw').style.color='var(--win)';
  $('d-avgloss').textContent    = '-'+st.avgL.toFixed(2)+'R'; $('d-avgloss').style.color='var(--loss)';
  $('d-best-setup').textContent = st.bestSetup;
  $('d-best-asset').textContent = st.bestAsset;
  $('d-off-plan').textContent   = st.offPlan+' ('+(st.offPlan/st.total*100).toFixed(0)+'%)';
  $('d-off-plan').style.color   = st.offPlan>st.total*.2?'var(--loss)':'var(--t1)';
  $('d-wr-plan').textContent    = st.wrOnPlan!=null?st.wrOnPlan.toFixed(0)+'%':'--';

  /* Pie — doughnut cosmique */
  if(state.chartPie) state.chartPie.destroy();
  state.chartPie = new Chart($('chart-pie'),{
    type:'doughnut',
    data:{
      labels:['Win','Loss','BE'],
      datasets:[{
        data:[st.wins,st.losses,st.bes],
        backgroundColor:[C.win.fill,C.loss.fill,C.be.fill],
        borderColor:[C.win.line,C.loss.line,C.be.line],
        borderWidth:1.5,
        hoverBorderWidth:2.5,
        _glowBlur:14,
        _glowColor:'rgba(79,70,229,.25)',
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{labels:{color:'rgba(107,114,128,.7)',font:C.font,padding:18},position:'bottom'},
        tooltip:{callbacks:{label:ctx=>' '+ctx.label+': '+ctx.parsed}}
      },
      cutout:'68%',
      animation:{animateScale:true,animateRotate:true,duration:600,easing:'easeInOutQuart'}
    }
  });

  /* Bar R par jour */
  const dayR={};
  filtered.forEach(t=>{const d=t.date||'?';if(!dayR[d])dayR[d]=0;dayR[d]+=signedR(t);});
  const allDays=Object.keys(dayR).sort();
  const days=(state.periodMode==='preset'&&state.periodPreset==='all')?allDays.slice(-20):allDays;
  const dayVals=days.map(d=>parseFloat(dayR[d].toFixed(2)));
  if(state.chartBar) state.chartBar.destroy();
  state.chartBar = new Chart($('chart-bar'),{
    type:'bar',
    data:{
      labels:days.map(d=>d.slice(5)),
      datasets:[{
        label:'R/jour',data:dayVals,
        backgroundColor:dayVals.map(v=>v>=0?C.win.bar:C.loss.bar),
        borderColor:dayVals.map(v=>v>=0?C.win.line:C.loss.line),
        borderWidth:1,borderRadius:4,borderSkipped:false,
        _glowBlur:8,_glowColor:'rgba(90,158,122,.2)',
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        x:{ticks:{color:C.tick,font:C.font,maxRotation:0},grid:{color:C.grid}},
        y:{ticks:{color:C.tick,font:C.font,callback:v=>v+'R'},grid:{color:C.grid}}
      },
      animation:{duration:500,easing:'easeOutQuart'}
    }
  });

  /* Equity R — courbe cosmique */
  let cumR=0; const eqLabels=[],eqData=[];
  filtered.forEach((t,i)=>{cumR+=signedR(t);eqLabels.push('#'+(i+1));eqData.push(parseFloat(cumR.toFixed(2)));});
  const lastEq=eqData[eqData.length-1]??0;
  const eqPalette = lastEq>=0 ? C.win : C.loss;
  if(state.chartEquity) state.chartEquity.destroy();
  state.chartEquity = new Chart($('chart-equity'),{
    type:'line',
    data:{
      labels:eqLabels,
      datasets:[{
        label:'R cumulé',data:eqData,
        borderColor:eqPalette.line,borderWidth:2,
        backgroundColor:eqPalette.fill,fill:true,
        pointRadius:eqData.length>50?0:3,
        pointBackgroundColor:eqPalette.line,
        pointBorderColor:'transparent',
        tension:.35,
        _glowColor:eqPalette.glow,_glowBlur:12,
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        x:{ticks:{color:C.tick,font:C.font,maxTicksLimit:8},grid:{color:C.grid}},
        y:{ticks:{color:C.tick,font:C.font,callback:v=>v+'R'},grid:{color:C.grid}}
      },
      animation:{duration:600,easing:'easeOutQuart'}
    }
  });

  /* Grade table */
  const gMap2={'A+':'badge-ap','A':'badge-a','B':'badge-b','C':'badge-c','D':'badge-d'};
  $('quality-tbody').innerHTML=['A+','A','B','C','D'].map(g=>{
    const gt=filtered.filter(t=>(t.setupGrade||t.quality)===g);
    if(!gt.length) return `<tr><td><span class="badge ${gMap2[g]}">${g}</span></td><td style="color:var(--t4)">0</td><td>--</td><td>--</td><td>--</td></tr>`;
    const gst=calcStats(gt);
    return `<tr><td><span class="badge ${gMap2[g]}">${g}</span></td><td style="font-family:var(--mono)">${gst.total}</td><td style="font-family:var(--mono);color:${gst.wr>=60?'var(--win)':gst.wr>=45?'var(--be)':'var(--loss)'}">${gst.wr.toFixed(0)}%</td><td style="font-family:var(--mono);color:${gst.totalR>=0?'var(--win)':'var(--loss)'}">${(gst.totalR>=0?'+':'')+gst.totalR.toFixed(2)}R</td><td style="font-family:var(--mono);color:${gst.avgR>=0?'var(--win)':'var(--loss)'}">${(gst.avgR>=0?'+':'')+gst.avgR.toFixed(2)}R</td></tr>`;
  }).join('');

  /* PnL */
  const fmtPnl=v=>(v>=0?'+':'')+v.toFixed(2)+'$';
  const pnlColor=v=>v>=0?'var(--win)':'var(--loss)';
  const pnlValues=filtered.map(t=>t.pnl||0);
  const totalPnl=pnlValues.reduce((a,b)=>a+b,0);
  const avgPnl=pnlValues.length?totalPnl/pnlValues.length:0;
  const pnlSorted=[...filtered].filter(t=>t.pnl!==0&&t.pnl!=null).sort((a,b)=>(b.pnl||0)-(a.pnl||0));
  const bestTrade=pnlSorted[0]||null, worstTrade=pnlSorted[pnlSorted.length-1]||null;
  $('pnl-total').textContent=fmtPnl(totalPnl); $('pnl-total').style.color=pnlColor(totalPnl);
  $('pnl-avg').textContent=pnlValues.some(v=>v!==0)?fmtPnl(avgPnl):'--'; $('pnl-avg').style.color=pnlColor(avgPnl);
  if(bestTrade){$('pnl-best-trade').textContent=fmtPnl(bestTrade.pnl);$('pnl-best-trade').style.color='var(--win)';$('pnl-best-trade-info').textContent=(bestTrade.asset||'--')+' · '+(bestTrade.date||'').slice(5);}
  else{$('pnl-best-trade').textContent='--';$('pnl-best-trade-info').textContent='--';}
  if(worstTrade){$('pnl-worst-trade').textContent=fmtPnl(worstTrade.pnl);$('pnl-worst-trade').style.color='var(--loss)';$('pnl-worst-trade-info').textContent=(worstTrade.asset||'--')+' · '+(worstTrade.date||'').slice(5);}
  else{$('pnl-worst-trade').textContent='--';$('pnl-worst-trade-info').textContent='--';}

  let cumPnl=0; const pnlEqLabels=[],pnlEqData=[];
  filtered.forEach((t,i)=>{cumPnl+=(t.pnl||0);pnlEqLabels.push('#'+(i+1));pnlEqData.push(parseFloat(cumPnl.toFixed(2)));});
  const lastPnl=pnlEqData[pnlEqData.length-1]??0;
  const pnlEqColor=lastPnl>=0?'rgba(90,158,122,.85)':'rgba(158,90,90,.75)';
  if(window._chartPnlEq) window._chartPnlEq.destroy();
  window._chartPnlEq=new Chart($('chart-pnl-equity'),{
    type:'line',
    data:{
      labels:pnlEqLabels,
      datasets:[{
        label:'PnL cumulé ($)',data:pnlEqData,
        borderColor:lastPnl>=0?C.win.line:C.loss.line,borderWidth:2,
        backgroundColor:lastPnl>=0?C.win.fill:C.loss.fill,fill:true,
        pointRadius:pnlEqData.length>50?0:3,
        pointBackgroundColor:lastPnl>=0?C.win.line:C.loss.line,
        pointBorderColor:'transparent',
        tension:.35,
        _glowColor:lastPnl>=0?C.win.glow:C.loss.glow,_glowBlur:12,
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        x:{ticks:{color:C.tick,font:C.font,maxTicksLimit:8},grid:{color:C.grid}},
        y:{ticks:{color:C.tick,font:C.font,callback:v=>v+'$'},grid:{color:C.grid}}
      },
      animation:{duration:500,easing:'easeOutQuart'}
    }
  });

  const dayPnl={};
  filtered.forEach(t=>{const d=t.date||'?';if(!dayPnl[d])dayPnl[d]=0;dayPnl[d]+=(t.pnl||0);});
  const pnlDaysAll=Object.keys(dayPnl).sort();
  const pnlDays=(state.periodMode==='preset'&&state.periodPreset==='all')?pnlDaysAll.slice(-20):pnlDaysAll;
  const pnlDayVals=pnlDays.map(d=>parseFloat(dayPnl[d].toFixed(2)));
  if(window._chartPnlBar) window._chartPnlBar.destroy();
  window._chartPnlBar=new Chart($('chart-pnl-bar'),{
    type:'bar',
    data:{
      labels:pnlDays.map(d=>d.slice(5)),
      datasets:[{
        label:'PnL ($)',data:pnlDayVals,
        backgroundColor:pnlDayVals.map(v=>v>=0?C.win.bar:C.loss.bar),
        borderColor:pnlDayVals.map(v=>v>=0?C.win.line:C.loss.line),
        borderWidth:1,borderRadius:4,borderSkipped:false,
        _glowBlur:8,_glowColor:'rgba(90,158,122,.2)',
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        x:{ticks:{color:C.tick,font:C.font},grid:{color:C.grid}},
        y:{ticks:{color:C.tick,font:C.font,callback:v=>v+'$'},grid:{color:C.grid}}
      },
      animation:{duration:500,easing:'easeOutQuart'}
    }
  });

  /* Calibration */
  const calTrades=filtered.filter(t=>t.quality&&t.setupGrade);
  if(calTrades.length>=2){
    const aligned=calTrades.filter(t=>t.setupEvaluationGap==='aligned');
    const over=calTrades.filter(t=>t.setupEvaluationGap==='overestimated');
    const under=calTrades.filter(t=>t.setupEvaluationGap==='underestimated');
    const calN=calTrades.length;
    const pct=n=>calN?(n/calN*100).toFixed(0)+'%':'--';
    const avgRCal=s=>s.length?(s.reduce((a,t)=>a+signedR(t),0)/s.length).toFixed(2):'--';
    const avgPnlCal=s=>s.length?(s.reduce((a,t)=>a+(t.pnl||0),0)/s.length).toFixed(0):'--';
    const wrCal=s=>{const dec=s.filter(t=>t.result==='Win'||t.result==='Loss').length;return dec===0?'--':(s.filter(t=>t.result==='Win').length/dec*100).toFixed(0)+'%';};
    const rFmtCal=v=>v!=='--'?(parseFloat(v)>=0?'+':'')+v+'R':'--';
    $('cal-aligned-pct').textContent=pct(aligned.length); $('cal-aligned-n').textContent=aligned.length+' trade'+(aligned.length!==1?'s':'');
    $('cal-over-pct').textContent=pct(over.length); $('cal-over-n').textContent=over.length+' trade'+(over.length!==1?'s':'');
    $('cal-under-pct').textContent=pct(under.length); $('cal-under-n').textContent=under.length+' trade'+(under.length!==1?'s':'');
    const calRows=[{label:'Alignés',set:aligned,color:'var(--win)'},{label:'Surévalués',set:over,color:'var(--loss)'},{label:'Sous-évalués',set:under,color:'var(--blue)'}];
    $('cal-tbody').innerHTML=calRows.map(row=>{const rV=avgRCal(row.set);return`<tr><td style="color:${row.color};font-weight:600">${row.label}</td><td style="font-family:var(--mono)">${row.set.length}</td><td style="font-family:var(--mono)">${wrCal(row.set)}</td><td style="font-family:var(--mono);color:${rV!=='--'&&parseFloat(rV)>=0?'var(--win)':'var(--loss)'}">${rFmtCal(rV)}</td><td style="font-family:var(--mono)">${avgPnlCal(row.set)!=='--'?(parseFloat(avgPnlCal(row.set))>=0?'+':'')+avgPnlCal(row.set)+'$':'--'}</td></tr>`;}).join('');
    $('panel-calibration').style.display='';
  } else {
    $('panel-calibration').style.display=calTrades.length===0?'none':'';
    if($('cal-tbody')) $('cal-tbody').innerHTML=`<tr><td colspan="5" style="text-align:center;color:var(--t4)">Renseigne la qualité perçue sur au moins 2 state.trades clôturés.</td></tr>`;
    ['cal-aligned-pct','cal-over-pct','cal-under-pct'].forEach(id=>{const el=$(id);if(el)el.textContent='--';});
    ['cal-aligned-n','cal-over-n','cal-under-n'].forEach(id=>{const el=$(id);if(el)el.textContent='--';});
  }

  generateInsights(st, filtered, calTrades);
  renderCalibrationCharts(filtered);
  renderTiltDashboard(filtered);
  renderEdgeInsights(filtered);
  renderEmotionShiftPanel(filtered);
}

/* ============================================================
   NAV TABS
============================================================ */
$$('.nav-tab').forEach(tab=>{
  tab.addEventListener('click',function(){
    switchToTab(this.dataset.page);
    if(this.dataset.page==='page-dashboard') renderDashboard();
    if(this.dataset.page==='page-history')  renderHistory();
  });
});


/* ============================================================
   SETTINGS UI — Personnalisation des confluences
============================================================ */

function renderSettingsUI(){
  const container = $('settings-confluence-list');
  if(!container) return;

  const settings = loadSettings();
  container.innerHTML = '';

  // En-tête colonnes
  container.insertAdjacentHTML('beforeend', `
    <div style="display:grid;grid-template-columns:80px 1fr 1fr 80px;gap:8px;padding:0 4px;margin-bottom:4px">
      <div style="font-family:var(--mono);font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;color:var(--t3)">ID</div>
      <div style="font-family:var(--mono);font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;color:var(--t3)">Label affiché</div>
      <div style="font-family:var(--mono);font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;color:var(--t3)">Catégorie</div>
      <div style="font-family:var(--mono);font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;color:var(--t3)">Visible</div>
    </div>`);

  const groupOpts = ['CONTEXTE','STRUCTURE','ENTRÉE','SESSION'];

  DEFAULT_CONFLUENCE_DEFS.forEach(def => {
    const s  = settings?.confluences?.[def.id] || {};
    const lbl = s.label   || def.label;
    const grp = s.group   || def.group;
    const hid = s.hidden  === true;

    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:80px 1fr 1fr 80px;gap:8px;align-items:center;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.04)';
    row.innerHTML = `
      <div style="font-family:var(--mono);font-size:.68rem;color:var(--t3)">${def.id}</div>
      <input type="text" class="s-label" data-id="${def.id}" value="${lbl}" placeholder="${def.label}"
             style="padding:5px 8px;font-size:.75rem;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:5px;color:var(--t1)"/>
      <select class="s-group" data-id="${def.id}"
              style="padding:5px 8px;font-size:.72rem;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:5px;color:var(--t2);appearance:none">
        ${groupOpts.map(g => `<option value="${g}" ${g===grp?'selected':''}>${g}</option>`).join('')}
      </select>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-family:var(--mono);font-size:.65rem;color:var(--t3)">
        <input type="checkbox" class="s-visible" data-id="${def.id}" ${!hid?'checked':''} style="width:14px;height:14px"/>
        Actif
      </label>`;
    container.appendChild(row);
  });
}

// Save
$('btn-save-settings')?.addEventListener('click', () => {
  const settings = loadSettings();
  if(!settings.confluences) settings.confluences = {};

  $$('.s-label').forEach(inp => {
    const id = inp.dataset.id;
    if(!settings.confluences[id]) settings.confluences[id] = {};
    const val = inp.value.trim();
    settings.confluences[id].label = val || id;
  });
  $$('.s-group').forEach(sel => {
    const id = sel.dataset.id;
    if(!settings.confluences[id]) settings.confluences[id] = {};
    settings.confluences[id].group = sel.value;
  });
  $$('.s-visible').forEach(chk => {
    const id = chk.dataset.id;
    if(!settings.confluences[id]) settings.confluences[id] = {};
    settings.confluences[id].hidden = !chk.checked;
  });

  saveSettings(settings);
  state.activeDefs = getActiveConfluenceDefs(settings); // mettre à jour defs actives
  renderConfluenceGroups([]); // reconstruire le UI

  const msg = $('settings-saved-msg');
  if(msg){ msg.style.display = ''; setTimeout(() => msg.style.display='none', 2500); }
});

// Reset
$('btn-reset-settings')?.addEventListener('click', async () => {
  const ok = await showConfirmModal('Réinitialiser toutes les personnalisations ?', 'Réinitialiser', true);
  if(!ok) return;
  localStorage.removeItem(SETTINGS_KEY);
  state.activeDefs = getActiveConfluenceDefs({});
  renderConfluenceGroups([]);
  renderSettingsUI();
  showToast('Confluences réinitialisées');
});

// Ouvrir la page settings
$$('.nav-tab').forEach(tab => {
  if(tab.dataset.page === 'page-settings'){
    tab.addEventListener('click', renderSettingsUI);
  }
});

/* ============================================================
   SETUP CONFIG — Renommage des setups (UI uniquement)
============================================================ */

// Liste des setups avec leur valeur interne et label par défaut
const DEFAULT_SETUP_DEFS = [
  { id:'ICT Asian KZ',         label:'ICT Asian KZ'         },
  { id:'London continuation',  label:'London continuation'  },
  { id:'NY reversal',          label:'NY reversal'          },
  { id:'FVG continuation',     label:'FVG continuation'     },
  { id:'OB reversal',          label:'OB reversal'          },
  { id:'Sweep + displacement', label:'Sweep + displacement' },
  { id:'BOS + retest',         label:'BOS + retest'         },
  { id:'Liquidity grab',       label:'Liquidity grab'       },
  { id:'Setup perso',          label:'Setup perso'          },
];

/**
 * getSetupLabel(id, settings)
 * Retourne le label affiché pour un setup.
 * La valeur interne (id) ne change jamais.
 */
function getSetupLabel(id, settings){
  return settings?.setups?.[id]?.label || id;
}

/**
 * renderSetupDropdown()
 * (Re)génère les options du select f-setup avec les labels personnalisés.
 * Les value restent les IDs internes — jamais modifiés.
 */
function renderSetupDropdown(){
  const select   = $('f-setup');
  if(!select) return;
  const settings = loadSettings();
  const current  = select.value; // préserver la sélection active

  // Vider sauf la première option placeholder
  while(select.options.length > 1) select.remove(1);

  DEFAULT_SETUP_DEFS.forEach(def => {
    const opt   = document.createElement('option');
    opt.value   = def.id;                          // ID interne — inchangé
    opt.textContent = getSetupLabel(def.id, settings);
    select.appendChild(opt);
  });

  // Restaurer la sélection
  if(current) select.value = current;
}

/**
 * renderSetupConfig()
 * Génère la liste d'inputs de renommage dans page-setup-config.
 */
function renderSetupConfig(){
  const container = $('setup-config-list');
  if(!container) return;
  const settings  = loadSettings();
  container.innerHTML = '';

  // En-tête colonnes
  container.insertAdjacentHTML('beforeend', `
    <div style="display:grid;grid-template-columns:180px 1fr;gap:8px;padding:0 4px;margin-bottom:4px">
      <div style="font-family:var(--mono);font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;color:var(--t3)">ID interne</div>
      <div style="font-family:var(--mono);font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;color:var(--t3)">Label affiché</div>
    </div>`);

  DEFAULT_SETUP_DEFS.forEach(def => {
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:180px 1fr;gap:8px;align-items:center;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.04)';
    row.innerHTML = `
      <div style="font-family:var(--mono);font-size:.68rem;color:var(--t3)">${def.id}</div>
      <input type="text" class="setup-label-input" data-id="${def.id}"
             value="${getSetupLabel(def.id, settings)}"
             placeholder="${def.label}"
             style="padding:5px 8px;font-size:.75rem;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:5px;color:var(--t1);width:100%"/>`;
    container.appendChild(row);
  });
}

// ── Bouton  → ouvrir page setup config
$('open-setup-config')?.addEventListener('click', () => {
  renderSetupConfig();
  switchToTab('page-setup-config');
});

// ── Bouton ← Retour
$('btn-back-from-setup-config')?.addEventListener('click', () => {
  switchToTab('page-log');
});

// ── Bouton  Sauvegarder
$('btn-save-setup-config')?.addEventListener('click', () => {
  const settings = loadSettings();
  settings.setups = settings.setups || {};

  $$('#setup-config-list .setup-label-input').forEach(input => {
    const id    = input.dataset.id;
    const value = input.value.trim();
    if(id) settings.setups[id] = { label: value || id };
  });

  saveSettings(settings);
  renderSetupDropdown(); // mettre à jour le dropdown immédiatement

  const msg = $('setup-config-saved-msg');
  if(msg){ msg.style.display = ''; setTimeout(() => msg.style.display = 'none', 2000); }
  showToast('Labels setups sauvegardés');
});

// ── Bouton ℹ️ — explication du score
$('open-score-info')?.addEventListener('click', () => {
  const overlay = document.createElement('div');
  overlay.id = 'score-info-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:600;background:rgba(8,10,16,.86);display:flex;align-items:center;justify-content:center;padding:20px;animation:overlay-in .15s ease';

  overlay.innerHTML = `
    <div style="background:rgba(10,12,18,.95);border:1px solid rgba(255,255,255,.09);border-radius:var(--rl);width:100%;max-width:380px;overflow:hidden;animation:modal-in .2s cubic-bezier(.16,1,.3,1)">
      <div style="background:rgba(255,255,255,.02);border-bottom:1px solid rgba(255,255,255,.07);padding:12px 16px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-family:var(--mono);font-size:.63rem;letter-spacing:.13em;text-transform:uppercase;color:var(--t2);display:flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" class="icon icon-brain"><path d="M12 3a4 4 0 00-4 4v1a3 3 0 00-2 3v2a3 3 0 003 3h6a3 3 0 003-3v-2a3 3 0 00-2-3V7a4 4 0 00-4-4z"/></svg> Score Setup</span>
        <button id="score-info-close" style="background:transparent;border:none;color:var(--t3);cursor:pointer;display:flex;align-items:center"><svg viewBox="0 0 24 24" class="icon" style="stroke:var(--t3);margin:0"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div style="padding:16px;font-family:var(--mono);font-size:.72rem;line-height:1.7;color:var(--t2)">
        <div style="margin-bottom:10px">
          <span style="color:var(--blue);font-weight:700">Setup A</span> — discipliné &amp; complet<br>
          <span style="color:var(--t3)">Contexte · Structure · Entrée · Session · RR ≥ 1.5</span>
        </div>
        <div style="margin-bottom:10px">
          <span style="color:var(--violet);font-weight:700">Setup A+</span> — sniper<br>
          <span style="color:var(--t3)">MSS + Displacement · Contexte · RR ≥ 1.5</span><br>
          <span style="color:var(--t3);font-size:.65rem">(Entrée optionnelle si structure forte)</span>
        </div>
        <div style="margin-bottom:10px">
          <span style="color:var(--be);font-weight:700">Setup B</span><br>
          <span style="color:var(--t3)">Structure + Entrée (catégories incomplètes)</span>
        </div>
        <div style="margin-bottom:10px">
          <span style="color:var(--loss);font-weight:700">C / D</span><br>
          <span style="color:var(--t3)">Confluences insuffisantes</span>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,.07);padding-top:10px;margin-top:4px;color:var(--t3);font-size:.65rem">
          [!] Le score reflète la qualité technique, pas la performance.
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });
  overlay.querySelector('#score-info-close').addEventListener('click', () => overlay.remove());
});

/* ============================================================
   INITIALISATION
============================================================ */
$('f-date').value = todayISO();
$('f-time').value = nowTime();
loadTrades();         // charge + migre si nécessaire
updateMiniStats();
updatePeriodSelectors();
setPeriodActiveState();
updateStatusSection();
renderConfluenceGroups([]); // construire le UI confluences structuré
renderSetupDropdown();      // construire le dropdown setups avec labels perso
refreshSetupDisplay();      // initialiser les barres (tout vide = D)
