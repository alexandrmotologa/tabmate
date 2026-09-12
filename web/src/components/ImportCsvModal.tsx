import React, { useState } from 'react';
import { X, UploadCloud, FileText, CheckCircle2 } from 'lucide-react';

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  onSuccess: () => Promise<void>;
}

export const ImportCsvModal: React.FC<ImportCsvModalProps> = ({
  isOpen,
  onClose,
  groupId,
  onSuccess,
}) => {
  const [csvText, setCsvText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvText((event.target?.result as string) || '');
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    if (!csvText.trim()) {
      setErrorMsg('Please paste CSV content or choose a file.');
      return;
    }

    try {
      setIsImporting(true);
      setErrorMsg(null);
      const res = await fetch(`/api/groups/${groupId}/import-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: csvText }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to import CSV');
      }

      setResultMsg(`Successfully imported ${data.expensesImported} expenses (${data.newMembersAdded} new members added).`);
      await onSuccess();
      setTimeout(() => {
        setResultMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error processing CSV');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in duration-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <UploadCloud className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-slate-100">Import Splitwise / CSV</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Easily migrate trips from Splitwise, Tricount, or a spreadsheet. Any members in the file who aren't in this group will be added automatically.
        </p>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {resultMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{resultMsg}</span>
          </div>
        )}

        {/* File upload trigger */}
        <label className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/40 cursor-pointer transition-colors">
          <FileText className="w-8 h-8 text-slate-500 mb-1" />
          <span className="text-xs font-semibold text-slate-300">Click to upload a .csv file</span>
          <span className="text-[11px] text-slate-500">or paste text below</span>
          <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
        </label>

        {/* Raw CSV Textarea */}
        <textarea
          rows={5}
          placeholder="Date,Description,Category,Cost,Currency,Payer..."
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          className="w-full font-mono text-xs bg-slate-950/60 border border-slate-800 rounded-2xl p-3 text-slate-200 focus:outline-none focus:border-blue-500"
        />

        <button
          onClick={handleImport}
          disabled={isImporting || !csvText.trim()}
          className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] font-bold text-xs text-white shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
        >
          {isImporting ? 'Importing Expenses...' : 'Import Into TabMate'}
        </button>
      </div>
    </div>
  );
};
