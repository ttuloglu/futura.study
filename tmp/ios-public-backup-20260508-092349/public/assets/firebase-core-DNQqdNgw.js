const ws=()=>{};var _i={};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const er=function(e){const n=[];let s=0;for(let o=0;o<e.length;o++){let c=e.charCodeAt(o);c<128?n[s++]=c:c<2048?(n[s++]=c>>6|192,n[s++]=c&63|128):(c&64512)===55296&&o+1<e.length&&(e.charCodeAt(o+1)&64512)===56320?(c=65536+((c&1023)<<10)+(e.charCodeAt(++o)&1023),n[s++]=c>>18|240,n[s++]=c>>12&63|128,n[s++]=c>>6&63|128,n[s++]=c&63|128):(n[s++]=c>>12|224,n[s++]=c>>6&63|128,n[s++]=c&63|128)}return n},bs=function(e){const n=[];let s=0,o=0;for(;s<e.length;){const c=e[s++];if(c<128)n[o++]=String.fromCharCode(c);else if(c>191&&c<224){const d=e[s++];n[o++]=String.fromCharCode((c&31)<<6|d&63)}else if(c>239&&c<365){const d=e[s++],f=e[s++],I=e[s++],T=((c&7)<<18|(d&63)<<12|(f&63)<<6|I&63)-65536;n[o++]=String.fromCharCode(55296+(T>>10)),n[o++]=String.fromCharCode(56320+(T&1023))}else{const d=e[s++],f=e[s++];n[o++]=String.fromCharCode((c&15)<<12|(d&63)<<6|f&63)}}return n.join("")},nr={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(e,n){if(!Array.isArray(e))throw Error("encodeByteArray takes an array as a parameter");this.init_();const s=n?this.byteToCharMapWebSafe_:this.byteToCharMap_,o=[];for(let c=0;c<e.length;c+=3){const d=e[c],f=c+1<e.length,I=f?e[c+1]:0,T=c+2<e.length,v=T?e[c+2]:0,O=d>>2,A=(d&3)<<4|I>>4;let S=(I&15)<<2|v>>6,x=v&63;T||(x=64,f||(S=64)),o.push(s[O],s[A],s[S],s[x])}return o.join("")},encodeString(e,n){return this.HAS_NATIVE_SUPPORT&&!n?btoa(e):this.encodeByteArray(er(e),n)},decodeString(e,n){return this.HAS_NATIVE_SUPPORT&&!n?atob(e):bs(this.decodeStringToByteArray(e,n))},decodeStringToByteArray(e,n){this.init_();const s=n?this.charToByteMapWebSafe_:this.charToByteMap_,o=[];for(let c=0;c<e.length;){const d=s[e.charAt(c++)],I=c<e.length?s[e.charAt(c)]:0;++c;const v=c<e.length?s[e.charAt(c)]:64;++c;const A=c<e.length?s[e.charAt(c)]:64;if(++c,d==null||I==null||v==null||A==null)throw new vs;const S=d<<2|I>>4;if(o.push(S),v!==64){const x=I<<4&240|v>>2;if(o.push(x),A!==64){const P=v<<6&192|A;o.push(P)}}}return o},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let e=0;e<this.ENCODED_VALS.length;e++)this.byteToCharMap_[e]=this.ENCODED_VALS.charAt(e),this.charToByteMap_[this.byteToCharMap_[e]]=e,this.byteToCharMapWebSafe_[e]=this.ENCODED_VALS_WEBSAFE.charAt(e),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[e]]=e,e>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(e)]=e,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(e)]=e)}}};class vs extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const Is=function(e){const n=er(e);return nr.encodeByteArray(n,!0)},pe=function(e){return Is(e).replace(/\./g,"")},Es=function(e){try{return nr.decodeString(e,!0)}catch(n){console.error("base64Decode failed: ",n)}return null};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ts(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ss=()=>Ts().__FIREBASE_DEFAULTS__,As=()=>{if(typeof process>"u"||typeof _i>"u")return;const e=_i.__FIREBASE_DEFAULTS__;if(e)return JSON.parse(e)},Cs=()=>{if(typeof document>"u")return;let e;try{e=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const n=e&&Es(e[1]);return n&&JSON.parse(n)},we=()=>{try{return ws()||Ss()||As()||Cs()}catch(e){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${e}`);return}},_s=e=>{var n,s;return(s=(n=we())==null?void 0:n.emulatorHosts)==null?void 0:s[e]},gh=e=>{const n=_s(e);if(!n)return;const s=n.lastIndexOf(":");if(s<=0||s+1===n.length)throw new Error(`Invalid host ${n} with no separate hostname and port!`);const o=parseInt(n.substring(s+1),10);return n[0]==="["?[n.substring(1,s-1),o]:[n.substring(0,s),o]},ir=()=>{var e;return(e=we())==null?void 0:e.config},mh=e=>{var n;return(n=we())==null?void 0:n[`_${e}`]};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ds{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((n,s)=>{this.resolve=n,this.reject=s})}wrapCallback(n){return(s,o)=>{s?this.reject(s):this.resolve(o),typeof n=="function"&&(this.promise.catch(()=>{}),n.length===1?n(s):n(s,o))}}}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ks(e){try{return(e.startsWith("http://")||e.startsWith("https://")?new URL(e).hostname:e).endsWith(".cloudworkstations.dev")}catch{return!1}}async function yh(e){return(await fetch(e,{credentials:"include"})).ok}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function wh(e,n){if(e.uid)throw new Error('The "uid" field is no longer supported by mockUserToken. Please use "sub" instead for Firebase Auth User ID.');const s={alg:"none",type:"JWT"},o=n||"demo-project",c=e.iat||0,d=e.sub||e.user_id;if(!d)throw new Error("mockUserToken must contain 'sub' or 'user_id' field!");const f={iss:`https://securetoken.google.com/${o}`,aud:o,iat:c,exp:c+3600,auth_time:c,sub:d,user_id:d,firebase:{sign_in_provider:"custom",identities:{}},...e};return[pe(JSON.stringify(s)),pe(JSON.stringify(f)),""].join(".")}const Wt={};function Os(){const e={prod:[],emulator:[]};for(const n of Object.keys(Wt))Wt[n]?e.emulator.push(n):e.prod.push(n);return e}function Ms(e){let n=document.getElementById(e),s=!1;return n||(n=document.createElement("div"),n.setAttribute("id",e),s=!0),{created:s,element:n}}let Di=!1;function bh(e,n){if(typeof window>"u"||typeof document>"u"||!ks(window.location.host)||Wt[e]===n||Wt[e]||Di)return;Wt[e]=n;function s(S){return`__firebase__banner__${S}`}const o="__firebase__banner",d=Os().prod.length>0;function f(){const S=document.getElementById(o);S&&S.remove()}function I(S){S.style.display="flex",S.style.background="#7faaf0",S.style.position="fixed",S.style.bottom="5px",S.style.left="5px",S.style.padding=".5em",S.style.borderRadius="5px",S.style.alignItems="center"}function T(S,x){S.setAttribute("width","24"),S.setAttribute("id",x),S.setAttribute("height","24"),S.setAttribute("viewBox","0 0 24 24"),S.setAttribute("fill","none"),S.style.marginLeft="-6px"}function v(){const S=document.createElement("span");return S.style.cursor="pointer",S.style.marginLeft="16px",S.style.fontSize="24px",S.innerHTML=" &times;",S.onclick=()=>{Di=!0,f()},S}function O(S,x){S.setAttribute("id",x),S.innerText="Learn more",S.href="https://firebase.google.com/docs/studio/preview-apps#preview-backend",S.setAttribute("target","__blank"),S.style.paddingLeft="5px",S.style.textDecoration="underline"}function A(){const S=Ms(o),x=s("text"),P=document.getElementById(x)||document.createElement("span"),j=s("learnmore"),M=document.getElementById(j)||document.createElement("a"),Q=s("preprendIcon"),q=document.getElementById(Q)||document.createElementNS("http://www.w3.org/2000/svg","svg");if(S.created){const W=S.element;I(W),O(M,j);const rt=v();T(q,Q),W.append(q,P,M,rt),document.body.appendChild(W)}d?(P.innerText="Preview backend disconnected.",q.innerHTML=`<g clip-path="url(#clip0_6013_33858)">
<path d="M4.8 17.6L12 5.6L19.2 17.6H4.8ZM6.91667 16.4H17.0833L12 7.93333L6.91667 16.4ZM12 15.6C12.1667 15.6 12.3056 15.5444 12.4167 15.4333C12.5389 15.3111 12.6 15.1667 12.6 15C12.6 14.8333 12.5389 14.6944 12.4167 14.5833C12.3056 14.4611 12.1667 14.4 12 14.4C11.8333 14.4 11.6889 14.4611 11.5667 14.5833C11.4556 14.6944 11.4 14.8333 11.4 15C11.4 15.1667 11.4556 15.3111 11.5667 15.4333C11.6889 15.5444 11.8333 15.6 12 15.6ZM11.4 13.6H12.6V10.4H11.4V13.6Z" fill="#212121"/>
</g>
<defs>
<clipPath id="clip0_6013_33858">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>`):(q.innerHTML=`<g clip-path="url(#clip0_6083_34804)">
<path d="M11.4 15.2H12.6V11.2H11.4V15.2ZM12 10C12.1667 10 12.3056 9.94444 12.4167 9.83333C12.5389 9.71111 12.6 9.56667 12.6 9.4C12.6 9.23333 12.5389 9.09444 12.4167 8.98333C12.3056 8.86111 12.1667 8.8 12 8.8C11.8333 8.8 11.6889 8.86111 11.5667 8.98333C11.4556 9.09444 11.4 9.23333 11.4 9.4C11.4 9.56667 11.4556 9.71111 11.5667 9.83333C11.6889 9.94444 11.8333 10 12 10ZM12 18.4C11.1222 18.4 10.2944 18.2333 9.51667 17.9C8.73889 17.5667 8.05556 17.1111 7.46667 16.5333C6.88889 15.9444 6.43333 15.2611 6.1 14.4833C5.76667 13.7056 5.6 12.8778 5.6 12C5.6 11.1111 5.76667 10.2833 6.1 9.51667C6.43333 8.73889 6.88889 8.06111 7.46667 7.48333C8.05556 6.89444 8.73889 6.43333 9.51667 6.1C10.2944 5.76667 11.1222 5.6 12 5.6C12.8889 5.6 13.7167 5.76667 14.4833 6.1C15.2611 6.43333 15.9389 6.89444 16.5167 7.48333C17.1056 8.06111 17.5667 8.73889 17.9 9.51667C18.2333 10.2833 18.4 11.1111 18.4 12C18.4 12.8778 18.2333 13.7056 17.9 14.4833C17.5667 15.2611 17.1056 15.9444 16.5167 16.5333C15.9389 17.1111 15.2611 17.5667 14.4833 17.9C13.7167 18.2333 12.8889 18.4 12 18.4ZM12 17.2C13.4444 17.2 14.6722 16.6944 15.6833 15.6833C16.6944 14.6722 17.2 13.4444 17.2 12C17.2 10.5556 16.6944 9.32778 15.6833 8.31667C14.6722 7.30555 13.4444 6.8 12 6.8C10.5556 6.8 9.32778 7.30555 8.31667 8.31667C7.30556 9.32778 6.8 10.5556 6.8 12C6.8 13.4444 7.30556 14.6722 8.31667 15.6833C9.32778 16.6944 10.5556 17.2 12 17.2Z" fill="#212121"/>
</g>
<defs>
<clipPath id="clip0_6083_34804">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>`,P.innerText="Preview backend running in this workspace."),P.setAttribute("id",x)}document.readyState==="loading"?window.addEventListener("DOMContentLoaded",A):A()}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function rr(){return typeof navigator<"u"&&typeof navigator.userAgent=="string"?navigator.userAgent:""}function vh(){return typeof window<"u"&&!!(window.cordova||window.phonegap||window.PhoneGap)&&/ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(rr())}function Rs(){var n;const e=(n=we())==null?void 0:n.forceEnvironment;if(e==="node")return!0;if(e==="browser")return!1;try{return Object.prototype.toString.call(global.process)==="[object process]"}catch{return!1}}function Ih(){return typeof navigator<"u"&&navigator.userAgent==="Cloudflare-Workers"}function sr(){const e=typeof chrome=="object"?chrome.runtime:typeof browser=="object"?browser.runtime:void 0;return typeof e=="object"&&e.id!==void 0}function Eh(){return typeof navigator=="object"&&navigator.product==="ReactNative"}function Th(){const e=rr();return e.indexOf("MSIE ")>=0||e.indexOf("Trident/")>=0}function Sh(){return!Rs()&&!!navigator.userAgent&&navigator.userAgent.includes("Safari")&&!navigator.userAgent.includes("Chrome")}function be(){try{return typeof indexedDB=="object"}catch{return!1}}function ve(){return new Promise((e,n)=>{try{let s=!0;const o="validate-browser-context-for-indexeddb-analytics-module",c=self.indexedDB.open(o);c.onsuccess=()=>{c.result.close(),s||self.indexedDB.deleteDatabase(o),e(!0)},c.onupgradeneeded=()=>{s=!1},c.onerror=()=>{var d;n(((d=c.error)==null?void 0:d.message)||"")}}catch(s){n(s)}})}function pn(){return!(typeof navigator>"u"||!navigator.cookieEnabled)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ps="FirebaseError";class St extends Error{constructor(n,s,o){super(s),this.code=n,this.customData=o,this.name=Ps,Object.setPrototypeOf(this,St.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,Xt.prototype.create)}}class Xt{constructor(n,s,o){this.service=n,this.serviceName=s,this.errors=o}create(n,...s){const o=s[0]||{},c=`${this.service}/${n}`,d=this.errors[n],f=d?Ns(d,o):"Error",I=`${this.serviceName}: ${f} (${c}).`;return new St(c,I,o)}}function Ns(e,n){return e.replace(xs,(s,o)=>{const c=n[o];return c!=null?String(c):`<${o}?>`})}const xs=/\{\$([^}]+)}/g;function Ah(e){for(const n in e)if(Object.prototype.hasOwnProperty.call(e,n))return!1;return!0}function de(e,n){if(e===n)return!0;const s=Object.keys(e),o=Object.keys(n);for(const c of s){if(!o.includes(c))return!1;const d=e[c],f=n[c];if(ki(d)&&ki(f)){if(!de(d,f))return!1}else if(d!==f)return!1}for(const c of o)if(!s.includes(c))return!1;return!0}function ki(e){return e!==null&&typeof e=="object"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ch(e){const n=[];for(const[s,o]of Object.entries(e))Array.isArray(o)?o.forEach(c=>{n.push(encodeURIComponent(s)+"="+encodeURIComponent(c))}):n.push(encodeURIComponent(s)+"="+encodeURIComponent(o));return n.length?"&"+n.join("&"):""}function _h(e,n){const s=new Bs(e,n);return s.subscribe.bind(s)}class Bs{constructor(n,s){this.observers=[],this.unsubscribes=[],this.observerCount=0,this.task=Promise.resolve(),this.finalized=!1,this.onNoObservers=s,this.task.then(()=>{n(this)}).catch(o=>{this.error(o)})}next(n){this.forEachObserver(s=>{s.next(n)})}error(n){this.forEachObserver(s=>{s.error(n)}),this.close(n)}complete(){this.forEachObserver(n=>{n.complete()}),this.close()}subscribe(n,s,o){let c;if(n===void 0&&s===void 0&&o===void 0)throw new Error("Missing Observer.");js(n,["next","error","complete"])?c=n:c={next:n,error:s,complete:o},c.next===void 0&&(c.next=qe),c.error===void 0&&(c.error=qe),c.complete===void 0&&(c.complete=qe);const d=this.unsubscribeOne.bind(this,this.observers.length);return this.finalized&&this.task.then(()=>{try{this.finalError?c.error(this.finalError):c.complete()}catch{}}),this.observers.push(c),d}unsubscribeOne(n){this.observers===void 0||this.observers[n]===void 0||(delete this.observers[n],this.observerCount-=1,this.observerCount===0&&this.onNoObservers!==void 0&&this.onNoObservers(this))}forEachObserver(n){if(!this.finalized)for(let s=0;s<this.observers.length;s++)this.sendOne(s,n)}sendOne(n,s){this.task.then(()=>{if(this.observers!==void 0&&this.observers[n]!==void 0)try{s(this.observers[n])}catch(o){typeof console<"u"&&console.error&&console.error(o)}})}close(n){this.finalized||(this.finalized=!0,n!==void 0&&(this.finalError=n),this.task.then(()=>{this.observers=void 0,this.onNoObservers=void 0}))}}function js(e,n){if(typeof e!="object"||e===null)return!1;for(const s of n)if(s in e&&typeof e[s]=="function")return!0;return!1}function qe(){}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ls=1e3,$s=2,Fs=14400*1e3,Hs=.5;function Oi(e,n=Ls,s=$s){const o=n*Math.pow(s,e),c=Math.round(Hs*o*(Math.random()-.5)*2);return Math.min(Fs,o+c)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function At(e){return e&&e._delegate?e._delegate:e}class Z{constructor(n,s,o){this.name=n,this.instanceFactory=s,this.type=o,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(n){return this.instantiationMode=n,this}setMultipleInstances(n){return this.multipleInstances=n,this}setServiceProps(n){return this.serviceProps=n,this}setInstanceCreatedCallback(n){return this.onInstanceCreated=n,this}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const bt="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Us{constructor(n,s){this.name=n,this.container=s,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(n){const s=this.normalizeInstanceIdentifier(n);if(!this.instancesDeferred.has(s)){const o=new Ds;if(this.instancesDeferred.set(s,o),this.isInitialized(s)||this.shouldAutoInitialize())try{const c=this.getOrInitializeService({instanceIdentifier:s});c&&o.resolve(c)}catch{}}return this.instancesDeferred.get(s).promise}getImmediate(n){const s=this.normalizeInstanceIdentifier(n==null?void 0:n.identifier),o=(n==null?void 0:n.optional)??!1;if(this.isInitialized(s)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:s})}catch(c){if(o)return null;throw c}else{if(o)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(n){if(n.name!==this.name)throw Error(`Mismatching Component ${n.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=n,!!this.shouldAutoInitialize()){if(Ks(n))try{this.getOrInitializeService({instanceIdentifier:bt})}catch{}for(const[s,o]of this.instancesDeferred.entries()){const c=this.normalizeInstanceIdentifier(s);try{const d=this.getOrInitializeService({instanceIdentifier:c});o.resolve(d)}catch{}}}}clearInstance(n=bt){this.instancesDeferred.delete(n),this.instancesOptions.delete(n),this.instances.delete(n)}async delete(){const n=Array.from(this.instances.values());await Promise.all([...n.filter(s=>"INTERNAL"in s).map(s=>s.INTERNAL.delete()),...n.filter(s=>"_delete"in s).map(s=>s._delete())])}isComponentSet(){return this.component!=null}isInitialized(n=bt){return this.instances.has(n)}getOptions(n=bt){return this.instancesOptions.get(n)||{}}initialize(n={}){const{options:s={}}=n,o=this.normalizeInstanceIdentifier(n.instanceIdentifier);if(this.isInitialized(o))throw Error(`${this.name}(${o}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const c=this.getOrInitializeService({instanceIdentifier:o,options:s});for(const[d,f]of this.instancesDeferred.entries()){const I=this.normalizeInstanceIdentifier(d);o===I&&f.resolve(c)}return c}onInit(n,s){const o=this.normalizeInstanceIdentifier(s),c=this.onInitCallbacks.get(o)??new Set;c.add(n),this.onInitCallbacks.set(o,c);const d=this.instances.get(o);return d&&n(d,o),()=>{c.delete(n)}}invokeOnInitCallbacks(n,s){const o=this.onInitCallbacks.get(s);if(o)for(const c of o)try{c(n,s)}catch{}}getOrInitializeService({instanceIdentifier:n,options:s={}}){let o=this.instances.get(n);if(!o&&this.component&&(o=this.component.instanceFactory(this.container,{instanceIdentifier:Vs(n),options:s}),this.instances.set(n,o),this.instancesOptions.set(n,s),this.invokeOnInitCallbacks(o,n),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,n,o)}catch{}return o||null}normalizeInstanceIdentifier(n=bt){return this.component?this.component.multipleInstances?n:bt:n}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function Vs(e){return e===bt?void 0:e}function Ks(e){return e.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zs{constructor(n){this.name=n,this.providers=new Map}addComponent(n){const s=this.getProvider(n.name);if(s.isComponentSet())throw new Error(`Component ${n.name} has already been registered with ${this.name}`);s.setComponent(n)}addOrOverwriteComponent(n){this.getProvider(n.name).isComponentSet()&&this.providers.delete(n.name),this.addComponent(n)}getProvider(n){if(this.providers.has(n))return this.providers.get(n);const s=new Us(n,this);return this.providers.set(n,s),s}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var k;(function(e){e[e.DEBUG=0]="DEBUG",e[e.VERBOSE=1]="VERBOSE",e[e.INFO=2]="INFO",e[e.WARN=3]="WARN",e[e.ERROR=4]="ERROR",e[e.SILENT=5]="SILENT"})(k||(k={}));const Ws={debug:k.DEBUG,verbose:k.VERBOSE,info:k.INFO,warn:k.WARN,error:k.ERROR,silent:k.SILENT},Gs=k.INFO,qs={[k.DEBUG]:"log",[k.VERBOSE]:"log",[k.INFO]:"info",[k.WARN]:"warn",[k.ERROR]:"error"},Xs=(e,n,...s)=>{if(n<e.logLevel)return;const o=new Date().toISOString(),c=qs[n];if(c)console[c](`[${o}]  ${e.name}:`,...s);else throw new Error(`Attempted to log a message with an invalid logType (value: ${n})`)};class or{constructor(n){this.name=n,this._logLevel=Gs,this._logHandler=Xs,this._userLogHandler=null}get logLevel(){return this._logLevel}set logLevel(n){if(!(n in k))throw new TypeError(`Invalid value "${n}" assigned to \`logLevel\``);this._logLevel=n}setLogLevel(n){this._logLevel=typeof n=="string"?Ws[n]:n}get logHandler(){return this._logHandler}set logHandler(n){if(typeof n!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=n}get userLogHandler(){return this._userLogHandler}set userLogHandler(n){this._userLogHandler=n}debug(...n){this._userLogHandler&&this._userLogHandler(this,k.DEBUG,...n),this._logHandler(this,k.DEBUG,...n)}log(...n){this._userLogHandler&&this._userLogHandler(this,k.VERBOSE,...n),this._logHandler(this,k.VERBOSE,...n)}info(...n){this._userLogHandler&&this._userLogHandler(this,k.INFO,...n),this._logHandler(this,k.INFO,...n)}warn(...n){this._userLogHandler&&this._userLogHandler(this,k.WARN,...n),this._logHandler(this,k.WARN,...n)}error(...n){this._userLogHandler&&this._userLogHandler(this,k.ERROR,...n),this._logHandler(this,k.ERROR,...n)}}const Ys=(e,n)=>n.some(s=>e instanceof s);let Mi,Ri;function Js(){return Mi||(Mi=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function Zs(){return Ri||(Ri=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const ar=new WeakMap,an=new WeakMap,cr=new WeakMap,Xe=new WeakMap,dn=new WeakMap;function Qs(e){const n=new Promise((s,o)=>{const c=()=>{e.removeEventListener("success",d),e.removeEventListener("error",f)},d=()=>{s(et(e.result)),c()},f=()=>{o(e.error),c()};e.addEventListener("success",d),e.addEventListener("error",f)});return n.then(s=>{s instanceof IDBCursor&&ar.set(s,e)}).catch(()=>{}),dn.set(n,e),n}function to(e){if(an.has(e))return;const n=new Promise((s,o)=>{const c=()=>{e.removeEventListener("complete",d),e.removeEventListener("error",f),e.removeEventListener("abort",f)},d=()=>{s(),c()},f=()=>{o(e.error||new DOMException("AbortError","AbortError")),c()};e.addEventListener("complete",d),e.addEventListener("error",f),e.addEventListener("abort",f)});an.set(e,n)}let cn={get(e,n,s){if(e instanceof IDBTransaction){if(n==="done")return an.get(e);if(n==="objectStoreNames")return e.objectStoreNames||cr.get(e);if(n==="store")return s.objectStoreNames[1]?void 0:s.objectStore(s.objectStoreNames[0])}return et(e[n])},set(e,n,s){return e[n]=s,!0},has(e,n){return e instanceof IDBTransaction&&(n==="done"||n==="store")?!0:n in e}};function eo(e){cn=e(cn)}function no(e){return e===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(n,...s){const o=e.call(Ye(this),n,...s);return cr.set(o,n.sort?n.sort():[n]),et(o)}:Zs().includes(e)?function(...n){return e.apply(Ye(this),n),et(ar.get(this))}:function(...n){return et(e.apply(Ye(this),n))}}function io(e){return typeof e=="function"?no(e):(e instanceof IDBTransaction&&to(e),Ys(e,Js())?new Proxy(e,cn):e)}function et(e){if(e instanceof IDBRequest)return Qs(e);if(Xe.has(e))return Xe.get(e);const n=io(e);return n!==e&&(Xe.set(e,n),dn.set(n,e)),n}const Ye=e=>dn.get(e);function Ie(e,n,{blocked:s,upgrade:o,blocking:c,terminated:d}={}){const f=indexedDB.open(e,n),I=et(f);return o&&f.addEventListener("upgradeneeded",T=>{o(et(f.result),T.oldVersion,T.newVersion,et(f.transaction),T)}),s&&f.addEventListener("blocked",T=>s(T.oldVersion,T.newVersion,T)),I.then(T=>{d&&T.addEventListener("close",()=>d()),c&&T.addEventListener("versionchange",v=>c(v.oldVersion,v.newVersion,v))}).catch(()=>{}),I}function Je(e,{blocked:n}={}){const s=indexedDB.deleteDatabase(e);return n&&s.addEventListener("blocked",o=>n(o.oldVersion,o)),et(s).then(()=>{})}const ro=["get","getKey","getAll","getAllKeys","count"],so=["put","add","delete","clear"],Ze=new Map;function Pi(e,n){if(!(e instanceof IDBDatabase&&!(n in e)&&typeof n=="string"))return;if(Ze.get(n))return Ze.get(n);const s=n.replace(/FromIndex$/,""),o=n!==s,c=so.includes(s);if(!(s in(o?IDBIndex:IDBObjectStore).prototype)||!(c||ro.includes(s)))return;const d=async function(f,...I){const T=this.transaction(f,c?"readwrite":"readonly");let v=T.store;return o&&(v=v.index(I.shift())),(await Promise.all([v[s](...I),c&&T.done]))[0]};return Ze.set(n,d),d}eo(e=>({...e,get:(n,s,o)=>Pi(n,s)||e.get(n,s,o),has:(n,s)=>!!Pi(n,s)||e.has(n,s)}));/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class oo{constructor(n){this.container=n}getPlatformInfoString(){return this.container.getProviders().map(s=>{if(ao(s)){const o=s.getImmediate();return`${o.library}/${o.version}`}else return null}).filter(s=>s).join(" ")}}function ao(e){const n=e.getComponent();return(n==null?void 0:n.type)==="VERSION"}const hn="@firebase/app",Ni="0.14.8";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const nt=new or("@firebase/app"),co="@firebase/app-compat",ho="@firebase/analytics-compat",lo="@firebase/analytics",uo="@firebase/app-check-compat",fo="@firebase/app-check",po="@firebase/auth",go="@firebase/auth-compat",mo="@firebase/database",yo="@firebase/data-connect",wo="@firebase/database-compat",bo="@firebase/functions",vo="@firebase/functions-compat",Io="@firebase/installations",Eo="@firebase/installations-compat",To="@firebase/messaging",So="@firebase/messaging-compat",Ao="@firebase/performance",Co="@firebase/performance-compat",_o="@firebase/remote-config",Do="@firebase/remote-config-compat",ko="@firebase/storage",Oo="@firebase/storage-compat",Mo="@firebase/firestore",Ro="@firebase/ai",Po="@firebase/firestore-compat",No="firebase",xo="12.9.0";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ln="[DEFAULT]",Bo={[hn]:"fire-core",[co]:"fire-core-compat",[lo]:"fire-analytics",[ho]:"fire-analytics-compat",[fo]:"fire-app-check",[uo]:"fire-app-check-compat",[po]:"fire-auth",[go]:"fire-auth-compat",[mo]:"fire-rtdb",[yo]:"fire-data-connect",[wo]:"fire-rtdb-compat",[bo]:"fire-fn",[vo]:"fire-fn-compat",[Io]:"fire-iid",[Eo]:"fire-iid-compat",[To]:"fire-fcm",[So]:"fire-fcm-compat",[Ao]:"fire-perf",[Co]:"fire-perf-compat",[_o]:"fire-rc",[Do]:"fire-rc-compat",[ko]:"fire-gcs",[Oo]:"fire-gcs-compat",[Mo]:"fire-fst",[Po]:"fire-fst-compat",[Ro]:"fire-vertex","fire-js":"fire-js",[No]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ge=new Map,jo=new Map,un=new Map;function xi(e,n){try{e.container.addComponent(n)}catch(s){nt.debug(`Component ${n.name} failed to register with FirebaseApp ${e.name}`,s)}}function it(e){const n=e.name;if(un.has(n))return nt.debug(`There were multiple attempts to register component ${n}.`),!1;un.set(n,e);for(const s of ge.values())xi(s,e);for(const s of jo.values())xi(s,e);return!0}function Yt(e,n){const s=e.container.getProvider("heartbeat").getImmediate({optional:!0});return s&&s.triggerHeartbeat(),e.container.getProvider(n)}function Dh(e){return e==null?!1:e.settings!==void 0}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Lo={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},ft=new Xt("app","Firebase",Lo);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $o{constructor(n,s,o){this._isDeleted=!1,this._options={...n},this._config={...s},this._name=s.name,this._automaticDataCollectionEnabled=s.automaticDataCollectionEnabled,this._container=o,this.container.addComponent(new Z("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(n){this.checkDestroyed(),this._automaticDataCollectionEnabled=n}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(n){this._isDeleted=n}checkDestroyed(){if(this.isDeleted)throw ft.create("app-deleted",{appName:this._name})}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const kh=xo;function Fo(e,n={}){let s=e;typeof n!="object"&&(n={name:n});const o={name:ln,automaticDataCollectionEnabled:!0,...n},c=o.name;if(typeof c!="string"||!c)throw ft.create("bad-app-name",{appName:String(c)});if(s||(s=ir()),!s)throw ft.create("no-options");const d=ge.get(c);if(d){if(de(s,d.options)&&de(o,d.config))return d;throw ft.create("duplicate-app",{appName:c})}const f=new zs(c);for(const T of un.values())f.addComponent(T);const I=new $o(s,o,f);return ge.set(c,I),I}function hr(e=ln){const n=ge.get(e);if(!n&&e===ln&&ir())return Fo();if(!n)throw ft.create("no-app",{appName:e});return n}function J(e,n,s){let o=Bo[e]??e;s&&(o+=`-${s}`);const c=o.match(/\s|\//),d=n.match(/\s|\//);if(c||d){const f=[`Unable to register library "${o}" with version "${n}":`];c&&f.push(`library name "${o}" contains illegal characters (whitespace or "/")`),c&&d&&f.push("and"),d&&f.push(`version name "${n}" contains illegal characters (whitespace or "/")`),nt.warn(f.join(" "));return}it(new Z(`${o}-version`,()=>({library:o,version:n}),"VERSION"))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ho="firebase-heartbeat-database",Uo=1,Gt="firebase-heartbeat-store";let Qe=null;function lr(){return Qe||(Qe=Ie(Ho,Uo,{upgrade:(e,n)=>{switch(n){case 0:try{e.createObjectStore(Gt)}catch(s){console.warn(s)}}}}).catch(e=>{throw ft.create("idb-open",{originalErrorMessage:e.message})})),Qe}async function Vo(e){try{const s=(await lr()).transaction(Gt),o=await s.objectStore(Gt).get(ur(e));return await s.done,o}catch(n){if(n instanceof St)nt.warn(n.message);else{const s=ft.create("idb-get",{originalErrorMessage:n==null?void 0:n.message});nt.warn(s.message)}}}async function Bi(e,n){try{const o=(await lr()).transaction(Gt,"readwrite");await o.objectStore(Gt).put(n,ur(e)),await o.done}catch(s){if(s instanceof St)nt.warn(s.message);else{const o=ft.create("idb-set",{originalErrorMessage:s==null?void 0:s.message});nt.warn(o.message)}}}function ur(e){return`${e.name}!${e.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ko=1024,zo=30;class Wo{constructor(n){this.container=n,this._heartbeatsCache=null;const s=this.container.getProvider("app").getImmediate();this._storage=new qo(s),this._heartbeatsCachePromise=this._storage.read().then(o=>(this._heartbeatsCache=o,o))}async triggerHeartbeat(){var n,s;try{const c=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),d=ji();if(((n=this._heartbeatsCache)==null?void 0:n.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((s=this._heartbeatsCache)==null?void 0:s.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===d||this._heartbeatsCache.heartbeats.some(f=>f.date===d))return;if(this._heartbeatsCache.heartbeats.push({date:d,agent:c}),this._heartbeatsCache.heartbeats.length>zo){const f=Xo(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(f,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(o){nt.warn(o)}}async getHeartbeatsHeader(){var n;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((n=this._heartbeatsCache)==null?void 0:n.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const s=ji(),{heartbeatsToSend:o,unsentEntries:c}=Go(this._heartbeatsCache.heartbeats),d=pe(JSON.stringify({version:2,heartbeats:o}));return this._heartbeatsCache.lastSentHeartbeatDate=s,c.length>0?(this._heartbeatsCache.heartbeats=c,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),d}catch(s){return nt.warn(s),""}}}function ji(){return new Date().toISOString().substring(0,10)}function Go(e,n=Ko){const s=[];let o=e.slice();for(const c of e){const d=s.find(f=>f.agent===c.agent);if(d){if(d.dates.push(c.date),Li(s)>n){d.dates.pop();break}}else if(s.push({agent:c.agent,dates:[c.date]}),Li(s)>n){s.pop();break}o=o.slice(1)}return{heartbeatsToSend:s,unsentEntries:o}}class qo{constructor(n){this.app=n,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return be()?ve().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const s=await Vo(this.app);return s!=null&&s.heartbeats?s:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(n){if(await this._canUseIndexedDBPromise){const o=await this.read();return Bi(this.app,{lastSentHeartbeatDate:n.lastSentHeartbeatDate??o.lastSentHeartbeatDate,heartbeats:n.heartbeats})}else return}async add(n){if(await this._canUseIndexedDBPromise){const o=await this.read();return Bi(this.app,{lastSentHeartbeatDate:n.lastSentHeartbeatDate??o.lastSentHeartbeatDate,heartbeats:[...o.heartbeats,...n.heartbeats]})}else return}}function Li(e){return pe(JSON.stringify({version:2,heartbeats:e})).length}function Xo(e){if(e.length===0)return-1;let n=0,s=e[0].date;for(let o=1;o<e.length;o++)e[o].date<s&&(s=e[o].date,n=o);return n}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Yo(e){it(new Z("platform-logger",n=>new oo(n),"PRIVATE")),it(new Z("heartbeat",n=>new Wo(n),"PRIVATE")),J(hn,Ni,e),J(hn,Ni,"esm2020"),J("fire-js","")}Yo("");var Jo="firebase",Zo="12.9.0";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */J(Jo,Zo,"app");const fr="@firebase/installations",gn="0.6.19";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const pr=1e4,dr=`w:${gn}`,gr="FIS_v2",Qo="https://firebaseinstallations.googleapis.com/v1",ta=3600*1e3,ea="installations",na="Installations";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ia={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},It=new Xt(ea,na,ia);function mr(e){return e instanceof St&&e.code.includes("request-failed")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function yr({projectId:e}){return`${Qo}/projects/${e}/installations`}function wr(e){return{token:e.token,requestStatus:2,expiresIn:sa(e.expiresIn),creationTime:Date.now()}}async function br(e,n){const o=(await n.json()).error;return It.create("request-failed",{requestName:e,serverCode:o.code,serverMessage:o.message,serverStatus:o.status})}function vr({apiKey:e}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e})}function ra(e,{refreshToken:n}){const s=vr(e);return s.append("Authorization",oa(n)),s}async function Ir(e){const n=await e();return n.status>=500&&n.status<600?e():n}function sa(e){return Number(e.replace("s","000"))}function oa(e){return`${gr} ${e}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function aa({appConfig:e,heartbeatServiceProvider:n},{fid:s}){const o=yr(e),c=vr(e),d=n.getImmediate({optional:!0});if(d){const v=await d.getHeartbeatsHeader();v&&c.append("x-firebase-client",v)}const f={fid:s,authVersion:gr,appId:e.appId,sdkVersion:dr},I={method:"POST",headers:c,body:JSON.stringify(f)},T=await Ir(()=>fetch(o,I));if(T.ok){const v=await T.json();return{fid:v.fid||s,registrationStatus:2,refreshToken:v.refreshToken,authToken:wr(v.authToken)}}else throw await br("Create Installation",T)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Er(e){return new Promise(n=>{setTimeout(n,e)})}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ca(e){return btoa(String.fromCharCode(...e)).replace(/\+/g,"-").replace(/\//g,"_")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ha=/^[cdef][\w-]{21}$/,fn="";function la(){try{const e=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(e),e[0]=112+e[0]%16;const s=ua(e);return ha.test(s)?s:fn}catch{return fn}}function ua(e){return ca(e).substr(0,22)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ee(e){return`${e.appName}!${e.appId}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Tr=new Map;function Sr(e,n){const s=Ee(e);Ar(s,n),fa(s,n)}function Ar(e,n){const s=Tr.get(e);if(s)for(const o of s)o(n)}function fa(e,n){const s=pa();s&&s.postMessage({key:e,fid:n}),da()}let vt=null;function pa(){return!vt&&"BroadcastChannel"in self&&(vt=new BroadcastChannel("[Firebase] FID Change"),vt.onmessage=e=>{Ar(e.data.key,e.data.fid)}),vt}function da(){Tr.size===0&&vt&&(vt.close(),vt=null)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ga="firebase-installations-database",ma=1,Et="firebase-installations-store";let tn=null;function mn(){return tn||(tn=Ie(ga,ma,{upgrade:(e,n)=>{switch(n){case 0:e.createObjectStore(Et)}}})),tn}async function me(e,n){const s=Ee(e),c=(await mn()).transaction(Et,"readwrite"),d=c.objectStore(Et),f=await d.get(s);return await d.put(n,s),await c.done,(!f||f.fid!==n.fid)&&Sr(e,n.fid),n}async function Cr(e){const n=Ee(e),o=(await mn()).transaction(Et,"readwrite");await o.objectStore(Et).delete(n),await o.done}async function Te(e,n){const s=Ee(e),c=(await mn()).transaction(Et,"readwrite"),d=c.objectStore(Et),f=await d.get(s),I=n(f);return I===void 0?await d.delete(s):await d.put(I,s),await c.done,I&&(!f||f.fid!==I.fid)&&Sr(e,I.fid),I}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function yn(e){let n;const s=await Te(e.appConfig,o=>{const c=ya(o),d=wa(e,c);return n=d.registrationPromise,d.installationEntry});return s.fid===fn?{installationEntry:await n}:{installationEntry:s,registrationPromise:n}}function ya(e){const n=e||{fid:la(),registrationStatus:0};return _r(n)}function wa(e,n){if(n.registrationStatus===0){if(!navigator.onLine){const c=Promise.reject(It.create("app-offline"));return{installationEntry:n,registrationPromise:c}}const s={fid:n.fid,registrationStatus:1,registrationTime:Date.now()},o=ba(e,s);return{installationEntry:s,registrationPromise:o}}else return n.registrationStatus===1?{installationEntry:n,registrationPromise:va(e)}:{installationEntry:n}}async function ba(e,n){try{const s=await aa(e,n);return me(e.appConfig,s)}catch(s){throw mr(s)&&s.customData.serverCode===409?await Cr(e.appConfig):await me(e.appConfig,{fid:n.fid,registrationStatus:0}),s}}async function va(e){let n=await $i(e.appConfig);for(;n.registrationStatus===1;)await Er(100),n=await $i(e.appConfig);if(n.registrationStatus===0){const{installationEntry:s,registrationPromise:o}=await yn(e);return o||s}return n}function $i(e){return Te(e,n=>{if(!n)throw It.create("installation-not-found");return _r(n)})}function _r(e){return Ia(e)?{fid:e.fid,registrationStatus:0}:e}function Ia(e){return e.registrationStatus===1&&e.registrationTime+pr<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Ea({appConfig:e,heartbeatServiceProvider:n},s){const o=Ta(e,s),c=ra(e,s),d=n.getImmediate({optional:!0});if(d){const v=await d.getHeartbeatsHeader();v&&c.append("x-firebase-client",v)}const f={installation:{sdkVersion:dr,appId:e.appId}},I={method:"POST",headers:c,body:JSON.stringify(f)},T=await Ir(()=>fetch(o,I));if(T.ok){const v=await T.json();return wr(v)}else throw await br("Generate Auth Token",T)}function Ta(e,{fid:n}){return`${yr(e)}/${n}/authTokens:generate`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function wn(e,n=!1){let s;const o=await Te(e.appConfig,d=>{if(!Dr(d))throw It.create("not-registered");const f=d.authToken;if(!n&&Ca(f))return d;if(f.requestStatus===1)return s=Sa(e,n),d;{if(!navigator.onLine)throw It.create("app-offline");const I=Da(d);return s=Aa(e,I),I}});return s?await s:o.authToken}async function Sa(e,n){let s=await Fi(e.appConfig);for(;s.authToken.requestStatus===1;)await Er(100),s=await Fi(e.appConfig);const o=s.authToken;return o.requestStatus===0?wn(e,n):o}function Fi(e){return Te(e,n=>{if(!Dr(n))throw It.create("not-registered");const s=n.authToken;return ka(s)?{...n,authToken:{requestStatus:0}}:n})}async function Aa(e,n){try{const s=await Ea(e,n),o={...n,authToken:s};return await me(e.appConfig,o),s}catch(s){if(mr(s)&&(s.customData.serverCode===401||s.customData.serverCode===404))await Cr(e.appConfig);else{const o={...n,authToken:{requestStatus:0}};await me(e.appConfig,o)}throw s}}function Dr(e){return e!==void 0&&e.registrationStatus===2}function Ca(e){return e.requestStatus===2&&!_a(e)}function _a(e){const n=Date.now();return n<e.creationTime||e.creationTime+e.expiresIn<n+ta}function Da(e){const n={requestStatus:1,requestTime:Date.now()};return{...e,authToken:n}}function ka(e){return e.requestStatus===1&&e.requestTime+pr<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Oa(e){const n=e,{installationEntry:s,registrationPromise:o}=await yn(n);return o?o.catch(console.error):wn(n).catch(console.error),s.fid}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Ma(e,n=!1){const s=e;return await Ra(s),(await wn(s,n)).token}async function Ra(e){const{registrationPromise:n}=await yn(e);n&&await n}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Pa(e){if(!e||!e.options)throw en("App Configuration");if(!e.name)throw en("App Name");const n=["projectId","apiKey","appId"];for(const s of n)if(!e.options[s])throw en(s);return{appName:e.name,projectId:e.options.projectId,apiKey:e.options.apiKey,appId:e.options.appId}}function en(e){return It.create("missing-app-config-values",{valueName:e})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const kr="installations",Na="installations-internal",xa=e=>{const n=e.getProvider("app").getImmediate(),s=Pa(n),o=Yt(n,"heartbeat");return{app:n,appConfig:s,heartbeatServiceProvider:o,_delete:()=>Promise.resolve()}},Ba=e=>{const n=e.getProvider("app").getImmediate(),s=Yt(n,kr).getImmediate();return{getId:()=>Oa(s),getToken:c=>Ma(s,c)}};function ja(){it(new Z(kr,xa,"PUBLIC")),it(new Z(Na,Ba,"PRIVATE"))}ja();J(fr,gn);J(fr,gn,"esm2020");/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ye="analytics",La="firebase_id",$a="origin",Fa=60*1e3,Ha="https://firebase.googleapis.com/v1alpha/projects/-/apps/{app-id}/webConfig",bn="https://www.googletagmanager.com/gtag/js";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const U=new or("@firebase/analytics");/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ua={"already-exists":"A Firebase Analytics instance with the appId {$id}  already exists. Only one Firebase Analytics instance can be created for each appId.","already-initialized":"initializeAnalytics() cannot be called again with different options than those it was initially called with. It can be called again with the same options to return the existing instance, or getAnalytics() can be used to get a reference to the already-initialized instance.","already-initialized-settings":"Firebase Analytics has already been initialized.settings() must be called before initializing any Analytics instanceor it will have no effect.","interop-component-reg-failed":"Firebase Analytics Interop Component failed to instantiate: {$reason}","invalid-analytics-context":"Firebase Analytics is not supported in this environment. Wrap initialization of analytics in analytics.isSupported() to prevent initialization in unsupported environments. Details: {$errorInfo}","indexeddb-unavailable":"IndexedDB unavailable or restricted in this environment. Wrap initialization of analytics in analytics.isSupported() to prevent initialization in unsupported environments. Details: {$errorInfo}","fetch-throttle":"The config fetch request timed out while in an exponential backoff state. Unix timestamp in milliseconds when fetch request throttling ends: {$throttleEndTimeMillis}.","config-fetch-failed":"Dynamic config fetch failed: [{$httpStatus}] {$responseMessage}","no-api-key":'The "apiKey" field is empty in the local Firebase config. Firebase Analytics requires this field tocontain a valid API key.',"no-app-id":'The "appId" field is empty in the local Firebase config. Firebase Analytics requires this field tocontain a valid app ID.',"no-client-id":'The "client_id" field is empty.',"invalid-gtag-resource":"Trusted Types detected an invalid gtag resource: {$gtagURL}."},z=new Xt("analytics","Analytics",Ua);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Va(e){if(!e.startsWith(bn)){const n=z.create("invalid-gtag-resource",{gtagURL:e});return U.warn(n.message),""}return e}function Or(e){return Promise.all(e.map(n=>n.catch(s=>s)))}function Ka(e,n){let s;return window.trustedTypes&&(s=window.trustedTypes.createPolicy(e,n)),s}function za(e,n){const s=Ka("firebase-js-sdk-policy",{createScriptURL:Va}),o=document.createElement("script"),c=`${bn}?l=${e}&id=${n}`;o.src=s?s==null?void 0:s.createScriptURL(c):c,o.async=!0,document.head.appendChild(o)}function Wa(e){let n=[];return Array.isArray(window[e])?n=window[e]:window[e]=n,n}async function Ga(e,n,s,o,c,d){const f=o[c];try{if(f)await n[f];else{const T=(await Or(s)).find(v=>v.measurementId===c);T&&await n[T.appId]}}catch(I){U.error(I)}e("config",c,d)}async function qa(e,n,s,o,c){try{let d=[];if(c&&c.send_to){let f=c.send_to;Array.isArray(f)||(f=[f]);const I=await Or(s);for(const T of f){const v=I.find(A=>A.measurementId===T),O=v&&n[v.appId];if(O)d.push(O);else{d=[];break}}}d.length===0&&(d=Object.values(n)),await Promise.all(d),e("event",o,c||{})}catch(d){U.error(d)}}function Xa(e,n,s,o){async function c(d,...f){try{if(d==="event"){const[I,T]=f;await qa(e,n,s,I,T)}else if(d==="config"){const[I,T]=f;await Ga(e,n,s,o,I,T)}else if(d==="consent"){const[I,T]=f;e("consent",I,T)}else if(d==="get"){const[I,T,v]=f;e("get",I,T,v)}else if(d==="set"){const[I]=f;e("set",I)}else e(d,...f)}catch(I){U.error(I)}}return c}function Ya(e,n,s,o,c){let d=function(...f){window[o].push(arguments)};return window[c]&&typeof window[c]=="function"&&(d=window[c]),window[c]=Xa(d,e,n,s),{gtagCore:d,wrappedGtag:window[c]}}function Ja(e){const n=window.document.getElementsByTagName("script");for(const s of Object.values(n))if(s.src&&s.src.includes(bn)&&s.src.includes(e))return s;return null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Za=30,Qa=1e3;class tc{constructor(n={},s=Qa){this.throttleMetadata=n,this.intervalMillis=s}getThrottleMetadata(n){return this.throttleMetadata[n]}setThrottleMetadata(n,s){this.throttleMetadata[n]=s}deleteThrottleMetadata(n){delete this.throttleMetadata[n]}}const Mr=new tc;function ec(e){return new Headers({Accept:"application/json","x-goog-api-key":e})}async function nc(e){var f;const{appId:n,apiKey:s}=e,o={method:"GET",headers:ec(s)},c=Ha.replace("{app-id}",n),d=await fetch(c,o);if(d.status!==200&&d.status!==304){let I="";try{const T=await d.json();(f=T.error)!=null&&f.message&&(I=T.error.message)}catch{}throw z.create("config-fetch-failed",{httpStatus:d.status,responseMessage:I})}return d.json()}async function ic(e,n=Mr,s){const{appId:o,apiKey:c,measurementId:d}=e.options;if(!o)throw z.create("no-app-id");if(!c){if(d)return{measurementId:d,appId:o};throw z.create("no-api-key")}const f=n.getThrottleMetadata(o)||{backoffCount:0,throttleEndTimeMillis:Date.now()},I=new oc;return setTimeout(async()=>{I.abort()},Fa),Rr({appId:o,apiKey:c,measurementId:d},f,I,n)}async function Rr(e,{throttleEndTimeMillis:n,backoffCount:s},o,c=Mr){var I;const{appId:d,measurementId:f}=e;try{await rc(o,n)}catch(T){if(f)return U.warn(`Timed out fetching this Firebase app's measurement ID from the server. Falling back to the measurement ID ${f} provided in the "measurementId" field in the local Firebase config. [${T==null?void 0:T.message}]`),{appId:d,measurementId:f};throw T}try{const T=await nc(e);return c.deleteThrottleMetadata(d),T}catch(T){const v=T;if(!sc(v)){if(c.deleteThrottleMetadata(d),f)return U.warn(`Failed to fetch this Firebase app's measurement ID from the server. Falling back to the measurement ID ${f} provided in the "measurementId" field in the local Firebase config. [${v==null?void 0:v.message}]`),{appId:d,measurementId:f};throw T}const O=Number((I=v==null?void 0:v.customData)==null?void 0:I.httpStatus)===503?Oi(s,c.intervalMillis,Za):Oi(s,c.intervalMillis),A={throttleEndTimeMillis:Date.now()+O,backoffCount:s+1};return c.setThrottleMetadata(d,A),U.debug(`Calling attemptFetch again in ${O} millis`),Rr(e,A,o,c)}}function rc(e,n){return new Promise((s,o)=>{const c=Math.max(n-Date.now(),0),d=setTimeout(s,c);e.addEventListener(()=>{clearTimeout(d),o(z.create("fetch-throttle",{throttleEndTimeMillis:n}))})})}function sc(e){if(!(e instanceof St)||!e.customData)return!1;const n=Number(e.customData.httpStatus);return n===429||n===500||n===503||n===504}class oc{constructor(){this.listeners=[]}addEventListener(n){this.listeners.push(n)}abort(){this.listeners.forEach(n=>n())}}async function ac(e,n,s,o,c){if(c&&c.global){e("event",s,o);return}else{const d=await n,f={...o,send_to:d};e("event",s,f)}}async function cc(e,n,s,o){if(o&&o.global){const c={};for(const d of Object.keys(s))c[`user_properties.${d}`]=s[d];return e("set",c),Promise.resolve()}else{const c=await n;e("config",c,{update:!0,user_properties:s})}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function hc(){if(be())try{await ve()}catch(e){return U.warn(z.create("indexeddb-unavailable",{errorInfo:e==null?void 0:e.toString()}).message),!1}else return U.warn(z.create("indexeddb-unavailable",{errorInfo:"IndexedDB is not available in this environment."}).message),!1;return!0}async function lc(e,n,s,o,c,d,f){const I=ic(e);I.then(S=>{s[S.measurementId]=S.appId,e.options.measurementId&&S.measurementId!==e.options.measurementId&&U.warn(`The measurement ID in the local Firebase config (${e.options.measurementId}) does not match the measurement ID fetched from the server (${S.measurementId}). To ensure analytics events are always sent to the correct Analytics property, update the measurement ID field in the local config or remove it from the local config.`)}).catch(S=>U.error(S)),n.push(I);const T=hc().then(S=>{if(S)return o.getId()}),[v,O]=await Promise.all([I,T]);Ja(d)||za(d,v.measurementId),c("js",new Date);const A=(f==null?void 0:f.config)??{};return A[$a]="firebase",A.update=!0,O!=null&&(A[La]=O),c("config",v.measurementId,A),v.measurementId}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class uc{constructor(n){this.app=n}_delete(){return delete kt[this.app.options.appId],Promise.resolve()}}let kt={},Hi=[];const Ui={};let nn="dataLayer",fc="gtag",Vi,vn,Ki=!1;function pc(){const e=[];if(sr()&&e.push("This is a browser extension environment."),pn()||e.push("Cookies are not available."),e.length>0){const n=e.map((o,c)=>`(${c+1}) ${o}`).join(" "),s=z.create("invalid-analytics-context",{errorInfo:n});U.warn(s.message)}}function dc(e,n,s){pc();const o=e.options.appId;if(!o)throw z.create("no-app-id");if(!e.options.apiKey)if(e.options.measurementId)U.warn(`The "apiKey" field is empty in the local Firebase config. This is needed to fetch the latest measurement ID for this Firebase app. Falling back to the measurement ID ${e.options.measurementId} provided in the "measurementId" field in the local Firebase config.`);else throw z.create("no-api-key");if(kt[o]!=null)throw z.create("already-exists",{id:o});if(!Ki){Wa(nn);const{wrappedGtag:d,gtagCore:f}=Ya(kt,Hi,Ui,nn,fc);vn=d,Vi=f,Ki=!0}return kt[o]=lc(e,Hi,Ui,n,Vi,nn,s),new uc(e)}function Oh(e=hr()){e=At(e);const n=Yt(e,ye);return n.isInitialized()?n.getImmediate():gc(e)}function gc(e,n={}){const s=Yt(e,ye);if(s.isInitialized()){const c=s.getImmediate();if(de(n,s.getOptions()))return c;throw z.create("already-initialized")}return s.initialize({options:n})}async function Mh(){if(sr()||!pn()||!be())return!1;try{return await ve()}catch{return!1}}function mc(e,n,s){e=At(e),cc(vn,kt[e.app.options.appId],n,s).catch(o=>U.error(o))}function yc(e,n,s,o){e=At(e),ac(vn,kt[e.app.options.appId],n,s,o).catch(c=>U.error(c))}const zi="@firebase/analytics",Wi="0.10.19";function wc(){it(new Z(ye,(n,{options:s})=>{const o=n.getProvider("app").getImmediate(),c=n.getProvider("installations-internal").getImmediate();return dc(o,c,s)},"PUBLIC")),it(new Z("analytics-internal",e,"PRIVATE")),J(zi,Wi),J(zi,Wi,"esm2020");function e(n){try{const s=n.getProvider(ye).getImmediate();return{logEvent:(o,c,d)=>yc(s,o,c,d),setUserProperties:(o,c)=>mc(s,o,c)}}catch(s){throw z.create("interop-component-reg-failed",{reason:s})}}}wc();var Gi=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var bc,vc;(function(){var e;/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/function n(g,h){function u(){}u.prototype=h.prototype,g.F=h.prototype,g.prototype=new u,g.prototype.constructor=g,g.D=function(m,p,w){for(var l=Array(arguments.length-2),V=2;V<arguments.length;V++)l[V-2]=arguments[V];return h.prototype[p].apply(m,l)}}function s(){this.blockSize=-1}function o(){this.blockSize=-1,this.blockSize=64,this.g=Array(4),this.C=Array(this.blockSize),this.o=this.h=0,this.u()}n(o,s),o.prototype.u=function(){this.g[0]=1732584193,this.g[1]=4023233417,this.g[2]=2562383102,this.g[3]=271733878,this.o=this.h=0};function c(g,h,u){u||(u=0);const m=Array(16);if(typeof h=="string")for(var p=0;p<16;++p)m[p]=h.charCodeAt(u++)|h.charCodeAt(u++)<<8|h.charCodeAt(u++)<<16|h.charCodeAt(u++)<<24;else for(p=0;p<16;++p)m[p]=h[u++]|h[u++]<<8|h[u++]<<16|h[u++]<<24;h=g.g[0],u=g.g[1],p=g.g[2];let w=g.g[3],l;l=h+(w^u&(p^w))+m[0]+3614090360&4294967295,h=u+(l<<7&4294967295|l>>>25),l=w+(p^h&(u^p))+m[1]+3905402710&4294967295,w=h+(l<<12&4294967295|l>>>20),l=p+(u^w&(h^u))+m[2]+606105819&4294967295,p=w+(l<<17&4294967295|l>>>15),l=u+(h^p&(w^h))+m[3]+3250441966&4294967295,u=p+(l<<22&4294967295|l>>>10),l=h+(w^u&(p^w))+m[4]+4118548399&4294967295,h=u+(l<<7&4294967295|l>>>25),l=w+(p^h&(u^p))+m[5]+1200080426&4294967295,w=h+(l<<12&4294967295|l>>>20),l=p+(u^w&(h^u))+m[6]+2821735955&4294967295,p=w+(l<<17&4294967295|l>>>15),l=u+(h^p&(w^h))+m[7]+4249261313&4294967295,u=p+(l<<22&4294967295|l>>>10),l=h+(w^u&(p^w))+m[8]+1770035416&4294967295,h=u+(l<<7&4294967295|l>>>25),l=w+(p^h&(u^p))+m[9]+2336552879&4294967295,w=h+(l<<12&4294967295|l>>>20),l=p+(u^w&(h^u))+m[10]+4294925233&4294967295,p=w+(l<<17&4294967295|l>>>15),l=u+(h^p&(w^h))+m[11]+2304563134&4294967295,u=p+(l<<22&4294967295|l>>>10),l=h+(w^u&(p^w))+m[12]+1804603682&4294967295,h=u+(l<<7&4294967295|l>>>25),l=w+(p^h&(u^p))+m[13]+4254626195&4294967295,w=h+(l<<12&4294967295|l>>>20),l=p+(u^w&(h^u))+m[14]+2792965006&4294967295,p=w+(l<<17&4294967295|l>>>15),l=u+(h^p&(w^h))+m[15]+1236535329&4294967295,u=p+(l<<22&4294967295|l>>>10),l=h+(p^w&(u^p))+m[1]+4129170786&4294967295,h=u+(l<<5&4294967295|l>>>27),l=w+(u^p&(h^u))+m[6]+3225465664&4294967295,w=h+(l<<9&4294967295|l>>>23),l=p+(h^u&(w^h))+m[11]+643717713&4294967295,p=w+(l<<14&4294967295|l>>>18),l=u+(w^h&(p^w))+m[0]+3921069994&4294967295,u=p+(l<<20&4294967295|l>>>12),l=h+(p^w&(u^p))+m[5]+3593408605&4294967295,h=u+(l<<5&4294967295|l>>>27),l=w+(u^p&(h^u))+m[10]+38016083&4294967295,w=h+(l<<9&4294967295|l>>>23),l=p+(h^u&(w^h))+m[15]+3634488961&4294967295,p=w+(l<<14&4294967295|l>>>18),l=u+(w^h&(p^w))+m[4]+3889429448&4294967295,u=p+(l<<20&4294967295|l>>>12),l=h+(p^w&(u^p))+m[9]+568446438&4294967295,h=u+(l<<5&4294967295|l>>>27),l=w+(u^p&(h^u))+m[14]+3275163606&4294967295,w=h+(l<<9&4294967295|l>>>23),l=p+(h^u&(w^h))+m[3]+4107603335&4294967295,p=w+(l<<14&4294967295|l>>>18),l=u+(w^h&(p^w))+m[8]+1163531501&4294967295,u=p+(l<<20&4294967295|l>>>12),l=h+(p^w&(u^p))+m[13]+2850285829&4294967295,h=u+(l<<5&4294967295|l>>>27),l=w+(u^p&(h^u))+m[2]+4243563512&4294967295,w=h+(l<<9&4294967295|l>>>23),l=p+(h^u&(w^h))+m[7]+1735328473&4294967295,p=w+(l<<14&4294967295|l>>>18),l=u+(w^h&(p^w))+m[12]+2368359562&4294967295,u=p+(l<<20&4294967295|l>>>12),l=h+(u^p^w)+m[5]+4294588738&4294967295,h=u+(l<<4&4294967295|l>>>28),l=w+(h^u^p)+m[8]+2272392833&4294967295,w=h+(l<<11&4294967295|l>>>21),l=p+(w^h^u)+m[11]+1839030562&4294967295,p=w+(l<<16&4294967295|l>>>16),l=u+(p^w^h)+m[14]+4259657740&4294967295,u=p+(l<<23&4294967295|l>>>9),l=h+(u^p^w)+m[1]+2763975236&4294967295,h=u+(l<<4&4294967295|l>>>28),l=w+(h^u^p)+m[4]+1272893353&4294967295,w=h+(l<<11&4294967295|l>>>21),l=p+(w^h^u)+m[7]+4139469664&4294967295,p=w+(l<<16&4294967295|l>>>16),l=u+(p^w^h)+m[10]+3200236656&4294967295,u=p+(l<<23&4294967295|l>>>9),l=h+(u^p^w)+m[13]+681279174&4294967295,h=u+(l<<4&4294967295|l>>>28),l=w+(h^u^p)+m[0]+3936430074&4294967295,w=h+(l<<11&4294967295|l>>>21),l=p+(w^h^u)+m[3]+3572445317&4294967295,p=w+(l<<16&4294967295|l>>>16),l=u+(p^w^h)+m[6]+76029189&4294967295,u=p+(l<<23&4294967295|l>>>9),l=h+(u^p^w)+m[9]+3654602809&4294967295,h=u+(l<<4&4294967295|l>>>28),l=w+(h^u^p)+m[12]+3873151461&4294967295,w=h+(l<<11&4294967295|l>>>21),l=p+(w^h^u)+m[15]+530742520&4294967295,p=w+(l<<16&4294967295|l>>>16),l=u+(p^w^h)+m[2]+3299628645&4294967295,u=p+(l<<23&4294967295|l>>>9),l=h+(p^(u|~w))+m[0]+4096336452&4294967295,h=u+(l<<6&4294967295|l>>>26),l=w+(u^(h|~p))+m[7]+1126891415&4294967295,w=h+(l<<10&4294967295|l>>>22),l=p+(h^(w|~u))+m[14]+2878612391&4294967295,p=w+(l<<15&4294967295|l>>>17),l=u+(w^(p|~h))+m[5]+4237533241&4294967295,u=p+(l<<21&4294967295|l>>>11),l=h+(p^(u|~w))+m[12]+1700485571&4294967295,h=u+(l<<6&4294967295|l>>>26),l=w+(u^(h|~p))+m[3]+2399980690&4294967295,w=h+(l<<10&4294967295|l>>>22),l=p+(h^(w|~u))+m[10]+4293915773&4294967295,p=w+(l<<15&4294967295|l>>>17),l=u+(w^(p|~h))+m[1]+2240044497&4294967295,u=p+(l<<21&4294967295|l>>>11),l=h+(p^(u|~w))+m[8]+1873313359&4294967295,h=u+(l<<6&4294967295|l>>>26),l=w+(u^(h|~p))+m[15]+4264355552&4294967295,w=h+(l<<10&4294967295|l>>>22),l=p+(h^(w|~u))+m[6]+2734768916&4294967295,p=w+(l<<15&4294967295|l>>>17),l=u+(w^(p|~h))+m[13]+1309151649&4294967295,u=p+(l<<21&4294967295|l>>>11),l=h+(p^(u|~w))+m[4]+4149444226&4294967295,h=u+(l<<6&4294967295|l>>>26),l=w+(u^(h|~p))+m[11]+3174756917&4294967295,w=h+(l<<10&4294967295|l>>>22),l=p+(h^(w|~u))+m[2]+718787259&4294967295,p=w+(l<<15&4294967295|l>>>17),l=u+(w^(p|~h))+m[9]+3951481745&4294967295,g.g[0]=g.g[0]+h&4294967295,g.g[1]=g.g[1]+(p+(l<<21&4294967295|l>>>11))&4294967295,g.g[2]=g.g[2]+p&4294967295,g.g[3]=g.g[3]+w&4294967295}o.prototype.v=function(g,h){h===void 0&&(h=g.length);const u=h-this.blockSize,m=this.C;let p=this.h,w=0;for(;w<h;){if(p==0)for(;w<=u;)c(this,g,w),w+=this.blockSize;if(typeof g=="string"){for(;w<h;)if(m[p++]=g.charCodeAt(w++),p==this.blockSize){c(this,m),p=0;break}}else for(;w<h;)if(m[p++]=g[w++],p==this.blockSize){c(this,m),p=0;break}}this.h=p,this.o+=h},o.prototype.A=function(){var g=Array((this.h<56?this.blockSize:this.blockSize*2)-this.h);g[0]=128;for(var h=1;h<g.length-8;++h)g[h]=0;h=this.o*8;for(var u=g.length-8;u<g.length;++u)g[u]=h&255,h/=256;for(this.v(g),g=Array(16),h=0,u=0;u<4;++u)for(let m=0;m<32;m+=8)g[h++]=this.g[u]>>>m&255;return g};function d(g,h){var u=I;return Object.prototype.hasOwnProperty.call(u,g)?u[g]:u[g]=h(g)}function f(g,h){this.h=h;const u=[];let m=!0;for(let p=g.length-1;p>=0;p--){const w=g[p]|0;m&&w==h||(u[p]=w,m=!1)}this.g=u}var I={};function T(g){return-128<=g&&g<128?d(g,function(h){return new f([h|0],h<0?-1:0)}):new f([g|0],g<0?-1:0)}function v(g){if(isNaN(g)||!isFinite(g))return A;if(g<0)return M(v(-g));const h=[];let u=1;for(let m=0;g>=u;m++)h[m]=g/u|0,u*=4294967296;return new f(h,0)}function O(g,h){if(g.length==0)throw Error("number format error: empty string");if(h=h||10,h<2||36<h)throw Error("radix out of range: "+h);if(g.charAt(0)=="-")return M(O(g.substring(1),h));if(g.indexOf("-")>=0)throw Error('number format error: interior "-" character');const u=v(Math.pow(h,8));let m=A;for(let w=0;w<g.length;w+=8){var p=Math.min(8,g.length-w);const l=parseInt(g.substring(w,w+p),h);p<8?(p=v(Math.pow(h,p)),m=m.j(p).add(v(l))):(m=m.j(u),m=m.add(v(l)))}return m}var A=T(0),S=T(1),x=T(16777216);e=f.prototype,e.m=function(){if(j(this))return-M(this).m();let g=0,h=1;for(let u=0;u<this.g.length;u++){const m=this.i(u);g+=(m>=0?m:4294967296+m)*h,h*=4294967296}return g},e.toString=function(g){if(g=g||10,g<2||36<g)throw Error("radix out of range: "+g);if(P(this))return"0";if(j(this))return"-"+M(this).toString(g);const h=v(Math.pow(g,6));var u=this;let m="";for(;;){const p=rt(u,h).g;u=Q(u,p.j(h));let w=((u.g.length>0?u.g[0]:u.h)>>>0).toString(g);if(u=p,P(u))return w+m;for(;w.length<6;)w="0"+w;m=w+m}},e.i=function(g){return g<0?0:g<this.g.length?this.g[g]:this.h};function P(g){if(g.h!=0)return!1;for(let h=0;h<g.g.length;h++)if(g.g[h]!=0)return!1;return!0}function j(g){return g.h==-1}e.l=function(g){return g=Q(this,g),j(g)?-1:P(g)?0:1};function M(g){const h=g.g.length,u=[];for(let m=0;m<h;m++)u[m]=~g.g[m];return new f(u,~g.h).add(S)}e.abs=function(){return j(this)?M(this):this},e.add=function(g){const h=Math.max(this.g.length,g.g.length),u=[];let m=0;for(let p=0;p<=h;p++){let w=m+(this.i(p)&65535)+(g.i(p)&65535),l=(w>>>16)+(this.i(p)>>>16)+(g.i(p)>>>16);m=l>>>16,w&=65535,l&=65535,u[p]=l<<16|w}return new f(u,u[u.length-1]&-2147483648?-1:0)};function Q(g,h){return g.add(M(h))}e.j=function(g){if(P(this)||P(g))return A;if(j(this))return j(g)?M(this).j(M(g)):M(M(this).j(g));if(j(g))return M(this.j(M(g)));if(this.l(x)<0&&g.l(x)<0)return v(this.m()*g.m());const h=this.g.length+g.g.length,u=[];for(var m=0;m<2*h;m++)u[m]=0;for(m=0;m<this.g.length;m++)for(let p=0;p<g.g.length;p++){const w=this.i(m)>>>16,l=this.i(m)&65535,V=g.i(p)>>>16,pt=g.i(p)&65535;u[2*m+2*p]+=l*pt,q(u,2*m+2*p),u[2*m+2*p+1]+=w*pt,q(u,2*m+2*p+1),u[2*m+2*p+1]+=l*V,q(u,2*m+2*p+1),u[2*m+2*p+2]+=w*V,q(u,2*m+2*p+2)}for(g=0;g<h;g++)u[g]=u[2*g+1]<<16|u[2*g];for(g=h;g<2*h;g++)u[g]=0;return new f(u,0)};function q(g,h){for(;(g[h]&65535)!=g[h];)g[h+1]+=g[h]>>>16,g[h]&=65535,h++}function W(g,h){this.g=g,this.h=h}function rt(g,h){if(P(h))throw Error("division by zero");if(P(g))return new W(A,A);if(j(g))return h=rt(M(g),h),new W(M(h.g),M(h.h));if(j(h))return h=rt(g,M(h)),new W(M(h.g),h.h);if(g.g.length>30){if(j(g)||j(h))throw Error("slowDivide_ only works with positive integers.");for(var u=S,m=h;m.l(g)<=0;)u=st(u),m=st(m);var p=G(u,1),w=G(m,1);for(m=G(m,2),u=G(u,2);!P(m);){var l=w.add(m);l.l(g)<=0&&(p=p.add(u),w=l),m=G(m,1),u=G(u,1)}return h=Q(g,p.j(h)),new W(p,h)}for(p=A;g.l(h)>=0;){for(u=Math.max(1,Math.floor(g.m()/h.m())),m=Math.ceil(Math.log(u)/Math.LN2),m=m<=48?1:Math.pow(2,m-48),w=v(u),l=w.j(h);j(l)||l.l(g)>0;)u-=m,w=v(u),l=w.j(h);P(w)&&(w=S),p=p.add(w),g=Q(g,l)}return new W(p,g)}e.B=function(g){return rt(this,g).h},e.and=function(g){const h=Math.max(this.g.length,g.g.length),u=[];for(let m=0;m<h;m++)u[m]=this.i(m)&g.i(m);return new f(u,this.h&g.h)},e.or=function(g){const h=Math.max(this.g.length,g.g.length),u=[];for(let m=0;m<h;m++)u[m]=this.i(m)|g.i(m);return new f(u,this.h|g.h)},e.xor=function(g){const h=Math.max(this.g.length,g.g.length),u=[];for(let m=0;m<h;m++)u[m]=this.i(m)^g.i(m);return new f(u,this.h^g.h)};function st(g){const h=g.g.length+1,u=[];for(let m=0;m<h;m++)u[m]=g.i(m)<<1|g.i(m-1)>>>31;return new f(u,g.h)}function G(g,h){const u=h>>5;h%=32;const m=g.g.length-u,p=[];for(let w=0;w<m;w++)p[w]=h>0?g.i(w+u)>>>h|g.i(w+u+1)<<32-h:g.i(w+u);return new f(p,g.h)}o.prototype.digest=o.prototype.A,o.prototype.reset=o.prototype.u,o.prototype.update=o.prototype.v,vc=o,f.prototype.add=f.prototype.add,f.prototype.multiply=f.prototype.j,f.prototype.modulo=f.prototype.B,f.prototype.compare=f.prototype.l,f.prototype.toNumber=f.prototype.m,f.prototype.toString=f.prototype.toString,f.prototype.getBits=f.prototype.i,f.fromNumber=v,f.fromString=O,bc=f}).apply(typeof Gi<"u"?Gi:typeof self<"u"?self:typeof window<"u"?window:{});var fe=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var Ic,Ec,Tc,Sc,Ac,Cc,_c,Dc;(function(){var e,n=Object.defineProperty;function s(t){t=[typeof globalThis=="object"&&globalThis,t,typeof window=="object"&&window,typeof self=="object"&&self,typeof fe=="object"&&fe];for(var i=0;i<t.length;++i){var r=t[i];if(r&&r.Math==Math)return r}throw Error("Cannot find global object")}var o=s(this);function c(t,i){if(i)t:{var r=o;t=t.split(".");for(var a=0;a<t.length-1;a++){var y=t[a];if(!(y in r))break t;r=r[y]}t=t[t.length-1],a=r[t],i=i(a),i!=a&&i!=null&&n(r,t,{configurable:!0,writable:!0,value:i})}}c("Symbol.dispose",function(t){return t||Symbol("Symbol.dispose")}),c("Array.prototype.values",function(t){return t||function(){return this[Symbol.iterator]()}}),c("Object.entries",function(t){return t||function(i){var r=[],a;for(a in i)Object.prototype.hasOwnProperty.call(i,a)&&r.push([a,i[a]]);return r}});/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/var d=d||{},f=this||self;function I(t){var i=typeof t;return i=="object"&&t!=null||i=="function"}function T(t,i,r){return t.call.apply(t.bind,arguments)}function v(t,i,r){return v=T,v.apply(null,arguments)}function O(t,i){var r=Array.prototype.slice.call(arguments,1);return function(){var a=r.slice();return a.push.apply(a,arguments),t.apply(this,a)}}function A(t,i){function r(){}r.prototype=i.prototype,t.Z=i.prototype,t.prototype=new r,t.prototype.constructor=t,t.Ob=function(a,y,b){for(var E=Array(arguments.length-2),C=2;C<arguments.length;C++)E[C-2]=arguments[C];return i.prototype[y].apply(a,E)}}var S=typeof AsyncContext<"u"&&typeof AsyncContext.Snapshot=="function"?t=>t&&AsyncContext.Snapshot.wrap(t):t=>t;function x(t){const i=t.length;if(i>0){const r=Array(i);for(let a=0;a<i;a++)r[a]=t[a];return r}return[]}function P(t,i){for(let a=1;a<arguments.length;a++){const y=arguments[a];var r=typeof y;if(r=r!="object"?r:y?Array.isArray(y)?"array":r:"null",r=="array"||r=="object"&&typeof y.length=="number"){r=t.length||0;const b=y.length||0;t.length=r+b;for(let E=0;E<b;E++)t[r+E]=y[E]}else t.push(y)}}class j{constructor(i,r){this.i=i,this.j=r,this.h=0,this.g=null}get(){let i;return this.h>0?(this.h--,i=this.g,this.g=i.next,i.next=null):i=this.i(),i}}function M(t){f.setTimeout(()=>{throw t},0)}function Q(){var t=g;let i=null;return t.g&&(i=t.g,t.g=t.g.next,t.g||(t.h=null),i.next=null),i}class q{constructor(){this.h=this.g=null}add(i,r){const a=W.get();a.set(i,r),this.h?this.h.next=a:this.g=a,this.h=a}}var W=new j(()=>new rt,t=>t.reset());class rt{constructor(){this.next=this.g=this.h=null}set(i,r){this.h=i,this.g=r,this.next=null}reset(){this.next=this.g=this.h=null}}let st,G=!1,g=new q,h=()=>{const t=Promise.resolve(void 0);st=()=>{t.then(u)}};function u(){for(var t;t=Q();){try{t.h.call(t.g)}catch(r){M(r)}var i=W;i.j(t),i.h<100&&(i.h++,t.next=i.g,i.g=t)}G=!1}function m(){this.u=this.u,this.C=this.C}m.prototype.u=!1,m.prototype.dispose=function(){this.u||(this.u=!0,this.N())},m.prototype[Symbol.dispose]=function(){this.dispose()},m.prototype.N=function(){if(this.C)for(;this.C.length;)this.C.shift()()};function p(t,i){this.type=t,this.g=this.target=i,this.defaultPrevented=!1}p.prototype.h=function(){this.defaultPrevented=!0};var w=(function(){if(!f.addEventListener||!Object.defineProperty)return!1;var t=!1,i=Object.defineProperty({},"passive",{get:function(){t=!0}});try{const r=()=>{};f.addEventListener("test",r,i),f.removeEventListener("test",r,i)}catch{}return t})();function l(t){return/^[\s\xa0]*$/.test(t)}function V(t,i){p.call(this,t?t.type:""),this.relatedTarget=this.g=this.target=null,this.button=this.screenY=this.screenX=this.clientY=this.clientX=0,this.key="",this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1,this.state=null,this.pointerId=0,this.pointerType="",this.i=null,t&&this.init(t,i)}A(V,p),V.prototype.init=function(t,i){const r=this.type=t.type,a=t.changedTouches&&t.changedTouches.length?t.changedTouches[0]:null;this.target=t.target||t.srcElement,this.g=i,i=t.relatedTarget,i||(r=="mouseover"?i=t.fromElement:r=="mouseout"&&(i=t.toElement)),this.relatedTarget=i,a?(this.clientX=a.clientX!==void 0?a.clientX:a.pageX,this.clientY=a.clientY!==void 0?a.clientY:a.pageY,this.screenX=a.screenX||0,this.screenY=a.screenY||0):(this.clientX=t.clientX!==void 0?t.clientX:t.pageX,this.clientY=t.clientY!==void 0?t.clientY:t.pageY,this.screenX=t.screenX||0,this.screenY=t.screenY||0),this.button=t.button,this.key=t.key||"",this.ctrlKey=t.ctrlKey,this.altKey=t.altKey,this.shiftKey=t.shiftKey,this.metaKey=t.metaKey,this.pointerId=t.pointerId||0,this.pointerType=t.pointerType,this.state=t.state,this.i=t,t.defaultPrevented&&V.Z.h.call(this)},V.prototype.h=function(){V.Z.h.call(this);const t=this.i;t.preventDefault?t.preventDefault():t.returnValue=!1};var pt="closure_listenable_"+(Math.random()*1e6|0),Fr=0;function Hr(t,i,r,a,y){this.listener=t,this.proxy=null,this.src=i,this.type=r,this.capture=!!a,this.ha=y,this.key=++Fr,this.da=this.fa=!1}function Jt(t){t.da=!0,t.listener=null,t.proxy=null,t.src=null,t.ha=null}function Zt(t,i,r){for(const a in t)i.call(r,t[a],a,t)}function Ur(t,i){for(const r in t)i.call(void 0,t[r],r,t)}function Cn(t){const i={};for(const r in t)i[r]=t[r];return i}const _n="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function Dn(t,i){let r,a;for(let y=1;y<arguments.length;y++){a=arguments[y];for(r in a)t[r]=a[r];for(let b=0;b<_n.length;b++)r=_n[b],Object.prototype.hasOwnProperty.call(a,r)&&(t[r]=a[r])}}function Qt(t){this.src=t,this.g={},this.h=0}Qt.prototype.add=function(t,i,r,a,y){const b=t.toString();t=this.g[b],t||(t=this.g[b]=[],this.h++);const E=Ae(t,i,a,y);return E>-1?(i=t[E],r||(i.fa=!1)):(i=new Hr(i,this.src,b,!!a,y),i.fa=r,t.push(i)),i};function Se(t,i){const r=i.type;if(r in t.g){var a=t.g[r],y=Array.prototype.indexOf.call(a,i,void 0),b;(b=y>=0)&&Array.prototype.splice.call(a,y,1),b&&(Jt(i),t.g[r].length==0&&(delete t.g[r],t.h--))}}function Ae(t,i,r,a){for(let y=0;y<t.length;++y){const b=t[y];if(!b.da&&b.listener==i&&b.capture==!!r&&b.ha==a)return y}return-1}var Ce="closure_lm_"+(Math.random()*1e6|0),_e={};function kn(t,i,r,a,y){if(Array.isArray(i)){for(let b=0;b<i.length;b++)kn(t,i[b],r,a,y);return null}return r=Rn(r),t&&t[pt]?t.J(i,r,I(a)?!!a.capture:!1,y):Vr(t,i,r,!1,a,y)}function Vr(t,i,r,a,y,b){if(!i)throw Error("Invalid event type");const E=I(y)?!!y.capture:!!y;let C=ke(t);if(C||(t[Ce]=C=new Qt(t)),r=C.add(i,r,a,E,b),r.proxy)return r;if(a=Kr(),r.proxy=a,a.src=t,a.listener=r,t.addEventListener)w||(y=E),y===void 0&&(y=!1),t.addEventListener(i.toString(),a,y);else if(t.attachEvent)t.attachEvent(Mn(i.toString()),a);else if(t.addListener&&t.removeListener)t.addListener(a);else throw Error("addEventListener and attachEvent are unavailable.");return r}function Kr(){function t(r){return i.call(t.src,t.listener,r)}const i=zr;return t}function On(t,i,r,a,y){if(Array.isArray(i))for(var b=0;b<i.length;b++)On(t,i[b],r,a,y);else a=I(a)?!!a.capture:!!a,r=Rn(r),t&&t[pt]?(t=t.i,b=String(i).toString(),b in t.g&&(i=t.g[b],r=Ae(i,r,a,y),r>-1&&(Jt(i[r]),Array.prototype.splice.call(i,r,1),i.length==0&&(delete t.g[b],t.h--)))):t&&(t=ke(t))&&(i=t.g[i.toString()],t=-1,i&&(t=Ae(i,r,a,y)),(r=t>-1?i[t]:null)&&De(r))}function De(t){if(typeof t!="number"&&t&&!t.da){var i=t.src;if(i&&i[pt])Se(i.i,t);else{var r=t.type,a=t.proxy;i.removeEventListener?i.removeEventListener(r,a,t.capture):i.detachEvent?i.detachEvent(Mn(r),a):i.addListener&&i.removeListener&&i.removeListener(a),(r=ke(i))?(Se(r,t),r.h==0&&(r.src=null,i[Ce]=null)):Jt(t)}}}function Mn(t){return t in _e?_e[t]:_e[t]="on"+t}function zr(t,i){if(t.da)t=!0;else{i=new V(i,this);const r=t.listener,a=t.ha||t.src;t.fa&&De(t),t=r.call(a,i)}return t}function ke(t){return t=t[Ce],t instanceof Qt?t:null}var Oe="__closure_events_fn_"+(Math.random()*1e9>>>0);function Rn(t){return typeof t=="function"?t:(t[Oe]||(t[Oe]=function(i){return t.handleEvent(i)}),t[Oe])}function $(){m.call(this),this.i=new Qt(this),this.M=this,this.G=null}A($,m),$.prototype[pt]=!0,$.prototype.removeEventListener=function(t,i,r,a){On(this,t,i,r,a)};function F(t,i){var r,a=t.G;if(a)for(r=[];a;a=a.G)r.push(a);if(t=t.M,a=i.type||i,typeof i=="string")i=new p(i,t);else if(i instanceof p)i.target=i.target||t;else{var y=i;i=new p(a,t),Dn(i,y)}y=!0;let b,E;if(r)for(E=r.length-1;E>=0;E--)b=i.g=r[E],y=te(b,a,!0,i)&&y;if(b=i.g=t,y=te(b,a,!0,i)&&y,y=te(b,a,!1,i)&&y,r)for(E=0;E<r.length;E++)b=i.g=r[E],y=te(b,a,!1,i)&&y}$.prototype.N=function(){if($.Z.N.call(this),this.i){var t=this.i;for(const i in t.g){const r=t.g[i];for(let a=0;a<r.length;a++)Jt(r[a]);delete t.g[i],t.h--}}this.G=null},$.prototype.J=function(t,i,r,a){return this.i.add(String(t),i,!1,r,a)},$.prototype.K=function(t,i,r,a){return this.i.add(String(t),i,!0,r,a)};function te(t,i,r,a){if(i=t.i.g[String(i)],!i)return!0;i=i.concat();let y=!0;for(let b=0;b<i.length;++b){const E=i[b];if(E&&!E.da&&E.capture==r){const C=E.listener,N=E.ha||E.src;E.fa&&Se(t.i,E),y=C.call(N,a)!==!1&&y}}return y&&!a.defaultPrevented}function Wr(t,i){if(typeof t!="function")if(t&&typeof t.handleEvent=="function")t=v(t.handleEvent,t);else throw Error("Invalid listener argument");return Number(i)>2147483647?-1:f.setTimeout(t,i||0)}function Pn(t){t.g=Wr(()=>{t.g=null,t.i&&(t.i=!1,Pn(t))},t.l);const i=t.h;t.h=null,t.m.apply(null,i)}class Gr extends m{constructor(i,r){super(),this.m=i,this.l=r,this.h=null,this.i=!1,this.g=null}j(i){this.h=arguments,this.g?this.i=!0:Pn(this)}N(){super.N(),this.g&&(f.clearTimeout(this.g),this.g=null,this.i=!1,this.h=null)}}function Ot(t){m.call(this),this.h=t,this.g={}}A(Ot,m);var Nn=[];function xn(t){Zt(t.g,function(i,r){this.g.hasOwnProperty(r)&&De(i)},t),t.g={}}Ot.prototype.N=function(){Ot.Z.N.call(this),xn(this)},Ot.prototype.handleEvent=function(){throw Error("EventHandler.handleEvent not implemented")};var Me=f.JSON.stringify,qr=f.JSON.parse,Xr=class{stringify(t){return f.JSON.stringify(t,void 0)}parse(t){return f.JSON.parse(t,void 0)}};function Bn(){}function jn(){}var Mt={OPEN:"a",hb:"b",ERROR:"c",tb:"d"};function Re(){p.call(this,"d")}A(Re,p);function Pe(){p.call(this,"c")}A(Pe,p);var dt={},Ln=null;function ee(){return Ln=Ln||new $}dt.Ia="serverreachability";function $n(t){p.call(this,dt.Ia,t)}A($n,p);function Rt(t){const i=ee();F(i,new $n(i))}dt.STAT_EVENT="statevent";function Fn(t,i){p.call(this,dt.STAT_EVENT,t),this.stat=i}A(Fn,p);function H(t){const i=ee();F(i,new Fn(i,t))}dt.Ja="timingevent";function Hn(t,i){p.call(this,dt.Ja,t),this.size=i}A(Hn,p);function Pt(t,i){if(typeof t!="function")throw Error("Fn must not be null and must be a function");return f.setTimeout(function(){t()},i)}function Nt(){this.g=!0}Nt.prototype.ua=function(){this.g=!1};function Yr(t,i,r,a,y,b){t.info(function(){if(t.g)if(b){var E="",C=b.split("&");for(let _=0;_<C.length;_++){var N=C[_].split("=");if(N.length>1){const B=N[0];N=N[1];const Y=B.split("_");E=Y.length>=2&&Y[1]=="type"?E+(B+"="+N+"&"):E+(B+"=redacted&")}}}else E=null;else E=b;return"XMLHTTP REQ ("+a+") [attempt "+y+"]: "+i+`
`+r+`
`+E})}function Jr(t,i,r,a,y,b,E){t.info(function(){return"XMLHTTP RESP ("+a+") [ attempt "+y+"]: "+i+`
`+r+`
`+b+" "+E})}function Ct(t,i,r,a){t.info(function(){return"XMLHTTP TEXT ("+i+"): "+Qr(t,r)+(a?" "+a:"")})}function Zr(t,i){t.info(function(){return"TIMEOUT: "+i})}Nt.prototype.info=function(){};function Qr(t,i){if(!t.g)return i;if(!i)return null;try{const b=JSON.parse(i);if(b){for(t=0;t<b.length;t++)if(Array.isArray(b[t])){var r=b[t];if(!(r.length<2)){var a=r[1];if(Array.isArray(a)&&!(a.length<1)){var y=a[0];if(y!="noop"&&y!="stop"&&y!="close")for(let E=1;E<a.length;E++)a[E]=""}}}}return Me(b)}catch{return i}}var ne={NO_ERROR:0,cb:1,qb:2,pb:3,kb:4,ob:5,rb:6,Ga:7,TIMEOUT:8,ub:9},Un={ib:"complete",Fb:"success",ERROR:"error",Ga:"abort",xb:"ready",yb:"readystatechange",TIMEOUT:"timeout",sb:"incrementaldata",wb:"progress",lb:"downloadprogress",Nb:"uploadprogress"},Vn;function Ne(){}A(Ne,Bn),Ne.prototype.g=function(){return new XMLHttpRequest},Vn=new Ne;function xt(t){return encodeURIComponent(String(t))}function ts(t){var i=1;t=t.split(":");const r=[];for(;i>0&&t.length;)r.push(t.shift()),i--;return t.length&&r.push(t.join(":")),r}function ot(t,i,r,a){this.j=t,this.i=i,this.l=r,this.S=a||1,this.V=new Ot(this),this.H=45e3,this.J=null,this.o=!1,this.u=this.B=this.A=this.M=this.F=this.T=this.D=null,this.G=[],this.g=null,this.C=0,this.m=this.v=null,this.X=-1,this.K=!1,this.P=0,this.O=null,this.W=this.L=this.U=this.R=!1,this.h=new Kn}function Kn(){this.i=null,this.g="",this.h=!1}var zn={},xe={};function Be(t,i,r){t.M=1,t.A=re(X(i)),t.u=r,t.R=!0,Wn(t,null)}function Wn(t,i){t.F=Date.now(),ie(t),t.B=X(t.A);var r=t.B,a=t.S;Array.isArray(a)||(a=[String(a)]),si(r.i,"t",a),t.C=0,r=t.j.L,t.h=new Kn,t.g=Ti(t.j,r?i:null,!t.u),t.P>0&&(t.O=new Gr(v(t.Y,t,t.g),t.P)),i=t.V,r=t.g,a=t.ba;var y="readystatechange";Array.isArray(y)||(y&&(Nn[0]=y.toString()),y=Nn);for(let b=0;b<y.length;b++){const E=kn(r,y[b],a||i.handleEvent,!1,i.h||i);if(!E)break;i.g[E.key]=E}i=t.J?Cn(t.J):{},t.u?(t.v||(t.v="POST"),i["Content-Type"]="application/x-www-form-urlencoded",t.g.ea(t.B,t.v,t.u,i)):(t.v="GET",t.g.ea(t.B,t.v,null,i)),Rt(),Yr(t.i,t.v,t.B,t.l,t.S,t.u)}ot.prototype.ba=function(t){t=t.target;const i=this.O;i&&ht(t)==3?i.j():this.Y(t)},ot.prototype.Y=function(t){try{if(t==this.g)t:{const C=ht(this.g),N=this.g.ya(),_=this.g.ca();if(!(C<3)&&(C!=3||this.g&&(this.h.h||this.g.la()||fi(this.g)))){this.K||C!=4||N==7||(N==8||_<=0?Rt(3):Rt(2)),je(this);var i=this.g.ca();this.X=i;var r=es(this);if(this.o=i==200,Jr(this.i,this.v,this.B,this.l,this.S,C,i),this.o){if(this.U&&!this.L){e:{if(this.g){var a,y=this.g;if((a=y.g?y.g.getResponseHeader("X-HTTP-Initial-Response"):null)&&!l(a)){var b=a;break e}}b=null}if(t=b)Ct(this.i,this.l,t,"Initial handshake response via X-HTTP-Initial-Response"),this.L=!0,Le(this,t);else{this.o=!1,this.m=3,H(12),gt(this),Bt(this);break t}}if(this.R){t=!0;let B;for(;!this.K&&this.C<r.length;)if(B=ns(this,r),B==xe){C==4&&(this.m=4,H(14),t=!1),Ct(this.i,this.l,null,"[Incomplete Response]");break}else if(B==zn){this.m=4,H(15),Ct(this.i,this.l,r,"[Invalid Chunk]"),t=!1;break}else Ct(this.i,this.l,B,null),Le(this,B);if(Gn(this)&&this.C!=0&&(this.h.g=this.h.g.slice(this.C),this.C=0),C!=4||r.length!=0||this.h.h||(this.m=1,H(16),t=!1),this.o=this.o&&t,!t)Ct(this.i,this.l,r,"[Invalid Chunked Response]"),gt(this),Bt(this);else if(r.length>0&&!this.W){this.W=!0;var E=this.j;E.g==this&&E.aa&&!E.P&&(E.j.info("Great, no buffering proxy detected. Bytes received: "+r.length),We(E),E.P=!0,H(11))}}else Ct(this.i,this.l,r,null),Le(this,r);C==4&&gt(this),this.o&&!this.K&&(C==4?bi(this.j,this):(this.o=!1,ie(this)))}else ms(this.g),i==400&&r.indexOf("Unknown SID")>0?(this.m=3,H(12)):(this.m=0,H(13)),gt(this),Bt(this)}}}catch{}finally{}};function es(t){if(!Gn(t))return t.g.la();const i=fi(t.g);if(i==="")return"";let r="";const a=i.length,y=ht(t.g)==4;if(!t.h.i){if(typeof TextDecoder>"u")return gt(t),Bt(t),"";t.h.i=new f.TextDecoder}for(let b=0;b<a;b++)t.h.h=!0,r+=t.h.i.decode(i[b],{stream:!(y&&b==a-1)});return i.length=0,t.h.g+=r,t.C=0,t.h.g}function Gn(t){return t.g?t.v=="GET"&&t.M!=2&&t.j.Aa:!1}function ns(t,i){var r=t.C,a=i.indexOf(`
`,r);return a==-1?xe:(r=Number(i.substring(r,a)),isNaN(r)?zn:(a+=1,a+r>i.length?xe:(i=i.slice(a,a+r),t.C=a+r,i)))}ot.prototype.cancel=function(){this.K=!0,gt(this)};function ie(t){t.T=Date.now()+t.H,qn(t,t.H)}function qn(t,i){if(t.D!=null)throw Error("WatchDog timer not null");t.D=Pt(v(t.aa,t),i)}function je(t){t.D&&(f.clearTimeout(t.D),t.D=null)}ot.prototype.aa=function(){this.D=null;const t=Date.now();t-this.T>=0?(Zr(this.i,this.B),this.M!=2&&(Rt(),H(17)),gt(this),this.m=2,Bt(this)):qn(this,this.T-t)};function Bt(t){t.j.I==0||t.K||bi(t.j,t)}function gt(t){je(t);var i=t.O;i&&typeof i.dispose=="function"&&i.dispose(),t.O=null,xn(t.V),t.g&&(i=t.g,t.g=null,i.abort(),i.dispose())}function Le(t,i){try{var r=t.j;if(r.I!=0&&(r.g==t||$e(r.h,t))){if(!t.L&&$e(r.h,t)&&r.I==3){try{var a=r.Ba.g.parse(i)}catch{a=null}if(Array.isArray(a)&&a.length==3){var y=a;if(y[0]==0){t:if(!r.v){if(r.g)if(r.g.F+3e3<t.F)he(r),ae(r);else break t;ze(r),H(18)}}else r.xa=y[1],0<r.xa-r.K&&y[2]<37500&&r.F&&r.A==0&&!r.C&&(r.C=Pt(v(r.Va,r),6e3));Jn(r.h)<=1&&r.ta&&(r.ta=void 0)}else yt(r,11)}else if((t.L||r.g==t)&&he(r),!l(i))for(y=r.Ba.g.parse(i),i=0;i<y.length;i++){let _=y[i];const B=_[0];if(!(B<=r.K))if(r.K=B,_=_[1],r.I==2)if(_[0]=="c"){r.M=_[1],r.ba=_[2];const Y=_[3];Y!=null&&(r.ka=Y,r.j.info("VER="+r.ka));const wt=_[4];wt!=null&&(r.za=wt,r.j.info("SVER="+r.za));const lt=_[5];lt!=null&&typeof lt=="number"&&lt>0&&(a=1.5*lt,r.O=a,r.j.info("backChannelRequestTimeoutMs_="+a)),a=r;const ut=t.g;if(ut){const ue=ut.g?ut.g.getResponseHeader("X-Client-Wire-Protocol"):null;if(ue){var b=a.h;b.g||ue.indexOf("spdy")==-1&&ue.indexOf("quic")==-1&&ue.indexOf("h2")==-1||(b.j=b.l,b.g=new Set,b.h&&(Fe(b,b.h),b.h=null))}if(a.G){const Ge=ut.g?ut.g.getResponseHeader("X-HTTP-Session-Id"):null;Ge&&(a.wa=Ge,D(a.J,a.G,Ge))}}r.I=3,r.l&&r.l.ra(),r.aa&&(r.T=Date.now()-t.F,r.j.info("Handshake RTT: "+r.T+"ms")),a=r;var E=t;if(a.na=Ei(a,a.L?a.ba:null,a.W),E.L){Zn(a.h,E);var C=E,N=a.O;N&&(C.H=N),C.D&&(je(C),ie(C)),a.g=E}else yi(a);r.i.length>0&&ce(r)}else _[0]!="stop"&&_[0]!="close"||yt(r,7);else r.I==3&&(_[0]=="stop"||_[0]=="close"?_[0]=="stop"?yt(r,7):Ke(r):_[0]!="noop"&&r.l&&r.l.qa(_),r.A=0)}}Rt(4)}catch{}}var is=class{constructor(t,i){this.g=t,this.map=i}};function Xn(t){this.l=t||10,f.PerformanceNavigationTiming?(t=f.performance.getEntriesByType("navigation"),t=t.length>0&&(t[0].nextHopProtocol=="hq"||t[0].nextHopProtocol=="h2")):t=!!(f.chrome&&f.chrome.loadTimes&&f.chrome.loadTimes()&&f.chrome.loadTimes().wasFetchedViaSpdy),this.j=t?this.l:1,this.g=null,this.j>1&&(this.g=new Set),this.h=null,this.i=[]}function Yn(t){return t.h?!0:t.g?t.g.size>=t.j:!1}function Jn(t){return t.h?1:t.g?t.g.size:0}function $e(t,i){return t.h?t.h==i:t.g?t.g.has(i):!1}function Fe(t,i){t.g?t.g.add(i):t.h=i}function Zn(t,i){t.h&&t.h==i?t.h=null:t.g&&t.g.has(i)&&t.g.delete(i)}Xn.prototype.cancel=function(){if(this.i=Qn(this),this.h)this.h.cancel(),this.h=null;else if(this.g&&this.g.size!==0){for(const t of this.g.values())t.cancel();this.g.clear()}};function Qn(t){if(t.h!=null)return t.i.concat(t.h.G);if(t.g!=null&&t.g.size!==0){let i=t.i;for(const r of t.g.values())i=i.concat(r.G);return i}return x(t.i)}var ti=RegExp("^(?:([^:/?#.]+):)?(?://(?:([^\\\\/?#]*)@)?([^\\\\/?#]*?)(?::([0-9]+))?(?=[\\\\/?#]|$))?([^?#]+)?(?:\\?([^#]*))?(?:#([\\s\\S]*))?$");function rs(t,i){if(t){t=t.split("&");for(let r=0;r<t.length;r++){const a=t[r].indexOf("=");let y,b=null;a>=0?(y=t[r].substring(0,a),b=t[r].substring(a+1)):y=t[r],i(y,b?decodeURIComponent(b.replace(/\+/g," ")):"")}}}function at(t){this.g=this.o=this.j="",this.u=null,this.m=this.h="",this.l=!1;let i;t instanceof at?(this.l=t.l,jt(this,t.j),this.o=t.o,this.g=t.g,Lt(this,t.u),this.h=t.h,He(this,oi(t.i)),this.m=t.m):t&&(i=String(t).match(ti))?(this.l=!1,jt(this,i[1]||"",!0),this.o=$t(i[2]||""),this.g=$t(i[3]||"",!0),Lt(this,i[4]),this.h=$t(i[5]||"",!0),He(this,i[6]||"",!0),this.m=$t(i[7]||"")):(this.l=!1,this.i=new Ht(null,this.l))}at.prototype.toString=function(){const t=[];var i=this.j;i&&t.push(Ft(i,ei,!0),":");var r=this.g;return(r||i=="file")&&(t.push("//"),(i=this.o)&&t.push(Ft(i,ei,!0),"@"),t.push(xt(r).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),r=this.u,r!=null&&t.push(":",String(r))),(r=this.h)&&(this.g&&r.charAt(0)!="/"&&t.push("/"),t.push(Ft(r,r.charAt(0)=="/"?as:os,!0))),(r=this.i.toString())&&t.push("?",r),(r=this.m)&&t.push("#",Ft(r,hs)),t.join("")},at.prototype.resolve=function(t){const i=X(this);let r=!!t.j;r?jt(i,t.j):r=!!t.o,r?i.o=t.o:r=!!t.g,r?i.g=t.g:r=t.u!=null;var a=t.h;if(r)Lt(i,t.u);else if(r=!!t.h){if(a.charAt(0)!="/")if(this.g&&!this.h)a="/"+a;else{var y=i.h.lastIndexOf("/");y!=-1&&(a=i.h.slice(0,y+1)+a)}if(y=a,y==".."||y==".")a="";else if(y.indexOf("./")!=-1||y.indexOf("/.")!=-1){a=y.lastIndexOf("/",0)==0,y=y.split("/");const b=[];for(let E=0;E<y.length;){const C=y[E++];C=="."?a&&E==y.length&&b.push(""):C==".."?((b.length>1||b.length==1&&b[0]!="")&&b.pop(),a&&E==y.length&&b.push("")):(b.push(C),a=!0)}a=b.join("/")}else a=y}return r?i.h=a:r=t.i.toString()!=="",r?He(i,oi(t.i)):r=!!t.m,r&&(i.m=t.m),i};function X(t){return new at(t)}function jt(t,i,r){t.j=r?$t(i,!0):i,t.j&&(t.j=t.j.replace(/:$/,""))}function Lt(t,i){if(i){if(i=Number(i),isNaN(i)||i<0)throw Error("Bad port number "+i);t.u=i}else t.u=null}function He(t,i,r){i instanceof Ht?(t.i=i,ls(t.i,t.l)):(r||(i=Ft(i,cs)),t.i=new Ht(i,t.l))}function D(t,i,r){t.i.set(i,r)}function re(t){return D(t,"zx",Math.floor(Math.random()*2147483648).toString(36)+Math.abs(Math.floor(Math.random()*2147483648)^Date.now()).toString(36)),t}function $t(t,i){return t?i?decodeURI(t.replace(/%25/g,"%2525")):decodeURIComponent(t):""}function Ft(t,i,r){return typeof t=="string"?(t=encodeURI(t).replace(i,ss),r&&(t=t.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),t):null}function ss(t){return t=t.charCodeAt(0),"%"+(t>>4&15).toString(16)+(t&15).toString(16)}var ei=/[#\/\?@]/g,os=/[#\?:]/g,as=/[#\?]/g,cs=/[#\?@]/g,hs=/#/g;function Ht(t,i){this.h=this.g=null,this.i=t||null,this.j=!!i}function mt(t){t.g||(t.g=new Map,t.h=0,t.i&&rs(t.i,function(i,r){t.add(decodeURIComponent(i.replace(/\+/g," ")),r)}))}e=Ht.prototype,e.add=function(t,i){mt(this),this.i=null,t=_t(this,t);let r=this.g.get(t);return r||this.g.set(t,r=[]),r.push(i),this.h+=1,this};function ni(t,i){mt(t),i=_t(t,i),t.g.has(i)&&(t.i=null,t.h-=t.g.get(i).length,t.g.delete(i))}function ii(t,i){return mt(t),i=_t(t,i),t.g.has(i)}e.forEach=function(t,i){mt(this),this.g.forEach(function(r,a){r.forEach(function(y){t.call(i,y,a,this)},this)},this)};function ri(t,i){mt(t);let r=[];if(typeof i=="string")ii(t,i)&&(r=r.concat(t.g.get(_t(t,i))));else for(t=Array.from(t.g.values()),i=0;i<t.length;i++)r=r.concat(t[i]);return r}e.set=function(t,i){return mt(this),this.i=null,t=_t(this,t),ii(this,t)&&(this.h-=this.g.get(t).length),this.g.set(t,[i]),this.h+=1,this},e.get=function(t,i){return t?(t=ri(this,t),t.length>0?String(t[0]):i):i};function si(t,i,r){ni(t,i),r.length>0&&(t.i=null,t.g.set(_t(t,i),x(r)),t.h+=r.length)}e.toString=function(){if(this.i)return this.i;if(!this.g)return"";const t=[],i=Array.from(this.g.keys());for(let a=0;a<i.length;a++){var r=i[a];const y=xt(r);r=ri(this,r);for(let b=0;b<r.length;b++){let E=y;r[b]!==""&&(E+="="+xt(r[b])),t.push(E)}}return this.i=t.join("&")};function oi(t){const i=new Ht;return i.i=t.i,t.g&&(i.g=new Map(t.g),i.h=t.h),i}function _t(t,i){return i=String(i),t.j&&(i=i.toLowerCase()),i}function ls(t,i){i&&!t.j&&(mt(t),t.i=null,t.g.forEach(function(r,a){const y=a.toLowerCase();a!=y&&(ni(this,a),si(this,y,r))},t)),t.j=i}function us(t,i){const r=new Nt;if(f.Image){const a=new Image;a.onload=O(ct,r,"TestLoadImage: loaded",!0,i,a),a.onerror=O(ct,r,"TestLoadImage: error",!1,i,a),a.onabort=O(ct,r,"TestLoadImage: abort",!1,i,a),a.ontimeout=O(ct,r,"TestLoadImage: timeout",!1,i,a),f.setTimeout(function(){a.ontimeout&&a.ontimeout()},1e4),a.src=t}else i(!1)}function fs(t,i){const r=new Nt,a=new AbortController,y=setTimeout(()=>{a.abort(),ct(r,"TestPingServer: timeout",!1,i)},1e4);fetch(t,{signal:a.signal}).then(b=>{clearTimeout(y),b.ok?ct(r,"TestPingServer: ok",!0,i):ct(r,"TestPingServer: server error",!1,i)}).catch(()=>{clearTimeout(y),ct(r,"TestPingServer: error",!1,i)})}function ct(t,i,r,a,y){try{y&&(y.onload=null,y.onerror=null,y.onabort=null,y.ontimeout=null),a(r)}catch{}}function ps(){this.g=new Xr}function Ue(t){this.i=t.Sb||null,this.h=t.ab||!1}A(Ue,Bn),Ue.prototype.g=function(){return new se(this.i,this.h)};function se(t,i){$.call(this),this.H=t,this.o=i,this.m=void 0,this.status=this.readyState=0,this.responseType=this.responseText=this.response=this.statusText="",this.onreadystatechange=null,this.A=new Headers,this.h=null,this.F="GET",this.D="",this.g=!1,this.B=this.j=this.l=null,this.v=new AbortController}A(se,$),e=se.prototype,e.open=function(t,i){if(this.readyState!=0)throw this.abort(),Error("Error reopening a connection");this.F=t,this.D=i,this.readyState=1,Vt(this)},e.send=function(t){if(this.readyState!=1)throw this.abort(),Error("need to call open() first. ");if(this.v.signal.aborted)throw this.abort(),Error("Request was aborted.");this.g=!0;const i={headers:this.A,method:this.F,credentials:this.m,cache:void 0,signal:this.v.signal};t&&(i.body=t),(this.H||f).fetch(new Request(this.D,i)).then(this.Pa.bind(this),this.ga.bind(this))},e.abort=function(){this.response=this.responseText="",this.A=new Headers,this.status=0,this.v.abort(),this.j&&this.j.cancel("Request was aborted.").catch(()=>{}),this.readyState>=1&&this.g&&this.readyState!=4&&(this.g=!1,Ut(this)),this.readyState=0},e.Pa=function(t){if(this.g&&(this.l=t,this.h||(this.status=this.l.status,this.statusText=this.l.statusText,this.h=t.headers,this.readyState=2,Vt(this)),this.g&&(this.readyState=3,Vt(this),this.g)))if(this.responseType==="arraybuffer")t.arrayBuffer().then(this.Na.bind(this),this.ga.bind(this));else if(typeof f.ReadableStream<"u"&&"body"in t){if(this.j=t.body.getReader(),this.o){if(this.responseType)throw Error('responseType must be empty for "streamBinaryChunks" mode responses.');this.response=[]}else this.response=this.responseText="",this.B=new TextDecoder;ai(this)}else t.text().then(this.Oa.bind(this),this.ga.bind(this))};function ai(t){t.j.read().then(t.Ma.bind(t)).catch(t.ga.bind(t))}e.Ma=function(t){if(this.g){if(this.o&&t.value)this.response.push(t.value);else if(!this.o){var i=t.value?t.value:new Uint8Array(0);(i=this.B.decode(i,{stream:!t.done}))&&(this.response=this.responseText+=i)}t.done?Ut(this):Vt(this),this.readyState==3&&ai(this)}},e.Oa=function(t){this.g&&(this.response=this.responseText=t,Ut(this))},e.Na=function(t){this.g&&(this.response=t,Ut(this))},e.ga=function(){this.g&&Ut(this)};function Ut(t){t.readyState=4,t.l=null,t.j=null,t.B=null,Vt(t)}e.setRequestHeader=function(t,i){this.A.append(t,i)},e.getResponseHeader=function(t){return this.h&&this.h.get(t.toLowerCase())||""},e.getAllResponseHeaders=function(){if(!this.h)return"";const t=[],i=this.h.entries();for(var r=i.next();!r.done;)r=r.value,t.push(r[0]+": "+r[1]),r=i.next();return t.join(`\r
`)};function Vt(t){t.onreadystatechange&&t.onreadystatechange.call(t)}Object.defineProperty(se.prototype,"withCredentials",{get:function(){return this.m==="include"},set:function(t){this.m=t?"include":"same-origin"}});function ci(t){let i="";return Zt(t,function(r,a){i+=a,i+=":",i+=r,i+=`\r
`}),i}function Ve(t,i,r){t:{for(a in r){var a=!1;break t}a=!0}a||(r=ci(r),typeof t=="string"?r!=null&&xt(r):D(t,i,r))}function R(t){$.call(this),this.headers=new Map,this.L=t||null,this.h=!1,this.g=null,this.D="",this.o=0,this.l="",this.j=this.B=this.v=this.A=!1,this.m=null,this.F="",this.H=!1}A(R,$);var ds=/^https?$/i,gs=["POST","PUT"];e=R.prototype,e.Fa=function(t){this.H=t},e.ea=function(t,i,r,a){if(this.g)throw Error("[goog.net.XhrIo] Object is active with another request="+this.D+"; newUri="+t);i=i?i.toUpperCase():"GET",this.D=t,this.l="",this.o=0,this.A=!1,this.h=!0,this.g=this.L?this.L.g():Vn.g(),this.g.onreadystatechange=S(v(this.Ca,this));try{this.B=!0,this.g.open(i,String(t),!0),this.B=!1}catch(b){hi(this,b);return}if(t=r||"",r=new Map(this.headers),a)if(Object.getPrototypeOf(a)===Object.prototype)for(var y in a)r.set(y,a[y]);else if(typeof a.keys=="function"&&typeof a.get=="function")for(const b of a.keys())r.set(b,a.get(b));else throw Error("Unknown input type for opt_headers: "+String(a));a=Array.from(r.keys()).find(b=>b.toLowerCase()=="content-type"),y=f.FormData&&t instanceof f.FormData,!(Array.prototype.indexOf.call(gs,i,void 0)>=0)||a||y||r.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");for(const[b,E]of r)this.g.setRequestHeader(b,E);this.F&&(this.g.responseType=this.F),"withCredentials"in this.g&&this.g.withCredentials!==this.H&&(this.g.withCredentials=this.H);try{this.m&&(clearTimeout(this.m),this.m=null),this.v=!0,this.g.send(t),this.v=!1}catch(b){hi(this,b)}};function hi(t,i){t.h=!1,t.g&&(t.j=!0,t.g.abort(),t.j=!1),t.l=i,t.o=5,li(t),oe(t)}function li(t){t.A||(t.A=!0,F(t,"complete"),F(t,"error"))}e.abort=function(t){this.g&&this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1,this.o=t||7,F(this,"complete"),F(this,"abort"),oe(this))},e.N=function(){this.g&&(this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1),oe(this,!0)),R.Z.N.call(this)},e.Ca=function(){this.u||(this.B||this.v||this.j?ui(this):this.Xa())},e.Xa=function(){ui(this)};function ui(t){if(t.h&&typeof d<"u"){if(t.v&&ht(t)==4)setTimeout(t.Ca.bind(t),0);else if(F(t,"readystatechange"),ht(t)==4){t.h=!1;try{const b=t.ca();t:switch(b){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var i=!0;break t;default:i=!1}var r;if(!(r=i)){var a;if(a=b===0){let E=String(t.D).match(ti)[1]||null;!E&&f.self&&f.self.location&&(E=f.self.location.protocol.slice(0,-1)),a=!ds.test(E?E.toLowerCase():"")}r=a}if(r)F(t,"complete"),F(t,"success");else{t.o=6;try{var y=ht(t)>2?t.g.statusText:""}catch{y=""}t.l=y+" ["+t.ca()+"]",li(t)}}finally{oe(t)}}}}function oe(t,i){if(t.g){t.m&&(clearTimeout(t.m),t.m=null);const r=t.g;t.g=null,i||F(t,"ready");try{r.onreadystatechange=null}catch{}}}e.isActive=function(){return!!this.g};function ht(t){return t.g?t.g.readyState:0}e.ca=function(){try{return ht(this)>2?this.g.status:-1}catch{return-1}},e.la=function(){try{return this.g?this.g.responseText:""}catch{return""}},e.La=function(t){if(this.g){var i=this.g.responseText;return t&&i.indexOf(t)==0&&(i=i.substring(t.length)),qr(i)}};function fi(t){try{if(!t.g)return null;if("response"in t.g)return t.g.response;switch(t.F){case"":case"text":return t.g.responseText;case"arraybuffer":if("mozResponseArrayBuffer"in t.g)return t.g.mozResponseArrayBuffer}return null}catch{return null}}function ms(t){const i={};t=(t.g&&ht(t)>=2&&t.g.getAllResponseHeaders()||"").split(`\r
`);for(let a=0;a<t.length;a++){if(l(t[a]))continue;var r=ts(t[a]);const y=r[0];if(r=r[1],typeof r!="string")continue;r=r.trim();const b=i[y]||[];i[y]=b,b.push(r)}Ur(i,function(a){return a.join(", ")})}e.ya=function(){return this.o},e.Ha=function(){return typeof this.l=="string"?this.l:String(this.l)};function Kt(t,i,r){return r&&r.internalChannelParams&&r.internalChannelParams[t]||i}function pi(t){this.za=0,this.i=[],this.j=new Nt,this.ba=this.na=this.J=this.W=this.g=this.wa=this.G=this.H=this.u=this.U=this.o=null,this.Ya=this.V=0,this.Sa=Kt("failFast",!1,t),this.F=this.C=this.v=this.m=this.l=null,this.X=!0,this.xa=this.K=-1,this.Y=this.A=this.D=0,this.Qa=Kt("baseRetryDelayMs",5e3,t),this.Za=Kt("retryDelaySeedMs",1e4,t),this.Ta=Kt("forwardChannelMaxRetries",2,t),this.va=Kt("forwardChannelRequestTimeoutMs",2e4,t),this.ma=t&&t.xmlHttpFactory||void 0,this.Ua=t&&t.Rb||void 0,this.Aa=t&&t.useFetchStreams||!1,this.O=void 0,this.L=t&&t.supportsCrossDomainXhr||!1,this.M="",this.h=new Xn(t&&t.concurrentRequestLimit),this.Ba=new ps,this.S=t&&t.fastHandshake||!1,this.R=t&&t.encodeInitMessageHeaders||!1,this.S&&this.R&&(this.R=!1),this.Ra=t&&t.Pb||!1,t&&t.ua&&this.j.ua(),t&&t.forceLongPolling&&(this.X=!1),this.aa=!this.S&&this.X&&t&&t.detectBufferingProxy||!1,this.ia=void 0,t&&t.longPollingTimeout&&t.longPollingTimeout>0&&(this.ia=t.longPollingTimeout),this.ta=void 0,this.T=0,this.P=!1,this.ja=this.B=null}e=pi.prototype,e.ka=8,e.I=1,e.connect=function(t,i,r,a){H(0),this.W=t,this.H=i||{},r&&a!==void 0&&(this.H.OSID=r,this.H.OAID=a),this.F=this.X,this.J=Ei(this,null,this.W),ce(this)};function Ke(t){if(di(t),t.I==3){var i=t.V++,r=X(t.J);if(D(r,"SID",t.M),D(r,"RID",i),D(r,"TYPE","terminate"),zt(t,r),i=new ot(t,t.j,i),i.M=2,i.A=re(X(r)),r=!1,f.navigator&&f.navigator.sendBeacon)try{r=f.navigator.sendBeacon(i.A.toString(),"")}catch{}!r&&f.Image&&(new Image().src=i.A,r=!0),r||(i.g=Ti(i.j,null),i.g.ea(i.A)),i.F=Date.now(),ie(i)}Ii(t)}function ae(t){t.g&&(We(t),t.g.cancel(),t.g=null)}function di(t){ae(t),t.v&&(f.clearTimeout(t.v),t.v=null),he(t),t.h.cancel(),t.m&&(typeof t.m=="number"&&f.clearTimeout(t.m),t.m=null)}function ce(t){if(!Yn(t.h)&&!t.m){t.m=!0;var i=t.Ea;st||h(),G||(st(),G=!0),g.add(i,t),t.D=0}}function ys(t,i){return Jn(t.h)>=t.h.j-(t.m?1:0)?!1:t.m?(t.i=i.G.concat(t.i),!0):t.I==1||t.I==2||t.D>=(t.Sa?0:t.Ta)?!1:(t.m=Pt(v(t.Ea,t,i),vi(t,t.D)),t.D++,!0)}e.Ea=function(t){if(this.m)if(this.m=null,this.I==1){if(!t){this.V=Math.floor(Math.random()*1e5),t=this.V++;const y=new ot(this,this.j,t);let b=this.o;if(this.U&&(b?(b=Cn(b),Dn(b,this.U)):b=this.U),this.u!==null||this.R||(y.J=b,b=null),this.S)t:{for(var i=0,r=0;r<this.i.length;r++){e:{var a=this.i[r];if("__data__"in a.map&&(a=a.map.__data__,typeof a=="string")){a=a.length;break e}a=void 0}if(a===void 0)break;if(i+=a,i>4096){i=r;break t}if(i===4096||r===this.i.length-1){i=r+1;break t}}i=1e3}else i=1e3;i=mi(this,y,i),r=X(this.J),D(r,"RID",t),D(r,"CVER",22),this.G&&D(r,"X-HTTP-Session-Id",this.G),zt(this,r),b&&(this.R?i="headers="+xt(ci(b))+"&"+i:this.u&&Ve(r,this.u,b)),Fe(this.h,y),this.Ra&&D(r,"TYPE","init"),this.S?(D(r,"$req",i),D(r,"SID","null"),y.U=!0,Be(y,r,null)):Be(y,r,i),this.I=2}}else this.I==3&&(t?gi(this,t):this.i.length==0||Yn(this.h)||gi(this))};function gi(t,i){var r;i?r=i.l:r=t.V++;const a=X(t.J);D(a,"SID",t.M),D(a,"RID",r),D(a,"AID",t.K),zt(t,a),t.u&&t.o&&Ve(a,t.u,t.o),r=new ot(t,t.j,r,t.D+1),t.u===null&&(r.J=t.o),i&&(t.i=i.G.concat(t.i)),i=mi(t,r,1e3),r.H=Math.round(t.va*.5)+Math.round(t.va*.5*Math.random()),Fe(t.h,r),Be(r,a,i)}function zt(t,i){t.H&&Zt(t.H,function(r,a){D(i,a,r)}),t.l&&Zt({},function(r,a){D(i,a,r)})}function mi(t,i,r){r=Math.min(t.i.length,r);const a=t.l?v(t.l.Ka,t.l,t):null;t:{var y=t.i;let C=-1;for(;;){const N=["count="+r];C==-1?r>0?(C=y[0].g,N.push("ofs="+C)):C=0:N.push("ofs="+C);let _=!0;for(let B=0;B<r;B++){var b=y[B].g;const Y=y[B].map;if(b-=C,b<0)C=Math.max(0,y[B].g-100),_=!1;else try{b="req"+b+"_"||"";try{var E=Y instanceof Map?Y:Object.entries(Y);for(const[wt,lt]of E){let ut=lt;I(lt)&&(ut=Me(lt)),N.push(b+wt+"="+encodeURIComponent(ut))}}catch(wt){throw N.push(b+"type="+encodeURIComponent("_badmap")),wt}}catch{a&&a(Y)}}if(_){E=N.join("&");break t}}E=void 0}return t=t.i.splice(0,r),i.G=t,E}function yi(t){if(!t.g&&!t.v){t.Y=1;var i=t.Da;st||h(),G||(st(),G=!0),g.add(i,t),t.A=0}}function ze(t){return t.g||t.v||t.A>=3?!1:(t.Y++,t.v=Pt(v(t.Da,t),vi(t,t.A)),t.A++,!0)}e.Da=function(){if(this.v=null,wi(this),this.aa&&!(this.P||this.g==null||this.T<=0)){var t=4*this.T;this.j.info("BP detection timer enabled: "+t),this.B=Pt(v(this.Wa,this),t)}},e.Wa=function(){this.B&&(this.B=null,this.j.info("BP detection timeout reached."),this.j.info("Buffering proxy detected and switch to long-polling!"),this.F=!1,this.P=!0,H(10),ae(this),wi(this))};function We(t){t.B!=null&&(f.clearTimeout(t.B),t.B=null)}function wi(t){t.g=new ot(t,t.j,"rpc",t.Y),t.u===null&&(t.g.J=t.o),t.g.P=0;var i=X(t.na);D(i,"RID","rpc"),D(i,"SID",t.M),D(i,"AID",t.K),D(i,"CI",t.F?"0":"1"),!t.F&&t.ia&&D(i,"TO",t.ia),D(i,"TYPE","xmlhttp"),zt(t,i),t.u&&t.o&&Ve(i,t.u,t.o),t.O&&(t.g.H=t.O);var r=t.g;t=t.ba,r.M=1,r.A=re(X(i)),r.u=null,r.R=!0,Wn(r,t)}e.Va=function(){this.C!=null&&(this.C=null,ae(this),ze(this),H(19))};function he(t){t.C!=null&&(f.clearTimeout(t.C),t.C=null)}function bi(t,i){var r=null;if(t.g==i){he(t),We(t),t.g=null;var a=2}else if($e(t.h,i))r=i.G,Zn(t.h,i),a=1;else return;if(t.I!=0){if(i.o)if(a==1){r=i.u?i.u.length:0,i=Date.now()-i.F;var y=t.D;a=ee(),F(a,new Hn(a,r)),ce(t)}else yi(t);else if(y=i.m,y==3||y==0&&i.X>0||!(a==1&&ys(t,i)||a==2&&ze(t)))switch(r&&r.length>0&&(i=t.h,i.i=i.i.concat(r)),y){case 1:yt(t,5);break;case 4:yt(t,10);break;case 3:yt(t,6);break;default:yt(t,2)}}}function vi(t,i){let r=t.Qa+Math.floor(Math.random()*t.Za);return t.isActive()||(r*=2),r*i}function yt(t,i){if(t.j.info("Error code "+i),i==2){var r=v(t.bb,t),a=t.Ua;const y=!a;a=new at(a||"//www.google.com/images/cleardot.gif"),f.location&&f.location.protocol=="http"||jt(a,"https"),re(a),y?us(a.toString(),r):fs(a.toString(),r)}else H(2);t.I=0,t.l&&t.l.pa(i),Ii(t),di(t)}e.bb=function(t){t?(this.j.info("Successfully pinged google.com"),H(2)):(this.j.info("Failed to ping google.com"),H(1))};function Ii(t){if(t.I=0,t.ja=[],t.l){const i=Qn(t.h);(i.length!=0||t.i.length!=0)&&(P(t.ja,i),P(t.ja,t.i),t.h.i.length=0,x(t.i),t.i.length=0),t.l.oa()}}function Ei(t,i,r){var a=r instanceof at?X(r):new at(r);if(a.g!="")i&&(a.g=i+"."+a.g),Lt(a,a.u);else{var y=f.location;a=y.protocol,i=i?i+"."+y.hostname:y.hostname,y=+y.port;const b=new at(null);a&&jt(b,a),i&&(b.g=i),y&&Lt(b,y),r&&(b.h=r),a=b}return r=t.G,i=t.wa,r&&i&&D(a,r,i),D(a,"VER",t.ka),zt(t,a),a}function Ti(t,i,r){if(i&&!t.L)throw Error("Can't create secondary domain capable XhrIo object.");return i=t.Aa&&!t.ma?new R(new Ue({ab:r})):new R(t.ma),i.Fa(t.L),i}e.isActive=function(){return!!this.l&&this.l.isActive(this)};function Si(){}e=Si.prototype,e.ra=function(){},e.qa=function(){},e.pa=function(){},e.oa=function(){},e.isActive=function(){return!0},e.Ka=function(){};function le(){}le.prototype.g=function(t,i){return new K(t,i)};function K(t,i){$.call(this),this.g=new pi(i),this.l=t,this.h=i&&i.messageUrlParams||null,t=i&&i.messageHeaders||null,i&&i.clientProtocolHeaderRequired&&(t?t["X-Client-Protocol"]="webchannel":t={"X-Client-Protocol":"webchannel"}),this.g.o=t,t=i&&i.initMessageHeaders||null,i&&i.messageContentType&&(t?t["X-WebChannel-Content-Type"]=i.messageContentType:t={"X-WebChannel-Content-Type":i.messageContentType}),i&&i.sa&&(t?t["X-WebChannel-Client-Profile"]=i.sa:t={"X-WebChannel-Client-Profile":i.sa}),this.g.U=t,(t=i&&i.Qb)&&!l(t)&&(this.g.u=t),this.A=i&&i.supportsCrossDomainXhr||!1,this.v=i&&i.sendRawJson||!1,(i=i&&i.httpSessionIdParam)&&!l(i)&&(this.g.G=i,t=this.h,t!==null&&i in t&&(t=this.h,i in t&&delete t[i])),this.j=new Dt(this)}A(K,$),K.prototype.m=function(){this.g.l=this.j,this.A&&(this.g.L=!0),this.g.connect(this.l,this.h||void 0)},K.prototype.close=function(){Ke(this.g)},K.prototype.o=function(t){var i=this.g;if(typeof t=="string"){var r={};r.__data__=t,t=r}else this.v&&(r={},r.__data__=Me(t),t=r);i.i.push(new is(i.Ya++,t)),i.I==3&&ce(i)},K.prototype.N=function(){this.g.l=null,delete this.j,Ke(this.g),delete this.g,K.Z.N.call(this)};function Ai(t){Re.call(this),t.__headers__&&(this.headers=t.__headers__,this.statusCode=t.__status__,delete t.__headers__,delete t.__status__);var i=t.__sm__;if(i){t:{for(const r in i){t=r;break t}t=void 0}(this.i=t)&&(t=this.i,i=i!==null&&t in i?i[t]:void 0),this.data=i}else this.data=t}A(Ai,Re);function Ci(){Pe.call(this),this.status=1}A(Ci,Pe);function Dt(t){this.g=t}A(Dt,Si),Dt.prototype.ra=function(){F(this.g,"a")},Dt.prototype.qa=function(t){F(this.g,new Ai(t))},Dt.prototype.pa=function(t){F(this.g,new Ci)},Dt.prototype.oa=function(){F(this.g,"b")},le.prototype.createWebChannel=le.prototype.g,K.prototype.send=K.prototype.o,K.prototype.open=K.prototype.m,K.prototype.close=K.prototype.close,Dc=function(){return new le},_c=function(){return ee()},Cc=dt,Ac={jb:0,mb:1,nb:2,Hb:3,Mb:4,Jb:5,Kb:6,Ib:7,Gb:8,Lb:9,PROXY:10,NOPROXY:11,Eb:12,Ab:13,Bb:14,zb:15,Cb:16,Db:17,fb:18,eb:19,gb:20},ne.NO_ERROR=0,ne.TIMEOUT=8,ne.HTTP_ERROR=6,Sc=ne,Un.COMPLETE="complete",Tc=Un,jn.EventType=Mt,Mt.OPEN="a",Mt.CLOSE="b",Mt.ERROR="c",Mt.MESSAGE="d",$.prototype.listen=$.prototype.J,Ec=jn,R.prototype.listenOnce=R.prototype.K,R.prototype.getLastError=R.prototype.Ha,R.prototype.getLastErrorCode=R.prototype.ya,R.prototype.getStatus=R.prototype.ca,R.prototype.getResponseJson=R.prototype.La,R.prototype.getResponseText=R.prototype.la,R.prototype.send=R.prototype.ea,R.prototype.setWithCredentials=R.prototype.Fa,Ic=R}).apply(typeof fe<"u"?fe:typeof self<"u"?self:typeof window<"u"?window:{});/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const kc="/firebase-messaging-sw.js",Oc="/firebase-cloud-messaging-push-scope",Pr="BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4",Mc="https://fcmregistrations.googleapis.com/v1",Nr="google.c.a.c_id",Rc="google.c.a.c_l",Pc="google.c.a.ts",Nc="google.c.a.e",qi=1e4;var Xi;(function(e){e[e.DATA_MESSAGE=1]="DATA_MESSAGE",e[e.DISPLAY_NOTIFICATION=3]="DISPLAY_NOTIFICATION"})(Xi||(Xi={}));/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */var qt;(function(e){e.PUSH_RECEIVED="push-received",e.NOTIFICATION_CLICKED="notification-clicked"})(qt||(qt={}));/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function tt(e){const n=new Uint8Array(e);return btoa(String.fromCharCode(...n)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}function xc(e){const n="=".repeat((4-e.length%4)%4),s=(e+n).replace(/\-/g,"+").replace(/_/g,"/"),o=atob(s),c=new Uint8Array(o.length);for(let d=0;d<o.length;++d)c[d]=o.charCodeAt(d);return c}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const rn="fcm_token_details_db",Bc=5,Yi="fcm_token_object_Store";async function jc(e){if("databases"in indexedDB&&!(await indexedDB.databases()).map(d=>d.name).includes(rn))return null;let n=null;return(await Ie(rn,Bc,{upgrade:async(o,c,d,f)=>{if(c<2||!o.objectStoreNames.contains(Yi))return;const I=f.objectStore(Yi),T=await I.index("fcmSenderId").get(e);if(await I.clear(),!!T){if(c===2){const v=T;if(!v.auth||!v.p256dh||!v.endpoint)return;n={token:v.fcmToken,createTime:v.createTime??Date.now(),subscriptionOptions:{auth:v.auth,p256dh:v.p256dh,endpoint:v.endpoint,swScope:v.swScope,vapidKey:typeof v.vapidKey=="string"?v.vapidKey:tt(v.vapidKey)}}}else if(c===3){const v=T;n={token:v.fcmToken,createTime:v.createTime,subscriptionOptions:{auth:tt(v.auth),p256dh:tt(v.p256dh),endpoint:v.endpoint,swScope:v.swScope,vapidKey:tt(v.vapidKey)}}}else if(c===4){const v=T;n={token:v.fcmToken,createTime:v.createTime,subscriptionOptions:{auth:tt(v.auth),p256dh:tt(v.p256dh),endpoint:v.endpoint,swScope:v.swScope,vapidKey:tt(v.vapidKey)}}}}}})).close(),await Je(rn),await Je("fcm_vapid_details_db"),await Je("undefined"),Lc(n)?n:null}function Lc(e){if(!e||!e.subscriptionOptions)return!1;const{subscriptionOptions:n}=e;return typeof e.createTime=="number"&&e.createTime>0&&typeof e.token=="string"&&e.token.length>0&&typeof n.auth=="string"&&n.auth.length>0&&typeof n.p256dh=="string"&&n.p256dh.length>0&&typeof n.endpoint=="string"&&n.endpoint.length>0&&typeof n.swScope=="string"&&n.swScope.length>0&&typeof n.vapidKey=="string"&&n.vapidKey.length>0}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const $c="firebase-messaging-database",Fc=1,Tt="firebase-messaging-store";let sn=null;function In(){return sn||(sn=Ie($c,Fc,{upgrade:(e,n)=>{switch(n){case 0:e.createObjectStore(Tt)}}})),sn}async function xr(e){const n=Tn(e),o=await(await In()).transaction(Tt).objectStore(Tt).get(n);if(o)return o;{const c=await jc(e.appConfig.senderId);if(c)return await En(e,c),c}}async function En(e,n){const s=Tn(e),c=(await In()).transaction(Tt,"readwrite");return await c.objectStore(Tt).put(n,s),await c.done,n}async function Hc(e){const n=Tn(e),o=(await In()).transaction(Tt,"readwrite");await o.objectStore(Tt).delete(n),await o.done}function Tn({appConfig:e}){return e.appId}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Uc={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"only-available-in-window":"This method is available in a Window context.","only-available-in-sw":"This method is available in a service worker context.","permission-default":"The notification permission was not granted and dismissed instead.","permission-blocked":"The notification permission was not granted and blocked instead.","unsupported-browser":"This browser doesn't support the API's required to use the Firebase SDK.","indexed-db-unsupported":"This browser doesn't support indexedDb.open() (ex. Safari iFrame, Firefox Private Browsing, etc)","failed-service-worker-registration":"We are unable to register the default service worker. {$browserErrorMessage}","token-subscribe-failed":"A problem occurred while subscribing the user to FCM: {$errorInfo}","token-subscribe-no-token":"FCM returned no token when subscribing the user to push.","token-unsubscribe-failed":"A problem occurred while unsubscribing the user from FCM: {$errorInfo}","token-update-failed":"A problem occurred while updating the user from FCM: {$errorInfo}","token-update-no-token":"FCM returned no token when updating the user to push.","use-sw-after-get-token":"The useServiceWorker() method may only be called once and must be called before calling getToken() to ensure your service worker is used.","invalid-sw-registration":"The input to useServiceWorker() must be a ServiceWorkerRegistration.","invalid-bg-handler":"The input to setBackgroundMessageHandler() must be a function.","invalid-vapid-key":"The public VAPID key must be a string.","use-vapid-key-after-get-token":"The usePublicVapidKey() method may only be called once and must be called before calling getToken() to ensure your VAPID key is used."},L=new Xt("messaging","Messaging",Uc);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Vc(e,n){const s=await An(e),o=jr(n),c={method:"POST",headers:s,body:JSON.stringify(o)};let d;try{d=await(await fetch(Sn(e.appConfig),c)).json()}catch(f){throw L.create("token-subscribe-failed",{errorInfo:f==null?void 0:f.toString()})}if(d.error){const f=d.error.message;throw L.create("token-subscribe-failed",{errorInfo:f})}if(!d.token)throw L.create("token-subscribe-no-token");return d.token}async function Kc(e,n){const s=await An(e),o=jr(n.subscriptionOptions),c={method:"PATCH",headers:s,body:JSON.stringify(o)};let d;try{d=await(await fetch(`${Sn(e.appConfig)}/${n.token}`,c)).json()}catch(f){throw L.create("token-update-failed",{errorInfo:f==null?void 0:f.toString()})}if(d.error){const f=d.error.message;throw L.create("token-update-failed",{errorInfo:f})}if(!d.token)throw L.create("token-update-no-token");return d.token}async function Br(e,n){const o={method:"DELETE",headers:await An(e)};try{const d=await(await fetch(`${Sn(e.appConfig)}/${n}`,o)).json();if(d.error){const f=d.error.message;throw L.create("token-unsubscribe-failed",{errorInfo:f})}}catch(c){throw L.create("token-unsubscribe-failed",{errorInfo:c==null?void 0:c.toString()})}}function Sn({projectId:e}){return`${Mc}/projects/${e}/registrations`}async function An({appConfig:e,installations:n}){const s=await n.getToken();return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e.apiKey,"x-goog-firebase-installations-auth":`FIS ${s}`})}function jr({p256dh:e,auth:n,endpoint:s,vapidKey:o}){const c={web:{endpoint:s,auth:n,p256dh:e}};return o!==Pr&&(c.web.applicationPubKey=o),c}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const zc=10080*60*1e3;async function Wc(e){const n=await Xc(e.swRegistration,e.vapidKey),s={vapidKey:e.vapidKey,swScope:e.swRegistration.scope,endpoint:n.endpoint,auth:tt(n.getKey("auth")),p256dh:tt(n.getKey("p256dh"))},o=await xr(e.firebaseDependencies);if(o){if(Yc(o.subscriptionOptions,s))return Date.now()>=o.createTime+zc?qc(e,{token:o.token,createTime:Date.now(),subscriptionOptions:s}):o.token;try{await Br(e.firebaseDependencies,o.token)}catch(c){console.warn(c)}return Ji(e.firebaseDependencies,s)}else return Ji(e.firebaseDependencies,s)}async function Gc(e){const n=await xr(e.firebaseDependencies);n&&(await Br(e.firebaseDependencies,n.token),await Hc(e.firebaseDependencies));const s=await e.swRegistration.pushManager.getSubscription();return s?s.unsubscribe():!0}async function qc(e,n){try{const s=await Kc(e.firebaseDependencies,n),o={...n,token:s,createTime:Date.now()};return await En(e.firebaseDependencies,o),s}catch(s){throw s}}async function Ji(e,n){const o={token:await Vc(e,n),createTime:Date.now(),subscriptionOptions:n};return await En(e,o),o.token}async function Xc(e,n){const s=await e.pushManager.getSubscription();return s||e.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:xc(n)})}function Yc(e,n){const s=n.vapidKey===e.vapidKey,o=n.endpoint===e.endpoint,c=n.auth===e.auth,d=n.p256dh===e.p256dh;return s&&o&&c&&d}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Zi(e){const n={from:e.from,collapseKey:e.collapse_key,messageId:e.fcmMessageId};return Jc(n,e),Zc(n,e),Qc(n,e),n}function Jc(e,n){if(!n.notification)return;e.notification={};const s=n.notification.title;s&&(e.notification.title=s);const o=n.notification.body;o&&(e.notification.body=o);const c=n.notification.image;c&&(e.notification.image=c);const d=n.notification.icon;d&&(e.notification.icon=d)}function Zc(e,n){n.data&&(e.data=n.data)}function Qc(e,n){var c,d,f,I;if(!n.fcmOptions&&!((c=n.notification)!=null&&c.click_action))return;e.fcmOptions={};const s=((d=n.fcmOptions)==null?void 0:d.link)??((f=n.notification)==null?void 0:f.click_action);s&&(e.fcmOptions.link=s);const o=(I=n.fcmOptions)==null?void 0:I.analytics_label;o&&(e.fcmOptions.analyticsLabel=o)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function th(e){return typeof e=="object"&&!!e&&Nr in e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function eh(e){if(!e||!e.options)throw on("App Configuration Object");if(!e.name)throw on("App Name");const n=["projectId","apiKey","appId","messagingSenderId"],{options:s}=e;for(const o of n)if(!s[o])throw on(o);return{appName:e.name,projectId:s.projectId,apiKey:s.apiKey,appId:s.appId,senderId:s.messagingSenderId}}function on(e){return L.create("missing-app-config-values",{valueName:e})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class nh{constructor(n,s,o){this.deliveryMetricsExportedToBigQueryEnabled=!1,this.onBackgroundMessageHandler=null,this.onMessageHandler=null,this.logEvents=[],this.isLogServiceStarted=!1;const c=eh(n);this.firebaseDependencies={app:n,appConfig:c,installations:s,analyticsProvider:o}}_delete(){return Promise.resolve()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Lr(e){try{e.swRegistration=await navigator.serviceWorker.register(kc,{scope:Oc}),e.swRegistration.update().catch(()=>{}),await ih(e.swRegistration)}catch(n){throw L.create("failed-service-worker-registration",{browserErrorMessage:n==null?void 0:n.message})}}async function ih(e){return new Promise((n,s)=>{const o=setTimeout(()=>s(new Error(`Service worker not registered after ${qi} ms`)),qi),c=e.installing||e.waiting;e.active?(clearTimeout(o),n()):c?c.onstatechange=d=>{var f;((f=d.target)==null?void 0:f.state)==="activated"&&(c.onstatechange=null,clearTimeout(o),n())}:(clearTimeout(o),s(new Error("No incoming service worker found.")))})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function rh(e,n){if(!n&&!e.swRegistration&&await Lr(e),!(!n&&e.swRegistration)){if(!(n instanceof ServiceWorkerRegistration))throw L.create("invalid-sw-registration");e.swRegistration=n}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function sh(e,n){n?e.vapidKey=n:e.vapidKey||(e.vapidKey=Pr)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function $r(e,n){if(!navigator)throw L.create("only-available-in-window");if(Notification.permission==="default"&&await Notification.requestPermission(),Notification.permission!=="granted")throw L.create("permission-blocked");return await sh(e,n==null?void 0:n.vapidKey),await rh(e,n==null?void 0:n.serviceWorkerRegistration),Wc(e)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function oh(e,n,s){const o=ah(n);(await e.firebaseDependencies.analyticsProvider.get()).logEvent(o,{message_id:s[Nr],message_name:s[Rc],message_time:s[Pc],message_device_time:Math.floor(Date.now()/1e3)})}function ah(e){switch(e){case qt.NOTIFICATION_CLICKED:return"notification_open";case qt.PUSH_RECEIVED:return"notification_foreground";default:throw new Error}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function ch(e,n){const s=n.data;if(!s.isFirebaseMessaging)return;e.onMessageHandler&&s.messageType===qt.PUSH_RECEIVED&&(typeof e.onMessageHandler=="function"?e.onMessageHandler(Zi(s)):e.onMessageHandler.next(Zi(s)));const o=s.data;th(o)&&o[Nc]==="1"&&await oh(e,s.messageType,o)}const Qi="@firebase/messaging",tr="0.12.23";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const hh=e=>{const n=new nh(e.getProvider("app").getImmediate(),e.getProvider("installations-internal").getImmediate(),e.getProvider("analytics-internal"));return navigator.serviceWorker.addEventListener("message",s=>ch(n,s)),n},lh=e=>{const n=e.getProvider("messaging").getImmediate();return{getToken:o=>$r(n,o)}};function uh(){it(new Z("messaging",hh,"PUBLIC")),it(new Z("messaging-internal",lh,"PRIVATE")),J(Qi,tr),J(Qi,tr,"esm2020")}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function fh(){try{await ve()}catch{return!1}return typeof window<"u"&&be()&&pn()&&"serviceWorker"in navigator&&"PushManager"in window&&"Notification"in window&&"fetch"in window&&ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification")&&PushSubscription.prototype.hasOwnProperty("getKey")}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function ph(e){if(!navigator)throw L.create("only-available-in-window");return e.swRegistration||await Lr(e),Gc(e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function dh(e,n){if(!navigator)throw L.create("only-available-in-window");return e.onMessageHandler=n,()=>{e.onMessageHandler=null}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Rh(e=hr()){return fh().then(n=>{if(!n)throw L.create("unsupported-browser")},n=>{throw L.create("indexed-db-unsupported")}),Yt(At(e),"messaging").getImmediate()}async function Ph(e,n){return e=At(e),$r(e,n)}function Nh(e){return e=At(e),ph(e)}function xh(e,n){return e=At(e),dh(e,n)}uh();export{Ch as A,_s as B,Z as C,Th as D,Cc as E,St as F,Ah as G,Ih as H,bc as I,Fo as J,Mh as K,or as L,vc as M,Oh as N,fh as O,Rh as P,xh as Q,Ph as R,Ac as S,Nh as T,Ec as W,Ic as X,Dh as _,k as a,hr as b,Yt as c,gh as d,de as e,wh as f,At as g,Sh as h,ks as i,rr as j,_c as k,Tc as l,Sc as m,Dc as n,it as o,yh as p,kh as q,J as r,mh as s,vh as t,bh as u,Eh as v,sr as w,Xt as x,_h as y,Es as z};
