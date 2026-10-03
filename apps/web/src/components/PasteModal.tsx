'use client';

import React, { useState } from 'react';
import { X, FileCode2, Play, Sparkles } from 'lucide-react';
import {
  ECOMMERCE_SAMPLE_YAML,
  ECOMMERCE_V2_SAMPLE_YAML,
  MINIMAL_SAMPLE_JSON,
} from '../lib/samples';

interface PasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (content: string) => void;
  initialContent?: string;
}

export function PasteModal({
  isOpen,
  onClose,
  onAnalyze,
  initialContent = '',
}: PasteModalProps) {
  const [content, setContent] = useState(initialContent);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileCode2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Provide OpenAPI Specification
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Sample Selector */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Load built-in test contract:</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setContent(ECOMMERCE_SAMPLE_YAML)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              Commerce API v1 (Full)
            </button>
            <button
              onClick={() => setContent(ECOMMERCE_V2_SAMPLE_YAML)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              Commerce API v2 (Breaking)
            </button>
            <button
              onClick={() => setContent(MINIMAL_SAMPLE_JSON)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              Health API (JSON)
            </button>
          </div>
        </div>

        {/* Text Area */}
        <div className="p-6 flex-1 flex flex-col min-h-[300px]">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your OpenAPI 3.0 or 3.1 YAML / JSON specification here..."
            className="w-full flex-1 p-4 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
            spellCheck={false}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Supports OpenAPI 3.0.x and 3.1.x (YAML & JSON)
          </span>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg hover:bg-slate-800 text-slate-300 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (content.trim()) {
                  onAnalyze(content);
                  onClose();
                }
              }}
              disabled={!content.trim()}
              className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs transition disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Analyze Specification</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
