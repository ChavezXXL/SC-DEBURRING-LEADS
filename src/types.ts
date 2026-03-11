export type LeadStatus =
  | 'new'
  | 'called'
  | 'emailed'
  | 'visited'
  | 'voicemail'
  | 'interested'
  | 'quote'
  | 'dead'
  | 'client';

export interface Lead {
  id: string;
  t: 1 | 2;
  r: string;
  co: string;
  city: string;
  ph: string;
  em: string;
  web: string;
  who: string;
  role: string;
  pm: string;
  pm_title: string;
  parts: string;
  pitch: string;
  status: LeadStatus;
  notes: string;
}

export interface StatusDef {
  k: LeadStatus;
  label: string;
  dot: string;
  bg: string;
  tx: string;
}

export interface ScriptDef {
  id: string;
  cat: 'Cold Call' | 'Email' | 'Text' | 'Walk-In' | 'LinkedIn';
  icon: string;
  title: string;
  use: string;
  body: string;
}

export interface ObjectionDef {
  q: string;
  a: string;
}