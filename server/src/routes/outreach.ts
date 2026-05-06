import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { z } from "zod";
import { getPool } from "../db.js";

const bodySchema = z.object({
  lead_id: z.string().uuid().optional(),
  company: z.string().optional(),
  contact_name: z.string().optional(),
  role: z.string().optional(),
  url: z.string().optional(),
  notes: z.string().optional(),
  /** Candidate resume / highlights — improves personalization (never logged verbatim). */
  resume_context: z.string().optional(),
});

function demoDrafts(input: {
  company: string;
  contact_name?: string | null;
  role?: string | null;
  url?: string | null;
  notes?: string | null;
  resume_snippet?: string | null;
}) {
  const who = input.contact_name ? input.contact_name : "there";
  const role = input.role ? ` (${input.role})` : "";
  const site = input.url ? `\nSite: ${input.url}` : "";
  const notes = input.notes ? `\nContext: ${input.notes}` : "";
  const resume =
    input.resume_snippet?.trim().slice(0, 400)
      ? `\n${input.resume_snippet.trim().slice(0, 280)}…`
      : "";
  const closingFit = input.resume_snippet?.trim()
    ? "Happy to share specifics from my background (same details as in my profile summary) if there's mutual interest."
    : "Happy to share relevant background if there's a potential fit — I won't claim specifics here without my profile on hand.";
  const subj = `Quick idea for ${input.company}'s product workflow`;
  const a = `Hi ${who}${role},

I'm reaching out about ${input.company}${site}.${notes}${resume}

If you're open to it, I can send a short walkthrough — no obligation.

Best`;
  const b = `Hi ${who},

Noticed ${input.company}${role}.${notes}

${closingFit}

Cheers`;
  return {
    subject_lines: [subj, `Intro — shipping help for ${input.company}`, `Freelance dev — ${input.company}`],
    drafts: [
      { label: "Consultative", body: a },
      { label: "Direct", body: b },
      {
        label: "Follow-up (3 days)",
        body: `Hi ${who}, bumping this in case it got buried. Still happy to continue the conversation if useful.`,
      },
    ],
    disclaimer:
      "Demo mode: templates avoid invented credentials. Set OPENAI_API_KEY for model drafts still bounded by your saved resume on the server.",
  };
}

export function registerOutreachRoutes(app: Express): void {
  app.post("/api/outreach", async (req: Request, res: Response) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    let company = parsed.data.company ?? "";
    let contact_name: string | null | undefined = parsed.data.contact_name;
    let role: string | null | undefined = parsed.data.role;
    let url: string | null | undefined = parsed.data.url;
    let notes: string | null | undefined = parsed.data.notes;
    let resumeContext = (parsed.data.resume_context ?? "").trim();

    const pool = getPool();

    if (parsed.data.lead_id) {
      if (!pool) {
        return res.status(503).json({ error: "Database not configured" });
      }
      const r = await pool.query(
        `SELECT company, contact_name, role, url, notes FROM leads WHERE id = $1`,
        [parsed.data.lead_id]
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Lead not found" });
      const row = r.rows[0] as Record<string, unknown>;
      company = String(row.company ?? "");
      contact_name = row.contact_name as string | null | undefined;
      role = row.role as string | null | undefined;
      url = row.url as string | null | undefined;
      notes = row.notes as string | null | undefined;
    }

    if (!company.trim()) {
      return res.status(400).json({ error: "company is required (or pass lead_id)" });
    }

    if (!resumeContext && pool) {
      try {
        const pr = await pool.query<{ resume_text: string }>(
          `SELECT resume_text FROM user_profile WHERE id = 1 LIMIT 1`
        );
        const stored = pr.rows[0]?.resume_text;
        if (typeof stored === "string" && stored.trim()) resumeContext = stored.trim();
      } catch {
        /* ignore profile read errors */
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.json(
        demoDrafts({
          company,
          contact_name,
          role,
          url,
          notes,
          resume_snippet: resumeContext || null,
        })
      );
    }

    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

    const system = `You draft short, human outreach emails for a freelancer contacting a prospect company.

Ground truth for THE CANDIDATE (the sender) is ONLY the field resume_context when it is non-empty.
- Every skill, employer, title, degree, certification, stack, metric, project name, or accomplishment mentioned about the sender MUST appear in resume_context (or be generic wording that asserts nothing factual, e.g. "happy to share relevant experience").
- Do NOT infer the sender's technologies or achievements from the job posting, company name, or notes unless the same facts appear verbatim or clearly paraphrasable from resume_context.
- Do NOT invent numbers, clients, job titles, dates, or tools.
- If resume_context is null or empty: write a neutral message — show interest in the role/company using company, role, url, notes only; do NOT describe the sender's qualifications beyond offering to share background.
- Do NOT claim "I saw your site" or deep product knowledge unless notes/url give concrete hooks you reference honestly.

Job posting / lead fields (company, role, url, notes, contact_name) describe THE PROSPECT — you may reference those freely.

Output strict JSON with keys: subject_lines (array of 3 strings), drafts (array of 3 objects with label and body strings).
Tone: professional, concise, no hype, no exaggeration.`;

    const user = JSON.stringify({
      company,
      contact_name,
      role,
      url,
      notes,
      resume_context:
        resumeContext.length > 0 ? resumeContext.slice(0, 8000) : null,
      instruction:
        "Only attribute qualifications to the sender that are supported by resume_context; otherwise stay generic.",
    });

    try {
      const completion = await client.chat.completions.create({
        model,
        temperature: 0.35,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      });
      const raw = completion.choices[0]?.message?.content ?? "{}";
      const obj = JSON.parse(raw) as {
        subject_lines?: string[];
        drafts?: { label: string; body: string }[];
      };
      res.json({
        subject_lines: obj.subject_lines ?? [],
        drafts: obj.drafts ?? [],
        model,
        disclaimer:
          "Verify every claim about your background against Profile before sending — drafts must match your resume only.",
      });
    } catch (e) {
      console.error(e);
      res.status(502).json({
        error: "AI provider error",
        fallback: demoDrafts({
          company,
          contact_name,
          role,
          url,
          notes,
          resume_snippet: resumeContext || null,
        }),
      });
    }
  });
}
