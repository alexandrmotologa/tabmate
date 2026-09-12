import React, { useState, useMemo } from 'react';
import {
  Utensils,
  Car,
  Hotel,
  Ticket,
  ShoppingCart,
  Receipt,
  Trash2,
  Search,
  Users,
} from 'lucide-react';
import { Expense } from '../types.js';

interface ExpenseListProps {
  expenses: Expense[];
  activeMemberId: string;
  currency: string;
  onDeleteExpense: (id: string) => Promise<void>;
}

const CATEGORY_ICONS: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  food: { icon: <Utensils className="w-4 h-4" />, label: 'Food & Dining', color: 'bg-amber-500/20 text-amber-300' },
  transport: { icon: <Car className="w-4 h-4" />, label: 'Transport', color: 'bg-cyan-500/20 text-cyan-300' },
  lodging: { icon: <Hotel className="w-4 h-4" />, label: 'Lodging', color: 'bg-indigo-500/20 text-indigo-300' },
  entertainment: { icon: <Ticket className="w-4 h-4" />, label: 'Fun & Tickets', color: 'bg-pink-500/20 text-pink-300' },
  groceries: { icon: <ShoppingCart className="w-4 h-4" />, label: 'Groceries', color: 'bg-emerald-500/20 text-emerald-300' },
  general: { icon: <Receipt className="w-4 h-4" />, label: 'General', color: 'bg-slate-500/20 text-slate-300' },
};

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  activeMemberId,
  currency,
  onDeleteExpense,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'food', label: 'Food' },
    { id: 'transport', label: 'Transport' },
    { id: 'lodging', label: 'Lodging' },
    { id: 'entertainment', label: 'Fun' },
    { id: 'groceries', label: 'Groceries' },
  ];

  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchesCat = selectedCategory === 'all' || exp.category === selectedCategory;
      const matchesSearch =
        exp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (exp.payer_name && exp.payer_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (exp.notes && exp.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [expenses, selectedCategory, searchQuery]);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this expense?')) {
      try {
        setDeletingId(id);
        await onDeleteExpense(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const formatCurrency = (val: number) => {
    const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : `${currency} `;
    return `${symbol}${val.toFixed(2)}`;
  };

  return (
    <div className="space-y-4">
      {/* Search & Category Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search expenses or people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === c.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Expense List Items */}
      {filteredExpenses.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-3xl glass-card border border-slate-800/80">
          <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">No expenses found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            {searchQuery || selectedCategory !== 'all'
              ? 'Try changing your search query or category filter.'
              : 'Add your first shared expense by tapping the + Add Expense button above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredExpenses.map((expense) => {
            const catInfo = CATEGORY_ICONS[expense.category] || CATEGORY_ICONS.general;
            const isPayer = expense.paid_by_member_id === activeMemberId;
            const userSplit = expense.splits.find((s) => s.member_id === activeMemberId);

            return (
              <div
                key={expense.id}
                className="group relative flex items-center justify-between p-4 rounded-2xl glass-card border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-sm"
              >
                <div className="flex items-start space-x-3 min-w-0">
                  {/* Category icon */}
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 ${catInfo.color}`}
                  >
                    {catInfo.icon}
                  </div>

                  {/* Expense details */}
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-slate-100 truncate">
                      {expense.title}
                    </h4>

                    <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                      <span>
                        Paid by <strong className="text-slate-300">{isPayer ? 'You' : expense.payer_name}</strong>
                      </span>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <Users className="w-3 h-3 text-slate-500" />
                        <span>{expense.splits.length}</span>
                      </span>
                    </div>

                    {expense.notes && (
                      <p className="text-xs text-slate-500 truncate mt-1 italic">
                        "{expense.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Amount & Your Share */}
                <div className="flex items-center space-x-3 flex-shrink-0 ml-3 text-right">
                  <div>
                    <div className="text-sm font-bold text-slate-100">
                      {formatCurrency(expense.amount)}
                    </div>

                    {userSplit && (
                      <div className="text-xs text-slate-400">
                        {isPayer ? (
                          <span className="text-emerald-400 font-medium">
                            + {formatCurrency(expense.amount - userSplit.amount)}
                          </span>
                        ) : (
                          <span className="text-rose-400 font-medium">
                            - {formatCurrency(userSplit.amount)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Delete action */}
                  <button
                    onClick={() => handleDelete(expense.id)}
                    disabled={deletingId === expense.id}
                    title="Delete expense"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
