import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { getPool } from "../db.js";

const FALLBACK_QUESTIONS = [
  "Can you walk me through your relevant experience for this role?",
  "What technologies or tools have you used most in your recent positions?",
  "Describe a challenging project you completed and how you approached it.",
  "How do you stay current with changes in your field?",
  "What does your typical workflow look like when starting a new assignment?",
  "Have you worked in a similar industry or environment before?",
  "What is your expected compensation range and availability?",
  "Are you comfortable with the location/remote requirements for this role?",
  "What are you looking for in your next opportunity?",
  "Do you have any questions about the role or company?",
];

export function registerScreeningRoutes(app: Express): void {
  app.post(
    "/api/job-orders/:id/screening-questions",
    async (req: Request, res: Response) => {
      const pool = getPool();
      if (!pool) {
        res.status(503).json({ error: "Database not configured" });
        return;
      }

      const r = await pool.query(
        `SELECT title, client_company, location, remote, salary_range, description
         FROM job_orders WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, req.tenantId]
      );
      if (r.rowCount === 0) {
        res.status(404).json({ error: "Job order not found" });
        return;
      }

      const job = r.rows[0] as {
        title: string;
        client_company: string;
        location: string | null;
        remote: boolean;
        salary_range: string | null;
        description: string | null;
      };

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.json({ questions: FALLBACK_QUESTIONS, source: "fallback" });
        return;
      }

      const client = new OpenAI({ apiKey });
      const prompt = `You are an expert technical recruiter. Generate 10 concise, targeted screening interview questions for the following job opening. 
Focus on skill verification, relevant experience, and role fit. Each question should be specific to this role — not generic.

Job Title: ${job.title}
Company: ${job.client_company}
Location: ${job.location ?? "Not specified"}${job.remote ? " (Remote)" : ""}
Salary Range: ${job.salary_range ?? "Not specified"}
Description:
${job.description ?? "No description provided."}

Return a JSON array of exactly 10 question strings. No numbering, no extra text — just the JSON array.`;

      try {
        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.7,
        });

        const raw = completion.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(raw) as { questions?: string[] } | string[];
        const questions: string[] = Array.isArray(parsed)
          ? parsed
          : (parsed as { questions?: string[] }).questions ?? FALLBACK_QUESTIONS;

        res.json({ questions, source: "ai" });
      } catch (err) {
        console.error("Screening questions AI error:", err);
        res.json({ questions: FALLBACK_QUESTIONS, source: "fallback" });
      }
    }
  );
}
