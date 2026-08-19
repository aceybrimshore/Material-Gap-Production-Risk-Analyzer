import React, { useState } from 'react';
import { Sparkles, Send, X, Bot, User, RefreshCw } from 'lucide-react';
import { WorkOrderItem, SummaryMetrics } from '../types';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: WorkOrderItem[];
  metrics: SummaryMetrics;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({
  isOpen,
  onClose,
  items,
  metrics,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello! I am your **Supply Chain & Material Shortage Analyst**. I have loaded your current dataset (${metrics.totalWOs} Work Orders, ${metrics.criticalItemsCount} critical shortages). 

Ask me anything such as:
- *"Which parts cause the longest production delays?"*
- *"Summarize the shortage impact on assembly PZQ3089050"*
- *"Can we start any Work Orders immediately?"*
- *"Which vendors should we escalate first?"*`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const quickPrompts = [
    'Which components cause the biggest production delay?',
    'Summarize PZQ3089050 risk and B137 impact',
    'List all work orders with unconfirmed PO dates',
    'What work orders can be released without shortages?',
  ];

  const handleSend = async (questionText?: string) => {
    const textToSend = questionText || inputText;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      // Build lightweight dataset context for AI
      const datasetContext = {
        totalWOs: metrics.totalWOs,
        criticalItemsCount: metrics.criticalItemsCount,
        maxDelayDays: metrics.maxDelayDays,
        totalQtyVariance: metrics.totalQtyVariance,
        sampleItems: items.filter(i => !i.isNonMaterial && i.qtyVar > 0).map(i => ({
          wo: i.woNumber,
          assembly: i.assemblyItem,
          part: i.item,
          desc: i.itemDescription,
          needed: i.qtyNeeded,
          committed: i.committed,
          var: i.qtyVar,
          prodStart: i.prodStartDate,
          supplyDate: i.maxSupplyReceiptDate,
          delayDays: i.delayDays,
          status: i.riskLevel,
        })).slice(0, 25),
      };

      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: textToSend, datasetContext }),
      });

      const data = await response.json();
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: data.answer || 'Unable to generate response at this time.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('Error chatting with AI:', err);
      const errorMsg: Message = {
        id: `ai-err-${Date.now()}`,
        sender: 'assistant',
        text: 'Error processing inquiry. Please verify server connection.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Supply Chain AI Copilot</h3>
            <p className="text-[11px] text-slate-400">Gemini 3.7 Flash Intelligence</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl p-3 space-y-1 ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-slate-50 text-slate-800 rounded-tl-none border border-slate-200'
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed">
                {msg.text}
              </div>
              <div className={`text-[9px] ${msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-400'} text-right`}>
                {msg.timestamp}
              </div>
            </div>
            {msg.sender === 'user' && (
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl rounded-tl-none text-slate-500 flex items-center gap-2 border border-slate-200">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>Analyzing supply chain data...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Prompt Chips */}
      <div className="p-2.5 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-1">
        {quickPrompts.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(chip)}
            className="text-[10px] px-2 py-1 bg-white text-slate-700 border border-slate-200 rounded-md hover:border-indigo-500 hover:text-indigo-600 transition"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask about materials, shortages, dates..."
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
