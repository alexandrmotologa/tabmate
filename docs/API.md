# REST API Reference

The TabMate server exposes JSON REST endpoints under `/api`. All amounts are numeric floats rounded to two decimal places.

## Base URL

```
http://localhost:8080
```

---

## Health Check

### `GET /health`
Returns the operational status of the service.

**Response:**
```json
{
  "status": "ok",
  "service": "tabmate-server",
  "timestamp": "2026-09-12T11:08:29.123Z"
}
```

---

## Groups

### `GET /api/groups`
Lists all active expense groups.

**Response:**
```json
{
  "groups": [
    {
      "id": "demo",
      "telegram_chat_id": null,
      "title": "Summer Trip to Rome 🍕",
      "currency": "EUR",
      "created_at": "2026-09-12 11:08:29"
    }
  ]
}
```

---

### `POST /api/groups`
Creates a new expense group.

**Request Body:**
```json
{
  "title": "Roadtrip Transylvania",
  "currency": "EUR",
  "creatorName": "Alex",
  "telegramChatId": "-100123456789"
}
```

**Response (201 Created):**
```json
{
  "group": {
    "id": "grp-9a4f21bc",
    "title": "Roadtrip Transylvania",
    "currency": "EUR",
    "telegram_chat_id": "-100123456789",
    "created_at": "2026-09-12 11:15:00"
  },
  "members": [
    {
      "id": "m-b1c2d3e4",
      "group_id": "grp-9a4f21bc",
      "name": "Alex",
      "avatar_color": "#3B82F6",
      "created_at": "2026-09-12 11:15:00"
    }
  ]
}
```

---

### `GET /api/groups/:id`
Retrieves complete group details, including members, expenses, recorded settlements, current net balances, and simplified debt transactions.

**Response:**
```json
{
  "group": {
    "id": "demo",
    "title": "Summer Trip to Rome 🍕",
    "currency": "EUR",
    "created_at": "2026-09-12 11:08:29"
  },
  "members": [
    {
      "id": "m-alex",
      "group_id": "demo",
      "name": "Alex",
      "username": "alex_dev",
      "revolut_handle": "alexmotologa",
      "paypal_handle": "alexmotologa",
      "avatar_color": "#3B82F6"
    }
  ],
  "expenses": [
    {
      "id": "exp-1",
      "group_id": "demo",
      "paid_by_member_id": "m-alex",
      "title": "Airbnb Villa Trastevere",
      "amount": 360,
      "currency": "EUR",
      "category": "lodging",
      "payer_name": "Alex",
      "splits": [
        { "member_id": "m-alex", "amount": 72 },
        { "member_id": "m-dan", "amount": 72 }
      ]
    }
  ],
  "balances": [
    { "userId": "m-alex", "name": "Alex", "amount": 200 },
    { "userId": "m-dan", "name": "Dan", "amount": -60 }
  ],
  "simplifiedDebts": [
    {
      "fromUserId": "m-dan",
      "fromName": "Dan",
      "toUserId": "m-alex",
      "toName": "Alex",
      "amount": 60,
      "revolutLink": "https://revolut.me/alexmotologa",
      "paypalLink": "https://paypal.me/alexmotologa/60"
    }
  ],
  "totalExpenses": 840
}
```

---

## Members

### `POST /api/groups/:id/members`
Adds a new member to a group.

**Request Body:**
```json
{
  "name": "Marco",
  "username": "marco_foodie",
  "revolutHandle": "marcorome",
  "iban": "IT60X0542811101000000123456"
}
```

**Response (201 Created):**
```json
{
  "member": {
    "id": "m-5f6a7b8c",
    "group_id": "demo",
    "name": "Marco",
    "username": "marco_foodie",
    "revolut_handle": "marcorome",
    "iban": "IT60X0542811101000000123456",
    "avatar_color": "#F59E0B",
    "created_at": "2026-09-12 11:20:00"
  }
}
```

---

### `PATCH /api/groups/:id/members/:memberId`
Updates a member's payment handles.

**Request Body:**
```json
{
  "revolutHandle": "alexmotologa",
  "paypalHandle": "alexmotologa",
  "monzoHandle": "alex_m",
  "iban": "RO49AAAA1B31007593840000"
}
```

**Response:**
```json
{
  "success": true
}
```

---

## Expenses

### `POST /api/groups/:id/expenses`
Registers an expense and distributes splits among members.

**Request Body (Equal Split):**
```json
{
  "title": "Trattoria Dinner",
  "amount": 90,
  "currency": "EUR",
  "paidByMemberId": "m-alex",
  "category": "food",
  "splitType": "equal",
  "notes": "House wine and pizza",
  "splits": [
    { "memberId": "m-alex" },
    { "memberId": "m-dan" },
    { "memberId": "m-elena" }
  ]
}
```

