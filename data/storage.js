/**
 * Guard Journal — Storage
 * Couche d'abstraction localStorage versionnée.
 *
 * Compatible avec la clé existante 'tj_trades_v1'.
 * Aucune modification du format de données.
 * Ajoute : versioning, backup automatique, événements.
 *
 * Dépendances : core/eventBus.js, data/migrations.js
 */

(function(global) {
  'use strict';

  const LS_KEY          = 'tj_trades_v1';
  const SETTINGS_KEY    = 'tj_user_settings_v1';
  const AF_KEY          = 'tj_af_v1';

  function getEventBus() {
    return global.GuardJournal && global.GuardJournal.EventBus
      ? global.GuardJournal.EventBus
      : null;
  }

  function getMigrations() {
    return global.GuardJournal && global.GuardJournal.Migrations
      ? global.GuardJournal.Migrations
      : null;
  }

  // ─── Trades ───────────────────────────────────────────────────────────────

  const Storage = {

    /**
     * Charge les trades depuis localStorage.
     * Applique les migrations si nécessaire.
     * @returns {Array} trades
     */
    loadTrades() {
      let trades = [];
      try {
        const raw = localStorage.getItem(LS_KEY);
        const parsed = JSON.parse(raw);
        trades = Array.isArray(parsed) ? parsed : [];
      } catch(e) {
        console.warn('[Storage] Impossible de lire les trades:', e);
        trades = [];
      }

      // Appliquer les migrations si le système est disponible
      const migrations = getMigrations();
      if (migrations && trades.length > 0) {
        const { trades: migrated, applied } = migrations.run(trades);
        if (applied.length > 0) {
          // Sauvegarder après migration
          this.saveTrades(migrated, { silent: true });
          const bus = getEventBus();
          if (bus) {
            bus.emit(bus.EVENTS.TRADES_LOADED, { trades: migrated, migrated: applied.length });
          }
          return migrated;
        }
      }

      const bus = getEventBus();
      if (bus) {
        bus.emit(bus.EVENTS.TRADES_LOADED, { trades, migrated: 0 });
      }
      return trades;
    },

    /**
     * Sauvegarde les trades dans localStorage.
     * @param {Array} trades
     * @param {{ silent?: boolean }} options
     */
    saveTrades(trades, options = {}) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(trades));
        if (!options.silent) {
          const bus = getEventBus();
          if (bus) {
            bus.emit(bus.EVENTS.TRADES_SAVED, { count: trades.length });
          }
        }
        return true;
      } catch(e) {
        console.error('[Storage] Impossible de sauvegarder les trades:', e);
        const bus = getEventBus();
        if (bus) bus.emit(bus.EVENTS.APP_ERROR, { source: 'storage.saveTrades', error: e.message });
        return false;
      }
    },

    /**
     * Crée un backup horodaté des trades actuels.
     * @param {string} label - label du backup (ex: 'before-delete')
     * @returns {string|null} clé du backup
     */
    backup(label = 'manual') {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const key = 'gj_backup_' + label + '_' + Date.now();
      try {
        localStorage.setItem(key, raw);
        const bus = getEventBus();
        if (bus) {
          bus.emit(bus.EVENTS.BACKUP_CREATED, {
            key,
            label,
            count: JSON.parse(raw).length
          });
        }
        return key;
      } catch(e) {
        console.warn('[Storage] Backup échoué:', e);
        return null;
      }
    },

    /**
     * Restaure les trades depuis un backup.
     * @param {string} backupKey
     * @returns {Array|null}
     */
    restoreFromBackup(backupKey) {
      try {
        const raw = localStorage.getItem(backupKey);
        if (!raw) return null;
        const trades = JSON.parse(raw);
        if (!Array.isArray(trades)) return null;
        this.backup('before-restore');
        this.saveTrades(trades);
        return trades;
      } catch(e) {
        console.error('[Storage] Restauration échouée:', e);
        return null;
      }
    },

    // ─── Settings ─────────────────────────────────────────────────────────

    loadSettings() {
      try {
        return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
      } catch(e) { return {}; }
    },

    saveSettings(settings) {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        return true;
      } catch(e) { return false; }
    },

    // ─── Antifragile state ─────────────────────────────────────────────────

    loadAFState() {
      try {
        return JSON.parse(localStorage.getItem(AF_KEY)) || { ignored: 0 };
      } catch(e) { return { ignored: 0 }; }
    },

    saveAFState(afState) {
      try {
        localStorage.setItem(AF_KEY, JSON.stringify(afState));
        return true;
      } catch(e) { return false; }
    },

    // ─── Utilitaires ──────────────────────────────────────────────────────

    /**
     * Retourne la taille totale utilisée dans localStorage (estimation en Ko).
     */
    getStorageSize() {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        total += (localStorage.getItem(key) || '').length;
      }
      return (total / 1024).toFixed(1);
    },

    /**
     * Liste tous les backups Guard disponibles.
     */
    listBackups() {
      const backups = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const isGuardBackup = key.startsWith('gj_backup_') || key.startsWith('backup_trades_before_migration_');
        if (isGuardBackup) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            backups.push({
              key,
              count    : Array.isArray(data) ? data.length : '?',
              sizeKo   : ((localStorage.getItem(key) || '').length / 1024).toFixed(1),
              createdAt: key.split('_').pop(),
            });
          } catch(e) { /* ignore */ }
        }
      }
      return backups.sort((a, b) => b.createdAt - a.createdAt);
    },

    /**
     * Supprime les backups anciens (garde les N plus récents).
     * @param {number} keepCount - nombre de backups à conserver (défaut: 5)
     */
    pruneBackups(keepCount = 5) {
      const backups = this.listBackups();
      if (backups.length <= keepCount) return 0;
      const toDelete = backups.slice(keepCount);
      toDelete.forEach(b => localStorage.removeItem(b.key));
      return toDelete.length;
    },

    // ─── Debug ────────────────────────────────────────────────────────────

    debug() {
      const trades = this.loadTrades();
      const backups = this.listBackups();
      console.group('[Guard Storage Debug]');
      console.log('Trades en mémoire :', trades.length);
      console.log('Espace utilisé    :', this.getStorageSize(), 'Ko');
      console.log('Backups           :', backups.length);
      if (backups.length) console.table(backups);
      const mig = getMigrations();
      if (mig) {
        console.log('Migrations        :');
        console.table(mig.list());
      }
      console.groupEnd();
    },

  };

  global.GuardJournal = global.GuardJournal || {};
  global.GuardJournal.Storage = Storage;

})(window);
