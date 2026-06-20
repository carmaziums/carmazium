import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

const MAX_BYTES = 1.2 * 1024 * 1024; // 1.2 MB conservative target (actual cap is 1.5 MB)
const MAX_ITERATIONS = 6;

/**
 * Convert a local image URI to JPEG and compress it until it is under 1.2 MB.
 * Returns the URI of the converted/compressed file.
 *
 * Uses manipulateAsync (not the class-based API) for stability on Expo SDK 54.
 */
export async function convertAndCompress(uri: string): Promise<string> {
  let quality = 0.85;
  let currentUri = uri;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const result = await ImageManipulator.manipulateAsync(
      currentUri,
      [], // no resize — preserve original dimensions
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );

    // FileSystem.getInfoAsync returns { exists, uri, size?, ... }
    // We cast to any because the type definition omits the size field
    const info = await FileSystem.getInfoAsync(result.uri);
    const size: number = (info as any).size ?? 0;

    if (size <= MAX_BYTES || i === MAX_ITERATIONS - 1) {
      return result.uri;
    }

    // Reduce quality by 15% each iteration, minimum 0.3
    quality = Math.max(0.3, quality - 0.15);
    currentUri = result.uri;
  }

  return currentUri;
}

/**
 * Upload a local file to Supabase Storage using the ArrayBuffer method.
 * This is the production-correct approach for React Native — the fetch→blob
 * pattern silently produces 0-byte files on Android.
 *
 * Returns the public URL of the uploaded file.
 *
 * @param localUri   - file:// URI from ImagePicker or ImageManipulator
 * @param bucket     - Supabase Storage bucket name (e.g. 'listings', 'kyc-documents')
 * @param path       - destination path within bucket (e.g. 'userId/category/filename.jpg')
 * @param contentType - MIME type (default: 'image/jpeg')
 */
export async function uploadToStorage(
  localUri: string,
  bucket: string,
  path: string,
  contentType: string = 'image/jpeg',
): Promise<string> {
  // 1. Read file as Base64
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // 2. Convert Base64 to ArrayBuffer
  const arrayBuffer = decode(base64);

  // 3. Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, {
      contentType,
      upsert: true,
    });

  if (error) throw error;

  // 4. Get public URL — getPublicUrl is synchronous (no error field)
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}
