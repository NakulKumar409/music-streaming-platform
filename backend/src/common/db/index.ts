import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

pool.connect()
  .then((client) => {
    console.log("DB Connected to Neon ✅");
    client.release();
  })
  .catch((err) => console.error("DB Connection Error", err));
