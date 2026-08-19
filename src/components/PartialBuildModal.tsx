import React, { useState, useMemo } from 'react';
import { WorkOrderGroup } from '../types';
import { 
  Scissors, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Copy, 
  Check, 
  ArrowRight, 
  PackageCheck, 
  Layers, 
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { copyToClipboard } from '../utils/excelExport';

interface PartialBuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrderGroup | null;
}

export const PartialBuildModal: React.FC<PartialBuildModalProps> = ({
  isOpen,
  onClose,
  workOrder,
}) => {
  const [copied, setCopied] = useState(false);
  const [customBuildQty, setCustomBuildQty] = useState<number | null>(null);

  if (!isOpen || !workOrder) return null;

  const pb = workOrder.partialBuild;
  const originalQty = pb?.originalTargetQty || Math.max(...workOrder.allMaterialItems.map(i => i.qtyNeeded), 100);
  const suggestedQty = pb?.maxBuildableQty || 0;
  const isFeasible = pb?.isFeasible ?? false;

  // Active simulated build quantity
  const activeQty = customBuildQty !== null ? customBuildQty : suggestedQty;
  const splitQty = Math.max(0, originalQty - activeQty);
  const percentage = originalQty > 0 ? Math.round((activeQty / originalQty) * 100) : 0;

  // Evaluate component coverage for activeQty
  const componentAnalysis = workOrder.allMaterialItems.map(item => {
    // Exact ratio of this item per assembly unit
    const unitMultiplier = (item.memberQuantity && item.memberQuantity > 0)
      ? item.memberQuantity
      : (originalQty > 0 ? item.qtyNeeded / originalQty : 1);

    const neededForSimulated = Math.ceil(unitMultiplier * activeQty);
    const hasEnough = item.committed >= neededForSimulated;
    const maxUnitsFromThisItem = unitMultiplier > 0 ? Math.floor(item.committed / unitMultiplier) : item.committed;

    return {
      itemCode: item.item,
      description: item.itemDescription,
      unitMultiplier,
      originalNeeded: item.qtyNeeded,
      committed: item.committed,
      neededForSimulated,
      hasEnough,
      maxUnitsFromThisItem,
      isBottleneck: maxUnitsFromThisItem === suggestedQty,
      supplyDate: item.maxSupplyReceiptDate || 'Unconfirmed'
    };
  });

  const allComponentsCoveredForActive = componentAnalysis.every(c => c.hasEnough);

  const handleCopyInstruction = async () => {
    const text = `====================================================
ERP WORK ORDER REDUCTION & SPLIT INSTRUCTION
====================================================
Work Order Number:  ${workOrder.woNumber}
Finished Assembly:  ${workOrder.assemblyItem}
Customer:           ${workOrder.customer || 'Standard Production'}
Target Start Date:  ${workOrder.prodStartDate || 'Immediate'}

ACTION REQUIRED:
----------------------------------------------------
1. REDUCE PRIMARY WORK ORDER (${workOrder.woNumber}):
   - Reduce Batch Quantity: From ${originalQty} units ➔ ${activeQty} units (${percentage}% build).
   - Status: Release to Shop Floor immediately. 100% of required materials are in stock & committed.

2. CREATE SECONDARY SPLIT / BACKORDER WO:
   - Split Quantity: ${splitQty} units (${100 - percentage}%).
   - Delay / Holding Reason: Awaiting component(s):
${pb?.limitingParts.map(p => `     * ${p.itemCode} (${p.itemDescription}) - Short by ${p.shortage} units (Supply ETA: ${p.maxSupplyReceiptDate})`).join('\n')}

RATIONALE:
Reducing the work order allows the factory to complete ${activeQty} finished units to satisfy customer orders today without halting production line.
====================================================`;

    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-linear-to-r from-amber-500 to-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-tight">Work Order Reduction & Partial Build Advisor</h3>
                <span className="px-2 py-0.5 rounded-full bg-white/25 text-[11px] font-bold">
                  {workOrder.woNumber}
                </span>
              </div>
              <p className="text-amber-100 text-xs mt-0.5">
                Assembly: <strong className="text-white">{workOrder.assemblyItem}</strong> • Target Start: <strong className="text-white">{workOrder.prodStartDate}</strong>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Executive Feasibility Banner */}
          {isFeasible ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="font-bold text-sm text-emerald-900 flex items-center gap-1.5">
                      <span>Feasible Partial Build Opportunity Identified</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800 font-bold">
                        {percentage}% Immediate Build
                      </span>
                    </h4>
                  </div>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    By reducing this work order from <strong>{originalQty}</strong> units down to <strong>{suggestedQty}</strong> units, <strong>100% of all required components</strong> are already committed and on hand in stock. You can release and build <strong>{suggestedQty} units today</strong> to satisfy customers while splitting the remaining {splitQty} units.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-950">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-rose-900">
                    Partial Build Not Feasible
                  </h4>
                  <p className="text-xs text-rose-800 mt-1">
                    At least one critical component on this work order currently has 0 committed units in stock. A work order reduction cannot unlock production until initial supplier stock arrives.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Before vs After Comparison Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Original Plan */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Original Order Plan
              </div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-2xl font-mono font-extrabold text-slate-800">
                  {originalQty} <span className="text-xs font-normal text-slate-500">units</span>
                </span>
                <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded">
                  Blocked ({workOrder.totalQtyVar} short)
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Production is completely stalled waiting for missing component delivery.
              </p>
            </div>

            {/* Suggested Reduced Plan */}
            <div className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl">
                RECOMMENDED
              </div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 mb-2">
                Suggested Reduced Order (Build 1)
              </div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-2xl font-mono font-extrabold text-emerald-700">
                  {activeQty} <span className="text-xs font-normal text-emerald-600">units ({percentage}%)</span>
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  100% Ready Now
                </span>
              </div>
              <p className="text-[11px] text-emerald-800">
                Split {splitQty} units into secondary order awaiting outstanding PO delivery.
              </p>
            </div>
          </div>

          {/* Interactive Reduction Simulator */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Simulate Custom Work Order Reduction Quantity</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Adjust the build target to verify component availability in real-time.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCustomBuildQty(suggestedQty)}
                  className="text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-md border border-amber-200 transition"
                >
                  Reset to Optimal ({suggestedQty})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <input
                type="range"
                min="1"
                max={originalQty}
                value={activeQty}
                onChange={(e) => setCustomBuildQty(parseInt(e.target.value, 10))}
                className="flex-1 accent-emerald-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
              />
              <div className="flex items-center gap-1 font-mono">
                <input
                  type="number"
                  min="1"
                  max={originalQty}
                  value={activeQty}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1 && val <= originalQty) {
                      setCustomBuildQty(val);
                    }
                  }}
                  className="w-20 px-2 py-1 text-center font-bold text-slate-900 border border-slate-300 rounded-lg text-sm"
                />
                <span className="text-xs text-slate-500">/ {originalQty}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-500">
                Simulated Build: <strong className="text-slate-800">{activeQty} units</strong>
              </span>
              <span className="text-slate-500">
                Split / Backorder: <strong className="text-amber-700">{splitQty} units</strong>
              </span>
              <span className={`font-bold ${allComponentsCoveredForActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {allComponentsCoveredForActive ? '✅ All Components 100% Available' : '❌ Insufficient Stock for this Target'}
              </span>
            </div>
          </div>

          {/* Component Coverage Verification Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>Component Stock Coverage Analysis</span>
              </h4>
              <span className="text-[11px] text-slate-500">
                Targeting: <strong>{activeQty} units</strong>
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                    <th className="px-3 py-2.5">Component</th>
                    <th className="px-3 py-2.5">Description</th>
                    <th className="px-3 py-2.5 text-center">Qty / Unit</th>
                    <th className="px-3 py-2.5 text-right">Committed Stock</th>
                    <th className="px-3 py-2.5 text-right">Needed for {activeQty}</th>
                    <th className="px-3 py-2.5 text-center">Coverage Status</th>
                    <th className="px-3 py-2.5 text-right">Max Buildable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {componentAnalysis.map((c) => (
                    <tr 
                      key={c.itemCode}
                      className={c.isBottleneck ? 'bg-amber-50/50' : 'hover:bg-slate-50'}
                    >
                      <td className="px-3 py-2 font-mono font-bold text-slate-900">
                        {c.itemCode}
                        {c.isBottleneck && (
                          <span className="ml-1.5 text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                            Bottleneck
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600 max-w-[180px] truncate" title={c.description}>
                        {c.description}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-slate-500 font-semibold">
                        {c.unitMultiplier}x
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">
                        {c.committed.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-slate-700">
                        {c.neededForSimulated.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {c.hasEnough ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Covered
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Short
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-800">
                        {c.maxUnitsFromThisItem.toLocaleString()} units
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Copying instruction formats a standard ERP WO split memo.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition"
            >
              Close
            </button>
            <button
              onClick={handleCopyInstruction}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5 text-white" />}
              {copied ? 'Copied to Clipboard!' : 'Copy ERP WO Split Instruction'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
