import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var generalsPrisma: PrismaClient | undefined;
}

export const prisma = global.generalsPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') global.generalsPrisma = prisma;
