<p align="center">
  <img src="docs/images/logo.png?raw=true" alt="TabMate Logo" width="140" style="border-radius: 28px;" />
</p>

<h1 align="center">TabMate</h1>

<p align="center">
  <b>Ad-free Telegram Mini App & bot for frictionless group expense splitting and debt settlement.</b>
</p>

<p align="center">
  <a href="https://github.com/alexandrmotologa/tabmate/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/alexandrmotologa/tabmate/ci.yml?branch=main&style=flat-square&logo=github&label=CI" alt="CI Status" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-22%20%7C%2024-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 18" /></a>
  <a href="https://core.telegram.org/bots/webapps"><img src="https://img.shields.io/badge/Telegram-Mini%20App-24A1DE?style=flat-square&logo=telegram&logoColor=white" alt="Telegram Mini App" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License" /></a>
</p>

<p align="center">
  TabMate operates directly inside Telegram group chats or through a web browser. Debts are simplified into the fewest possible transactions using a greedy minimum cash flow algorithm, and friends can settle balances directly through Revolut, PayPal, Monzo, or IBAN transfers.
</p>

---

## Screenshots

<div align="center">
  <table>
    <tr>
      <td align="center" width="33%">
        <b>Bills & Shared Ledger</b><br/><br/>
        <img src="docs/images/screenshot_bills.png?raw=true" alt="Bills Ledger" width="280" />
      </td>
      <td align="center" width="33%">
        <b>Simplified Debts & 1-Tap Pay</b><br/><br/>
        <img src="docs/images/screenshot_debts.png?raw=true" alt="Simplified Debts" width="280" />
      </td>
      <td align="center" width="33%">
        <b>Visual Spending Analytics</b><br/><br/>
        <img src="docs/images/screenshot_analytics.png?raw=true" alt="Spending Analytics" width="280" />
      </td>
    </tr>
    <tr>
      <td align="center" width="33%">
        <b>Partial Settlements & Payment Modal</b><br/><br/>
        <img src="docs/images/screenshot_settle_modal.png?raw=true" alt="Settlement Modal" width="280" />
      </td>
      <td align="center" width="33%">
        <b>Itemized Receipt Splitter</b><br/><br/>
        <img src="docs/images/screenshot_receipt_splitter.png?raw=true" alt="Receipt Splitter" width="280" />
      </td>
      <td align="center" width="33%">
        <b>Full Architecture & Flow</b><br/><br/>
        <img src="docs/images/architecture.svg?raw=true" alt="Architecture" width="280" />
      </td>
    </tr>
  </table>
</div>

## Features

- **Telegram bot with long polling:** Runs locally without webhooks, custom domains, or SSL certificates.
- **Smart natural language expense parser:** Add expenses directly from chat using patterns like `/split 85 Dinner paid by Alex except Marco`.
- **Minimum cash flow debt engine:** Resolves circular debts and multi-party debt chains into the absolute minimum pairwise payments.
- **Multi-currency engine:** Record expenses in EUR, USD, GBP, CHF, RON, MDL, PLN, or TRY with real-time conversion rates and offline fallback.
- **Partial debt settlements:** Settle debts partially or in full with support for Revolut (`revolut.me`), PayPal (`paypal.me`), Monzo (`monzo.me`), or IBAN copying.
- **Visual analytics tab:** Built-in SVG donut chart, top categories, personal share metrics, and member comparison bars.
- **Itemized receipt line-item splitter:** Split complex restaurant or supermarket bills by specific items and assign custom shares with proportional tip/tax distribution.
- **Splitwise & Tricount CSV import:** Migrate existing trips and expense groups with one click by uploading or pasting CSV exports.
- **Printable HTML/PDF settlement report:** Generate clean, print-ready settlement summaries for trip record-keeping.
- **1-tap expense duplication & payment nudges:** Quick re-use of recurring expenses and friendly Telegram debt reminders.
- **Standalone web preview:** Includes a local browser mock shell to inspect any member perspective without Telegram accounts.
- **Zero native build dependencies:** Built on Node.js using built-in `node:sqlite` in WAL mode.

