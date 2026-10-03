import { createHash } from 'node:crypto';
import { parseSpecSync } from '@helios/spec-parser';
import { prisma } from '../client.js';
import { PersistenceError } from '../errors.js';

export const MAX_SPEC_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export function computeSpecHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export interface CreateVersionInput {
  projectId?: string;
  apiId: string;
  version: string;
  specContent: string;
}

export class VersionService {
  static async createVersion(input: CreateVersionInput) {
    const { projectId, apiId, version, specContent } = input;

    if (!apiId || typeof apiId !== 'string') {
      throw new PersistenceError('Valid API ID is required.', 'VALIDATION_ERROR', 400);
    }

    if (!version || typeof version !== 'string' || version.trim().length === 0) {
      throw new PersistenceError('Version identifier (e.g. v1.0.0) is required.', 'VALIDATION_ERROR', 400);
    }

    if (!specContent || typeof specContent !== 'string' || specContent.trim().length === 0) {
      throw new PersistenceError('Specification content is required and cannot be empty.', 'VALIDATION_ERROR', 400);
    }

    // 1. Security Check: Spec Size Limit
    const byteSize = Buffer.byteLength(specContent, 'utf8');
    if (byteSize > MAX_SPEC_SIZE_BYTES) {
      throw new PersistenceError(
        `Specification size (${(byteSize / 1024 / 1024).toFixed(2)}MB) exceeds the maximum allowed limit of 5MB.`,
        'SPEC_TOO_LARGE',
        413
      );
    }

    // 2. Validate API existence (and cross-project access if projectId provided)
    const api = await prisma.api.findUnique({
      where: { id: apiId },
    });

    if (!api) {
      throw new PersistenceError(`API with id "${apiId}" was not found.`, 'RESOURCE_NOT_FOUND', 404);
    }

    if (projectId && api.projectId !== projectId) {
      throw new PersistenceError(
        `API "${apiId}" does not belong to Project "${projectId}". Cross-project resource access is forbidden.`,
        'INVALID_RELATION',
        403
      );
    }

    // 3. Compute SHA-256 Content Hash
    const contentHash = computeSpecHash(specContent);

    // 4. Duplicate Check: Prevent identical specification for the same API
    const existing = await prisma.apiVersion.findUnique({
      where: {
        apiId_contentHash: {
          apiId,
          contentHash,
        },
      },
    });

    if (existing) {
      throw new PersistenceError(
        `An identical specification already exists for this API as version "${existing.version}" (created at ${existing.createdAt.toISOString()}). Duplicate specification upload is rejected.`,
        'DUPLICATE_SPECIFICATION',
        409,
        { existingVersionId: existing.id, existingVersion: existing.version }
      );
    }

    // 5. Specification Parsing & Validation
    const parseResult = parseSpecSync(specContent);
    if (!parseResult.success) {
      throw new PersistenceError(
        `OpenAPI specification parsing failed: ${parseResult.error.message}`,
        'INVALID_SPECIFICATION',
        422,
        parseResult.error
      );
    }

    const format = parseResult.data.format;
    const openapiVersion = parseResult.data.openapi || parseResult.data.specVersion;

    // 6. Persist valid ApiVersion
    const created = await prisma.apiVersion.create({
      data: {
        apiId,
        version: version.trim(),
        specification: specContent,
        format,
        openapiVersion,
        contentHash,
      },
    });

    // Update parent API updated timestamp
    await prisma.api.update({
      where: { id: apiId },
      data: { updatedAt: new Date() },
    });

    return created;
  }

  static async listVersionsForApi(apiId: string) {
    const api = await prisma.api.findUnique({
      where: { id: apiId },
    });

    if (!api) {
      throw new PersistenceError(`API with id "${apiId}" was not found.`, 'RESOURCE_NOT_FOUND', 404);
    }

    return await prisma.apiVersion.findMany({
      where: { apiId },
      orderBy: { createdAt: 'desc' },
      include: {
        analysisRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
    });
  }

  static async getVersionById(versionId: string, apiId?: string) {
    const version = await prisma.apiVersion.findUnique({
      where: { id: versionId },
      include: {
        api: true,
        analysisRuns: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!version) {
      throw new PersistenceError(`API Version with id "${versionId}" was not found.`, 'RESOURCE_NOT_FOUND', 404);
    }

    if (apiId && version.apiId !== apiId) {
      throw new PersistenceError(
        `Version "${versionId}" does not belong to API "${apiId}".`,
        'INVALID_RELATION',
        403
      );
    }

    return version;
  }

  static async deleteVersion(versionId: string) {
    await this.getVersionById(versionId);

    return await prisma.apiVersion.delete({
      where: { id: versionId },
    });
  }
}
