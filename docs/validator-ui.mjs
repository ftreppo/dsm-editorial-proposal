import {validateDocument, MAX_BYTES, ENGINE_VERSION} from "./validator-v1.mjs";
import {preflight,MAX_INPUT_BYTES,ENGINE_VERSION as BINARY_ENGINE} from "./preflight-v2b.mjs";
import {inspectPdf,renderLocalPdfPreview,ENGINE_VERSION as PDF_ENGINE} from "./pdf-engine-v2c.mjs";

const ui = {
  it: {
    title:"Verifica locale JSON, PDF e DOCX",
    lede:"JSON: controlli strutturali V1. DOCX: controllo preliminare di archivio, testo e margini dichiarati. PDF: PDF.js controlla pagina e testo quando disponibile sul sito; altrimenti solo intestazione e fine file. Tutto resta nel browser.",
    choose:"Seleziona JSON (2 MiB), PDF o DOCX (12 MiB)",
    format:"PDF.js controlla pagina e testo quando presente sul sito; in caso contrario solo intestazione e trailer. DOCX verifica soltanto indizi tecnici; non esegue controlli grafici completi, PDF/UA o LRS.",
    run:"Verifica il documento", example:"Apri un esempio JSON", result:"Rapporto V1 / V2b · Solo controlli eseguiti",
    findingsTitle:"Osservazioni",coverageTitle:"Copertura",
    coverage:"Non verificati: identità visiva, PDF/UA, equivalenza didattica, misure LRS, fedeltà all'originale e correttezza della traduzione.",
    save:"Scarica il rapporto JSON",privacyHeading:"Privacy e limiti.",
    privacy:"Il documento resta nel browser. Soltanto per JSON viene richiesto lo schema pubblico dallo stesso sito. Nessun file o rapporto è caricato. Per PDF e DOCX il risultato resta REVIEW o FAIL; PDF.js è necessario per verificare formato pagina e testo.",
    docs:"Leggi i limiti e la CLI del validatore",
    busy:"Verifica in corso…",noFile:"Seleziona prima un file JSON.",oversize:"Il documento supera il limite locale di 2 MiB.",
    invalid:"Non è stato possibile leggere un documento JSON valido. Il file rimane sul dispositivo.",
    network:"Impossibile leggere lo schema pubblico della repository. Riprova quando il sito è raggiungibile.",
    passing:"Nessun problema riscontrato nei soli controlli strutturali V1.",
    reviewing:"Sono necessarie verifiche o approvazioni umane.",
    failing:"Sono presenti errori strutturali o di metadati.",
    visualTitle:"Misure tipografiche e margini (indicative)",
    previewOpen:"Mostra anteprima PDF",previewTitle:"Anteprima PDF sul dispositivo",
    previewExplanation:"Linee tratteggiate: guida proposta a 12 mm dal bordo, non requisito ufficiale DSM. L’immagine non entra nel rapporto.",
    previewPrev:"Precedente",previewNext:"Successiva",previewUnavailable:"Anteprima non disponibile.",
    previewWaiting:"Rendering sul dispositivo…",pageShort:"Pagina",marginText:"margini S/A/D/B",
    fontText:"mediana testo",previewPageOf:(n,m)=>"Pagina "+n+" / "+m,
    noIssues:"Nessuna osservazione per le regole eseguite.",hasher:"SHA-256 del file",
    noHash:"non disponibile nel browser",version:"Motore"
  },
  de: {
    title:"JSON-, PDF- und DOCX-Prüfung im Browser",
    lede:"JSON: Strukturprüfung V1. DOCX: ZIP, Textläufe und deklarierte Seitenränder. PDF: PDF.js prüft Seitenformat und Text, falls lokal verfügbar; sonst nur Header und Dateiende. Alles bleibt im Browser.",
    choose:"JSON (2 MiB), PDF oder DOCX (12 MiB) wählen",
    format:"PDF.js prüft Seitenformat/Text, falls lokal installiert, sonst nur Header/Dateiende; DOCX nur technische Vorprüfung. Keine vollständige Layout-, PDF/UA- oder LRS-Zertifizierung.",
    run:"Dokument prüfen",example:"JSON-Beispiel öffnen",result:"V1-/V2b-Bericht · Nur ausgeführte Prüfungen",
    findingsTitle:"Ergebnisse",coverageTitle:"Prüfumfang",
    coverage:"Nicht geprüft: visuelle Identität, PDF/UA, didaktische Gleichwertigkeit, LRS-Maßnahmen, Inhaltstreue und Übersetzungsqualität.",
    save:"JSON-Bericht speichern",privacyHeading:"Datenschutz und Grenzen.",
    privacy:"Das Dokument bleibt lokal im Browser. Nur für JSON wird das öffentliche Schema vom selben Webauftritt geladen. Dateien und Berichte werden nicht hochgeladen. PDF/DOCX liefern nur REVIEW oder FAIL; PDF.js ist für Seitengröße und Textprüfung erforderlich.",
    docs:"Grenzen und CLI-Anleitung lesen",
    busy:"Prüfung läuft…",noFile:"Bitte zuerst eine JSON-Datei auswählen.",oversize:"Die Datei überschreitet das Limit von 2 MiB.",
    invalid:"Die Datei konnte nicht als gültiges JSON gelesen werden. Sie bleibt auf deinem Gerät.",
    network:"Das öffentliche Schema ist momentan nicht erreichbar.",
    passing:"Keine Probleme in den ausgeführten Strukturprüfungen V1 gefunden.",
    reviewing:"Menschliche Prüfung oder Freigabe ist erforderlich.",
    failing:"Struktur- oder Metadatenfehler gefunden.",
    visualTitle:"Text- und Randmaße (Näherungswerte)",
    previewOpen:"PDF-Vorschau anzeigen",previewTitle:"Lokale PDF-Vorschau",
    previewExplanation:"Gestrichelte Linien: vorgeschlagene 12-mm-Randhilfe, keine offizielle DSM-Vorgabe. Das Bild wird nicht gespeichert.",
    previewPrev:"Zurück",previewNext:"Weiter",previewUnavailable:"Vorschau nicht verfügbar.",
    previewWaiting:"Lokale Darstellung läuft…",pageShort:"Seite",marginText:"Rand L/O/R/U",
    fontText:"Median Schrift",previewPageOf:(n,m)=>"Seite "+n+" / "+m,
    noIssues:"Keine Befunde für ausgeführte Regeln.",hasher:"Datei-SHA-256",
    noHash:"im Browser nicht verfügbar",version:"Prüfmodul"
  },
  en: {
    title:"Validate JSON, PDF and DOCX locally",
    lede:"JSON: V1 structure checks. DOCX: preliminary ZIP, text-run and declared-margin checks. PDF: PDF.js checks page size and text when bundled locally; otherwise header/trailer only. Files stay in your browser.",
    choose:"Choose JSON (2 MiB), PDF or DOCX (12 MiB)",
    format:"PDF.js checks page size/text when locally installed, otherwise only header/trailer; DOCX checks technical metadata. This does not certify layout, PDF/UA, or LRS compliance.",
    run:"Validate document",example:"Open a JSON example",result:"V1 / V2b report · Executed checks only",
    findingsTitle:"Findings",coverageTitle:"Coverage",
    coverage:"Not tested: visual identity, PDF/UA, educational equivalence, LRS accommodations, original-content fidelity or translation accuracy.",
    save:"Download JSON report",privacyHeading:"Privacy and limitations.",
    privacy:"Documents remain in your browser. Only JSON validation fetches the public schema from this site. No file or report is uploaded. PDF/DOCX return REVIEW or FAIL; PDF.js is required for page geometry and text checks.",
    docs:"Read validator limits and CLI documentation",
    busy:"Validating…",noFile:"Select a JSON file first.",oversize:"This file exceeds the 2 MiB limit.",
    invalid:"Could not parse a valid JSON document. The file remains on your device.",
    network:"The public schema could not be loaded from this site.",
    passing:"No issues found within the V1 structural checks.",
    reviewing:"Human review or approval is still required.",
    failing:"Document structure or metadata failed validation.",
    visualTitle:"Measured text and margins (approximate)",
    previewOpen:"Show local PDF preview",previewTitle:"On-device PDF preview",
    previewExplanation:"Dashed lines: proposed 12 mm caution guide, not official DSM design. Preview pixels are not in the report.",
    previewPrev:"Previous",previewNext:"Next",previewUnavailable:"Preview unavailable.",
    previewWaiting:"Rendering on device…",pageShort:"Page",marginText:"margins L/T/R/B",
    fontText:"text median",previewPageOf:(n,m)=>"Page "+n+" / "+m,
    noIssues:"No findings for the executed rules.",hasher:"File SHA-256",
    noHash:"not available in this browser",version:"Engine"
  }
};
const $ = x => document.getElementById(x);
const fileInput = $("documentFile"), runButton = $("run"), reportSection=$("reportSection");
let lang = new URLSearchParams(window.location.search).get("lang") || "it";
if(!ui[lang]) lang="it";
let latest = null;
let schemaCache = null;
let activePdfFile=null;
let previewPage=1;

