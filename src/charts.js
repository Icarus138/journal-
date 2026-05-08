import Chart from 'chart.js/auto'
import { state } from './state.js'
import { ICONS } from './config.js'
import { $, fmtDate } from './utils.js'
import { calcStats, signedR, computeUserStats } from './stats.js'
import { computeTiltScore, getTiltState } from './tilt.js'

/* ============================================================
   CALIBRATION CHARTS — Psychologie & Setup Visualisation
============================================================ */

/* Références des 3 charts calibration */

export function destroyCalibrationCharts(){
  [state.cCalBar, state.cCalScatter, state.cCalEquity].forEach(c => { if(c){ c.destroy(); } });
  state.cCalBar = null; state.cCalScatter = null; state.cCalEquity = null;
}

/**
 * Calcule les stats par catégorie de calibration.
 * Entrée : array de state.trades clôturés avec quality + setupGrade + setupEvaluationGap.
 */
export function calculateCalibrationStats(calTrades){
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
    return { n: set.length, avgR, avgP, wr, trades: set };
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
export function generateCalibrationInsights(calStats, filtered){
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
export function renderCalibrationCharts(filtered){
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
export function renderTiltDashboard(filtered){
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
export function computeSetupPerformance(closedTrades){
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
export function detectEdge(performance){
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
export function generateEdgeInsights(closedTrades){
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
export function computeEmotionShiftStats(trades){
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
export function renderEmotionShiftPanel(filtered){
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

export function renderEdgeInsights(filtered){
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


