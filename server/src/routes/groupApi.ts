import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { queries } from '../db/queries.js';
import { calculateNetBalances, simplifyDebts } from '../engine/settle.js';

export const groupApiPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
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

    const totalAmount = parsed.data.amount;
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
        currency: parsed.data.currency,
        category: parsed.data.category,
        splitType: parsed.data.splitType,
        notes: parsed.data.notes,
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
