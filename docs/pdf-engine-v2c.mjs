/**
 * DSM-ES-VALIDATOR-002C — real, on-device PDF geometry/text inspection.
 * Mozilla PDF.js is loaded from a same-origin, version-pinned vendor build.
 * No PDF bytes, text, page previews or filenames are transmitted.
 *
 * IMPORTANT: this is NOT PDF/UA certification, a visual design audit,
 * a pedagogical/LRS decision, or formal institutional approval.
 */
import {preflight as fallbackPreflight, MAX_INPUT_BYTES} from "./preflight-v2b.mjs";
import {analyzeTextLayout,summarizeVisualPages} from "./visual-engine-v2d.mjs";

export const ENGINE_VERSION="DSM-ES-VALIDATOR-002D/pdfjs-visual-v0.1";
export const PDFJS_PIN="6.5.438";
const MAX_PAGES=50;
const MAX_ITEMS=250000;
const A4_MM=[210,297],TOLERANCE_MM=3;
const MM_PER_PT=25.4/72;

const NOT_TESTED=[
 "official_brand_identity","authorized_logo","visual_rendering",
 "pdf_ua_accessibility","wcag_full_accessibility","lrs_policy",
 "educational_equivalence","source_fidelity","translation_quality",
 "privacy_regulatory_compliance","pdf_annotations_semantics"
];

const finding=(category,code,severity,message)=>({category,code,severity,message});
const baseChecks=()=>({
 file_integrity:"NOT_TESTED",page_geometry:"NOT_TESTED",
 text_extractability:"NOT_TESTED",document_structure:"NOT_TESTED",
 basic_accessibility:"NOT_TESTED"
});
function makeReport(overall,checks,findings,metrics){
 for(const key of NOT_TESTED)checks[key]="NOT_TESTED";
 findings.sort((a,b)=>(a.category+a.code).localeCompare(b.category+b.code));
 return {
   report_version:"2.2",engine_version:ENGINE_VERSION,
   pdfjs_version:PDFJS_PIN,
   scope:"PDF geometry, extractable text and preliminary layout/typography heuristics; no institutional conformity",
   file_type:"PDF",overall,not_an_official_approval:true,
   checks,findings,finding_count:findings.length,metrics,
   disclaimer:"Content stays on device. Manual visual and educational review required. "
     +"No PDF/UA, permitted-brand-logo, translation, LRS, or rendered-layout certification."
 };
}
function a4(w,h) {
 return Math.abs(w*MM_PER_PT-A4_MM[0])<=TOLERANCE_MM &&
   Math.abs(h*MM_PER_PT-A4_MM[1])<=TOLERANCE_MM;
}

let importedPdfJs=null;
async function loadLocalPdfJs(){
 if(importedPdfJs)return importedPdfJs;
 const url=new URL("./vendor/pdfjs/pdf.mjs",import.meta.url);
 const pdfjs=await import(url.href);
 pdfjs.GlobalWorkerOptions.workerSrc=new URL("./vendor/pdfjs/pdf.worker.mjs",import.meta.url).href;
 importedPdfJs=pdfjs;
 return pdfjs;
}

