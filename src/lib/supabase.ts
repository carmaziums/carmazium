import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables - Image upload will fail');
}

export const supabase = createClient(supabaseUrl || 'https://missing-url.supabase.co', supabaseAnonKey || 'missing-key');

/**
 * Get the current access token from the Supabase session
 * Always prioritizes the fresh Supabase session token to avoid stale tokens
 * @returns The access token or null if not authenticated
 */
export async function getAccessToken(): Promise<string | null> {
    try {
        // Always get fresh token from Supabase session first
        const { data: { session } } = await supabase.auth.getSession();
        const sessionToken = session?.access_token || null;

        if (sessionToken && typeof window !== 'undefined') {
            // Keep localStorage in sync with fresh token
            localStorage.setItem('authToken', sessionToken);
        }

        if (sessionToken) return sessionToken;
    } catch (err) {
        console.warn('Failed to get Supabase session:', err);
    }

    // Fallback to localStorage only if Supabase session fetch fails
    const localToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    return localToken;
}


/**
 * Check if an error is a network/abort-related error that can be retried
 */
function isRetryableError(error: any): boolean {
    if (!error) return false;
    const message = (error.message || error.statusText || String(error)).toLowerCase();
    return (
        message.includes('signal is aborted') ||
        message.includes('aborterror') ||
        message.includes('aborted') ||
        message.includes('network') ||
        message.includes('failed to fetch') ||
        message.includes('load failed') ||
        message.includes('networkerror') ||
        message.includes('timeout') ||
        message.includes('econnreset') ||
        message.includes('econnrefused') ||
        message.includes('socket hang up')
    );
}

/**
 * Check if an error is a permanent/config error that should NOT be retried
 */
function isPermanentError(error: any): { permanent: boolean; message: string } {
    if (!error) return { permanent: false, message: '' };
    const msg = error.message || String(error);
    if (msg.includes('Bucket not found')) {
        return { permanent: true, message: `Storage bucket not found. Please create it in Supabase Dashboard.` };
    }
    if (msg.includes('row-level security') || msg.includes('policy') || msg.includes('Unauthorized') || msg.includes('403')) {
        return { permanent: true, message: 'Permission denied. Please check Supabase storage bucket RLS policies allow uploads.' };
    }
    if (msg.includes('Payload too large') || msg.includes('413')) {
        return { permanent: true, message: 'File is too large. Please reduce the file size and try again.' };
    }
    if (msg.includes('duplicate') || msg.includes('already exists')) {
        return { permanent: true, message: 'A file with this name already exists.' };
    }
    return { permanent: false, message: '' };
}

/**
 * Upload a file directly to Supabase Storage REST API using a plain fetch
 * (bypassing the SDK's internal AbortController which causes premature aborts)
 */
async function directUploadToSupabase(
    file: File,
    bucket: string,
    fileName: string
): Promise<string> {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${fileName}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Content-Type': file.type || 'application/octet-stream',
            'x-upsert': 'false',
            'Cache-Control': 'max-age=3600',
        },
        body: file,
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Direct upload failed (${response.status}): ${errorBody || response.statusText}`);
    }

    // Build public URL
    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}`;
    return publicUrl;
}

/**
 * Upload an image to Supabase Storage
 * Uses the Supabase SDK first. If it fails with an abort/network error,
 * falls back to a direct REST upload that avoids the SDK's internal AbortController.
 *
 * @param file - The file to upload
 * @param bucket - The storage bucket name (default: 'listings')
 * @returns Public URL of the uploaded file
 */
export async function uploadImage(
    file: File,
    bucket: string = 'listings'
): Promise<string> {
    // Check if initialized properly
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment variables.');
    }

    // Generate unique filename: timestamp-uuid-originalname
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${timestamp}-${randomId}.${fileExt}`;

    // ── Strategy 1: Try with Supabase SDK (2 attempts) ──────────────────────
    let sdkAttempts = 0;
    const maxSdkAttempts = 2;
    let lastError: Error | null = null;
    let usedDirectFallback = false;

    for (sdkAttempts = 0; sdkAttempts < maxSdkAttempts; sdkAttempts++) {
        try {
            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false,
                });

            if (error) {
                // Check for permanent errors first
                const perm = isPermanentError(error);
                if (perm.permanent) {
                    throw new Error(perm.message);
                }

                // If it's a retryable error, continue the loop
                if (isRetryableError(error)) {
                    console.warn(`[Upload] SDK attempt ${sdkAttempts + 1} failed (retryable): ${error.message}`);
                    lastError = new Error(error.message);
                    await new Promise(r => setTimeout(r, 1500 * (sdkAttempts + 1)));
                    continue;
                }

                // Unknown SDK error
                throw new Error(`Failed to upload image: ${error.message}`);
            }

            // Success! Get public URL
            const { data: publicUrlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(data.path);

            return publicUrlData.publicUrl;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));

            // Rethrow permanent errors immediately
            const perm = isPermanentError(lastError);
            if (perm.permanent) throw new Error(perm.message);

            // For retryable errors, continue to next SDK attempt or fall through to direct upload
            if (isRetryableError(lastError) && sdkAttempts < maxSdkAttempts - 1) {
                console.warn(`[Upload] SDK attempt ${sdkAttempts + 1} caught error, retrying: ${lastError.message}`);
                await new Promise(r => setTimeout(r, 1500 * (sdkAttempts + 1)));
                continue;
            }
        }
    }

    // ── Strategy 2: Direct REST upload (bypasses SDK AbortController) ───────
    console.warn('[Upload] SDK attempts exhausted. Falling back to direct REST upload...');
    const maxDirectAttempts = 2;

    for (let directAttempt = 0; directAttempt < maxDirectAttempts; directAttempt++) {
        try {
            const publicUrl = await directUploadToSupabase(file, bucket, fileName);
            console.log('[Upload] Direct REST upload succeeded.');
            return publicUrl;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));

            const perm = isPermanentError(lastError);
            if (perm.permanent) throw new Error(perm.message);

            if (directAttempt < maxDirectAttempts - 1) {
                console.warn(`[Upload] Direct attempt ${directAttempt + 1} failed, retrying: ${lastError.message}`);
                await new Promise(r => setTimeout(r, 2000 * (directAttempt + 1)));
            }
        }
    }

    // All strategies exhausted
    throw new Error(
        'Unable to upload image after multiple attempts. ' +
        'This may be caused by a slow or unstable connection. ' +
        'Please try again in a moment, or try uploading a smaller image.'
    );
}


/**
 * Delete an image from Supabase Storage
 * @param publicUrl - The public URL of the image to delete
 * @param bucket - The storage bucket name (default: 'listings')
 */
export async function deleteImage(
    publicUrl: string,
    bucket: string = 'listings'
): Promise<void> {
    // Check if initialized properly
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment variables.');
    }

    // Extract filename from public URL
    const urlParts = publicUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];

    const { error } = await supabase.storage.from(bucket).remove([fileName]);

    if (error) {
        console.error('Delete error:', error);
        throw new Error(`Failed to delete image: ${error.message}`);
    }
}
