import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { z } from "zod";
import { getPool } from "../db.js";

const fromPostingBody = z.object({
  raw_posting: z.string().min(30, "Paste at least a few lines from the job posting"),
  resume_context: z.string().optional(),
  company_hint: z.string().optional(),
  /** Job page URL if you have it (any string; stored as-is). */
  url: z.string().optional(),
});

type ParsedLead = {
  company: string;
  role: string | null;
  url: string | null;
  notes: string | null;
};

function normalizeUrl(s: string | undefined): string | null {
  const t = s?.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function fallbackLead(input: z.infer<typeof fromPostingBody>): ParsedLead {
  const company = input.company_hint?.trim() || "Edit company name";
  const url = normalizeUrl(input.url);
  const header =
    "Imported from job posting — fill company/title if needed.\n\n";
  return {
    company,
    role: null,
    url,
    notes: header + input.raw_posting.trim(),
  };
}

async function parseWithOpenAI(
  rawPosting: string,
  resumeContext: string | undefined,
  companyHint: string | undefined,
  urlHint: string | undefined
): Promise<ParsedLead | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const system = `You extract structured hiring info for a developer CRM.
Return ONLY valid JSON with keys:
- company (string, employer name — no staffing fluff unless that's all there is)
- role (string|null, job title)
- url (string|null, canonical job URL if inferable from text, else null)
- notes (string): 5-8 lines max: stack/tools mentioned, seniority, location/remote, apply instructions if present, and 2 bullets on fit angles for a full-stack React/API freelancer. No invented employers.
Optional context may include the candidate resume — use only to infer fit themes, not to invent employer facts.`;

  const user = JSON.stringify({
    company_hint: companyHint ?? null,
    url_hint: urlHint ?? null,
    resume_excerpt: resumeContext ? resumeContext.slice(0, 6000) : null,
    posting: rawPosting.slice(0, 12000),
  });

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const company = typeof obj.company === "string" ? obj.company.trim() : "";
    if (!company) return null;
    const role = typeof obj.role === "string" ? obj.role.trim() : null;
    let url: string | null =
      typeof obj.url === "string" && /^https?:\/\//i.test(obj.url) ? obj.url : null;
    if (!url && urlHint) url = normalizeUrl(urlHint);
    const notesRaw = typeof obj.notes === "string" ? obj.notes.trim() : "";
    const notes = notesRaw
      ? `${notesRaw}\n\n---\nSource: job posting import`
      : `Source: job posting import\n\n${rawPosting.slice(0, 4000)}`;
    return {
      company,
      role: role || null,
      url,
      notes,
    };
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function registerPostingRoutes(app: Express): void {
  app.post("/api/leads/from-posting", async (req: Request, res: Response) => {
    const parsed = fromPostingBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const pool = getPool();
    if (!pool) {
      return res.status(503).json({
        error: "Database not configured",
        hint: "Set DATABASE_URL and run npm run db:init --prefix server",
      });
    }

    const b = parsed.data;
    const aiResult = await parseWithOpenAI(
      b.raw_posting,
      b.resume_context,
      b.company_hint,
      b.url?.trim() || undefined
    );
    let extracted: ParsedLead;
    let usedAi = false;
    if (aiResult?.company.trim()) {
      extracted = aiResult;
      usedAi = true;
    } else {
      extracted = fallbackLead(b);
    }

    const insert = await pool.query(
      `INSERT INTO leads (company, contact_name, role, url, notes, stage)
       VALUES ($1, NULL, $2, $3, $4, 'new')
       RETURNING id, company, contact_name, role, url, notes, stage, next_action_at, created_at, updated_at`,
      [
        extracted.company,
        extracted.role,
        extracted.url,
        extracted.notes,
      ]
    );

    res.status(201).json({
      lead: insert.rows[0],
      used_ai: usedAi,
    });
  });
}
