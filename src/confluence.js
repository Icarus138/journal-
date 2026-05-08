import { state } from './state.js'
import { loadSettings, getConfluenceLabel, isConfluenceVisible, getActiveConfluenceDefs, DEFAULT_CONFLUENCE_DEFS, SETTINGS_KEY } from './user_settings.js'

/* ============================================================
   CONFLUENCE UI
============================================================ */

// Groupes de confluences par catégorie — ordre lecture trader
export const CONFLUENCE_GROUPS = {
  CONTEXTE  : ['HTF', 'Liquidity', 'Sweep'],
  STRUCTURE : ['MSS', 'Displacement'],
  'ENTRÉE'  : ['OB', 'FVG', 'BPR', 'Prem/Disc', 'Confirmation'],
  SESSION   : ['London', 'NY', 'Asia'],
};

// Mapping catégorie → classe CSS (couleur active)
export const GROUP_CSS = {
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
export function renderConfluenceGroups(selected = [], settings = null){
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
export function getConfluences(){
  return [...$$('#confluence-container .confluence-btn.active')].map(b => b.dataset.name);
}

// RR prévu → mise à jour du score setup en live
$('f-rr-plan').addEventListener('input', refreshSetupDisplay);
export function updateStatusSection(){
  const isOpen = getToggleVal('status') === 'open';
  const rs = $('result-section');
  if(rs) rs.classList.toggle('result-dim', isOpen);
  const ol = $('result-optional-label');
  if(ol) ol.style.display = isOpen ? 'inline' : 'none';
}

