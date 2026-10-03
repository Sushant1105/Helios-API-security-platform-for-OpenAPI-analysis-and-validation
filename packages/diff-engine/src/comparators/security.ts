/**
 * @helios/diff-engine
 * Comparator for security requirements, schemes, and OAuth scopes.
 * Classifies security-relevant contract changes.
 */

import type {
  CanonicalApiAst,
  CanonicalEndpoint,
  CanonicalSecurityRequirement,
} from '@helios/canonical-ast';
import type { ApiChange, DiffConfiguration } from '../types.js';

function formatSecReqs(reqs: CanonicalSecurityRequirement[] | undefined): string {
  if (!reqs || reqs.length === 0) return '[]';
  return reqs.map((r) => `${r.name}(${(r.scopes || []).join(',')})`).sort().join('; ');
}

export function compareEndpointSecurity(
  oldEndpoint: CanonicalEndpoint,
  newEndpoint: CanonicalEndpoint,
  config: Required<DiffConfiguration>
): ApiChange[] {
  const changes: ApiChange[] = [];
  const { path, method } = oldEndpoint;

  const oldSec = oldEndpoint.security || [];
  const newSec = newEndpoint.security || [];

  const oldNames = new Map(oldSec.map((s) => [s.name, s]));
  const newNames = new Map(newSec.map((s) => [s.name, s]));

  // Security requirement added
  for (const [name, req] of newNames.entries()) {
    if (!oldNames.has(name)) {
      changes.push({
        id: `security:${path}:${method}:${name}:SECURITY_REQUIREMENT_ADDED`,
        kind: 'SECURITY_REQUIREMENT_ADDED',
        category: 'security',
        compatibility: 'potentially_breaking',
        message: `Security requirement "${name}" added to ${method.toUpperCase()} ${path}`,
        path,
        method,
        location: `security[${name}]`,
        rationale: 'Adding authentication requirement means callers without valid credentials will now be rejected.',
        newValue: req,
        isSecurityRelevant: true,
      });
    }
  }

  // Security requirement removed
  for (const [name, req] of oldNames.entries()) {
    if (!newNames.has(name)) {
      changes.push({
        id: `security:${path}:${method}:${name}:SECURITY_REQUIREMENT_REMOVED`,
        kind: 'SECURITY_REQUIREMENT_REMOVED',
        category: 'security',
        compatibility: config.unauthenticatedEndpointImpact,
        message: `Security requirement "${name}" removed from ${method.toUpperCase()} ${path}`,
        path,
        method,
        location: `security[${name}]`,
        rationale: 'Removing authentication requirements alters the security posture and opens the endpoint to unauthenticated access.',
        oldValue: req,
        isSecurityRelevant: true,
      });
    }
  }

  // Scopes modified on common requirements
  for (const [name, oldReq] of oldNames.entries()) {
    if (newNames.has(name)) {
      const newReq = newNames.get(name)!;
      const oldScopes = new Set(oldReq.scopes || []);
      const newScopes = new Set(newReq.scopes || []);

      for (const scope of newScopes) {
        if (!oldScopes.has(scope)) {
          changes.push({
            id: `security:${path}:${method}:${name}:scope:${scope}:SECURITY_SCOPE_ADDED`,
            kind: 'SECURITY_SCOPE_ADDED',
            category: 'security',
            compatibility: 'potentially_breaking',
            message: `Required scope "${scope}" added for scheme "${name}" on ${method.toUpperCase()} ${path}`,
            path,
            method,
            location: `security[${name}].scopes`,
            rationale: 'Adding required OAuth/OIDC scopes requires client tokens to have elevated permissions.',
            newValue: scope,
            isSecurityRelevant: true,
          });
        }
      }

      for (const scope of oldScopes) {
        if (!newScopes.has(scope)) {
          changes.push({
            id: `security:${path}:${method}:${name}:scope:${scope}:SECURITY_SCOPE_REMOVED`,
            kind: 'SECURITY_SCOPE_REMOVED',
            category: 'security',
            compatibility: 'non_breaking',
            message: `Required scope "${scope}" removed from scheme "${name}" on ${method.toUpperCase()} ${path}`,
            path,
            method,
            location: `security[${name}].scopes`,
            rationale: 'Removing required scopes relaxes authorization restrictions without breaking callers with existing scopes.',
            oldValue: scope,
            isSecurityRelevant: true,
          });
        }
      }
    }
  }

  return changes;
}

