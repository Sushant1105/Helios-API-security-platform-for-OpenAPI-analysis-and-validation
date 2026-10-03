export interface SavedVersionItem {
  id: string;
  version: string;
  apiName?: string;
  projectName?: string;
  createdAt?: string | Date;
}

export interface VersionSelectionState {
  baseVersionId: string;
  targetVersionId: string;
  canCompare: boolean;
}

/**
 * Resolves base and target version selections given available saved versions and previous selections.
 * 
 * Rules:
 * 1. If savedVersions is empty, selections are empty strings and canCompare is false.
 * 2. If prevBaseId exists in savedVersions, keep it. Otherwise default to savedVersions[0].id.
 * 3. If prevTargetId exists in savedVersions, keep it. Otherwise:
 *    - If savedVersions has at least 2 versions, default to savedVersions[1].id.
 *    - If savedVersions has 1 version, default to savedVersions[0].id.
 * 4. canCompare is true when both IDs are non-empty, differ from each other, and savedVersions >= 2.
 */
export function resolveVersionSelection(
  savedVersions: readonly SavedVersionItem[],
  prevBaseId?: string | null,
  prevTargetId?: string | null
): VersionSelectionState {
  if (!savedVersions || savedVersions.length === 0) {
    return {
      baseVersionId: '',
      targetVersionId: '',
      canCompare: false,
    };
  }

  const baseExists = Boolean(prevBaseId && savedVersions.some((v) => v.id === prevBaseId));
  const targetExists = Boolean(prevTargetId && savedVersions.some((v) => v.id === prevTargetId));

  const firstId = savedVersions[0]?.id || '';
  const secondId = savedVersions[1]?.id || firstId;

  const baseVersionId = baseExists && prevBaseId ? prevBaseId : firstId;
  const targetVersionId =
    targetExists && prevTargetId
      ? prevTargetId
      : savedVersions.length >= 2
        ? secondId
        : firstId;

  const canCompare = Boolean(
    savedVersions.length >= 2 &&
      baseVersionId &&
      targetVersionId &&
      baseVersionId !== targetVersionId
  );

  return {
    baseVersionId,
    targetVersionId,
    canCompare,
  };
}
