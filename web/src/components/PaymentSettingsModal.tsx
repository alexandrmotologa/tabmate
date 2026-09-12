import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { Member } from '../types.js';

interface PaymentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | undefined;
  onSave: (handles: {
    revolutHandle?: string;
    paypalHandle?: string;
    monzoHandle?: string;
    iban?: string;
  }) => Promise<void>;
}

export const PaymentSettingsModal: React.FC<PaymentSettingsModalProps> = ({
  isOpen,
  onClose,
  member,
  onSave,
}) => {
  const [revolut, setRevolut] = useState(member?.revolut_handle || '');
  const [paypal, setPaypal] = useState(member?.paypal_handle || '');
  const [monzo, setMonzo] = useState(member?.monzo_handle || '');
  const [iban, setIban] = useState(member?.iban || '');
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await onSave({
        revolutHandle: revolut.trim().replace(/^@/, '') || undefined,
        paypalHandle: paypal.trim().replace(/^@/, '') || undefined,
        monzoHandle: monzo.trim().replace(/^@/, '') || undefined,
        iban: iban.trim().toUpperCase() || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in duration-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-100">Payment Handles</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Configuring receiving accounts for {member.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400">Revolut Username</label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-xs text-slate-500">@</span>
              <input
                type="text"
                placeholder="revolut_tag"
                value={revolut}
                onChange={(e) => setRevolut(e.target.value)}
                className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-[11px] text-slate-500">Enables 1-tap "Pay with Revolut" links</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400">PayPal.Me Username</label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-xs text-slate-500">@</span>
              <input
                type="text"
                placeholder="paypal_username"
                value={paypal}
                onChange={(e) => setPaypal(e.target.value)}
                className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400">Monzo.me Username</label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-xs text-slate-500">@</span>
              <input
                type="text"
                placeholder="monzo_tag"
                value={monzo}
                onChange={(e) => setMonzo(e.target.value)}
                className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400">Bank IBAN</label>
            <input
              type="text"
              placeholder="RO49AAAA1B31007593840000"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500 uppercase"
            />
            <p className="text-[11px] text-slate-500">Friends can copy this IBAN in one tap</p>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] font-semibold text-xs text-white transition-all flex items-center justify-center space-x-1.5 shadow-lg shadow-blue-600/25"
          >
            {success ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Saved Successfully!</span>
              </>
            ) : isSaving ? (
              <span>Saving...</span>
            ) : (
              <span>Save Payment Details</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
