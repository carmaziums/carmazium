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
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
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
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}-${randomId}.${fileExt}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
        });

    if (error) {
        console.error('Upload error:', error);
        throw new Error(`Failed to upload image: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
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
