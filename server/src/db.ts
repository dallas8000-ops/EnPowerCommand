import pg from "pg";

let pool: pg.Pool | null = null;

function shouldUseSsl(url: string): boolean {
  return (
    /sslmode=require/i.test(url) ||
    process.env.PGSSLMODE === "require" ||
    process.env.DB_SSL === "true" ||
    Boolean(process.env.RENDER)
  );
}

export function getPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: url,
      max: 10,
      ssl: shouldUseSsl(url) ? { rejectUnauthorized: false } : undefined,
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
