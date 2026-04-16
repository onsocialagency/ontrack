/**
 * Creative Lab -- Alert Computation
 *
 * Scans LiveCreative[] and returns alert flags that drive
 * the green dot badge on the Creative Lab sidebar nav.
 */

import type { LiveCreative } from "./creativeAggregator";

export interface CreativeAlertSummary {
  hasAlerts: boolean;
  alertCount: number;
  fatiguedCount: number;
  killCount: number;
  trafficWarningCount: number;
  lowQSCount: number;
  learningCount: number;
}

/**
 * Compute creative alert summary from an array of LiveCreatives.
 * Returns a summary used to show/hide the sidebar badge.
 */
export function computeCreativeAlerts(creatives: LiveCreative[]): CreativeAlertSummary {
  let fatiguedCount = 0;
  let killCount = 0;
  let trafficWarningCount = 0;
  let lowQSCount = 0;
  let learningCount = 0;

  for (const c of creatives) {
    // Only count live creatives for alerts
    if (!c.isLive) continue;

    if (c.scoreResult.fatigueLevel === "critical" || c.scoreResult.fatigueLevel === "fatigued") {
      fatiguedCount++;
    }

    if (c.scoreResult.label === "Kill") {
      killCount++;
    }

    if (c.scoreResult.warnings.length > 0) {
      trafficWarningCount++;
    }

    if (c.scoreResult.isLearning) {
      learningCount++;
    }
  }

  const alertCount = fatiguedCount + killCount + trafficWarningCount;

  return {
    hasAlerts: alertCount > 0,
    alertCount,
    fatiguedCount,
    killCount,
    trafficWarningCount,
    lowQSCount,
    learningCount,
  };
}
