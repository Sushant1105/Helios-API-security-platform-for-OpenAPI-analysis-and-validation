/**
 * @helios/security-engine
 * Authentication and Authorization Security Rules:
 * AUTH-001: Missing Effective Security
 * AUTH-002: Explicitly Public Endpoint Override
 * AUTH-003: Unused Security Scheme
 * AUTH-004: Insecure Basic Authentication
 * AUTH-005: Incomplete OAuth2 / OpenID Connect Configuration
 * AUTH-006: Undefined Security Scheme Reference
 */

import type { CanonicalApiAst } from '@helios/canonical-ast';
import type { SecurityFinding, SecurityRule, SecurityRuleContext } from '../types.js';

export const ruleMissingEffectiveSecurity: SecurityRule = {
  id: 'AUTH-001',
  name: 'MISSING_EFFECTIVE_SECURITY',
  description: 'Identifies endpoints that have no effective security requirement applied (neither operation-level nor global security).',
  defaultSeverity: 'HIGH',
  confidence: 'HIGH',
  category: 'authentication',
  owaspCategory: 'API2:2023_BROKEN_AUTH',
  execute(ast: CanonicalApiAst, _context: SecurityRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const hasGlobalSecurity = Array.isArray(ast.security) && ast.security.length > 0;

    for (const ep of ast.endpoints) {
      // If endpoint has no security defined (undefined) AND there is no global security
      const hasOperationSecurity = ep.security !== undefined && ep.security !== null;
      if (!hasOperationSecurity && !hasGlobalSecurity) {
        findings.push({
          id: `AUTH-001:${ep.id}`,
          ruleId: 'AUTH-001',
          title: 'Endpoint Has No Effective Security',
          description: `Operation "${ep.id}" (${ep.method.toUpperCase()} ${ep.path}) does not declare an operation-level security requirement and no global API security requirement exists.`,
          severity: this.defaultSeverity,
          confidence: this.confidence,
          category: this.category,
          owaspCategory: this.owaspCategory,
          endpointPath: ep.path,
          httpMethod: ep.method,
          remediation: 'Declare a security requirement on the endpoint or configure a global security requirement in the root security array.',
          evidence: `Global security: ${hasGlobalSecurity ? 'present' : 'none'}; Endpoint security: undefined`,
        });
      }
    }

    return findings;
  },
};

export const ruleExplicitPublicEndpoint: SecurityRule = {
  id: 'AUTH-002',
  name: 'EXPLICIT_PUBLIC_ENDPOINT',
  description: 'Identifies endpoints that explicitly override and disable global security with an empty security array [].',
  defaultSeverity: 'MEDIUM',
  confidence: 'HIGH',
  category: 'authentication',
  owaspCategory: 'API2:2023_BROKEN_AUTH',
  execute(ast: CanonicalApiAst, _context: SecurityRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const hasGlobalSecurity = Array.isArray(ast.security) && ast.security.length > 0;

    // Only applies if global security actually exists
    if (!hasGlobalSecurity) {
      return findings;
    }

    for (const ep of ast.endpoints) {
      if (Array.isArray(ep.security) && ep.security.length === 0) {
        findings.push({
          id: `AUTH-002:${ep.id}`,
          ruleId: 'AUTH-002',
          title: 'Endpoint Explicitly Overrides Global Security as Public',
          description: `Operation "${ep.id}" (${ep.method.toUpperCase()} ${ep.path}) explicitly defines "security: []", disabling all global API authentication controls for this operation.`,
          severity: this.defaultSeverity,
          confidence: this.confidence,
          category: this.category,
          owaspCategory: this.owaspCategory,
          endpointPath: ep.path,
          httpMethod: ep.method,
          remediation: 'Verify whether this endpoint is intentionally unauthenticated (e.g. public health check or login). If unintentional, remove the empty security array.',
          evidence: 'endpoint.security is explicitly set to []',
        });
      }
    }

    return findings;
  },
};

