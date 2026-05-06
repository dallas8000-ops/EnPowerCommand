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
      ? `\n(My background: ${input.resume_snippet.trim().slice(0, 280)}…)`
      : "";
  const subj = `Quick idea for ${input.company}'s product workflow`;
  const a = `Hi ${who}${role},

I looked at ${input.company}${site} and sketched a small improvement that usually saves teams time on onboarding and follow-ups.${notes}${resume}

If you're open to it, I can send a 2-minute Loom walking through it — no obligation.

Best`;
  const b = `Hi ${who},

Noticed ${input.company} — I build React + API tooling for small teams (staging, CI, clean handoff).${notes}${resume}

Happy to do a free 20-min discovery if there's a fit.

Cheers`;
  return {
    subject_lines: [subj, `Intro — shipping help for ${input.company}`, `Freelance dev — ${input.company}`],
    drafts: [
      { label: "Consultative", body: a },
      { label: "Direct", body: b },
      {
        label: "Follow-up (3 days)",
        body: `Hi ${who}, bumping this in case it got buried. Still happy to share the short walkthrough if useful.`,
      },
    ],
    disclaimer: "Demo mode: set OPENAI_API_KEY for model-generated drafts.",
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
    const resumeContext = parsed.data.resume_context?.trim();

    if (parsed.data.lead_id) {
      const pool = getPool();
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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.json(
        demoDrafts({
          company,
          contact_name,
          role,
          url,
          notes,
          resume_snippet: resumeContext ?? null,
        })
      );
    }

    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

    const system = `You help a freelance full-stack developer write short, human outreach.
Rules: no spam, no fake claims, no "I saw your website" fluff without substance.
Use resume_context only to choose relevant proof points — do not invent employers or credentials.
Output strict JSON with keys: subject_lines (array of 3 strings), drafts (array of 3 objects with label and body strings).
Tone: professional, concise, specific when notes/url allow.`;

    const user = JSON.stringify({
      company,
      contact_name,
      role,
      url,
      notes,
      resume_context: resumeContext?.slice(0, 8000) ?? null,
    });

    try {
      const completion = await client.chat.completions.create({
        model,
        temperature: 0.7,
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
          resume_snippet: resumeContext ?? null,
        }),
      });
    }
  });
}