**Request Body (Custom Exact Amounts):**
```json
{
  "title": "Train Tickets",
  "amount": 55,
  "paidByMemberId": "m-dan",
  "category": "transport",
  "splitType": "custom",
  "splits": [
    { "memberId": "m-alex", "amount": 25 },
    { "memberId": "m-dan", "amount": 30 }
  ]
}
```

**Response (201 Created):**
```json
{
  "expenseId": "exp-3c2b1a0f",
  "success": true
}
```

---

### `DELETE /api/groups/:id/expenses/:expenseId`
Deletes an expense and its associated splits.

**Response:**
```json
{
  "success": true
}
```

---

## Settlements

### `GET /api/groups/:id/balances`
Calculates member balances and outputs the minimal set of debtor-to-creditor reimbursement transactions.

**Response:**
```json
{
  "balances": [
    { "userId": "m-alex", "name": "Alex", "amount": 100 },
    { "userId": "m-dan", "name": "Dan", "amount": -100 }
  ],
  "simplifiedDebts": [
    {
      "fromUserId": "m-dan",
      "fromName": "Dan",
      "toUserId": "m-alex",
      "toName": "Alex",
      "amount": 100,
      "revolutLink": "https://revolut.me/alexmotologa",
      "paypalLink": "https://paypal.me/alexmotologa/100"
    }
  ]
}
```

---

### `POST /api/groups/:id/settlements`
Marks a debt transaction as settled.

**Request Body:**
```json
{
  "fromMemberId": "m-dan",
  "toMemberId": "m-alex",
  "amount": 60,
  "notes": "Paid via Revolut"
}
```

**Response (201 Created):**
```json
{
  "settlement": {
    "id": "settle-12345",
    "group_id": "demo",
    "from_member_id": "m-dan",
    "to_member_id": "m-alex",
    "amount": 60,
    "notes": "Paid via Revolut",
    "settled_at": "2026-09-12 11:30:00"
  }
}
```

---

### `DELETE /api/groups/:id/settlements/:settlementId`
Deletes a recorded settlement payment (undoes the payment).

**Response:**
```json
{
  "success": true
}
```

---

## Export

### `GET /api/groups/:id/export.csv`
Generates and downloads a CSV spreadsheet containing all expenses recorded in the group.

**Headers:**
- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="tabmate-demo-expenses.csv"`

**Sample CSV Content:**
```csv
Date,Title,Category,Paid By,Amount,Currency,Notes
"2026-09-12 11:08:29","Airbnb Villa Trastevere","lodging","Alex",360.00,"EUR","3 nights stay in Rome center"
"2026-09-12 11:08:29","Colosseum & Roman Forum Tickets","entertainment","Elena",125.00,"EUR","Skip-the-line group ticket"
```

---

## Analytics & Insights

### `GET /api/groups/:id/analytics`
Calculates visual spending analytics, category breakdowns, member spending comparisons, and top category metrics.

**Response:**
```json
{
  "totalGroupSpend": 570.0,
  "expenseCount": 4,
  "topCategory": "lodging",
  "categoryBreakdown": [
    { "category": "lodging", "total": 360.0, "percentage": 63.16 },
    { "category": "entertainment", "total": 125.0, "percentage": 21.93 },
    { "category": "food", "total": 85.0, "percentage": 14.91 }
  ],
  "memberSpending": [
    { "memberId": "m-alex", "name": "Alex", "totalPaid": 360.0, "totalShare": 142.5, "net": 217.5 },
    { "memberId": "m-elena", "name": "Elena", "totalPaid": 125.0, "totalShare": 142.5, "net": -17.5 }
  ]
}
```

---

## Multi-Currency Rates

### `GET /api/rates?base=EUR`
Fetches live and cached exchange rates against supported currencies (`EUR`, `USD`, `GBP`, `CHF`, `RON`, `MDL`, `PLN`, `TRY`).

**Response:**
```json
{
  "base": "EUR",
  "rates": {
    "EUR": 1.0,
    "USD": 1.08,
    "GBP": 0.85,
    "RON": 4.97,
    "MDL": 19.3
  }
}
```

---

## CSV Migration & Import

### `POST /api/groups/:id/import-csv`
Parses CSV exports from Splitwise or Tricount, automatically creating missing members and recording imported expenses.

**Request Body:**
```json
{
  "csvContent": "Date,Description,Cost,Currency,Alex,Elena,Marco,Dan\n2026-09-10,Pasta Dinner,80.00,EUR,80.00,0,0,0"
}
```

**Response:**
```json
{
  "success": true,
  "importedCount": 1,
  "membersCreated": []
}
```

---

## Printable Settlement Report

### `GET /api/groups/:id/report.html`
Renders a clean, standalone, printable HTML settlement and expense audit sheet for PDF export or archiving.

---

## Friendly Debt Reminders

### `POST /api/groups/:id/nudge`
Sends an actionable debt settlement reminder from a creditor to a debtor.

**Request Body:**
```json
{
  "fromUserId": "m-alex",
  "toUserId": "m-marco",
  "amount": 90.0
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment reminder triggered for Marco."
}
```
