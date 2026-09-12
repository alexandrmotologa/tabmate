export interface Balance {
  userId: string;
  name: string;
  username?: string;
  revolutHandle?: string;
  paypalHandle?: string;
  monzoHandle?: string;
  iban?: string;
  amount: number; // Positive = is owed money; Negative = owes money
}

export interface SettlementTransaction {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
  revolutLink?: string;
  paypalLink?: string;
  monzoLink?: string;
  iban?: string;
}

export interface MemberSummary {
  id: string;
  name: string;
  username?: string;
  revolutHandle?: string;
  paypalHandle?: string;
  monzoHandle?: string;
  iban?: string;
  avatarColor?: string;
}

export interface ExpenseRecord {
  id: string;
  paidByMemberId: string;
  amount: number;
}

export interface SplitRecord {
  expenseId: string;
  memberId: string;
  amount: number;
}

export interface SettlementRecord {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

/**
 * Calculates net balance for every member in a group based on:
 * - Paid expenses (+)
 * - Allocated splits (-)
 * - Recorded settlements (payer +, receiver -)
 */
export function calculateNetBalances(
  members: MemberSummary[],
  expenses: ExpenseRecord[],
  splits: SplitRecord[],
  settlements: SettlementRecord[]
): Balance[] {
  const balanceMap = new Map<string, number>();

  for (const m of members) {
    balanceMap.set(m.id, 0);
  }

  // Add amounts paid for expenses
  for (const exp of expenses) {
    const current = balanceMap.get(exp.paidByMemberId) || 0;
    balanceMap.set(exp.paidByMemberId, current + exp.amount);
  }

  // Deduct amounts owed from expense splits
  for (const sp of splits) {
    const current = balanceMap.get(sp.memberId) || 0;
    balanceMap.set(sp.memberId, current - sp.amount);
  }

  // Apply settlements already recorded
  // When fromMember pays toMember:
  // fromMember reduced their debt (+amount)
  // toMember received money (-amount)
  for (const st of settlements) {
    const fromBal = balanceMap.get(st.fromMemberId) || 0;
    const toBal = balanceMap.get(st.toMemberId) || 0;
    balanceMap.set(st.fromMemberId, fromBal + st.amount);
    balanceMap.set(st.toMemberId, toBal - st.amount);
  }

  return members.map((m) => ({
    userId: m.id,
    name: m.name,
    username: m.username,
    revolutHandle: m.revolutHandle,
    paypalHandle: m.paypalHandle,
    monzoHandle: m.monzoHandle,
    iban: m.iban,
    amount: Math.round((balanceMap.get(m.id) || 0) * 100) / 100,
  }));
}

/**
 * Minimum Cash Flow Algorithm:
 * Reduces arbitrary debt graphs to the minimal number of pairwise transactions.
 */
export function simplifyDebts(balances: Balance[]): SettlementTransaction[] {
  // Separate into debtors (< -0.01) and creditors (> 0.01)
  const debtors = balances
    .filter((b) => b.amount < -0.009)
    .map((b) => ({ ...b, amount: Math.abs(b.amount) }));

  const creditors = balances
    .filter((b) => b.amount > 0.009)
    .map((b) => ({ ...b, amount: b.amount }));

  // Sort descending by amount for greedy matching
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions: SettlementTransaction[] = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const settleAmount = Math.min(debtors[d].amount, creditors[c].amount);
    const roundedAmount = Math.round(settleAmount * 100) / 100;

    if (roundedAmount > 0) {
      const creditor = creditors[c];
      const debtor = debtors[d];

      // Generate payment links
      const revolutLink = creditor.revolutHandle
        ? `https://revolut.me/${creditor.revolutHandle.replace('@', '')}`
        : undefined;

      const paypalLink = creditor.paypalHandle
        ? `https://paypal.me/${creditor.paypalHandle.replace('@', '')}/${roundedAmount}`
        : undefined;

      const monzoLink = creditor.monzoHandle
        ? `https://monzo.me/${creditor.monzoHandle.replace('@', '')}/${roundedAmount}`
        : undefined;

      transactions.push({
        fromUserId: debtor.userId,
        fromName: debtor.name,
        toUserId: creditor.userId,
        toName: creditor.name,
        amount: roundedAmount,
        revolutLink,
        paypalLink,
        monzoLink,
        iban: creditor.iban,
      });
    }

    debtors[d].amount = Math.round((debtors[d].amount - settleAmount) * 100) / 100;
    creditors[c].amount = Math.round((creditors[c].amount - settleAmount) * 100) / 100;

    if (debtors[d].amount < 0.01) d++;
    if (creditors[c].amount < 0.01) c++;
  }

  return transactions;
}
