import { state } from './state.js'

/* ============================================================
   UTILITAIRES
============================================================ */
export const $  = id => document.getElementById(id);
export const $$ = sel => document.querySelectorAll(sel);
export const pad = n => String(n).padStart(2,'0');

export function todayISO(){
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
export function nowTime(){
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fmtDate(iso){
  if(!iso) return '--';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
export function fmtDateLong(iso){
  if(!iso || iso === '?') return 'Date inconnue';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
}
export function showToast(msg, ms=2200){
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms);
}

/* ============================================================
   HORLOGE
============================================================ */
export function updateClock(){
  const n = new Date();
  $('nav-time').textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
  $('nav-date').textContent = n.toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short'});
}
updateClock();
setInterval(updateClock, 1000);

/* ============================================================
   NAVIGATION
============================================================ */
export function switchToTab(pageId){
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
export function getToggleVal(group){
  const active = document.querySelector(`[data-group="${group}"] .tgl.active`);
  return active ? active.dataset.val : '';
}

export function setToggleVal(group, val){
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

