import cors from "cors";
import "dotenv/config";
import express from "express";
import { registerLeadRoutes } from "./routes/leads.js";
import { registerOutreachRoutes } from "./routes/outreach.js";
import { registerPostingRoutes } from "./routes/posting.js";

const app = express();
app.set("trust proxy", 1);
const port = Number(process.env.PORT ?? 3002);

const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin: corsOrigin ? corsOrigin.split(",").map((s) => s.trim()) : true,
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "enpower-command",
    db: Boolean(process.env.DATABASE_URL),
    ai: Boolean(process.env.OPENAI_API_KEY),
  });
});

registerLeadRoutes(app);
registerPostingRoutes(app);
registerOutreachRoutes(app);

const server = app.listen(port, () => {
  console.log(`API http://localhost:${port}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\nPort ${port} is already in use. Either stop the other process (e.g. an old "npm run dev" / API server) or set a different PORT in server/.env, then set the same port in client/.env as VITE_API_PROXY_TARGET (e.g. http://localhost:3003).\n`
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});
