import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open overlays, oldest first; only the last one reacts to Esc and Tab. */
const overlayStack: object[] = [];

export interface DialogBehaviorOptions {
  readonly active: boolean;
  readonly onClose: () => void;
}

/**
 * Shared overlay behaviour: Esc closes, Tab and Shift+Tab stay inside the container, focus moves
 * in when the overlay opens and returns to the previously focused element when it closes.
 */
export function useDialogBehavior(
  containerRef: RefObject<HTMLElement | null>,
  { active, onClose }: DialogBehaviorOptions,
): void {
  // Callers pass inline arrows; keeping the latest in a ref stops a parent re-render from
  // re-running the effect (which would move focus back to the opener and then to Close).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const token = {};
    overlayStack.push(token);
    const previous = document.activeElement;
    focusInto(containerRef.current);

    function handleKeyDown(event: KeyboardEvent): void {
      if (overlayStack[overlayStack.length - 1] !== token) {
        return;
      }
      if (event.key === 'Escape') {
        onCloseRef.current();

        return;
      }
      if (event.key === 'Tab') {
        trapTab(event, containerRef.current);
      }
    }
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      overlayStack.splice(overlayStack.indexOf(token), 1);
      if (previous instanceof HTMLElement) {
        previous.focus();
      }
    };
  }, [active, containerRef]);
}

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
}

function focusInto(container: HTMLElement | null): void {
  if (container === null) {
    return;
  }
  const [first] = focusableIn(container);
  if (first === undefined) {
    container.focus();
  } else {
    first.focus();
  }
}

function trapTab(event: KeyboardEvent, container: HTMLElement | null): void {
  if (container === null) {
    return;
  }
  const items = focusableIn(container);
  const first = items[0];
  const last = items[items.length - 1];
  if (first === undefined || last === undefined) {
    event.preventDefault();
    container.focus();

    return;
  }
  const current = document.activeElement;
  if (event.shiftKey && (current === first || !container.contains(current))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (current === last || !container.contains(current))) {
    event.preventDefault();
    first.focus();
  }
}
