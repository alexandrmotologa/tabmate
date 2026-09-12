import { describe, it, expect } from 'vitest';
import {
  simplifyDebts,
  calculateNetBalances,
  Balance,
  MemberSummary,
  ExpenseRecord,
  SplitRecord,
  SettlementRecord,
} from './settle.js';

describe('simplifyDebts', () => {
  it('resolves zero balances to zero transactions', () => {
    const balances: Balance[] = [
      { userId: '1', name: 'Alice', amount: 0 },
      { userId: '2', name: 'Bob', amount: 0 },
    ];
    const transactions = simplifyDebts(balances);
    expect(transactions).toHaveLength(0);
  });

  it('resolves a simple 2-party debt', () => {
    const balances: Balance[] = [
      { userId: '1', name: 'Alice', amount: -50 },
      { userId: '2', name: 'Bob', amount: 50, revolutHandle: 'bob123' },
    ];
    const transactions = simplifyDebts(balances);
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toEqual({
      fromUserId: '1',
      fromName: 'Alice',
      toUserId: '2',
      toName: 'Bob',
      amount: 50,
      revolutLink: 'https://revolut.me/bob123',
      paypalLink: undefined,
      monzoLink: undefined,
      iban: undefined,
    });
  });

  it('eliminates circular debts completely', () => {
    // Alice paid 30 for Bob, Bob paid 30 for Charlie, Charlie paid 30 for Alice
    // Everyone paid 30 and consumed 30 -> all net balances are 0
    const balances: Balance[] = [
      { userId: '1', name: 'Alice', amount: 0 },
      { userId: '2', name: 'Bob', amount: 0 },
      { userId: '3', name: 'Charlie', amount: 0 },
    ];
    const transactions = simplifyDebts(balances);
    expect(transactions).toHaveLength(0);
  });

  it('simplifies multi-party chain into minimal payments', () => {
    // Alice is owed 40, Bob owes 15, Charlie owes 25
    const balances: Balance[] = [
      { userId: '1', name: 'Alice', amount: 40, revolutHandle: 'alice_pay' },
      { userId: '2', name: 'Bob', amount: -15 },
      { userId: '3', name: 'Charlie', amount: -25 },
    ];

    const transactions = simplifyDebts(balances);
    expect(transactions).toHaveLength(2);

    const totalPaid = transactions.reduce((sum, t) => sum + t.amount, 0);
    expect(totalPaid).toBe(40);

    // Both Bob and Charlie should pay Alice directly
    expect(transactions.find((t) => t.fromUserId === '3')?.amount).toBe(25);
    expect(transactions.find((t) => t.fromUserId === '2')?.amount).toBe(15);
    expect(transactions.every((t) => t.toUserId === '1')).toBe(true);
    expect(transactions[0].revolutLink).toBe('https://revolut.me/alice_pay');
  });

  it('formats PayPal and Monzo links when handles are available', () => {
    const balances: Balance[] = [
      { userId: '1', name: 'Dave', amount: -35.5 },
      {
        userId: '2',
        name: 'Emma',
        amount: 35.5,
        paypalHandle: '@emma_pp',
        monzoHandle: 'emma_m',
        iban: 'RO49AAAA1B31007593840000',
      },
    ];

    const [tx] = simplifyDebts(balances);
    expect(tx.amount).toBe(35.5);
    expect(tx.paypalLink).toBe('https://paypal.me/emma_pp/35.5');
    expect(tx.monzoLink).toBe('https://monzo.me/emma_m/35.5');
    expect(tx.iban).toBe('RO49AAAA1B31007593840000');
  });
});

describe('calculateNetBalances', () => {
  const members: MemberSummary[] = [
    { id: 'm1', name: 'Alex' },
    { id: 'm2', name: 'Dan' },
    { id: 'm3', name: 'Elena' },
  ];

  it('computes correct balances for a shared dinner', () => {
    // Alex paid 90 for a dinner split equally (30 each)
    const expenses: ExpenseRecord[] = [{ id: 'e1', paidByMemberId: 'm1', amount: 90 }];
    const splits: SplitRecord[] = [
      { expenseId: 'e1', memberId: 'm1', amount: 30 },
      { expenseId: 'e1', memberId: 'm2', amount: 30 },
      { expenseId: 'e1', memberId: 'm3', amount: 30 },
    ];
    const settlements: SettlementRecord[] = [];

    const balances = calculateNetBalances(members, expenses, splits, settlements);

    const alex = balances.find((b) => b.userId === 'm1');
    const dan = balances.find((b) => b.userId === 'm2');
    const elena = balances.find((b) => b.userId === 'm3');

    expect(alex?.amount).toBe(60); // Paid 90, owes 30 -> net +60
    expect(dan?.amount).toBe(-30); // Owes 30 -> net -30
    expect(elena?.amount).toBe(-30); // Owes 30 -> net -30
  });

  it('adjusts balances when a settlement is registered', () => {
    const expenses: ExpenseRecord[] = [{ id: 'e1', paidByMemberId: 'm1', amount: 90 }];
    const splits: SplitRecord[] = [
      { expenseId: 'e1', memberId: 'm1', amount: 30 },
      { expenseId: 'e1', memberId: 'm2', amount: 30 },
      { expenseId: 'e1', memberId: 'm3', amount: 30 },
    ];
    // Dan pays Alex 30 to settle his debt
    const settlements: SettlementRecord[] = [
      { fromMemberId: 'm2', toMemberId: 'm1', amount: 30 },
    ];

    const balances = calculateNetBalances(members, expenses, splits, settlements);

    const alex = balances.find((b) => b.userId === 'm1');
    const dan = balances.find((b) => b.userId === 'm2');
    const elena = balances.find((b) => b.userId === 'm3');

    expect(dan?.amount).toBe(0); // Dan is now fully settled
    expect(alex?.amount).toBe(30); // Alex is still owed 30 (from Elena)
    expect(elena?.amount).toBe(-30);
  });
});
