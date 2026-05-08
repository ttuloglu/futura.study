import{g as _t,J as rr}from"./index-BHsReuS5.js";import{s as tt,k as ir}from"./markdown-B49XpgWn.js";import{a as nr,r as zt,g as Ze,c as or}from"./firebase-storage-DSFj8cqr.js";import{F as fe,D as Oe,C as _e}from"./native-CNv3aUEx.js";import{e as Ct,u as Ve}from"./ai-DmL5QL3R.js";import"./react-vendor-C0FGkIV1.js";import"./icons-DQ56R61j.js";import"./firebase-firestore-BGG1TBHB.js";import"./firebase-core-DNQqdNgw.js";import"./firebase-functions-CX-cRT_3.js";import"./firebase-auth-BnC0e2V7.js";let ze=null;function bt(t){return`${"/".endsWith("/")?"/":"//"}vendor/${t}`}function yt(t){return new Promise((e,r)=>{const i=document.querySelector(`script[src="${t}"]`);if(i){if(i.dataset.loaded==="true"){e();return}i.addEventListener("load",()=>e(),{once:!0}),i.addEventListener("error",()=>r(new Error(`Failed to load ${t}`)),{once:!0});return}const n=document.createElement("script");n.src=t,n.async=!0,n.addEventListener("load",()=>{n.dataset.loaded="true",e()},{once:!0}),n.addEventListener("error",()=>r(new Error(`Failed to load ${t}`)),{once:!0}),document.head.appendChild(n)})}async function Pt(){var t;return(t=window.pdfMake)!=null&&t.createPdf?window.pdfMake:(ze||(ze=(async()=>{var e;if(await yt(bt("pdfmake.min.js")),await yt(bt("vfs_fonts.js")),!((e=window.pdfMake)!=null&&e.createPdf))throw new Error("pdfMake failed to initialize");return window.pdfMake})().catch(e=>{throw ze=null,e})),ze)}const xt=7e3,ar=15e3,Ne=8,sr=10,Ft="#d9f2ff",$t=1800,lr=.9,cr=280*1024,mr=.97,Le=595.28,Et=841.89,le=40,He=Le-le*2,Pe=2,dr=1.3,ur=320,gr=260,Bt=t=>{var s;const r=(s=String(t||"").trim().match(/^#([0-9a-f]{6})$/i))==null?void 0:s[1];if(!r)return!1;const i=parseInt(r.slice(0,2),16),n=parseInt(r.slice(2,4),16),a=parseInt(r.slice(4,6),16);return(.2126*i+.7152*n+.0722*a)/255<.35},rt=(t,e,r="kitap")=>`${String(t||"").normalize("NFC").replace(/\s+/g," ").trim()||r}.${e}`,Qe=`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4F9B43" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"></circle>
  <line x1="14.31" y1="8" x2="20.05" y2="17.94"></line>
  <line x1="9.69" y1="8" x2="21.17" y2="8"></line>
  <line x1="7.38" y1="12" x2="13.12" y2="2.06"></line>
  <line x1="9.69" y1="16" x2="3.95" y2="6.06"></line>
  <line x1="14.31" y1="16" x2="2.83" y2="16"></line>
  <line x1="16.62" y1="12" x2="10.88" y2="21.94"></line>
</svg>
`,At=t=>[{type:"rect",x:0,y:0,w:Le,h:Et,color:t}],Lt=(t,e,r=le)=>{const i=Bt(e),n=i?"#f8fafc":"#14324b",a=i?"#dbeafe":"#28506d",o=i?"#7dd3fc":"#9fc5de";return{margin:[r,18,r,0],stack:[{columns:[{width:"*",stack:[{text:String(t||"").trim()||"Fortale",bold:!0,fontSize:15,color:n}]},{width:"auto",columns:[{width:18,svg:Qe,margin:[0,-1,6,0]},{width:"auto",text:"Fortale",bold:!0,fontSize:11,color:a,margin:[0,2,0,0]}]}],columnGap:12},{canvas:[{type:"line",x1:0,y1:0,x2:Le-r*2,y2:0,lineWidth:.8,lineColor:o}],margin:[0,8,0,0]}]}},ne=t=>{const e=String(t||"").trim();if(!e)return"";const r=e.match(/^<([^>]+)>(?:\s+["'][^"']*["'])?$/);if(r!=null&&r[1])return r[1].trim();const i=e.match(/^(\S+)(?:\s+["'][^"']*["'])?$/);return i!=null&&i[1]?i[1].trim():e.startsWith("<")&&e.endsWith(">")?e.slice(1,-1).trim():e},It=t=>new Promise(e=>{const r=new FileReader;r.onloadend=()=>e(typeof r.result=="string"?r.result:null),r.onerror=()=>e(null),r.readAsDataURL(t)}),pr=t=>new Promise(e=>{const r=new Image;r.onload=()=>{try{const i=r.naturalWidth||r.width,n=r.naturalHeight||r.height;if(!i||!n){e(null);return}const a=document.createElement("canvas");a.width=i,a.height=n;const o=a.getContext("2d");if(!o){e(null);return}o.drawImage(r,0,0,i,n),e(a.toDataURL("image/png"))}catch{e(null)}},r.onerror=()=>e(null),r.src=t}),Tt=async t=>{const e=String(t||"").match(/^data:(image\/[a-z0-9.+-]+);base64,/i);if(!e)return null;const r=e[1].toLowerCase();return r==="image/png"||r==="image/jpeg"||r==="image/jpg"?t:pr(t)},fr=t=>new Promise(e=>{const r=new Image;r.onload=()=>{const i=r.naturalWidth||r.width||0,n=r.naturalHeight||r.height||0;if(!i||!n){e(null);return}e({width:i,height:n})},r.onerror=()=>e(null),r.src=t}),be=async t=>{const e=ne(t);if(!e)return null;try{if(/^data:image\//i.test(e)){const s=await Mr(e)||e;return Tt(s)}const r=await Kt(e);if(!r)throw new Error("Blob could not be loaded");const i=await lt(r),n=await It(i);if(!n)return null;const a=await Tt(n);return a||(console.warn("Unsupported image format for PDF:",e),null)}catch(r){return console.warn("Failed to load image for PDF:",e,r),null}},hr=[[/\\sum/g,"∑"],[/\\prod/g,"∏"],[/\\times/g,"×"],[/\\cdot/g,"·"],[/\\div/g,"÷"],[/\\pm/g,"±"],[/\\mp/g,"∓"],[/\\neq/g,"≠"],[/\\ne/g,"≠"],[/\\leq/g,"≤"],[/\\geq/g,"≥"],[/\\approx/g,"≈"],[/\\sim/g,"∼"],[/\\to/g,"→"],[/\\rightarrow/g,"→"],[/\\leftarrow/g,"←"],[/\\infty/g,"∞"],[/\\in/g,"∈"],[/\\notin/g,"∉"],[/\\subseteq/g,"⊆"],[/\\subset/g,"⊂"],[/\\supseteq/g,"⊇"],[/\\cup/g,"∪"],[/\\cap/g,"∩"],[/\\forall/g,"∀"],[/\\exists/g,"∃"],[/\\therefore/g,"∴"],[/\\because/g,"∵"],[/\\alpha/g,"α"],[/\\beta/g,"β"],[/\\gamma/g,"γ"],[/\\delta/g,"δ"],[/\\epsilon/g,"ε"],[/\\theta/g,"θ"],[/\\lambda/g,"λ"],[/\\mu/g,"μ"],[/\\pi/g,"π"],[/\\sigma/g,"σ"],[/\\phi/g,"φ"],[/\\omega/g,"ω"],[/\\Delta/g,"Δ"],[/\\Sigma/g,"Σ"],[/\\Pi/g,"Π"],[/\\Omega/g,"Ω"]],wr={0:"⁰",1:"¹",2:"²",3:"³",4:"⁴",5:"⁵",6:"⁶",7:"⁷",8:"⁸",9:"⁹","+":"⁺","-":"⁻","=":"⁼","(":"⁽",")":"⁾",n:"ⁿ",i:"ⁱ"},br={0:"₀",1:"₁",2:"₂",3:"₃",4:"₄",5:"₅",6:"₆",7:"₇",8:"₈",9:"₉","+":"₊","-":"₋","=":"₌","(":"₍",")":"₎"},Ye=t=>String(t||"").split("").map(e=>wr[e]||e).join(""),Ce=t=>String(t||"").split("").map(e=>br[e]||e).join(""),yr=t=>String(t||"").replace(/\\\[\s*([\s\S]*?)\s*\\\]/g,(e,r)=>` $$${String(r||"").trim()}$$ `).replace(/\\\(\s*([\s\S]*?)\s*\\\)/g,(e,r)=>` $${String(r||"").trim()}$ `),Ge=t=>{let e=String(t||"").trim();if(!e)return"";for(let r=0;r<4;r+=1){const i=e;if(e=e.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g,"($1/$2)").replace(/\\sqrt\s*\{([^{}]+)\}/g,"√($1)").replace(/\\text\s*\{([^{}]+)\}/g,"$1").replace(/\\operatorname\s*\{([^{}]+)\}/g,"$1"),e===i)break}for(const[r,i]of hr)e=e.replace(r,i);return e=e.replace(/\\vec\s*\{([^{}]+)\}/g,(r,i)=>`${String(i||"").trim()}⃗`).replace(/\\vec\s*([A-Za-z0-9])/g,(r,i)=>`${String(i||"").trim()}⃗`).replace(/\\left|\\right/g,"").replace(/\\,/g," ").replace(/\\;/g," ").replace(/\\:/g," ").replace(/\\!/g,"").replace(/\\_/g,"_").replace(/\\%/g,"%").replace(/\\#/g,"#").replace(/\\&/g,"&").replace(/[{}]/g,"").replace(/\s+/g," ").trim(),e=e.replace(/\^\{([^{}]+)\}/g,(r,i)=>Ye(String(i||"").trim())).replace(/\^([A-Za-z0-9+\-=()])/g,(r,i)=>Ye(String(i||"").trim())).replace(/_\{([^{}]+)\}/g,(r,i)=>Ce(String(i||"").trim())).replace(/_([A-Za-z0-9+\-=()])/g,(r,i)=>Ce(String(i||"").trim())).replace(/([A-Za-z])([0-9]{1,3})\b/g,(r,i,n)=>`${i}${Ce(n)}`),e},X=t=>yr(t).replace(/\$\$([\s\S]+?)\$\$/g,(r,i)=>` ${Ge(String(i||""))} `).replace(/\$([^$\n]+)\$/g,(r,i)=>` ${Ge(String(i||""))} `).replace(/\\vec\s*([A-Za-z0-9])/g,"\\vec{$1}").replace(/\\sum\\vec/g,"\\sum \\vec").replace(/\\(?:sum|prod|vec|frac|sqrt|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|phi|omega|Delta|Sigma|Pi|Omega|times|cdot|div|pm|mp|neq|ne|leq|geq|approx|sim|to|rightarrow|leftarrow|infty|in|notin|subseteq|subset|supseteq|cup|cap|forall|exists|therefore|because)\b[^\n]*/g,r=>Ge(r)).replace(/([A-Za-z])\^([0-9]+)/g,(r,i,n)=>`${i}${Ye(String(n||""))}`).replace(/([A-Za-z])_([0-9]+)/g,(r,i,n)=>`${i}${Ce(String(n||""))}`),K=t=>t.replace(/\*\*\*\*/g,"").replace(/\*\*\*/g,"").replace(/\*\*/g,"").replace(/\*/g,"").replace(/___/g,"").replace(/__/g,""),H=t=>{const e=[],r=/(\*\*\*.+?\*\*\*|___.+?___|\*\*.+?\*\*|__.+?__|~~.+?~~|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;let i=0,n,a=X(t);for(;(n=r.exec(a))!==null;){n.index>i&&e.push({text:a.slice(i,n.index)});const s=n[0];s.startsWith("***")&&s.endsWith("***")||s.startsWith("___")&&s.endsWith("___")?e.push({text:s.slice(3,-3),bold:!0,italics:!0}):s.startsWith("**")&&s.endsWith("**")||s.startsWith("__")&&s.endsWith("__")?e.push({text:s.slice(2,-2),bold:!0}):s.startsWith("*")&&s.endsWith("*")||s.startsWith("_")&&s.endsWith("_")?e.push({text:s.slice(1,-1),italics:!0}):s.startsWith("`")&&s.endsWith("`")?e.push({text:s.slice(1,-1),background:"#f0f0f0",font:"Courier"}):s.startsWith("~~")&&s.endsWith("~~")?e.push({text:s.slice(2,-2),decoration:"lineThrough"}):e.push({text:s}),i=r.lastIndex}i<a.length&&e.push({text:a.slice(i)});const o=e.map(s=>!s.bold&&!s.italics&&!s.decoration&&!s.background&&typeof s.text=="string"?{...s,text:K(s.text)}:s).filter(s=>s.text!=="");return o.length>0?o:[{text:X(t)}]},xr=()=>({canvas:[{type:"line",x1:0,y1:0,x2:510,y2:0,lineWidth:.8,lineColor:"#6E8D78",dash:{length:4,space:3}}],margin:[0,-1,0,10]}),Xe=()=>({canvas:[{type:"line",x1:0,y1:0,x2:510,y2:0,lineWidth:.8,lineColor:"#6E8D78",dash:{length:4,space:3}}],margin:[0,3,0,6]}),$r=()=>({stack:[{canvas:[{type:"line",x1:0,y1:0,x2:510,y2:0,lineWidth:1,lineColor:"#5B7A99"}],margin:[0,0,0,3]},{canvas:[{type:"line",x1:0,y1:0,x2:510,y2:0,lineWidth:.7,lineColor:"#7F9AB6",dash:{length:2,space:4}}],margin:[0,0,0,0]}],margin:[0,0,0,7]}),Dt=t=>t==="fairy_tale"?"Masal":t==="story"?"Hikaye":t==="novel"?"Roman":"Akademik",xe=t=>{const e=t.trim();return e.startsWith("|")?e.split("|").slice(1,-1).map(r=>r.trim()).filter((r,i,n)=>i<n.length):[]},Fe=t=>{const e=xe(t);return e.length?e.every(r=>/^:?-{3,}:?$/.test(r.replace(/\s+/g,""))):!1},vt=(t,e)=>{const r=t.slice(0,e).map(i=>i.trim());for(;r.length<e;)r.push("");return r},Ut=(t,e)=>{var s,l,m;const r=((s=t[e])==null?void 0:s.trim())||"",i=((l=t[e+1])==null?void 0:l.trim())||"";if(!r.startsWith("|")||!Fe(i))return null;const n=xe(r).map(d=>d.trim());if(!n.length||n.every(d=>!d)||n.some(d=>/!\[[^\]]*]\(([^)]+)\)/.test(d)))return null;const a=[];let o=e+2;for(;o<t.length;){const d=((m=t[o])==null?void 0:m.trim())||"";if(!d.startsWith("|")||Fe(d))break;const p=xe(d);if(!p.length)break;a.push(vt(p,n.length)),o+=1}return a.length?{headers:vt(n,n.length),rows:a,endIndex:o-1}:null},Mt=t=>{const e=String(t||"").trim().toLocaleLowerCase("tr-TR");return e?e==="doğru"||e==="dogru"||e==="true"?"true":e==="yanlış"||e==="yanlis"||e==="false"?"false":null:null},Tr=t=>{const e=Array.isArray(t==null?void 0:t.options)?t.options:[];if(e.length!==2)return!1;const r=e.map(Mt);return r.includes("true")&&r.includes("false")},vr=t=>{let e=String(t||"").replace(/\((?:\s*doğru\s*\/\s*yanlış\s*|true\s*\/\s*false\s*)\)/gi," ").replace(/\b(doğru\s*mu|yanlış\s*mı|true\s*or\s*false)\b/gi," ").replace(/\s+/g," ").trim();if(e=e.replace(/\s*[?？]\s*$/,"").trim(),!e)return"";const r=e;return e=e.replace(/\bdeğildir\b/gi,"dir").replace(/\bdeğil\b/gi,"").replace(/\s+/g," ").trim(),e.endsWith(".")||(e+="."),e.toLocaleLowerCase("tr-TR")===r.toLocaleLowerCase("tr-TR")||e.length<12?"":e},Rt=t=>{var i,n;if(!Tr(t)){const a=String.fromCharCode(65+(t.correctAnswer??0)),o=((i=t.options)==null?void 0:i[t.correctAnswer??0])||"";return{prefix:"Cevap",text:`${a}) ${o}`}}if(Mt(((n=t.options)==null?void 0:n[t.correctAnswer??0])||"")==="true")return{prefix:"Doğrulama",text:"Bu ifade doğrudur."};const r=vr(t.question||"");return r?{prefix:"Doğru bilgi",text:r}:{prefix:"Doğru bilgi",text:"Bu ifade hatalıdır; doğru bilgi ilgili bölüm açıklamalarında verilmiştir."}},qt=t=>{const e=t.match(/!\[([^\]]*)\]\(([^)]+)\)/);return e?{alt:e[1]||"",url:ne(e[2]||"")}:null},Ie=(t,e)=>{const r=(t||"").replace(/\s+/g," ").trim();if(!r)return"";let i=r;const n=a=>{i=i.replace(a,"").trim()};return e==="quiz"?n(/\s*(?:[-–:]\s*)?(?:quiz|test)\s*$/i):e==="exam"?n(/\s*(?:[-–:]\s*)?(?:genel\s*)?(?:sınav|exam|test)\s*$/i):e==="podcast"?n(/\s*(?:[-–:]\s*)?(?:podcast)\s*$/i):e==="lecture"?n(/\s*(?:[-–:]\s*)?(?:giriş|giris|lecture|introduction)\s*$/iu):e==="reinforce"?n(/\s*(?:[-–:]\s*)?(?:peki[şs]t[iı]rme|pekistirme|detaylar|detay|details?|reinforcement|geli[şs]me|development)\s*$/iu):e==="retention"&&n(/\s*(?:[-–:]\s*)?(?:kalıcılık|kalicilik|özet(?:\s*bilgi)?|ozet(?:\s*bilgi)?|summary(?:\s*card)?|sonu[çc]|conclusion)\s*$/iu),i||r},it=t=>{const e=(t||"").replace(/\s+/g," ").trim();return e&&(e.replace(/^(?:giriş|giris|lecture|introduction)\s*[:：-]\s*/iu,"").replace(/\s*(?:[-–:]\s*)?(?:giriş|giris|lecture|introduction)\s*$/iu,"").replace(/\s+/g," ").trim()||e)},nt=t=>{const e=(t||"").replace(/\s+/g," ").trim();return e&&(e.replace(/^(?:peki[şs]t[iı]rme|pekistirme|detaylar|detay|details?|reinforcement|geli[şs]me|development)\s*[:：-]\s*/iu,"").replace(/\s*(?:[-–:]\s*)?(?:peki[şs]t[iı]rme|pekistirme|detaylar|detay|details?|reinforcement|geli[şs]me|development)\s*$/iu,"").replace(/\s+/g," ").trim()||e)},he=t=>{const e=K(X(String(t||""))).replace(/^#{1,6}\s+/,"").replace(/^>\s?/,"").replace(/[“”"'`´]/g,"").replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim();return e?e.toLocaleLowerCase("tr-TR"):""},Sr=t=>t==="lecture"?/^(\s*#{1,6}\s*)?(?:giriş|giris|introduction|lecture)\s*[:：-]\s*/iu:t==="reinforce"?/^(\s*#{1,6}\s*)?(?:peki[şs]t[iı]rme|pekistirme|detaylar|detay|details?|reinforcement|geli[şs]me|development)\s*[:：-]\s*/iu:t==="retention"?/^(\s*#{1,6}\s*)?(?:özet(?:\s*bilgi)?|ozet(?:\s*bilgi)?|summary(?:\s*card)?|kavram\s*haritası|kavram\s*haritasi|sonu[çc]|conclusion)\s*[:：-]\s*/iu:t==="podcast"?/^(\s*#{1,6}\s*)?(?:podcast)\s*[:：-]\s*/i:null,kr=t=>t==="lecture"?/^(?:giriş|giris|introduction|lecture)\s*[:：-]\s*/iu:t==="reinforce"?/^(?:peki[şs]t[iı]rme|pekistirme|detaylar|detay|details?|reinforcement|geli[şs]me|development)\s*[:：-]\s*/iu:t==="retention"?/^(?:özet(?:\s*bilgi)?|ozet(?:\s*bilgi)?|summary(?:\s*card)?|kavram\s*haritası|kavram\s*haritasi|sonu[çc]|conclusion)\s*[:：-]\s*/iu:t==="podcast"?/^(?:podcast)\s*[:：-]\s*/i:null,_r=(t,e)=>{const r=Sr(e);return r?t.replace(r,"$1"):t},zr=(t,e)=>{const r=kr(e);return r?t.replace(r,"").trim():t},ot=(t,e)=>{const r=he(t);return r?e==="lecture"?/^(giriş|giris|introduction|lecture)$/.test(r):e==="reinforce"?/^(pekiştirme|pekistirme|detaylar|detay|details?|reinforcement|gelişme|gelisme|development)$/.test(r):e==="retention"?/^(özet|ozet|özet bilgi|ozet bilgi|summary|summary card|kavram haritası|kavram haritasi|sonuç|sonuc|conclusion)$/.test(r):e==="podcast"?/^podcast$/.test(r):!1:!0},Ee=(t,e)=>{const r=he(t);return r?e==="quiz"?/^(quiz|test|kısa quiz|kisa quiz|mini quiz|soru seti)$/.test(r):e==="exam"?/^(sınav|sinav|exam|test|ana sınav|ana sinav|genel sınav|genel sinav)$/.test(r):ot(t,e):!0},at=t=>{const e=[t.courseTopic,Ie(t.nodeTitle,t.nodeType),t.contentTitle].map(r=>he(r)).filter(Boolean);return new Set(e)},Be=(t,e)=>{const r=he(t);return!!r&&e.has(r)},Cr=/^\s*[*_~`]*\s*g[öo]rsel\s+\d+\s*\/\s*\d+\s*(?:-\s*.+)?\s*[*_~`]*\s*$/iu,Pr=/^\s*[*_~`]*\s*(?:global sequence index|scene excerpt for this specific image|previous scene cue|narrative timeline lock|visual structure requirement|panel-to-grid mapping)\b/iu,Fr=t=>String(t||"").split(`
`).filter(r=>{const i=K(X(r)).trim();return i?!(Cr.test(i)||Pr.test(i)):!0}).join(`
`).replace(/\n{3,}/g,`

`).trim(),Wt=(t,e)=>{const r=Fr(t).split(`
`);if(!r.length)return"";const i=at(e);if(i.size===0)return r.join(`
`);let n=0,a=0;for(;a<r.length&&n<10;){const o=r[a],s=o.trim();if(!s){a+=1;continue}n+=1;const l=s.replace(/^#{1,6}\s+/,"").replace(/^>\s?/,"").trim(),m=zr(l,e.nodeType);if(ot(l,e.nodeType)||Be(l,i)||m!==l&&Be(m,i)){r.splice(a,1);continue}m!==l&&m&&(r[a]=_r(o,e.nodeType));break}return r.join(`
`)},Er=async(t,e)=>{var dt,ut,gt;const r=await mt(t),i=r.bookType==="fairy_tale"||r.bookType==="story"||r.bookType==="novel",n=[],a=((dt=e==null?void 0:e.backgroundColor)==null?void 0:dt.trim())||Ft,o=Bt(a),s=o?"#F8FAFC":"#1F2937",l=o?"#D8E3F0":"#4B5563",m=o?"#BCC9D8":"#6B7280",d=o?"#FFFFFF":"#1F4D7A",p=o?"#F4F7FB":"#1F2937",f=o?"#DCE5EF":"#334155",w=o?"#FFFFFF":"#1A1A1A",F=o?"#F8FAFC":"#0F172A",B=o?"#334155":"#E8EEF8",v=o?"#1F2937":"#F8FAFC",U=o?"#111827":"#FFFFFF",g=o?"#64748B":"#A8B8CC",Z=o?"#1F2937":"#F8FAFC",x=o?"#E5EEF9":"#334155",M=o?"#BFDBFE":"#0F3C72",S=o?"#BBF7D0":"#14532D",A=(r.bookType==="fairy_tale",1),_=r.bookType==="fairy_tale"?64:14,me=(b,c=[0,2,0,6])=>({text:H(b),fontSize:11,lineHeight:1.4,margin:c,alignment:"justify",color:p}),de=async b=>{const c=await fr(b),z=c&&c.height>0?c.width/c.height:null;return i?{image:b,width:He,margin:[0,8,0,10],alignment:"center"}:z&&z>=dr?{image:b,width:He,margin:[0,8,0,8],alignment:"center"}:{image:b,fit:[He,i?gr:ur],margin:[0,8,0,8],alignment:"center"}},ue=b=>{if(Array.isArray(b))return b.map(z=>ue(z));if(!b||typeof b!="object")return b;const c={};for(const[z,ee]of Object.entries(b)){if(z==="fontSize"&&typeof ee=="number"&&Number.isFinite(ee)){c[z]=ee<=_?Math.round((ee+A)*10)/10:ee;continue}c[z]=ue(ee)}return c},k=r.coverImageUrl?await be(r.coverImageUrl):null,R=new Date(r.createdAt||new Date).toLocaleDateString("tr-TR",{day:"2-digit",month:"short",year:"numeric"}),V=_t(r.ageGroup),q=Dt(r.bookType),Y=(r.subGenre||"").trim()||"Belirtilmedi",W=(r.category||"Belirtilmedi").trim(),ie=(r.creatorName||"Anonim").trim(),Ue=`hsl(${Math.abs((r.topic||"").split("").reduce((b,c)=>b*31+c.charCodeAt(0),0))%360}, 42%, 28%)`;let J=0;const Vt=k?{image:k,fit:[78,104],alignment:"left"}:{stack:[{canvas:[{type:"rect",x:0,y:0,w:78,h:104,r:2,color:Ue}]},{columns:[{width:10,svg:Qe,margin:[10,-62,2,0]},{width:"*",text:"Fortale",color:"#ffffff",fontSize:10,bold:!0,margin:[0,-62,0,0]}],columnGap:0}]};n.push({columns:[{width:86,stack:[Vt]},{width:"*",stack:[{text:r.topic,fontSize:18,bold:!0,color:s,margin:[0,2,0,8]},{text:`Tür: ${q} • Alt Tür: ${Y} • ${V} • Kategori: ${W}`,fontSize:10.5,color:l,margin:[0,0,0,6]},{columns:[{width:"auto",text:`Kurgulayan: ${ie} | ${R} |`,fontSize:10,color:m},{width:11,svg:Qe,margin:[0,.6,0,0]},{width:"auto",text:"Fortale I Build Your Epic",fontSize:10.2,bold:!0,color:d}],columnGap:2}]}],columnGap:14,margin:[0,0,0,12]}),n.push(xr()),n.push({text:" ",fontSize:10,margin:[0,0,0,6]});for(let b=0;b<r.nodes.length;b++){const c=r.nodes[b],z=Ie(c.title,c.type),ee=ct(r,c),Yt=at({nodeType:c.type,courseTopic:r.topic,nodeTitle:c.title,contentTitle:ee});let oe=z;if(c.type==="lecture"&&!i)oe="GİRİŞ";else if(c.type==="podcast")oe=`PODCAST: ${z}`;else if(c.type==="quiz"){const u=c.questions?` • ${c.questions.length} Soru`:"";oe=Ee(z,"quiz")?`QUİZ${u}`:`QUİZ: ${z}${u}`}else if(c.type==="reinforce")oe=i?"GELİŞME":"DETAYLAR";else if(c.type==="exam"){const u=c.questions?` • ${c.questions.length} Soru`:"";oe=Ee(z,"exam")?`GENEL SINAV${u}`:`GENEL SINAV: ${z}${u}`}else c.type==="retention"&&(oe=i?"SONUÇ":"ÖZET");n.push({text:oe,fontSize:14,bold:!0,margin:[0,b===0?0:5,0,5],color:s}),n.push($r());let te="";const Me=c.type==="quiz"||c.type==="exam"||c.type==="retention";c.type==="podcast"&&c.podcastScript?te=c.podcastScript:Me&&c.questions&&c.questions.length>0?te=c.questions.map((u,L)=>{const O=u.options.map((C,Se)=>`${String.fromCharCode(65+Se)}) ${C}`).join(`
`),se=L<c.questions.length-1?`
---
`:"";return`**Soru ${L+1}:** ${u.question}
${O}${se}
`}).join(`
`):c.content?te=c.content:te="_Henüz içerik oluşturulmamış._",c.type!=="quiz"&&c.type!=="exam"&&(te=Wt(te,{nodeType:c.type,courseTopic:r.topic,nodeTitle:c.title,contentTitle:ee}));const pt=Ct(te),Jt=pt.images;te=pt.markdown;const Q=te.split(`
`);let Re=!1,qe=[],ft=!1,E=!1;const ht=u=>{const L=K(X(u)).trim();if(!L.endsWith(":"))return!1;const O=L.slice(0,-1).trim();return O?O.split(/\s+/).filter(Boolean).length<=6:!1};let Te=0,ve=[];const We=(u=!1)=>{ve.length&&(u||Te>=Pe)&&(n.push(...ve),ve=[])},ae=(u=1)=>{Te+=u,We()},ge=(u,L=!1)=>{if(L||Te>=Pe){n.push(u);return}ve.push(u)};for(const u of Jt){if(J>=Ne)break;const L=ne(u.src),O=await be(L);if(O){J+=1;const se=await de(O);ge(se,!0)}else ge({text:`[Görsel İndirilemedi: ${L}]`,color:"#999999",italics:!0},!0)}const j=()=>{Re&&(n.push({ul:qe,margin:[0,2,0,6],fontSize:11}),qe=[],Re=!1,ae())},wt=/!\[([^\]]*)\]\(([^)]+)\)/g;for(let u=0;u<Q.length;u++){let O=Q[u];const se=()=>{for(let T=u+1;T<Q.length;T++){const h=Q[T].trim();if(!(!h||h==="---"||h==="--"))return h}return null},C=O.trim();if(!C){j();continue}if(C==="---"||C==="--"){j(),Me&&n.push(Xe());continue}if(C.startsWith("|")){const T=((ut=Q[u+1])==null?void 0:ut.trim())||"",h=((gt=Q[u+2])==null?void 0:gt.trim())||"";if(Fe(T)&&h.startsWith("|")){const I=xe(C),D=I.map(qt).filter(N=>!!N);if(D.length>=2){j(),E=!1;const N=Math.max(0,Ne-J),pe=D.slice(0,Math.min(2,N));if(pe.length===0){u+=2;continue}const ke=await Promise.all(pe.map(async re=>{const er=ne(re.url),je=await be(er),tr=je?await de(je):null;return{...re,base64Data:je,imageBlock:tr}}));J+=ke.filter(re=>!!re.base64Data).length,ke.forEach(re=>{if(re.imageBlock){ge(re.imageBlock);return}ge({text:"[Görsel İndirilemedi]",color:"#999999",italics:!0,alignment:"center",margin:[0,20,0,8]})}),u+=2;continue}if(I.length>=2&&I.slice(0,2).every(N=>!N.trim())){j(),E=!1,u+=2;continue}}const $=Ut(Q,u);if($){j(),E=!1;const I=[$.headers.map(D=>({text:H(X(K(D))),bold:!0,color:F,margin:[6,5,6,5]})),...$.rows.map(D=>D.map(N=>({text:H(X(K(N))),color:p,margin:[6,5,6,5]})))];n.push({table:{headerRows:1,widths:Array($.headers.length).fill("*"),body:I},layout:{fillColor:D=>D===0?B:D%2===0?v:U,hLineColor:()=>g,vLineColor:()=>g,hLineWidth:()=>.8,vLineWidth:()=>.8},margin:[0,8,0,10]}),ae(),u=$.endIndex;continue}}wt.lastIndex=0;let Se=wt.exec(C);if(Se){if(j(),J>=Ne){E=!1;continue}const T=Se[2],h=ne(T),$=await be(h);if($){E=!1,J+=1;const I=await de($);ge(I)}else E=!1,ge({text:`[Görsel İndirilemedi: ${h}]`,color:"#999999",italics:!0});continue}const we=C.match(/^(#{1,6})\s+(.*)/);if(we){j();const T=we[1].length,h=c.type==="lecture"?it(we[2]):c.type==="reinforce"?nt(we[2]):we[2];if(c.type==="lecture"||c.type==="reinforce"){const N=String(h||"").trim(),pe=c.type==="lecture"?/^(giriş|introduction)$/i:/^(pekiştirme|detaylar|details?|reinforcement)$/i;if(!N||pe.test(N))continue}if(Be(h,Yt))continue;We(!0),Te=0;const $=K(X(h)),I=$.toLocaleLowerCase("tr-TR").replace(/\s+/g,"");I.includes("bunlarıbiliyormuydunuz")||I.includes("didyouknow");const D=[18,16,14,12,11,10];E=!1,n.push({text:$,fontSize:D[T-1]||12,bold:!0,margin:[0,12,0,6],color:w});continue}if(C.match(/^[-*+]\s/)){const T=C.replace(/^[-*+]\s+/,"").trim(),h=se(),$=h?/^[-*+]\s|^\d+\.\s/.test(h):!1;if(ht(T)&&$){j(),E=!1,n.push({text:H(T),fontSize:12,bold:!0,margin:[0,10,0,4],color:s});continue}Re=!0,E=!1,qe.push({text:H(T),lineHeight:1.4});continue}else if(C.match(/^\d+\.\s/)){const T=C.replace(/^\d+\.\s+/,"").trim(),h=se(),$=h?/^[-*+]\s|^\d+\.\s/.test(h):!1;if(ht(T)&&$){j(),E=!1,n.push({text:H(T),fontSize:12,bold:!0,margin:[0,10,0,4],color:s});continue}j(),E=!1,n.push({text:H(C),margin:[15,2,0,6],fontSize:11,lineHeight:1.4}),ae();continue}if(C.startsWith(">")){j();const T=[];let h=u;for(;h<Q.length&&Q[h].trim().startsWith(">");)T.push(Q[h].trim().replace(/^>\s?/,"").trim()),h+=1;u=h-1;const $=T.join(" ").trim(),I=$.toLocaleLowerCase("tr-TR"),D=/^önemli\s*[:：]?/i.test($)||I.includes("önemli"),N=/^(dikkat|sık hata)\s*[:：]?/i.test($)||I.includes("dikkat")||I.includes("sık hata");if(D||N){const pe=X(K($)).replace(/^(önemli|dikkat|sık hata)\s*[:：-]?\s*/iu,"").trim(),ke=H(pe||$).map(re=>({...re,italics:!0}));n.push({text:[{text:"“",italics:!0},...ke,{text:"”",italics:!0}],fontSize:11.2,lineHeight:1.48,alignment:"center",color:D?M:S,margin:[12,E?14:8,12,10]}),ae(),E=!0;continue}n.push({table:{widths:["*"],body:[[{text:H(X(K($))),color:x,margin:[8,7,8,7]}]]},layout:{fillColor:()=>Z,hLineColor:()=>Z,vLineColor:()=>Z,hLineWidth:()=>0,vLineWidth:()=>0},margin:[0,6,0,9]}),ae(),E=!1;continue}if(c.type==="lecture"&&!ft&&!i){const T=H(C).map(h=>({...h,italics:!0}));E=!1,n.push({text:[{text:"“",italics:!0},...T,{text:"”",italics:!0}],fontSize:11.3,lineHeight:1.5,margin:[12,4,12,10],alignment:"center",color:x}),ae(),ft=!0;continue}E=!1,n.push(me(C)),ae()}if(j(),We(!0),Me&&c.questions&&c.questions.length>0){n.push({text:"Cevap Anahtarı",fontSize:12,bold:!0,margin:[0,15,0,5],color:"#E53935"}),n.push(Xe());for(let u=0;u<c.questions.length;u++){const L=c.questions[u],O=Rt(L);n.push({stack:[{columns:[{width:"auto",text:`${u+1}.`,color:"#2563EB",bold:!0,fontSize:10,margin:[0,0,8,0]},{width:"*",text:[{text:"Soru: ",bold:!0,color:s},...H(L.question||"")],fontSize:10.5,lineHeight:1.35,color:p}],columnGap:6},{text:[{text:`${O.prefix}: `,bold:!0,color:"#15803D"},...H(O.text)],fontSize:10.5,lineHeight:1.35,margin:[22,4,0,0],color:f}],margin:[0,2,0,6]}),u<c.questions.length-1&&n.push(Xe())}}}const Qt={content:ue(n),pageMargins:[le,64,le,72],header:()=>Lt(r.topic,a,le),background:()=>({canvas:At(a)}),footer:(b,c)=>({margin:[le,6,le,10],stack:[{text:`${b} / ${c}`,alignment:"center",fontSize:9,color:m}]}),defaultStyle:{font:"Roboto",color:p}};try{const z=await(await Pt()).createPdf(Qt).getBlob();await tt({blob:z,fileName:rt(r.topic,"pdf")})}catch(b){console.error("PDF Export error:",b),alert("PDF oluşturulamadı!")}},Br=t=>{const e=String(t.coverImageUrl||"").trim(),r=e?[{id:"visual-story-cover",title:t.topic||"Kapak",imageUrl:e,text:String(t.coverNarrationText||t.description||t.topic||"").trim()}]:[],i=(t.nodes||[]).filter(n=>{var a;return n.type==="lecture"&&!!((a=n.pageImageUrl)!=null&&a.trim())}).map((n,a)=>{const o=Number(n.pageSequence);return{id:n.id||`visual-story-page-${a+1}`,title:n.title||`Sayfa ${a+1}`,imageUrl:n.pageImageUrl.trim(),text:String(n.pageText||"").trim(),sequence:Number.isFinite(o)?o:a+1,index:a}}).sort((n,a)=>n.sequence-a.sequence||n.index-a.index).map(({id:n,title:a,imageUrl:o,text:s})=>({id:n,title:a,imageUrl:o,text:s}));return[...r,...i].filter(n=>n.imageUrl)},pi=async(t,e)=>{var S;const r=await mt(t),i=Br(r);if(i.length===0)throw new Error("Visual story PDF export requires at least one page image.");const n=((S=e==null?void 0:e.backgroundColor)==null?void 0:S.trim())||Ft,a=r.bookType==="fairy_tale"&&["1-6","1-3","4-6"].includes(String(r.ageGroup||"").trim()),o=await Promise.all(i.map(async(A,_)=>({...A,order:_+1,imageData:await be(A.imageUrl)}))),s=28,l=64,m=34,d=Le-s*2,p=Et-l-m,f=Math.floor(p*(a?.57:.62)),w=p-f,F=a?16:13,B=a?1.62:1.55,v=a?[18,0,18,0]:[14,0,14,0],U=[];for(let A=0;A<o.length;A+=1){const _=o[A],me=String(_.text||"").trim();U.push({stack:[_.imageData?{image:_.imageData,fit:[d,f],alignment:"center",margin:[0,0,0,16]}:{table:{widths:[d],heights:[f],body:[[{text:`Görsel yüklenemedi: ${_.title}`,alignment:"center",color:"#6B7280",fontSize:11,margin:[10,f/2-10,10,0]}]]},layout:{hLineColor:()=>"#D1D5DB",vLineColor:()=>"#D1D5DB",hLineWidth:()=>.8,vLineWidth:()=>.8,fillColor:()=>"#F9FAFB"},margin:[0,0,0,16]},{stack:[{text:me||_.title,alignment:"center",fontSize:F,lineHeight:B,margin:v}],minHeight:w}],pageBreak:A===0?void 0:"before"})}const g={pageSize:"A4",pageOrientation:"portrait",pageMargins:[s,l,s,m],header:()=>Lt(r.topic,n,s),background:()=>({canvas:At(n)}),footer:(A,_)=>({margin:[s,6,s,10],text:`${A} / ${_}`,alignment:"center",fontSize:9,color:"#5b7288"}),content:U,defaultStyle:{font:"Roboto",color:"#111827"}},M=await(await Pt()).createPdf(g).getBlob();await tt({blob:M,fileName:rt(r.topic,"pdf")})},fi=async(t,e)=>{const r={...t,topic:`${t.topic} - ${e.title}`,nodes:[e]};return Er(r)},P=t=>(t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"),y=t=>(t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"),$e=(t,e="smartbook")=>(t||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"_").replace(/^_+|_+$/g,"").toLowerCase()||e,jt=t=>{if(!t.length)return null;if(t.length>=8&&t[0]===137&&t[1]===80&&t[2]===78&&t[3]===71&&t[4]===13&&t[5]===10&&t[6]===26&&t[7]===10)return"image/png";if(t.length>=3&&t[0]===255&&t[1]===216&&t[2]===255)return"image/jpeg";if(t.length>=6&&t[0]===71&&t[1]===73&&t[2]===70&&t[3]===56&&(t[4]===55||t[4]===57)&&t[5]===97)return"image/gif";if(t.length>=12&&t[0]===82&&t[1]===73&&t[2]===70&&t[3]===70&&t[8]===87&&t[9]===69&&t[10]===66&&t[11]===80)return"image/webp";if(t.length>=12&&t[0]===82&&t[1]===73&&t[2]===70&&t[3]===70&&t[8]===87&&t[9]===65&&t[10]===86&&t[11]===69)return"audio/wav";if(t.length>=4&&t[0]===79&&t[1]===103&&t[2]===103&&t[3]===83)return"audio/ogg";if(t.length>=4&&(t[0]===255&&(t[1]&224)===224||t[0]===73&&t[1]===68&&t[2]===51))return"audio/mpeg";if(t.length>=4&&t[0]===26&&t[1]===69&&t[2]===223&&t[3]===163)return"audio/webm";if(t.length>=12&&t[4]===102&&t[5]===116&&t[6]===121&&t[7]===112)return"audio/mp4";try{const e=new TextDecoder("utf-8").decode(t.slice(0,512)).trimStart().toLowerCase();if(e.startsWith("<svg")||e.startsWith("<?xml")&&e.includes("<svg"))return"image/svg+xml"}catch{}return null},st=t=>{const e=String(t||"").match(/^data:([^;,]+)(?:;|,)/i);return e!=null&&e[1]?e[1].trim().toLowerCase():null},Ot=t=>/^data:/i.test(String(t||"").trim()),Nt=(t,e)=>{const r=(t.type||"").split(";")[0].trim().toLowerCase();if(r&&r!=="application/octet-stream")return r;const i=(e||"").split("?")[0].toLowerCase();return i.endsWith(".png")?"image/png":i.endsWith(".jpg")||i.endsWith(".jpeg")?"image/jpeg":i.endsWith(".webp")?"image/webp":i.endsWith(".gif")?"image/gif":i.endsWith(".svg")?"image/svg+xml":i.endsWith(".wav")?"audio/wav":i.endsWith(".mp3")?"audio/mpeg":i.endsWith(".m4a")?"audio/mp4":i.endsWith(".ogg")?"audio/ogg":i.endsWith(".webm")?"audio/webm":r||"application/octet-stream"},Je=t=>{const e=st(t);if(e)return e;const r=String(t||"").split("?")[0].toLowerCase();return r.endsWith(".png")?"image/png":r.endsWith(".jpg")||r.endsWith(".jpeg")?"image/jpeg":r.endsWith(".webp")?"image/webp":r.endsWith(".gif")?"image/gif":r.endsWith(".svg")?"image/svg+xml":r.endsWith(".wav")?"audio/wav":r.endsWith(".mp3")?"audio/mpeg":r.endsWith(".m4a")?"audio/mp4":r.endsWith(".ogg")?"audio/ogg":r.endsWith(".webm")?"audio/webm":"application/octet-stream"},Ht=(t,e="bin")=>{const r=(t||"").toLowerCase();return r==="image/png"?"png":r==="image/jpeg"?"jpg":r==="image/webp"?"webp":r==="image/gif"?"gif":r==="image/svg+xml"?"svg":r==="audio/wav"||r==="audio/x-wav"?"wav":r==="audio/mpeg"?"mp3":r==="audio/mp4"?"m4a":r==="audio/ogg"?"ogg":r==="audio/webm"?"webm":e},Ar=(t,e)=>{const r=(t||"").toLowerCase();return r==="audio/wav"||r==="audio/x-wav"?!0:(e||"").split("?")[0].toLowerCase().endsWith(".wav")},Lr=async t=>new Uint8Array(await t.arrayBuffer()),St=async(t,e,r)=>{try{return await new Promise((i,n)=>{const a=window.setTimeout(()=>n(new Error(`Timed out after ${e}ms`)),e);t.then(o=>{window.clearTimeout(a),i(o)}).catch(o=>{window.clearTimeout(a),n(o)})})}catch{return r}},Ir=()=>{try{if(typeof _e.isNativePlatform=="function"&&_e.isNativePlatform())return!0;const t=typeof _e.getPlatform=="function"?String(_e.getPlatform()||"").toLowerCase():"";return t==="ios"||t==="android"}catch{return!1}},Gt=(t,e)=>{const r=String(t||"").trim();if(!r)return null;const i=st(r)||String(e||"").trim().toLowerCase(),n=r.includes(",")?r.slice(r.indexOf(",")+1):r;try{const a=atob(n),o=new Uint8Array(a.length);for(let m=0;m<a.length;m+=1)o[m]=a.charCodeAt(m);const s=jt(o),l=i&&i!=="application/octet-stream"?i:s||i||"application/octet-stream";return new Blob([o],{type:l})}catch{return null}},Xt=t=>{const e=String(t||"").trim();if(!Ot(e))return null;const r=st(e)||"application/octet-stream";if(/;base64,/i.test(e))return Gt(e,r);const i=e.indexOf(",");if(i<0)return null;try{const n=decodeURIComponent(e.slice(i+1));return new Blob([n],{type:r})}catch{return null}},ce=async(t,e)=>{const r=(t.type||"").split(";")[0].trim().toLowerCase();if(r&&r!=="application/octet-stream")return t;const i=new Uint8Array(await t.arrayBuffer()),n=jt(i);if(n)return new Blob([i],{type:n});const a=Je(String(e||""));return a!=="application/octet-stream"?new Blob([i],{type:a}):t},Dr=t=>{const e=String(t||"").toLowerCase();return e==="image/jpeg"||e==="image/jpg"||e==="image/png"||e==="image/webp"},Ur=t=>new Promise(e=>{if(typeof document>"u"||typeof URL>"u"){e(null);return}const r=URL.createObjectURL(t),i=new Image;i.onload=()=>{URL.revokeObjectURL(r),e(i)},i.onerror=()=>{URL.revokeObjectURL(r),e(null)},i.src=r}),lt=async t=>{if(typeof document>"u")return t;const e=String(t.type||"").split(";")[0].trim().toLowerCase();if(!Dr(e))return t;const r=await Ur(t);if(!r)return t;const i=r.naturalWidth||r.width||0,n=r.naturalHeight||r.height||0;if(!i||!n)return t;const a=Math.max(i,n),o=a>$t;if(!(o||t.size>=cr||e!=="image/jpeg"))return t;const l=o?$t/a:1,m=Math.max(1,Math.round(i*l)),d=Math.max(1,Math.round(n*l)),p=document.createElement("canvas");p.width=m,p.height=d;const f=p.getContext("2d");if(!f)return t;f.fillStyle="#ffffff",f.fillRect(0,0,m,d),f.drawImage(r,0,0,m,d);const w=await new Promise(F=>{p.toBlob(B=>F(B),"image/jpeg",lr)});return!w||!o&&e==="image/jpeg"&&w.size>=t.size*mr||!o&&w.size>=t.size?t:w},Mr=async t=>{const e=Xt(t);if(!e)return null;const r=await ce(e,t),i=await lt(r);return It(i)},Rr=async t=>{if(!Ir()||!/^https?:\/\//i.test(String(t||"").trim())||typeof fe.downloadFile!="function")return null;const e=Ht(Je(t),"bin"),r=`export-assets/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${e}`;let i=r,n=!1;try{const a=await fe.downloadFile({url:t,path:r,directory:Oe.Temporary,recursive:!0}),o=String(a.path||"").trim();o&&(i=o,n=o.startsWith("file://")||o.startsWith("/"));const s=n?await fe.readFile({path:i}):await fe.readFile({path:i,directory:Oe.Temporary});if(s.data instanceof Blob)return await ce(s.data,t);if(typeof s.data=="string"){const l=Gt(s.data,Je(t));return l?await ce(l,t):null}return null}catch(a){return console.warn("Native filesystem asset fetch failed:",t,a),null}finally{await(n?fe.deleteFile({path:i}):fe.deleteFile({path:i,directory:Oe.Temporary})).catch(()=>{})}},Kt=async t=>{const e=String(t||"").trim();if(!e)return null;const r=Xt(e);if(r)return await ce(r,e);const i=await St(Rr(e),ar,null);if(i)return await ce(i,e);const n=await St(qr(e),xt,null);if(n)return await ce(n,e);try{const a=new AbortController,o=window.setTimeout(()=>a.abort(),xt),s=await fetch(e,{signal:a.signal});if(window.clearTimeout(o),!s.ok)return null;const l=await s.blob();return await ce(l,e)}catch(a){return console.warn("Failed to load asset for EPUB:",e,a),null}},Zt=t=>/https?:\/\/firebasestorage\.googleapis\.com\//i.test(t)||/https?:\/\/[^/]*firebasestorage\.app\//i.test(t)||/https?:\/\/storage\.googleapis\.com\//i.test(t),Ae=t=>{const e=n=>{try{return decodeURIComponent(n)}catch{return n}},r=String(t||"").trim();if(!r)return null;const i=r.match(/^gs:\/\/([^/]+)\/(.+)$/i);if(i!=null&&i[1]&&(i!=null&&i[2]))return{bucketUrl:`gs://${i[1]}`,objectPath:e(i[2])};if(!/^https?:\/\//i.test(r))return{objectPath:r.replace(/^\/+/,"")};try{const n=new URL(r),a=n.pathname||"",o=a.match(/\/(?:v0|download\/storage\/v1)\/b\/([^/]+)\/o\/(.+)$/i);if(o!=null&&o[1]&&(o!=null&&o[2]))return{bucketUrl:`gs://${e(o[1])}`,objectPath:e(o[2])};const s=a.match(/\/o\/(.+)$/);if(s!=null&&s[1]){const l=n.hostname.match(/^([^.]+)\.firebasestorage\.app$/i);return{bucketUrl:l!=null&&l[1]?`gs://${e(l[1])}`:void 0,objectPath:e(s[1])}}if(/^storage\.googleapis\.com$/i.test(n.hostname)){const l=a.split("/").filter(Boolean);if(l.length>=2)return{bucketUrl:`gs://${e(l[0])}`,objectPath:e(l.slice(1).join("/"))}}return null}catch{return null}},qr=async t=>{const e=String(t||"").trim();if(!e||Ot(e)||/^blob:/i.test(e))return null;const r=Zt(e)||/^gs:\/\//i.test(e)||!/^https?:\/\//i.test(e)?Ae(e):null;if(!(r!=null&&r.objectPath))return null;try{const i=r.bucketUrl?Ze(Ve,r.bucketUrl):Ze(Ve),n=zt(i,r.objectPath);return await or(n)}catch(i){return console.warn("Firebase Storage SDK blob fetch failed for export asset, falling back to URL fetch:",r.objectPath,i),null}},Wr=(t,e,r)=>Math.min(r,Math.max(e,t)),jr=(t,e)=>{const r=new ArrayBuffer(44+t.length*2),i=new DataView(r),n=(o,s)=>{for(let l=0;l<s.length;l++)i.setUint8(o+l,s.charCodeAt(l))};n(0,"RIFF"),i.setUint32(4,36+t.length*2,!0),n(8,"WAVE"),n(12,"fmt "),i.setUint32(16,16,!0),i.setUint16(20,1,!0),i.setUint16(22,1,!0),i.setUint32(24,e,!0),i.setUint32(28,e*2,!0),i.setUint16(32,2,!0),i.setUint16(34,16,!0),n(36,"data"),i.setUint32(40,t.length*2,!0);let a=44;for(let o=0;o<t.length;o++){const s=Wr(t[o],-1,1);i.setInt16(a,s<0?s*32768:s*32767,!0),a+=2}return new Blob([r],{type:"audio/wav"})},Or=t=>{const e=t.numberOfChannels,r=t.length,i=new Float32Array(r);if(e<=1)return i.set(t.getChannelData(0)),i;for(let n=0;n<e;n++){const a=t.getChannelData(n);for(let o=0;o<r;o++)i[o]+=a[o]/e}return i},Nr=(t,e,r)=>{if(!t.length||e<=0||r<=0||e===r)return t;const i=e/r,n=Math.max(1,Math.round(t.length/i)),a=new Float32Array(n);for(let o=0;o<n;o++){const s=o*i,l=Math.floor(s),m=Math.min(t.length-1,l+1),d=s-l;a[o]=t[l]*(1-d)+t[m]*d}return a},Hr=async(t,e)=>{const r=Nt(t,e);if(!Ar(r,e))return t;const i=t.size||0;if(!i)return t;try{const n=window.AudioContext||window.webkitAudioContext;if(!n)return t;const a=new n;try{const o=await t.arrayBuffer(),s=await a.decodeAudioData(o.slice(0)),l=Or(s),m=s.sampleRate>22050?22050:s.sampleRate,d=Nr(l,s.sampleRate,m),p=jr(d,m);return p.size>0&&p.size<i*.97?p:t}finally{try{await a.close()}catch{}}}catch(n){return console.warn("EPUB audio compression failed, using original audio.",n),t}};class Gr{constructor(){this.assets=[],this.bySource=new Map,this.counters={image:0,audio:0}}getAll(){return this.assets}async addRemoteAsset(e,r,i){if(!e||r==="image"&&this.counters.image>=sr)return null;const n=`${r}:${e}`,a=this.bySource.get(n);if(a)return a;const o=await Kt(e);if(!o)return null;let s=o;r==="audio"?s=await Hr(o,e):r==="image"&&(s=await lt(o));const l=Nt(s,e),m=Ht(l,r==="image"?"png":"wav"),d=++this.counters[r],p=$e(i||`${r}_${d}`,r),f=r==="image"?"assets/images":"assets/audio",w=r==="image"?"img":"aud",F=`${f}/${p}_${d}.${m}`,B=`${w}_${d}`,v=await Lr(s),U={id:B,href:F,mediaType:l,kind:r};return this.assets.push({...U,bytes:v,sourceKey:n}),this.bySource.set(n,U),U}}const kt=(t,e)=>{const r=(t||"").trim();if(!r)return"";try{const i=ir.renderToString(r,{throwOnError:!1,displayMode:e,output:"mathml"});return`<${e?"div":"span"} class="${e?"math-display":"math-inline"}">${i}</${e?"div":"span"}>`}catch{return`<${e?"div":"span"} class="${e?"math-display":"math-inline"} math-fallback">${P(r)}</${e?"div":"span"}>`}},G=t=>{if(!t)return"";let e=t;const r=[],i=a=>`@@EPUBTOK${r.push(a)-1}@@`;e=e.replace(/\$\$([\s\S]+?)\$\$/g,(a,o)=>i(kt(o,!0))),e=e.replace(/(^|[^\\])\$([^$\n]+)\$/g,(a,o,s)=>`${o}${i(kt(s,!1))}`);let n=P(e);return n=n.replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\*\*\*([^*]+)\*\*\*/g,"<strong><em>$1</em></strong>").replace(/___([^_]+)___/g,"<strong><em>$1</em></strong>").replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/__([^_]+)__/g,"<strong>$1</strong>").replace(/~~([^~]+)~~/g,"<del>$1</del>").replace(/\*([^*]+)\*/g,"<em>$1</em>").replace(/_([^_]+)_/g,"<em>$1</em>"),n=n.replace(/@@EPUBTOK(\d+)@@/g,(a,o)=>r[Number(o)]||""),K(n)},Xr=t=>{const e=Array.isArray(t.questions)?t.questions:[];if(!e.length)return'<p class="body-text muted">Bu bölüm için soru seti henüz hazır değil.</p>';const r=e.map((n,a)=>{const o=(n.options||[]).map((s,l)=>`<li><span class="option-key">${String.fromCharCode(65+l)})</span> <span>${G(s)}</span></li>`).join("");return`
          <article class="qa-card">
            <h3 class="qa-title">Soru ${a+1}</h3>
            <p class="qa-question">${G(n.question)}</p>
            <ol class="qa-options" type="A">${o}</ol>
          </article>
        `}).join(""),i=e.map((n,a)=>{const o=Rt(n);return`
          <div class="answer-row">
            <div class="answer-num">${a+1}</div>
            <div class="answer-main">
              <div class="answer-question"><span class="answer-label">Soru:</span> ${G(n.question||"")}</div>
              <div class="answer-text"><span class="answer-label answer-label-green">${P(o.prefix)}:</span> ${G(o.text)}</div>
            </div>
          </div>
        `}).join("");return`
      <section class="quiz-wrap">
        ${r}
      </section>
      <section class="answer-key-wrap">
        <h3 class="subheading red">Cevap Anahtarı</h3>
        <div class="answer-key-grid">${i}</div>
      </section>
    `},ye=t=>`../${(t||"").replace(/^\/+/,"")}`,Ke=async(t,e)=>{var g,Z;const r=Wt(t||"",{nodeType:e.nodeType,courseTopic:e.topic,nodeTitle:e.sectionTitle,contentTitle:e.contentTitle}),i=Ct(r),n=at({nodeType:e.nodeType,courseTopic:e.topic,nodeTitle:e.sectionTitle,contentTitle:e.contentTitle}),a=i.markdown.split(`
