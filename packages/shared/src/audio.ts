// Names of every sound the TV can play. Recorded files are named after these
// (e.g. applause.mp3, applause-2.mp3); synthesized fallbacks exist for many.

export const SOUND_CUES = [
  // game events
  'join',
  'start',
  'vote',
  'spinTick',
  'spinLand',
  'question',
  'lockIn',
  'tick',
  'timeUp',
  'drumroll',
  'reveal',
  'wrong',
  'scoreboard',
  'leadChange',
  'winner',
  // power plays
  'freeze',
  'splat',
  'shatter',
  'wipe',
  // the studio audience
  'applause',
  'cheer',
  'ooh',
  'aww',
  'laugh',
  'gasp',
] as const;
export type SoundCue = (typeof SOUND_CUES)[number];

export const MUSIC_TRACKS = ['lobby', 'thinking', 'final'] as const;
export type MusicTrack = (typeof MUSIC_TRACKS)[number];

/** public/audio/manifest.json: each name maps to one or more files (variants are picked at random). */
export type AudioManifest = Partial<Record<SoundCue | MusicTrack, string | string[]>>;

/** public/voice/manifest.json: Otto's pre-recorded lines by voice id, with each clip's length. */
export type VoiceManifest = Record<string, { file: string; hash: string; durationMs?: number }>;
