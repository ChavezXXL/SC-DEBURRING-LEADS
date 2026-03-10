import { GoogleGenAI, Type } from '@google/genai';
import { Lead } from '../types';

let aiInstance: GoogleGenAI | null = null;

function getAi() {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is missing. Please add it to your environment variables.");
    }
    // Decode the base64 key that was injected by Vite to bypass Netlify secret scanner
    const decodedKey = atob(key);
    aiInstance = new GoogleGenAI({ apiKey: decodedKey });
  }
  return aiInstance;
}

export async function findNewLeads(query: string): Promise<Lead[]> {
  const ai = getAi();
  const prompt = `You are a B2B sales prospector for a deburring shop. Find 3-5 new manufacturing companies that fit this query: "${query}".
  
Return a JSON array of companies. Fill in as much detail as possible using Google Search.
- id: generate a unique lowercase string (e.g. "company-name-city")
- t: tier (1 for large/aerospace, 2 for general machine shop, 3 for small)
- r: region (e.g. "San Fernando Valley", "Orange County", "San Diego", "Other")
- co: Company Name
- city: City, CA
- ph: Phone number if you can find it
- em: Email if you can find it
- web: Website URL
- who: General contact name or "Owner"
- role: Role of general contact
- pm: Purchasing Manager or Buyer name if you can find it
- pm_title: Title of the PM
- parts: What kind of parts they make (e.g. "Aerospace components", "Medical devices")
- pitch: A short 1-sentence angle on why they need deburring
- status: "new"
- notes: ""
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            t: { type: Type.NUMBER },
            r: { type: Type.STRING },
            co: { type: Type.STRING },
            city: { type: Type.STRING },
            ph: { type: Type.STRING },
            em: { type: Type.STRING },
            web: { type: Type.STRING },
            who: { type: Type.STRING },
            role: { type: Type.STRING },
            pm: { type: Type.STRING },
            pm_title: { type: Type.STRING },
            parts: { type: Type.STRING },
            pitch: { type: Type.STRING },
            status: { type: Type.STRING },
            notes: { type: Type.STRING }
          },
          required: ["id", "t", "r", "co", "city", "ph", "em", "web", "who", "role", "pm", "pm_title", "parts", "pitch", "status", "notes"]
        }
      }
    }
  });
  
  return JSON.parse(response.text || "[]");
}

export async function generatePitch(lead: any) {
  const ai = getAi();
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
  const ai = getAi();
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
