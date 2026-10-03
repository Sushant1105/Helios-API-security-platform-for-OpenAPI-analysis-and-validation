'use client';

import React, { useRef } from 'react';
import {
  Upload,
  FileCode2,
  Play,
  Loader2,
  FolderKanban,
  Layers,
  History,
  RefreshCw,
  Clock,
} from 'lucide-react';
import type { PipelineAnalysisResult } from '@helios/analysis-pipeline';

export interface ProjectHeaderItem {
  id: string;
  name: string;
}

export interface ApiHeaderItem {
  id: string;
  name: string;
}

export interface VersionHeaderItem {
  id: string;
  version: string;
}

export interface RunHeaderItem {
  id: string;
  status: string;
  createdAt: string;
}

interface HeaderProps {
  currentResult: PipelineAnalysisResult | null;
  isAnalyzing: boolean;
  projects: ProjectHeaderItem[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  apis: ApiHeaderItem[];
  activeApiId: string | null;
  onSelectApi: (apiId: string) => void;
  versions: VersionHeaderItem[];
  activeVersionId: string | null;
  onSelectVersion: (versionId: string) => void;
  runs: RunHeaderItem[];
  activeRunId: string | null;
  onSelectRun: (runId: string) => void;
  isHistoricalRun: boolean;
  onRerunAnalysis: () => void;
  onAnalyze: (content: string) => void;
  onOpenPasteModal: () => void;
  onLoadSample: (sampleKey: 'ecommerce' | 'ecommerceV2' | 'health') => void;
}

export function Header({
  currentResult,
  isAnalyzing,
  projects,
  activeProjectId,
  onSelectProject,
  apis,
  activeApiId,
  onSelectApi,
  versions,
  activeVersionId,
  onSelectVersion,
  runs,
  activeRunId,
  onSelectRun,
  isHistoricalRun,
  onRerunAnalysis,
  onAnalyze,
  onOpenPasteModal,
  onLoadSample,
}: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onAnalyze(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
      {/* Brand & Context Selectors */}
      <div className="flex items-center space-x-3 sm:space-x-4 overflow-hidden">
        <div className="flex items-center space-x-2 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-tr from-emerald-500 to-cyan-400 flex items-center justify-center font-bold text-slate-950 text-base sm:text-lg shadow-md shadow-emerald-500/20">
            H
          </div>
          <div className="hidden lg:block">
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-slate-100 tracking-tight text-sm">HELIOS</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PROD
              </span>
            </div>
            <p className="text-[10px] text-slate-400">API Security &amp; Intelligence</p>
          </div>
        </div>

        {/* Persistent Selectors Hierarchy: Project -> API -> Version */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 text-xs font-mono overflow-x-auto py-1">
          {/* Project Selector */}
          {projects.length > 0 && (
            <div className="flex items-center space-x-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 shrink-0">
              <FolderKanban className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={activeProjectId || ''}
                onChange={(e) => onSelectProject(e.target.value)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer max-w-[110px] sm:max-w-[140px] truncate"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* API Selector */}
          {apis.length > 0 && (
            <div className="flex items-center space-x-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 shrink-0">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={activeApiId || ''}
                onChange={(e) => onSelectApi(e.target.value)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer max-w-[100px] sm:max-w-[130px] truncate"
              >
                {apis.map((a) => (
                  <option key={a.id} value={a.id} className="bg-slate-900 text-slate-200">
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Version Selector */}
          {versions.length > 0 && (
            <div className="flex items-center space-x-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 shrink-0">
              <span className="text-slate-500 text-[10px]">Ver:</span>
              <select
                value={activeVersionId || ''}
                onChange={(e) => onSelectVersion(e.target.value)}
                className="bg-transparent text-emerald-400 font-semibold text-xs focus:outline-none cursor-pointer"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id} className="bg-slate-900 text-slate-200">
                    {v.version}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Analysis History Run Selector */}
          {runs.length > 0 && (
            <div className="hidden xl:flex items-center space-x-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 shrink-0">
              <History className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={activeRunId || ''}
                onChange={(e) => onSelectRun(e.target.value)}
                className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer max-w-[160px] truncate"
              >
                {runs.map((r, idx) => (
                  <option key={r.id} value={r.id} className="bg-slate-900 text-slate-200">
                    {idx === 0 ? 'Latest Run' : `Run #${runs.length - idx}`} ({new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Historical Run Badge */}
          {isHistoricalRun && (
            <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
              <Clock className="w-3 h-3" />
              <span>Historical Run</span>
            </span>
          )}
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center space-x-2 shrink-0">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".yaml,.yml,.json"
          className="hidden"
        />

        {/* Quick Sample Selector */}
        <div className="hidden 2xl:flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <span className="px-2 text-slate-400 font-medium text-[11px]">Sample:</span>
          <button
            onClick={() => onLoadSample('ecommerce')}
            disabled={isAnalyzing}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition text-[11px]"
          >
            Commerce
          </button>
          <button
            onClick={() => onLoadSample('health')}
            disabled={isAnalyzing}
            className="px-2 py-1 rounded hover:bg-slate-800 text-slate-300 transition text-[11px]"
          >
            Health
          </button>
        </div>

        {/* Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isAnalyzing}
          className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition"
        >
          <Upload className="w-3.5 h-3.5 text-slate-400" />
          <span>Upload</span>
        </button>

        {/* Paste Spec Button */}
        <button
          onClick={onOpenPasteModal}
          disabled={isAnalyzing}
          className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition"
        >
          <FileCode2 className="w-3.5 h-3.5 text-slate-400" />
          <span>Paste Spec</span>
        </button>

        {/* Re-run Analysis Button (when active version exists) */}
        {activeVersionId && (
          <button
            onClick={onRerunAnalysis}
            disabled={isAnalyzing}
            title="Explicitly re-run deterministic analysis and persist a new run"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">Re-run</span>
          </button>
        )}

        {/* Primary Analyze Action */}
        <button
          onClick={() => {
            if (activeVersionId) {
              onRerunAnalysis();
            } else if (currentResult?.specRaw) {
              onAnalyze(currentResult.specRaw);
            } else {
              onLoadSample('ecommerce');
            }
          }}
          disabled={isAnalyzing}
          className="flex items-center space-x-2 px-3.5 sm:px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs shadow-md shadow-emerald-500/20 transition disabled:opacity-50"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden sm:inline">Analyzing...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Analyze</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
