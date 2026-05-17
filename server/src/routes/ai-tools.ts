import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { getPool } from "../db.js";

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export function registerAiToolRoutes(app: Express): void {
  app.post("/api/ai/follow-up-draft", async (req: Request, res: Response) => {
    const { candidate_id, context } = req.body as { candidate_id?: string; context?: string };
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }

    let candidateInfo = "";
    if (candidate_id) {
      const r = await pool.query(
        `SELECT name, title, skills, location, notes FROM candidates WHERE id = $1 AND tenant_id IS NOT DISTINCT FROM $2`,
        [candidate_id, req.tenantId ?? null]
      );
      if (r.rowCount && r.rowCount > 0) {
        const c = r.rows[0] as { name: string; title: string | null; skills: string | null; location: string | null; notes: string | null };
        candidateInfo = `Candidate: ${c.name}${c.title ? `, ${c.title}` : ''}${c.location ? ` in ${c.location}` : ''}${c.skills ? `. Skills: ${c.skills}` : ''}${c.notes ? `. Notes: ${c.notes}` : ''}`;
      }
    }

    const ai = getOpenAI();
    if (!ai) {
      res.json({ draft: `Hi {{name}},\n\nI wanted to follow up on your profile. We have some exciting opportunities that might be a great fit for your background.\n\nWould you be open to a quick 15-minute call this week?\n\nBest,\n{{recruiter_name}}` });
      return;
    }

    const prompt = `Write a brief, professional recruiter follow-up email for a cold candidate.
${candidateInfo}
${context ? `Additional context: ${context}` : ''}
Keep it under 100 words, friendly, and include a clear call to action. Use {{name}} and {{recruiter_name}} as placeholders.`;

    const completion = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
    });

    res.json({ draft: completion.choices[0]?.message?.content?.trim() ?? "" });
  });

  app.post("/api/ai/placement-prediction", async (req: Request, res: Response) => {
    const { candidate_id, job_order_id } = req.body as { candidate_id?: string; job_order_id?: string };
    if (!candidate_id || !job_order_id) {
      res.status(400).json({ error: "candidate_id and job_order_id required" });
      return;
    }
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }

    const [candRes, jobRes] = await Promise.all([
      pool.query(
        `SELECT name, title, skills, location, notes FROM candidates WHERE id = $1 AND tenant_id IS NOT DISTINCT FROM $2`,
        [candidate_id, req.tenantId ?? null]
      ),
      pool.query(
        `SELECT title, client_company, location, remote, salary_range, description FROM job_orders WHERE id = $1 AND tenant_id IS NOT DISTINCT FROM $2`,
        [job_order_id, req.tenantId ?? null]
      ),
    ]);

    if (candRes.rowCount === 0 || jobRes.rowCount === 0) {
      res.status(404).json({ error: "Candidate or job not found" });
      return;
    }

    const c = candRes.rows[0] as { name: string; title: string | null; skills: string | null; location: string | null; notes: string | null };
    const j = jobRes.rows[0] as { title: string; client_company: string; location: string | null; remote: boolean; salary_range: string | null; description: string | null };

    const ai = getOpenAI();
    if (!ai) {
      res.json({ probability: 72, factors: ["Skills appear relevant", "Location is compatible", "Experience level matches"], risks: ["AI analysis unavailable — add OPENAI_API_KEY for full prediction"] });
      return;
    }

    const prompt = `You are an expert recruitment consultant. Predict the likelihood of a successful placement.

Candidate: ${c.name}, ${c.title ?? 'Unknown title'}
Skills: ${c.skills ?? 'Not listed'}
Location: ${c.location ?? 'Unknown'}
Notes: ${c.notes ?? 'None'}

Job: ${j.title} at ${j.client_company}
Location: ${j.location ?? 'Unknown'}${j.remote ? ' (Remote)' : ''}
Salary: ${j.salary_range ?? 'Not specified'}
Description: ${(j.description ?? '').slice(0, 400)}

Return JSON only: { "probability": <0-100>, "factors": ["<positive factor>", ...], "risks": ["<risk>", ...] }
Max 3 factors and 3 risks.`;

    const completion = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    try {
      const result = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as { probability?: number; factors?: string[]; risks?: string[] };
      res.json({ probability: result.probability ?? 0, factors: result.factors ?? [], risks: result.risks ?? [] });
    } catch {
      res.json({ probability: 0, factors: [], risks: ["Failed to parse AI response"] });
    }
  });

  app.post("/api/ai/offer-letter", async (req: Request, res: Response) => {
    const { candidate_id, job_order_id, salary, start_date } = req.body as {
      candidate_id?: string; job_order_id?: string; salary?: string; start_date?: string;
    };
    if (!candidate_id || !job_order_id) {
      res.status(400).json({ error: "candidate_id and job_order_id required" });
      return;
    }
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }

    const [candRes, jobRes, profileRes] = await Promise.all([
      pool.query(`SELECT name, title, email FROM candidates WHERE id = $1 AND tenant_id IS NOT DISTINCT FROM $2`, [candidate_id, req.tenantId ?? null]),
      pool.query(`SELECT title, client_company, location, remote, description FROM job_orders WHERE id = $1 AND tenant_id IS NOT DISTINCT FROM $2`, [job_order_id, req.tenantId ?? null]),
      pool.query(`SELECT name FROM tenants WHERE id IS NOT DISTINCT FROM $1`, [req.tenantId ?? null]),
    ]);

    if (candRes.rowCount === 0 || jobRes.rowCount === 0) {
      res.status(404).json({ error: "Candidate or job not found" });
      return;
    }

    const c = candRes.rows[0] as { name: string; title: string | null; email: string | null };
    const j = jobRes.rows[0] as { title: string; client_company: string; location: string | null; remote: boolean; description: string | null };
    const agencyName = (profileRes.rows[0] as { name?: string } | undefined)?.name ?? "RecruitCommand";

    const ai = getOpenAI();
    const dateStr = start_date ? new Date(start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '[Start Date]';

    if (!ai) {
      const fallback = `Dear ${c.name},\n\nWe are pleased to offer you the position of ${j.title} at ${j.client_company}.\n\nStart Date: ${dateStr}\nCompensation: ${salary ?? '[Salary TBD]'}\nLocation: ${j.location ?? (j.remote ? 'Remote' : 'TBD')}\n\nPlease sign and return this letter by [Date].\n\nCongratulations and welcome to the team!\n\nSincerely,\n${agencyName}`;
      res.json({ letter: fallback });
      return;
    }

    const prompt = `Draft a professional offer letter for a recruiter agency to send to a candidate.

Agency: ${agencyName}
Candidate: ${c.name}
Role: ${j.title} at ${j.client_company}
Location: ${j.location ?? (j.remote ? 'Remote' : 'TBD')}
Salary: ${salary ?? 'competitive, to be discussed'}
Start Date: ${dateStr}

Write a complete, formal offer letter. Use professional language. Keep it under 300 words.`;

    const completion = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
    });

    res.json({ letter: completion.choices[0]?.message?.content?.trim() ?? "" });
  });

  app.get("/api/candidates/duplicates", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }
    const r = await pool.query(
      `SELECT email, COUNT(*) AS count, array_agg(json_build_object('id', id, 'name', name, 'created_at', created_at) ORDER BY created_at) AS candidates
       FROM candidates
       WHERE tenant_id IS NOT DISTINCT FROM $1 AND email IS NOT NULL AND email != ''
       GROUP BY email HAVING COUNT(*) > 1`,
      [req.tenantId ?? null]
    );
    res.json({ duplicates: r.rows });
  });

  app.post("/api/candidates/bulk-import", async (req: Request, res: Response) => {
    const { candidates } = req.body as { candidates?: Array<{ name: string; email?: string; phone?: string; title?: string; location?: string; skills?: string; notes?: string }> };
    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      res.status(400).json({ error: "candidates array required" });
      return;
    }
    if (candidates.length > 10) {
      res.status(400).json({ error: "Maximum 10 candidates per import" });
      return;
    }
    const pool = getPool();
    if (!pool) { res.status(503).json({ error: "Database not configured" }); return; }

    const results: { name: string; id?: string; error?: string }[] = [];
    for (const c of candidates) {
      if (!c.name) { results.push({ name: '', error: 'name required' }); continue; }
      try {
        const r = await pool.query(
          `INSERT INTO candidates (tenant_id, name, email, phone, title, location, skills, notes, status, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active','bulk-import') RETURNING id`,
          [req.tenantId ?? null, c.name, c.email ?? null, c.phone ?? null, c.title ?? null, c.location ?? null, c.skills ?? null, c.notes ?? null]
        );
        results.push({ name: c.name, id: (r.rows[0] as { id: string }).id });
      } catch (e: unknown) {
        results.push({ name: c.name, error: e instanceof Error ? e.message : 'Insert failed' });
      }
    }
    res.status(201).json({ results });
  });
}
