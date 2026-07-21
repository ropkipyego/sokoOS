import { PrismaClient } from "@prisma/client";

export { PrismaClient, Prisma } from "@prisma/client";
export type * from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __sokoosPrisma: PrismaClient | undefined;
}

/**
 * Shared Prisma client for Nest modules and scripts.
 * Reuses a singleton in development to avoid exhausting connections under HMR.
 */
export function createPrismaClient(url?: string): PrismaClient {
  return new PrismaClient(
    url
      ? {
          datasources: {
            db: { url },
          },
        }
      : undefined,
  );
}

export const prisma: PrismaClient =
  globalThis.__sokoosPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__sokoosPrisma = prisma;
}

export default prisma;
