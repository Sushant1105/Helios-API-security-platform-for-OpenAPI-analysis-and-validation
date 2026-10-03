/**
 * @helios/diff-engine
 * Comparator for responses: status codes, headers, media types, and schemas.
 */

import type { CanonicalEndpoint } from '@helios/canonical-ast';
import type { ApiChange, DiffConfiguration } from '../types.js';
import { compareSchemas } from './schema.js';

export function compareResponses(
  oldEndpoint: CanonicalEndpoint,
  newEndpoint: CanonicalEndpoint,
  config: Required<DiffConfiguration>
): ApiChange[] {
  const changes: ApiChange[] = [];
  const { path, method } = oldEndpoint;

  const oldResponses = oldEndpoint.responses || {};
  const newResponses = newEndpoint.responses || {};

  const oldStatuses = Object.keys(oldResponses).sort();
  const newStatuses = Object.keys(newResponses).sort();

  // 1. Added status codes
  for (const status of newStatuses) {
    if (!(status in oldResponses)) {
      const resp = newResponses[status];
      if (!resp) continue;

      changes.push({
        id: `response:${path}:${method}:${status}:RESPONSE_STATUS_ADDED`,
        kind: 'RESPONSE_STATUS_ADDED',
        category: 'response',
        compatibility: 'non_breaking',
        message: `Response status code "${status}" added to ${method.toUpperCase()} ${path}`,
        path,
        method,
        location: `responses['${status}']`,
        rationale: 'Adding response status codes provides explicit outcome definitions.',
        newValue: resp,
      });

      // Check schemas in newly added response
      for (const [mt, mediaObj] of Object.entries(resp.content || {})) {
        if (mediaObj.schema) {
          const schemaChanges = compareSchemas(undefined, mediaObj.schema, {
            path,
            method,
            location: `responses['${status}'].content['${mt}'].schema`,
            direction: 'response',
            config,
            visitedPairs: new Set(),
          });
          changes.push(...schemaChanges);
        }
      }
    }
  }

  // 2. Removed status codes
  for (const status of oldStatuses) {
    if (!(status in newResponses)) {
      const resp = oldResponses[status];
      if (!resp) continue;

      changes.push({
        id: `response:${path}:${method}:${status}:RESPONSE_STATUS_REMOVED`,
        kind: 'RESPONSE_STATUS_REMOVED',
        category: 'response',
        compatibility: 'breaking',
        message: `Response status code "${status}" removed from ${method.toUpperCase()} ${path}`,
        path,
        method,
        location: `responses['${status}']`,
        rationale: 'Removing a documented response status code breaks client response handling for that status.',
        oldValue: resp,
      });
    }
  }

  // 3. Common status codes
  for (const status of oldStatuses) {
    if (status in newResponses) {
      const oldResp = oldResponses[status];
      const newResp = newResponses[status];
      if (!oldResp || !newResp) continue;

      const oldMediaTypes = new Set(Object.keys(oldResp.content || {}));
      const newMediaTypes = new Set(Object.keys(newResp.content || {}));

      // Media type added
      for (const mt of newMediaTypes) {
        if (!oldMediaTypes.has(mt)) {
          changes.push({
            id: `response:${path}:${method}:${status}:${encodeURIComponent(mt)}:RESPONSE_MEDIA_TYPE_ADDED`,
            kind: 'RESPONSE_MEDIA_TYPE_ADDED',
            category: 'response',
            compatibility: 'non_breaking',
            message: `Response media type "${mt}" added for status ${status}`,
            path,
            method,
            location: `responses['${status}'].content['${mt}']`,
            rationale: 'Adding response media types allows clients to negotiate additional content formats.',
            newValue: mt,
          });
        }
      }

      // Media type removed
      for (const mt of oldMediaTypes) {
        if (!newMediaTypes.has(mt)) {
          changes.push({
            id: `response:${path}:${method}:${status}:${encodeURIComponent(mt)}:RESPONSE_MEDIA_TYPE_REMOVED`,
            kind: 'RESPONSE_MEDIA_TYPE_REMOVED',
            category: 'response',
            compatibility: 'breaking',
            message: `Response media type "${mt}" removed for status ${status}`,
            path,
            method,
            location: `responses['${status}'].content['${mt}']`,
            rationale: 'Removing a response media type causes clients requesting that Accept type to receive 406 or unsupported format.',
            oldValue: mt,
          });
        }
      }

      // Common media types: compare schemas
      for (const mt of oldMediaTypes) {
        if (newMediaTypes.has(mt)) {
          const oldSchema = oldResp.content?.[mt]?.schema;
          const newSchema = newResp.content?.[mt]?.schema;

          if (oldSchema || newSchema) {
            const schemaChanges = compareSchemas(oldSchema, newSchema, {
              path,
              method,
              location: `responses['${status}'].content['${mt}'].schema`,
              direction: 'response',
              config,
              visitedPairs: new Set(),
            });
            changes.push(...schemaChanges);
          }
        }
      }
    }
  }

  return changes;
}
