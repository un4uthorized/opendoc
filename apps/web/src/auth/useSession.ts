import { useEffect, useState } from 'react';
import { getMe, type Me } from './api';

/** One request per page load, shared by every component that asks. */
let pending: Promise<Me | null> | undefined;

/**
 * The signed-in session: undefined while loading, null when signed out. Pages that need someone
 * signed in send everyone else back to "/", which shows the login.
 */
export function useSession({ required = false } = {}) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    pending ??= getMe().catch(() => null);
    pending.then((result) => {
      if (!active) return;
      if (required && result?.stage !== 'active') {
        window.location.replace('/');
        return;
      }
      setMe(result);
    });
    return () => { active = false; };
  }, [required]);
  return me;
}
