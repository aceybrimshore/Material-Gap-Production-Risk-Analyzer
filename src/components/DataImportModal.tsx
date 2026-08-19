import React, { useState } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { PROMPT_SAMPLE_RAW } from '../utils/sampleData';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportData: (rawText: string, datasetName: string) => void;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({
  isOpen,
  onClose,
  onImportData,
}) => {
  const [activeTab, setActiveTab] = useState<'PASTE' | 'FILE'>('PASTE');
  const [pastedText, setPastedText] = useState('');
  const [datasetName, setDatasetName] = useState('Imported Work Order Data');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) {
      setErrorMessage('Please paste Work Order CSV/TSV data.');
      return;
    }
    onImportData(pastedText, datasetName || 'Custom Work Orders');
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onImportData(content, file.name.replace(/\.[^/.]+$/, ''));
        onClose();
      }
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read file.');
    };
    reader.readAsText(file);
  };

  const handleLoadSampleInModal = () => {
    setPastedText(PROMPT_SAMPLE_RAW);
    setDatasetName('Sample Work Orders (15 rows)');
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Import Work Order CSV / TSV
              </h3>
              <p className="text-xs text-slate-500">
                Paste tabular data directly from ERP/Excel or upload a .csv file.
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

        {/* Tab Selector */}
        <div className="px-4 pt-3 flex items-center justify-between border-b border-slate-100">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('PASTE')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition ${
                activeTab === 'PASTE'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Paste CSV / TSV Text
            </button>
            <button
              onClick={() => setActiveTab('FILE')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition ${
                activeTab === 'FILE'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Upload File (.csv, .tsv, .txt)
            </button>
          </div>

          <button
            onClick={handleLoadSampleInModal}
            className="text-xs text-indigo-600 hover:underline pb-2 flex items-center gap-1 font-medium"
          >
            <FileText className="w-3.5 h-3.5" />
            Paste Sample Data
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Dataset Name / Tag:
            </label>
            <input
              type="text"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
              placeholder="e.g., Weekly Work Orders - Run #44"
            />
          </div>

          {activeTab === 'PASTE' ? (
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                CSV / TSV Content (Tab or Comma Separated with Headers):
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => {
                  setPastedText(e.target.value);
                  setErrorMessage('');
                }}
                placeholder="Date Created&#9;WO Number&#9;Assembly Item&#9;Status&#9;Prod. Start Date&#9;Item&#9;..."
                rows={10}
                className="w-full p-3 font-mono text-[11px] rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Expected columns: WO Number, Assembly Item, Prod. Start Date, Item, Item Description, Qty Needed, Committed, Qty. Var., Maximum of Supply Receipt Date, Inventory Type.
              </p>
            </div>
          ) : (
            <div className="py-8 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-3 bg-slate-50 text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">
                  Select a CSV or TSV file to upload
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Supports comma, tab, and semicolon delimited files
                </p>
              </div>
              <label className="cursor-pointer px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs transition">
                <span>Browse Files</span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {activeTab === 'PASTE' && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium transition"
            >
              Cancel
            </button>
            <button
              onClick={handlePasteSubmit}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Analyze Data
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
