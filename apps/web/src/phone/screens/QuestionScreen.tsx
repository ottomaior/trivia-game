import { LIFELINES, t, type LadderHelp, type LadderSeat, type Lifeline, type McQuestionStage, type PlayerView, type PowerPlay } from '@trivia/shared';
import { useState, type CSSProperties } from 'react';
import { send } from '../../net/send.ts';
import type { GameSocket } from '../../net/socket.ts';
import { phoneAnswerStyle, phoneCardStyle, TILE } from '../../ui/answers.ts';
import { AnswerShape } from '../../ui/AnswerShape.tsx';
import { art } from '../../ui/art.ts';
import { FreezeCover, SlimeCover } from '../Obstacles.tsx';
import styles from '../Phone.module.css';

type QuestionStage = McQuestionStage;

/** With both on you, the slime comes off first, then the ice underneath. */
const COVER_ORDER: PowerPlay[] = ['slime', 'freeze'];

export function QuestionScreen({ view, stage, socket }: { view: PlayerView; stage: QuestionStage; socket: GameSocket }) {
  const { question } = stage;
  const open = stage.phase === 'question_open';
  // Show the tap instantly; the server's view confirms it a moment later.
  const [pending, setPending] = useState<{ questionId: string; choice: number } | null>(null);
  const localChoice = pending?.questionId === question.id ? pending.choice : null;
  const mine = view.mine.choice ?? localChoice;
  // Milliomos-létra: climbers get lifelines, everyone off the ladder answers as the audience.
  const seat = view.ladder?.seats.find((s) => s.playerId === view.me.id) ?? null;
  const climbing = seat?.status === 'in';
  const help = view.mine.ladder;
  const hidden = new Set(help?.hidden ?? []);

  // Power plays thrown at me this round; a cleared one goes at once, before the server confirms.
  const [clearedHere, setClearedHere] = useState<string[]>([]);
  const onMe = stage.hits.filter((h) => h.target === view.me.id);
  const cover = COVER_ORDER.find(
    (power) => onMe.some((h) => h.power === power && !h.cleared) && !clearedHere.includes(`${question.id}:${power}`),
  );

  async function answer(choice: number) {
    if (!open || mine !== null || cover || hidden.has(choice)) return;
    setPending({ questionId: question.id, choice });
    navigator.vibrate?.(40);
    const res = await send(socket, 'answer:submit', { questionId: question.id, choice });
    if (!res.ok) setPending(null);
  }

  function cleared(power: PowerPlay) {
    setClearedHere((keys) => [...keys, `${question.id}:${power}`]);
    void send(socket, 'power:clear', { power });
  }

  if (mine !== null) {
    return (
      <div className={styles.column}>
        <div className={styles.lockedCard} style={phoneCardStyle(TILE[mine]!)}>
          <span className={styles.lockedLetter}>
            <AnswerShape index={mine} />
          </span>
          <span>{question.choices[mine]}</span>
        </div>
        <h2 className={styles.screenTitle}>{t.lockedIn}</h2>
        <p className={styles.hint}>{t.waitForOthers}</p>
      </div>
    );
  }

  const audienceTotal = help?.audience?.reduce((a, b) => a + b, 0) ?? 0;
  const byline = cover ? throwers(view, onMe.filter((h) => h.power === cover).map((h) => h.by), cover) : '';
  return (
    <div className={styles.column}>
      <p className={styles.phonePrompt} data-testid="phone-prompt">
        {question.prompt}
      </p>
      {!open && <p className={styles.hint}>{t.getReady}</p>}
      {view.ladder && !climbing && <p className={styles.hint}>{t.audienceMode}</p>}
      {open && climbing && seat && <LifelineBar view={view} seat={seat} socket={socket} />}
      {help && <HelpNotes view={view} help={help} total={audienceTotal} />}
      <div className={styles.choices}>
        {question.choices.map((c, i) => {
          const gone = hidden.has(i);
          const votes = help?.audience?.[i] ?? null;
          return (
          <button
            key={i}
            className={`${styles.choice} ${gone ? styles.choiceGone : ''}`}
            style={phoneAnswerStyle(i)}
            disabled={!open || cover !== undefined || gone}
            onClick={() => answer(i)}
            data-testid={`choice-${i}`}
          >
            <span className={styles.choiceLetter}>
              <AnswerShape index={i} />
            </span>
            <span className={styles.choiceText}>{c}</span>
            {votes !== null && (
              <span className={styles.audienceVotes}>{audienceTotal > 0 ? `${Math.round((votes / audienceTotal) * 100)}%` : '–'}</span>
            )}
          </button>
          );
        })}
        {cover === 'freeze' && (
          <FreezeCover key={`${question.id}-freeze`} active={open} byline={byline} onCleared={() => cleared('freeze')} />
        )}
        {cover === 'slime' && (
          <SlimeCover key={`${question.id}-slime`} active={open} byline={byline} onCleared={() => cleared('slime')} />
        )}
      </div>
    </div>
  );
}

