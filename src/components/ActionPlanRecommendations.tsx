import React from 'react';
import { 
  Zap, 
  RefreshCw,
  Mail,
  ShieldCheck,
  Activity,
  AlertOctagon,
  ArrowRight,
  Boxes
} from 'lucide-react';
import { WorkOrderItem, AIAnalysisResponse, ExpediteRecommendation, ComponentRollup } from '../types';
import { aggregateByComponent, aggregateByAssembly } from '../utils/parser';

interface ActionPlanRecommendationsProps {
  items: WorkOrderItem[];
  aiAnalysis: AIAnalysisResponse | null;
  isAILoading: boolean;
  onTriggerAI: () => void;
  onOpenExpediteModalForRollup: (rec: ExpediteRecommendation) => void;
}

export const ActionPlanRecommendations: React.FC<ActionPlanRecommendationsProps> = ({
  items,
  aiAnalysis,
  isAILoading,
  onTriggerAI,
  onOpenExpediteModalForRollup,
}) => {
  // Aggregate critical parts across work orders
  const componentBottlenecks = aggregateByComponent(items);
  const assemblyRisks = aggregateByAssembly(items);

  // Compute recommendations from aggregated components
  const computedRecommendations: ExpediteRecommendation[] = componentBottlenecks.slice(0, 5).map((c: ComponentRollup, idx: number) => {
    const hasNoSupplyDate = c.supplyDates.length === 0 || 
      c.supplyDates.includes('Unconfirmed') || 
      c.supplyDates.includes('NO SUPPLY DATE') || 
      c.supplyDates.some(d => !d || d === '- None -' || d.trim() === '');
      
    const isCritical = c.maxDelayDays > 0 || hasNoSupplyDate;
    const supplyDateStr = hasNoSupplyDate ? 'NO SUPPLY DATE (No PO)' : (c.supplyDates.length > 0 ? c.supplyDates.join(', ') : 'Unconfirmed');
    
    let actionText = '';
    if (hasNoSupplyDate) {
      actionText = `NO SUPPLY DATE (No PO on record). Action required: Create a Purchase Order (PO) immediately or verify if this part is obsolete/superceded before production start ${c.earliestProdStartDate}.`;
    } else if (c.maxDelayDays > 0) {
      actionText = `Expedite ${c.totalQtyVar.toLocaleString()} units immediately across ${c.affectedWOs.length} WOs (${c.affectedWOs.slice(0, 3).join(', ')}). Target Production: ${c.earliestProdStartDate} (${c.maxDelayDays}d late).`;
    } else {
      actionText = `Verify PO delivery schedule (${supplyDateStr}) to protect assembly buffer before ${c.earliestProdStartDate}.`;
    }

    return {
      id: `rec-${c.itemCode}-${idx}`,
      itemCode: c.itemCode,
      description: c.description,
      totalShortage: c.totalQtyVar,
      criticality: isCritical ? (idx === 0 ? 'URGENT' : 'HIGH') : 'MEDIUM',
      affectedWOCount: c.affectedWOs.length,
      recommendedArrivalDate: c.earliestProdStartDate,
      currentArrivalDate: supplyDateStr,
      impactedAssemblies: c.affectedAssemblies,
      suggestedAction: actionText,
    };
  });

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left 2 Cols: Action Plan & Expedite Priorities */}
      <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                Action Plan & Expedite Priorities
              </h3>
              <p className="text-[11px] text-slate-500">
                Aggregated component shortages across multiple Work Orders
              </p>
            </div>
          </div>

          <button
            onClick={onTriggerAI}
            disabled={isAILoading}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAILoading ? 'animate-spin' : ''}`} />
            {isAILoading ? 'Refreshing AI...' : 'Refresh AI Plan'}
          </button>
        </div>

        {/* Priority Action List */}
        <div className="space-y-3">
          {computedRecommendations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl">
              <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-bold text-slate-700 text-xs">No active material bottlenecks found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">All production lines are fully committed or on schedule.</p>
            </div>
          ) : (
            computedRecommendations.map((rec) => {
              const isUrgent = rec.criticality === 'URGENT' || rec.criticality === 'HIGH';
              const cardClass = isUrgent 
                ? 'bg-rose-50 border-l-4 border-rose-500 text-rose-900' 
                : 'bg-amber-50 border-l-4 border-amber-500 text-amber-900';
              const badgeClass = isUrgent 
                ? 'bg-rose-100 text-rose-700' 
                : 'bg-amber-100 text-amber-800';

              return (
                <div 
                  key={rec.id}
                  className={`p-4 rounded-r-xl transition flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs ${cardClass}`}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${badgeClass}`}>
                        {rec.criticality === 'URGENT' ? '🚨 Immediate Escalation' : '⚠️ Expedite Request'}
                      </span>
                      <strong className="text-xs font-mono font-bold text-slate-900">
                        {rec.itemCode}
                      </strong>
                      <span className="text-[11px] text-slate-600 truncate max-w-xs font-normal">
                        ({rec.description})
                      </span>
                    </div>

                    <p className="text-xs leading-relaxed text-slate-800">
                      {rec.suggestedAction}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                      <span>
                        Total Gap: <strong className="font-mono text-rose-600 font-bold">-{rec.totalShortage.toLocaleString()} units</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Impacts: <strong>{rec.affectedWOCount} Work Orders</strong> ({rec.impactedAssemblies.slice(0, 2).join(', ')})
                      </span>
                      <span>•</span>
                      <span>
                        Target: <strong className="text-slate-800 font-medium">{rec.recommendedArrivalDate}</strong> (ETA: {rec.currentArrivalDate})
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenExpediteModalForRollup(rec)}
                    className="self-start md:self-center px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs rounded-lg shadow-xs transition flex items-center gap-1.5 shrink-0"
                  >
                    <Mail className="w-3.5 h-3.5 text-indigo-600" />
                    Draft Email
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Col: Production Readiness & Strategic Summary */}
      <div className="bg-slate-900 rounded-xl p-6 text-white shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold opacity-90 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Production Readiness Summary
            </h3>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
              Live Assessment
            </span>
          </div>

          <div className="space-y-4 text-xs">
            {/* Metric 1 */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">Committed Material Coverage</span>
                <span className="font-bold text-emerald-400">
                  {Math.round(((items.length - componentBottlenecks.length) / Math.max(1, items.length)) * 100)}%
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.round(((items.length - componentBottlenecks.length) / Math.max(1, items.length)) * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Metric 2 */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">Schedule Lead Time Accuracy</span>
                <span className="font-bold text-rose-400">
                  {componentBottlenecks.filter(c => c.maxDelayDays > 0).length > 0 ? 'Critical Lag' : 'Synchronized'}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-rose-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(20, componentBottlenecks.length * 25))}%` }}
                ></div>
              </div>
            </div>

            {/* Top Assemblies Blocked */}
            <div className="pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Top Stalled Assembly Lines
              </span>
              <div className="space-y-1.5">
                {assemblyRisks.slice(0, 3).map((asm, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-800/80 border border-slate-700/50">
                    <span className="font-mono font-semibold text-slate-200">{asm.assemblyCode}</span>
                    <span className="text-[11px] text-rose-400 font-bold">
                      {asm.totalShortageItems} parts ({asm.totalQtyVar} units)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AI Strategy Quote */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <p className="text-[11px] text-slate-300 italic leading-relaxed">
            {aiAnalysis?.executiveBrief ? (
              `"${aiAnalysis.executiveBrief}"`
            ) : (
              '"Risk assessment suggests expediting security screws (B137/B092) and roof clamps (C645) via air-freight immediately to prevent halting PZQ3089050 and ISUZO02 line starts."'
            )}
          </p>
        </div>
      </div>
    </section>
  );
};
