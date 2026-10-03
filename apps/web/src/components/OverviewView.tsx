'use client';

import React from 'react';
import {
  CheckCircle2,
  ShieldCheck,
  Award,
  Activity,
  Server,
  Layers,
  FileCode2,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';
import type { PipelineAnalysisResult } from '@helios/analysis-pipeline';
import type { DashboardSection } from './Sidebar';

interface OverviewViewProps {
  result: PipelineAnalysisResult;
  onNavigate: (section: DashboardSection) => void;
}

export function OverviewView({ result, onNavigate }: OverviewViewProps) {
  const { ast, validation, security, compliance, stats } = result;

  return (
    <div className="space-y-6">
      {/* Top Banner: Specification Metadata */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">
              {ast.title || 'Untitled API'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              v{ast.version || '1.0.0'}
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
              OpenAPI {ast.specVersion}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400 max-w-2xl">
            {ast.info.description || 'No description provided in specification.'}
          </p>
        </div>

        {/* Structural Metrics */}
        <div className="flex items-center space-x-4 text-xs font-mono bg-slate-950/60 p-3 rounded-lg border border-slate-800">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-slate-200 font-bold">{stats.endpointsCount}</div>
              <div className="text-[10px] text-slate-500">Endpoints</div>
            </div>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div className="flex items-center space-x-2">
            <FileCode2 className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-slate-200 font-bold">{stats.schemasCount}</div>
              <div className="text-[10px] text-slate-500">Schemas</div>
            </div>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-purple-400" />
            <div>
              <div className="text-slate-200 font-bold">{stats.serversCount}</div>
              <div className="text-[10px] text-slate-500">Servers</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Core Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. Validation Card */}
        <div
          onClick={() => onNavigate('validation')}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Validation</span>
              <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-bold font-mono text-slate-100">
                {validation.findings.length}
              </span>
              <span className="text-xs text-slate-400">findings</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-rose-400 font-semibold">{validation.stats.errorCount} Errors</span>
            <span className="text-amber-400 font-semibold">{validation.stats.warningCount} Warnings</span>
            <span className="text-slate-400">{validation.stats.infoCount} Info</span>
          </div>
        </div>

        {/* 2. Security Audit Card */}
        <div
          onClick={() => onNavigate('security')}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Security Engine</span>
              <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-bold font-mono text-emerald-400">
                {security.score}
              </span>
              <span className="text-xs text-slate-400">/100 score</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-rose-500 font-semibold">{security.summary.critical} Crit</span>
            <span className="text-rose-400 font-semibold">{security.summary.high} High</span>
            <span className="text-amber-400 font-semibold">{security.summary.medium} Med</span>
            <span className="text-slate-400">{security.summary.low} Low</span>
          </div>
        </div>

        {/* 3. Compliance Card */}
        <div
          onClick={() => onNavigate('compliance')}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Compliance</span>
              <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-bold font-mono text-rose-400">
                {stats.complianceGapsCount}
              </span>
              <span className="text-xs text-slate-400">technical gaps</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">3 Frameworks</span>
            <span className="text-emerald-400 font-semibold">
              {compliance.mappings.filter((m) => m.status === 'COMPLIANT').length} Passed
            </span>
            <span className="text-amber-400 font-semibold">
              {compliance.mappings.filter((m) => m.status === 'REQUIRES_MANUAL_REVIEW').length} Review
            </span>
          </div>
        </div>

        {/* 4. Risk Card */}
        <div
          onClick={() => onNavigate('risk')}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall Posture</span>
              <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span
                className={`text-2xl font-bold font-mono ${
                  stats.overallRiskScore < 60
                    ? 'text-rose-400'
                    : stats.overallRiskScore < 80
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {stats.overallRiskScore}
              </span>
              <span className="text-xs text-slate-400">/100 risk score</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Posture:</span>
            <span
              className={`font-semibold font-mono ${
                stats.overallRiskScore < 60
                  ? 'text-rose-400'
                  : stats.overallRiskScore < 80
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {stats.overallRiskScore < 60
                ? 'Elevated Risk'
                : stats.overallRiskScore < 80
                ? 'Moderate Risk'
                : 'Optimal Posture'}
            </span>
          </div>
        </div>
      </div>

      {/* Breakdown Section: Severity Distribution & Category Posture */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Finding Severity Breakdown */}
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4 flex items-center justify-between">
            <span>Security Finding Breakdown</span>
            <span className="text-xs font-mono font-normal text-slate-400">{security.findings.length} Total</span>
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Critical', count: security.summary.critical, color: 'bg-rose-500', text: 'text-rose-400' },
              { label: 'High', count: security.summary.high, color: 'bg-rose-400', text: 'text-rose-300' },
              { label: 'Medium', count: security.summary.medium, color: 'bg-amber-400', text: 'text-amber-300' },
              { label: 'Low', count: security.summary.low, color: 'bg-cyan-400', text: 'text-cyan-300' },
              { label: 'Info', count: security.summary.info, color: 'bg-slate-500', text: 'text-slate-400' },
            ].map((row) => {
              const pct = security.findings.length > 0 ? Math.round((row.count / security.findings.length) * 100) : 0;
              return (
                <div key={row.label} className="text-xs">
                  <div className="flex justify-between font-mono mb-1">
                    <span className={row.text}>{row.label}</span>
                    <span className="text-slate-400">
                      {row.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div className={`h-full ${row.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Risk Categories */}
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4 flex items-center justify-between">
            <span>Risk Category Posture</span>
            <span className="text-xs font-mono font-normal text-emerald-400">Weighted Scoring</span>
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Authentication', score: compliance.riskScore.categoryScores.authentication, weight: '30%' },
              { label: 'Data Protection', score: compliance.riskScore.categoryScores.dataProtection, weight: '25%' },
              { label: 'Authorization', score: compliance.riskScore.categoryScores.authorization, weight: '20%' },
              { label: 'Input Validation', score: compliance.riskScore.categoryScores.inputValidation, weight: '15%' },
              { label: 'Configuration', score: compliance.riskScore.categoryScores.configuration, weight: '10%' },
            ].map((cat) => {
              const color =
                cat.score < 60 ? 'bg-rose-500' : cat.score < 85 ? 'bg-amber-400' : 'bg-emerald-500';
              return (
                <div key={cat.label} className="text-xs">
                  <div className="flex justify-between font-mono mb-1">
                    <span className="text-slate-300">
                      {cat.label} <span className="text-slate-500 text-[10px]">({cat.weight})</span>
                    </span>
                    <span className="text-slate-400 font-bold">{cat.score} / 100</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div className={`h-full ${color}`} style={{ width: `${cat.score}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
