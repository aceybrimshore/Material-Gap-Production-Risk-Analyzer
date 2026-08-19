import React, { useState, useMemo } from 'react';
import { 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronRight,
  Mail,
  Ban,
  ArrowUpDown,
  Layers,
  Briefcase,
  Box,
  ListFilter,
  Maximize2,
  Minimize2,
  Clock,
  ArrowRight,
  CheckCircle,
  HelpCircle,
  TrendingDown,
  FileQuestion,
  Wrench,
  Copy,
  FileSpreadsheet,
  Check,
  Scissors,
  Sparkles
} from 'lucide-react';
import { WorkOrderItem, WorkOrderGroup, AssemblyGroup, RiskLevel } from '../types';
import { groupItemsByWorkOrder, groupItemsByAssembly } from '../utils/parser';
import { 
  copyToClipboard, 
  formatWorkOrderForExcel, 
  formatAssemblyForExcel, 
  formatAllWorkOrdersForExcel, 
  formatAllItemsForExcel 
} from '../utils/excelExport';
import { PartialBuildModal } from './PartialBuildModal';

interface ShortageBreakdownTableProps {
  items: WorkOrderItem[];
  activeRiskFilter: string;
  onChangeRiskFilter: (filter: string) => void;
  hideNonMaterial: boolean;
  onToggleHideNonMaterial: () => void;
  onOpenExpediteModal: (item: WorkOrderItem) => void;
}

type ViewMode = 'WORK_ORDER' | 'ASSEMBLY' | 'FLAT_LIST';

