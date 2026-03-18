/**
 * Tests for getPortCountForModel and GIGACORE_PORT_COUNTS.
 */

import { describe, it, expect } from 'vitest';
import { getPortCountForModel, GIGACORE_PORT_COUNTS } from './types';

describe('getPortCountForModel', () => {
  // ── Exact model matches ─────────────────────────────────────────────────

  it('should return correct port count for all known models', () => {
    const expected: Record<string, number> = {
      'GigaCore 10': 12,
      'GigaCore 12': 12,
      'GigaCore 14R': 14,
      'GigaCore 14r': 14,
      'GigaCore 16t': 16,
      'GigaCore 16RFO': 16,
      'GigaCore 16Xt': 16,
      'GigaCore 18t': 18,
      'GigaCore 20t': 20,
      'GigaCore 26i': 26,
      'GigaCore 30i': 30,
    };

    for (const [model, count] of Object.entries(expected)) {
      expect(getPortCountForModel(model)).toBe(count);
    }
  });

  // ── Case-insensitive matching ───────────────────────────────────────────

  it('should match case-insensitively', () => {
    expect(getPortCountForModel('gigacore 30i')).toBe(30);
    expect(getPortCountForModel('GIGACORE 26I')).toBe(26);
    expect(getPortCountForModel('GiGaCoRe 14R')).toBe(14);
  });

  // ── Substring matching (model string embedded in larger text) ───────────

  it('should match when model string is part of a longer string', () => {
    expect(getPortCountForModel('Luminex GigaCore 30i v2')).toBe(30);
    expect(getPortCountForModel('My GigaCore 16t Switch')).toBe(16);
  });

  // ── Fallback numeric extraction ─────────────────────────────────────────

  it('should extract port count from number in model string when no exact match', () => {
    // Number within valid range (8-48)
    expect(getPortCountForModel('SomeSwitch 24')).toBe(24);
    expect(getPortCountForModel('Model48')).toBe(48);
    expect(getPortCountForModel('Switch-8')).toBe(8);
  });

  it('should reject numbers outside the 8-48 range', () => {
    expect(getPortCountForModel('Model 2')).toBe(0);
    expect(getPortCountForModel('Switch 100')).toBe(0);
  });

  // ── Disambiguation: GigaCore 10 vs GigaCore 12 ─────────────────────────

  it('should correctly distinguish GigaCore 10 (12 ports) from extracting "10" as port count', () => {
    // "GigaCore 10" is a known model that has 12 ports, not 10
    expect(getPortCountForModel('GigaCore 10')).toBe(12);
  });

  // ── No match at all ─────────────────────────────────────────────────────

  it('should return 0 for completely unknown models with no extractable number', () => {
    expect(getPortCountForModel('Unknown')).toBe(0);
    expect(getPortCountForModel('')).toBe(0);
  });

  // ── GIGACORE_PORT_COUNTS sanity ─────────────────────────────────────────

  it('should have all models mapping to positive port counts', () => {
    for (const [model, count] of Object.entries(GIGACORE_PORT_COUNTS)) {
      expect(count).toBeGreaterThan(0);
      expect(model).toMatch(/GigaCore/i);
    }
  });
});
