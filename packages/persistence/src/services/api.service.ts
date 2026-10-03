import { prisma } from '../client.js';
import { PersistenceError } from '../errors.js';
import { ProjectService } from './project.service.js';

export interface CreateApiInput {
  name: string;
  description?: string;
}

export class ApiService {
  static async createApi(projectId: string, input: CreateApiInput) {
    // Validate project existence
    await ProjectService.getProjectById(projectId);

    if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
      throw new PersistenceError('API name is required and cannot be empty.', 'VALIDATION_ERROR', 400);
    }

    return await prisma.api.create({
      data: {
        projectId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
      },
    });
  }

  static async listApisForProject(projectId: string) {
    // Validate project existence
    await ProjectService.getProjectById(projectId);

    return await prisma.api.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            version: true,
            format: true,
            openapiVersion: true,
            createdAt: true,
          },
        },
        _count: {
          select: { versions: true },
        },
      },
    });
  }

  static async getApiById(projectId: string, apiId: string) {
    const api = await prisma.api.findUnique({
      where: { id: apiId },
      include: {
        versions: {
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
        },
      },
    });

    if (!api) {
      throw new PersistenceError(`API with id "${apiId}" was not found.`, 'RESOURCE_NOT_FOUND', 404);
    }

    // Security check: Verify API belongs to specified project
    if (api.projectId !== projectId) {
      throw new PersistenceError(
        `API "${apiId}" does not belong to Project "${projectId}". Cross-project resource access is forbidden.`,
        'INVALID_RELATION',
        403
      );
    }

    return api;
  }

  static async deleteApi(projectId: string, apiId: string) {
    // Validate existence & ownership
    await this.getApiById(projectId, apiId);

    return await prisma.api.delete({
      where: { id: apiId },
    });
  }
}
