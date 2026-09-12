import { MemberSummary } from '../engine/settle.js';

export interface ParsedSplitCommand {
  amount: number;
  title: string;
  payerName?: string;
  payerMemberId?: string;
  includedMemberIds?: string[];
  excludedMemberIds?: string[];
  splitType: 'equal' | 'custom' | 'shares';
  rawText: string;
}

/**
 * Fuzzy matches a member by name or username from the group's members.
 */
export function matchMember(query: string, members: MemberSummary[]): MemberSummary | undefined {
  const clean = query.trim().toLowerCase().replace(/^@/, '');
  if (!clean) return undefined;

  // 1. Exact match on name or username
  const exact = members.find(
    (m) =>
      m.name.toLowerCase() === clean ||
      (m.username && m.username.toLowerCase().replace(/^@/, '') === clean)
  );
  if (exact) return exact;

  // 2. Starts with / prefix match
  const prefix = members.find(
    (m) =>
      m.name.toLowerCase().startsWith(clean) ||
      (m.username && m.username.toLowerCase().startsWith(clean))
  );
  if (prefix) return prefix;

  return undefined;
}

/**
 * Parses natural language expense text entered after `/split`.
 *
 * Supports patterns such as:
 * - "85 Dinner with wine"
 * - "85 Dinner paid by Alex for Dan, Elena"
 * - "120 Hotel except Marco"
 * - "30 Taxi with Dan"
 * - "45.50 Groceries"
 */
export function parseNaturalLanguageExpense(
  text: string,
  members: MemberSummary[],
  senderTelegramId?: string | number
): ParsedSplitCommand | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Regex to extract initial amount or currency symbol
  // Supports: "45", "45.50", "45,50", "€45", "$100", "50 EUR"
  const amountMatch = trimmed.match(
    /(?:[$€£]|RON|EUR|USD|GBP)?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:[$€£]|RON|EUR|USD|GBP)?/i
  );
  if (!amountMatch) return null;

  const rawAmountNum = parseFloat(amountMatch[1].replace(',', '.'));
  if (isNaN(rawAmountNum) || rawAmountNum <= 0) return null;

  // Remainder text without the amount
  let remainder = trimmed.replace(amountMatch[0], '').trim();

  let payerMemberId: string | undefined;
  let payerName: string | undefined;
  let includedMemberIds: string[] | undefined;
  let excludedMemberIds: string[] | undefined;

  // Look for "paid by <name>"
  const paidByMatch = remainder.match(/\bpaid\s+by\s+([a-zA-Z0-9_@]+)/i);
  if (paidByMatch) {
    const candidate = paidByMatch[1];
    const found = matchMember(candidate, members);
    if (found) {
      payerMemberId = found.id;
      payerName = found.name;
    } else {
      payerName = candidate;
    }
    remainder = remainder.replace(paidByMatch[0], '').trim();
  } else if (senderTelegramId) {
    // Default to the sender if known
    const foundSender = members.find((m) => (m as any).telegramUserId === senderTelegramId.toString());
    if (foundSender) {
      payerMemberId = foundSender.id;
      payerName = foundSender.name;
    }
  }

  // Look for "except <names>"
  const exceptMatch = remainder.match(/\bexcept\s+([a-zA-Z0-9_@,\s]+)$/i);
  if (exceptMatch) {
    const rawExclusions = exceptMatch[1].split(/[,&]|\band\b/i);
    const exclusions: string[] = [];
    for (const raw of rawExclusions) {
      const found = matchMember(raw.trim(), members);
      if (found) exclusions.push(found.id);
    }
    if (exclusions.length > 0) {
      excludedMemberIds = exclusions;
    }
    remainder = remainder.replace(exceptMatch[0], '').trim();
  }

  // Look for "for <names>" or "with <names>"
  const forMatch = remainder.match(/\b(?:for|with)\s+([a-zA-Z0-9_@,\s]+)$/i);
  if (forMatch && !excludedMemberIds) {
    const rawInclusions = forMatch[1].split(/[,&]|\band\b/i);
    const inclusions: string[] = [];
    for (const raw of rawInclusions) {
      const found = matchMember(raw.trim(), members);
      if (found) inclusions.push(found.id);
    }
    // If "with Dan" is used, also include the payer
    if (inclusions.length > 0) {
      if (payerMemberId && !inclusions.includes(payerMemberId)) {
        inclusions.push(payerMemberId);
      }
      includedMemberIds = inclusions;
    }
    remainder = remainder.replace(forMatch[0], '').trim();
  }

  // Clean title
  const cleanTitle = remainder.replace(/\s+/g, ' ').trim() || 'Shared Expense';

  return {
    amount: Math.round(rawAmountNum * 100) / 100,
    title: cleanTitle,
    payerName,
    payerMemberId,
    includedMemberIds,
    excludedMemberIds,
    splitType: 'equal',
    rawText: trimmed,
  };
}
