'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  Search,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Info,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import type { SecurityAuditResult, SecurityFinding, SecuritySeverity } from '@helios/security-engine';

interface SecurityViewProps {
  security: SecurityAuditResult;
}

const SEVERITY_COLORS: Record<SecuritySeverity, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  HIGH: { bg: 'bg-rose-400/10', text: 'text-rose-300', border: 'border-rose-400/30' },
  MEDIUM: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  LOW: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  INFO: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
};

export function SecurityView({ security }: SecurityViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const findings = security.findings || [];

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
      selectedSeverity === 'ALL' || f.severity === selectedSeverity;
    const matchesCategory =
      selectedCategory === 'ALL' || f.category === selectedCategory;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      f.title.toLowerCase().includes(query) ||
      f.ruleId.toLowerCase().includes(query) ||
      f.description.toLowerCase().includes(query) ||
      (f.endpointPath && f.endpointPath.toLowerCase().includes(query)) ||
      (f.owaspCategory && f.owaspCategory.toLowerCase().includes(query));
    return matchesSeverity && matchesCategory && matchesSearch;
  });

  const categories = [
    'ALL',
    'authentication',
    'transport',
    'data-exposure',
    'resource-consumption',
    'configuration',
  ];
  const severities = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

  return (
    <div className="space-y-6">
      {/* Static Analysis Limitation Banner */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start space-x-3">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-amber-200">Static Contract Boundary: </span>
          Static OpenAPI contract analysis cannot prove runtime authorization, database encryption, or tenant isolation. Findings highlight declared interface risks and static misconfigurations.
        </div>
      </div>

      {/* Header Controls */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rules, endpoints, OWASP codes..."
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

      {/* Security Findings List */}
      <div className="space-y-3">
        {filteredFindings.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-slate-900 border border-slate-800 text-slate-500 text-xs">
            {findings.length === 0
              ? 'No security vulnerabilities detected by deterministic engine.'
              : 'No security findings match your filter criteria.'}
          </div>
        ) : (
          filteredFindings.map((f) => {
            const isExpanded = expandedIds.has(f.id);
            const sevStyle = SEVERITY_COLORS[f.severity] || SEVERITY_COLORS.INFO;

            return (
              <div
                key={f.id}
                className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden transition"
              >
                {/* Header */}
                <div
                  onClick={() => toggleExpand(f.id)}
                  className="p-4 cursor-pointer hover:bg-slate-800/40 flex items-center justify-between gap-4 select-none"
                >
                  <div className="flex items-center space-x-3">
                    <ShieldAlert className={`w-4 h-4 shrink-0 ${sevStyle.text}`} />

                    {/* Severity Badge */}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${sevStyle.bg} ${sevStyle.text} ${sevStyle.border}`}
                    >
                      {f.severity}
                    </span>

                    {/* Heuristic / Deterministic Pill */}
                    {f.isHeuristic ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center space-x-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>HEURISTIC</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                        DETERMINISTIC
                      </span>
                    )}

                    {/* Rule Title & Target */}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-slate-200">{f.ruleId}</span>
                        <span className="text-xs font-semibold text-slate-100">{f.title}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{f.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {f.endpointPath && (
                      <span className="hidden sm:inline font-mono text-[11px] text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {f.httpMethod ? `${f.httpMethod.toUpperCase()} ` : ''}
                        {f.endpointPath}
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
                  <div className="px-5 pb-5 pt-3 border-t border-slate-800/80 bg-slate-950/40 space-y-3 text-xs">
                    {/* Meta Row */}
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                      <span className="text-slate-500">Category:</span>
                      <span className="text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {f.category}
                      </span>

                      {f.owaspCategory && (
                        <>
                          <span className="text-slate-500 ml-2">OWASP API Category:</span>
                          <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {f.owaspCategory}
                          </span>
                        </>
                      )}

                      <span className="text-slate-500 ml-2">Confidence:</span>
                      <span className="text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {f.confidence}
                      </span>
                    </div>

                    {/* Evidence Snippet */}
                    {f.evidence && (
                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs">
                        <span className="text-slate-500 text-[10px] uppercase tracking-wider block mb-1">
                          Evidence Found in Spec:
                        </span>
                        <code className="text-rose-300">{f.evidence}</code>
                      </div>
                    )}

                    {/* Remediation Guidance */}
                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-emerald-300">
                      <span className="font-semibold text-emerald-400">Remediation: </span>
                      {f.remediation}
                    </div>
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
