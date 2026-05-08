export const LS_KEY = 'tj_trades_v1';

export const state = {
  // Données
  trades: [],
  USER_STATS: null,
  USER_PROFILE: null,

  // Historique
  historySortAsc: false,
  historyFilterStatus: '',
  historyFilterGrade: '',

  // Formulaire
  editingTradeId: null,
  formMode: 'create', // 'create' | 'edit' | 'close'

  // Dashboard période
  periodMode: 'preset',
  periodPreset: 'all',
  periodMonthSel: '',
  periodYearSel: '',
  periodCustomFrom: '',
  periodCustomTo: '',

  // UI interne
  partialRows: [],
  activeDefs: null,

  // Graphiques
  chartPie: null,
  chartBar: null,
  chartEquity: null,
  cCalBar: null,
  cCalScatter: null,
  cCalEquity: null,
  chartTiltScatter: null,
};
