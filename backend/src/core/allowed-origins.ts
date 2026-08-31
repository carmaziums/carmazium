/**
 * The single list of browser origins allowed to talk to this API.
 *
 * WHY THIS EXISTS: this list was maintained in four places — main.ts (HTTP
 * CORS) and the three WebSocket gateways — and they drifted. main.ts had been
 * updated with the real domains, but all three gateways still allowed only
 * `localhost`, the decommissioned `carmazium.vercel.app`, and a stale Fly
 * hostname. None of them allowed `www.carmazium.com`, which is where the site
 * actually runs, so live auction bidding, chat and real-time notifications
 * were all making cross-origin socket connections the server never listed.
 *
 * One list, imported everywhere, so HTTP and WebSocket policy cannot disagree
 * again. Add a domain here and every transport picks it up.
 *
 * `carmazium.vercel.app` is deliberately retained: it costs nothing to keep a
 * dead origin allowed, and removing it is a different kind of risk than the
 * FRONTEND_URL fix — that one *redirected* customers to a dead host, whereas
 * this merely permits requests from one.
 */
const CORE_ORIGINS = [
    'http://localhost:3000',
    'https://carmazium.com',
    'https://www.carmazium.com',
    'https://carmazium-two.vercel.app',
    'https://carmazium.vercel.app',
    'https://carmazium.fly.dev',
    'https://carmazium-hjoh9w.fly.dev',
];

/**
 * Extra origins from ALLOWED_ORIGINS (comma-separated), so a new preview or
 * domain can be permitted without a redeploy.
 */
export function getAllowedOrigins(): string[] {
    const extra = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
        : [];
    return [...new Set([...CORE_ORIGINS, ...extra])];
}

/** Ready-made CORS config for the WebSocket gateways. */
export const WS_CORS = {
    origin: getAllowedOrigins(),
    credentials: true,
};
