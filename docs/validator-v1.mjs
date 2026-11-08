/**
 * DSM-ES V1 browser validator — entirely local document processing.
 *
 * No network requests are made by this module. Caller loads the public schema
 * from this site's own static directory. Neither results nor source text are sent.
 * PASS applies to deterministic metadata/section checks only, not DSM/LRS approval.
 */
export const ENGINE_VERSION = "DSM-ES-VALIDATOR-001/V1-browser";
export const MAX_BYTES = 2 * 1024 * 1024;
const NOT_TESTED = [
  "visual_identity", "pdf_ua_accessibility", "lrs_adaptation",
  "educational_equivalence", "source_fidelity", "translation_quality"
];

const SAFE_PATH_KEYS=new Set([
  "schema_version","document_id","version","status","profile","use_case","title",
  "subject","class_or_audience","source_language","support_languages",
  "response_languages","translation_status","date","duration_minutes","max_points",
  "source_reference","distribution","approval","editor_reviewed",
  "translation_reviewed","assessor_approved","assessment","restrictions",
  "assessed_competences_per_task","policy_pack_reference","sections","section_id",
  "kind","texts","points","answer_area","de","it","en"
]);
function pointer(parts) {
  if (!parts.length) return "/";
  return "/" + parts.map(x=>String(typeof x==="number" || SAFE_PATH_KEYS.has(x)?x:"*")
    .replace(/~/g,"~0").replace(/\//g,"~1")).join("/");
}
function issue(category, code, severity, path, message) {
  return {category, code, severity, path, message};
}
function object(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
function sameValue(a,b) { return JSON.stringify(a) === JSON.stringify(b); }
function status(items) {
  if (items.some(x => x.severity === "FAIL")) return "FAIL";
  if (items.some(x => x.severity === "REVIEW")) return "REVIEW";
  return "PASS";
}
function validType(value, kind) {
  if (kind === "object") return object(value);
  if (kind === "array") return Array.isArray(value);
  if (kind === "integer") return Number.isSafeInteger(value);
  if (kind === "number") return typeof value === "number" && Number.isFinite(value);
  if (kind === "string") return typeof value === "string";
  if (kind === "boolean") return typeof value === "boolean";
  if (kind === "null") return value === null;
  return false;
}
function isoDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y,m,d]=s.split("-").map(Number);
  if(y<1 || y>9999 || m<1 || m>12 || d<1 || d>31)return false;
  const dt=new Date(0);dt.setUTCHours(0,0,0,0);dt.setUTCFullYear(y,m-1,d);
  return dt.getUTCFullYear()===y && dt.getUTCMonth()===m-1 && dt.getUTCDate()===d;
}
/**
 * Restricted JSON Schema draft 2020-12 evaluator for the **exact keywords**
 * used by specification/document.schema.json. A CI test locks that subset.
 * Unrecognized constraint keywords are rejected instead of silently skipped.
 */
const supported = new Set([
  "$schema","$id","title","description","type","const","enum","additionalProperties",
  "required","properties","items","minLength","maxLength","minimum","maximum",
  "minItems","maxItems","uniqueItems","minProperties","maxProperties",
  "allOf","if","then","else","format"
]);
function assertSupported(schema) {
  if (!object(schema)) throw Error("Invalid schema object");
  for (const [key,val] of Object.entries(schema)) {
    if (!supported.has(key)) throw Error("Unsupported JSON Schema keyword: " + key);
    if (key === "properties") {
      for (const child of Object.values(val)) assertSupported(child);
    }
    if ((key === "items" || key === "additionalProperties" || key === "if" || key === "then" || key === "else") && object(val)) {
      assertSupported(val);
    }
    if (key === "allOf") for (const child of val) assertSupported(child);
  }
  if (schema.format && schema.format !== "date") throw Error("Unsupported schema format");
}
function collectSchema(data, schema, path, out) {
  const bad=(keyword)=>out.push(issue("schema","SCHEMA_"+keyword.toUpperCase(),"FAIL",pointer(path),
    "JSON Schema rule violated: "+keyword));
  if (schema.type && !validType(data,schema.type)) { bad("type"); return; }
  if ("const" in schema && !sameValue(data,schema.const)) bad("const");
  if (schema.enum && !schema.enum.some(v=>sameValue(v,data))) bad("enum");
  if (typeof data === "string") {
    if (schema.minLength !== undefined && [...data].length < schema.minLength) bad("minLength");
    if (schema.maxLength !== undefined && [...data].length > schema.maxLength) bad("maxLength");
    if (schema.format === "date" && !isoDate(data)) bad("format");
  }
  if (typeof data === "number" && Number.isFinite(data)) {
    if (schema.minimum !== undefined && data < schema.minimum) bad("minimum");
    if (schema.maximum !== undefined && data > schema.maximum) bad("maximum");
  }
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) bad("minItems");
    if (schema.maxItems !== undefined && data.length > schema.maxItems) bad("maxItems");
    if (schema.uniqueItems && new Set(data.map(x=>JSON.stringify(x))).size !== data.length) bad("uniqueItems");
    if (schema.items) data.forEach((x,i)=>collectSchema(x,schema.items,path.concat(i),out));
  }
  if (object(data)) {
    if (schema.minProperties !== undefined && Object.keys(data).length < schema.minProperties) bad("minProperties");
    if (schema.maxProperties !== undefined && Object.keys(data).length > schema.maxProperties) bad("maxProperties");
    if (schema.required) for(const key of schema.required) if(!Object.prototype.hasOwnProperty.call(data,key)) bad("required");
    const properties=schema.properties || {};
    for (const [key,val] of Object.entries(data)) {
      if (Object.prototype.hasOwnProperty.call(properties,key)) collectSchema(val,properties[key],path.concat(key),out);
      else if (schema.additionalProperties === false) bad("additionalProperties");
      else if (object(schema.additionalProperties)) collectSchema(val,schema.additionalProperties,path.concat(key),out);
    }
  }
  if (schema.allOf) for (const s of schema.allOf) collectSchema(data,s,path,out);
  if (schema.if) {
    const condition=[]; collectSchema(data,schema.if,path,condition);
    if(condition.length===0 && schema.then) collectSchema(data,schema.then,path,out);
    if(condition.length!==0 && schema.else) collectSchema(data,schema.else,path,out);
  }
}
function semantic(doc) {
  const out=[];
  const add=(category,code,severity,path,msg)=>out.push(issue(category,code,severity,path,msg));
  const source=doc.source_language, supports=new Set(doc.support_languages);
  const allowed=new Set(doc.response_languages);
  const assessment=doc.use_case === "ASSESSMENT";
  if(supports.has(source))add("languages","SOURCE_AS_SUPPORT","FAIL","/support_languages","Support languages must exclude the source language.");
  if(supports.size && doc.translation_status==="NOT_APPLICABLE")add("languages","TRANSLATION_STATUS_INVALID","FAIL","/translation_status","Support translation cannot be NOT_APPLICABLE.");
  if(supports.size && doc.translation_status==="DRAFT")add("languages","TRANSLATION_REVIEW_REQUIRED","REVIEW","/translation_status","Human subject-matter translation review required.");
  if(!supports.size && doc.translation_status!=="NOT_APPLICABLE")add("languages","TRANSLATION_STATUS_UNUSED","REVIEW","/translation_status","Review translation status.");
  if(doc.profile!=="PARENTS"&&["STUDY","HOMEWORK","ASSESSMENT"].includes(doc.use_case)&&!allowed.size)add("languages","RESPONSE_LANGUAGE_MISSING","REVIEW","/response_languages","Declare permissible response language(s).");
  if(assessment&&doc.profile!=="ASSESSMENT")add("assessment","ASSESSMENT_PROFILE_MISMATCH","FAIL","/profile","Assessments require ASSESSMENT profile.");
  if(doc.profile==="PARENTS"&&doc.use_case!=="NOTICE")add("metadata","PARENTS_USE_CASE_MISMATCH","REVIEW","/use_case","Parent notices normally use NOTICE.");
  const seen=new Set(), exercises=new Set();
  let points=0,missing=false;
  doc.sections.forEach((section,index)=>{
    const path="/sections/"+index;
    if(seen.has(section.section_id))add("sections","DUPLICATE_SECTION_ID","FAIL",path+"/section_id","Section IDs must be unique.");
    seen.add(section.section_id);
    const texts=new Set(Object.keys(section.texts));
    if(!texts.has(source))add("languages","SOURCE_TEXT_MISSING","FAIL",path+"/texts","Source language missing in section.");
    for(const lang of supports)if(!texts.has(lang))add("languages","SUPPORT_TEXT_MISSING","FAIL",path+"/texts","Support language missing in section.");
    for(const lang of texts)if(lang!==source&&!supports.has(lang))add("languages","UNDECLARED_LANGUAGE","FAIL",path+"/texts","Undeclared language in section.");
    if(section.kind==="EXERCISE") {
      exercises.add(section.section_id);
      if(!["FULL_WIDTH_TEXT","FULL_WIDTH_DRAWING"].includes(section.answer_area))
        add("sections","ANSWER_AREA_MISSING","FAIL",path+"/answer_area","Exercise requires full-width answer area.");
      if(Object.prototype.hasOwnProperty.call(section,"points"))points+=section.points;
      else missing=true;
    } else if(section.answer_area!==undefined&&section.answer_area!=="NONE") {
      add("sections","PARAGRAPH_ANSWER_AREA","REVIEW",path+"/answer_area","Paragraph usually should not have an answer area.");
    }
  });
  if("max_points" in doc) {
    if(missing)add("sections","POINTS_INCOMPLETE","REVIEW","/max_points","Exercise points missing.");
    else if(Math.abs(points-doc.max_points)>1e-9)add("sections","POINTS_MISMATCH","FAIL","/max_points","Total does not match exercise points.");
  }
  if(assessment){
    if(!exercises.size)add("assessment","NO_EXERCISES","FAIL","/sections","Assessment requires exercises.");
    const comps=doc.assessment.assessed_competences_per_task;
    for(const id of exercises)if(!Object.prototype.hasOwnProperty.call(comps,id))add("assessment","COMPETENCE_MISSING","FAIL","/assessment/assessed_competences_per_task","Exercise competence missing.");
    for(const id of Object.keys(comps))if(!exercises.has(id))add("assessment","COMPETENCE_ORPHAN","REVIEW","/assessment/assessed_competences_per_task","Unknown exercise competence.");
    if(supports.size)add("assessment","BILINGUAL_ASSESSMENT_HUMAN_REVIEW","REVIEW","/support_languages","Authorization/competence review required.");
  }
  if(doc.status==="RELEASED"){
    const approval=doc.approval||{};
    if(!approval.editor_reviewed)add("metadata","EDITOR_APPROVAL_MISSING","REVIEW","/approval","Released document needs editorial approval evidence.");
    if(supports.size&&!approval.translation_reviewed)add("languages","TRANSLATION_APPROVAL_MISSING","REVIEW","/approval","Released bilingual document needs translation review evidence.");
    if(assessment&&!approval.assessor_approved)add("assessment","ASSESSMENT_APPROVAL_MISSING","REVIEW","/approval","Released assessment needs authorization evidence.");
  }
  return out;
}
/** Validation function with no side effects and no content leakage in findings. */
export function validateDocument(doc, schema) {
  assertSupported(schema);
  const findings=[];
  collectSchema(doc,schema,[],findings);
  if(findings.length===0)findings.push(...semantic(doc));
  findings.sort((a,b)=>(a.category+a.path+a.code).localeCompare(b.category+b.path+b.code));
  const checks={};
  const schemaFailed=findings.some(f=>f.category==="schema");
  for(const category of ["schema","metadata","languages","sections","assessment"])
    checks[category]=(schemaFailed&&category!=="schema")?"NOT_TESTED":status(findings.filter(f=>f.category===category));
  for(const category of NOT_TESTED)checks[category]="NOT_TESTED";
  return {
    report_version:"1.0",engine_version:ENGINE_VERSION,
    standard_version:"DSM-ES-v0.1-community-proposal",
    scope:"Structured JSON deterministic checks only (client-side)",
    overall:status(findings),not_an_official_approval:true,
    checks,findings,finding_count:findings.length,
    disclaimer:"PASS only covers executed V1 checks; not official DSM approval, LRS equivalence, translation quality, or accessible PDF conformance."
  };
}
/** Verify the JSON Schema uses only supported keywords. Throw on drift. */
export function checkSchemaSupport(schema) { assertSupported(schema); return true; }
