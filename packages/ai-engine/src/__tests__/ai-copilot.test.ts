/**
 * @helios/ai-engine
 * Comprehensive unit test suite covering:
 * - Ollama provider configuration
 * - Provider failure and timeout handling
 * - Context construction for endpoints, findings, diffs, and compliance
 * - Structured output parsing and invalid JSON fallback
 * - Hallucination detection: nonexistent endpoints, schemas, findings, controls, diff changes
 * - Incorrect finding-to-endpoint association detection
 * - Partial verification, full verification, and rejection
 * - Deterministic context construction
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalApiAst } from '@helios/canonical-ast';
import type { ComplianceControlMapping } from '@helios/compliance-engine';
import type { ApiChange } from '@helios/diff-engine';
import type { SecurityFinding } from '@helios/security-engine';
import type { ValidationFinding } from '@helios/validator';
import {
  AiCopilot,
  AstGroundTruthValidator,
  ContextBuilder,
  MockLlmProvider,
  OllamaProvider,
  parseAiResponse,
} from '../index.js';

function createSampleAst(): CanonicalApiAst {
  return {
    id: 'user-service:1.0.0',
    title: 'User Service API',
    version: '1.0.0',
    specVersion: '3.1',
    format: 'yaml',
    info: {
      title: 'User Service API',
      version: '1.0.0',
      description: 'Production user management service',
    },
    servers: [{ url: 'https://api.users.example.com', description: 'Production server' }],
    tags: [{ name: 'Users' }],
    endpoints: [
      {
        id: 'get:/users/{id}',
        path: '/users/{id}',
        method: 'get',
        operationId: 'getUserById',
        deprecated: false,
        tags: ['Users'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            deprecated: false,
            schema: {
              type: 'string',
              nullable: false,
              readOnly: false,
              writeOnly: false,
              deprecated: false,
              requiredProperties: [],
            },
          },
        ],
        responses: {
          '200': {
            statusCode: '200',
            description: 'User details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  nullable: false,
                  readOnly: false,
                  writeOnly: false,
                  deprecated: false,
                  requiredProperties: ['id', 'email'],
                  properties: {
                    id: {
                      name: 'id',
                      required: true,
                      schema: {
                        type: 'string',
                        nullable: false,
                        readOnly: true,
                        writeOnly: false,
                        deprecated: false,
                        requiredProperties: [],
                      },
                    },
                    email: {
                      name: 'email',
                      required: true,
                      schema: {
                        type: 'string',
                        nullable: false,
                        readOnly: false,
                        writeOnly: false,
                        deprecated: false,
                        requiredProperties: [],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        id: 'post:/users',
        path: '/users',
        method: 'post',
        operationId: 'createUser',
        deprecated: false,
        tags: ['Users'],
        parameters: [],
        responses: {
          '201': {
            statusCode: '201',
            description: 'User created',
          },
        },
      },
    ],
    schemas: {
      User: {
        id: 'User',
        type: 'object',
        nullable: false,
        readOnly: false,
        writeOnly: false,
        deprecated: false,
        requiredProperties: ['id', 'email'],
        properties: {
          id: {
            name: 'id',
            required: true,
            schema: { type: 'string', nullable: false, readOnly: true, writeOnly: false, deprecated: false, requiredProperties: [] },
          },
          email: {
            name: 'email',
            required: true,
            schema: { type: 'string', nullable: false, readOnly: false, writeOnly: false, deprecated: false, requiredProperties: [] },
          },
        },
      },
    },
    securitySchemes: {
      BearerAuth: {
        id: 'BearerAuth',
        type: 'http',
        scheme: 'bearer',
      },
    },
    security: [],
    metadata: {
      normalizedAt: '2026-09-19T00:00:00.000Z',
      sourceFormat: 'yaml',
      specVersion: '3.1',
      totalEndpoints: 2,
      totalSchemas: 1,
    },
  };
}

const sampleSecurityFindings: SecurityFinding[] = [
  {
    id: 'AUTH-001:get:/users/{id}',
    ruleId: 'AUTH-001',
    title: 'Unauthenticated Endpoint',
    description: 'Endpoint defines no security requirement and global security is empty.',
    severity: 'HIGH',
    confidence: 'HIGH',
    category: 'authentication',
    owaspCategory: 'API2:2023_BROKEN_AUTH',
    endpointPath: '/users/{id}',
    httpMethod: 'get',
    remediation: 'Declare a security requirement on this endpoint.',
  },
  {
    id: 'DATA-001:post:/users',
    ruleId: 'DATA-001',
    title: 'Sensitive Data Exposure',
    description: 'Sensitive field pattern match in request payload.',
    severity: 'MEDIUM',
    confidence: 'MEDIUM',
    category: 'data-exposure',
    endpointPath: '/users',
    httpMethod: 'post',
    remediation: 'Mask or encrypt sensitive attributes.',
  },
];

const sampleValidationFindings: ValidationFinding[] = [
  {
    id: 'semantic:MISSING_API_VERSION:global',
    severity: 'warning',
    category: 'semantic',
    code: 'MISSING_API_VERSION',
    message: 'API title is present but semantic version string is missing.',
  },
];

const sampleComplianceMappings: ComplianceControlMapping[] = [
  {
    controlId: 'PCI-8.2.1',
    standard: 'PCI_DSS_V4_TECHNICAL_CONTROLS',
    title: 'Strong Authentication',
    description: 'All access to system components must be authenticated.',
    matchedFindings: [sampleSecurityFindings[0]!],
    status: 'NON_COMPLIANT',
  },
];

const sampleDiffChanges: ApiChange[] = [
  {
    id: 'endpoint:delete:/users/{id}:ENDPOINT_REMOVED',
    kind: 'ENDPOINT_REMOVED',
    category: 'endpoint',
    compatibility: 'breaking',
    message: 'Endpoint DELETE /users/{id} was removed',
    path: '/users/{id}',
    method: 'delete',
    rationale: 'Existing callers will receive 404 Not Found.',
  },
];

describe('Local AI Copilot and Ground-Truth Validator (Phase 8)', () => {
  it('1. should configure OllamaProvider with defaults and custom options', () => {
    const provider = new OllamaProvider({
      baseUrl: 'http://127.0.0.1:11434',
      modelName: 'qwen2.5-coder',
      timeoutMs: 15000,
      temperature: 0.2,
    });

    assert.equal(provider.name, 'ollama');
  });

  it('2. should handle provider failure gracefully', async () => {
    const mock = new MockLlmProvider();
    mock.addRule({
      pattern: /./,
      response: '',
      shouldFail: true,
      failError: new Error('Ollama service unavailable'),
    });

    const copilot = new AiCopilot({ provider: mock });
    const ast = createSampleAst();

    await assert.rejects(
      () => copilot.ask({ ast, userQuery: 'Why is this insecure?' }),
      /Ollama service unavailable/
    );
  });

  it('3. should handle timeout handling via AbortSignal', async () => {
    let fetchAborted = false;
    const mockFetch = async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          fetchAborted = true;
          const abortError = new Error('The operation was aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    };

    const provider = new OllamaProvider({
      timeoutMs: 50,
      fetch: mockFetch as typeof fetch,
    });

    await assert.rejects(
      () => provider.generate({ prompt: 'test' }),
      /timed out after 50ms/
    );
    assert.equal(fetchAborted, true);
  });

  it('4. should construct targeted context for endpoint questions without dumping whole AST', () => {
    const ast = createSampleAst();
    const context = ContextBuilder.buildContext(
      ast,
      {
        userQuery: 'Why is GET /users/{id} insecure?',
        targetEndpointPath: '/users/{id}',
        targetHttpMethod: 'get',
      },
      {
        securityFindings: sampleSecurityFindings,
        validationFindings: sampleValidationFindings,
      }
    );

    assert.ok(context.targetEndpoint);
    assert.equal(context.targetEndpoint.path, '/users/{id}');
    assert.equal(context.relevantSecurityFindings.length, 1);
    assert.equal(context.relevantSecurityFindings[0]!.id, 'AUTH-001:get:/users/{id}');
    // Should NOT include findings for POST /users
    assert.equal(context.relevantSecurityFindings.some((f) => f.endpointPath === '/users'), false);
  });

  it('5. should construct targeted context for security finding questions', () => {
    const ast = createSampleAst();
    const context = ContextBuilder.buildContext(
      ast,
      {
        userQuery: 'Explain finding DATA-001',
        targetFindingId: 'DATA-001',
      },
      {
        securityFindings: sampleSecurityFindings,
      }
    );

    assert.equal(context.relevantSecurityFindings.length, 1);
    assert.equal(context.relevantSecurityFindings[0]!.ruleId, 'DATA-001');
  });

  it('6. should construct targeted context for API diff questions', () => {
    const ast = createSampleAst();
    const context = ContextBuilder.buildContext(
      ast,
      {
        userQuery: 'What breaking changes occurred in the API?',
      },
      {
        diffChanges: sampleDiffChanges,
      }
    );

    assert.equal(context.relevantDiffChanges.length, 1);
    assert.equal(context.relevantDiffChanges[0]!.compatibility, 'breaking');
  });

  it('7. should construct targeted context for compliance questions', () => {
    const ast = createSampleAst();
    const context = ContextBuilder.buildContext(
      ast,
      {
        userQuery: 'Explain PCI-8.2.1 compliance mapping',
        targetControlId: 'PCI-8.2.1',
      },
      {
        complianceMappings: sampleComplianceMappings,
      }
    );

    assert.equal(context.relevantComplianceMappings.length, 1);
    assert.equal(context.relevantComplianceMappings[0]!.controlId, 'PCI-8.2.1');
  });

  it('8. should parse structured AI JSON output cleanly', () => {
    const rawJson = JSON.stringify({
      answer: 'GET /users/{id} is public and unprotected.',
      referencedEndpoints: ['get:/users/{id}'],
      referencedSchemas: ['User'],
      referencedFindings: ['AUTH-001'],
      referencedControls: ['PCI-8.2.1'],
      referencedChanges: [],
      limitations: ['Static analysis cannot prove runtime token validation.'],
      confidence: 'HIGH',
    });

    const parsed = parseAiResponse(rawJson);
    assert.equal(parsed.answer, 'GET /users/{id} is public and unprotected.');
    assert.deepEqual(parsed.referencedEndpoints, ['get:/users/{id}']);
    assert.deepEqual(parsed.referencedSchemas, ['User']);
    assert.deepEqual(parsed.referencedFindings, ['AUTH-001']);
    assert.equal(parsed.confidence, 'HIGH');
  });

  it('9. should handle malformed or non-JSON LLM responses gracefully', () => {
    const rawText = 'This is a freeform text response that failed to output JSON.';
    const parsed = parseAiResponse(rawText);

    assert.equal(parsed.answer, rawText);
    assert.equal(parsed.confidence, 'LOW');
    assert.ok(parsed.limitations.length > 0);
  });

  it('10. should detect nonexistent endpoint references (hallucination)', () => {
    const ast = createSampleAst();
    const answer = {
      answer: 'The endpoint DELETE /admin/super-secret is vulnerable.',
      referencedEndpoints: ['delete:/admin/super-secret'],
      referencedSchemas: [],
      referencedFindings: [],
      referencedControls: [],
      referencedChanges: [],
      limitations: [],
      confidence: 'HIGH' as const,
    };

    const verified = AstGroundTruthValidator.verify(answer, ast);
    assert.equal(verified.status, 'rejected');
    assert.equal(verified.hallucinationsDetected.length, 1);
    assert.equal(verified.hallucinationsDetected[0]!.type, 'NONEXISTENT_ENDPOINT');
    assert.equal(verified.hallucinationsDetected[0]!.reference, 'delete:/admin/super-secret');
  });

  it('11. should detect nonexistent finding references (hallucination)', () => {
    const ast = createSampleAst();
    const answer = {
      answer: 'This endpoint triggers VULN-999.',
      referencedEndpoints: ['get:/users/{id}'],
      referencedSchemas: [],
      referencedFindings: ['VULN-999'],
      referencedControls: [],
      referencedChanges: [],
      limitations: [],
      confidence: 'HIGH' as const,
    };

    const verified = AstGroundTruthValidator.verify(answer, ast, {
      securityFindings: sampleSecurityFindings,
    });

    assert.equal(verified.status, 'partially_verified');
    const findingViolation = verified.hallucinationsDetected.find((v) => v.type === 'NONEXISTENT_FINDING');
    assert.ok(findingViolation);
    assert.equal(findingViolation.reference, 'VULN-999');
  });

  it('12. should detect incorrect finding-to-endpoint associations', () => {
    const ast = createSampleAst();
    // AUTH-001 belongs to GET /users/{id}, but model claims it for POST /users
    const answer = {
      answer: 'POST /users has unauthenticated access via AUTH-001.',
      referencedEndpoints: ['post:/users'],
      referencedSchemas: [],
      referencedFindings: ['AUTH-001:get:/users/{id}'],
      referencedControls: [],
      referencedChanges: [],
      limitations: [],
      confidence: 'HIGH' as const,
    };

    const verified = AstGroundTruthValidator.verify(answer, ast, {
      securityFindings: sampleSecurityFindings,
    });

    assert.equal(verified.status, 'partially_verified');
    const assocViolation = verified.hallucinationsDetected.find((v) => v.type === 'UNASSOCIATED_FINDING');
    assert.ok(assocViolation);
  });

  it('13. should detect nonexistent compliance controls', () => {
    const ast = createSampleAst();
    const answer = {
      answer: 'This violates GDPR-ARTICLE-99.',
      referencedEndpoints: ['get:/users/{id}'],
      referencedSchemas: [],
      referencedFindings: ['AUTH-001:get:/users/{id}'],
      referencedControls: ['GDPR-ARTICLE-99'],
      referencedChanges: [],
      limitations: [],
      confidence: 'HIGH' as const,
    };

    const verified = AstGroundTruthValidator.verify(answer, ast, {
      securityFindings: sampleSecurityFindings,
      complianceMappings: sampleComplianceMappings,
    });

    assert.equal(verified.status, 'partially_verified');
    const ctrlViolation = verified.hallucinationsDetected.find((v) => v.type === 'NONEXISTENT_CONTROL');
    assert.ok(ctrlViolation);
  });

  it('14. should detect hallucinated schemas', () => {
    const ast = createSampleAst();
    const answer = {
      answer: 'The endpoint returns schema CreditCardToken.',
      referencedEndpoints: ['get:/users/{id}'],
      referencedSchemas: ['CreditCardToken'],
      referencedFindings: [],
      referencedControls: [],
      referencedChanges: [],
      limitations: [],
      confidence: 'HIGH' as const,
    };

    const verified = AstGroundTruthValidator.verify(answer, ast);
    assert.equal(verified.status, 'partially_verified');
    const schemaViolation = verified.hallucinationsDetected.find((v) => v.type === 'NONEXISTENT_SCHEMA');
    assert.ok(schemaViolation);
    assert.equal(schemaViolation.reference, 'CreditCardToken');
  });

  it('15. should detect hallucinated diff changes', () => {
    const ast = createSampleAst();
    const answer = {
      answer: 'Endpoint PUT /users was modified in this release.',
      referencedEndpoints: [],
      referencedSchemas: [],
      referencedFindings: [],
      referencedControls: [],
      referencedChanges: ['endpoint:put:/users:ENDPOINT_MODIFIED'],
      limitations: [],
      confidence: 'HIGH' as const,
    };

    const verified = AstGroundTruthValidator.verify(answer, ast, {
      diffChanges: sampleDiffChanges,
    });

    assert.equal(verified.status, 'rejected');
    const diffViolation = verified.hallucinationsDetected.find((v) => v.type === 'NONEXISTENT_DIFF_CHANGE');
    assert.ok(diffViolation);
  });

  it('16. should fully verify response when all references match ground truth', () => {
    const ast = createSampleAst();
    const answer = {
      answer: 'GET /users/{id} exposes user details without authentication according to AUTH-001.',
      referencedEndpoints: ['get:/users/{id}'],
      referencedSchemas: ['User'],
      referencedFindings: ['AUTH-001:get:/users/{id}'],
      referencedControls: ['PCI-8.2.1'],
      referencedChanges: [],
      limitations: ['Static analysis indication only.'],
      confidence: 'HIGH' as const,
    };

    const verified = AstGroundTruthValidator.verify(answer, ast, {
      securityFindings: sampleSecurityFindings,
      complianceMappings: sampleComplianceMappings,
    });

    assert.equal(verified.status, 'verified');
    assert.equal(verified.hallucinationsDetected.length, 0);
    assert.equal(verified.validReferences.endpoints.length, 1);
    assert.equal(verified.validReferences.schemas.length, 1);
    assert.equal(verified.validReferences.findings.length, 1);
    assert.equal(verified.validReferences.controls.length, 1);
  });

  it('17. should reject response when all referenced entities are hallucinations', () => {
    const ast = createSampleAst();
    const answer = {
      answer: 'Fake claims about fake endpoints.',
      referencedEndpoints: ['post:/nonexistent'],
      referencedSchemas: ['GhostModel'],
      referencedFindings: ['FAKE-999'],
      referencedControls: [],
      referencedChanges: [],
      limitations: [],
      confidence: 'HIGH' as const,
    };

    const verified = AstGroundTruthValidator.verify(answer, ast);
    assert.equal(verified.status, 'rejected');
    assert.ok(verified.verifiedAnswer.includes('[HELIOS AST Ground-Truth Rejection'));
  });

  it('18. should produce deterministic context construction', () => {
    const ast = createSampleAst();
    const query = { userQuery: 'Why is GET /users/{id} insecure?' };

    const c1 = ContextBuilder.buildContext(ast, query, { securityFindings: sampleSecurityFindings });
    const c2 = ContextBuilder.buildContext(ast, query, { securityFindings: sampleSecurityFindings });

    assert.deepEqual(c1, c2);
  });

  it('19. should end-to-end execute AiCopilot with MockLlmProvider and return VerifiedAiAnswer', async () => {
    const ast = createSampleAst();
    const mockResponse = {
      answer: 'GET /users/{id} is vulnerable to AUTH-001 because no security scheme is attached.',
      referencedEndpoints: ['get:/users/{id}'],
      referencedSchemas: ['User'],
      referencedFindings: ['AUTH-001:get:/users/{id}'],
      referencedControls: ['PCI-8.2.1'],
      referencedChanges: [],
      limitations: ['Static contract verification only.'],
      confidence: 'HIGH',
    };

    const mockProvider = new MockLlmProvider(mockResponse);
    const copilot = new AiCopilot({ provider: mockProvider });

    const result = await copilot.ask({
      ast,
      userQuery: 'Why is GET /users/{id} insecure?',
      securityFindings: sampleSecurityFindings,
      complianceMappings: sampleComplianceMappings,
    });

    assert.equal(result.status, 'verified');
    assert.equal(result.validReferences.endpoints[0], 'get:/users/{id}');
    assert.equal(mockProvider.callCount, 1);
  });
});
