'use client';

import React from 'react';
import {
  FolderKanban,
  LayoutDashboard,
  Compass,
  CheckCircle2,
  ShieldCheck,
  Award,
  Activity,
  GitCompare,
  Binary,
  Bot,
} from 'lucide-react';
import type { PipelineAnalysisResult } from '@helios/analysis-pipeline';

export type DashboardSection =
  | 'projects'
  | 'overview'
  | 'explorer'
  | 'validation'
  | 'security'
  | 'compliance'
  | 'risk'
  | 'diff'
  | 'sdk'
  | 'copilot';

interface SidebarProps {
  currentSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  analysis: PipelineAnalysisResult | null;
}

export function Sidebar({
  currentSection,
  onSelectSection,
  analysis,
}: SidebarProps) {
  const navItems: Array<{
    id: DashboardSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    badgeColor?: string;
  }> = [
    {
      id: 'projects',
      label: 'Projects & APIs',
      icon: FolderKanban,
    },
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'explorer',
      label: 'API Explorer',
      icon: Compass,
      badge: analysis?.stats.endpointsCount,
      badgeColor: 'bg-slate-800 text-slate-300',
    },
    {
      id: 'validation',
      label: 'Validation',
      icon: CheckCircle2,
      badge: analysis ? analysis.validation.findings.length : undefined,
      badgeColor:
        analysis && analysis.validation.stats.errorCount > 0
          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
          : 'bg-slate-800 text-slate-300',
    },
    {
      id: 'security',
      label: 'Security Engine',
      icon: ShieldCheck,
      badge: analysis ? analysis.security.findings.length : undefined,
      badgeColor:
        analysis && analysis.security.summary.critical > 0
          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    },
    {
      id: 'compliance',
      label: 'Compliance',
      icon: Award,
      badge: analysis ? `${analysis.stats.complianceGapsCount} gaps` : undefined,
      badgeColor:
        analysis && analysis.stats.complianceGapsCount > 0
          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    },
    {
      id: 'risk',
      label: 'Risk Posture',
      icon: Activity,
      badge: analysis ? `${analysis.stats.overallRiskScore}/100` : undefined,
      badgeColor:
        analysis && analysis.stats.overallRiskScore < 60
          ? 'bg-rose-500/20 text-rose-400'
          : 'bg-emerald-500/20 text-emerald-400',
    },
    {
      id: 'diff',
      label: 'Semantic Diff',
      icon: GitCompare,
    },
    {
      id: 'sdk',
      label: 'SDK Generator',
      icon: Binary,
    },
    {
      id: 'copilot',
      label: 'AI Copilot',
      icon: Bot,
      badge: 'Local',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col shrink-0">
      <div className="p-4 flex-1 space-y-1">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500 space-y-1">
        <div className="flex justify-between items-center font-mono">
          <span>Engine Status:</span>
          <span className="text-emerald-400">Deterministic</span>
        </div>
        <div className="flex justify-between items-center font-mono">
          <span>Ollama LLM:</span>
          <span className="text-slate-400">Ground-Truth Guarded</span>
        </div>
      </div>
    </aside>
  );
}
