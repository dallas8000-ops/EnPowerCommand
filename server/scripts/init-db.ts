import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

function shouldUseSsl(url: string): boolean {
  return (
    /sslmode=require/i.test(url) ||
    process.env.PGSSLMODE === "require" ||
    process.env.DB_SSL === "true" ||
    Boolean(process.env.RENDER)
  );
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy server/env.example to server/.env");
    process.exit(1);
  }

  const schemaPath = join(__dirname, "..", "sql", "schema.sql");
  const schemaV2Path = join(__dirname, "..", "sql", "schema-v2.sql");
  const schemaV3Path = join(__dirname, "..", "sql", "schema-v3.sql");
  const sql = readFileSync(schemaPath, "utf8");
  const sqlV2 = readFileSync(schemaV2Path, "utf8");
  const sqlV3 = readFileSync(schemaV3Path, "utf8");

  const client = new pg.Client({
    connectionString: url,
    ssl: shouldUseSsl(url) ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Schema v1 applied.");
    await client.query(sqlV2);
    console.log("Schema v2 (multi-tenant recruiter) applied.");
    await client.query(sqlV3);
    console.log("Schema v3 (public job board) applied.");
    await client.query(`
      INSERT INTO tenants (id, name, subscription_status) VALUES
        ('00000000-0000-0000-0000-000000000000', 'Dev Tenant', 'active')
      ON CONFLICT (id) DO NOTHING
    `);
    await client.query(`
      INSERT INTO tenant_users (id, tenant_id, email, password_hash, role) VALUES
        ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'dev@localhost', 'skip', 'admin')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log("Dev tenant seeded (SKIP_AUTH=true compatible).");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
