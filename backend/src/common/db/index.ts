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
  idleTimeoutMillis: 30000,
  max: 10,
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected error on idle client", err);
});

pool.connect()
  .then((client) => {
    console.log("[DB] Connected to Neon PostgreSQL ✅");
    client.release();
  })
  .catch((err) => console.error("[DB] Connection Error — check DATABASE_URL env var:", err?.message ?? err));
