import { describe, it, expect } from 'vitest';
import { parseNaturalLanguageExpense, matchMember } from './parser.js';

describe('natural language expense parser', () => {
  const members = [
    { id: 'm-alex', name: 'Alex', username: 'alex_dev' },
    { id: 'm-dan', name: 'Dan', username: 'dan_travel' },
    { id: 'm-elena', name: 'Elena', username: 'elena_roma' },
    { id: 'm-marco', name: 'Marco', username: 'marco_foodie' },
  ];

  it('matches members by name and username', () => {
    expect(matchMember('Alex', members)?.id).toBe('m-alex');
    expect(matchMember('@dan_travel', members)?.id).toBe('m-dan');
    expect(matchMember('elena', members)?.id).toBe('m-elena');
    expect(matchMember('Unknown', members)).toBeUndefined();
  });

  it('parses standard amount and title', () => {
    const res = parseNaturalLanguageExpense('45.50 Pizza and beer', members);
    expect(res).not.toBeNull();
    expect(res?.amount).toBe(45.5);
    expect(res?.title).toBe('Pizza and beer');
  });

  it('parses "paid by <name>" accurately', () => {
    const res = parseNaturalLanguageExpense('85 Dinner paid by Alex', members);
    expect(res).not.toBeNull();
    expect(res?.amount).toBe(85);
    expect(res?.title).toBe('Dinner');
    expect(res?.payerMemberId).toBe('m-alex');
    expect(res?.payerName).toBe('Alex');
  });

  it('parses "except <name>" exclusions', () => {
    const res = parseNaturalLanguageExpense('120 Villa rental paid by Alex except Marco', members);
    expect(res).not.toBeNull();
    expect(res?.amount).toBe(120);
    expect(res?.title).toBe('Villa rental');
    expect(res?.payerMemberId).toBe('m-alex');
    expect(res?.excludedMemberIds).toEqual(['m-marco']);
  });

  it('parses "with <name>" inclusions and keeps payer', () => {
    const res = parseNaturalLanguageExpense('30 Scooter rental paid by Alex with Dan', members);
    expect(res).not.toBeNull();
    expect(res?.amount).toBe(30);
    expect(res?.title).toBe('Scooter rental');
    expect(res?.payerMemberId).toBe('m-alex');
    expect(res?.includedMemberIds).toContain('m-dan');
    expect(res?.includedMemberIds).toContain('m-alex');
  });

  it('handles comma-separated decimal numbers and currency prefixes', () => {
    const res = parseNaturalLanguageExpense('€25,90 Gelato tour', members);
    expect(res?.amount).toBe(25.9);
    expect(res?.title).toBe('Gelato tour');
  });
});
