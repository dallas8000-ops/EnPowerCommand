import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { z } from "zod";
import { getPool } from "../db.js";

const body = z.object({
  candidate_id: z.string().uuid(),
  job_order_id: z.string().uuid(),
  tone: z.enum(["professional", "friendly", "concise"]).default("professional"),
});

function fallbackEmail(candidateName: string, jobTitle: string, company: string): string {
  return `Subject: Exciting opportunity — ${jobTitle} at ${company}

Hi ${candidateName.split(" ")[0]},

I came across your profile and wanted to reach out about a ${jobTitle} opening at ${company}.

Based on your background, I think this could be a great fit. I'd love to connect briefly to share more details.

Are you open to a quick call this week?

Best regards`;
}

export function registerCandidateOutreachRoutes(app: Express): void {
  app.post("/api/ai/candidate-outreach", async (req: Request, res: Response) => {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "candidate_id and job_order_id are required." });
      return;
    }

    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }

    const { candidate_id, job_order_id, tone } = parsed.data;
    const tid = req.tenantId ?? null;

    const [candRes, jobRes] = await Promise.all([
      pool.query(
        `SELECT name, title, skills, location, notes FROM candidates WHERE id = $1 AND tenant_id IS NOT DISTINCT FROM $2`,
        [candidate_id, tid]
      ),
      pool.query(
        `SELECT title, client_company, location, remote, salary_range, description FROM job_orders WHERE id = $1 AND tenant_id IS NOT DISTINCT FROM $2`,
        [job_order_id, tid]
      ),
    ]);

    if (candRes.rowCount === 0 || jobRes.rowCount === 0) {
      res.status(404).json({ error: "Candidate or job order not found." });
      return;
    }

    const c = candRes.rows[0] as { name: string; title: string | null; skills: string | null; location: string | null; notes: string | null };
    const j = jobRes.rows[0] as { title: string; client_company: string; location: string | null; remote: boolean; salary_range: string | null; description: string | null };

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.json({ email: fallbackEmail(c.name, j.title, j.client_company), source: "fallback" });
      return;
    }

    const client = new OpenAI({ apiKey });
    const toneGuide = tone === "friendly" ? "warm and conversational" : tone === "concise" ? "brief and direct (under 100 words)" : "professional and polished";

    const prompt = `You are a recruiter writing an outreach email to a candidate about a job opportunity.
Tone: ${toneGuide}

Candidate:
- Name: ${c.name}
- Current title: ${c.title ?? "Not specified"}
- Skills: ${c.skills ?? "Not specified"}
- Location: ${c.location ?? "Not specified"}
- Background notes: ${c.notes?.slice(0, 300) ?? "None"}

Job Opportunity:
- Role: ${j.title} at ${j.client_company}
- Location: ${j.location ?? "Not specified"}${j.remote ? " (Remote OK)" : ""}
- Salary: ${j.salary_range ?? "Competitive"}
- Description: ${j.description?.slice(0, 500) ?? "Not provided"}

Write a short, personalized outreach email. Include:
1. Subject line (start with "Subject: ")
2. Greeting
3. Why this candidate is a good fit (1-2 sentences, reference their specific skills)
4. Brief job highlight (1-2 sentences)
5. Call to action (short call or reply)
6. Sign-off (just "Best regards" — no name)

Keep it under 150 words total. Do not use placeholders like [Your Name].`;

    try {
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.75,
      });
      const email = completion.choices[0]?.message?.content?.trim() ?? "";
      res.json({ email, source: "ai" });
    } catch (err) {
      console.error("Candidate outreach error:", err);
      res.json({ email: fallbackEmail(c.name, j.title, j.client_company), source: "fallback" });
    }
  });
}
