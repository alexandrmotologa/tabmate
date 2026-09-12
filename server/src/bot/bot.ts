import { Bot, InlineKeyboard } from 'grammy';
import crypto from 'crypto';
import { queries } from '../db/queries.js';
import { calculateNetBalances, simplifyDebts } from '../engine/settle.js';
import { parseNaturalLanguageExpense } from './parser.js';
import { fetchExchangeRates } from '../engine/currency.js';

export function createTelegramBot(token?: string, webAppUrl?: string): Bot | null {
  if (!token || token === 'mock_token' || token.trim() === '') {
    console.log('[TabMate Bot] No valid TELEGRAM_BOT_TOKEN provided. Running in web/demo mode.');
    return null;
  }

  const bot = new Bot(token);
  const appUrl = webAppUrl || process.env.WEBAPP_URL || 'http://localhost:8080';

  // Helper to ensure group exists in database
  const getOrCreateGroupForChat = (chatId: number | string, chatTitle?: string) => {
    const stringChatId = chatId.toString();
    let group = queries.getGroupByTelegramChatId(stringChatId);
    if (!group) {
      const groupId = `grp-${crypto.randomUUID().slice(0, 8)}`;
      group = queries.createGroup(groupId, chatTitle || 'Telegram Group', 'EUR', stringChatId);
    }
    return group;
  };

  // /start command
  bot.command('start', async (ctx) => {
    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';

    if (isGroup) {
      const group = getOrCreateGroupForChat(ctx.chat.id, ctx.chat.title);
      const keyboard = new InlineKeyboard().webApp(
        '💳 Open TabMate',
        `${appUrl}?groupId=${group.id}`
      );

      await ctx.reply(
        `👋 **TabMate is ready for "${group.title}"!**\n\n` +
          `Track group expenses, split bills equally or custom, and settle debts with minimal transactions.\n\n` +
          `Commands:\n` +
          `• \`/split <amount> <title>\` — Quick-add an expense\n` +
          `• \`/balance\` — View current debts\n` +
          `• \`/settle\` — Get direct payment links`,
        { reply_markup: keyboard, parse_mode: 'Markdown' }
      );
    } else {
      // Private chat
      const keyboard = new InlineKeyboard()
        .webApp('🚀 Open Demo Group', `${appUrl}?groupId=demo`)
        .row()
        .url('➕ Add to Group', `https://t.me/${ctx.me.username}?startgroup=true`);

      await ctx.reply(
        `👋 **Welcome to TabMate!**\n\n` +
          `TabMate helps you and your friends split bills and settle debts effortlessly.\n\n` +
          `1. Add me to any group chat.\n` +
          `2. Type \`/split 45 Dinner\` to log expenses.\n` +
          `3. Open the Mini App to settle debts via Revolut, PayPal, or IBAN.\n\n` +
          `Tap below to explore the live Demo trip to Rome!`,
        { reply_markup: keyboard, parse_mode: 'Markdown' }
      );
    }
  });

  // /split <amount> <title> with natural language support
  bot.command('split', async (ctx) => {
    const text = ctx.match?.trim();
    const group = getOrCreateGroupForChat(ctx.chat.id, ctx.chat.title);
    const engineData = queries.getGroupEngineData(group.id);

    if (!text) {
      const keyboard = new InlineKeyboard().webApp(
        '➕ Add Expense in TabMate',
        `${appUrl}?groupId=${group.id}&action=new_expense`
      );
      await ctx.reply(
        `To log an expense, type: \`/split <amount> <description>\`\n\n` +
          `Examples:\n` +
          `• \`/split 48.50 Pizza & drinks\`\n` +
          `• \`/split 120 Hotel paid by Alex except Marco\`\n` +
          `• \`/split 35 Taxi with Dan\``,
        { reply_markup: keyboard, parse_mode: 'Markdown' }
      );
      return;
    }

    const parsed = parseNaturalLanguageExpense(text, engineData.members, ctx.from?.id);
    if (!parsed) {
      await ctx.reply(
        '⚠️ Could not parse amount from your message. Example: `/split 25 Gelato paid by Sofia`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const amount = parsed.amount;
    const title = parsed.title;

    let deepLink = `${appUrl}?groupId=${group.id}&amount=${amount}&title=${encodeURIComponent(title)}`;
    if (parsed.payerMemberId) {
      deepLink += `&paidBy=${parsed.payerMemberId}`;
    }

    let summary = `💸 **Expense Ready to Split:**\n` +
      `• **Item:** ${title}\n` +
      `• **Amount:** €${amount.toFixed(2)}\n`;

    if (parsed.payerName) {
      summary += `• **Paid by:** ${parsed.payerName}\n`;
    }
    if (parsed.excludedMemberIds && parsed.excludedMemberIds.length > 0) {
      const excludedNames = engineData.members
        .filter((m) => parsed.excludedMemberIds?.includes(m.id))
        .map((m) => m.name)
        .join(', ');
      summary += `• **Excluded:** ${excludedNames}\n`;
    }

    const keyboard = new InlineKeyboard().webApp(
      `💳 Split €${amount.toFixed(2)} in TabMate`,
      deepLink
    );

    await ctx.reply(`${summary}\nTap below to confirm participants and save!`, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });
  });

  // /rates command
  bot.command('rates', async (ctx) => {
    const rates = await fetchExchangeRates('EUR');
    const msg =
      `💱 **Live Exchange Rates (Base: 1 EUR):**\n\n` +
      `• **USD:** $${rates.USD?.toFixed(2) || '1.08'}\n` +
      `• **GBP:** £${rates.GBP?.toFixed(2) || '0.85'}\n` +
      `• **RON:** ${rates.RON?.toFixed(2) || '4.98'} lei\n` +
      `• **JPY:** ¥${rates.JPY?.toFixed(1) || '162.5'}\n` +
      `• **CHF:** ${rates.CHF?.toFixed(2) || '0.95'} Fr\n\n` +
      `You can log expenses in any of these currencies in TabMate.`;

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  // /nudge command
  bot.command('nudge', async (ctx) => {
    const group = getOrCreateGroupForChat(ctx.chat.id, ctx.chat.title);
    const engineData = queries.getGroupEngineData(group.id);

    const balances = calculateNetBalances(
      engineData.members,
      engineData.expenses,
      engineData.splits,
      engineData.settlements
    );
    const debts = simplifyDebts(balances);

    if (debts.length === 0) {
      await ctx.reply('🎉 All settled up! No one owes anything right now.');
      return;
    }

    let nudgeMsg = `👋 **Gentle Settlement Reminder for "${group.title}":**\n\n`;
    for (const d of debts) {
      nudgeMsg += `• **${d.fromName}**, you owe **${d.toName}** €${d.amount.toFixed(2)}\n`;
    }
    nudgeMsg += `\nTap below to settle via Revolut or PayPal:`;

    const keyboard = new InlineKeyboard().webApp(
      '⚡ Settle Now in TabMate',
      `${appUrl}?groupId=${group.id}&tab=settle`
    );

    await ctx.reply(nudgeMsg, { reply_markup: keyboard, parse_mode: 'Markdown' });
  });

  // /balance command
  bot.command('balance', async (ctx) => {
    const group = getOrCreateGroupForChat(ctx.chat.id, ctx.chat.title);
    const engineData = queries.getGroupEngineData(group.id);

    if (engineData.members.length === 0) {
      await ctx.reply('No members registered in this group yet. Open TabMate to start logging!');
      return;
    }

    const balances = calculateNetBalances(
      engineData.members,
      engineData.expenses,
      engineData.splits,
      engineData.settlements
    );

    const simplifiedDebts = simplifyDebts(balances);

    if (simplifiedDebts.length === 0) {
      const keyboard = new InlineKeyboard().webApp(
        '💳 Open TabMate',
        `${appUrl}?groupId=${group.id}`
      );
      await ctx.reply(`🎉 **All settled up!**\nNo outstanding debts in "${group.title}".`, {
        reply_markup: keyboard,
        parse_mode: 'Markdown',
      });
      return;
    }

    let summary = `📊 **Current Balances for "${group.title}":**\n\n`;
    for (const tx of simplifiedDebts) {
      summary += `• **${tx.fromName}** owes **${tx.toName}** €${tx.amount.toFixed(2)}\n`;
    }

    const keyboard = new InlineKeyboard().webApp(
      '⚡ Settle Debts in TabMate',
      `${appUrl}?groupId=${group.id}&tab=settle`
    );

    await ctx.reply(summary, { reply_markup: keyboard, parse_mode: 'Markdown' });
  });

  // /settle command
  bot.command('settle', async (ctx) => {
    const group = getOrCreateGroupForChat(ctx.chat.id, ctx.chat.title);
    const engineData = queries.getGroupEngineData(group.id);

    const balances = calculateNetBalances(
      engineData.members,
      engineData.expenses,
      engineData.splits,
      engineData.settlements
    );

    const simplifiedDebts = simplifyDebts(balances);

    if (simplifiedDebts.length === 0) {
      await ctx.reply('🎉 No debts to settle in this group!');
      return;
    }

    const keyboard = new InlineKeyboard().webApp(
      '⚡ Pay & Settle in TabMate',
      `${appUrl}?groupId=${group.id}&tab=settle`
    );

    await ctx.reply(
      `💳 **Ready to settle up?**\n` +
        `Open TabMate to send payments via Revolut, PayPal, or IBAN and mark them settled.`,
      { reply_markup: keyboard, parse_mode: 'Markdown' }
    );
  });

  // /demo command
  bot.command('demo', async (ctx) => {
    const keyboard = new InlineKeyboard().webApp(
      '🍕 Explore Rome Demo',
      `${appUrl}?groupId=demo`
    );

    await ctx.reply(
      `🏖️ **TabMate Demo Trip: Rome**\n` +
        `Pre-loaded with 5 friends, €840 in expenses, and minimal settlements.\n` +
        `Tap below to preview!`,
      { reply_markup: keyboard, parse_mode: 'Markdown' }
    );
  });

  // Listen for bot added to group
  bot.on('my_chat_member', async (ctx) => {
    const status = ctx.myChatMember.new_chat_member.status;
    if (status === 'member' || status === 'administrator') {
      const group = getOrCreateGroupForChat(ctx.chat.id, ctx.chat.title);
      const keyboard = new InlineKeyboard().webApp(
        '💳 Open TabMate',
        `${appUrl}?groupId=${group.id}`
      );
      await ctx.reply(
        `🎉 Thanks for adding TabMate to **${group.title}**!\n\n` +
          `Use \`/split <amount> <title>\` to add shared bills.\n` +
          `Tap below to open the group dashboard.`,
        { reply_markup: keyboard, parse_mode: 'Markdown' }
      );
    }
  });

  return bot;
}
