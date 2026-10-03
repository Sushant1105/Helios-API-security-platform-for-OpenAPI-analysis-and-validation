'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  FileCode2,
  Upload,
  Play,
  Loader2,
  AlertCircle,
  Sparkles,
  History,
  RefreshCw,
  FolderKanban,
} from 'lucide-react';
import type { PipelineAnalysisResult, PipelineError } from '@helios/analysis-pipeline';
import {
  Header,
  type ProjectHeaderItem,
  type ApiHeaderItem,
  type VersionHeaderItem,
  type RunHeaderItem,
} from '../components/Header';
import { Sidebar, type DashboardSection } from '../components/Sidebar';
import { PasteModal } from '../components/PasteModal';
import { OverviewView } from '../components/OverviewView';
import { ApiExplorerView } from '../components/ApiExplorerView';
import { ValidationView } from '../components/ValidationView';
import { SecurityView } from '../components/SecurityView';
import { ComplianceView } from '../components/ComplianceView';
import { RiskView } from '../components/RiskView';
import { DiffView, type SavedVersionOption } from '../components/DiffView';
import { SdkGeneratorView } from '../components/SdkGeneratorView';
import { AiCopilotView } from '../components/AiCopilotView';
import { ProjectsView } from '../components/ProjectsView';
import { ECOMMERCE_SAMPLE_YAML } from '../lib/samples';

