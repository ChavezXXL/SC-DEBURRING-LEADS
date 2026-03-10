import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generatePitch(lead: any) {
  const prompt = `You write tight, human cold outreach for SC Precision Deburring — 35-year family-owned aerospace deburring shop in Pacoima CA. Anthony is the owner. Microscope-inspected precision deburring. No minimums. Fast turnaround. Write short, real, no-fluff outreach.

Write a personalized cold email + 2-sentence phone opener:

Company: ${lead.co}
Contact: ${lead.pm || lead.who} (${lead.role})
City: ${lead.city}, CA
Parts they make: ${lead.parts}
Best pitch angle: ${lead.pitch}

Format exactly:
COLD EMAIL
Subject: [subject line]
[body — 4 sentences max]

CALL OPENER
[2 sentences max]`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: prompt,
  });
  return response.text;
}

export async function researchContact(lead: any) {
  const prompt = `You are a B2B sales researcher. Your job is to find the right decision-maker contact at manufacturing companies for a deburring subcontract service. Be specific and honest about what you know vs. don't know. Always suggest the best search approach if you can't confirm details.

Research the best contact at this company for outsourced deburring work:

Company: ${lead.co}
City: ${lead.city}, CA
Industry: Aerospace/Defense precision machining
What they make: ${lead.parts}
Current contact on file: ${lead.who} — ${lead.role}
${lead.pm ? `Named contact on file: ${lead.pm} (${lead.pm_title})` : "No named contact yet"}

Provide:
1. Best contact name & title (Purchasing Manager, Procurement, Operations Mgr, or Owner)
2. Email address or best email pattern to try
3. Direct LinkedIn search URL to find them
4. Best outreach angle for this specific company
5. Confidence level: HIGH / MEDIUM / LOW
6. Top Google search query to find their buyer

Be specific. If you don't know the name, say so and give the best strategy to find them.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    }
  });
  return response.text;
}
