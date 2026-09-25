import type { Expression, HostView, Stage } from '@trivia/shared';

type RevealStage = Extract<Stage, { phase: 'reveal' }>;

/**
 * How a player's answer shows on their face at the reveal. Blöffölő: fell
 * for a lie → fooled, else fooled someone with theirs → sneaky, else found
 * the truth → correct. Other modes: right → correct; some points (a partly
 * right order) → no change; nothing → wrong. No answer at all → wrong.
 */
export function revealExpression(stage: RevealStage, playerId: string): Expression | undefined {
  const pick = stage.picks.find((p) => p.playerId === playerId);
  if (!pick) return undefined;
  const { result } = stage;
  if (result.kind === 'bluff') {
    const lies = result.options.filter((o) => !o.truth);
    if (lies.some((o) => o.pickers.includes(playerId))) return 'fooled';
    if (lies.some((o) => o.authors.includes(playerId) && o.pickers.some((id) => id !== playerId))) return 'sneaky';
    if (result.options.some((o) => o.truth && o.pickers.includes(playerId))) return 'correct';
    return 'wrong';
  }
  if (pick.correct) return 'correct';
  return pick.points > 0 ? undefined : 'wrong';
}

/**
 * What stays on a player's face whatever the phase: a power play they
 * haven't cleared yet (slime first: it is cleared before the ice), or having
 * fallen off the ladder.
 */
export function heldExpression(view: HostView, playerId: string): Expression | undefined {
  const hits = 'hits' in view.stage ? view.stage.hits.filter((h) => h.target === playerId && !h.cleared) : [];
  if (hits.some((h) => h.power === 'slime')) return 'slimed';
  if (hits.some((h) => h.power === 'freeze')) return 'frozen';
  if (view.ladder?.seats.find((s) => s.playerId === playerId)?.status === 'out') return 'out';
  return undefined;
}
