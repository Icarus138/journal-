import { state } from './state.js'
import { $ } from './utils.js'
import { loadTrades } from './storage.js'
import { refreshUserStats } from './stats.js'
import { renderHistory } from './history.js'
import { renderDashboard } from './dashboard.js'
import { renderSettingsUI } from './settings.js'
import { switchToTab, updateClock } from './utils.js'
import './config.js'

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
