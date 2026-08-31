/**
 * The single source of truth for the public site URL.
 *
 * WHY THIS EXISTS: `FRONTEND_URL` was pointing at `https://carmazium.vercel.app`,
 * a deployment that no longer exists. Because every Stripe `success_url` and
 * `cancel_url` is built from it, real customers completed live payments
 * (`cs_live_…`) and landed on a Vercel `DEPLOYMENT_NOT_FOUND` page. Every link
 * in every transactional email pointed there too.
 *
 * The value was wrong in one place, but the damage was spread across six
 * services that each rebuilt the same fallback by hand — and each fell back to
 * either that dead domain or `http://localhost:3000`, neither of which is a
 * safe thing to hand to Stripe in production. Centralising it means there is
 * one line to change, and a bad fallback cannot quietly differ between the
 * checkout flow and the emails that confirm it.
 *
 * The production fallback is the live site rather than localhost on purpose:
 * if the env var ever goes missing again, a customer being sent to the real
 * site is a recoverable annoyance, while being sent to localhost or a dead
 * host means a completed payment with nowhere to land.
 */
const PRODUCTION_FALLBACK = 'https://www.carmazium.com';
const DEVELOPMENT_FALLBACK = 'http://localhost:3000';

/**
 * Known-dead hosts. If the env var still points at one of these we ignore it
 * rather than faithfully sending customers somewhere that 404s — the whole
 * failure mode this module exists to prevent.
 */
const DEAD_HOSTS = ['carmazium.vercel.app'];

export function resolveFrontendUrl(configured?: string | null): string {
    const raw = configured?.trim();

    if (raw) {
        const isDead = DEAD_HOSTS.some((host) => raw.includes(host));
        if (!isDead) {
            // A trailing slash would turn `${base}/checkout/success` into a
            // double-slashed URL, which Stripe accepts and the router does not.
            return raw.replace(/\/+$/, '');
        }
        console.error(
            `FRONTEND_URL points at a decommissioned host (${raw}). ` +
            `Falling back to ${PRODUCTION_FALLBACK} so checkout redirects and ` +
            `email links still reach a live page. Fix the env var.`,
        );
    }

    return process.env.NODE_ENV === 'production' ? PRODUCTION_FALLBACK : DEVELOPMENT_FALLBACK;
}
