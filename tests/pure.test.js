import { describe, it, expect } from 'vitest'
import {
  signedR,
  calcStats,
  computeRealizedR,
  normalizePartials,
  fmtDate,
  getEmotionDelta,
  computeTiltScore,
  getTiltState,
} from '../src/lib/pure.js'

// ── Helpers ────────────────────────────────────────────────────────────────
function makeTrade(overrides = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    status: 'closed',
    result: 'Win',
    rrReal: 2,
    realizedR: null,
    emotion: 'Calme',
    emotionEntry: 'Calme',
    emotionExit: 'Calme',
    setup: 'MSS',
    grade: 'A',
    date: '2025-01-10',
    ...overrides,
  }
}

// ── signedR ────────────────────────────────────────────────────────────────
describe('signedR', () => {
  it('retourne realizedR si défini', () => {
    expect(signedR(makeTrade({ realizedR: 3.5 }))).toBe(3.5)
  })

  it('retourne positif pour un Win', () => {
    expect(signedR(makeTrade({ rrReal: 2, result: 'Win' }))).toBeGreaterThan(0)
  })

  it('retourne négatif pour un Loss', () => {
    expect(signedR(makeTrade({ rrReal: 1.5, result: 'Loss' }))).toBeLessThan(0)
  })

  it('retourne 0 pour un BE', () => {
    expect(signedR(makeTrade({ rrReal: 0, result: 'BE' }))).toBe(0)
  })

  it('retourne 1 par défaut pour un Win sans rrReal', () => {
    expect(signedR(makeTrade({ rrReal: 0, result: 'Win' }))).toBe(1)
  })
})

// ── calcStats ──────────────────────────────────────────────────────────────
describe('calcStats', () => {
  it('retourne null pour un set vide', () => {
    expect(calcStats([])).toBeNull()
    expect(calcStats(null)).toBeNull()
  })

  it('calcule le winrate correctement', () => {
    const trades = [
      makeTrade({ result: 'Win',  rrReal: 2 }),
      makeTrade({ result: 'Win',  rrReal: 1 }),
      makeTrade({ result: 'Loss', rrReal: 1 }),
      makeTrade({ result: 'BE',   rrReal: 0 }),
    ]
    const stats = calcStats(trades)
    // 2 wins / 3 decisive = 66.67%
    expect(stats.wr).toBeCloseTo(66.67, 1)
  })

  it('calcule le totalR correctement', () => {
    const trades = [
      makeTrade({ result: 'Win',  realizedR:  2 }),
      makeTrade({ result: 'Loss', realizedR: -1 }),
    ]
    const stats = calcStats(trades)
    expect(stats.totalR).toBeCloseTo(1, 5)
  })

  it('calcule le streak gagnant (maxW)', () => {
    const trades = [
      makeTrade({ result: 'Win' }),
      makeTrade({ result: 'Win' }),
      makeTrade({ result: 'Win' }),
      makeTrade({ result: 'Loss' }),
    ]
    const stats = calcStats(trades)
    expect(stats.maxW).toBe(3)
  })
})

// ── computeRealizedR ───────────────────────────────────────────────────────
describe('computeRealizedR', () => {
  it('retourne null pour partiels vides', () => {
    expect(computeRealizedR([])).toBeNull()
    expect(computeRealizedR(null)).toBeNull()
  })

  it('calcule le R pondéré correctement', () => {
    const partials = [
      { size: 0.5, R: 2 },
      { size: 0.5, R: 4 },
    ]
    expect(computeRealizedR(partials)).toBeCloseTo(3, 2)
  })

  it('gère un seul partiel', () => {
    expect(computeRealizedR([{ size: 1, R: 2.5 }])).toBeCloseTo(2.5, 2)
  })
})

// ── normalizePartials ──────────────────────────────────────────────────────
describe('normalizePartials', () => {
  it('retourne [] pour tableau vide', () => {
    expect(normalizePartials([])).toEqual([])
  })

  it('normalise pour que la somme des sizes = 1', () => {
    const result = normalizePartials([
      { size: 1, R: 2 },
      { size: 3, R: 4 },
    ])
    const total = result.reduce((s, p) => s + p.size, 0)
    expect(total).toBeCloseTo(1, 5)
  })

  it('ne modifie pas si déjà normalisé', () => {
    const partials = [{ size: 0.4, R: 2 }, { size: 0.6, R: 3 }]
    const result = normalizePartials(partials)
    expect(result.reduce((s, p) => s + p.size, 0)).toBeCloseTo(1, 5)
  })
})

// ── fmtDate ────────────────────────────────────────────────────────────────
describe('fmtDate', () => {
  it('formate une date ISO en dd/mm/yyyy', () => {
    expect(fmtDate('2025-01-15')).toBe('15/01/2025')
  })

  it('retourne -- pour une valeur vide', () => {
    expect(fmtDate('')).toBe('--')
    expect(fmtDate(null)).toBe('--')
  })
})

// ── getEmotionDelta ────────────────────────────────────────────────────────
describe('getEmotionDelta', () => {
  it('retourne 0 si entrée = sortie', () => {
    expect(getEmotionDelta(makeTrade({ emotionEntry: 'Calme', emotionExit: 'Calme' }))).toBe(0)
  })

  it('retourne négatif si dégradation (Calme → FOMO)', () => {
    expect(getEmotionDelta(makeTrade({ emotionEntry: 'Calme', emotionExit: 'FOMO' }))).toBeLessThan(0)
  })

  it('retourne positif si amélioration (Stress → Calme)', () => {
    expect(getEmotionDelta(makeTrade({ emotionEntry: 'Stress', emotionExit: 'Calme' }))).toBeGreaterThan(0)
  })

  it('cas extrême : Calme → Revenge = -5', () => {
    expect(getEmotionDelta(makeTrade({ emotionEntry: 'Calme', emotionExit: 'Revenge' }))).toBe(-5)
  })
})

// ── computeTiltScore ───────────────────────────────────────────────────────
describe('computeTiltScore', () => {
  it('retourne 0 pour un set vide', () => {
    expect(computeTiltScore([])).toBe(0)
  })

  it('augmente avec des pertes consécutives et mauvaise discipline', () => {
    const clean = [
      makeTrade({ result: 'Win', plan: 'Oui' }),
      makeTrade({ result: 'Win', plan: 'Oui' }),
    ]
    const tilted = [
      makeTrade({ result: 'Loss', rrReal: 1, plan: 'Non' }),
      makeTrade({ result: 'Loss', rrReal: 1, plan: 'Non' }),
    ]
    expect(computeTiltScore(tilted)).toBeGreaterThan(computeTiltScore(clean))
  })
})

// ── getTiltState ───────────────────────────────────────────────────────────
describe('getTiltState', () => {
  it('retourne STABLE pour score 0', () => {
    expect(getTiltState(0)).toBe('STABLE')
  })

  it('retourne WARNING pour score modéré', () => {
    expect(getTiltState(2)).toBe('WARNING')
  })

  it('retourne HIGH_RISK pour score élevé', () => {
    expect(getTiltState(10)).toBe('HIGH_RISK')
  })
})
