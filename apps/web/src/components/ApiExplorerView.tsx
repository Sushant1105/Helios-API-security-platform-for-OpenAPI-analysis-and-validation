'use client';

import React, { useState } from 'react';
import {
  Search,
  Lock,
  Unlock,
  Layers,
  ChevronRight,
  X,
  FileCode,
  Tag,
  AlertCircle,
} from 'lucide-react';
import type { CanonicalApiAst, CanonicalEndpoint } from '@helios/canonical-ast';

interface ApiExplorerViewProps {
  ast: CanonicalApiAst;
}

const METHOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  get: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
  post: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  put: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  delete: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  patch: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  options: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  head: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30' },
};

export function ApiExplorerView({ ast }: ApiExplorerViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [selectedEndpoint, setSelectedEndpoint] = useState<CanonicalEndpoint | null>(null);

  const endpoints = ast.endpoints || [];

  const filteredEndpoints = endpoints.filter((ep) => {
    const matchesMethod =
      selectedMethod === 'ALL' || ep.method.toLowerCase() === selectedMethod.toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      ep.path.toLowerCase().includes(query) ||
      (ep.operationId && ep.operationId.toLowerCase().includes(query)) ||
      (ep.summary && ep.summary.toLowerCase().includes(query)) ||
      (ep.tags && ep.tags.some((t) => t.toLowerCase().includes(query)));
    return matchesMethod && matchesSearch;
  });

  const methods = ['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter endpoints by path, tag, or operation..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Method Pills */}
        <div className="flex items-center space-x-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
          {methods.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMethod(m)}
              className={`px-3 py-1 rounded text-xs font-mono font-semibold transition ${
                selectedMethod === m
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Endpoints List & Detail Drawer */}
      <div className="flex gap-6">
        {/* List of Endpoints */}
        <div className="flex-1 space-y-2">
          {filteredEndpoints.length === 0 ? (
            <div className="p-12 text-center rounded-xl bg-slate-900 border border-slate-800 text-slate-500 text-xs">
              No endpoints matching your filter criteria.
            </div>
          ) : (
            filteredEndpoints.map((ep) => {
              const mColor = METHOD_COLORS[ep.method.toLowerCase()] || METHOD_COLORS.get;
              const isSelected = selectedEndpoint?.id === ep.id;
              const hasSecurity = ep.security && ep.security.length > 0;

              return (
                <div
                  key={ep.id}
                  onClick={() => setSelectedEndpoint(ep)}
                  className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between group ${
                    isSelected
                      ? 'bg-slate-800/90 border-emerald-500/50 shadow-md shadow-emerald-500/5'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    {/* Method Tag */}
                    <span
                      className={`w-16 text-center py-1 rounded font-mono text-[11px] font-bold uppercase border ${mColor.bg} ${mColor.text} ${mColor.border}`}
                    >
                      {ep.method}
                    </span>

                    {/* Path & Summary */}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-semibold text-slate-200 tracking-tight">
                          {ep.path}
                        </span>
                        {ep.deprecated && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            DEPRECATED
                          </span>
                        )}
                      </div>
                      {ep.summary && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{ep.summary}</p>
                      )}
                    </div>
                  </div>

                  {/* Metadata Indicators */}
                  <div className="flex items-center space-x-4 text-xs font-mono">
                    {/* Security Badge */}
                    {hasSecurity ? (
                      <span className="flex items-center space-x-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px]">
                        <Lock className="w-3 h-3" />
                        <span>Secured</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[10px]">
                        <Unlock className="w-3 h-3" />
                        <span>Public</span>
                      </span>
                    )}

                    {/* Tags */}
                    {ep.tags && ep.tags.length > 0 && (
                      <span className="hidden md:inline px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                        {ep.tags[0]}
                      </span>
                    )}

                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Endpoint Detail View */}
        {selectedEndpoint && (
          <div className="w-96 rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-6 shrink-0 h-fit sticky top-24">
            <div className="flex items-start justify-between">
              <div>
                <span
                  className={`px-2 py-0.5 rounded font-mono text-xs font-bold uppercase border ${
                    METHOD_COLORS[selectedEndpoint.method.toLowerCase()]?.bg
                  } ${METHOD_COLORS[selectedEndpoint.method.toLowerCase()]?.text} ${
                    METHOD_COLORS[selectedEndpoint.method.toLowerCase()]?.border
                  }`}
                >
                  {selectedEndpoint.method}
                </span>
                <h3 className="text-sm font-bold font-mono text-slate-100 mt-2 break-all">
                  {selectedEndpoint.path}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEndpoint(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Operation ID & Summary */}
            <div className="space-y-1 text-xs">
              {selectedEndpoint.operationId && (
                <div className="text-slate-400 font-mono text-[11px]">
                  OperationId: <span className="text-slate-200">{selectedEndpoint.operationId}</span>
                </div>
              )}
              {selectedEndpoint.description && (
                <p className="text-slate-400 text-xs mt-2 bg-slate-950 p-2.5 rounded border border-slate-800">
                  {selectedEndpoint.description}
                </p>
              )}
            </div>

            {/* Security Schemes */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Security</h4>
              {selectedEndpoint.security && selectedEndpoint.security.length > 0 ? (
                <div className="space-y-1">
                  {selectedEndpoint.security.map((sec, idx) => (
                    <div
                      key={idx}
                      className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 text-emerald-400 border border-slate-800 flex items-center space-x-2"
                    >
                      <Lock className="w-3 h-3" />
                      <span>{sec.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 text-amber-400 border border-slate-800 flex items-center space-x-2">
                  <Unlock className="w-3 h-3" />
                  <span>No explicit security requirements applied</span>
                </div>
              )}
            </div>

            {/* Parameters */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Parameters ({selectedEndpoint.parameters.length})
              </h4>
              {selectedEndpoint.parameters.length === 0 ? (
                <div className="text-xs text-slate-500 italic">No parameters declared.</div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {selectedEndpoint.parameters.map((param, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-slate-950 border border-slate-800 text-xs font-mono flex items-center justify-between"
                    >
                      <div>
                        <span className="text-slate-200 font-semibold">{param.name}</span>
                        <span className="text-slate-500 text-[10px] ml-1.5">({param.in})</span>
                      </div>
                      {param.required ? (
                        <span className="text-[10px] text-rose-400 font-semibold">required</span>
                      ) : (
                        <span className="text-[10px] text-slate-500">optional</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Responses */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Declared Responses
              </h4>
              <div className="space-y-1 font-mono text-xs">
                {Object.entries(selectedEndpoint.responses || {}).map(([statusCode, resp]) => (
                  <div
                    key={statusCode}
                    className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between"
                  >
                    <span
                      className={`font-bold ${
                        statusCode.startsWith('2')
                          ? 'text-emerald-400'
                          : statusCode.startsWith('4')
                          ? 'text-amber-400'
                          : statusCode.startsWith('5')
                          ? 'text-rose-400'
                          : 'text-sky-400'
                      }`}
                    >
                      HTTP {statusCode}
                    </span>
                    <span className="text-slate-400 text-[11px] truncate max-w-[160px]">
                      {resp.description || 'No description'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
