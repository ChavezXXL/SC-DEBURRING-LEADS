# AI Assistant Guide (Claude / System)

Hello! If you are an AI assistant (like Claude) taking over or helping manage this codebase, this document is for you. It outlines the current architecture, tech stack, and recommendations for extending the app safely.

## Tech Stack
- **Frontend Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Icons:** `lucide-react`
- **Database:** Firebase Firestore (`firebase.ts` handles initialization)
- **AI Integration:** `@google/genai` (Gemini API for pitch generation and lead research)

## Current Architecture & State
Currently, the application is heavily centralized. 
- **`/src/App.tsx`**: This is a monolithic file (~1400 lines) containing almost everything:
  - Global State (`useState`, `useEffect`)
  - Hardcoded Data (`SCRIPTS`, `OBJECTIONS`, `STATUS`, `REGIONS`)
  - TypeScript Interfaces (`Lead`, `AiMode`)
  - Firebase CRUD operations (`addDoc`, `updateDoc`, `deleteDoc`, `onSnapshot`)
  - Gemini AI logic (`handleAI`, `findNewLeads`)
  - All UI Components (Sidebar, Lead Cards, Modals, Outreach Tab)

## Database Schema (Firestore)
**Collection:** `leads`
- `id`: string (Document ID)
- `co`: string (Company Name)
- `city`: string (Location)
- `pm`: string (Purchasing Manager Name)
- `pm_title`: string (Purchasing Manager Title)
- `role`: string (General Contact Role)
- `ph`: string (Phone Number)
- `em`: string (Email Address)
- `web`: string (Website URL)
- `parts`: string (Parts/Programs context)
- `pitch`: string (Custom pitch angle)
- `notes`: string (Call log / notes)
- `status`: string (e.g., 'new', 'contacted', 'won', 'lost')
- `createdAt`: timestamp

## How to Make Changes Safely
Because `App.tsx` is very large, **do not attempt to replace the entire file at once**. Use targeted search-and-replace or surgical edits. 

### Recommended Refactoring (If adding major features)
If the user asks you to add significant new features, your **first step** should be to modularize the codebase to save your context window:
1. **Extract Types:** Move all `interface` and `type` declarations to `/src/types.ts`.
2. **Extract Constants:** Move `SCRIPTS`, `OBJECTIONS`, `STATUS`, and `REGIONS` to `/src/constants.ts`.
3. **Extract Services:** Move Firebase logic to `/src/services/db.ts` and Gemini logic to `/src/services/ai.ts`.
4. **Extract Components:** Break the UI into `/src/components/Sidebar.tsx`, `/src/components/LeadCard.tsx`, `/src/components/Modals.tsx`, etc.

## Environment Variables
- `VITE_FIREBASE_*`: Standard Firebase config variables.
- `GEMINI_API_KEY`: Used for the AI features. (Note: In the AI Studio environment, this is injected automatically via `process.env.GEMINI_API_KEY` on the backend, but currently the app calls it directly from the frontend using `import.meta.env.VITE_GEMINI_API_KEY` or similar if configured).

## Common Tasks
- **Adding a new Status:** Update the `STATUS` array in `App.tsx`.
- **Adding a new Script:** Update the `SCRIPTS` array in `App.tsx`.
- **Adding a new Lead Field:** Update the `Lead` interface, the `EMPTY_LEAD_FORM` constant, the Add Lead modal inputs, and the Lead Card display.
