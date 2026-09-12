import { queries } from '../db/queries.js';

export function seedDemoData(): void {
  const existingGroup = queries.getGroup('demo');
  if (existingGroup) {
    return;
  }

  // 1. Create demo group
  queries.createGroup('demo', 'Summer Trip to Rome 🍕', 'EUR');

  // 2. Add 5 members with payment handles
  const members = [
    {
      id: 'm-alex',
      name: 'Alex',
      username: 'alex_dev',
      telegramUserId: '1001',
      revolut: 'alexmotologa',
      paypal: 'alexmotologa',
      color: '#3B82F6',
    },
    {
      id: 'm-dan',
      name: 'Dan',
      username: 'dan_travel',
      telegramUserId: '1002',
      revolut: 'dantravel',
      color: '#10B981',
    },
    {
      id: 'm-elena',
      name: 'Elena',
      username: 'elena_roma',
      telegramUserId: '1003',
      revolut: 'elenaroma',
      monzo: 'elena_r',
      color: '#EC4899',
    },
    {
      id: 'm-marco',
      name: 'Marco',
      username: 'marco_foodie',
      telegramUserId: '1004',
      revolut: 'marcorome',
      iban: 'IT60X0542811101000000123456',
      color: '#F59E0B',
    },
    {
      id: 'm-sofia',
      name: 'Sofia',
      username: 'sofia_art',
      telegramUserId: '1005',
      paypal: 'sofia_art',
      color: '#8B5CF6',
    },
  ];

  for (const m of members) {
    queries.addMember(
      m.id,
      'demo',
      m.name,
      m.telegramUserId,
      m.username,
      m.revolut,
      m.paypal,
      m.monzo,
      m.iban,
      m.color
    );
  }

  // 3. Create sample expenses
  const all5 = ['m-alex', 'm-dan', 'm-elena', 'm-marco', 'm-sofia'];

  // Expense 1: Airbnb Trastevere (€360 by Alex)
  queries.createExpenseWithSplits(
    {
      id: 'exp-1',
      groupId: 'demo',
      paidByMemberId: 'm-alex',
      title: 'Airbnb Villa Trastevere',
      amount: 360,
      currency: 'EUR',
      category: 'lodging',
      splitType: 'equal',
      notes: '3 nights stay in Rome center',
    },
    all5.map((mid) => ({ id: `sp-1-${mid}`, memberId: mid, amount: 72 }))
  );

  // Expense 2: Colosseum Tickets (€125 by Elena)
  queries.createExpenseWithSplits(
    {
      id: 'exp-2',
      groupId: 'demo',
      paidByMemberId: 'm-elena',
      title: 'Colosseum & Roman Forum Tickets',
      amount: 125,
      currency: 'EUR',
      category: 'entertainment',
      splitType: 'equal',
      notes: 'Skip-the-line group ticket',
    },
    all5.map((mid) => ({ id: `sp-2-${mid}`, memberId: mid, amount: 25 }))
  );

  // Expense 3: Trattoria da Enzo (€145 by Marco)
  queries.createExpenseWithSplits(
    {
      id: 'exp-3',
      groupId: 'demo',
      paidByMemberId: 'm-marco',
      title: 'Trattoria da Enzo Dinner',
      amount: 145,
      currency: 'EUR',
      category: 'food',
      splitType: 'equal',
      notes: 'Cacio e pepe and house red wine',
    },
    all5.map((mid) => ({ id: `sp-3-${mid}`, memberId: mid, amount: 29 }))
  );

  // Expense 4: Gelato at Giolitti (€25 by Sofia)
  queries.createExpenseWithSplits(
    {
      id: 'exp-4',
      groupId: 'demo',
      paidByMemberId: 'm-sofia',
      title: 'Giolitti Gelato Tour',
      amount: 25,
      currency: 'EUR',
      category: 'food',
      splitType: 'equal',
      notes: 'Pistachio and dark chocolate',
    },
    all5.map((mid) => ({ id: `sp-4-${mid}`, memberId: mid, amount: 5 }))
  );

  // Expense 5: Vespa Rental Day 1 (€90 by Dan, for Dan, Alex, Elena)
  queries.createExpenseWithSplits(
    {
      id: 'exp-5',
      groupId: 'demo',
      paidByMemberId: 'm-dan',
      title: 'Vespa Rental Day 1',
      amount: 90,
      currency: 'EUR',
      category: 'transport',
      splitType: 'custom',
      notes: 'Two scooters for the afternoon',
    },
    [
      { id: 'sp-5-dan', memberId: 'm-dan', amount: 30 },
      { id: 'sp-5-alex', memberId: 'm-alex', amount: 30 },
      { id: 'sp-5-elena', memberId: 'm-elena', amount: 30 },
    ]
  );

  // Expense 6: Coop Supermarket Groceries (€45 by Sofia)
  queries.createExpenseWithSplits(
    {
      id: 'exp-6',
      groupId: 'demo',
      paidByMemberId: 'm-sofia',
      title: 'Coop Supermarket Groceries',
      amount: 45,
      currency: 'EUR',
      category: 'groceries',
      splitType: 'equal',
      notes: 'Breakfast supplies and bottled water',
    },
    all5.map((mid) => ({ id: `sp-6-${mid}`, memberId: mid, amount: 9 }))
  );

  // Expense 7: Fiumicino Express Train (€50 by Alex)
  queries.createExpenseWithSplits(
    {
      id: 'exp-7',
      groupId: 'demo',
      paidByMemberId: 'm-alex',
      title: 'Airport Express Tickets',
      amount: 50,
      currency: 'EUR',
      category: 'transport',
      splitType: 'equal',
      notes: 'Airport transfer to Termini station',
    },
    all5.map((mid) => ({ id: `sp-7-${mid}`, memberId: mid, amount: 10 }))
  );

  // 4. Sample recorded settlement: Dan settled €30 with Alex
  queries.createSettlement(
    'settle-1',
    'demo',
    'm-dan',
    'm-alex',
    30,
    'Revolut settlement for Vespa'
  );
}
