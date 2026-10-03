'use client';

import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Plus,
  Layers,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Calendar,
  Sparkles,
  Loader2,
  AlertCircle,
  FileCode2,
  Upload,
} from 'lucide-react';
import type { PipelineAnalysisResult } from '@helios/analysis-pipeline';

export interface ProjectWithApis {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  apis: Array<{
    id: string;
    projectId: string;
    name: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
    versions: Array<{
      id: string;
      apiId: string;
      version: string;
      format: string;
      openapiVersion: string;
      contentHash: string;
      createdAt: string;
      analysisRuns: Array<{
        id: string;
        status: string;
        createdAt: string;
        completedAt: string | null;
      }>;
    }>;
  }>;
}

interface ProjectsViewProps {
  onSelectVersion: (projectId: string, apiId: string, versionId: string) => void;
  onRefreshNeeded?: () => void;
}

export function ProjectsView({ onSelectVersion, onRefreshNeeded }: ProjectsViewProps) {
  const [projects, setProjects] = useState<ProjectWithApis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  const [isNewApiModalOpen, setIsNewApiModalOpen] = useState(false);
  const [selectedProjectIdForApi, setSelectedProjectIdForApi] = useState<string | null>(null);
  const [newApiName, setNewApiName] = useState('');
  const [newApiDesc, setNewApiDesc] = useState('');

  const [isNewVersionModalOpen, setIsNewVersionModalOpen] = useState(false);
  const [selectedApiForVersion, setSelectedApiForVersion] = useState<{ projectId: string; apiId: string } | null>(null);
  const [newVersionTag, setNewVersionTag] = useState('v1.0.0');
  const [newVersionSpec, setNewVersionSpec] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/projects');
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || 'Failed to load projects');
        return;
      }

      // Fetch full details for each project to list APIs
      const fullProjects: ProjectWithApis[] = [];
      for (const p of json.data) {
        const detailRes = await fetch(`/api/projects/${p.id}`);
        const detailJson = await detailRes.json();
        if (detailJson.success) {
          fullProjects.push(detailJson.data);
        }
      }
      setProjects(fullProjects);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName, description: newProjectDesc }),
      });
      const json = await res.json();
      if (!json.success) {
        setSubmitError(json.error?.message || 'Failed to create project');
      } else {
        setIsNewProjectModalOpen(false);
        setNewProjectName('');
        setNewProjectDesc('');
        await fetchProjects();
        onRefreshNeeded?.();
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateApi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectIdForApi || !newApiName.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/projects/${selectedProjectIdForApi}/apis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newApiName, description: newApiDesc }),
      });
      const json = await res.json();
      if (!json.success) {
        setSubmitError(json.error?.message || 'Failed to create API');
      } else {
        setIsNewApiModalOpen(false);
        setNewApiName('');
        setNewApiDesc('');
        setSelectedProjectIdForApi(null);
        await fetchProjects();
        onRefreshNeeded?.();
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApiForVersion || !newVersionTag.trim() || !newVersionSpec.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/apis/${selectedApiForVersion.apiId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: newVersionTag,
          specContent: newVersionSpec,
          autoAnalyze: true,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setSubmitError(json.error?.message || 'Failed to upload version');
      } else {
        const createdVer = json.data.version;
        setIsNewVersionModalOpen(false);
        setNewVersionTag('v1.0.0');
        setNewVersionSpec('');
        const projId = selectedApiForVersion.projectId;
        const aId = selectedApiForVersion.apiId;
        setSelectedApiForVersion(null);
        await fetchProjects();
        onRefreshNeeded?.();
        // Immediately select and open in dashboard
        onSelectVersion(projId, aId, createdVer.id);
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
            <FolderKanban className="w-5 h-5 text-emerald-400" />
            <span>Project & API Version Management</span>
          </h2>
          <p className="text-xs text-slate-400">
            Persistent storage hierarchy: Project → API → API Version (SHA-256) → Analysis Runs.
          </p>
        </div>

        <button
          onClick={() => {
            setSubmitError(null);
            setIsNewProjectModalOpen(true);
          }}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <span className="text-xs text-slate-400 font-mono">Loading persistent projects and APIs...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center space-y-4">
          <FolderKanban className="w-12 h-12 text-slate-600" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-200">No Projects Found</h3>
            <p className="text-xs text-slate-400">
              Create your first project to organize APIs and track version history deterministically.
            </p>
          </div>
          <button
            onClick={() => setIsNewProjectModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs transition"
          >
            Create First Project
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden"
            >
              {/* Project Card Header */}
              <div className="p-5 border-b border-slate-800/80 bg-slate-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-base text-slate-100">{project.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                      {project.apis.length} {project.apis.length === 1 ? 'API' : 'APIs'}
                    </span>
                  </div>
                  {project.description && (
                    <p className="text-xs text-slate-400">{project.description}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-500 font-mono hidden md:inline">
                    Updated: {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedProjectIdForApi(project.id);
                      setSubmitError(null);
                      setIsNewApiModalOpen(true);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add API</span>
                  </button>
                </div>
              </div>

              {/* APIs List */}
              <div className="p-5 space-y-4">
                {project.apis.length === 0 ? (
                  <div className="p-6 text-center rounded-lg bg-slate-950/50 border border-dashed border-slate-800 text-xs text-slate-500">
                    No APIs added to this project yet. Click &quot;Add API&quot; above to register an API service.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {project.apis.map((api) => {
                      const latestVersion = api.versions[0];
                      const latestRun = latestVersion?.analysisRuns?.[0];

                      return (
                        <div
                          key={api.id}
                          className="p-4 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center space-x-3">
                              <Layers className="w-4 h-4 text-emerald-400" />
                              <span className="font-semibold text-sm text-slate-200">
                                {api.name}
                              </span>
                              {latestVersion && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                  {latestVersion.version}
                                </span>
                              )}
                            </div>

                            {api.description && (
                              <p className="text-xs text-slate-400 pl-7">{api.description}</p>
                            )}

                            {latestVersion && (
                              <div className="flex items-center space-x-4 pl-7 text-[11px] text-slate-500 font-mono">
                                <span>Format: {latestVersion.format.toUpperCase()}</span>
                                <span>OpenAPI: {latestVersion.openapiVersion}</span>
                                <span>Hash: {latestVersion.contentHash.slice(0, 10)}...</span>
                                {latestRun && (
                                  <span
                                    className={`font-semibold ${
                                      latestRun.status === 'SUCCESS'
                                        ? 'text-emerald-400'
                                        : 'text-rose-400'
                                    }`}
                                  >
                                    Analysis: {latestRun.status}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center space-x-2 pl-7 md:pl-0">
                            <button
                              onClick={() => {
                                setSelectedApiForVersion({ projectId: project.id, apiId: api.id });
                                setSubmitError(null);
                                setIsNewVersionModalOpen(true);
                              }}
                              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium transition"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Upload Version</span>
                            </button>

                            {latestVersion && (
                              <button
                                onClick={() =>
                                  onSelectVersion(project.id, api.id, latestVersion.id)
                                }
                                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-semibold transition"
                              >
                                <span>Open in Dashboard</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create Project */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-100">Create New Project</h3>
            {submitError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
                {submitError}
              </div>
            )}
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Core Banking Platform"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Describe the project scope and domain..."
                  rows={3}
                  className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs resize-none focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Project</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add API */}
      {isNewApiModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-100">Add API to Project</h3>
            {submitError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
                {submitError}
              </div>
            )}
            <form onSubmit={handleCreateApi} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">API Name</label>
                <input
                  type="text"
                  required
                  value={newApiName}
                  onChange={(e) => setNewApiName(e.target.value)}
                  placeholder="e.g. Payments Gateway"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={newApiDesc}
                  onChange={(e) => setNewApiDesc(e.target.value)}
                  placeholder="Describe this API service..."
                  rows={3}
                  className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs resize-none focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewApiModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save API</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Upload Version */}
      {isNewVersionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-100">Upload New API Version</h3>
            <p className="text-xs text-slate-400">
              Validates specification syntax, computes SHA-256 hash, checks for duplicate content, and automatically runs initial analysis.
            </p>
            {submitError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
                {submitError}
              </div>
            )}
            <form onSubmit={handleCreateVersion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Version Identifier
                </label>
                <input
                  type="text"
                  required
                  value={newVersionTag}
                  onChange={(e) => setNewVersionTag(e.target.value)}
                  placeholder="e.g. v1.1.0 or v2.0.0"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  OpenAPI Specification (YAML or JSON)
                </label>
                <textarea
                  required
                  value={newVersionSpec}
                  onChange={(e) => setNewVersionSpec(e.target.value)}
                  placeholder="Paste valid OpenAPI 3.0 / 3.1 YAML or JSON here..."
                  rows={10}
                  className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-[11px] resize-none focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewVersionModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Validating & Persisting...</span>
                    </>
                  ) : (
                    <span>Create & Analyze Version</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
