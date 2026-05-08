import { state } from './state.js'
import { MONTH_FR, ICONS } from './config.js'
import { $, $$, fmtDate } from './utils.js'
import { calcStats, signedR, computeUserStats, computeUserProfile } from './stats.js'
import { renderCalibrationCharts, destroyCalibrationCharts, renderTiltDashboard, renderEdgeInsights, renderEmotionShiftPanel } from './charts.js'
import { updateTiltDisplay } from './tilt.js'
import { getActiveConfluenceDefs } from './user_settings.js'

/* ============================================================
   PÉRIODE DASHBOARD
============================================================ */
export function updatePeriodSelectors(){
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

export function setPeriodActiveState(){
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

export function getWeekBounds(){
  const now=new Date(), day=now.getDay()||7;
  const mon=new Date(now); mon.setDate(now.getDate()-day+1); mon.setHours(0,0,0,0);
  const sun=new Date(mon); sun.setDate(mon.getDate()+6); sun.setHours(23,59,59,999);
  return {from:mon,to:sun};
}

export function filterByActivePeriod(tradeSet){
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

export function periodLabel(){
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
export function onCustomDateChange(){
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
export function generateInsights(st, tradeSet, calTrades = []){
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
export function renderDashboard(){
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

