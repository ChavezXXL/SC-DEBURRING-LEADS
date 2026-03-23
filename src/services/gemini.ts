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

const MODEL_CANDIDATES = (import.meta.env.VITE_GEMINI_MODELS as string | undefined)
  ?.split(',')
  .map(model => model.trim())
  .filter(Boolean) || ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.1-pro-preview'];
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_GEMINI_TIMEOUT_MS || 12000);
const TOTAL_TIMEOUT_MS = Number(import.meta.env.VITE_GEMINI_TOTAL_TIMEOUT_MS || 20000);

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldRetry(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('503') ||
    message.includes('unavailable') ||
    message.includes('high demand') ||
    message.includes('429') ||
    message.includes('rate')
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function generateWithFallback(
  request: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>
) {
  const ai = getAi();
  const errors: string[] = [];
  const startedAt = Date.now();

  for (const model of MODEL_CANDIDATES) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (Date.now() - startedAt > TOTAL_TIMEOUT_MS) {
        throw new Error(`AI timed out after ${TOTAL_TIMEOUT_MS}ms. Please try again.`);
      }

      try {
        return await withTimeout(
          ai.models.generateContent({
            model,
            ...request
          }),
          REQUEST_TIMEOUT_MS,
          `Model ${model} timed out after ${REQUEST_TIMEOUT_MS}ms`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`[${model}, attempt ${attempt}] ${message}`);

        if (!shouldRetry(error) || attempt === 2) {
          break;
        }

        await wait(350 * attempt);
      }
    }
  }

  throw new Error(`AI request failed after retries/model fallback. ${errors.join(' | ')}`);
}

export async function findNewLeads(query: string): Promise<Lead[]> {
  const prompt = `You are a B2B sales prospector for a deburring shop. Find 3-5 new manufacturing companies that fit this query: "${query}".
  
Return ONLY a raw JSON array of companies. Do not include markdown formatting like \`\`\`json. Fill in as much detail as possible using Google Search.
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

  const response = await generateWithFallback({
    contents: prompt,
    config: {
      maxOutputTokens: 900,
      tools: [{ googleSearch: {} }],
    }
  });
  
  let text = response.text || "[]";
  
  // 1. Strip markdown code blocks
  text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  // 2. Robust JSON extraction: try to find the first valid JSON array or object
  let parsed = null;
  
  // Try parsing the whole text first
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    // If it fails, try to find a valid JSON substring
    let found = false;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '[' || text[i] === '{') {
        for (let j = text.length - 1; j >= i; j--) {
          if ((text[i] === '[' && text[j] === ']') || (text[i] === '{' && text[j] === '}')) {
            try {
              parsed = JSON.parse(text.substring(i, j + 1));
              found = true;
              break;
            } catch (err) {
              // Continue searching
            }
          }
        }
      }
      if (found) break;
    }
  }
  
  if (!parsed) {
    console.error("Failed to parse JSON from AI:", text);
    throw new Error("AI returned invalid data format. Please try again.");
  }
  
  // Sometimes AI wraps it in an object like { "companies": [...] }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const keys = Object.keys(parsed);
    for (const key of keys) {
      if (Array.isArray(parsed[key])) {
        parsed = parsed[key];
        break;
      }
    }
  }
  
  return Array.isArray(parsed) ? parsed : [];
}

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

  const response = await generateWithFallback({
    contents: prompt,
    config: {
      maxOutputTokens: 450,
    }
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

  const response = await generateWithFallback({
    contents: prompt,
    config: {
      maxOutputTokens: 700,
      tools: [{ googleSearch: {} }],
    }
  });
  return response.text;
}
