import "dotenv/config";
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const r = await client.query(
  "SELECT id, name, subscription_status, created_at FROM tenants ORDER BY created_at"
);
console.log(JSON.stringify(r.rows, null, 2));
await client.end();
