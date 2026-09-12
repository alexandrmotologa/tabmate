import React from 'react';
import { ArrowUpRight, ArrowDownLeft, CheckCircle2, TrendingUp, Users } from 'lucide-react';
import { GroupResponse } from '../types.js';

interface BalanceCardProps {
  data: GroupResponse;
  activeMemberId: string;
  onAddExpense: () => void;
  onOpenSettlement: () => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  data,
  activeMemberId,
  onAddExpense,
  onOpenSettlement,
}) => {
  const activeBalance = data.balances.find((b) => b.userId === activeMemberId);
  const activeMember = data.members.find((m) => m.id === activeMemberId);
  const netAmount = activeBalance ? activeBalance.amount : 0;
  const currency = data.group.currency || 'EUR';

  // Calculate how much active user spent in total
  const userExpenses = data.expenses.filter((e) => e.paid_by_member_id === activeMemberId);
  const totalUserSpent = userExpenses.reduce((sum, e) => sum + e.amount, 0);

  const formatCurrency = (val: number) => {
    const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : `${currency} `;
    return `${symbol}${Math.abs(val).toFixed(2)}`;
  };

  return (
    <div className="relative overflow-hidden rounded-3xl p-6 glass-panel border border-slate-700/50 shadow-2xl">
      {/* Background ambient glow */}
      <div
        className={`absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${
          netAmount > 0 ? 'bg-emerald-500' : netAmount < 0 ? 'bg-rose-500' : 'bg-blue-500'
        }`}
      />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow"
            style={{ backgroundColor: activeMember?.avatar_color || '#3B82F6' }}
          >
            {activeMember?.name.slice(0, 2).toUpperCase() || 'ME'}
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Personal Standing
            </h2>
            <p className="text-sm font-medium text-slate-200">{activeMember?.name || 'You'}</p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>{data.members.length} members</span>
        </div>
      </div>

      {/* Main Net Amount Display */}
      <div className="my-2">
        {netAmount > 0.01 ? (
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 mb-1 font-medium text-sm">
              <ArrowDownLeft className="w-4 h-4" />
              <span>You are owed</span>
            </div>
            <div className="text-4xl font-extrabold text-emerald-400 tracking-tight">
              +{formatCurrency(netAmount)}
            </div>
          </div>
        ) : netAmount < -0.01 ? (
          <div>
            <div className="flex items-center space-x-2 text-rose-400 mb-1 font-medium text-sm">
              <ArrowUpRight className="w-4 h-4" />
              <span>You owe</span>
            </div>
            <div className="text-4xl font-extrabold text-rose-400 tracking-tight">
              -{formatCurrency(netAmount)}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center space-x-2 text-blue-400 mb-1 font-medium text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>You are all settled up</span>
            </div>
            <div className="text-4xl font-extrabold text-slate-200 tracking-tight">
              {formatCurrency(0)}
            </div>
          </div>
        )}
      </div>

      {/* Group Stats Micro-Grid */}
      <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-slate-800/80 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-slate-400 mb-0.5">Total Group Spend</div>
          <div className="font-semibold text-slate-100 text-sm">
            {formatCurrency(data.totalExpenses)}
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-slate-400 mb-0.5">You Paid Total</div>
          <div className="font-semibold text-slate-100 text-sm flex items-center space-x-1">
            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
            <span>{formatCurrency(totalUserSpent)}</span>
          </div>
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <button
          onClick={onAddExpense}
          className="flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all font-semibold text-white shadow-lg shadow-blue-600/25"
        >
          <span>+ Add Expense</span>
        </button>

        <button
          onClick={onOpenSettlement}
          className="flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] transition-all font-semibold text-slate-200 border border-slate-700"
        >
          <span>⚡ Settlements</span>
          {data.simplifiedDebts.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 text-xs flex items-center justify-center font-bold">
              {data.simplifiedDebts.length}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
