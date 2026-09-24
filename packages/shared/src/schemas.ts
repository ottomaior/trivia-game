import { z } from 'zod';
import {
  AVATAR_COLORS,
  AVATAR_FACES,
  CHOICES_PER_QUESTION,
  FLAG_REASONS,
  NAME_MAX_LENGTH,
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
  color: z.enum(AVATAR_COLORS),
  face: z.enum(AVATAR_FACES),
});

export const kickSchema = z.object({ playerId: z.string().min(1).max(64) });

export const voteSchema = z.object({ option: z.int().min(0).max(9) });

export const answerSchema = z.object({
  questionId: z.string().min(1).max(64),
  choice: z.int().min(0).max(CHOICES_PER_QUESTION - 1),
});

export const flagSchema = z.object({
  questionId: z.string().min(1).max(64),
  reason: z.enum(FLAG_REASONS),
});

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
export type AnswerPayload = z.infer<typeof answerSchema>;
export type FlagPayload = z.infer<typeof flagSchema>;
export type TimePingPayload = z.infer<typeof timePingSchema>;

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
