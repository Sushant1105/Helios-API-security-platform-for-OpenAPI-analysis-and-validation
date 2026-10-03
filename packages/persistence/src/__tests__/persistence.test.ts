import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ECOMMERCE_SAMPLE_YAML, ECOMMERCE_V2_SAMPLE_YAML } from '@helios/analysis-pipeline';
import {
  prisma,
  ProjectService,
  ApiService,
  VersionService,
  AnalysisService,
  DiffService,
  PersistenceError,
  computeSpecHash,
} from '../index.js';

describe('HELIOS Phase 10: Persistence and API Version Management', () => {
  let testProjectId: string;
  let testProjectBId: string;
  let testApiId: string;
  let testApiBId: string;
  let testVersion1Id: string;
  let testVersion2Id: string;
  let testRun1Id: string;

  before(async () => {
    // Clean up test data if any leftovers exist
    await prisma.project.deleteMany({
      where: { name: { startsWith: 'TEST_PHASE10_' } },
    });
  });

  after(async () => {
    // Clean up test projects (cascade deletes apis, versions, and runs)
    await prisma.project.deleteMany({
      where: { name: { startsWith: 'TEST_PHASE10_' } },
    });
    await prisma.$disconnect();
  });

  describe('1. Project Management', () => {
    it('should create a new project successfully', async () => {
      const project = await ProjectService.createProject({
        name: 'TEST_PHASE10_ECommerce Project',
        description: 'E-commerce microservices and security audit project',
      });

      assert.ok(project.id);
      assert.equal(project.name, 'TEST_PHASE10_ECommerce Project');
      assert.equal(project.description, 'E-commerce microservices and security audit project');
      assert.ok(project.createdAt instanceof Date);
      testProjectId = project.id;
    });

    it('should create a second project for cross-project isolation tests', async () => {
      const projectB = await ProjectService.createProject({
        name: 'TEST_PHASE10_Fintech Project B',
      });
      assert.ok(projectB.id);
      testProjectBId = projectB.id;
    });

    it('should reject creating a project with empty name', async () => {
      await assert.rejects(
        async () => {
          await ProjectService.createProject({ name: '   ' });
        },
        (err: unknown) => {
          assert.ok(err instanceof PersistenceError);
          assert.equal(err.code, 'VALIDATION_ERROR');
          assert.equal(err.statusCode, 400);
          return true;
        }
      );
    });

    it('should list projects with correct api counts', async () => {
      const list = await ProjectService.listProjects();
      const found = list.find((p) => p.id === testProjectId);
      assert.ok(found);
      assert.equal(found.apiCount, 0);
    });
  });

  describe('2. API Creation and Cross-Project Security', () => {
    it('should create an API under Project A', async () => {
      const api = await ApiService.createApi(testProjectId, {
        name: 'Storefront Service',
        description: 'Public storefront and inventory gateway',
      });

      assert.ok(api.id);
      assert.equal(api.projectId, testProjectId);
      assert.equal(api.name, 'Storefront Service');
      testApiId = api.id;
    });

    it('should create an API under Project B', async () => {
      const apiB = await ApiService.createApi(testProjectBId, {
        name: 'Payments Core',
      });
      assert.ok(apiB.id);
      assert.equal(apiB.projectId, testProjectBId);
      testApiBId = apiB.id;
    });

    it('should retrieve API when valid project and API ID are supplied', async () => {
      const api = await ApiService.getApiById(testProjectId, testApiId);
      assert.equal(api.id, testApiId);
      assert.equal(api.projectId, testProjectId);
    });

    it('should strictly reject cross-project access (Project A accessing API belonging to Project B)', async () => {
      await assert.rejects(
        async () => {
          // Attempting to access API B via Project A
          await ApiService.getApiById(testProjectId, testApiBId);
        },
        (err: unknown) => {
          assert.ok(err instanceof PersistenceError);
          assert.equal(err.code, 'INVALID_RELATION');
          assert.equal(err.statusCode, 403);
          return true;
        }
      );
    });
  });

  describe('3. Version Creation, Duplicate Detection & Validation', () => {
    it('should reject specification exceeding maximum allowed size', async () => {
      const hugeContent = 'a'.repeat(6 * 1024 * 1024); // 6MB
      await assert.rejects(
        async () => {
          await VersionService.createVersion({
            apiId: testApiId,
            version: 'v0.9.0',
            specContent: hugeContent,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof PersistenceError);
          assert.equal(err.code, 'SPEC_TOO_LARGE');
          assert.equal(err.statusCode, 413);
          return true;
        }
      );
    });

    it('should reject invalid specification syntax without persisting', async () => {
      const invalidSpec = 'invalid: openapi: syntax::: corrupt';
      await assert.rejects(
        async () => {
          await VersionService.createVersion({
            apiId: testApiId,
            version: 'v0.0.1-broken',
            specContent: invalidSpec,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof PersistenceError);
          assert.equal(err.code, 'INVALID_SPECIFICATION');
          assert.equal(err.statusCode, 422);
          return true;
        }
      );

      // Verify no version was persisted
      const versions = await VersionService.listVersionsForApi(testApiId);
      assert.equal(versions.length, 0);
    });

    it('should create version v1.0.0 with valid specification and compute SHA-256 hash', async () => {
      const expectedHash = computeSpecHash(ECOMMERCE_SAMPLE_YAML);

      const version = await VersionService.createVersion({
        apiId: testApiId,
        version: 'v1.0.0',
        specContent: ECOMMERCE_SAMPLE_YAML,
      });

      assert.ok(version.id);
      assert.equal(version.apiId, testApiId);
      assert.equal(version.version, 'v1.0.0');
      assert.equal(version.format, 'yaml');
      assert.equal(version.openapiVersion, '3.1.0');
      assert.equal(version.contentHash, expectedHash);
      testVersion1Id = version.id;
    });

    it('should detect duplicate specification content and reject duplicate version creation', async () => {
      await assert.rejects(
        async () => {
          // Attempting to upload identical specification text to the same API
          await VersionService.createVersion({
            apiId: testApiId,
            version: 'v1.0.1-duplicate',
            specContent: ECOMMERCE_SAMPLE_YAML,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof PersistenceError);
          assert.equal(err.code, 'DUPLICATE_SPECIFICATION');
          assert.equal(err.statusCode, 409);
          assert.match(err.message, /identical specification already exists/i);
          return true;
        }
      );
    });

    it('should successfully create version v2.0.0 with updated specification', async () => {
      const version2 = await VersionService.createVersion({
        apiId: testApiId,
        version: 'v2.0.0',
        specContent: ECOMMERCE_V2_SAMPLE_YAML,
      });

      assert.ok(version2.id);
      assert.equal(version2.version, 'v2.0.0');
      assert.notEqual(version2.contentHash, computeSpecHash(ECOMMERCE_SAMPLE_YAML));
      testVersion2Id = version2.id;
    });
  });

  describe('4. Analysis Persistence and Historical Retrieval', () => {
    it('should run deterministic analysis pipeline and persist complete AnalysisRun', async () => {
      const { run, data } = await AnalysisService.runAndPersistAnalysis(testVersion1Id);

      assert.ok(run.id);
      assert.equal(run.apiVersionId, testVersion1Id);
      assert.equal(run.status, 'SUCCESS');
      assert.ok(run.completedAt);

      // Verify complete aggregate results persisted
      assert.ok(data.ast);
      assert.ok(data.validation);
      assert.ok(data.security);
      assert.ok(data.compliance);
      assert.ok(data.stats);

      testRun1Id = run.id;
    });

    it('should allow re-running analysis and create a second historical run record', async () => {
      const { run: run2 } = await AnalysisService.runAndPersistAnalysis(testVersion1Id);

      assert.ok(run2.id);
      assert.notEqual(run2.id, testRun1Id);

      const history = await AnalysisService.listRunsForVersion(testVersion1Id);
      assert.equal(history.length, 2);
      assert.ok(history[0]);
      assert.ok(history[1]);
      assert.equal(history[0].id, run2.id);
      assert.equal(history[1].id, testRun1Id);
    });

    it('should retrieve historical analysis run without re-running analysis', async () => {
      const retrieved = await AnalysisService.getRunById(testRun1Id);

      assert.equal(retrieved.run.id, testRun1Id);
      assert.equal(retrieved.run.status, 'SUCCESS');
      assert.equal(retrieved.data.ast.title, 'Helios Commerce API');
      assert.ok(retrieved.data.security.findings.length > 0);
      assert.ok(retrieved.data.compliance.riskScore.overallScore >= 0);
    });
  });

  describe('5. Version Comparison via Saved Versions', () => {
    it('should execute semantic diff comparing saved version v1.0.0 and v2.0.0', async () => {
      const comparison = await DiffService.compareSavedVersions(testVersion1Id, testVersion2Id);

      assert.equal(comparison.baseVersion.version, 'v1.0.0');
      assert.equal(comparison.targetVersion.version, 'v2.0.0');
      assert.ok(comparison.diff);
      assert.ok(comparison.diff.summary.totalChanges > 0);
      assert.ok(comparison.diff.changes.length > 0);
    });
  });

  describe('6. AI Grounding on Persisted Historical Analysis', () => {
    it('should ground local AI copilot against persisted historical analysis run without rerun', async () => {
      const historical = await AnalysisService.getRunById(testRun1Id);
      assert.ok(historical.data);

      const { ast, security, validation, compliance } = historical.data;

      // Import AiCopilot and MockLlmProvider from @helios/ai-engine
      const { AiCopilot, MockLlmProvider } = await import('@helios/ai-engine');

      const mockProvider = new MockLlmProvider();
      // Find an endpoint and its directly associated finding
      const targetFinding = security.findings.find((f) => f.endpointPath);
      const targetEndpoint = targetFinding
        ? ast.endpoints.find((e) => e.path === targetFinding.endpointPath && e.method === targetFinding.httpMethod)
        : ast.endpoints[0];
      assert.ok(targetEndpoint);

      mockProvider.setDefaultResponse({
        answer: `Persisted analysis analysis: endpoint ${targetEndpoint.path} was audited.`,
        referencedEndpoints: [targetEndpoint.id],
        referencedSchemas: [],
        referencedFindings: targetFinding ? [targetFinding.id] : [],
        referencedControls: [],
        referencedChanges: [],
        limitations: ['Verified against persisted historical AnalysisRun.'],
        confidence: 'HIGH',
      });

      const copilot = new AiCopilot({ provider: mockProvider });
      const verificationResult = await copilot.ask({
        ast,
        userQuery: 'What is the security posture of this persisted API version?',
        securityFindings: [...security.findings],
        validationFindings: [...validation.findings],
        complianceMappings: [...compliance.mappings],
        targetEndpointPath: targetEndpoint.path,
        targetHttpMethod: targetEndpoint.method,
      });

      assert.equal(verificationResult.status, 'verified');
      assert.equal(verificationResult.hallucinationsDetected.length, 0);
      assert.equal(verificationResult.validReferences.endpoints.length, 1);
      assert.equal(verificationResult.validReferences.endpoints[0], targetEndpoint.id);
    });
  });

  describe('7. Cascade Deletion', () => {
    it('should cascade delete all APIs, versions, and runs when project is deleted', async () => {
      await ProjectService.deleteProject(testProjectId);

      // Verify Project A is gone
      await assert.rejects(
        async () => {
          await ProjectService.getProjectById(testProjectId);
        },
        (err: unknown) => {
          assert.ok(err instanceof PersistenceError);
          assert.equal(err.code, 'RESOURCE_NOT_FOUND');
          return true;
        }
      );

      // Verify API is deleted
      const api = await prisma.api.findUnique({ where: { id: testApiId } });
      assert.equal(api, null);

      // Verify Version is deleted
      const version = await prisma.apiVersion.findUnique({ where: { id: testVersion1Id } });
      assert.equal(version, null);

      // Verify AnalysisRun is deleted
      const run = await prisma.analysisRun.findUnique({ where: { id: testRun1Id } });
      assert.equal(run, null);
    });
  });
});
