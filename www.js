// LitElement 核心库（保持原样）
const D=window,st=D.ShadowRoot&&(D.ShadyCSS===void 0||D.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,nt=Symbol(),ht=new WeakMap;class At{constructor(t,e,i){if(this._$cssResult$=!0,i!==nt)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(st&&t===void 0){const i=e!==void 0&&e.length===1;i&&(t=ht.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&ht.set(e,t))}return t}toString(){return this.cssText}}const Rt=n=>new At(typeof n=="string"?n:n+"",void 0,nt),k=(n,...t)=>{const e=n.length===1?n[0]:t.reduce((i,s,o)=>i+(r=>{if(r._$cssResult$===!0)return r.cssText;if(typeof r=="number")return r;throw Error("use css function "+r+". Use unsafeCSS")})(s)+n[o+1],n[0]);return new At(e,n,nt)},Bt=(n,t)=>{st?n.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet):t.forEach(e=>{const i=document.createElement("style"),s=D.litNonce;s!==void 0&&i.setAttribute("nonce",s),i.textContent=e.cssText,n.appendChild(i)})},ct=st?n=>n:n=>n instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return Rt(e)})(n):n;var Z;const j=window,dt=j.trustedTypes,Ht=dt?dt.emptyScript:"",ut=j.reactiveElementPolyfillSupport,tt={toAttribute(n,t){switch(t){case Boolean:n=n?Ht:null;break;case Object:case Array:n=n==null?n:JSON.stringify(n)}return n},fromAttribute(n,t){let e=n;switch(t){case Boolean:e=n!==null;break;case Number:e=n===null?null:Number(n);break;case Object:case Array:try{e=JSON.parse(n)}catch{e=null}}return e}},Et=(n,t)=>t!==n&&(t==t||n==n),J={attribute:!0,type:String,converter:tt,reflect:!1,hasChanged:Et},et="finalized";class E extends HTMLElement{constructor(){super(),this._$Ei=new Map,this.isUpdatePending=!1,this.hasUpdated=!1,this._$El=null,this._$Eu()}static addInitializer(t){var e;this.finalize(),((e=this.h)!==null&&e!==void 0?e:this.h=[]).push(t)}static get observedAttributes(){this.finalize();const t=[];return this.elementProperties.forEach((e,i)=>{const s=this._$Ep(i,e);s!==void 0&&(this._$Ev.set(s,i),t.push(s))}),t}static createProperty(t,e=J){if(e.state&&(e.attribute=!1),this.finalize(),this.elementProperties.set(t,e),!e.noAccessor&&!this.prototype.hasOwnProperty(t)){const i=typeof t=="symbol"?Symbol():"__"+t,s=this.getPropertyDescriptor(t,i,e);s!==void 0&&Object.defineProperty(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){return{get(){return this[e]},set(s){const o=this[t];this[e]=s,this.requestUpdate(t,o,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)||J}static finalize(){if(this.hasOwnProperty(et))return!1;this[et]=!0;const t=Object.getPrototypeOf(this);if(t.finalize(),t.h!==void 0&&(this.h=[...t.h]),this.elementProperties=new Map(t.elementProperties),this._$Ev=new Map,this.hasOwnProperty("properties")){const e=this.properties,i=[...Object.getOwnPropertyNames(e),...Object.getOwnPropertySymbols(e)];for(const s of i)this.createProperty(s,e[s])}return this.elementStyles=this.finalizeStyles(this.styles),!0}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const s of i)e.unshift(ct(s))}else t!==void 0&&e.push(ct(t));return e}static _$Ep(t,e){const i=e.attribute;return i===!1?void 0:typeof i=="string"?i:typeof t=="string"?t.toLowerCase():void 0}_$Eu(){var t;this._$E_=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$Eg(),this.requestUpdate(),(t=this.constructor.h)===null||t===void 0||t.forEach(e=>e(this))}addController(t){var e,i;((e=this._$ES)!==null&&e!==void 0?e:this._$ES=[]).push(t),this.renderRoot!==void 0&&this.isConnected&&((i=t.hostConnected)===null||i===void 0||i.call(t))}removeController(t){var e;(e=this._$ES)===null||e===void 0||e.splice(this._$ES.indexOf(t)>>>0,1)}_$Eg(){this.constructor.elementProperties.forEach((t,e)=>{this.hasOwnProperty(e)&&(this._$Ei.set(e,this[e]),delete this[e])})}createRenderRoot(){var t;const e=(t=this.shadowRoot)!==null&&t!==void 0?t:this.attachShadow(this.constructor.shadowRootOptions);return Bt(e,this.constructor.elementStyles),e}connectedCallback(){var t;this.renderRoot===void 0&&(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),(t=this._$ES)===null||t===void 0||t.forEach(e=>{var i;return(i=e.hostConnected)===null||i===void 0?void 0:i.call(e)})}enableUpdating(t){}disconnectedCallback(){var t;(t=this._$ES)===null||t===void 0||t.forEach(e=>{var i;return(i=e.hostDisconnected)===null||i===void 0?void 0:i.call(e)})}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$EO(t,e,i=J){var s;const o=this.constructor._$Ep(t,i);if(o!==void 0&&i.reflect===!0){const r=(((s=i.converter)===null||s===void 0?void 0:s.toAttribute)!==void 0?i.converter:tt).toAttribute(e,i.type);this._$El=t,r==null?this.removeAttribute(o):this.setAttribute(o,r),this._$El=null}}_$AK(t,e){var i;const s=this.constructor,o=s._$Ev.get(t);if(o!==void 0&&this._$El!==o){const r=s.getPropertyOptions(o),h=typeof r.converter=="function"?{fromAttribute:r.converter}:((i=r.converter)===null||i===void 0?void 0:i.fromAttribute)!==void 0?r.converter:tt;this._$El=o,this[o]=h.fromAttribute(e,r.type),this._$El=null}}requestUpdate(t,e,i){let s=!0;t!==void 0&&(((i=i||this.constructor.getPropertyOptions(t)).hasChanged||Et)(this[t],e)?(this._$AL.has(t)||this._$AL.set(t,e),i.reflect===!0&&this._$El!==t&&(this._$EC===void 0&&(this._$EC=new Map),this._$EC.set(t,i))):s=!1),!this.isUpdatePending&&s&&(this._$E_=this._$Ej())}async _$Ej(){this.isUpdatePending=!0;try{await this._$E_}catch(e){Promise.reject(e)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var t;if(!this.isUpdatePending)return;this.hasUpdated,this._$Ei&&(this._$Ei.forEach((s,o)=>this[o]=s),this._$Ei=void 0);let e=!1;const i=this._$AL;try{e=this.shouldUpdate(i),e?(this.willUpdate(i),(t=this._$ES)===null||t===void 0||t.forEach(s=>{var o;return(o=s.hostUpdate)===null||o===void 0?void 0:o.call(s)}),this.update(i)):this._$Ek()}catch(s){throw e=!1,this._$Ek(),s}e&&this._$AE(i)}willUpdate(t){}_$AE(t){var e;(e=this._$ES)===null||e===void 0||e.forEach(i=>{var s;return(s=i.hostUpdated)===null||s===void 0?void 0:s.call(i)}),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$Ek(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$E_}shouldUpdate(t){return!0}update(t){this._$EC!==void 0&&(this._$EC.forEach((e,i)=>this._$EO(i,this[i],e)),this._$EC=void 0),this._$Ek()}updated(t){}firstUpdated(t){}}E[et]=!0,E.elementProperties=new Map,E.elementStyles=[],E.shadowRootOptions={mode:"open"},ut==null||ut({ReactiveElement:E}),((Z=j.reactiveElementVersions)!==null&&Z!==void 0?Z:j.reactiveElementVersions=[]).push("1.6.3");var K;const q=window,S=q.trustedTypes,pt=S?S.createPolicy("lit-html",{createHTML:n=>n}):void 0,it="$lit$",y=`lit$${(Math.random()+"").slice(9)}$`,St="?"+y,Mt=`<${St}>`,A=document,N=()=>A.createComment(""),R=n=>n===null||typeof n!="object"&&typeof n!="function",Ct=Array.isArray,Lt=n=>Ct(n)||typeof(n==null?void 0:n[Symbol.iterator])=="function",Q=`[ 	
\f\r]`,U=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,gt=/-->/g,mt=/>/g,w=RegExp(`>|${Q}(?:([^\\s"'>=/]+)(${Q}*=${Q}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),ft=/'/g,_t=/"/g,Ot=/^(?:script|style|textarea|title)$/i,kt=n=>(t,...e)=>({_$litType$:n,strings:t,values:e}),l=kt(1),It=kt(2),C=Symbol.for("lit-noChange"),g=Symbol.for("lit-nothing"),vt=new WeakMap,x=A.createTreeWalker(A,129,null,!1);function Pt(n,t){if(!Array.isArray(n)||!n.hasOwnProperty("raw"))throw Error("invalid template strings array");return pt!==void 0?pt.createHTML(t):t}const Dt=(n,t)=>{const e=n.length-1,i=[];let s,o=t===2?"<svg>":"",r=U;for(let h=0;h<e;h++){const a=n[h];let c,d,u=-1,p=0;for(;p<a.length&&(r.lastIndex=p,d=r.exec(a),d!==null);)p=r.lastIndex,r===U?d[1]==="!--"?r=gt:d[1]!==void 0?r=mt:d[2]!==void 0?(Ot.test(d[2])&&(s=RegExp("</"+d[2],"g")),r=w):d[3]!==void 0&&(r=w):r===w?d[0]===">"?(r=s!=null?s:U,u=-1):d[1]===void 0?u=-2:(u=r.lastIndex-d[2].length,c=d[1],r=d[3]===void 0?w:d[3]==='"'?_t:ft):r===_t||r===ft?r=w:r===gt||r===mt?r=U:(r=w,s=void 0);const m=r===w&&n[h+1].startsWith("/>")?" ":"";o+=r===U?a+Mt:u>=0?(i.push(c),a.slice(0,u)+it+a.slice(u)+y+m):a+y+(u===-2?(i.push(void 0),h):m)}return[Pt(n,o+(n[e]||"<?>")+(t===2?"</svg>":"")),i]};class B{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let o=0,r=0;const h=t.length-1,a=this.parts,[c,d]=Dt(t,e);if(this.el=B.createElement(c,i),x.currentNode=this.el.content,e===2){const u=this.el.content,p=u.firstChild;p.remove(),u.append(...p.childNodes)}for(;(s=x.nextNode())!==null&&a.length<h;){if(s.nodeType===1){if(s.hasAttributes()){const u=[];for(const p of s.getAttributeNames())if(p.endsWith(it)||p.startsWith(y)){const m=d[r++];if(u.push(p),m!==void 0){const P=s.getAttribute(m.toLowerCase()+it).split(y),f=/([.?@])?(.*)/.exec(m);a.push({type:1,index:o,name:f[2],strings:P,ctor:f[1]==="."?qt:f[1]==="?"?Ft:f[1]==="@"?Vt:V})}else a.push({type:6,index:o})}for(const p of u)s.removeAttribute(p)}if(Ot.test(s.tagName)){const u=s.textContent.split(y),p=u.length-1;if(p>0){s.textContent=S?S.emptyScript:"";for(let m=0;m<p;m++)s.append(u[m],N()),x.nextNode(),a.push({type:2,index:++o});s.append(u[p],N())}}}else if(s.nodeType===8)if(s.data===St)a.push({type:2,index:o});else{let u=-1;for(;(u=s.data.indexOf(y,u+1))!==-1;)a.push({type:7,index:o}),u+=y.length-1}o++}}static createElement(t,e){const i=A.createElement("template");return i.innerHTML=t,i}}function O(n,t,e=n,i){var s,o,r,h;if(t===C)return t;let a=i!==void 0?(s=e._$Co)===null||s===void 0?void 0:s[i]:e._$Cl;const c=R(t)?void 0:t._$litDirective$;return(a==null?void 0:a.constructor)!==c&&((o=a==null?void 0:a._$AO)===null||o===void 0||o.call(a,!1),c===void 0?a=void 0:(a=new c(n),a._$AT(n,e,i)),i!==void 0?((r=(h=e)._$Co)!==null&&r!==void 0?r:h._$Co=[])[i]=a:e._$Cl=a),a!==void 0&&(t=O(n,a._$AS(n,t.values),a,i)),t}class jt{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){var e;const{el:{content:i},parts:s}=this._$AD,o=((e=t==null?void 0:t.creationScope)!==null&&e!==void 0?e:A).importNode(i,!0);x.currentNode=o;let r=x.nextNode(),h=0,a=0,c=s[0];for(;c!==void 0;){if(h===c.index){let d;c.type===2?d=new M(r,r.nextSibling,this,t):c.type===1?d=new c.ctor(r,c.name,c.strings,this,t):c.type===6&&(d=new Wt(r,this,t)),this._$AV.push(d),c=s[++a]}h!==(c==null?void 0:c.index)&&(r=x.nextNode(),h++)}return x.currentNode=A,o}v(t){let e=0;for(const i of this._$AV)i!==void 0&&(i.strings!==void 0?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}}class M{constructor(t,e,i,s){var o;this.type=2,this._$AH=g,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cp=(o=s==null?void 0:s.isConnected)===null||o===void 0||o}get _$AU(){var t,e;return(e=(t=this._$AM)===null||t===void 0?void 0:t._$AU)!==null&&e!==void 0?e:this._$Cp}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return e!==void 0&&(t==null?void 0:t.nodeType)===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=O(this,t,e),R(t)?t===g||t==null||t===""?(this._$AH!==g&&this._$AR(),this._$AH=g):t!==this._$AH&&t!==C&&this._(t):t._$litType$!==void 0?this.g(t):t.nodeType!==void 0?this.$(t):Lt(t)?this.T(t):this._(t)}k(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}$(t){this._$AH!==t&&(this._$AR(),this._$AH=this.k(t))}_(t){this._$AH!==g&&R(this._$AH)?this._$AA.nextSibling.data=t:this.$(A.createTextNode(t)),this._$AH=t}g(t){var e;const{values:i,_$litType$:s}=t,o=typeof s=="number"?this._$AC(t):(s.el===void 0&&(s.el=B.createElement(Pt(s.h,s.h[0]),this.options)),s);if(((e=this._$AH)===null||e===void 0?void 0:e._$AD)===o)this._$AH.v(i);else{const r=new jt(o,this),h=r.u(this.options);r.v(i),this.$(h),this._$AH=r}}_$AC(t){let e=vt.get(t.strings);return e===void 0&&vt.set(t.strings,e=new B(t)),e}T(t){Ct(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,s=0;for(const o of t)s===e.length?e.push(i=new M(this.k(N()),this.k(N()),this,this.options)):i=e[s],i._$AI(o),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){var i;for((i=this._$AP)===null||i===void 0||i.call(this,!1,!0,e);t&&t!==this._$AB;){const s=t.nextSibling;t.remove(),t=s}}setConnected(t){var e;this._$AM===void 0&&(this._$Cp=t,(e=this._$AP)===null||e===void 0||e.call(this,t))}}class V{constructor(t,e,i,s,o){this.type=1,this._$AH=g,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=o,i.length>2||i[0]!==""||i[1]!==""?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=g}get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}_$AI(t,e=this,i,s){const o=this.strings;let r=!1;if(o===void 0)t=O(this,t,e,0),r=!R(t)||t!==this._$AH&&t!==C,r&&(this._$AH=t);else{const h=t;let a,c;for(t=o[0],a=0;a<o.length-1;a++)c=O(this,h[i+a],e,a),c===C&&(c=this._$AH[a]),r||(r=!R(c)||c!==this._$AH[a]),c===g?t=g:t!==g&&(t+=(c!=null?c:"")+o[a+1]),this._$AH[a]=c}r&&!s&&this.j(t)}j(t){t===g?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t!=null?t:"")}}class qt extends V{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===g?void 0:t}}const zt=S?S.emptyScript:"";class Ft extends V{constructor(){super(...arguments),this.type=4}j(t){t&&t!==g?this.element.setAttribute(this.name,zt):this.element.removeAttribute(this.name)}}class Vt extends V{constructor(t,e,i,s,o){super(t,e,i,s,o),this.type=5}_$AI(t,e=this){var i;if((t=(i=O(this,t,e,0))!==null&&i!==void 0?i:g)===C)return;const s=this._$AH,o=t===g&&s!==g||t.capture!==s.capture||t.once!==s.once||t.passive!==s.passive,r=t!==g&&(s===g||o);o&&this.element.removeEventListener(this.name,this,s),r&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){var e,i;typeof this._$AH=="function"?this._$AH.call((i=(e=this.options)===null||e===void 0?void 0:e.host)!==null&&i!==void 0?i:this.element,t):this._$AH.handleEvent(t)}}class Wt{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){O(this,t)}}const $t=q.litHtmlPolyfillSupport;$t==null||$t(B,M),((K=q.litHtmlVersions)!==null&&K!==void 0?K:q.litHtmlVersions=[]).push("2.8.0");const Zt=(n,t,e)=>{var i,s;const o=(i=e==null?void 0:e.renderBefore)!==null&&i!==void 0?i:t;let r=o._$litPart$;if(r===void 0){const h=(s=e==null?void 0:e.renderBefore)!==null&&s!==void 0?s:null;o._$litPart$=r=new M(t.insertBefore(N(),h),h,void 0,e!=null?e:{})}return r._$AI(n),r};var X,Y;class _ extends E{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){var t,e;const i=super.createRenderRoot();return(t=(e=this.renderOptions).renderBefore)!==null&&t!==void 0||(e.renderBefore=i.firstChild),i}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Zt(e,this.renderRoot,this.renderOptions)}connectedCallback(){var t;super.connectedCallback(),(t=this._$Do)===null||t===void 0||t.setConnected(!0)}disconnectedCallback(){var t;(t=this._$Do)===null||t===void 0||t.setConnected(!1)}render(){return C}}_.finalized=!0,_._$litElement$=!0,(X=globalThis.litElementHydrateSupport)===null||X===void 0||X.call(globalThis,{LitElement:_});const yt=globalThis.litElementPolyfillSupport;yt==null||yt({LitElement:_});((Y=globalThis.litElementVersions)!==null&&Y!==void 0?Y:globalThis.litElementVersions=[]).push("3.3.3");const L=n=>t=>typeof t=="function"?((e,i)=>(customElements.define(e,i),i))(n,t):((e,i)=>{const{kind:s,elements:o}=i;return{kind:s,elements:o,finisher(r){customElements.define(e,r)}}})(n,t),Jt=(n,t)=>t.kind==="method"&&t.descriptor&&!("value"in t.descriptor)?{...t,finisher(e){e.createProperty(t.key,n)}}:{kind:"field",key:Symbol(),placement:"own",descriptor:{},originalKey:t.key,initializer(){typeof t.initializer=="function"&&(this[t.key]=t.initializer.call(this))},finisher(e){e.createProperty(t.key,n)}},Kt=(n,t,e)=>{t.constructor.createProperty(e,n)};function $(n){return(t,e)=>e!==void 0?Kt(n,t,e):Jt(n,t)}function I(n){return $({...n,state:!0})}const Qt=({finisher:n,descriptor:t})=>(e,i)=>{var s;if(i===void 0){const o=(s=e.originalKey)!==null&&s!==void 0?s:e.key,r=t!=null?{kind:"method",placement:"prototype",key:o,descriptor:t(e.key)}:{...e,key:o};return n!=null&&(r.finisher=function(h){n(h,o)}),r}{const o=e.constructor;t!==void 0&&Object.defineProperty(e,i,t(i)),n==null||n(o,i)}};function Xt(n,t){return Qt({descriptor:e=>{const i={get(){var s,o;return(o=(s=this.renderRoot)===null||s===void 0?void 0:s.querySelector(n))!==null&&o!==void 0?o:null},enumerable:!0,configurable:!0};if(t){const s=typeof e=="symbol"?Symbol():"__"+e;i.get=function(){var o,r;return this[s]===void 0&&(this[s]=(r=(o=this.renderRoot)===null||o===void 0?void 0:o.querySelector(n))!==null&&r!==void 0?r:null),this[s]}}return i}})}var G;((G=window.HTMLSlotElement)===null||G===void 0?void 0:G.prototype.assignedElements)!=null;

// ================= 自定义代码从这里开始 =================

// ================= 自定义代码从这里开始 =================

// 样式变量
var rt = k`
:host { font-family: -apple-system, sans-serif; --bg: #000; --card: #1c1c1e; --primary: #ffd60a; }
.mi-app { background: var(--bg)!important; min-height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
.pager { display: flex; width: 300%; height: calc(100vh - 120px); transition: transform 0.4s ease; }
.page { width: 33.333%; height: 100%; overflow-y: auto; padding: 10px 20px; box-sizing: border-box; }
.hk-card { background: var(--card); border-radius: 20px; padding: 14px; height: 104px; display: flex; flex-direction: column; justify-content: space-between; color: #fff; cursor: pointer; }
.hk-card.active { background: #fff!important; color: #000!important; }
.hk-card.active .ent-s { color: rgba(0,0,0,0.6)!important; }
.ent-n { font-size: 16px; font-weight: 600; }
.ent-s { font-size: 24px; font-weight: 700; color: var(--primary); }
.dots { display: flex; justify-content: center; gap: 8px; padding: 10px; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.3); cursor: pointer; }
.dot.active { background: #fff; width: 14px; border-radius: 3px; }
select { background: #333; color: #fff; border: none; padding: 8px; border-radius: 8px; width: 100%; margin-bottom: 10px; }
button { background: #333; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
button:active { opacity: 0.7; }

/* 空调 UI */
.ac-screen { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 20px; color: #fff; margin-bottom: 20px; text-align: center; }
.ac-temp-big { font-size: 64px; font-weight: 200; line-height: 1; margin: 10px 0; }
.ac-status { font-size: 14px; opacity: 0.9; margin-top: 8px; }
.ac-pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
.ac-btn { height: 64px; border-radius: 16px; border: none; font-weight: 600; font-size: 16px; background: #2c2c2e; color: #fff; cursor: pointer; transition: all 0.2s; }
.ac-btn:active { transform: scale(0.95); }
.btn-red { background: #ff4d4f; grid-column: span 3; font-size: 18px; }
.btn-blue { background: #0a84ff; }
.btn-green { background: #34c759; }
.temp-display { font-size: 48px; font-weight: 300; color: #fff; text-align: center; margin: 20px 0; }
.menu-group { background: var(--card); border-radius: 16px; padding: 16px; margin-bottom: 16px; }
.menu-item { margin-bottom: 12px; }
.menu-item label { display: block; color: #999; font-size: 12px; margin-bottom: 6px; text-transform: uppercase; }
.nav-arrows { display: flex; gap: 10px; }
.nav-arrows button { flex: 1; background: #444; }
.msg { text-align: center; padding: 10px; color: #666; font-size: 12px; }
`;

// 辅助函数
var Yt=Object.defineProperty,Gt=Object.getOwnPropertyDescriptor,ot=(n,t,e,i)=>{for(var s=i>1?void 0:i?Gt(t,e):t,o=n.length-1,r;o>=0;o--)(r=n[o])&&(s=(i?r(t,e,s):r(s))||s);return i&&s&&Yt(t,e,s),s};
function at(){let n=window.location.pathname;return n.endsWith("/")?n.slice(0,-1):n}
let bt=at();
function Ut(n){return n.includes("/")}
function te(n){return Ut(n)?n.split("/")[0]:n.split("-")[0]}
function Nt(n,t){if(Ut(n.unique_id)){const i=encodeURIComponent(n.name),s=n.device?`${encodeURIComponent(n.device)}/`:"";return`${bt}/${n.domain}/${s}${i}/${t}`}const e=n.unique_id.split("-").slice(1).join("-");return`${bt}/${n.domain}/${e}/${t}`}

// 设备控制类
class ee{exec(t){if(this[t])return this[t]()}render_switch(){this.restAction(this.entity,this.entity.state==='ON'?'turn_off':'turn_on')}render_fan(){this.render_switch()}render_light(){this.render_switch()}render_climate(){}}

// 主组件
let z=class extends _{constructor(){super(...arguments);this.entities=[];this._traitsStore={};this._tabIndex=0;this._actionRenderer=new ee;this._acState={power:0,target_temp:24,current_temp:25,mode:'off'};this._acAuth={id:null,token:null};this._acBrands=[];this._acIndexes=[];this._acPtr=0;this._acBrandId="1";this._acMsg="初始化...";}
connectedCallback(){var n;super.connectedCallback();const es=window.EventSource?new EventSource(at()+"/events"):null;if(es){es.addEventListener("state",t=>{const i=JSON.parse(t.data),s=i.name_id||i.id;let o=this.entities.findIndex(r=>r.unique_id===s);if(o===-1&&s){let h={...i,domain:i.domain||te(s),unique_id:s};this.entities.push(h);this.requestUpdate()}else{Object.assign(this.entities[o],i);this.requestUpdate()}if(i.domain==='climate'&&i.id==='my_climate'){this._acState={power:i.state!=='OFF'?1:0,target_temp:i.target_temperature||24,current_temp:i.current_temperature||25,mode:i.state.toLowerCase()};this.requestUpdate();}});window.source=es;}this.acInit();}

// 修复：修正 URL 拼接，移除空格
async acProxy(url,body){
    const fd=new FormData();
    fd.append("url","http://srv.irext.net/irext-server"+url);
    fd.append("body",JSON.stringify(body));
    const res=await fetch("/api/proxy",{method:"POST",body:fd});
    if(!res.ok)throw new Error("Proxy error");
    return await res.json();
}

async acInit(){try{await this.acLogin();await this.acLoadBrands();await this.acLoadIndexes();}catch(e){console.error("AC Init failed:",e);this._acMsg="离线模式:"+e.message;this.requestUpdate()}}

async acLogin(){const d=await this.acProxy("/app/app_login",{appKey:"55b1d89fda0658d6f851ee89cad564de",appSecret:"83dfd86ad59843ce50342ec863a49bf0",appType:"2"});this._acAuth={id:d.entity.id,token:d.entity.token}}

async acLoadBrands(){this._acMsg="加载品牌...";this.requestUpdate();const d=await this.acProxy("/indexing/list_brands",{id:this._acAuth.id,token:this._acAuth.token,categoryId:1,from:0,count:200});this._acBrands=d.entity||[];if(this._acBrands.length>0){this._acBrandId=String(this._acBrands[0].id);}this.requestUpdate()}

async acLoadIndexes(){this._acMsg="加载方案...";this.requestUpdate();const d=await this.acProxy("/indexing/list_indexes",{id:this._acAuth.id,token:this._acAuth.token,categoryId:1,brandId:this._acBrandId,from:0,count:50});this._acIndexes=d.entity||[];this._acPtr=0;this._acMsg=`方案:${this._acIndexes.length}个`;this.requestUpdate()}

async acFire(key){
    if(!this._acIndexes.length)return;
    if(navigator.vibrate)navigator.vibrate(10);
    let s=this._acState;
    let needUpdate=false;
    if(key==='p'){s.power=1-s.power;needUpdate=true;}
    else if(s.power===0){s.power=1;needUpdate=true;}
    if(s.power){
        if(key==='t_up'&&s.target_temp<30){s.target_temp++;needUpdate=true;}
        if(key==='t_dn'&&s.target_temp>16){s.target_temp--;needUpdate=true;}
        if(key==='m'){needUpdate=true;}
    }
    if(needUpdate)this.requestUpdate();
    const idxId=this._acIndexes[this._acPtr].id;
    const cacheKey=`AC_${idxId}_p${s.power}_t${s.target_temp}_m${s.mode}`;
    const cached=localStorage.getItem(cacheKey);
    let timings;
    if(cached){
        this._acMsg="⚡缓存发射";
        timings=JSON.parse(cached);
    }else{
        this._acMsg="☁️云端获取...";this.requestUpdate();
        try{
            const d=await this.acProxy("/operation/decode",{id:this._acAuth.id,token:this._acAuth.token,indexId:idxId,keyCode:0,acStatus:{acPower:s.power,acMode:1,acTemp:s.target_temp-16,acWindSpeed:0,acWindDir:0,changeWindDir:0}});
            timings=d.entity;
            localStorage.setItem(cacheKey,JSON.stringify(timings));
            this._acMsg="✅已缓存";
        }catch(e){this._acMsg="❌获取失败";this.requestUpdate();return;}
    }
    fetch("/api/service/send_raw_ir",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code_str:JSON.stringify(timings)})});
    this.requestUpdate();
}

control(n){if(n.domain==='select'||n.domain==='number')return;this._actionRenderer.entity=n;this._actionRenderer.actioner=this;this._actionRenderer.exec(`render_${n.domain}`)}
restAction(n,t){fetch(Nt(n,t),{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"}})}

render(){
    const mains=this.entities.filter(n=>n.domain!=='select'&&n.domain!=='number'&&n.domain!=='button'&&n.domain!=='climate');
    const ac=this._acState;
    return l`<div class="mi-app">
        <div class="dots">
            <div class="dot ${this._tabIndex==0?'active':''}" @click="${()=>this._tabIndex=0}"></div>
            <div class="dot ${this._tabIndex==1?'active':''}" @click="${()=>this._tabIndex=1}"></div>
        </div>
        <div class="pager" style="transform:translateX(${this._tabIndex*-33.333}%)">
            <div class="page">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                    ${mains.map(n=>l`<div class="hk-card ${n.state==='ON'?'active':''}" @click="${()=>this.control(n)}">
                        <div class="ent-n">${n.name}</div>
                        <div class="ent-s">${n.state}</div>
                    </div>`)}
                </div>
            </div>
            <div class="page">
                <div class="menu-group">
                    <div class="menu-item">
                        <label>品牌选择 (${this._acBrands.length})</label>
                        <select @change="${e=>{this._acBrandId=e.target.value;this.acLoadIndexes()}}">
                            ${this._acBrands.map(b=>l`<option value="${b.id}" ?selected="${b.id==this._acBrandId}">${b.name}</option>`)}
                        </select>
                    </div>
                    <div class="menu-item">
                        <label>红外方案 (${this._acPtr+1}/${this._acIndexes.length})</label>
                        <div class="nav-arrows">
                            <button @click="${()=>{if(this._acPtr>0)this._acPtr--;this.requestUpdate()}}">◀</button>
                            <button @click="${()=>{if(this._acPtr<this._acIndexes.length-1)this._acPtr++;this.requestUpdate()}}">▶</button>
                        </div>
                    </div>
                </div>
                <div class="ac-screen">
                    <div style="font-size:14px;opacity:0.8">${ac.power?'运行中':'已关机'}</div>
                    <div class="ac-temp-big">${ac.target_temp}°</div>
                    <div class="ac-status">当前 ${ac.current_temp}°C | 目标温度</div>
                </div>
                <div class="ac-pad">
                    <button class="ac-btn btn-red" @click="${()=>this.acFire('p')}">${ac.power?'关闭':'开启'}</button>
                    <button class="ac-btn" @click="${()=>this.acFire('t_dn')}" ?disabled="${!ac.power}">－</button>
                    <button class="ac-btn" @click="${()=>this.acFire('t_up')}" ?disabled="${!ac.power}">＋</button>
                    <button class="ac-btn btn-blue" @click="${()=>this.acFire('m')}" ?disabled="${!ac.power}">模式</button>
                    <button class="ac-btn btn-blue" @click="${()=>this.acFire('s')}" ?disabled="${!ac.power}">风速</button>
                    <button class="ac-btn btn-green" @click="${()=>this.acFire('d')}" ?disabled="${!ac.power}">扫风</button>
                </div>
                <div class="msg">${this._acMsg}</div>
            </div>
            <div class="page"></div>
        </div>
    </div>`}
static get styles(){return[rt]}
};
ot([I()],z.prototype,"entities",2);ot([I()],z.prototype,"_tabIndex",2);ot([I()],z.prototype,"_acState",2);ot([I()],z.prototype,"_acBrands",2);ot([I()],z.prototype,"_acIndexes",2);ot([I()],z.prototype,"_acPtr",2);ot([I()],z.prototype,"_acMsg",2);
z=ot([L("esp-entity-table")],z);

let H=class extends _{constructor(){super();this.config={title:"智能空调"}}setConfig(n){this.config=n;document.title=n.title}firstUpdated(n){super.firstUpdated(n);const s=document.createElement('style');s.innerHTML="body{margin:0;background:#000;color:#fff}";document.head.appendChild(s);if(!window.source&&window.EventSource){window.source=new EventSource(at()+"/events");window.source.addEventListener("ping",e=>{if(e.data.length)this.setConfig(JSON.parse(e.data))})}}render(){return l`<div class="mi-app"><main style="flex:1"><esp-entity-table></esp-entity-table></main></div>`}};H=ot([L("esp-app")],H);