export async function inspectPdf(bytesInput){
 const bytes=bytesInput instanceof Uint8Array?bytesInput:
   bytesInput instanceof ArrayBuffer?new Uint8Array(bytesInput):null;
 if(!bytes||!bytes.length||bytes.length>MAX_INPUT_BYTES)
   return makeReport("FAIL",{...baseChecks(),file_integrity:"FAIL"},
     [finding("file_integrity","PDF_INPUT_INVALID","FAIL",
      "The PDF is empty or exceeds the 12 MiB input limit.")],{});
 const header=new TextDecoder("latin1")
   .decode(bytes.subarray(0,Math.min(bytes.length,1024)));
 if(!/%PDF-\d\.\d/.test(header))
   return makeReport("FAIL",{...baseChecks(),file_integrity:"FAIL"},
     [finding("file_integrity","PDF_SIGNATURE_INVALID","FAIL",
      "No valid PDF header was found near the start of the input.")],{});

 let pdfjs;
 try {pdfjs=await loadLocalPdfJs();}
 catch (_) {
   // GitHub Pages branch /docs may not have built the PDF.js bundle yet.
   // Degrade safely to explicit signature-only V2b rather than claiming checks.
   const fallback=await fallbackPreflight(bytes,"PDF");
   fallback.engine_version=ENGINE_VERSION+" / V2b fallback";
   fallback.scope="V2b signature-only fallback; local PDF.js assets unavailable";
   fallback.findings.push(finding("file_integrity","PDF_ENGINE_UNAVAILABLE","REVIEW",
     "Full PDF engine is not installed on this site; geometry/text NOT_TESTED."));
   fallback.finding_count=fallback.findings.length;
   fallback.checks.page_geometry="NOT_TESTED";
   fallback.checks.text_extractability="NOT_TESTED";
   fallback.overall=fallback.overall==="FAIL"?"FAIL":"REVIEW";
   return fallback;
 }
 let task=null,document=null;
 const checks=baseChecks(),findings=[],metrics={};
 try {
   // A byte COPY is necessary: PDF.js may transfer and detach its input buffer.
   // The UI still needs to calculate the input SHA-256 locally afterward.
   task=pdfjs.getDocument({
     data:bytes.slice(),
     stopAtErrors:true,
     enableXfa:false,
     isEvalSupported:false,
     disableFontFace:true,
     useSystemFonts:false,
     useWasm:false,
     disableAutoFetch:true,
     disableStream:true,
     verbosity:0
   });
   document=await task.promise;
   checks.file_integrity="REVIEW"; // Valid load is not full PDF structural safety certification.
   const pageCount=document.numPages;
   if(!Number.isSafeInteger(pageCount)||pageCount<1||pageCount>MAX_PAGES){
     checks.file_integrity="FAIL";
     findings.push(finding("file_integrity","PDF_PAGE_LIMIT","FAIL",
       "PDF page count is invalid or exceeds the 50-page limit."));
     return makeReport("FAIL",checks,findings,{});
   }
   let a4Count=0,textCount=0,itemsCount=0,approxWords=0;
   let emptyTextPages=0;
   const visualPages=[];
   for(let number=1;number<=pageCount;number++){
     const page=await document.getPage(number);
     try{
       const viewport=page.getViewport({scale:1});
       if(a4(viewport.width,viewport.height))a4Count++;
       // getTextContent reads text on-device. Never include it in findings/metrics.
       const content=await page.getTextContent({
         includeMarkedContent:false,
         disableNormalization:false
       });
       const items=content.items||[];
       visualPages.push(analyzeTextLayout({
         pageNumber:number,width:viewport.width,height:viewport.height,
         viewportTransform:viewport.transform,items
       }));
       itemsCount+=items.length;
       if(itemsCount>MAX_ITEMS){
         checks.text_extractability="REVIEW";
         findings.push(finding("text_extractability","PDF_TEXT_VOLUME_LIMIT",
           "REVIEW","Text-item limit reached; remaining pages need offline review."));
         break;
       }
       let pageHasText=false;
       for(const item of items){
         if(typeof item.str==="string" && item.str.trim()){
           pageHasText=true;
           approxWords+=item.str.trim().split(/\s+/u).length;
         }
       }
       if(pageHasText)textCount++;
       else emptyTextPages++;
     }finally{
       page.cleanup();
     }
   }
   metrics.pages=pageCount;
   metrics.a4_portrait_pages=a4Count;
   metrics.pages_with_extractable_text=textCount;
   metrics.empty_text_pages=emptyTextPages;
   metrics.text_items_examined=itemsCount;
   metrics.word_count_approx=Math.min(approxWords,1000000);
   const visual=summarizeVisualPages(visualPages,pageCount);
   metrics.visual_pages=visual.metrics;
   metrics.visual_profile=visual.profile;
   metrics.visual_profile_authority=visual.profile_authority;
   findings.push(...visual.findings);
   Object.assign(checks,visual.checks);
   if(a4Count!==pageCount){
     checks.page_geometry="REVIEW";
     findings.push(finding("page_geometry","NON_A4_PORTRAIT","REVIEW",
       "At least one parsed PDF page differs from A4 portrait (proposed profile)."));
   }else{
     checks.page_geometry="PASS";
   }
   if(textCount!==pageCount){
     checks.text_extractability="REVIEW";
     findings.push(finding("text_extractability","PDF_TEXT_NOT_EXTRACTABLE","REVIEW",
       "Some pages have no extractable text, possibly due to scanning or graphics."));
   }else{
     checks.text_extractability="PASS";
   }
   // This is a *preflight*. Rendering, accessibility and translation remain untested.
   return makeReport("REVIEW",checks,findings,metrics);
 }catch(_){
   // Never echo PDF.js exceptions: document metadata/strings can leak through errors.
   checks.file_integrity="FAIL";
   checks.page_geometry="NOT_TESTED";
   checks.text_extractability="NOT_TESTED";
   return makeReport("FAIL",checks,[
     finding("file_integrity","PDF_PARSE_FAILED","FAIL",
       "PDF cannot be inspected safely; it may be damaged, unsupported or password protected.")
   ],{});
 }finally{
   // PDFDocumentLoadingTask.destroy() is the supported worker teardown API.
   // Do not assume a destroy() method exists on the PDFDocumentProxy in every build.
   if(task && typeof task.destroy==="function"){
     try {await task.destroy();}catch(_){}
   }
 }
}
