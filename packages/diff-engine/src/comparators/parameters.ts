/**
 * @helios/diff-engine
 * Comparator for endpoint parameters: query, path, header, and cookie.
 */

import type { CanonicalEndpoint, CanonicalParameter } from '@helios/canonical-ast';
import type { ApiChange, DiffConfiguration } from '../types.js';
import { compareSchemas } from './schema.js';

export function compareParameters(
  oldEndpoint: CanonicalEndpoint,
  newEndpoint: CanonicalEndpoint,
  config: Required<DiffConfiguration>
): ApiChange[] {
  const changes: ApiChange[] = [];
  const { path, method } = oldEndpoint;

  const oldParams = new Map<string, CanonicalParameter>();
  for (const param of oldEndpoint.parameters) {
    oldParams.set(`${param.in}:${param.name}`, param);
  }

  const newParams = new Map<string, CanonicalParameter>();
  for (const param of newEndpoint.parameters) {
    newParams.set(`${param.in}:${param.name}`, param);
  }

  // 1. Added parameters
  for (const [key, newParam] of newParams.entries()) {
    if (!oldParams.has(key)) {
      const isBreaking = newParam.required;
      changes.push({
        id: `parameter:${path}:${method}:${newParam.in}:${newParam.name}:PARAMETER_ADDED`,
        kind: 'PARAMETER_ADDED',
        category: 'parameter',
        compatibility: isBreaking ? 'breaking' : 'non_breaking',
        message: `Parameter "${newParam.name}" (in: ${newParam.in}) added to ${method.toUpperCase()} ${path} (required: ${newParam.required})`,
        path,
        method,
        location: `parameters[${newParam.in}:${newParam.name}]`,
        rationale: isBreaking
          ? 'Adding a required parameter breaks existing clients that do not transmit this parameter.'
          : 'Adding an optional parameter allows new capabilities while preserving backward compatibility.',
        newValue: newParam,
      });
    }
  }

  // 2. Removed parameters
  for (const [key, oldParam] of oldParams.entries()) {
    if (!newParams.has(key)) {
      changes.push({
        id: `parameter:${path}:${method}:${oldParam.in}:${oldParam.name}:PARAMETER_REMOVED`,
        kind: 'PARAMETER_REMOVED',
        category: 'parameter',
        compatibility: 'non_breaking',
        message: `Parameter "${oldParam.name}" (in: ${oldParam.in}) removed from ${method.toUpperCase()} ${path}`,
        path,
        method,
        location: `parameters[${oldParam.in}:${oldParam.name}]`,
        rationale: 'Removing a parameter simplifies the contract; clients transmitting it will typically have it ignored.',
        oldValue: oldParam,
      });
    }
  }

  // 3. Modified parameters (common parameters)
  for (const [key, oldParam] of oldParams.entries()) {
    if (newParams.has(key)) {
      const newParam = newParams.get(key)!;

      // Required status changed
      if (oldParam.required !== newParam.required) {
        const isBreaking = !oldParam.required && newParam.required;
        changes.push({
          id: `parameter:${path}:${method}:${oldParam.in}:${oldParam.name}:PARAMETER_REQUIRED_CHANGED`,
          kind: 'PARAMETER_REQUIRED_CHANGED',
          category: 'parameter',
          compatibility: isBreaking ? 'breaking' : 'non_breaking',
          message: `Parameter "${oldParam.name}" required status changed from ${oldParam.required} to ${newParam.required}`,
          path,
          method,
          location: `parameters[${oldParam.in}:${oldParam.name}].required`,
          rationale: isBreaking
            ? 'Making an optional parameter required breaks existing clients that omit it.'
            : 'Relaxing a required parameter to optional is backward-compatible.',
          oldValue: oldParam.required,
          newValue: newParam.required,
        });
      }

      // Schema comparison
      if (oldParam.schema || newParam.schema) {
        const schemaChanges = compareSchemas(oldParam.schema, newParam.schema, {
          path,
          method,
          location: `parameters[${oldParam.in}:${oldParam.name}].schema`,
          direction: 'request',
          config,
          visitedPairs: new Set(),
        });

        for (const change of schemaChanges) {
          changes.push({
            ...change,
            category: 'parameter',
            id: `parameter:${path}:${method}:${oldParam.in}:${oldParam.name}:${change.kind}:${change.location || ''}`,
          });
        }
      }
    }
  }

  return changes;
}
