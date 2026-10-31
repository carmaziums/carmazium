// Regression guards for client-side photo optimisation before Supabase Storage upload.
// These source-level tests do not replace real-device image-quality QA.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { Blob } from "node:buffer"
import vm from "node:vm"
import ts from "typescript"

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
    // Small photos must not bypass re-encoding: EXIF may carry GPS coordinates.
    assert.doesNotMatch(compressor, /return sourceFile/)
    assert.match(compressor, /EXIF headers in small JPEGs/)
    assert.match(compressor, /image\.removeAttribute\('src'\)/)
    assert.match(compressor, /canvas\.width = 0/)
    assert.match(compressor, /canvas\.height = 0/)
    assert.match(compressor, /finally \{\s*\/\/ Safari may retain canvas backing stores/)
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


/**
 * Run the actual TypeScript image helper with lightweight browser objects.
 * This checks the sequence of decoding, canvas re-encoding and cleanup;
 * real JPEG sharpness still requires real-device visual tests.
 */
function imageHarness({ width = 1200, height = 900, failEncode = false, largeFirstCanvas = false } = {}) {
    const js = ts.transpileModule(compressor, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText
    const canvases = []
    const images = []
    const revoked = []
    let canvasCalls = 0

    class TestFile extends Blob {
        constructor(parts, name, options = {}) {
            super(parts, { type: options.type })
            this.name = name
            this.lastModified = options.lastModified ?? 0
        }
    }
    const document = {
        createElement(tag) {
            if (tag === "img") {
                const img = {
                    naturalWidth: width,
                    naturalHeight: height,
                    onload: null,
                    onerror: null,
                    removed: false,
                    set src(url) {
                        this._src = url
                        queueMicrotask(() => this.onload?.())
                    },
                    removeAttribute(key) {
                        if (key === "src") this.removed = true
                    },
                }
                images.push(img)
                return img
            }
            assert.equal(tag, "canvas")
            const canvas = {
                width: 0,
                height: 0,
                getContext() {
                    return { fillRect() {}, drawImage() {}, set fillStyle(value) {} }
                },
                toBlob(cb, mime, quality) {
                    canvasCalls++
                    assert.equal(mime, "image/jpeg")
                    assert.ok(quality >= 0.72)
                    if (failEncode) return cb(null)
                    // Force the first resolution through multiple quality attempts.
                    const oversized = largeFirstCanvas && this.width >= 1920
                    cb(oversized
                        ? new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: mime })
                        : new Blob(["CANVAS_PIXELS_NO_EXIF"], { type: mime }))
                }
            }
            canvases.push(canvas)
            return canvas
        }
    }
    const module = { exports: {} }
    vm.runInNewContext(js, {
        module, exports: module.exports, File: TestFile, Blob,
        document, console, Promise, URL: {
            createObjectURL() { return "blob:vehicle" },
            revokeObjectURL(url) { revoked.push(url) },
        },
    })
    return {
        TestFile,
        prepare: module.exports.prepareImageForUpload,
        canvases, images, revoked,
        get canvasCalls() { return canvasCalls },
    }
}

test("small JPEGs are re-encoded instead of publishing original GPS EXIF metadata", async () => {
    const h = imageHarness()
    const original = new h.TestFile(["SENSITIVE_EXIF_GPS=52.0,-1.8"], "seller.jpeg", {
        type: "image/jpeg", lastModified: 123,
    })
    const output = await h.prepare(original)
    assert.notEqual(output, original)
    assert.equal(output.name, "seller.jpg")
    assert.equal(output.type, "image/jpeg")
    assert.equal(output.lastModified, original.lastModified)
    assert.equal(await output.text(), "CANVAS_PIXELS_NO_EXIF")
    assert.ok(h.canvasCalls >= 1)
    assert.equal(h.canvases[0].width, 0)
    assert.equal(h.canvases[0].height, 0)
    assert.equal(h.images[0].removed, true)
    assert.equal(h.images[0].onload, null)
    assert.deepEqual(h.revoked, ["blob:vehicle"])
})

test("a high-resolution image releases each canvas before the smaller fallback succeeds", async () => {
    const h = imageHarness({ width: 3000, height: 2000, largeFirstCanvas: true })
    const result = await h.prepare(new h.TestFile(["high-res"], "car.png", { type: "image/png" }))
    assert.equal(result.name, "car.jpg")
    assert.ok(h.canvases.length >= 2, "should retry below 1920px")
    assert.ok(h.canvases.every(c => c.width === 0 && c.height === 0))
    assert.equal(h.images[0].removed, true)
    assert.equal(h.revoked.length, 1)
})

test("canvas errors still release decoded image, canvas and object URL", async () => {
    const h = imageHarness({ failEncode: true })
    await assert.rejects(
        () => h.prepare(new h.TestFile(["jpeg"], "car.jpg", { type: "image/jpeg" })),
        /Could not prepare this photo for upload/,
    )
    assert.equal(h.canvases[0].width, 0)
    assert.equal(h.canvases[0].height, 0)
    assert.equal(h.images[0].removed, true)
    assert.deepEqual(h.revoked, ["blob:vehicle"])
})
