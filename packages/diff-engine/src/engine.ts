/**
 * @helios/diff-engine
 * Core Semantic API Diff Engine orchestrator.
 * Produces deterministic, structured diff reports between two CanonicalApiAst specifications.
 */

import type { CanonicalApiAst, CanonicalEndpoint } from '@helios/canonical-ast';
import { DEFAULT_DIFF_CONFIGURATION } from './constants.js';
import { compareMetadata } from './comparators/metadata.js';
import { compareParameters } from './comparators/parameters.js';
import { compareRequestBody } from './comparators/request-body.js';
import { compareResponses } from './comparators/responses.js';
import { compareSchemas } from './comparators/schema.js';
import { compareEndpointSecurity, compareGlobalSecurity } from './comparators/security.js';
import type {
  ApiChange,
  ChangeCategory,
  DiffConfiguration,
  DiffResult,
  DiffSummary,
} from './types.js';

const CATEGORY_SORT_ORDER: Record<ChangeCategory, number> = {
  endpoint: 1,
  parameter: 2,
  request_body: 3,
  response: 4,
  schema: 5,
  security: 6,
  metadata: 7,
};

export class DiffEngine {
  private readonly config: Required<DiffConfiguration>;

  constructor(config?: DiffConfiguration) {
    this.config = {
      ...DEFAULT_DIFF_CONFIGURATION,
      ...(config || {}),
    };
  }

