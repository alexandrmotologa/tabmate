# Telegram Bot Setup Guide

This guide walks through creating and configuring your TabMate Telegram bot using `@BotFather`.

## 1. Create the Bot

1. Open Telegram and search for `@BotFather`.
2. Send the command:
   ```
   /newbot
   ```
3. Enter a display name for your bot (for example: `TabMate Expense Bot`).
4. Enter a username ending in `bot` (for example: `tabmate_split_bot`).
5. BotFather will provide an HTTP API token:
   ```
   123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
   ```
6. Copy this token into your local `.env` file in the project root:
   ```env
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
   ```

## 2. Configure Bot Commands

Send `/setcommands` to `@BotFather`, select your bot, and paste the following list:

```
start - Open your personal balance summary
split - Split an expense in group chats (e.g. /split 45 Dinner)
balance - View outstanding debts in the group
settle - Get direct payment links to settle debts
demo - Open the Rome vacation demo trip
```

## 3. Enable Group Joining

Ensure group permissions are enabled so you can add TabMate to group chats:

1. Send `/setjoingroups` to `@BotFather`.
2. Select your bot and choose **Enable**.

## 4. Set Up the Menu Button for Mini App

To allow group members to launch TabMate directly from the bottom-left menu button:

1. Send `/setmenubutton` to `@BotFather`.
2. Select your bot.
3. Enter the button title (for example: `Open TabMate`).
4. Enter your web app URL (for example: `https://your-domain.com` or your local Cloudflare / ngrok tunnel URL).

## 5. Group Privacy Mode

By default, Telegram bots run with Privacy Mode enabled, meaning they only receive messages that start with a slash command (`/`), mention the bot directly, or are replies to the bot.

TabMate is designed to work with Privacy Mode enabled because all operations use explicit commands (`/split`, `/balance`, `/settle`). You do not need to disable privacy mode.

## 6. Local Testing Without Public Domain

If you want to test the Telegram bot from your local computer without paying for hosting or setting up custom domains:

1. Start TabMate locally:
   ```bash
   npm run dev:server
   ```
   The bot connects via long polling (`getUpdates`) and immediately begins responding to `/split` and `/balance` commands in any group chat.

2. To let Telegram open the Mini App on your mobile device during local testing, you can expose your local port 8080 using a free Cloudflare tunnel:
   ```bash
   cloudflared tunnel --url http://localhost:8080
   ```
   Or open `http://localhost:5173` directly in your desktop browser. TabMate includes a browser mock shell that simulates all Telegram WebApp features.
