import { useState } from 'react';
import {
  Receipt,
  Sparkles,
  Download,
  RotateCw,
  Settings,
  Plus,
  Compass,
} from 'lucide-react';
import { useGroupData } from './hooks/useGroupData.js';
import { useTelegram } from './hooks/useTelegram.js';
import { BalanceCard } from './components/BalanceCard.js';
import { ExpenseList } from './components/ExpenseList.js';
import { SettlementView } from './components/SettlementView.js';
import { AddExpenseModal } from './components/AddExpenseModal.js';
import { PaymentSettingsModal } from './components/PaymentSettingsModal.js';
import { DevBanner } from './components/DevBanner.js';

export function App() {
  const {
    groupId,
    data,
    loading,
    error,
    activeMemberId,
    switchActiveMember,
    addExpense,
    deleteExpense,
    settleDebt,
    deleteSettlement,
    addMember,
    updatePaymentHandles,
    refresh,
  } = useGroupData('demo');

  const { haptic, isTelegram } = useTelegram();

  const [activeTab, setActiveTab] = useState<'expenses' | 'settle'>('expenses');
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isPaymentSettingsOpen, setIsPaymentSettingsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    haptic.impact('light');
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleOpenAddExpense = () => {
    haptic.impact('medium');
    setIsAddExpenseOpen(true);
  };

  const handleOpenSettlement = () => {
    haptic.selection();
    setActiveTab('settle');
  };

  const handleSettleDebtWithHaptic = async (
    fromId: string,
    toId: string,
    amount: number,
    notes?: string
  ) => {
    haptic.impact('heavy');
    await settleDebt(fromId, toId, amount, notes);
    haptic.notification('success');
  };

  const handleUndoSettlementWithHaptic = async (settlementId: string) => {
    haptic.impact('medium');
    await deleteSettlement(settlementId);
  };

  const handleDownloadCsv = () => {
    haptic.impact('light');
    window.location.href = `/api/groups/${groupId}/export.csv`;
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center animate-spin mb-4">
          <RotateCw className="w-6 h-6 text-blue-400" />
        </div>
        <h2 className="text-base font-bold text-slate-200">Loading TabMate...</h2>
        <p className="text-xs text-slate-500 mt-1">Retrieving shared expenses and settlement graph</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mb-4">
          <Receipt className="w-6 h-6 text-rose-400" />
        </div>
        <h2 className="text-base font-bold text-slate-200">Could Not Load Group</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto mb-4">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 rounded-xl bg-blue-600 font-semibold text-xs text-white"
        >
          Try Again
        </button>
      </div>
    );
  }

  const activeMember = data.members.find((m) => m.id === activeMemberId);

  return (
    <div className="min-h-screen pb-20 bg-[#090d16] text-slate-100 font-sans">
      {/* Dev Perspective Banner (useful in desktop browser) */}
      <DevBanner
        members={data.members}
        activeMemberId={activeMemberId}
        onSwitchMember={switchActiveMember}
        onAddMember={async (name) => {
          await addMember({ name });
        }}
      />

      {/* Main Container */}
      <main className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* Top App Bar */}
        <header className="flex items-center justify-between py-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-100 tracking-tight leading-tight">
                {data.group.title}
              </h1>
              <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                <span>TabMate</span>
                <span>•</span>
                <span className="text-blue-400 font-medium">
                  {isTelegram ? 'Telegram Mini App' : 'Web Preview'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={handleRefresh}
              title="Refresh balances"
              className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>

            <button
              onClick={handleDownloadCsv}
              title="Export CSV"
              className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPaymentSettingsOpen(true)}
              title="Payment Handles"
              className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Primary Standing & Quick Actions Card */}
        <BalanceCard
          data={data}
          activeMemberId={activeMemberId}
          onAddExpense={handleOpenAddExpense}
          onOpenSettlement={handleOpenSettlement}
        />

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 rounded-2xl bg-slate-900/90 p-1 border border-slate-800 text-xs font-bold">
          <button
            onClick={() => {
              haptic.selection();
              setActiveTab('expenses');
            }}
            className={`flex items-center justify-center space-x-2 py-2.5 rounded-xl transition-all ${
              activeTab === 'expenses'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Expenses ({data.expenses.length})</span>
          </button>

          <button
            onClick={() => {
              haptic.selection();
              setActiveTab('settle');
            }}
            className={`flex items-center justify-center space-x-2 py-2.5 rounded-xl transition-all ${
              activeTab === 'settle'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Settlements ({data.simplifiedDebts.length})</span>
          </button>
        </div>

        {/* Tab Viewport */}
        {activeTab === 'expenses' ? (
          <ExpenseList
            expenses={data.expenses}
            activeMemberId={activeMemberId}
            currency={data.group.currency}
            onDeleteExpense={deleteExpense}
          />
        ) : (
          <SettlementView
            simplifiedDebts={data.simplifiedDebts}
            settlements={data.settlements}
            members={data.members}
            activeMemberId={activeMemberId}
            currency={data.group.currency}
            onSettleDebt={handleSettleDebtWithHaptic}
            onUndoSettlement={handleUndoSettlementWithHaptic}
            onOpenPaymentSettings={() => setIsPaymentSettingsOpen(true)}
          />
        )}
      </main>

      {/* Floating Add Expense Button */}
      <button
        onClick={handleOpenAddExpense}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white shadow-xl shadow-blue-600/40 flex items-center justify-center z-40 transition-transform"
        title="Add Expense"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        members={data.members}
        activeMemberId={activeMemberId}
        defaultCurrency={data.group.currency}
        onSave={async (expense) => {
          await addExpense(expense);
        }}
      />

      {/* Payment Settings Modal */}
      <PaymentSettingsModal
        isOpen={isPaymentSettingsOpen}
        onClose={() => setIsPaymentSettingsOpen(false)}
        member={activeMember}
        onSave={async (handles) => {
          if (activeMemberId) {
            await updatePaymentHandles(activeMemberId, handles);
          }
        }}
      />
    </div>
  );
}
