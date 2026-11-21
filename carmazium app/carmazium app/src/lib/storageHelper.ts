import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

const MAX_BYTES = 2 * 1024 * 1024; // Shared browser/native vehicle-photo upload limit
const MAX_IMAGE_EDGE = 1920; // Preserve legible damage/number-plate details
const MIN_JPEG_QUALITY = 0.72;
const JPEG_QUALITIES = [0.86, 0.79, MIN_JPEG_QUALITY] as const;

/**
 * Convert a phone photo to a metadata-free JPEG and enforce the upload limit.
 *
 * - Always re-encode (to remove GPS/EXIF from small photos too).
 * - Try high-quality encoding before reducing dimensions.
 * - Re-process the ORIGINAL, never repeatedly recompress the last JPEG.
 * - Resize only if needed, preserving the aspect ratio and keeping up to 1920px.
 * - Reject rather than silently upload an oversized or zero-byte result.
 *
 * Physical iOS HEIC/Android JPEG sharpness and orientation require device QA
 * before this is included in the published APK.
 */
export async function convertAndCompress(uri: string): Promise<string> {
  if (!uri) throw new Error('Please select a photo before uploading.');

  let originalWidth = 0;
  let originalHeight = 0;
  let previousSize = '';

  // First attempt retains the original dimensions at high JPEG quality.
  // Capture the oriented output dimensions for aspect-ratio-safe fallback.
  const first = await ImageManipulator.manipulateAsync(uri, [], {
    compress: JPEG_QUALITIES[0],
    format: ImageManipulator.SaveFormat.JPEG,
  });
  originalWidth = first.width;
  originalHeight = first.height;
  const initialInfo = await FileSystem.getInfoAsync(first.uri);
  const initialSize = (initialInfo as { size?: number }).size;
  if (initialInfo.exists && typeof initialSize === 'number' && initialSize > 0 && initialSize <= MAX_BYTES) {
    return first.uri;
  }
  if (!originalWidth || !originalHeight) {
    throw new Error('Could not read this photo’s dimensions. Please try a JPEG image.');
  }

  const longestEdge = Math.max(originalWidth, originalHeight);
  for (const edgeLimit of [longestEdge, MAX_IMAGE_EDGE, 1600, 1440, 1280]) {
    const scale = Math.min(1, edgeLimit / longestEdge);
    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));
    const dimensions = `${width}x${height}`;
    if (dimensions === previousSize) continue;
    previousSize = dimensions;

    const actions: ImageManipulator.Action[] = scale < 1
      ? [{ resize: { width, height } }]
      : [];
    for (const quality of JPEG_QUALITIES) {
      if (scale === 1 && quality === JPEG_QUALITIES[0]) continue; // Already tried above.
      const output = await ImageManipulator.manipulateAsync(uri, actions, {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      const info = await FileSystem.getInfoAsync(output.uri);
      const size = (info as { size?: number }).size;
      if (info.exists && typeof size === 'number' && size > 0 && size <= MAX_BYTES) {
        return output.uri;
      }
    }
  }

  throw new Error('This photo could not be compressed below 2 MB while preserving useful detail. Please choose a smaller photo.');
}

/**
 * Upload a local file to Supabase Storage using the ArrayBuffer method.
 * This is the production-correct approach for React Native — the fetch→blob
 * pattern silently produces 0-byte files on Android.
 *
 * Returns the public URL of the uploaded file.
 *
 * @param localUri   - file:// URI from ImagePicker or ImageManipulator
 * @param bucket     - Supabase Storage bucket name. Listing/KYC/handover media
 *                     currently share the public 'listings' bucket; callers must
 *                     keep the authenticated user ID as the first path segment.
 * @param path       - destination path within bucket (e.g. 'userId/category/filename.jpg')
 * @param contentType - MIME type (default: 'image/jpeg')
 */
export async function uploadToStorage(
  localUri: string,
  bucket: string,
  path: string,
  contentType: string = 'image/jpeg',
): Promise<string> {
  if (process.env.EXPO_PUBLIC_QA_READ_ONLY === '1') {
    throw new Error('QA_READ_ONLY: Photo uploads/deletions are disabled in this visual review build.');
  }
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
      // Paths are timestamped/unique. Avoid upsert so client uploads never
      // require UPDATE permission on Storage objects.
      upsert: false,
    });

  if (error) throw error;

  // 4. Get public URL — getPublicUrl is synchronous (no error field)
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}


/**
 * Upload a local file through a short-lived Supabase signed upload token.
 * Unlike uploadToStorage(), this does not expose or return a public URL.
 */
export async function uploadToSignedStorage(
  localUri: string,
  bucket: string,
  path: string,
  token: string,
  contentType: string = 'image/jpeg',
): Promise<void> {
  if (process.env.EXPO_PUBLIC_QA_READ_ONLY === '1') {
    throw new Error('QA_READ_ONLY: Photo uploads/deletions are disabled in this visual review build.');
  }
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const arrayBuffer = decode(base64);

  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(path, token, arrayBuffer, {
      contentType,
    });

  if (error) throw error;
}


/**
 * Delete an owner-scoped vehicle photo by its public Storage URL.
 * Presentation/category metadata lives in the URL fragment and is stripped
 * before resolving the underlying object path.
 */
export async function deletePublicStorageObject(
  publicUrl: string,
  bucket: string = 'listings',
): Promise<void> {
  if (process.env.EXPO_PUBLIC_QA_READ_ONLY === '1') {
    throw new Error('QA_READ_ONLY: Photo uploads/deletions are disabled in this visual review build.');
  }
  const cleanUrl = publicUrl.split('#')[0];
  const marker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = cleanUrl.indexOf(marker);

  if (markerIndex < 0) {
    throw new Error('This photo is not a valid CarMazium storage URL.');
  }

  const objectPath = decodeURIComponent(cleanUrl.slice(markerIndex + marker.length));
  const [ownerSegment, categorySegment] = objectPath.split('/');
  const allowedFolders = new Set(['vehicle', 'exterior', 'interior', 'damage']);

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user?.id) {
    throw new Error('Please sign in before deleting vehicle photos.');
  }

  if (
    ownerSegment !== authData.user.id
    || !categorySegment
    || !allowedFolders.has(categorySegment)
  ) {
    throw new Error('Only your own vehicle photos can be deleted from this device.');
  }

  const { error } = await supabase.storage.from(bucket).remove([objectPath]);
  if (error) throw error;
}
