'use client';

import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Info,
  ChevronDown,
  ChevronRight,
  Database,
  FileCode2,
} from 'lucide-react';
import type { DiffResult, ApiChange, CompatibilityImpact } from '@helios/diff-engine';
import { resolveVersionSelection } from '@helios/persistence/version-selector';
import { ECOMMERCE_SAMPLE_YAML, ECOMMERCE_V2_SAMPLE_YAML } from '../lib/samples';

export interface SavedVersionOption {
  id: string;
  version: string;
  apiName: string;
  projectName: string;
}

interface DiffViewProps {
  currentSpecRaw?: string;
  savedVersions?: SavedVersionOption[];
}

const IMPACT_COLORS: Record<CompatibilityImpact, { bg: string; text: string; border: string }> = {
  breaking: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  potentially_breaking: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  non_breaking: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
};

export function DiffView({ currentSpecRaw = '', savedVersions = [] }: DiffViewProps) {
  const [diffMode, setDiffMode] = useState<'saved' | 'manual'>(
    savedVersions.length >= 2 ? 'saved' : 'manual'
  );

  // Saved versions mode state
  const [baseVersionId, setBaseVersionId] = useState<string>(() => {
    return resolveVersionSelection(savedVersions).baseVersionId;
  });
  const [targetVersionId, setTargetVersionId] = useState<string>(() => {
    return resolveVersionSelection(savedVersions).targetVersionId;
  });

  // Manual mode state
  const [oldSpec, setOldSpec] = useState(currentSpecRaw || ECOMMERCE_SAMPLE_YAML);
  const [newSpec, setNewSpec] = useState(ECOMMERCE_V2_SAMPLE_YAML);

  const [isDiffing, setIsDiffing] = useState(false);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterImpact, setFilterImpact] = useState<string>('ALL');

  // Update default selections ONLY when savedVersions array changes (e.g. loaded from API)
  // Preserves existing selections if they still exist in savedVersions, preventing resets on user change.
  useEffect(() => {
    setBaseVersionId((prevBase) => {
      const exists = prevBase ? savedVersions.some((v) => v.id === prevBase) : false;
      if (exists) return prevBase;
      return savedVersions[0]?.id || '';
    });

    setTargetVersionId((prevTarget) => {
      const exists = prevTarget ? savedVersions.some((v) => v.id === prevTarget) : false;
      if (exists) return prevTarget;
      return savedVersions.length >= 2 ? savedVersions[1].id : (savedVersions[0]?.id || '');
    });
  }, [savedVersions]);

  const isSameVersion = Boolean(
    baseVersionId && targetVersionId && baseVersionId === targetVersionId
  );
  const canCompareSaved =
    !isDiffing &&
    savedVersions.length >= 2 &&
    Boolean(baseVersionId) &&
    Boolean(targetVersionId) &&
    !isSameVersion;

  // Run diff on saved versions
  const handleRunSavedDiff = async () => {
    if (!baseVersionId || !targetVersionId) {
      setError('Please select both a base version and a target version to compare.');
      return;
    }

    if (baseVersionId === targetVersionId) {
      setError('Base version and target version must be different.');
      return;
    }

    setIsDiffing(true);
    setError(null);

    try {
      const res = await fetch('/api/diff/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseVersionId, targetVersionId }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || 'Failed to compare saved versions.');
      } else {
        setDiffResult(json.data.diff);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDiffing(false);
    }
  };

  // Run diff on manual text specs
  const handleRunManualDiff = async () => {
    if (!oldSpec.trim() || !newSpec.trim()) {
      setError('Both base and target specifications must be provided.');
      return;
    }

    setIsDiffing(true);
    setError(null);

    try {
      const res = await fetch('/api/diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldSpecContent: oldSpec, newSpecContent: newSpec }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || 'Diff comparison failed.');
      } else {
        setDiffResult(json.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDiffing(false);
    }
  };

  const filteredChanges = (diffResult?.changes || []).filter((c) => {
    if (filterImpact === 'ALL') return true;
    if (filterImpact === 'SECURITY') return c.isSecurityRelevant;
    return c.compatibility === filterImpact;
  });

  return (
    <div className="space-y-6">
      {/* Mode Selector */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setDiffMode('saved')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            diffMode === 'saved'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Compare Saved Versions ({savedVersions.length})</span>
        </button>
        <button
          onClick={() => setDiffMode('manual')}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            diffMode === 'manual'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileCode2 className="w-3.5 h-3.5" />
          <span>Manual Specification Diff</span>
        </button>
      </div>

      {/* Saved Versions Selector Mode */}
      {diffMode === 'saved' && (
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Select Persisted Versions to Compare
              </h3>
              <p className="text-xs text-slate-400">
                Select any two saved API versions across your projects to evaluate contract compatibility.
              </p>
            </div>

            <button
              onClick={handleRunSavedDiff}
              disabled={!canCompareSaved}
              className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs transition disabled:opacity-50"
            >
              {isDiffing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Evaluating AST Changes...</span>
                </>
              ) : (
                <>
                  <GitCompare className="w-4 h-4" />
                  <span>Compare Saved Versions</span>
                </>
              )}
            </button>
          </div>

          {savedVersions.length < 2 ? (
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400">
              At least two API versions must be stored in the database to run version comparison. You can upload another version from the &quot;Projects &amp; APIs&quot; tab or switch to &quot;Manual Specification Diff&quot;.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Base Specification (Previous)
                  </label>
                  <select
                    value={baseVersionId}
                    onChange={(e) => setBaseVersionId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  >
                    {savedVersions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.projectName} &gt; {v.apiName} ({v.version})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Target Specification (Current / Proposed)
                  </label>
                  <select
                    value={targetVersionId}
                    onChange={(e) => setTargetVersionId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  >
                    {savedVersions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.projectName} &gt; {v.apiName} ({v.version})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isSameVersion && savedVersions.length >= 2 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Base and target specifications must be different versions to run comparison.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Manual Diff Mode */}
      {diffMode === 'manual' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Base (Previous) Spec */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Base Specification (v1 / Previous)
                </span>
                <button
                  onClick={() => setOldSpec(ECOMMERCE_SAMPLE_YAML)}
                  className="text-[11px] text-emerald-400 hover:underline"
                >
                  Load Sample v1
                </button>
              </div>
              <textarea
                value={oldSpec}
                onChange={(e) => setOldSpec(e.target.value)}
                placeholder="Paste base OpenAPI specification..."
                className="w-full h-44 p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 resize-none focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Target (Current) Spec */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Target Specification (v2 / Current)
                </span>
                <button
                  onClick={() => setNewSpec(ECOMMERCE_V2_SAMPLE_YAML)}
                  className="text-[11px] text-emerald-400 hover:underline"
                >
                  Load Sample v2
                </button>
              </div>
              <textarea
                value={newSpec}
                onChange={(e) => setNewSpec(e.target.value)}
                placeholder="Paste target OpenAPI specification..."
                className="w-full h-44 p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 resize-none focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400 font-mono">
              Semantic diff evaluates AST models, parameter contracts, and responses—not raw text syntax.
            </div>
            <button
              onClick={handleRunManualDiff}
              disabled={isDiffing}
              className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs transition disabled:opacity-50"
            >
              {isDiffing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Comparing Canonical ASTs...</span>
                </>
              ) : (
                <>
                  <GitCompare className="w-4 h-4" />
                  <span>Run Semantic Diff</span>
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
          <span className="font-bold">Diff Engine Error: </span> {error}
        </div>
      )}

      {/* Diff Result View */}
      {diffResult && (
        <div className="space-y-6 pt-4 border-t border-slate-800">
          {/* Summary Banner */}
          <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3">
                <h3 className="text-base font-bold text-slate-100">
                  Diff: v{diffResult.baseVersion} → v{diffResult.targetVersion}
                </h3>
                {diffResult.hasBreakingChanges ? (
                  <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    BREAKING CHANGES DETECTED
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    BACKWARD COMPATIBLE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                {diffResult.summary.totalChanges} total changes identified across AST structures.
              </p>
            </div>

            {/* Impact Badges */}
            <div className="flex items-center space-x-3 text-xs font-mono">
              <span className="px-3 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold">
                {diffResult.summary.breaking} Breaking
              </span>
              <span className="px-3 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
                {diffResult.summary.potentiallyBreaking} Potentially Breaking
              </span>
              <span className="px-3 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                {diffResult.summary.nonBreaking} Non-Breaking
              </span>
              <span className="px-3 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 font-bold">
                {diffResult.summary.securityRelevant} Security
              </span>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="text-slate-500">Filter Impact:</span>
            {['ALL', 'breaking', 'potentially_breaking', 'non_breaking', 'SECURITY'].map((imp) => (
              <button
                key={imp}
                onClick={() => setFilterImpact(imp)}
                className={`px-3 py-1 rounded transition uppercase ${
                  filterImpact === imp
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {imp}
              </button>
            ))}
          </div>

          {/* Changes List */}
          <div className="space-y-3">
            {filteredChanges.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-900 border border-slate-800 text-slate-500 text-xs">
                No semantic changes match the active filter.
              </div>
            ) : (
              filteredChanges.map((change) => {
                const impactStyle = IMPACT_COLORS[change.compatibility] || IMPACT_COLORS.non_breaking;

                return (
                  <div
                    key={change.id}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-3">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${impactStyle.bg} ${impactStyle.text} ${impactStyle.border}`}
                        >
                          {change.compatibility.replace('_', ' ')}
                        </span>

                        {change.isSecurityRelevant && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/30">
                            SECURITY-RELEVANT
                          </span>
                        )}

                        <span className="font-mono text-xs font-bold text-slate-200">
                          {change.kind}
                        </span>

                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                          {change.category}
                        </span>
                      </div>

                      {change.path && (
                        <span className="font-mono text-xs text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {change.method ? `${change.method.toUpperCase()} ` : ''}
                          {change.path}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300">{change.message}</p>
                    <p className="text-[11px] text-slate-500 italic">
                      <span className="font-semibold text-slate-400 not-italic">Rationale: </span>
                      {change.rationale}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
