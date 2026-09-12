# Architecture Guide

TabMate is organized as a single repository containing a Node.js backend server and a React 18 single-page application. The system runs locally without external webhooks or public domains by using Telegram's long-polling API.

## System Topology

```
+-------------------------------------------------------------+
|                      Telegram Client                        |
|                                                             |
|  +------------------------+     +------------------------+  |
|  |   Group / DM Chat      |     |  Telegram Mini App     |  |
|  |   Commands (/split)    |     |  (Embedded Webview)    |  |
|  +-----------+------------+     +-----------+------------+  |
+--------------|------------------------------|---------------+
               |                              |
               | Telegram getUpdates          | HTTP REST API
               | (Long Polling)               | & Static Assets
               v                              v
+-------------------------------------------------------------+
|                       Fastify Server                        |
|                                                             |
|  +------------------------+     +------------------------+  |
|  |     grammY Bot         |     |     REST Endpoints     |  |
|  |     Event Loop         |     |     /api/groups/*      |  |
|  +-----------+------------+     +-----------+------------+  |
|              |                              |               |
|              +--------------+---------------+               |
|                             |                               |
|                             v                               |
|              +------------------------------+               |
|              |  Minimum Cash Flow Engine    |               |
|              |  (Debt Simplification)       |               |
|              +--------------+---------------+               |
|                             |                               |
|                             v                               |
|              +------------------------------+               |
|              |  SQLite in WAL Mode          |               |
|              |  (node:sqlite DatabaseSync)  |               |
|              +------------------------------+               |
+-------------------------------------------------------------+
```

## Core Components

### 1. Telegram Bot (grammY)
The bot uses grammY with the built-in long polling runner. It does not bind any public webhooks, which allows it to run behind NATs, firewalls, and local developer machines.

When added to a group chat, the bot catches the `my_chat_member` event and creates a corresponding group row in the database. When a user runs `/split 40 Pizza`, the bot parses the arguments and sends an inline button with a URL linking to the Mini App with prefilled expense parameters.

### 2. Fastify HTTP Server
Fastify serves two duties:
- Exposes JSON endpoints under `/api/groups/*` for group information, expense logging, balance calculation, and settlements.
- Serves the compiled React bundle from `web/dist` on the root path with a single-page application fallback handler.

In local development, the Vite dev server runs on port 5173 and proxies `/api` and `/health` requests to the Fastify server on port 8080.

### 3. Database Layer
TabMate uses Node.js's built-in `node:sqlite` module (`DatabaseSync`). This removes external native C++ compilation steps during `npm install` on Windows and Linux.

The database runs with write-ahead logging (`PRAGMA journal_mode = WAL;`) and foreign key constraints enabled (`PRAGMA foreign_keys = ON;`).

Tables:
- `groups`: Stores Telegram chat IDs, titles, currency preferences, and creation dates.
- `members`: Stores user names, Telegram user IDs, and payment handles (Revolut, PayPal, Monzo, IBAN).
- `expenses`: Stores payment amounts, categories, payer references, and split configurations.
- `expense_splits`: Stores the exact breakdown assigned to each participating member.
- `settlements`: Stores records of debt payoffs between pairs of members.

### 4. Minimum Cash Flow Debt Engine
The calculation engine operates in two steps:

1. **Net Balance Calculation:** Sums each member's total expenditure against their allocated share of expenses and historical settlements. A member who paid 90 EUR for a dinner split three ways ends up with a net balance of +60 EUR, while the other two members each have -30 EUR.
2. **Greedy Matching:** Sorts debtors and creditors by absolute balance, then matches the largest debtor with the largest creditor. Each step settles the smaller of the two balances and updates both parties until all balances drop below 0.01 EUR.

### 5. Frontend Mini App (React 18 + Vite)
The frontend uses standard React with Tailwind CSS and Lucide icons. It integrates `@twa-dev/sdk` for Telegram viewport management, theme synchronization, and haptic feedback.

When opened outside of Telegram in a regular desktop browser, the app detects the absence of `initData` and presents a developer perspective toolbar. This toolbar lets developers switch between simulated members to inspect individual balance states and test settlement flows.
