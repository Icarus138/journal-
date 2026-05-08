/**
 * Guard Journal — Migrations
 * Système de migration versionné pour les données localStorage.
 *
 * Principe :
 *   - Chaque migration a un numéro de version unique
 *   - Les migrations s'appliquent dans l'ordre croissant
 *   - Un backup est créé AVANT toute migration
 *   - Les migrations sont idempotentes
 *
 * Clé de version : 'gj_schema_version'
 */

(function(global) {
  'use strict';

  const SCHEMA_VERSION_KEY = 'gj_schema_version';
  const LS_KEY             = 'tj_trades_v1';
  const SCORING_VERSION    = 6; // version actuelle du scoring

  // ─── Registre des migrations ─────────────────────────────────────────────
  // Chaque migration : { version, description, up(trades) → trades }
  const MIGRATIONS = [

    {
      version: 1,
      description: 'Ajout champs status/isOpen/createdAt/updatedAt',
      up(trades) {
        return trades.map(t => ({
          ...t,
          status    : t.status    || 'closed',
          isOpen    : t.isOpen    !== undefined ? t.isOpen : false,
          createdAt : t.createdAt || (t.date ? t.date + 'T' + (t.time || '00:00') : new Date().toISOString()),
          updatedAt : t.updatedAt || new Date().toISOString(),
        }));
      }
    },

    {
      version: 2,
      description: 'Normalisation emotionEntry/emotionExit',
      up(trades) {
        return trades.map(t => ({
          ...t,
          emotionEntry : t.emotionEntry || t.emotion || '',
          emotionExit  : t.emotionExit  || '',
        }));
      }
    },

    {
      version: 3,
      description: 'Ajout champs prix (entryPrice, stopLoss, takeProfit, exitPrice)',
      up(trades) {
        return trades.map(t => ({
          ...t,
          entryPrice  : t.entryPrice  != null ? t.entryPrice  : 0,
          stopLoss    : t.stopLoss    != null ? t.stopLoss    : 0,
          takeProfit  : t.takeProfit  != null ? t.takeProfit  : 0,
          exitPrice   : t.exitPrice   != null ? t.exitPrice   : 0,
        }));
      }
    },

    {
      version: 4,
      description: 'Ajout champs partials et realizedR',
      up(trades) {
        return trades.map(t => ({
          ...t,
          partials  : Array.isArray(t.partials) ? t.partials : [],
          realizedR : t.realizedR != null ? t.realizedR : null,
        }));
      }
    },

    {
      version: 5,
      description: 'Ajout setupScore, setupGrade (calculés si manquants)',
      up(trades) {
        // Le recalcul du score setup nécessite calculateSetupScore()
        // Si la fonction est disponible on l'utilise, sinon on garde null
        return trades.map(t => {
          if (t.setupScore != null && t.setupGrade != null) return t;
          let setupScore = null;
          let setupGrade = null;
          if (typeof calculateSetupScore === 'function') {
            const result = calculateSetupScore(t);
            setupScore = result.setupScore;
            setupGrade = result.setupGrade;
          }
          return { ...t, setupScore, setupGrade };
        });
      }
    },

    {
      version: 6,
      description: 'Ajout setupEvaluationGap et scoringVersion v6',
      up(trades) {
        return trades.map(t => {
          if (t.scoringVersion >= SCORING_VERSION && t.setupEvaluationGap !== undefined) return t;
          let setupScore = t.setupScore;
          let setupGrade = t.setupGrade;
          let setupEvaluationGap = t.setupEvaluationGap;

          if (typeof calculateSetupScore === 'function') {
            const result = calculateSetupScore(t);
            setupScore = result.setupScore;
            setupGrade = result.setupGrade;
          }
          if (typeof calculateSetupEvaluationGap === 'function' && setupGrade) {
            setupEvaluationGap = calculateSetupEvaluationGap({ ...t, setupGrade });
          }

          return {
            ...t,
            setupScore,
            setupGrade,
            setupEvaluationGap : setupEvaluationGap !== undefined ? setupEvaluationGap : null,
            scoringVersion     : SCORING_VERSION,
          };
        });
      }
    },

  ];

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function getCurrentSchemaVersion() {
    const v = localStorage.getItem(SCHEMA_VERSION_KEY);
    return v !== null ? parseInt(v, 10) : 0;
  }

  function setSchemaVersion(v) {
    localStorage.setItem(SCHEMA_VERSION_KEY, String(v));
  }

  function createBackup(trades, reason) {
    const key = 'gj_backup_' + reason + '_' + Date.now();
    try {
      localStorage.setItem(key, JSON.stringify(trades));
      if (global.GuardJournal && global.GuardJournal.EventBus) {
        global.GuardJournal.EventBus.emit(
          global.GuardJournal.EventBus.EVENTS.BACKUP_CREATED,
          { key, count: trades.length, reason }
        );
      }
      return key;
    } catch(e) {
      console.warn('[Migrations] Impossible de créer le backup:', e);
      return null;
    }
  }

  function getLatestVersion() {
    return Math.max(...MIGRATIONS.map(m => m.version));
  }

  // ─── API publique ──────────────────────────────────────────────────────────

  const Migrations = {

    /**
     * Applique toutes les migrations manquantes sur un tableau de trades.
     * @param {Array} trades - tableau de trades à migrer
     * @returns {{ trades: Array, applied: number[], backupKey: string|null }}
     */
    run(trades) {
      if (!Array.isArray(trades) || trades.length === 0) {
        return { trades, applied: [], backupKey: null };
      }

      const currentVersion = getCurrentSchemaVersion();
      const pendingMigrations = MIGRATIONS.filter(m => m.version > currentVersion);

      if (pendingMigrations.length === 0) {
        return { trades, applied: [], backupKey: null };
      }

      // Backup avant toute migration
      const backupKey = createBackup(trades, 'pre_migration_v' + (currentVersion + 1));

      let migrated = [...trades];
      const applied = [];

      for (const migration of pendingMigrations) {
        try {
          console.info('[Migration] Application v' + migration.version + ': ' + migration.description);
          migrated = migration.up(migrated);
          applied.push(migration.version);
        } catch(err) {
          console.error('[Migration] Échec v' + migration.version + ':', err);
          // On arrête et on retourne les données avant l'échec
          break;
        }
      }

      if (applied.length > 0) {
        setSchemaVersion(Math.max(...applied));
        if (global.GuardJournal && global.GuardJournal.EventBus) {
          global.GuardJournal.EventBus.emit(
            global.GuardJournal.EventBus.EVENTS.MIGRATION_DONE,
            { applied, from: currentVersion, to: Math.max(...applied) }
          );
        }
      }

      return { trades: migrated, applied, backupKey };
    },

    /** Retourne la version de schéma actuelle. */
    getCurrentVersion() {
      return getCurrentSchemaVersion();
    },

    /** Retourne la version cible maximale. */
    getLatestVersion() {
      return getLatestVersion();
    },

    /** Liste les migrations disponibles. */
    list() {
      return MIGRATIONS.map(m => ({
        version     : m.version,
        description : m.description,
        applied     : m.version <= getCurrentSchemaVersion(),
      }));
    },

    /** Liste les backups disponibles dans localStorage. */
    listBackups() {
      const backups = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('gj_backup_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            backups.push({ key, count: Array.isArray(data) ? data.length : 0 });
          } catch(e) { /* ignore */ }
        }
      }
      return backups;
    },

  };

  global.GuardJournal = global.GuardJournal || {};
  global.GuardJournal.Migrations = Migrations;

})(window);
