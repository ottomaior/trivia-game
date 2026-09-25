import { t, type PlayerView, type Stage } from '@trivia/shared';
import { useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { send } from '../../net/send.ts';
import type { GameSocket } from '../../net/socket.ts';
import { letterOf, optionTile } from '../../ui/answers.ts';
import styles from '../Phone.module.css';
import { moveItem, orderUi } from './orderUi.ts';

type OrderStage = Extract<Stage, { phase: 'order_open' }>;

interface Drag {
  item: number;
  pointerId: number;
  /** Where the finger is, and where it grabbed the row (from the row's top), in px. */
  y: number;
  grab: number;
}

/**
 * Időrend: put the five items in order, earliest at the top, then "Kész".
 * Rows are dragged with a finger (the row stays behind as a dashed gap while
 * a copy follows the finger), or moved with arrows (see orderUi.ts).
 */
export function OrderScreen({ view, stage, socket }: { view: PlayerView; stage: OrderStage; socket: GameSocket }) {
  const { question } = stage;
  const items = question.kind === 'timeline' ? question.items : [];
  const ui = useMemo(orderUi, []);
  const [order, setOrder] = useState(() => items.map((_, i) => i));
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pending, setPending] = useState<{ questionId: string; order: number[] } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const sent = view.mine.order ?? (pending?.questionId === question.id ? pending.order : null);

  async function submit() {
    if (sent) return;
    setPending({ questionId: question.id, order });
    navigator.vibrate?.(40);
    const res = await send(socket, 'order:submit', { questionId: question.id, order });
    if (!res.ok) setPending(null);
  }

  if (sent) {
    return (
      <div className={styles.column}>
        <OrderList items={items} order={sent} />
        <h2 className={styles.screenTitle}>{t.lockedIn}</h2>
        <p className={styles.hint}>{t.waitForOthers}</p>
      </div>
    );
  }

  /** The slot under the finger, from the list's rows (all the same height). */
  function slotAt(y: number): number {
    const list = listRef.current!.getBoundingClientRect();
    const slot = Math.floor(((y - list.top) / list.height) * order.length);
    return Math.min(order.length - 1, Math.max(0, slot));
  }

  function grab(e: ReactPointerEvent<HTMLLIElement>, item: number) {
    if (drag) return;
    // Capture on the list, which never moves: the row itself changes place under the finger.
    listRef.current!.setPointerCapture(e.pointerId);
    const row = e.currentTarget.getBoundingClientRect();
    setDrag({ item, pointerId: e.pointerId, y: e.clientY, grab: e.clientY - row.top });
    navigator.vibrate?.(15);
  }

  function move(e: ReactPointerEvent<HTMLOListElement>) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    setDrag({ ...drag, y: e.clientY });
    const to = slotAt(e.clientY - drag.grab + rowHeight() / 2);
    const from = order.indexOf(drag.item);
    if (to !== from) setOrder(moveItem(order, from, to));
  }

  function drop(e: ReactPointerEvent<HTMLOListElement>) {
    if (drag && e.pointerId === drag.pointerId) setDrag(null);
  }

  function rowHeight(): number {
    const list = listRef.current!.getBoundingClientRect();
    return list.height / order.length;
  }

  const listTop = listRef.current?.getBoundingClientRect().top ?? 0;
  return (
    <div className={styles.column}>
      <p className={styles.phonePrompt}>{question.prompt}</p>
      <p className={styles.hint}>{ui === 'drag' ? t.orderHint : t.orderHintArrows}</p>
      <p className={styles.orderEnd}>▲ {t.orderEarliest}</p>
      <ol
        ref={listRef}
        className={`${styles.orderList} ${ui === 'drag' ? styles.orderDraggable : ''}`}
        onPointerMove={ui === 'drag' ? move : undefined}
        onPointerUp={ui === 'drag' ? drop : undefined}
        onPointerCancel={ui === 'drag' ? drop : undefined}
        onLostPointerCapture={ui === 'drag' ? () => setDrag(null) : undefined}
        data-testid="order-list"
      >
        {order.map((item, slot) => (
          <li
            key={item}
            className={`${styles.orderItem} ${drag?.item === item ? styles.orderPlaceholder : ''}`}
            style={{ background: optionTile(item).bg, color: optionTile(item).fg } as CSSProperties}
            onPointerDown={ui === 'drag' ? (e) => grab(e, item) : undefined}
            data-testid={`order-item-${slot}`}
            data-item={item}
          >
            <span className={styles.orderSlot}>{slot + 1}.</span>
            <span className={styles.choiceLetter}>{letterOf(item)}</span>
            <span className={styles.orderText}>{items[item]}</span>
            {ui === 'drag' ? (
              <span className={styles.orderHandle} aria-hidden="true">
                ⋮⋮
              </span>
            ) : (
              <span className={styles.orderArrows}>
                <button
                  className={styles.orderArrow}
                  disabled={slot === 0}
                  onClick={() => setOrder(moveItem(order, slot, slot - 1))}
                  aria-label={t.orderMoveUp}
                  data-testid={`order-up-${slot}`}
                >
                  ▲
                </button>
                <button
                  className={styles.orderArrow}
                  disabled={slot === order.length - 1}
                  onClick={() => setOrder(moveItem(order, slot, slot + 1))}
                  aria-label={t.orderMoveDown}
                  data-testid={`order-down-${slot}`}
                >
                  ▼
                </button>
              </span>
            )}
          </li>
        ))}
        {drag && (
          <li
            className={`${styles.orderItem} ${styles.orderGhost}`}
            style={{ background: optionTile(drag.item).bg, color: optionTile(drag.item).fg, top: drag.y - listTop - drag.grab } as CSSProperties}
            aria-hidden="true"
          >
            <span className={styles.orderSlot} />
            <span className={styles.choiceLetter}>{letterOf(drag.item)}</span>
            <span className={styles.orderText}>{items[drag.item]}</span>
            <span className={styles.orderHandle}>⋮⋮</span>
          </li>
        )}
      </ol>
      <p className={styles.orderEnd}>▼ {t.orderLatest}</p>
      <button className={styles.primary} onClick={() => void submit()} disabled={drag !== null} data-testid="order-done">
        {t.orderDone}
      </button>
    </div>
  );
}

/** A read-only order: the player's, once sent. */
export function OrderList({ items, order, marks }: { items: string[]; order: number[]; marks?: boolean[] }) {
  return (
    <ol className={styles.orderList}>
      {order.map((item, slot) => (
        <li
          key={item}
          className={`${styles.orderItem} ${marks ? (marks[slot] ? styles.orderRight : styles.orderWrong) : ''}`}
          style={{ background: optionTile(item).bg, color: optionTile(item).fg } as CSSProperties}
        >
          <span className={styles.orderSlot}>{slot + 1}.</span>
          <span className={styles.choiceLetter}>{letterOf(item)}</span>
          <span className={styles.orderText}>{items[item]}</span>
        </li>
      ))}
    </ol>
  );
}