/** "Anna sent you an ice trap!" (with every thrower's name when several teamed up). */
function throwers(view: PlayerView, ids: string[], power: PowerPlay): string {
  const names = ids.map((id) => view.players.find((p) => p.id === id)?.name ?? '?');
  return t.powerHitYou(names.join(', '), power);
}

/** 50:50, ask the audience, phone a friend: one of each per game. */
function LifelineBar({ view, seat, socket }: { view: PlayerView; seat: LadderSeat; socket: GameSocket }) {
  const [choosingFriend, setChoosingFriend] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasAudience = view.ladder!.seats.some((s) => s.status === 'out' || s.status === 'walked');

  async function use(kind: Lifeline, friendId?: string) {
    setBusy(true);
    setChoosingFriend(false);
    await send(socket, 'ladder:lifeline', kind === 'phone' ? { kind, friendId: friendId! } : { kind });
    setBusy(false);
  }

  if (choosingFriend) {
    return (
      <div className={styles.lifelines}>
        <p className={styles.hint}>{t.pickFriend}</p>
        {view.players
          .filter((p) => p.id !== view.me.id)
          .map((p) => (
            <button key={p.id} className={styles.secondary} disabled={busy} onClick={() => void use('phone', p.id)}>
              {p.name}
            </button>
          ))}
        <button className={styles.textButton} onClick={() => setChoosingFriend(false)}>
          {t.cancel}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.lifelineRow} role="group" aria-label={t.lifelinesLabel}>
      {LIFELINES.map((kind) => {
        const used = seat.used.includes(kind);
        const unavailable = (kind === 'audience' && !hasAudience) || (kind === 'phone' && view.players.length < 2);
        return (
          <button
            key={kind}
            className={styles.lifeline}
            disabled={busy || used || unavailable}
            title={kind === 'audience' && !hasAudience ? t.noAudienceYet : undefined}
            onClick={() => (kind === 'phone' ? setChoosingFriend(true) : void use(kind))}
          >
            <img src={art(`life-${kind}${used ? '-used' : ''}`)} alt="" className={styles.lifelineArt} draggable={false} />
            {t.lifelines[kind]}
          </button>
        );
      })}
    </div>
  );
}

/** What the audience and the friend said, as it comes in. */
function HelpNotes({ view, help, total }: { view: PlayerView; help: LadderHelp; total: number }) {
  const friend = help.friend ? view.players.find((p) => p.id === help.friend!.playerId) : null;
  if (!help.audience && !friend) return null;
  return (
    <div className={styles.helpNotes}>
      {help.audience && (
        <p className={styles.hint}>
          {t.audienceSays} {total === 0 ? '…' : ''}
        </p>
      )}
      {friend &&
        (help.friend!.choice === null ? (
          <p className={styles.hint}>{t.friendThinking(friend.name)}</p>
        ) : (
          <p className={styles.friendPick}>
            {t.friendSays(friend.name)} <AnswerShape index={help.friend!.choice} size="1.3em" />
          </p>
        ))}
    </div>
  );
}