export const ruleUnusedSecurityScheme: SecurityRule = {
  id: 'AUTH-003',
  name: 'UNUSED_SECURITY_SCHEME',
  description: 'Detects authentication schemes declared in components.securitySchemes that are never applied in any security requirement.',
  defaultSeverity: 'INFO',
  confidence: 'HIGH',
  category: 'configuration',
  owaspCategory: 'API9:2023_IMPROPER_INVENTORY_MANAGEMENT',
  execute(ast: CanonicalApiAst, _context: SecurityRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const definedSchemes = Object.keys(ast.securitySchemes);
    if (definedSchemes.length === 0) return findings;

    const usedSchemes = new Set<string>();

    for (const sec of ast.security) {
      usedSchemes.add(sec.name);
    }

    for (const ep of ast.endpoints) {
      if (Array.isArray(ep.security)) {
        for (const sec of ep.security) {
          usedSchemes.add(sec.name);
        }
      }
    }

    for (const schemeId of definedSchemes) {
      if (!usedSchemes.has(schemeId)) {
        findings.push({
          id: `AUTH-003:${schemeId}`,
          ruleId: 'AUTH-003',
          title: 'Unused Security Scheme Declared',
          description: `Security scheme "${schemeId}" is defined in components.securitySchemes but is never referenced in global or endpoint security requirements.`,
          severity: this.defaultSeverity,
          confidence: this.confidence,
          category: this.category,
          owaspCategory: this.owaspCategory,
          remediation: 'Remove the unused security scheme definition or apply it to the relevant operations.',
          evidence: `components.securitySchemes.${schemeId} has 0 references`,
        });
      }
    }

    return findings;
  },
};

export const ruleInsecureBasicAuth: SecurityRule = {
  id: 'AUTH-004',
  name: 'INSECURE_BASIC_AUTH',
  description: 'Detects HTTP Basic authentication configured or used on an API that supports unencrypted HTTP transport.',
  defaultSeverity: 'HIGH',
  confidence: 'HIGH',
  category: 'authentication',
  owaspCategory: 'API2:2023_BROKEN_AUTH',
  execute(ast: CanonicalApiAst, _context: SecurityRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const hasHttpServer = ast.servers.some((s) => s.url.toLowerCase().startsWith('http://'));

    for (const [id, scheme] of Object.entries(ast.securitySchemes)) {
      if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'basic') {
        if (hasHttpServer || ast.servers.length === 0) {
          findings.push({
            id: `AUTH-004:${id}`,
            ruleId: 'AUTH-004',
            title: 'HTTP Basic Authentication Over Plaintext HTTP',
            description: `Security scheme "${id}" uses HTTP Basic authentication while the API servers include unencrypted HTTP endpoints. Basic authentication transmits credentials encoded in plaintext Base64.`,
            severity: this.defaultSeverity,
            confidence: this.confidence,
            category: this.category,
            owaspCategory: this.owaspCategory,
            remediation: 'Migrate to a modern bearer token protocol (OAuth2/OpenID Connect) and mandate HTTPS for all environments.',
            evidence: `Scheme: ${id} (http/basic); Servers with http://: ${ast.servers.map((s) => s.url).join(', ')}`,
          });
        }
      }
    }

    return findings;
  },
};