`),o=[];let s=!1,l=[],m=null,d=[],p=0,f=[];const w=(x=!1)=>{f.length&&(x||p>=Pe)&&(o.push(...f),f=[])},F=()=>{p+=1,w()},B=(x,M=!1)=>{if(M||p>=Pe){o.push(x);return}f.push(x)};for(const x of i.images){const M=ne(x.src||""),S=await e.collector.addRemoteAsset(M,"image",`${e.sectionBaseName}_img`);B(S?`
              <figure class="hero-image">
                <img src="${y(ye(S.href))}" alt="${y(x.alt||"Görsel")}" loading="lazy" />
              </figure>
            `:'<p class="body-text muted">[Görsel yüklenemedi]</p>',!0)}const v=()=>{!m||!d.length||(o.push(`<${m} class="content-list">${d.join("")}</${m}>`),m=null,d=[],F())},U=()=>{s&&(o.push(`<pre class="code-block"><code>${P(l.join(`
`))}</code></pre>`),s=!1,l=[])};for(let x=0;x<a.length;x++){const M=a[x],S=M.trim();if(S.startsWith("```")){v(),s?U():(s=!0,l=[]);continue}if(s){l.push(M);continue}if(!S){v();continue}if(S==="---"||S==="--"){v(),o.push('<hr class="dashed-sep" />');continue}if(S.startsWith("|")){const k=((g=a[x+1])==null?void 0:g.trim())||"",R=((Z=a[x+2])==null?void 0:Z.trim())||"";if(Fe(k)&&R.startsWith("|")){v();const q=xe(S),Y=q.map(qt).filter(W=>!!W).slice(0,2);if(Y.length>=2){const W=[];for(let ie=0;ie<Y.length;ie++){const De=Y[ie],Ue=ne(De.url||""),J=await e.collector.addRemoteAsset(Ue,"image",`${e.sectionBaseName}_remedial_${ie+1}`);W.push(`
                          <figure class="image-grid-item">
                            ${J?`<img src="${y(ye(J.href))}" alt="${y(De.alt||"Görsel")}" loading="lazy" />`:'<div class="asset-missing">Görsel yüklenemedi</div>'}
                          </figure>
                        `)}B(`<section class="image-grid">${W.join("")}</section>`),x+=2;continue}if(q.length>=2&&q.slice(0,2).every(W=>!W.trim())){x+=2;continue}}const V=Ut(a,x);if(V){v();const q=V.headers.map(W=>`<th>${G(W)}</th>`).join(""),Y=V.rows.map(W=>`<tr>${W.map(ie=>`<td>${G(ie)}</td>`).join("")}</tr>`).join("");o.push(`
                  <div class="table-wrap">
                    <table class="content-table">
                      <thead><tr>${q}</tr></thead>
                      <tbody>${Y}</tbody>
                    </table>
                  </div>
                `),F(),x=V.endIndex;continue}}const A=S.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);if(A){v();const k=A[1]||"",R=K(X(k)),V=ne(A[2]||""),q=await e.collector.addRemoteAsset(V,"image",`${e.sectionBaseName}_img`);B(q?`
                  <figure class="hero-image">
                    <img src="${y(ye(q.href))}" alt="${y(R||"Görsel")}" loading="lazy" />
                  </figure>
                `:'<p class="body-text muted">[Görsel yüklenemedi]</p>');continue}const _=S.match(/^(#{1,6})\s+(.*)$/);if(_){v();const k=Math.min(6,_[1].length+1),R=e.nodeType==="lecture"?it(_[2]):e.nodeType==="reinforce"?nt(_[2]):_[2];if(ot(R,e.nodeType)||Be(R,n))continue;w(!0),p=0,o.push(`<h${k} class="content-heading level-${k}">${G(R)}</h${k}>`);continue}const me=S.match(/^[-*+]\s+(.*)$/);if(me){const k=me[1].trim();m!=="ul"&&v(),m="ul",d.push(`<li>${G(k)}</li>`);continue}const de=S.match(/^\d+\.\s+(.*)$/);if(de){const k=de[1].trim();m!=="ol"&&v(),m="ol",d.push(`<li>${G(k)}</li>`);continue}const ue=S.match(/^>\s?(.*)$/);if(ue){v();const k=ue[1]||"",R=k.toLocaleLowerCase("tr-TR"),V=/^önemli\s*[:：]?/i.test(k)||R.includes("önemli"),q=/^(dikkat|sık hata)\s*[:：]?/i.test(k)||R.includes("dikkat")||R.includes("sık hata"),Y=V?"content-quote content-quote-important":q?"content-quote content-quote-warning":"content-quote";o.push(`<blockquote class="${Y}">${G(k)}</blockquote>`),F();continue}v(),o.push(`<p class="body-text">${G(S)}</p>`),F()}return U(),v(),w(!0),o.join(`
