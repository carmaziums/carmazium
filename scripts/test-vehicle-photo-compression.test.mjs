// Regression guards for client-side photo optimisation before Supabase Storage upload.
// These source-level tests do not replace real-device image-quality QA.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = file => readFileSync(new URL("../" + file, import.meta.url), "utf8")
const compressor = read("src/lib/vehiclePhotoCompression.ts")
const listing = read("src/components/listing/ImageUpload.tsx")
const damage = read("src/components/listing/VehicleDamageMapper.tsx")
const admin = read("src/components/dashboard/ListingEditModal.tsx")

test("pre-upload preparation targets 2MB with readable detail and HEIC support", () => {
    assert.match(compressor, /TARGET_UPLOAD_SIZE = 2 \* 1024 \* 1024/)
    assert.match(compressor, /MAX_IMAGE_EDGE = 1920/)
    assert.match(compressor, /\[MAX_IMAGE_EDGE, 1600, 1440, 1280\]/)
    assert.match(compressor, /MIN_JPEG_QUALITY = 0\.72/)
    assert.match(compressor, /heic2any/)
    assert.match(compressor, /alreadyOptimised && Math\.max\(width, height\) <= MAX_IMAGE_EDGE/)
    assert.match(compressor, /URL\.revokeObjectURL\(objectUrl\)/)
    assert.match(compressor, /if \(blob\.size <= TARGET_UPLOAD_SIZE\)/)
    assert.match(compressor, /throw new Error\(\x60\$\{sourceFile\.name\}: The photo could not be optimised below 2MB/)
})

test("all three web vehicle photo upload paths prepare smaller files first", () => {
    assert.match(listing, /const preparedFile = await prepareImageForUpload\(file\)/)
    assert.match(listing, /await uploadImage\(preparedFile, 'listings', activeTab\.toLowerCase\(\)\)/)
    assert.match(damage, /const preparedFile = await prepareImageForUpload\(file\)/)
    assert.match(damage, /await uploadImage\(preparedFile, "listings", "damage"\)/)
    assert.match(admin, /const preparedFile = await prepareImageForUpload\(file\)/)
    assert.match(admin, /await uploadImage\(preparedFile, 'listings', 'admin-edit'\)/)
    assert.doesNotMatch(damage, /await uploadImage\(file, "listings", "damage"\)/)
    assert.doesNotMatch(admin, /await uploadImage\(file, 'listings', 'admin-edit'\)/)
})

test("existing upload permissions and conservative source limits remain", () => {
    assert.match(listing, /MAX_SOURCE_FILE_SIZE/)
    assert.match(damage, /file\.size > 15 \* 1024 \* 1024/)
    assert.match(compressor, /MAX_SOURCE_FILE_SIZE = 50 \* 1024 \* 1024/)
    assert.match(compressor, /canvas\.toBlob/)
    assert.match(compressor, /canvas\.getContext\('2d'\)/)
    assert.match(compressor, /type: 'image\/jpeg'/)
})
