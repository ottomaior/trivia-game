import { z } from 'zod';
import {
  BLUFF_LIE_MAX_CHARS,
  CHARACTERS,
  CHOICES_PER_QUESTION,
  GUESS_CHIPS,
  TIMELINE_ITEMS,
  FLAG_REASONS,
  GAME_MODES,
  NAME_MAX_LENGTH,
  POWER_PLAYS,
  ROOM_CODE_LENGTH,
} from './rules.ts';

// Runtime validation for every client -> server payload, plus the shape of
// question content (seed files and AI output share it).

const roomCode = z.string().trim().toUpperCase().length(ROOM_CODE_LENGTH);

const token = z.string().min(16).max(128);

export const hostCreateSchema = z.object({
  householdId: z.uuid(),
});

export const hostResumeSchema = z.object({
  roomCode,
  hostToken: token,
});

export const playerJoinSchema = z.object({
  roomCode,
  name: z
    .string()
    .trim()
    .min(1)
    .max(NAME_MAX_LENGTH * 2), // generous here; normalizeName() clamps
});

export const playerResumeSchema = z.object({
  roomCode,
  playerId: z.string().min(1).max(64),
  sessionToken: token,
});

export const setAvatarSchema = z.object({
  character: z.enum(CHARACTERS),
});

export const kickSchema = z.object({ playerId: z.string().min(1).max(64) });

export const voteSchema = z.object({ option: z.int().min(0).max(9) });

export const pickModeSchema = z.object({ mode: z.enum(GAME_MODES) });

export const packVoteSchema = z.object({ pack: z.string().min(1).max(40) });

export const setCategorySchema = z.object({ categoryId: z.int().min(1), enabled: z.boolean() });

/** Milliomos-létra: stop before the next rung (true) or keep climbing (false). */
export const ladderWalkSchema = z.object({ walk: z.boolean() });

export const lifelineSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fifty') }),
  z.object({ kind: z.literal('audience') }),
  z.object({ kind: z.literal('phone'), friendId: z.string().min(1).max(64) }),
]);

export const answerSchema = z.object({
  questionId: z.string().min(1).max(64),
  choice: z.int().min(0).max(CHOICES_PER_QUESTION - 1),
});

const questionId = z.string().min(1).max(64);

export const bluffWriteSchema = z.object({ questionId, lie: z.string().trim().min(1).max(BLUFF_LIE_MAX_CHARS) });

/** Room for up to six lies, the truth and the house's padding. */
export const bluffPickSchema = z.object({ questionId, option: z.int().min(0).max(15) });

export const orderSubmitSchema = z.object({
  questionId,
  order: z
    .array(z.int().min(0).max(TIMELINE_ITEMS - 1))
    .length(TIMELINE_ITEMS)
    .refine((o) => new Set(o).size === o.length, 'each item once'),
});

export const guessSubmitSchema = z.object({ questionId, value: z.number().finite().min(-1e15).max(1e15) });

/** Chips name guesses by their index in the sorted list; both may go on the same one. */
export const betSchema = z.object({ questionId, chips: z.array(z.int().min(0).max(15)).length(GUESS_CHIPS) });

export const flagSchema = z.object({
  questionId: z.string().min(1).max(64),
  reason: z.enum(FLAG_REASONS),
});

export const powerChooseSchema = z.object({
  power: z.enum(POWER_PLAYS),
  targetId: z.string().min(1).max(64),
});

export const powerClearSchema = z.object({ power: z.enum(POWER_PLAYS) });

export const timePingSchema = z.object({
  t: z.number(),
});

export const emptySchema = z.object({}).optional();

export type HostCreatePayload = z.infer<typeof hostCreateSchema>;
export type HostResumePayload = z.infer<typeof hostResumeSchema>;
export type PlayerJoinPayload = z.infer<typeof playerJoinSchema>;
export type PlayerResumePayload = z.infer<typeof playerResumeSchema>;
export type SetAvatarPayload = z.infer<typeof setAvatarSchema>;
export type KickPayload = z.infer<typeof kickSchema>;
export type VotePayload = z.infer<typeof voteSchema>;
export type PickModePayload = z.infer<typeof pickModeSchema>;
export type PackVotePayload = z.infer<typeof packVoteSchema>;
export type SetCategoryPayload = z.infer<typeof setCategorySchema>;
export type LadderWalkPayload = z.infer<typeof ladderWalkSchema>;
export type LifelinePayload = z.infer<typeof lifelineSchema>;
export type AnswerPayload = z.infer<typeof answerSchema>;
export type FlagPayload = z.infer<typeof flagSchema>;
export type PowerChoosePayload = z.infer<typeof powerChooseSchema>;
export type PowerClearPayload = z.infer<typeof powerClearSchema>;
export type TimePingPayload = z.infer<typeof timePingSchema>;
export type BluffWritePayload = z.infer<typeof bluffWriteSchema>;
export type BluffPickPayload = z.infer<typeof bluffPickSchema>;
export type OrderSubmitPayload = z.infer<typeof orderSubmitSchema>;
export type GuessSubmitPayload = z.infer<typeof guessSubmitSchema>;
export type BetPayload = z.infer<typeof betSchema>;

