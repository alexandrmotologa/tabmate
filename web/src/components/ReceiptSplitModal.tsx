import React, { useState } from 'react';
import { X, Plus, Trash2, Calculator } from 'lucide-react';
import { Member } from '../types.js';

interface ReceiptLineItem {
  id: string;
  name: string;
  price: number;
  consumedBy: string[]; // member IDs
}

interface ReceiptSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  activeMemberId: string;
  currency: string;
  onSaveExpense: (expense: {
    title: string;
    amount: number;
    currency: string;
    paidByMemberId: string;
    category: string;
    splitType: 'custom';
    notes?: string;
    splits: { memberId: string; amount: number }[];
  }) => Promise<void>;
}

export const ReceiptSplitModal: React.FC<ReceiptSplitModalProps> = ({
  isOpen,
  onClose,
  members,
  activeMemberId,
  currency,
  onSaveExpense,
}) => {
  const [billTitle, setBillTitle] = useState('Dinner Receipt');
  const [payerId, setPayerId] = useState(activeMemberId || members[0]?.id || '');
  const [items, setItems] = useState<ReceiptLineItem[]>([
    { id: '1', name: 'Pizza Margherita', price: 12.5, consumedBy: members.slice(0, 2).map((m) => m.id) },
    { id: '2', name: 'Pasta Carbonara', price: 14.0, consumedBy: members.slice(2, 3).map((m) => m.id) },
    { id: '3', name: 'Craft Beers x3', price: 18.0, consumedBy: members.slice(0, 3).map((m) => m.id) },
  ]);

  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [tipAmountStr, setTipAmountStr] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const tipAmount = parseFloat(tipAmountStr.replace(',', '.')) || 0;
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const totalBill = subtotal + tipAmount;

  // Calculate each member's personal share
  const memberShares: Record<string, number> = {};
  for (const m of members) memberShares[m.id] = 0;

  for (const item of items) {
    if (item.consumedBy.length > 0) {
      const splitPrice = item.price / item.consumedBy.length;
      for (const mid of item.consumedBy) {
        memberShares[mid] = (memberShares[mid] || 0) + splitPrice;
      }
    }
  }

  // Distribute tip proportionally to food orders
  if (tipAmount > 0 && subtotal > 0) {
    for (const m of members) {
      const proportion = (memberShares[m.id] || 0) / subtotal;
      memberShares[m.id] = (memberShares[m.id] || 0) + tipAmount * proportion;
    }
  }

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newItemPrice.replace(',', '.'));
    if (!newItemName.trim() || isNaN(price) || price <= 0) return;

    setItems([
      ...items,
      {
        id: `item-${Date.now()}`,
        name: newItemName.trim(),
        price,
        consumedBy: members.map((m) => m.id), // defaults to all
      },
    ]);
    setNewItemName('');
    setNewItemPrice('');
  };

  const handleToggleConsumer = (itemId: string, memberId: string) => {
    setItems(
      items.map((item) => {
        if (item.id !== itemId) return item;
        const exists = item.consumedBy.includes(memberId);
        const next = exists
          ? item.consumedBy.filter((id) => id !== memberId)
          : [...item.consumedBy, memberId];
        return { ...item, consumedBy: next };
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleSave = async () => {
    if (items.length === 0) return;

    const splits = members
      .map((m) => ({
        memberId: m.id,
        amount: Math.round((memberShares[m.id] || 0) * 100) / 100,
      }))
      .filter((s) => s.amount > 0);

    try {
      setIsSubmitting(true);
      await onSaveExpense({
        title: billTitle.trim() || 'Itemized Receipt',
        amount: Math.round(totalBill * 100) / 100,
        currency,
        paidByMemberId: payerId,
        category: 'food',
        splitType: 'custom',
        notes: `Itemized breakdown (${items.length} items + ${currency} ${tipAmount.toFixed(2)} tip/tax)`,
        splits,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => {
    const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : `${currency} `;
    return `${symbol}${val.toFixed(2)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Calculator className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-slate-100">Itemized Receipt Splitter</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Bill Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Receipt Title</label>
              <input
                type="text"
                value={billTitle}
                onChange={(e) => setBillTitle(e.target.value)}
                className="w-full bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Paid By</label>
              <select
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="w-full bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs text-slate-100"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Line Items List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Receipt Items ({items.length})
              </label>
              <span className="text-xs font-bold text-slate-300">
                Subtotal: {formatCurrency(subtotal)}
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.id} className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">{item.name}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-100">{formatCurrency(item.price)}</span>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Consumed By Member Avatars */}
                  <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                    <span className="text-[10px] text-slate-500 mr-1">Shared by:</span>
                    {members.map((m) => {
                      const isSelected = item.consumedBy.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleToggleConsumer(item.id, m.id)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all ${
                            isSelected
                              ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                              : 'bg-slate-900 border-slate-800 text-slate-500'
                          }`}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Add Item Form */}
          <form onSubmit={handleAddItem} className="flex items-center space-x-2 p-2 rounded-2xl bg-slate-950 border border-slate-800">
            <input
              type="text"
              placeholder="Add item (e.g. Bruschetta)"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="flex-1 bg-transparent px-2 text-xs text-slate-200 focus:outline-none"
            />
            <input
              type="text"
              inputMode="decimal"
              placeholder="Price"
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(e.target.value)}
              className="w-16 bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200 text-right focus:outline-none"
            />
            <button
              type="submit"
              className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>

          {/* Tip / Tax Extra */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs">
            <span className="text-slate-400">Add Tip / Cover / Tax:</span>
            <div className="relative w-24">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">€</span>
              <input
                type="text"
                inputMode="decimal"
                value={tipAmountStr}
                onChange={(e) => setTipAmountStr(e.target.value)}
                className="w-full pl-6 pr-2 py-1 bg-slate-900 rounded-lg border border-slate-700 text-xs text-slate-100 text-right focus:outline-none"
              />
            </div>
          </div>

          {/* Live Result Per Member */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 pb-1 border-b border-slate-800/60">
              <span>Calculated Split:</span>
              <span className="text-blue-400">Total: {formatCurrency(totalBill)}</span>
            </div>
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{m.name}:</span>
                <span className="font-semibold text-slate-200">
                  {formatCurrency(memberShares[m.id] || 0)}
                </span>
              </div>
            ))}
          </div>

          {/* Submit */}
          <button
            onClick={handleSave}
            disabled={isSubmitting || items.length === 0}
            className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] font-bold text-xs text-white shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Saving Receipt...' : `Log Receipt (${formatCurrency(totalBill)})`}
          </button>
        </div>
      </div>
    </div>
  );
};