## Quick Start

### 1. Prerequisites
- Node.js 22+ (or Node 24)
- npm 10+

### 2. Clone and install

```bash
git clone https://github.com/alexandrmotologa/tabmate.git
cd tabmate

# Install server dependencies
cd server && npm install && cd ..

# Install web dependencies
cd web && npm install && cd ..
```

### 3. Run in development mode

You can run both the frontend and backend concurrently or in separate terminals:

```bash
# Terminal 1: Backend service (port 8080)
npm run dev:server

# Terminal 2: React Mini App (port 5173 with proxy to backend)
npm run dev:web
```

Open `http://localhost:5173` in your browser. The app loads the pre-seeded "Summer Trip to Rome" demo group.

### 4. Run with Docker

```bash
docker compose up --build
```

Access the application at `http://localhost:8080`.

## Telegram Bot Setup

To connect TabMate to a live Telegram bot:

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot` and follow the prompts to choose a name and username.
3. Copy the HTTP API token provided by BotFather.
4. Set the token in your `.env` file:
   ```env
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
   WEBAPP_URL=https://your-public-url.com
   ```
5. In `@BotFather`, send `/setinline` and select your bot to enable inline actions.
6. Add the bot to any group chat and type `/split 45 Dinner` or `/balance`.

For detailed instructions on menu buttons and privacy settings, see [docs/TELEGRAM_SETUP.md](docs/TELEGRAM_SETUP.md).

## Bot Commands

| Command | Chat Type | Description |
| :--- | :--- | :--- |
| `/start` | Private / Group | Displays welcome screen, personal balances, and Mini App launcher |
| `/split <amount> <title> [paid by X] [except Y]` | Group | Natural language expense registration with auto-member matching |
| `/balance` | Group | Prints a text summary of who owes whom in the group |
| `/settle` | Group | Provides direct payment links to settle outstanding debts |
| `/nudge` | Group | Sends a polite, actionable payment reminder to pending debtors |
| `/rates` | Private / Group | Shows current live currency exchange rates |
| `/demo` | Private | Opens the pre-seeded Rome vacation demo group |

## Project Structure

```
tabmate/
├── .github/workflows/ci.yml # GitHub Actions pipeline
├── docs/                    # Technical documentation
│   ├── ARCHITECTURE.md      # System design and data flow
│   ├── API.md               # REST API documentation
│   ├── TELEGRAM_SETUP.md    # BotFather configuration guide
│   └── ALGORITHM.md         # Debt simplification algorithm analysis
├── server/                  # Fastify backend & Telegram bot
│   ├── src/
│   │   ├── bot/             # grammY bot commands and handlers
│   │   ├── db/              # SQLite database connection and queries
│   │   ├── engine/          # Minimum cash flow debt simplifier & seeder
│   │   ├── routes/          # REST API endpoints
│   │   ├── security/        # Telegram initData validator
│   │   └── index.ts         # Fastify server entrypoint
│   ├── package.json
│   └── tsconfig.json
├── web/                     # React 18 + Vite Telegram Mini App
│   ├── src/
│   │   ├── components/      # UI components (BalanceCard, ExpenseList, Modals)
│   │   ├── hooks/           # useTelegram and useGroupData hooks
│   │   ├── App.tsx          # Main application container
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
├── Dockerfile
└── package.json             # Monorepo scripts
```

## Running Tests

Run the backend unit test suite:

```bash
npm test
```

The tests verify that circular debts resolve to zero, multi-party debt chains collapse into direct debtor-to-creditor payments, and payment links format correctly.

## Documentation

- [Architecture Guide](docs/ARCHITECTURE.md)
- [REST API Reference](docs/API.md)
- [Debt Simplification Algorithm](docs/ALGORITHM.md)
- [Telegram Bot Setup](docs/TELEGRAM_SETUP.md)

## License

MIT (c) 2026 Alexandr Motologa
