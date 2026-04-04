import { PrismaClient } from "@prisma/client";

let dbUrl = process.env.DATABASE_URL || "";
if (dbUrl && !dbUrl.includes("connection_limit")) {
  const separator = dbUrl.includes("?") ? "&" : "?";
  dbUrl += `${separator}connection_limit=50&pool_timeout=10`;
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});

let readDbUrl = process.env.DATABASE_URL_REPLICA || process.env.DATABASE_URL || "";
if (readDbUrl && !readDbUrl.includes("connection_limit")) {
  const separator = readDbUrl.includes("?") ? "&" : "?";
  readDbUrl += `${separator}connection_limit=50&pool_timeout=10`;
}

export const prismaRead = new PrismaClient({
  datasources: {
    db: {
      url: readDbUrl,
    },
  },
});
