import React, { useState } from 'react';
import { X, Check, Utensils, Car, Hotel, Ticket, ShoppingCart, Receipt } from 'lucide-react';
import { Member } from '../types.js';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  activeMemberId: string;
  defaultCurrency: string;
  onSave: (expense: {
    title: string;
    amount: number;
    currency: string;
    paidByMemberId: string;
    category: string;
    splitType: 'equal' | 'custom' | 'shares' | 'percentage';
    notes?: string;
    splits: { memberId: string; amount?: number; shareCount?: number }[];
  }) => Promise<void>;
}

const CATEGORIES = [
  { id: 'food', label: 'Food', icon: <Utensils className="w-3.5 h-3.5" /> },
  { id: 'transport', label: 'Transport', icon: <Car className="w-3.5 h-3.5" /> },
  { id: 'lodging', label: 'Lodging', icon: <Hotel className="w-3.5 h-3.5" /> },
  { id: 'entertainment', label: 'Fun', icon: <Ticket className="w-3.5 h-3.5" /> },
  { id: 'groceries', label: 'Groceries', icon: <ShoppingCart className="w-3.5 h-3.5" /> },
  { id: 'general', label: 'Other', icon: <Receipt className="w-3.5 h-3.5" /> },
];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  members,
  activeMemberId,
  defaultCurrency,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency || 'EUR');
  const [category, setCategory] = useState('food');
  const [paidBy, setPaidBy] = useState(activeMemberId || members[0]?.id || '');
  const [splitType, setSplitType] = useState<'equal' | 'custom' | 'shares'>('equal');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Equal split: Set of participating member IDs (defaults to all)
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(
    () => new Set(members.map((m) => m.id))
  );

  // Custom split: Map of memberId -> amount
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  // Shares split: Map of memberId -> shareCount
  const [shares, setShares] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const m of members) init[m.id] = 1;
    return init;
  });

  if (!isOpen) return null;

  const numericAmount = parseFloat(amountStr.replace(',', '.')) || 0;

  const toggleParticipant = (memberId: string) => {
    const next = new Set(selectedParticipants);
    if (next.has(memberId)) {
      if (next.size > 1) next.delete(memberId);
    } else {
      next.add(memberId);
    }
    setSelectedParticipants(next);
  };

  const calculateCustomRemaining = () => {
    const allocated = Object.values(customAmounts).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0
    );
    return Math.round((numericAmount - allocated) * 100) / 100;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (numericAmount <= 0) {
      setErrorMsg('Please enter a valid expense amount.');
      return;
    }

    if (!title.trim()) {
      setErrorMsg('Please give this expense a description.');
      return;
    }

    let finalSplits: { memberId: string; amount?: number; shareCount?: number }[] = [];

    if (splitType === 'equal') {
      if (selectedParticipants.size === 0) {
        setErrorMsg('At least one member must be included in the split.');
        return;
      }
      finalSplits = Array.from(selectedParticipants).map((mid) => ({ memberId: mid }));
    } else if (splitType === 'custom') {
      const remaining = calculateCustomRemaining();
      if (Math.abs(remaining) > 0.05) {
        setErrorMsg(`Splits must sum up to €${numericAmount.toFixed(2)}. Difference: €${remaining.toFixed(2)}`);
        return;
      }
      finalSplits = members.map((m) => ({
        memberId: m.id,
        amount: parseFloat(customAmounts[m.id] || '0') || 0,
      }));
    } else if (splitType === 'shares') {
      finalSplits = members.map((m) => ({
        memberId: m.id,
        shareCount: shares[m.id] || 1,
      }));
    }

    try {
      setIsSubmitting(true);
      await onSave({
        title: title.trim(),
        amount: numericAmount,
        currency,
        paidByMemberId: paidBy,
        category,
        splitType,
        notes: notes.trim() || undefined,
        splits: finalSplits,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-base font-bold text-slate-100">Add Shared Expense</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Amount input & Currency */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Amount
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                autoFocus
                className="w-full text-3xl font-extrabold bg-slate-950/60 border border-slate-800 rounded-2xl px-4 py-3 text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="absolute right-3 bg-slate-800 text-slate-200 text-sm font-semibold rounded-xl px-2.5 py-1.5 border border-slate-700 focus:outline-none"
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
                <option value="RON">RON (lei)</option>
              </select>
            </div>
          </div>

          {/* Title & Quick Presets */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Description
            </label>
            <input
              type="text"
              placeholder="e.g. Dinner, Villa, Scooter rental"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['Dinner 🍕', 'Groceries 🛒', 'Taxi 🚕', 'Museum Tickets 🎟️', 'Coffee ☕'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTitle(preset.split(' ')[0])}
                  className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Category Chips */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                    category === cat.id
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Paid By Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Paid By
            </label>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.id === activeMemberId ? '(You)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Split Mode Tabs */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Split Mode
              </label>
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setSplitType('equal')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    splitType === 'equal' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Equal
                </button>
                <button
                  type="button"
                  onClick={() => setSplitType('custom')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    splitType === 'custom' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Exact
                </button>
                <button
                  type="button"
                  onClick={() => setSplitType('shares')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    splitType === 'shares' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Shares
                </button>
              </div>
            </div>

            {/* Split Content: Equal */}
            {splitType === 'equal' && (
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="text-xs text-slate-400 flex items-center justify-between mb-2">
                  <span>Included participants ({selectedParticipants.size}):</span>
                  {selectedParticipants.size > 0 && numericAmount > 0 && (
                    <span className="font-semibold text-blue-400">
                      €{(numericAmount / selectedParticipants.size).toFixed(2)} / person
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {members.map((m) => {
                    const isChecked = selectedParticipants.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleParticipant(m.id)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-all ${
                          isChecked
                            ? 'bg-slate-800/90 text-slate-100 border border-slate-700/80'
                            : 'bg-slate-900/40 text-slate-500 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] text-white"
                            style={{ backgroundColor: m.avatar_color || '#3B82F6' }}
                          >
                            {m.name.slice(0, 1)}
                          </div>
                          <span>{m.name}</span>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors ${
                            isChecked ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Split Content: Custom Exact */}
            {splitType === 'custom' && (
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="text-xs flex items-center justify-between mb-2">
                  <span className="text-slate-400">Enter exact amounts:</span>
                  <span
                    className={`font-semibold ${
                      Math.abs(calculateCustomRemaining()) < 0.01 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    Remaining: €{calculateCustomRemaining().toFixed(2)}
                  </span>
                </div>
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-200">{m.name}</span>
                      <div className="relative w-32">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">€</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={customAmounts[m.id] || ''}
                          onChange={(e) =>
                            setCustomAmounts({ ...customAmounts, [m.id]: e.target.value })
                          }
                          className="w-full pl-6 pr-2 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 text-right focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Split Content: Shares */}
            {splitType === 'shares' && (
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="text-xs text-slate-400 mb-2">
                  Assign shares (e.g. 2 for couples, 1 for singles):
                </div>
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-200">{m.name}</span>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() =>
                            setShares({ ...shares, [m.id]: Math.max(0, (shares[m.id] || 1) - 1) })
                          }
                          className="w-6 h-6 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold text-slate-100 w-4 text-center">
                          {shares[m.id] || 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShares({ ...shares, [m.id]: (shares[m.id] || 1) + 1 })}
                          className="w-6 h-6 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Notes (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Tip included"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] font-bold text-white shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Saving Expense...' : 'Save Shared Expense'}
          </button>
        </form>
      </div>
    </div>
  );
};
