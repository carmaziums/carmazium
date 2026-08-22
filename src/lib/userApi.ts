import { apiClient } from './apiClient'

/**
 * Permanently deletes (soft-delete + anonymize) the current user's account.
 * Requires the literal word "DELETE" as a deliberate-action confirmation —
 * the backend rejects anything else.
 */
export async function deleteAccount(confirmation: string): Promise<{ success: boolean }> {
    return apiClient<{ success: boolean }>('/users/me', {
        method: 'DELETE',
        body: JSON.stringify({ confirmation }),
    })
}