// ---------------------------------------------------------------------------
// Question content

/** One multiple-choice question as authored: the answer plus three wrong ones. */
export const authoredQuestionSchema = z.object({
  category: z.string().min(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  prompt: z.string().trim().min(8).max(240),
  answer: z.string().trim().min(1).max(80),
  wrong: z.tuple([
    z.string().trim().min(1).max(80),
    z.string().trim().min(1).max(80),
    z.string().trim().min(1).max(80),
  ]),
  explanation: z.string().trim().max(200).optional(),
});

export type AuthoredQuestion = z.infer<typeof authoredQuestionSchema>;

/** Stored `payload` for kind = 'mc'. */
export const mcPayloadSchema = z.object({
  choices: z.array(z.string()).length(CHOICES_PER_QUESTION),
  correct: z.int().min(0).max(CHOICES_PER_QUESTION - 1),
});

export type McPayload = z.infer<typeof mcPayloadSchema>;

const category = z.string().min(1);
const difficulty = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const prompt = z.string().trim().min(8).max(240);
const explanation = z.string().trim().max(200).optional();
const shortText = z.string().trim().min(1).max(80);

/** The blank players fill in with their lie, in Blöffölő prompts. */
export const BLUFF_BLANK = '____';

/**
 * Blöffölő: a fact with a blank (or a short question) whose answer players
 * try to fake. `alternates` are other accepted spellings of the truth (a lie
 * matching one is refused); `decoys` are the house's own believable lies,
 * used when too few players write one.
 */
export const authoredBluffSchema = z
  .object({
    category,
    difficulty,
    prompt,
    answer: z.string().trim().min(1).max(40),
    alternates: z.array(z.string().trim().min(1).max(40)).max(6).optional(),
    decoys: z.tuple([z.string().trim().min(1).max(40), z.string().trim().min(1).max(40)]),
    explanation,
  })
  .refine((q) => q.prompt.split(BLUFF_BLANK).length === 2 || (!q.prompt.includes(BLUFF_BLANK) && q.prompt.endsWith('?')), {
    message: `the prompt needs exactly one ${BLUFF_BLANK} blank, or to be a question`,
  });

/** Időrend: five things of one kind, listed earliest first, each with its year. */
export const authoredTimelineSchema = z
  .object({
    category,
    difficulty,
    prompt,
    items: z
      .array(z.object({ text: z.string().trim().min(1).max(60), year: z.int().min(-5000).max(2100) }))
      .length(TIMELINE_ITEMS),
    explanation,
  })
  .refine((q) => q.items.every((it, i) => i === 0 || it.year > q.items[i - 1]!.year), {
    message: 'items must be listed earliest first, with different years',
  })
  .refine((q) => new Set(q.items.map((it) => it.text.toLocaleLowerCase('hu'))).size === q.items.length, {
    message: 'items must differ',
  });

/** Tippelj!: a question whose answer is one exact number. */
export const authoredNumberSchema = z.object({
  category,
  difficulty,
  prompt,
  answer: z.number().finite(),
  unit: z.string().trim().min(1).max(20).optional(),
  explanation,
});

export type AuthoredBluff = z.infer<typeof authoredBluffSchema>;
export type AuthoredTimeline = z.infer<typeof authoredTimelineSchema>;
export type AuthoredNumber = z.infer<typeof authoredNumberSchema>;

/** Stored `payload` for kind = 'bluff'. */
export const bluffPayloadSchema = z.object({
  answer: z.string(),
  alternates: z.array(z.string()),
  decoys: z.tuple([z.string(), z.string()]),
});

/** Stored `payload` for kind = 'timeline': items earliest first. */
export const timelinePayloadSchema = z.object({
  items: z.array(z.object({ text: z.string(), year: z.int() })).length(TIMELINE_ITEMS),
});

/** Stored `payload` for kind = 'number'. */
export const numberPayloadSchema = z.object({ answer: z.number(), unit: z.string().nullable() });
