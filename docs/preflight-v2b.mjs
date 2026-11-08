/**
 * DSM-ES-VALIDATOR-002B — local PDF/DOCX browser preflight (community proposal).
 * No fetch(), uploads, external scripts, OCR, rendering or macro execution.
 * PDF: signature/trailer only, never real PDF parsing.
 * DOCX: bounded ZIP directory and CRC-verified XML metadata.
 */
export const ENGINE_VERSION = "DSM-ES-VALIDATOR-002B/browser-preflight-v0.1";
export const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const MAX_ENTRIES=1500, MAX_MEMBER=24*1024*1024;
const MAX_TOTAL=96*1024*1024, MAX_XML=8*1024*1024;
const NOT_TESTED=["official_brand_identity","authorized_logo","visual_rendering",
  "pdf_ua_accessibility","wcag_full_accessibility","lrs_policy",
  "educational_equivalence","source_fidelity","translation_quality",
  "privacy_regulatory_compliance"];
class Rejected extends Error {
  constructor(code){super(code);this.code=code;this.name="Rejected";}
}
const issue=(category,code,severity,message)=>({category,code,severity,message});
const bounded=(n,start,size)=>Number.isSafeInteger(start)&&Number.isSafeInteger(size)&&
  start>=0&&size>=0&&start<=n&&size<=n-start;
