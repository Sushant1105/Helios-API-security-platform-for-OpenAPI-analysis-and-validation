/**
 * @helios/security-engine
 * Transport Security Rules:
 * TRNS-001: Plaintext HTTP Server URL
 * TRNS-002: Insecure Production Server URL
 * TRNS-003: Sensitive Operations Exposed Over Insecure HTTP
 * TRNS-004: API Key Transmitted in Query String
 */

import type { CanonicalApiAst } from '@helios/canonical-ast';
import type { SecurityFinding, SecurityRule, SecurityRuleContext } from '../types.js';

export const ruleHttpServerUrl: SecurityRule = {
  id: 'TRNS-001',
  name: 'HTTP_SERVER_URL',
  description: 'Detects API server URLs configured with unencrypted http:// protocol.',
  defaultSeverity: 'HIGH',
  confidence: 'HIGH',
  category: 'transport',
  owaspCategory: 'API8:2023_SECURITY_MISCONFIGURATION',
  execute(ast: CanonicalApiAst, _context: SecurityRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    for (const server of ast.servers) {
      const lower = server.url.toLowerCase();
      if (lower.startsWith('http://') && !lower.includes('localhost') && !lower.includes('127.0.0.1')) {
        findings.push({
          id: `TRNS-001:${server.url}`,
          ruleId: 'TRNS-001',
          title: 'Unencrypted HTTP Server URL',
          description: `Server URL "${server.url}" specifies unencrypted "http://" transport. Traffic can be intercepted or modified via man-in-the-middle attacks.`,
          severity: this.defaultSeverity,
          confidence: this.confidence,
          category: this.category,
          owaspCategory: this.owaspCategory,
          remediation: 'Update server URL to use the secure "https://" protocol with TLS 1.2 or higher.',
          evidence: `Server URL: ${server.url}`,
        });
      }
    }

    return findings;
  },
};

export const ruleInsecureProductionServer: SecurityRule = {
  id: 'TRNS-002',
  name: 'INSECURE_PRODUCTION_SERVER',
  description: 'Detects production server definitions configured without TLS/HTTPS encryption.',
  defaultSeverity: 'CRITICAL',
  confidence: 'HIGH',
  category: 'transport',
  owaspCategory: 'API8:2023_SECURITY_MISCONFIGURATION',
  execute(ast: CanonicalApiAst, _context: SecurityRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    for (const server of ast.servers) {
      const lowerUrl = server.url.toLowerCase();
      const lowerDesc = (server.description || '').toLowerCase();
      const isProd =
        lowerDesc.includes('prod') ||
        lowerDesc.includes('production') ||
        lowerDesc.includes('live') ||
        lowerUrl.includes('prod.');

      if (isProd && lowerUrl.startsWith('http://')) {
        findings.push({
          id: `TRNS-002:${server.url}`,
          ruleId: 'TRNS-002',
          title: 'Production Server Configured Over Insecure HTTP',
          description: `Production server "${server.url}" (${server.description || 'Production'}) is exposed over unencrypted HTTP. Production APIs must enforce HTTPS strictly.`,
          severity: this.defaultSeverity,
          confidence: this.confidence,
          category: this.category,
          owaspCategory: this.owaspCategory,
          remediation: 'Mandate HTTPS for all production endpoints and enforce HTTP Strict Transport Security (HSTS).',
          evidence: `Server: ${server.url} (Description: ${server.description || 'none'})`,
        });
      }
    }

    return findings;
  },
};

export const ruleSensitiveOperationOverHttp: SecurityRule = {
  id: 'TRNS-003',
  name: 'SENSITIVE_OPERATION_OVER_HTTP',
  description: 'Flags state-modifying operations (POST, PUT, PATCH, DELETE) or auth endpoints when the API exposes HTTP servers.',
  defaultSeverity: 'HIGH',
  confidence: 'HIGH',
  category: 'transport',
  owaspCategory: 'API2:2023_BROKEN_AUTH',
  execute(ast: CanonicalApiAst, _context: SecurityRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const hasOnlyHttpServers =
      ast.servers.length > 0 &&
      ast.servers.every((s) => s.url.toLowerCase().startsWith('http://') && !s.url.includes('localhost'));

    if (!hasOnlyHttpServers) return findings;

    const mutatingMethods = new Set(['post', 'put', 'patch', 'delete']);

    for (const ep of ast.endpoints) {
      const isMutating = mutatingMethods.has(ep.method);
      const isAuthEndpoint = /login|auth|token|password|oauth/i.test(ep.path);

      if (isMutating || isAuthEndpoint) {
        findings.push({
          id: `TRNS-003:${ep.id}`,
          ruleId: 'TRNS-003',
          title: 'Sensitive Operation Exposed Over Insecure Transport',
          description: `Operation "${ep.id}" (${ep.method.toUpperCase()} ${ep.path}) performs state mutations or credentials handling on an API with exclusively unencrypted HTTP servers.`,
          severity: this.defaultSeverity,
          confidence: this.confidence,
          category: this.category,
          owaspCategory: this.owaspCategory,
          endpointPath: ep.path,
          httpMethod: ep.method,
          remediation: 'Enforce HTTPS for all state-modifying and authentication endpoints.',
          evidence: `Method: ${ep.method.toUpperCase()}, Path: ${ep.path}`,
        });
      }
    }

    return findings;
  },
};

export const ruleQueryApiKeyAuth: SecurityRule = {
  id: 'TRNS-004',
  name: 'QUERY_API_KEY_AUTH',
  description: 'Detects API key authentication transmitted in query parameters, which are routinely leaked via browser histories, server access logs, and referrer headers.',
  defaultSeverity: 'MEDIUM',
  confidence: 'HIGH',
  category: 'transport',
  owaspCategory: 'API2:2023_BROKEN_AUTH',
  execute(ast: CanonicalApiAst, _context: SecurityRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    for (const [id, scheme] of Object.entries(ast.securitySchemes)) {
      if (scheme.type === 'apiKey' && scheme.in === 'query') {
        findings.push({
          id: `TRNS-004:${id}`,
          ruleId: 'TRNS-004',
          title: 'API Key Transmitted in URL Query String',
          description: `API Key security scheme "${id}" specifies parameter location "in: query" (parameter "${scheme.name || 'key'}"). Query parameters are frequently logged in web server access logs, proxy caches, and browser history.`,
          severity: this.defaultSeverity,
          confidence: this.confidence,
          category: this.category,
          owaspCategory: this.owaspCategory,
          remediation: 'Transmit API keys in standard HTTP headers (e.g. "X-API-Key" or "Authorization: Bearer") instead of URL query parameters.',
          evidence: `components.securitySchemes.${id}: in: query, name: ${scheme.name || 'unknown'}`,
        });
      }
    }

    return findings;
  },
};

export const transportRules: SecurityRule[] = [
  ruleHttpServerUrl,
  ruleInsecureProductionServer,
  ruleSensitiveOperationOverHttp,
  ruleQueryApiKeyAuth,
];
