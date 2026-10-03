/**
 * @helios/diff-engine
 * Comparator for API metadata: info, servers, and tags.
 */

import type { CanonicalApiAst } from '@helios/canonical-ast';
import type { ApiChange, DiffConfiguration } from '../types.js';

export function compareMetadata(
  oldAst: CanonicalApiAst,
  newAst: CanonicalApiAst,
  config: Required<DiffConfiguration>
): ApiChange[] {
  if (!config.includeMetadataChanges) {
    return [];
  }

  const changes: ApiChange[] = [];

  // 1. Info: Title
  if (oldAst.info.title !== newAst.info.title) {
    changes.push({
      id: 'metadata:global:*:API_TITLE_CHANGED',
      kind: 'API_TITLE_CHANGED',
      category: 'metadata',
      compatibility: 'non_breaking',
      message: `API title changed from "${oldAst.info.title}" to "${newAst.info.title}"`,
      location: 'info.title',
      rationale: 'API title modification is a non-functional metadata change.',
      oldValue: oldAst.info.title,
      newValue: newAst.info.title,
    });
  }

  // 2. Info: Version
  if (oldAst.info.version !== newAst.info.version) {
    changes.push({
      id: 'metadata:global:*:API_VERSION_CHANGED',
      kind: 'API_VERSION_CHANGED',
      category: 'metadata',
      compatibility: 'non_breaking',
      message: `API version changed from "${oldAst.info.version}" to "${newAst.info.version}"`,
      location: 'info.version',
      rationale: 'Specification version update reflects documentation or release lifecycle.',
      oldValue: oldAst.info.version,
      newValue: newAst.info.version,
    });
  }

  // 3. Info: Description (if not ignored)
  if (!config.ignoreDescriptionChanges && oldAst.info.description !== newAst.info.description) {
    changes.push({
      id: 'metadata:global:*:API_DESCRIPTION_CHANGED',
      kind: 'API_DESCRIPTION_CHANGED',
      category: 'metadata',
      compatibility: 'non_breaking',
      message: 'API description updated.',
      location: 'info.description',
      rationale: 'API description updates are informational and do not affect client execution.',
      oldValue: oldAst.info.description,
      newValue: newAst.info.description,
    });
  }

  // 4. Servers
  const oldServerUrls = new Map(oldAst.servers.map((s) => [s.url, s]));
  const newServerUrls = new Map(newAst.servers.map((s) => [s.url, s]));

  // Check added servers
  for (const [url, server] of newServerUrls.entries()) {
    if (!oldServerUrls.has(url)) {
      changes.push({
        id: `metadata:server:${encodeURIComponent(url)}:SERVER_ADDED`,
        kind: 'SERVER_ADDED',
        category: 'metadata',
        compatibility: 'non_breaking',
        message: `Server URL added: "${url}"`,
        location: `servers[${url}]`,
        rationale: 'Adding alternative server endpoints provides additional connectivity without invalidating existing endpoints.',
        newValue: server,
      });
    }
  }

  // Check removed servers
  for (const [url, server] of oldServerUrls.entries()) {
    if (!newServerUrls.has(url)) {
      changes.push({
        id: `metadata:server:${encodeURIComponent(url)}:SERVER_REMOVED`,
        kind: 'SERVER_REMOVED',
        category: 'metadata',
        compatibility: 'potentially_breaking',
        message: `Server URL removed: "${url}"`,
        location: `servers[${url}]`,
        rationale: 'Clients configured with the removed server URL will fail to connect unless reconfigured.',
        oldValue: server,
      });
    }
  }

  // 5. Tags
  const oldTagNames = new Set(oldAst.tags.map((t) => t.name));
  const newTagNames = new Set(newAst.tags.map((t) => t.name));

  for (const tag of newAst.tags) {
    if (!oldTagNames.has(tag.name)) {
      changes.push({
        id: `metadata:tag:${encodeURIComponent(tag.name)}:TAG_ADDED`,
        kind: 'TAG_ADDED',
        category: 'metadata',
        compatibility: 'non_breaking',
        message: `Tag added: "${tag.name}"`,
        location: `tags[${tag.name}]`,
        rationale: 'Adding tags provides organizational metadata without altering operational contracts.',
        newValue: tag.name,
      });
    }
  }

  for (const tag of oldAst.tags) {
    if (!newTagNames.has(tag.name)) {
      changes.push({
        id: `metadata:tag:${encodeURIComponent(tag.name)}:TAG_REMOVED`,
        kind: 'TAG_REMOVED',
        category: 'metadata',
        compatibility: 'non_breaking',
        message: `Tag removed: "${tag.name}"`,
        location: `tags[${tag.name}]`,
        rationale: 'Removing tags alters categorization but does not change endpoint behaviour.',
        oldValue: tag.name,
      });
    }
  }

  return changes;
}
