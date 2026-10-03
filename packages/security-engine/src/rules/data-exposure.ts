/**
 * @helios/security-engine
 * Sensitive Data Exposure Rules:
 * DATA-001: Sensitive Field Heuristic in Response Payload
 * DATA-002: Sensitive Field Heuristic in Request URL / Parameters
 */

import type { CanonicalApiAst, CanonicalSchema } from '@helios/canonical-ast';
import type { SecurityFinding, SecurityRule, SecurityRuleContext } from '../types.js';

export const DEFAULT_SENSITIVE_FIELD_NAMES: string[] = [
  'password',
  'passwordhash',
  'secret',
  'privatekey',
  'accesstoken',
  'refreshtoken',
  'ssn',
  'aadhaar',
  'creditcardnumber',
  'cvv',
  'cardnumber',
];

function isSensitiveFieldName(fieldName: string, sensitiveList: string[]): boolean {
  const normalized = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return sensitiveList.some((sens) => {
    const cleanSens = sens.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalized.includes(cleanSens) || cleanSens.includes(normalized);
  });
}

export const ruleSensitiveFieldInResponse: SecurityRule = {
  id: 'DATA-001',
  name: 'SENSITIVE_FIELD_IN_RESPONSE',
  description: 'Heuristically detects response properties matching sensitive credential, token, or PII keywords.',
  defaultSeverity: 'HIGH',
  confidence: 'MEDIUM',
  category: 'data-exposure',
  owaspCategory: 'API3:2023_BOPLA',
  execute(ast: CanonicalApiAst, context: SecurityRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const sensitiveList = context.options.sensitiveFieldNames || DEFAULT_SENSITIVE_FIELD_NAMES;

    const inspectSchema = (
      schema: CanonicalSchema | undefined,
      endpointPath: string,
      endpointId: string,
      statusCode: string,
      mediaType: string,
      currentPath = ''
    ) => {
      if (!schema) return;

      if (schema.properties) {
        for (const [propName, prop] of Object.entries(schema.properties)) {
          const propPath = currentPath ? `${currentPath}.${propName}` : propName;
          if (isSensitiveFieldName(propName, sensitiveList)) {
            findings.push({
              id: `DATA-001:${endpointId}:${statusCode}:${propPath}`,
              ruleId: 'DATA-001',
              title: `Heuristic: Sensitive Field "${propName}" in Response`,
              description: `Response (${statusCode} on ${endpointId}) defines schema property "${propPath}" matching sensitive field name patterns. Returning sensitive data can cause excessive data exposure (OWASP API3).`,
              severity: this.defaultSeverity,
              confidence: this.confidence,
              category: this.category,
              owaspCategory: this.owaspCategory,
              endpointPath,
              remediation: `Verify that "${propName}" is strictly necessary for client consumption. Mask or exclude sensitive fields, tokens, or hashed credentials from public response payloads.`,
              isHeuristic: true,
              evidence: `Response ${statusCode} -> content[${mediaType}] -> property: ${propPath}`,
            });
          }

          inspectSchema(prop.schema, endpointPath, endpointId, statusCode, mediaType, propPath);
        }
      }

      if (schema.items) {
        inspectSchema(schema.items, endpointPath, endpointId, statusCode, mediaType, `${currentPath}[]`);
      }
    };

    for (const ep of ast.endpoints) {
      for (const [code, resp] of Object.entries(ep.responses)) {
        if (resp.content) {
          for (const [media, mObj] of Object.entries(resp.content)) {
            inspectSchema(mObj.schema, ep.path, ep.id, code, media);
          }
        }
      }
    }

    // Also inspect components.schemas
    for (const [name, schema] of Object.entries(ast.schemas)) {
      if (schema.properties) {
        for (const propName of Object.keys(schema.properties)) {
          if (isSensitiveFieldName(propName, sensitiveList)) {
            findings.push({
              id: `DATA-001:components.schemas.${name}:${propName}`,
              ruleId: 'DATA-001',
              title: `Heuristic: Sensitive Field "${propName}" in Schema "${name}"`,
              description: `Shared schema "${name}" defines property "${propName}" matching sensitive credential/PII keyword patterns.`,
              severity: this.defaultSeverity,
              confidence: this.confidence,
              category: this.category,
              owaspCategory: this.owaspCategory,
              remediation: `Verify if "${propName}" is returned in API responses and apply appropriate masking or exclusion.`,
              isHeuristic: true,
              evidence: `components.schemas.${name}.properties.${propName}`,
            });
          }
        }
      }
    }

    return findings;
  },
};

export const ruleSensitiveFieldInRequest: SecurityRule = {
  id: 'DATA-002',
  name: 'SENSITIVE_FIELD_IN_REQUEST',
  description: 'Heuristically detects sensitive credentials, secrets, or PII transmitted via URL query or path parameters.',
  defaultSeverity: 'MEDIUM',
  confidence: 'MEDIUM',
  category: 'data-exposure',
  owaspCategory: 'API3:2023_BOPLA',
  execute(ast: CanonicalApiAst, context: SecurityRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const sensitiveList = context.options.sensitiveFieldNames || DEFAULT_SENSITIVE_FIELD_NAMES;

    for (const ep of ast.endpoints) {
      for (const p of ep.parameters) {
        if (p.in === 'query' || p.in === 'path') {
          if (isSensitiveFieldName(p.name, sensitiveList)) {
            findings.push({
              id: `DATA-002:${ep.id}:${p.in}:${p.name}`,
              ruleId: 'DATA-002',
              title: `Heuristic: Sensitive Parameter "${p.name}" in URL ${p.in.toUpperCase()}`,
              description: `Operation "${ep.id}" defines ${p.in} parameter "${p.name}" matching sensitive credential/PII patterns. Parameters transmitted in URLs are stored in proxy logs, web server logs, and browser histories.`,
              severity: this.defaultSeverity,
              confidence: this.confidence,
              category: this.category,
              owaspCategory: this.owaspCategory,
              endpointPath: ep.path,
              httpMethod: ep.method,
              remediation: `Move "${p.name}" into an encrypted request body (POST/PUT) or standard HTTP authorization header instead of URL ${p.in}.`,
              isHeuristic: true,
              evidence: `Parameter ${p.name} (in: ${p.in}) on ${ep.id}`,
            });
          }
        }
      }
    }

    return findings;
  },
};

export const dataExposureRules: SecurityRule[] = [
  ruleSensitiveFieldInResponse,
  ruleSensitiveFieldInRequest,
];
