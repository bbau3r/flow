const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./pdf-BFWi2Cdl.js","./layout-WE_v_ZGa.js","./editor-cGdnKzNh.js"])))=>i.map(i=>d[i]);
import{c as e,i as t,l as n,n as r,r as i,t as a}from"./layout-WE_v_ZGa.js";(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var o=`modulepreload`,s=function(e,t){return new URL(e,t).href},c={},l=function(e){return e.pathname.endsWith(`.css`)},u=function(e,t,n){if(t in e)return e[t];let r=n();if(!r){e[t]=void 0;return}let i=r.then(()=>{e[t]=void 0},n=>{throw e[t]=void 0,n});return e[t]=i,i},d=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e,i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function d(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function f(e){return import.meta.resolve?new URL(import.meta.resolve(e)):new URL(e,import.meta.url)}r=d(t.map(t=>{t=s(t,n);let r=f(t),i=l(r);return u(c,r.href,()=>{if(e===void 0){e={all:new Set,styles:new Set};let t=document.getElementsByTagName(`link`);for(let n=t.length-1;n>=0;n--){let r=t[n];e.all.add(r.href),r.rel===`stylesheet`&&e.styles.add(r.href)}}if((i?e.styles:e.all).has(r.href))return;let t=document.createElement(`link`);if(t.rel=i?`stylesheet`:o,i||(t.as=`script`),t.crossOrigin=``,t.href=r.href,a&&t.setAttribute(`nonce`,a),document.head.appendChild(t),i)return new Promise((e,n)=>{t.addEventListener(`load`,e),t.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${r}`)))})})}).filter(e=>e!==void 0))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},f=`false`,p=`false`,m=f===`true`,h=p===`true`;function g(e={}){let{immediate:t=!1,onNeedReload:n,onNeedRefresh:r,onOfflineReady:i,onRegistered:a,onRegisteredSW:o,onRegisterError:s}=e,c,l,u,f=async(e=!0)=>{await l,m||u?.()};async function p(){if(`serviceWorker`in navigator){if(c=await d(async()=>{let{Workbox:e}=await import(`./workbox-window.prod.es5-Bd17z0YL.js`);return{Workbox:e}},[],import.meta.url).then(({Workbox:e})=>new e(`./sw.js`,{scope:`./`,type:`classic`})).catch(e=>{s?.(e)}),!c)return;if(u=()=>{c?.messageSkipWaiting()},!h){if(m)c.addEventListener(`activated`,e=>{(e.isUpdate||e.isExternal)&&(n?n():window.location.reload())}),c.addEventListener(`installed`,e=>{e.isUpdate||i?.()});else{let e=!1,t=()=>{e=!0,c?.addEventListener(`controlling`,e=>{e.isUpdate&&(n?n():window.location.reload())}),r?.()};c.addEventListener(`installed`,n=>{n.isUpdate===void 0?n.isExternal===void 0?!e&&i?.():n.isExternal?t():!e&&i?.():n.isUpdate||i?.()}),c.addEventListener(`waiting`,t)}}c.register({immediate:t}).then(e=>{o?o(`./sw.js`,e):a?.(e)}).catch(e=>{s?.(e)})}}return l=p(),f}function _(e=new Date){return[`Title: Untitled`,`Credit: Written by`,`Author: Your Name`,`Source: Based On Blank`,`Draft date: ${e.toLocaleDateString(`en-US`,{year:`numeric`,month:`long`,day:`numeric`})}`,`Contact:`,`    Your Name`,`    you@example.com`,`    555-555-5555`,`Copyright: (c) ${e.getFullYear()} Your Name`,`Notes: First draft`,``,``].join(`
`)}var v=e=>e===void 0||e.trim()===``,y=e=>e.contentEnd>e.contentStart?e.raw.slice(e.contentStart,e.contentEnd):``,b=t=>e(t.join(`
`)).lines,x=e=>e.comments.map(t=>e.raw.slice(t.start,t.end)).join(` `),S=(e,t)=>[`section`,`scene`,`transition`,`synopsis`].includes(e[t].type);function C(e,t){let{level:n}=e[t];for(let r=t+1;r<e.length;r++)if(e[r].type===`section`&&e[r].level<=n)return r;return e.length}function w(e,t){let{type:n}=e[t];if(n===`section`)return C(e,t);if(n===`synopsis`)return t+1;let r=!1;for(let i=t+1;i<e.length;i++){if(!S(e,i))continue;let t=e[i].type;if(t===`section`||t===`synopsis`||r||t===n)return i;r=!0}return e.length}function ee({lines:e}){let t={level:0,children:[]},n=[t];return e.forEach((t,r)=>{if(!S(e,r))return;let{children:i}=n[n.length-1];if(t.type===`synopsis`)i.push({kind:`synopsis`,line:r,end:r+1,text:y(t)});else if(t.type===`section`){for(;n[n.length-1].level>=t.level;)n.pop();let i={kind:`section`,line:r,end:w(e,r),level:t.level,text:y(t),children:[]};n[n.length-1].children.push(i),n.push(i)}else{let n=i[i.length-1];(n?.kind!==`block`||n.lines.length>1||n.lines[0].kind===t.type)&&(n={kind:`block`,line:r,end:w(e,r),scene:!1,text:t.text.trim(),lines:[]},i.push(n)),n.lines.push({kind:t.type,line:r,text:t.text.trim(),forced:!!t.forced,number:t.sceneNumber??``}),t.type===`scene`&&(n.scene=!0,n.text=t.text.trim())}}),t.children}function te(e,t,n){let r=e=>{for(let t of e){if(t.line===n)return t;let e=t.children&&r(t.children);if(e)return e}return null},i=typeof n==`number`,{kind:a,level:o}=i?r(e):n,s=a===`section`?o:1/0,c=[],l=(e,t,r,a)=>{let o=i?e.filter(e=>e.line!==n):e;if(r<s){let e=!1;for(let n of o)if(c.push({line:n.line,before:n.line,parent:t}),n.kind===`section`&&n.level<s){e=!0;break}e||c.push({line:a,before:null,parent:t})}for(let e of o)e.kind===`section`&&e.level<s&&l(e.children,e.line,e.level,e.end)};return l(e,null,0,t),c.sort((e,t)=>e.line-t.line)}var T=(e,t)=>e.some(e=>e.lineStart<t&&e.lineEnd>=t);function E(e,t,n,{start:r=!0,end:i=!0}={}){for(;r&&t<n&&v(e[t]);)t++;for(;i&&n>t&&v(e[n-1]);)n--;return[t,n]}var ne=(e,t,n)=>e[t].type===`synopsis`&&e[n]?.type!==`title`;function re(t,n,r){let{lines:i,comments:a}=e(t.join(`
`)),o=w(i,n),s=i[n].type===`synopsis`?D(i,r):r;if(s>=n&&s<=o||[n,o,s].some(e=>T(a,e)))return null;let c=E(t,n,o),l=s<n?[E(t,0,s,{start:!1}),c,E(t,s,n),E(t,o,t.length,{end:!1})]:[E(t,0,n,{start:!1}),E(t,o,s),c,E(t,s,t.length,{end:!1})],u=[],d=0,f=-1;for(let e of l){let[n,r]=e;n!==r&&(u.length&&!ne(i,n,f)&&u.push(``),e===c&&(d=u.length),u.push(...t.slice(n,r)),f=r-1)}return{lines:u,focus:d}}var ie=e=>e.replace(/[^\w.-]/g,``);function ae(e,t,n){let r=[...e],i=b(r)[t],a=ie(n),[o,s]=i.sceneNumberRange??[i.contentEnd,i.contentEnd];return r[t]=`${i.raw.slice(0,o).trimEnd()}${a?` #${a}#`:``}${i.raw.slice(s)}`,r}function D(e,t){let n=t;for(;n>0&&e[n-1].type===`blank`;)n--;return n}var O=e=>e.length===1&&e[0]===``?[]:[...e];function oe(e,t=1,n=e.length){let r=O(e),i=b(r),a=D(i,Math.min(n,r.length)),o=a>0?[``,`#`.repeat(t)]:[`#`.repeat(t)];return a<r.length&&!v(r[a])&&i[a].type!==`synopsis`&&o.push(``),r.splice(a,0,...o),{lines:r,focus:a+o.indexOf(`#`.repeat(t))}}function se(e,t=e.length){let n=O(e),r=b(n),i=D(r,Math.min(t,n.length)),a=i>0&&r[i-1].type===`title`?[``,`=`]:[`=`];return i<n.length&&!v(n[i])&&r[i].type!==`synopsis`&&a.push(``),n.splice(i,0,...a),{lines:n,focus:i+a.indexOf(`=`)}}function ce(e,t,n){let r=[...e],i=b(r)[t],a=i.type===`section`?i.level:1,o=i.raw.slice(0,i.prefix[0][0]+a),s=i.raw.slice(Math.max(i.contentStart,i.contentEnd)).trim();return r[t]=[o,n.replace(/\s*\n\s*/g,` `),s].filter(Boolean).join(` `),r}function k(e,t){let n=t.index;t.comments.length?e[n]=x(t):n>0&&!v(e[n-1])?e[n]=``:e.splice(n,n+1<e.length&&v(e[n+1])?2:1)}function le(e,t){let n=[...e],r=b(n);for(let e=C(r,t)-1;e>=t;e--)r[e].type===`section`&&k(n,r[e]);return n.length?n:[``]}function ue(e,t){let n=[...e],r=b(n);return r[t].comments.length?n[t]=x(r[t]):!v(n[t+1])&&r[t+1].type!==`synopsis`?n[t]=``:n.splice(t,1),n.length?n:[``]}var de={stack:`<path d="M14 6V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1"/><path d="M18 10V9a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1"/><rect x="11" y="11" width="10" height="10" rx="2"/>`,save:`<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8V3"/><path d="M7 21v-7h10v7"/>`,"save-as":`<path d="M11 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v2"/><path d="M7 3v5h8V3"/><path d="M7 21v-6h5"/><path d="M20.5 13.5a1.5 1.5 0 0 1 2 2L17 21l-3 1 1-3z"/>`,pdf:`<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>`,comment:`<path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M8 11h.01"/><path d="M12 11h.01"/><path d="M16 11h.01"/>`,undo:`<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>`,redo:`<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>`,seamless:`<path d="M4 3h16"/><path d="M4 21h16"/><path d="M7 8h10"/><path d="M7 12h10"/><path d="M7 16h6"/>`,paged:`<path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/>`,write:`<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>`,outline:`<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/>`,read:`<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>`,source:`<path d="m8 7-5 5 5 5"/><path d="m16 7 5 5-5 5"/>`,palette:`<path d="M12 22a10 10 0 1 1 10-10c0 2.5-2 4-4.5 4H15a2 2 0 0 0-1.5 3.3c.6.8 0 2.7-1.5 2.7z"/><circle cx="7.5" cy="10.5" r=".5"/><circle cx="12" cy="7.5" r=".5"/><circle cx="16.5" cy="10.5" r=".5"/>`,plus:`<path d="M12 5v14"/><path d="M5 12h14"/>`,minus:`<path d="M5 12h14"/>`,close:`<path d="M6 6l12 12"/><path d="M18 6 6 18"/>`,grip:`<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>`,act:`<path d="M6 3h12v18l-6-4-6 4z"/>`,sequence:`<path d="M5 4v7a4 4 0 0 0 4 4h11"/><path d="m15 10 5 5-5 5"/>`,synopsis:`<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/>`,scene:`<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>`,chevron:`<path d="m6 9 6 6 6-6"/>`,"chevron-left":`<path d="m15 6-6 6 6 6"/>`,check:`<path d="M20 6 9 17l-5-5"/>`,more:`<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>`,"page-break":`<path d="M6 8V4a1 1 0 0 1 1-1h7l4 4v1"/><path d="M6 16v4a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-4"/><path d="M3 12h2"/><path d="M8 12h2"/><path d="M14 12h2"/><path d="M19 12h2"/>`},fe=`"Courier Prime", "Courier New", Courier, monospace`,A=8;function j(e,t={}){for(let[n,r]of Object.entries(t))e.setAttribute(n,r)}function M(e,...t){let n=document.createElement(`div`);return n.className=e,n.append(...t),n}function N(e){let t=document.createElementNS(`http://www.w3.org/2000/svg`,`svg`);return t.classList.add(`fl-svg`),j(t,{viewBox:`0 0 24 24`,"aria-hidden":`true`}),t.innerHTML=de[e],t}var P=null;function F(e){P??=document.createElement(`canvas`).getContext(`2d`);let t=P;t.font=`700 100px ${fe}`;let n=t.measureText(e.textContent),r=n.width/2-(n.actualBoundingBoxRight-n.actualBoundingBoxLeft)/2,i=(n.fontBoundingBoxDescent-n.fontBoundingBoxAscent)/2-(n.actualBoundingBoxDescent-n.actualBoundingBoxAscent)/2;e.style.transform=`translate(${(r/100).toFixed(3)}em, ${(i/100).toFixed(3)}em)`}var I=e=>e.querySelectorAll(`.fl-icon-glyph`).forEach(F);function pe(e){let t=document.createElement(`span`);t.className=`fl-icon-glyph`,t.style.fontFamily=fe,t.textContent=e,F(t);let n=document.createElement(`span`);return n.className=`fl-icon`,n.setAttribute(`aria-hidden`,`true`),n.append(t),n}function me(e){let t=e;for(;t;){if(t.classList?.contains(`fl-scroll`))return t;t=t.assignedSlot??t.parentNode??t.host}return null}var he=({icon:e,glyph:t})=>e?N(e):t?pe(t):null;function L({label:e,title:t=e,icon:n,glyph:r,text:i,iconOnly:a,collapse:o,toggle:s,href:c,cls:l,attrs:u,onClick:d}){let f=document.createElement(c?`a`:`button`);c?f.href=c:f.type=`button`,f.className=`fl-btn${l?` ${l}`:``}`,f.title=t,f.setAttribute(`aria-label`,e),s&&f.setAttribute(`aria-pressed`,`false`),j(f,u);let p=he({icon:n,glyph:r});if(p&&f.append(p),i)f.append(i);else if(!a){let t=document.createElement(`span`);t.className=o?`fl-label fl-collapse`:`fl-label`,t.textContent=e,f.append(t)}return f.addEventListener(`mousedown`,e=>e.preventDefault()),d&&f.addEventListener(`click`,d),f}function R({cls:e,label:t,attrs:n}={},...r){let i=M(`fl-pill${e?` ${e}`:``}`,...r);return i.setAttribute(`role`,`group`),t&&i.setAttribute(`aria-label`,t),j(i,n),i}function z(){let e=M(`fl-pill-sep`);return e.setAttribute(`aria-hidden`,`true`),e}function ge(e,t,n){let r=M(`fl-responsive`,M(`fl-wide-only`,t),M(`fl-compact-only`,n));return j(r,e),r}function _e({label:e,attrs:t,onSelect:n},r){let i=r.find(e=>e.selected),a=null,o=e=>{if(e!==i){i=e;for(let[t,n]of s)n.setAttribute(`aria-selected`,String(t===e));a.refresh(),n?.(e.label)}},s=new Map(r.map(e=>{let t=document.createElement(`button`);return t.type=`button`,t.className=`fl-tab`,e.icon&&t.append(N(e.icon)),t.append(e.label),t.disabled=!!e.disabled,e.title&&(t.title=e.title),j(t,{role:`tab`,"aria-selected":String(!!e.selected)}),t.addEventListener(`mousedown`,e=>e.preventDefault()),t.addEventListener(`click`,()=>o(e)),[e,t]})),c=R({cls:`fl-tabs`,label:e},...s.values());return c.setAttribute(`role`,`tablist`),a=new B({sections:[{items:r.map(e=>({...e,value:e.label}))}],isChecked:e=>e===i.label,trigger:()=>{let t=document.createElement(`span`);return t.textContent=i.label,{label:`${e}: ${i.label}`,content:[...i.icon?[N(i.icon)]:[],t]}},onSelect:e=>o(r.find(t=>t.label===e))}),ge(t,c,R({cls:`fl-tabs`,label:e},a.root))}function ve({label:e,cls:t,attrs:n},r){let i=R({cls:t,label:e},...r.flatMap((e,t)=>[...t?[z()]:[],...e.map(e=>L({...e,iconOnly:!0}))])),a=new Map(r.flat().map(e=>[e.label,e])),o=new B({caret:!1,sections:r.map(e=>({plain:!0,items:e.map(({label:e,title:t,icon:n})=>({value:e,label:e,title:t,icon:n}))})),trigger:()=>({label:e,content:[N(`more`)]}),onSelect:e=>a.get(e).onClick()});return ge(n,i,R({label:e},o.root))}var B=class{#e;#t;#n;#r;#i=[];#a=e=>this.#c(e);#o=()=>this.#l();constructor({sections:e,trigger:t,isChecked:n=()=>!1,onSelect:r,up:i=!1,caret:a=!0,cls:o,triggerCls:s,attrs:c}){this.#e=t,this.#t=n,this.#n=i,this.#r=a,this.button=document.createElement(`button`),this.button.type=`button`,this.button.className=`fl-btn fl-menu-trigger${s?` ${s}`:``}`,j(this.button,{"aria-haspopup":`menu`,"aria-expanded":`false`}),this.button.addEventListener(`mousedown`,e=>e.preventDefault()),this.button.addEventListener(`click`,e=>this.toggle(e.detail===0)),this.button.addEventListener(`keydown`,e=>{e.key===`ArrowDown`&&!this.isOpen&&(e.preventDefault(),this.open(!0))}),this.popup=M(`fl-menu-popup${i?` fl-menu-up`:``}`),this.popup.setAttribute(`role`,`menu`),this.popup.hidden=!0;for(let t of e){if(t.label){let e=M(`fl-menu-heading`);e.textContent=t.label,this.popup.append(e)}else this.popup.childElementCount&&this.popup.append(M(`fl-menu-rule`));for(let e of t.items)this.popup.append(this.#s(e,t,r))}this.root=M(`fl-menu${o?` ${o}`:``}`,this.button,this.popup),j(this.root,c),this.refresh()}get isOpen(){return!this.popup.hidden}refresh(){let{label:e,content:t}=this.#e();this.button.setAttribute(`aria-label`,e),this.button.title=e,this.button.replaceChildren(...t,...this.#r?[N(`chevron`)]:[]);for(let{node:e,item:t,section:n}of this.#i)n.plain||e.setAttribute(`aria-checked`,String(this.#t(t.value)))}toggle(e){this.isOpen?this.close():this.open(e)}open(e){this.popup.hidden=!1,this.button.setAttribute(`aria-expanded`,`true`),this.#l(),document.addEventListener(`pointerdown`,this.#a,!0),document.addEventListener(`keydown`,this.#a,!0),window.addEventListener(`resize`,this.#o),e&&(this.#i.find(({node:e})=>e.getAttribute(`aria-checked`)===`true`)??this.#i.find(({node:e})=>!e.disabled)).node.focus()}close(){this.isOpen&&(this.popup.hidden=!0,this.button.setAttribute(`aria-expanded`,`false`),document.removeEventListener(`pointerdown`,this.#a,!0),document.removeEventListener(`keydown`,this.#a,!0),window.removeEventListener(`resize`,this.#o))}#s(e,t,n){let r=document.createElement(`button`);r.type=`button`,r.className=`fl-menu-item`,r.title=e.title??e.label,r.disabled=!!e.disabled,j(r,{role:t.plain?`menuitem`:`menuitemradio`,"aria-label":e.label,tabindex:`-1`});let i=he(e),a=document.createElement(`span`);return a.textContent=e.label,r.append(...i?[i]:[],a),t.plain||r.append(N(`check`)),r.addEventListener(`mousedown`,e=>e.preventDefault()),r.addEventListener(`click`,t=>{this.close(),t.detail===0&&this.button.focus(),n?.(e.value)}),this.#i.push({node:r,item:e,section:t}),r}#c(e){if(e.type===`pointerdown`){e.composedPath().includes(this.root)||this.close();return}let t=this.#i.map(({node:e})=>e).filter(e=>!e.disabled),n=t.indexOf(this.root.getRootNode().activeElement);e.key===`Escape`?(this.close(),n>=0&&this.button.focus()):e.key===`Tab`?this.close():n>=0&&[`ArrowDown`,`ArrowUp`,`Home`,`End`].includes(e.key)&&(e.preventDefault(),t[({ArrowDown:n+1,ArrowUp:n-1,Home:0,End:t.length-1}[e.key]+t.length)%t.length].focus())}#l(){let{popup:e}=this;e.style.left=``,e.style.top=``,e.style.maxHeight=``;let t=0;if(getComputedStyle(this.root).position===`static`){let n=e.offsetParent.getBoundingClientRect(),r=this.button.getBoundingClientRect();t=r.left-n.left,e.style.left=`${t}px`,e.style.top=`${r.bottom-n.top+6}px`}let n=e.getBoundingClientRect(),r=me(e),i=r?.getBoundingClientRect()??{left:0,top:0},a=i.left+A,o=i.left+(r??document.documentElement).clientWidth-A,s=r?i.top+r.clientHeight-A:window.innerHeight-A,c=0;n.right>o&&(c=o-n.right),n.left+c<a&&(c=a-n.left),c&&(e.style.left=`${t+c}px`);let l=this.#n?n.bottom-i.top-A:s-n.top;n.height>l&&(e.style.maxHeight=`${Math.max(l,120)}px`)}};function V(e,{title:t,body:n,actions:r,onClose:i}){let a=document.createElement(`dialog`);a.className=`fl-dialog`,a.setAttribute(`aria-labelledby`,`fl-dialog-title`);let o=document.createElement(`h2`);return o.id=`fl-dialog-title`,o.textContent=t,a.append(o,M(`fl-dialog-body`,...n),M(`fl-dialog-actions`,...r)),a.addEventListener(`close`,()=>{a.remove(),i?.()}),e.append(a),a.showModal(),{dialog:a,close:()=>a.close()}}var H={"pill-bg":`var(--flow-ribbon-bg)`,"pill-ink":`var(--flow-ribbon-ink)`,"pill-border":`var(--flow-rule)`,"pill-radius":`999px`,"pill-shadow":`0 2px 6px var(--flow-shadow)`,"float-shadow":`0 1px 2px var(--flow-shadow), 0 2px 4px var(--flow-shadow), 0 3px 7px var(--flow-shadow)`,"pill-tint-bg":`color-mix(in srgb, var(--flow-accent) 18%, var(--flow-ribbon-bg))`,"pill-tint-border":`color-mix(in srgb, var(--flow-accent) 35%, var(--flow-rule))`,"button-radius":`999px`,"button-hover-bg":`color-mix(in srgb, var(--flow-accent) 15%, transparent)`,"button-active-bg":`var(--flow-accent)`,"button-active-ink":`var(--flow-accent-ink)`,"tabs-bg":`var(--flow-pill-tint-bg, color-mix(in srgb, var(--flow-accent) 18%, var(--flow-ribbon-bg)))`,"tabs-border":`var(--flow-pill-tint-border, color-mix(in srgb, var(--flow-accent) 35%, var(--flow-rule)))`,"tabs-ink":`var(--flow-ribbon-ink)`,"tab-selected-bg":`var(--flow-accent)`,"tab-selected-ink":`var(--flow-accent-ink)`,"menu-bg":`var(--flow-ribbon-bg)`,"menu-ink":`var(--flow-ribbon-ink)`,"menu-border":`var(--flow-rule)`,"menu-radius":`10px`,"menu-heading-bg":`var(--flow-accent)`,"menu-heading-ink":`var(--flow-accent-ink)`,"dialog-bg":`var(--flow-desk)`,"dialog-ink":`var(--flow-ink)`,"dialog-radius":`12px`,focus:`var(--flow-accent)`,scrollbar:`var(--flow-accent)`,check:`var(--flow-accent)`,"field-bg":`var(--flow-paper)`,"field-ink":`var(--flow-ink)`,"field-border":`var(--flow-rule)`,"selection-bg":`color-mix(in srgb, var(--flow-accent) 30%, transparent)`,"drop-line":`var(--flow-accent)`,"preview-line":`var(--flow-secondary)`,"danger-hover":`var(--flow-danger)`},U=e=>`var(--flow-${e}, ${H[e]})`,ye=`
.fl-svg {
  flex: none; width: 1.25em; height: 1.25em;
  fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}
.fl-icon {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  min-width: 1.5em; height: 1.5em; padding: 0 0.2em;
  border: 1px solid var(--flow-accent); border-radius: 3px;
  background: color-mix(in srgb, var(--flow-accent) 12%, transparent);
  color: var(--flow-accent);
  font-size: 0.95em; font-weight: 700; line-height: 1;
}
.fl-icon-glyph { display: block; white-space: pre; }

.fl-pill {
  display: inline-flex; align-items: center; gap: 2px; min-width: 0; padding: var(--fl-pill-pad, 3px);
  background: ${U(`pill-bg`)}; color: ${U(`pill-ink`)};
  border: 1px solid ${U(`pill-border`)}; border-radius: ${U(`pill-radius`)};
  box-shadow: ${U(`pill-shadow`)};
  font-size: var(--fl-pill-font, 13px); line-height: 1.25;
}
.fl-pill[hidden] { display: none; }
/* Pills take clicks even where the bar around them lets clicks through. */
.fl-pill { pointer-events: auto; }
/* Lighter than the primary color, for information rather than actions. */
.fl-pill-tinted { background: ${U(`pill-tint-bg`)}; border-color: ${U(`pill-tint-border`)}; }
.fl-pill-sep { flex: none; width: 1px; height: 1.4em; margin: 0 2px; background: currentColor; opacity: 0.25; }
.fl-pill-sep[hidden] { display: none; }

.fl-btn {
  appearance: none; display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex: none;
  min-width: var(--fl-control-size, 30px); min-height: var(--fl-control-size, 30px); padding: 3px var(--fl-control-pad, 8px);
  background: transparent; color: inherit;
  border: 0; border-radius: ${U(`button-radius`)};
  font: inherit; text-decoration: none; white-space: nowrap; cursor: pointer;
}
.fl-btn[hidden] { display: none; }
.fl-btn:hover:not(:disabled) { background: ${U(`button-hover-bg`)}; }
.fl-btn:focus-visible, .fl-tab:focus-visible, .fl-menu-item:focus-visible { outline: 2px solid ${U(`focus`)}; outline-offset: 1px; }
input[type="checkbox"], input[type="radio"], input[type="range"], progress { accent-color: ${U(`check`)}; }
input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid ${U(`focus`)}; outline-offset: 1px; }
.fl-btn[aria-pressed="true"], .fl-btn[aria-pressed="true"]:hover:not(:disabled), .fl-btn-primary, .fl-btn-primary:hover:not(:disabled) {
  background: ${U(`button-active-bg`)}; color: ${U(`button-active-ink`)};
}
.fl-btn[aria-pressed="true"] .fl-icon { color: inherit; border-color: currentColor; background: transparent; }
/* A quieter pressed look: the secondary color behind, with only the icon in primary. */
.fl-btn-soft[aria-pressed="true"], .fl-btn-soft[aria-pressed="true"]:hover:not(:disabled) { background: ${U(`pill-tint-bg`)}; color: inherit; }
.fl-btn-soft[aria-pressed="true"] .fl-icon { background: ${U(`button-active-bg`)}; border-color: ${U(`button-active-bg`)}; color: ${U(`button-active-ink`)}; }
.fl-btn:disabled { opacity: 0.4; cursor: default; }
.fl-btn-outline { border: 1px solid ${U(`pill-border`)}; }

.fl-tabs { align-items: stretch; background: ${U(`tabs-bg`)}; border-color: ${U(`tabs-border`)}; color: ${U(`tabs-ink`)}; }
.fl-tab {
  appearance: none; display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 3px 16px 3px 12px;
  background: transparent; color: inherit;
  border: 0; border-radius: ${U(`button-radius`)};
  font: inherit; font-weight: 600; white-space: nowrap; cursor: pointer;
}
.fl-tab:focus-visible { outline-color: ${U(`tabs-ink`)}; }
.fl-tab[aria-selected="true"] { background: ${U(`tab-selected-bg`)}; color: ${U(`tab-selected-ink`)}; }
.fl-tab:disabled { opacity: 0.8; cursor: default; }
.fl-tab .fl-svg { width: 1.1em; height: 1.1em; }
/* On small screens a dropdown names the current tab, in the same type as the tabs. */
.fl-tabs .fl-menu-trigger { font-weight: 600; }

.fl-menu { position: relative; display: inline-flex; }
.fl-menu-trigger > .fl-svg:not(:only-child):last-child { width: 1em; height: 1em; }
.fl-menu-popup {
  position: absolute; left: 0; top: calc(100% + 6px); z-index: 30;
  display: flex; flex-direction: column; gap: 1px;
  min-width: 11rem; max-width: calc(100vw - 16px); padding: 6px; overflow-y: auto;
  background: ${U(`menu-bg`)}; color: ${U(`menu-ink`)};
  border: 1px solid ${U(`menu-border`)}; border-radius: ${U(`menu-radius`)};
  box-shadow: 0 6px 20px var(--flow-shadow);
  font-size: 13px; line-height: 1.25;
}
.fl-menu-popup[hidden] { display: none; }
.fl-menu-up { top: auto; bottom: calc(100% + 6px); }
.fl-menu-heading {
  flex: none; padding: 3px 8px; border-radius: 6px;
  background: ${U(`menu-heading-bg`)}; color: ${U(`menu-heading-ink`)};
  font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
}
.fl-menu-item + .fl-menu-heading { margin-top: 5px; }
.fl-menu-rule { flex: none; height: 1px; margin: 4px 2px; background: ${U(`menu-border`)}; }
.fl-menu-item {
  appearance: none; display: flex; align-items: center; gap: 8px; flex: none; width: 100%; min-height: 30px; padding: 3px 8px;
  background: transparent; color: inherit;
  border: 0; border-radius: 6px;
  font: inherit; text-align: left; white-space: nowrap; cursor: pointer;
}
.fl-menu-item > span:not(.fl-icon) { flex: 1; }
.fl-menu-item:hover:not(:disabled) { background: ${U(`button-hover-bg`)}; }
.fl-menu-item > .fl-svg:last-child { visibility: hidden; width: 1em; height: 1em; color: var(--flow-accent); }
.fl-menu-item:disabled { opacity: 0.5; cursor: default; }
.fl-menu-item[aria-checked="true"] { font-weight: 600; }
.fl-menu-item[aria-checked="true"] > .fl-svg:last-child { visibility: visible; }

/* Space runs short in stages, measured from the bar the control sits in. */
.fl-responsive, .fl-wide-only { display: contents; }
.fl-compact-only { display: none; }
@container (max-width: 760px) {
  .fl-collapse { display: none; }
}
@container (max-width: 600px) {
  .fl-wide-only, .fl-compact-hide { display: none; }
  .fl-compact-only { display: contents; }
}

.fl-dialog {
  width: min(460px, calc(100vw - 32px)); padding: 20px;
  background: ${U(`dialog-bg`)}; color: ${U(`dialog-ink`)};
  border: 1px solid var(--flow-rule); border-radius: ${U(`dialog-radius`)};
  box-shadow: 0 10px 40px var(--flow-shadow);
  font-size: 14px;
}
.fl-dialog::backdrop { background: rgb(0 0 0 / 0.4); }
.fl-dialog h2 {
  margin: 0 0 14px; color: var(--flow-muted);
  font-size: 13px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
}
.fl-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.fl-dialog-actions .fl-btn { padding-inline: 14px; }
`,W={sage:{label:`Sage`,light:{desk:`#dfe4db`,paper:`#f6f8f4`,ink:`#2f3e46`,muted:`#4c6662`,accent:`#52796f`,"accent-ink":`#f6f8f4`,secondary:`#b0645a`,"secondary-ink":`#f6f8f4`,success:`#3d7d3a`,warning:`#a3670a`,danger:`#b3302d`,rule:`#cad2c5`,"ribbon-bg":`#eef1ea`,"ribbon-ink":`#2f3e46`,"bubble-bg":`#d5e3d5`,"bubble-ink":`#354f52`,shadow:`rgb(47 62 70 / 0.22)`,scheme:`light`},dark:{desk:`#1c1e1d`,paper:`#262928`,ink:`#e3e8e0`,muted:`#a9bcb0`,accent:`#84a98c`,"accent-ink":`#262928`,secondary:`#e0a395`,"secondary-ink":`#262928`,success:`#8fcf7e`,warning:`#e8b04a`,danger:`#f07a72`,rule:`#3d4644`,"ribbon-bg":`#212423`,"ribbon-ink":`#e3e8e0`,"bubble-bg":`#354f52`,"bubble-ink":`#e3e8e0`,shadow:`rgb(0 0 0 / 0.6)`,scheme:`dark`}},sand:{label:`Sand`,light:{desk:`#e9dcca`,paper:`#fcf6ee`,ink:`#32271c`,muted:`#6e5737`,accent:`#97592c`,"accent-ink":`#fcf6ee`,secondary:`#3f6c8f`,"secondary-ink":`#fcf6ee`,success:`#2f7d4a`,warning:`#b07d00`,danger:`#b3302d`,rule:`#dac5a9`,"ribbon-bg":`#f5f0e2`,"ribbon-ink":`#3c2e1d`,"bubble-bg":`#e9dabb`,"bubble-ink":`#423119`,shadow:`rgb(85 60 28 / 0.24)`,scheme:`light`},dark:{desk:`#1e1c1a`,paper:`#2a2724`,ink:`#f6dcb2`,muted:`#c2a67a`,accent:`#eab658`,"accent-ink":`#2a2724`,secondary:`#8fb6d6`,"secondary-ink":`#2a2724`,success:`#6cc58a`,warning:`#f0c24a`,danger:`#f07a72`,rule:`#4a453e`,"ribbon-bg":`#24221f`,"ribbon-ink":`#f6dcb2`,"bubble-bg":`#463e34`,"bubble-ink":`#fae3bf`,shadow:`rgb(0 0 0 / 0.6)`,scheme:`dark`}},sea:{label:`Sea`,light:{desk:`#e1e5f2`,paper:`#ffffff`,ink:`#022b3a`,muted:`#1f5a6b`,accent:`#1f7a8c`,"accent-ink":`#ffffff`,secondary:`#c4553a`,"secondary-ink":`#ffffff`,success:`#2f7d4a`,warning:`#a3670a`,danger:`#b3302d`,rule:`#bfdbf7`,"ribbon-bg":`#f3f5fa`,"ribbon-ink":`#022b3a`,"bubble-bg":`#bfdbf7`,"bubble-ink":`#022b3a`,shadow:`rgb(2 43 58 / 0.2)`,scheme:`light`},dark:{desk:`#181c1e`,paper:`#22282b`,ink:`#e1e5f2`,muted:`#9fbcd6`,accent:`#5fb8c9`,"accent-ink":`#22282b`,secondary:`#f08a6c`,"secondary-ink":`#22282b`,success:`#6cc58a`,warning:`#e8b04a`,danger:`#f07a72`,rule:`#36444a`,"ribbon-bg":`#1c2124`,"ribbon-ink":`#e1e5f2`,"bubble-bg":`#245a66`,"bubble-ink":`#ffffff`,shadow:`rgb(0 0 0 / 0.6)`,scheme:`dark`}},romance:{label:`Romance`,light:{desk:`#cebebe`,paper:`#faf6ef`,ink:`#3a1826`,muted:`#844b58`,accent:`#6d2e46`,"accent-ink":`#faf6ef`,secondary:`#4f7a5c`,"secondary-ink":`#faf6ef`,success:`#2f7d4a`,warning:`#a3670a`,danger:`#c0392b`,rule:`#d5b9b2`,"ribbon-bg":`#ece2d0`,"ribbon-ink":`#3a1826`,"bubble-bg":`#ead2cf`,"bubble-ink":`#6d2e46`,shadow:`rgb(109 46 70 / 0.22)`,scheme:`light`},dark:{desk:`#1f1a1c`,paper:`#2b2226`,ink:`#f3e3ec`,muted:`#c3a0b3`,accent:`#d48aa8`,"accent-ink":`#2b2226`,secondary:`#9cc7a8`,"secondary-ink":`#2b2226`,success:`#6cc58a`,warning:`#e8b04a`,danger:`#ff7b6e`,rule:`#4a3a42`,"ribbon-bg":`#251e21`,"ribbon-ink":`#f3e3ec`,"bubble-bg":`#5a2a40`,"bubble-ink":`#f8e5ee`,shadow:`rgb(0 0 0 / 0.6)`,scheme:`dark`}},forest:{label:`Forest`,light:{desk:`#e4dac3`,paper:`#fbf8ef`,ink:`#23291a`,muted:`#6b5433`,accent:`#3f6b2f`,"accent-ink":`#fbf8ef`,secondary:`#8a3f72`,"secondary-ink":`#fbf8ef`,success:`#2a7a62`,warning:`#a3670a`,danger:`#b3302d`,rule:`#d2c5a4`,"ribbon-bg":`#f3eddc`,"ribbon-ink":`#2f3522`,"bubble-bg":`#dfe6c4`,"bubble-ink":`#34401f`,shadow:`rgb(60 50 20 / 0.25)`,scheme:`light`},dark:{desk:`#1e1e1a`,paper:`#292824`,ink:`#e2dcbe`,muted:`#b8a27c`,accent:`#8fc05c`,"accent-ink":`#292824`,secondary:`#d38fc0`,"secondary-ink":`#292824`,success:`#6cc9a8`,warning:`#e8b04a`,danger:`#f07a72`,rule:`#4a493f`,"ribbon-bg":`#23231f`,"ribbon-ink":`#e2dcbe`,"bubble-bg":`#474533`,"bubble-ink":`#e6e3c2`,shadow:`rgb(0 0 0 / 0.6)`,scheme:`dark`}},lavender:{label:`Lavender`,light:{desk:`#e5d7d2`,paper:`#f8f3f0`,ink:`#22223b`,muted:`#5e5568`,accent:`#4a4e69`,"accent-ink":`#f8f3f0`,secondary:`#9a6b1f`,"secondary-ink":`#f8f3f0`,success:`#2f7d4a`,warning:`#a3670a`,danger:`#b3302d`,rule:`#c9ada7`,"ribbon-bg":`#f2e9e4`,"ribbon-ink":`#22223b`,"bubble-bg":`#e3d9e1`,"bubble-ink":`#3a3550`,shadow:`rgb(34 34 59 / 0.25)`,scheme:`light`},dark:{desk:`#1c1b20`,paper:`#26252c`,ink:`#f2e9e4`,muted:`#b3a5b0`,accent:`#c9ada7`,"accent-ink":`#26252c`,secondary:`#e0b45c`,"secondary-ink":`#26252c`,success:`#6cc58a`,warning:`#e8b04a`,danger:`#f07a72`,rule:`#45434f`,"ribbon-bg":`#211f26`,"ribbon-ink":`#f2e9e4`,"bubble-bg":`#3a3a4d`,"bubble-ink":`#f2e9e4`,shadow:`rgb(0 0 0 / 0.6)`,scheme:`dark`}},graphite:{label:`Graphite`,light:{desk:`#e2e3e6`,paper:`#f7f7f8`,ink:`#1d1e22`,muted:`#55575e`,accent:`#33353b`,"accent-ink":`#f7f7f8`,secondary:`#a63d40`,"secondary-ink":`#f7f7f8`,success:`#2f7d4a`,warning:`#a3670a`,danger:`#c0262d`,rule:`#cfd1d6`,"ribbon-bg":`#efeff1`,"ribbon-ink":`#1d1e22`,"bubble-bg":`#ece2e2`,"bubble-ink":`#5a2e30`,shadow:`rgb(20 22 28 / 0.22)`,scheme:`light`},dark:{desk:`#18191b`,paper:`#222326`,ink:`#e6e7ea`,muted:`#a4a6ad`,accent:`#c9cbd1`,"accent-ink":`#222326`,secondary:`#e07a7c`,"secondary-ink":`#222326`,success:`#6cc58a`,warning:`#e8b04a`,danger:`#ff6b6b`,rule:`#3a3c41`,"ribbon-bg":`#1d1e21`,"ribbon-ink":`#e6e7ea`,"bubble-bg":`#3d2c2e`,"bubble-ink":`#f0dcdc`,shadow:`rgb(0 0 0 / 0.6)`,scheme:`dark`}}},be=e=>Object.entries(e).map(([e,t])=>e===`scheme`?`color-scheme:${t};`:`--flow-${e}:${t};`).join(``);function G(e,t){let n=(e,n)=>`${t(e)} { ${be(n)} }`,r=(e,{light:t,dark:r})=>[n(e,t),`@media (prefers-color-scheme: dark) { ${n(e,r)} }`];return[`${e} { ${be(W.sage.light)} }`,...Object.entries(W).flatMap(([e,t])=>[n(`${e}-light`,t.light),n(`${e}-dark`,t.dark),...r(`${e}-auto`,t)]),...r(`auto`,W.sage)].join(`
`)}var xe=G(`:host`,e=>`:host([theme="${e}"])`),Se=G(`:root`,e=>`:root[data-theme="${e}"]`),Ce=new Map,we=e=>Ce.get(e),Te=`
${xe}
${ye}
:host {
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
  background: var(--flow-desk);
  color: var(--flow-ink);
  font-family: var(--flow-ui-font, Roboto, system-ui, sans-serif);
  --fl-script-font: var(--flow-font, "Courier Prime", "Courier New", Courier, monospace);
  --fl-page-w: 51em;
  --fl-page-h: 66em;
  --fl-action-w: 36.6em;
}
:host([hidden]) { display: none; }
* { box-sizing: border-box; }

.fl-scroll { flex: 1; min-height: 0; overflow: auto; container-type: inline-size; scroll-padding-top: var(--fl-inset-top, 0px); scroll-padding-bottom: var(--fl-inset-bottom, 0px); }
/* geometricPrecision keeps character widths fractional. Without it, Linux browsers at
   standard density round 9.6px up to 10px, which breaks every column on the page. */
.fl-script { font-family: var(--fl-script-font); font-variant-ligatures: none; line-height: 1; text-rendering: geometricPrecision; }
:host([view="page"]) .fl-script, .fl-read { font-size: calc(min(16px, var(--fl-area-w, 100cqw) / 52.5) * var(--fl-scale, 1)); }

/* With the bars, the script fills the room between them when short, so they rest at the top
   and bottom, and grows past them when long. A grid would confine each to its own row. */
.fl-has-bars { display: flex; flex-direction: column; }
.fl-has-bars > * { flex: 1 0 auto; }
.fl-has-bars > .fl-chrome, .fl-has-bars > .fl-footer { flex: none; }
.fl-has-bars > .fl-flow, .fl-has-bars > .fl-source { min-height: 0; }
/* The bars float over the script: only the pills take clicks, and the script passes beneath
   them. Being query containers lets labels collapse by width. */
.fl-chrome, .fl-footer {
  position: sticky; left: 0; z-index: 20;
  container-type: inline-size;
  pointer-events: none;
  --flow-pill-shadow: ${U(`float-shadow`)};
}
.fl-chrome { top: 0; }
.fl-footer { bottom: 0; --fl-control-size: 22px; --fl-control-pad: 6px; --fl-pill-font: 11.5px; --fl-pill-pad: 2px; }
/* A bar with an open menu comes forward, so the menu can reach over the other bar. */
.fl-chrome:has(.fl-menu-popup:not([hidden])), .fl-footer:has(.fl-menu-popup:not([hidden])) { z-index: 40; }
::slotted(*) { pointer-events: auto; }
/* Two rows by default, with the formatting controls leaning left on the second. */
.fl-topbar {
  position: relative;
  display: grid; align-items: center; gap: 6px 8px; padding: 8px 12px;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: "start end" "format format";
}
.fl-topbar:has(> .fl-ribbon[hidden]) { row-gap: 0; }
/* Folded away on its own row, the action center is only its toggle, which stays where the row
   was but floats over the page, so the page moves up by the whole row. */
@container (max-width: 999.98px) {
  .fl-topbar:has(> .fl-ribbon > .fl-action-pills[hidden]) { row-gap: 0; }
  .fl-topbar:has(> .fl-ribbon > .fl-action-pills[hidden]) > .fl-ribbon {
    /* Out of the grid, or its own area would be what it's placed against. */
    grid-area: auto; position: absolute; top: calc(100% - 2px); left: 12px;
    margin: 0; padding: 0; overflow: visible;
  }
}
/* Stretched, so that the document and tabs pills always match in height. */
.fl-topbar-start { grid-area: start; display: flex; align-items: stretch; gap: 8px; min-width: 0; }
.fl-topbar-tabs { flex: none; display: flex; }
.fl-topbar-tabs[hidden], .fl-ribbon[hidden] { display: none; }
.fl-topbar-end { grid-area: end; display: flex; justify-content: flex-end; }
.fl-ribbon { grid-area: format; display: flex; align-items: center; gap: 8px; }
.fl-action-pills { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; min-width: 0; }
.fl-action-pills[hidden] { display: none; }
.fl-action-animating { flex-wrap: nowrap; }
.fl-action-animating > * { flex: none; }
/* A bare icon over the page, unlike the pills around it, until the pointer finds it. */
.fl-action-toggle { pointer-events: auto; color: var(--flow-ink); }
.fl-action-toggle .fl-svg { transition: transform 220ms ease; }
.fl-action-toggle[aria-expanded="false"] .fl-svg { transform: rotate(180deg); }
@media (prefers-reduced-motion: reduce) { .fl-action-toggle .fl-svg { transition: none; } }
/* With room for everything, one row. The title gives way first if it's long. */
@container (min-width: 1000px) {
  .fl-topbar {
    grid-template-columns: minmax(0, max-content) auto minmax(max-content, 1fr);
    grid-template-areas: "start format end";
  }
}
.fl-ribbon .fl-b { font-weight: 700; }
.fl-ribbon .fl-i { font-style: italic; }
.fl-ribbon .fl-u { text-decoration: underline; }
.fl-ribbon .fl-strike { text-decoration: line-through; }
.fl-topics .fl-menu-trigger { justify-content: flex-start; min-width: 10.5em; }
.fl-topic-name { flex: 1; text-align: left; }
/* Once the tabs are a dropdown, the document gets all the room that's left. */
@container (max-width: 600px) {
  .fl-topics .fl-menu-trigger { min-width: 8em; }
  /* One row that scrolls sideways. The padding keeps pill shadows from being cut off, and
     the margins let pills run to the screen's edge. */
  .fl-ribbon {
    flex-wrap: nowrap; column-gap: 6px;
    margin: -6px -12px -12px; padding: 6px 12px 12px;
    overflow-x: auto; overflow-y: hidden;
    scrollbar-width: thin; scrollbar-color: ${U(`scrollbar`)} transparent;
    pointer-events: auto;
  }
  .fl-ribbon > *, .fl-action-pills > * { flex: none; }
  .fl-action-pills { flex-wrap: nowrap; column-gap: 6px; }
  /* The row would clip a menu anchored inside it, so it anchors to the whole bar instead. */
  .fl-ribbon .fl-menu { position: static; }
}
.fl-statusbar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; padding: 6px 12px; }
.fl-scale { min-width: 3.5em; font-variant-numeric: tabular-nums; }
.fl-status { padding: 0 8px; color: var(--flow-muted); }
.fl-spacer { flex: 1; }
.fl-field { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.fl-field select { margin-left: auto; font: inherit; color: ${U(`field-ink`)}; background: ${U(`field-bg`)}; border: 1px solid ${U(`field-border`)}; border-radius: 4px; padding: 2px 4px; }

/* Read-only pages */
.fl-pages { display: flex; flex-direction: column; align-items: safe center; gap: 1.5em; padding: 1.5em 0; }
.fl-page, .fl-sheet {
  position: relative;
  width: var(--fl-page-w);
  background: var(--flow-paper);
  color: var(--flow-ink);
  box-shadow: 0 1px 6px var(--flow-shadow);
}
.fl-page { position: relative; height: var(--fl-page-h); flex: none; overflow: hidden; }
.fl-row { position: absolute; left: 0; right: 0; height: 1em; }
.fl-cell { position: absolute; top: 0; white-space: pre; }
.fl-page-number { position: absolute; top: 3em; white-space: pre; }
.fl-bold { font-weight: 700; }
.fl-italic { font-style: italic; }
.fl-underline { text-decoration: underline; }

/* Comment bubbles. The summary keeps its place and size whether open or closed, and
   the note opens as an overlay behind it, so together they read as one pill and
   nothing around them moves. */
.fl-bubble { position: relative; isolation: isolate; font-family: var(--flow-ui-font, Roboto, system-ui, sans-serif); font-size: 0.8em; line-height: 1.3; }
.fl-bubble[open] { z-index: 6; }
.fl-bubble summary {
  position: relative; z-index: 1;
  display: flex; align-items: center; gap: 0.35em; height: 1.7em; padding: 0 0.6em;
  border-radius: 0.85em;
  background: var(--flow-bubble-bg); color: var(--flow-bubble-ink);
  cursor: pointer; list-style: none; user-select: none; white-space: nowrap;
}
.fl-bubble summary::-webkit-details-marker { display: none; }
.fl-bubble[open] summary { background: transparent; }
.fl-bubble-icon, .fl-bubble-close { display: inline-flex; justify-content: center; flex: none; width: 1em; }
.fl-bubble-close { display: none; width: 0.8em; font-size: 1.25em; font-weight: 700; line-height: 1; } /* same box as the icon */
.fl-bubble[open] .fl-bubble-icon { display: none; }
.fl-bubble[open] .fl-bubble-close { display: inline-flex; }
.fl-bubble-chip {
  display: inline-flex; align-items: center; gap: 0.35em; max-width: 16em;
  padding: 0.1em 0.6em; border-radius: 1em;
  background: var(--flow-bubble-bg); color: var(--flow-bubble-ink);
  cursor: pointer; user-select: none; white-space: nowrap;
}
.fl-bubble-preview { overflow: hidden; text-overflow: ellipsis; }
.fl-bubble[open] .fl-bubble-preview { visibility: hidden; }
.fl-bubble-body {
  position: absolute; z-index: 0; top: 0;
  border-radius: 0.85em;
  background: var(--flow-bubble-bg); color: var(--flow-bubble-ink);
  white-space: pre-wrap; overflow-wrap: anywhere;
  box-shadow: 0 3px 10px var(--flow-shadow);
}
.fl-page .fl-bubbles { position: absolute; top: -0.1em; right: 0.5em; display: flex; flex-direction: column; align-items: flex-end; z-index: 5; }
.fl-page .fl-bubble summary { justify-content: center; width: 2.2em; padding: 0; }
.fl-page .fl-bubble-preview { display: none; }
.fl-page .fl-bubble-body { right: 0; width: 20em; min-height: 1.7em; padding: 0.2em 2.4em 0.55em 0.85em; }
.fl-page:has(.fl-bubble[open]) { overflow: visible; z-index: 1; }

/* Script lines, shared by the editor and the read-only flow view */
.fl-line { white-space: pre-wrap; overflow-wrap: break-word; min-height: 1em; }
.fl-line.fl-scene:not(.fl-forced) { text-transform: uppercase; }
.fl-line.fl-transition { text-align: right; text-transform: uppercase; }
.fl-line.fl-centered { text-align: center; }
.fl-line.fl-lyrics { font-style: italic; }
.fl-line .fl-b { font-weight: 700; }
.fl-line .fl-i { font-style: italic; }
.fl-line .fl-u { text-decoration: underline; }
.fl-scene-number { color: var(--flow-muted); }
.fl-line.fl-section, .fl-line.fl-synopsis {
  font-family: var(--flow-ui-font, Roboto, system-ui, sans-serif); color: var(--flow-muted); text-transform: none;
}
.fl-line.fl-section { font-weight: 600; }
.fl-line.fl-section-1 { font-size: 1.15em; }
.fl-line.fl-section-3 { font-weight: 400; }
.fl-line.fl-synopsis { font-style: italic; }
.fl-line.fl-page-break:not(.fl-active) { position: relative; color: transparent; }
.fl-line.fl-page-break:not(.fl-active)::after {
  content: ""; position: absolute; left: 0; right: 0; top: 50%;
  border-top: 2px dashed var(--flow-rule);
}
.fl-line.fl-title-title { text-align: center; font-size: 1em; }
.fl-line.fl-title-credit, .fl-line.fl-title-author, .fl-line.fl-title-authors, .fl-line.fl-title-source { text-align: center; }

/* Page view indents, measured from the page edge like the printed page */
.fl-sheet .fl-line.fl-character { margin-left: 12em; max-width: 19.8em; }
.fl-sheet .fl-line.fl-parenthetical { margin-left: 9em; max-width: 15.6em; }
.fl-sheet .fl-line.fl-dialogue, .fl-sheet .fl-line.fl-in-dialogue { margin-left: 6em; max-width: 21.6em; }
.fl-sheet .fl-line { max-width: var(--fl-action-w); }

/* The cover page in page view: placed by row, as in print, and always a full page */
.fl-sheet .fl-line.fl-title-placed {
  position: absolute; top: calc((6 + var(--fl-title-y)) * 1em);
  left: 0; right: 0; max-width: none; text-align: center;
}
.fl-sheet .fl-line.fl-title-placed.fl-title-notes, .fl-sheet .fl-line.fl-title-placed.fl-title-copyright {
  left: 9em; right: auto; width: 18em; text-align: left;
}
.fl-sheet .fl-line.fl-title-placed.fl-title-draft-date, .fl-sheet .fl-line.fl-title-placed.fl-title-date, .fl-sheet .fl-line.fl-title-placed.fl-title-contact {
  left: calc(9em + var(--fl-action-w) - 18em); right: auto; width: 18em; text-align: left;
}
.fl-sheet .fl-title-separator:not(.fl-active) { height: 0; min-height: 0; overflow: hidden; }
.fl-sheet .fl-page-gap.fl-title-gap { margin-top: calc(var(--fl-page-h) - 6em); }

/* Flow view: same relationships, proportional to whatever width is available */
.fl-flow { max-width: 44em; margin: 0 auto; padding: 1.5em; background: var(--flow-paper); color: var(--flow-ink); min-height: 100%; width: 100%; line-height: 1.35; font-size: calc(16px * var(--fl-scale, 1)); }
/* The Fountain text itself: an ordinary column, with nothing placed or hidden */
.fl-source { max-width: 52em; margin: 0 auto; padding: 1.5em; background: var(--flow-paper); color: var(--flow-ink); min-height: 100%; width: 100%; line-height: 1.35; font-size: calc(16px * var(--fl-scale, 1)); white-space: pre-wrap; overflow-wrap: break-word; }
.fl-flow .fl-line.fl-character { margin-left: 32%; }
.fl-flow .fl-line.fl-parenthetical { margin-left: 24%; margin-right: 20%; }
.fl-flow .fl-line.fl-dialogue, .fl-flow .fl-line.fl-in-dialogue { margin-left: 15%; margin-right: 15%; }
.fl-dual { display: grid; grid-template-columns: 1fr 1fr; gap: 1em; }
.fl-dual .fl-line { margin-right: 0 !important; }
.fl-dual .fl-line.fl-character { margin-left: 25% !important; }
.fl-dual .fl-line.fl-parenthetical { margin-left: 10% !important; }
.fl-dual .fl-line.fl-dialogue, .fl-dual .fl-line.fl-in-dialogue { margin-left: 0 !important; }
.fl-flow .fl-bubble { display: inline-flex; vertical-align: top; max-width: 16em; margin: 0 0.25em; }
.fl-flow .fl-bubble summary { min-width: 0; }
.fl-flow .fl-bubble-body { left: 0; width: min(24em, 80cqw); padding: 1.9em 0.85em 0.55em; }

/* Editor */
.fl-sheet {
  position: relative;
  --fl-pad-right: calc(var(--fl-page-w) - 9em - var(--fl-action-w));
  margin: 1.5em auto; padding: 6em var(--fl-pad-right) 6em 9em; min-height: var(--fl-page-h);
}
.fl-editor-host .ProseMirror { outline: none; white-space: pre-wrap; word-wrap: break-word; caret-color: var(--flow-accent); }
.fl-editor-host .ProseMirror ::selection { background: ${U(`selection-bg`)}; }
/* A title page value's indent takes up no room. It stays as text with a font size, unlike a
   display: none marker, because on a value still empty it's all the cursor has to sit in. */
.fl-line .fl-indent { letter-spacing: -0.6em; word-spacing: 0; tab-size: 0; opacity: 0; }
.fl-marker { color: var(--flow-accent); opacity: 0.75; font-weight: 400; font-style: normal; text-decoration: none; }
.fl-line:not(.fl-active) .fl-marker { display: none; }
.fl-comment-src { display: none; }
.fl-active .fl-comment-src { display: inline; color: var(--flow-bubble-ink); background: var(--flow-bubble-bg); font-style: normal; font-weight: 400; }
.fl-active .fl-bubble-chip { display: none; }
.fl-comment-hidden:not(.fl-active) { display: none; }
.fl-editor-host .fl-bubble-chip { margin: 0 0.25em; font-family: var(--flow-ui-font, Roboto, system-ui, sans-serif); font-size: 0.8em; line-height: 1.3; vertical-align: baseline; }
.fl-boneyard { color: var(--flow-muted); opacity: 0.75; text-decoration: line-through; }
.fl-page-gap {
  display: flex; align-items: center; justify-content: flex-end;
  height: 3em; margin: 2em calc(-1 * var(--fl-pad-right, 0em)) 2em -9em; padding: 0 1em;
  background: var(--flow-desk); color: var(--flow-muted);
  font-family: var(--flow-ui-font, Roboto, system-ui, sans-serif);
  box-shadow: inset 0 3px 4px -3px var(--flow-shadow), inset 0 -3px 4px -3px var(--flow-shadow);
  user-select: none;
}
.fl-flow .fl-page-gap, .fl-flow .fl-page-one { display: none; }
.fl-flow .fl-title-gap span { display: none; }
.fl-page-one {
  position: absolute; top: 1em; right: 1em;
  color: var(--flow-muted);
  font-family: var(--flow-ui-font, Roboto, system-ui, sans-serif);
  user-select: none;
}
/* Without pages to separate them, breaks in flow view are drawn as a dashed line. */
.fl-break-rule, .fl-flow .fl-page-gap.fl-title-gap {
  display: block; height: 0; margin: 1em 0; padding: 0;
  background: none; box-shadow: none;
  border-top: 2px dashed var(--flow-rule);
}

/* The Outline tab: a single column of cards, sized by the page scale like the script. */
.fl-outline {
  position: relative; width: 100%; max-width: 44em; margin: 0 auto; padding: 1em 1em 2em;
  font-size: calc(16px * var(--fl-scale, 1)); line-height: 1.35;
}
.fl-outline[hidden] { display: none; }
.fl-outline-list, .fl-outline-children { display: flex; flex-direction: column; min-width: 0; }
.fl-outline-list { gap: 1.25em; }
.fl-outline-list:empty { display: none; }
.fl-outline-children { gap: 0.5em; }
.fl-outline-children:not(:empty) { margin-top: 0.35em; }
.fl-outline-card {
  display: flex; flex-direction: column; gap: 0.35em; min-width: 0; padding: 0.75em 0.75em 0.5em 0.5em;
  background: var(--flow-paper); color: var(--flow-ink);
  border: 1px solid var(--flow-rule); border-radius: 12px;
  box-shadow: 0 1px 6px var(--flow-shadow);
}
.fl-outline-card .fl-outline-card {
  padding: 0.5em 0.5em 0.35em 0.35em;
  background: var(--flow-desk); box-shadow: none;
}
/* A connector through the gap between acts. */
.fl-outline-list > .fl-outline-card { position: relative; }
.fl-outline-list > .fl-outline-card + .fl-outline-card::before {
  content: ""; position: absolute; left: 50%; bottom: 100%; width: 1px; height: calc(1.25em + 1px);
  background: var(--flow-rule); pointer-events: none;
}
.fl-outline-row { display: flex; align-items: flex-start; gap: 0.5em; min-width: 0; }
.fl-outline-kind { flex: none; display: inline-flex; height: 1.35em; align-items: center; color: var(--flow-accent); }
.fl-outline-kind .fl-svg { width: 1em; height: 1em; }
.fl-outline-field {
  appearance: none; flex: 1; display: block; min-width: 0; padding: 0; overflow: hidden; resize: none;
  background: transparent; color: inherit; border: 0; border-radius: 3px; outline: none;
  font: inherit;
}
.fl-outline-field:focus-visible, .fl-outline-number:focus-visible { outline: 2px solid ${U(`focus`)}; outline-offset: 2px; }
.fl-outline-field::placeholder { color: var(--flow-muted); opacity: 1; font-weight: 400; }
.fl-outline-heading { font-size: 1.25em; font-weight: 600; }
.fl-outline-card .fl-outline-card .fl-outline-heading { font-size: 1.05em; }
.fl-outline-synopsis { color: var(--flow-muted); font-style: italic; }
.fl-outline-grip {
  --fl-control-size: 1.5em; --fl-control-pad: 0;
  flex: none; height: 1.35em; min-height: 0; padding: 0; color: var(--flow-muted); font-size: 1em; cursor: grab; touch-action: none;
}
.fl-outline-grip .fl-svg { width: 1em; height: 1em; }
/* The remove button stays out of the way until its card is pointed at or being edited. A
   pointer over a card inside this one counts for that card alone. */
.fl-outline-remove {
  --fl-control-size: 1.6em; --fl-control-pad: 0;
  flex: none; color: var(--flow-muted); font-size: 13px; font-style: normal;
  opacity: 0; pointer-events: none;
}
.fl-outline-card:hover:not(:has(.fl-outline-card:hover)) > .fl-outline-row > .fl-outline-remove,
.fl-outline-card:hover:not(:has(.fl-outline-card:hover)) > .fl-outline-children > .fl-outline-row > .fl-outline-remove,
.fl-outline-card:has(> .fl-outline-row :focus, > .fl-outline-children > .fl-outline-row :focus) > .fl-outline-row > .fl-outline-remove,
.fl-outline-card:has(> .fl-outline-row :focus, > .fl-outline-children > .fl-outline-row :focus) > .fl-outline-children > .fl-outline-row > .fl-outline-remove,
.fl-outline-remove:focus-visible { opacity: 1; pointer-events: auto; }
.fl-outline-remove:hover:not(:disabled) { color: ${U(`danger-hover`)}; }
/* Scenes and transitions can be moved here but only changed in the script. */
.fl-outline-block {
  display: flex; align-items: flex-start; gap: 0.5em; min-width: 0; padding: 0.35em 0.75em 0.35em 0.35em;
  background: var(--flow-paper); color: var(--flow-ink);
  border: 1px solid var(--flow-rule); border-radius: 8px;
  font-family: var(--fl-script-font); font-size: 0.9em;
}
.fl-outline-lines { flex: 1; display: flex; flex-direction: column; gap: 0.3em; min-width: 0; }
.fl-outline-line { display: flex; align-items: flex-start; gap: 0.5em; min-width: 0; }
.fl-outline-block-text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.fl-outline-block-text:not(.fl-outline-forced) { text-transform: uppercase; }
.fl-outline-transition .fl-outline-block-text { text-transform: uppercase; color: var(--flow-muted); }
/* The one thing on a scene card that can be changed, so it's outlined like a field. */
.fl-outline-number {
  appearance: none; flex: none; display: block; width: calc(5ch + 0.8em + 2px); padding: 0 0.4em; overflow: hidden; resize: none;
  background: transparent; color: var(--flow-ink);
  border: 1px solid var(--flow-rule); border-radius: 4px; outline: none;
  font: inherit; text-align: right;
}
.fl-outline-number:hover { border-color: var(--flow-accent); }
.fl-outline-number::placeholder { color: var(--flow-muted); opacity: 0.75; }
.fl-outline-dragging { opacity: 0.45; }
.fl-outline-drop, .fl-outline-preview { position: absolute; z-index: 5; height: 3px; margin-top: -1.5px; border-radius: 3px; background: ${U(`drop-line`)}; pointer-events: none; }
/* Where a tool in the action center would add its card, while the pointer rests on it. */
.fl-outline-preview { background: ${U(`preview-line`)}; }
.fl-outline-drop[hidden], .fl-outline-preview[hidden] { display: none; }
.fl-outline-ghost {
  position: absolute; z-index: 6; left: 1em; right: 1em; display: flex; align-items: center; gap: 0.5em; padding: 0.4em 0.75em; overflow: hidden;
  background: var(--flow-paper); color: var(--flow-ink);
  border: 1px solid var(--flow-accent); border-radius: 8px;
  box-shadow: 0 6px 20px var(--flow-shadow);
  white-space: nowrap; pointer-events: none;
}
.fl-outline-ghost[hidden] { display: none; }
.fl-outline-ghost .fl-svg { width: 1em; height: 1em; color: var(--flow-accent); }
.fl-outline-hint { max-width: 26em; margin: 3em auto 1em; color: var(--flow-muted); text-align: center; }
.fl-outline-hint[hidden] { display: none; }
.fl-outline-hint p { margin: 0.5em 0 0; }
.fl-outline-hint .fl-outline-hint-title { margin: 0; color: var(--flow-ink); font-size: 1.15em; font-weight: 600; }
.fl-outline:focus { outline: none; }
/* The card that new ones from the action center go below. */
.fl-outline-selected { border-color: var(--flow-accent); box-shadow: 0 0 0 1px var(--flow-accent); }
.fl-outline-card .fl-outline-card.fl-outline-selected { box-shadow: 0 0 0 1px var(--flow-accent); }
.fl-outline-row.fl-outline-selected { border-radius: 6px; box-shadow: 0 0 0 1px var(--flow-accent); }
/* Dragged from the action center, they can be placed or clicked. */
.fl-outline-tool { touch-action: none; }
.fl-outline-tool .fl-svg { color: var(--flow-accent); }

@media print {
  :host { background: none; }
  .fl-chrome, .fl-footer, .fl-outline { display: none; }
  .fl-scroll { display: block; overflow: visible; container-type: normal; }
  .fl-script { font-size: 12pt !important; }
  .fl-pages { display: block; padding: 0; }
  .fl-page { box-shadow: none; break-after: page; background: #fff; color: #000; }
  .fl-bubbles { display: none; }
}
`,Ee=`💬︎`;function K(e,t,n){let r=document.createElement(e);return t&&(r.className=t),n!==void 0&&(r.textContent=n),r}function De(e,t){for(let n of t){let t=[n.bold&&`fl-bold`,n.italic&&`fl-italic`,n.underline&&`fl-underline`].filter(Boolean).join(` `);t?e.append(K(`span`,t,n.text)):e.append(n.text)}}var Oe=`×`;function ke(e,t){t.style.left=``;let n=e.closest(`.fl-flow`);if(!e.open||!n)return;let r=t.getBoundingClientRect().right-n.getBoundingClientRect().right;r>0&&(t.style.left=`${-r}px`)}function q(e){let t=K(`details`,`fl-bubble`),n=K(`summary`),r=`Note: ${e.text}`;n.setAttribute(`aria-label`,r),n.append(K(`span`,`fl-bubble-icon`,Ee),K(`span`,`fl-bubble-close`,Oe),K(`span`,`fl-bubble-preview`,e.text.split(`
`)[0]));let i=K(`div`,`fl-bubble-body`,e.text);return t.append(n,i),t.addEventListener(`toggle`,()=>{n.setAttribute(`aria-label`,t.open?`Close note`:r),ke(t,i)}),t}function Ae(e,n){let r=t(e,n),i=K(`div`,`fl-script fl-pages`);for(let e of r.pages){let t=K(`section`,`fl-page`);if(t.dataset.page=e.number??`title`,t.setAttribute(`aria-label`,e.number?`Page ${e.number}`:`Title page`),e.showNumber){let n=`${e.number}.`,i=K(`div`,`fl-page-number`,n);i.style.left=`${(a.action+r.profile.actionWidth-n.length)*.6}em`,t.append(i)}for(let n of e.rows){if(!n.cells.length&&!n.notes.length)continue;let e=K(`div`,`fl-row`);e.style.top=`${6+n.y}em`,e.dataset.line=n.line;for(let t of n.cells){let n=K(`div`,`fl-cell`);n.style.left=`${t.x*.6}em`,De(n,t.runs),e.append(n)}if(n.notes.length){let t=K(`div`,`fl-bubbles`);t.append(...n.notes.map(q)),e.append(t)}t.append(e)}i.append(t)}return i}var je=new Set([`section`,`synopsis`,`comment`]);function J(e){let t=K(`div`,`fl-line fl-${e.type}`);t.dataset.line=e.index,e.forced&&t.classList.add(`fl-forced`),e.inDialogue&&t.classList.add(`fl-in-dialogue`);let n=[...e.runs.map(e=>({at:e.start,run:e}))];for(let t of e.comments)t.comment.type===`note`&&t.comment.lineStart===e.index&&n.push({at:t.start,note:t.comment});n.sort((e,t)=>e.at-t.at);for(let e of n)e.note?t.append(q(e.note)):De(t,[e.run]);return t}function Me(e){let t=K(`div`,`fl-script fl-flow`),{lines:n}=e;if(e.titlePage.length){for(let r of e.titlePage)for(let e of r.lines){let i=J(n[e]);i.className=`fl-line fl-title fl-title-${r.key.replace(/\s+/g,`-`)}`,t.append(i)}t.append(K(`div`,`fl-break-rule`))}let r=!0,i=null;for(let e=0;e<n.length;e++){let a=n[e];if(a.type!==`title`){if(a.type===`page-break`)t.append(K(`div`,`fl-break-rule`)),r=!0;else if(je.has(a.type)){for(let n of a.comments)n.comment.type===`note`&&n.comment.lineStart===e&&t.append(q(n.comment));r=!0}else if(a.type===`blank`){if(r)continue;t.append(J(a)),r=!0}else if(r=!1,a.type===`character`){let r=K(`div`,`fl-speech`),o=e;for(;o<n.length;o++){let t=n[o],i=t.type===`parenthetical`||t.type===`dialogue`||t.type===`lyrics`&&t.inDialogue;if(o>e&&!i&&t.type!==`comment`)break;if(t.type!==`comment`)r.append(J(t));else for(let e of t.comments)e.comment.type===`note`&&e.comment.lineStart===o&&r.append(q(e.comment))}if(e=o-1,a.dual&&i&&t.lastElementChild?.classList.contains(`fl-blank`)&&t.lastElementChild.previousElementSibling===i){t.lastElementChild.remove();let e=K(`div`,`fl-dual`);i.replaceWith(e),e.append(i,r),i=null}else t.append(r),i=r}else t.append(J(a))}}return t}function Ne(t,{view:n,options:r}){if(n===`source`)return K(`pre`,`fl-script fl-source`,t);let i=e(t);return n===`flow`?Me(i):Ae(i,r)}var Pe=220,Fe=(e,...t)=>{let n=document.createElement(`div`);return n.className=e,n.append(...t),n};function Ie(){let e=new Map,t=null,n=Fe(`fl-action-pills`),r=L({label:`Hide`,icon:`chevron-left`,iconOnly:!0,cls:`fl-action-toggle`,attrs:{"aria-expanded":`true`},onClick:()=>l(!t.collapsed)}),i=Fe(`fl-ribbon`,n,r);i.setAttribute(`role`,`toolbar`),i.hidden=!0;let a=()=>{let e=t.label.toLowerCase(),n=t.collapsed?`Show ${e}`:`Hide ${e}`;r.setAttribute(`aria-expanded`,String(!t.collapsed)),r.setAttribute(`aria-label`,n),r.title=n},o=null,s=[],c=()=>{o?.cancel(),o=null;for(let e of s)e.cancel();s=[],n.classList.remove(`fl-action-animating`)};function l(e){t.collapsed=e,t.onCollapse?.(),a();let r=n.getBoundingClientRect().width;c(),n.hidden=!1,n.classList.add(`fl-action-animating`);let i=e?0:n.scrollWidth,l=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches?0:Pe,u={opacity:1,transform:`none`},d={opacity:0,transform:`translateX(-8px)`};s=[...n.children].filter(e=>!e.hidden).map(t=>t.animate(e?[u,d]:[d,u],{duration:l,easing:`ease`,fill:`forwards`}));let f=n.animate([{width:`${r}px`},{width:`${i}px`}],{duration:l,easing:`ease`});o=f,f.finished.then(()=>{n.classList.remove(`fl-action-animating`),n.hidden=e;for(let e of s)e.cancel();s=[]}).catch(()=>{})}return{root:i,set(n,{label:r,pills:i,onCollapse:a}){let o=e.get(n);e.set(n,{label:r,nodes:i,onCollapse:a,collapsed:o?.collapsed??!1}),t&&t===o&&this.show(n)},show(r){let o=e.get(r)??null;(o!==t||o&&n.firstChild!==o.nodes[0])&&(c(),t=o,i.hidden=!t,t?(i.setAttribute(`aria-label`,t.label),n.replaceChildren(...t.nodes),n.hidden=t.collapsed,a()):n.replaceChildren())}}}var Le=[{key:`bold`,label:`Bold`,text:`B`,cls:`fl-b`,title:`Bold (Ctrl/Cmd+B)`},{key:`italic`,label:`Italic`,text:`I`,cls:`fl-i`,title:`Italic (Ctrl/Cmd+I)`},{key:`underline`,label:`Underline`,text:`U`,cls:`fl-u`,title:`Underline (Ctrl/Cmd+U)`}],Re=[[{value:`scene`,glyph:`.`,label:`Scene`,title:`Scene heading. Type . to force one.`},{value:`action`,glyph:`!`,label:`Action`,title:`Action. Type ! to force it.`},{value:`transition`,glyph:`>`,label:`Transition`,title:`Transition. Type > to force one.`},{value:`centered`,glyph:`><`,label:`Centered`,title:`Centered text. Wrap it in > <.`},{value:`lyrics`,glyph:`~`,label:`Lyrics`,title:`Lyrics. Type ~ at the start of the line.`}],[{value:`character`,glyph:`@`,label:`Character`,title:`Character cue. Type @ to force one.`},{value:`parenthetical`,glyph:`()`,label:`Parenthetical`,title:`Parenthetical. Wrap it in ( ) under a character.`},{value:`dialogue`,glyph:`“`,label:`Dialogue`,title:`Dialogue. No marker needed: it is any text under a character.`}],[{value:`section-1`,glyph:`#`,label:`Act`,title:`Outline section, level 1. Type #. Not printed.`},{value:`section-2`,glyph:`##`,label:`Sequence`,title:`Outline section, level 2. Type ##. Not printed.`},{value:`synopsis`,glyph:`=`,label:`Synopsis`,title:`Synopsis. Type =. Not printed.`}]],ze=[{value:`note`,glyph:`[[`,label:`Comment`},{value:`boneyard`,glyph:`/*`,label:`Boneyard`},{value:`page-break`,glyph:`===`,label:`Page break`},{value:`section-3`,glyph:`###`,label:`Section`},{value:`title`,glyph:`:`,label:`Title page`}],Be=new Map([...Re.flat(),...ze].map(e=>[e.value,e])),Ve=Be.get(`action`),He=new Set([`character`,`parenthetical`,`dialogue`]),Ue=e=>{let t=document.createElement(`slot`);return t.name=e,t},We=(e,...t)=>{let n=document.createElement(`div`);return n.className=e,n.append(...t),n};function Ge(e){let t={label:`PDF`,title:`Export a PDF`,icon:`pdf`,onClick:()=>e.openExport()},n=We(`fl-topbar-end fl-export-holder`),r=e=>{n.replaceChildren(ve({label:`Export`,cls:`fl-export`},e.length?[e,[t]]:[[t]]))};r([]);let i=document.createElement(`div`);return i.className=`fl-topbar`,i.append(We(`fl-topbar-start`,Ue(`document`),We(`fl-topbar-tabs`,Ue(`tabs`))),n),{bar:i,exportHolder:n,setExportActions:r}}function Ke(e){let t=new Map,n=(e,n,r)=>{let i=L({...n,toggle:!0,onClick:r});return t.set(e,i),i},r=n(`boneyard`,{label:`Boneyard`,text:`S`,cls:`fl-strike`,title:`Boneyard: cut text that stays in the file but never prints. Wrap it in /* */.`},()=>e.boneyard()),i=L({label:`Page break`,title:`Insert a page break. Type === on its own line.`,icon:`page-break`,iconOnly:!0,onClick:()=>e.pageBreak()}),a=R({label:`Text style`},...Le.map(({key:t,...r})=>n(t,r,()=>e.emphasis(t))),z(),r),o=n(`note`,{label:`Comment`,title:`Comment, shown as a bubble. Wrap it in [[ ]].`,icon:`comment`,iconOnly:!0},()=>e.setLineType(`note`)),s=Ve,c=`blank`,l=new B({cls:`fl-topics`,sections:Re.map(e=>({items:e})),isChecked:e=>e===s.value,trigger:()=>{let e=document.createElement(`span`);return e.className=`fl-topic-name`,e.textContent=s.label,{label:`Topic: ${s.label}`,content:[pe(s.glyph),e]}},onSelect:t=>{(t!==`action`||c!==`blank`)&&e.setLineType(t)}}),u=R({label:`Topic options`},n(`dual`,{label:`Dual`,title:`Dual dialogue: place this speech beside the previous one. Type ^ after the name.`,glyph:`^`,collapse:!0,cls:`fl-btn-soft`},()=>e.dual()));u.hidden=!0;let d=Ie();d.set(`write`,{label:`Formatting`,pills:[a,R({label:`Topic`},l.root),R({label:`Page break`},i),R({label:`Comments`},o),u],onCollapse:()=>l.close()});let f=document.createElement(`div`);f.className=`fl-chrome`;let p=Ge(e);p.bar.insertBefore(d.root,p.exportHolder),f.append(p.bar);let m=()=>I(f);return document.fonts.ready.then(m),document.fonts.addEventListener(`loadingdone`,m),{root:f,setExportActions:p.setExportActions,destroy(){document.fonts.removeEventListener(`loadingdone`,m),l.close(),f.remove()},update(e){for(let[n,r]of t)r.setAttribute(`aria-pressed`,String(e.type===n||e[n]===!0));c=e.type;let n=Be.get(e.type)??Ve;n!==s&&(s=n,l.refresh()),u.hidden=!He.has(e.type)},setActions(e,t){d.set(e,t)},setWorkspace(e){e!==`write`&&l.close(),d.show(e)}}}var qe=10,Je=100,Ye=[{value:`flow`,icon:`seamless`,label:`Seamless`,title:`Continuous text, with no pages`},{value:`page`,icon:`paged`,label:`Paged`,title:`Editable standard script pages`},{value:`source`,icon:`source`,label:`Fountain`,title:`The Fountain text itself, with nothing hidden or formatted`}];function Xe(e){let t=`flow`,n=Je,r=new B({up:!0,sections:[{items:Ye}],isChecked:e=>e===t,trigger:()=>{let e=Ye.find(e=>e.value===t),n=document.createElement(`span`);return n.className=`fl-label fl-collapse`,n.textContent=e.label,{label:`View: ${e.label}`,content:[N(e.icon),n]}},onSelect:t=>e.setView(t)}),i=L({label:`Reset page scale`,title:`Reset to ${Je}%`,iconOnly:!0,cls:`fl-scale`,onClick:()=>e.setScale(Je)}),a=t=>()=>e.setScale(n+t),o=L({label:`Larger`,title:`Increase page scale`,icon:`plus`,iconOnly:!0,onClick:a(qe)}),s=L({label:`Smaller`,title:`Decrease page scale`,icon:`minus`,iconOnly:!0,onClick:a(-10)}),c=L({label:`Undo`,title:`Undo (Ctrl/Cmd+Z)`,icon:`undo`,iconOnly:!0,onClick:()=>e.undo()}),l=L({label:`Redo`,title:`Redo (Ctrl/Cmd+Shift+Z)`,icon:`redo`,iconOnly:!0,onClick:()=>e.redo()});c.disabled=!0,l.disabled=!0;let u=R({label:`History`},c,z(),l),d=document.createElement(`span`);d.className=`fl-status`,d.setAttribute(`role`,`status`);let f=R({label:`Status`},d);f.hidden=!0;let p=document.createElement(`span`);p.className=`fl-spacer`;let m=document.createElement(`slot`);m.name=`status-end`;let h=document.createElement(`div`);h.className=`fl-statusbar`;let g=R({label:`View`},r.root);h.append(g,R({label:`Page scale`},i,z(),o,s),f,p,u,m);let _=document.createElement(`footer`);return _.className=`fl-footer`,_.append(h),{root:_,destroy(){r.close(),_.remove()},update(e){c.disabled=!e.canUndo,l.disabled=!e.canRedo},setView(e,n=`write`){t=e,r.refresh(),n!==`write`&&r.close(),g.hidden=n!==`write`,u.hidden=n===`read`},setScale(e){n=e,i.textContent=`${n}%`,i.setAttribute(`aria-label`,`Page scale ${n}%. Reset to ${Je}%`),o.disabled=n>=200,s.disabled=n<=50},setStatus(e){d.textContent=e,f.hidden=!e}}}var Ze={mouse:4,touch:12,pen:12},Qe=64,$e=12,et=16,tt={1:`act`,2:`sequence`},nt=e=>tt[e]??`section`,rt=e=>e[0].toUpperCase()+e.slice(1),Y=(e,t,...n)=>{let r=document.createElement(e);return r.className=t,r.append(...n),r},it=e=>{let t=Y(`span`,`fl-outline-kind`,N(e));return t.setAttribute(`aria-hidden`,`true`),t},at=e=>e.kind===`block`?`scene`:e.kind===`synopsis`?`synopsis`:e.level===1?`act`:`sequence`,ot=[{name:`act`,spec:{kind:`section`,level:1}},{name:`sequence`,spec:{kind:`section`,level:2}},{name:`synopsis`,spec:{kind:`synopsis`}}],st=e=>e.map(e=>e.kind===`section`?`${e.level}@${e.line}(${st(e.children)})`:e.kind===`synopsis`?`synopsis@${e.line}`:`block@${e.line}:${e.lines.map(e=>`${e.kind}:${e.forced}:${e.text}`).join(`|`)}`).join(),ct=e=>e.lines.filter(e=>e.kind===`scene`).map(e=>({line:e.line,text:e.number})),lt=e=>e.flatMap(e=>e.kind===`section`?[e,...lt(e.children)]:e.kind===`synopsis`?[e]:ct(e));function ut({edit:t,undo:n,redo:r}){let i=[``],a=[],o=null,s=[],c=new Map,l=new Map,u=new Map,d=null,f=!1,p=new Map,m=!1,h=null,g=null,_=null,v=Y(`div`,`fl-outline-list`),y=Y(`div`,`fl-outline-hint`,Y(`p`,`fl-outline-hint-title`,`Outline your screenplay here.`),Y(`p`,``,`Click Act, Sequence or Synopsis above to add one, or drag it to where it belongs.`)),b=Y(`div`,`fl-outline-drop`);b.hidden=!0;let x=Y(`div`,`fl-outline-preview`);x.hidden=!0,x.setAttribute(`aria-hidden`,`true`);let S=Y(`div`,`fl-outline-ghost`);S.hidden=!0,S.setAttribute(`aria-hidden`,`true`);let C=({lines:e,focus:n=`add`})=>{h=n,t(e)},w=Y(`section`,`fl-outline`,y,v,b,x,S);w.setAttribute(`aria-label`,`Outline`),w.tabIndex=-1,w.hidden=!0;let T=e=>{d!==null&&c.get(d)?.classList.remove(`fl-outline-selected`),d=e!==null&&c.has(e)?e:null,d!==null&&c.get(d).classList.add(`fl-outline-selected`)},E=e=>{for(let t=e;t&&t!==w;t=t.parentElement){let e=t.dataset?.line;if(e!==void 0&&c.get(Number(e))===t)return Number(e)}return null},ne=e=>{let t=te(a,i.length,e),n=d===null?null:u.get(d);if(!n)return t[t.length-1].line;if(e.kind===`section`&&(n.kind!==`section`||n.level>e.level))return n.line;let r=n.line;for(let e of n.children??[]){if(e.kind!==`synopsis`)break;r=e.line}return(t.find(e=>e.line>r)??t[t.length-1]).line},D=(e,t)=>{C(e.kind===`synopsis`?se(i,t):oe(i,e.level,t))},O=()=>w.parentElement,k=e=>{e.style.height=`auto`,e.style.height=`${e.scrollHeight+e.offsetHeight-e.clientHeight}px`},de=()=>{let e=w.getRootNode().activeElement;return s.find(t=>t.field===e)??null},fe=({field:e})=>{e.focus(),e.setSelectionRange(e.value.length,e.value.length)},A=(e,n)=>{let r=re(i,e,n);return r?(o=null,g=r.focus,t(r.lines),!0):!1},j=(e,t)=>{let n=te(a,i.length,e.line),r=t?n.find(t=>t.line>e.end):n.findLast(t=>t.line<e.line);r&&A(e.line,r.line)},M=e=>{let t=w.getBoundingClientRect();return te(a,i.length,e).map(e=>{let n=l.get(e.parent).getBoundingClientRect(),r=e.before===null?n.bottom+3:c.get(e.before).getBoundingClientRect().top-3;return{...e,y:r-t.top,left:n.left-t.left,width:n.width}})},P=(e,{y:t,left:n,width:r})=>{e.style.top=`${t}px`,e.style.left=`${n}px`,e.style.width=`${r}px`,e.hidden=!1},F=e=>{if(x.hidden=!0,w.hidden||_||!a.length)return;let t=ne(e),n=M(e).filter(e=>e.line===t).at(-1);if(n){P(x,n);return}let r=c.get(t);if(!r)return;let i=w.getBoundingClientRect(),o=r.getBoundingClientRect();P(x,{y:o.top-3-i.top,left:o.left-i.left,width:o.width})},I=()=>{x.hidden=!0},pe=()=>{let e=O(),t=e.getBoundingClientRect(),n=getComputedStyle(e);return{top:t.top+parseFloat(n.scrollPaddingTop||0),bottom:t.bottom-parseFloat(n.scrollPaddingBottom||0)}},me=()=>{let e=w.getBoundingClientRect(),t=_.pointerY-e.top,n=pe();_.inside=_.pointerY>=n.top&&_.pointerY<=n.bottom,_.inside&&(_.entered=!0),_.slot=_.item||_.inside?_.slots.reduce((e,n)=>Math.abs(n.y-t)<Math.abs(e.y-t)?n:e,_.slots[0]):null,b.hidden=!_.slot,_.slot&&(b.hidden=!1,b.style.top=`${_.slot.y}px`,b.style.left=`${_.slot.left}px`,b.style.width=`${_.slot.width}px`);let r=Math.min(t+et,w.offsetHeight-S.offsetHeight);S.style.top=`${Math.max(0,r)}px`},he=()=>{if(!_?.active)return;let e=O(),t=pe();(_.item||_.entered)&&(_.pointerY<t.top+Qe?e.scrollTop-=$e:_.pointerY>t.bottom-Qe&&(e.scrollTop+=$e)),me(),_.frame=requestAnimationFrame(he)},z=()=>{_&&=(cancelAnimationFrame(_.frame),window.removeEventListener(`keydown`,_.onKey,!0),_.item&&c.get(_.item.line)?.classList.remove(`fl-outline-dragging`),b.hidden=!0,S.hidden=!0,null)},ge=()=>{I(),_.active=!0,_.slots=M(_.item?_.item.line:_.spec),_.item&&c.get(_.item.line).classList.add(`fl-outline-dragging`);let e=Y(`span`,``,_.label);S.replaceChildren(N(_.icon),e),S.hidden=!1,he()},_e=(e,t)=>{e.addEventListener(`pointerdown`,n=>{if(n.button!==0)return;e.setPointerCapture(n.pointerId);let r=e=>{e.key===`Escape`&&(e.stopPropagation(),z())};window.addEventListener(`keydown`,r,!0),_={item:null,spec:null,...t(),threshold:Ze[n.pointerType]??Ze.touch,startX:n.clientX,startY:n.clientY,pointerY:n.clientY,active:!1,inside:!1,entered:!1,slots:[],slot:null,onKey:r,frame:0}}),e.addEventListener(`pointermove`,e=>{_&&(_.pointerY=e.clientY,_.active?me():Math.hypot(e.clientX-_.startX,e.clientY-_.startY)>=_.threshold&&ge())});let n=e=>()=>{if(!_)return;let{item:t,spec:n,slot:r,active:i}=_;z(),i&&(f=!0),e&&i&&r&&(t?A(t.line,r.line):D(n,r.line))};e.addEventListener(`pointerup`,n(!0)),e.addEventListener(`pointercancel`,n(!1))},ve=ot.map(({name:e,spec:t})=>{let n=L({label:`Add ${e}`,title:`Add ${e===`act`?`an`:`a`} ${e} where the line shows, or drag it into place.`,icon:e,text:rt(e),cls:`fl-outline-tool`,onClick:()=>{I(),f?f=!1:D(t,ne(t))}});return _e(n,()=>({spec:t,icon:e,label:`New ${e}`})),n.addEventListener(`pointerenter`,e=>{e.pointerType===`mouse`&&F(t)}),n.addEventListener(`pointerleave`,I),n.addEventListener(`focus`,()=>{n.matches(`:focus-visible`)&&F(t)}),n.addEventListener(`blur`,I),n}),B=(e,t)=>{let n=L({label:`Move ${t}`,title:`Drag to move${t===`synopsis`?``:`, with everything under it`}. The arrow keys move it too.`,icon:`grip`,iconOnly:!0,cls:`fl-outline-grip`});return n.addEventListener(`keydown`,t=>{(t.key===`ArrowUp`||t.key===`ArrowDown`)&&(t.preventDefault(),j(e.item,t.key===`ArrowDown`))}),_e(n,()=>({item:e.item,icon:at(e.item),label:e.field?.value||e.item.text||t})),p.set(e.item.line,n),n},V=(e,n,{cls:r=`fl-outline-field`,placeholder:a=n,clean:o=e=>e,write:c=ce}={})=>{let l=document.createElement(`textarea`);l.className=r,l.rows=1,l.value=e.text,l.placeholder=a,l.setAttribute(`aria-label`,n);let u={field:l,item:e};return l.addEventListener(`input`,()=>{let e=o(l.value);e!==l.value&&(l.value=e),k(l),m=!0,t(c(i,u.item.line,l.value),{typing:!0}),m=!1}),l.addEventListener(`keydown`,e=>{if(e.key!==`Enter`||e.isComposing)return;e.preventDefault();let t=s[s.indexOf(u)+1];t?fe(t):ve[0].focus()}),s.push(u),u},H=(e,t)=>{t.dataset.line=e.line,c.set(e.line,t),u.set(e.line,e)},U=e=>L({...e,icon:`close`,iconOnly:!0,cls:`fl-outline-remove`}),ye=e=>{let t={item:e,field:null},n=e.lines.map(e=>{let t=Y(`div`,`fl-outline-line fl-outline-${e.kind}`,Y(`span`,`fl-outline-block-text${e.forced?` fl-outline-forced`:``}`,e.text));return e.kind===`scene`&&t.append(V({line:e.line,text:e.number},`Scene number`,{cls:`fl-outline-number`,placeholder:`12A`,clean:ie,write:ae}).field),t}),r=Y(`div`,`fl-outline-block`,B(t,e.scene?`scene`:`transition`),it(`scene`),Y(`div`,`fl-outline-lines`,...n));return H(e,r),r},W=e=>{let t=e.level===1,n=nt(e.level),r=V(e,rt(n)),a=Y(`article`,`fl-outline-card`,Y(`div`,`fl-outline-row fl-outline-heading`,B(r,n),it(at(e)),r.field,U({label:`Remove ${n}`,title:`Remove this ${t?`act and its sequences`:n} from the script. Scenes stay, and so do synopses, out of the outline.`,onClick:()=>C({lines:le(i,r.item.line)})})));H(e,a);let o=Y(`div`,`fl-outline-children`,...e.children.map(G));return l.set(e.line,o),a.append(o),a},be=e=>{let t=V(e,`Synopsis`),n=Y(`div`,`fl-outline-row fl-outline-synopsis`,B(t,`synopsis`),t.field,U({label:`Remove synopsis`,title:`Delete this synopsis from the script`,onClick:()=>C({lines:ue(i,t.item.line)})}));return H(e,n),n};function G(e){return e.kind===`section`?W(e):e.kind===`synopsis`?be(e):ye(e)}let xe=t=>{I(),a=ee(e(t)),i=t.split(`
`);let n=st(a),r=de();if(n===o)lt(a).forEach((e,t)=>{let n=s[t];n.item=e,n.field.value!==e.text&&!(m&&n===r)&&(n.field.value=e.text,k(n.field))});else{z();let e=r?.item.line;s=[],p=new Map,c=new Map,u=new Map,d=null,l=new Map([[null,v]]),o=n,v.replaceChildren(...a.map(G)),y.hidden=a.length>0;for(let{field:e}of s)k(e);let t=s.find(({item:t})=>t.line===(h??e));g===null?t?fe(t):(h!==null||r)&&w.focus():p.get(g)?.focus();let i=w.getRootNode().activeElement;T(w.contains(i)?E(i):null)}h=null,g=null};w.addEventListener(`focusin`,e=>{let t=E(e.target);t!==null&&T(t)}),w.addEventListener(`pointerdown`,e=>{let t=E(e.target);T(t),t===null&&w.focus({preventScroll:!0})}),w.addEventListener(`keydown`,e=>{e.key!==`Escape`||d===null||_||(T(null),w.focus({preventScroll:!0}))}),w.addEventListener(`keydown`,e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey)return;let t=e.key.toLowerCase();(t===`z`||t===`y`)&&(e.preventDefault(),t===`y`||e.shiftKey?r():n())});let Se=new ResizeObserver(()=>{if(!w.hidden)for(let{field:e}of s)k(e)});return Se.observe(w),{root:w,tools:ve.map(e=>R({label:e.getAttribute(`aria-label`)},e)),render:xe,focus(){w.contains(w.getRootNode().activeElement)||w.focus({preventScroll:!0})},destroy(){z(),Se.disconnect(),w.remove()}}}var dt=[[`titlePage`,`Title page`],[`sceneNumbers`,`Scene numbers`],[`boldScenes`,`Bold scene headings`],[`underlineScenes`,`Underline scene headings`],[`doubleSpaceScenes`,`Double space before scenes`],[`sceneContinued`,`Scene continued across pages`],[`pageNumbers`,`Page numbers`]],ft=[[`letter`,`US Letter`],[`a4`,`A4`]];function pt(e,t){let n=t.getOptions(),r=document.createElement(`label`);r.className=`fl-field`;let i=document.createElement(`select`);for(let[e,t]of ft)i.add(new Option(t,e,!1,n.paper===e));i.addEventListener(`change`,()=>t.setOption(`paper`,i.value)),r.append(`Paper`,i);let a=V(e,{title:`Export PDF`,body:[r,...dt.map(([e,r])=>{let i=document.createElement(`label`);i.className=`fl-field`;let a=document.createElement(`input`);return a.type=`checkbox`,a.checked=n[e],a.addEventListener(`change`,()=>t.setOption(e,a.checked)),i.append(a,r),i})],onClose:t.onClose,actions:[L({label:`Cancel`,cls:`fl-btn-outline`,onClick:()=>a.close()}),L({label:`Export PDF`,cls:`fl-btn-primary`,onClick:()=>{a.close(),t.exportPdf()}})]})}var mt=!1;function ht(){mt||(mt=!0,d(()=>import(`./fonts-DueK1BC_.js`).then(e=>e.registerFonts()),[],import.meta.url).catch(()=>{}))}var gt=class extends HTMLElement{static observedAttributes=[`readonly`,`view`,`workspace`,`theme`,`paper`,`scale`];#e=``;#t=!1;#n={...r};#r=null;#i=null;#a=null;#o=null;#s=null;#c=[];#l=null;#u=null;#d=null;#f=null;#p=[];#m=!1;constructor(){super();let e=this.attachShadow({mode:`open`}),t=document.createElement(`style`);t.textContent=Te,this.#u=document.createElement(`div`),this.#u.className=`fl-scroll`,e.append(t,this.#u),new ResizeObserver(()=>{this.style.setProperty(`--fl-area-w`,`${this.#u.clientWidth}px`)}).observe(this.#u)}connectedCallback(){if(!this.#m){for(let e of[`value`,`readonly`,`view`,`workspace`,`printOptions`,`exportActions`])if(Object.hasOwn(this,e)){let t=this[e];delete this[e],this[e]=t}if(this.#m=!0,!this.#t){let t=this.querySelector(`script[type="text/fountain"]`);this.#e=e(t?_t(t.textContent):this.textContent.trim()?_t(this.textContent):``).source}ht(),this.applyTheme(),this.#h(),this.#g(),this.#_()}}disconnectedCallback(){queueMicrotask(()=>{this.isConnected||(this.#r&&(this.#e=this.#r.value),this.#r?.destroy(),this.#r=null,this.#s?.destroy(),this.#s=null,this.#m=!1,this.#t=!0)})}attributeChangedCallback(e,t,n){t!==n&&this.#m&&(e===`theme`&&this.applyTheme(),e===`scale`&&this.#g(),e===`paper`&&(this.#n.paper=i[n]?n:`letter`,this.#h()),e===`readonly`?this.#_():(e===`view`||e===`workspace`||e===`paper`)&&(this.#r?this.#b():this.#f?this.#v():this.#_()))}get value(){return this.#r?this.#r.value:this.#e}set value(t){this.#t=!0,this.#e=e(t).source,this.#r?(this.#r.value=this.#e,this.#x(),this.#S()):this.#m&&!this.#f&&this.#_()}get readonly(){return this.hasAttribute(`readonly`)}set readonly(e){this.toggleAttribute(`readonly`,!!e)}get view(){let e=this.getAttribute(`view`);return e===`page`||e===`source`?e:`flow`}set view(e){this.setAttribute(`view`,e)}get workspace(){let e=this.getAttribute(`workspace`);return e===`outline`||e===`read`?e:`write`}set workspace(e){this.setAttribute(`workspace`,e)}get scale(){let e=Number(this.getAttribute(`scale`)??100);return Math.min(200,Math.max(50,Number.isFinite(e)?e:100))}set scale(e){this.setAttribute(`scale`,e)}get exportActions(){return this.#c}set exportActions(e){this.#c=e,this.#i?.setExportActions(e)}get outline(){return e(this.value).outline}get pageCount(){let{pages:n}=t(e(this.value),this.#n);return n.filter(e=>e.kind===`script`).length}get printOptions(){return{...this.#n}}set printOptions(e){this.#n={...this.#n,...e},e.paper&&(this.getAttribute(`paper`)!==e.paper&&this.setAttribute(`paper`,e.paper),this.#h()),this.#r?(this.#r.relayout(),this.#x()):this.#m&&!this.#f&&this.#_()}focus(){this.workspace===`outline`?this.#s?.focus():this.workspace===`write`&&this.#r?.focus()}scrollToLine(e){this.#r?this.#r.scrollToLine(e):this.shadowRoot.querySelector(`[data-line="${Number(e)}"]`)?.scrollIntoView({block:`center`})}selectText(e,t,n){this.#r?.selectText(e,t,n)}async exportPdf(e={}){let[{renderPdf:t},{pdfFonts:n}]=await Promise.all([d(()=>import(`./pdf-BFWi2Cdl.js`),__vite__mapDeps([0,1]),import.meta.url),d(()=>import(`./pdf-fonts-CxJ7dSoj.js`),[],import.meta.url)]),r=await t(this.value,{...this.#n,...e,fonts:n()});return{...r,blob:new Blob([r.bytes],{type:`application/pdf`})}}async downloadPdf(t={}){let r=await this.exportPdf(t),i=n(e(this.value),` - `),a=document.createElement(`a`);return a.href=URL.createObjectURL(r.blob),a.download=`${(t.filename??i??``).replace(/[\\/:*?"<>|]+/g,``)||`screenplay`}.pdf`,a.click(),setTimeout(()=>URL.revokeObjectURL(a.href),1e4),r}applyTheme(){for(let e of this.#p)this.style.removeProperty(e);this.#p=[];let e=we(this.getAttribute(`theme`));if(e)for(let[t,n]of Object.entries(e)){let e=t.startsWith(`--`)?t:`--flow-${t}`;this.style.setProperty(e,n),this.#p.push(e)}}#h(){let e=this.getAttribute(`paper`);i[e]&&(this.#n.paper=e);let t=i[this.#n.paper]??i.letter;this.style.setProperty(`--fl-page-w`,`${t.widthIn*6}em`),this.style.setProperty(`--fl-page-h`,`${t.heightIn*6}em`),this.style.setProperty(`--fl-action-w`,`${t.actionWidth*.6}em`)}#g(){let{scale:e}=this;this.style.setProperty(`--fl-scale`,e/100),this.#a?.setScale(e)}#_(){this.readonly?this.#w():this.#T()}#v(){this.#i?.setWorkspace(this.workspace),this.#a?.setView(this.view,this.workspace)}#y(){return this.workspace!==`write`}#b(){let e=this.#d.hidden;this.#d.className=this.#C(),this.#d.hidden=this.#y(),this.#v(),this.#r.relayout(),this.#x(),this.#S(),e&&!this.#d.hidden&&this.#r.focus()}#x(){let e=this.workspace===`read`;e&&!this.#o&&(this.#u.scrollTop=0),this.#o?.remove(),this.#o=null,e&&(this.#o=Ne(this.#r.value,{view:`page`,options:this.#n}),this.#o.classList.add(`fl-read`),this.#a.root.before(this.#o))}#S(){if(!this.#s)return;let e=this.workspace===`outline`;e&&this.#s.root.hidden&&(this.#u.scrollTop=0),this.#s.root.hidden=!e,e&&this.#s.render(this.#r.value)}#C(){return`fl-script fl-editor-host ${{flow:`fl-flow`,source:`fl-source`}[this.view]??`fl-sheet`}`}#w(){this.#f=null,this.#r&&=(this.#e=this.#r.value,this.#r.destroy(),null),this.#s?.destroy(),this.#s=null,this.#O(),this.#o=null;let e=this.hasAttribute(`view`)?this.view:`page`;this.#u.replaceChildren(Ne(this.#e,{view:e,options:this.#n})),this.dispatchEvent(new CustomEvent(`flow-ready`))}async#T(){this.#r&&=(this.#e=this.#r.value,this.#r.destroy(),null),this.#s?.destroy(),this.#s=null,this.#E();let e=this.#f={},{FlowEditor:t}=await d(async()=>{let{FlowEditor:e}=await import(`./editor-cGdnKzNh.js`);return{FlowEditor:e}},__vite__mapDeps([2,1]),import.meta.url);this.#f!==e||this.readonly||(this.#f=null,this.#d=document.createElement(`div`),this.#d.className=this.#C(),this.#d.hidden=this.#y(),this.#s=ut({edit:(e,t)=>this.#r.commitFromOutline(e,t),undo:()=>this.#r.undo({focus:!1}),redo:()=>this.#r.redo({focus:!1})}),this.#i.setActions(`outline`,{label:`Outline`,pills:this.#s.tools}),this.#v(),this.#u.replaceChildren(this.#i.root,this.#d,this.#s.root,this.#a.root),this.#o=null,this.#r=new t(this.#d,{value:this.#e,getLayoutOptions:()=>this.#n,showSource:()=>this.view===`source`,onChange:(e,t)=>{this.#e=e,this.workspace===`outline`&&this.#s?.render(e),this.dispatchEvent(new CustomEvent(`flow-change`,{detail:{value:e,outline:t}}))},onState:e=>{this.#i?.update(e),this.#a?.update(e),this.dispatchEvent(new CustomEvent(`flow-selection`,{detail:e}))}}),this.#D(),this.#x(),this.#S(),this.dispatchEvent(new CustomEvent(`flow-ready`)))}#E(){this.#i||(this.#i=this.#A(),this.#a=this.#k(),this.#u.classList.add(`fl-has-bars`),this.#u.prepend(this.#i.root),this.#u.append(this.#a.root),this.#l=new ResizeObserver(()=>this.#D()),this.#l.observe(this.#i.root),this.#l.observe(this.#a.root),this.#i.setExportActions(this.#c),this.#v(),this.#a.setScale(this.scale))}#D(){if(!this.#i)return;let e=this.#i.root.offsetHeight,t=this.#a.root.offsetHeight;this.style.setProperty(`--fl-inset-top`,`${e}px`),this.style.setProperty(`--fl-inset-bottom`,`${t}px`),this.#r?.setInsets(e,t)}#O(){this.#l?.disconnect(),this.#l=null,this.#u.classList.remove(`fl-has-bars`),this.style.removeProperty(`--fl-inset-top`),this.style.removeProperty(`--fl-inset-bottom`),this.#i?.destroy(),this.#a?.destroy(),this.#i=null,this.#a=null}#k(){return Xe({undo:()=>this.#r?.undo({focus:this.workspace===`write`}),redo:()=>this.#r?.redo({focus:this.workspace===`write`}),setView:e=>{this.view=e},setScale:e=>{this.scale=e,this.dispatchEvent(new CustomEvent(`flow-scale`,{detail:{scale:this.scale}}))}})}#A(){let e=e=>(...t)=>this.#r&&e(this.#r,...t);return Ke({emphasis:e((e,t)=>e.emphasis(t)),setLineType:e((e,t)=>e.setLineType(t)),dual:e(e=>e.dual()),boneyard:e(e=>e.boneyard()),pageBreak:e(e=>e.pageBreak()),openExport:()=>pt(this.shadowRoot,{getOptions:()=>this.#n,setOption:(e,t)=>{this.printOptions={[e]:t}},exportPdf:()=>this.#j(),onClose:()=>this.focus()})})}async#j(){let e=e=>this.#a?.setStatus(e);e(`Building PDF…`);try{let{pageCount:t,unsupported:n}=await this.downloadPdf();e(n.length?`Exported, but "${n.slice(0,8).join(``)}" can't be drawn and show as "?"`:`Exported ${t} page${t===1?``:`s`}`)}catch(t){e(`PDF export failed: ${t.message}`)}}};function _t(e){let t=e.replace(/\r\n?/g,`
`).split(`
`);for(;t.length&&!t[0].trim();)t.shift();for(;t.length&&!t[t.length-1].trim();)t.pop();let n=t.filter(e=>e.trim()).map(e=>/^[ \t]*/.exec(e)[0].length),r=n.length?Math.min(...n):0;return t.map(e=>e.slice(r)).join(`
`)}function vt(){let e=document.createElement(`style`);e.textContent=`${Se}\n${ye}`,document.head.prepend(e)}customElements.get(`flow-script`)||customElements.define(`flow-script`,gt);var yt=`flow`,bt=`docs`,xt=null;function St(){return xt??=new Promise((e,t)=>{let n=indexedDB.open(yt,1);n.onupgradeneeded=()=>n.result.createObjectStore(bt,{keyPath:`id`}),n.onsuccess=()=>e(n.result),n.onerror=()=>t(n.error)}),xt}async function Ct(e,t){let n=await St();return new Promise((r,i)=>{let a=n.transaction(bt,e),o=t(a.objectStore(bt));a.oncomplete=()=>r(o.result),a.onerror=()=>i(a.error)})}var wt=e=>Ct(`readonly`,t=>t.get(e)),Tt=e=>Ct(`readwrite`,t=>t.put(e)),Et=e=>Ct(`readwrite`,t=>t.delete(e));async function Dt(){return(await Ct(`readonly`,e=>e.getAll())).sort((e,t)=>t.updatedAt-e.updatedAt)}async function Ot({name:e,value:t,provider:n=null,ref:r=null,saved:i=!1}){let a={id:crypto.randomUUID(),name:e,value:t,savedValue:i?t:null,provider:n,ref:r,updatedAt:Date.now()};return await Tt(a),a}var kt=[`.fountain`,`.spmd`,`.txt`],At=[{description:`Fountain screenplay`,accept:{"text/plain":kt}}],jt=`flow-scripts`,Mt=()=>`showOpenFilePicker`in window&&`showSaveFilePicker`in window,Nt=e=>e?.name===`AbortError`;function Pt(){return new Promise(e=>{let t=document.createElement(`input`);t.type=`file`,t.accept=kt.join(`,`),t.addEventListener(`change`,()=>e(t.files[0]??null)),t.addEventListener(`cancel`,()=>e(null)),t.click()})}function Ft(e){let t=Vt(e.name),n=document.createElement(`a`);return n.href=URL.createObjectURL(new Blob([e.value],{type:`text/plain;charset=utf-8`})),n.download=t,n.click(),setTimeout(()=>URL.revokeObjectURL(n.href),1e4),{name:t,ref:{downloaded:!0}}}async function It(e,t){let n=await e.createWritable();return await n.write(t),await n.close(),(await e.getFile()).lastModified}async function Lt(e){try{return await window.showSaveFilePicker({suggestedName:Vt(e.name),types:At,...e.ref?.handle?{startIn:e.ref.handle}:{id:jt}})}catch(e){if(Nt(e))return null;throw e}}var Rt={id:`local`,label:`This device`,description:`Open a Fountain file from your computer or phone.`,status:()=>({ok:!0}),saveHint:()=>Mt()?`Choose the folder and file name.`:`Downloads a copy. This browser can’t choose a folder.`,location:e=>e.ref?.handle?`On this device`:`Downloaded copy`,async open(){if(!Mt()){let e=await Pt();return e&&{name:e.name,text:await e.text(),ref:{downloaded:!0}}}try{let[e]=await window.showOpenFilePicker({id:jt,types:At});return await this.openHandle(e)}catch(e){if(Nt(e))return null;throw e}},async openHandle(e){let t=await e.getFile();return{name:t.name,text:await t.text(),ref:{handle:e,lastModified:t.lastModified}}},async save(e,{force:t=!1,target:n=null}={}){if(!Mt())return Ft(e);let r=e.ref?.handle,i=n??await Lt(e);if(!i)return null;if(!t&&r&&await i.isSameEntry(r)&&(await i.getFile()).lastModified>e.ref.lastModified){let t=new Bt(`${e.name} changed outside Flow since it was last opened or saved.`);throw t.target=i,t}return{name:i.name,ref:{handle:i,lastModified:await It(i,e.value)}}},saveAs(e){return this.save(e)}},X=[Rt],zt=e=>X.find(t=>t.id===e),Bt=class extends Error{name=`ConflictError`};function Vt(e){let t=(e.replace(/\s*\u00b7\s*/g,` - `)||`Untitled Screenplay`).replace(/[\\/:*?"<>|]+/g,``).trim()||`Untitled Screenplay`;return/\.(fountain|spmd|txt)$/i.test(t)?t:`${t}.fountain`}function Z(e,t={},...n){let r=document.createElement(e);for(let[e,n]of Object.entries(t))e.startsWith(`on`)?r.addEventListener(e.slice(2),n):e===`class`?r.className=n:n===!0?r.setAttribute(e,``):n!==!1&&n!=null&&r.setAttribute(e,n);return r.append(...n.filter(e=>e!=null)),r}var Ht;function Q(e){let t=document.getElementById(`toast`);t.textContent=e,t.hidden=!1,clearTimeout(Ht),Ht=setTimeout(()=>{t.hidden=!0},6e3)}function Ut(e){let t=Math.round((Date.now()-e)/6e4);if(t<1)return`just now`;if(t<60)return`${t} min ago`;let n=Math.round(t/60);return n<24?`${n} hr ago`:new Date(e).toLocaleDateString(void 0,{month:`short`,day:`numeric`,year:`numeric`})}var Wt=[[`auto`,`Auto`],[`light`,`Light`],[`dark`,`Dark`]],Gt=`flow-theme`,Kt={palette:`sage`,mode:`auto`},qt={amber:`sand`,ocean:`sea`,tulip:`lavender`,volcano:`romance`};function Jt(){let e=null;try{e=localStorage.getItem(Gt)}catch{}let[t,n]=(e??``).split(`-`),r=qt[t]??t;return W[r]&&Wt.some(([e])=>e===n)?{palette:r,mode:n}:Kt}var Yt=({palette:e,mode:t})=>`${e}-${t}`,Xt=()=>Yt(Jt());function Zt({onChange:e,up:t}={}){let n=Jt(),r=e=>`palette:${e}`,i=e=>`mode:${e}`,a=new B({up:t,cls:`theme`,sections:[{label:`Theme`,items:Object.entries(W).map(([e,{label:t}])=>({value:r(e),label:t}))},{label:`Mode`,items:Wt.map(([e,t])=>({value:i(e),label:t}))}],isChecked:e=>e===r(n.palette)||e===i(n.mode),trigger:()=>{let{label:e}=W[n.palette];return{label:`Theme: ${e}, ${Wt.find(([e])=>e===n.mode)[1]}`,content:[N(`palette`),Z(`span`,{class:`fl-compact-hide`},e)]}},onSelect:t=>{let[r,i]=t.split(`:`);n={...n,[r]:i};let o=Yt(n);try{localStorage.setItem(Gt,o)}catch{}document.documentElement.dataset.theme=o,a.refresh(),e?.(o)}});return a.root}var Qt=e=>{location.hash=`#/edit/${e.id}`};async function $t(){let e=await Ot({name:`Untitled Screenplay`,value:_()});sessionStorage.setItem(`flow-new-doc`,e.id),Qt(e)}async function en(e){try{let t=await e.open();if(!t)return;Qt(await Ot({name:t.name,value:t.text.replace(/\r\n?/g,`
`),provider:e.id,ref:t.ref,saved:!0}))}catch(e){Q(e.message)}}function tn(e){let t=e.status();return Z(`button`,{type:`button`,class:`card`,disabled:!t.ok,"data-provider":e.id,onclick:()=>en(e)},Z(`span`,{class:`card-title`},e.label),Z(`span`,{class:`card-text`},e.description),t.ok?null:Z(`span`,{class:`badge`},t.reason))}function nn(e,t){let n=e.value!==e.savedValue,r=X.find(t=>t.id===e.provider)?.label??`Not saved to a file`;return Z(`li`,{class:`recent-row`},Z(`button`,{type:`button`,class:`recent-open`,onclick:()=>Qt(e)},Z(`span`,{class:`recent-name`},e.name),Z(`span`,{class:`recent-meta`},`${r} · ${Ut(e.updatedAt)}${n?` · unsaved changes`:``}`)),Z(`button`,{type:`button`,class:`recent-remove`,"aria-label":`Remove ${e.name} from this list`,title:`Remove from this list`,onclick:async()=>{(!n||confirm(`"${e.name}" has changes that aren't saved to a file. Remove it and lose them?`))&&(await Et(e.id),t())}},`×`))}var $=null;window.addEventListener(`beforeinstallprompt`,e=>{e.preventDefault(),$=e,document.getElementById(`install`)?.removeAttribute(`hidden`)}),window.addEventListener(`appinstalled`,()=>{$=null,document.getElementById(`install`)?.setAttribute(`hidden`,``)});async function rn(e){let t=await Dt(),n=()=>rn(e),r=Z(`button`,{type:`button`,id:`install`,class:`plain`,hidden:!$,onclick:async()=>{await $?.prompt(),$=null,r.hidden=!0}},`Install app`);e.replaceChildren(Z(`div`,{class:`home`},Z(`header`,{class:`home-top`},Z(`span`,{class:`brand`},`Flow`),Z(`span`,{class:`spacer`}),navigator.onLine?null:Z(`span`,{class:`badge`},`Offline`),r,R({label:`Appearance`},Zt())),Z(`main`,{},Z(`h1`,{},`Write your screenplay`),Z(`section`,{"aria-labelledby":`start-heading`},Z(`h2`,{id:`start-heading`},`Start something new`),Z(`button`,{type:`button`,class:`card primary`,id:`new-script`,onclick:$t},Z(`span`,{class:`card-title`},`New script`),Z(`span`,{class:`card-text`},`Begins with a full title page. Keep what you need and delete the rest.`))),Z(`section`,{"aria-labelledby":`open-heading`},Z(`h2`,{id:`open-heading`},`Open a script`),Z(`div`,{class:`cards`},...X.map(tn))),t.length?Z(`section`,{"aria-labelledby":`recent-heading`},Z(`h2`,{id:`recent-heading`},`Recent`),Z(`ul`,{class:`recent`},...t.map(e=>nn(e,n)))):null)))}var an=300,on=`flow-scale`;function sn(){let e=X.filter(e=>e.status().ok);return e.length===1?Promise.resolve(e[0]):new Promise(e=>{let t=null,n=e=>{t=e,r.close()},r=V(document.body,{title:`Save to`,onClose:()=>e(t),body:[Z(`div`,{class:`cards`},...X.map(e=>{let t=e.status();return Z(`button`,{type:`button`,class:`card`,disabled:!t.ok,onclick:()=>n(e)},Z(`span`,{class:`card-title`},e.label),Z(`span`,{class:`card-text`},e.saveHint()),t.ok?null:Z(`span`,{class:`badge`},t.reason))}))],actions:[L({label:`Cancel`,cls:`fl-btn-outline`,onClick:()=>n(null)})]})})}var cn=[`Write`,`Outline`,`Read`],ln=()=>{let e=new URLSearchParams(location.hash.split(`?`)[1]).get(`tab`);return cn.find(t=>t.toLowerCase()===e)??`Write`},un=e=>{let[t]=location.hash.split(`?`);history.replaceState(history.state,``,e===`Write`?t:`${t}?tab=${e.toLowerCase()}`)},dn=()=>{try{return localStorage.getItem(on)}catch{return null}};function fn(t,r){let i=document.createElement(`flow-script`),a=ln();i.setAttribute(`workspace`,a.toLowerCase()),i.setAttribute(`theme`,Xt());let o=dn();o&&i.setAttribute(`scale`,o),i.addEventListener(`flow-scale`,e=>{try{localStorage.setItem(on,e.detail.scale)}catch{}}),i.value=r.value;let s=Z(`span`,{class:`doc-name`}),c=Z(`span`,{class:`doc-date`}),l=Z(`span`,{class:`doc-where`}),u=Z(`span`,{class:`doc-state`,role:`status`}),d=!1,f=()=>{s.textContent=r.name,c.textContent=new Date(r.updatedAt).toLocaleDateString(void 0,{month:`short`,day:`numeric`,year:`numeric`}),l.textContent=zt(r.provider)?.location(r)??``,r.value===r.savedValue?u.textContent=`Saved`:r.savedValue===null?u.textContent=`On this device only`:u.textContent=`Unsaved changes`},p=null,m=()=>(clearTimeout(p),p=null,Tt(r).catch(e=>Q(`Couldn't autosave: ${e.message}`))),h=async(e,t)=>{Object.assign(r,{name:t.name,ref:t.ref,provider:e.id,savedValue:r.value}),await m(),f(),Q(t.ref.downloaded?`Downloaded ${t.name}. This browser can\u2019t ask where to save, but Chrome and Edge can.`:`Saved ${t.name}`)},g=async(e,t)=>{try{return await e.save(r,t)}catch(t){if(t.name!==`ConflictError`)throw t;return confirm(`${t.message}\n\nOverwrite it with this version?`)?g(e,{force:!0,target:t.target}):null}},_=e=>async()=>{if(!d){d=!0;try{await e()}catch(e){Q(`${e.message} Your changes are kept on this device.`)}finally{d=!1,i.focus()}}},v=_(async()=>{let e=await sn();if(!e)return;let t=await e.saveAs(r);t&&await h(e,t)}),y=async()=>{let e=zt(r.provider);return e?_(async()=>{let t=await g(e);t&&await h(e,t)})():v()},b=e=>{(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()===`s`&&(e.preventDefault(),e.shiftKey?v():y())},x=()=>{p&&m()};return i.addEventListener(`flow-change`,t=>{r.value=t.detail.value,r.updatedAt=Date.now(),r.savedValue===null&&(r.name=n(e(r.value))||`Untitled Screenplay`),f(),clearTimeout(p),p=setTimeout(m,an)}),sessionStorage.getItem(`flow-new-doc`)===r.id&&(sessionStorage.removeItem(`flow-new-doc`),i.addEventListener(`flow-ready`,()=>{let t=e(r.value).lines[0];i.selectText(0,t.contentStart,t.contentEnd)},{once:!0})),window.addEventListener(`keydown`,b),window.addEventListener(`pagehide`,x),f(),i.exportActions=[{label:`Save`,title:`Save (Ctrl/Cmd+S)`,icon:`save`,attrs:{id:`save`},onClick:y},{label:`Save as`,title:`Save as (Ctrl/Cmd+Shift+S)`,icon:`save-as`,attrs:{id:`save-as`},onClick:v}],i.append(R({cls:`fl-pill-tinted doc-pill`,label:`Document`,attrs:{slot:`document`}},L({label:`Home`,title:`Back to all scripts`,icon:`stack`,iconOnly:!0,href:`#/`,cls:`home-link`}),z(),Z(`span`,{class:`doc`},s,Z(`span`,{class:`doc-meta`},c,l,u))),_e({label:`Workspace`,attrs:{slot:`tabs`},onSelect:e=>{i.setAttribute(`workspace`,e.toLowerCase()),un(e)}},[{label:`Write`,icon:`write`,selected:a===`Write`},{label:`Outline`,icon:`outline`,title:`Plan the script with acts, sequences and synopses`,selected:a===`Outline`},{label:`Read`,icon:`read`,title:`The pages as they print, with editing off`,selected:a===`Read`}]),R({label:`Appearance`,attrs:{slot:`status-end`}},Zt({up:!0,onChange:e=>i.setAttribute(`theme`,e)}))),t.replaceChildren(Z(`div`,{class:`editor`},i)),()=>{window.removeEventListener(`keydown`,b),window.removeEventListener(`pagehide`,x),p&&m()}}var pn=async(e,t)=>e.provider===`local`&&!!e.ref?.handle&&e.ref.handle.isSameEntry(t);async function mn(e){let t=await Rt.openHandle(e),n=t.text.replace(/\r\n?/g,`
`);for(let r of await Dt())if(await pn(r,e))return r.value===r.savedValue&&(Object.assign(r,{value:n,savedValue:n,ref:t.ref,updatedAt:Date.now()}),await Tt(r)),r;return Ot({name:t.name,value:n,provider:Rt.id,ref:t.ref,saved:!0})}var hn=document.getElementById(`app`),gn=null;async function _n(){gn?.(),gn=null;let e=/^#\/edit\/([^?]+)/.exec(location.hash)?.[1],t=e&&await wt(e);t?gn=fn(hn,t):await rn(hn)}var vn=()=>!/^#\/edit\//.test(location.hash);vt(),document.documentElement.dataset.theme=Xt(),ht(),window.addEventListener(`hashchange`,()=>_n().catch(e=>Q(e.message)));for(let e of[`online`,`offline`])window.addEventListener(e,()=>{vn()&&_n()});_n().catch(e=>Q(e.message)),`launchQueue`in window&&window.launchQueue.setConsumer(async({files:e})=>{if(e?.length)try{let t=null;for(let n of e)t=await mn(n);let n=`#/edit/${t.id}`;location.hash===n?await _n():location.hash=n}catch(e){Q(e.message)}});var yn=g({onNeedRefresh(){let e=document.createElement(`div`);e.className=`update-banner`,e.setAttribute(`role`,`status`);let t=document.createElement(`button`);t.type=`button`,t.textContent=`Reload`,t.addEventListener(`click`,()=>yn(!0)),e.append(`A new version of Flow is ready. `,t),document.body.append(e)}});