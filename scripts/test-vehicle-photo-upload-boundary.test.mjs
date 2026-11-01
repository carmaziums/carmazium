import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import ts from "typescript"
import vm from "node:vm"

const read = path => fs.readFileSync(new URL("../"+path,import.meta.url),"utf8")
const uploader = read("src/lib/supabase.ts")
const codec = read("src/lib/vehiclePhotoCompression.ts")

function createClientImageHarness() {
  let encodes = 0
  let imgLoads = 0
  let revoked = 0
  class FakeFile {
    constructor(parts,name,options={}) {
      this.name=name
      this.type=options.type??""
      this.size=parts.reduce((sum,x)=>sum+(x.size??x.length??0),0)
      this.lastModified=options.lastModified??0
    }
  }
  const fakeDocument = {
    createElement(tag) {
      if(tag==="img") {
        const image={naturalWidth:4000,naturalHeight:3000,onload:null,onerror:null,
          removeAttribute(){}}
        Object.defineProperty(image,"src",{set() {imgLoads++;queueMicrotask(()=>image.onload?.())}})
        return image
      }
      if(tag==="canvas") return {
        width:0,height:0,
        getContext(){return {fillRect(){},drawImage(){},set fillStyle(_){}}},
        toBlob(cb,mime,quality){encodes++;cb(new Blob([new Uint8Array(240000)],{type:mime}))},
      }
      throw new Error("Unexpected element "+tag)
    },
  }
  const mod={exports:{}}
  const compiled=ts.transpileModule(codec,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true})
  assert.equal(compiled.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0)
  vm.runInNewContext(compiled.outputText,{exports:mod.exports,module:mod,Blob,File:FakeFile,WeakSet,URL:{
    createObjectURL:()=>"blob:mock",
    revokeObjectURL:()=>{revoked++},
  },document:fakeDocument,console,queueMicrotask})
  return {ensure:mod.exports.ensurePreparedVehiclePhoto,FakeFile,getCounts:()=>({encodes,imgLoads,revoked})}
}

test("oversized PNG is converted to JPEG at final upload boundary and already-sanitised photo is not recompressed",async()=>{
  const h=createClientImageHarness()
  const incoming=new h.FakeFile([new Uint8Array(3500000)],"damage.png",{type:"image/png"})
  const prepared=await h.ensure(incoming)
  assert.equal(prepared.type,"image/jpeg")
  assert.match(prepared.name,/\.jpg$/)
  assert.ok(prepared.size>0 && prepared.size<=2*1024*1024)
  assert.notEqual(prepared,incoming)
  assert.equal(await h.ensure(prepared),prepared)
  assert.deepEqual(h.getCounts(),{encodes:1,imgLoads:1,revoked:1})
})

test("small untrusted JPEG is still re-encoded to remove possible GPS/EXIF",async()=>{
  const h=createClientImageHarness()
  const photo=new h.FakeFile([new Uint8Array(180000)],"original.jpg",{type:"image/jpeg"})
  const safe=await h.ensure(photo)
  assert.notEqual(photo,safe)
  assert.equal(safe.type,"image/jpeg")
  assert.equal(h.getCounts().encodes,1)
})

test("shared browser storage upload restricts conversion to vehicle folders, including default vehicle",()=>{
  assert.match(uploader,/const imageFolder = folder\?\.replace\(/)
  assert.match(uploader,/const vehiclePhoto = bucket === 'listings'/)
  for(const folder of ["'vehicle'","'exterior'","'interior'","'damage'"])
    assert.ok(uploader.includes(folder),folder)
  assert.match(uploader,/ensurePreparedVehiclePhoto\(file\)/)
  assert.match(uploader,/directUploadToSupabase\(uploadFile, bucket, fileName\)/)
  assert.match(uploader,/const fileExt = uploadFile\.name/)
  assert.match(uploader,/: file;/)
  assert.match(uploader,/const userId = await getAuthenticatedUserId\(\)/)
  assert.match(uploader,/effectiveFolder = \`\$\{userId\}\/\$\{effectiveFolder \|\| 'vehicle'\}\`/)
})

test("the existing listing wizard still prepares images before upload, and documents stay outside the scope",()=>{
  const wizard=read("src/components/listing/ImageUpload.tsx")
  assert.match(wizard,/const preparedFile = await prepareImageForUpload\(file\)/)
  assert.match(wizard,/uploadImage\(preparedFile, 'listings', activeTab\.toLowerCase\(\)\)/)
  assert.ok(!uploader.includes("bucket === 'hpi' &&"))
  assert.match(codec,/WeakSet<File>/)
  assert.match(codec,/preparedVehicleFiles\.add\(prepared\)/)
})
