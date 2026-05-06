import pg from "pg";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new pg.Pool({ connectionString: url, max: 10 });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
