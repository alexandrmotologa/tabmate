import { describe, it, expect } from 'vitest';
import { computeAnalytics } from './analytics.js';

describe('analytics engine', () => {
  const members = [
    { id: 'm1', name: 'Alex' },
    { id: 'm2', name: 'Dan' },
  ];

  const expenses = [
    { id: 'e1', paid_by_member_id: 'm1', amount: 100, category: 'lodging' },
    { id: 'e2', paid_by_member_id: 'm2', amount: 50, category: 'food' },
  ];

  const splits = [
    { expenseId: 'e1', memberId: 'm1', amount: 50 },
    { expenseId: 'e1', memberId: 'm2', amount: 50 },
    { expenseId: 'e2', memberId: 'm1', amount: 25 },
    { expenseId: 'e2', memberId: 'm2', amount: 25 },
  ];

  it('computes total spend and average cost per person', () => {
    const res = computeAnalytics(members, expenses, splits);
    expect(res.totalSpend).toBe(150);
    expect(res.expenseCount).toBe(2);
    expect(res.averageCostPerPerson).toBe(75);
  });

  it('computes category breakdowns with percentages', () => {
    const res = computeAnalytics(members, expenses, splits);
    expect(res.categories).toHaveLength(2);
    // lodging: 100/150 = 66.7%
    expect(res.categories[0].category).toBe('lodging');
    expect(res.categories[0].total).toBe(100);
    expect(res.categories[0].percentage).toBeCloseTo(66.7, 1);
  });

  it('identifies top spender correctly', () => {
    const res = computeAnalytics(members, expenses, splits);
    expect(res.topSpender).toEqual({ name: 'Alex', amount: 100 });
  });

  it('computes member spending vs consumption accurately', () => {
    const res = computeAnalytics(members, expenses, splits);
    const alex = res.memberStats.find((m) => m.memberId === 'm1');
    const dan = res.memberStats.find((m) => m.memberId === 'm2');

    expect(alex?.totalPaid).toBe(100);
    expect(alex?.totalConsumed).toBe(75);
    expect(alex?.net).toBe(25);

    expect(dan?.totalPaid).toBe(50);
    expect(dan?.totalConsumed).toBe(75);
    expect(dan?.net).toBe(-25);
  });
});
