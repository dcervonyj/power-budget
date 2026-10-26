import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const previous = document.activeElement;
    focusInto(containerRef.current);

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();

        return;
      }
      if (event.key === 'Tab') {
        trapTab(event, containerRef.current);
      }
    }
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previous instanceof HTMLElement) {
        previous.focus();
      }
    };
  }, [active, onClose, containerRef]);
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
