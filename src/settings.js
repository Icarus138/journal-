import { state } from './state.js'
import { $, $$, showToast } from './utils.js'
import { loadSettings, saveSettings, getConfluenceLabel, isConfluenceVisible, DEFAULT_CONFLUENCE_DEFS, SETTINGS_KEY } from './user_settings.js'
import { renderConfluenceGroups } from './confluence.js'
import { renderHistory } from './history.js'
import { renderDashboard } from './dashboard.js'

/* ============================================================
   SETTINGS UI — Personnalisation des confluences
============================================================ */

export function renderSettingsUI(){
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
export const DEFAULT_SETUP_DEFS = [
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
export function getSetupLabel(id, settings){
  return settings?.setups?.[id]?.label || id;
}

/**
 * renderSetupDropdown()
 * (Re)génère les options du select f-setup avec les labels personnalisés.
 * Les value restent les IDs internes — jamais modifiés.
 */
export function renderSetupDropdown(){
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
export function renderSetupConfig(){
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

