import cors from "cors";
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { authConfigured, requireAuth } from "./middleware/auth.js";
import { registerActivityRoutes } from "./routes/activities.js";
import { registerAnalyticsRoutes } from "./routes/analytics.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerBillingRoutes } from "./routes/billing.js";
import { registerCandidateRoutes } from "./routes/candidates.js";
import { registerExportRoutes } from "./routes/export.js";
import { registerJobOrderRoutes } from "./routes/job-orders.js";
import { registerLeadRoutes } from "./routes/leads.js";
import { registerOutreachRoutes } from "./routes/outreach.js";
import { registerPipelineRoutes } from "./routes/pipeline.js";
import { registerPostingRoutes } from "./routes/posting.js";
import { registerScreeningRoutes } from "./routes/screening.js";
import { registerResumeParseRoutes } from "./routes/resume-parse.js";
import { registerMatchingRoutes } from "./routes/matching.js";
import { registerJdGeneratorRoutes } from "./routes/jd-generator.js";
import { registerCandidateOutreachRoutes } from "./routes/candidate-outreach.js";
import { registerInterviewRoutes } from "./routes/interviews.js";
import { registerTeamRoutes } from "./routes/team.js";
import { registerEmailRoutes } from "./routes/email.js";
import { registerCalendarRoutes } from "./routes/calendar.js";
import { registerApplicationRoutes } from "./routes/applications.js";
import { registerClientPortalRoutes } from "./routes/client-portal.js";
import { registerAiToolRoutes } from "./routes/ai-tools.js";
import { registerExportRoutes as registerCsvExportRoutes } from "./routes/exports.js";
import { registerBlogRoutes } from "./routes/blog.js";
import { registerProfileRoutes } from "./routes/profile.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerRegisterRoutes } from "./routes/register.js";

const app = express();
app.set("trust proxy", 1);
const port = Number(process.env.PORT ?? 3002);

const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin: corsOrigin ? corsOrigin.split(",").map((s) => s.trim()) : true,
  })
);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "enpower-command",
    db: Boolean(process.env.DATABASE_URL),
    ai: Boolean(process.env.OPENAI_API_KEY),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    auth_required: authConfigured(),
  });
});

app.use("/api/billing/webhook", express.raw({ type: "*/*" }));
app.use(express.json({ limit: "2mb" }));

registerAuthRoutes(app);
registerRegisterRoutes(app);
registerPublicRoutes(app);

app.use(requireAuth);
registerBillingRoutes(app);
registerProfileRoutes(app);
registerExportRoutes(app);
registerActivityRoutes(app);
registerAnalyticsRoutes(app);
registerLeadRoutes(app);
registerPostingRoutes(app);
registerOutreachRoutes(app);
registerCandidateRoutes(app);
registerJobOrderRoutes(app);
registerPipelineRoutes(app);
registerScreeningRoutes(app);
registerResumeParseRoutes(app);
registerMatchingRoutes(app);
registerJdGeneratorRoutes(app);
registerCandidateOutreachRoutes(app);
registerInterviewRoutes(app);
registerTeamRoutes(app);
registerEmailRoutes(app);
registerCalendarRoutes(app);
registerApplicationRoutes(app);
registerClientPortalRoutes(app);
registerAiToolRoutes(app);
registerCsvExportRoutes(app);
registerBlogRoutes(app);

// Serve built React client in production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.join(__dirname, "..", "..", "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? "Internal server error" });
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

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
