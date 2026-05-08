/* ============================================================
   USER SETTINGS — Labels et visibilité des confluences
   Les IDs internes ne changent jamais. Seuls labels + visibilité.
============================================================ */

export const DEFAULT_CONFLUENCE_DEFS = [
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

export const SETTINGS_KEY = 'tj_user_settings_v1';

export function loadSettings(){
  try{ return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch(e){ return {}; }
}

export function saveSettings(settings){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * getConfluenceLabel(id, settings)
 * Retourne le label personnalisé ou le défaut.
 */
export function getConfluenceLabel(id, settings){
  return settings?.confluences?.[id]?.label || id;
}

/**
 * isConfluenceVisible(id, settings)
 * Retourne true sauf si l'utilisateur l'a désactivé.
 */
export function isConfluenceVisible(id, settings){
  return settings?.confluences?.[id]?.hidden !== true;
}

/**
 * getActiveConfluenceDefs(settings)
 * Retourne les defs filtrées + labels personnalisés.
 */
export function getActiveConfluenceDefs(settings = {}){
  return DEFAULT_CONFLUENCE_DEFS
    .filter(d => isConfluenceVisible(d.id, settings))
    .map(d => ({ ...d, label: getConfluenceLabel(d.id, settings) }));
}

// ── Groupes dynamiques issus des settings ───────────────────
// Calculé au chargement, mis à jour si settings changent
state.activeDefs = getActiveConfluenceDefs(loadSettings());

