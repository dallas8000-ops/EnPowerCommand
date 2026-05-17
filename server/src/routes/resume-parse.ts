import type { Express, Request, Response } from "express";
import OpenAI from "openai";

type ParsedCandidate = {
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  location: string | null;
  skills: string | null;
  notes: string | null;
};

function fallbackParse(text: string): ParsedCandidate {
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  const phoneMatch = text.match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return {
    name: lines[0] ?? "Unknown",
    email: emailMatch?.[0] ?? null,
    phone: phoneMatch?.[0] ?? null,
    title: null,
    location: null,
    skills: null,
    notes: "Resume pasted — please fill in remaining details.",
  };
}

export function registerResumeParseRoutes(app: Express): void {
  app.post("/api/candidates/parse-resume", async (req: Request, res: Response) => {
    const text = (req.body?.resume_text ?? "") as string;
    if (!text.trim() || text.trim().length < 50) {
      res.status(400).json({ error: "Please paste at least a few lines of the resume." });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.json({ candidate: fallbackParse(text), source: "fallback" });
      return;
    }

    const client = new OpenAI({ apiKey });
    const prompt = `Extract candidate information from the resume below. Return a JSON object with these exact keys:
- name (string, full name)
- email (string or null)
- phone (string or null)
- title (string or null, current or most recent job title)
- location (string or null, city/state)
- skills (string or null, comma-separated list of key technical skills and tools)
- notes (string or null, 1-2 sentence professional summary)

Resume:
${text.slice(0, 4000)}

Return only valid JSON. No markdown, no extra text.`;

    try {
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
      const cleaned = raw.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
      const parsed = JSON.parse(cleaned) as ParsedCandidate;
      res.json({ candidate: parsed, source: "ai" });
    } catch (err) {
      console.error("Resume parse error:", err);
      res.json({ candidate: fallbackParse(text), source: "fallback" });
    }
  });
}
