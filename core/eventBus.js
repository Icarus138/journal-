/**
 * Guard Journal — EventBus
 * Bus d'événements pub/sub central.
 * Architecture : UI → EventBus → Engines → Data Layer
 *
 * Usage :
 *   GuardJournal.EventBus.on('trades:saved', handler)
 *   GuardJournal.EventBus.emit('trades:saved', { count: 5 })
 *   GuardJournal.EventBus.off('trades:saved', handler)
 *   GuardJournal.EventBus.once('app:ready', handler)
 */

(function(global) {
  'use strict';

  const _listeners = {};

  const EventBus = {

    /**
     * S'abonner à un événement.
     * @param {string} event
     * @param {Function} callback
     * @returns {Function} unsubscribe function
     */
    on(event, callback) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(callback);
      return () => this.off(event, callback);
    },

    /**
     * Se désabonner d'un événement.
     */
    off(event, callback) {
      if (!_listeners[event]) return;
      _listeners[event] = _listeners[event].filter(fn => fn !== callback);
    },

    /**
     * S'abonner une seule fois.
     */
    once(event, callback) {
      const wrapper = (data) => {
        callback(data);
        this.off(event, wrapper);
      };
      this.on(event, wrapper);
    },

    /**
     * Émettre un événement avec des données.
     * @param {string} event
     * @param {*} data
     */
    emit(event, data) {
      if (!_listeners[event]) return;
      _listeners[event].forEach(fn => {
        try {
          fn(data);
        } catch (err) {
          console.error('[EventBus] Erreur dans le handler "' + event + '":', err);
        }
      });
    },

    /**
     * Liste tous les événements actifs (debug).
     */
    debug() {
      const active = Object.keys(_listeners).filter(k => _listeners[k].length > 0);
      console.table(active.map(k => ({ event: k, handlers: _listeners[k].length })));
    },
  };

  // Catalogue des événements disponibles (documentation vivante)
  EventBus.EVENTS = {
    // Données
    TRADES_LOADED   : 'trades:loaded',
    TRADES_SAVED    : 'trades:saved',
    TRADE_ADDED     : 'trade:added',
    TRADE_UPDATED   : 'trade:updated',
    TRADE_DELETED   : 'trade:deleted',
    MIGRATION_DONE  : 'migration:done',
    BACKUP_CREATED  : 'backup:created',

    // UI
    TAB_CHANGED     : 'ui:tab-changed',
    FORM_RESET      : 'ui:form-reset',
    TOAST_SHOW      : 'ui:toast-show',

    // Engines
    STATS_UPDATED   : 'stats:updated',
    TILT_UPDATED    : 'tilt:updated',
    SCORE_UPDATED   : 'score:updated',

    // App
    APP_READY       : 'app:ready',
    APP_ERROR       : 'app:error',
  };

  // Exposition globale sous namespace Guard
  global.GuardJournal = global.GuardJournal || {};
  global.GuardJournal.EventBus = EventBus;

})(window);
