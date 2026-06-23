import { PrismaClient } from "@prisma/client";

// Singleton do Prisma — evita esgotar conexões com o hot-reload do Next em dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
