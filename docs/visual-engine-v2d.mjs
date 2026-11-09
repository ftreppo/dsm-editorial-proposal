/**
 * DSM-ES-VALIDATOR-002D — numeric PDF text-layout preflight.
 *
 * Source: PDF.js getTextContent + viewport transforms, never private document
 * content in findings. These are approximate glyph/text bounds, NOT a pixel-
 * accurate rendering or a certified institutional branding check.
 *
 * Profile: independent COMMUNITY PROPOSAL, not official DSM Corporate Design.
 */
export const VISUAL_PROFILE="DSM-ES-VISUAL-PROPOSAL-v0.1";
export const VISUAL_RULES=Object.freeze({
  cautionMinimumMarginMm:12,
  cautionBodyFontPt:9.5,
  largeBottomWhitespaceMm:110,
  crossPageLeftMarginDeltaMm:9,
  maxTextItems:250000
});
const MM=25.4/72;
const round=(x,digits=1)=>Number(x.toFixed(digits));
const finding=(category,code,message)=>({category,code,severity:"REVIEW",message});

function multiply(A,B){
  return [
    A[0]*B[0]+A[2]*B[1], A[1]*B[0]+A[3]*B[1],
    A[0]*B[2]+A[2]*B[3], A[1]*B[2]+A[3]*B[3],
    A[0]*B[4]+A[2]*B[5]+A[4], A[1]*B[4]+A[3]*B[5]+A[5]
  ];
}
function finite(v){return typeof v==="number"&&Number.isFinite(v);}
function weightedMedian(samples) {
  if(!samples.length)return null;
  const ordered=samples.slice().sort((a,b)=>a.value-b.value);
  const total=ordered.reduce((sum,x)=>sum+x.weight,0);
  let acc=0;
  for(const x of ordered){
    acc+=x.weight;
    if(acc>=total/2)return x.value;
  }
  return ordered.at(-1).value;
}

/**
 * Per-page metrics derived from text boxes. Do not pass raw text to reports.
 *
 * @param {{pageNumber:number,width:number,height:number,
 *   viewportTransform:number[],items:Array<{str:string,width:number,height:number,transform:number[]}>}} p
 * @returns {{checked:boolean,metrics:object,findings:Array}}
 */
