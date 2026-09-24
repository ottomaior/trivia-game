// Length of an MP3 clip, from its frame headers (works for CBR and VBR). The
// server uses clip lengths to let Otto finish a line before the show moves on.

const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SAMPLE_RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** Milliseconds of audio in an MPEG Layer III file; 0 if it has no frames. */
export function mp3DurationMs(data: Uint8Array): number {
  let i = 0;
  // Skip an ID3v2 tag.
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) {
    i = 10 + ((data[6]! << 21) | (data[7]! << 14) | (data[8]! << 7) | data[9]!);
  }
  let seconds = 0;
  while (i + 4 <= data.length) {
    const b1 = data[i + 1]!;
    const b2 = data[i + 2]!;
    const version = (b1 >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    const layer = (b1 >> 1) & 3; // 1 = Layer III
    const bitrateIndex = b2 >> 4;
    const rateIndex = (b2 >> 2) & 3;
    if (data[i] !== 0xff || (b1 & 0xe0) !== 0xe0 || version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) {
      i++; // not a frame header: resync
      continue;
    }
    const bitrate = (version === 3 ? BITRATES_V1_L3 : BITRATES_V2_L3)[bitrateIndex]! * 1000;
    const sampleRate = SAMPLE_RATES[version]![rateIndex]!;
    const samples = version === 3 ? 1152 : 576;
    const padding = (b2 >> 1) & 1;
    const frameBytes = Math.floor(((samples / 8) * bitrate) / sampleRate) + padding;
    seconds += samples / sampleRate;
    i += frameBytes;
  }
  return Math.round(seconds * 1000);
}
