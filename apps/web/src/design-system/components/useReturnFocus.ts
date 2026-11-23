import { useRef } from 'react';

interface AutoFocusHandlers {
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

/**
 * Radix returns focus to <Dialog.Trigger> on close. Dialogs opened another way (a shortcut, a
 * button outside the Root, a controlled `open`) have no trigger, so focus would fall to <body>.
 * This remembers what was focused when the dialog opened and returns focus there.
 */
export function useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus }: AutoFocusHandlers = {}) {
  const previous = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      // Runs before Radix moves focus inside, so activeElement is still the opener.
      previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event);
      if (event.defaultPrevented) return;
      const target = previous.current;
      if (target && target !== document.body && target.isConnected) {
        event.preventDefault();
        target.focus({ preventScroll: true });
      }
    },
  };
}
