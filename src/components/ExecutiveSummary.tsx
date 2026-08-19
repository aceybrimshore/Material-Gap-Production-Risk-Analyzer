import React from 'react';
import { 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Layers, 
  ShieldAlert,
  Ban,
  Activity,
  FileQuestion,
  HelpCircle
} from 'lucide-react';
import { SummaryMetrics } from '../types';

interface ExecutiveSummaryProps {
  metrics: SummaryMetrics;
  onFilterRisk: (risk: string) => void;
  activeRiskFilter: string;
  hideNonMaterial: boolean;
  onToggleHideNonMaterial: () => void;
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({
  metrics,
  onFilterRisk,
  activeRiskFilter,
}) => {
  const commitRate = metrics.totalQtyVariance > 0 || metrics.onTrackItemsCount > 0
    ? Math.round(((metrics.activeMaterialItems - metrics.criticalItemsCount) / Math.max(1, metrics.activeMaterialItems)) * 100)
    : 100;

  return (
    <div className="space-y-4">
      {/* Top Banner Alert if Critical Delays or Blank Supply Dates Exist */}
      {metrics.criticalItemsCount > 0 && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-900 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-1 rounded-md bg-rose-100 text-rose-600 shrink-0 mt-0.5">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest bg-rose-100 px-2 py-0.5 rounded">
                  Critical Schedule Alert
                </span>
                <h3 className="font-bold text-sm text-rose-950">
                  {metrics.highRiskWOsCount} Work Orders Blocked by Late Supply or Missing POs
                </h3>
              </div>
              <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                Found <strong>{metrics.criticalItemsCount} critical material shortages</strong> where supply ETA exceeds production start date (maximum delay: <strong>+{metrics.maxDelayDays} days</strong>)
                {metrics.missingSupplyDateCount > 0 && (
                  <span> or <strong>{metrics.missingSupplyDateCount} items have NO SUPPLY DATE</strong> (Action Required: Create PO or check if part is obsolete).</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {metrics.missingSupplyDateCount > 0 && (
              <button
                onClick={() => onFilterRisk('NO_SUPPLY_DATE')}
                className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-bold transition border border-rose-300 flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5 text-rose-600" />
                {metrics.missingSupplyDateCount} No Supply Date
              </button>
            )}
            <button
              id="btn-filter-critical-banner"
              onClick={() => onFilterRisk('CRITICAL')}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
            >
              Filter All {metrics.criticalItemsCount} Critical
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Card 1: Total WOs */}
        <div 
          onClick={() => onFilterRisk('ALL')}
          className={`bg-white p-4 rounded-xl border shadow-xs transition cursor-pointer hover:border-slate-300 ${
            activeRiskFilter === 'ALL' ? 'ring-2 ring-indigo-600 border-transparent' : 'border-slate-200'
          }`}
        >
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center justify-between">
            <span>Total WOs</span>
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{metrics.totalWOs}</span>
            <span className="text-[11px] font-medium text-slate-400">Processed</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">
            {metrics.activeMaterialItems} active items
          </div>
        </div>

        {/* Card 2: Shortage Items */}
        <div 
          onClick={() => onFilterRisk('CRITICAL')}
          className={`bg-white p-4 rounded-xl border shadow-xs transition cursor-pointer hover:border-rose-300 ${
            activeRiskFilter === 'CRITICAL' ? 'ring-2 ring-rose-500 border-transparent bg-rose-50/20' : 'border-slate-200'
          }`}
        >
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center justify-between">
            <span>Shortage Items</span>
            <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-600">{metrics.criticalItemsCount + metrics.moderateItemsCount}</span>
            <span className="text-[11px] font-medium text-rose-400">Qty. Var &gt; 0</span>
          </div>
          <div className="text-[11px] text-rose-600 font-semibold mt-1">
            {metrics.totalQtyVariance.toLocaleString()} total units gap
          </div>
        </div>

        {/* Card 3: High-Risk WOs */}
        <div 
          onClick={() => onFilterRisk('CRITICAL')}
          className={`bg-white p-4 rounded-xl border shadow-xs transition cursor-pointer hover:border-orange-300 ${
            activeRiskFilter === 'CRITICAL' ? 'ring-2 ring-orange-500 border-transparent bg-orange-50/20' : 'border-slate-200'
          }`}
        >
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center justify-between">
            <span>High-Risk WOs</span>
            <ShieldAlert className="w-3.5 h-3.5 text-orange-500" />
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-orange-600">{metrics.highRiskWOsCount}</span>
            <span className="text-[11px] font-medium text-orange-400">Late / No PO</span>
          </div>
          <div className="text-[11px] text-orange-600 font-semibold mt-1">
            {metrics.totalWOs > 0 ? Math.round((metrics.highRiskWOsCount / metrics.totalWOs) * 100) : 0}% of order volume
          </div>
        </div>

        {/* Card 4: No Supply Date / Create PO */}
        <div 
          onClick={() => onFilterRisk('NO_SUPPLY_DATE')}
          className={`bg-white p-4 rounded-xl border shadow-xs transition cursor-pointer hover:border-rose-400 ${
            activeRiskFilter === 'NO_SUPPLY_DATE' ? 'ring-2 ring-rose-600 border-transparent bg-rose-50/30' : 'border-slate-200'
          }`}
        >
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center justify-between">
            <span>No Supply Date</span>
            <HelpCircle className="w-3.5 h-3.5 text-rose-600" />
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-600">{metrics.missingSupplyDateCount}</span>
            <span className="text-[10px] font-bold text-rose-500 bg-rose-100 px-1.5 py-0.2 rounded">PO Needed</span>
          </div>
          <div className="text-[11px] text-rose-700 font-semibold mt-1">
            Create PO or check obsolete
          </div>
        </div>

        {/* Card 5: Max Delay */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center justify-between">
            <span>Max Delay</span>
            <Clock className="w-3.5 h-3.5 text-rose-500" />
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-600">
              {metrics.maxDelayDays > 0 ? `+${metrics.maxDelayDays}` : '0'}
            </span>
            <span className="text-[11px] font-medium text-slate-400">Days Late</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Avg: +{metrics.avgDelayDays}d on late parts
          </div>
        </div>

        {/* Card 6: Inventory Health */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center justify-between">
            <span>Inventory Health</span>
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600">{commitRate}%</span>
            <span className="text-[11px] font-medium text-emerald-500">Readiness</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{metrics.excludedItems} Non-Mat. filtered</span>
          </div>
        </div>
      </section>
    </div>
  );
};
