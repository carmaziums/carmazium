import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables - Image upload will fail');
}

export const supabase = createClient(supabaseUrl || 'https://missing-url.supabase.co', supabaseAnonKey || 'missing-key');

/**
 * Get the current access token from the Supabase session
 * @returns The access token or null if not authenticated
 */
export async function getAccessToken(): Promise<string | null> {
    // Try localStorage first for immediate availability
    const localToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (localToken) return localToken;

    const { data: { session } } = await supabase.auth.getSession();
    const sessionToken = session?.access_token || null;

    // Sync storage if session found it but local didn't
    if (sessionToken && typeof window !== 'undefined') {
        localStorage.setItem('authToken', sessionToken);
    }

    return sessionToken;
}


/**
 * Upload an image to Supabase Storage
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

    // Try upload with retry logic
    let lastError: Error | null = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false,
                });

            if (error) {
                // Handle specific error cases
                if (error.message.includes('Bucket not found')) {
                    throw new Error(`Storage bucket "${bucket}" not found. Please create it in Supabase Dashboard.`);
                }
                if (error.message.includes('row-level security') || error.message.includes('policy')) {
                    throw new Error('Permission denied. Please check Supabase storage bucket RLS policies.');
                }
                if (error.message.includes('signal is aborted')) {
                    // Retry on signal abort
                    if (attempt < maxRetries) {
                        console.warn(`Upload attempt ${attempt + 1} failed, retrying...`);
                        await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // Exponential backoff
                        continue;
                    }
                    throw new Error('Upload was interrupted. Please check your internet connection and try again.');
                }
                throw new Error(`Failed to upload image: ${error.message}`);
            }

            // Get public URL
            const { data: publicUrlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(data.path);

            return publicUrlData.publicUrl;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt >= maxRetries) {
                throw lastError;
            }
        }
    }

    throw lastError || new Error('Upload failed after retries');
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
