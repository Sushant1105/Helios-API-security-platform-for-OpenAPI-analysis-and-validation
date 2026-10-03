'use client';

import React, { useState } from 'react';
import {
  Bot,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Layers,
  ShieldCheck,
  Award,
  GitCompare,
  FileCode2,
  Info,
} from 'lucide-react';
import type { PipelineAnalysisResult } from '@helios/analysis-pipeline';
import type { VerifiedAiAnswer, GroundTruthStatus } from '@helios/ai-engine';

interface AiCopilotViewProps {
  analysis: PipelineAnalysisResult;
}

const PRESET_QUESTIONS = [
  'Explain security finding AUTH-001 in detail',
  'Why is the GET /admin/users endpoint risky?',
  'Explain PCI-DSS technical compliance gaps',
  'What are the primary attack vectors in this API?',
  'Summarize sensitive object data exposure risks',
];

export function AiCopilotView({ analysis }: AiCopilotViewProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copilotResponse, setCopilotResponse] = useState<{
    answer: VerifiedAiAnswer;
    isOllamaRunning: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async (questionText: string) => {
    if (!questionText.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ast: analysis.ast,
          query: questionText,
          context: {
            securityFindings: analysis.security.findings,
            validationFindings: analysis.validation.findings,
            complianceMappings: analysis.compliance.mappings,
          },
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || 'Copilot query failed.');
      } else {
        setCopilotResponse({
          answer: json.data,
          isOllamaRunning: json.data.isOllamaRunning,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: GroundTruthStatus) => {
    switch (status) {
      case 'verified':
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>VERIFIED BY CANONICAL AST</span>
          </div>
        );
      case 'partially_verified':
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>PARTIALLY VERIFIED</span>
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="w-4 h-4 text-rose-400" />
            <span>REJECTED (HALLUCINATION DETECTED)</span>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Engine Status Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <Bot className="w-5 h-5 text-emerald-400" />
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-100">HELIOS Grounded Copilot</h3>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                AST-VALIDATED
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Answers are cross-verified against Canonical AST & deterministic findings. Untrusted claims are flagged or rejected.
            </p>
          </div>
        </div>

        {/* Ollama Connection Indicator */}
        <div className="text-[11px] font-mono px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-400 flex items-center space-x-2">
          <span
            className={`w-2 h-2 rounded-full ${
              copilotResponse?.isOllamaRunning ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span>
            {copilotResponse?.isOllamaRunning
              ? 'Local Ollama: Connected (localhost:11434)'
              : 'Local Ollama: Offline (Local Deterministic Assistant Active)'}
          </span>
        </div>
      </div>

      {/* Preset Question Chips */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
          Suggested Analytical Inquiries
        </span>
        <div className="flex flex-wrap gap-2">
          {PRESET_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => {
                setQuery(q);
                handleAsk(q);
              }}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs transition text-left"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input Box */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center space-x-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAsk(query);
          }}
          placeholder="Ask HELIOS about security flaws, risk reasons, compliance controls..."
          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
        />
        <button
          onClick={() => handleAsk(query)}
          disabled={isLoading || !query.trim()}
          className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs flex items-center space-x-2 transition disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Ask</span>
            </>
          )}
        </button>
      </div>

      {/* Error View */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
          <span className="font-bold">Copilot Error: </span> {error}
        </div>
      )}

      {/* Verified AI Answer Display */}
      {copilotResponse && (
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-6">
          {/* Header Row: Verification Status & Confidence */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
            <div className="flex items-center space-x-3">
              {getStatusBadge(copilotResponse.answer.status)}
              <span className="text-xs font-mono text-slate-400">
                Confidence: <strong className="text-slate-200">{copilotResponse.answer.originalAnswer?.confidence || 'HIGH'}</strong>
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Verified at: {new Date(copilotResponse.answer.verificationTimestamp).toLocaleTimeString()}
            </span>
          </div>

          {/* If Status is Rejected: Prominent Safety Alert */}
          {copilotResponse.answer.status === 'rejected' && (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono">
              <strong className="block mb-1">Safety Alert: Output Rejected</strong>
              HELIOS could not verify this AI response against the available API evidence. All referenced endpoints, schemas, or findings were hallucinations not present in the Canonical AST.
            </div>
          )}

          {/* Narrative Text */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              AI Explanation
            </h4>
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap">
              {copilotResponse.answer.verifiedAnswer}
            </div>
          </div>

          {/* Ground-Truth Citations / Evidence */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Ground-Truth Verification Citations
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
              {/* Endpoints */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] uppercase block">Verified Endpoints</span>
                {copilotResponse.answer.validReferences.endpoints.length === 0 ? (
                  <span className="text-slate-500 italic text-[11px]">None cited</span>
                ) : (
                  copilotResponse.answer.validReferences.endpoints.map((ep) => (
                    <div key={ep} className="text-emerald-400 font-semibold truncate">
                      {ep}
                    </div>
                  ))
                )}
              </div>

              {/* Security Findings */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] uppercase block">Verified Findings</span>
                {copilotResponse.answer.validReferences.findings.length === 0 ? (
                  <span className="text-slate-500 italic text-[11px]">None cited</span>
                ) : (
                  copilotResponse.answer.validReferences.findings.map((f) => (
                    <div key={f} className="text-rose-400 font-semibold truncate">
                      {f}
                    </div>
                  ))
                )}
              </div>

              {/* Compliance Controls */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] uppercase block">Verified Controls</span>
                {copilotResponse.answer.validReferences.controls.length === 0 ? (
                  <span className="text-slate-500 italic text-[11px]">None cited</span>
                ) : (
                  copilotResponse.answer.validReferences.controls.map((c) => (
                    <div key={c} className="text-purple-400 font-semibold truncate">
                      {c}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Hallucinations Detected (if any) */}
          {copilotResponse.answer.hallucinationsDetected.length > 0 && (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs font-mono space-y-2">
              <span className="text-rose-400 font-bold block">
                Hallucinations Detected ({copilotResponse.answer.hallucinationsDetected.length}):
              </span>
              {copilotResponse.answer.hallucinationsDetected.map((h, i) => (
                <div key={i} className="text-rose-300">
                  <span className="font-semibold text-rose-400">[{h.type}] </span>
                  {h.reference}: {h.details}
                </div>
              ))}
            </div>
          )}

          {/* Limitations */}
          {copilotResponse.answer.originalAnswer?.limitations?.length > 0 && (
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <span className="font-semibold text-slate-300 block">Limitations & Static Constraints:</span>
              <ul className="list-disc list-inside space-y-0.5">
                {copilotResponse.answer.originalAnswer.limitations.map((lim, i) => (
                  <li key={i}>{lim}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
