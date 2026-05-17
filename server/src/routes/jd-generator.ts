import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { z } from "zod";

const generateJdBody = z.object({
  title: z.string().min(2),
  company: z.string().min(1),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  salary_range: z.string().optional(),
  notes: z.string().optional(),
});

export function registerJdGeneratorRoutes(app: Express): void {
  app.post("/api/ai/generate-jd", async (req: Request, res: Response) => {
    const parsed = generateJdBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "title and company are required." });
      return;
    }

    const { title, company, location, remote, salary_range, notes } = parsed.data;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.json({
        description: `${title} at ${company}\n\nWe are looking for an experienced ${title} to join our team${location ? ` in ${location}` : ""}${remote ? " (Remote)" : ""}.\n\nResponsibilities:\n- [Add key responsibilities]\n\nRequirements:\n- [Add required skills and experience]\n\nWhat we offer:\n${salary_range ? `- Compensation: ${salary_range}\n` : ""}- Collaborative team environment\n- Growth opportunities`,
        source: "fallback",
      });
      return;
    }

    const client = new OpenAI({ apiKey });
    const prompt = `Write a professional, compelling job description for the following position. Use clear sections: Overview, Responsibilities (5-7 bullets), Requirements (5-7 bullets), and Nice to Have (3 bullets). Keep it concise and appealing to top candidates.

Job Title: ${title}
Company: ${company}
Location: ${location ?? "Not specified"}${remote ? " (Remote)" : ""}
Salary/Rate: ${salary_range ?? "Competitive"}
Additional context: ${notes ?? "None"}

Return the job description as plain text with section headers.`;

    try {
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });

      const description = completion.choices[0]?.message?.content?.trim() ?? "";
      res.json({ description, source: "ai" });
    } catch (err) {
      console.error("JD generator error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "AI error" });
    }
  });
}