export function analyzeTextLayout(p) {
  if(!p || !finite(p.width)||!finite(p.height)||
     p.width<=0||p.height<=0||!Array.isArray(p.items)||
     p.items.length>VISUAL_RULES.maxTextItems||
     !Array.isArray(p.viewportTransform)||p.viewportTransform.length!==6||
     !p.viewportTransform.every(finite)){
    return {checked:false,metrics:{page:p?.pageNumber??null},findings:[
      finding("layout_preflight","LAYOUT_GEOMETRY_UNAVAILABLE",
        "Text geometry cannot be reliably measured on this page.")
    ]};
  }
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  const fontSamples=[];
  let valid=0,vertical=0;
  for(const item of p.items) {
    if(!item || typeof item.str!=="string" || !item.str.trim() ||
       !Array.isArray(item.transform)||item.transform.length!==6 ||
       !item.transform.every(finite))continue;
    const tx=multiply(p.viewportTransform,item.transform);
    const fontSize=Math.hypot(tx[2],tx[3]);
    if(!finite(fontSize)||fontSize<2||fontSize>140)continue;
    // V2d measures horizontal runs only. Vertical/rotated writing is review.
    if(Math.abs(tx[1])>Math.abs(tx[0])*0.35){vertical++;continue;}
    const x=tx[4],baseline=tx[5];
    const width=Math.abs(item.width);
    const height=Math.abs(item.height);
    if(!finite(width)||!finite(height)||width<=0||height<=0||
       width>p.width*2||height>p.height/2)continue;
    const x1=x,x2=x+width,y1=baseline-height,y2=baseline;
    if(![x1,x2,y1,y2].every(finite)||
       x1 < -4 || y1 < -4 || x2 > p.width+4 || y2 > p.height+4)
       continue;
    valid++;
    left=Math.min(left,x1);top=Math.min(top,y1);
    right=Math.max(right,x2);bottom=Math.max(bottom,y2);
    fontSamples.push({value:fontSize,weight:Math.min(item.str.trim().length,500)});
  }
  if(!valid){
    return {checked:false,metrics:{page:p.pageNumber,text_runs_used:0},findings:[
      finding("layout_preflight","LAYOUT_NO_MEASURABLE_TEXT",
        "No measurable horizontal text geometry was found; inspect the page visually.")
    ]};
  }
  const margins={
    left_mm:round(Math.max(0,left)*MM),
    top_mm:round(Math.max(0,top)*MM),
    right_mm:round(Math.max(0,p.width-right)*MM),
    bottom_mm:round(Math.max(0,p.height-bottom)*MM)
  };
  const body=weightedMedian(fontSamples), maxFont=Math.max(...fontSamples.map(s=>s.value));
  const metrics={
    page:p.pageNumber,
    measured_from:"PDF_TEXT_GEOMETRY_APPROXIMATE",
    page_width_mm:round(p.width*MM),
    page_height_mm:round(p.height*MM),
    margins,
    text_vertical_coverage_pct:round(100*(bottom-top)/p.height),
    median_text_size_pt:round(body),
    maximum_text_size_pt:round(maxFont),
    text_runs_used:valid,
    rotated_text_runs_skipped:vertical
  };
  const findings=[];
  if(Object.values(margins).some(v=>v<VISUAL_RULES.cautionMinimumMarginMm)){
    findings.push(finding("layout_preflight","NARROW_TEXT_MARGIN",
      "One measured text edge is closer than 12 mm to the page edge; review the design profile."));
  }
  if(margins.bottom_mm>VISUAL_RULES.largeBottomWhitespaceMm){
    findings.push(finding("layout_preflight","LARGE_BOTTOM_WHITESPACE",
      "A large blank area follows the extractable text; this can be intentional."));
  }
  if(body<VISUAL_RULES.cautionBodyFontPt){
    findings.push(finding("typography_preflight","SMALL_MEDIAN_TEXT",
      "The median measured text size is under the proposed 9.5 pt caution threshold."));
  }
  if(vertical){
    findings.push(finding("layout_preflight","ROTATED_TEXT_SKIPPED",
      "Some rotated text runs were excluded; geometry needs manual review."));
  }
  return {checked:true,metrics,findings};
}

export function summarizeVisualPages(pages,expectedPages){
  const observed=pages.filter(x=>x?.checked);
  const findings=pages.flatMap(x=>x?.findings||[]);
  if(!observed.length || observed.length!==expectedPages){
    findings.push(finding("layout_preflight","VISUAL_PAGES_INCOMPLETE",
      "Not every page was measured; no full layout preflight result is available."));
  }
  if(observed.length>=2){
    const lefts=observed.map(x=>x.metrics.margins.left_mm);
    if(Math.max(...lefts)-Math.min(...lefts)>VISUAL_RULES.crossPageLeftMarginDeltaMm){
      findings.push(finding("layout_preflight","LEFT_MARGIN_INCONSISTENT",
        "Measured left text margins differ considerably between pages."));
    }
  }
  const checkedAll=observed.length===expectedPages && expectedPages>0;
  const category=(name)=>!checkedAll?"NOT_TESTED":
    findings.some(f=>f.category===name)?"REVIEW":"PASS";
  return {
    profile:VISUAL_PROFILE,
    profile_authority:"INDEPENDENT_COMMUNITY_PROPOSAL_NOT_OFFICIAL_DSM",
    metrics:pages.map(x=>x.metrics),
    findings,
    checks:{
      layout_preflight:category("layout_preflight"),
      typography_preflight:category("typography_preflight"),
      // Visibility of a preview does not prove visual design, accessibility, or brand.
      visual_rendering:"NOT_TESTED",
      institutional_design:"NOT_TESTED",
      bilingual_layout:"NOT_TESTED"
    }
  };
}
