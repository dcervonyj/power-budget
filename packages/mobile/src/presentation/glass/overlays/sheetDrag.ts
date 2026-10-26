/** A drag of the sheet header closes it past this distance (px) or this speed (px/ms). */
export const DRAG_CLOSE_DISTANCE = 96;
export const DRAG_CLOSE_VELOCITY = 0.6;
const MIN_FLICK_DISTANCE = 24;

/** Downward drag only: an upward pull never moves the sheet. */
export function clampDrag(deltaY: number): number {
  return Math.max(0, deltaY);
}

export function shouldCloseOnDrag(deltaY: number, elapsedMs: number): boolean {
  const distance = clampDrag(deltaY);
  if (distance >= DRAG_CLOSE_DISTANCE) {
    return true;
  }

  return (
    elapsedMs > 0 && distance >= MIN_FLICK_DISTANCE && distance / elapsedMs >= DRAG_CLOSE_VELOCITY
  );
}
