import crypto from 'crypto';
import { queries } from '../db/queries.js';

export interface ParsedCsvExpense {
  title: string;
  amount: number;
  currency: string;
  category: string;
  payerName: string;
  participants: string[];
  date?: string;
  notes?: string;
}

export interface CsvImportResult {
  expensesImported: number;
  newMembersAdded: number;
}

/**
 * Parses CSV lines handling quoted commas and escapes.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parses Splitwise, Tricount, or generic TabMate CSV export content.
 */
export function parseExpenseCsv(csvContent: string): ParsedCsvExpense[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const dateIdx = header.findIndex((h) => h.includes('date'));
  const titleIdx = header.findIndex((h) => h.includes('title') || h.includes('description'));
  const categoryIdx = header.findIndex((h) => h.includes('category'));
  const amountIdx = header.findIndex((h) => h.includes('amount') || h.includes('cost'));
  const currencyIdx = header.findIndex((h) => h.includes('currency'));
  const payerIdx = header.findIndex((h) => h.includes('paid by') || h.includes('payer'));
  const notesIdx = header.findIndex((h) => h.includes('note'));

  const parsedExpenses: ParsedCsvExpense[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length <= 1) continue;

    const rawAmount = amountIdx !== -1 ? cols[amountIdx] : cols[4] || '0';
    const amount = Math.abs(parseFloat(rawAmount.replace(/[^0-9.-]/g, '')) || 0);
    if (amount <= 0) continue;

    const title = titleIdx !== -1 ? cols[titleIdx] : cols[1] || 'Imported Expense';
    const category = categoryIdx !== -1 ? cols[categoryIdx] : 'general';
    const payerName = payerIdx !== -1 ? cols[payerIdx] : cols[3] || 'Anonymous';
    const currency = currencyIdx !== -1 ? cols[currencyIdx] || 'EUR' : 'EUR';
    const notes = notesIdx !== -1 ? cols[notesIdx] : undefined;
    const date = dateIdx !== -1 ? cols[dateIdx] : undefined;

    parsedExpenses.push({
      title,
      amount,
      currency,
      category: category.toLowerCase().trim() || 'general',
      payerName: payerName.trim(),
      participants: [],
      date,
      notes,
    });
  }

  return parsedExpenses;
}

/**
 * Imports parsed expenses into a group, creating missing members dynamically.
 */
export function importExpensesToGroup(groupId: string, expenses: ParsedCsvExpense[]): CsvImportResult {
  const existingMembers = queries.getMembers(groupId);
  const memberNameMap = new Map<string, string>(); // lowercase name -> memberId
  let newMembersAdded = 0;

  for (const m of existingMembers) {
    memberNameMap.set(m.name.toLowerCase(), m.id);
  }

  // Ensure all payers exist as members
  const colors = ['#3B82F6', '#10B981', '#EC4899', '#F59E0B', '#8B5CF6', '#06B6D4'];
  for (const exp of expenses) {
    const lowerPayer = exp.payerName.toLowerCase();
    if (!memberNameMap.has(lowerPayer)) {
      const newId = `m-${crypto.randomUUID().slice(0, 8)}`;
      const color = colors[memberNameMap.size % colors.length];
      queries.addMember(newId, groupId, exp.payerName, undefined, undefined, undefined, undefined, undefined, undefined, color);
      memberNameMap.set(lowerPayer, newId);
      newMembersAdded++;
    }
  }

  // Reload all members
  const allMembers = queries.getMembers(groupId);
  let expensesImported = 0;

  for (const exp of expenses) {
    const payerId = memberNameMap.get(exp.payerName.toLowerCase()) || allMembers[0].id;
    const perPerson = Math.round((exp.amount / allMembers.length) * 100) / 100;
    let running = 0;

    const splits = allMembers.map((m, idx) => {
      const isLast = idx === allMembers.length - 1;
      const share = isLast ? Math.round((exp.amount - running) * 100) / 100 : perPerson;
      running += share;
      return {
        id: `sp-${crypto.randomUUID().slice(0, 8)}`,
        memberId: m.id,
        amount: share,
      };
    });

    queries.createExpenseWithSplits(
      {
        id: `exp-${crypto.randomUUID().slice(0, 8)}`,
        groupId,
        paidByMemberId: payerId,
        title: exp.title,
        amount: exp.amount,
        currency: exp.currency || 'EUR',
        category: exp.category || 'general',
        splitType: 'equal',
        notes: exp.notes,
      },
      splits
    );

    expensesImported++;
  }

  return { expensesImported, newMembersAdded };
}
