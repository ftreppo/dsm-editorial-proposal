import test from "node:test";
import assert from "node:assert/strict";
import {deflateRawSync} from "node:zlib";
import {readFileSync} from "node:fs";
import {preflight,MAX_INPUT_BYTES,ENGINE_VERSION} from "../docs/preflight-v2b.mjs";

const encoder=new TextEncoder();
const TYPES='<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>';
function sampleXml(options={}) {
 const {a4=true,margin=1000,text="SYNTHETIC_SAMPLE",sections=true}=options;
 const width=a4?"11906":"12240",height=a4?"16838":"15840";
 return '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+
  '<w:p><w:r><w:t>'+text+'</w:t></w:r></w:p>'+
  (sections?'<w:sectPr><w:pgSz w:w="'+width+'" w:h="'+height+'"/>'+
    '<w:pgMar w:top="'+margin+'" w:bottom="'+margin+'" w:left="'+margin+'" w:right="'+margin+'"/></w:sectPr>':'')+
  '</w:body></w:document>';
}
function crc32(data){
 let c=-1;
 for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^(-(c&1)&0xedb88320);}
 return (c^-1)>>>0;
}
function zip(entries) {
 let at=0;
 const locals=[],central=[];
 for(const entry of entries) {
  const nameBytes=Buffer.from(entry.name,"ascii");
  const raw=Buffer.from(entry.value,"utf8");
  const method=entry.method??8,comp=method===0?raw:deflateRawSync(raw);
  const crc=crc32(raw),local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);
  local.writeUInt16LE(20,4);
  local.writeUInt16LE(method,8);
  local.writeUInt32LE(crc,14);
  local.writeUInt32LE(comp.length,18);
  local.writeUInt32LE(raw.length,22);
  local.writeUInt16LE(nameBytes.length,26);
  locals.push(local,nameBytes,comp);
  const c=Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);
  c.writeUInt16LE(method,10);c.writeUInt32LE(crc,16);
  c.writeUInt32LE(comp.length,20);c.writeUInt32LE(raw.length,24);
  c.writeUInt16LE(nameBytes.length,28);c.writeUInt32LE(at,42);
  central.push(c,nameBytes);
  at+=local.length+nameBytes.length+comp.length;
 }
 const cd=Buffer.concat(central),e=Buffer.alloc(22);
 e.writeUInt32LE(0x06054b50,0);
 e.writeUInt16LE(entries.length,8);e.writeUInt16LE(entries.length,10);
 e.writeUInt32LE(cd.length,12);e.writeUInt32LE(at,16);
 return new Uint8Array(Buffer.concat([...locals,cd,e]));
}
function docx(extra=[],xml=sampleXml()) {
 return zip([{name:"[Content_Types].xml",value:TYPES},
   {name:"word/document.xml",value:xml},...extra]);
}
const codes = r => r.findings.map(f=>f.code);

