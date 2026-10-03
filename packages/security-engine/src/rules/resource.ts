/**
 * @helios/security-engine
 * Resource Consumption Security Rules:
 * RSRC-001: Collection Endpoint Without Pagination
 * RSRC-002: Request Array Without maxItems Constraint
 * RSRC-003: String Input Without maxLength Limit
 * RSRC-004: Numeric Input Without Range Bounds
 * RSRC-005: Unconstrained File Upload
 */

import type { CanonicalApiAst, CanonicalEndpoint, CanonicalSchema } from '@helios/canonical-ast';
import type { SecurityFinding, SecurityRule, SecurityRuleContext } from '../types.js';

export const DEFAULT_PAGINATION_KEYWORDS: string[] = [
  'limit',
  'offset',
  'page',
  'pagesize',
  'per_page',
  'cursor',
  'starting_after',
  'ending_before',
  'skip',
  'take',
];

export const ruleUnpaginatedCollection: SecurityRule = {
  id: 'RSRC-001',
  name: 'UNPAGINATED_COLLECTION',
  description: 'Detects collection GET endpoints returning an array of items without pagination query parameters.',
  defaultSeverity: 'MEDIUM',
  confidence: 'MEDIUM',
  category: 'resource-consumption',
  owaspCategory: 'API4:2023_UNRESTRICTED_RESOURCE_CONSUMPTION',
  execute(ast: CanonicalApiAst, context: SecurityRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const keywords = context.options.paginationKeywords || DEFAULT_PAGINATION_KEYWORDS;

    for (const ep of ast.endpoints) {
      if (ep.method !== 'get') continue;

      // Check if any 200/201 response returns an array
      let returnsCollection = false;
      const resp200 = ep.responses['200'] || ep.responses['201'] || ep.responses['default'];
      if (resp200?.content) {
        for (const mObj of Object.values(resp200.content)) {
          if (mObj.schema?.type === 'array') {
            returnsCollection = true;
            break;
          }
          if (mObj.schema?.properties) {
            // Check for common collection envelopes like { data: [], items: [], results: [] }
            for (const [propName, prop] of Object.entries(mObj.schema.properties)) {
              if (['items', 'data', 'results', 'records'].includes(propName.toLowerCase()) && prop.schema.type === 'array') {
                returnsCollection = true;
                break;
              }
            }
          }
        }
      }

      if (returnsCollection) {
        const queryParamNames = ep.parameters
          .filter((p) => p.in === 'query')
          .map((p) => p.name.toLowerCase().replace(/[^a-z0-9]/g, ''));

        const hasPagination = queryParamNames.some((qp) =>
          keywords.some((kw) => qp.includes(kw.replace(/[^a-z0-9]/g, '')))
        );

        if (!hasPagination) {
          findings.push({
            id: `RSRC-001:${ep.id}`,
            ruleId: 'RSRC-001',
            title: 'Collection Endpoint Lacks Pagination Parameters',
            description: `GET endpoint "${ep.id}" (${ep.path}) returns an array or collection, but specifies no pagination parameters (e.g. limit, offset, page, cursor). Large queries can exhaust server memory or bandwidth.`,
            severity: this.defaultSeverity,
            confidence: this.confidence,
            category: this.category,
            owaspCategory: this.owaspCategory,
            endpointPath: ep.path,
            httpMethod: ep.method,
            remediation: 'Implement cursor-based or limit-offset pagination with query parameters and enforce a maximum page size on the server.',
            evidence: `Endpoint returns array response with 0 query parameters matching: ${keywords.slice(0, 5).join(', ')}...`,
          });
        }
      }
    }

    return findings;
  },
};

export const ruleArrayWithoutMaxItems: SecurityRule = {
  id: 'RSRC-002',
  name: 'ARRAY_WITHOUT_MAX_ITEMS',
  description: 'Detects request body arrays or collection parameters that omit the maxItems constraint.',
  defaultSeverity: 'LOW',
  confidence: 'MEDIUM',
  category: 'resource-consumption',
  owaspCategory: 'API4:2023_UNRESTRICTED_RESOURCE_CONSUMPTION',
  execute(ast: CanonicalApiAst, _context: SecurityRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    const inspectSchema = (schema: CanonicalSchema | undefined, ep: CanonicalEndpoint, contextLabel: string) => {
      if (!schema) return;

      if (schema.type === 'array' && schema.maxItems === undefined) {
        findings.push({
          id: `RSRC-002:${ep.id}:${contextLabel}`,
          ruleId: 'RSRC-002',
          title: `Array Schema Without maxItems Constraint in ${contextLabel}`,
          description: `Operation "${ep.id}" defines an array schema in ${contextLabel} with no "maxItems" constraint, which can permit unbounded payload submissions.`,
          severity: this.defaultSeverity,
          confidence: this.confidence,
          category: this.category,
          owaspCategory: this.owaspCategory,
          endpointPath: ep.path,
          httpMethod: ep.method,
          remediation: 'Specify a reasonable "maxItems" constraint in the array schema.',
          evidence: `Schema type: array, maxItems: undefined`,
        });
      }

      if (schema.properties) {
        for (const [propName, prop] of Object.entries(schema.properties)) {
          inspectSchema(prop.schema, ep, `${contextLabel}.${propName}`);
        }
      }
    };

    for (const ep of ast.endpoints) {
      if (ep.requestBody?.content) {
        for (const [media, mObj] of Object.entries(ep.requestBody.content)) {
          inspectSchema(mObj.schema, ep, `requestBody[${media}]`);
        }
      }
    }

    return findings;
  },
};