export const ruleIncompleteOAuth2Config: SecurityRule = {
  id: 'AUTH-005',
  name: 'INCOMPLETE_OAUTH2_CONFIG',
  description: 'Detects OAuth2 or OpenID Connect configurations missing necessary authorization, token, or discovery endpoints.',
  defaultSeverity: 'MEDIUM',
  confidence: 'HIGH',
  category: 'configuration',
  owaspCategory: 'API2:2023_BROKEN_AUTH',
  execute(ast: CanonicalApiAst, _context: SecurityRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    for (const [id, scheme] of Object.entries(ast.securitySchemes)) {
      if (scheme.type === 'oauth2') {
        if (!scheme.flows || typeof scheme.flows !== 'object' || Object.keys(scheme.flows).length === 0) {
          findings.push({
            id: `AUTH-005:${id}:no-flows`,
            ruleId: 'AUTH-005',
            title: 'OAuth2 Scheme Missing Flows Configuration',
            description: `OAuth2 security scheme "${id}" has no OAuth2 flow configurations defined.`,
            severity: this.defaultSeverity,
            confidence: this.confidence,
            category: this.category,
            owaspCategory: this.owaspCategory,
            remediation: 'Configure at least one OAuth2 flow (authorizationCode, clientCredentials, etc.) with required URLs.',
          });
        } else {
          for (const [flowName, flowVal] of Object.entries(scheme.flows)) {
            const fObj = flowVal as Record<string, unknown> | null;
            if (!fObj || typeof fObj !== 'object') continue;

            if (flowName === 'authorizationCode') {
              if (!fObj.authorizationUrl || !fObj.tokenUrl) {
                findings.push({
                  id: `AUTH-005:${id}:${flowName}:missing-urls`,
                  ruleId: 'AUTH-005',
                  title: 'OAuth2 Authorization Code Flow Missing Required URLs',
                  description: `OAuth2 scheme "${id}" flow "${flowName}" requires both "authorizationUrl" and "tokenUrl".`,
                  severity: this.defaultSeverity,
                  confidence: this.confidence,
                  category: this.category,
                  owaspCategory: this.owaspCategory,
                  remediation: 'Provide valid URLs for authorizationUrl and tokenUrl in the OAuth2 flow.',
                });
              }
            }
          }
        }
      } else if (scheme.type === 'openIdConnect') {
        if (!scheme.openIdConnectUrl || typeof scheme.openIdConnectUrl !== 'string') {
          findings.push({
            id: `AUTH-005:${id}:missing-oidc-url`,
            ruleId: 'AUTH-005',
            title: 'OpenID Connect Scheme Missing Discovery URL',
            description: `OpenID Connect security scheme "${id}" is missing the mandatory "openIdConnectUrl" discovery endpoint.`,
            severity: this.defaultSeverity,
            confidence: this.confidence,
            category: this.category,
            owaspCategory: this.owaspCategory,
            remediation: 'Specify the openIdConnectUrl pointing to the OpenID provider configuration (.well-known/openid-configuration).',
          });
        }
      }
    }

    return findings;
  },
};

export const ruleUndefinedSecurityScheme: SecurityRule = {
  id: 'AUTH-006',
  name: 'UNDEFINED_SECURITY_SCHEME',
  description: 'Identifies security requirements referencing an authentication scheme not defined in components.securitySchemes.',
  defaultSeverity: 'HIGH',
  confidence: 'HIGH',
  category: 'authentication',
  owaspCategory: 'API8:2023_SECURITY_MISCONFIGURATION',
  execute(ast: CanonicalApiAst, _context: SecurityRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const definedSchemes = new Set(Object.keys(ast.securitySchemes));

    for (const sec of ast.security) {
      if (!definedSchemes.has(sec.name)) {
        findings.push({
          id: `AUTH-006:global:${sec.name}`,
          ruleId: 'AUTH-006',
          title: 'Global Security References Undefined Scheme',
          description: `Global security requirement references security scheme "${sec.name}", but it is not defined in components.securitySchemes.`,
          severity: this.defaultSeverity,
          confidence: this.confidence,
          category: this.category,
          owaspCategory: this.owaspCategory,
          remediation: `Define "${sec.name}" under components.securitySchemes or remove the requirement.`,
        });
      }
    }

    for (const ep of ast.endpoints) {
      if (Array.isArray(ep.security)) {
        for (const sec of ep.security) {
          if (!definedSchemes.has(sec.name)) {
            findings.push({
              id: `AUTH-006:${ep.id}:${sec.name}`,
              ruleId: 'AUTH-006',
              title: 'Endpoint Security References Undefined Scheme',
              description: `Operation "${ep.id}" references security scheme "${sec.name}", but it is not defined in components.securitySchemes.`,
              severity: this.defaultSeverity,
              confidence: this.confidence,
              category: this.category,
              owaspCategory: this.owaspCategory,
              endpointPath: ep.path,
              httpMethod: ep.method,
              remediation: `Define "${sec.name}" under components.securitySchemes or remove the requirement.`,
            });
          }
        }
      }
    }

    return findings;
  },
};

export const authRules: SecurityRule[] = [
  ruleMissingEffectiveSecurity,
  ruleExplicitPublicEndpoint,
  ruleUnusedSecurityScheme,
  ruleInsecureBasicAuth,
  ruleIncompleteOAuth2Config,
  ruleUndefinedSecurityScheme,
];
