import React from 'react';
import { 
  Package, 
  UploadCloud, 
  FileSpreadsheet, 
  Sparkles, 
  Download, 
  Printer, 
  FileText,
  BarChart3
} from 'lucide-react';

interface HeaderProps {
  onOpenImportModal: () => void;
  onLoadSample: (type: 'prompt' | 'expanded') => void;
  onExportCSV: () => void;
  onPrintReport: () => void;
  onTriggerAIAnalysis: () => void;
  isAILoading: boolean;
  activeDatasetName: string;
  totalItemsCount: number;
  criticalCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenImportModal,
  onLoadSample,
  onExportCSV,
  onPrintReport,
  onTriggerAIAnalysis,
  isAILoading,
  activeDatasetName,
  totalItemsCount,
  criticalCount,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-3.5 gap-3">
          {/* Brand & Context */}
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-xs shrink-0 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-slate-800">
                  Material Gap & Production Risk Analyzer
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Supply Chain Pro
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                <span className="font-medium bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-[11px]">
                  Dataset: <strong>{activeDatasetName}</strong> ({totalItemsCount} rows)
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">System Live</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Toolbar */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Sample Selector Dropdown */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs">
              <button
                id="btn-sample-prompt"
                onClick={() => onLoadSample('prompt')}
                className="px-2.5 py-1 rounded text-slate-600 hover:text-slate-900 hover:bg-white transition font-medium flex items-center gap-1.5 shadow-xs"
                title="Load the 15-row Work Order sample from prompt"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                Prompt Sample (15)
              </button>
              <button
                id="btn-sample-expanded"
                onClick={() => onLoadSample('expanded')}
                className="px-2.5 py-1 rounded text-slate-600 hover:text-slate-900 hover:bg-white transition font-medium flex items-center gap-1.5"
                title="Load expanded manufacturing dataset"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Expanded Run (21)
              </button>
            </div>

            {/* Upload / Paste Custom CSV */}
            <button
              id="btn-open-import"
              onClick={onOpenImportModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-xs transition"
            >
              <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
              Upload / Paste CSV
            </button>

            {/* AI Analysis Button */}
            <button
              id="btn-trigger-ai"
              onClick={onTriggerAIAnalysis}
              disabled={isAILoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-xs disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAILoading ? 'animate-spin' : ''}`} />
              {isAILoading ? 'Analyzing...' : 'AI Action Plan'}
            </button>

            {/* Export Actions */}
            <button
              id="btn-export-csv"
              onClick={onExportCSV}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 shadow-xs transition"
              title="Export Current Filtered Shortages as CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              Export
            </button>
            <button
              id="btn-print-report"
              onClick={onPrintReport}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 shadow-xs transition"
              title="Print Shortage Analysis Report"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

