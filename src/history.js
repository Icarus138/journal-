import { state } from './state.js'
import { ICONS, GRADE_VAL } from './config.js'
import { $, $$, fmtDate, fmtDateLong, showToast } from './utils.js'
import { calcStats, signedR } from './stats.js'

/* ============================================================
   HISTORIQUE
============================================================ */
export function sortedByDateTime(tradeSet, asc){
  return [...tradeSet].sort((a,b) => {
    const da = (a.date||'0000-00-00')+'T'+(a.time||'00:00');
    const db = (b.date||'0000-00-00')+'T'+(b.time||'00:00');
    return asc ? da.localeCompare(db) : db.localeCompare(da);
  });
}

export function renderHistory(){
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
  const data = { version:2, exportedAt:new Date().toISOString(), count:state.trades.length, trades: state.trades };
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

