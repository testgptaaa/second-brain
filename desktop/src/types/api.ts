export interface DocMetadata {
  id: string;
  title: string;
  doc_type: "episode" | "context" | "note" | "task" | "day_index";
  created_at: string;
  updated_at: string;
  revision: number;
  tags?: string[];
  source_id?: string;
  extra?: Record<string, any>;
}

export interface MemoryDoc {
  metadata: DocMetadata;
  body: string;
  relative_path?: string;
  body_hash?: string;
}

export interface DayOverview {
  date: string;
  path: string;
  episodes_count: number;
  notes_count: number;
}

export interface DayDetail {
  date: string;
  episodes: Array<{
    id: string;
    title: string;
    body: string;
    path: string;
    created_at: string;
  }>;
  notes: Array<{
    id: string;
    title: string;
    body: string;
    path: string;
    created_at: string;
    tags?: string[];
  }>;
}

export interface TaskItem {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "waiting_reply" | "done" | "cancelled";
  due_date?: string;
  confirmed: boolean | number;
  source_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface ConflictItem {
  id: string;
  doc_id: string;
  canonical_path: string;
  conflict_path: string;
  metadata_path: string;
  reason: string;
  created_at: string;
}

export interface SearchResult {
  id: string;
  relative_path: string;
  doc_type: string;
  title: string;
  created_at: string;
  updated_at: string;
  source_id?: string;
  snippet?: string;
  rank?: number;
}

export interface QAResult {
  request_id: string;
  answer: string;
  status: string;
  sources: SearchResult[];
  tokens?: {
    prompt: number;
    completion: number;
  };
}

export interface PolicyStatus {
  is_paused: boolean;
  privacy_mode: "raw" | "pseudonymize";
  analysis_mode: "direct_text" | "image_vision";
  excluded_apps: string[];
  excluded_domains: string[];
}

export interface SuggestionItem {
  id: string;
  scenario_id: string;
  title: string;
  description: string;
  source_refs: Array<{ id: string; title: string }>;
  actions: string[];
  is_notification: boolean;
  created_at: string;
  dismissed: boolean;
  payload?: Record<string, any>;
}

export interface ModelConfig {
  base_url: string;
  api_key: string;
  model_name: string;
}

export interface SecondBrainAPI {
  sendRequest: <T = any>(type: string, payload?: any) => Promise<T>;
  onEvent: (event: string, callback: (payload: any) => void) => () => void;
  mockMode?: boolean;
}

declare global {
  interface Window {
    secondBrain?: SecondBrainAPI;
  }
}
