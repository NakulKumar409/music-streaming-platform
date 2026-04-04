import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  console.error("[DB] FATAL: DATABASE_URL environment variable is not set. Please configure it in your deployment environment.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("sslmode=disable")
    ? false
    : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
  max: 50,
});

const readDbUrl = process.env.DATABASE_URL_REPLICA || process.env.DATABASE_URL;

export const poolRead = new Pool({
  connectionString: readDbUrl,
  ssl: readDbUrl?.includes("sslmode=disable")
    ? false
    : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
  max: 50,
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected error on primary idle client", err);
});

poolRead.on("error", (err) => {
  console.error("[DB Read] Unexpected error on read idle client", err);
});

pool.connect()
  .then((client) => {
    console.log("[DB] Connected to Primary PostgreSQL ✅");
    client.release();
  })
  .catch((err) => console.error("[DB] Connection Error — check DATABASE_URL env var:", err?.message ?? err));

poolRead.connect()
  .then((client) => {
    console.log("[DB Read] Connected to Replica PostgreSQL ✅");
    client.release();
  })
  .catch((err) => console.error("[DB Read] Connection Error — check DATABASE_URL_REPLICA env var:", err?.message ?? err));
