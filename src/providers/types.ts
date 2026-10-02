/**
 * The provider boundary.
 *
 * Core systems (state machine, quiz engine, lock, gamification) consume only
 * the normalized events below. Nothing outside a provider folder may import
 * site-specific code, read site DOM, or know that YouTube Kids exists.
 *
 * Adding youtube.com later means writing one more module in this shape.
 */

export interface VideoMetadata {
  /** Stable identifier within the provider. */
  videoId: string;
  title: string | null;
  /** Seconds. Null when the provider cannot determine it. */
  durationSeconds: number | null;
  channel: string | null;
  description: string | null;
}

export interface TranscriptCue {
  /** Seconds from video start. */
  startSeconds: number;
  text: string;
}

export interface Transcript {
  videoId: string;
  languageCode: string;
  /** True when auto-generated rather than human authored. */
  isAutomatic: boolean;
  cues: TranscriptCue[];
  /**
   * Share of the video the cues cover, 0 to 1. Generation waits on this
   * rather than on a wall clock.
   */
  coverage: number;
}

export type ProviderEvent =
  | { type: 'videoStarted'; metadata: VideoMetadata; atSeconds: number }
  | { type: 'progress'; videoId: string; positionSeconds: number; playing: boolean }
  | { type: 'metadataUpdated'; metadata: VideoMetadata }
  | { type: 'transcriptUpdated'; transcript: Transcript }
  | { type: 'transcriptUnavailable'; videoId: string; reason: string }
  /** Playback reached the end of the video. */
  | { type: 'videoEnded'; videoId: string }
  /** The child navigated to a different video, or away from the player. */
  | { type: 'videoLeft'; videoId: string; nextVideoId: string | null };

export type ProviderEventHandler = (event: ProviderEvent) => void;

export interface VideoProvider {
  /** Stable provider name, used in persisted state. */
  readonly id: string;
  /** True when this provider handles the given page. */
  matches(url: string): boolean;
  /** Begin observing. Safe to call once per page. */
  start(emit: ProviderEventHandler): void;
  stop(): void;
  /** Best effort. Used to halt playback the moment a challenge is owed. */
  pausePlayback(): void;
}
