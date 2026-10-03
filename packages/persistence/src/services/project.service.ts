import { prisma } from '../client.js';
import { PersistenceError } from '../errors.js';

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  apiCount: number;
}

export class ProjectService {
  static async createProject(input: CreateProjectInput) {
    if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
      throw new PersistenceError('Project name is required and cannot be empty.', 'VALIDATION_ERROR', 400);
    }

    return await prisma.project.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
      },
    });
  }

  static async listProjects(): Promise<ProjectSummary[]> {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { apis: true },
        },
      },
    });

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      apiCount: p._count.apis,
    }));
  }

  static async getProjectById(id: string) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        apis: {
          orderBy: { updatedAt: 'desc' },
          include: {
            versions: {
              orderBy: { createdAt: 'desc' },
              take: 5,
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
        },
      },
    });

    if (!project) {
      throw new PersistenceError(`Project with id "${id}" was not found.`, 'RESOURCE_NOT_FOUND', 404);
    }

    return project;
  }

  static async deleteProject(id: string) {
    // Verify existence
    await this.getProjectById(id);

    return await prisma.project.delete({
      where: { id },
    });
  }
}
