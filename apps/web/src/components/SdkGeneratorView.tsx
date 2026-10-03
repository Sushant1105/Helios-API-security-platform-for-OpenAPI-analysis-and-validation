'use client';

import React, { useState } from 'react';
import {
  Binary,
  Loader2,
  FileCode,
  Download,
  Copy,
  Check,
  Info,
  CheckCircle2,
} from 'lucide-react';
import type { CanonicalApiAst } from '@helios/canonical-ast';
import type { GeneratedSdk, GeneratedFile } from '@helios/sdk-generator';

interface SdkGeneratorViewProps {
  ast: CanonicalApiAst;
}

export function SdkGeneratorView({ ast }: SdkGeneratorViewProps) {
  const [target, setTarget] = useState<'typescript' | 'python'>('typescript');
  const [packageName, setPackageName] = useState(
    target === 'python' ? 'helios_client' : 'helios-client'
  );
  const [packageVersion, setPackageVersion] = useState('1.0.0');
  const [clientClassName, setClientClassName] = useState('ApiClient');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSdk, setGeneratedSdk] = useState<GeneratedSdk | null>(null);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTargetChange = (newTarget: 'typescript' | 'python') => {
    setTarget(newTarget);
    setPackageName(newTarget === 'python' ? 'helios_client' : 'helios-client');
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/generate-sdk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ast,
          target,
          packageName,
          packageVersion,
          clientClassName,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || 'SDK generation failed.');
      } else {
        setGeneratedSdk(json.data);
        if (json.data.files?.length > 0) {
          setSelectedFile(json.data.files[0]);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!selectedFile) return;
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    if (!selectedFile) return;
    const blob = new Blob([selectedFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.path.split('/').pop() || 'file.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Target & Options Config Card */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-6">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
            Generate Typed Client SDK
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Emit idiomatic, deterministic SDK packages directly from the Canonical AST.
          </p>
        </div>

        {/* Target Language Toggle */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleTargetChange('typescript')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold font-mono transition flex items-center space-x-2 border ${
              target === 'typescript'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 shadow-sm'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <span>TypeScript (Fetch / NPM)</span>
          </button>
          <button
            onClick={() => handleTargetChange('python')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold font-mono transition flex items-center space-x-2 border ${
              target === 'python'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 shadow-sm'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <span>Python 3.10+ (urllib / @dataclass)</span>
          </button>
        </div>

        {/* Config Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <label className="text-slate-400 block mb-1">Package Name</label>
            <input
              type="text"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              className="w-full p-2 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Version</label>
            <input
              type="text"
              value={packageVersion}
              onChange={(e) => setPackageVersion(e.target.value)}
              className="w-full p-2 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Client Class Name</label>
            <input
              type="text"
              value={clientClassName}
              onChange={(e) => setClientClassName(e.target.value)}
              className="w-full p-2 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
          <div className="text-[11px] text-slate-500 font-mono">
            Supported Targets: TypeScript & Python. Unsupported: WebSockets, SSE streams.
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs transition disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Compiling SDK...</span>
              </>
            ) : (
              <>
                <Binary className="w-4 h-4" />
                <span>Generate Client SDK</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error View */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
          <span className="font-bold">Generator Error: </span> {error}
        </div>
      )}

      {/* Generated SDK Output View */}
      {generatedSdk && (
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-100">
                Generated {target.toUpperCase()} SDK ({generatedSdk.files.length} files)
              </h3>
            </div>
            {generatedSdk.stats && (
              <span className="text-xs font-mono text-slate-400">
                Endpoints Covered: {generatedSdk.stats.totalEndpointsCovered} | Models: {generatedSdk.stats.totalModelsGenerated}
              </span>
            )}
          </div>

          {/* Explorer Layout: File Tree & Syntax Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[350px]">
            {/* File List */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1 font-mono text-xs overflow-y-auto max-h-[450px]">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider px-2 py-1">
                Package Files
              </div>
              {generatedSdk.files.map((f) => (
                <button
                  key={f.path}
                  onClick={() => setSelectedFile(f)}
                  className={`w-full text-left px-2.5 py-1.5 rounded transition flex items-center space-x-2 ${
                    selectedFile?.path === f.path
                      ? 'bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{f.path}</span>
                </button>
              ))}
            </div>

            {/* Code Content Preview */}
            <div className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-lg flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
                <span className="font-mono text-xs text-slate-300 font-semibold">
                  {selectedFile?.path || 'No file selected'}
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleCopy}
                    disabled={!selectedFile}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition text-xs flex items-center space-x-1"
                    title="Copy code to clipboard"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={handleDownloadFile}
                    disabled={!selectedFile}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition text-xs flex items-center space-x-1"
                    title="Download file"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <pre className="p-4 flex-1 overflow-x-auto text-[11px] font-mono text-slate-300 leading-relaxed max-h-[400px]">
                {selectedFile?.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
