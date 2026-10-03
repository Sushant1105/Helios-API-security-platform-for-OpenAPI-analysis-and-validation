/**
 * @helios/diff-engine
 * Comparator for request bodies: required flags, media types, and schemas.
 */

import type { CanonicalEndpoint } from '@helios/canonical-ast';
import type { ApiChange, DiffConfiguration } from '../types.js';
import { compareSchemas } from './schema.js';

export function compareRequestBody(
  oldEndpoint: CanonicalEndpoint,
  newEndpoint: CanonicalEndpoint,
  config: Required<DiffConfiguration>
): ApiChange[] {
  const changes: ApiChange[] = [];
  const { path, method } = oldEndpoint;

  const oldBody = oldEndpoint.requestBody;
  const newBody = newEndpoint.requestBody;

  // 1. Added request body
  if (!oldBody && newBody) {
    const isBreaking = newBody.required;
    changes.push({
      id: `request_body:${path}:${method}:REQUEST_BODY_ADDED`,
      kind: 'REQUEST_BODY_ADDED',
      category: 'request_body',
      compatibility: isBreaking ? 'breaking' : 'non_breaking',
      message: `Request body added to ${method.toUpperCase()} ${path} (required: ${newBody.required})`,
      path,
      method,
      location: 'requestBody',
      rationale: isBreaking
        ? 'Adding a required request body breaks clients invoking this endpoint without a payload.'
        : 'Adding an optional request body allows additional data without invalidating payload-less callers.',
      newValue: newBody,
    });

    // Check media types schemas in new body
    for (const [mediaType, mediaObj] of Object.entries(newBody.content || {})) {
      if (mediaObj.schema) {
        const schemaChanges = compareSchemas(undefined, mediaObj.schema, {
          path,
          method,
          location: `requestBody.content['${mediaType}'].schema`,
          direction: 'request',
          config,
          visitedPairs: new Set(),
        });
        changes.push(...schemaChanges);
      }
    }

    return changes;
  }

  // 2. Removed request body
  if (oldBody && !newBody) {
    changes.push({
      id: `request_body:${path}:${method}:REQUEST_BODY_REMOVED`,
      kind: 'REQUEST_BODY_REMOVED',
      category: 'request_body',
      compatibility: 'breaking',
      message: `Request body removed from ${method.toUpperCase()} ${path}`,
      path,
      method,
      location: 'requestBody',
      rationale: 'Removing an accepted request body means payloads sent by existing clients are no longer processed.',
      oldValue: oldBody,
    });
    return changes;
  }

  // 3. Modified request body
  if (oldBody && newBody) {
    // Required flag changed
    if (oldBody.required !== newBody.required) {
      const isBreaking = !oldBody.required && newBody.required;
      changes.push({
        id: `request_body:${path}:${method}:REQUEST_BODY_REQUIRED_CHANGED`,
        kind: 'REQUEST_BODY_REQUIRED_CHANGED',
        category: 'request_body',
        compatibility: isBreaking ? 'breaking' : 'non_breaking',
        message: `Request body required status changed from ${oldBody.required} to ${newBody.required}`,
        path,
        method,
        location: 'requestBody.required',
        rationale: isBreaking
          ? 'Making an optional request body mandatory breaks callers sending empty requests.'
          : 'Relaxing a required request body to optional is backward-compatible.',
        oldValue: oldBody.required,
        newValue: newBody.required,
      });
    }

    // Media types
    const oldMediaTypes = new Set(Object.keys(oldBody.content || {}));
    const newMediaTypes = new Set(Object.keys(newBody.content || {}));

    // Added media types
    for (const mt of newMediaTypes) {
      if (!oldMediaTypes.has(mt)) {
        changes.push({
          id: `request_body:${path}:${method}:${encodeURIComponent(mt)}:REQUEST_MEDIA_TYPE_ADDED`,
          kind: 'REQUEST_MEDIA_TYPE_ADDED',
          category: 'request_body',
          compatibility: 'non_breaking',
          message: `Supported request media type added: "${mt}"`,
          path,
          method,
          location: `requestBody.content['${mt}']`,
          rationale: 'Adding support for additional request media types expands compatibility.',
          newValue: mt,
        });
      }
    }

    // Removed media types
    for (const mt of oldMediaTypes) {
      if (!newMediaTypes.has(mt)) {
        changes.push({
          id: `request_body:${path}:${method}:${encodeURIComponent(mt)}:REQUEST_MEDIA_TYPE_REMOVED`,
          kind: 'REQUEST_MEDIA_TYPE_REMOVED',
          category: 'request_body',
          compatibility: 'breaking',
          message: `Supported request media type removed: "${mt}"`,
          path,
          method,
          location: `requestBody.content['${mt}']`,
          rationale: 'Removing a supported request media type causes requests with that Content-Type to fail.',
          oldValue: mt,
        });
      }
    }

    // Common media types: compare schemas
    for (const mt of oldMediaTypes) {
      if (newMediaTypes.has(mt)) {
        const oldSchema = oldBody.content[mt]?.schema;
        const newSchema = newBody.content[mt]?.schema;

        if (oldSchema || newSchema) {
          const schemaChanges = compareSchemas(oldSchema, newSchema, {
            path,
            method,
            location: `requestBody.content['${mt}'].schema`,
            direction: 'request',
            config,
            visitedPairs: new Set(),
          });
          changes.push(...schemaChanges);
        }
      }
    }
  }

  return changes;
}
