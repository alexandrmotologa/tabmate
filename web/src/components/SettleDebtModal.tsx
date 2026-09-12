import React, { useState } from 'react';
import { X, Check, ExternalLink, Copy, CheckCircle2, ArrowRight } from 'lucide-react';
import { SettlementTransaction, Member } from '../types.js';

interface SettleDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: SettlementTransaction | null;
  fromMember?: Member;
  toMember?: Member;
  currency: string;
  onConfirm: (
    fromId: string,
    toId: string,
    amount: number,
    paymentMethod: string,
    notes?: string
  ) => Promise<void>;
}

export const SettleDebtModal: React.FC<SettleDebtModalProps> = ({
  isOpen,
  onClose,
  transaction,
  fromMember,
  toMember,
  currency,
  onConfirm,
}) => {
  if (!isOpen || !transaction) return null;

  const fullAmount = transaction.amount;
  const [amountStr, setAmountStr] = useState(fullAmount.toString());
  const [method, setMethod] = useState<'revolut' | 'paypal' | 'monzo' | 'cash' | 'bank'>('revolut');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedIban, setCopiedIban] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const numericAmount = parseFloat(amountStr.replace(',', '.')) || 0;
  const remaining = Math.round((fullAmount - numericAmount) * 100) / 100;

  const copyIban = () => {
    if (transaction.iban) {
      navigator.clipboard.writeText(transaction.iban);
      setCopiedIban(true);
      setTimeout(() => setCopiedIban(false), 2000);
    }
  };

  const handlePreset = (val: number) => {
    setAmountStr(val.toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) {
      setErrorMsg('Please enter a valid positive settlement amount.');
      return;
    }
    if (numericAmount > fullAmount + 0.01) {
      setErrorMsg(`Amount cannot exceed the total outstanding debt of ${currency} ${fullAmount.toFixed(2)}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirm(
        transaction.fromUserId,
        transaction.toUserId,
        numericAmount,
        method,
        notes.trim() || undefined
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record settlement');
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
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-100">Settle Group Debt</h3>
            <p className="text-xs text-slate-400 mt-0.5">Pay in full or record a partial settlement</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Parties Card */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs text-white"
              style={{ backgroundColor: fromMember?.avatar_color || '#EF4444' }}
            >
              {transaction.fromName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold uppercase">Debtor (Payer)</div>
              <div className="text-xs font-bold text-slate-200">{transaction.fromName}</div>
            </div>
          </div>

          <ArrowRight className="w-4 h-4 text-slate-500 flex-shrink-0 mx-2" />

          <div className="flex items-center space-x-2.5">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs text-white"
              style={{ backgroundColor: toMember?.avatar_color || '#10B981' }}
            >
              {transaction.toName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold uppercase">Creditor (Receiver)</div>
              <div className="text-xs font-bold text-slate-200">{transaction.toName}</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Amount input & Quick Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Settlement Amount
              </label>
              <span className="text-xs text-slate-400">
                Total Debt: <strong className="text-slate-200">{formatCurrency(fullAmount)}</strong>
              </span>
            </div>

            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-lg font-bold text-slate-500">
                {currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="w-full text-2xl font-extrabold bg-slate-950/60 border border-slate-800 rounded-2xl pl-9 pr-4 py-2.5 text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Quick preset buttons */}
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => handlePreset(fullAmount)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  Math.abs(numericAmount - fullAmount) < 0.01
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                100% ({formatCurrency(fullAmount)})
              </button>
              <button
                type="button"
                onClick={() => handlePreset(fullAmount / 2)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  Math.abs(numericAmount - fullAmount / 2) < 0.01
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                50% ({formatCurrency(fullAmount / 2)})
              </button>
            </div>

            {/* Partial Settlement remaining indicator */}
            {remaining > 0.01 && (
              <p className="text-[11px] text-amber-400 font-medium">
                Remaining debt after this payment: {formatCurrency(remaining)}
              </p>
            )}
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Payment Channel
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'revolut', label: 'Revolut' },
                { id: 'paypal', label: 'PayPal' },
                { id: 'monzo', label: 'Monzo' },
                { id: 'bank', label: 'Bank / IBAN' },
                { id: 'cash', label: 'Cash' },
                { id: 'other', label: 'Other' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id as any)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                    method === m.id
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Direct Link / Copy Callout based on selected method */}
          {method === 'revolut' && transaction.revolutLink && (
            <div className="p-3 rounded-2xl bg-blue-950/20 border border-blue-900/40 flex items-center justify-between">
              <span className="text-xs text-blue-300">Open recipient's Revolut:</span>
              <a
                href={transaction.revolutLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-xs font-bold transition-colors"
              >
                <span>Launch Revolut</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {method === 'paypal' && transaction.paypalLink && (
            <div className="p-3 rounded-2xl bg-indigo-950/20 border border-indigo-900/40 flex items-center justify-between">
              <span className="text-xs text-indigo-300">Open PayPal.Me:</span>
              <a
                href={transaction.paypalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-xs font-bold transition-colors"
              >
                <span>Launch PayPal</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {method === 'bank' && transaction.iban && (
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">IBAN:</span>
                <div className="text-xs font-mono text-slate-200 truncate">{transaction.iban}</div>
              </div>
              <button
                type="button"
                onClick={copyIban}
                className="flex items-center space-x-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 text-xs font-medium"
              >
                {copiedIban ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedIban ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Settlement Note (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Paid in cash at train station"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] font-bold text-xs text-white shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? 'Recording Settlement...' : `Confirm Payment of ${formatCurrency(numericAmount)}`}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
