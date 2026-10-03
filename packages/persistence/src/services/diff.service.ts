import { compareSpecifications } from '@helios/analysis-pipeline';
import type { DiffConfiguration, DiffResult } from '@helios/diff-engine';
import { VersionService } from './version.service.js';

export class DiffService {
  static async compareSavedVersions(
    baseVersionId: string,
    targetVersionId: string,
    config?: DiffConfiguration
  ): Promise<{
    baseVersion: { id: string; version: string };
    targetVersion: { id: string; version: string };
    diff: DiffResult;
  }> {
    const baseVersion = await VersionService.getVersionById(baseVersionId);
    const targetVersion = await VersionService.getVersionById(targetVersionId);

    const diffResult = await compareSpecifications(
      baseVersion.specification,
      targetVersion.specification,
      config
    );

    if (!diffResult.success) {
      throw new Error(`Semantic diff engine failed: ${diffResult.error.message}`);
    }

    return {
      baseVersion: {
        id: baseVersion.id,
        version: baseVersion.version,
      },
      targetVersion: {
        id: targetVersion.id,
        version: targetVersion.version,
      },
      diff: diffResult.data,
    };
  }
}
