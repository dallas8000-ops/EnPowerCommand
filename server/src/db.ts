import pg from "pg";

let pool: pg.Pool | null = null;

function shouldUseSsl(url: string): boolean {
  return (
    /sslmode=require/i.test(url) ||
    process.env.PGSSLMODE === "require" ||
    process.env.DB_SSL === "true" ||
    Boolean(process.env.RAILWAY_ENVIRONMENT)
  );
}

export function getPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      ssl: shouldUseSsl(url) ? { rejectUnauthorized: false } : undefined,
    });
    pool.on("error", (err) => {
      console.error("Postgres pool error:", err.message);
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
