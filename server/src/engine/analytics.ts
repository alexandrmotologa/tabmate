import { MemberSummary, ExpenseRecord, SplitRecord } from './settle.js';

export interface CategoryBreakdown {
  category: string;
  total: number;
  percentage: number;
  count: number;
  color: string;
}

export interface MemberSpending {
  memberId: string;
  name: string;
  avatarColor?: string;
  totalPaid: number;
  totalConsumed: number;
  net: number;
}

export interface TripAnalytics {
  totalSpend: number;
  expenseCount: number;
  averageCostPerPerson: number;
  topSpender: { name: string; amount: number } | null;
  topCategory: { category: string; total: number } | null;
  categories: CategoryBreakdown[];
  memberStats: MemberSpending[];
}

const CATEGORY_COLORS: Record<string, string> = {
  food: '#F59E0B',
  transport: '#06B6D4',
  lodging: '#6366F1',
  entertainment: '#EC4899',
  groceries: '#10B981',
  general: '#64748B',
};

export function computeAnalytics(
  members: MemberSummary[],
  expenses: { id: string; paid_by_member_id: string; amount: number; category: string }[],
  splits: SplitRecord[]
): TripAnalytics {
  const totalSpend = Math.round(expenses.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;
  const expenseCount = expenses.length;
  const averageCostPerPerson =
    members.length > 0 ? Math.round((totalSpend / members.length) * 100) / 100 : 0;

  // 1. Category Breakdown
  const catMap = new Map<string, { total: number; count: number }>();
  for (const exp of expenses) {
    const cat = exp.category || 'general';
    const cur = catMap.get(cat) || { total: 0, count: 0 };
    catMap.set(cat, {
      total: cur.total + exp.amount,
      count: cur.count + 1,
    });
  }

  const categories: CategoryBreakdown[] = Array.from(catMap.entries())
    .map(([cat, data]) => {
      const roundedTotal = Math.round(data.total * 100) / 100;
      const percentage = totalSpend > 0 ? Math.round((roundedTotal / totalSpend) * 1000) / 10 : 0;
      return {
        category: cat,
        total: roundedTotal,
        percentage,
        count: data.count,
        color: CATEGORY_COLORS[cat] || '#8B5CF6',
      };
    })
    .sort((a, b) => b.total - a.total);

  // 2. Member Paid vs Consumed
  const paidMap = new Map<string, number>();
  const consumedMap = new Map<string, number>();
  for (const m of members) {
    paidMap.set(m.id, 0);
    consumedMap.set(m.id, 0);
  }

  for (const exp of expenses) {
    const cur = paidMap.get(exp.paid_by_member_id) || 0;
    paidMap.set(exp.paid_by_member_id, cur + exp.amount);
  }

  for (const sp of splits) {
    const cur = consumedMap.get(sp.memberId) || 0;
    consumedMap.set(sp.memberId, cur + sp.amount);
  }

  const memberStats: MemberSpending[] = members.map((m) => {
    const totalPaid = Math.round((paidMap.get(m.id) || 0) * 100) / 100;
    const totalConsumed = Math.round((consumedMap.get(m.id) || 0) * 100) / 100;
    return {
      memberId: m.id,
      name: m.name,
      avatarColor: m.avatarColor,
      totalPaid,
      totalConsumed,
      net: Math.round((totalPaid - totalConsumed) * 100) / 100,
    };
  });

  // Top Spender
  let topSpender: { name: string; amount: number } | null = null;
  if (memberStats.length > 0) {
    const sortedSpenders = [...memberStats].sort((a, b) => b.totalPaid - a.totalPaid);
    if (sortedSpenders[0].totalPaid > 0) {
      topSpender = { name: sortedSpenders[0].name, amount: sortedSpenders[0].totalPaid };
    }
  }

  // Top Category
  const topCategory = categories.length > 0 ? { category: categories[0].category, total: categories[0].total } : null;

  return {
    totalSpend,
    expenseCount,
    averageCostPerPerson,
    topSpender,
    topCategory,
    categories,
    memberStats,
  };
}