export function compareGlobalSecurity(
  oldAst: CanonicalApiAst,
  newAst: CanonicalApiAst,
  _config: Required<DiffConfiguration>
): ApiChange[] {
  const changes: ApiChange[] = [];

  // 1. Global security requirements
  const oldSec = oldAst.security || [];
  const newSec = newAst.security || [];

  const oldSecStr = formatSecReqs(oldSec);
  const newSecStr = formatSecReqs(newSec);

  if (oldSecStr !== newSecStr) {
    changes.push({
      id: 'security:global:*:SECURITY_REQUIREMENT_CHANGED',
      kind: 'SECURITY_REQUIREMENT_CHANGED',
      category: 'security',
      compatibility: 'potentially_breaking',
      message: `Global security requirement changed from [${oldSecStr}] to [${newSecStr}]`,
      location: 'security',
      rationale: 'Modifying root security requirements affects all endpoints that inherit global authentication.',
      oldValue: oldSec,
      newValue: newSec,
      isSecurityRelevant: true,
    });
  }

  // 2. Component Security Schemes
  const oldSchemes = oldAst.securitySchemes || {};
  const newSchemes = newAst.securitySchemes || {};

  const oldSchemeIds = Object.keys(oldSchemes).sort();
  const newSchemeIds = Object.keys(newSchemes).sort();

  // Added schemes
  for (const id of newSchemeIds) {
    if (!(id in oldSchemes)) {
      const scheme = newSchemes[id];
      if (!scheme) continue;
      changes.push({
        id: `security:scheme:${id}:SECURITY_SCHEME_ADDED`,
        kind: 'SECURITY_SCHEME_ADDED',
        category: 'security',
        compatibility: 'non_breaking',
        message: `Security scheme "${id}" added (type: ${scheme.type})`,
        location: `components.securitySchemes['${id}']`,
        rationale: 'Adding new security scheme definitions introduces new authentication mechanisms.',
        newValue: scheme,
        isSecurityRelevant: true,
      });
    }
  }

  // Removed schemes
  for (const id of oldSchemeIds) {
    if (!(id in newSchemes)) {
      const scheme = oldSchemes[id];
      if (!scheme) continue;
      changes.push({
        id: `security:scheme:${id}:SECURITY_SCHEME_REMOVED`,
        kind: 'SECURITY_SCHEME_REMOVED',
        category: 'security',
        compatibility: 'breaking',
        message: `Security scheme "${id}" removed`,
        location: `components.securitySchemes['${id}']`,
        rationale: 'Removing a declared security scheme invalidates endpoints or clients configured to use it.',
        oldValue: scheme,
        isSecurityRelevant: true,
      });
    }
  }

  // Modified schemes
  for (const id of oldSchemeIds) {
    if (id in newSchemes) {
      const oldScheme = oldSchemes[id];
      const newScheme = newSchemes[id];
      if (!oldScheme || !newScheme) continue;

      if (
        oldScheme.type !== newScheme.type ||
        oldScheme.in !== newScheme.in ||
        oldScheme.scheme !== newScheme.scheme
      ) {
        changes.push({
          id: `security:scheme:${id}:SECURITY_SCHEME_MODIFIED`,
          kind: 'SECURITY_SCHEME_MODIFIED',
          category: 'security',
          compatibility: 'breaking',
          message: `Security scheme "${id}" configuration changed (type: ${oldScheme.type}->${newScheme.type})`,
          location: `components.securitySchemes['${id}']`,
          rationale: 'Changing security scheme type or transmission location breaks client authorization headers.',
          oldValue: oldScheme,
          newValue: newScheme,
          isSecurityRelevant: true,
        });
      }
    }
  }

  return changes;
}
