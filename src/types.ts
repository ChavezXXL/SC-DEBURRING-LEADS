export interface Lead {
  id: string;
  t: number;
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
  status: string;
  notes: string;
}

export interface StatusDef {
  k: string;
  label: string;
  dot: string;
  bg: string;
  tx: string;
}

export interface ScriptDef {
  id: string;
  cat: string;
  icon: string;
  title: string;
  use: string;
  body: string;
}

export interface ObjectionDef {
  q: string;
  a: string;
}
