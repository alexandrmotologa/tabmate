import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle,
  Copy,
  ExternalLink,
  History,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { SettlementTransaction, SettlementRecord, Member } from '../types.js';
import { SettleDebtModal } from './SettleDebtModal.js';

interface SettlementViewProps {
  simplifiedDebts: SettlementTransaction[];
  settlements: SettlementRecord[];
  members: Member[];
  activeMemberId: string;
  currency: string;
  onSettleDebt: (
    fromId: string,
    toId: string,
    amount: number,
    paymentMethod?: string,
    notes?: string
  ) => Promise<void>;
  onUndoSettlement: (settlementId: string) => Promise<void>;
  onOpenPaymentSettings: () => void;
  onSendNudge?: (fromUserId: string, toUserId: string, amount: number) => void;
}

export const SettlementView: React.FC<SettlementViewProps> = ({
  simplifiedDebts,
  settlements,
  members,
  activeMemberId,
  currency,
  onSettleDebt,
  onUndoSettlement,
  onOpenPaymentSettings,
  onSendNudge,
}) => {
  const [copiedIban, setCopiedIban] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [selectedTxForModal, setSelectedTxForModal] = useState<SettlementTransaction | null>(null);

  const copyIban = (iban: string) => {
    navigator.clipboard.writeText(iban);
    setCopiedIban(iban);
    setTimeout(() => setCopiedIban(null), 2500);
  };

  const handleOpenSettleModal = (tx: SettlementTransaction) => {
    setSelectedTxForModal(tx);
  };

  const handleUndo = async (id: string) => {
    if (confirm('Undo this settlement payment?')) {
      try {
        setUndoingId(id);
        await onUndoSettlement(id);
      } finally {
        setUndoingId(null);
      }
    }
  };

  const formatCurrency = (val: number) => {
    const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : `${currency} `;
    return `${symbol}${val.toFixed(2)}`;
  };

  return (
    <div className="space-y-4">
      {/* Tab Switcher: Pending vs History */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-2xl bg-slate-900 p-1 border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl transition-all ${
              activeTab === 'pending'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Optimal Debts ({simplifiedDebts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl transition-all ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({settlements.length})</span>
          </button>
        </div>

        <button
          onClick={onOpenPaymentSettings}
          className="text-xs text-blue-400 hover:text-blue-300 font-medium px-2 py-1"
        >
          Payment Setup
        </button>
      </div>

      {/* Pending Settlements */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {simplifiedDebts.length === 0 ? (
            <div className="text-center py-14 px-4 rounded-3xl glass-card border border-slate-800/80">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-100">Zero Pending Debts</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Everyone is completely square! No one owes anyone anything right now.
              </p>
            </div>
          ) : (
            simplifiedDebts.map((tx, idx) => {
              const isDebtor = tx.fromUserId === activeMemberId;
              const isCreditor = tx.toUserId === activeMemberId;
              const fromMember = members.find((m) => m.id === tx.fromUserId);
              const toMember = members.find((m) => m.id === tx.toUserId);

              return (
                <div
                  key={idx}
                  className={`p-5 rounded-3xl glass-panel border transition-all ${
                    isDebtor
                      ? 'border-rose-500/40 bg-rose-950/10'
                      : isCreditor
                      ? 'border-emerald-500/40 bg-emerald-950/10'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Parties & Amount */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {/* From Member */}
                      <div className="text-center">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs text-white shadow mx-auto"
                          style={{ backgroundColor: fromMember?.avatar_color || '#EF4444' }}
                        >
                          {tx.fromName.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-[11px] font-semibold text-slate-200 mt-1 block truncate max-w-[65px]">
                          {isDebtor ? 'You' : tx.fromName}
                        </span>
                      </div>

                      <ArrowRight className="w-5 h-5 text-slate-500 flex-shrink-0" />

                      {/* To Member */}
                      <div className="text-center">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs text-white shadow mx-auto"
                          style={{ backgroundColor: toMember?.avatar_color || '#10B981' }}
                        >
                          {tx.toName.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-[11px] font-semibold text-slate-200 mt-1 block truncate max-w-[65px]">
                          {isCreditor ? 'You' : tx.toName}
                        </span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right">
                      <div className="text-2xl font-extrabold text-slate-100">
                        {formatCurrency(tx.amount)}
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {isDebtor ? 'You owe' : isCreditor ? 'Owes you' : 'Direct debt'}
                      </span>
                    </div>
                  </div>

                  {/* Payment Links & Action Buttons */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {/* Revolut */}
                      {tx.revolutLink && (
                        <a
                          href={tx.revolutLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold transition-colors"
                        >
                          <span>⚡ Pay with Revolut</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {/* PayPal */}
                      {tx.paypalLink && (
                        <a
                          href={tx.paypalLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold transition-colors"
                        >
                          <span>PayPal.me</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {/* Monzo */}
                      {tx.monzoLink && (
                        <a
                          href={tx.monzoLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-coral-600/20 hover:bg-coral-600/30 border border-coral-500/40 text-coral-300 text-xs font-semibold transition-colors"
                        >
                          <span>Monzo</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {/* IBAN Copy */}
                      {tx.iban && (
                        <button
                          onClick={() => copyIban(tx.iban!)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedIban === tx.iban ? 'IBAN Copied!' : 'Copy IBAN'}</span>
                        </button>
                      )}
                    </div>

                    {/* Settle Up Button */}
                    <div className="flex items-center space-x-2 mt-2">
                      <button
                        onClick={() => handleOpenSettleModal(tx)}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-xs font-bold text-white transition-all flex items-center justify-center space-x-2 shadow-md shadow-blue-600/20"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Settle or Partial Pay</span>
                      </button>

                      {onSendNudge && (
                        <button
                          onClick={() => onSendNudge(tx.fromUserId, tx.toUserId, tx.amount)}
                          title="Send reminder to debtor"
                          className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                        >
                          Nudge 👋
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Settle Debt Modal */}
      <SettleDebtModal
        isOpen={Boolean(selectedTxForModal)}
        onClose={() => setSelectedTxForModal(null)}
        transaction={selectedTxForModal}
        fromMember={members.find((m) => m.id === selectedTxForModal?.fromUserId)}
        toMember={members.find((m) => m.id === selectedTxForModal?.toUserId)}
        currency={currency}
        onConfirm={async (fromId, toId, amount, paymentMethod, notes) => {
          await onSettleDebt(fromId, toId, amount, paymentMethod, notes);
        }}
      />

      {/* Settlement History */}
      {activeTab === 'history' && (
        <div className="space-y-2.5">
          {settlements.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-3xl glass-card border border-slate-800/80">
              <History className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-slate-300">No settlement history yet</h4>
              <p className="text-xs text-slate-500 mt-1">
                Completed debt settlements will appear here.
              </p>
            </div>
          ) : (
            settlements.map((st) => (
              <div
                key={st.id}
                className="flex items-center justify-between p-3.5 rounded-2xl glass-card border border-slate-800/80"
              >
                <div className="min-w-0">
                  <div className="flex items-center space-x-2 text-xs text-slate-200 font-semibold">
                    <span className="text-slate-300">{st.from_name}</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className="text-slate-300">{st.to_name}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {st.settled_at} {st.notes ? `• ${st.notes}` : ''}
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-sm font-bold text-emerald-400">
                    +{formatCurrency(st.amount)}
                  </span>
                  <button
                    onClick={() => handleUndo(st.id)}
                    disabled={undoingId === st.id}
                    title="Undo settlement"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
