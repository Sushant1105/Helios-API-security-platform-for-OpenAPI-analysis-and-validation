import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __heliosPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__heliosPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__heliosPrisma = prisma;
}

export default prisma;