export const ShortageBreakdownTable: React.FC<ShortageBreakdownTableProps> = ({
  items,
  activeRiskFilter,
  onChangeRiskFilter,
  hideNonMaterial,
  onToggleHideNonMaterial,
  onOpenExpediteModal,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('WORK_ORDER');
  const [searchQuery, setSearchQuery] = useState('');
  const [assemblyFilter, setAssemblyFilter] = useState('ALL');
  const [showOnlyShortagesInWO, setShowOnlyShortagesInWO] = useState(true);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [selectedPartialBuildWO, setSelectedPartialBuildWO] = useState<WorkOrderGroup | null>(null);

  const showToast = (msg: string) => {
    setCopyToast(msg);
    setTimeout(() => {
      setCopyToast(null);
    }, 3200);
  };

  // Expanded states
  const [expandedWOs, setExpandedWOs] = useState<Record<string, boolean>>({});
  const [expandedAssemblies, setExpandedAssemblies] = useState<Record<string, boolean>>({});

  // Flat sort states
  const [sortField, setSortField] = useState<keyof WorkOrderItem>('delayDays');
  const [sortAsc, setSortAsc] = useState(false);

  // Grouped datasets
  const allWOGroups = useMemo(() => groupItemsByWorkOrder(items), [items]);
  const allAssemblyGroups = useMemo(() => groupItemsByAssembly(items), [items]);

  // Distinct Assemblies for Dropdown
  const uniqueAssemblies = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.assemblyItem && i.assemblyItem !== '- None -') set.add(i.assemblyItem);
    });
    return Array.from(set).sort();
  }, [items]);

  // Search normalization helper to handle spelling variations like ISUZO02 vs ISUZU02
  const normalizeForSearch = (str: string) => {
    return str
      .toLowerCase()
      .replace(/isuzu/g, 'isuzo')
      .replace(/[-\s_]/g, '');
  };

  // Filtered Work Orders
  const filteredWOGroups = useMemo(() => {
    return allWOGroups.filter(wo => {
      // Exclude purely non-material WOs if hideNonMaterial is true unless EXCLUDED is active
      if (hideNonMaterial && wo.allMaterialItems.length === 0 && activeRiskFilter !== 'EXCLUDED') {
        return false;
      }

      // Risk filter
      if (activeRiskFilter !== 'ALL') {
        if (activeRiskFilter === 'PARTIAL_BUILD') {
          if (!wo.partialBuild?.isFeasible) return false;
        } else if (activeRiskFilter === 'NO_SUPPLY_DATE') {
          if (!wo.hasMissingSupplyDate && !wo.shortItems.some(i => i.isMissingSupplyDate)) {
            return false;
          }
        } else if (activeRiskFilter === 'EXCLUDED') {
          if (wo.overallRiskLevel !== 'EXCLUDED' && wo.allMaterialItems.length > 0) return false;
        } else if (wo.overallRiskLevel !== activeRiskFilter) {
          return false;
        }
      }

      // Assembly filter
      if (assemblyFilter !== 'ALL' && wo.assemblyItem !== assemblyFilter) {
        return false;
      }

      // Search query across WO number, Assembly, Customer, or internal item codes
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const normQ = normalizeForSearch(searchQuery);

        const matchWO = wo.woNumber.toLowerCase().includes(q);
        const matchAsm = wo.assemblyItem.toLowerCase().includes(q) || normalizeForSearch(wo.assemblyItem).includes(normQ);
        const matchCust = wo.customer.toLowerCase().includes(q);
        const matchItems = wo.allMaterialItems.some(
          it => it.item.toLowerCase().includes(q) || 
                it.itemDescription.toLowerCase().includes(q) || 
                normalizeForSearch(it.itemDescription).includes(normQ)
        );
        const matchExcluded = wo.excludedItems.some(
          it => it.item.toLowerCase().includes(q) || it.itemDescription.toLowerCase().includes(q)
        );
        if (!matchWO && !matchAsm && !matchCust && !matchItems && !matchExcluded) return false;
      }

      return true;
    });
  }, [allWOGroups, activeRiskFilter, hideNonMaterial, assemblyFilter, searchQuery]);

  // Filtered Assembly Groups
  const filteredAssemblyGroups = useMemo(() => {
    return allAssemblyGroups.filter(asm => {
      // Risk filter
      if (activeRiskFilter !== 'ALL') {
        if (activeRiskFilter === 'PARTIAL_BUILD') {
          if (!asm.partialBuildAvailableCount || asm.partialBuildAvailableCount === 0) {
            return false;
          }
        } else if (activeRiskFilter === 'NO_SUPPLY_DATE') {
          if (!asm.uniqueMissingParts.some(p => !p.maxSupplyReceiptDate || p.maxSupplyReceiptDate === 'Unconfirmed' || p.maxSupplyReceiptDate === 'NO SUPPLY DATE')) {
            return false;
          }
        } else if (activeRiskFilter === 'EXCLUDED') {
          if (asm.overallRiskLevel !== 'EXCLUDED') return false;
        } else if (asm.overallRiskLevel !== activeRiskFilter) {
          return false;
        }
      }

      // Assembly filter
      if (assemblyFilter !== 'ALL' && asm.assemblyItem !== assemblyFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const normQ = normalizeForSearch(searchQuery);

        const matchAsm = asm.assemblyItem.toLowerCase().includes(q) || normalizeForSearch(asm.assemblyItem).includes(normQ);
        const matchWOs = asm.workOrders.some(w => w.woNumber.toLowerCase().includes(q));
        const matchParts = asm.uniqueMissingParts.some(
          p => p.itemCode.toLowerCase().includes(q) || 
               p.itemDescription.toLowerCase().includes(q) || 
               normalizeForSearch(p.itemDescription).includes(normQ)
        );
        if (!matchAsm && !matchWOs && !matchParts) return false;
      }

      return true;
    });
  }, [allAssemblyGroups, activeRiskFilter, assemblyFilter, searchQuery]);

  // Flat Filtered Items
  const processedFlatItems = useMemo(() => {
    return items
      .filter((item) => {
        if (hideNonMaterial && item.isNonMaterial && activeRiskFilter !== 'EXCLUDED') {
          return false;
        }
        if (activeRiskFilter !== 'ALL') {
          if (activeRiskFilter === 'PARTIAL_BUILD') {
            const parentWO = allWOGroups.find(w => w.woNumber === item.woNumber);
            if (!parentWO?.partialBuild?.isFeasible) return false;
          } else if (activeRiskFilter === 'NO_SUPPLY_DATE') {
            if (!item.isMissingSupplyDate && item.maxSupplyReceiptDate && item.maxSupplyReceiptDate !== 'Unconfirmed') {
              return false;
            }
          } else if (activeRiskFilter === 'EXCLUDED') {
            if (!item.isNonMaterial) return false;
          } else if (item.riskLevel !== activeRiskFilter) {
            return false;
          }
        }
        if (assemblyFilter !== 'ALL' && item.assemblyItem !== assemblyFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const normQ = normalizeForSearch(searchQuery);

          const matchWO = item.woNumber.toLowerCase().includes(q);
          const matchItem = item.item.toLowerCase().includes(q);
          const matchDesc = item.itemDescription.toLowerCase().includes(q) || normalizeForSearch(item.itemDescription).includes(normQ);
          const matchAssembly = item.assemblyItem.toLowerCase().includes(q) || normalizeForSearch(item.assemblyItem).includes(normQ);
          if (!matchWO && !matchItem && !matchDesc && !matchAssembly) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (sortField === 'delayDays') {
          valA = a.delayDays === null ? (a.riskLevel === 'CRITICAL' ? 999 : -999) : a.delayDays;
          valB = b.delayDays === null ? (b.riskLevel === 'CRITICAL' ? 999 : -999) : b.delayDays;
        }

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [items, activeRiskFilter, hideNonMaterial, assemblyFilter, searchQuery, sortField, sortAsc]);

  // Expand / Collapse Helpers
  const toggleAllWOs = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    if (expand) {
      filteredWOGroups.forEach(wo => { next[wo.id] = true; });
    }
    setExpandedWOs(next);
  };

  const toggleAllAssemblies = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    if (expand) {
      filteredAssemblyGroups.forEach(asm => { next[asm.id] = true; });
    }
    setExpandedAssemblies(next);
  };

  const toggleWO = (id: string) => {
    setExpandedWOs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAssembly = (id: string) => {
    setExpandedAssemblies(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
      {/* Top Header Bar */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-sm">
              Work Order & Assembly Shortage Matrix
            </h2>
            <p className="text-[11px] text-slate-500">
              Combined job view showing exact missing components per Work Order & Assembly
            </p>
          </div>
        </div>

        {/* View Mode Switcher Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 self-start md:self-auto">
          <button
            onClick={() => setViewMode('WORK_ORDER')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 ${
              viewMode === 'WORK_ORDER'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Combined Work Orders ({filteredWOGroups.length})</span>
          </button>

          <button
            onClick={() => setViewMode('ASSEMBLY')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 ${
              viewMode === 'ASSEMBLY'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Combined Assemblies ({filteredAssemblyGroups.length})</span>
          </button>

          <button
            onClick={() => setViewMode('FLAT_LIST')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 ${
              viewMode === 'FLAT_LIST'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>Flat Line Items ({processedFlatItems.length})</span>
          </button>
        </div>
      </div>

      {/* Control Toolbar: Risk Pills, Search, Assembly Selector, Expand/Collapse */}
      <div className="p-4 border-b border-slate-100 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Risk Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => onChangeRiskFilter('ALL')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
              activeRiskFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Items
          </button>
          <button
            onClick={() => onChangeRiskFilter('CRITICAL')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
              activeRiskFilter === 'CRITICAL'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            🚨 Critical Delays
          </button>
          <button
            onClick={() => onChangeRiskFilter('NO_SUPPLY_DATE')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
              activeRiskFilter === 'NO_SUPPLY_DATE'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-200'
            }`}
          >
            <HelpCircle className="w-3 h-3 text-rose-600" />
            NO SUPPLY DATE (PO Needed)
          </button>
          <button
            onClick={() => onChangeRiskFilter('PARTIAL_BUILD')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
              activeRiskFilter === 'PARTIAL_BUILD'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
            }`}
            title="Work orders with shortages that can be reduced to immediately build partial quantities"
          >
            <Scissors className="w-3 h-3 text-amber-700" />
            💡 Partial Build Ready ({allWOGroups.filter(w => w.partialBuild?.isFeasible).length})
          </button>
          <button
            onClick={() => onChangeRiskFilter('MODERATE')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
              activeRiskFilter === 'MODERATE'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            ⚠️ Moderate Gaps
          </button>
          <button
            onClick={() => onChangeRiskFilter('ON_TRACK')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
              activeRiskFilter === 'ON_TRACK'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            ✅ On Track
          </button>
          <button
            onClick={() => onChangeRiskFilter('EXCLUDED')}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition flex items-center gap-1.5 ${
              activeRiskFilter === 'EXCLUDED'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            <Ban className="w-3 h-3" /> Excluded Items
          </button>
        </div>

        {/* Search, Filter & Expand Toggles */}
        <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap">
          {viewMode === 'WORK_ORDER' && (
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => toggleAllWOs(true)}
                className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded flex items-center gap-1"
                title="Expand All Work Orders"
              >
                <Maximize2 className="w-3 h-3 text-indigo-600" />
                <span>Expand All</span>
              </button>
              <button
                onClick={() => toggleAllWOs(false)}
                className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded flex items-center gap-1"
                title="Collapse All Work Orders"
              >
                <Minimize2 className="w-3 h-3 text-slate-400" />
                <span>Collapse</span>
              </button>
            </div>
          )}

          {viewMode === 'ASSEMBLY' && (
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => toggleAllAssemblies(true)}
                className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded flex items-center gap-1"
                title="Expand All Assemblies"
              >
                <Maximize2 className="w-3 h-3 text-indigo-600" />
                <span>Expand All</span>
              </button>
              <button
                onClick={() => toggleAllAssemblies(false)}
                className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded flex items-center gap-1"
                title="Collapse All Assemblies"
              >
                <Minimize2 className="w-3 h-3 text-slate-400" />
                <span>Collapse</span>
              </button>
            </div>
          )}

          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search WO#, Part, Assembly..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          {/* Assembly Selector */}
          <select
            value={assemblyFilter}
            onChange={(e) => setAssemblyFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
          >
            <option value="ALL">All Assemblies</option>
            {uniqueAssemblies.map(asm => (
              <option key={asm} value={asm}>{asm}</option>
            ))}
          </select>

          {/* Copy All for Excel Button */}
          <button
            id="btn-copy-all-excel"
            onClick={async () => {
              let tsv = '';
              let countStr = '';
              if (viewMode === 'WORK_ORDER') {
                tsv = formatAllWorkOrdersForExcel(filteredWOGroups);
                countStr = `${filteredWOGroups.length} Work Orders`;
              } else if (viewMode === 'ASSEMBLY') {
                tsv = formatAllWorkOrdersForExcel(filteredWOGroups);
                countStr = `${filteredAssemblyGroups.length} Assemblies`;
              } else {
                tsv = formatAllItemsForExcel(processedFlatItems);
                countStr = `${processedFlatItems.length} items`;
              }
              const ok = await copyToClipboard(tsv);
              if (ok) {
                showToast(`Copied all ${countStr} to clipboard! Ready to paste into Excel (Ctrl+V).`);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer shrink-0"
            title="Copy all currently filtered data formatted for direct Excel paste (Ctrl+V)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Copy All for Excel</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="p-6 space-y-4">
        {/* Active Filter Helper Banner */}
        {(activeRiskFilter !== 'ALL' || assemblyFilter !== 'ALL' || searchQuery.trim() !== '') && (
          <div className="bg-slate-100 border border-slate-200 px-4 py-2 rounded-lg flex items-center justify-between gap-2 text-xs text-slate-700">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900">Active View Filter:</span>
              {activeRiskFilter !== 'ALL' && (
                <span className="px-2 py-0.5 rounded bg-white font-semibold text-slate-800 border border-slate-200">
                  Risk: {activeRiskFilter === 'NO_SUPPLY_DATE' ? 'NO SUPPLY DATE (No PO)' : activeRiskFilter}
                </span>
              )}
              {assemblyFilter !== 'ALL' && (
                <span className="px-2 py-0.5 rounded bg-white font-semibold text-slate-800 border border-slate-200">
                  Assembly: {assemblyFilter}
                </span>
              )}
              {searchQuery.trim() !== '' && (
                <span className="px-2 py-0.5 rounded bg-white font-semibold text-slate-800 border border-slate-200">
                  Search: "{searchQuery}"
                </span>
              )}
            </div>
            <button
              onClick={() => {
                onChangeRiskFilter('ALL');
                setAssemblyFilter('ALL');
                setSearchQuery('');
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline shrink-0"
            >
              Show All Assemblies & Work Orders
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: COMBINED BY WORK ORDER (Job Centric)                             */}
        {/* ========================================================================= */}
        {viewMode === 'WORK_ORDER' && (
          <div className="space-y-4">
            {filteredWOGroups.length === 0 ? (
              <div className="py-16 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                <Filter className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700 text-xs">No Work Orders match your current search/filters</p>
                <button
                  onClick={() => {
                    onChangeRiskFilter('ALL');
                    setSearchQuery('');
                    setAssemblyFilter('ALL');
                  }}
                  className="text-xs text-indigo-600 font-bold hover:underline mt-1 inline-block"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              filteredWOGroups.map((wo) => {
                const isExpanded = expandedWOs[wo.id] ?? true;
                const isCritical = wo.overallRiskLevel === 'CRITICAL';
                const isModerate = wo.overallRiskLevel === 'MODERATE';
                const isPureNonMaterial = wo.allMaterialItems.length === 0 && wo.excludedItems.length > 0;
                const displayItems = isPureNonMaterial ? wo.excludedItems : (showOnlyShortagesInWO ? wo.shortItems : wo.allMaterialItems);

                const percentFulfilled = wo.totalQtyNeeded > 0 
                  ? Math.round((wo.totalCommitted / wo.totalQtyNeeded) * 100)
                  : 100;

                return (
                  <div 
                    key={wo.id}
                    className={`rounded-xl border transition shadow-xs overflow-hidden ${
                      isPureNonMaterial
                        ? 'border-slate-300 bg-slate-50/50'
                        : isCritical
                        ? 'border-rose-300 bg-rose-50/10'
                        : isModerate
                        ? 'border-amber-300 bg-amber-50/10'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* Work Order Header Card */}
                    <div 
                      onClick={(e) => {
                        // If the user was highlighting/selecting text, do NOT toggle
                        const selection = window.getSelection();
                        if (selection && selection.toString().trim().length > 0) {
                          return;
                        }
                        const target = e.target as HTMLElement;
                        if (target.closest('button') || target.closest('a') || target.closest('input')) {
                          return;
                        }
                        toggleWO(wo.id);
                      }}
                      className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-text transition ${
                        isPureNonMaterial
                          ? 'bg-slate-100/70 hover:bg-slate-200/60 border-b border-slate-200'
                          : isCritical
                          ? 'bg-rose-50/40 hover:bg-rose-50/70 border-b border-rose-100'
                          : isModerate
                          ? 'bg-amber-50/40 hover:bg-amber-50/70 border-b border-amber-100'
                          : 'bg-slate-50/70 hover:bg-slate-100/70 border-b border-slate-100'
                      }`}
                    >
                      {/* Left: WO Number, Finished Good Assembly & Customer */}
                      <div className="flex items-center gap-3 select-text">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWO(wo.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                          title={isExpanded ? "Collapse Work Order" : "Expand Work Order"}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-indigo-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                          )}
                        </button>

                        <div className="select-text cursor-text">
                          <div className="flex items-center gap-2 flex-wrap select-text">
                            <span className="font-mono text-base font-extrabold text-slate-900 select-text cursor-text">
                              {wo.woNumber}
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono select-text cursor-text">
                              {wo.assemblyItem}
                            </span>
                            {wo.targetOrderQty > 0 && (
                              <span 
                                className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-mono select-text cursor-text flex items-center gap-1 shadow-2xs"
                                title={`Work Order Target: ${wo.targetOrderQty} finished ${wo.targetOrderQty === 1 ? 'unit' : 'units'}`}
                              >
                                <Box className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span>{wo.targetOrderQty} {wo.targetOrderQty === 1 ? 'unit' : 'units'}</span>
                              </span>
                            )}
                            {wo.partialBuild?.isFeasible && (
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPartialBuildWO(wo);
                                }}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 cursor-pointer hover:bg-amber-200 transition"
                                title="Partial build possible: Click to simulate reducing work order quantity"
                              >
                                <Scissors className="w-3 h-3 text-amber-700" />
                                <span>💡 Reduce to {wo.partialBuild.maxBuildableQty} ({wo.partialBuild.buildablePercentage}%)</span>
                              </span>
                            )}
                            {wo.customer && wo.customer !== '- None -' && (
                              <span className="text-[11px] text-slate-500 font-medium select-text cursor-text">
                                • Customer: <strong className="text-slate-700">{wo.customer}</strong>
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 select-text cursor-text">
                            <span>Target Prod Start: <strong className="text-slate-800 select-text">{wo.prodStartDate || 'Unscheduled'}</strong></span>
                            <span>•</span>
                            {isPureNonMaterial ? (
                              <span className="text-slate-600 font-medium select-text">Non-Material Lines: <strong>{wo.excludedItems.length} items</strong></span>
                            ) : (
                              <span className="select-text">Total BOM Items: <strong>{wo.allMaterialItems.length} parts</strong></span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Shortage Metrics & Status Badge */}
                      <div className="flex items-center gap-4 flex-wrap self-end md:self-auto">
                        {!isPureNonMaterial && (
                          <div className="w-32 hidden sm:block">
                            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                              <span>Fulfilled</span>
                              <span className="font-bold text-slate-800">{percentFulfilled}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  percentFulfilled === 100 
                                    ? 'bg-emerald-500' 
                                    : percentFulfilled > 50 
                                    ? 'bg-amber-500' 
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${percentFulfilled}%` }}
                              ></div>
                            </div>
                          </div>
                        )}

                        {/* Shortage Count Pill */}
                        <div className="text-right">
                          {isPureNonMaterial ? (
                            <div>
                              <span className="font-mono font-medium text-slate-600 text-xs">
                                Labour / Non-Inventory
                              </span>
                              <div className="text-[10px] text-slate-400">
                                {wo.excludedItems.length} service charges
                              </div>
                            </div>
                          ) : wo.shortageItemsCount > 0 ? (
                            <div>
                              <span className="font-mono font-extrabold text-rose-600 text-sm">
                                -{wo.totalQtyVar.toLocaleString()} units
                              </span>
                              <div className="text-[10px] text-slate-500 font-medium">
                                Committed: <strong className="text-emerald-700">{wo.totalCommitted.toLocaleString()}</strong> / <strong className="text-slate-700">{wo.totalQtyNeeded.toLocaleString()}</strong>
                              </div>
                              <div className="text-[10px] text-rose-600 font-bold">
                                {wo.shortageItemsCount} missing {wo.shortageItemsCount === 1 ? 'part' : 'parts'}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="font-mono font-bold text-emerald-600 text-sm">
                                100% Ready
                              </span>
                              <div className="text-[10px] text-emerald-600 font-medium">
                                {wo.totalCommitted.toLocaleString()} units committed
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Missing Supply Date Warning */}
                        {wo.hasMissingSupplyDate && (
                          <div className="px-2.5 py-1 rounded-lg bg-rose-100 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-1">
                            <HelpCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>NO SUPPLY DATE</span>
                          </div>
                        )}

                        {/* Delay Days Indicator */}
                        {wo.maxDelayDays !== null && wo.maxDelayDays > 0 && (
                          <div className="px-2.5 py-1 rounded-lg bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold text-center">
                            +{wo.maxDelayDays}d Late
                          </div>
                        )}

                        {/* Risk Badge */}
                        <div>
                          {isPureNonMaterial ? (
                            <span className="px-3 py-1 rounded-lg bg-slate-600 text-white font-bold text-xs shadow-xs flex items-center gap-1">
                              <Wrench className="w-3.5 h-3.5" />
                              NON-MATERIAL
                            </span>
                          ) : isCritical ? (
                            <span className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs shadow-xs flex items-center gap-1">
                              <AlertOctagon className="w-3.5 h-3.5" />
                              CRITICAL
                            </span>
                          ) : isModerate ? (
                            <span className="px-3 py-1 rounded-lg bg-amber-500 text-white font-bold text-xs shadow-xs flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              MODERATE
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-xs flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              READY
                            </span>
                          )}
                        </div>

                        {/* Copy Single WO Box for Excel */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const tsv = formatWorkOrderForExcel(wo);
                            const ok = await copyToClipboard(tsv);
                            if (ok) {
                              showToast(`Copied Work Order ${wo.woNumber} (${wo.assemblyItem}) with all parts for Excel!`);
                            }
                          }}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                          title={`Copy all details and component lines for ${wo.woNumber} (${wo.assemblyItem}) to paste into Excel`}
                        >
                          <Copy className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="hidden sm:inline">Copy for Excel</span>
                        </button>
                      </div>
                    </div>

                    {/* Sub-Table of Missing / Short Components for this WO */}
                    {isExpanded && (
                      <div className="p-0 bg-white">
                        {/* Partial Build Suggestion Banner if feasible */}
                        {wo.partialBuild?.isFeasible && (
                          <div className="mx-4 mt-3 mb-2 p-3.5 rounded-xl bg-linear-to-r from-amber-50 to-amber-100/60 border border-amber-300 flex items-center justify-between gap-3 select-text shadow-2xs">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                                <Scissors className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-amber-950 flex items-center gap-2 flex-wrap">
                                  <span>Proactive Suggestion: Reduce Work Order Quantity for Immediate Build</span>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold border border-emerald-300">
                                    {wo.partialBuild.buildablePercentage}% Immediate Build Ready ({wo.partialBuild.maxBuildableQty} / {wo.partialBuild.originalTargetQty} units)
                                  </span>
                                </div>
                                <div className="text-[11px] text-amber-900 mt-0.5 leading-relaxed">
                                  {wo.shortageItemsCount === 1 ? (
                                    <span>Only <strong>1 component</strong> is short ({wo.partialBuild.limitingParts[0]?.itemCode} short by {wo.partialBuild.limitingParts[0]?.shortage} units). </span>
                                  ) : (
                                    <span>Primary bottleneck: <strong>{wo.partialBuild.limitingParts[0]?.itemCode}</strong> ({wo.partialBuild.limitingParts[0]?.committed} committed on hand limits build to {wo.partialBuild.maxBuildableQty} {wo.partialBuild.maxBuildableQty === 1 ? 'unit' : 'units'}). </span>
                                  )}
                                  100% of all required BOM components are committed and in stock for <strong>{wo.partialBuild.maxBuildableQty} {wo.partialBuild.maxBuildableQty === 1 ? 'unit' : 'units'}</strong>. You can reduce this WO to release production today and satisfy customers without waiting for backordered shipments!
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPartialBuildWO(wo);
                              }}
                              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition shrink-0 cursor-pointer flex items-center gap-1.5"
                              title="Simulate reducing work order quantity and generate ERP split instructions"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Simulate & Split WO</span>
                            </button>
                          </div>
                        )}

                        {displayItems.length === 0 ? (
                          <div className="p-6 text-center text-slate-400 bg-slate-50/50 flex flex-col items-center justify-center gap-1 text-xs">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                            <span className="font-semibold text-slate-700">All materials fully committed for Work Order {wo.woNumber}</span>
                            <span className="text-[11px] text-slate-400">No active material gaps or schedule delays.</span>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50/80 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 tracking-wider">
                                  <th className="px-5 py-2.5">Component / Part #</th>
                                  <th className="px-4 py-2.5">Description</th>
                                  <th className="px-3 py-2.5 text-center">Qty / Unit</th>
                                  <th className="px-4 py-2.5 text-right">Needed</th>
                                  <th className="px-4 py-2.5 text-right">Committed</th>
                                  <th className="px-4 py-2.5 text-right">Shortage Gap</th>
                                  <th className="px-4 py-2.5">Supply ETA</th>
                                  <th className="px-4 py-2.5 text-center">Schedule / PO Impact</th>
                                  <th className="px-4 py-2.5 text-right">Action Needed</th>
                                  <th className="px-4 py-2.5 text-center w-20">Expedite</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {displayItems.map((item) => {
                                  const itemIsCritical = item.riskLevel === 'CRITICAL';
                                  const itemIsModerate = item.riskLevel === 'MODERATE';
                                  const itemHasNoSupplyDate = item.isMissingSupplyDate || !item.maxSupplyReceiptDate || item.maxSupplyReceiptDate === 'Unconfirmed';

                                  return (
                                    <tr 
                                      key={item.id}
                                      className={`hover:bg-slate-50/80 transition-colors ${
                                        itemHasNoSupplyDate
                                          ? 'bg-rose-50/30'
                                          : itemIsCritical
                                          ? 'bg-rose-50/15'
                                          : itemIsModerate
                                          ? 'bg-amber-50/10'
                                          : ''
                                      }`}
                                    >
                                      {/* Part Code */}
                                      <td className="px-5 py-2.5 font-mono font-bold text-slate-900">
                                        <div className="flex items-center gap-1.5">
                                          {itemHasNoSupplyDate ? (
                                            <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0 animate-pulse"></span>
                                          ) : itemIsCritical ? (
                                            <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0"></span>
                                          ) : itemIsModerate ? (
                                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                                          ) : (
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                          )}
                                          <span>{item.item}</span>
                                          {item.isNonMaterial && (
                                            <span className="text-[9px] px-1 rounded bg-slate-200 text-slate-600 font-sans font-normal">
                                              Non-Material
                                            </span>
                                          )}
                                        </div>
                                      </td>

                                      {/* Description */}
                                      <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate" title={item.itemDescription}>
                                        {item.itemDescription}
                                      </td>

                                      {/* Qty / Unit (Member Quantity) */}
                                      <td className="px-3 py-2.5 text-center font-mono text-slate-500 font-medium">
                                        {item.memberQuantity !== null && item.memberQuantity !== undefined ? (
                                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-bold">
                                            {item.memberQuantity}x
                                          </span>
                                        ) : (
                                          <span className="text-slate-300">-</span>
                                        )}
                                      </td>

                                      {/* Needed */}
                                      <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                                        {item.qtyNeeded.toLocaleString()}
                                      </td>

                                      {/* Committed */}
                                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">
                                        {item.committed.toLocaleString()}
                                      </td>

                                      {/* Shortage Gap */}
                                      <td className="px-4 py-2.5 text-right">
                                        {item.qtyVar > 0 ? (
                                          <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                                            -{item.qtyVar.toLocaleString()}
                                          </span>
                                        ) : (
                                          <span className="font-mono text-emerald-600 font-medium">
                                            0
                                          </span>
                                        )}
                                      </td>

                                      {/* Supply ETA */}
                                      <td className="px-4 py-2.5">
                                        {!itemHasNoSupplyDate ? (
                                          <span className={`font-medium ${
                                            item.delayDays && item.delayDays > 0 ? 'text-rose-600 font-bold' : 'text-slate-700'
                                          }`}>
                                            {item.maxSupplyReceiptDate}
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                                            <HelpCircle className="w-3 h-3 text-rose-600" />
                                            NO SUPPLY DATE
                                          </span>
                                        )}
                                      </td>

                                      {/* Schedule Impact / PO Status */}
                                      <td className="px-4 py-2.5 text-center">
                                        {itemHasNoSupplyDate ? (
                                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                            ⚠️ No PO on Record
                                          </span>
                                        ) : item.delayDays !== null ? (
                                          item.delayDays > 0 ? (
                                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                                              +{item.delayDays}d late
                                            </span>
                                          ) : (
                                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                                              {item.delayDays === 0 ? 'On Time' : `${Math.abs(item.delayDays)}d early`}
                                            </span>
                                          )
                                        ) : (
                                          <span className="text-[10px] text-slate-400">Unscheduled</span>
                                        )}
                                      </td>

                                      {/* Action Recommendation */}
                                      <td className="px-4 py-2.5 text-right">
                                        {itemHasNoSupplyDate ? (
                                          <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                                            Create PO / Check Obsolete
                                          </span>
                                        ) : itemIsCritical ? (
                                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                                            Expedite Vendor
                                          </span>
                                        ) : itemIsModerate ? (
                                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                            Monitor Buffer
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                            Ready
                                          </span>
                                        )}
                                      </td>

                                      {/* Expedite Button */}
                                      <td className="px-4 py-2.5 text-center">
                                        {item.qtyVar > 0 ? (
                                          <button
                                            onClick={() => onOpenExpediteModal(item)}
                                            className={`p-1 rounded-md transition ${
                                              itemHasNoSupplyDate 
                                                ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold border border-rose-300' 
                                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                                            }`}
                                            title={itemHasNoSupplyDate ? 'Inquire / Draft PO Creation Request' : 'Draft Vendor Expedite Email'}
                                          >
                                            <Mail className="w-3.5 h-3.5" />
                                          </button>
                                        ) : (
                                          <span className="text-slate-300">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: COMBINED BY ASSEMBLY (Finished Good Rollup)                      */}
        {/* ========================================================================= */}
        {viewMode === 'ASSEMBLY' && (
          <div className="space-y-4">
            {filteredAssemblyGroups.length === 0 ? (
              <div className="py-16 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                <Filter className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700 text-xs">No Assemblies match your current search/filters</p>
                <button
                  onClick={() => {
                    onChangeRiskFilter('ALL');
                    setSearchQuery('');
                    setAssemblyFilter('ALL');
                  }}
                  className="text-xs text-indigo-600 font-bold hover:underline mt-1 inline-block"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              filteredAssemblyGroups.map((asm) => {
                const isExpanded = expandedAssemblies[asm.id] ?? true;
                const isCritical = asm.overallRiskLevel === 'CRITICAL';
                const isModerate = asm.overallRiskLevel === 'MODERATE';

                return (
                  <div 
                    key={asm.id}
                    className={`rounded-xl border transition shadow-xs overflow-hidden ${
                      isCritical
                        ? 'border-rose-300 bg-rose-50/10'
                        : isModerate
                        ? 'border-amber-300 bg-amber-50/10'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* Assembly Header */}
                    <div 
                      onClick={(e) => {
                        // If the user was highlighting/selecting text, do NOT toggle
                        const selection = window.getSelection();
                        if (selection && selection.toString().trim().length > 0) {
                          return;
                        }
                        const target = e.target as HTMLElement;
                        if (target.closest('button') || target.closest('a') || target.closest('input')) {
                          return;
                        }
                        toggleAssembly(asm.id);
                      }}
                      className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-text transition ${
                        isCritical
                          ? 'bg-rose-50/50 hover:bg-rose-50/80 border-b border-rose-100'
                          : isModerate
                          ? 'bg-amber-50/50 hover:bg-amber-50/80 border-b border-amber-100'
                          : 'bg-slate-50/80 hover:bg-slate-100/80 border-b border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 select-text">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAssembly(asm.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                          title={isExpanded ? "Collapse Assembly" : "Expand Assembly"}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-indigo-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                          )}
                        </button>

                        <div className="select-text cursor-text">
                          <div className="flex items-center gap-2 select-text flex-wrap">
                            <span className="font-mono text-base font-extrabold text-slate-900 select-text cursor-text">
                              Assembly: {asm.assemblyItem}
                            </span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono select-text cursor-text">
                              {asm.totalWOCount} {asm.totalWOCount === 1 ? 'Work Order' : 'Work Orders'}
                            </span>
                            {asm.partialBuildAvailableCount !== undefined && asm.partialBuildAvailableCount > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                <Scissors className="w-3 h-3 text-amber-700" />
                                <span>{asm.partialBuildAvailableCount} Partial Build {asm.partialBuildAvailableCount === 1 ? 'Opportunity' : 'Opportunities'}</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 select-text cursor-text">
                            Earliest Production Start: <strong className="text-slate-800 select-text">{asm.earliestProdStartDate || 'N/A'}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 select-text">
                        <div className="text-right select-text cursor-text">
                          {asm.totalShortageItemsCount > 0 ? (
                            <div>
                              <span className="font-mono font-extrabold text-rose-600 text-sm select-text cursor-text">
                                -{asm.totalQtyVar.toLocaleString()} units short
                              </span>
                              <div className="text-[10px] text-slate-600 font-medium select-text cursor-text">
                                Committed: <strong className="text-emerald-700">{asm.totalCommitted.toLocaleString()}</strong> / Needed: <strong className="text-slate-800">{asm.totalQtyNeeded.toLocaleString()}</strong>
                              </div>
                              <div className="text-[10px] text-rose-600 font-bold select-text cursor-text">
                                {asm.uniqueMissingParts.length} {asm.uniqueMissingParts.length === 1 ? 'part' : 'unique parts'} blocking build
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="font-mono font-bold text-emerald-600 text-sm select-text cursor-text">
                                Assembly Ready
                              </span>
                              <div className="text-[10px] text-emerald-600 font-medium select-text cursor-text">
                                {asm.totalCommitted.toLocaleString()} units committed (100%)
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          {isCritical ? (
                            <span className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs shadow-xs flex items-center gap-1">
                              <AlertOctagon className="w-3.5 h-3.5" />
                              CRITICAL
                            </span>
                          ) : isModerate ? (
                            <span className="px-3 py-1 rounded-lg bg-amber-500 text-white font-bold text-xs shadow-xs flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              MODERATE
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-xs flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              READY
                            </span>
                          )}
                        </div>

                        {/* Copy Single Assembly Box for Excel */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const tsv = formatAssemblyForExcel(asm);
                            const ok = await copyToClipboard(tsv);
                            if (ok) {
                              showToast(`Copied Assembly ${asm.assemblyItem} box with all missing parts for Excel!`);
                            }
                          }}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                          title={`Copy all missing parts and WO details for Assembly ${asm.assemblyItem} to paste into Excel`}
                        >
                          <Copy className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="hidden sm:inline">Copy for Excel</span>
                        </button>
                      </div>
                    </div>

                    {/* Assembly Expanded Content */}
                    {isExpanded && (
                      <div className="p-4 space-y-4 bg-white">
                        {/* Section 1: Consolidated Shortages for this Assembly */}
                        <div>
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                            <span>Consolidated Missing Parts across {asm.assemblyItem} WOs</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-mono font-bold">
                              {asm.uniqueMissingParts.length}
                            </span>
                          </h4>

                          {asm.uniqueMissingParts.length === 0 ? (
                            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-medium">
                              All parts are fully committed for this assembly across all work orders.
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                                    <th className="px-4 py-2">Part Code</th>
                                    <th className="px-4 py-2">Description</th>
                                    <th className="px-4 py-2 text-right">Total Needed</th>
                                    <th className="px-4 py-2 text-right">Total Committed</th>
                                    <th className="px-4 py-2 text-right">Total Gap</th>
                                    <th className="px-4 py-2">Supply ETA</th>
                                    <th className="px-4 py-2 text-center">Delay / Status</th>
                                    <th className="px-4 py-2">Impacting WOs</th>
                                    <th className="px-4 py-2 text-right">Action Needed</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {asm.uniqueMissingParts.map((part) => {
                                    const hasNoDate = !part.maxSupplyReceiptDate || part.maxSupplyReceiptDate === 'Unconfirmed' || part.maxSupplyReceiptDate === 'NO SUPPLY DATE';

                                    return (
                                      <tr key={part.itemCode} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 font-mono font-bold text-slate-900 select-text cursor-text">
                                          {part.itemCode}
                                        </td>
                                        <td className="px-4 py-2 text-slate-600 max-w-xs truncate select-text cursor-text" title={part.itemDescription}>
                                          {part.itemDescription}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono font-semibold text-slate-700 select-text cursor-text">
                                          {part.totalQtyNeeded.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono font-bold text-emerald-700 bg-emerald-50/40 select-text cursor-text">
                                          {part.totalCommitted.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono font-extrabold text-rose-600 select-text cursor-text">
                                          -{part.totalQtyVar.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2 font-medium text-slate-700 select-text cursor-text">
                                          {hasNoDate ? (
                                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                                              NO SUPPLY DATE
                                            </span>
                                          ) : (
                                            part.maxSupplyReceiptDate
                                          )}
                                        </td>
                                        <td className="px-4 py-2 text-center select-text cursor-text">
                                          {hasNoDate ? (
                                            <span className="text-[10px] font-bold text-rose-600">
                                              PO Missing
                                            </span>
                                          ) : part.delayDays !== null && part.delayDays > 0 ? (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                                              +{part.delayDays}d late
                                            </span>
                                          ) : (
                                            <span className="text-[10px] text-slate-400">On Track</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-2 text-slate-700 font-mono text-[11px] select-text cursor-text">
                                          {part.wosAffected.join(', ')}
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                          {hasNoDate ? (
                                            <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                                              Create PO / Obsolete?
                                            </span>
                                          ) : part.riskLevel === 'CRITICAL' ? (
                                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                              CRITICAL
                                            </span>
                                          ) : (
                                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                              MODERATE
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Section 2: Child Work Orders */}
                        <div className="pt-2">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                            Child Work Orders Building {asm.assemblyItem}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {asm.workOrders.map((wo) => (
                              <div 
                                key={wo.id}
                                className={`p-3 rounded-lg border text-xs select-text ${
                                  wo.overallRiskLevel === 'CRITICAL'
                                    ? 'border-rose-200 bg-rose-50/30'
                                    : wo.overallRiskLevel === 'MODERATE'
                                    ? 'border-amber-200 bg-amber-50/30'
                                    : 'border-slate-200 bg-slate-50/50'
                                }`}
                              >
                                <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono text-sm select-text cursor-text">{wo.woNumber}</span>
                                    {wo.targetOrderQty > 0 && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono">
                                        {wo.targetOrderQty} {wo.targetOrderQty === 1 ? 'unit' : 'units'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-right select-text cursor-text">
                                    <span className={wo.totalQtyVar > 0 ? 'text-rose-600 font-mono font-extrabold text-xs' : 'text-emerald-600 font-bold text-xs'}>
                                      {wo.totalQtyVar > 0 ? `-${wo.totalQtyVar.toLocaleString()} units short` : '100% Committed'}
                                    </span>
                                    {wo.totalQtyVar > 0 && (
                                      <div className="text-[10px] text-slate-500 font-medium">
                                        Committed: <span className="font-bold text-emerald-700">{wo.totalCommitted.toLocaleString()}</span> / Needed: <span className="font-bold text-slate-800">{wo.totalQtyNeeded.toLocaleString()}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-[11px] text-slate-500 mb-2 flex items-center justify-between select-text cursor-text">
                                  <span>Prod Start: <strong>{wo.prodStartDate}</strong> • {wo.shortageItemsCount} missing {wo.shortageItemsCount === 1 ? 'part' : 'parts'}</span>
                                  {wo.hasMissingSupplyDate && (
                                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">
                                      NO SUPPLY DATE
                                    </span>
                                  )}
                                </div>
                                {wo.shortItems.length > 0 && (
                                  <div className="space-y-1.5">
                                    {wo.shortItems.map(si => (
                                      <div key={si.id} className="flex justify-between items-center text-[11px] bg-white p-2 rounded-lg border border-slate-200/90 shadow-2xs gap-2 select-text">
                                        <div className="min-w-0 flex-1 select-text cursor-text">
                                          <div className="flex items-center gap-1.5 flex-wrap select-text">
                                            <span className="font-mono font-bold text-slate-900 select-text cursor-text">{si.item}</span>
                                            {si.isMissingSupplyDate ? (
                                              <span className="text-[9px] text-rose-700 font-bold bg-rose-50 px-1 rounded border border-rose-200">
                                                No PO
                                              </span>
                                            ) : si.maxSupplyReceiptDate && (
                                              <span className="text-[9px] text-slate-500 font-mono bg-slate-100 px-1 rounded">
                                                ETA: {si.maxSupplyReceiptDate}
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-[10px] text-slate-500 truncate select-text cursor-text" title={si.itemDescription}>
                                            {si.itemDescription}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2.5 text-right shrink-0 select-text cursor-text">
                                          <div className="text-[10px] font-mono leading-tight select-text">
                                            <div className="text-emerald-700 font-bold select-text" title="Units committed to this work order">
                                              {si.committed.toLocaleString()} committed
                                            </div>
                                            <div className="text-slate-500 select-text" title="Total units needed for this work order">
                                              of {si.qtyNeeded.toLocaleString()} needed
                                            </div>
                                          </div>
                                          <span className="text-xs px-2 py-0.5 rounded-md bg-rose-100 border border-rose-200 text-rose-700 font-mono font-extrabold select-text" title="Shortage variance gap">
                                            -{si.qtyVar.toLocaleString()}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Partial Build Suggestion in Child WO card */}
                                {wo.partialBuild?.isFeasible && (
                                  <div className="mt-2.5 p-2 rounded-lg bg-amber-50 border border-amber-200/90 flex items-center justify-between gap-2 select-text shadow-2xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="w-6 h-6 rounded-md bg-amber-500 text-white flex items-center justify-center shrink-0">
                                        <Scissors className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="font-bold text-[11px] text-amber-950 truncate">
                                          💡 Suggestion: Reduce WO to {wo.partialBuild.maxBuildableQty} units ({wo.partialBuild.buildablePercentage}% buildable now)
                                        </div>
                                        <div className="text-[10px] text-amber-800 truncate">
                                          100% components available on hand for {wo.partialBuild.maxBuildableQty} units. Split {wo.partialBuild.shortageQtyToSplit} units into backorder.
                                        </div>
                                      </div>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedPartialBuildWO(wo);
                                      }}
                                      className="px-2 py-1 text-[10px] font-bold rounded-md bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs transition shrink-0 cursor-pointer flex items-center gap-1"
                                      title="Simulate reducing this work order quantity to release build immediately"
                                    >
                                      <Sparkles className="w-3 h-3 text-amber-600" />
                                      <span>Simulate</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: FLAT ITEM DETAIL TABLE                                            */}
        {/* ========================================================================= */}
        {viewMode === 'FLAT_LIST' && (
          <div className="overflow-x-auto min-h-[360px] rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 shadow-xs z-10">
                <tr className="text-[11px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-200">
                  <th className="px-4 py-3 cursor-pointer hover:text-slate-800 transition select-none" onClick={() => { setSortField('woNumber'); setSortAsc(!sortAsc); }}>
                    <div className="flex items-center gap-1">
                      <span>WO / Assembly</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:text-slate-800 transition select-none" onClick={() => { setSortField('item'); setSortAsc(!sortAsc); }}>
                    <div className="flex items-center gap-1">
                      <span>Item / Description</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right cursor-pointer hover:text-slate-800 transition select-none" onClick={() => { setSortField('qtyVar'); setSortAsc(!sortAsc); }}>
                    <div className="flex items-center justify-end gap-1">
                      <span>Variance</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right">Needed / Comm.</th>
                  <th className="px-4 py-3 cursor-pointer hover:text-slate-800 transition select-none" onClick={() => { setSortField('prodStartDate'); setSortAsc(!sortAsc); }}>
                    <div className="flex items-center gap-1">
                      <span>Prod. Start</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 cursor-pointer hover:text-slate-800 transition select-none" onClick={() => { setSortField('maxSupplyReceiptDate'); setSortAsc(!sortAsc); }}>
                    <div className="flex items-center gap-1">
                      <span>Supply Arrival</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center cursor-pointer hover:text-slate-800 transition select-none" onClick={() => { setSortField('delayDays'); setSortAsc(!sortAsc); }}>
                    <div className="flex items-center justify-center gap-1">
                      <span>Schedule Delta</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right">Risk Level</th>
                  <th className="px-4 py-3 text-center w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {processedFlatItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                      No line items match filter.
                    </td>
                  </tr>
                ) : (
                  processedFlatItems.map((item) => {
                    const itemHasNoSupplyDate = item.isMissingSupplyDate || !item.maxSupplyReceiptDate || item.maxSupplyReceiptDate === 'Unconfirmed';

                    return (
                      <tr key={item.id} className={`hover:bg-slate-50 transition ${itemHasNoSupplyDate ? 'bg-rose-50/20' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 font-mono">{item.woNumber}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{item.assemblyItem}</div>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <div className="font-bold text-slate-900 font-mono flex items-center gap-1.5">
                            <span>{item.item}</span>
                            {item.isNonMaterial && (
                              <span className="text-[9px] px-1 rounded bg-slate-200 text-slate-600 font-sans">
                                Non-Material
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{item.itemDescription}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.qtyVar > 0 ? (
                            <span className="font-mono font-bold text-rose-600">-{item.qtyVar.toLocaleString()}</span>
                          ) : (
                            <span className="font-mono text-emerald-600">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-[11px]">
                          {item.qtyNeeded} / <span className="text-slate-500">{item.committed}</span>
                        </td>
                        <td className="px-4 py-3">{item.prodStartDate}</td>
                        <td className="px-4 py-3">
                          {itemHasNoSupplyDate ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                              NO SUPPLY DATE
                            </span>
                          ) : (
                            item.maxSupplyReceiptDate
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {itemHasNoSupplyDate ? (
                            <span className="text-[10px] font-bold text-rose-600">
                              Create PO / Obsolete?
                            </span>
                          ) : item.delayDays !== null && item.delayDays > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                              +{item.delayDays}d
                            </span>
                          ) : (
                            <span className="text-emerald-700 text-[10px]">On Track</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {item.isNonMaterial ? (
                            <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 font-semibold text-[10px]">
                              Non-Material
                            </span>
                          ) : itemHasNoSupplyDate ? (
                            <span className="px-2 py-1 rounded bg-rose-700 text-white font-bold text-[10px]">
                              🚨 NO SUPPLY DATE
                            </span>
                          ) : item.riskLevel === 'CRITICAL' ? (
                            <span className="px-2 py-1 rounded bg-rose-100 text-rose-700 font-bold text-[10px]">
                              🚨 CRITICAL
                            </span>
                          ) : item.riskLevel === 'MODERATE' ? (
                            <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 font-bold text-[10px]">
                              ⚠️ MODERATE
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                              ✅ ON TRACK
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.qtyVar > 0 && (
                            <button
                              onClick={() => onOpenExpediteModal(item)}
                              className={`p-1.5 rounded-lg transition ${
                                itemHasNoSupplyDate 
                                  ? 'bg-rose-100 hover:bg-rose-200 text-rose-800' 
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                              }`}
                              title={itemHasNoSupplyDate ? 'Request PO Creation or Check Obsolete' : 'Draft Expedite Email'}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Copy Feedback Toast */}
      {copyToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 text-xs font-medium max-w-md">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-white text-xs">{copyToast}</p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Ready to paste! In Microsoft Excel or Google Sheets, press <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300 font-mono font-bold">Ctrl + V</kbd>
            </p>
          </div>
        </div>
      )}

      {/* Partial Build & Work Order Reduction Modal */}
      <PartialBuildModal
        isOpen={!!selectedPartialBuildWO}
        onClose={() => setSelectedPartialBuildWO(null)}
        workOrder={selectedPartialBuildWO}
      />
    </div>
  );
};