function applyLanguage(value) {
  if (!ui[value]) return;
  lang=value;document.documentElement.lang=lang;
  for (const el of document.querySelectorAll("[data-i18n]")) {
    const key=el.dataset.i18n;
    if(ui[lang][key])el.textContent=ui[lang][key];
  }
  for(const button of document.querySelectorAll("[data-lang]")) button.setAttribute("aria-pressed",String(button.dataset.lang===lang));
  try {
    const url=new URL(window.location.href);url.searchParams.set("lang",lang);
    history.replaceState(null,"",url.toString());
  } catch(_) {}
  if(latest) render(latest);
}
for (const button of document.querySelectorAll("[data-lang]")) {
  button.addEventListener("click",()=>applyLanguage(button.dataset.lang));
}
applyLanguage(lang);
function reportError(code) {
  latest={overall:"INPUT_ERROR", engine_version:PDF_ENGINE+" / "+BINARY_ENGINE+" / "+ENGINE_VERSION, checks:{}, findings:[],
    finding_count:0, input_sha256:null,
    input_error:code, not_an_official_approval:true};
  render(latest);
}
function render(report) {
  const tr=ui[lang], statusEl=$("status"), expl=$("statusExplanation");
  reportSection.classList.add("visible");
  statusEl.className="status "+report.overall;
  statusEl.textContent=report.overall;
  const explanation=report.overall==="PASS"?tr.passing:
    report.overall==="REVIEW"?tr.reviewing:
    report.overall==="FAIL"?tr.failing:
    tr[report.input_error]||tr.invalid;
  expl.textContent=explanation;
  const findings=$("findings");
  findings.replaceChildren();
  if(!report.findings || !report.findings.length){
    const p=document.createElement("p");
    p.className="fineprint";p.textContent=tr.noIssues;findings.appendChild(p);
  } else {
    for (const item of report.findings) {
      const row=document.createElement("div");row.className="finding";
      const title=document.createElement("strong");
      title.textContent=item.severity+" · "+item.code+(item.path?" · "+item.path:"");
      const body=document.createElement("p");
      body.textContent=item.message;
      row.append(title,body);findings.appendChild(row);
    }
  }
  $("reportHash").textContent=tr.version+": "+report.engine_version+"\n"+
    tr.hasher+": "+(report.input_sha256||tr.noHash);
  $("save").disabled=report.overall==="INPUT_ERROR";
  $("previewOpen").hidden=!(report.file_type==="PDF" &&
    report.engine_version===PDF_ENGINE && report.overall==="REVIEW");
  const visual=$("visualMetrics");
  visual.replaceChildren();
  const pages=report.metrics?.visual_pages;
  if(Array.isArray(pages)){
    for(const p of pages){
      if(!p.margins)continue;
      const line=document.createElement("p");
      const m=p.margins;
      line.textContent=tr.pageShort+" "+p.page+" · "+tr.marginText+": "+
        [m.left_mm,m.top_mm,m.right_mm,m.bottom_mm].join(" / ")+" mm · "+
        tr.fontText+": "+p.median_text_size_pt+" pt";
      visual.appendChild(line);
    }
  }
}
async function getSchema(){
  if(schemaCache)return schemaCache;
  const response=await fetch("./specification/document.schema.json",{
    method:"GET",cache:"no-store",credentials:"omit"
  });
  if(!response.ok)throw Error("Cannot fetch public schema");
  schemaCache=await response.json();
  return schemaCache;
}
async function getHash(buffer) {
  if(!globalThis.crypto || !globalThis.crypto.subtle)return null;
  const bytes=await crypto.subtle.digest("SHA-256",buffer);
  return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,"0")).join("");
}
fileInput.addEventListener("change",()=>{
  latest=null;activePdfFile=null;previewPage=1;
  reportSection.classList.remove("visible");
  $("previewSection").hidden=true;
});
runButton.addEventListener("click",async()=>{
  const file=fileInput.files?.[0];
  if(!file) {reportError("noFile");return;}
  const ext=file.name.toLowerCase().match(/\.(json|pdf|docx)$/)?.[1];
  if(!ext){reportError("invalid");return;}
  if(file.size > (ext==="json"?MAX_BYTES:MAX_INPUT_BYTES)){reportError("oversize");return;}
  runButton.disabled=true;runButton.textContent=ui[lang].busy;
  activePdfFile=null;$("previewSection").hidden=true;
  try {
    const buffer=await file.arrayBuffer();
    let validation;
    if(ext==="json"){
      const raw=new TextDecoder("utf-8",{fatal:true}).decode(buffer).replace(/^\uFEFF/,"");
      let doc;
      try{doc=JSON.parse(raw);}catch(_){reportError("invalid");return;}
      let schema;
      try{schema=await getSchema();}catch(_){reportError("network");return;}
      validation=validateDocument(doc,schema);
    } else {
      validation=ext==="pdf"?await inspectPdf(buffer):await preflight(buffer,ext);
    }
    const input_sha256=await getHash(buffer);
    latest={...validation,input_sha256};
    activePdfFile=ext==="pdf" && validation.engine_version===PDF_ENGINE && validation.overall==="REVIEW" ? file:null;
    render(latest);
  } catch(_){reportError("invalid");}
  finally{runButton.disabled=false;runButton.textContent=ui[lang].run;}
});
$("save").addEventListener("click",()=>{
  if(!latest || latest.overall==="INPUT_ERROR")return;
  const blob=new Blob([JSON.stringify(latest,null,2)+"\n"],{type:"application/json"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download="dsm-es-validation-report.json";document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
});

async function showPreview(pageNumber){
  if(!activePdfFile||!latest||latest.engine_version!==PDF_ENGINE)return;
  const total=latest.metrics?.pages;
  if(!Number.isSafeInteger(total)||pageNumber<1||pageNumber>total)return;
  const tr=ui[lang],prev=$("previewPrev"),next=$("previewNext"),stat=$("previewStatus");
  $("previewSection").hidden=false;
  stat.textContent=tr.previewWaiting;
  prev.disabled=true;next.disabled=true;
  try{
    const buffer=await activePdfFile.arrayBuffer();
    const rendered=await renderLocalPdfPreview(buffer,pageNumber,$("previewCanvas"));
    previewPage=rendered.page;
    $("previewCount").textContent=tr.previewPageOf(previewPage,rendered.pages);
    stat.textContent="";
  }catch(_){
    stat.textContent=tr.previewUnavailable;
    $("previewCanvas").width=0;$("previewCanvas").height=0;
  }finally{
    prev.disabled=previewPage<=1;
    next.disabled=previewPage>=total;
  }
}
$("previewOpen").addEventListener("click",()=>showPreview(1));
$("previewPrev").addEventListener("click",()=>showPreview(previewPage-1));
$("previewNext").addEventListener("click",()=>showPreview(previewPage+1));
