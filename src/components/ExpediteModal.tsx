import React, { useState, useEffect } from 'react';
import { X, Mail, Sparkles, Copy, Check, Send, AlertOctagon, RefreshCw } from 'lucide-react';
import { WorkOrderItem, ExpediteRecommendation } from '../types';

interface ExpediteModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetItem: WorkOrderItem | null;
  targetRec: ExpediteRecommendation | null;
}

export const ExpediteModal: React.FC<ExpediteModalProps> = ({
  isOpen,
  onClose,
  targetItem,
  targetRec,
}) => {
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Extract common details
  const itemCode = targetItem?.item || targetRec?.itemCode || '';
  const itemDesc = targetItem?.itemDescription || targetRec?.description || '';
  const totalShortage = targetItem?.qtyVar || targetRec?.totalShortage || 0;
  const affectedWOs = targetItem ? [targetItem.woNumber] : (targetRec?.impactedAssemblies || ['Active Work Orders']);
  const currentArrival = targetItem?.maxSupplyReceiptDate || targetRec?.currentArrivalDate || 'Unconfirmed';
  const targetArrival = targetItem?.prodStartDate || targetRec?.recommendedArrivalDate || 'Immediate';
  const delayDays = targetItem?.delayDays || 0;

  useEffect(() => {
    if (!isOpen || !itemCode) return;

    // Generate initial draft
    generateDraft();
  }, [isOpen, itemCode]);

  const generateDraft = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-expedite-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemCode,
          itemDescription: itemDesc,
          totalShortage,
          affectedWOs,
          currentArrivalDate: currentArrival,
          targetArrivalDate: targetArrival,
          delayDays
        }),
      });

      const data = await response.json();
      if (data.subject && data.body) {
        setEmailSubject(data.subject);
        setEmailBody(data.body);
      }
    } catch (err) {
      console.error('Error generating email draft:', err);
      // Fallback
      setEmailSubject(`URGENT EXPEDITE: Part ${itemCode} - Material Shortage for Production Start ${targetArrival}`);
      setEmailBody(`Dear Supplier Team,

We urgently require an update and expedited delivery for Part Number ${itemCode} (${itemDesc}).

Shortage Quantity: ${totalShortage} units
Current ETA: ${currentArrival}
Required Production Start: ${targetArrival}

Please confirm if an emergency partial shipment or air freight can be scheduled immediately.

Best regards,
Materials Planning Team`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${emailSubject}\n\n${emailBody}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Vendor Expedite Escalation Generator
              </h3>
              <p className="text-xs text-slate-500">
                Auto-generated supplier email for Part <strong className="font-mono text-slate-800">{itemCode}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortage Summary Banner */}
        <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-100 flex items-center justify-between text-xs text-rose-900">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Shortage: <strong className="font-mono font-bold text-rose-700">{totalShortage.toLocaleString()} units</strong> • Target Prod: <strong>{targetArrival}</strong> • Current ETA: <strong>{currentArrival}</strong>
            </span>
          </div>
          <button
            onClick={generateDraft}
            disabled={isGenerating}
            className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Subject Line:
            </label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Message Body:
            </label>
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={12}
              className="w-full p-3 font-sans text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="text-[11px] text-slate-400">
            Click copy to paste into Outlook, Gmail, or ERP vendor messaging.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium transition text-xs"
            >
              Close
            </button>
            <button
              onClick={handleCopy}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs transition flex items-center gap-1.5 text-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied to Clipboard!' : 'Copy Email Draft'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
