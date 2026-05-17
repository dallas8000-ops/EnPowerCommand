import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { getPool } from "../db.js";

type MatchResult = {
  candidate_id: string;
  name: string;
  title: string | null;
  skills: string | null;
  location: string | null;
  score: number;
  reason: string;
};

export function registerMatchingRoutes(app: Express): void {
  app.get(
    "/api/job-orders/:id/matches",
    async (req: Request, res: Response) => {
      const pool = getPool();
      if (!pool) {
        res.status(503).json({ error: "Database not configured" });
        return;
      }

      const jobRes = await pool.query(
        `SELECT title, client_company, location, remote, description
         FROM job_orders WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, req.tenantId]
      );
      if (jobRes.rowCount === 0) {
        res.status(404).json({ error: "Job order not found" });
        return;
      }
      const job = jobRes.rows[0] as {
        title: string;
        client_company: string;
        location: string | null;
        remote: boolean;
        description: string | null;
      };

      const candRes = await pool.query(
        `SELECT id, name, title, skills, location, notes
         FROM candidates WHERE tenant_id = $1 AND status = 'active'
         ORDER BY updated_at DESC LIMIT 50`,
        [req.tenantId]
      );
      const candidates = candRes.rows as {
        id: string;
        name: string;
        title: string | null;
        skills: string | null;
        location: string | null;
        notes: string | null;
      }[];

      if (candidates.length === 0) {
        res.json({ matches: [], note: "No active candidates found." });
        return;
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        const fallback: MatchResult[] = candidates.slice(0, 5).map((c) => ({
          candidate_id: c.id,
          name: c.name,
          title: c.title,
          skills: c.skills,
          location: c.location,
          score: 50,
          reason: "AI not configured — showing active candidates.",
        }));
        res.json({ matches: fallback, source: "fallback" });
        return;
      }

      const client = new OpenAI({ apiKey });
      const candidateList = candidates
        .map(
          (c, i) =>
            `${i}: id=${c.id} | name=${c.name} | title=${c.title ?? "N/A"} | skills=${c.skills ?? "N/A"} | location=${c.location ?? "N/A"}`
        )
        .join("\n");

      const prompt = `You are a recruiting expert. Score each candidate's fit for the job below on a scale of 0–100 and give a one-sentence reason.

Job: ${job.title} at ${job.client_company}
Location: ${job.location ?? "N/A"}${job.remote ? " (Remote OK)" : ""}
Requirements: ${job.description?.slice(0, 800) ?? "Not specified"}

Candidates:
${candidateList}

Return a JSON array of objects for the TOP 5 matches (highest score first):
[{ "candidate_id": "...", "score": 85, "reason": "..." }, ...]

Only return the JSON array.`;

      try {
        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
        });

        const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
        const cleaned = raw.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
        const aiMatches = JSON.parse(cleaned) as { candidate_id: string; score: number; reason: string }[];

        const candMap = new Map(candidates.map((c) => [c.id, c]));
        const matches: MatchResult[] = aiMatches
          .filter((m) => candMap.has(m.candidate_id))
          .map((m) => {
            const c = candMap.get(m.candidate_id)!;
            return {
              candidate_id: c.id,
              name: c.name,
              title: c.title,
              skills: c.skills,
              location: c.location,
              score: m.score,
              reason: m.reason,
            };
          });

        res.json({ matches, source: "ai" });
      } catch (err) {
        console.error("Matching error:", err);
        const fallback: MatchResult[] = candidates.slice(0, 5).map((c) => ({
          candidate_id: c.id,
          name: c.name,
          title: c.title,
          skills: c.skills,
          location: c.location,
          score: 50,
          reason: "AI error — showing active candidates.",
        }));
        res.json({ matches: fallback, source: "fallback" });
      }
    }
  );
}
