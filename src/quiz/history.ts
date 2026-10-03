/**
 * Minimal history: which questions were recently asked.
 *
 * Two separate concerns share this shape. Per-video history (last 20 videos,
 * recent questions per video) is what tells the LLM generator (next phase)
 * not to repeat itself on a rewatched video. The fallback bank's own
 * no-repeat window is the same idea applied to a fixed pool of question ids
 * instead of freshly generated text, so one history shape covers both.
 *
 * Pure functions over a plain id list. No chrome.* calls, so the no-repeat
 * logic is testable without storage.
 */

import { CONFIG } from '../config.js';

/** A bounded, most-recent-last list of ids. */
export type RecentIds = string[];

export function recordUsed(recent: RecentIds, id: string, windowSize: number): RecentIds {
  const next = [...recent.filter((existing) => existing !== id), id];
  return next.length > windowSize ? next.slice(next.length - windowSize) : next;
}

export function wasRecentlyUsed(recent: RecentIds, id: string): boolean {
  return recent.includes(id);
}

/** Per-video question history, bounded per src/config.ts. */
export interface VideoHistoryEntry {
  videoId: string;
  /** Prompts asked about this video, most recent last. */
  recentPrompts: string[];
}

export type VideoHistory = VideoHistoryEntry[];

export function recordVideoQuestions(
  history: VideoHistory,
  videoId: string,
  prompts: string[],
): VideoHistory {
  const { maxVideos, maxQuestionsPerVideo } = CONFIG.history;
  const existing = history.find((e) => e.videoId === videoId);
  const mergedPrompts = [...(existing?.recentPrompts ?? []), ...prompts].slice(-maxQuestionsPerVideo);

  const withoutThisVideo = history.filter((e) => e.videoId !== videoId);
  const updated = [...withoutThisVideo, { videoId, recentPrompts: mergedPrompts }];

  // Oldest video drops first. Order of first appearance in the array is the
  // recency order, since every touch re-appends to the end.
  return updated.length > maxVideos ? updated.slice(updated.length - maxVideos) : updated;
}

export function promptsForVideo(history: VideoHistory, videoId: string): string[] {
  return history.find((e) => e.videoId === videoId)?.recentPrompts ?? [];
}
