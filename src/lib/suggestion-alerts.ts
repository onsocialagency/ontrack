/**
 * Suggestions -- Alert Computation
 *
 * Scans a Suggestion[] (already filtered through suggestionStorage) and
 * returns the summary used by the sidebar green-dot badge + count.
 */

import type { Suggestion } from "./types";

export interface SuggestionAlertSummary {
  hasHighPriority: boolean;
  highCount: number;
  totalActive: number;
}

export function computeSuggestionAlerts(suggestions: Suggestion[]): SuggestionAlertSummary {
  let highCount = 0;
  for (const s of suggestions) {
    if (s.priority === "high") highCount++;
  }
  return {
    hasHighPriority: highCount > 0,
    highCount,
    totalActive: suggestions.length,
  };
}
