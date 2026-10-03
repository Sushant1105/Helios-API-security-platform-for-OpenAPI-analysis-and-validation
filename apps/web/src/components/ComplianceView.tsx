'use client';

import React, { useState } from 'react';
import {
  Award,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  Info,
  ExternalLink,
} from 'lucide-react';
import type { ComplianceReport, ComplianceStandard, ComplianceControlMapping } from '@helios/compliance-engine';

interface ComplianceViewProps {
  compliance: ComplianceReport;
}

const FRAMEWORKS: Array<{ id: ComplianceStandard; name: string; tag: string }> = [
  { id: 'OWASP_API_SECURITY_2023', name: 'OWASP API Security 2023', tag: 'OWASP' },
  { id: 'PCI_DSS_V4_TECHNICAL_CONTROLS', name: 'PCI-DSS v4.0 (Technical Controls)', tag: 'PCI-DSS' },
  { id: 'HIPAA_SECURITY_RULE_TECHNICAL_SAFEGUARDS', name: 'HIPAA Security Safeguards', tag: 'HIPAA' },
];

export function ComplianceView({ compliance }: ComplianceViewProps) {
  const [selectedStandard, setSelectedStandard] = useState<ComplianceStandard>('OWASP_API_SECURITY_2023');

  const mappings = compliance.mappings || [];
  const currentMappings = mappings.filter((m) => m.standard === selectedStandard);

  const getStatusBadge = (status: ComplianceControlMapping['status']) => {
    switch (status) {
      case 'NON_COMPLIANT':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-mono font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center space-x-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Gap Identified</span>
          </span>
        );
      case 'REQUIRES_MANUAL_REVIEW':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-mono font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center space-x-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Insufficient Evidence (Review Required)</span>
          </span>
        );
      case 'COMPLIANT':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Static Indicator Met</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded text-xs font-mono bg-slate-800 text-slate-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Mandatory Statutory Disclaimer */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-start space-x-3">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-200">Regulatory Disclaimer: </span>
          {compliance.disclaimer}
        </div>
      </div>

      {/* Framework Selector Tabs */}
      <div className="flex border-b border-slate-800 space-x-2">
        {FRAMEWORKS.map((fw) => {
          const isSelected = selectedStandard === fw.id;
          const count = mappings.filter((m) => m.standard === fw.id).length;
          const gaps = mappings.filter((m) => m.standard === fw.id && m.status === 'NON_COMPLIANT').length;

          return (
            <button
              key={fw.id}
              onClick={() => setSelectedStandard(fw.id)}
              className={`pb-3 px-4 text-xs font-semibold tracking-tight transition flex items-center space-x-2 border-b-2 -mb-px ${
                isSelected
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{fw.name}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  gaps > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {gaps > 0 ? `${gaps} gaps` : `${count}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Controls List */}
      <div className="space-y-4">
        {currentMappings.map((control) => (
          <div
            key={control.controlId}
            className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-xs font-bold text-slate-200 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {control.controlId}
                  </span>
                  <h3 className="text-sm font-bold text-slate-100">{control.title}</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-3xl">{control.description}</p>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">{getStatusBadge(control.status)}</div>
            </div>

            {/* Matched Findings if NON_COMPLIANT */}
            {control.matchedFindings.length > 0 && (
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400 flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Mapped Security Findings ({control.matchedFindings.length}):</span>
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {control.matchedFindings.map((f) => (
                    <div
                      key={f.id}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono flex items-center justify-between"
                    >
                      <div className="truncate mr-2">
                        <span className="text-rose-400 font-bold mr-2">[{f.ruleId}]</span>
                        <span className="text-slate-300">{f.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 uppercase shrink-0">
                        {f.endpointPath || 'global'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evidence Note for Manual Review */}
            {control.status === 'REQUIRES_MANUAL_REVIEW' && (
              <div className="text-[11px] text-slate-400 italic bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
                No negative static findings identified. However, compliance with {control.controlId} requires operational policies, runtime monitoring, or infrastructure safeguards outside OpenAPI contract scope.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
