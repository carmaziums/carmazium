export type MaziumFailureCode = 'PROVIDER_TRANSIENT' | 'PROVIDER_REJECTED' | 'INVALID_MODEL_OUTPUT' | 'INTERNAL';

/** Coarse diagnostics only: never expose provider bodies, prompts or credentials. */
export function maziumFailureCode(error: unknown): MaziumFailureCode {
    if (error instanceof SyntaxError) return 'INVALID_MODEL_OUTPUT';
    if (!error || typeof error !== 'object') return 'INTERNAL';
    const { status, name } = error as { status?: unknown; name?: unknown };
    if (name === 'APIConnectionError' || name === 'APIConnectionTimeoutError') return 'PROVIDER_TRANSIENT';
    if (typeof status === 'number') {
        if ([408, 409, 429].includes(status) || status >= 500 && status <= 599) return 'PROVIDER_TRANSIENT';
        if (status >= 400 && status <= 499) return 'PROVIDER_REJECTED';
    }
    return 'INTERNAL';
}
