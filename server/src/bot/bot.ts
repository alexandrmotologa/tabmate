import { Bot, InlineKeyboard } from 'grammy';
import crypto from 'crypto';
import { queries } from '../db/queries.js';
import { calculateNetBalances, simplifyDebts } from '../engine/settle.js';

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

  // /split <amount> <title>
  bot.command('split', async (ctx) => {
    const text = ctx.match?.trim();
    const group = getOrCreateGroupForChat(ctx.chat.id, ctx.chat.title);

    if (!text) {
      const keyboard = new InlineKeyboard().webApp(
        '➕ Add Expense in TabMate',
        `${appUrl}?groupId=${group.id}&action=new_expense`
      );
      await ctx.reply(
        `To log an expense, type: \`/split <amount> <description>\`\n\n` +
          `Example: \`/split 48.50 Pizza & drinks\``,
        { reply_markup: keyboard, parse_mode: 'Markdown' }
      );
      return;
    }

    const parts = text.split(/\s+/);
    const amountStr = parts[0].replace(',', '.');
    const amount = parseFloat(amountStr);

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('⚠️ Please provide a valid positive amount. Example: `/split 25 Gelato`', {
        parse_mode: 'Markdown',
      });
      return;
    }

    const title = parts.slice(1).join(' ') || 'Shared Expense';

    const keyboard = new InlineKeyboard().webApp(
      `💳 Split €${amount.toFixed(2)} in TabMate`,
      `${appUrl}?groupId=${group.id}&amount=${amount}&title=${encodeURIComponent(title)}`
    );

    await ctx.reply(
      `💸 **Expense ready to split:**\n` +
        `• **Item:** ${title}\n` +
        `• **Amount:** €${amount.toFixed(2)}\n\n` +
        `Tap below to select who was involved and save!`,
      { reply_markup: keyboard, parse_mode: 'Markdown' }
    );
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
