import { supabase } from './supabase';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

/** Supabase 2.107 holds its auth lock while notifying subscribers. Returning
 * immediately lets getSession/signOut run after that lock has been released. */
export function subscribeDeferredAuthChanges(
  handler: (event: AuthChangeEvent, session: Session | null) => void | Promise<void>,
): () => void {
  let active = true;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!active) return;
      // Do not put session/token contents into diagnostics.
      void Promise.resolve().then(() => { if (active) return handler(event, session); }).catch(() => {
        console.warn('Auth event processing failed');
      });
    }, 0);
    timers.add(timer);
  });
  return () => {
    active = false;
    subscription.unsubscribe();
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  };
}
