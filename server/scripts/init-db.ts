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
  const sql = readFileSync(schemaPath, "utf8");

  const client = new pg.Client({
    connectionString: url,
    ssl: shouldUseSsl(url) ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Schema applied.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
