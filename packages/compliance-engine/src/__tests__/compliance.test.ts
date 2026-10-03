import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { HeliosSpec } from '@helios/canonical-ast';
import type { SecurityFinding } from '@helios/security-engine';
import {
  calculateRiskScore,
  evaluateCompliance,
  COMPLIANCE_DISCLAIMER,
} from '../index.js';

function createSampleSpec(): HeliosSpec {
  return {
    id: 'test-spec:1.0.0',
    title: 'Test Spec',
    version: '1.0.0',
    specVersion: '3.1',
    format: 'json',
    info: { title: 'Test Spec', version: '1.0.0' },
    servers: [{ url: 'https://api.example.com', description: 'Production HTTPS server' }],
    tags: [],
    endpoints: [
      {
        id: 'get:/users',
        path: '/users',
        method: 'get',
        deprecated: false,
        tags: [],
        parameters: [],
        responses: {
          '200': { statusCode: '200', description: 'OK' },
        },
      },
    ],
    schemas: {},
    securitySchemes: {
      BearerAuth: {
        id: 'BearerAuth',
        name: 'BearerAuth',
        type: 'http',
        scheme: 'bearer',
      },
    },
    security: [{ name: 'BearerAuth', scopes: [] }],
    metadata: {
      normalizedAt: new Date().toISOString(),
      sourceFormat: 'json',
      specVersion: '3.1',
      totalEndpoints: 1,
      totalSchemas: 0,
    },
  };
}

describe('Compliance Engine Tests', () => {
  it('should evaluate compliance report with all 3 supported standards', () => {
    const spec = createSampleSpec();
    const findings: SecurityFinding[] = [
      {
        id: 'AUTH-001:get:/users:',
        ruleId: 'AUTH-001',
        title: 'Missing Authentication',
        description: 'Endpoint has no effective authentication scheme.',
        severity: 'CRITICAL',
        confidence: 'HIGH',
        category: 'authentication',
        owaspCategory: 'API2:2023_BROKEN_AUTH',
        endpointPath: '/users',
        httpMethod: 'get',
        remediation: 'Declare security scheme.',
      },
      {
        id: 'TRNS-001:global:',
        ruleId: 'TRNS-001',
        title: 'HTTP Cleartext Server',
        description: 'Server defines http cleartext url.',
        severity: 'HIGH',
        confidence: 'HIGH',
        category: 'transport',
        owaspCategory: 'API8:2023_SECURITY_MISCONFIGURATION',
        remediation: 'Use HTTPS.',
      },
    ];

    const report = evaluateCompliance(spec, findings);

    assert.ok(report.timestamp);
    assert.equal(report.disclaimer, COMPLIANCE_DISCLAIMER);
    assert.ok(report.mappings.length >= 10);

    const standards = new Set(report.mappings.map((m) => m.standard));
    assert.ok(standards.has('OWASP_API_SECURITY_2023'));
    assert.ok(standards.has('PCI_DSS_V4_TECHNICAL_CONTROLS'));
    assert.ok(standards.has('HIPAA_SECURITY_RULE_TECHNICAL_SAFEGUARDS'));

    // Check that AUTH-001 mapped to API2:2023_BROKEN_AUTH as NON_COMPLIANT
    const brokenAuth = report.mappings.find((m) => m.controlId === 'API2:2023_BROKEN_AUTH');
    assert.ok(brokenAuth);
    assert.equal(brokenAuth.status, 'NON_COMPLIANT');
    assert.equal(brokenAuth.matchedFindings.length, 1);

    // Check PCI-4.2.1 mapped TRNS-001
    const pciCrypto = report.mappings.find((m) => m.controlId === 'PCI-4.2.1');
    assert.ok(pciCrypto);
    assert.equal(pciCrypto.status, 'NON_COMPLIANT');

    // Check control with no findings returns REQUIRES_MANUAL_REVIEW
    const bola = report.mappings.find((m) => m.controlId === 'API7:2023_SSRF');
    assert.ok(bola);
    assert.equal(bola.status, 'REQUIRES_MANUAL_REVIEW');
  });

  it('should calculate transparent, deterministic risk score with category breakdown', () => {
    const findings: SecurityFinding[] = [
      {
        id: 'AUTH-001',
        ruleId: 'AUTH-001',
        title: 'Missing Auth',
        description: 'No auth',
        severity: 'CRITICAL', // -25
        confidence: 'HIGH',
        category: 'authentication',
        remediation: 'Fix it',
      },
      {
        id: 'DATA-001',
        ruleId: 'DATA-001',
        title: 'Sensitive Field',
        description: 'Exposes password',
        severity: 'HIGH', // -15
        confidence: 'HIGH',
        category: 'data-exposure',
        remediation: 'Fix it',
      },
    ];

    const risk = calculateRiskScore(findings);

    assert.ok(risk.overallScore >= 0 && risk.overallScore <= 100);
    assert.equal(risk.categoryScores.authentication, 75); // 100 - 25
    assert.equal(risk.categoryScores.dataProtection, 85); // 100 - 15
    assert.equal(risk.categoryScores.inputValidation, 100);
    assert.ok(risk.formulaDescription.includes('Weighted composite score'));
  });

  it('should evaluate clean spec with no findings as optimal risk posture (100)', () => {
    const risk = calculateRiskScore([]);
    assert.equal(risk.overallScore, 100);
    assert.equal(risk.categoryScores.authentication, 100);
    assert.equal(risk.categoryScores.dataProtection, 100);
    assert.equal(risk.categoryScores.authorization, 100);
    assert.equal(risk.categoryScores.inputValidation, 100);
    assert.equal(risk.categoryScores.configuration, 100);
  });
});