  public compare(oldAst: CanonicalApiAst, newAst: CanonicalApiAst): DiffResult {
    const rawChanges: ApiChange[] = [];

    // 1. Metadata diff
    rawChanges.push(...compareMetadata(oldAst, newAst, this.config));

    // 2. Global Security diff
    rawChanges.push(...compareGlobalSecurity(oldAst, newAst, this.config));

    // 3. Component Schemas diff
    const oldSchemas = oldAst.schemas || {};
    const newSchemas = newAst.schemas || {};

    const oldSchemaNames = Object.keys(oldSchemas).sort();
    const newSchemaNames = Object.keys(newSchemas).sort();

    for (const name of newSchemaNames) {
      if (!(name in oldSchemas)) {
        rawChanges.push({
          id: `schema:components.schemas.${name}:SCHEMA_ADDED`,
          kind: 'SCHEMA_ADDED',
          category: 'schema',
          compatibility: 'non_breaking',
          message: `Component schema "${name}" added`,
          location: `components.schemas['${name}']`,
          rationale: 'Adding new reusable schema models is backward-compatible.',
          newValue: newSchemas[name],
        });
      }
    }

    for (const name of oldSchemaNames) {
      if (!(name in newSchemas)) {
        rawChanges.push({
          id: `schema:components.schemas.${name}:SCHEMA_REMOVED`,
          kind: 'SCHEMA_REMOVED',
          category: 'schema',
          compatibility: 'breaking',
          message: `Component schema "${name}" removed`,
          location: `components.schemas['${name}']`,
          rationale: 'Removing a component schema breaks any client or endpoint referencing it.',
          oldValue: oldSchemas[name],
        });
      }
    }

    for (const name of oldSchemaNames) {
      if (name in newSchemas) {
        const schemaChanges = compareSchemas(oldSchemas[name], newSchemas[name], {
          location: `components.schemas['${name}']`,
          direction: 'standalone',
          config: this.config,
          visitedPairs: new Set(),
        });
        rawChanges.push(...schemaChanges);
      }
    }

    // 4. Endpoints diff
    const oldEndpoints = new Map<string, CanonicalEndpoint>();
    for (const ep of oldAst.endpoints) {
      oldEndpoints.set(`${ep.method.toLowerCase()}:${ep.path}`, ep);
    }

    const newEndpoints = new Map<string, CanonicalEndpoint>();
    for (const ep of newAst.endpoints) {
      newEndpoints.set(`${ep.method.toLowerCase()}:${ep.path}`, ep);
    }

    // Added Endpoints
    for (const [key, newEp] of newEndpoints.entries()) {
      if (!oldEndpoints.has(key)) {
        rawChanges.push({
          id: `endpoint:${newEp.path}:${newEp.method}:ENDPOINT_ADDED`,
          kind: 'ENDPOINT_ADDED',
          category: 'endpoint',
          compatibility: 'non_breaking',
          message: `Endpoint ${newEp.method.toUpperCase()} ${newEp.path} added`,
          path: newEp.path,
          method: newEp.method,
          location: `endpoints[${key}]`,
          rationale: 'Adding a new API endpoint expands capabilities without breaking existing endpoints.',
          newValue: newEp,
        });
      }
    }

    // Removed Endpoints
    for (const [key, oldEp] of oldEndpoints.entries()) {
      if (!newEndpoints.has(key)) {
        rawChanges.push({
          id: `endpoint:${oldEp.path}:${oldEp.method}:ENDPOINT_REMOVED`,
          kind: 'ENDPOINT_REMOVED',
          category: 'endpoint',
          compatibility: 'breaking',
          message: `Endpoint ${oldEp.method.toUpperCase()} ${oldEp.path} removed`,
          path: oldEp.path,
          method: oldEp.method,
          location: `endpoints[${key}]`,
          rationale: 'Removing an endpoint causes all existing client requests targeting it to return 404 Not Found.',
          oldValue: oldEp,
        });
      }
    }

    // Common Endpoints
    for (const [key, oldEp] of oldEndpoints.entries()) {
      if (newEndpoints.has(key)) {
        const newEp = newEndpoints.get(key)!;

        // OperationId changed
        if (oldEp.operationId !== newEp.operationId && (oldEp.operationId || newEp.operationId)) {
          rawChanges.push({
            id: `endpoint:${oldEp.path}:${oldEp.method}:OPERATION_ID_CHANGED`,
            kind: 'OPERATION_ID_CHANGED',
            category: 'endpoint',
            compatibility: this.config.operationIdChangeImpact,
            message: `operationId changed from "${oldEp.operationId || ''}" to "${newEp.operationId || ''}" on ${oldEp.method.toUpperCase()} ${oldEp.path}`,
            path: oldEp.path,
            method: oldEp.method,
            location: 'operationId',
            rationale: 'Changing operationId affects SDK generators and programmatic client bindings.',
            oldValue: oldEp.operationId,
            newValue: newEp.operationId,
          });
        }

        // Deprecation flag
        if (!oldEp.deprecated && newEp.deprecated) {
          rawChanges.push({
            id: `endpoint:${oldEp.path}:${oldEp.method}:ENDPOINT_DEPRECATED`,
            kind: 'ENDPOINT_DEPRECATED',
            category: 'endpoint',
            compatibility: 'non_breaking',
            message: `Endpoint ${oldEp.method.toUpperCase()} ${oldEp.path} marked as deprecated`,
            path: oldEp.path,
            method: oldEp.method,
            location: 'deprecated',
            rationale: 'Deprecating an endpoint signals planned retirement but maintains operational compatibility.',
            oldValue: false,
            newValue: true,
          });
        }

        // Parameters
        rawChanges.push(...compareParameters(oldEp, newEp, this.config));

        // Request Body
        rawChanges.push(...compareRequestBody(oldEp, newEp, this.config));

        // Responses
        rawChanges.push(...compareResponses(oldEp, newEp, this.config));

        // Security
        rawChanges.push(...compareEndpointSecurity(oldEp, newEp, this.config));
      }
    }

    // 5. Deterministic sorting
    const sortedChanges = rawChanges.slice().sort((a, b) => {
      // 1. Category
      const catA = CATEGORY_SORT_ORDER[a.category] || 99;
      const catB = CATEGORY_SORT_ORDER[b.category] || 99;
      if (catA !== catB) return catA - catB;

      // 2. Path
      const pathA = a.path || '';
      const pathB = b.path || '';
      if (pathA !== pathB) return pathA.localeCompare(pathB);

      // 3. Method
      const methA = a.method || '';
      const methB = b.method || '';
      if (methA !== methB) return methA.localeCompare(methB);

      // 4. Stable ID
      return a.id.localeCompare(b.id);
    });

    // 6. Summary tabulation
    const summary: DiffSummary = {
      totalChanges: sortedChanges.length,
      breaking: 0,
      potentiallyBreaking: 0,
      nonBreaking: 0,
      securityRelevant: 0,
      byCategory: {
        metadata: 0,
        endpoint: 0,
        parameter: 0,
        request_body: 0,
        response: 0,
        schema: 0,
        security: 0,
      },
    };

    for (const change of sortedChanges) {
      if (change.compatibility === 'breaking') {
        summary.breaking += 1;
      } else if (change.compatibility === 'potentially_breaking') {
        summary.potentiallyBreaking += 1;
      } else {
        summary.nonBreaking += 1;
      }

      if (change.isSecurityRelevant) {
        summary.securityRelevant += 1;
      }

      summary.byCategory[change.category] = (summary.byCategory[change.category] || 0) + 1;
    }

    return {
      baseVersion: oldAst.version,
      targetVersion: newAst.version,
      hasBreakingChanges: summary.breaking > 0,
      summary,
      changes: sortedChanges,
      configurationApplied: this.config,
    };
  }
}

export function diffAsts(
  oldAst: CanonicalApiAst,
  newAst: CanonicalApiAst,
  config?: DiffConfiguration
): DiffResult {
  const engine = new DiffEngine(config);
  return engine.compare(oldAst, newAst);
}
