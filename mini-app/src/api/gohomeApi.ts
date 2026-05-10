import { requestJson } from './apiBase';

// ── Types ────────────────────────────────────────────────────────

export type UserRoute = {
  id: number;
  tg_id: number;
  category: 'minsk' | 'home';
  route_number: string;
  direction: number;
  stop_from_id: string;
  stop_from_name: string;
  stop_to_id: string;
  stop_to_name: string;
  sort_order: number;
};

export type HourEntry = {
  hour: number;
  minutes: string[];
};

export type DaySchedule = {
  label: string;
  mask: number;
  hours: HourEntry[];
};

export type StopSchedule = {
  today: HourEntry[];
  days: DaySchedule[];
};

export type RouteSchedule = {
  route_number: string;
  route_name: string;
  direction: number;
  from: { id: string; name: string; schedule: StopSchedule };
  to: { id: string; name: string; schedule: StopSchedule };
  error?: string;
};

// ── API calls ────────────────────────────────────────────────────

export async function getRoutes(tgId: number, category?: string): Promise<UserRoute[]> {
  const params = category ? `tg_id=${tgId}&category=${category}` : `tg_id=${tgId}`;
  return requestJson<UserRoute[]>(`/api/routes?${params}`);
}

export async function getSchedule(tgId: number, category: string): Promise<RouteSchedule[]> {
  return requestJson<RouteSchedule[]>(`/api/schedule?tg_id=${tgId}&category=${category}`);
}

// ── Search ───────────────────────────────────────────────────────

export type RouteStop = { id: string; name: string };

export type RouteDirection = {
  direction: number;
  name: string;
  end_stop: string;
  stops: RouteStop[];
};

export type RouteSearchResult = {
  route_number: string;
  name_a: string;
  name_b: string;
  directions: RouteDirection[];
};

export async function searchRoute(route: string): Promise<RouteSearchResult> {
  return requestJson<RouteSearchResult>(
    `/api/search/route?route=${encodeURIComponent(route)}`,
    { timeoutMs: 30_000 },
  );
}

export type AddRouteBody = {
  tg_id: number;
  category: 'minsk' | 'home';
  route_number: string;
  direction: number;
  stop_from_id: string;
  stop_to_id: string;
};

export async function addRoute(body: AddRouteBody): Promise<{ id: number; stop_from_name: string; stop_to_name: string }> {
  return requestJson(`/api/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
