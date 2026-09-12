import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { queries } from '../db/queries.js';
import { calculateNetBalances, simplifyDebts } from '../engine/settle.js';
import { fetchExchangeRates, convertCurrency } from '../engine/currency.js';
import { computeAnalytics } from '../engine/analytics.js';
import { parseExpenseCsv, importExpensesToGroup } from '../engine/importer.js';

export const groupApiPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /api/exchange-rates - Fetch current rates
  fastify.get<{ Querystring: { base?: string } }>('/api/exchange-rates', async (request) => {
    const base = request.query.base || 'EUR';
    const rates = await fetchExchangeRates(base);
    return { base, rates };
  });

  // GET /api/groups - List all groups
  fastify.get('/api/groups', async () => {
    const groups = queries.listGroups();
    return { groups };
  });

  // POST /api/groups - Create a new group
  fastify.post('/api/groups', async (request, reply) => {
    const bodySchema = z.object({
      title: z.string().min(1).max(100),
      currency: z.string().default('EUR'),
      creatorName: z.string().min(1).default('Me'),
      telegramChatId: z.string().optional(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }

    const groupId = `grp-${crypto.randomUUID().slice(0, 8)}`;
    const group = queries.createGroup(
      groupId,
      parsed.data.title,
      parsed.data.currency,
      parsed.data.telegramChatId
    );

    // Add creator as first member
    const memberId = `m-${crypto.randomUUID().slice(0, 8)}`;
    const member = queries.addMember(
      memberId,
      groupId,
      parsed.data.creatorName,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      '#3B82F6'
    );

    return reply.status(201).send({ group, members: [member] });
  });

  // GET /api/groups/:id - Full group details with balances and settlements
  fastify.get<{ Params: { id: string } }>('/api/groups/:id', async (request, reply) => {
    const { id } = request.params;
    const group = queries.getGroup(id);
    if (!group) {
      return reply.status(404).send({ error: 'Group not found' });
    }

    const members = queries.getMembers(id);
    const expenses = queries.getExpenses(id);
    const settlements = queries.getSettlements(id);
    const engineData = queries.getGroupEngineData(id);

    const balances = calculateNetBalances(
      engineData.members,
      engineData.expenses,
      engineData.splits,
      engineData.settlements
    );

    const simplifiedDebts = simplifyDebts(balances);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    return {
      group,
      members,
      expenses,
      settlements,
      balances,
      simplifiedDebts,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
    };
  });

  // POST /api/groups/:id/members - Add member to group
  fastify.post<{ Params: { id: string } }>('/api/groups/:id/members', async (request, reply) => {
    const { id } = request.params;
    const group = queries.getGroup(id);
    if (!group) {
      return reply.status(404).send({ error: 'Group not found' });
    }

    const schema = z.object({
      name: z.string().min(1).max(50),
      username: z.string().optional(),
      telegramUserId: z.string().optional(),
      revolutHandle: z.string().optional(),
      paypalHandle: z.string().optional(),
      monzoHandle: z.string().optional(),
      iban: z.string().optional(),
      avatarColor: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }

    const memberId = `m-${crypto.randomUUID().slice(0, 8)}`;
    const colors = ['#3B82F6', '#10B981', '#EC4899', '#F59E0B', '#8B5CF6', '#06B6D4', '#EF4444'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const member = queries.addMember(
      memberId,
      id,
      parsed.data.name,
      parsed.data.telegramUserId,
      parsed.data.username,
      parsed.data.revolutHandle,
      parsed.data.paypalHandle,
      parsed.data.monzoHandle,
      parsed.data.iban,
      parsed.data.avatarColor || randomColor
    );

    return reply.status(201).send({ member });
  });

  // PATCH /api/groups/:id/members/:memberId - Update member payment handles
  fastify.patch<{ Params: { id: string; memberId: string } }>(
    '/api/groups/:id/members/:memberId',
    async (request, reply) => {
      const { memberId } = request.params;

      const schema = z.object({
        revolutHandle: z.string().optional(),
        paypalHandle: z.string().optional(),
        monzoHandle: z.string().optional(),
        iban: z.string().optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.message });
      }

      queries.updateMemberPayment(memberId, {
        revolut_handle: parsed.data.revolutHandle,
        paypal_handle: parsed.data.paypalHandle,
        monzo_handle: parsed.data.monzoHandle,
        iban: parsed.data.iban,
      });

      return { success: true };
    }
  );

  // POST /api/groups/:id/expenses - Add new expense
  fastify.post<{ Params: { id: string } }>('/api/groups/:id/expenses', async (request, reply) => {
    const { id } = request.params;
    const group = queries.getGroup(id);
    if (!group) {
      return reply.status(404).send({ error: 'Group not found' });
    }

    const schema = z.object({
      title: z.string().min(1).max(100),
      amount: z.number().positive(),
      currency: z.string().default('EUR'),
      paidByMemberId: z.string(),
      category: z.string().default('general'),
      splitType: z.enum(['equal', 'custom', 'shares', 'percentage']).default('equal'),
      notes: z.string().optional(),
      // Custom split details
      splits: z
        .array(
          z.object({
            memberId: z.string(),
            amount: z.number().nonnegative().optional(),
            shareCount: z.number().positive().optional(),
          })
        )
        .min(1),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }

    const rawCurrency = parsed.data.currency || group.currency;
    let totalAmount = parsed.data.amount;
    let expenseNotes = parsed.data.notes || '';

    // If expense was entered in a different currency than group currency, convert to group currency
    if (rawCurrency.toUpperCase() !== group.currency.toUpperCase()) {
      const conversion = await convertCurrency(totalAmount, rawCurrency, group.currency);
      const originalAmountStr = `${totalAmount.toFixed(2)} ${rawCurrency.toUpperCase()}`;
      totalAmount = conversion.convertedAmount;
      expenseNotes = expenseNotes
        ? `${expenseNotes} (Converted from ${originalAmountStr} @ rate ${conversion.rate})`
        : `Converted from ${originalAmountStr} @ rate ${conversion.rate}`;
    }

    const splitType = parsed.data.splitType;
    let finalSplits: { id: string; memberId: string; amount: number; shareCount?: number }[] = [];

    if (splitType === 'equal') {
      // Split equally among all participants in splits array
      const count = parsed.data.splits.length;
      const rawShare = totalAmount / count;
      let runningSum = 0;

      finalSplits = parsed.data.splits.map((s, idx) => {
        const isLast = idx === count - 1;
        const share = isLast
          ? Math.round((totalAmount - runningSum) * 100) / 100
          : Math.round(rawShare * 100) / 100;
        runningSum += share;
        return {
          id: `sp-${crypto.randomUUID().slice(0, 8)}`,
          memberId: s.memberId,
          amount: share,
          shareCount: 1,
        };
      });
    } else if (splitType === 'shares') {
      const totalShares = parsed.data.splits.reduce((acc, s) => acc + (s.shareCount || 1), 0);
      let runningSum = 0;

      finalSplits = parsed.data.splits.map((s, idx) => {
        const shareCount = s.shareCount || 1;
        const rawAmount = (totalAmount * shareCount) / totalShares;
        const isLast = idx === parsed.data.splits.length - 1;
        const share = isLast
          ? Math.round((totalAmount - runningSum) * 100) / 100
          : Math.round(rawAmount * 100) / 100;
        runningSum += share;
        return {
          id: `sp-${crypto.randomUUID().slice(0, 8)}`,
          memberId: s.memberId,
          amount: share,
          shareCount,
        };
      });
    } else {
      // Custom or percentage (amount is directly supplied)
      finalSplits = parsed.data.splits.map((s) => ({
        id: `sp-${crypto.randomUUID().slice(0, 8)}`,
        memberId: s.memberId,
        amount: Math.round((s.amount || 0) * 100) / 100,
        shareCount: 1,
      }));
    }

    const expenseId = `exp-${crypto.randomUUID().slice(0, 8)}`;
    queries.createExpenseWithSplits(
      {
        id: expenseId,
        groupId: id,
        paidByMemberId: parsed.data.paidByMemberId,
        title: parsed.data.title,
        amount: Math.round(totalAmount * 100) / 100,
        currency: group.currency,
        category: parsed.data.category,
        splitType: parsed.data.splitType,
        notes: expenseNotes || undefined,
      },
      finalSplits
    );

    return reply.status(201).send({ expenseId, success: true });
  });

  // DELETE /api/groups/:id/expenses/:expenseId
  fastify.delete<{ Params: { id: string; expenseId: string } }>(
    '/api/groups/:id/expenses/:expenseId',
    async (request, reply) => {
      const { expenseId } = request.params;
      queries.deleteExpense(expenseId);
      return { success: true };
    }
  );

  // GET /api/groups/:id/balances - Net balances and simplified debts
  fastify.get<{ Params: { id: string } }>('/api/groups/:id/balances', async (request, reply) => {
    const { id } = request.params;
    const group = queries.getGroup(id);
    if (!group) {
      return reply.status(404).send({ error: 'Group not found' });
    }

    const engineData = queries.getGroupEngineData(id);
    const balances = calculateNetBalances(
      engineData.members,
      engineData.expenses,
      engineData.splits,
      engineData.settlements
    );
    const simplifiedDebts = simplifyDebts(balances);

    return {
      balances,
      simplifiedDebts,
    };
  });

  // GET /api/groups/:id/analytics - Spending breakdown and trip stats
  fastify.get<{ Params: { id: string } }>('/api/groups/:id/analytics', async (request, reply) => {
    const { id } = request.params;
    const group = queries.getGroup(id);
    if (!group) {
      return reply.status(404).send({ error: 'Group not found' });
    }

    const engineData = queries.getGroupEngineData(id);
    const expenses = queries.getExpenses(id);
    const analytics = computeAnalytics(
      engineData.members,
      expenses.map((e) => ({
        id: e.id,
        paid_by_member_id: e.paid_by_member_id,
        amount: e.amount,
        category: e.category,
      })),
      engineData.splits
    );

    return {
      groupId: id,
      currency: group.currency,
      analytics,
    };
  });

  // POST /api/groups/:id/nudge - Send settlement reminder
  fastify.post<{ Params: { id: string } }>(
    '/api/groups/:id/nudge',
    async (request, reply) => {
      const { id } = request.params;
      const group = queries.getGroup(id);
      if (!group) {
        return reply.status(404).send({ error: 'Group not found' });
      }

      const schema = z.object({
        fromUserId: z.string(),
        toUserId: z.string(),
        amount: z.number().positive(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.message });
      }

      const members = queries.getMembers(id);
      const debtor = members.find((m) => m.id === parsed.data.fromUserId);
      const creditor = members.find((m) => m.id === parsed.data.toUserId);

      return reply.send({
        success: true,
        message: `Reminder recorded for ${debtor?.name || 'debtor'} to settle €${parsed.data.amount.toFixed(2)} with ${creditor?.name || 'creditor'}.`,
      });
    }
  );

  // POST /api/groups/:id/settlements - Register a settlement payment
  fastify.post<{ Params: { id: string } }>(
    '/api/groups/:id/settlements',
    async (request, reply) => {
      const { id } = request.params;
      const group = queries.getGroup(id);
      if (!group) {
        return reply.status(404).send({ error: 'Group not found' });
      }

      const schema = z.object({
        fromMemberId: z.string(),
        toMemberId: z.string(),
        amount: z.number().positive(),
        paymentMethod: z.string().optional(),
        notes: z.string().optional(),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.message });
      }

      const settlementId = `settle-${crypto.randomUUID().slice(0, 8)}`;
      const settlement = queries.createSettlement(
        settlementId,
        id,
        parsed.data.fromMemberId,
        parsed.data.toMemberId,
        Math.round(parsed.data.amount * 100) / 100,
        parsed.data.paymentMethod || 'revolut',
        parsed.data.notes
      );

      return reply.status(201).send({ settlement });
    }
  );

  // DELETE /api/groups/:id/settlements/:settlementId
  fastify.delete<{ Params: { id: string; settlementId: string } }>(
    '/api/groups/:id/settlements/:settlementId',
    async (request, reply) => {
      const { settlementId } = request.params;
      queries.deleteSettlement(settlementId);
      return { success: true };
    }
  );

  // POST /api/groups/:id/import-csv - Import Splitwise or generic CSV
  fastify.post<{ Params: { id: string } }>(
    '/api/groups/:id/import-csv',
    async (request, reply) => {
      const { id } = request.params;
      const group = queries.getGroup(id);
      if (!group) {
        return reply.status(404).send({ error: 'Group not found' });
      }

      const schema = z.object({
        csvContent: z.string().min(1),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.message });
      }

      const expenses = parseExpenseCsv(parsed.data.csvContent);
      if (expenses.length === 0) {
        return reply.status(400).send({ error: 'No valid expenses found in the provided CSV.' });
      }

      const result = importExpensesToGroup(id, expenses);
      return reply.send({
        success: true,
        ...result,
      });
    }
  );

  // GET /api/groups/:id/report.html - Printable Trip Settlement Report
  fastify.get<{ Params: { id: string } }>('/api/groups/:id/report.html', async (request, reply) => {
    const { id } = request.params;
    const group = queries.getGroup(id);
    if (!group) {
      return reply.status(404).send({ error: 'Group not found' });
    }

    const members = queries.getMembers(id);
    const expenses = queries.getExpenses(id);
    const engineData = queries.getGroupEngineData(id);

    const balances = calculateNetBalances(
      engineData.members,
      engineData.expenses,
      engineData.splits,
      engineData.settlements
    );
    const simplifiedDebts = simplifyDebts(balances);
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

    const currencySymbol = group.currency === 'EUR' ? '€' : group.currency === 'USD' ? '$' : `${group.currency} `;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TabMate Settlement Report — ${group.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.5; color: #1e293b; background: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .title { font-size: 24px; font-weight: 800; margin: 0; color: #0f172a; }
    .subtitle { color: #64748b; font-size: 13px; margin-top: 4px; }
    .btn-print { background: #2563eb; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; }
    .btn-print:hover { background: #1d4ed8; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: #f1f5f9; padding: 16px; border-radius: 12px; }
    .stat-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; }
    .stat-val { font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; font-size: 13px; }
    th { text-align: left; padding: 10px 12px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-weight: 700; color: #475569; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .text-emerald { color: #059669; font-weight: 700; }
    .text-rose { color: #e11d48; font-weight: 700; }
    .section-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; color: #0f172a; border-left: 4px solid #2563eb; padding-left: 10px; }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1 class="title">${group.title}</h1>
        <div class="subtitle">Official TabMate Settlement Ledger • Generated on ${new Date().toLocaleDateString()}</div>
      </div>
      <button class="btn-print no-print" onclick="window.print()">Print / Save PDF</button>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Expenditure</div>
        <div class="stat-val">${currencySymbol}${totalSpent.toFixed(2)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Logged Expenses</div>
        <div class="stat-val">${expenses.length} bills</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Group Members</div>
        <div class="stat-val">${members.length} people</div>
      </div>
    </div>

    <div class="section-title">Optimal Settlement Plan (Minimal Payments)</div>
    <table>
      <thead>
        <tr>
          <th>From (Debtor)</th>
          <th>To (Creditor)</th>
          <th class="text-right">Settlement Amount</th>
          <th>Payment Handle</th>
        </tr>
      </thead>
      <tbody>
        ${
          simplifiedDebts.length === 0
            ? '<tr><td colspan="4" style="text-align:center;color:#64748b;">All debts are fully settled!</td></tr>'
            : simplifiedDebts
                .map(
                  (d) => `<tr>
              <td><strong>${d.fromName}</strong></td>
              <td><strong>${d.toName}</strong></td>
              <td class="text-right text-emerald">${currencySymbol}${d.amount.toFixed(2)}</td>
              <td>${d.revolutLink ? `<a href="${d.revolutLink}">Revolut</a>` : d.iban ? `IBAN: ${d.iban}` : 'Cash/Transfer'}</td>
            </tr>`
                )
                .join('')
        }
      </tbody>
    </table>

    <div class="section-title">Individual Balance Summary</div>
    <table>
      <thead>
        <tr>
          <th>Member Name</th>
          <th class="text-right">Net Standing</th>
        </tr>
      </thead>
      <tbody>
        ${balances
          .map(
            (b) => `<tr>
          <td><strong>${b.name}</strong></td>
          <td class="text-right ${b.amount > 0 ? 'text-emerald' : b.amount < 0 ? 'text-rose' : ''}">
            ${b.amount > 0 ? `+${currencySymbol}${b.amount.toFixed(2)} (Owed)` : b.amount < 0 ? `-${currencySymbol}${Math.abs(b.amount).toFixed(2)} (Owes)` : 'Settled'}
          </td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>

    <div class="section-title">Itemized Expense Ledger</div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Category</th>
          <th>Paid By</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${expenses
          .map(
            (e) => `<tr>
          <td>${e.created_at.slice(0, 10)}</td>
          <td><strong>${e.title}</strong>${e.notes ? `<div style="font-size:11px;color:#64748b;">${e.notes}</div>` : ''}</td>
          <td style="text-transform:capitalize;">${e.category}</td>
          <td>${e.payer_name}</td>
          <td class="text-right">${currencySymbol}${e.amount.toFixed(2)}</td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;

    reply.header('Content-Type', 'text/html; charset=utf-8');
    return reply.send(html);
  });

  // GET /api/groups/:id/export.csv - Download CSV report
  fastify.get<{ Params: { id: string } }>('/api/groups/:id/export.csv', async (request, reply) => {
    const { id } = request.params;
    const group = queries.getGroup(id);
    if (!group) {
      return reply.status(404).send({ error: 'Group not found' });
    }

    const expenses = queries.getExpenses(id);
    const rows = [
      ['Date', 'Title', 'Category', 'Paid By', 'Amount', 'Currency', 'Notes'],
    ];

    for (const exp of expenses) {
      rows.push([
        `"${exp.created_at}"`,
        `"${exp.title.replace(/"/g, '""')}"`,
        `"${exp.category}"`,
        `"${(exp.payer_name || '').replace(/"/g, '""')}"`,
        `${exp.amount.toFixed(2)}`,
        `"${exp.currency}"`,
        `"${(exp.notes || '').replace(/"/g, '""')}"`,
      ]);
    }

    const csvContent = rows.map((r) => r.join(',')).join('\n');

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="tabmate-${id}-expenses.csv"`);
    return reply.send(csvContent);
  });
};
