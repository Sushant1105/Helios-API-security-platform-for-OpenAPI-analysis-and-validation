'use client';

import React, { useState } from 'react';
import {
  Search,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react';
import type { ValidationResult, ValidationFinding, ValidationSeverity } from '@helios/validator';

interface ValidationViewProps {
  validation: ValidationResult;
}

export function ValidationView({ validation }: ValidationViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const findings = validation.findings || [];

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredFindings = findings.filter((f) => {
    const matchesSeverity =
      selectedSeverity === 'ALL' || f.severity.toLowerCase() === selectedSeverity.toLowerCase();
    const matchesCategory =
      selectedCategory === 'ALL' || f.category.toLowerCase() === selectedCategory.toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      f.message.toLowerCase().includes(query) ||
      f.code.toLowerCase().includes(query) ||
      (f.path && f.path.toLowerCase().includes(query)) ||
      (f.suggestion && f.suggestion.toLowerCase().includes(query));
    return matchesSeverity && matchesCategory && matchesSearch;
  });

  const categories = ['ALL', 'structure', 'semantic', 'reference', 'consistency'];
  const severities = ['ALL', 'error', 'warning', 'info'];

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search validation rules, codes, paths..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Severity Pills */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {severities.map((sev) => (
              <button
                key={sev}
                onClick={() => setSelectedSeverity(sev)}
                className={`px-2.5 py-1 rounded font-mono text-[11px] font-semibold uppercase transition ${
                  selectedSeverity === sev
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                Category: {c.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        {filteredFindings.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-slate-900 border border-slate-800 text-slate-500 text-xs">
            {findings.length === 0
              ? 'Specification passed all structural and semantic validation checks.'
              : 'No validation findings match your filter criteria.'}
          </div>
        ) : (
          filteredFindings.map((f) => {
            const isExpanded = expandedIds.has(f.id);
            const isError = f.severity === 'error';
            const isWarning = f.severity === 'warning';

            return (
              <div
                key={f.id}
                className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden transition"
              >
                {/* Finding Header */}
                <div
                  onClick={() => toggleExpand(f.id)}
                  className="p-4 cursor-pointer hover:bg-slate-800/40 flex items-center justify-between gap-4 select-none"
                >
                  <div className="flex items-center space-x-3">
                    {/* Severity Icon */}
                    {isError ? (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 text-sky-400 shrink-0" />
                    )}

                    {/* Severity Pill */}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                        isError
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : isWarning
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                      }`}
                    >
                      {f.severity}
                    </span>

                    {/* Code & Message */}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-slate-200">
                          {f.code}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                          {f.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{f.message}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {f.path && (
                      <span className="hidden sm:inline font-mono text-[11px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {f.path}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 border-t border-slate-800/80 bg-slate-950/40 space-y-3 text-xs">
                    {f.path && (
                      <div className="font-mono text-[11px] text-slate-400">
                        <span className="text-slate-500">Target Path: </span>
                        <span className="text-slate-200 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          {f.path}
                        </span>
                      </div>
                    )}

                    {f.suggestion && (
                      <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-emerald-300">
                        <span className="font-semibold text-emerald-400">Suggestion: </span>
                        {f.suggestion}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
