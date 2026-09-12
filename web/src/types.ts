export interface Member {
  id: string;
  group_id: string;
  telegram_user_id?: string;
  name: string;
  username?: string;
  revolut_handle?: string;
  paypal_handle?: string;
  monzo_handle?: string;
  iban?: string;
  avatar_color?: string;
  created_at: string;
}

export interface Split {
  id: string;
  expense_id: string;
  member_id: string;
  amount: number;
  share_count: number;
  member_name?: string;
}

export interface Expense {
  id: string;
  group_id: string;
  paid_by_member_id: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  split_type: string;
  notes?: string;
  created_at: string;
  payer_name?: string;
  splits: Split[];
}

export interface Balance {
  userId: string;
  name: string;
  username?: string;
  revolutHandle?: string;
  paypalHandle?: string;
  monzoHandle?: string;
  iban?: string;
  amount: number;
}

export interface SettlementTransaction {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
  revolutLink?: string;
  paypalLink?: string;
  monzoLink?: string;
  iban?: string;
}

export interface SettlementRecord {
  id: string;
  group_id: string;
  from_member_id: string;
  to_member_id: string;
  amount: number;
  notes?: string;
  settled_at: string;
  from_name?: string;
  to_name?: string;
}

export interface Group {
  id: string;
  telegram_chat_id?: string;
  title: string;
  currency: string;
  created_at: string;
}

export interface GroupResponse {
  group: Group;
  members: Member[];
  expenses: Expense[];
  settlements: SettlementRecord[];
  balances: Balance[];
  simplifiedDebts: SettlementTransaction[];
  totalExpenses: number;
}
