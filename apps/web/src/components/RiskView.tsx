'use client';

import React from 'react';
import { Activity, ShieldAlert, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import type { RiskScoreBreakdown } from '@helios/compliance-engine';
import type { SecurityAuditResult } from '@helios/security-engine';

interface RiskViewProps {
  risk: RiskScoreBreakdown;
  security: SecurityAuditResult;
}

export function RiskView({ risk, security }: RiskViewProps) {
  const { overallScore, categoryScores, weightingsApplied, formulaDescription } = risk;

  const getScoreColor = (score: number) => {
    if (score < 60) return 'text-rose-400';
    if (score < 80) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const getScoreBg = (score: number) => {
    if (score < 60) return 'bg-rose-500';
    if (score < 80) return 'bg-amber-400';
    return 'bg-emerald-500';
  };

  return (
    <div className="space-y-6">
      {/* Disclaimer Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-start space-x-3">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-200">Deterministic Methodology: </span>
          The HELIOS Risk Score is a deterministic, rule-based mathematical index evaluating declared interface exposure and static vulnerabilities. It is not an empirical guarantee of runtime security posture.
        </div>
      </div>

      {/* Main Score & Gauge Card */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Overall Security Posture Score
          </span>
          <div className="flex items-baseline justify-center md:justify-start space-x-3">
            <span className={`text-5xl font-black font-mono tracking-tight ${getScoreColor(overallScore)}`}>
              {overallScore}
            </span>
            <span className="text-slate-400 text-sm font-mono font-semibold">/ 100</span>
          </div>
          <p className="text-xs text-slate-400 max-w-xl font-mono">
            {overallScore >= 80
              ? 'Optimal Posture: High alignment with API security best practices and minimal interface exposure.'
              : overallScore >= 60
              ? 'Moderate Risk: Potential misconfigurations or unauthenticated endpoints requiring architectural review.'
              : 'Elevated Risk: Critical vulnerabilities or insecure cleartext endpoints detected requiring remediation.'}
          </p>
        </div>

        {/* Formula Explanation Pill */}
        <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 max-w-md font-mono space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            Scoring Formula Applied
          </div>
          <p className="text-[11px] text-slate-500">{formulaDescription}</p>
        </div>
      </div>

      {/* Category Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            key: 'authentication',
            label: 'Authentication',
            score: categoryScores.authentication,
            weight: weightingsApplied['authentication'] ? `${weightingsApplied['authentication'] * 100}%` : '30%',
            desc: 'Verification of identity schemes, token configurations, and public route boundaries.',
          },
          {
            key: 'dataProtection',
            label: 'Data Protection & Transport',
            score: categoryScores.dataProtection,
            weight: weightingsApplied['dataProtection'] ? `${weightingsApplied['dataProtection'] * 100}%` : '25%',
            desc: 'TLS transport encryption, avoidance of cleartext HTTP, and sensitive field masking.',
          },
          {
            key: 'authorization',
            label: 'Authorization Boundaries',
            score: categoryScores.authorization,
            weight: weightingsApplied['authorization'] ? `${weightingsApplied['authorization'] * 100}%` : '20%',
            desc: 'Object-level and function-level access control indicators on mutating methods.',
          },
          {
            key: 'inputValidation',
            label: 'Input Validation & Resources',
            score: categoryScores.inputValidation,
            weight: weightingsApplied['inputValidation'] ? `${weightingsApplied['inputValidation'] * 100}%` : '15%',
            desc: 'Array/string length bounds, numeric constraints, pagination, and upload limits.',
          },
          {
            key: 'configuration',
            label: 'Security Configuration',
            score: categoryScores.configuration,
            weight: weightingsApplied['configuration'] ? `${weightingsApplied['configuration'] * 100}%` : '10%',
            desc: 'Server specifications, unused security schemes, and inventory management.',
          },
        ].map((cat) => (
          <div
            key={cat.key}
            className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-slate-200">{cat.label}</span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  Weight: {cat.weight}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">{cat.desc}</p>
            </div>

            <div>
              <div className="flex justify-between items-baseline font-mono text-xs mb-1.5">
                <span className="text-slate-400">Sub-Score:</span>
                <span className={`font-bold ${getScoreColor(cat.score)}`}>{cat.score} / 100</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div className={`h-full ${getScoreBg(cat.score)}`} style={{ width: `${cat.score}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Finding Deductions Contributor Table */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
          Risk Deductions by Security Finding
        </h3>
        {security.findings.length === 0 ? (
          <div className="text-xs text-slate-500 italic">No deductions applied. Clean posture.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left font-mono">
              <thead className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="pb-2">Finding ID</th>
                  <th className="pb-2">Severity</th>
                  <th className="pb-2">Category</th>
                  <th className="pb-2">Target</th>
                  <th className="pb-2 text-right">Score Deduction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {security.findings.map((f) => {
                  const deduction =
                    f.severity === 'CRITICAL'
                      ? -25
                      : f.severity === 'HIGH'
                      ? -15
                      : f.severity === 'MEDIUM'
                      ? -7
                      : f.severity === 'LOW'
                      ? -2
                      : 0;

                  return (
                    <tr key={f.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 font-bold text-slate-200">{f.ruleId}</td>
                      <td className="py-2.5">
                        <span
                          className={`font-semibold ${
                            f.severity === 'CRITICAL' || f.severity === 'HIGH'
                              ? 'text-rose-400'
                              : f.severity === 'MEDIUM'
                              ? 'text-amber-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {f.severity}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-400">{f.category}</td>
                      <td className="py-2.5 text-slate-400 truncate max-w-[200px]">
                        {f.endpointPath || 'global'}
                      </td>
                      <td className="py-2.5 text-right font-bold text-rose-400">
                        {deduction === 0 ? '0' : `${deduction} pts`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
