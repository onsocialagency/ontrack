/**
 * Suggestion Storage (localStorage)
 *
 * Persists user decisions (done / snoozed / dismissed) keyed by client slug.
 * Guards every call with `typeof window` checks so imports are SSR-safe.
 */

import type { Suggestion } from "./types";

export interface DoneEntry {
  id: string;
  actionedAt: string;
}

export interface SnoozeEntry {
  id: string;
  snoozedUntil: string;
}

export interface DismissEntry {
  id: string;
  dismissedAt: string;
}

function keyFor(clientSlug: string, kind: "done" | "snoozed" | "dismissed"): string {
  return `ontrack_suggestions_${clientSlug}_${kind}`;
}

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readList<T>(key: string): T[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, list: T[]): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Ignore quota errors.
  }
}

/* ── Getters ── */

export function getDone(clientSlug: string): DoneEntry[] {
  return readList<DoneEntry>(keyFor(clientSlug, "done"));
}

export function getSnoozed(clientSlug: string): SnoozeEntry[] {
  return readList<SnoozeEntry>(keyFor(clientSlug, "snoozed"));
}

export function getDismissed(clientSlug: string): DismissEntry[] {
  return readList<DismissEntry>(keyFor(clientSlug, "dismissed"));
}

/* ── Mutators ── */

export function markDone(clientSlug: string, id: string): void {
  const list = getDone(clientSlug);
  if (list.some((e) => e.id === id)) return;
  list.unshift({ id, actionedAt: new Date().toISOString() });
  // Keep the list from growing unbounded.
  writeList(keyFor(clientSlug, "done"), list.slice(0, 200));
}

export function snooze(clientSlug: string, id: string, days: number = 7): void {
  const list = getSnoozed(clientSlug).filter((e) => e.id !== id);
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  list.push({ id, snoozedUntil: until });
  writeList(keyFor(clientSlug, "snoozed"), list);
}

export function dismiss(clientSlug: string, id: string): void {
  const list = getDismissed(clientSlug).filter((e) => e.id !== id);
  list.push({ id, dismissedAt: new Date().toISOString() });
  writeList(keyFor(clientSlug, "dismissed"), list);
}

/* ── Filter helper ── */

/**
 * Remove any suggestion whose id is marked done, dismissed, or snoozed with
 * a `snoozedUntil` still in the future.
 */
export function filterActiveSuggestions(
  clientSlug: string,
  suggestions: Suggestion[],
): Suggestion[] {
  const doneIds = new Set(getDone(clientSlug).map((e) => e.id));
  const dismissedIds = new Set(getDismissed(clientSlug).map((e) => e.id));
  const now = Date.now();
  const snoozedActive = new Set(
    getSnoozed(clientSlug)
      .filter((e) => new Date(e.snoozedUntil).getTime() > now)
      .map((e) => e.id),
  );

  return suggestions.filter(
    (s) => !doneIds.has(s.id) && !dismissedIds.has(s.id) && !snoozedActive.has(s.id),
  );
}

/**
 * Return the most recent N "done" entries for the Actioned this month section.
 */
export function getRecentDone(clientSlug: string, limit: number = 10): DoneEntry[] {
  return getDone(clientSlug)
    .slice()
    .sort((a, b) => b.actionedAt.localeCompare(a.actionedAt))
    .slice(0, limit);
}
