/**
 * How Időrend's items are put in order on the phone: dragged with a finger,
 * or moved with ▲▼ buttons. Dragging is the live one; the arrows are the
 * fallback in case dragging misbehaves on some phone. Switch the default
 * here, or try the other on one phone with ?order=arrows (or ?order=drag),
 * which that phone then remembers.
 */
export type OrderUi = 'drag' | 'arrows';

export const ORDER_UI: OrderUi = 'drag';

const KEY = 'trivia.orderUi';

export function orderUi(): OrderUi {
  try {
    const asked = new URLSearchParams(window.location.search).get('order');
    if (asked === 'drag' || asked === 'arrows') {
      localStorage.setItem(KEY, asked);
      return asked;
    }
    const saved = localStorage.getItem(KEY);
    if (saved === 'drag' || saved === 'arrows') return saved;
  } catch {
    // No storage (private mode): the default it is.
  }
  return ORDER_UI;
}

/** `order` with the item at `from` moved to `to`. */
export function moveItem(order: readonly number[], from: number, to: number): number[] {
  const next = [...order];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}
