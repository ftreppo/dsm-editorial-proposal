import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {analyzeTextLayout,summarizeVisualPages,VISUAL_RULES,VISUAL_PROFILE}
  from "../docs/visual-engine-v2d.mjs";

const W=595.2756,H=841.8898, viewport=[1,0,0,-1,0,H];
function item({x=57,y=100,size=10,text="SYNTHETIC"}={}){
  // PDF text transform has baseline at H-y. getTextContent width/height are
  // expressed in page points, and viewport flips the vertical direction.
  return {str:text,transform:[size,0,0,size,x,H-y],width:Math.max(20,text.length*size/2),height:size};
}
function page(items,number=1){
 return {pageNumber:number,width:W,height:H,viewportTransform:viewport,items};
}
const codes=x=>x.findings.map(f=>f.code);

test("profile documents community proposal, not official branding",()=>{
  assert.equal(VISUAL_PROFILE,"DSM-ES-VISUAL-PROPOSAL-v0.1");
  assert.equal(VISUAL_RULES.cautionMinimumMarginMm,12);
});
test("text bounds and font size are measured as numeric data",()=>{
  const r=analyzeTextLayout(page([
    item({x:57,y:70,size:18,text:"SYNTHETIC_HEADING"}),
    item({x:57,y:170,size:10,text:"SYNTHETIC_BODY_ONLY"}),
    item({x:57,y:785,size:10,text:"END_OF_PAGE"})
  ]));
  assert.equal(r.checked,true);
  assert.ok(Math.abs(r.metrics.margins.left_mm-20.1)<0.2);
  assert.ok(r.metrics.margins.bottom_mm<25);
  assert.equal(r.metrics.maximum_text_size_pt,18);
  assert.ok(r.metrics.text_runs_used===3);
});
test("large blank bottom is a review, not a failure",()=>{
  const r=analyzeTextLayout(page([item({x:57,y:100,text:"SHORT_SHEET"})],2));
  assert.ok(codes(r).includes("LARGE_BOTTOM_WHITESPACE"));
  const summary=summarizeVisualPages([r],1);
  assert.equal(summary.checks.layout_preflight,"REVIEW");
  assert.equal(summary.checks.visual_rendering,"NOT_TESTED");
  assert.equal(summary.profile_authority,"INDEPENDENT_COMMUNITY_PROPOSAL_NOT_OFFICIAL_DSM");
});
test("narrow text margins get a review warning",()=>{
  const r=analyzeTextLayout(page([item({x:9,y:400,text:"NARROW"})]));
  assert.ok(codes(r).includes("NARROW_TEXT_MARGIN"));
});
test("small dominant font gets a review warning",()=>{
  const r=analyzeTextLayout(page([item({x:57,y:200,size:8.1,text:"SYNTHETIC_TEXT"})]));
  assert.ok(codes(r).includes("SMALL_MEDIAN_TEXT"));
});
test("empty page never claims layout PASS",()=>{
  const r=analyzeTextLayout(page([]));
  assert.equal(r.checked,false);
  const sum=summarizeVisualPages([r],1);
  assert.equal(sum.checks.layout_preflight,"NOT_TESTED");
  assert.equal(sum.checks.typography_preflight,"NOT_TESTED");
  assert.ok(codes(sum).includes("VISUAL_PAGES_INCOMPLETE"));
});
test("a missing page prevents all-pages PASS",()=>{
  const one=analyzeTextLayout(page([item({x:57,y:200})]));
  const two=analyzeTextLayout(page([],2));
  const sum=summarizeVisualPages([one,two],2);
  assert.equal(sum.checks.layout_preflight,"NOT_TESTED");
});
test("different left text margins across pages trigger warning",()=>{
  const first=analyzeTextLayout(page([item({x:57,y:200})],1));
  const next=analyzeTextLayout(page([item({x:93,y:200})],2));
  assert.ok(codes(summarizeVisualPages([first,next],2)).includes("LEFT_MARGIN_INCONSISTENT"));
});
test("rotated items are excluded and signalled",()=>{
  const rotated={str:"SIDEWAYS",width:80,height:10,transform:[0,10,-10,0,57,H-100]};
  const r=analyzeTextLayout(page([item({x:57,y:200}),rotated]));
  assert.ok(codes(r).includes("ROTATED_TEXT_SKIPPED"));
  assert.equal(r.metrics.rotated_text_runs_skipped,1);
});
test("no raw text, filename or student identifier in report",()=>{
  const r=analyzeTextLayout(page([item({x:57,y:200,text:"STUDENT_PRIVATE_83478"})]));
  assert.doesNotMatch(JSON.stringify(r),/STUDENT_PRIVATE_83478/);
});
test("unexpected transforms fail closed",()=>{
  const r=analyzeTextLayout({pageNumber:1,width:W,height:H,
    viewportTransform:[1,0,0,NaN,0,H],items:[item()]});
  assert.equal(r.checked,false);
  assert.ok(codes(r).includes("LAYOUT_GEOMETRY_UNAVAILABLE"));
});
test("site has local preview controls and no remote rendering dependency",()=>{
  const root=new URL("../",import.meta.url);
  const html=readFileSync(new URL("docs/validate.html",root),"utf8");
  const ui=readFileSync(new URL("docs/validator-ui.mjs",root),"utf8");
  const render=readFileSync(new URL("docs/pdf-engine-v2c.mjs",root),"utf8");
  assert.match(html,/id="previewCanvas"/);
  assert.match(html,/id="previewPrev"/);
  assert.match(html,/id="previewNext"/);
  assert.match(ui,/renderLocalPdfPreview/);
  assert.match(render,/page\.render\(/);
  assert.doesNotMatch(render,/<script[^>]+src="https?:\/\//);
});
