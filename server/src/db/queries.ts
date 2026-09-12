import { getDatabase } from './database.js';
import { MemberSummary, ExpenseRecord, SplitRecord, SettlementRecord } from '../engine/settle.js';

export interface GroupRow {
  id: string;
  telegram_chat_id?: string;
  title: string;
  currency: string;
  created_at: string;
}

export interface MemberRow {
  id: string;
  group_id: string;
  telegram_user_id?: string;
  name: string;
  username?: string;
  revolut_handle?: string;
  paypal_handle?: string;
  monzo_handle?: string;
  iban?: string;
  avatar_color?: string;
  created_at: string;
}

export interface ExpenseRow {
  id: string;
  group_id: string;
  paid_by_member_id: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  split_type: string;
  notes?: string;
  created_at: string;
  payer_name?: string;
}

export interface SplitRow {
  id: string;
  expense_id: string;
  member_id: string;
  amount: number;
  share_count: number;
  member_name?: string;
}

export interface SettlementRow {
  id: string;
  group_id: string;
  from_member_id: string;
  to_member_id: string;
  amount: number;
  payment_method?: string;
  notes?: string;
  settled_at: string;
  from_name?: string;
  to_name?: string;
}

export const queries = {
  getGroup(id: string): GroupRow | undefined {
    const db = getDatabase();
    return db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as unknown as GroupRow | undefined;
  },

  getGroupByTelegramChatId(chatId: string): GroupRow | undefined {
    const db = getDatabase();
    return db
      .prepare('SELECT * FROM groups WHERE telegram_chat_id = ?')
      .get(chatId) as unknown as GroupRow | undefined;
  },

  listGroups(): GroupRow[] {
    const db = getDatabase();
    return db.prepare('SELECT * FROM groups ORDER BY created_at DESC').all() as unknown as GroupRow[];
  },

  createGroup(id: string, title: string, currency = 'EUR', telegramChatId?: string): GroupRow {
    const db = getDatabase();
    const stmt = db.prepare(
      'INSERT INTO groups (id, title, currency, telegram_chat_id) VALUES (?, ?, ?, ?) RETURNING *'
    );
    return stmt.get(id, title, currency, telegramChatId || null) as unknown as GroupRow;
  },

  getMembers(groupId: string): MemberRow[] {
    const db = getDatabase();
    return db
      .prepare('SELECT * FROM members WHERE group_id = ? ORDER BY created_at ASC')
      .all(groupId) as unknown as MemberRow[];
  },

  getMemberByTelegramId(groupId: string, telegramUserId: string): MemberRow | undefined {
    const db = getDatabase();
    return db
      .prepare('SELECT * FROM members WHERE group_id = ? AND telegram_user_id = ?')
      .get(groupId, telegramUserId) as unknown as MemberRow | undefined;
  },

  addMember(
    id: string,
    groupId: string,
    name: string,
    telegramUserId?: string,
    username?: string,
    revolutHandle?: string,
    paypalHandle?: string,
    monzoHandle?: string,
    iban?: string,
    avatarColor?: string
  ): MemberRow {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO members (
        id, group_id, name, telegram_user_id, username, 
        revolut_handle, paypal_handle, monzo_handle, iban, avatar_color
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    return stmt.get(
      id,
      groupId,
      name,
      telegramUserId || null,
      username || null,
      revolutHandle || null,
      paypalHandle || null,
      monzoHandle || null,
      iban || null,
      avatarColor || '#3B82F6'
    ) as unknown as MemberRow;
  },

  updateMemberPayment(
    memberId: string,
    handles: {
      revolut_handle?: string;
      paypal_handle?: string;
      monzo_handle?: string;
      iban?: string;
    }
  ): void {
    const db = getDatabase();
    const fields: string[] = [];
    const values: (string | null)[] = [];

    if (handles.revolut_handle !== undefined) {
      fields.push('revolut_handle = ?');
      values.push(handles.revolut_handle || null);
    }
    if (handles.paypal_handle !== undefined) {
      fields.push('paypal_handle = ?');
      values.push(handles.paypal_handle || null);
    }
    if (handles.monzo_handle !== undefined) {
      fields.push('monzo_handle = ?');
      values.push(handles.monzo_handle || null);
    }
    if (handles.iban !== undefined) {
      fields.push('iban = ?');
      values.push(handles.iban || null);
    }

    if (fields.length === 0) return;

    values.push(memberId);
    db.prepare(`UPDATE members SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  },

  getExpenses(groupId: string): (ExpenseRow & { splits: SplitRow[] })[] {
    const db = getDatabase();
    const expenses = db
      .prepare(`
        SELECT e.*, m.name as payer_name
        FROM expenses e
        JOIN members m ON e.paid_by_member_id = m.id
        WHERE e.group_id = ?
        ORDER BY e.created_at DESC
      `)
      .all(groupId) as unknown as (ExpenseRow & { payer_name: string })[];

    const splitsStmt = db.prepare(`
      SELECT s.*, m.name as member_name
      FROM expense_splits s
      JOIN members m ON s.member_id = m.id
      WHERE s.expense_id = ?
    `);

    return expenses.map((exp) => ({
      ...exp,
      splits: splitsStmt.all(exp.id) as unknown as SplitRow[],
    }));
  },

  createExpenseWithSplits(
    expense: {
      id: string;
      groupId: string;
      paidByMemberId: string;
      title: string;
      amount: number;
      currency?: string;
      category?: string;
      splitType?: string;
      notes?: string;
    },
    splits: { id: string; memberId: string; amount: number; shareCount?: number }[]
  ): void {
    const db = getDatabase();
    db.exec('BEGIN;');
    try {
      db.prepare(`
        INSERT INTO expenses (id, group_id, paid_by_member_id, title, amount, currency, category, split_type, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        expense.id,
        expense.groupId,
        expense.paidByMemberId,
        expense.title,
        expense.amount,
        expense.currency || 'EUR',
        expense.category || 'general',
        expense.splitType || 'equal',
        expense.notes || null
      );

      const splitStmt = db.prepare(`
        INSERT INTO expense_splits (id, expense_id, member_id, amount, share_count)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const sp of splits) {
        splitStmt.run(sp.id, expense.id, sp.memberId, sp.amount, sp.shareCount || 1);
      }
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  },

  deleteExpense(expenseId: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM expenses WHERE id = ?').run(expenseId);
  },

  getSettlements(groupId: string): SettlementRow[] {
    const db = getDatabase();
    return db
      .prepare(`
        SELECT s.*, fm.name as from_name, tm.name as to_name
        FROM settlements s
        JOIN members fm ON s.from_member_id = fm.id
        JOIN members tm ON s.to_member_id = tm.id
        WHERE s.group_id = ?
        ORDER BY s.settled_at DESC
      `)
      .all(groupId) as unknown as SettlementRow[];
  },

  createSettlement(
    id: string,
    groupId: string,
    fromMemberId: string,
    toMemberId: string,
    amount: number,
    paymentMethod?: string,
    notes?: string
  ): SettlementRow {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO settlements (id, group_id, from_member_id, to_member_id, amount, payment_method, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    return stmt.get(
      id,
      groupId,
      fromMemberId,
      toMemberId,
      amount,
      paymentMethod || 'revolut',
      notes || null
    ) as unknown as SettlementRow;
  },

  deleteSettlement(settlementId: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM settlements WHERE id = ?').run(settlementId);
  },

  getGroupEngineData(groupId: string): {
    members: MemberSummary[];
    expenses: ExpenseRecord[];
    splits: SplitRecord[];
    settlements: SettlementRecord[];
  } {
    const db = getDatabase();
    const members = db
      .prepare('SELECT * FROM members WHERE group_id = ?')
      .all(groupId) as unknown as MemberRow[];

    const expenses = db
      .prepare('SELECT id, paid_by_member_id, amount FROM expenses WHERE group_id = ?')
      .all(groupId) as unknown as { id: string; paid_by_member_id: string; amount: number }[];

    const splits = db
      .prepare(`
        SELECT s.expense_id, s.member_id, s.amount
        FROM expense_splits s
        JOIN expenses e ON s.expense_id = e.id
        WHERE e.group_id = ?
      `)
      .all(groupId) as unknown as { expense_id: string; member_id: string; amount: number }[];

    const settlements = db
      .prepare('SELECT from_member_id, to_member_id, amount FROM settlements WHERE group_id = ?')
      .all(groupId) as unknown as { from_member_id: string; to_member_id: string; amount: number }[];

    return {
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        username: m.username,
        revolutHandle: m.revolut_handle,
        paypalHandle: m.paypal_handle,
        monzoHandle: m.monzo_handle,
        iban: m.iban,
        avatarColor: m.avatar_color,
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        paidByMemberId: e.paid_by_member_id,
        amount: e.amount,
      })),
      splits: splits.map((s) => ({
        expenseId: s.expense_id,
        memberId: s.member_id,
        amount: s.amount,
      })),
      settlements: settlements.map((st) => ({
        fromMemberId: st.from_member_id,
        toMemberId: st.to_member_id,
        amount: st.amount,
      })),
    };
  },
};
