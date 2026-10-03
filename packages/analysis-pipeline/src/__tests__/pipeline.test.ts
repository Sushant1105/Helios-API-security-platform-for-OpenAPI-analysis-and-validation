/**
 * @helios/analysis-pipeline
 * Comprehensive Integration Test Suite covering:
 * 1. Valid OpenAPI -> successful analysis
 * 2. Invalid OpenAPI -> structured error
 * 3. Parser error propagates correctly
 * 4. AST generation
 * 5. Validator execution
 * 6. Security engine execution
 * 7. Compliance engine execution
 * 8. Risk result propagation
 * 9. Diff integration
 * 10. SDK generation integration (TypeScript & Python)
 * 11. AI context integration
 * 12. AI ground-truth result propagation
 * 13. Empty specification state
 * 14. Unsupported OpenAPI version
 * 15. Realistic multi-endpoint specification with mixed findings
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockLlmProvider } from '@helios/ai-engine';
import {
  AnalysisPipeline,
  analyzeSpecification,
  compareSpecifications,
  generateClientSdk,
  queryCopilot,
  ECOMMERCE_SAMPLE_YAML,
  ECOMMERCE_V2_SAMPLE_YAML,
  MINIMAL_SAMPLE_JSON,
} from '../index.js';

describe('Analysis Pipeline End-to-End Integration Suite', () => {
  const pipeline = new AnalysisPipeline();

  it('1. should successfully analyze valid OpenAPI JSON specification', async () => {
    const res = await pipeline.analyze(MINIMAL_SAMPLE_JSON);
    assert.equal(res.success, true);
    if (!res.success) return;

    assert.equal(res.data.format, 'json');
    assert.equal(res.data.ast.title, 'Helios Health API');
    assert.equal(res.data.stats.endpointsCount, 1);
    assert.equal(res.data.stats.schemasCount, 0);
  });

  it('2. should return structured error on invalid OpenAPI syntax (malformed JSON)', async () => {
    const invalidJson = '{ "openapi": "3.0.0", "info": { "title": "Broken", ';
    const res = await pipeline.analyze(invalidJson);
    assert.equal(res.success, false);
    if (res.success) return;

    assert.equal(res.error.step, 'PARSE');
    assert.equal(res.error.code, 'SYNTAX_ERROR');
    assert.ok(res.error.message.includes('Failed to parse JSON'));
  });

  it('3. should propagate parser errors cleanly when required OpenAPI fields are missing', async () => {
    const missingPaths = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'No Paths', version: '1.0.0' },
    });
    const res = await pipeline.analyze(missingPaths);
    assert.equal(res.success, false);
    if (res.success) return;

    assert.equal(res.error.step, 'PARSE');
    assert.equal(res.error.code, 'VALIDATION_ERROR');
    assert.ok(res.error.message.includes('Missing required root property "paths"'));
  });

  it('4. should successfully build Canonical AST with normalized endpoints and schemas', async () => {
    const res = await analyzeSpecification(ECOMMERCE_SAMPLE_YAML);
    assert.equal(res.success, true);
    if (!res.success) return;

    const ast = res.data.ast;
    assert.ok(ast.id);
    assert.equal(ast.specVersion, '3.1');
    assert.ok(ast.endpoints.length >= 4);

    const getProduct = ast.endpoints.find((e) => e.path === '/products/{id}' && e.method === 'get');
    assert.ok(getProduct);
    assert.equal(getProduct.operationId, 'getProductById');
    assert.equal(getProduct.parameters[0]?.name, 'id');
  });

  it('5. should execute validator and produce real ValidationFindings', async () => {
    const res = await pipeline.analyze(ECOMMERCE_SAMPLE_YAML);
    assert.equal(res.success, true);
    if (!res.success) return;

    const validation = res.data.validation;
    assert.ok(validation.stats);
    assert.ok(Array.isArray(validation.findings));
  });

  it('6. should execute deterministic security engine and produce real SecurityFindings', async () => {
    const res = await pipeline.analyze(ECOMMERCE_SAMPLE_YAML);
    assert.equal(res.success, true);
    if (!res.success) return;

    const security = res.data.security;
    assert.ok(security.findings.length > 0);
    assert.ok(security.score >= 0 && security.score <= 100);
    assert.ok(security.summary.total > 0);

    // Verify cleartext HTTP server was flagged
    const cleartextFinding = security.findings.find((f) => f.ruleId === 'TRNS-001');
    assert.ok(cleartextFinding);
    assert.equal(cleartextFinding.severity, 'HIGH');

    // Verify missing auth on /admin/users was flagged
    const unauthFinding = security.findings.find((f) => f.endpointPath === '/admin/users');
    assert.ok(unauthFinding);
    assert.equal(unauthFinding.ruleId, 'AUTH-001');
  });

  it('7. should execute compliance engine and map findings to OWASP, PCI-DSS, and HIPAA', async () => {
    const res = await pipeline.analyze(ECOMMERCE_SAMPLE_YAML);
    assert.equal(res.success, true);
    if (!res.success) return;

    const compliance = res.data.compliance;
    assert.ok(compliance.mappings.length >= 10);
    assert.ok(compliance.disclaimer.includes('technical control indicators only'));

    // Broken Auth should be NON_COMPLIANT due to AUTH-001 on /admin/users
    const brokenAuth = compliance.mappings.find((m) => m.controlId === 'API2:2023_BROKEN_AUTH');
    assert.ok(brokenAuth);
    assert.equal(brokenAuth.status, 'NON_COMPLIANT');

    // PCI-4.2.1 should be NON_COMPLIANT due to HTTP cleartext server
    const pciCrypto = compliance.mappings.find((m) => m.controlId === 'PCI-4.2.1');
    assert.ok(pciCrypto);
    assert.equal(pciCrypto.status, 'NON_COMPLIANT');
  });

  it('8. should propagate risk results with category scores and overall posture score', async () => {
    const res = await pipeline.analyze(ECOMMERCE_SAMPLE_YAML);
    assert.equal(res.success, true);
    if (!res.success) return;

    const risk = res.data.compliance.riskScore;
    assert.ok(risk.overallScore >= 0 && risk.overallScore <= 100);
    assert.ok(risk.categoryScores.authentication < 100); // Has auth findings
    assert.ok(risk.categoryScores.dataProtection < 100); // Has transport/data findings
    assert.equal(res.data.stats.overallRiskScore, risk.overallScore);
  });

  it('9. should integrate diff engine and detect breaking vs non-breaking changes between API versions', async () => {
    const diffRes = await compareSpecifications(ECOMMERCE_SAMPLE_YAML, ECOMMERCE_V2_SAMPLE_YAML);
    assert.equal(diffRes.success, true);
    if (!diffRes.success) return;

    const diff = diffRes.data;
    assert.equal(diff.hasBreakingChanges, true);
    assert.ok(diff.summary.breaking > 0);

    // Endpoint removed (/products/{id} delete)
    const removedEndpoint = diff.changes.find(
      (c) => c.category === 'endpoint' && c.compatibility === 'breaking'
    );
    assert.ok(removedEndpoint);

    // New required query parameter (tenantId)
    const newReqParam = diff.changes.find(
      (c) => c.category === 'parameter' && c.compatibility === 'breaking'
    );
    assert.ok(newReqParam);
  });

  it('10. should generate TypeScript and Python SDKs from Canonical AST', async () => {
    const res = await pipeline.analyze(MINIMAL_SAMPLE_JSON);
    assert.equal(res.success, true);
    if (!res.success) return;

    // TypeScript SDK
    const tsSdk = generateClientSdk(res.data.ast, {
      target: 'typescript',
      packageName: 'helios-health-client',
      packageVersion: '1.0.0',
    });
    assert.equal(tsSdk.success, true);
    if (tsSdk.success) {
      assert.ok(tsSdk.data.files.length >= 4);
      assert.ok(tsSdk.data.files.some((f) => f.path === 'package.json'));
      assert.ok(tsSdk.data.files.some((f) => f.path === 'src/client.ts'));
    }

    // Python SDK
    const pySdk = generateClientSdk(res.data.ast, {
      target: 'python',
      packageName: 'helios_health_client',
      packageVersion: '1.0.0',
    });
    assert.equal(pySdk.success, true);
    if (pySdk.success) {
      assert.ok(pySdk.data.files.length >= 4);
      assert.ok(pySdk.data.files.some((f) => f.path === 'pyproject.toml'));
      assert.ok(pySdk.data.files.some((f) => f.path.includes('client.py')));
    }
  });

  it('11. should provide targeted context extraction for AI questions', async () => {
    const res = await pipeline.analyze(ECOMMERCE_SAMPLE_YAML);
    assert.equal(res.success, true);
    if (!res.success) return;

    const mockLlm = new MockLlmProvider();
    mockLlm.setDefaultResponse({
      answer: 'The /admin/users endpoint is missing authentication controls.',
      referencedEndpoints: ['get:/admin/users'],
      referencedSchemas: ['UserAccount'],
      referencedFindings: ['AUTH-001:get:/admin/users:'],
      referencedControls: ['API2:2023_BROKEN_AUTH'],
      referencedChanges: [],
      limitations: ['Static analysis cannot verify runtime firewalls'],
      confidence: 'HIGH',
    });

    const aiRes = await queryCopilot(
      res.data.ast,
      'Why is /admin/users risky?',
      {
        securityFindings: res.data.security.findings,
        complianceMappings: res.data.compliance.mappings,
        targetEndpointPath: '/admin/users',
        targetHttpMethod: 'get',
      },
      { provider: mockLlm }
    );

    assert.equal(aiRes.success, true);
    if (aiRes.success) {
      assert.equal(aiRes.data.status, 'verified');
      assert.ok(aiRes.data.validReferences.endpoints.includes('get:/admin/users'));
    }
  });

  it('12. should propagate AI ground-truth verification and detect hallucinations', async () => {
    const res = await pipeline.analyze(ECOMMERCE_SAMPLE_YAML);
    assert.equal(res.success, true);
    if (!res.success) return;

    const mockLlm = new MockLlmProvider();
    // Hallucinating a nonexistent endpoint /super/secret
    mockLlm.setDefaultResponse({
      answer: 'The endpoint /super/secret is completely unauthenticated.',
      referencedEndpoints: ['get:/super/secret'],
      referencedSchemas: [],
      referencedFindings: [],
      referencedControls: [],
      referencedChanges: [],
      limitations: [],
      confidence: 'HIGH',
    });

    const aiRes = await queryCopilot(
      res.data.ast,
      'Tell me about secret endpoints',
      {},
      { provider: mockLlm }
    );

    assert.equal(aiRes.success, true);
    if (aiRes.success) {
      assert.equal(aiRes.data.status, 'rejected');
      assert.equal(aiRes.data.hallucinationsDetected.length, 1);
      assert.equal(aiRes.data.hallucinationsDetected[0]?.type, 'NONEXISTENT_ENDPOINT');
    }
  });

  it('13. should reject empty specification content', async () => {
    const res = await pipeline.analyze('   \n  ');
    assert.equal(res.success, false);
    if (res.success) return;

    assert.equal(res.error.code, 'EMPTY_SPECIFICATION');
  });

  it('14. should reject unsupported Swagger 2.0 or invalid versions with clear error', async () => {
    const swagger2 = JSON.stringify({
      swagger: '2.0',
      info: { title: 'Legacy Swagger', version: '1.0' },
      paths: {},
    });
    const res = await pipeline.analyze(swagger2);
    assert.equal(res.success, false);
    if (res.success) return;

    assert.equal(res.error.step, 'PARSE');
    assert.equal(res.error.code, 'UNSUPPORTED_VERSION');
    assert.ok(res.error.message.includes('OpenAPI 2.0 (Swagger) specifications are not supported'));
  });

  it('15. should successfully execute full pipeline on realistic multi-endpoint ECOMMERCE_SAMPLE_YAML', async () => {
    const res = await pipeline.analyze(ECOMMERCE_SAMPLE_YAML);
    assert.equal(res.success, true);
    if (!res.success) return;

    assert.equal(res.data.stats.endpointsCount, 6);
    assert.ok(res.data.stats.schemasCount >= 4);
    assert.equal(res.data.stats.serversCount, 2);
    assert.equal(res.data.stats.securitySchemesCount, 2);
    assert.ok(res.data.stats.securityFindingsCount >= 3);
    assert.ok(res.data.stats.complianceGapsCount >= 1);
  });
});
