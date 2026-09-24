import { ottoText, ottoVoiceId, SPEECH_CHARS_PER_SECOND, type OttoLine, type VoiceManifest } from '@trivia/shared';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * How long Otto talks, so the show can wait for him instead of cutting him
 * off. Lengths come from the recorded clips' manifests (public/voice/).
 */
export interface SpeechLengths {
  /** Milliseconds one of Otto's lines takes. */
  line(line: OttoLine): number;
  /** Milliseconds the read-aloud of a question takes (0 if it wasn't recorded: the TV stays silent). */
  question(voice: string): number;
}

/** No voice at all (unit tests): nothing to wait for. */
export const silentSpeech: SpeechLengths = { line: () => 0, question: () => 0 };

function readManifest(path: string): VoiceManifest {
  try {
    return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as VoiceManifest) : {};
  } catch {
    return {};
  }
}

/** Reads the voice manifests in `voiceDir` (and its q/ folder). */
export function loadSpeechLengths(voiceDir: string): SpeechLengths {
  const lines = readManifest(join(voiceDir, 'manifest.json'));
  const questions = readManifest(join(voiceDir, 'q', 'manifest.json'));
  const voiced = Object.keys(lines).length > 0;
  return {
    line(line) {
      const ms = lines[ottoVoiceId(line)]?.durationMs;
      if (ms !== undefined) return ms;
      // A line not recorded yet still shows in the bubble: leave time to read it.
      return voiced ? Math.round((ottoText(line).length / SPEECH_CHARS_PER_SECOND) * 1000) : 0;
    },
    question: (voice) => questions[voice]?.durationMs ?? 0,
  };
}