`)},Kr=(t,e)=>{const r=Ie(e.title,e.type),i=t.bookType==="fairy_tale"||t.bookType==="story"||t.bookType==="novel";return e.type==="lecture"?i?r||t.topic:"GİRİŞ":e.type==="podcast"?"PODCAST":e.type==="quiz"?`QUİZ${e.questions?` • ${e.questions.length} Soru`:""}`:e.type==="reinforce"?i?r||t.topic:"DETAYLAR":e.type==="exam"?`ANA SINAV${e.questions?` • ${e.questions.length} Soru`:""}`:e.type==="retention"?i?r||t.topic:"ÖZET":r},ct=(t,e)=>{const r=Ie(e.title,e.type);if(e.type==="lecture"){const i=it(r||"").trim();return!i||/^(giriş|introduction)$/i.test(i)?t.topic:i}if(e.type==="podcast"){const i=(r||"").trim().toLocaleLowerCase("tr-TR");if(!i||i==="podcast")return"Sesli Anlatım"}if(e.type==="reinforce"){const i=nt(r||"").trim();return!i||/^(peki[şs]t[iı]rme|pekistirme|detaylar|detay|details?|reinforcement)$/iu.test(i)?t.topic:i}return e.type==="retention"?t.topic:e.type==="quiz"?Ee(r,"quiz")?t.topic:r||t.topic:e.type==="exam"&&Ee(r,"exam")?t.topic:r||t.topic},Zr=`
html, body {
  margin: 0;
  padding: 0;
  color: #18212d;
  background: #ffffff;
  font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", "Times New Roman", Georgia, serif;
  line-height: 1.62;
}
body { padding: 1.05rem 1rem 1.25rem; }
h1, h2, h3, h4, h5, h6 { margin: 0; line-height: 1.28; }
p { margin: 0; }
.cover-page { min-height: 95vh; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
.cover-top { display: block; width: 100%; }
.cover-image-wrap { width: 100%; max-width: 24rem; margin: 0 auto; }
.cover-image-wrap img {
  width: 100%;
  max-width: 100%;
  height: auto;
  max-height: 72vh;
  object-fit: contain;
  border-radius: 0.65rem;
  display: block;
  background: #11161d;
  box-shadow: 0 1rem 2rem rgba(17, 22, 29, 0.16);
}
.cover-meta { margin-top: 1rem; text-align: center; }
.cover-meta h1 { font-size: 1.2rem; font-weight: 800; color: #1f2937; margin-top: 0.1rem; }
.cover-meta .meta-line { color: #4b5563; font-size: 0.8rem; margin-top: 0.28rem; }
.brand-line { color: #6b7280; font-size: 0.72rem; margin-top: 0.4rem; }
.cover-divider, .dashed-sep {
  border: 0;
  border-top: 1px dashed #6e8d78;
  margin: 0.7rem 0;
}
.section-shell { }
.tab-header-row { margin-bottom: 0.45rem; }
.tab-label {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 800;
  color: #e53935;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.section-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: #2563eb;
  margin-top: 0.2rem;
}
.body-text {
  font-size: 0.95rem;
  color: #18212d;
  margin: 0.3rem 0 0.42rem;
  text-align: justify;
}
.body-text-intro-quote {
  text-align: center;
  font-style: italic;
  color: #334155;
  margin: 0.38rem 0 0.6rem;
}
.intro-quote-mark {
  opacity: 0.85;
}
.body-text.muted { color: #6b7280; font-style: italic; }
.content-heading { margin: 0.8rem 0 0.35rem; font-weight: 800; color: #2563eb; }
.content-heading.level-2 { font-size: 1rem; }
.content-heading.level-3 { font-size: 0.94rem; }
.content-heading.level-4 { font-size: 0.9rem; }
.content-heading.level-5, .content-heading.level-6 { font-size: 0.86rem; }
.content-list {
  margin: 0.25rem 0 0.45rem 1.05rem;
  padding: 0;
  color: #18212d;
}
.content-list li {
  margin: 0.18rem 0;
  line-height: 1.5;
}
.content-list li::marker { color: #6e8d78; }
.content-quote {
  margin: 0.4rem 0 0.55rem;
  padding: 0.55rem 0.7rem;
  border-left: 3px solid #6e8d78;
  background: rgba(17,22,29,0.03);
  color: #334155;
}
.content-quote-important {
  border-left-color: #fb923c;
  background: #fff7ed;
  color: #7c2d12;
}
.content-quote-warning {
  border-left-color: #f87171;
  background: #fef2f2;
  color: #7f1d1d;
}
.table-wrap {
  margin: 0.5rem 0 0.7rem;
  overflow-x: auto;
}
.content-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 0.84rem;
}
.content-table th,
.content-table td {
  border: 1px solid #a8b8cc;
  padding: 0.32rem 0.36rem;
  vertical-align: top;
  line-height: 1.38;
}
.content-table th {
  background: #e8eef8;
  color: #0f172a;
  font-weight: 800;
  text-align: left;
}
.content-table tbody tr:nth-child(even) td {
  background: #f8fafc;
}
code {
  background: rgba(59,130,246,0.08);
  color: #1d4ed8;
  padding: 0.06rem 0.25rem;
  border-radius: 0.2rem;
  font-size: 0.88em;
}
.code-block {
  background: rgba(17,22,29,0.04);
  border: 1px dashed rgba(110,141,120,0.35);
  border-radius: 0.4rem;
  padding: 0.65rem 0.7rem;
  overflow-x: auto;
  margin: 0.45rem 0 0.6rem;
}
.code-block code {
  background: transparent;
  color: #1f2937;
  padding: 0;
}
.hero-image { margin: 0.65rem 0 0.65rem; }
.hero-image img {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  border-radius: 0.22rem;
  background: #11161d;
}
.hero-image figcaption {
  margin-top: 0.25rem;
  font-size: 0.74rem;
  color: #6b7280;
  font-style: italic;
  text-align: center;
}
.image-grid {
  display: table;
  width: 100%;
  table-layout: fixed;
  border-spacing: 0.45rem 0;
  margin: 0.55rem 0 0.7rem;
}
.image-grid-item {
  display: table-cell;
  vertical-align: top;
  width: 50%;
}
.image-grid-item img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 0.22rem;
  background: #11161d;
}
.image-grid-item figcaption {
  margin-top: 0.25rem;
  font-size: 0.72rem;
  color: #6b7280;
  font-style: italic;
  text-align: center;
  line-height: 1.35;
}
.asset-missing {
  border: 1px dashed rgba(110,141,120,0.35);
  border-radius: 0.3rem;
  padding: 2rem 0.8rem;
  color: #6b7280;
  text-align: center;
  font-size: 0.8rem;
}
.quiz-wrap { margin-top: 0.3rem; }
.qa-card {
  border: 1px dashed rgba(110,141,120,0.35);
  background: rgba(17,22,29,0.02);
  border-radius: 0.42rem;
  padding: 0.65rem 0.7rem;
  margin: 0.45rem 0;
}
.qa-title {
  color: #e53935;
  font-size: 0.82rem;
  font-weight: 800;
}
.qa-question {
  margin: 0.22rem 0 0.35rem;
  color: #18212d;
  font-size: 0.9rem;
  line-height: 1.45;
}
.qa-options {
  margin: 0 0 0 1.1rem;
  padding: 0;
}
.qa-options li {
  margin: 0.18rem 0;
  font-size: 0.88rem;
}
.option-key { color: #2563eb; font-weight: 700; }
.answer-key-wrap { margin-top: 0.8rem; }
.subheading {
  font-size: 0.86rem;
  font-weight: 800;
  margin: 0.2rem 0 0.4rem;
}
.subheading.red { color: #e53935; }
.subheading.blue { color: #2563eb; }
.answer-key-grid { display: block; }
.answer-row {
  display: table;
  width: 100%;
  table-layout: fixed;
  border: 1px dashed rgba(110,141,120,0.28);
  border-radius: 0.35rem;
  margin: 0.28rem 0;
  background: rgba(17,22,29,0.018);
}
.answer-num, .answer-main {
  display: table-cell;
  vertical-align: middle;
}
.answer-num {
  width: 2rem;
  text-align: center;
  font-size: 0.8rem;
  font-weight: 800;
  color: #64748b;
  border-right: 1px dashed rgba(110,141,120,0.22);
}
.answer-main {
  padding: 0.35rem 0.5rem;
}
.answer-letter {
  font-weight: 800;
  color: #15803d;
  font-size: 0.78rem;
}
.answer-question {
  color: #1f2937;
  font-size: 0.78rem;
  line-height: 1.35;
}
.answer-text {
  margin-top: 0.05rem;
  color: #334155;
  font-size: 0.78rem;
  line-height: 1.35;
}
.answer-label {
  font-weight: 800;
  color: #2563eb;
}
.answer-label-green {
  color: #15803d;
}
.podcast-block {
  border: 1px dashed rgba(110,141,120,0.3);
  border-radius: 0.45rem;
  padding: 0.7rem;
  background: rgba(17,22,29,0.02);
  margin: 0.35rem 0 0.65rem;
}
audio {
  display: block;
  width: 100%;
  margin-top: 0.35rem;
}
.podcast-note {
  margin-top: 0.3rem;
  color: #6b7280;
  font-size: 0.72rem;
}
.math-inline {
  color: #8b1d9a;
  font-weight: 600;
}
.math-display {
  color: #8b1d9a;
  margin: 0.35rem 0;
  padding: 0.35rem 0.45rem;
  background: rgba(139,29,154,0.04);
  border: 1px dashed rgba(139,29,154,0.16);
  border-radius: 0.35rem;
  overflow-x: auto;
}
.math-display math, .math-inline math { color: inherit; }
`,et=(t,e,r,i="styles.css")=>`<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${y(r)}" lang="${y(r)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${P(t)}</title>
    <link rel="stylesheet" type="text/css" href="${y(i)}" />
  </head>
  <body>
    ${e}
  </body>
</html>`,Vr=async(t,e)=>{await tt({blob:t,fileName:e})},Qr=async(t,e,r)=>{var m;const i=Kr(t,e),n=ct(t,e),a=he(i)!==he(n),o=`${$e(t.topic)}_${e.type}_${$e(e.id)}`;let s=[];if(e.type==="podcast"){const d=await Ke(e.podcastScript||e.content||"_Podcast metni hazır değil._",{nodeType:e.type,sectionBaseName:o,collector:r,topic:t.topic,sectionTitle:e.title,contentTitle:n});s.push(d)}else if(e.type==="quiz"||e.type==="exam")s.push(Xr(e));else if(t.visualStoryMode===!0&&e.type==="lecture"&&e.pageImageUrl){const d=await r.addRemoteAsset(e.pageImageUrl,"image",`${o}_visual_story_image`);d&&s.push(`
              <figure class="visual-story-page">
                <img src="${y(ye(d.href))}" alt="${y(e.title||i)}" />
              </figure>
            `),(m=e.pageText)!=null&&m.trim()&&s.push(await Ke(e.pageText,{nodeType:e.type,sectionBaseName:`${o}_text`,collector:r,topic:t.topic,sectionTitle:e.title,contentTitle:n}))}else{const d=e.content||"_Henüz içerik oluşturulmamış._";s.push(await Ke(d,{nodeType:e.type,sectionBaseName:o,collector:r,topic:t.topic,sectionTitle:e.title,contentTitle:n}))}return{bodyHtml:`
      <article class="section-shell">
        <header class="tab-header-row">
          ${a?`<div class="tab-label">${P(i)}</div>`:""}
          <h1 class="section-title">${P(n)}</h1>
        </header>
        <hr class="dashed-sep" />
        ${s.join(`
`)}
      </article>
    `}},Yr=async(t,e)=>{let r=null;t.coverImageUrl&&(r=await e.addRemoteAsset(t.coverImageUrl,"image",`${$e(t.topic)}_cover`));const i=new Date(t.createdAt||new Date).toLocaleDateString("tr-TR",{day:"2-digit",month:"short",year:"numeric"}),n=_t(t.ageGroup),a=Dt(t.bookType),o=(t.subGenre||"").trim()||"Belirtilmedi",s=(t.category||"Belirtilmedi").trim(),l=(t.creatorName||"Anonim").trim(),d=`
      <section class="cover-page">
        <div class="cover-top">
          <div class="cover-image-wrap">${r?`<img src="${y(ye(r.href))}" alt="${y(`${t.topic} Fortale kapağı`)}" />`:'<div class="asset-missing">Kapak görseli yok</div>'}</div>
          <div class="cover-meta">
            <h1>${P(t.topic)}</h1>
            <div class="meta-line">Tür: ${P(a)} • Alt Tür: ${P(o)} • ${P(n)} • Kategori: ${P(s)}</div>
            <div class="brand-line">Kurgulayan: ${P(l)} | ${P(i)} | Fortale I Build Your Epic</div>
          </div>
        </div>
        <hr class="cover-divider" />
        <p class="body-text">${P(t.description||"Fortale içeriği bölümler halinde düzenlenmiş öğrenme akışını içerir.")}</p>
      </section>
    `;return{xhtml:et(t.topic,d,(t.language||"tr").toLowerCase(),"../styles.css"),coverImageRef:r}},Jr=async(t,e)=>{const r=await mt(t),i=new Gr,n=(r.language||"tr").toLowerCase(),a=new Date().toISOString().replace(/\.\d{3}Z$/,"Z"),o=new rr,s=[],{xhtml:l,coverImageRef:m}=await Yr(r,i);s.push({id:"cover_xhtml",href:"text/cover.xhtml",title:r.topic,xhtml:l});for(let g=0;g<r.nodes.length;g++){const Z=r.nodes[g],{bodyHtml:x}=await Qr(r,Z,i),M=ct(r,Z);s.push({id:`sec_${g+1}`,href:`text/section_${g+1}.xhtml`,title:M,xhtml:et(M,x,n,"../styles.css")})}const d=et(`${r.topic} - İçindekiler`,`
          <nav epub:type="toc" id="toc">
            <h1 class="section-title">${P(r.topic)}</h1>
            <hr class="dashed-sep" />
            <ol class="content-list">
              ${s.map(g=>`<li><a href="${y(g.href)}">${P(g.title)}</a></li>`).join("")}
            </ol>
          </nav>
        `,n).replace("<html ",'<html xmlns:epub="http://www.idpf.org/2007/ops" '),p=[{id:"nav",href:"nav.xhtml",mediaType:"application/xhtml+xml",properties:"nav"},{id:"css",href:"styles.css",mediaType:"text/css"}];s.forEach(g=>{p.push({id:g.id,href:g.href,mediaType:"application/xhtml+xml"})}),i.getAll().forEach(g=>{p.push({id:g.id,href:g.href,mediaType:g.mediaType,properties:m&&g.id===m.id?"cover-image":void 0})});const f=s.map(g=>`<itemref idref="${y(g.id)}" />`).join(`
    `),w=p.map(g=>`<item id="${y(g.id)}" href="${y(g.href)}" media-type="${y(g.mediaType)}"${g.properties?` properties="${y(g.properties)}"`:""} />`).join(`
    `),F=m?`
    <meta name="cover" content="${y(m.id)}" />`:"",B=`<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="${y(n)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${y(r.id||$e(r.topic))}</dc:identifier>
    <dc:title>${y(r.topic)}</dc:title>
    <dc:language>${y(n)}</dc:language>
    <dc:creator>Fortale</dc:creator>
    <dc:publisher>Fortale</dc:publisher>
    <dc:description>${y(r.description||"")}</dc:description>
    ${F}
    <meta property="dcterms:modified">${a}</meta>
  </metadata>
  <manifest>
    ${w}
  </manifest>
  <spine>
    ${f}
  </spine>
</package>`,v=`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`;o.file("mimetype","application/epub+zip",{compression:"STORE"}),o.file("META-INF/container.xml",v),o.file("META-INF/com.apple.ibooks.display-options.xml",`<?xml version="1.0" encoding="UTF-8"?>
<display_options>
  <platform name="*">
    <option name="specified-fonts">true</option>
  </platform>
</display_options>`),o.file("OEBPS/styles.css",Zr),o.file("OEBPS/nav.xhtml",d),o.file("OEBPS/package.opf",B),s.forEach(g=>{o.file(`OEBPS/${g.href}`,g.xhtml)}),i.getAll().forEach(g=>{o.file(`OEBPS/${g.href}`,g.bytes)});const U=await o.generateAsync({type:"blob",mimeType:"application/epub+zip",compression:"DEFLATE",compressionOptions:{level:6}});await Vr(U,rt(e||r.topic,"epub"))},ei=async t=>{try{await Jr(t,t.topic)}catch(e){console.error("EPUB Export error:",e),alert("EPUB oluşturulamadı!")}},hi=async(t,e)=>{const r={...t,topic:`${t.topic} - ${e.title}`,nodes:[e]};return ei(r)},ti=t=>{const e=["jpg","jpeg","png","webp","gif"],r=[],i=f=>{const w=String(f||"").trim().replace(/^\/+/,"");!w||r.includes(w)||r.push(w)},n=f=>{const w=String(f||"").trim().replace(/^\/+/,"").replace(/\/+$/,"");if(w)for(const F of e)i(`${w}.${F}`)},a=String(t.coverImageUrl||"").trim(),o=Ae(a);if(o!=null&&o.objectPath){const f=o.objectPath.trim().replace(/^\/+/,"");if(f){i(f);const w=f.replace(/\.(?:jpe?g|png|webp|gif)$/i,"");w!==f&&n(w)}}const s=String(t.contentPackagePath||"").trim().replace(/\/package\.json$/i,"");s&&n(`${s}/cover`);const l=Ae(String(t.contentPackageUrl||"").trim()),m=String((l==null?void 0:l.objectPath)||"").trim().replace(/\/package\.json$/i,"");m&&n(`${m}/cover`);const d=String(t.id||"").replace(/[^a-zA-Z0-9_-]/g,"_").trim(),p=String(t.userId||"").replace(/[^a-zA-Z0-9_-]/g,"_").trim();return d&&(n(`smartbooks/${d}/cover`),p&&n(`smartbooks/${p}/${d}/cover`)),r},ri=async t=>{const e=n=>{const a=Ae(n);return a!=null&&a.objectPath&&a.objectPath.trim().replace(/^\/+/,"")||null},r=async n=>{const a=e(n);if(!a)return null;try{return await nr(zt(Ze(Ve),a))}catch{return null}},i=String(t.coverImageUrl||"").trim();if(/^data:image\//i.test(i))return i;if(i){if(/^https?:\/\//i.test(i)&&!Zt(i))return i;const n=await r(i);if(n)return n;if(/^https?:\/\//i.test(i))return i}for(const n of ti(t)){const a=await r(n);if(a)return a}},mt=async t=>{const e=await ri(t);return!e||e===t.coverImageUrl?t:{...t,coverImageUrl:e}};export{ei as exportCourseToEpub,Er as exportCourseToPdf,hi as exportNodeToEpub,fi as exportNodeToPdf,pi as exportVisualStoryToPdf};