export default function DashboardPage() {
  const [currentSection, setCurrentSection] = useState<DashboardSection>('overview');
  const [analysis, setAnalysis] = useState<PipelineAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<PipelineError | null>(null);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);

  // Persistence Hierarchy State
  const [projects, setProjects] = useState<ProjectHeaderItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [apis, setApis] = useState<ApiHeaderItem[]>([]);
  const [activeApiId, setActiveApiId] = useState<string | null>(null);

  const [versions, setVersions] = useState<VersionHeaderItem[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  const [runs, setRuns] = useState<RunHeaderItem[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isHistoricalRun, setIsHistoricalRun] = useState(false);

  const [allSavedVersions, setAllSavedVersions] = useState<SavedVersionOption[]>([]);

  // Refresh all projects and build flat saved versions list
  const refreshProjectsList = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setProjects(json.data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));

        // Gather saved versions for diff view
        const flattened: SavedVersionOption[] = [];
        for (const p of json.data) {
          const detailRes = await fetch(`/api/projects/${p.id}`);
          const detailJson = await detailRes.json();
          if (detailJson.success && Array.isArray(detailJson.data.apis)) {
            for (const a of detailJson.data.apis) {
              if (Array.isArray(a.versions)) {
                const sortedVersions = [...a.versions].sort((v1: { createdAt?: string | Date }, v2: { createdAt?: string | Date }) => {
                  const t1 = v1.createdAt ? new Date(v1.createdAt).getTime() : 0;
                  const t2 = v2.createdAt ? new Date(v2.createdAt).getTime() : 0;
                  return t1 - t2;
                });
                for (const v of sortedVersions) {
                  flattened.push({
                    id: v.id,
                    version: v.version,
                    apiName: a.name,
                    projectName: p.name,
                  });
                }
              }
            }
          }
        }
        setAllSavedVersions(flattened);
        return json.data;
      }
    } catch {
      // Ignore initial fetch errors
    }
    return [];
  }, []);

  // Load APIs for selected project
  const loadApisForProject = useCallback(async (projId: string) => {
    try {
      const res = await fetch(`/api/projects/${projId}/apis`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const apiList: ApiHeaderItem[] = json.data.map((a: { id: string; name: string }) => ({
          id: a.id,
          name: a.name,
        }));
        setApis(apiList);
        return apiList;
      }
    } catch {
      // Ignore error
    }
    setApis([]);
    return [];
  }, []);

  // Load versions for selected API
  const loadVersionsForApi = useCallback(async (apiId: string) => {
    try {
      const res = await fetch(`/api/apis/${apiId}/versions`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const verList: VersionHeaderItem[] = json.data.map((v: { id: string; version: string }) => ({
          id: v.id,
          version: v.version,
        }));
        setVersions(verList);
        return verList;
      }
    } catch {
      // Ignore error
    }
    setVersions([]);
    return [];
  }, []);

  // Load historical runs for selected Version
  const loadRunsForVersion = useCallback(async (versionId: string) => {
    try {
      const res = await fetch(`/api/versions/${versionId}/runs`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const runList: RunHeaderItem[] = json.data.map(
          (r: { id: string; status: string; createdAt: string }) => ({
            id: r.id,
            status: r.status,
            createdAt: r.createdAt,
          })
        );
        setRuns(runList);
        return runList;
      }
    } catch {
      // Ignore error
    }
    setRuns([]);
    return [];
  }, []);

  // Load persisted analysis run from DB
  const loadHistoricalRun = useCallback(async (runId: string, isHistoric = true) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${runId}`);
      const json = await res.json();
      if (!json.success) {
        setError({
          step: 'PARSE',
          code: 'RUN_LOAD_ERROR',
          message: json.error?.message || 'Failed to load historical run',
        });
      } else {
        setAnalysis(json.data.data);
        setActiveRunId(runId);
        setIsHistoricalRun(isHistoric);
      }
    } catch (err: unknown) {
      setError({
        step: 'PARSE',
        code: 'RUN_LOAD_ERROR',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // Trigger explicit re-analysis on active version and persist run
  const handleRerunAnalysis = async () => {
    if (!activeVersionId) return;

    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`/api/versions/${activeVersionId}/analyze`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!json.success) {
        setError({
          step: 'SECURITY',
          code: json.error?.code || 'ANALYSIS_ERROR',
          message: json.error?.message || 'Re-run analysis failed',
        });
      } else {
        setAnalysis(json.data.data);
        setIsHistoricalRun(false);

        // Reload runs list
        const updatedRuns = await loadRunsForVersion(activeVersionId);
        if (updatedRuns.length > 0) {
          setActiveRunId(updatedRuns[0].id);
        }
      }
    } catch (err: unknown) {
      setError({
        step: 'PARSE',
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Seed default project and API if database is completely empty
  const initializeWorkspace = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const existing = await refreshProjectsList();
      if (existing && existing.length > 0) {
        // Select first project
        const firstProj = existing[0];
        setActiveProjectId(firstProj.id);
        const apiList = await loadApisForProject(firstProj.id);
        if (apiList.length > 0) {
          const firstApi = apiList[0];
          setActiveApiId(firstApi.id);
          const verList = await loadVersionsForApi(firstApi.id);
          if (verList.length > 0) {
            const firstVer = verList[0];
            setActiveVersionId(firstVer.id);
            const runList = await loadRunsForVersion(firstVer.id);
            if (runList.length > 0) {
              await loadHistoricalRun(runList[0].id, false);
            } else {
              // Analyze initial version
              const analyzeRes = await fetch(`/api/versions/${firstVer.id}/analyze`, { method: 'POST' });
              const analyzeJson = await analyzeRes.json();
              if (analyzeJson.success) {
                setAnalysis(analyzeJson.data.data);
                const updatedRuns = await loadRunsForVersion(firstVer.id);
                if (updatedRuns.length > 0) setActiveRunId(updatedRuns[0].id);
              }
            }
          }
        }
      } else {
        // DB is empty: Seed initial Project -> API -> Version v1.0.0
        const pRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Commerce & Payments Platform',
            description: 'Core microservices portfolio and security posture audits',
          }),
        });
        const pJson = await pRes.json();
        if (pJson.success) {
          const newProj = pJson.data;
          setActiveProjectId(newProj.id);

          const aRes = await fetch(`/api/projects/${newProj.id}/apis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'Helios Commerce API',
              description: 'High-throughput e-commerce platform microservice',
            }),
          });
          const aJson = await aRes.json();
          if (aJson.success) {
            const newApi = aJson.data;
            setActiveApiId(newApi.id);

            const vRes = await fetch(`/api/apis/${newApi.id}/versions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                version: 'v1.0.0',
                specContent: ECOMMERCE_SAMPLE_YAML,
                autoAnalyze: true,
              }),
            });
            const vJson = await vRes.json();
            if (vJson.success) {
              const newVer = vJson.data.version;
              setActiveVersionId(newVer.id);
              if (vJson.data.analysis) {
                setAnalysis(vJson.data.analysis);
              }
              await refreshProjectsList();
              await loadApisForProject(newProj.id);
              await loadVersionsForApi(newApi.id);
              const updatedRuns = await loadRunsForVersion(newVer.id);
              if (updatedRuns.length > 0) setActiveRunId(updatedRuns[0].id);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to initialize persistent workspace:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    refreshProjectsList,
    loadApisForProject,
    loadVersionsForApi,
    loadRunsForVersion,
    loadHistoricalRun,
  ]);

  useEffect(() => {
    initializeWorkspace();
  }, [initializeWorkspace]);

  // Handle Project Selection from Dropdown
  const handleSelectProject = async (projId: string) => {
    setActiveProjectId(projId);
    const apiList = await loadApisForProject(projId);
    if (apiList.length > 0) {
      handleSelectApi(apiList[0].id);
    } else {
      setActiveApiId(null);
      setVersions([]);
      setActiveVersionId(null);
      setRuns([]);
      setActiveRunId(null);
      setAnalysis(null);
    }
  };

  // Handle API Selection from Dropdown
  const handleSelectApi = async (apiId: string) => {
    setActiveApiId(apiId);
    const verList = await loadVersionsForApi(apiId);
    if (verList.length > 0) {
      handleSelectVersion(verList[0].id);
    } else {
      setVersions([]);
      setActiveVersionId(null);
      setRuns([]);
      setActiveRunId(null);
      setAnalysis(null);
    }
  };

  // Handle Version Selection from Dropdown
  const handleSelectVersion = async (verId: string) => {
    setActiveVersionId(verId);
    const runList = await loadRunsForVersion(verId);
    if (runList.length > 0) {
      await loadHistoricalRun(runList[0].id, false);
    } else {
      // Auto analyze if no runs
      setIsAnalyzing(true);
      try {
        const analyzeRes = await fetch(`/api/versions/${verId}/analyze`, { method: 'POST' });
        const analyzeJson = await analyzeRes.json();
        if (analyzeJson.success) {
          setAnalysis(analyzeJson.data.data);
          const updatedRuns = await loadRunsForVersion(verId);
          if (updatedRuns.length > 0) setActiveRunId(updatedRuns[0].id);
        }
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  // Handle selection from ProjectsView
  const handleSelectVersionFromProjectsView = async (
    projId: string,
    apiId: string,
    verId: string
  ) => {
    setActiveProjectId(projId);
    await loadApisForProject(projId);
    setActiveApiId(apiId);
    await loadVersionsForApi(apiId);
    await handleSelectVersion(verId);
    setCurrentSection('overview');
  };

  // Fallback ad-hoc Analyze (creates version under active API or runs ad-hoc)
  const handleAdHocAnalyze = async (specContent: string) => {
    if (activeApiId) {
      // Persist as new version if active API is selected
      try {
        const verTag = `v${versions.length + 1}.0.0`;
        const res = await fetch(`/api/apis/${activeApiId}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: verTag,
            specContent,
            autoAnalyze: true,
          }),
        });
        const json = await res.json();
        if (json.success) {
          await loadVersionsForApi(activeApiId);
          await handleSelectVersion(json.data.version.id);
          await refreshProjectsList();
          return;
        }
      } catch {
        // Fall back to direct analyze
      }
    }

    // Direct ad-hoc analyze
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specContent }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error);
      } else {
        setAnalysis(json.data);
      }
    } catch (err: unknown) {
      setError({
        step: 'PARSE',
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Load sample specification
  const handleLoadSample = async (sampleKey: 'ecommerce' | 'ecommerceV2' | 'health') => {
    try {
      const res = await fetch('/api/samples');
      const json = await res.json();
      const spec = json[sampleKey];
      if (spec) {
        handleAdHocAnalyze(spec);
      }
    } catch (err) {
      setError({
        step: 'PARSE',
        code: 'SAMPLE_LOAD_ERROR',
        message: `Failed to load sample specification: ${err}`,
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header */}
      <Header
        currentResult={analysis}
        isAnalyzing={isAnalyzing}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={handleSelectProject}
        apis={apis}
        activeApiId={activeApiId}
        onSelectApi={handleSelectApi}
        versions={versions}
        activeVersionId={activeVersionId}
        onSelectVersion={handleSelectVersion}
        runs={runs}
        activeRunId={activeRunId}
        onSelectRun={(runId) => loadHistoricalRun(runId, true)}
        isHistoricalRun={isHistoricalRun}
        onRerunAnalysis={handleRerunAnalysis}
        onAnalyze={handleAdHocAnalyze}
        onOpenPasteModal={() => setIsPasteModalOpen(true)}
        onLoadSample={handleLoadSample}
      />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentSection={currentSection}
          onSelectSection={setCurrentSection}
          analysis={analysis}
        />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Historical Run Notice Banner */}
            {isHistoricalRun && activeRunId && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2 text-amber-300">
                  <History className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    Viewing Historical Analysis Run (ID: <code className="font-mono">{activeRunId.slice(0, 8)}</code>). Persisted from database without re-executing.
                  </span>
                </div>
                <button
                  onClick={handleRerunAnalysis}
                  disabled={isAnalyzing}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-semibold transition self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>Re-run Analysis</span>
                </button>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-mono space-y-1">
                <div className="flex items-center space-x-2 text-rose-400 font-bold">
                  <AlertCircle className="w-4 h-4" />
                  <span>Pipeline Failure during [{error.step}]</span>
                  <span className="text-slate-400 font-normal">({error.code})</span>
                </div>
                <p className="text-rose-200">{error.message}</p>
              </div>
            )}

            {/* Loading Overlay */}
            {isAnalyzing && (
              <div className="p-16 text-center rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-200">
                    Executing Deterministic Analysis Pipeline...
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Ingesting spec → Normalizing Canonical AST → Validator → Security Engine → Compliance & Risk
                  </p>
                </div>
              </div>
            )}

            {/* Empty State when no spec is analyzed */}
            {!isAnalyzing && !analysis && !error && currentSection !== 'projects' && (
              <div className="p-16 text-center rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center space-y-4">
                <FileCode2 className="w-12 h-12 text-slate-600" />
                <div className="space-y-1 max-w-md">
                  <h3 className="text-base font-bold text-slate-200">
                    No API Specification Loaded
                  </h3>
                  <p className="text-xs text-slate-400">
                    Upload an OpenAPI YAML/JSON file, create a persistent version, or load a sample API to begin analysis.
                  </p>
                </div>
                <div className="flex items-center space-x-3 pt-2">
                  <button
                    onClick={() => setCurrentSection('projects')}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs transition"
                  >
                    <FolderKanban className="w-3.5 h-3.5" />
                    <span>Manage Projects &amp; APIs</span>
                  </button>
                  <button
                    onClick={() => setIsPasteModalOpen(true)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition"
                  >
                    Paste OpenAPI Spec
                  </button>
                </div>
              </div>
            )}

            {/* Active Section Views */}
            {currentSection === 'projects' && (
              <ProjectsView
                onSelectVersion={handleSelectVersionFromProjectsView}
                onRefreshNeeded={refreshProjectsList}
              />
            )}

            {!isAnalyzing && analysis && (
              <>
                {currentSection === 'overview' && (
                  <OverviewView result={analysis} onNavigate={setCurrentSection} />
                )}
                {currentSection === 'explorer' && <ApiExplorerView ast={analysis.ast} />}
                {currentSection === 'validation' && (
                  <ValidationView validation={analysis.validation} />
                )}
                {currentSection === 'security' && <SecurityView security={analysis.security} />}
                {currentSection === 'compliance' && (
                  <ComplianceView compliance={analysis.compliance} />
                )}
                {currentSection === 'risk' && (
                  <RiskView risk={analysis.compliance.riskScore} security={analysis.security} />
                )}
                {currentSection === 'diff' && (
                  <DiffView
                    currentSpecRaw={analysis.specRaw}
                    savedVersions={allSavedVersions}
                  />
                )}
                {currentSection === 'sdk' && <SdkGeneratorView ast={analysis.ast} />}
                {currentSection === 'copilot' && <AiCopilotView analysis={analysis} />}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Paste Spec Modal */}
      <PasteModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        onAnalyze={handleAdHocAnalyze}
        initialContent={analysis?.specRaw || ''}
      />
    </div>
  );
}
