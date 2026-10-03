/**
 * @helios/diff-engine
 * Default configurations, constants, and impact rules.
 */

import type { DiffConfiguration } from './types.js';

export const DEFAULT_DIFF_CONFIGURATION: Required<DiffConfiguration> = {
  responsePropertyRemovalImpact: 'breaking',
  responseEnumAdditionImpact: 'potentially_breaking',
  operationIdChangeImpact: 'non_breaking',
  unauthenticatedEndpointImpact: 'non_breaking',
  includeMetadataChanges: true,
  strictConstraintChecking: true,
  ignoreDescriptionChanges: true,
};