function check(n,start,size) {
  if(!bounded(n,start,size))throw new Rejected("DOCX_INVALID_ZIP_OFFSETS");
}
function ascii(bytes){
  let s="";
  for(const b of bytes){if(b>127)throw new Rejected("DOCX_NONASCII_ENTRY_NAME");
    s+=String.fromCharCode(b);}
  return s;
}
function crc32(data){
  let c=-1;
  for(const b of data){
    c^=b;
    for(let i=0;i<8;i++)c=(c>>>1)^(-(c&1)&0xedb88320);
  }
  return (c^-1)>>>0;
}
function zipDirectory(bytes){
  const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),n=bytes.length;
  if(n<22)throw new Rejected("DOCX_ZIP_TOO_SHORT");
  let e=-1;
  for(let i=n-22;i>=Math.max(0,n-65557);i--){
    if(d.getUint32(i,true)===0x06054b50 &&
      i+22+d.getUint16(i+20,true)===n){e=i;break;}
  }
  if(e<0)throw new Rejected("DOCX_EOCD_MISSING");
  const count=d.getUint16(e+10,true),countDisk=d.getUint16(e+8,true);
  const size=d.getUint32(e+12,true),start=d.getUint32(e+16,true);
  if(d.getUint16(e+4,true)||d.getUint16(e+6,true)||count!==countDisk)
    throw new Rejected("DOCX_MULTIDISK_UNSUPPORTED");
  if(count===65535||size===0xffffffff||start===0xffffffff)
    throw new Rejected("DOCX_ZIP64_UNSUPPORTED");
  if(count<2||count>MAX_ENTRIES)throw new Rejected("DOCX_ENTRY_COUNT_INVALID");
  if(!bounded(n,start,size)||start+size>e)
    throw new Rejected("DOCX_CENTRAL_DIRECTORY_INVALID");
  let p=start,total=0;
  const entries=new Map();
  for(let i=0;i<count;i++){
    check(n,p,46);
    if(d.getUint32(p,true)!==0x02014b50)
      throw new Rejected("DOCX_CENTRAL_ENTRY_INVALID");
    const flags=d.getUint16(p+8,true),method=d.getUint16(p+10,true);
    const crc=d.getUint32(p+16,true),compressed=d.getUint32(p+20,true);
    const inflated=d.getUint32(p+24,true),offset=d.getUint32(p+42,true);
    const nl=d.getUint16(p+28,true),el=d.getUint16(p+30,true);
    const cl=d.getUint16(p+32,true),row=46+nl+el+cl;
    check(n,p,row);
    if(p+row>start+size)throw new Rejected("DOCX_CENTRAL_ENTRY_OVERRUN");
    if((flags&1)||(flags&0x40)||(flags&0x2000))
      throw new Rejected("DOCX_ENCRYPTION_UNSUPPORTED");
    if(method!==0&&method!==8)throw new Rejected("DOCX_COMPRESSION_UNSUPPORTED");
    if(offset===0xffffffff||compressed===0xffffffff||inflated===0xffffffff||
      d.getUint16(p+34,true)!==0)
      throw new Rejected("DOCX_ZIP64_UNSUPPORTED");
    const name=ascii(bytes.subarray(p+46,p+46+nl)).replaceAll("\\","/");
    if(!name||name.startsWith("/")||name.split("/").includes("..")||
       name.includes("\0")||name.includes(":"))
      throw new Rejected("DOCX_UNSAFE_ZIP_PATH");
    if(entries.has(name))throw new Rejected("DOCX_DUPLICATE_ZIP_ENTRY");
    if(inflated>MAX_MEMBER)throw new Rejected("DOCX_MEMBER_LIMIT");
    total+=inflated;
    if(total>MAX_TOTAL)throw new Rejected("DOCX_TOTAL_UNCOMPRESSED_LIMIT");
    if(inflated>1000000&&inflated/Math.max(compressed,1)>200)
      throw new Rejected("DOCX_EXCESSIVE_COMPRESSION_RATIO");
    entries.set(name,{name,flags,method,crc,compressed,inflated,offset});
    p+=row;
  }
  if(p!==start+size)throw new Rejected("DOCX_CENTRAL_SIZE_MISMATCH");
  if(!entries.has("[Content_Types].xml")||!entries.has("word/document.xml"))
    throw new Rejected("DOCX_REQUIRED_PARTS_MISSING");
  if([...entries.keys()].some(name=>/(^|\/)vbaProject\.bin$/i.test(name)))
    throw new Rejected("DOCX_MACROS_PRESENT");
  return {entries,centralStart:start};
}
async function xmlPart(bytes,zip,name){
  const ent=zip.entries.get(name);
  if(!ent)throw new Rejected("DOCX_REQUIRED_PARTS_MISSING");
  if(ent.inflated>MAX_XML)throw new Rejected("DOCX_XML_TOO_LARGE");
  const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),p=ent.offset;
  check(bytes.length,p,30);
  if(d.getUint32(p,true)!==0x04034b50)
    throw new Rejected("DOCX_LOCAL_HEADER_INVALID");
  if(d.getUint16(p+8,true)!==ent.method)
    throw new Rejected("DOCX_LOCAL_METHOD_MISMATCH");
  const nl=d.getUint16(p+26,true),el=d.getUint16(p+28,true);
  check(bytes.length,p+30,nl+el);
  if(ascii(bytes.subarray(p+30,p+30+nl))!==name)
    throw new Rejected("DOCX_LOCAL_NAME_MISMATCH");
  const off=p+30+nl+el;
  check(bytes.length,off,ent.compressed);
  if(off+ent.compressed>zip.centralStart)
    throw new Rejected("DOCX_DATA_OVERLAP");
  const input=bytes.subarray(off,off+ent.compressed);
  let decoded;
  if(ent.method===0){
    if(ent.compressed!==ent.inflated)
      throw new Rejected("DOCX_STORED_SIZE_MISMATCH");
    decoded=input;
  }else{
    if(typeof DecompressionStream==="undefined")
      throw new Rejected("BROWSER_DEFLATE_RAW_UNAVAILABLE");
    let reader;
    try{
      reader=new Blob([input]).stream().pipeThrough(
        new DecompressionStream("deflate-raw")).getReader();
      const chunks=[];let total=0;
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        total+=value.byteLength;
        if(total>ent.inflated||total>MAX_XML){
          await reader.cancel().catch(()=>{});
          throw new Rejected("DOCX_DECOMPRESSION_LIMIT");
        }
        chunks.push(value);
      }
      decoded=new Uint8Array(total);
      let at=0;
      for(const chunk of chunks){decoded.set(chunk,at);at+=chunk.byteLength;}
    }catch(error){
      if(error instanceof Rejected)throw error;
      throw new Rejected("DOCX_DECOMPRESSION_FAILURE");
    }finally{if(reader)reader.releaseLock();}
  }
  if(decoded.length!==ent.inflated)
    throw new Rejected("DOCX_SIZE_MISMATCH");
  if(crc32(decoded)!==ent.crc)throw new Rejected("DOCX_CRC_MISMATCH");
  let xml;
  try{xml=new TextDecoder("utf-8",{fatal:true}).decode(decoded);}
  catch(_){throw new Rejected("DOCX_XML_UTF8_REQUIRED");}
  if(/<\s*!(?:DOCTYPE|ENTITY)\b/i.test(xml))
    throw new Rejected("DOCX_DTD_UNSUPPORTED");
  return xml;
}
function hints(xml){
  // Metadata heuristics only; never claim semantic fidelity or verified layout.
  const safe=xml.replace(/<!--[\s\S]*?-->/g,"").replace(/<\?[\s\S]*?\?>/g,"");
  const tags=name=>[...safe.matchAll(new RegExp(
    "<(?:[\\w.-]+:)?"+name+"(?=[\\s/>])[^>]*>","g"))].map(m=>m[0]);
  const attr=(tag,name)=>{
    const found=tag.match(new RegExp(
      "\\s(?:[\\w.-]+:)?"+name+"\\s*=\\s*([\"'])([^\"']+)\\1","i"));
    return found?found[2]:null;
  };
  const sections=tags("sectPr"),sizes=tags("pgSz"),margins=tags("pgMar");
  const textMatches=[...safe.matchAll(/<(?:[\w.-]+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?t\s*>/g)];
  const hasText=textMatches.some(m=>m[1].trim().length>0);
  let a4=0;
  for(const tag of sizes){
    const w=Number(attr(tag,"w")),h=Number(attr(tag,"h"));
    if(w>0&&h>0&&Math.abs(w*25.4/1440-210)<=3&&
       Math.abs(h*25.4/1440-297)<=3&&attr(tag,"orient")!=="landscape")a4++;
  }
  const findings=[];
  if(!sections.length||sizes.length<sections.length||a4!==sizes.length)
    findings.push(issue("page_geometry","DOCX_A4_REVIEW","REVIEW",
      "Some declared sections are not A4 portrait or have no explicit page size."));
  if(margins.length<sections.length)
    findings.push(issue("page_geometry","DOCX_MARGINS_UNDECLARED","REVIEW",
      "Margins were not explicitly declared for every section."));
  let narrow=false;
  for(const tag of margins){
    for(const name of ["top","bottom","left","right"]){
      const v=attr(tag,name);
      if(v!==null&&Number(v)*25.4/1440<12)narrow=true;
    }
  }
  if(narrow)findings.push(issue("page_geometry","DOCX_NARROW_MARGINS","REVIEW",
    "A declared page margin is below the proposed 12 mm minimum."));
  if(!hasText)findings.push(issue("text_extractability","DOCX_NO_TEXT_RUNS",
    "REVIEW","No text runs detected in document XML."));
  return {findings,metrics:{
    declared_sections:sections.length,declared_page_sizes:sizes.length,
    declared_a4_portrait_sizes:a4,declared_page_margins:margins.length,
    text_runs_detected:hasText
  },checks:{
    file_integrity:"REVIEW",
    page_geometry:findings.some(x=>x.category==="page_geometry")?"REVIEW":"PASS",
    text_extractability:hasText?"PASS":"REVIEW",
    document_structure:"NOT_TESTED",basic_accessibility:"NOT_TESTED"
  }};
}
async function inspectDocx(bytes){
  const zip=zipDirectory(bytes);
  const [xml,content]=await Promise.all([
    xmlPart(bytes,zip,"word/document.xml"),
    xmlPart(bytes,zip,"[Content_Types].xml")
  ]);
  if(!/<(?:[\w.-]+:)?Types(?:\s|>)/.test(content)||
     !/<(?:[\w.-]+:)?document(?:\s|>)/.test(xml))
    throw new Rejected("DOCX_XML_ROOT_INVALID");
  const out=hints(xml);
  if([...zip.entries.keys()].some(x=>x.startsWith("word/embeddings/")))
    out.findings.push(issue("file_integrity","DOCX_EMBEDDED_OBJECTS_UNOPENED",
      "REVIEW","Embedded objects were not opened or checked."));
  return out;
}
function inspectPdf(bytes){
  const head=new TextDecoder("latin1")
    .decode(bytes.subarray(0,Math.min(bytes.length,1024)));
  if(!/%PDF-\d\.\d/.test(head))
    throw new Rejected("PDF_SIGNATURE_INVALID");
  const tail=new TextDecoder("latin1")
    .decode(bytes.subarray(Math.max(0,bytes.length-2048)));
  const findings=[issue("file_integrity","PDF_PARSER_NOT_INCLUDED","REVIEW",
    "Header detected. Full PDF geometry, text extraction and PDF/UA NOT TESTED.")];
  if(!tail.includes("%%EOF"))
    findings.push(issue("file_integrity","PDF_EOF_MISSING","REVIEW",
      "No PDF EOF marker detected near the end of the file."));
  return {findings,metrics:{signature_detected:true},checks:{
    file_integrity:"REVIEW",page_geometry:"NOT_TESTED",
    text_extractability:"NOT_TESTED",document_structure:"NOT_TESTED",
    basic_accessibility:"NOT_TESTED"
  }};
}
export async function preflight(bytesInput,kind){
  const type=String(kind).toUpperCase();
  if(!["PDF","DOCX"].includes(type))
    throw new Rejected("UNSUPPORTED_FORMAT");
  const bytes=bytesInput instanceof Uint8Array?bytesInput:
    bytesInput instanceof ArrayBuffer?new Uint8Array(bytesInput):null;
  if(!bytes||bytes.length<1||bytes.length>MAX_INPUT_BYTES)
    throw new Rejected("INVALID_INPUT_SIZE");
  let inspected;
  try{inspected=type==="PDF"?inspectPdf(bytes):await inspectDocx(bytes);}
  catch(error){
    inspected={
      findings:[issue("file_integrity",
        error instanceof Rejected?error.code:"PREFLIGHT_UNEXPECTED_ERROR",
        "FAIL","Input could not be safely inspected.")],
      metrics:{},checks:{file_integrity:"FAIL",page_geometry:"NOT_TESTED",
        text_extractability:"NOT_TESTED",document_structure:"NOT_TESTED",
        basic_accessibility:"NOT_TESTED"}
    };
  }
  const overall=inspected.findings.some(x=>x.severity==="FAIL")?"FAIL":"REVIEW";
  for(const key of NOT_TESTED)inspected.checks[key]="NOT_TESTED";
  inspected.findings.sort((a,b)=>(a.category+a.code).localeCompare(b.category+b.code));
  return {
    report_version:"2.1",engine_version:ENGINE_VERSION,file_type:type,overall,
    scope:type==="PDF"?"PDF header/trailer only":"Limited DOCX ZIP/XML preflight",
    not_an_official_approval:true,
    checks:inspected.checks,findings:inspected.findings,
    finding_count:inspected.findings.length,metrics:inspected.metrics,
    disclaimer:"Human review required. This cannot certify full PDF parsing, PDF/UA, "
      +"visual appearance, DSM branding, LRS, translation or educational equivalence."
  };
}
