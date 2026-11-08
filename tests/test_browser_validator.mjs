import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateDocument, checkSchemaSupport, ENGINE_VERSION} from "../docs/validator-v1.mjs";

const base = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, base), "utf8");
const schema = JSON.parse(read("specification/document.schema.json"));
const mirror = read("docs/specification/document.schema.json");
const fixture = JSON.parse(read("examples/synthetic-physics.json"));
const copy = x => structuredClone(x);
const report = d => validateDocument(d,schema);
const codes = result => result.findings.map(x => x.code);

test("schema subset supported and exactly mirrored on Pages",()=>{
  assert.equal(checkSchemaSupport(schema),true);
  assert.equal(mirror,read("specification/document.schema.json"));
  assert.equal(ENGINE_VERSION,"DSM-ES-VALIDATOR-001/V1-browser");
});
test("synthetic fixture is REVIEW for unreviewed translation",()=>{
  const r=report(fixture);
  assert.equal(r.overall,"REVIEW");
  assert.ok(codes(r).includes("TRANSLATION_REVIEW_REQUIRED"));
  assert.equal(r.checks.lrs_adaptation,"NOT_TESTED");
});
test("reviewed draft passes structural V1 only",()=>{
  const d=copy(fixture);d.translation_status="REVIEWED";
  const r=report(d);
  assert.equal(r.overall,"PASS");
  assert.equal(r.not_an_official_approval,true);
  assert.equal(r.checks.source_fidelity,"NOT_TESTED");
});
test("required title rejected",()=>{
  const d=copy(fixture);delete d.title;
  assert.equal(report(d).overall,"FAIL");
  assert.ok(codes(report(d)).includes("SCHEMA_REQUIRED"));
});
test("unknown root property rejected",()=>{
  const d=copy(fixture);d.unknown="x";
  assert.ok(codes(report(d)).includes("SCHEMA_ADDITIONALPROPERTIES"));
});
test("invalid 2026-02-30 date rejected",()=>{
  const d=copy(fixture);d.date="2026-02-30";
  assert.ok(codes(report(d)).includes("SCHEMA_FORMAT"));
});
test("source as support fails",()=>{
  const d=copy(fixture);d.support_languages=["de","it"];
  assert.ok(codes(report(d)).includes("SOURCE_AS_SUPPORT"));
});
test("missing declared support text fails",()=>{
  const d=copy(fixture);delete d.sections[0].texts.it;
  assert.ok(codes(report(d)).includes("SUPPORT_TEXT_MISSING"));
});
test("undeclared section language fails",()=>{
  const d=copy(fixture);d.support_languages=[];d.translation_status="NOT_APPLICABLE";
  assert.ok(codes(report(d)).includes("UNDECLARED_LANGUAGE"));
});
test("missing response area fails",()=>{
  const d=copy(fixture);d.sections[0].answer_area="NONE";
  assert.ok(codes(report(d)).includes("ANSWER_AREA_MISSING"));
});
test("duplicate section ID fails",()=>{
  const d=copy(fixture);d.sections.push(copy(d.sections[0]));
  assert.ok(codes(report(d)).includes("DUPLICATE_SECTION_ID"));
});
test("total points mismatch fails",()=>{
  const d=copy(fixture);d.max_points=3;
  assert.ok(codes(report(d)).includes("POINTS_MISMATCH"));
});
test("assessment without metadata fails schema",()=>{
  const d=copy(fixture);d.profile="ASSESSMENT";d.use_case="ASSESSMENT";
  assert.ok(codes(report(d)).includes("SCHEMA_REQUIRED"));
});
test("assessment competence and bilingual gates",()=>{
  const d=copy(fixture);d.profile="ASSESSMENT";d.use_case="ASSESSMENT";
  d.assessment={restrictions:[],assessed_competences_per_task:{other:"Ray path"}};
  assert.ok(codes(report(d)).includes("COMPETENCE_MISSING"));
  assert.ok(codes(report(d)).includes("BILINGUAL_ASSESSMENT_HUMAN_REVIEW"));
});
test("released document missing review metadata needs human review",()=>{
  const d=copy(fixture);d.status="RELEASED";
  assert.ok(codes(report(d)).includes("EDITOR_APPROVAL_MISSING"));
});
test("sensitive field text is never included in findings",()=>{
  const d=copy(fixture);d.sections[0].texts.de="PRIVATE_SENTINEL_78945";
  assert.doesNotMatch(JSON.stringify(report(d)),/PRIVATE_SENTINEL/);
});
test("unknown future schema rule fails closed",()=>{
  const extra=copy(schema);extra.properties.title.pattern="^ABC";
  assert.throws(()=>checkSchemaSupport(extra),/Unsupported JSON Schema keyword/);
});
test("section structure preserves assessment schema if/then",()=>{
  const d=copy(fixture);d.profile="ASSESSMENT";d.use_case="STUDY";
  assert.ok(codes(report(d)).includes("SCHEMA_CONST"));
});