export const ruleStringWithoutMaxLength: SecurityRule = {
  id: 'RSRC-003',
  name: 'STRING_WITHOUT_MAX_LENGTH',
  description: 'Flags free-form string properties in request payloads that omit maxLength constraints.',
  defaultSeverity: 'LOW',
  confidence: 'LOW',
  category: 'resource-consumption',
  owaspCategory: 'API4:2023_UNRESTRICTED_RESOURCE_CONSUMPTION',
  execute(ast: CanonicalApiAst, _context: SecurityRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    const inspectSchema = (schema: CanonicalSchema | undefined, ep: CanonicalEndpoint, contextLabel: string) => {
      if (!schema) return;

      if (schema.type === 'string' && schema.maxLength === undefined && !schema.enum && schema.format !== 'date' && schema.format !== 'date-time' && schema.format !== 'uuid') {
        findings.push({
          id: `RSRC-003:${ep.id}:${contextLabel}`,
          ruleId: 'RSRC-003',
          title: `String Input Lacks maxLength Constraint in ${contextLabel}`,
          description: `String property in ${contextLabel} on "${ep.id}" does not specify a "maxLength" constraint.`,
          severity: this.defaultSeverity,
          confidence: this.confidence,
          category: this.category,
          owaspCategory: this.owaspCategory,
          endpointPath: ep.path,
          httpMethod: ep.method,
          remediation: 'Define an appropriate "maxLength" limit to guard against buffer and database memory exhaustion.',
          evidence: `Property ${contextLabel}: type: string, maxLength: undefined`,
        });
      }

      if (schema.properties) {
        for (const [propName, prop] of Object.entries(schema.properties)) {
          inspectSchema(prop.schema, ep, `${contextLabel}.${propName}`);
        }
      }
    };

    for (const ep of ast.endpoints) {
      if (ep.requestBody?.content) {
        for (const [media, mObj] of Object.entries(ep.requestBody.content)) {
          inspectSchema(mObj.schema, ep, `requestBody[${media}]`);
        }
      }
    }

    return findings;
  },
};

export const ruleNumericWithoutBounds: SecurityRule = {
  id: 'RSRC-004',
  name: 'NUMERIC_WITHOUT_BOUNDS',
  description: 'Identifies numeric parameters or payload inputs without minimum or maximum constraints.',
  defaultSeverity: 'LOW',
  confidence: 'LOW',
  category: 'resource-consumption',
  owaspCategory: 'API4:2023_UNRESTRICTED_RESOURCE_CONSUMPTION',
  execute(ast: CanonicalApiAst, _context: SecurityRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    for (const ep of ast.endpoints) {
      for (const p of ep.parameters) {
        if ((p.schema?.type === 'integer' || p.schema?.type === 'number') && p.schema.minimum === undefined && p.schema.maximum === undefined) {
          findings.push({
            id: `RSRC-004:${ep.id}:param:${p.name}`,
            ruleId: 'RSRC-004',
            title: `Numeric Parameter "${p.name}" Lacks Range Bounds`,
            description: `Parameter "${p.name}" on "${ep.id}" has numeric type without minimum or maximum boundaries.`,
            severity: this.defaultSeverity,
            confidence: this.confidence,
            category: this.category,
            owaspCategory: this.owaspCategory,
            endpointPath: ep.path,
            httpMethod: ep.method,
            remediation: 'Specify minimum and maximum bounds for numeric parameters.',
            evidence: `Parameter ${p.name}: type: ${p.schema.type}, minimum: undefined, maximum: undefined`,
          });
        }
      }
    }

    return findings;
  },
};

export const ruleUnconstrainedFileUpload: SecurityRule = {
  id: 'RSRC-005',
  name: 'UNCONSTRAINED_FILE_UPLOAD',
  description: 'Detects file upload request bodies (multipart/form-data or binary) that have no documented payload size constraints.',
  defaultSeverity: 'MEDIUM',
  confidence: 'MEDIUM',
  category: 'resource-consumption',
  owaspCategory: 'API4:2023_UNRESTRICTED_RESOURCE_CONSUMPTION',
  execute(ast: CanonicalApiAst, _context: SecurityRuleContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    for (const ep of ast.endpoints) {
      if (ep.requestBody?.content) {
        for (const [media, mObj] of Object.entries(ep.requestBody.content)) {
          const lowerMedia = media.toLowerCase();
          const isUpload =
            lowerMedia.includes('multipart/form-data') ||
            lowerMedia.includes('application/octet-stream') ||
            mObj.schema?.format === 'binary';

          if (isUpload) {
            findings.push({
              id: `RSRC-005:${ep.id}:${media}`,
              ruleId: 'RSRC-005',
              title: `File Upload Endpoint Lacks Size Limits in ${media}`,
              description: `Operation "${ep.id}" accepts file uploads via "${media}" without documented file size limitations, creating potential Denial of Service (DoS) vulnerability.`,
              severity: this.defaultSeverity,
              confidence: this.confidence,
              category: this.category,
              owaspCategory: this.owaspCategory,
              endpointPath: ep.path,
              httpMethod: ep.method,
              remediation: 'Enforce and document maximum upload payload sizes in web server gateways and API definitions.',
              evidence: `Media type: ${media}`,
            });
          }
        }
      }
    }

    return findings;
  },
};

export const resourceRules: SecurityRule[] = [
  ruleUnpaginatedCollection,
  ruleArrayWithoutMaxItems,
  ruleStringWithoutMaxLength,
  ruleNumericWithoutBounds,
  ruleUnconstrainedFileUpload,
];
