import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables - Image upload will fail');
}

export const supabase = createClient(supabaseUrl || 'https://missing-url.supabase.co', supabaseAnonKey || 'missing-key');

/**
 * Get the current access token from the Supabase session.
 *
 * IMPORTANT: Do NOT read from localStorage.authToken here. That key is written
 * by AuthContext on every auth event and is shared across all browser tabs,
 * meaning a second tab logging in as a different account would overwrite it and
 * cause every tab to send the wrong user's Bearer token to the backend.
 *
 * The Supabase SDK is the authoritative source — getSession() returns the token
 * for the user who authenticated in this SDK instance.
 */
export async function getAccessToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    // Fast path: read the token synchronously from localStorage.
    // If it's still fresh (> 60 s before expiry) we skip the network call entirely.
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
        if (match?.[1]) {
            const raw = localStorage.getItem(`sb-${match[1]}-auth-token`);
            if (raw) {
                const parsed = JSON.parse(raw);
                const expiresAt: number = parsed?.expires_at ?? 0;
                if (parsed?.access_token && Date.now() / 1000 < expiresAt - 60) {
                    return parsed.access_token;
                }
            }
        }
    } catch { /* ignore */ }

    // Slow path: ask the SDK to refresh the session.
    // Race against a 4 s ceiling — supabase.auth.getSession() makes a network
    // request and can hang indefinitely if the auth server is unreachable.
    try {
        const result = await Promise.race([
            supabase.auth.getSession(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
        ]);
        if (result && 'data' in result) {
            if (result.data.session?.access_token) return result.data.session.access_token;
        }
    } catch (e) {
        console.warn('getAccessToken: getSession() failed:', e);
    }

    return null;
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

    const token = await getAccessToken();
    const authHeader = token
        ? `Bearer ${token}`
        : `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`;

    // AbortSignal.timeout() was added in Chrome 103 / Safari 16 / Firefox 100.
    // Use a manual AbortController as a polyfill for older browsers.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Upload timed out after 15 s')), 15000);

    let response: Response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                'Content-Type': file.type || 'application/octet-stream',
                'x-upsert': 'true',
                'Cache-Control': 'max-age=3600',
            },
            body: file,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Upload failed (${response.status}): ${errorBody || response.statusText}`);
    }

    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}`;
}

/**
 * Upload an image/document to Supabase Storage.
 * Uses the existing 'listings' bucket by default (already configured and public).
 * Pass a folder prefix (e.g. 'kyc') to organise files in sub-paths within the bucket.
 *
 * @param file   - The file to upload
 * @param bucket - The storage bucket name (default: 'listings')
 * @param folder - Optional sub-folder path inside the bucket (e.g. 'kyc', 'handover/123')
 * @returns Public URL of the uploaded file
 */
export async function uploadImage(
    file: File,
    bucket: string = 'listings',
    folder?: string
): Promise<string> {
    // Check if initialized properly
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment variables.');
    }

    // Generate unique filename: timestamp-uuid.ext
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const baseName = `${timestamp}-${randomId}.${fileExt}`;
    // Prepend folder prefix if provided (e.g. 'kyc/1234567-abc.jpg')
    const fileName = folder ? `${folder.replace(/\/+$/, '')}/${baseName}` : baseName;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const publicUrl = await directUploadToSupabase(file, bucket, fileName);
            return publicUrl;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));

            const perm = isPermanentError(lastError);
            if (perm.permanent) throw new Error(perm.message);

            if (attempt === 0) {
                console.warn(`[Upload] Attempt 1 failed, retrying: ${lastError.message}`);
                await new Promise(r => setTimeout(r, 1500));
            }
        }
    }

    throw new Error(
        'Upload failed after 2 attempts. Check your connection and try again. (' + lastError?.message + ')'
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