test("engine is browser-only and reports explicit human review",async()=>{
 const r=await preflight(docx(),"DOCX");
 assert.equal(r.engine_version,ENGINE_VERSION);
 assert.equal(r.overall,"REVIEW");
 assert.equal(r.file_type,"DOCX");
 assert.equal(r.checks.page_geometry,"PASS");
 assert.equal(r.checks.text_extractability,"PASS");
 assert.equal(r.checks.document_structure,"NOT_TESTED");
 assert.equal(r.checks.visual_rendering,"NOT_TESTED");
 assert.equal(r.checks.pdf_ua_accessibility,"NOT_TESTED");
});
test("valid stored zip members also supported",async()=>{
 const r=await preflight(zip([
  {name:"[Content_Types].xml",value:TYPES,method:0},
  {name:"word/document.xml",value:sampleXml(),method:0}
 ]),"DOCX");
 assert.equal(r.overall,"REVIEW");assert.equal(r.checks.page_geometry,"PASS");
});
test("non A4 sections require review",async()=>{
 const r=await preflight(docx([],sampleXml({a4:false})),"DOCX");
 assert.ok(codes(r).includes("DOCX_A4_REVIEW"));
 assert.equal(r.checks.page_geometry,"REVIEW");
});
test("narrow margins require review",async()=>{
 const r=await preflight(docx([],sampleXml({margin:400})),"DOCX");
 assert.ok(codes(r).includes("DOCX_NARROW_MARGINS"));
});
test("missing section metadata requires review",async()=>{
 const r=await preflight(docx([],sampleXml({sections:false})),"DOCX");
 assert.ok(codes(r).includes("DOCX_A4_REVIEW"));
 assert.equal(r.overall,"REVIEW");
});
test("no text runs is review",async()=>{
 const r=await preflight(docx([],sampleXml({text:""})),"DOCX");
 assert.ok(codes(r).includes("DOCX_NO_TEXT_RUNS"));
});
test("corrupted archive fails without document text leak",async()=>{
 const r=await preflight(encoder.encode("PRIVATE_STUDENT_980"),"DOCX");
 assert.equal(r.overall,"FAIL");
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE_STUDENT_980/);
});
test("zip path traversal rejected",async()=>{
 const r=await preflight(docx([{name:"../escape",value:"no"}]),"DOCX");
 assert.equal(r.overall,"FAIL");assert.ok(codes(r).includes("DOCX_UNSAFE_ZIP_PATH"));
});
test("macro project rejected",async()=>{
 const r=await preflight(docx([{name:"word/vbaProject.bin",value:"code"}]),"DOCX");
 assert.equal(r.overall,"FAIL");assert.ok(codes(r).includes("DOCX_MACROS_PRESENT"));
});
test("duplicate member names rejected",async()=>{
 const r=await preflight(docx([{name:"word/document.xml",value:"different"}]),"DOCX");
 assert.equal(r.overall,"FAIL");assert.ok(codes(r).includes("DOCX_DUPLICATE_ZIP_ENTRY"));
});
test("zipbomb large member rejected on metadata before decompress",async()=>{
 const r=await preflight(docx([{name:"word/large.xml",value:"x".repeat(25*1024*1024)}]),"DOCX");
 assert.equal(r.overall,"FAIL");assert.ok(codes(r).includes("DOCX_MEMBER_LIMIT"));
});
test("CRC mismatch rejected",async()=>{
 const bytes=docx();
 // Tamper ZIP local compressed bytes, leaving central CRC unchanged.
 const i=bytes.indexOf(0x78); // do not assume this is document member; change a safe local header byte instead
 const broken=Uint8Array.from(bytes);
 const buf=Buffer.from(broken);
 const cd=buf.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
 const second=buf.indexOf(Buffer.from([0x50,0x4b,0x03,0x04]),5);
 const nameSize=buf.readUInt16LE(second+26),extra=buf.readUInt16LE(second+28);
 const dataStart=second+30+nameSize+extra;
 broken[dataStart+2]^=0x10;
 const r=await preflight(broken,"DOCX");
 assert.equal(r.overall,"FAIL");
});
test("HTML cannot be masqueraded as a PDF",async()=>{
 const r=await preflight(encoder.encode("<html>hello</html>"),"PDF");
 assert.equal(r.overall,"FAIL");assert.ok(codes(r).includes("PDF_SIGNATURE_INVALID"));
});
test("simple PDF is header-only, no geometry pass",async()=>{
 const r=await preflight(encoder.encode("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"),"PDF");
 assert.equal(r.overall,"REVIEW");
 assert.equal(r.checks.file_integrity,"REVIEW");
 assert.equal(r.checks.page_geometry,"NOT_TESTED");
 assert.equal(r.checks.text_extractability,"NOT_TESTED");
 assert.ok(codes(r).includes("PDF_PARSER_NOT_INCLUDED"));
});
test("truncated-looking PDF remains REVIEW, not certification",async()=>{
 const r=await preflight(encoder.encode("%PDF-1.5\nfake"),"PDF");
 assert.equal(r.overall,"REVIEW");
 assert.ok(codes(r).includes("PDF_EOF_MISSING"));
});
test("binary input limit checked before parsing",async()=>{
 await assert.rejects(preflight(new Uint8Array(MAX_INPUT_BYTES+1),"PDF"),/INVALID_INPUT_SIZE/);
});
test("invalid kind is rejected",async()=>{
 await assert.rejects(preflight(new Uint8Array([1,2,3]),"EXE"),/UNSUPPORTED_FORMAT/);
});
test("reports never include body text or filenames",async()=>{
 const r=await preflight(docx([],sampleXml({text:"PRIVATE_CHILD_19083"})),"DOCX");
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE_CHILD_19083/);
 assert.equal(r.not_an_official_approval,true);
});
test("embedded objects are flagged but not opened",async()=>{
 const r=await preflight(docx([{name:"word/embeddings/object1.bin",value:"p"}]),"DOCX");
 assert.ok(codes(r).includes("DOCX_EMBEDDED_OBJECTS_UNOPENED"));
});

test("faked XML root in nested markup fails closed",async()=>{
 const fake='<root><w:document xmlns:w="x"><w:body/></w:document></root>';
 const r=await preflight(docx([],fake),"DOCX");
 assert.equal(r.overall,"FAIL");assert.ok(codes(r).includes("DOCX_XML_ROOT_INVALID"));
});
test("site wires local file selector to PDF.js for PDF and V2b for DOCX",()=>{
 const root=new URL("../",import.meta.url);
 const html=readFileSync(new URL("docs/validate.html",root),"utf8");
 const ui=readFileSync(new URL("docs/validator-ui.mjs",root),"utf8");
 const core=readFileSync(new URL("docs/preflight-v2b.mjs",root),"utf8");
 assert.match(html,/id="documentFile"/);
 assert.match(html,/\.pdf.*\.docx/);
 assert.match(ui,/import \{preflight,MAX_INPUT_BYTES/);
 assert.match(ui,/validation=ext==="pdf"\?await inspectPdf\(buffer\):await preflight\(buffer,ext\)/);
 assert.doesNotMatch(core,/\bfetch\s*\(/);
 assert.doesNotMatch(html,/<script[^>]+src="https?:\/\//);
});
