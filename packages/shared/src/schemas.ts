import { z } from 'zod';
import { LANGS, NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from './rules.ts';

// Runtime validation for every client -> server payload.

const roomCode = z
  .string()
  .trim()
  .toUpperCase()
  .length(ROOM_CODE_LENGTH);

const token = z.string().min(16).max(128);

export const hostCreateSchema = z.object({
  householdId: z.uuid(),
  lang: z.enum(LANGS),
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

export const timePingSchema = z.object({
  t: z.number(),
});

export type HostCreatePayload = z.infer<typeof hostCreateSchema>;
export type HostResumePayload = z.infer<typeof hostResumeSchema>;
export type PlayerJoinPayload = z.infer<typeof playerJoinSchema>;
export type PlayerResumePayload = z.infer<typeof playerResumeSchema>;
export type TimePingPayload = z.infer<typeof timePingSchema>;
