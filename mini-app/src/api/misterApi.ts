import { requestJson } from './apiBase';

// ── Types ────────────────────────────────────────────────────────

export type AppConfig = {
  event: {
    id: number;
    year: number;
    title: string;
    is_active: boolean;
    voting_enabled: boolean;
    interviews_enabled: boolean;
    tapbar_enabled: boolean;
    results_visible: boolean;
    contest_type: 'person' | 'class';
    accent_color: string;
    classes: string[];
  };
  texts: Record<string, string>;
};

export type Contestant = {
  id: number;
  name: string;
  surname: string;
  display_name: string;
  profile: string;
  description: string;
  photo_url: string;
  sort_order: number;
};

export type AuthResponse = {
  voter_id: number;
  access: boolean;
  already_voted: boolean;
};

export type ResultEntry = {
  id: number;
  display_name: string;
  photo_url: string;
  votes: number;
  percentage: number;
};

export type ResultsPayload = {
  contestants: ResultEntry[];
  total_votes: number;
};

// ── Helpers ──────────────────────────────────────────────────────

/** Prepend the API base URL to photo paths that come from the backend. */
export function resolvePhotoUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = import.meta.env.VITE_API_BASE_URL || '';
  return base ? `${base}${url}` : url;
}

// ── API calls ────────────────────────────────────────────────────

export async function getConfig(): Promise<AppConfig> {
  return requestJson<AppConfig>('/api/config');
}

export async function getContestants(): Promise<Contestant[]> {
  return requestJson<Contestant[]>('/api/contestants');
}

export type RafflePayload = {
  active: boolean;
  winner: { row: number; seat: number } | null;
};

export async function authVoter(data: {
  first_name: string;
  last_name: string;
  profile: string;
  parallel: string;
  is_guest: boolean;
}): Promise<AuthResponse> {
  return requestJson<AuthResponse>('/api/auth-voter', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function castVote(voter_id: number, contestant_id: number): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>('/api/vote', {
    method: 'POST',
    body: JSON.stringify({ voter_id, contestant_id }),
  });
}

export async function getResults(): Promise<ResultsPayload> {
  return requestJson<ResultsPayload>('/api/results');
}

export async function checkResultsAccess(tgId: number): Promise<{ can_see: boolean }> {
  return requestJson<{ can_see: boolean }>(`/api/results/access?tg_id=${tgId}`);
}

export function subscribeResults(onData: (data: ResultsPayload) => void): () => void {
  const base = import.meta.env.VITE_API_BASE_URL || '';
  const eventSource = new EventSource(`${base}/api/results/stream`);
  eventSource.addEventListener('results', (e) => {
    try {
      const payload = JSON.parse(e.data) as ResultsPayload;
      onData(payload);
    } catch {}
  });
  return () => eventSource.close();
}

export async function getRaffle(): Promise<RafflePayload> {
  return requestJson<RafflePayload>('/api/raffle');
}

export function subscribeRaffle(onData: (data: RafflePayload) => void): () => void {
  const base = import.meta.env.VITE_API_BASE_URL || '';
  const eventSource = new EventSource(`${base}/api/raffle/stream`);
  eventSource.addEventListener('raffle', (e) => {
    try {
      const payload = JSON.parse(e.data) as RafflePayload;
      onData(payload);
    } catch {}
  });
  return () => eventSource.close();
}
