"use strict";var VadWeb=(()=>{var ct=(U=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(U,{get:(q,N)=>(typeof require<"u"?require:q)[N]}):U)(function(U){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+U+'" is not supported')});var tt=(U,q)=>()=>{try{return q||U((q={exports:{}}).exports,q),q.exports}catch(N){throw q=0,N}};var $s=tt(Na=>{"use strict";Object.defineProperty(Na,"__esModule",{value:!0});Na.baseAssetPath=void 0;var jh=typeof window<"u"&&typeof window.document<"u",xc=jh?window.document.currentScript:null,Sc="/";xc&&(Sc=xc.src.replace(/#.*$/,"").replace(/\?.*$/,"").replace(/\/[^/]+$/,"/"));Na.baseAssetPath=Sc});var qa=tt(La=>{"use strict";Object.defineProperty(La,"__esModule",{value:!0});La.defaultModelFetcher=void 0;var Hh=U=>fetch(U).then(q=>q.arrayBuffer());La.defaultModelFetcher=Hh});var hi=tt(Fa=>{"use strict";Object.defineProperty(Fa,"__esModule",{value:!0});Fa.log=void 0;var bs=U=>q=>{console.log(`VAD | ${U} >`,q)};Fa.log={error:bs("error"),debug:bs("debug"),warn:bs("warn")}});var ga=tt(Va=>{"use strict";Object.defineProperty(Va,"__esModule",{value:!0});Va.Message=void 0;var Tc;(function(U){U.AudioFrame="AUDIO_FRAME",U.SpeechStart="SPEECH_START",U.VADMisfire="VAD_MISFIRE",U.SpeechEnd="SPEECH_END",U.SpeechStop="SPEECH_STOP",U.SpeechRealStart="SPEECH_REAL_START",U.FrameProcessed="FRAME_PROCESSED"})(Tc||(Va.Message=Tc={}))});var Ga=tt(sr=>{"use strict";Object.defineProperty(sr,"__esModule",{value:!0});sr.FrameProcessor=sr.validateOptions=sr.defaultFrameProcessorOptions=void 0;var ya=hi(),Wr=ga();sr.defaultFrameProcessorOptions={positiveSpeechThreshold:.3,negativeSpeechThreshold:.25,preSpeechPadMs:800,redemptionMs:1400,minSpeechMs:400,submitUserSpeechOnPause:!1};function Kh(U){(U.positiveSpeechThreshold<0||U.positiveSpeechThreshold>1)&&ya.log.error("positiveSpeechThreshold should be a number between 0 and 1"),(U.negativeSpeechThreshold<0||U.negativeSpeechThreshold>U.positiveSpeechThreshold)&&ya.log.error("negativeSpeechThreshold should be between 0 and positiveSpeechThreshold"),U.preSpeechPadMs<0&&ya.log.error("preSpeechPadMs should be positive"),U.redemptionMs<0&&ya.log.error("redemptionMs should be positive"),U.minSpeechMs<0&&ya.log.error("minSpeechMs should be positive")}sr.validateOptions=Kh;var Ec=U=>{let q=U.reduce((H,Z)=>(H.push(H.at(-1)+Z.length),H),[0]),N=new Float32Array(q.at(-1));return U.forEach((H,Z)=>{let C=q[Z];N.set(H,C)}),N};function kc(U,q){let N=Math.floor(U.redemptionMs/q),H=Math.floor(U.preSpeechPadMs/q),Z=Math.floor(U.minSpeechMs/q);return{redemptionFrames:N,preSpeechPadFrames:H,minSpeechFrames:Z}}var vs=class{constructor(q,N,H,Z){this.modelProcessFunc=q,this.modelResetFunc=N,this.options=H,this.msPerFrame=Z,this.speaking=!1,this.redemptionCounter=0,this.speechFrameCount=0,this.active=!1,this.speechRealStartFired=!1,this.setOptions=te=>{this.options={...this.options,...te};let{redemptionFrames:fe,preSpeechPadFrames:_e,minSpeechFrames:ze}=kc(this.options,this.msPerFrame);this.redemptionFrames=fe,this.preSpeechPadFrames=_e,this.minSpeechFrames=ze},this.reset=()=>{this.speaking=!1,this.speechRealStartFired=!1,this.audioBuffer=[],this.modelResetFunc(),this.redemptionCounter=0,this.speechFrameCount=0},this.pause=te=>{this.active=!1,this.options.submitUserSpeechOnPause?this.endSegment(te):this.reset()},this.resume=()=>{this.active=!0},this.endSegment=te=>{let fe=this.audioBuffer;this.audioBuffer=[];let _e=this.speaking;if(this.reset(),_e)if(fe.reduce((rt,_t)=>_t.isSpeech?rt+1:rt,0)>=this.minSpeechFrames){let rt=Ec(fe.map(_t=>_t.frame));te({msg:Wr.Message.SpeechEnd,audio:rt})}else te({msg:Wr.Message.VADMisfire});return{}},this.process=async(te,fe)=>{if(!this.active)return;let _e=await this.modelProcessFunc(te),ze=_e.isSpeech>=this.options.positiveSpeechThreshold;if(fe({probs:_e,msg:Wr.Message.FrameProcessed,frame:te}),this.audioBuffer.push({frame:te,isSpeech:ze}),ze&&(this.speechFrameCount++,this.redemptionCounter=0),ze&&!this.speaking&&(this.speaking=!0,fe({msg:Wr.Message.SpeechStart})),this.speaking&&this.speechFrameCount===this.minSpeechFrames&&!this.speechRealStartFired&&(this.speechRealStartFired=!0,fe({msg:Wr.Message.SpeechRealStart})),_e.isSpeech<this.options.negativeSpeechThreshold&&this.speaking&&++this.redemptionCounter>=this.redemptionFrames){this.redemptionCounter=0,this.speechFrameCount=0,this.speaking=!1,this.speechRealStartFired=!1;let rt=this.audioBuffer;if(this.audioBuffer=[],rt.reduce((Ie,xt)=>xt.isSpeech?Ie+1:Ie,0)>=this.minSpeechFrames){let Ie=Ec(rt.map(xt=>xt.frame));fe({msg:Wr.Message.SpeechEnd,audio:Ie})}else fe({msg:Wr.Message.VADMisfire})}if(!this.speaking){for(;this.audioBuffer.length>this.preSpeechPadFrames;)this.audioBuffer.shift();this.speechFrameCount=0}},this.audioBuffer=[];let{redemptionFrames:C,preSpeechPadFrames:ue,minSpeechFrames:Se}=kc(this.options,this.msPerFrame);this.redemptionFrames=C,this.preSpeechPadFrames=ue,this.minSpeechFrames=Se,this.reset()}};sr.FrameProcessor=vs});var Ac=tt((Cc,xs)=>{"use strict";var Zh=(()=>{var U=Object.defineProperty,q=Object.getOwnPropertyDescriptor,N=Object.getOwnPropertyNames,H=Object.prototype.hasOwnProperty,Z=(e=>typeof ct<"u"?ct:typeof Proxy<"u"?new Proxy(e,{get:(t,r)=>(typeof ct<"u"?ct:t)[r]}):e)(function(e){if(typeof ct<"u")return ct.apply(this,arguments);throw Error('Dynamic require of "'+e+'" is not supported')}),C=(e,t,r)=>()=>{if(r)throw r[0];try{return e&&(t=e(e=0)),t}catch(i){throw r=[i],i}},ue=(e,t)=>{for(var r in t)U(e,r,{get:t[r],enumerable:!0})},Se=(e,t,r,i)=>{if(t&&typeof t=="object"||typeof t=="function")for(let a of N(t))!H.call(e,a)&&a!==r&&U(e,a,{get:()=>t[a],enumerable:!(i=q(t,a))||i.enumerable});return e},te=e=>Se(U({},"__esModule",{value:!0}),e),fe,_e,ze,rt,_t,Ie=C(()=>{"use strict";fe=new Map,_e=[],ze=(e,t,r)=>{if(t&&typeof t.init=="function"&&typeof t.createInferenceSessionHandler=="function"){let i=fe.get(e);if(i===void 0)fe.set(e,{backend:t,priority:r});else{if(i.priority>r)return;if(i.priority===r&&i.backend!==t)throw new Error(`cannot register backend "${e}" using priority ${r}`)}if(r>=0){let a=_e.indexOf(e);a!==-1&&_e.splice(a,1);for(let n=0;n<_e.length;n++)if(fe.get(_e[n]).priority<=r){_e.splice(n,0,e);return}_e.push(e)}return}throw new TypeError("not a valid backend")},rt=async e=>{let t=fe.get(e);if(!t)return"backend not found.";if(t.initialized)return t.backend;if(t.aborted)return t.error;{let r=!!t.initPromise;try{return r||(t.initPromise=t.backend.init(e)),await t.initPromise,t.initialized=!0,t.backend}catch(i){return r||(t.error=`${i}`,t.aborted=!0),t.error}finally{delete t.initPromise}}},_t=async e=>{let t=e.executionProviders||[],r=t.map(u=>typeof u=="string"?u:u.name),i=r.length===0?_e:r,a,n=[],s=new Set;for(let u of i){let l=await rt(u);typeof l=="string"?n.push({name:u,err:l}):(a||(a=l),a===l&&s.add(u))}if(!a)throw new Error(`no available backend found. ERR: ${n.map(u=>`[${u.name}] ${u.err}`).join(", ")}`);for(let{name:u,err:l}of n)r.includes(u)&&console.warn(`removing requested execution provider "${u}" from session options because it is not available: ${l}`);let o=t.filter(u=>s.has(typeof u=="string"?u:u.name));return[a,new Proxy(e,{get:(u,l)=>l==="executionProviders"?o:Reflect.get(u,l)})]}}),xt=C(()=>{"use strict";Ie()}),ur,Hr=C(()=>{"use strict";ur="1.30.0"}),lr,Te,fi=C(()=>{"use strict";Hr(),lr="warning",Te={wasm:{},webgl:{},webgpu:{},versions:{common:ur},set logLevel(e){if(e!==void 0){if(typeof e!="string"||["verbose","info","warning","error","fatal"].indexOf(e)===-1)throw new Error(`Unsupported logging level: ${e}`);lr=e}},get logLevel(){return lr}},Object.defineProperty(Te,"logLevel",{enumerable:!0})}),de,Xa=C(()=>{"use strict";fi(),de=Te}),mi,gi,Ya=C(()=>{"use strict";mi=(e,t)=>{let r=typeof document<"u"?document.createElement("canvas"):new OffscreenCanvas(1,1);r.width=e.dims[3],r.height=e.dims[2];let i=r.getContext("2d");if(i!=null){let a,n;t?.tensorLayout!==void 0&&t.tensorLayout==="NHWC"?(a=e.dims[2],n=e.dims[3]):(a=e.dims[3],n=e.dims[2]);let s=t?.format!==void 0?t.format:"RGB",o=t?.norm,u,l;o===void 0||o.mean===void 0?u=[255,255,255,255]:typeof o.mean=="number"?u=[o.mean,o.mean,o.mean,o.mean]:(u=[o.mean[0],o.mean[1],o.mean[2],0],o.mean[3]!==void 0&&(u[3]=o.mean[3])),o===void 0||o.bias===void 0?l=[0,0,0,0]:typeof o.bias=="number"?l=[o.bias,o.bias,o.bias,o.bias]:(l=[o.bias[0],o.bias[1],o.bias[2],0],o.bias[3]!==void 0&&(l[3]=o.bias[3]));let p=n*a,d=0,h=p,m=p*2,f=-1;s==="RGBA"?(d=0,h=p,m=p*2,f=p*3):s==="RGB"?(d=0,h=p,m=p*2):s==="RBG"&&(d=0,m=p,h=p*2);for(let _=0;_<n;_++)for(let b=0;b<a;b++){let w=(e.data[d++]-l[0])*u[0],y=(e.data[h++]-l[1])*u[1],x=(e.data[m++]-l[2])*u[2],v=f===-1?255:(e.data[f++]-l[3])*u[3];i.fillStyle="rgba("+w+","+y+","+x+","+v+")",i.fillRect(b,_,1,1)}if("toDataURL"in r)return r.toDataURL();throw new Error("toDataURL is not supported")}else throw new Error("Can not access image data")},gi=(e,t)=>{let r=typeof document<"u"?document.createElement("canvas").getContext("2d"):new OffscreenCanvas(1,1).getContext("2d"),i;if(r!=null){let a,n,s;t?.tensorLayout!==void 0&&t.tensorLayout==="NHWC"?(a=e.dims[2],n=e.dims[1],s=e.dims[3]):(a=e.dims[3],n=e.dims[2],s=e.dims[1]);let o=t!==void 0&&t.format!==void 0?t.format:"RGB",u=t?.norm,l,p;u===void 0||u.mean===void 0?l=[255,255,255,255]:typeof u.mean=="number"?l=[u.mean,u.mean,u.mean,u.mean]:(l=[u.mean[0],u.mean[1],u.mean[2],255],u.mean[3]!==void 0&&(l[3]=u.mean[3])),u===void 0||u.bias===void 0?p=[0,0,0,0]:typeof u.bias=="number"?p=[u.bias,u.bias,u.bias,u.bias]:(p=[u.bias[0],u.bias[1],u.bias[2],0],u.bias[3]!==void 0&&(p[3]=u.bias[3]));let d=n*a;if(t!==void 0&&(t.format!==void 0&&s===4&&t.format!=="RGBA"||s===3&&t.format!=="RGB"&&t.format!=="BGR"))throw new Error("Tensor format doesn't match input tensor dims");let h=4,m=0,f=1,_=2,b=3,w=0,y=d,x=d*2,v=-1;o==="RGBA"?(w=0,y=d,x=d*2,v=d*3):o==="RGB"?(w=0,y=d,x=d*2):o==="RBG"&&(w=0,x=d,y=d*2),i=r.createImageData(a,n);for(let S=0;S<n*a;m+=h,f+=h,_+=h,b+=h,S++)i.data[m]=(e.data[w++]-p[0])*l[0],i.data[f]=(e.data[y++]-p[1])*l[1],i.data[_]=(e.data[x++]-p[2])*l[2],i.data[b]=v===-1?255:(e.data[v++]-p[3])*l[3]}else throw new Error("Can not access image data");return i}}),Wt,yi,_i,wi,$i,bi,Ja=C(()=>{"use strict";pr(),Wt=(e,t)=>{if(e===void 0)throw new Error("Image buffer must be defined");if(t.height===void 0||t.width===void 0)throw new Error("Image height and width must be defined");if(t.tensorLayout==="NHWC")throw new Error("NHWC Tensor layout is not supported yet");let{height:r,width:i}=t,a=t.norm??{mean:255,bias:0},n,s;typeof a.mean=="number"?n=[a.mean,a.mean,a.mean,a.mean]:n=[a.mean[0],a.mean[1],a.mean[2],a.mean[3]??255],typeof a.bias=="number"?s=[a.bias,a.bias,a.bias,a.bias]:s=[a.bias[0],a.bias[1],a.bias[2],a.bias[3]??0];let o=t.format!==void 0?t.format:"RGBA",u=t.tensorFormat!==void 0&&t.tensorFormat!==void 0?t.tensorFormat:"RGB",l=r*i,p=u==="RGBA"?new Float32Array(l*4):new Float32Array(l*3),d=4,h=0,m=1,f=2,_=3,b=0,w=l,y=l*2,x=-1;o==="RGB"&&(d=3,h=0,m=1,f=2,_=-1),u==="RGBA"?x=l*3:u==="RBG"?(b=0,y=l,w=l*2):u==="BGR"&&(y=0,w=l,b=l*2);for(let v=0;v<l;v++,h+=d,f+=d,m+=d,_+=d)p[b++]=(e[h]+s[0])/n[0],p[w++]=(e[m]+s[1])/n[1],p[y++]=(e[f]+s[2])/n[2],x!==-1&&_!==-1&&(p[x++]=(e[_]+s[3])/n[3]);return u==="RGBA"?new Oe("float32",p,[1,4,r,i]):new Oe("float32",p,[1,3,r,i])},yi=async(e,t)=>{let r=typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement,i=typeof ImageData<"u"&&e instanceof ImageData,a=typeof ImageBitmap<"u"&&e instanceof ImageBitmap,n=typeof e=="string",s,o=t??{},u=()=>{if(typeof document<"u")return document.createElement("canvas");if(typeof OffscreenCanvas<"u")return new OffscreenCanvas(1,1);throw new Error("Canvas is not supported")},l=p=>typeof HTMLCanvasElement<"u"&&p instanceof HTMLCanvasElement||p instanceof OffscreenCanvas?p.getContext("2d"):null;if(r){let p=u();p.width=e.width,p.height=e.height;let d=l(p);if(d!=null){let h=e.height,m=e.width;if(t!==void 0&&t.resizedHeight!==void 0&&t.resizedWidth!==void 0&&(h=t.resizedHeight,m=t.resizedWidth),t!==void 0){if(o=t,t.tensorFormat!==void 0)throw new Error("Image input config format must be RGBA for HTMLImageElement");o.tensorFormat="RGBA",o.height=h,o.width=m}else o.tensorFormat="RGBA",o.height=h,o.width=m;d.drawImage(e,0,0),s=d.getImageData(0,0,m,h).data}else throw new Error("Can not access image data")}else if(i){let p,d;if(t!==void 0&&t.resizedWidth!==void 0&&t.resizedHeight!==void 0?(p=t.resizedHeight,d=t.resizedWidth):(p=e.height,d=e.width),t!==void 0&&(o=t),o.format="RGBA",o.height=p,o.width=d,t!==void 0){let h=u();h.width=d,h.height=p;let m=l(h);if(m!=null)m.putImageData(e,0,0),s=m.getImageData(0,0,d,p).data;else throw new Error("Can not access image data")}else s=e.data}else if(a){if(t===void 0)throw new Error("Please provide image config with format for Imagebitmap");let p=u();p.width=e.width,p.height=e.height;let d=l(p);if(d!=null){let h=e.height,m=e.width;return d.drawImage(e,0,0,m,h),s=d.getImageData(0,0,m,h).data,o.height=h,o.width=m,Wt(s,o)}else throw new Error("Can not access image data")}else{if(n)return new Promise((p,d)=>{let h=u(),m=l(h);if(!e||!m)return d();let f=new Image;f.crossOrigin="Anonymous",f.src=e,f.onload=()=>{h.width=f.width,h.height=f.height,m.drawImage(f,0,0,h.width,h.height);let _=m.getImageData(0,0,h.width,h.height);o.height=h.height,o.width=h.width,p(Wt(_.data,o))}});throw new Error("Input data provided is not supported - aborted tensor creation")}if(s!==void 0)return Wt(s,o);throw new Error("Input data provided is not supported - aborted tensor creation")},_i=(e,t)=>{let{width:r,height:i,download:a,dispose:n}=t,s=[1,i,r,4];return new Oe({location:"texture",type:"float32",texture:e,dims:s,download:a,dispose:n})},wi=(e,t)=>{let{dataType:r,dims:i,download:a,dispose:n}=t;return new Oe({location:"gpu-buffer",type:r??"float32",gpuBuffer:e,dims:i,download:a,dispose:n})},$i=(e,t)=>{let{dataType:r,dims:i,download:a,dispose:n}=t;return new Oe({location:"ml-tensor",type:r??"float32",mlTensor:e,dims:i,download:a,dispose:n})},bi=(e,t,r)=>new Oe({location:"cpu-pinned",type:e,data:t,dims:r??[t.length]})}),it,St,dr,vi,en=C(()=>{"use strict";it=new Map([["float32",Float32Array],["uint8",Uint8Array],["int8",Int8Array],["uint16",Uint16Array],["int16",Int16Array],["int32",Int32Array],["bool",Uint8Array],["float64",Float64Array],["uint32",Uint32Array],["int4",Uint8Array],["uint4",Uint8Array]]),St=new Map([[Float32Array,"float32"],[Uint8Array,"uint8"],[Int8Array,"int8"],[Uint16Array,"uint16"],[Int16Array,"int16"],[Int32Array,"int32"],[Float64Array,"float64"],[Uint32Array,"uint32"]]),dr=!1,vi=()=>{if(!dr){dr=!0;let e=typeof BigInt64Array<"u"&&BigInt64Array.from,t=typeof BigUint64Array<"u"&&BigUint64Array.from,r=globalThis.Float16Array,i=typeof r<"u"&&r.from;e&&(it.set("int64",BigInt64Array),St.set(BigInt64Array,"int64")),t&&(it.set("uint64",BigUint64Array),St.set(BigUint64Array,"uint64")),i?(it.set("float16",r),St.set(r,"float16")):it.set("float16",Uint16Array)}}}),xi,Si,tn=C(()=>{"use strict";pr(),xi=e=>{let t=1;for(let r=0;r<e.length;r++){let i=e[r];if(typeof i!="number"||!Number.isSafeInteger(i))throw new TypeError(`dims[${r}] must be an integer, got: ${i}`);if(i<0)throw new RangeError(`dims[${r}] must be a non-negative integer, got: ${i}`);t*=i}return t},Si=(e,t)=>{switch(e.location){case"cpu":return new Oe(e.type,e.data,t);case"cpu-pinned":return new Oe({location:"cpu-pinned",data:e.data,type:e.type,dims:t});case"texture":return new Oe({location:"texture",texture:e.texture,type:e.type,dims:t});case"gpu-buffer":return new Oe({location:"gpu-buffer",gpuBuffer:e.gpuBuffer,type:e.type,dims:t});case"ml-tensor":return new Oe({location:"ml-tensor",mlTensor:e.mlTensor,type:e.type,dims:t});default:throw new Error(`tensorReshape: tensor location ${e.location} is not supported`)}}}),Oe,pr=C(()=>{"use strict";Ya(),Ja(),en(),tn(),Oe=class{constructor(e,t,r){vi();let i,a;if(typeof e=="object"&&"location"in e)switch(this.dataLocation=e.location,i=e.type,a=e.dims,e.location){case"cpu-pinned":{let s=it.get(i);if(!s)throw new TypeError(`unsupported type "${i}" to create tensor from pinned buffer`);if(!(e.data instanceof s))throw new TypeError(`buffer should be of type ${s.name}`);this.cpuData=e.data;break}case"texture":{if(i!=="float32")throw new TypeError(`unsupported type "${i}" to create tensor from texture`);this.gpuTextureData=e.texture,this.downloader=e.download,this.disposer=e.dispose;break}case"gpu-buffer":{if(i!=="float32"&&i!=="float16"&&i!=="int32"&&i!=="int64"&&i!=="uint32"&&i!=="uint8"&&i!=="bool"&&i!=="uint4"&&i!=="int4")throw new TypeError(`unsupported type "${i}" to create tensor from gpu buffer`);this.gpuBufferData=e.gpuBuffer,this.downloader=e.download,this.disposer=e.dispose;break}case"ml-tensor":{if(i!=="float32"&&i!=="float16"&&i!=="int32"&&i!=="int64"&&i!=="uint32"&&i!=="uint64"&&i!=="int8"&&i!=="uint8"&&i!=="bool"&&i!=="uint4"&&i!=="int4")throw new TypeError(`unsupported type "${i}" to create tensor from MLTensor`);this.mlTensorData=e.mlTensor,this.downloader=e.download,this.disposer=e.dispose;break}default:throw new Error(`Tensor constructor: unsupported location '${this.dataLocation}'`)}else{let s,o;if(typeof e=="string")if(i=e,o=r,e==="string"){if(!Array.isArray(t))throw new TypeError("A string tensor's data must be a string array.");s=t}else{let u=it.get(e);if(u===void 0)throw new TypeError(`Unsupported tensor type: ${e}.`);if(Array.isArray(t)){if(e==="float16"&&u===Uint16Array||e==="uint4"||e==="int4")throw new TypeError(`Creating a ${e} tensor from number array is not supported. Please use ${u.name} as data.`);e==="uint64"||e==="int64"?s=u.from(t,BigInt):s=u.from(t)}else if(t instanceof u)s=t;else if(t instanceof Uint8ClampedArray)if(e==="uint8")s=Uint8Array.from(t);else throw new TypeError("A Uint8ClampedArray tensor's data must be type of uint8");else if(e==="float16"&&t instanceof Uint16Array&&u!==Uint16Array)s=new globalThis.Float16Array(t.buffer,t.byteOffset,t.length);else throw new TypeError(`A ${i} tensor's data must be type of ${u}`)}else if(o=t,Array.isArray(e)){if(e.length===0)throw new TypeError("Tensor type cannot be inferred from an empty array.");let u=typeof e[0];if(u==="string")i="string",s=e;else if(u==="boolean")i="bool",s=Uint8Array.from(e);else throw new TypeError(`Invalid element type of data array: ${u}.`)}else if(e instanceof Uint8ClampedArray)i="uint8",s=Uint8Array.from(e);else{let u=St.get(e.constructor);if(u===void 0)throw new TypeError(`Unsupported type for tensor data: ${e.constructor}.`);i=u,s=e}if(o===void 0)o=[s.length];else if(!Array.isArray(o))throw new TypeError("A tensor's dims must be a number array");a=o,this.cpuData=s,this.dataLocation="cpu"}let n=xi(a);if(this.cpuData&&n!==this.cpuData.length&&!((i==="uint4"||i==="int4")&&Math.ceil(n/2)===this.cpuData.length))throw new Error(`Tensor's size(${n}) does not match data length(${this.cpuData.length}).`);this.type=i,this.dims=a,this.size=n}static async fromImage(e,t){return yi(e,t)}static fromTexture(e,t){return _i(e,t)}static fromGpuBuffer(e,t){return wi(e,t)}static fromMLTensor(e,t){return $i(e,t)}static fromPinnedBuffer(e,t,r){return bi(e,t,r)}toDataURL(e){return mi(this,e)}toImageData(e){return gi(this,e)}get data(){if(this.ensureValid(),!this.cpuData)throw new Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");return this.cpuData}get location(){return this.dataLocation}get texture(){if(this.ensureValid(),!this.gpuTextureData)throw new Error("The data is not stored as a WebGL texture.");return this.gpuTextureData}get gpuBuffer(){if(this.ensureValid(),!this.gpuBufferData)throw new Error("The data is not stored as a WebGPU buffer.");return this.gpuBufferData}get mlTensor(){if(this.ensureValid(),!this.mlTensorData)throw new Error("The data is not stored as a WebNN MLTensor.");return this.mlTensorData}async getData(e){switch(this.ensureValid(),this.dataLocation){case"cpu":case"cpu-pinned":return this.data;case"texture":case"gpu-buffer":case"ml-tensor":{if(!this.downloader)throw new Error("The current tensor is not created with a specified data downloader.");if(this.isDownloading)throw new Error("The current tensor is being downloaded.");try{this.isDownloading=!0;let t=await this.downloader();return this.downloader=void 0,this.dataLocation="cpu",this.cpuData=t,e&&this.disposer&&(this.disposer(),this.disposer=void 0),t}finally{this.isDownloading=!1}}default:throw new Error(`cannot get data from location: ${this.dataLocation}`)}}dispose(){if(this.isDownloading)throw new Error("The current tensor is being downloaded.");this.disposer&&(this.disposer(),this.disposer=void 0),this.cpuData=void 0,this.gpuTextureData=void 0,this.gpuBufferData=void 0,this.mlTensorData=void 0,this.downloader=void 0,this.isDownloading=void 0,this.dataLocation="none"}ensureValid(){if(this.dataLocation==="none")throw new Error("The tensor is disposed.")}reshape(e){if(this.ensureValid(),this.downloader||this.disposer)throw new Error("Cannot reshape a tensor that owns GPU resource.");return Si(this,e)}}}),Me,Ti=C(()=>{"use strict";pr(),Me=Oe}),Pt,cr,je,Ve,Xe,Ye,Ei=C(()=>{"use strict";fi(),Pt=(e,t)=>{(typeof Te.trace>"u"?!Te.wasm.trace:!Te.trace)||console.timeStamp(`${e}::ORT::${t}`)},cr=(e,t)=>{let r=new Error().stack?.split(/\r\n|\r|\n/g)||[],i=!1;for(let a=0;a<r.length;a++){if(i&&!r[a].includes("TRACE_FUNC")){let n=`FUNC_${e}::${r[a].trim().split(" ")[1]}`;t&&(n+=`::${t}`),Pt("CPU",n);return}r[a].includes("TRACE_FUNC")&&(i=!0)}},je=e=>{(typeof Te.trace>"u"?!Te.wasm.trace:!Te.trace)||cr("BEGIN",e)},Ve=e=>{(typeof Te.trace>"u"?!Te.wasm.trace:!Te.trace)||cr("END",e)},Xe=e=>{(typeof Te.trace>"u"?!Te.wasm.trace:!Te.trace)||console.time(`ORT::${e}`)},Ye=e=>{(typeof Te.trace>"u"?!Te.wasm.trace:!Te.trace)||console.timeEnd(`ORT::${e}`)}}),ki,rn=C(()=>{"use strict";Ie(),Ti(),Ei(),ki=class Ic{constructor(t){this.handler=t}async run(t,r,i){je(),Xe("InferenceSession.run");let a={},n={};if(typeof t!="object"||t===null||t instanceof Me||Array.isArray(t))throw new TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");let s=!0;if(typeof r=="object"){if(r===null)throw new TypeError("Unexpected argument[1]: cannot be null.");if(r instanceof Me)throw new TypeError("'fetches' cannot be a Tensor");if(Array.isArray(r)){if(r.length===0)throw new TypeError("'fetches' cannot be an empty array.");s=!1;for(let l of r){if(typeof l!="string")throw new TypeError("'fetches' must be a string array or an object.");if(this.outputNames.indexOf(l)===-1)throw new RangeError(`'fetches' contains invalid output name: ${l}.`);a[l]=null}if(typeof i=="object"&&i!==null)n=i;else if(typeof i<"u")throw new TypeError("'options' must be an object.")}else{let l=!1,p=Object.getOwnPropertyNames(r);for(let d of this.outputNames)if(p.indexOf(d)!==-1){let h=r[d];(h===null||h instanceof Me)&&(l=!0,s=!1,a[d]=h)}if(l){if(typeof i=="object"&&i!==null)n=i;else if(typeof i<"u")throw new TypeError("'options' must be an object.")}else n=r}}else if(typeof r<"u")throw new TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");for(let l of this.inputNames)if(typeof t[l]>"u")throw new Error(`input '${l}' is missing in 'feeds'.`);if(s)for(let l of this.outputNames)a[l]=null;let o=await this.handler.run(t,a,n),u={};for(let l in o)if(Object.hasOwnProperty.call(o,l)){let p=o[l];p instanceof Me?u[l]=p:u[l]=new Me(p.type,p.data,p.dims)}return Ye("InferenceSession.run"),Ve(),u}async release(){return this.handler.dispose()}static async create(t,r,i,a){je(),Xe("InferenceSession.create");let n,s={};if(typeof t=="string"){if(n=t,typeof r=="object"&&r!==null)s=r;else if(typeof r<"u")throw new TypeError("'options' must be an object.")}else if(t instanceof Uint8Array){if(n=t,typeof r=="object"&&r!==null)s=r;else if(typeof r<"u")throw new TypeError("'options' must be an object.")}else if(t instanceof ArrayBuffer||typeof SharedArrayBuffer<"u"&&t instanceof SharedArrayBuffer){let p=t,d=0,h=t.byteLength;if(typeof r=="object"&&r!==null)s=r;else if(typeof r=="number"){if(d=r,!Number.isSafeInteger(d))throw new RangeError("'byteOffset' must be an integer.");if(d<0||d>=p.byteLength)throw new RangeError(`'byteOffset' is out of range [0, ${p.byteLength}).`);if(h=t.byteLength-d,typeof i=="number"){if(h=i,!Number.isSafeInteger(h))throw new RangeError("'byteLength' must be an integer.");if(h<=0||d+h>p.byteLength)throw new RangeError(`'byteLength' is out of range (0, ${p.byteLength-d}].`);if(typeof a=="object"&&a!==null)s=a;else if(typeof a<"u")throw new TypeError("'options' must be an object.")}else if(typeof i<"u")throw new TypeError("'byteLength' must be a number.")}else if(typeof r<"u")throw new TypeError("'options' must be an object.");n=new Uint8Array(p,d,h)}else throw new TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");let[o,u]=await _t(s),l=await o.createInferenceSessionHandler(n,u);return Ye("InferenceSession.create"),Ve(),new Ic(l)}startProfiling(){this.handler.startProfiling()}endProfiling(){this.handler.endProfiling()}get inputNames(){return this.handler.inputNames}get outputNames(){return this.handler.outputNames}get inputMetadata(){return this.handler.inputMetadata}get outputMetadata(){return this.handler.outputMetadata}}}),hr,an=C(()=>{"use strict";rn(),hr=ki}),nn=C(()=>{"use strict"}),sn=C(()=>{"use strict"}),on=C(()=>{"use strict"}),un=C(()=>{"use strict"}),Ii={};ue(Ii,{InferenceSession:()=>hr,TRACE:()=>Pt,TRACE_EVENT_BEGIN:()=>Xe,TRACE_EVENT_END:()=>Ye,TRACE_FUNC_BEGIN:()=>je,TRACE_FUNC_END:()=>Ve,Tensor:()=>Me,env:()=>de,registerBackend:()=>ze});var Ge=C(()=>{"use strict";xt(),Xa(),an(),Ti(),nn(),sn(),Ei(),on(),un()}),fr=C(()=>{"use strict"}),zi={};ue(zi,{default:()=>Ci});var mr,gr,Ci,ln=C(()=>{"use strict";uc(),st(),br(),mr="ort-wasm-proxy-worker",gr=globalThis.self?.name===mr,gr&&(self.onmessage=e=>{let{type:t,in:r}=e.data;try{switch(t){case"init-wasm":Sr(r.wasm).then(()=>{os(r).then(()=>{postMessage({type:t})},i=>{postMessage({type:t,err:i})})},i=>{postMessage({type:t,err:i})});break;case"init-ep":{let{epName:i,env:a}=r;us(a,i).then(()=>{postMessage({type:t})},n=>{postMessage({type:t,err:n})});break}case"copy-from":{let{buffer:i}=r,a=Da(i);postMessage({type:t,out:a});break}case"create":{let{model:i,options:a}=r;ds(i,a).then(n=>{postMessage({type:t,out:n})},n=>{postMessage({type:t,err:n})});break}case"release":ps(r),postMessage({type:t});break;case"run":{let{sessionId:i,inputIndices:a,inputs:n,outputIndices:s,options:o}=r;hs(i,a,n,s,new Array(s.length).fill(null),o).then(u=>{u.some(l=>l[3]!=="cpu")?postMessage({type:t,err:"Proxy does not support non-cpu tensor location."}):postMessage({type:t,out:u},ms([...n,...u]))},u=>{postMessage({type:t,err:u})});break}case"end-profiling":fs(r),postMessage({type:t});break;default:}}catch(i){postMessage({type:t,err:i})}}),Ci=gr?null:e=>new Worker(e??Re,{type:"classic",name:mr})}),Ai,Oi,Re,yr,jt,Ri,Bi,_r,Mi,wr,Di,$r,Pi,br=C(()=>{"use strict";fr(),Ai=typeof location>"u"?void 0:location.origin,Oi=()=>typeof document<"u"?document.currentScript?.src:typeof self<"u"?self.location?.href:void 0,Re=Oi(),yr=()=>{if(Re&&!Re.startsWith("blob:"))return Re.substring(0,Re.lastIndexOf("/")+1)},jt=(e,t)=>{try{let r=t??Re;return(r?new URL(e,r):new URL(e)).origin===Ai}catch{return!1}},Ri=(e,t)=>{let r=t??Re;try{return(r?new URL(e,r):new URL(e)).href}catch{return}},Bi=(e,t)=>`${t??"./"}${e}`,_r=async e=>{let t=await(await fetch(e,{credentials:"same-origin"})).blob();return URL.createObjectURL(t)},Mi=async e=>(await import(e)).default,wr=(ln(),te(zi)).default,Di=async()=>{if(!Re)throw new Error("Failed to load proxy worker: cannot determine the script source URL.");if(jt(Re))return[void 0,wr()];let e=await _r(Re);return[e,wr(e)]},$r=void 0,Pi=async(e,t,r,i)=>{let a=$r&&!(e||t);if(a)if(Re)a=jt(Re)||i&&!r;else if(i&&!r)a=!0;else throw new Error("cannot determine the script source URL.");if(a)return[void 0,$r];{let n="ort-wasm-simd-threaded.jsep.mjs",s=e??Ri(n,t),o=r&&s&&!jt(s,t),u=o?await _r(s):s??Bi(n,t);return[o?u:void 0,await Mi(u)]}}}),vr,Ht,Tt,xr,Ui,Ni,Li,Sr,le,st=C(()=>{"use strict";br(),Ht=!1,Tt=!1,xr=!1,Ui=()=>{if(typeof SharedArrayBuffer>"u")return!1;try{return typeof MessageChannel<"u"&&new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)),WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,4,1,3,1,1,10,11,1,9,0,65,0,254,16,2,0,26,11]))}catch{return!1}},Ni=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,30,1,28,0,65,0,253,15,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,253,186,1,26,11]))}catch{return!1}},Li=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,19,1,17,0,65,1,253,15,65,2,253,15,65,3,253,15,253,147,2,11]))}catch{return!1}},Sr=async e=>{if(Ht)return Promise.resolve();if(Tt)throw new Error("multiple calls to 'initializeWebAssembly()' detected.");if(xr)throw new Error("previous call to 'initializeWebAssembly()' failed.");Tt=!0;let t=e.initTimeout,r=e.numThreads;if(e.simd!==!1){if(e.simd==="relaxed"){if(!Li())throw new Error("Relaxed WebAssembly SIMD is not supported in the current environment.")}else if(!Ni())throw new Error("WebAssembly SIMD is not supported in the current environment.")}let i=Ui();r>1&&!i&&(typeof self<"u"&&!self.crossOriginIsolated&&console.warn("env.wasm.numThreads is set to "+r+", but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info."),console.warn("WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading."),e.numThreads=r=1);let a=e.wasmPaths,n=typeof a=="string"?a:void 0,s=a?.mjs,o=s?.href??s,u=a?.wasm,l=u?.href??u,p=e.wasmBinary,[d,h]=await Pi(o,n,r>1,!!p||!!l),m=!1,f=[];if(t>0&&f.push(new Promise(_=>{setTimeout(()=>{m=!0,_()},t)})),f.push(new Promise((_,b)=>{let w={numThreads:r};if(p)w.wasmBinary=p,w.locateFile=y=>y;else if(l||n)w.locateFile=y=>l??n+y;else if(o&&o.indexOf("blob:")!==0)w.locateFile=y=>new URL(y,o).href;else if(d){let y=yr();y&&(w.locateFile=x=>y+x)}h(w).then(y=>{Tt=!1,Ht=!0,vr=y,_(),d&&URL.revokeObjectURL(d)},y=>{Tt=!1,xr=!0,b(y)})})),await Promise.race(f),m)throw new Error(`WebAssembly backend initializing failed due to timeout: ${t}ms`)},le=()=>{if(Ht&&vr)return vr;throw new Error("WebAssembly is not initialized yet.")}}),De,Kt,re,Tr=C(()=>{"use strict";st(),De=(e,t)=>{let r=le(),i=r.lengthBytesUTF8(e)+1,a=r._malloc(i);return r.stringToUTF8(e,a,i),t.push(a),a},Kt=(e,t,r,i)=>{if(typeof e=="object"&&e!==null){if(r.has(e))throw new Error("Circular reference in options");r.add(e)}Object.entries(e).forEach(([a,n])=>{let s=t?t+a:a;if(typeof n=="object")Kt(n,s+".",r,i);else if(typeof n=="string"||typeof n=="number")i(s,n.toString());else if(typeof n=="boolean")i(s,n?"1":"0");else throw new Error(`Can't handle extra config type: ${typeof n}`)})},re=e=>{let t=le(),r=t.stackSave();try{let i=t.PTR_SIZE,a=t.stackAlloc(2*i);t._OrtGetLastError(a,a+i);let n=Number(t.getValue(a,i===4?"i32":"i64")),s=t.getValue(a+i,"*"),o=s?t.UTF8ToString(s):"";throw new Error(`${e} ERROR_CODE: ${n}, ERROR_MESSAGE: ${o}`)}finally{t.stackRestore(r)}}}),qi,dn=C(()=>{"use strict";st(),Tr(),qi=e=>{let t=le(),r=0,i=[],a=e||{};try{if(e?.logSeverityLevel===void 0)a.logSeverityLevel=2;else if(typeof e.logSeverityLevel!="number"||!Number.isInteger(e.logSeverityLevel)||e.logSeverityLevel<0||e.logSeverityLevel>4)throw new Error(`log severity level is not valid: ${e.logSeverityLevel}`);if(e?.logVerbosityLevel===void 0)a.logVerbosityLevel=0;else if(typeof e.logVerbosityLevel!="number"||!Number.isInteger(e.logVerbosityLevel))throw new Error(`log verbosity level is not valid: ${e.logVerbosityLevel}`);e?.terminate===void 0&&(a.terminate=!1);let n=0;return e?.tag!==void 0&&(n=De(e.tag,i)),r=t._OrtCreateRunOptions(a.logSeverityLevel,a.logVerbosityLevel,!!a.terminate,n),r===0&&re("Can't create run options."),e?.extra!==void 0&&Kt(e.extra,"",new WeakSet,(s,o)=>{let u=De(s,i),l=De(o,i);t._OrtAddRunConfigEntry(r,u,l)!==0&&re(`Can't set a run config entry: ${s} - ${o}.`)}),[r,i]}catch(n){throw r!==0&&t._OrtReleaseRunOptions(r),i.forEach(s=>t._free(s)),n}}}),Fi,Vi,Gi,at,Wi,ji,pn=C(()=>{"use strict";st(),Tr(),Fi=e=>{switch(e){case"disabled":return 0;case"basic":return 1;case"extended":return 2;case"layout":return 3;case"all":return 99;default:throw new Error(`unsupported graph optimization level: ${e}`)}},Vi=e=>{switch(e){case"sequential":return 0;case"parallel":return 1;default:throw new Error(`unsupported execution mode: ${e}`)}},Gi=e=>{e.extra||(e.extra={}),e.extra.session||(e.extra.session={});let t=e.extra.session;t.use_ort_model_bytes_directly||(t.use_ort_model_bytes_directly="1"),e.executionProviders&&e.executionProviders.some(r=>(typeof r=="string"?r:r.name)==="webgpu")&&(e.enableMemPattern=!1)},at=(e,t,r,i)=>{let a=De(t,i),n=De(r,i);le()._OrtAddSessionConfigEntry(e,a,n)!==0&&re(`Can't set a session config entry: ${t} - ${r}.`)},Wi=async(e,t,r)=>{let i=t.executionProviders;for(let a of i){let n=typeof a=="string"?a:a.name,s=[];switch(n){case"webnn":if(n="WEBNN",at(e,"session.disable_quant_qdq","1",r),at(e,"session.disable_qdq_constant_folding","1",r),typeof a!="string"){let d=a?.deviceType;d&&at(e,"deviceType",d,r)}break;case"webgpu":if(n="JS",typeof a!="string"){let d=a;if(d?.preferredLayout){if(d.preferredLayout!=="NCHW"&&d.preferredLayout!=="NHWC")throw new Error(`preferredLayout must be either 'NCHW' or 'NHWC': ${d.preferredLayout}`);at(e,"preferredLayout",d.preferredLayout,r)}}break;case"wasm":case"cpu":continue;default:throw new Error(`not supported execution provider: ${n}`)}let o=De(n,r),u=s.length,l=0,p=0;if(u>0){l=le()._malloc(u*le().PTR_SIZE),r.push(l),p=le()._malloc(u*le().PTR_SIZE),r.push(p);for(let d=0;d<u;d++)le().setValue(l+d*le().PTR_SIZE,s[d][0],"*"),le().setValue(p+d*le().PTR_SIZE,s[d][1],"*")}await le()._OrtAppendExecutionProvider(e,o,l,p,u)!==0&&re(`Can't append execution provider: ${n}.`)}},ji=async e=>{let t=le(),r=0,i=[],a=e||{};Gi(a);try{let n=Fi(a.graphOptimizationLevel??"all"),s=Vi(a.executionMode??"sequential"),o=typeof a.logId=="string"?De(a.logId,i):0,u=a.logSeverityLevel??2;if(!Number.isInteger(u)||u<0||u>4)throw new Error(`log severity level is not valid: ${u}`);let l=a.logVerbosityLevel??0;if(!Number.isInteger(l)||l<0||l>4)throw new Error(`log verbosity level is not valid: ${l}`);let p=typeof a.optimizedModelFilePath=="string"?De(a.optimizedModelFilePath,i):0;if(r=t._OrtCreateSessionOptions(n,!!a.enableCpuMemArena,!!a.enableMemPattern,s,!!a.enableProfiling,0,o,u,l,p),r===0&&re("Can't create session options."),a.executionProviders&&await Wi(r,a,i),a.enableGraphCapture!==void 0){if(typeof a.enableGraphCapture!="boolean")throw new Error(`enableGraphCapture must be a boolean value: ${a.enableGraphCapture}`);at(r,"enableGraphCapture",a.enableGraphCapture.toString(),i)}if(a.freeDimensionOverrides)for(let[d,h]of Object.entries(a.freeDimensionOverrides)){if(typeof d!="string")throw new Error(`free dimension override name must be a string: ${d}`);if(typeof h!="number"||!Number.isInteger(h)||h<0)throw new Error(`free dimension override value must be a non-negative integer: ${h}`);let m=De(d,i);t._OrtAddFreeDimensionOverride(r,m,h)!==0&&re(`Can't set a free dimension override: ${d} - ${h}.`)}return a.extra!==void 0&&Kt(a.extra,"",new WeakSet,(d,h)=>{at(r,d,h,i)}),[r,i]}catch(n){throw r!==0&&t._OrtReleaseSessionOptions(r)!==0&&re("Can't release session options."),i.forEach(s=>t._free(s)),n}}}),ot,ut,lt,Er,kr,Ir,zr,Kr,oe=C(()=>{"use strict";ot=e=>{switch(e){case"int8":return 3;case"uint8":return 2;case"bool":return 9;case"int16":return 5;case"uint16":return 4;case"int32":return 6;case"uint32":return 12;case"float16":return 10;case"float32":return 1;case"float64":return 11;case"string":return 8;case"int64":return 7;case"uint64":return 13;case"int4":return 22;case"uint4":return 21;default:throw new Error(`unsupported data type: ${e}`)}},ut=e=>{switch(e){case 3:return"int8";case 2:return"uint8";case 9:return"bool";case 5:return"int16";case 4:return"uint16";case 6:return"int32";case 12:return"uint32";case 10:return"float16";case 1:return"float32";case 11:return"float64";case 8:return"string";case 7:return"int64";case 13:return"uint64";case 22:return"int4";case 21:return"uint4";default:throw new Error(`unsupported data type: ${e}`)}},lt=(e,t)=>{let r=[-1,4,1,1,2,2,4,8,-1,1,2,8,4,8,-1,-1,-1,-1,-1,-1,-1,.5,.5][e],i=typeof t=="number"?t:t.reduce((a,n)=>a*n,1);return r>0?Math.ceil(i*r):void 0},Er=e=>{switch(e){case"float16":return typeof Float16Array<"u"?Float16Array:Uint16Array;case"float32":return Float32Array;case"uint8":return Uint8Array;case"int8":return Int8Array;case"uint16":return Uint16Array;case"int16":return Int16Array;case"int32":return Int32Array;case"bool":return Uint8Array;case"float64":return Float64Array;case"uint32":return Uint32Array;case"int64":return BigInt64Array;case"uint64":return BigUint64Array;default:throw new Error(`unsupported type: ${e}`)}},kr=e=>{switch(e){case"verbose":return 0;case"info":return 1;case"warning":return 2;case"error":return 3;case"fatal":return 4;default:throw new Error(`unsupported logging level: ${e}`)}},Ir=e=>e==="float32"||e==="float16"||e==="int32"||e==="int64"||e==="uint32"||e==="uint8"||e==="bool"||e==="uint4"||e==="int4",zr=e=>e==="float32"||e==="float16"||e==="int32"||e==="int64"||e==="uint32"||e==="uint64"||e==="int8"||e==="uint8"||e==="bool"||e==="uint4"||e==="int4",Kr=e=>{switch(e){case"none":return 0;case"cpu":return 1;case"cpu-pinned":return 2;case"texture":return 3;case"gpu-buffer":return 4;case"ml-tensor":return 5;default:throw new Error(`unsupported data location: ${e}`)}}}),Cr,Hi=C(()=>{"use strict";fr(),Cr=async e=>{if(typeof e=="string"){let t=await fetch(e);if(!t.ok)throw new Error(`failed to load external data file: ${e}`);let r=t.headers.get("Content-Length"),i=r?parseInt(r,10):0;if(i<1073741824)return new Uint8Array(await t.arrayBuffer());{if(!t.body)throw new Error(`failed to load external data file: ${e}, no response body.`);let a=t.body.getReader(),n;try{n=new ArrayBuffer(i)}catch(o){if(o instanceof RangeError){let u=Math.ceil(i/65536);n=new WebAssembly.Memory({initial:u,maximum:u}).buffer}else throw o}let s=0;for(;;){let{done:o,value:u}=await a.read();if(o)break;let l=u.byteLength;new Uint8Array(n,s,l).set(u),s+=l}return new Uint8Array(n,0,i)}}else return e instanceof Blob?new Uint8Array(await e.arrayBuffer()):e instanceof Uint8Array?e:new Uint8Array(e)}}),Ki,Zr,Qr,Ut,Xr,Yr,$e,ht=C(()=>{"use strict";oe(),Ki=["V","I","W","E","F"],Zr=(e,t)=>{console.log(`[${Ki[e]},${new Date().toISOString()}]${t}`)},Xr=(e,t)=>{Qr=e,Ut=t},Yr=(e,t)=>{let r=kr(e),i=kr(Qr);r>=i&&Zr(r,typeof t=="function"?t():t)},$e=(...e)=>{Ut&&Yr(...e)}}),Jr,Nt,M,Jt,ei,Zi,Et,ie=C(()=>{"use strict";Jr=class{static calcMatMulShape(e,t){return e[1]!==t[0]?void 0:[e[0],t[1]]}},Nt=class{static calcShape(e,t,r=!1){let i=e.length,a=t.length;if(i===0)return t;if(a===0)return e;let n=Math.max(e.length,t.length),s=new Array(n);if(r){if(i<2||a<2)return;let o=Jr.calcMatMulShape([e[i-2],e[i-1]],[t[a-2],t[a-1]]);if(o===void 0)return;[s[n-2],s[n-1]]=o}for(let o=r?3:1;o<=n;o++){let u=i-o<0?1:e[i-o],l=a-o<0?1:t[a-o];if(u!==l&&u>1&&l>1)return;let p=Math.max(u,l);if(u&&l)s[n-o]=Math.max(u,l);else{if(p>1)return;s[n-o]=0}}return s}static isValidBroadcast(e,t){let r=e.length,i=t.length;if(r>i)return!1;for(let a=1;a<=r;a++)if(e[r-a]!==1&&e[r-a]!==t[i-a])return!1;return!0}},M=class Wa{static size(t){return Wa.getSizeFromDimensionRange(t,0,t.length)}static convertShape(t,r=4){let i=t.length;if(i===0)return[];let a=new Array(i),n=i-1;for(;n>=0;){if(t[n]%r===0){a[n]=t[n]/r;break}if(r%t[n]!==0)throw new Error("cannot convert shape");a[n]=1,r/=t[n],n--}for(n--;n>=0;n--)a[n]=t[n];return a}static sizeFromDimension(t,r){if(r<0||r>t.length)throw new Error(`invalid dimension of ${r} for sizeFromDimension as Tensor has ${t.length} dimensions.`);return Wa.getSizeFromDimensionRange(t,r,t.length)}static sizeToDimension(t,r){if(r<0||r>t.length)throw new Error(`invalid dimension of ${r} for sizeToDimension as Tensor has ${t.length} dimensions.`);return Wa.getSizeFromDimensionRange(t,0,r)}static getSizeFromDimensionRange(t,r,i){let a=1;for(let n=r;n<i;n++){if(t[n]<0)throw new Error("cannot get valid size from specified dimension range. Most likely the range contains negative values in them.");a*=Number(t[n])}return a}static computeStrides(t){let r=t.length;if(r===0)return[];if(r===1)return[1];let i=new Array(r);i[r-1]=1,i[r-2]=t[r-1];for(let a=r-3;a>=0;--a)i[a]=i[a+1]*t[a+1];return i}static normalizeAxis(t,r){if(t<-r&&t>=r)throw new Error("unsupported axis for this operation.");return t<0?t+r:t}static normalizeAxes(t,r){return t.map(i=>this.normalizeAxis(i,r??t.length))}static sortBasedOnPerm(t,r){return r?r.map(i=>t[i]):t.slice().reverse()}static padShape(t,r){let i=t.length;return t.map((a,n)=>a+r[n]+r[n+i])}static areEqual(t,r){return t.length!==r.length?!1:t.every((i,a)=>i===r[a])}},Jt=class or{static adjustPoolAttributes(t,r,i,a,n,s){if(!t&&i.length!==r.length-2)throw new Error("length of specified kernel shapes should be 2 less than length of input dimensions");if(t)for(let o=0;o<r.length-2;o++)o>=i.length?i.push(r[o+2]):i[o]=r[o+2];for(let o=0;o<i.length;o++)if(o<a.length){if(a[o]<0)throw new Error("strides should be greater than or equal to 1")}else a.push(1);for(let o=0;o<i.length;o++)if(o<n.length){if(n[o]<0)throw new Error("dilations should be greater than or equal to 1")}else n.push(1);for(let o=0;o<i.length*2;o++)if(o<s.length){if(s[o]<0)throw new Error("pad should be greater than or equal to 1")}else s.push(0);for(let o=0;o<i.length;o++){if(i[o]<=0)throw new Error("kernel shapes need to be greater than 0");if(s[o]>=i[o]||s[o+i.length]>=i[o])throw new Error("pads should be smaller than kernel")}}static adjustPadsBasedOnAutoPad(t,r,i,a,n,s,o){if(o){if(n.length!==2*(t.length-2))throw new Error("length of pads should be twice the length of data dimensions");if(r.length!==t.length-2)throw new Error("length of strides should be the length of data dimensions");if(a.length!==t.length-2)throw new Error("length of kernel shapes should be the length of data dimensions");for(let u=0;u<t.length-2;u++)or.adjustPadAndReturnShape(t[u+(s?1:2)],r[u],i[u],a[u],n,u,u+t.length-2,o)}}static computePoolOutputShape(t,r,i,a,n,s,o,u=0){if(r.length<=0)throw new Error("input shape must be of size greater than 0");let l=[r[0],r[1]];return or.computeShapeHelper(t,r,l,i,a,n,s,o,u),l}static computeConvOutputShape(t,r,i,a,n,s,o){if(t.length<=0||r.length<=0)throw new Error("invalid input tensor dims or invalid filter tensor dims");let u=[t[0],r[0]];return or.computeShapeHelper(!1,t,u,i,a,n,s,o),u}static computeShapeHelper(t,r,i,a,n,s,o,u,l=0){if(t)for(let p=0;p<r.length-2;p++)i.push(1);else for(let p=0;p<r.length-2;p++)i.push(or.adjustPadAndReturnShape(r[p+2],a[p],n[p],s[p],o,p,p+r.length-2,u,l))}static computeOutputSize(t,r,i,a,n){let s=Math.floor(t/r)+1;return n===1&&(s=Math.ceil(t/r)+1,(s-1)*r>=i+a&&(s-=1)),s}static adjustPadAndReturnShape(t,r,i,a,n,s,o,u,l=0){let p=i*(a-1)+1;if(u&&u!=="NOTSET")switch(u){case"VALID":return n[s]=0,n[o]=0,or.computeOutputSize(t-p,r,t,0,l);case"SAME_LOWER":case"SAME_UPPER":if(i!==1)throw new Error("Dilation not supported for SAME_UPPER or SAME_LOWER");{let d=(Math.floor((t+r-1)/r)-1)*r+a-t;return n[s]=Math.floor(u==="SAME_LOWER"?(d+1)/2:d/2),n[o]=d-n[s],or.computeOutputSize(t+n[s]+n[o]-p,r,t,n[s],l)}default:throw new Error("Unsupported AutoPad type")}else return or.computeOutputSize(t+n[s]+n[o]-p,r,t,n[s],l)}},ei=class{static getShapeOfGemmResult(e,t,r,i,a){if(e.length!==2||r.length!==2)throw new Error("shape need to be of size 2");let n,s,o;t?(n=e[1],s=e[0]):(n=e[0],s=e[1]);let u=-1;if(i?(o=r[0],u=1):(o=r[1],u=0),r[u]!==s)throw new Error("dimension mismatch");if(n<=0||o<=0||s<=0)throw new Error("invalid shape specified");if(a&&!Nt.isValidBroadcast(a,[n,o]))throw new Error("gemm: invalid bias shape for broadcast");return[n,o,s]}},Zi=-34028234663852886e22,Et=34028234663852886e22}),Lt,er=C(()=>{"use strict";oe(),Lt=(e,t)=>new(Er(t))(e)}),Zt,Ar,Or,Rr,kt,qt,ti,ri,ii,Qi,Xi,ba=C(()=>{"use strict";oe(),ht(),Zt=new Map([["float32",32],["float16",16],["int32",32],["uint32",32],["int64",64],["uint64",64],["int8",8],["uint8",8],["int4",4],["uint4",4]]),Ar=(e,t)=>{if(t==="int32")return e;let r=Zt.get(t);if(!r)throw new Error(`WebNN backend does not support data type: ${t}`);let i=r/8;if(e.byteLength%i!==0)throw new Error(`Invalid Uint8Array length - must be a multiple of ${i}.`);let a=e.byteLength/i,n=new(Er(t))(e.buffer,e.byteOffset,a);switch(t){case"int64":case"uint64":{let s=new Int32Array(a);for(let o=0;o<a;o++){let u=n[o];if(u>2147483647n||u<-2147483648n)throw new Error("Can not convert int64 data to int32 - value out of range.");s[o]=Number(u)}return new Uint8Array(s.buffer)}case"int8":case"uint8":case"uint32":{if(t==="uint32"&&n.some(o=>o>2147483647))throw new Error("Can not convert uint32 data to int32 - value out of range.");let s=Int32Array.from(n,Number);return new Uint8Array(s.buffer)}default:throw new Error(`Unsupported data conversion from ${t} to 'int32'`)}},Or=(e,t)=>{if(t==="int32")return e;if(e.byteLength%4!==0)throw new Error("Invalid Uint8Array length - must be a multiple of 4 (int32).");let r=e.byteLength/4,i=new Int32Array(e.buffer,e.byteOffset,r);switch(t){case"int64":{let a=BigInt64Array.from(i,BigInt);return new Uint8Array(a.buffer)}case"uint64":{if(i.some(n=>n<0))throw new Error("Can not convert int32 data to uin64 - negative value found.");let a=BigUint64Array.from(i,BigInt);return new Uint8Array(a.buffer)}case"int8":{if(i.some(n=>n<-128||n>127))throw new Error("Can not convert int32 data to int8 - value out of range.");let a=Int8Array.from(i,Number);return new Uint8Array(a.buffer)}case"uint8":{if(i.some(a=>a<0||a>255))throw new Error("Can not convert int32 data to uint8 - value out of range.");return Uint8Array.from(i,Number)}case"uint32":{if(i.some(n=>n<0))throw new Error("Can not convert int32 data to uint32 - negative value found.");let a=Uint32Array.from(i,Number);return new Uint8Array(a.buffer)}default:throw new Error(`Unsupported data conversion from 'int32' to ${t}`)}},Rr=1,kt=()=>Rr++,qt=new Map([["int8","int32"],["uint8","int32"],["uint32","int32"],["int64","int32"]]),ti=(e,t)=>{let r=Zt.get(e);if(!r)throw new Error(`WebNN backend does not support data type: ${e}`);return t.length>0?Math.ceil(t.reduce((i,a)=>i*a)*r/8):0},ri=class{constructor(e){this.isDataConverted=!1;let{sessionId:t,context:r,tensor:i,dataType:a,shape:n,fallbackDataType:s}=e;this.sessionId=t,this.mlContext=r,this.mlTensor=i,this.dataType=a,this.tensorShape=n,this.fallbackDataType=s}get tensor(){return this.mlTensor}get type(){return this.dataType}get fallbackType(){return this.fallbackDataType}get shape(){return this.tensorShape}get byteLength(){return ti(this.dataType,this.tensorShape)}destroy(){$e("verbose",()=>"[WebNN] TensorWrapper.destroy"),this.mlTensor.destroy()}write(e){this.mlContext.writeTensor(this.mlTensor,e)}async read(e){if(this.fallbackDataType){let t=await this.mlContext.readTensor(this.mlTensor),r=Or(new Uint8Array(t),this.dataType);if(e){(e instanceof ArrayBuffer?new Uint8Array(e):new Uint8Array(e.buffer,e.byteOffset,e.byteLength)).set(r);return}else return new Uint8Array(r).buffer}else return e?this.mlContext.readTensor(this.mlTensor,e):this.mlContext.readTensor(this.mlTensor)}canReuseTensor(e,t,r){return this.mlContext===e&&this.dataType===t&&this.tensorShape.length===r.length&&this.tensorShape.every((i,a)=>i===r[a])}setIsDataConverted(e){this.isDataConverted=e}},ii=class{constructor(e,t){this.tensorManager=e,this.wrapper=t}get tensorWrapper(){return this.wrapper}releaseTensor(){this.tensorWrapper&&(this.tensorManager.releaseTensor(this.tensorWrapper),this.wrapper=void 0)}async ensureTensor(e,t,r,i){let a=this.tensorManager.getMLContext(e),n=this.tensorManager.getMLOpSupportLimits(e),s;if(!n?.input.dataTypes.includes(t)){if(s=qt.get(t),!s||!n?.input.dataTypes.includes(s))throw new Error(`WebNN backend does not support data type: ${t}`);$e("verbose",()=>`[WebNN] TensorIdTracker.ensureTensor: fallback dataType from ${t} to ${s}`)}if(this.wrapper){if(this.wrapper.canReuseTensor(a,t,r))return this.wrapper.tensor;if(i){if(this.wrapper.byteLength!==ti(t,r))throw new Error("Unable to copy data to tensor with different size.");this.activeUpload=new Uint8Array(await this.wrapper.read())}this.tensorManager.releaseTensor(this.wrapper)}let o=typeof MLTensorUsage>"u"?void 0:MLTensorUsage.READ|MLTensorUsage.WRITE;return this.wrapper=await this.tensorManager.getCachedTensor(e,t,r,o,!0,!0,s),i&&this.activeUpload&&(this.wrapper.write(this.activeUpload),this.activeUpload=void 0),this.wrapper.tensor}upload(e){let t=e;if(this.wrapper){if(this.wrapper.fallbackType)if(this.wrapper.fallbackType==="int32")t=Ar(e,this.wrapper.type),this.wrapper.setIsDataConverted(!0);else throw new Error(`Unsupported fallback data type: ${this.wrapper.fallbackType}`);if(e.byteLength===this.wrapper.byteLength){this.wrapper.write(t);return}else $e("verbose",()=>"Data size does not match tensor size. Releasing tensor."),this.releaseTensor()}this.activeUpload?this.activeUpload.set(t):this.activeUpload=new Uint8Array(t)}async download(e){if(this.activeUpload){let t=this.wrapper?.isDataConverted?Or(this.activeUpload,this.wrapper?.type):this.activeUpload;if(e){e instanceof ArrayBuffer?new Uint8Array(e).set(t):new Uint8Array(e.buffer,e.byteOffset,e.byteLength).set(t);return}else return t.buffer}if(!this.wrapper)throw new Error("Tensor has not been created.");return e?this.wrapper.read(e):this.wrapper.read()}},Qi=class{constructor(e){this.backend=e,this.tensorTrackersById=new Map,this.freeTensors=[],this.externalTensors=new Set}getMLContext(e){let t=this.backend.getMLContext(e);if(!t)throw new Error("MLContext not found for session.");return t}getMLOpSupportLimits(e){return this.backend.getMLOpSupportLimits(e)}reserveTensorId(){let e=kt();return this.tensorTrackersById.set(e,new ii(this)),e}releaseTensorId(e){let t=this.tensorTrackersById.get(e);t&&(this.tensorTrackersById.delete(e),t.tensorWrapper&&this.releaseTensor(t.tensorWrapper))}async ensureTensor(e,t,r,i,a){$e("verbose",()=>`[WebNN] TensorManager.ensureTensor {tensorId: ${t}, dataType: ${r}, shape: ${i}, copyOld: ${a}}`);let n=this.tensorTrackersById.get(t);if(!n)throw new Error("Tensor not found.");return n.ensureTensor(e,r,i,a)}upload(e,t){let r=this.tensorTrackersById.get(e);if(!r)throw new Error("Tensor not found.");r.upload(t)}async download(e,t){$e("verbose",()=>`[WebNN] TensorManager.download {tensorId: ${e}, dstBuffer: ${t?.byteLength}}`);let r=this.tensorTrackersById.get(e);if(!r)throw new Error("Tensor not found.");return r.download(t)}releaseTensorsForSession(e){for(let t of this.freeTensors)t.sessionId===e&&t.destroy();this.freeTensors=this.freeTensors.filter(t=>t.sessionId!==e)}registerTensor(e,t,r,i){let a=this.getMLContext(e),n=kt(),s=new ri({sessionId:e,context:a,tensor:t,dataType:r,shape:i});return this.tensorTrackersById.set(n,new ii(this,s)),this.externalTensors.add(s),n}async getCachedTensor(e,t,r,i,a,n,s){let o=this.getMLContext(e);for(let[l,p]of this.freeTensors.entries())if(p.canReuseTensor(o,t,r)){$e("verbose",()=>`[WebNN] Reusing tensor {dataType: ${t}, ${s?`fallbackDataType: ${s},`:""} shape: ${r}`);let d=this.freeTensors.splice(l,1)[0];return d.sessionId=e,d}$e("verbose",()=>`[WebNN] MLContext.createTensor {dataType: ${t}, ${s?`fallbackDataType: ${s},`:""} shape: ${r}}`);let u=await o.createTensor({dataType:s??t,shape:r,dimensions:r,usage:i,writable:a,readable:n});return new ri({sessionId:e,context:o,tensor:u,dataType:t,shape:r,fallbackDataType:s})}releaseTensor(e){this.externalTensors.has(e)&&this.externalTensors.delete(e),this.freeTensors.push(e)}},Xi=(...e)=>new Qi(...e)}),tr,Yi,Ji,ea=C(()=>{"use strict";oe(),st(),er(),ba(),ht(),tr=new Map([[1,"float32"],[10,"float16"],[6,"int32"],[12,"uint32"],[7,"int64"],[13,"uint64"],[22,"int4"],[21,"uint4"],[3,"int8"],[2,"uint8"],[9,"uint8"]]),Yi=(e,t)=>{if(e===t)return!0;if(e===void 0||t===void 0)return!1;let r=Object.keys(e).sort(),i=Object.keys(t).sort();return r.length===i.length&&r.every((a,n)=>a===i[n]&&e[a]===t[a])},Ji=class{constructor(e){this.tensorManager=Xi(this),this.mlContextBySessionId=new Map,this.sessionIdsByMLContext=new Map,this.mlContextCache=[],this.sessionGraphInputs=new Map,this.sessionGraphOutputs=new Map,this.temporaryGraphInputs=[],this.temporaryGraphOutputs=[],this.temporarySessionTensorIds=new Map,this.mlOpSupportLimitsBySessionId=new Map,Xr(e.logLevel,!!e.debug)}get currentSessionId(){if(this.activeSessionId===void 0)throw new Error("No active session");return this.activeSessionId}onRunStart(e){$e("verbose",()=>`[WebNN] onRunStart {sessionId: ${e}}`),this.activeSessionId=e}onRunEnd(e){$e("verbose",()=>`[WebNN] onRunEnd {sessionId: ${e}}`);let t=this.temporarySessionTensorIds.get(e);if(t){for(let r of t)$e("verbose",()=>`[WebNN] releasing temporary tensor {tensorId: ${r}}`),this.tensorManager.releaseTensorId(r);this.temporarySessionTensorIds.delete(e),this.activeSessionId=void 0}}async createMLContext(e){if(e instanceof GPUDevice){let r=this.mlContextCache.findIndex(i=>i.gpuDevice===e);if(r!==-1)return this.mlContextCache[r].mlContext;{let i=await navigator.ml.createContext(e);return this.mlContextCache.push({gpuDevice:e,mlContext:i}),i}}else if(e===void 0){let r=this.mlContextCache.findIndex(i=>i.options===void 0&&i.gpuDevice===void 0);if(r!==-1)return this.mlContextCache[r].mlContext;{let i=await navigator.ml.createContext();return this.mlContextCache.push({mlContext:i}),i}}let t=this.mlContextCache.findIndex(r=>Yi(r.options,e));if(t!==-1)return this.mlContextCache[t].mlContext;{let r=await navigator.ml.createContext(e);return this.mlContextCache.push({options:e,mlContext:r}),r}}registerMLContext(e,t){this.mlContextBySessionId.set(e,t);let r=this.sessionIdsByMLContext.get(t);r||(r=new Set,this.sessionIdsByMLContext.set(t,r)),r.add(e),this.mlOpSupportLimitsBySessionId.has(e)||this.mlOpSupportLimitsBySessionId.set(e,t.opSupportLimits()),this.temporaryGraphInputs.length>0&&(this.sessionGraphInputs.set(e,this.temporaryGraphInputs),this.temporaryGraphInputs=[]),this.temporaryGraphOutputs.length>0&&(this.sessionGraphOutputs.set(e,this.temporaryGraphOutputs),this.temporaryGraphOutputs=[])}onReleaseSession(e){this.sessionGraphInputs.delete(e),this.sessionGraphOutputs.delete(e);let t=this.mlContextBySessionId.get(e);if(!t)return;this.tensorManager.releaseTensorsForSession(e),this.mlContextBySessionId.delete(e),this.mlOpSupportLimitsBySessionId.delete(e);let r=this.sessionIdsByMLContext.get(t);if(r.delete(e),r.size===0){this.sessionIdsByMLContext.delete(t);let i=this.mlContextCache.findIndex(a=>a.mlContext===t);i!==-1&&this.mlContextCache.splice(i,1)}}getMLContext(e){return this.mlContextBySessionId.get(e)}getMLOpSupportLimits(e){return this.mlOpSupportLimitsBySessionId.get(e)}reserveTensorId(){return this.tensorManager.reserveTensorId()}releaseTensorId(e){$e("verbose",()=>`[WebNN] releaseTensorId {tensorId: ${e}}`),this.tensorManager.releaseTensorId(e)}async ensureTensor(e,t,r,i,a){let n=tr.get(r);if(!n)throw new Error(`Unsupported ONNX data type: ${r}`);return this.tensorManager.ensureTensor(e??this.currentSessionId,t,n,i,a)}async createTemporaryTensor(e,t,r){$e("verbose",()=>`[WebNN] createTemporaryTensor {onnxDataType: ${t}, shape: ${r}}`);let i=tr.get(t);if(!i)throw new Error(`Unsupported ONNX data type: ${t}`);let a=this.tensorManager.reserveTensorId();await this.tensorManager.ensureTensor(e,a,i,r,!1);let n=this.temporarySessionTensorIds.get(e);return n?n.push(a):this.temporarySessionTensorIds.set(e,[a]),a}uploadTensor(e,t){if(!le().shouldTransferToMLTensor)throw new Error("Trying to upload to a MLTensor while shouldTransferToMLTensor is false");$e("verbose",()=>`[WebNN] uploadTensor {tensorId: ${e}, data: ${t.byteLength}}`),this.tensorManager.upload(e,t)}async downloadTensor(e,t){return this.tensorManager.download(e,t)}createMLTensorDownloader(e,t){return async()=>{let r=await this.tensorManager.download(e);return Lt(r,t)}}registerMLTensor(e,t,r,i){let a=tr.get(r);if(!a)throw new Error(`Unsupported ONNX data type: ${r}`);let n=this.tensorManager.registerTensor(e,t,a,i);return $e("verbose",()=>`[WebNN] registerMLTensor {tensor: ${t}, dataType: ${a}, dimensions: ${i}} -> {tensorId: ${n}}`),n}registerGraphInput(e){this.temporaryGraphInputs.push(e)}registerGraphOutput(e){this.temporaryGraphOutputs.push(e)}isGraphInput(e,t){let r=this.sessionGraphInputs.get(e);return r?r.includes(t):!1}isGraphOutput(e,t){let r=this.sessionGraphOutputs.get(e);return r?r.includes(t):!1}isGraphInputOutputTypeSupported(e,t,r=!0){let i=tr.get(ot(t)),a=this.mlOpSupportLimitsBySessionId.get(e);return typeof i>"u"?!1:r?!!a?.input.dataTypes.includes(i):!!a?.output.dataTypes.includes(i)}flush(){}}}),ai=C(()=>{"use strict"}),ni,si,Br,oi,ui,li,ta,ra,va,cn=C(()=>{"use strict";ht(),ai(),ni=new Map([[64,250],[128,200],[256,200],[512,200],[2048,230],[4096,200],[8192,50],[16384,50],[32768,50],[65536,50],[131072,50],[262144,50],[524288,50],[1048576,50],[2097152,30],[4194304,20],[8388608,10],[12582912,10],[16777216,10],[26214400,15],[33554432,22],[44236800,2],[58982400,6],[67108864,6],[134217728,6],[167772160,6]]),si=[],Br=e=>Math.ceil(Number(e)/16)*16,oi=e=>{for(let t=0;t<si.length;t++){let r=si[t];if(e<=r)return r}return Math.ceil(e/16)*16},ui=1,li=()=>ui++,ta=async(e,t,r,i)=>{let a=Br(r),n=e.device.createBuffer({size:a,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});try{let s=e.getCommandEncoder();e.endComputePass(),s.copyBufferToBuffer(t,0,n,0,a),e.flush(),await n.mapAsync(GPUMapMode.READ);let o=n.getMappedRange();if(i){let u=i();return u.set(new Uint8Array(o,0,r)),u}else return new Uint8Array(o.slice(0,r))}finally{n.destroy()}},ra=class{constructor(e){this.backend=e,this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.buffersPending=[],this.capturedPendingBuffers=new Map;for(let[t]of ni)si.push(t),this.freeBuffers.set(t,[]),this.freeUniformBuffers.set(t,[]);this.sessionCount=0}upload(e,t){let r=t.buffer,i=t.byteOffset,a=t.byteLength,n=Br(a),s=this.storageCache.get(e);if(!s)throw new Error("gpu data for uploading does not exist");if(Number(s.originalSize)!==a)throw new Error(`inconsistent data size. gpu data size=${s.originalSize}, data size=${a}`);if(n===a&&i%4===0)this.backend.device.queue.writeBuffer(s.gpuData.buffer,0,r,i,a);else{let o=new Uint8Array(n);o.set(t),this.backend.device.queue.writeBuffer(s.gpuData.buffer,0,o,0,n)}$e("verbose",()=>`[WebGPU] GpuDataManager.upload(id=${e})`)}memcpy(e,t){let r=this.storageCache.get(e);if(!r)throw new Error("source gpu data for memcpy does not exist");let i=this.storageCache.get(t);if(!i)throw new Error("destination gpu data for memcpy does not exist");if(r.originalSize!==i.originalSize)throw new Error("inconsistent source and destination gpu data size");let a=Br(r.originalSize),n=this.backend.getCommandEncoder();this.backend.endComputePass(),n.copyBufferToBuffer(r.gpuData.buffer,0,i.gpuData.buffer,0,a)}registerExternalBuffer(e,t,r){let i;if(r){if(i=r[0],e===r[1])return $e("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${t}) => id=${i}, buffer is the same, skip.`),i;if(this.backend.capturedCommandList.has(this.backend.currentSessionId))throw new Error(`Registering a different external buffer under graph capture mode is not supported yet.
             Please use the previous external buffer!`)}else i=li();return this.storageCache.set(i,{gpuData:{id:i,type:0,buffer:e},originalSize:t}),$e("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${t}) => id=${i}, registered.`),i}unregisterExternalBuffer(e){e!==void 0&&(this.storageCache.delete(e),$e("verbose",()=>`[WebGPU] GpuDataManager.unregisterExternalBuffer() => id=${e}`))}create(e,t=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST){let r=oi(e),i,a=(t&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE,n=(t&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM;if(a||n){let o=(a?this.freeBuffers:this.freeUniformBuffers).get(r);o?o.length>0?i=o.pop():i=this.backend.device.createBuffer({size:r,usage:t}):i=this.backend.device.createBuffer({size:r,usage:t})}else i=this.backend.device.createBuffer({size:r,usage:t});let s={id:li(),type:0,buffer:i};return this.storageCache.set(s.id,{gpuData:s,originalSize:Number(e)}),$e("verbose",()=>`[WebGPU] GpuDataManager.create(size=${e}) => id=${s.id}`),s}get(e){return this.storageCache.get(e)?.gpuData}release(e){let t=typeof e=="bigint"?Number(e):e,r=this.storageCache.get(t);if(!r){if(this.storageCache.size===0)return 0;throw new Error("releasing data does not exist")}return $e("verbose",()=>`[WebGPU] GpuDataManager.release(id=${t}), gpuDataId=${r.gpuData.id}`),this.storageCache.delete(t),this.buffersPending.push(r.gpuData.buffer),r.originalSize}async download(e,t){let r=this.storageCache.get(Number(e));if(!r)throw new Error("data does not exist");await ta(this.backend,r.gpuData.buffer,r.originalSize,t)}refreshPendingBuffers(){if(this.buffersPending.length!==0)if(this.backend.sessionStatus==="default"){for(let e of this.buffersPending){let t=ni.get(e.size);if((e.usage&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE){let r=this.freeBuffers.get(e.size)||[];t===void 0||r.length>=t?e.destroy():r.push(e)}else if((e.usage&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM){let r=this.freeUniformBuffers.get(e.size)||[];t===void 0||r.length>=t?e.destroy():r.push(e)}else e.destroy()}this.buffersPending=[]}else{let e=this.capturedPendingBuffers.get(this.backend.currentSessionId);e||(e=[],this.capturedPendingBuffers.set(this.backend.currentSessionId,e));for(let t of this.buffersPending)e.push(t);this.buffersPending=[]}}dispose(){this.freeBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.freeUniformBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.storageCache.forEach(e=>{e.gpuData.buffer.destroy()}),this.capturedPendingBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.capturedPendingBuffers=new Map}onCreateSession(){this.sessionCount+=1}onReleaseSession(e){let t=this.capturedPendingBuffers.get(e);t&&(t.forEach(r=>{r.destroy()}),this.capturedPendingBuffers.delete(e)),this.sessionCount-=1,this.sessionCount===0&&($e("warning",()=>"[WebGPU] Clearing webgpu buffer cache"),this.storageCache.forEach(r=>{r.gpuData.buffer.destroy()}),this.storageCache=new Map)}},va=(...e)=>new ra(...e)}),c,g,$=C(()=>{"use strict";c=class{constructor(e){Object.assign(this,e)}get cacheKey(){return this.key||(this.key=Object.getOwnPropertyNames(this).sort().map(e=>`${this[e]}`).join(";")),this.key}},g=e=>new c(e)}),E,T,B,z,k,R,F,G,L,D,J,A,j,Ce,ce,me,be,K=C(()=>{"use strict";oe(),ie(),E=64,T=(e,t)=>{if(t===3)throw new Error("vec3 has same alignment as vec4, use vec4 instead");switch(Number(e)){case 10:return t>1?`vec${t}<f16>`:"f16";case 1:return t>1?`vec${t}<f32>`:"f32";case 6:return t>1?`vec${t}<i32>`:"i32";case 12:return t>1?`vec${t}<u32>`:"u32";case 7:if(t>1)throw new Error("currently not supported vecX of uint64 yet");return["vec2<u32>","i32"];case 13:if(t>1)throw new Error("currently not supported vecX of uint64 yet");return["vec2<u32>","u32"];case 9:if(t!==4)throw new Error("bool must be vec4");return["u32","vec4<bool>"];case 22:return"i32";case 21:return"u32";default:throw new Error(`Unknown data type: ${e}`)}},B=(e,t=1)=>{let r=T(e,t);return typeof r=="string"?r:r[0]},z=(e,t=1)=>{let r=T(e,t);return typeof r=="string"?r:r[1]},k=(...e)=>{let t=[];return e.forEach(r=>{r.length!==0&&t.push({type:12,data:r},{type:12,data:M.computeStrides(r)})}),t},R=e=>e%4===0?4:e%2===0?2:1,F=(e="f32",t,r="0")=>!t||t===1?`${e}(${r})`:`vec${t}<${e}>(${r})`,G=(e,t,r)=>e==="f32"?r:t===1?`f32(${r})`:`vec${t}<f32>(${r})`,L=(e,t)=>t===4?`(${e}.x + ${e}.y + ${e}.z + ${e}.w)`:t===2?`(${e}.x + ${e}.y)`:t===3?`(${e}.x + ${e}.y + ${e}.z)`:e,D=(e,t,r,i)=>e.startsWith("uniforms.")&&r>4?typeof t=="string"?i==="f16"?`${e}[(${t}) / 8][(${t}) % 8 / 4][(${t}) % 8 % 4]`:`${e}[(${t}) / 4][(${t}) % 4]`:i==="f16"?`${e}[${Math.floor(t/8)}][${Math.floor(t%8/4)}][${t%8%4}]`:`${e}[${Math.floor(t/4)}][${t%4}]`:r>1?`${e}[${t}]`:e,J=(e,t,r,i,a)=>{let n=typeof r=="number",s=n?r:r.length,o=[...new Array(s).keys()],u=s<2?"u32":s<=4?`vec${s}<u32>`:`array<u32, ${s}>`,l=T(t,a),p=typeof l=="string"?l:l[1],d=typeof l=="string"?l:l[0],h={indices:u,value:p,storage:d,tensor:t},m=W=>typeof W=="string"?W:`${W}u`,f={offsetToIndices:!1,indicesToOffset:!1,broadcastedIndicesToOffset:!1,set:!1,setByIndices:!1,get:!1,getByIndices:!1},_=n?"uniforms.":"",b=`${_}${e}_shape`,w=`${_}${e}_strides`,y="";for(let W=0;W<s-1;W++)y+=`
    let dim${W} = current / ${D(w,W,s)};
    let rest${W} = current % ${D(w,W,s)};
    indices[${W}] = dim${W};
    current = rest${W};
    `;y+=`indices[${s-1}] = current;`;let x=s<2?"":`
  fn o2i_${e}(offset: u32) -> ${h.indices} {
    var indices: ${h.indices};
    var current = offset;
    ${y}
    return indices;
  }`,v=W=>(f.offsetToIndices=!0,s<2?W:`o2i_${e}(${W})`),S=[];if(s>=2)for(let W=s-1;W>=0;W--)S.push(`${D(w,W,s)} * (indices[${W}])`);let I=s<2?"":`
  fn i2o_${e}(indices: ${h.indices}) -> u32 {
    return ${S.join("+")};
  }`,O=W=>(f.indicesToOffset=!0,s<2?W:`i2o_${e}(${W})`),P=(...W)=>s===0?"0u":`${h.indices}(${W.map(m).join(",")})`,V=(W,pe)=>s<2?`${W}`:`${D(W,pe,s)}`,Q=(W,pe,se)=>s<2?`${W}=${se};`:`${D(W,pe,s)}=${se};`,ye={},ae=(W,pe)=>{f.broadcastedIndicesToOffset=!0;let se=`${pe.name}broadcastedIndicesTo${e}Offset`;if(se in ye)return`${se}(${W})`;let Y=[];for(let Qe=s-1;Qe>=0;Qe--){let dt=pe.indicesGet("outputIndices",Qe+pe.rank-s);Y.push(`${V(w,Qe)} * (${dt} % ${V(b,Qe)})`)}return ye[se]=`fn ${se}(outputIndices: ${pe.type.indices}) -> u32 {
             return ${Y.length>0?Y.join("+"):"0u"};
           }`,`${se}(${W})`},ne=(W,pe)=>(()=>{if(h.storage===h.value)return`${e}[${W}]=${pe};`;if(h.storage==="vec2<u32>"&&h.value==="i32")return`${e}[${W}]=vec2<u32>(u32(${pe}), select(0u, 0xFFFFFFFFu, ${pe} < 0));`;if(h.storage==="vec2<u32>"&&h.value==="u32")return`${e}[${W}]=vec2<u32>(u32(${pe}), 0u);`;if(h.storage==="u32"&&h.value==="vec4<bool>")return`${e}[${W}]=dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(${pe}));`;throw new Error(`not supported combination of storage type ${h.storage} and value type ${h.value} yet`)})(),ke=W=>(()=>{if(h.storage===h.value)return`${e}[${W}]`;if(h.storage==="vec2<u32>"&&h.value==="i32")return`i32(${e}[${W}].x)`;if(h.storage==="vec2<u32>"&&h.value==="u32")return`u32(${e}[${W}].x)`;if(h.storage==="u32"&&h.value==="vec4<bool>")return`vec4<bool>(bool(${e}[${W}] & 0xFFu), bool(${e}[${W}] & 0xFF00u), bool(${e}[${W}] & 0xFF0000u), bool(${e}[${W}] & 0xFF000000u))`;throw new Error(`not supported combination of storage type ${h.storage} and value type ${h.value} yet`)})(),X=s<2?"":`
  fn get_${e}ByIndices(indices: ${h.indices}) -> ${p} {
    return ${ke(`i2o_${e}(indices)`)};
  }`,ee=s<2?"":(()=>{let W=o.map(se=>`d${se}: u32`).join(", "),pe=o.map(se=>`d${se}`).join(", ");return`
  fn get_${e}(${W}) -> ${p} {
    return get_${e}ByIndices(${P(pe)});
  }`})(),ge=(...W)=>{if(W.length!==s)throw new Error(`indices length must be ${s}`);let pe=W.map(m).join(",");return s===0?ke("0u"):s===1?ke(pe[0]):(f.get=!0,f.getByIndices=!0,f.indicesToOffset=!0,`get_${e}(${pe})`)},we=W=>s<2?ke(W):(f.getByIndices=!0,f.indicesToOffset=!0,`get_${e}ByIndices(${W})`),he=s<2?"":`
  fn set_${e}ByIndices(indices: ${h.indices}, value: ${p}) {
    ${ne(`i2o_${e}(indices)`,"value")}
  }`,ve=s<2?"":(()=>{let W=o.map(se=>`d${se}: u32`).join(", "),pe=o.map(se=>`d${se}`).join(", ");return`
  fn set_${e}(${W}, value: ${p}) {
    set_${e}ByIndices(${P(pe)}, value);
  }`})();return{impl:()=>{let W=[],pe=!1;return f.offsetToIndices&&(W.push(x),pe=!0),f.indicesToOffset&&(W.push(I),pe=!0),f.broadcastedIndicesToOffset&&(Object.values(ye).forEach(se=>W.push(se)),pe=!0),f.set&&(W.push(ve),pe=!0),f.setByIndices&&(W.push(he),pe=!0),f.get&&(W.push(ee),pe=!0),f.getByIndices&&(W.push(X),pe=!0),!n&&pe&&W.unshift(`const ${b} = ${h.indices}(${r.join(",")});`,`const ${w} = ${h.indices}(${M.computeStrides(r).join(",")});`),W.join(`
`)},type:h,offsetToIndices:v,indicesToOffset:O,broadcastedIndicesToOffset:ae,indices:P,indicesGet:V,indicesSet:Q,set:(...W)=>{if(W.length!==s+1)throw new Error(`indices length must be ${s}`);let pe=W[s];if(typeof pe!="string")throw new Error("value must be string");let se=W.slice(0,s).map(m).join(",");return s===0?ne("0u",pe):s===1?ne(se[0],pe):(f.set=!0,f.setByIndices=!0,f.indicesToOffset=!0,`set_${e}(${se}, ${pe})`)},setByOffset:ne,setByIndices:(W,pe)=>s<2?ne(W,pe):(f.setByIndices=!0,f.indicesToOffset=!0,`set_${e}ByIndices(${W}, ${pe});`),get:ge,getByOffset:ke,getByIndices:we,usage:i,name:e,strides:w,shape:b,rank:s}},A=(e,t,r,i=1)=>J(e,t,r,"input",i),j=(e,t,r,i=1)=>J(e,t,r,"output",i),Ce=(e,t,r)=>J(e,t,r,"atomicOutput",1),ce=(e,t,r,i=1)=>J(e,t,r,"internal",i),me=class{constructor(e,t){this.normalizedDispatchGroup=e,this.limits=t,this.internalVariables=[],this.variables=[],this.uniforms=[],this.variableIndex=0}guardAgainstOutOfBoundsWorkgroupSizes(e){return`if (global_idx >= ${typeof e=="number"?`${e}u`:e}) { return; }`}mainStart(e=E){let t=typeof e=="number"?e:e[0],r=typeof e=="number"?1:e[1],i=typeof e=="number"?1:e[2];if(t>this.limits.maxComputeWorkgroupSizeX||r>this.limits.maxComputeWorkgroupSizeY||i>this.limits.maxComputeWorkgroupSizeZ)throw new Error(`workgroup size [${t}, ${r}, ${i}] exceeds the maximum workgroup size [${this.limits.maxComputeWorkgroupSizeX}, ${this.limits.maxComputeWorkgroupSizeY}, ${this.limits.maxComputeWorkgroupSizeZ}].`);if(t*r*i>this.limits.maxComputeInvocationsPerWorkgroup)throw new Error(`workgroup size [${t}, ${r}, ${i}] exceeds the maximum workgroup invocations ${this.limits.maxComputeInvocationsPerWorkgroup}.`);let a=this.normalizedDispatchGroup[1]===1&&this.normalizedDispatchGroup[2]===1,n=a?`@builtin(global_invocation_id) global_id : vec3<u32>,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(local_invocation_id) local_id : vec3<u32>`:`@builtin(global_invocation_id) global_id : vec3<u32>,
                                             @builtin(local_invocation_id) local_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(num_workgroups) num_workgroups : vec3<u32>`,s=a?`let global_idx = global_id.x;
         let workgroup_index = workgroup_id.x;`:`let workgroup_index = workgroup_id.z * num_workgroups[0] * num_workgroups[1] +
             workgroup_id.y * num_workgroups[0] + workgroup_id.x;
         let global_idx = workgroup_index * ${t*r*i}u + local_idx;`;return`@compute @workgroup_size(${t}, ${r}, ${i})
  fn main(${n}) {
    ${s}
  `}appendVariableUniforms(e){e.rank!==0&&(e.shape.startsWith("uniforms.")&&this.uniforms.push({name:e.shape.replace("uniforms.",""),type:"u32",length:e.rank}),e.strides.startsWith("uniforms.")&&this.uniforms.push({name:e.strides.replace("uniforms.",""),type:"u32",length:e.rank}))}declareVariable(e,t){if(e.usage==="internal")throw new Error("cannot use internal variable with declareVariable(). use registerInternalVariables() instead.");this.variables.push(e),this.appendVariableUniforms(e);let r=e.usage==="input"?"read":"read_write",i=e.usage==="atomicOutput"?"atomic<i32>":e.type.storage;return`@group(0) @binding(${t}) var<storage, ${r}> ${e.name}: array<${i}>;`}declareVariables(...e){return e.map(t=>this.declareVariable(t,this.variableIndex++)).join(`
`)}registerInternalVariable(e){if(e.usage!=="internal")throw new Error("cannot use input or output variable with registerInternalVariable(). use declareVariables() instead.");this.internalVariables.push(e),this.appendVariableUniforms(e)}registerInternalVariables(...e){return e.forEach(t=>this.registerInternalVariable(t)),this}registerUniform(e,t,r=1){return this.uniforms.push({name:e,type:t,length:r}),this}registerUniforms(e){return this.uniforms=this.uniforms.concat(e),this}uniformDeclaration(){if(this.uniforms.length===0)return"";let e=[];for(let{name:t,type:r,length:i}of this.uniforms)if(i&&i>4)r==="f16"?e.push(`@align(16) ${t}:array<mat2x4<${r}>, ${Math.ceil(i/8)}>`):e.push(`${t}:array<vec4<${r}>, ${Math.ceil(i/4)}>`);else{let a=i==null||i===1?r:`vec${i}<${r}>`;e.push(`${t}:${a}`)}return`
      struct Uniforms { ${e.join(", ")} };
      @group(0) @binding(${this.variableIndex}) var<uniform> uniforms: Uniforms;`}get additionalImplementations(){return this.uniformDeclaration()+this.variables.map(e=>e.impl()).join(`
`)+this.internalVariables.map(e=>e.impl()).join(`
`)}get variablesInfo(){if(this.uniforms.length===0)return;let e=t=>[12,10,1,6][["u32","f16","f32","i32"].indexOf(t)];return this.uniforms.map(t=>[e(t.type),t.length??1])}},be=(e,t)=>new me(e,t)}),Pe,Ze,He,Ft,ia,di,Je,ft,wt,It=C(()=>{"use strict";oe(),ie(),$(),K(),Pe=(e,t)=>{if(!e||e.length!==1)throw new Error("Transpose requires 1 input.");if(t.length!==0&&t.length!==e[0].dims.length)throw new Error(`perm size ${t.length} does not match input rank ${e[0].dims.length}`)},Ze=(e,t)=>t.length!==0?t:[...new Array(e).keys()].reverse(),He=(e,t)=>M.sortBasedOnPerm(e,Ze(e.length,t)),Ft=(e,t,r,i)=>{let a=`fn perm(i: ${i.type.indices}) -> ${r.type.indices} {
    var a: ${r.type.indices};`;for(let n=0;n<t;++n)a+=`a[${e[n]}]=i[${n}];`;return a+="return a;}"},ia=(e,t)=>{let r=[],i=[];for(let a=0;a<e.length;++a)e[a]!==1&&r.push(e[a]),e[t[a]]!==1&&i.push(t[a]);return{newShape:r,newPerm:i}},di=(e,t)=>{let r=0;for(let i=0;i<e.length;++i)if(t[e[i]]!==1){if(e[i]<r)return!1;r=e[i]}return!0},Je=(e,t)=>{let r=e.dataType,i=e.dims.length,a=Ze(i,t),n=He(e.dims,a),s=e.dims,o=n,u=i<2||di(a,e.dims),l;if(u)return l=f=>{let _=A("input",r,s,4),b=j("output",r,o,4);return`
  ${f.registerUniform("output_size","u32").declareVariables(_,b)}
  ${f.mainStart()}
    ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    output[global_idx] = input[global_idx];
  }`},{name:"TransposeCopy",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let f=M.size(n);return{outputs:[{dims:n,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(f/64/4)},programUniforms:[{type:12,data:Math.ceil(f/4)}]}},getShaderSource:l};let{newShape:p,newPerm:d}=ia(e.dims,a),h=M.areEqual(d,[2,3,1]),m=M.areEqual(d,[3,1,2]);if(p.length===2||h||m){s=h?[p[0],p[1]*p[2]]:m?[p[0]*p[1],p[2]]:p,o=[s[1],s[0]];let f=16;return l=_=>{let b=A("a",r,s.length),w=j("output",r,o.length);return`
  ${_.registerUniform("output_size","u32").declareVariables(b,w)}
  var<workgroup> tile : array<array<${w.type.value}, ${f+1}>, ${f}>;
  ${_.mainStart([f,f,1])}
    let stride = (uniforms.output_shape[1] - 1) / ${f} + 1;
    let workgroup_id_x = workgroup_index % stride;
    let workgroup_id_y = workgroup_index / stride;
    let input_col = workgroup_id_y * ${f}u + local_id.x;
    let input_row = workgroup_id_x * ${f}u + local_id.y;
    if (input_row < uniforms.a_shape[0] && input_col < uniforms.a_shape[1]) {
      tile[local_id.y][local_id.x] = ${b.getByIndices(`${b.type.indices}(input_row, input_col)`)};
    }
    workgroupBarrier();

    let output_col = workgroup_id_x * ${f}u + local_id.x;
    let output_row = workgroup_id_y * ${f}u + local_id.y;
    if (output_row < uniforms.output_shape[0] && output_col < uniforms.output_shape[1]) {
      ${w.setByIndices(`${w.type.indices}(output_row, output_col)`,"tile[local_id.x][local_id.y]")}
    }
  }`},{name:"TransposeShared",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let _=M.size(n);return{outputs:[{dims:n,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(o[1]/f),y:Math.ceil(o[0]/f)},programUniforms:[{type:12,data:_},...k(s,o)]}},getShaderSource:l}}return l=f=>{let _=A("a",r,s.length),b=j("output",r,o.length);return`
  ${f.registerUniform("output_size","u32").declareVariables(_,b)}

  ${Ft(a,i,_,b)}

  ${f.mainStart()}
    ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${b.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${b.setByOffset("global_idx",_.getByIndices("aIndices"))}
  }`},{name:"Transpose",shaderCache:{hint:`${t}`,inputDependencies:["rank"]},getRunData:()=>{let f=M.size(n);return{outputs:[{dims:n,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(f/64)},programUniforms:[{type:12,data:f},...k(s,o)]}},getShaderSource:l}},ft=(e,t)=>{Pe(e.inputs,t.perm),e.compute(Je(e.inputs[0],t.perm))},wt=e=>g({perm:e.perm})}),xe,mt,xa,zt,Mr,Ue,et,pi,Dr,aa,gt,Ct,At,rr,Ne,Be,$t,Sa,Ta,Ms,Ds,Kc=C(()=>{"use strict";oe(),ie(),K(),fn(),It(),xe={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate * candidate",logSumExp:"bestValue + exp(candidate)",l1:"bestValue + abs(candidate)",l2:"bestValue + candidate * candidate",logSum:"bestValue + candidate"},mt={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate",logSumExp:"bestValue + candidate",l1:"bestValue + candidate",l2:"bestValue + candidate",logSum:"bestValue + candidate"},xa={max:"_A[offset]",min:"_A[offset]",mean:"0",sum:"0",prod:"1",sumSquare:"0",logSumExp:"0",l1:"0",l2:"0",logSum:"0"},zt={max:"bestValue",min:"bestValue",sum:"bestValue",prod:"bestValue",sumSquare:"bestValue",logSumExp:"log(bestValue)",l1:"bestValue",l2:"sqrt(bestValue)",logSum:"log(bestValue)"},Mr=(e,t)=>{let r=[];for(let i=t-e;i<t;++i)r.push(i);return r},Ue=(e,t)=>{let r=[],i=e.length;for(let n=0;n<i;n++)t.indexOf(n)===-1&&r.push(e[n]);let a=t.map(n=>e[n]);return[r,a]},et=(e,t)=>{let r=e.length+t.length,i=[],a=0;for(let n=0;n<r;n++)t.indexOf(n)===-1?i.push(e[a++]):i.push(1);return i},pi=(e,t)=>{for(let r=0;r<e.length;++r)if(e[e.length-r-1]!==t-1-r)return!1;return!0},Dr=(e,t)=>{let r=[];if(!pi(e,t)){for(let i=0;i<t;++i)e.indexOf(i)===-1&&r.push(i);e.forEach(i=>r.push(i))}return r},aa=(e,t,r,i,a,n,s)=>{let o=r[0].dims,u=M.size(n),l=M.size(s),p=A("_A",r[0].dataType,o),d=j("output",a,n),h=64;u===1&&(h=256);let m=`
          var<workgroup> aBestValues : array<f32, ${h}>;
       `,f=_=>`
        ${_.registerUniform("reduceSize","u32").declareVariables(p,d)}
        ${m}
        fn DIV_CEIL(a : u32, b : u32) -> u32 {
          return ((a - 1u) / b + 1u);
         }
         ${_.mainStart(h)}

          let outputIndex = global_idx / ${h};
          let offset = outputIndex * uniforms.reduceSize;

          var bestValue = f32(${xa[i]});
          let Length = uniforms.reduceSize;
          for (var k = local_idx; k < Length; k = k + ${h}) {
           let candidate = f32(${p.getByOffset("offset + k")});
           bestValue = ${xe[i]};
          }
          aBestValues[local_idx] = bestValue;
          workgroupBarrier();

         var reduceSize = min(Length, ${h}u);
         for (var currentSize = reduceSize / 2u; reduceSize > 1u;
             currentSize = reduceSize / 2u) {
           let interval = DIV_CEIL(reduceSize, 2u);
           if (local_idx < currentSize) {
            let candidate = aBestValues[local_idx + interval];
            bestValue = ${mt[i]};
            aBestValues[local_idx] = bestValue;
           }
           reduceSize = interval;
           workgroupBarrier();
         }

         if (local_idx == 0u) {
          ${d.setByOffset("outputIndex",`${i==="mean"?`${d.type.storage}(bestValue / f32(uniforms.reduceSize))`:`${d.type.storage}(${zt[i]})`}`)};
         }
        }`;return{name:e,shaderCache:{hint:`${t};${h}`,inputDependencies:["type"]},getShaderSource:f,getRunData:()=>({outputs:[{dims:n,dataType:a}],dispatchGroup:{x:u},programUniforms:[{type:12,data:l}]})}},gt=(e,t,r,i)=>{let a=e.inputs.length===1?r:hn(e.inputs,r),n=a.axes;n.length===0&&!a.noopWithEmptyAxes&&(n=e.inputs[0].dims.map((m,f)=>f));let s=M.normalizeAxes(n,e.inputs[0].dims.length),o=s,u=e.inputs[0],l=Dr(o,e.inputs[0].dims.length);l.length>0&&(u=e.compute(Je(e.inputs[0],l),{inputs:[0],outputs:[-1]})[0],o=Mr(o.length,u.dims.length));let[p,d]=Ue(u.dims,o),h=p;a.keepDims&&(h=et(p,s)),e.compute(aa(t,a.cacheKey,[u],i,e.inputs[0].dataType,h,d),{inputs:[u]})},Ct=(e,t)=>{gt(e,"ReduceMeanShared",t,"mean")},At=(e,t)=>{gt(e,"ReduceL1Shared",t,"l1")},rr=(e,t)=>{gt(e,"ReduceL2Shared",t,"l2")},Ne=(e,t)=>{gt(e,"ReduceLogSumExpShared",t,"logSumExp")},Be=(e,t)=>{gt(e,"ReduceMaxShared",t,"max")},$t=(e,t)=>{gt(e,"ReduceMinShared",t,"min")},Sa=(e,t)=>{gt(e,"ReduceProdShared",t,"prod")},Ta=(e,t)=>{gt(e,"ReduceSumShared",t,"sum")},Ms=(e,t)=>{gt(e,"ReduceSumSquareShared",t,"sumSquare")},Ds=(e,t)=>{gt(e,"ReduceLogSumShared",t,"logSum")}}),Ot,Ps,Ea,hn,Rt,Us,Ns,Ls,qs,Fs,Vs,Gs,Ws,js,Hs,Bt,Ks,Zs,Qs,Xs,Ys,Js,eo,to,ro,io,fn=C(()=>{"use strict";oe(),ie(),$(),K(),Kc(),Ot=e=>{if(!e||e.length===0||e.length>2)throw new Error("Reduce op requires 1 or 2 inputs.");if(e.length===2&&e[1].dims.length!==1)throw new Error("Invalid axes input dims.")},Ps=e=>["","",`var value = ${e.getByIndices("input_indices")};`,""],Ea=(e,t,r,i,a,n,s=!1,o=!1)=>{let u=[],l=r[0].dims,p=l.length,d=M.normalizeAxes(a,p),h=!o&&d.length===0;l.forEach((_,b)=>{h||d.indexOf(b)>=0?s&&u.push(1):u.push(_)});let m=u.length,f=M.size(u);return{name:e,shaderCache:t,getShaderSource:_=>{let b=[],w=A("_A",r[0].dataType,p),y=j("output",n,m),x=i(w,y,d),v=x[2];for(let S=0,I=0;S<p;S++)h||d.indexOf(S)>=0?(s&&I++,v=`for(var j${S}: u32 = 0; j${S} < ${l[S]}; j${S}++) {
                  ${x[2].includes("last_index")?`let last_index = j${S};`:""}
                  ${w.indicesSet("input_indices",S,`j${S}`)}
                  ${v}
                }`):(b.push(`${w.indicesSet("input_indices",S,y.indicesGet("output_indices",I))};`),I++);return`

        ${_.registerUniform("output_size","u32").declareVariables(w,y)}

        ${_.mainStart()}
          ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          var input_indices: ${w.type.indices};
          let output_indices = ${y.offsetToIndices("global_idx")};

          ${b.join(`
`)}
          ${x[0]}       // init ops for reduce max/min
          ${x[1]}
          ${v}
          ${x[3]}
          ${x.length===4?y.setByOffset("global_idx","value"):x.slice(4).join(`
`)}
        }`},getRunData:()=>({outputs:[{dims:u,dataType:n}],dispatchGroup:{x:Math.ceil(f/64)},programUniforms:[{type:12,data:f},...k(l,u)]})}},hn=(e,t)=>{let r=[];return e[1].dims[0]>0&&e[1].getBigInt64Array().forEach(i=>r.push(Number(i))),g({axes:r,keepDims:t.keepDims,noopWithEmptyAxes:t.noopWithEmptyAxes})},Rt=(e,t,r,i)=>{let a=e.inputs,n=a.length===1?r:hn(a,r);e.compute(Ea(t,{hint:n.cacheKey,inputDependencies:["rank"]},[a[0]],n.noopWithEmptyAxes&&n.axes.length===0?Ps:i,n.axes,a[0].dataType,n.keepDims,n.noopWithEmptyAxes),{inputs:[0]})},Us=(e,t)=>{Ot(e.inputs),Rt(e,"ReduceLogSum",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += ${r.getByIndices("input_indices")};`,"value = log(value);"])},Ns=(e,t)=>{Ot(e.inputs),Rt(e,"ReduceL1",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += abs(${r.getByIndices("input_indices")});`,""])},Ls=(e,t)=>{Ot(e.inputs),Rt(e,"ReduceL2",t,(r,i)=>[`var t = ${i.type.value}(0); var value = ${i.type.value}(0);`,"",`t = ${r.getByIndices("input_indices")}; value += (t * t);`,"value = sqrt(value);"])},qs=(e,t)=>{Ot(e.inputs),Rt(e,"ReduceLogSumExp",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += exp(${r.getByIndices("input_indices")});`,"value = log(value);"])},Fs=(e,t)=>{Ot(e.inputs),Rt(e,"ReduceMax",t,(r,i,a)=>{let n=[];for(let s=0;s<r.rank;s++)(a.indexOf(s)>=0||a.length===0)&&n.push(r.indicesSet("input_indices",s,0));return[`${n.join(`
`)}`,`var value = ${r.getByIndices("input_indices")};`,`value = max(value, ${r.getByIndices("input_indices")});`,""]})},Vs=(e,t)=>{Ot(e.inputs),Rt(e,"ReduceMean",t,(r,i,a)=>{let n=1;for(let s=0;s<r.rank;s++)(a.indexOf(s)>=0||a.length===0)&&(n*=e.inputs[0].dims[s]);return["var sum = f32(0);","",`sum += f32(${r.getByIndices("input_indices")});`,`let value = ${i.type.value}(sum / ${n});`]})},Gs=(e,t)=>{Ot(e.inputs),Rt(e,"ReduceMin",t,(r,i,a)=>{let n=[];for(let s=0;s<r.rank;s++)(a.indexOf(s)>=0||a.length===0)&&n.push(`input_indices[${s}] = 0;`);return[`${n.join(`
`)}`,`var value = ${r.getByIndices("input_indices")};`,`value = min(value, ${r.getByIndices("input_indices")});`,""]})},Ws=(e,t)=>{Ot(e.inputs),Rt(e,"ReduceProd",t,(r,i)=>[`var value = ${i.type.storage}(1);`,"",`value *= ${r.getByIndices("input_indices")};`,""])},js=(e,t)=>{Ot(e.inputs),Rt(e,"ReduceSum",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += ${r.getByIndices("input_indices")};`,""])},Hs=(e,t)=>{Ot(e.inputs),Rt(e,"ReduceSumSquare",t,(r,i)=>[`var t = ${i.type.value}(0); var value = ${i.type.value}(0);`,"",`t = ${r.getByIndices("input_indices")}; value += t * t;`,""])},Bt=(e,t,r)=>{if(t.length===0)return r;let i=1,a=1;for(let n=0;n<t.length;n++)t.indexOf(n)===-1?i*=e[n]:a*=e[n];return a<32&&i>1024},Ks=(e,t)=>{Bt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Vs(e,t):Ct(e,t)},Zs=(e,t)=>{Bt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Ns(e,t):At(e,t)},Qs=(e,t)=>{Bt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Ls(e,t):rr(e,t)},Xs=(e,t)=>{Bt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?qs(e,t):Ne(e,t)},Ys=(e,t)=>{Bt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Fs(e,t):Be(e,t)},Js=(e,t)=>{Bt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Gs(e,t):$t(e,t)},eo=(e,t)=>{Bt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Ws(e,t):Sa(e,t)},to=(e,t)=>{Bt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?js(e,t):Ta(e,t)},ro=(e,t)=>{Bt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Hs(e,t):Ms(e,t)},io=(e,t)=>{Bt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Us(e,t):Ds(e,t)}}),mn,ao,no,gn,Zc=C(()=>{"use strict";oe(),$(),fn(),mn=e=>{if(!e||e.length===0||e.length>2)throw new Error("ArgMinMaxOp op requires 1 or 2 inputs.");if(e[0].dataType!==1)throw new Error("Invalid input type.")},ao=(e,t)=>{mn(e.inputs);let r=(i,a,n)=>{let s=[];for(let o=0;o<i.rank;o++)(n.indexOf(o)>=0||n.length===0)&&s.push(`input_indices[${o}] = 0;`);return[`${s.join(`
`)}`,`var value = ${i.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${i.getByIndices("input_indices")} ${t.selectLastIndex>0?"<=":"<"} value) {
         value = ${i.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",a.setByOffset("global_idx","best_index")]};e.compute(Ea("ArgMin",{hint:t.cacheKey,inputDependencies:["rank"]},[e.inputs[0]],r,[t.axis],7,t.keepDims),{inputs:[0]})},no=(e,t)=>{mn(e.inputs);let r=(i,a,n)=>{let s=[];for(let o=0;o<i.rank;o++)(n.indexOf(o)>=0||n.length===0)&&s.push(`input_indices[${o}] = 0;`);return[`${s.join(`
`)}`,`var value = ${i.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${i.getByIndices("input_indices")} ${t.selectLastIndex>0?">=":">"} value) {
         value = ${i.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",a.setByOffset("global_idx","best_index")]};e.compute(Ea("argMax",{hint:t.cacheKey,inputDependencies:["rank"]},[e.inputs[0]],r,[t.axis],7,t.keepDims),{inputs:[0]})},gn=e=>g(e)}),so,ka,oo,uo,lo,na,po,co,yn=C(()=>{"use strict";oe(),ie(),ai(),K(),so=(e,t)=>{let r=e[0],i=e[1],a=e[2],n=e[3],s=e[4],o=e[5];if(s&&o)throw new Error("Attention cannot have both past and attention_bias");if(r.dims.length!==3)throw new Error('Input "input" must have 3 dimensions');let u=r.dims[0],l=r.dims[1],p=r.dims[2];if(a.dims.length!==1)throw new Error('Input "bias" is expected to have 1 dimensions');if(i.dims.length!==2)throw new Error('Input "weights" is expected to have 2 dimensions');if(i.dims[0]!==p)throw new Error("Input 1 dimension 0 should have same length as dimension 2 of input 0");if(a.dims[0]!==i.dims[1])throw new Error('Input "bias" dimension 0 should have same length as dimension 1 of input "weights"');let d=a.dims[0]/3,h=d,m=h;if(t.qkvHiddenSizes.length>0){if(t.qkvHiddenSizes.length!==3)throw new Error("qkv_hidden_sizes attribute should have 3 elements");for(let x of t.qkvHiddenSizes)if(x%t.numHeads!==0)throw new Error("qkv_hidden_sizes should be divisible by num_heads");d=t.qkvHiddenSizes[0],h=t.qkvHiddenSizes[1],m=t.qkvHiddenSizes[2]}let f=l;if(d!==h)throw new Error("qkv_hidden_sizes first element should be same as the second");if(a.dims[0]!==d+h+m)throw new Error('Input "bias" dimension 0 should have same length as sum of Q/K/V hidden sizes');let _=0;if(s){if(h!==m)throw new Error('Input "past" expect k_hidden_size == v_hidden_size');if(s.dims.length!==5)throw new Error('Input "past" must have 5 dimensions');if(s.dims[0]!==2)throw new Error('Input "past" first dimension must be 2');if(s.dims[1]!==u)throw new Error('Input "past" second dimension must be batch_size');if(s.dims[2]!==t.numHeads)throw new Error('Input "past" third dimension must be num_heads');if(s.dims[4]!==h/t.numHeads)throw new Error('Input "past" fifth dimension must be k_hidden_size / num_heads');t.pastPresentShareBuffer||(_=s.dims[3])}let b=f+_,w=-1,y=0;if(n)throw new Error("Mask not supported");if(s)throw new Error("past is not supported");if(o){if(o.dims.length!==4)throw new Error('Input "attention_bias" must have 4 dimensions');if(o.dims[0]!==u||o.dims[1]!==t.numHeads||o.dims[2]!==l||o.dims[3]!==b)throw new Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:u,sequenceLength:l,pastSequenceLength:_,kvSequenceLength:f,totalSequenceLength:b,maxSequenceLength:w,inputHiddenSize:p,hiddenSize:d,vHiddenSize:m,headSize:Math.floor(d/t.numHeads),vHeadSize:Math.floor(m/t.numHeads),numHeads:t.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:t.maskFilterValue,maskType:y,scale:t.scale,broadcastResPosBias:!1,passPastInKv:!1,qkvFormat:1}},ka=(e,t,r)=>t&&e?`
      let total_sequence_length_input = u32(${t.getByOffset("0")});
      let present_sequence_length = max(total_sequence_length_input, uniforms.past_sequence_length);
      let is_subsequent_prompt: bool = sequence_length > 1 && sequence_length != total_sequence_length_input;
      let is_first_prompt: bool = is_subsequent_prompt == false && sequence_length == total_sequence_length_input;
      total_sequence_length = u32(${e?.getByOffset("batchIdx")}) + 1;
      var past_sequence_length: u32 = 0;
      if (is_first_prompt == false) {
        past_sequence_length = total_sequence_length - sequence_length;
      }
       `:`
    ${r?"let past_sequence_length = uniforms.past_sequence_length":""};
    let present_sequence_length = total_sequence_length;
    `,oo=(e,t,r,i,a,n,s,o)=>{let u=R(s?1:n),l=64,p=n/u;p<l&&(l=32);let d=Math.ceil(n/u/l),h=[{type:12,data:t},{type:12,data:r},{type:12,data:i},{type:12,data:a},{type:12,data:p},{type:12,data:d}],m=B(e.dataType,u),f=z(1,u),_=["type"];s&&_.push("type"),o&&_.push("type");let b=w=>{let y=j("x",e.dataType,e.dims,u),x=[y],v=s?A("seq_lens",s.dataType,s.dims):void 0;v&&x.push(v);let S=o?A("total_sequence_length_input",o.dataType,o.dims):void 0;S&&x.push(S);let I=z(e.dataType),O=[{name:"batch_size",type:"u32"},{name:"num_heads",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"sequence_length",type:"u32"},{name:"total_sequence_length",type:"u32"},{name:"elements_per_thread",type:"u32"}];return`
  var<workgroup> thread_max: array<f32, ${l}>;
  var<workgroup> thread_sum: array<f32, ${l}>;
  ${w.registerUniforms(O).declareVariables(...x)}
  ${w.mainStart([l,1,1])}
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let sequence_length = uniforms.sequence_length;
    var total_sequence_length = uniforms.total_sequence_length;
    ${ka(v,S,!1)}
    let local_offset = local_idx * uniforms.elements_per_thread;
    let offset = (global_idx / ${l}) * uniforms.total_sequence_length + local_offset;
    let seq_causal_length = ${s?"u32(past_sequence_length + workgroup_id.y + 1)":"total_sequence_length"};
    var thread_max_vector = ${f}(-3.4028234663852886e+38f);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      thread_max_vector = max(${f}(x[offset + i]), thread_max_vector);
    }
    thread_max[local_idx] = ${(()=>{switch(u){case 1:return"thread_max_vector";case 2:return"max(thread_max_vector.x, thread_max_vector.y)";case 4:return"max(max(thread_max_vector.x, thread_max_vector.y), max(thread_max_vector.z, thread_max_vector.w))";default:throw new Error(`Unsupported components: ${u}`)}})()};
    workgroupBarrier();

    var max_value =  f32(-3.4028234663852886e+38f);
    for (var i = 0u; i < ${l}; i++) {
      max_value = max(thread_max[i], max_value);
    }

    var sum_vector = ${f}(0);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      sum_vector += exp(${f}(x[offset + i]) - max_value);
    }
    thread_sum[local_idx] = ${(()=>{switch(u){case 1:return"sum_vector";case 2:return"sum_vector.x + sum_vector.y";case 4:return"sum_vector.x + sum_vector.y + sum_vector.z + sum_vector.w";default:throw new Error(`Unsupported components: ${u}`)}})()};
    workgroupBarrier();

    var sum: f32 = 0;
    for (var i = 0u; i < ${l}; i++) {
      sum += thread_sum[i];
    }

    if (sum == 0) {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        x[offset + i] = ${y.type.value}(${I}(1.0) / ${I}(seq_causal_length));
      }
    } else {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        var f32input = ${f}(x[offset + i]);
        x[offset + i] = ${y.type.value}(exp(f32input - max_value) / sum);
      }
    }
      ${s?`
        for (var total_seq_id: u32 = seq_causal_length; total_seq_id + local_offset < uniforms.total_sequence_length; total_seq_id++) {
          x[offset + total_seq_id] = ${y.type.value}(${I}(0));
        }`:""};
  }`};return{name:"AttentionProbsSoftmax",shaderCache:{hint:`${l};${m};${u}`,inputDependencies:_},getShaderSource:b,getRunData:()=>({outputs:[],dispatchGroup:{x:1,y:a,z:t*r},programUniforms:h})}},uo=(e,t,r,i,a,n,s,o,u)=>{let l=s+n.kvSequenceLength,p=[n.batchSize,n.numHeads,n.sequenceLength,l],d=e>1&&i,h=n.kvNumHeads?n.kvNumHeads:n.numHeads,m=d?[n.batchSize,h,l,n.headSize]:void 0,f=n.nReps?n.nReps:1,_=n.scale===0?1/Math.sqrt(n.headSize):n.scale,b=R(n.headSize),w=n.headSize/b,y=12,x={x:Math.ceil(l/y),y:Math.ceil(n.sequenceLength/y),z:n.batchSize*n.numHeads},v=[{type:12,data:n.sequenceLength},{type:12,data:w},{type:12,data:l},{type:12,data:n.numHeads},{type:12,data:n.headSize},{type:1,data:_},{type:12,data:s},{type:12,data:n.kvSequenceLength},{type:12,data:f}],S=d&&i&&M.size(i.dims)>0,I=["type","type"];S&&I.push("type"),a&&I.push("type"),o&&I.push("type"),u&&I.push("type");let O=[{dims:p,dataType:t.dataType,gpuDataType:0}];d&&O.push({dims:m,dataType:t.dataType,gpuDataType:0});let P=V=>{let Q=A("q",t.dataType,t.dims,b),ye=A("key",r.dataType,r.dims,b),ae=[Q,ye];if(S){let he=A("past_key",i.dataType,i.dims,b);ae.push(he)}a&&ae.push(A("attention_bias",a.dataType,a.dims));let ne=o?A("seq_lens",o.dataType,o.dims):void 0;ne&&ae.push(ne);let ke=u?A("total_sequence_length_input",u.dataType,u.dims):void 0;ke&&ae.push(ke);let X=j("output",t.dataType,p),ee=[X];d&&ee.push(j("present_key",t.dataType,m,b));let ge=z(1,b),we=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"alpha",type:"f32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${y}u;

  var<workgroup> tileQ: array<${Q.type.storage}, ${y*y}>;
  var<workgroup> tileK: array<${Q.type.storage}, ${y*y}>;
  ${V.registerUniforms(we).declareVariables(...ae,...ee)}
  ${V.mainStart([y,y,1])}
    // x holds the N and y holds the M
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let kvHeadIdx = ${f===1?"headIdx":"headIdx / uniforms.n_reps"};
    let kv_num_heads = ${f===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let m = workgroup_id.y * TILE_SIZE;
    let n = workgroup_id.x * TILE_SIZE;
    let sequence_length = uniforms.M;
    var total_sequence_length = uniforms.N;
    ${ka(ne,ke,!0)}
    let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx;
    let qOffset = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
    ${S&&d?"let pastKeyOffset = absKvHeadIdx * uniforms.past_sequence_length * uniforms.K;":""};
    let kOffset = absKvHeadIdx * uniforms.kv_sequence_length * uniforms.K;
    ${d?"let presentKeyOffset = absKvHeadIdx * uniforms.N * uniforms.K;":""}
    var value = ${ge}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (global_id.y < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = q[qOffset + local_id.y * uniforms.K + w + local_id.x];
      }
      if (n + local_id.y < uniforms.N && w + local_id.x < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
      ${S&&d?`
              if (n + local_id.y < past_sequence_length) {
                tileK[idx] = past_key[pastKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
              } else if (n + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
                tileK[idx] = key[kOffset + (n + local_id.y - past_sequence_length) * uniforms.K + w + local_id.x];
              }`:`
          if (n + local_id.y < uniforms.kv_sequence_length) {
            tileK[idx] = key[kOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
          }`}
      ${d?`if (n + local_id.y < present_sequence_length) {
        present_key[presentKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x] = tileK[idx];
      }`:""}
      }
      workgroupBarrier();

      for (var k: u32 = 0u; k < TILE_SIZE && w+k < uniforms.K; k++) {
          value += ${ge}(tileQ[TILE_SIZE * local_id.y + k] * tileK[TILE_SIZE * local_id.x + k]);
      }

      workgroupBarrier();
    }

    if (global_id.y < uniforms.M && global_id.x < total_sequence_length) {
      let headOffset = workgroup_id.z * uniforms.M * uniforms.N;
      let outputIdx = headOffset + global_id.y * uniforms.N + global_id.x;
      var sum: f32 = ${(()=>{switch(b){case 1:return"value";case 2:return"value.x + value.y";case 4:return"value.x + value.y + value.z + value.w";default:throw new Error(`Unsupported components: ${b}`)}})()};
        output[outputIdx] = ${X.type.value} (sum * uniforms.alpha) + ${a?"attention_bias[outputIdx]":"0.0"};
    }
  }`};return{name:"AttentionProbs",shaderCache:{hint:`${b};${a!==void 0};${i!==void 0};${e}`,inputDependencies:I},getRunData:()=>({outputs:O,dispatchGroup:x,programUniforms:v}),getShaderSource:P}},lo=(e,t,r,i,a,n,s=void 0,o=void 0)=>{let u=n+a.kvSequenceLength,l=a.nReps?a.nReps:1,p=a.vHiddenSize*l,d=e>1&&i,h=a.kvNumHeads?a.kvNumHeads:a.numHeads,m=d?[a.batchSize,h,u,a.headSize]:void 0,f=[a.batchSize,a.sequenceLength,p],_=12,b={x:Math.ceil(a.vHeadSize/_),y:Math.ceil(a.sequenceLength/_),z:a.batchSize*a.numHeads},w=[{type:12,data:a.sequenceLength},{type:12,data:u},{type:12,data:a.vHeadSize},{type:12,data:a.numHeads},{type:12,data:a.headSize},{type:12,data:p},{type:12,data:n},{type:12,data:a.kvSequenceLength},{type:12,data:l}],y=d&&i&&M.size(i.dims)>0,x=["type","type"];y&&x.push("type"),s&&x.push("type"),o&&x.push("type");let v=[{dims:f,dataType:t.dataType,gpuDataType:0}];d&&v.push({dims:m,dataType:t.dataType,gpuDataType:0});let S=I=>{let O=A("probs",t.dataType,t.dims),P=A("v",r.dataType,r.dims),V=[O,P];y&&V.push(A("past_value",i.dataType,i.dims));let Q=s?A("seq_lens",s.dataType,s.dims):void 0;s&&V.push(Q);let ye=o?A("total_sequence_length_input",o.dataType,o.dims):void 0;o&&V.push(ye);let ae=[j("output",t.dataType,f)];d&&ae.push(j("present_value",t.dataType,m));let ne=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"v_hidden_size",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${_}u;
  var<workgroup> tileQ: array<${O.type.value}, ${_*_}>;
  var<workgroup> tileV: array<${O.type.value}, ${_*_}>;
  ${I.registerUniforms(ne).declareVariables(...V,...ae)}
  ${I.mainStart([_,_,1])}
   let headIdx = workgroup_id.z % uniforms.num_heads;
   let batchIdx = workgroup_id.z / uniforms.num_heads;
   let kvHeadIdx = ${l===1?"headIdx":"headIdx / uniforms.n_reps"};
   let kv_num_heads = ${l===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
   let m = global_id.y;
   let n = global_id.x;
   let sequence_length = uniforms.M;
   var total_sequence_length = uniforms.K;
   ${ka(Q,ye,!0)}
   let offsetA = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
   let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx; // kvHeadIdx is relative to the batch
   ${y&&d?"let pastValueOffset = absKvHeadIdx * uniforms.N * uniforms.past_sequence_length + n;":""};
   let vOffset = absKvHeadIdx * uniforms.N * uniforms.kv_sequence_length + n;
   ${d?"let presentValueOffset = absKvHeadIdx * uniforms.N * uniforms.K + n;":""}
   var value = ${O.type.storage}(0);
   for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = probs[offsetA + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
        ${y&&d?`
        if (w + local_id.y < past_sequence_length) {
          tileV[idx] = past_value[pastValueOffset + (w + local_id.y) * uniforms.N];
        } else if (w + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
          tileV[idx] = v[vOffset + (w + local_id.y - past_sequence_length) * uniforms.N];
        }
      `:`
            if (w + local_id.y < uniforms.kv_sequence_length) {
              tileV[idx] = v[vOffset + (w + local_id.y) * uniforms.N];
            }`}
        ${d?`
            if (w + local_id.y < present_sequence_length) {
          present_value[presentValueOffset + (w + local_id.y) * uniforms.N] = tileV[idx];
        }`:""}
      }
     workgroupBarrier();
     for (var k: u32 = 0u; k < TILE_SIZE && w+k < total_sequence_length; k++) {
       value += tileQ[TILE_SIZE * local_id.y + k] * tileV[TILE_SIZE * k + local_id.x];
     }
     workgroupBarrier();
   }

   // we need to transpose output from BNSH_v to BSND_v
   if (m < uniforms.M && n < uniforms.N) {
     let outputIdx = batchIdx * uniforms.M * uniforms.v_hidden_size + m * uniforms.v_hidden_size
       + headIdx * uniforms.N + n;
     output[outputIdx] = value;
   }
  }`};return{name:"AttentionScore",shaderCache:{hint:`${i!==void 0};${e}`,inputDependencies:x},getRunData:()=>({outputs:v,dispatchGroup:b,programUniforms:w}),getShaderSource:S}},na=(e,t,r,i,a,n,s,o,u,l,p=void 0,d=void 0)=>{let h=Math.min(e.outputCount,1+(s?1:0)+(o?1:0)),m=h>1?s:void 0,f=h>1?o:void 0,_=h>1?l.pastSequenceLength:0,b=_+l.kvSequenceLength,w=u&&M.size(u.dims)>0?u:void 0,y=[t,r];m&&M.size(m.dims)>0&&y.push(m),w&&y.push(w),p&&y.push(p),d&&y.push(d);let x=e.compute(uo(h,t,r,m,w,l,_,p,d),{inputs:y,outputs:h>1?[-1,1]:[-1]})[0];e.compute(oo(x,l.batchSize,l.numHeads,_,l.sequenceLength,b,p,d),{inputs:p&&d?[x,p,d]:[x],outputs:[]});let v=[x,i];f&&M.size(f.dims)>0&&v.push(f),p&&v.push(p),d&&v.push(d),e.compute(lo(h,x,i,f,l,_,p,d),{inputs:v,outputs:h>1?[0,2]:[0]})},po=(e,t)=>{let r=[t.batchSize,t.numHeads,t.sequenceLength,t.headSize],i=t.sequenceLength,a=t.inputHiddenSize,n=t.headSize,s=12,o={x:Math.ceil(t.headSize/s),y:Math.ceil(t.sequenceLength/s),z:t.batchSize*t.numHeads},u=[e.inputs[0],e.inputs[1],e.inputs[2]],l=[{type:12,data:i},{type:12,data:a},{type:12,data:n},{type:12,data:t.numHeads},{type:12,data:t.headSize},{type:12,data:t.hiddenSize},{type:12,data:t.hiddenSize+t.hiddenSize+t.vHiddenSize}],p=d=>{let h=j("output_q",u[0].dataType,r),m=j("output_k",u[0].dataType,r),f=j("output_v",u[0].dataType,r),_=A("input",u[0].dataType,u[0].dims),b=A("weight",u[1].dataType,u[1].dims),w=A("bias",u[2].dataType,u[2].dims),y=_.type.storage,x=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"hidden_size",type:"u32"},{name:"ldb",type:"u32"}];return`
  const TILE_SIZE = ${s}u;
  var<workgroup> tileInput: array<${y}, ${s*s}>;
  var<workgroup> tileWeightQ: array<${y}, ${s*s}>;
  var<workgroup> tileWeightK: array<${y}, ${s*s}>;
  var<workgroup> tileWeightV: array<${y}, ${s*s}>;
  ${d.registerUniforms(x).declareVariables(_,b,w,h,m,f)}
  ${d.mainStart([s,s,1])}
    let batchIndex = workgroup_id.z / uniforms.num_heads;
    let headNumber = workgroup_id.z % uniforms.num_heads;
    let m = global_id.y;
    let n = global_id.x;

    let inputOffset = batchIndex * (uniforms.M * uniforms.K) + m * uniforms.K;
    let biasOffsetQ = headNumber * uniforms.head_size;
    let biasOffsetK = uniforms.hidden_size + biasOffsetQ;
    let biasOffsetV = uniforms.hidden_size + biasOffsetK;

    var valueQ = ${y}(0);
    var valueK = ${y}(0);
    var valueV = ${y}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileInput[TILE_SIZE * local_id.y + local_id.x] = input[inputOffset + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        let offset = n + (w + local_id.y) * uniforms.ldb;
        tileWeightQ[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetQ + offset];
        tileWeightK[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetK + offset];
        tileWeightV[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetV + offset];
      }
      workgroupBarrier();
      for (var k: u32 = 0u; k<TILE_SIZE && w+k < uniforms.K; k++) {
        let inputTileOffset = TILE_SIZE * local_id.y + k;
        let weightTileOffset = TILE_SIZE * k + local_id.x;
        valueQ += tileInput[inputTileOffset] * tileWeightQ[weightTileOffset];
        valueK += tileInput[inputTileOffset] * tileWeightK[weightTileOffset];
        valueV += tileInput[inputTileOffset] * tileWeightV[weightTileOffset];
      }

      workgroupBarrier();
    }

    let headOffset = (m * uniforms.N + n) % uniforms.head_size;
    valueQ += bias[headOffset + biasOffsetQ];
    valueK += bias[headOffset + biasOffsetK];
    valueV += bias[headOffset + biasOffsetV];

    let offset = workgroup_id.z * uniforms.M * uniforms.N;
    if (m < uniforms.M && n < uniforms.N) {
      let outputIdx = offset + m * uniforms.N + n;
      output_q[outputIdx] = valueQ;
      output_k[outputIdx] = valueK;
      output_v[outputIdx] = valueV;
    }
  }`};return e.compute({name:"AttentionPrepare",shaderCache:{inputDependencies:["type","type","type"]},getRunData:()=>({outputs:[{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0},{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0},{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0}],dispatchGroup:o,programUniforms:l}),getShaderSource:p},{inputs:u,outputs:[-1,-1,-1]})},co=(e,t)=>{let r=so(e.inputs,t),[i,a,n]=po(e,r);return na(e,i,a,n,e.inputs[4],void 0,void 0,void 0,e.inputs[5],r)}}),ho,fo,mo,go,Qc=C(()=>{"use strict";Ge(),oe(),ie(),$(),K(),ho=(e,t)=>{if(!e||e.length!==5)throw new Error("BatchNormalization requires 5 inputs");let r=(i,a,n)=>{let s=a.length;if(s!==i.length)throw new Error(`${n}: num dimensions != ${s}`);a.forEach((o,u)=>{if(o!==i[u])throw new Error(`${n}: dim[${u}] do not match`)})};if(e[0].dims.length>1){let i=t.format==="NHWC"?t.spatial?e[0].dims.slice(-1):e[0].dims.slice(-1).concat(e[0].dims.slice(1,e[0].dims.length-1)):e[0].dims.slice(1,t.spatial?2:void 0);r(e[1].dims,i,"Invalid input scale"),r(e[2].dims,i,"Invalid input B"),r(e[3].dims,i,"Invalid input mean"),r(e[4].dims,i,"Invalid input var")}else r(e[1].dims,[1],"Invalid input scale"),r(e[2].dims,[1],"Invalid input B"),r(e[3].dims,[1],"Invalid input mean"),r(e[4].dims,[1],"Invalid input var")},fo=(e,t)=>{let{epsilon:r,spatial:i,format:a}=t,n=e[0].dims,s=i?R(n[n.length-1]):1,o=a==="NHWC"&&n.length>1?s:1,u=M.size(n)/s,l=i,p=l?n.length:n,d=A("x",e[0].dataType,e[0].dims,s),h=A("scale",e[1].dataType,e[1].dims,o),m=A("bias",e[2].dataType,e[2].dims,o),f=A("inputMean",e[3].dataType,e[3].dims,o),_=A("inputVar",e[4].dataType,e[4].dims,o),b=j("y",e[0].dataType,p,s),w=()=>{let x="";if(i)x=`let cOffset = ${n.length===1?"0u":a==="NHWC"?`outputIndices[${n.length-1}] / ${s}`:"outputIndices[1]"};`;else if(a==="NCHW")x=`
            ${b.indicesSet("outputIndices","0","0")}
            let cOffset = ${b.indicesToOffset("outputIndices")};`;else{x=`var cIndices = ${h.type.indices}(0);
                       cIndices[0] = outputIndices[${n.length-1}];`;for(let v=1;v<h.rank;v++)x+=`cIndices[${v}] = outputIndices[${v}];`;x+=`let cOffset = ${h.indicesToOffset("cIndices")};`}return x},y=x=>`
  const epsilon = ${r};
  ${x.registerUniform("outputSize","u32").declareVariables(d,h,m,f,_,b)}
  ${x.mainStart()}
  ${x.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
    var outputIndices = ${b.offsetToIndices(`global_idx * ${s}`)};
    ${w()}
    let scale = ${h.getByOffset("cOffset")};
    let bias = ${m.getByOffset("cOffset")};
    let inputMean = ${f.getByOffset("cOffset")};
    let inputVar = ${_.getByOffset("cOffset")};
    let x = ${d.getByOffset("global_idx")};
    let value = (x - inputMean) * inverseSqrt(inputVar + epsilon) * scale + bias;
    ${b.setByOffset("global_idx","value")}
  }`;return{name:"BatchNormalization",shaderCache:{hint:`${t.epsilon}_${t.format}_${i}_${s}`,inputDependencies:l?["rank","type","type","type","type"]:void 0},getShaderSource:y,getRunData:()=>({outputs:[{dims:e[0].dims,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:l?[{type:12,data:u},...k(n)]:[{type:12,data:u}]})}},mo=e=>g(e),go=(e,t)=>{let{inputs:r,outputCount:i}=e,a=mo({...t,outputCount:i});if(de.webgpu.validateInputContent&&ho(r,a),t.trainingMode)throw new Error("BatchNormalization trainingMode is not supported yet.");e.compute(fo(r,a))}}),yo,_o,wo,Xc=C(()=>{"use strict";ie(),K(),yo=e=>{if(e[0].dims.length!==3)throw new Error("input should have 3 dimensions");if(![320,640,1280].includes(e[0].dims[2]))throw new Error("number of channels should be 320, 640 or 1280");if(e[1].dims.length!==1)throw new Error("bias is expected to have 1 dimensions");if(e[0].dims[2]!==e[1].dims[0])throw new Error("last dimension of input and bias are not the same")},_o=e=>{let t=e[0].dims,r=e[0].dims[2],i=M.size(t)/4,a=e[0].dataType,n=A("input",a,t,4),s=A("bias",a,[r],4),o=A("residual",a,t,4),u=j("output",a,t,4);return{name:"BiasAdd",getRunData:()=>({outputs:[{dims:t,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(i/64)}}),getShaderSource:l=>`
  const channels = ${r}u / 4;
  ${l.declareVariables(n,s,o,u)}

  ${l.mainStart()}
    ${l.guardAgainstOutOfBoundsWorkgroupSizes(i)}
    let value = ${n.getByOffset("global_idx")}
      + ${s.getByOffset("global_idx % channels")} + ${o.getByOffset("global_idx")};
    ${u.setByOffset("global_idx","value")}
  }`}},wo=e=>{yo(e.inputs),e.compute(_o(e.inputs))}}),$o,Ee,bo,vo,xo,So,To,Eo,ko,Io,zo,Co,Ao,Oo,Ro,Bo,sa,Mo,Ia,Do,Po,Uo,No,Lo,qo,Fo,Vo,Go,Wo,jo,Ho,Ko,Zo,Qo,Xo,Yo,_n,Jo,wn,$n,eu,tu,ru,iu,au,nu,bn=C(()=>{"use strict";oe(),ie(),$(),K(),$o=(e,t,r,i,a,n,s)=>{let o=Math.ceil(t/4),u="";typeof a=="string"?u=`${a}(a)`:u=a("a");let l=A("inputData",r,[o],4),p=j("outputData",i,[o],4),d=[{name:"vec_size",type:"u32"}];return s&&d.push(...s),`
      ${e.registerUniforms(d).declareVariables(l,p)}

  ${n??""}

  ${e.mainStart()}
    ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}

    let a = ${l.getByOffset("global_idx")};
    ${p.setByOffset("global_idx",u)}
  }`},Ee=(e,t,r,i,a,n=e.dataType,s,o)=>{let u=[{type:12,data:Math.ceil(M.size(e.dims)/4)}];return s&&u.push(...s),{name:t,shaderCache:{hint:a,inputDependencies:["type"]},getShaderSource:l=>$o(l,M.size(e.dims),e.dataType,n,r,i,o),getRunData:l=>({outputs:[{dims:e.dims,dataType:n}],dispatchGroup:{x:Math.ceil(M.size(l[0].dims)/64/4)},programUniforms:u})}},bo=e=>{e.compute(Ee(e.inputs[0],"Abs","abs"))},vo=e=>{e.compute(Ee(e.inputs[0],"Acos","acos"))},xo=e=>{e.compute(Ee(e.inputs[0],"Acosh","acosh"))},So=e=>{e.compute(Ee(e.inputs[0],"Asin","asin"))},To=e=>{e.compute(Ee(e.inputs[0],"Asinh","asinh"))},Eo=e=>{e.compute(Ee(e.inputs[0],"Atan","atan"))},ko=e=>{e.compute(Ee(e.inputs[0],"Atanh","atanh"))},Io=e=>g(e),zo=(e,t)=>{let r;switch(t.to){case 10:r="vec4<f16>";break;case 1:r="vec4<f32>";break;case 12:r="vec4<u32>";break;case 6:r="vec4<i32>";break;case 9:r="vec4<bool>";break;default:throw new RangeError(`not supported type (specified in attribute 'to' from 'Cast' operator): ${t.to}`)}e.compute(Ee(e.inputs[0],"Cast",r,void 0,t.cacheKey,t.to))},Co=e=>{let t,r,i=e.length>=2&&e[1].data!==0,a=e.length>=3&&e[2].data!==0;switch(e[0].dataType){case 1:t=i?e[1].getFloat32Array()[0]:-34028234663852886e22,r=a?e[2].getFloat32Array()[0]:34028234663852886e22;break;case 10:t=i?e[1].getUint16Array()[0]:64511,r=a?e[2].getUint16Array()[0]:31743;break;default:throw new Error("Unsupport data type")}return g({min:t,max:r})},Ao=(e,t)=>{let r=t||Co(e.inputs),i=z(e.inputs[0].dataType);e.compute(Ee(e.inputs[0],"Clip",a=>`clamp(${a}, vec4<${i}>(uniforms.min), vec4<${i}>(uniforms.max))`,void 0,r.cacheKey,void 0,[{type:e.inputs[0].dataType,data:r.min},{type:e.inputs[0].dataType,data:r.max}],[{name:"min",type:i},{name:"max",type:i}]),{inputs:[0]})},Oo=e=>{e.compute(Ee(e.inputs[0],"Ceil","ceil"))},Ro=e=>{e.compute(Ee(e.inputs[0],"Cos","cos"))},Bo=e=>{e.compute(Ee(e.inputs[0],"Cosh","cosh"))},sa=e=>g(e),Mo=(e,t)=>{let r=z(e.inputs[0].dataType);e.compute(Ee(e.inputs[0],"Elu",i=>`elu_vf32(${i})`,`
  const elu_alpha_ = ${r}(${t.alpha});

  fn elu_f32(a: ${r}) -> ${r} {
  return select((exp(a) - 1.0) * elu_alpha_, a, a >= 0.0);
  }

  fn elu_vf32(v: vec4<${r}>) -> vec4<${r}> {
  return vec4(elu_f32(v.x), elu_f32(v.y), elu_f32(v.z), elu_f32(v.w));
  }`,t.cacheKey))},Ia=(e="f32")=>`
const r0: ${e} = 0.3275911;
const r1: ${e} = 0.254829592;
const r2: ${e} = -0.284496736;
const r3: ${e} = 1.421413741;
const r4: ${e} = -1.453152027;
const r5: ${e} = 1.061405429;

fn erf_vf32(v: vec4<${e}>) -> vec4<${e}> {
  let absv = abs(v);
  let x = 1.0 / (1.0 + r0 * absv);
  return sign(v) * (1.0 - ((((r5 * x + r4) * x + r3) * x + r2) * x + r1) * x * exp(-absv * absv));
}`,Do=e=>{let t=z(e.inputs[0].dataType);e.compute(Ee(e.inputs[0],"Erf",r=>`erf_vf32(${r})`,Ia(t)))},Po=e=>{e.compute(Ee(e.inputs[0],"Exp","exp"))},Uo=e=>{e.compute(Ee(e.inputs[0],"Floor","floor"))},No=e=>{let t=z(e.inputs[0].dataType);e.compute(Ee(e.inputs[0],"Gelu",r=>`0.5 * ${r} * (1.0 + erf_vf32(${r} * 0.7071067811865475))`,Ia(t)))},Lo=(e,t)=>{let r=z(e.inputs[0].dataType);e.compute(Ee(e.inputs[0],"LeakyRelu",i=>`select(leaky_relu_alpha_ * ${i}, ${i}, ${i} >= vec4<${r}>(0.0))`,`const leaky_relu_alpha_ = ${r}(${t.alpha});`,t.cacheKey))},qo=e=>{e.compute(Ee(e.inputs[0],"Not",t=>`!${t}`))},Fo=e=>{e.compute(Ee(e.inputs[0],"Neg",t=>`-${t}`))},Vo=e=>{e.compute(Ee(e.inputs[0],"Reciprocal",t=>`1.0/${t}`))},Go=e=>{let t=z(e.inputs[0].dataType);e.compute(Ee(e.inputs[0],"Relu",r=>`select(vec4<${t}>(0.0), ${r}, ${r} > vec4<${t}>(0.0))`))},Wo=e=>{e.compute(Ee(e.inputs[0],"Sigmoid",t=>`(1.0 / (1.0 + exp(-${t})))`))},jo=e=>g(e),Ho=(e,t)=>{let r=z(e.inputs[0].dataType);e.compute(Ee(e.inputs[0],"HardSigmoid",i=>`max(vec4<${r}>(0.0), min(vec4<${r}>(1.0), ${t.alpha} * ${i} + vec4<${r}>(${t.beta})))`,void 0,t.cacheKey))},Ko=e=>{let t=z(e.inputs[0].dataType);e.compute(Ee(e.inputs[0],"HardSwish",r=>`${r} * max(vec4<${t}>(0.0), min(vec4<${t}>(1.0), vec4<${t}>(${t}(1.0 / 6.0)) * ${r} + vec4<${t}>(0.5)))`))},Zo=e=>{e.compute(Ee(e.inputs[0],"Sin","sin"))},Qo=e=>{e.compute(Ee(e.inputs[0],"Sinh","sinh"))},Xo=e=>{e.compute(Ee(e.inputs[0],"Sqrt","sqrt"))},Yo=e=>{e.compute(Ee(e.inputs[0],"Tan","tan"))},_n=e=>`sign(${e}) * (1 - exp(-2 * abs(${e}))) / (1 + exp(-2 * abs(${e})))`,Jo=e=>{e.compute(Ee(e.inputs[0],"Tanh",_n))},wn=(e="f32")=>`
const fast_gelu_a: ${e} = 0.5;
const fast_gelu_b: ${e} = 0.7978845608028654;
const fast_gelu_c: ${e} = 0.035677408136300125;

fn tanh_v(v: vec4<${e}>) -> vec4<${e}> {
  return ${_n("v")};
}
`,$n=e=>`(fast_gelu_a + fast_gelu_a * tanh_v(${e} * (fast_gelu_c * ${e} * ${e} + fast_gelu_b))) * ${e}`,eu=e=>{let t=z(e.inputs[0].dataType);e.compute(Ee(e.inputs[0],"FastGelu",$n,wn(t),void 0,e.inputs[0].dataType))},tu=(e,t)=>{let r=z(e.inputs[0].dataType);return e.compute(Ee(e.inputs[0],"ThresholdedRelu",i=>`select(vec4<${r}>(0.0), ${i}, ${i} > thresholded_relu_alpha_)`,`const thresholded_relu_alpha_ = vec4<${r}>(${t.alpha});`,t.cacheKey)),0},ru=e=>{e.compute(Ee(e.inputs[0],"Log","log"))},iu=(e,t)=>`
const alpha = vec4<${e}>(${t});
const one = ${e}(1.0);
const zero = ${e}(0.0);

fn quick_gelu_impl(x: vec4<${e}>) -> vec4<${e}> {
  let v = x *alpha;
  var x1 : vec4<${e}>;
  for (var i = 0; i < 4; i = i + 1) {
    if (v[i] >= zero) {
      x1[i] = one / (one + exp(-v[i]));
    } else {
      x1[i] = one - one / (one + exp(v[i]));
    }
  }
  return x * x1;
}
`,au=e=>`quick_gelu_impl(${e})`,nu=(e,t)=>{let r=z(e.inputs[0].dataType);e.compute(Ee(e.inputs[0],"QuickGelu",au,iu(r,t.alpha),t.cacheKey,e.inputs[0].dataType))}}),su,ou,uu,Yc=C(()=>{"use strict";ie(),K(),bn(),su=e=>{if(e[0].dims.length!==3)throw new Error("input should have 3 dimensions");if(![2560,5120,10240].includes(e[0].dims[2]))throw new Error("hidden state should be 2560, 5120 or 10240");if(e[1].dims.length!==1)throw new Error("bias is expected to have 1 dimensions");if(e[0].dims[2]!==e[1].dims[0])throw new Error("last dimension of input and bias are not the same")},ou=e=>{let t=e[0].dims.slice();t[2]=t[2]/2;let r=A("input",e[0].dataType,e[0].dims,4),i=A("bias",e[0].dataType,[e[0].dims[2]],4),a=j("output",e[0].dataType,t,4),n=M.size(t)/4,s=B(e[0].dataType);return{name:"BiasSplitGelu",getRunData:()=>({outputs:[{dims:t,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(n/64)}}),getShaderSource:o=>`
  const M_SQRT2 = sqrt(2.0);
  const halfChannels = ${e[0].dims[2]/4/2}u;

  ${o.declareVariables(r,i,a)}

  ${Ia(s)}

  ${o.mainStart()}
    ${o.guardAgainstOutOfBoundsWorkgroupSizes(n)}
    let biasIdx = global_idx % halfChannels;
    let batchIndex = global_idx / halfChannels;
    let inputOffset = biasIdx + batchIndex * halfChannels * 2;
    let valueLeft = input[inputOffset] + bias[biasIdx];
    let valueRight = input[inputOffset + halfChannels] + bias[biasIdx + halfChannels];
    let geluRight = valueRight * 0.5 * (erf_vf32(valueRight / M_SQRT2) + 1);

    ${a.setByOffset("global_idx","valueLeft * geluRight")}
  }`}},uu=e=>{su(e.inputs),e.compute(ou(e.inputs))}}),lu,du,Mt,pu,cu,hu,fu,mu,gu,yu,_u,wu,$u,Jc=C(()=>{"use strict";oe(),ie(),K(),lu=(e,t,r,i,a,n,s,o,u,l,p,d)=>{let h,m;typeof o=="string"?h=m=(y,x)=>`${o}((${y}),(${x}))`:typeof o=="function"?h=m=o:(h=o.scalar,m=o.vector);let f=j("outputData",p,i.length,4),_=A("aData",u,t.length,4),b=A("bData",l,r.length,4),w;if(a)if(n){let y=M.size(t)===1,x=M.size(r)===1,v=t.length>0&&t[t.length-1]%4===0,S=r.length>0&&r[r.length-1]%4===0;y||x?w=f.setByOffset("global_idx",m(y?`${_.type.value}(${_.getByOffset("0")}.x)`:_.getByOffset("global_idx"),x?`${b.type.value}(${b.getByOffset("0")}.x)`:b.getByOffset("global_idx"))):w=`
            let outputIndices = ${f.offsetToIndices("global_idx * 4u")};
            let offsetA = ${_.broadcastedIndicesToOffset("outputIndices",f)};
            let offsetB = ${b.broadcastedIndicesToOffset("outputIndices",f)};
            ${f.setByOffset("global_idx",m(s||v?_.getByOffset("offsetA / 4u"):`${_.type.value}(${_.getByOffset("offsetA / 4u")}[offsetA % 4u])`,s||S?b.getByOffset("offsetB / 4u"):`${b.type.value}(${b.getByOffset("offsetB / 4u")}[offsetB % 4u])`))}
          `}else w=f.setByOffset("global_idx",m(_.getByOffset("global_idx"),b.getByOffset("global_idx")));else{if(!n)throw new Error("no necessary to use scalar implementation for element-wise binary op implementation.");let y=(x,v,S="")=>{let I=`aData[indexA${v}][componentA${v}]`,O=`bData[indexB${v}][componentB${v}]`;return`
            let outputIndices${v} = ${f.offsetToIndices(`global_idx * 4u + ${v}u`)};
            let offsetA${v} = ${_.broadcastedIndicesToOffset(`outputIndices${v}`,f)};
            let offsetB${v} = ${b.broadcastedIndicesToOffset(`outputIndices${v}`,f)};
            let indexA${v} = offsetA${v} / 4u;
            let indexB${v} = offsetB${v} / 4u;
            let componentA${v} = offsetA${v} % 4u;
            let componentB${v} = offsetB${v} % 4u;
            ${x}[${v}] = ${S}(${h(I,O)});
          `};p===9?w=`
            var data = vec4<u32>(0);
            ${y("data",0,"u32")}
            ${y("data",1,"u32")}
            ${y("data",2,"u32")}
            ${y("data",3,"u32")}
            outputData[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:w=`
            ${y("outputData[global_idx]",0)}
            ${y("outputData[global_idx]",1)}
            ${y("outputData[global_idx]",2)}
            ${y("outputData[global_idx]",3)}
          `}return`
        ${e.registerUniform("vec_size","u32").declareVariables(_,b,f)}

        ${d??""}

        ${e.mainStart()}
        ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${w}
      }`},du=(e,t,r,i,a,n,s=r.dataType)=>{let o=r.dims.map(Number),u=i.dims.map(Number),l=!M.areEqual(o,u),p=o,d=M.size(o),h=!1,m=!1,f=[l];if(l){let _=Nt.calcShape(o,u,!1);if(!_)throw new Error("Can't perform binary op on the given tensors");p=_.slice(),d=M.size(p);let b=M.size(o)===1,w=M.size(u)===1,y=o.length>0&&o[o.length-1]%4===0,x=u.length>0&&u[u.length-1]%4===0;f.push(b),f.push(w),f.push(y),f.push(x);let v=1;for(let S=1;S<p.length;S++){let I=o[o.length-S],O=u[u.length-S];if(I===O)v*=I;else break}v%4===0?(m=!0,h=!0):(b||w||y||x)&&(h=!0)}else h=!0;return f.push(h),{name:e,shaderCache:{hint:t+f.map(_=>_.toString()).join("_"),inputDependencies:["rank","rank"]},getShaderSource:_=>lu(_,o,u,p,h,l,m,a,r.dataType,i.dataType,s,n),getRunData:()=>({outputs:[{dims:p,dataType:s}],dispatchGroup:{x:Math.ceil(d/64/4)},programUniforms:[{type:12,data:Math.ceil(M.size(p)/4)},...k(o,u,p)]})}},Mt=(e,t,r,i,a,n)=>{e.compute(du(t,a??"",e.inputs[0],e.inputs[1],r,i,n))},pu=e=>{Mt(e,"Add",(t,r)=>`${t}+${r}`)},cu=e=>{Mt(e,"Div",(t,r)=>`${t}/${r}`)},hu=e=>{Mt(e,"Equal",{scalar:(t,r)=>`u32(${t}==${r})`,vector:(t,r)=>`vec4<u32>(${t}==${r})`},void 0,void 0,9)},fu=e=>{Mt(e,"Mul",(t,r)=>`${t}*${r}`)},mu=e=>{let t=A("input",e.inputs[0].dataType,e.inputs[0].dims).type.value;Mt(e,"Pow",{scalar:(r,i)=>`pow_custom(${r},${i})`,vector:(r,i)=>`pow_vector_custom(${r},${i})`},`
    fn pow_custom(a : ${t}, b : ${t}) -> ${t} {
      if (b == ${t}(0.0)) {
        return ${t}(1.0);
      } else if (a < ${t}(0.0) && f32(b) != floor(f32(b))) {
        return ${t}(pow(f32(a), f32(b))); // NaN
      }
      return select(sign(a), ${t}(1.0), round(f32(abs(b) % ${t}(2.0))) != 1.0) * ${t}(${t==="i32"?"round":""}(pow(f32(abs(a)), f32(b))));
    }
    fn pow_vector_custom(a : vec4<${t}>, b : vec4<${t}>) -> vec4<${t}> {
      // TODO: implement vectorized pow
      return vec4<${t}>(pow_custom(a.x, b.x), pow_custom(a.y, b.y), pow_custom(a.z, b.z), pow_custom(a.w, b.w));
    }
      `)},gu=e=>{Mt(e,"Sub",(t,r)=>`${t}-${r}`)},yu=e=>{Mt(e,"Greater",{scalar:(t,r)=>`u32(${t}>${r})`,vector:(t,r)=>`vec4<u32>(${t}>${r})`},void 0,void 0,9)},_u=e=>{Mt(e,"Less",{scalar:(t,r)=>`u32(${t}<${r})`,vector:(t,r)=>`vec4<u32>(${t}<${r})`},void 0,void 0,9)},wu=e=>{Mt(e,"GreaterOrEqual",{scalar:(t,r)=>`u32(${t}>=${r})`,vector:(t,r)=>`vec4<u32>(${t}>=${r})`},void 0,void 0,9)},$u=e=>{Mt(e,"LessOrEqual",{scalar:(t,r)=>`u32(${t}<=${r})`,vector:(t,r)=>`vec4<u32>(${t}<=${r})`},void 0,void 0,9)}}),bu,vu,xu,Su,Tu,Eu,eh=C(()=>{"use strict";oe(),ie(),$(),K(),bu=(e,t)=>{if(!e||e.length<1)throw new Error("too few inputs");let r=0,i=e[r],a=i.dataType,n=i.dims.length;e.forEach((s,o)=>{if(o!==r){if(s.dataType!==a)throw new Error("input tensors should be one type");if(s.dims.length!==n)throw new Error("input tensors should have the same shape");s.dims.forEach((u,l)=>{if(l!==t&&u!==i.dims[l])throw new Error("non concat dimensions must match")})}})},vu=(e,t)=>`
  fn calculateInputIndex(index: u32) -> u32 {
    let sizeInConcatAxis = array<u32, ${e}u>(${t});
    for (var i: u32 = 0u; i < ${e}; i += 1u ) {
      if (index < sizeInConcatAxis[i]) {
        return i;
      }
    }
    return ${e}u;
  }`,xu=(e,t)=>{let r=e.length,i=[];for(let a=0;a<r;++a){let n=t.setByOffset("global_idx",e[a].getByIndices("indices"));r===1?i.push(n):a===0?i.push(`if (inputIndex == ${a}u) { ${n} }`):a===r-1?i.push(`else { ${n} }`):i.push(`else if (inputIndex == ${a}) { ${n} }`)}return i.join(`
`)},Su=(e,t,r,i)=>{let a=M.size(r),n=new Array(e.length),s=new Array(e.length),o=0,u=[],l=[],p=[{type:12,data:a}];for(let _=0;_<e.length;++_)o+=e[_].dims[t],n[_]=o,l.push(e[_].dims.length),s[_]=A(`input${_}`,i,l[_]),u.push("rank"),p.push({type:12,data:n[_]});for(let _=0;_<e.length;++_)p.push(...k(e[_].dims));p.push(...k(r));let d=j("output",i,r.length),h=d.indicesGet("indices",t),m=Array.from(Array(n.length).keys()).map(_=>`uniforms.sizeInConcatAxis${_}`).join(","),f=_=>`

  ${(()=>{_.registerUniform("outputSize","u32");for(let b=0;b<e.length;b++)_.registerUniform(`sizeInConcatAxis${b}`,"u32");return _.declareVariables(...s,d)})()}

  ${vu(n.length,m)}

  ${_.mainStart()}
    ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

    var indices = ${d.offsetToIndices("global_idx")};

    let inputIndex = calculateInputIndex(${h});
    if (inputIndex != 0u) {
      let sizeInConcatAxis = array<u32, ${n.length}u>(${m});
      ${h} -= sizeInConcatAxis[inputIndex - 1u];
    }

    ${xu(s,d)}
  }`;return{name:"Concat",shaderCache:{hint:`${t}`,inputDependencies:u},getRunData:()=>({outputs:[{dims:r,dataType:i}],dispatchGroup:{x:Math.ceil(a/64)},programUniforms:p}),getShaderSource:f}},Tu=(e,t)=>{let r=e.inputs,i=r[0].dims,a=M.normalizeAxis(t.axis,i.length);bu(r,a);let n=i.slice();n[a]=r.reduce((o,u)=>o+(u.dims.length>a?u.dims[a]:0),0);let s=r.filter(o=>M.size(o.dims)>0);e.compute(Su(s,a,n,r[0].dataType),{inputs:s})},Eu=e=>g({axis:e.axis})}),Pr,Ur,Nr,vn,Lr=C(()=>{"use strict";oe(),ie(),Pr=(e,t,r="f32")=>{switch(e.activation){case"Relu":return`value = max(value, ${t}(0.0));`;case"Sigmoid":return`value = (${t}(1.0) / (${t}(1.0) + exp(-value)));`;case"Clip":return`value = clamp(value, ${t}(${r}(uniforms.clip_min)), ${t}(${r}(uniforms.clip_max)));`;case"HardSigmoid":return`value = max(${t}(0.0), min(${t}(1.0), ${r}(uniforms.alpha) * value + ${r}(uniforms.beta)));`;case"LeakyRelu":return`value = select(${r}(uniforms.alpha) * value, value, value >= ${t}(0.0));`;case"Tanh":return`let e2x = exp(-2.0 * abs(value));
              value = sign(value) * (1.0 - e2x) / (1.0 + e2x);
        `;case"":return"";default:throw new Error(`Unsupported activation ${e.activation}`)}},Ur=(e,t)=>{e.activation==="Clip"?t.push({type:1,data:e.clipMax},{type:1,data:e.clipMin}):e.activation==="HardSigmoid"?t.push({type:1,data:e.alpha},{type:1,data:e.beta}):e.activation==="LeakyRelu"&&t.push({type:1,data:e.alpha})},Nr=(e,t)=>{e.activation==="Clip"?t.push({name:"clip_max",type:"f32"},{name:"clip_min",type:"f32"}):e.activation==="HardSigmoid"?t.push({name:"alpha",type:"f32"},{name:"beta",type:"f32"}):e.activation==="LeakyRelu"&&t.push({name:"alpha",type:"f32"})},vn=e=>{let t=e?.activation||"";if(t==="HardSigmoid"){let[r,i]=e?.activation_params||[.2,.5];return{activation:t,alpha:r,beta:i}}else if(t==="Clip"){let[r,i]=e?.activation_params||[Zi,Et];return{activation:t,clipMax:i,clipMin:r}}else if(t==="LeakyRelu"){let[r]=e?.activation_params||[.01];return{activation:t,alpha:r}}return{activation:t}}}),Ke,ku,xn=C(()=>{"use strict";Ke=(e,t)=>{switch(e){case 1:return t;case 2:return`vec2<${t}>`;case 3:return`vec3<${t}>`;case 4:return`vec4<${t}>`;default:throw new Error(`${e}-component is not supported.`)}},ku=e=>`
      ${e?"value = value + getBiasByOutputCoords(coords);":""}
      `}),Iu,th=C(()=>{"use strict";Iu=e=>`
fn getIndexFromCoords4D(coords : vec4<i32>, shape : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
      shape.y * shape.z * shape.w, shape.z * shape.w, shape.w, 1));
}
fn getOutputIndexFromCoords(coords : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
    i32(${e}.x), i32(${e}.y), i32(${e}.z), 1));
}
`}),oa,Sn,Tn=C(()=>{"use strict";oe(),ie(),K(),Lr(),oa=(e,t,r,i,a)=>{let n=i-r;return`
      ${Array.from({length:r}).map((s,o)=>`
      if (${D(t.shape,o,t.rank)} != 1) {
        ${t.indicesSet(e,o,D(a,o+n,i))}
      } else {
        ${t.indicesSet(e,o,0)}
      }`).join("")}
`},Sn=(e,t,r,i,a=!1,n)=>{let s=e[0].dims,o=e[1].dims,u=s[s.length-2],l=o[o.length-1],p=s[s.length-1],d=R(l),h=R(p),m=R(u),f=M.size(r)/d/m,_=e.length>2,b=i?i.slice(0,-2):r.slice(0,-2),w=[M.size(b),u,l],y=[{type:12,data:f},{type:12,data:u},{type:12,data:l},{type:12,data:p}];Ur(t,y),y.push(...k(b,s,o)),_&&y.push(...k(e[2].dims)),y.push(...k(w));let x=v=>{let S=ce("batch_dims",e[0].dataType,b.length),I=A("a",e[0].dataType,s.length,h),O=A("b",e[1].dataType,o.length,d),P=j("output",e[0].dataType,w.length,d),V=B(P.type.tensor),Q=Pr(t,P.type.value,V),ye=[I,O],ae="";if(_){let X=a?d:1;ye.push(A("bias",e[2].dataType,e[2].dims.length,X)),ae=`${a?`value += bias[col / ${X}];`:`value += ${P.type.value}(bias[row + i]);`}`}let ne=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"}];Nr(t,ne);let ke=()=>{let X=`var a_data: ${I.type.value};`;for(let ee=0;ee<h;ee++)X+=`
              let b_data${ee} = b[(b_offset + (k + ${ee}) * uniforms.N + col) / ${d}];`;for(let ee=0;ee<m;ee++){X+=`a_data = a[(a_offset + (row + ${ee}) * uniforms.K + k) / ${h}];`;for(let ge=0;ge<h;ge++)X+=`
            values[${ee}] = fma(${O.type.value}(a_data${h===1?"":`[${ge}]`}), b_data${ge}, values[${ee}]);
`}return X};return`
  ${v.registerUniforms(ne).registerInternalVariables(S).declareVariables(...ye,P)}
  ${v.mainStart()}
    ${v.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let col = (global_idx % (uniforms.N / ${d})) * ${d};
    var index1 = global_idx / (uniforms.N / ${d});
    let stride1 = uniforms.M / ${m};
    let row = (index1 % stride1) * ${m};
    let batch = index1 / stride1;

    ${r.length===2?"":`let batch_indices = ${S.offsetToIndices("batch")};`}

    var a_indices: ${I.type.indices};
    ${oa("a_indices",I,I.rank-2,S.rank,"batch_indices")}
    ${I.indicesSet("a_indices",I.rank-2,0)}
    ${I.indicesSet("a_indices",I.rank-1,0)}
    let a_offset = ${I.indicesToOffset("a_indices")};

    var b_indices: ${O.type.indices};
    ${oa("b_indices",O,O.rank-2,S.rank,"batch_indices")}
    ${O.indicesSet("b_indices",O.rank-2,0)}
    ${O.indicesSet("b_indices",O.rank-1,0)}
    let b_offset = ${O.indicesToOffset("b_indices")};
    var values: array<${P.type.value}, ${m}>;
    for (var k: u32 = 0u; k < uniforms.K; k = k + ${h}) {
      ${ke()}
    }
    for (var i = 0u; i < ${m}u; i++) {
      var value = values[i];
      ${ae}
      ${Q}
      let cur_indices = ${P.type.indices}(batch, row + i, col);
      let offset = ${P.indicesToOffset("cur_indices")};
      ${P.setByOffset(`offset / ${d}`,"value")};
    }
  }
  `};return{name:"MatMulNaive",shaderCache:{hint:`${t.activation};${d};${h};${m};${a}`,inputDependencies:_?["rank","rank","rank"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:n?n(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(f/64)},programUniforms:y}),getShaderSource:x}}}),zu,Cu,En,kn,Au,In,Ou,za,zn=C(()=>{"use strict";oe(),ie(),K(),Lr(),Tn(),xn(),zu=(e,t)=>e?`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          kStart + inputRow,
          globalRowStart / innerElementSize + inputCol${t?", batchIndices":""});
        `:`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          globalRow + innerRow,
          kStart / innerElementSize + inputCol${t?", batchIndices":""});
        `,Cu=(e,t)=>e?`
        let ACached0 = mm_Asub[k * innerElementSize][localRow];
        let ACached1 = mm_Asub[k * innerElementSize + 1][localRow];
        let ACached2 = mm_Asub[k * innerElementSize + 2][localRow];
        ${t===3?"":"let ACached3 = mm_Asub[k * innerElementSize + 3][localRow];"}
        for (var i = 0; i < rowPerThread; i = i + 1) {
          acc[i] = BCached0 * ACached0[i] + acc[i];
          acc[i] = BCached1 * ACached1[i] + acc[i];
          acc[i] = BCached2 * ACached2[i] + acc[i];
          ${t===3?"":"acc[i] = BCached3 * ACached3[i] + acc[i];"}
        }`:`
        for (var i = 0; i < rowPerThread; i = i + 1) {
          let ACached = mm_Asub[tileRow + i][k];
          acc[i] = BCached0 * ACached.x + acc[i];
          acc[i] = BCached1 * ACached.y + acc[i];
          acc[i] = BCached2 * ACached.z + acc[i];
          ${t===3?"":"acc[i] = BCached3 * ACached.w + acc[i];"}
        }`,En=(e,t,r="f32",i,a=!1,n=32,s=!1,o=32)=>{let u=t[1]*e[1],l=t[0]*e[0],p=a?u:n,d=a?n:u,h=p/t[0],m=n/t[1];if(!((a&&h===4&&e[1]===4||!a&&(h===3||h===4))&&p%t[0]===0&&n%t[1]===0&&e[0]===4))throw new Error(`If transposeA ${a} is true, innerElementSize ${h} and workPerThread[1] ${e[1]} must be 4.
      Otherwise, innerElementSize ${h} must be 3 or 4.
  tileAWidth ${p} must be divisible by workgroupSize[0]${t[0]}. tileInner ${n} must be divisible by workgroupSize[1] ${t[1]}. colPerThread ${e[0]} must be 4.`);return`
var<workgroup> mm_Asub: array<array<vec${h}<${r}>, ${p/h}>, ${d}>;
var<workgroup> mm_Bsub: array<array<vec4<${r}>, ${l/e[0]}>, ${n}>;

const rowPerThread = ${e[1]};
const colPerThread = ${e[0]};
const innerElementSize = ${h};
const tileInner = ${n};

@compute @workgroup_size(${t[0]}, ${t[1]}, ${t[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
  let localRow = i32(localId.y);
  let tileRow = localRow * rowPerThread;
  let tileCol = i32(localId.x);

  let globalRow =i32(globalId.y) * rowPerThread;
  let globalCol = i32(globalId.x);
  let batch = ${s?"0":"i32(globalId.z)"};
  ${i?`let batchIndices = ${i.offsetToIndices("u32(batch)")};`:""}
  let globalRowStart = i32(workgroupId.y) * ${u};

  let num_tiles = ${s?`${Math.ceil(o/n)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
  var kStart = ${s?`i32(globalId.z) * ${o}`:"0"};

  var acc: array<vec4<${r}>, rowPerThread>;

  // Loop over shared dimension.
  let tileRowB = localRow * ${m};
  for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let inputRow = tileRow + innerRow;
          let inputCol = tileCol;
          ${zu(a,i)}
      }

      // Load one tile of B into local memory.
      for (var innerRow = 0; innerRow < ${m}; innerRow = innerRow + 1) {
          let inputRow = tileRowB + innerRow;
          let inputCol = tileCol;
          mm_Bsub[inputRow][inputCol] = mm_readB(batch, kStart + inputRow, globalCol${i?", batchIndices":""});
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      for (var k = 0; k < tileInner / innerElementSize; k = k + 1) {
          let BCached0 = mm_Bsub[k * innerElementSize][tileCol];
          let BCached1 = mm_Bsub[k * innerElementSize + 1][tileCol];
          let BCached2 = mm_Bsub[k * innerElementSize + 2][tileCol];
          ${h===3?"":"let BCached3 = mm_Bsub[k * innerElementSize + 3][tileCol];"}

          ${Cu(a,h)}
      }

      workgroupBarrier();
  }

  for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      mm_write(batch, globalRow + innerRow, globalCol, acc[innerRow]);
  }
}`},kn=(e,t)=>e?`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              kStart + inputRow,
              globalRowStart + inputCol${t?", batchIndices":""});
            `:`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              globalRowStart + inputRow,
              kStart + inputCol${t?", batchIndices":""});
            `,Au=e=>e?"let ACached = mm_Asub[k][tileRow + innerRow];":"let ACached = mm_Asub[tileRow + innerRow][k];",In=(e,t,r="f32",i,a=!1,n=32,s=!1,o=32,u=!1)=>{let l=e[1]*t[1],p=e[0]*t[0],d=a?l:n,h=a?n:l;if(!(h%t[1]===0&&d%t[0]===0&&n%t[1]===0))throw new Error(`tileAHight ${h} must be divisible by workgroupSize[1]${t[1]}, tileAWidth ${d} must be divisible by workgroupSize[0]${t[0]}, tileInner ${n} must be divisible by workgroupSize[1]${t[1]}`);let m=h/t[1],f=d/t[0],_=n/t[1],b=u?`
    let localRow = i32(localId.y);
    let localCol = i32(localId.x);
    let globalRowStart = i32(workgroupId.y) * ${l};
    let globalColStart = i32(workgroupId.x) * ${p};

    // Loop over shared dimension.
    for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var inputRow = localRow; inputRow < ${h}; inputRow = inputRow + ${t[1]}) {
        for (var inputCol = localCol; inputCol < ${d}; inputCol = inputCol + ${t[0]}) {
          ${kn(a,i)}
        }
      }
      // Load one tile of B into local memory.
      for (var inputRow = localRow; inputRow < ${n}; inputRow = inputRow + ${t[1]}) {
            for (var inputCol = localCol; inputCol < ${p}; inputCol = inputCol + ${t[0]}) {
          mm_Bsub[inputRow][inputCol] = mm_readB(batch,
            kStart + inputRow,
            globalColStart + inputCol${i?", batchIndices":""});
        }
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      var BCached : array<${r}, colPerThread>;
      for (var k = 0; k < tileInner; k = k + 1) {
        for (var inner = 0; inner < colPerThread; inner = inner + 1) {
          BCached[inner] = mm_Bsub[k][localCol + inner * ${t[0]}];
        }
        for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let ACached = ${a?`mm_Asub[k][localRow + innerRow * ${t[1]}];`:`mm_Asub[localRow + innerRow * ${t[1]}][k];`}
          for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
            acc[innerRow][innerCol] = acc[innerRow][innerCol] +
                ACached * BCached[innerCol];
          }
        }
      }
      workgroupBarrier();
    }
    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      let gRow = globalRowStart + localRow + innerRow * ${t[1]};
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        let gCol = globalColStart + localCol + innerCol * ${t[0]};
        mm_write(batch, gRow, gCol, acc[innerRow][innerCol]);
      }
    }
    `:`
let tileRow = i32(localId.y) * rowPerThread;
let tileCol = i32(localId.x) * colPerThread;

let globalRow = i32(globalId.y) * rowPerThread;
let globalCol = i32(globalId.x) * colPerThread;
let globalRowStart = i32(workgroupId.y) * ${l};

let tileRowA = i32(localId.y) * ${m};
let tileColA = i32(localId.x) * ${f};
let tileRowB = i32(localId.y) * ${_};
// Loop over shared dimension.
for (var t = 0; t < num_tiles; t = t + 1) {
  // Load one tile of A into local memory.
  for (var innerRow = 0; innerRow < ${m}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < ${f}; innerCol = innerCol + 1) {
      let inputRow = tileRowA + innerRow;
      let inputCol = tileColA + innerCol;
      ${kn(a,i)}
    }
  }

  // Load one tile of B into local memory.
  for (var innerRow = 0; innerRow < ${_}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
      let inputRow = tileRowB + innerRow;
      let inputCol = tileCol + innerCol;
      mm_Bsub[inputRow][inputCol] = mm_readB(batch,
        kStart + inputRow,
        globalCol + innerCol${i?", batchIndices":""});
    }
  }
  kStart = kStart + tileInner;
  workgroupBarrier();

  // Compute acc values for a single thread.
  var BCached : array<${r}, colPerThread>;
  for (var k = 0; k < tileInner; k = k + 1) {
    for (var inner = 0; inner < colPerThread; inner = inner + 1) {
      BCached[inner] = mm_Bsub[k][tileCol + inner];
    }

    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      ${Au(a)}
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        acc[innerRow][innerCol] = acc[innerRow][innerCol] + ACached * BCached[innerCol];
      }
    }
  }

  workgroupBarrier();
}

for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
  for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
    mm_write(batch, globalRow + innerRow, globalCol + innerCol,
        acc[innerRow][innerCol]);
  }
}
`;return`
  var<workgroup> mm_Asub : array<array<${r}, ${d}>, ${h}>;
  var<workgroup> mm_Bsub : array<array<${r}, ${p}>, ${n}>;
  const rowPerThread = ${e[1]};
  const colPerThread = ${e[0]};
  const tileInner = ${n};

@compute @workgroup_size(${t[0]}, ${t[1]}, ${t[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
    let batch = ${s?"0":"i32(globalId.z)"};
    ${i?`let batchIndices = ${i.offsetToIndices("u32(batch)")};`:""}
    let num_tiles = ${s?`${Math.ceil(o/n)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
    var kStart = ${s?`i32(globalId.z) * ${o}`:"0"};

    var acc : array<array<${r}, colPerThread>, rowPerThread>;
    ${b}
  }
`},Ou=(e,t,r,i,a=!1)=>{let[n,s,o,u]=i,l=B(i[0].type.tensor);return`
    fn mm_readA(batch: i32, row: i32, colIn: i32, batchIndices: ${n.type.indices}) -> ${Ke(e,l)} {
      var value = ${Ke(e,l)}(0.0);
      let col = colIn * ${e};
      if(row < uniforms.dim_a_outer && col < uniforms.dim_inner)
      {
        var aIndices: ${s.type.indices};
        ${oa("aIndices",s,s.rank-2,n.rank,"batchIndices")}
        ${s.indicesSet("aIndices",s.rank-2,"u32(row)")}
        ${s.indicesSet("aIndices",s.rank-1,"u32(colIn)")}
        value = ${s.getByIndices("aIndices")};
      }
      return value;
    }

    fn mm_readB(batch: i32, row: i32, colIn: i32, batchIndices: ${n.type.indices}) -> ${Ke(e,l)} {
      var value = ${Ke(e,l)}(0.0);
      let col = colIn * ${e};
      if(row < uniforms.dim_inner && col < uniforms.dim_b_outer)
      {
        var bIndices: ${o.type.indices};
        ${oa("bIndices",o,o.rank-2,n.rank,"batchIndices")}
        ${o.indicesSet("bIndices",o.rank-2,"u32(row)")}
        ${o.indicesSet("bIndices",o.rank-1,"u32(colIn)")}
        value = ${o.getByIndices("bIndices")};
      }
      return value;
    }

    fn mm_write(batch: i32, row: i32, colIn: i32, valueIn: ${Ke(e,l)}) {
      let col = colIn * ${e};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer) {
        var value = valueIn;
        let coords = vec3<i32>(batch, row, colIn);
        ${t?`value = value + ${a?"bias[colIn]":`${Ke(e,l)}(bias[row])`};`:""}
        ${r}
        ${u.setByIndices("vec3<u32>(coords)","value")}
      }
    }
    `},za=(e,t,r,i,a=!1,n)=>{let s=e[0].dims,o=e[1].dims,u=s.slice(0,-2),l=o.slice(0,-2),p=i?i.slice(0,-2):r.slice(0,-2),d=M.size(p),h=s[s.length-2],m=s[s.length-1],f=o[o.length-1],_=m%4===0&&f%4===0,b=h<=8?[4,1,1]:[4,4,1],w=[8,8,1],y=[Math.ceil(f/w[0]/b[0]),Math.ceil(h/w[1]/b[1]),Math.ceil(d/w[2]/b[2])],x=_?4:1,v=[...u,h,m/x],S=v.length,I=[...l,m,f/x],O=I.length,P=[d,h,f/x],V=[{type:6,data:h},{type:6,data:f},{type:6,data:m}];Ur(t,V),V.push(...k(p,v,I));let Q=["rank","rank"],ye=e.length>2;ye&&(V.push(...k(e[2].dims)),Q.push("rank")),V.push(...k(P));let ae=ne=>{let ke=p.length,X=ce("batchDims",e[0].dataType,ke,1),ee=B(e[0].dataType),ge=A("a",e[0].dataType,S,x),we=A("b",e[1].dataType,O,x),he=j("result",e[0].dataType,P.length,x),ve=[ge,we];if(ye){let Qe=a?x:1;ve.push(A("bias",e[2].dataType,e[2].dims.length,Qe))}let W=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"}];Nr(t,W);let pe=B(he.type.tensor),se=Pr(t,he.type.value,pe),Y=Ou(x,ye,se,[X,ge,we,he],a);return`
  ${ne.registerUniforms(W).registerInternalVariables(X).declareVariables(...ve,he)}
  ${Y}
  ${_?En(b,w,ee,X):In(b,w,ee,X)}
                   `};return{name:"MatMul",shaderCache:{hint:`${b};${t.activation};${_};${a}`,inputDependencies:Q},getRunData:()=>({outputs:[{dims:n?n(r):r,dataType:e[0].dataType}],dispatchGroup:{x:y[0],y:y[1],z:y[2]},programUniforms:V}),getShaderSource:ae}}}),Ru,Bu,rh=C(()=>{"use strict";oe(),ht(),K(),Lr(),xn(),th(),zn(),Ru=(e,t,r,i,a=!1,n,s=4,o=4,u=4,l="f32")=>{let p=V=>{switch(V){case 1:return"resData = x[xIndex];";case 3:return`resData = vec3<${l}>(x[xIndex], x[xIndex + 1], x[xIndex + 2]);`;case 4:return"resData = x[xIndex / 4];";default:throw new Error(`innerElementSize ${V} is not supported.`)}},d=V=>{switch(V){case 1:return"return w[row * i32(uniforms.w_shape[3]) + colIn];";case 4:return"return w[row * i32(uniforms.w_shape[3]) / 4 + colIn];";default:throw new Error(`innerElementSize ${V} is not supported.`)}},h=e?`
    let coord = vec4<i32>(batch, xRow, xCol, xCh);
    `:`
    let coord = vec4<i32>(batch, xCh, xRow, xCol);
    `,m=e?`
    let coords = vec4<i32>(
      batch,
      row / outWidth,
      row % outWidth,
      col);
    `:`
    let coords = vec4<i32>(
      batch,
      row,
      col / outWidth,
      col % outWidth);
    `,f=e?"i32(uniforms.x_shape[1])":"i32(uniforms.x_shape[2])",_=e?"i32(uniforms.x_shape[2])":"i32(uniforms.x_shape[3])",b=e?"row":"col",w=e?"col":"row",y=`
    let inChannels = i32(uniforms.w_shape[2]);
    let outWidth = ${e?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
    let outRow = ${b} / outWidth;
    let outCol = ${b} % outWidth;

    let WRow = ${w} / (i32(uniforms.w_shape[1]) * inChannels);
    let WCol = ${w} / inChannels % i32(uniforms.w_shape[1]);
    let xRow = outRow * uniforms.stride[0] + uniforms.dilation[0] * WRow - uniforms.pad[0];
    let xCol = outCol * uniforms.stride[1] + uniforms.dilation[1] * WCol - uniforms.pad[1];
    let xCh = ${w} % inChannels;
    var resData = ${Ke(s,l)}(0.0);
    // The bounds checking is always needed since we use it to pad zero for
    // the 'same' padding type.
    if (xRow >= 0 && xRow < ${f} && xCol >= 0 && xCol < ${_}) {
      ${h}
      let xIndex = getIndexFromCoords4D(coord, vec4<i32>(uniforms.x_shape));
      ${p(s)}
    }
    return resData;`,x=e?t&&i?`
    let col = colIn * ${s};
    ${y}`:`
    let col = colIn * ${s};
    if (row < uniforms.dim_a_outer && col < uniforms.dim_inner) {
      ${y}
    }
    return ${Ke(s,l)}(0.0);`:i&&r?`
    let col = colIn * ${s};
    ${y}`:`
    let col = colIn * ${s};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${y}
    }
    return ${Ke(s,l)}(0.0);`,v=e?i&&r?d(o):`
    let col = colIn * ${o};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${d(o)}
    }
    return ${Ke(o,l)}(0.0);`:`
    let col = colIn * ${o};
    if (row < uniforms.dim_inner && col < uniforms.dim_a_outer) {
      ${d(o)}
    }
    return ${Ke(o,l)}(0.0);`,S=Ke(u,l),I=Ke(e?s:o,l),O=Ke(e?o:s,l),P=Pr(n,S,l);return`
    fn mm_readA(batch: i32, row : i32, colIn : i32) -> ${I} {
      ${e?x:v}
    }

    fn mm_readB(batch: i32, row : i32, colIn : i32) -> ${O} {
      ${e?v:x}
    }

    fn mm_write(batch: i32, row : i32, colIn : i32, valueIn : ${S}) {
      let col = colIn * ${u};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer)
      {
      var value = valueIn;
      let outWidth = ${e?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
      ${m}
      ${ku(a)}
      ${P}
      setOutputAtCoords(coords[0], coords[1], coords[2], coords[3], value);
      }
    }`},Bu=(e,t,r,i,a,n,s,o,u)=>{let l=t.format==="NHWC",p=l?e[0].dims[3]:e[0].dims[1],d=r[0],h=l?r[2]:r[3],m=l?r[1]:r[2],f=l?r[3]:r[1],_=l&&(p%4===0||p%3===0)&&f%4===0,b=l?f:h*m,w=l?h*m:f,y=[8,8,1],x=i<=8?[4,1,1]:[4,4,1],v=[Math.ceil(b/y[0]/x[0]),Math.ceil(w/y[1]/x[1]),Math.ceil(d/y[2]/x[2])];$e("verbose",()=>`[conv2d_mm_webgpu] dispatch = ${v}`);let S=_?l&&p%4!==0?3:4:1,I=y[1]*x[1],O=y[0]*x[0],P=Math.max(y[0]*S,y[1]),V=i%I===0,Q=a%O===0,ye=n%P===0,ae=_?[S,4,4]:[1,1,1],ne=[{type:6,data:i},{type:6,data:a},{type:6,data:n},{type:6,data:[t.pads[0],t.pads[1]]},{type:6,data:t.strides},{type:6,data:t.dilations}];Ur(t,ne),ne.push(...k(e[0].dims,e[1].dims));let ke=["rank","rank"];s&&(ne.push(...k(e[2].dims)),ke.push("rank")),ne.push(...k(r));let X=ee=>{let ge=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"},{name:"pad",type:"i32",length:2},{name:"stride",type:"i32",length:2},{name:"dilation",type:"i32",length:2}];Nr(t,ge);let we=_?4:1,he=B(e[0].dataType),ve=`
      fn setOutputAtIndex(flatIndex : i32, value : ${_?`vec4<${he}>`:he}) {
        result[flatIndex] = ${_?`vec4<${he}>`:he}(value);
      }
      fn setOutputAtCoords(d0 : i32, d1 : i32, d2 : i32, d3 : i32, value : ${_?`vec4<${he}>`:he}) {
        let flatIndex = getOutputIndexFromCoords(vec4<i32>(d0, d1, d2, d3));
        setOutputAtIndex(flatIndex ${_?"/ 4":""}, value);
      }`,W=A("x",e[0].dataType,e[0].dims.length,S===3?1:S),pe=A("w",e[1].dataType,e[1].dims.length,we),se=[W,pe],Y=j("result",e[0].dataType,r.length,we);if(s){let Qe=A("bias",e[2].dataType,e[2].dims.length,we);se.push(Qe),ve+=`
        fn getBiasByOutputCoords(coords : vec4<i32>) -> ${_?`vec4<${he}>`:he} {
          return bias[coords.${l?"w":"y"}${_?"/ 4":""}];
        }`}return`
        ${Iu("uniforms.result_strides")}
        //struct Uniforms { xShape : vec4<i32>, wShape : vec4<i32>, outShape : vec4<i32>,
        //  outShapeStrides: vec3<i32>, filterDims : vec2<i32>, pad : vec2<i32>, stride : vec2<i32>,
        //  dilation : vec2<i32>, dimAOuter : i32, dimBOuter : i32, dimInner : i32 };
        ${ee.registerUniforms(ge).declareVariables(...se,Y)}
        ${ve}
        ${Ru(l,V,Q,ye,s,t,ae[0],ae[1],ae[2],he)}
        ${_?En(x,y,he,void 0,!l,P):In(x,y,he,void 0,!l,P,!1,void 0,o)}`};return{name:"Conv2DMatMul",shaderCache:{hint:`${t.cacheKey};${S};${_};${V};${Q};${ye};${I};${O};${P}`,inputDependencies:ke},getRunData:()=>({outputs:[{dims:u?u(r):r,dataType:e[0].dataType}],dispatchGroup:{x:v[0],y:v[1],z:v[2]},programUniforms:ne}),getShaderSource:X}}}),Mu,Cn,ua,Du,An,Pu,Uu,Nu,ih=C(()=>{"use strict";oe(),ht(),ie(),K(),Lr(),xn(),Mu=e=>{let t=1;for(let r=0;r<e.length;r++)t*=e[r];return t},Cn=e=>typeof e=="number"?[e,e,e]:e,ua=(e,t)=>t<=1?e:e+(e-1)*(t-1),Du=(e,t,r,i=1)=>{let a=ua(t,i);return Math.floor((e[0]*(r-1)-r+a)/2)},An=(e,t,r,i,a)=>{a==null&&(a=Du(e,t[0],i[0]));let n=[0,0,0,r];for(let s=0;s<3;s++)e[s]+2*a>=t[s]&&(n[s]=Math.trunc((e[s]-t[s]+2*a)/i[s]+1));return n},Pu=(e,t,r,i,a,n,s,o,u,l)=>{let p,d,h,m;if(e==="VALID"&&(e=0),typeof e=="number"){p={top:e,bottom:e,left:e,right:e,front:e,back:e};let f=An([t,r,i,1],[o,u,l],1,[a,n,s],e);d=f[0],h=f[1],m=f[2]}else if(Array.isArray(e)){if(!e.every((_,b,w)=>_===w[0]))throw Error(`Unsupported padding parameter: ${e}`);p={top:e[0],bottom:e[1],left:e[2],right:e[3],front:e[4],back:e[5]};let f=An([t,r,i,1],[o,u,l],1,[a,n,s],e[0]);d=f[0],h=f[1],m=f[2]}else if(e==="SAME_UPPER"){d=Math.ceil(t/a),h=Math.ceil(r/n),m=Math.ceil(i/s);let f=(d-1)*a+o-t,_=(h-1)*n+u-r,b=(m-1)*s+l-i,w=Math.floor(f/2),y=f-w,x=Math.floor(_/2),v=_-x,S=Math.floor(b/2),I=b-S;p={top:x,bottom:v,left:S,right:I,front:w,back:y}}else throw Error(`Unknown padding parameter: ${e}`);return{padInfo:p,outDepth:d,outHeight:h,outWidth:m}},Uu=(e,t,r,i,a,n=!1,s="channelsLast")=>{let o,u,l,p,d;if(s==="channelsLast")[o,u,l,p,d]=e;else if(s==="channelsFirst")[o,d,u,l,p]=e;else throw new Error(`Unknown dataFormat ${s}`);let[h,,m,f,_]=t,[b,w,y]=Cn(r),[x,v,S]=Cn(i),I=ua(m,x),O=ua(f,v),P=ua(_,S),{padInfo:V,outDepth:Q,outHeight:ye,outWidth:ae}=Pu(a,u,l,p,b,w,y,I,O,P),ne=n?h*d:h,ke=[0,0,0,0,0];return s==="channelsFirst"?ke=[o,ne,Q,ye,ae]:s==="channelsLast"&&(ke=[o,Q,ye,ae,ne]),{batchSize:o,dataFormat:s,inDepth:u,inHeight:l,inWidth:p,inChannels:d,outDepth:Q,outHeight:ye,outWidth:ae,outChannels:ne,padInfo:V,strideDepth:b,strideHeight:w,strideWidth:y,filterDepth:m,filterHeight:f,filterWidth:_,effectiveFilterDepth:I,effectiveFilterHeight:O,effectiveFilterWidth:P,dilationDepth:x,dilationHeight:v,dilationWidth:S,inShape:e,outShape:ke,filterShape:t}},Nu=(e,t,r,i,a,n)=>{let s=n==="channelsLast",o=s?e[0].dims[3]:e[0].dims[1],u=!1,l=[64,1,1],p={x:r.map((y,x)=>x)},d=[Math.ceil(Mu(p.x.map(y=>r[y]))/l[0]),1,1];$e("verbose",()=>`[conv3d_naive_webgpu] dispatch = ${d}`);let h=u?s&&o%4!==0?3:4:1,m=M.size(r),f=[{type:12,data:m},{type:12,data:i},{type:12,data:a},{type:12,data:t.strides},{type:12,data:t.dilations}];Ur(t,f),f.push(...k(e[0].dims,e[1].dims));let _=["rank","rank"],b=e.length===3;b&&(f.push(...k(e[2].dims)),_.push("rank")),f.push(...k(r));let w=y=>{let x=[{name:"output_size",type:"u32"},{name:"filter_dims",type:"u32",length:i.length},{name:"pads",type:"u32",length:a.length},{name:"strides",type:"u32",length:t.strides.length},{name:"dilations",type:"u32",length:t.dilations.length}];Nr(t,x);let v=u?4:1,S=B(e[0].dataType),I=A("x",e[0].dataType,e[0].dims.length,h===3?1:h),O=A("W",e[1].dataType,e[1].dims.length,v),P=[I,O],V=j("result",e[0].dataType,r.length,v),Q="";if(b){let ne=A("bias",e[2].dataType,e[2].dims.length,v);P.push(ne),Q+=`
        fn getBiasByOutputCoords(coords : array<u32, 5>) -> ${u?`vec4<${S}>`:S} {
          return bias[${s?D("coords",4,5):D("coords",1,5)}${u?"/ 4":""}];
        }`}let ye=Ke(h,S),ae=Pr(t,ye,S);return`
            ${Q}
            fn getX(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> ${S} {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${I.getByIndices("aIndices")};
            }
            fn getW(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> ${S} {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${O.getByIndices("aIndices")};
            }
          ${y.registerUniforms(x).declareVariables(...P,V)}
          ${y.mainStart()}
          ${y.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
              let coords = ${V.offsetToIndices("global_idx")};
              let batch = ${D("coords",0,I.rank)};
              let d2 = ${s?D("coords",I.rank-1,I.rank):D("coords",1,I.rank)};
              let xFRCCorner = vec3<u32>(${s?D("coords",1,I.rank):D("coords",2,I.rank)},
              ${s?D("coords",2,I.rank):D("coords",3,I.rank)},
              ${s?D("coords",3,I.rank):D("coords",4,I.rank)}) * uniforms.strides - uniforms.pads;
              let xFCorner = xFRCCorner.x;
              let xRCorner = xFRCCorner.y;
              let xCCorner = xFRCCorner.z;
              let xShapeY = ${s?D("uniforms.x_shape",1,I.rank):D("uniforms.x_shape",2,I.rank)};
              let xShapeZ = ${s?D("uniforms.x_shape",2,I.rank):D("uniforms.x_shape",3,I.rank)};
              let xShapeW = ${s?D("uniforms.x_shape",3,I.rank):D("uniforms.x_shape",4,I.rank)};
              let xShapeU = ${s?D("uniforms.x_shape",4,I.rank):D("uniforms.x_shape",1,I.rank)};
              let inputDepthNearestVec4 = (xShapeU / 4) * 4;
              let inputDepthVec4Remainder = xShapeU % 4;

              var value = ${S}(0);
              for (var wF = 0u; wF < uniforms.filter_dims[0]; wF++) {
                let xF = xFCorner + wF * uniforms.dilations[0];
                if (xF < 0 || xF >= xShapeY) {
                  continue;
                }

                for (var wR = 0u; wR < uniforms.filter_dims[1]; wR++) {
                  let xR = xRCorner + wR * uniforms.dilations[1];
                  if (xR < 0 || xR >= xShapeZ) {
                    continue;
                  }

                  for (var wC = 0u; wC < uniforms.filter_dims[2]; wC++) {
                    let xC = xCCorner + wC * uniforms.dilations[2];
                    if (xC < 0 || xC >= xShapeW) {
                      continue;
                    }

                    for (var d1 = 0u; d1 < inputDepthNearestVec4; d1 += 4) {
                      ${s?`let xValues = vec4<${S}>(
                               getX(batch, xF, xR, xC, d1),
                               getX(batch, xF, xR, xC, d1 + 1),
                               getX(batch, xF, xR, xC, d1 + 2),
                               getX(batch, xF, xR, xC, d1 + 3));
                            `:`let xValues = vec4<${S}>(
                               getX(batch, d1, xF, xR, xC),
                               getX(batch, d1 + 1, xF, xR, xC),
                               getX(batch, d1 + 2, xF, xR, xC),
                               getX(batch, d1 + 3, xF, xR, xC));
                            `}
                            let wValues = vec4<${S}>(
                              getW(d2, d1, wF, wR, wC),
                              getW(d2, d1 + 1, wF, wR, wC),
                              getW(d2, d1 + 2, wF, wR, wC),
                              getW(d2, d1 + 3, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                    if (inputDepthVec4Remainder == 1) {
                        ${s?`value += getX(batch, xF, xR, xC, inputDepthNearestVec4)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`:`value += getX(batch, inputDepthNearestVec4, xF, xR, xC)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`}
                    } else if (inputDepthVec4Remainder == 2) {
                      ${s?`let xValues = vec2<${S}>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1));
                      `:`let xValues = vec2<${S}>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC));
                    `}
                    let wValues = vec2<${S}>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC));
                      value += dot(xValues, wValues);
                    } else if (inputDepthVec4Remainder == 3) {
                      ${s?`let xValues = vec3<${S}>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 2));
                      `:`let xValues = vec3<${S}>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 2, xF, xR, xC));
                    `}
                    let wValues = vec3<${S}>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 2, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                  }
                }
              }
              ${b?"value = value + getBiasByOutputCoords(coords)":""};
              ${ae}
              result[global_idx] = ${S}(value);
          }`};return{name:"Conv3DNaive",shaderCache:{hint:`${t.cacheKey};${s};${h};${b}`,inputDependencies:_},getRunData:()=>({outputs:[{dims:r,dataType:e[0].dataType}],dispatchGroup:{x:d[0],y:d[1],z:d[2]},programUniforms:f}),getShaderSource:w}}}),Lu,qu,ah=C(()=>{"use strict";oe(),ie(),K(),Lr(),Lu=(e,t,r,i)=>{let a=e.length>2,n=a?"value += b[output_channel];":"",s=e[0].dims,o=e[1].dims,u=t.format==="NHWC",l=u?r[3]:r[1],p=l/t.group,d=u&&p>=4?R(l):1,h=M.size(r)/d,m=[{type:12,data:h},{type:12,data:t.dilations},{type:12,data:[t.strides[0],t.strides[1]]},{type:12,data:[t.pads[0],t.pads[1]]},{type:12,data:p}];Ur(t,m),m.push(...k(s,[o[0],o[1],o[2],o[3]/d]));let f=a?["rank","rank","rank"]:["rank","rank"];m.push(...k([r[0],r[1],r[2],r[3]/d]));let _=b=>{let w=j("output",e[0].dataType,r.length,d),y=B(w.type.tensor),x=Pr(t,w.type.value,y),v=A("x",e[0].dataType,s.length),S=A("w",e[1].dataType,o.length,d),I=[v,S];a&&I.push(A("b",e[2].dataType,e[2].dims,d));let O=[{name:"output_size",type:"u32"},{name:"dilations",type:"u32",length:t.dilations.length},{name:"strides",type:"u32",length:2},{name:"pads",type:"u32",length:2},{name:"output_channels_per_group",type:"u32"}];Nr(t,O);let P=u?`
      for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[0]; wHeight++) {
        let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

        if (xHeight < 0u || xHeight >= uniforms.x_shape[1]) {
          continue;
        }

        for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[1]; wWidth++) {
          let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
          if (xWidth < 0u || xWidth >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[2]; wInChannel++) {
            let input_channel = in_channel_offset + wInChannel;
            let xVal = ${v.get("batch","xHeight","xWidth","input_channel")};
            let wVal = ${S.get("wHeight","wWidth","wInChannel","output_channel")};
            value += xVal * wVal;
          }
        }
      }
      `:`
      for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[1]; wInChannel++) {
        let input_channel = in_channel_offset + wInChannel;
        for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[2]; wHeight++) {
          let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

          if (xHeight < 0u || xHeight >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[3]; wWidth++) {
            let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
            if (xWidth < 0u || xWidth >= uniforms.x_shape[3]) {
              continue;
            }

            let xVal = ${v.get("batch","input_channel","xHeight","xWidth")};
            let wVal = ${S.get("output_channel","wInChannel","wHeight","wWidth")};
            value += xVal * wVal;
          }
        }
      }
      `;return`
  ${b.registerUniforms(O).declareVariables(...I,w)}

  ${b.mainStart()}
    ${b.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let outputIndices = ${w.offsetToIndices("global_idx")};
    let batch: u32 = outputIndices[0];
    let output_channel: u32 = outputIndices[${u?3:1}];
    let xRCCorner: vec2<u32> = vec2<u32>(outputIndices[${u?1:2}], outputIndices[${u?2:3}]) * uniforms.strides - uniforms.pads;
    let group_id: u32 = output_channel * ${d} / uniforms.output_channels_per_group;
    var in_channel_offset = group_id * uniforms.w_shape[${u?2:1}];

    var value: ${w.type.value} = ${w.type.value}(0);
    ${P}
    ${n}
    ${x}
    ${w.setByOffset("global_idx","value")}
  }`};return{name:"GroupedConv",shaderCache:{hint:`${t.cacheKey}_${d}`,inputDependencies:f},getRunData:()=>({outputs:[{dims:i?i(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(h/64)},programUniforms:m}),getShaderSource:_}},qu=(e,t,r,i)=>{let a=e.length>2,n=R(r[3]),s=R(r[2]),o=M.size(r)/n/s,u=[e[0].dims[0],e[0].dims[1],e[0].dims[2],e[0].dims[3]/n],l=[e[1].dims[0],e[1].dims[1],e[1].dims[2],e[1].dims[3]/n],p=[r[0],r[1],r[2],r[3]/n],d=[{type:12,data:o},{type:6,data:[t.strides[0],t.strides[1]]},{type:6,data:[t.pads[0],t.pads[1]]}];Ur(t,d),d.push(...k(u,l,p));let h=(s-1)*t.strides[1]+l[1],m=f=>{let _=j("output",e[0].dataType,p.length,n),b=B(_.type.tensor),w=Pr(t,_.type.value,b),y=A("x",e[0].dataType,u.length,n),x=A("w",e[1].dataType,l.length,n),v=[y,x];a&&v.push(A("b",e[2].dataType,e[2].dims,n));let S=a?"value += b[output_channel];":"",I=[{name:"output_size",type:"u32"},{name:"strides",type:"i32",length:2},{name:"pads",type:"i32",length:2}];return Nr(t,I),`
  ${f.registerUniforms(I).declareVariables(...v,_)}
  ${f.mainStart()}
    ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let width0 = uniforms.output_shape[3];
    let output_channel = global_idx % width0;
    var index1 = global_idx / width0;
    let width1 = uniforms.output_shape[2] / ${s}u;
    let col = (index1 % width1) * ${s}u;
    index1 = index1 / width1;
    let row = index1 % uniforms.output_shape[1];
    let batch = index1 / uniforms.output_shape[1];

    let x_corner = vec2<i32>(i32(row), i32(col)) * uniforms.strides - uniforms.pads;

    var x_vals: array<${y.type.value}, ${h}>;
    var values: array<${_.type.value}, ${s}>;
    let input_channel = output_channel;
    // Use constant instead of uniform can give better performance for w's height/width.
    for (var w_height: u32 = 0u; w_height < ${l[0]}; w_height++) {
      let x_height = x_corner.x + i32(w_height);
      if (x_height >= 0 && u32(x_height) < uniforms.x_shape[1]) {
        for (var i = 0; i < ${h}; i++) {
          let x_width = x_corner.y + i;
          if (x_width >= 0 && u32(x_width) < uniforms.x_shape[2]) {
            x_vals[i] = ${y.get("batch","u32(x_height)","u32(x_width)","input_channel")};
          } else {
            x_vals[i] = ${y.type.value}(0);
          }
        }
        for (var w_width: u32 = 0u; w_width < ${l[1]}; w_width++) {
          let w_val = ${x.get("w_height","w_width","0","output_channel")};
          for (var i = 0u; i < ${s}u; i++) {
            values[i] = fma(x_vals[i * u32(uniforms.strides[1]) + w_width], w_val, values[i]);
          }
        }
      }
    }

    for (var i = 0u; i < ${s}u; i++) {
      var value = values[i];
      ${S}
      ${w}
      ${_.set("batch","row","col + i","output_channel","value")};
    }
  }`};return{name:"GroupedConv-Vectorize",shaderCache:{hint:`${t.cacheKey};${n};${s};${h};${l[0]};${l[1]}`,inputDependencies:a?["rank","rank","type"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:i?i(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(o/64)},programUniforms:d}),getShaderSource:m}}}),Fu,Ca,Vu,Aa,On,Rn,Gu,Wu,Bn,nh=C(()=>{"use strict";ie(),rh(),ih(),zn(),ah(),Lr(),Tn(),It(),Fu=(e,t,r,i,a,n)=>{let s=e[0],o=e.slice(n?1:2,n?3:4),u=o.length,l=t[0],p=t.slice(2).map((h,m)=>h+(h-1)*(r[m]-1)),d=o.map((h,m)=>h+i[m]+i[m+u]).map((h,m)=>Math.floor((h-p[m]+a[m])/a[m]));return d.splice(0,0,s),d.splice(n?3:1,0,l),d},Ca=[2,3,1,0],Vu=(e,t)=>{if(!e||e.length!==2&&e.length!==3)throw new Error("Conv requires 2 or 3 inputs");if(e[0].dims.length>5)throw new Error("greater than 5D is not supported");if(e[0].dims.length!==e[1].dims.length)throw new Error("filter does not have same dimension as input");let r=e[0].dims[t.format==="NHWC"?e[0].dims.length-1:1],i=e[1].dims[1]*t.group;if(r!==i)throw new Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");if(e.length===3&&(e[2].dims.length!==1||e[1].dims[0]!==e[2].dims[0]))throw new Error("invalid bias");let a=e[0].dims.length-2;if(t.dilations.length!==a)throw new Error(`dilations should be ${a}D`);if(t.strides.length!==a)throw new Error(`strides should be ${a}D`);if(t.pads.length!==a*2)throw new Error(`pads should be ${a*2}D`);if(t.kernelShape.length!==0&&t.kernelShape.length!==e[1].dims.length-2)throw new Error("invalid kernel shape")},Aa=(e,t)=>{let r=e.kernelShape.slice();r.length<t[1].dims.length-2&&r.push(...Array(t[1].dims.length-2-r.length).fill(0));for(let n=2;n<t[1].dims.length;++n)r[n-2]===0&&(r[n-2]=t[1].dims[n]);let i=e.pads.slice();Jt.adjustPadsBasedOnAutoPad(t[0].dims,e.strides,e.dilations,r,i,e.format==="NHWC",e.autoPad);let a=Object.assign({},e);return Object.assign(a,{kernelShape:r,pads:i}),a},On=e=>{let t=vn(e),r=e.format,i=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][e.auto_pad],a=e.dilations,n=e.group,s=e.kernel_shape,o=e.pads,u=e.strides,l=e.w_is_const();return{autoPad:i,format:r,dilations:a,group:n,kernelShape:s,pads:o,strides:u,wIsConst:l,...t,cacheKey:`${e.format};${t.activation};`}},Rn=(e,t,r,i)=>{let a=r.format==="NHWC",n=Fu(t[0].dims,t[1].dims,r.dilations,r.pads,r.strides,a);if(r.group!==1){let I=[t[0]];if(a){let O=e.kernelCustomData.wT??e.compute(Je(t[1],Ca),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=O),I.push(O)}else I.push(t[1]);t.length===3&&I.push(t[2]),!e.adapterInfo.isArchitecture("ampere")&&a&&t[1].dims[0]===r.group&&t[1].dims[1]===1&&r.dilations[0]===1&&r.dilations[1]===1?e.compute(qu(I,r,n,i),{inputs:I}):e.compute(Lu(I,r,n,i),{inputs:I});return}let s=t.length===3,o=t[0].dims[a?1:2],u=t[0].dims[a?2:3],l=t[0].dims[a?3:1],p=t[1].dims[2],d=t[1].dims[3],h=n[a?1:2],m=n[a?2:3],f=n[a?3:1],_=a&&p===o&&d===u&&r.pads[0]===0&&r.pads[1]===0;if(_||p===1&&d===1&&r.dilations[0]===1&&r.dilations[1]===1&&r.strides[0]===1&&r.strides[1]===1&&r.pads[0]===0&&r.pads[1]===0){let I=n[0],O,P,V,Q=[];if(a){let ne=e.kernelCustomData.wT??e.compute(Je(t[1],Ca),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];if(r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=ne),_){let ke=o*u*l;O=t[0].reshape([1,I,ke]),P=ne.reshape([1,ke,f]),V=[1,I,f]}else O=t[0].reshape([I,o*u,l]),P=ne.reshape([1,l,f]),V=[I,h*m,f];Q.push(O),Q.push(P)}else O=t[0].reshape([I,l,o*u]),P=t[1].reshape([1,f,l]),V=[I,f,h*m],Q.push(P),Q.push(O);s&&Q.push(t[2]);let ye=V[2],ae=Q[0].dims[Q[0].dims.length-1];ye<8&&ae<8?e.compute(Sn(Q,r,n,V,a,i),{inputs:Q}):e.compute(za(Q,r,n,V,a,i),{inputs:Q});return}let b=!0,w=e.kernelCustomData.wT??e.compute(Je(t[1],Ca),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=w);let y=[t[0],w];s&&y.push(t[2]);let x=a?h*m:f,v=a?f:h*m,S=p*d*l;e.compute(Bu(y,r,n,x,v,S,s,b,i),{inputs:y})},Gu=(e,t)=>{let r=t.format==="NHWC",i=[e.inputs[0].reshape(r?[e.inputs[0].dims[0],1,e.inputs[0].dims[1],e.inputs[0].dims[2]]:[e.inputs[0].dims[0],e.inputs[0].dims[1],1,e.inputs[0].dims[2]]),e.inputs[1].reshape([e.inputs[1].dims[0],e.inputs[1].dims[1],1,e.inputs[1].dims[2]])];e.inputs.length===3&&i.push(e.inputs[2]);let a=[0,t.pads[0],0,t.pads[1]],n=[1].concat(t.strides),s=[1].concat(t.dilations),o=[1].concat(t.kernelShape),u=Aa({...t,pads:a,strides:n,dilations:s,kernelShape:o},i);Rn(e,i,u,l=>r?[l[0],l[2],l[3]]:[l[0],l[1],l[3]])},Wu=(e,t,r)=>{let i=r.format==="NHWC"?"channelsLast":"channelsFirst",a=Aa(r,t),n=r.autoPad==="NOTSET"?r.pads:r.autoPad,s=Uu(t[0].dims,t[1].dims,r.strides,r.dilations,n,!1,i);e.compute(Nu(t,a,s.outShape,[s.filterDepth,s.filterHeight,s.filterWidth],[s.padInfo.front,s.padInfo.top,s.padInfo.left],i))},Bn=(e,t)=>{if(Vu(e.inputs,t),e.inputs[0].dims.length===3)Gu(e,t);else if(e.inputs[0].dims.length===5)Wu(e,e.inputs,t);else{let r=Aa(t,e.inputs);Rn(e,e.inputs,r)}}}),ju,sh=C(()=>{"use strict";oe(),ht(),ie(),K(),ju=(e,t,r)=>{let i=e.length>2,a=t.outputShape,n=t.format==="NHWC",s=t.group,o=e[1].dims,u=o[2]/s,l=o[3],p=n?R(u):1,d=n&&l===1&&u>=4,h=d?Math.floor(u/4)*4:Math.floor(u/p)*p,m=u-h,f=n?R(l):1,_=n?l===1?p:f:1,b=M.size(a)/f,w=[Math.ceil(b/64),1,1];$e("verbose",()=>`[conv2d_backprop_webgpu] dispatch = ${w}`);let y=["rank","rank"],x=[t.strides[0],t.strides[1]],v=[t.kernelShape[n?1:2],t.kernelShape[n?2:3]],S=[t.dilations[0],t.dilations[1]],I=[v[0]+(t.dilations[0]<=1?0:(t.kernelShape[n?1:2]-1)*(t.dilations[0]-1)),v[1]+(t.dilations[1]<=1?0:(t.kernelShape[n?2:3]-1)*(t.dilations[1]-1))],O=[I[0]-1-Math.floor((t.pads[0]+t.pads[2])/2),I[1]-1-Math.floor((t.pads[1]+t.pads[3])/2)],P=[{type:12,data:b},{type:12,data:x},{type:12,data:v},{type:12,data:S},{type:12,data:I},{type:6,data:O},{type:12,data:h},{type:12,data:u},{type:12,data:l},...k(e[0].dims,e[1].dims)];i&&(P.push(...k(e[2].dims)),y.push("rank")),P.push(...k(a));let V=Q=>{let ye=[{name:"output_size",type:"u32"},{name:"strides",type:"u32",length:x.length},{name:"filter_dims",type:"u32",length:v.length},{name:"dilations",type:"u32",length:v.length},{name:"effective_filter_dims",type:"u32",length:I.length},{name:"pads",type:"i32",length:O.length},{name:"input_channels_per_group_int",type:"u32"},{name:"input_channels_per_group",type:"u32"},{name:"output_channels_per_group",type:"u32"}],ae=B(e[0].dataType),ne=n?1:2,ke=n?2:3,X=n?3:1,ee=A("W",e[1].dataType,e[1].dims.length,_),ge=A("Dy",e[0].dataType,e[0].dims.length,p),we=[ge,ee];i&&we.push(A("bias",e[2].dataType,[a[X]].length,f));let he=j("result",e[0].dataType,a.length,f),ve=()=>{let se="";if(d)p===4?se+=`
        let xValue = ${ge.getByOffset("x_offset")};
        let wValue = ${ee.getByOffset("w_offset")};
        dotProd = dotProd + dot(xValue, wValue);
        x_offset += 1u;
        w_offset += 1u;`:p===2?se+=`
          dotProd = dotProd + dot(vec4<${ae}>(${ge.getByOffset("x_offset")}, ${ge.getByOffset("x_offset + 1u")}), vec4<${ae}>(${ee.getByOffset("w_offset")}, ${ee.getByOffset("w_offset + 1u")}));
          x_offset += 2u;
          w_offset += 2u;`:p===1&&(se+=`
          dotProd = dotProd + dot(vec4<${ae}>(${ge.getByOffset("x_offset")}, ${ge.getByOffset("x_offset + 1u")}, ${ge.getByOffset("x_offset + 2u")}, ${ge.getByOffset("x_offset + 3u")}), vec4<${ae}>(${ee.getByOffset("w_offset")}, ${ee.getByOffset("w_offset + 1u")}, ${ee.getByOffset("w_offset + 2u")}, ${ee.getByOffset("w_offset + 3u")}));
          x_offset += 4u;
          w_offset += 4u;`);else if(se+=`
                  let xValue = ${n?ge.getByOffset(`${ge.indicesToOffset(`${ge.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${p}`):ge.get("batch","inputChannel","idyR","idyC")};
        `,p===1)se+=`
          let w_offset = ${ee.indicesToOffset(`${ee.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel, wOutChannel)`)};
          let wValue = ${ee.getByOffset(`w_offset / ${_}`)};
          dotProd = dotProd + xValue * wValue;`;else for(let Y=0;Y<p;Y++)se+=`
            let wValue${Y} = ${ee.getByOffset(`${ee.indicesToOffset(`${ee.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel + ${Y}, wOutChannel)`)} / ${_}`)};
            dotProd = dotProd + xValue[${Y}] * wValue${Y};`;return se},W=()=>{if(m===0)return"";if(!d)throw new Error(`packInputAs4 ${d} is not true.`);let se="";if(p===1){se+="dotProd = dotProd";for(let Y=0;Y<m;Y++)se+=`
            + ${ge.getByOffset(`x_offset + ${Y}`)} * ${ee.getByOffset(`w_offset + ${Y}`)}`;se+=";"}else if(p===2){if(m!==2)throw new Error(`Invalid inputChannelsRemainder ${m}.`);se+=`
          let xValue = ${ge.getByOffset("x_offset")};
          let wValue = ${ee.getByOffset("w_offset")};
          dotProd = dotProd + dot(xValue, wValue);`}return se},pe=`
            let outputIndices = ${he.offsetToIndices(`global_idx * ${f}`)};
            let batch = ${he.indicesGet("outputIndices",0)};
            let d1 = ${he.indicesGet("outputIndices",X)};
            let r = ${he.indicesGet("outputIndices",ne)};
            let c = ${he.indicesGet("outputIndices",ke)};
            let dyCorner = vec2<i32>(i32(r), i32(c)) - uniforms.pads;
            let dyRCorner = dyCorner.x;
            let dyCCorner = dyCorner.y;
            let groupId = d1 / uniforms.output_channels_per_group;
            let wOutChannel = d1 - groupId * uniforms.output_channels_per_group;
            // Convolve dy(?, ?, d2) with w(:, :, d1, d2) to compute dx(xR, xC, d1).
            // ? = to be determined. : = across all values in that axis.
            var dotProd = ${he.type.value}(0.0);
            var wR: u32 = 0;
            if (uniforms.dilations.x == 1) {
              // Minimum wR >= 0 that satisfies (dyRCorner + wR) % (uniforms.strides.x) == 0
              wR = u32(((dyRCorner + i32(uniforms.strides.x) - 1) / i32(uniforms.strides.x)) * i32(uniforms.strides.x) - dyRCorner);
            }
            for (; wR < uniforms.effective_filter_dims.x; wR = wR + 1) {
              if (wR % uniforms.dilations.x != 0) {
                continue;
              }
              let dyR = (${ae}(dyRCorner) + ${ae}(wR)) / ${ae}(uniforms.strides[0]);
              let wRPerm = uniforms.filter_dims.x - 1 - wR / uniforms.dilations.x;
              if (dyR < 0.0 || dyR >= ${ae}(uniforms.Dy_shape[${ne}]) || fract(dyR) > 0.0 ||
                  wRPerm < 0) {
                continue;
              }
              let idyR: u32 = u32(dyR);
              var wC: u32 = 0;
              if (uniforms.dilations.y == 1) {
                // Minimum wC >= 0 that satisfies (dyCCorner + wC) % (uniforms.strides.y) == 0
                wC = u32(((dyCCorner + i32(uniforms.strides.y) - 1) / i32(uniforms.strides.y)) * i32(uniforms.strides.y) - dyCCorner);
              }
              for (; wC < uniforms.effective_filter_dims.y; wC = wC + 1) {
                if (wC % uniforms.dilations.y != 0) {
                  continue;
                }
                let dyC = (${ae}(dyCCorner) + ${ae}(wC)) / ${ae}(uniforms.strides.y);
                let wCPerm = uniforms.filter_dims.y - 1 - wC / uniforms.dilations.y;
                if (dyC < 0.0 || dyC >= ${ae}(uniforms.Dy_shape[${ke}]) ||
                    fract(dyC) > 0.0 || wCPerm < 0) {
                  continue;
                }
                let idyC: u32 = u32(dyC);
                var inputChannel = groupId * uniforms.input_channels_per_group;
                ${d?`
                var x_offset = ${ge.indicesToOffset(`${ge.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${p};
                var w_offset = ${ee.indicesToOffset(`${ee.type.indices}(wRPerm, wCPerm, inputChannel, wOutChannel)`)} / ${_};
                  `:""}
                for (var d2: u32 = 0; d2 < uniforms.input_channels_per_group_int; d2 = d2 + ${d?4:p}) {
                  ${ve()}
                  inputChannel = inputChannel + ${d?4:p};
                }
                ${W()}
                wC = wC + uniforms.strides.y - 1;
              }
              wR = wR + uniforms.strides[0] - 1;
            }
            let value = dotProd${i?` + bias[d1 / ${f}]`:""};
            ${he.setByOffset("global_idx","value")};
          `;return`
    ${Q.registerUniforms(ye).declareVariables(...we,he)}
      ${Q.mainStart()}
      ${Q.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")};
    ${pe}}`};return{name:"ConvTranspose2D",shaderCache:{hint:`${t.cacheKey};${p}${_}${f}${d}${m}`,inputDependencies:y},getRunData:()=>({dispatchGroup:{x:w[0],y:w[1],z:w[2]},outputs:[{dims:r?r(a):a,dataType:e[0].dataType}],programUniforms:P}),getShaderSource:V}}}),Hu,Ku,Zu,Mn,Qu,Xu,Dn,Yu,Ju,oh=C(()=>{"use strict";sh(),Lr(),It(),Hu=(e,t,r,i,a,n)=>(e-1)*t+r+(i-1)*a+1-n,Ku=(e,t,r,i,a)=>{let n=Math.floor(e/2);t==="SAME_UPPER"?(r[i]=n,r[a]=e-n):t==="SAME_LOWER"&&(r[i]=e-n,r[a]=n)},Zu=(e,t,r,i,a,n,s,o,u,l)=>{let p=e.length-2,d=l.length===0;u.length<p&&u.push(...Array(p-u.length).fill(0));let h=e[0],m=t[o?3:1]*a;for(let f=0,_=e.length-p-(o?1:0);f<p;++f,++_){let b=e[_],w=d?b*s[f]:l[f],y=Hu(b,s[f],n[f],t[_],r[f],w);Ku(y,i,n,f,f+p),d&&l.push(s[f]*(b-1)+u[f]+(t[_]-1)*r[f]+1-n[f]-n[f+p])}l.splice(0,0,h),l.splice(o?3:1,0,m)},Mn=(e,t)=>{let r=e.kernelShape.slice();if(e.kernelShape.length===0||e.kernelShape.reduce((d,h)=>d*h,1)===0){r.length=0;for(let d=2;d<t[1].dims.length;++d)r.push(t[1].dims[d])}let i=e.format==="NHWC";r.splice(0,0,t[1].dims[0]),r.splice(i?3:1,0,t[1].dims[1]);let a=e.pads.slice(),n=e.outputShape.slice(),s=e.outputPadding.slice(),o=t[0].dims,u=e.dilations.slice();if(u.reduce((d,h)=>d+h,0)===0){let d=t[0].dims.length-2;u=new Array(d).fill(1)}let l=e.strides.slice();if(l.reduce((d,h)=>d+h,0)===0){let d=t[0].dims.length-2;l=new Array(d).fill(1)}Zu(o,r,u,e.autoPad,e.group,a,l,i,s,n);let p=Object.assign({},e);return Object.assign(p,{kernelShape:r,pads:a,outputPadding:s,outputShape:n,dilations:u,strides:l}),p},Qu=e=>{let t=vn(e),r=e.format,i=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][typeof e.autoPad>"u"?0:e.autoPad],a=e.dilations,n=e.group??1,s=e.kernelShape,o=e.pads,u=e.strides,l=e.wIsConst(),p=e.outputPadding,d=e.outputShape;return{autoPad:i,format:r,dilations:a,group:n,kernelShape:s,outputPadding:p,outputShape:d,pads:o,strides:u,wIsConst:l,...t,cacheKey:`${e.format};${t.activation};`}},Xu=(e,t)=>{if(!e||e.length!==2&&e.length!==3)throw new Error("Conv requires 2 or 3 inputs");if(e[0].dims.length!==4&&e[0].dims.length!==3)throw new Error("currently only support 2-dimensional conv");if(e[0].dims.length!==e[1].dims.length)throw new Error("filter does not have same dimension as input");let r=e[0].dims[t.format==="NHWC"?e[0].dims.length-1:1],i=e[1].dims[0];if(r!==i)throw new Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");let a=e[1].dims[1]*t.group;if(e.length===3&&(e[2].dims.length!==1||e[2].dims[0]!==a))throw new Error("invalid bias");let n=e[0].dims.length-2;if(t.dilations.reduce((s,o)=>s+o,0)>0&&t.dilations.length!==n)throw new Error(`dilations should be ${n}D`);if(t.strides.reduce((s,o)=>s+o,0)>0&&t.strides.length!==n)throw new Error(`strides should be ${n}D`);if(t.pads.reduce((s,o)=>s+o,0)>0&&t.pads.length!==n*2)throw new Error(`pads should be ${n*2}D`);if(t.outputPadding.length!==n&&t.outputPadding.length!==0)throw new Error(`output_padding should be ${n}D`);if(t.kernelShape.reduce((s,o)=>s+o,0)>0&&t.kernelShape.length!==0&&t.kernelShape.length!==e[1].dims.length-2)throw new Error("invalid kernel shape");if(t.outputShape.length!==0&&t.outputShape.length!==e[0].dims.length-2)throw new Error("invalid output shape")},Dn=(e,t,r,i)=>{let a=e.kernelCustomData.wT??e.compute(Je(t[1],[2,3,0,1]),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=a);let n=[t[0],a];t.length===3&&n.push(t[2]),e.compute(ju(n,r,i),{inputs:n})},Yu=(e,t)=>{let r=t.format==="NHWC",i=[e.inputs[0].reshape(r?[e.inputs[0].dims[0],1,e.inputs[0].dims[1],e.inputs[0].dims[2]]:[e.inputs[0].dims[0],e.inputs[0].dims[1],1,e.inputs[0].dims[2]]),e.inputs[1].reshape([e.inputs[1].dims[0],e.inputs[1].dims[1],1,e.inputs[1].dims[2]])];e.inputs.length===3&&i.push(e.inputs[2]);let a=t.kernelShape;(a.length===0||a[0]===0)&&(a=[e.inputs[1].dims[2]]);let n=t.dilations;(n.length===0||n[0]===0)&&(n=[1]);let s=t.strides;(s.length===0||s[0]===0)&&(s=[1]);let o=t.pads;o.length===0&&(o=[0,0]),o=[0,o[0],0,o[1]],s=[1].concat(s),n=[1].concat(n),a=[1].concat(a);let u=t.outputPadding;u=[0].concat(u);let l=Mn({...t,pads:o,strides:s,dilations:n,kernelShape:a,outputPadding:u},i);Dn(e,i,l,p=>r?[p[0],p[2],p[3]]:[p[0],p[1],p[3]])},Ju=(e,t)=>{if(Xu(e.inputs,t),e.inputs[0].dims.length===3)Yu(e,t);else{let r=Mn(t,e.inputs);Dn(e,e.inputs,r)}}}),el,tl,rl,uh=C(()=>{"use strict";oe(),ie(),$(),K(),el=(e,t,r,i)=>{let a=M.size(t),n=t.length,s=A("input",e,n),o=j("output",e,n),u=r.dataType===6?r.getInt32Array()[0]:Number(r.getBigInt64Array()[0]),l=M.normalizeAxis(u,n),p=d=>{let h=` i32(${s.indicesGet("inputIndices","uniforms.axis")}) `,m=D("uniforms.input_shape","uniforms.axis",n),f=i.reverse?h+(i.exclusive?" + 1":""):"0",_=i.reverse?m:h+(i.exclusive?"":" + 1");return`
                ${d.registerUniform("outputSize","u32").registerUniform("axis","u32").declareVariables(s,o)}
                ${d.mainStart()}
                  ${d.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
                  var inputIndices = ${o.offsetToIndices("global_idx")};
                  var sum = ${o.type.value}(0);
                  let first : i32 = ${f};
                  let last : i32 = ${_};
                  for (var i : i32 = first; i < last; i++) {
                    ${s.indicesSet("inputIndices","uniforms.axis","u32(i)")};
                    sum = sum + ${s.getByIndices("inputIndices")};
                  }
                  ${o.setByOffset("global_idx","sum")};
                }`};return{name:"CumSum",shaderCache:{hint:i.cacheKey,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:t,dataType:e}],dispatchGroup:{x:Math.ceil(a/64)},programUniforms:[{type:12,data:a},{type:12,data:l},...k(t,t)]}),getShaderSource:p}},tl=(e,t)=>{let r=e.inputs[0].dims,i=e.inputs[0].dataType,a=e.inputs[1];e.compute(el(i,r,a,t),{inputs:[0]})},rl=e=>{let t=e.exclusive===1,r=e.reverse===1;return g({exclusive:t,reverse:r})}}),il,al,nl,sl,ol,lh=C(()=>{"use strict";oe(),ie(),$(),K(),il=e=>{if(!e||e.length!==1)throw new Error("DepthToSpace requires 1 input.");if(e[0].dims.length!==4)throw new Error("DepthToSpace requires 4D input.")},al=(e,t,r,i)=>{let a=[];a.push(`fn perm(i: ${i.type.indices}) -> ${r.type.indices} {
    var a: ${r.type.indices};`);for(let n=0;n<t;++n)a.push(r.indicesSet("a",e[n],`i[${n}]`));return a.push("return a;}"),a.join(`
`)},nl=(e,t)=>{let r,i,a,n,s,o,u=t.format==="NHWC",l=t.blocksize,p=t.mode==="DCR";u?([r,i,a,n]=e.dims,s=p?[r,i,a,l,l,n/l**2]:[r,i,a,n/l**2,l,l],o=p?[0,1,3,2,4,5]:[0,1,4,2,5,3]):([r,i,a,n]=[e.dims[0],e.dims[2],e.dims[3],e.dims[1]],s=p?[r,l,l,n/l**2,i,a]:[r,n/l**2,l,l,i,a],o=p?[0,3,4,1,5,2]:[0,1,4,2,5,3]);let d=e.reshape(s),h=d.dims.length,m=e.dataType,f=A("a",m,h),_=j("output",m,h),b=w=>`
  ${w.registerUniform("output_size","u32").declareVariables(f,_)}

  ${al(o,h,f,_)}

  ${w.mainStart()}
    ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${_.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${_.setByOffset("global_idx",f.getByIndices("aIndices"))}
  }`;return{name:"DepthToSpace",shaderCache:{hint:`${e.dims};${t.blocksize};${t.mode}`,inputDependencies:["rank"]},getRunData:w=>{let y=u?[r,i*l,a*l,n/l**2]:[r,n/l**2,i*l,a*l],x=M.size(y),v=d.dims,S=M.sortBasedOnPerm(v,o);return{outputs:[{dims:y,dataType:w[0].dataType}],dispatchGroup:{x:Math.ceil(x/64)},programUniforms:[{type:12,data:x},...k(v,S)]}},getShaderSource:b}},sl=(e,t)=>{il(e.inputs),e.compute(nl(e.inputs[0],t))},ol=e=>g({blocksize:e.blocksize,mode:e.mode,format:e.format})}),Qt,la,Oa,Pn,ir,ul,ll,dl,Un,Nn,Ln,pl,cl,qn,hl,fl,ml,dh=C(()=>{"use strict";oe(),ie(),$(),K(),Qt=256,la=512,Oa=2*Math.PI,Pn=e=>{let t=[],r=e;for(let i of[4,2,3,5])for(;r%i===0;)t.push(i),r/=i;return r===1?t:void 0},ir=e=>{let t=e.toPrecision(9);return/[.eE]/.test(t)?t:`${t}.0`},ul=(e,t,r,i,a)=>{let n=r/e,s=la-i,o=l=>`smem[${s}u + base + ${l*t}u]`,u=`  for (var t = local_idx; t < ${n}u; t += ${Qt}u) {
`;u+=`    let twiddleIndex = t % ${t}u;
    let angleUnit = f32(twiddleIndex);
`,u+=`    var leg: array<vec2<f32>, 5>;
`;for(let l=0;l<e;l++){let p=`${i}u + t + ${l*n}u`;if(l===0)u+=`    leg[0] = smem[${p}];
`;else{let d=a*Oa*l/(e*t);u+=`    { let a = ${ir(d)} * angleUnit; leg[${l}] = cmul(smem[${p}], vec2<f32>(cos(a), sin(a))); }
`}}if(u+=`    let base = (t / ${t}u) * ${t*e}u + twiddleIndex;
`,e===2)u+=`    ${o(0)} = leg[0] + leg[1];
    ${o(1)} = leg[0] - leg[1];
`;else if(e===4){let l=a<0?"vec2<f32>(oddDiff.y, -oddDiff.x)":"vec2<f32>(-oddDiff.y, oddDiff.x)";u+=`    let evenSum = leg[0] + leg[2]; let evenDiff = leg[0] - leg[2];
`,u+=`    let oddSum = leg[1] + leg[3]; let oddDiff = leg[1] - leg[3];
`,u+=`    let oddRot = ${l};
`,u+=`    ${o(0)} = evenSum + oddSum;
    ${o(1)} = evenDiff + oddRot;
`,u+=`    ${o(2)} = evenSum - oddSum;
    ${o(3)} = evenDiff - oddRot;
`}else for(let l=0;l<e;l++){let p=["leg[0]"];for(let d=1;d<e;d++){let h=a*Oa*(d*l)/e,m=ir(Math.cos(h)),f=ir(Math.sin(h));p.push(`vec2<f32>(leg[${d}].x*${m} - leg[${d}].y*${f}, leg[${d}].x*${f} + leg[${d}].y*${m})`)}u+=`    ${o(l)} = ${p.join(" + ")};
`}return`${u}  }
  workgroupBarrier();
`},ll=(e,t,r)=>{let i="",a=1,n=0;for(let s of e)i+=ul(s,a,t,n,r),a*=s,n=la-n;return{code:i,resultOffset:n}},dl=(e,t,r,i,a)=>{let n=e.dims,s=n.length,o=n[s-1],u=n[t],l=r&&i?(u-1)*2:u;a!==void 0&&(l=a);let p=r&&i?1:2,d=i&&!r?Math.floor(l/2)+1:l,h=n.slice();h[t]=d,h[s-1]=p;let m=1;for(let _=t+1;_<s-1;_++)m*=n[_];let f=M.size(n)/o/u;return{dataType:e.dataType,outputDims:h,length:l,signalLength:u,inner:m,batch:f,inputComponents:o,outputComponents:p,outputLength:d,inverse:r,onesided:i}},Un=(e,t)=>[t,e.length,e.inputComponents,e.outputComponents,e.inverse,e.onesided].join(";"),Nn=e=>[{type:12,data:e.batch},{type:12,data:e.signalLength},{type:12,data:e.inner},{type:12,data:e.outputLength}],Ln=(e,t,r)=>e.registerUniform("batch","u32").registerUniform("signalLength","u32").registerUniform("inner","u32").registerUniform("outputLength","u32").declareVariables(t,r),pl=e=>{let{dataType:t,length:r,inputComponents:i,outputComponents:a,inverse:n,onesided:s}=e,o=z(t),u=n?1:-1,l=n?1/r:1,p=Pn(r),d=h=>{let m=A("x",t,[1]),f=j("y",t,[1]),_=S=>{let I=`inBase + (${S}) * uniforms.inner * ${i}u`,O=`f32(${m.getByOffset(I)})`,P=i===2?`f32(${m.getByOffset(`${I} + 1u`)})`:"0.0";return`vec2<f32>(${O}, ${P})`},b;if(n&&s){let S=Math.floor(r/2)+1,I=r%2===0?`select(provided, provided - 1u, provided == ${S}u)`:"provided";b=`
    let provided = min(uniforms.signalLength, ${S}u);
    for (var i = local_idx; i < ${r}u; i += ${Qt}u) {
      if (i < provided) { smem[i] = ${_("i")}; } else { smem[i] = vec2<f32>(0.0); }
    }
    workgroupBarrier();
    for (var k = local_idx + 1u; k < ${I}; k += ${Qt}u) {
      let h = smem[k];
      smem[${r}u - k] = vec2<f32>(h.x, -h.y);
    }
    workgroupBarrier();`}else b=`
    let loadCount = min(uniforms.signalLength, ${r}u);
    for (var i = local_idx; i < ${r}u; i += ${Qt}u) {
      if (i < loadCount) { smem[i] = ${_("i")}; } else { smem[i] = vec2<f32>(0.0); }
    }
    workgroupBarrier();`;let{code:w,resultOffset:y}=ll(p,r,u),x=l===1?`smem[${y}u + i]`:`smem[${y}u + i] * ${ir(l)}`,v=a===2?f.setByOffset("off + 1u",`${o}(v.y)`):"";return`
  ${Ln(h,m,f)}
  var<workgroup> smem: array<vec2<f32>, ${2*la}>;
  fn cmul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
    return vec2<f32>(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
  }
  ${h.mainStart(Qt)}
    let row = workgroup_index;
    if (row >= uniforms.batch) { return; }
    let outer = row / uniforms.inner;
    let within = row % uniforms.inner;
    let inBase = (outer * uniforms.signalLength * uniforms.inner + within) * ${i}u;
    let outBase = (outer * uniforms.outputLength * uniforms.inner + within) * ${a}u;
    ${b}
${w}    for (var i = local_idx; i < uniforms.outputLength; i += ${Qt}u) {
      let v = ${x};
      let off = outBase + i * uniforms.inner * ${a}u;
      ${f.setByOffset("off",`${o}(v.x)`)}
      ${v}
    }
  }`};return{name:"DFT",shaderCache:{hint:Un(e,"fft"),inputDependencies:["type"]},getShaderSource:d,getRunData:()=>({outputs:[{dims:e.outputDims,dataType:t}],programUniforms:Nn(e),dispatchGroup:{x:e.batch}})}},cl=e=>{let{dataType:t,length:r,inputComponents:i,outputComponents:a,inverse:n,onesided:s}=e,o=z(t),u=n?1:-1,l=n?1/r:1,p=d=>{let h=A("x",t,[1]),m=j("y",t,[1]),f=x=>{let v=`inBase + (${x}) * uniforms.inner * ${i}u`,S=`f32(${h.getByOffset(v)})`,I=i===2?`f32(${h.getByOffset(`${v} + 1u`)})`:"0.0";return`vec2<f32>(${S}, ${I})`},_=n&&s?`fn spectrum(inBase: u32, k: u32) -> vec2<f32> {
    let provided = min(uniforms.signalLength, ${Math.floor(r/2)+1}u);
    if (k < provided) { return ${f("k")}; }
    let m = ${r}u - k;
    if (m < provided) {
      let h = ${f("m")};
      return vec2<f32>(h.x, -h.y);
    }
    return vec2<f32>(0.0, 0.0);
  }`:`fn spectrum(inBase: u32, n: u32) -> vec2<f32> {
    if (n < uniforms.signalLength) { return ${f("n")}; }
    return vec2<f32>(0.0, 0.0);
  }`,b=`
      let angle = ${ir(u*Oa)} * f32(knMod) / ${ir(r)};
      acc += cmul(spectrum(inBase, n), vec2<f32>(cos(angle), sin(angle)));
      knMod += k;
      if (knMod >= ${r}u) { knMod -= ${r}u; }`,w=a===2?m.setByOffset("off + 1u",`${o}(v.y)`):"",y=l===1?"acc":`acc * ${ir(l)}`;return`
  ${Ln(d,h,m)}
  fn cmul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
    return vec2<f32>(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
  }
  ${_}
  ${d.mainStart(Qt)}
    let row = workgroup_index;
    if (row >= uniforms.batch) { return; }
    let outer = row / uniforms.inner;
    let within = row % uniforms.inner;
    let inBase = (outer * uniforms.signalLength * uniforms.inner + within) * ${i}u;
    let outBase = (outer * uniforms.outputLength * uniforms.inner + within) * ${a}u;
    for (var k = local_idx; k < uniforms.outputLength; k += ${Qt}u) {
      var acc = vec2<f32>(0.0, 0.0);
      var knMod = 0u;
      for (var n = 0u; n < ${r}u; n++) {${b}
      }
      let v = ${y};
      let off = outBase + k * uniforms.inner * ${a}u;
      ${m.setByOffset("off",`${o}(v.x)`)}
      ${w}
    }
  }`};return{name:"DFT",shaderCache:{hint:Un(e,"direct"),inputDependencies:["type"]},getShaderSource:p,getRunData:()=>({outputs:[{dims:e.outputDims,dataType:t}],programUniforms:Nn(e),dispatchGroup:{x:e.batch}})}},qn=e=>{if(!e||e.dataType===0)return;if(M.size(e.dims)!==1)throw new Error("DFT optional scalar inputs must have exactly 1 element.");if(e.dataType===6)return e.getInt32Array()[0];let t=Number(e.getBigInt64Array()[0]);if(!Number.isSafeInteger(t))throw new Error("DFT optional scalar inputs are out of JavaScript safe integer range.");return t},hl=e=>{if(!e||e.length<1)throw new Error("DFT requires at least 1 input.");let t=e[0].dims;if(t.length<2)throw new Error("DFT input must have at least 2 dimensions.");let r=t[t.length-1];if(r!==1&&r!==2)throw new Error("DFT input's innermost dimension must be 1 (real) or 2 (complex).")},fl=(e,t)=>{hl(e.inputs);let r=e.inputs[0],i=r.dims.length,a=t.inverse!==0,n=t.onesided!==0,s=qn(e.inputs[1]);if(s!==void 0&&s<=0)throw new Error("dft_length must be greater than zero.");let o=M.normalizeAxis(qn(e.inputs[2])??t.axis,i);if(o===i-1)throw new Error("DFT axis must refer to a signal dimension, not the innermost (real/imaginary) dimension.");if(a&&n&&r.dims[i-1]!==2)throw new Error("Inverse one-sided DFT (IRFFT) requires complex-valued input (innermost dimension 2).");let u=dl(r,o,a,n,s);if(u.length<=0)throw new Error(`Invalid DFT length: ${u.length}`);let l=u.length<=la&&Pn(u.length)!==void 0?pl(u):cl(u);e.compute(l,{inputs:[0]})},ml=e=>g({axis:e.axis??1,inverse:e.inverse??0,onesided:e.onesided??0})}),Ra,da,Fn,gl,yl,_l,wl,Vn,$l,bl,vl,ph=C(()=>{"use strict";oe(),ie(),$(),K(),Ra="[a-zA-Z]|\\.\\.\\.",da="("+Ra+")+",Fn="^"+da+"$",gl="("+da+",)*"+da,yl="^"+gl+"$",_l=class{constructor(e=-1){this.symbolToIndices=new Map,this.inputIndex=e}addSymbol(e,t){let r=this.symbolToIndices.get(e);r===void 0?r=[t]:r.push(t),this.symbolToIndices.set(e,r)}},wl=class{constructor(e,t){this.equation=t,this.hasEllipsis=!1,this.symbolToInfo=new Map,this.lhs=new Array,this.outputDims=[];let[r,i]=t.includes("->")?t.split("->",2):[t,""];if(!r.match(RegExp(yl)))throw new Error("Invalid LHS term");if(r.split(",").forEach((a,n)=>{let s=e[n].dims.slice();if(!a.match(RegExp(Fn)))throw new Error("Invalid LHS term");let o=this.processTerm(a,!0,s,n);this.lhs.push(o)}),i==="")i+=[...this.symbolToInfo.entries()].filter(([a,n])=>n.count===1||a==="...").map(([a])=>a).join("");else if(!i.match(RegExp(da)))throw new Error("Invalid RHS");i.match(RegExp(Ra,"g"))?.forEach(a=>{if(a==="...")this.outputDims=this.outputDims.concat(this.ellipsisDims);else{let n=this.symbolToInfo.get(a);if(n===void 0)throw new Error("Invalid RHS symbol");this.outputDims.push(n.dimValue)}}),this.rhs=this.processTerm(i,!1,this.outputDims)}addSymbol(e,t,r){let i=this.symbolToInfo.get(e);if(i!==void 0){if(i.dimValue!==t&&i.count!==1)throw new Error("Dimension mismatch");i.count++,i.inputIndices.push(r)}else i={count:1,dimValue:t,inputIndices:[r]};this.symbolToInfo.set(e,i)}processTerm(e,t,r,i=-1){let a=r.length,n=!1,s=[],o=0;if(!e.match(RegExp(Fn))&&!t&&e!=="")throw new Error("Invalid LHS term");let u=e.match(RegExp(Ra,"g")),l=new _l(i);return u?.forEach((p,d)=>{if(p==="..."){if(n)throw new Error("Only one ellipsis is allowed per input term");n=!0;let h=a-u.length+1;if(h<0)throw new Error("Ellipsis out of bounds");if(s=r.slice(o,o+h),this.hasEllipsis){if(this.ellipsisDims.length!==s.length||this.ellipsisDims.toString()!==s.toString())throw new Error("Ellipsis dimensions mismatch")}else if(t)this.hasEllipsis=!0,this.ellipsisDims=s;else throw new Error("Ellipsis must be specified in the LHS");for(let m=0;m<s.length;m++){let f=String.fromCharCode(48+m);l.addSymbol(f,d+m),this.addSymbol(f,r[o++],i)}}else l.addSymbol(p,d+(this.hasEllipsis?this.ellipsisDims.length-1:0)),this.addSymbol(p,r[o++],i)}),l}},Vn=e=>e+"_max",$l=(e,t,r,i)=>{let a=e.map(l=>l.length).map((l,p)=>A(`input${p}`,t,l)),n=M.size(i),s=j("output",t,i.length),o=[...r.symbolToInfo.keys()].filter(l=>!r.rhs.symbolToIndices.has(l)),u=l=>{let p=[],d="var prod = 1.0;",h="var sum = 0.0;",m="sum += prod;",f=[],_=[],b=[],w=[],y=r.symbolToInfo.size===r.rhs.symbolToIndices.size;r.symbolToInfo.forEach((v,S)=>{if(r.rhs.symbolToIndices.has(S)){let I=r.rhs.symbolToIndices.get(S)?.[0];I!==void 0&&r.lhs.forEach((O,P)=>{if(v.inputIndices.includes(P)){let V=O.symbolToIndices.get(S);if(V===void 0)throw new Error("Invalid symbol error");V.forEach(Q=>{p.push(`${a[P].indicesSet(`input${P}Indices`,Q,s.indicesGet("outputIndices",I))}`)})}})}else r.lhs.forEach((I,O)=>{if(v.inputIndices.includes(O)){let P=I.symbolToIndices.get(S);if(P===void 0)throw new Error("Invalid symbol error");P.forEach(V=>{f.push(`${a[O].indicesSet(`input${O}Indices`,V,`${S}`)}`)}),w.push(`prod *= ${a[O].getByIndices(`input${O}Indices`)};`)}}),_.push(`for(var ${S}: u32 = 0; ${S} < uniforms.${Vn(S)}; ${S}++) {`),b.push("}")});let x=y?[...p,`let sum = ${a.map((v,S)=>v.getByIndices(`input${S}Indices`)).join(" * ")};`]:[...p,h,..._,...f,d,...w,m,...b];return`
            ${l.registerUniforms(o.map(v=>({name:`${Vn(v)}`,type:"u32"}))).registerUniform("outputSize","u32").declareVariables(...a,s)}

            ${l.mainStart()}
            ${l.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
            var outputIndices = ${s.offsetToIndices("global_idx")};
            ${a.map((v,S)=>`var input${S}Indices: ${a[S].type.indices};`).join(`
`)}
            ${x.join(`
`)};
            ${s.setByOffset("global_idx","sum")};
          }`};return{name:"Einsum",shaderCache:{hint:r.equation,inputDependencies:e.map(()=>"rank")},getRunData:()=>{let l=o.filter(d=>r.symbolToInfo.has(d)).map(d=>({type:12,data:r.symbolToInfo.get(d)?.dimValue||0}));l.push({type:12,data:n});let p=e.map((d,h)=>[...k(d)]).reduce((d,h)=>d.concat(h),l);return p.push(...k(i)),{outputs:[{dims:i,dataType:t}],dispatchGroup:{x:Math.ceil(n/64)},programUniforms:p}},getShaderSource:u}},bl=(e,t)=>{let r=new wl(e.inputs,t.equation),i=r.outputDims,a=e.inputs.map((n,s)=>n.dims);e.compute($l(a,e.inputs[0].dataType,r,i))},vl=e=>{let t=e.equation.replace(/\s+/g,"");return g({equation:t})}}),xl,Gn,Sl,Tl,El,ch=C(()=>{"use strict";oe(),ie(),K(),xl=e=>{if(!e||e.length!==2)throw new Error("Expand requires 2 input.");let t=e[0].dims,r=Array.from(e[1].getBigInt64Array(),Number),i=r.length<t.length?0:r.length-t.length,a=t.length<r.length?0:t.length-r.length;for(;i<r.length&&a<t.length;++i,++a)if(r[i]!==t[a]&&r[i]!==1&&t[a]!==1)throw new Error("Expand requires shape to be broadcastable to input")},Gn=(e,t)=>{let r=e.length-t.length,i=[];for(let a=0;a<r;++a)i.push(e[a]);for(let a=0;a<t.length;++a)i.push(t[a]===1?e[a+r]:t[a]);return i},Sl=(e,t)=>e.length>t.length?Gn(e,t):Gn(t,e),Tl=e=>{let t=e[0].dims,r=Array.from(e[1].getBigInt64Array(),Number),i=Sl(t,r),a=e[0].dataType,n=a===9||M.size(t)===1,s=a===9||t.length>0&&t[t.length-1]%4===0?4:1,o=n||i.length>0&&i[i.length-1]%4===0?4:1,u=Math.ceil(M.size(i)/o),l=d=>{let h=A("input",a,t.length,s),m=j("output",a,i.length,o),f;if(a===9){let _=(b,w,y="")=>`
          let outputIndices${w} = ${m.offsetToIndices(`outputOffset + ${w}u`)};
          let offset${w} = ${h.broadcastedIndicesToOffset(`outputIndices${w}`,m)};
          let index${w} = offset${w} / 4u;
          let component${w} = offset${w} % 4u;
          ${b}[${w}] = ${y}(${h.getByOffset(`index${w}`)}[component${w}]);
        `;f=`
        let outputOffset = global_idx * ${o};
        var data = vec4<u32>(0);
        ${_("data",0,"u32")}
        ${_("data",1,"u32")}
        ${_("data",2,"u32")}
        ${_("data",3,"u32")}
        ${m.setByOffset("global_idx","data")}
      }`}else f=`
        let outputIndices = ${m.offsetToIndices(`global_idx * ${o}`)};
        let inputOffset = ${h.broadcastedIndicesToOffset("outputIndices",m)};
        let data = ${m.type.value}(${h.getByOffset(`inputOffset / ${s}`)});
        ${m.setByOffset("global_idx","data")}
      }`;return`
    ${d.registerUniform("vec_size","u32").declareVariables(h,m)}
    ${d.mainStart()}
    ${d.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
    ${f}`},p=[{type:12,data:u},...k(t,i)];return{name:"Expand",shaderCache:{hint:`${i.length};${s}${o}`,inputDependencies:["rank"]},getShaderSource:l,getRunData:()=>({outputs:[{dims:i,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:p})}},El=e=>{xl(e.inputs),e.compute(Tl(e.inputs),{inputs:[0]})}}),kl,Il,hh=C(()=>{"use strict";oe(),ie(),K(),bn(),kl=e=>{let t=e[0].dataType,r=M.size(e[0].dims),i=M.size(e[1].dims),a=i%4===0,n=s=>{let o=A("x",t,[1],4),u=A("bias",t,[1],4),l=j("y",t,[1],4),p=[{name:"output_vec_size",type:"u32"},{name:"bias_size",type:"u32"}],d=m=>`
      let bias${m}_offset: u32 = (global_idx * 4 + ${m}) % uniforms.bias_size;
      let bias${m} = ${u.getByOffset(`bias${m}_offset / 4`)}[bias${m}_offset % 4];`,h=a?`
      let bias = ${u.getByOffset("global_idx % (uniforms.bias_size / 4)")};`:`${d(0)}${d(1)}${d(2)}${d(3)}
      let bias = ${o.type.value}(bias0, bias1, bias2, bias3);`;return`${s.registerUniforms(p).declareVariables(o,u,l)}

    ${wn(z(t))}

    ${s.mainStart(E)}
      ${s.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_vec_size")}

      let x = ${o.getByOffset("global_idx")};
      ${h}
      let x_in = x + bias;
      ${l.setByOffset("global_idx",$n("x_in"))}
    }`};return{name:"FastGeluWithBias",shaderCache:{hint:`${a}`,inputDependencies:["type","type"]},getShaderSource:n,getRunData:s=>({outputs:[{dims:s[0].dims,dataType:s[0].dataType}],programUniforms:[{type:12,data:Math.ceil(r/4)},{type:12,data:i}],dispatchGroup:{x:Math.ceil(r/E/4)}})}},Il=e=>{e.inputs.length<2||M.size(e.inputs[1].dims)===0?eu(e):e.compute(kl(e.inputs))}}),zl,Cl,Al,Ol,fh=C(()=>{"use strict";oe(),ie(),$(),K(),zl=e=>{if(!e||e.length!==2)throw new Error("Gather requires 2 inputs.")},Cl=(e,t)=>{let r=e[0].dims,i=e[1].dims,a=r.length,n=M.normalizeAxis(t.axis,a),s=r.slice(0);s.splice(n,1,...i);let o=r[n],u=e[0].dataType===9?4:1,l=Math.ceil(M.size(s)/u),p=[{type:12,data:l},{type:6,data:o},{type:12,data:n},...k(e[0].dims,e[1].dims,s)],d=h=>{let m=A("data",e[0].dataType,e[0].dims.length,u),f=A("inputIndices",e[1].dataType,e[1].dims.length),_=j("output",e[0].dataType,s.length,u),b=y=>{let x=i.length,v=`var indicesIndices${y}  = ${f.type.indices}(0);`;for(let S=0;S<x;S++)v+=`${x>1?`indicesIndices${y}[${S}]`:`indicesIndices${y}`} = ${s.length>1?`outputIndices${y}[uniforms.axis + ${S}]`:`outputIndices${y}`};`;v+=`
          var idx${y} = ${f.getByIndices(`indicesIndices${y}`)};
          if (idx${y} < 0) {
            idx${y} = idx${y} + uniforms.axisDimLimit;
          }
          var dataIndices${y} : ${m.type.indices};
        `;for(let S=0,I=0;S<a;S++)S===n?(v+=`${a>1?`dataIndices${y}[${S}]`:`dataIndices${y}`} = u32(idx${y});`,I+=x):(v+=`${a>1?`dataIndices${y}[${S}]`:`dataIndices${y}`} = ${s.length>1?`outputIndices${y}[${I}]`:`outputIndices${y}`};`,I++);return v},w;if(e[0].dataType===9){let y=(x,v,S="")=>`
          let outputIndices${v} = ${_.offsetToIndices(`outputOffset + ${v}u`)};
          ${b(v)};
          let offset${v} = ${m.indicesToOffset(`dataIndices${v}`)};
          let index${v} = offset${v} / 4u;
          let component${v} = offset${v} % 4u;
          ${x}[${v}] = ${S}(${m.getByOffset(`index${v}`)}[component${v}]);
        `;w=`
        let outputOffset = global_idx * ${u};
        var value = vec4<u32>(0);
        ${y("value",0,"u32")}
        ${y("value",1,"u32")}
        ${y("value",2,"u32")}
        ${y("value",3,"u32")}
        ${_.setByOffset("global_idx","value")}
      `}else w=`
      let outputIndices = ${_.offsetToIndices("global_idx")};
      ${b("")};
      let value = ${m.getByIndices("dataIndices")};
      ${_.setByOffset("global_idx","value")};
      `;return`
      ${h.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(m,f,_)}
      ${h.mainStart()}
        ${h.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        ${w}
      }`};return{name:"Gather",shaderCache:{hint:t.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:s,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(l/64)},programUniforms:p}),getShaderSource:d}},Al=e=>g({axis:e.axis}),Ol=(e,t)=>{let r=e.inputs;zl(r),e.compute(Cl(e.inputs,t))}}),Rl,Bl,Ml,mh=C(()=>{"use strict";oe(),ie(),K(),Rl=(e,t,r,i,a,n,s,o,u)=>{let l=[{type:12,data:n},{type:12,data:i},{type:12,data:a},{type:12,data:r},{type:12,data:s},{type:12,data:o},{type:12,data:u}],p=[n];l.push(...k(t.dims,p));let d=h=>{let m=A("indices_data",t.dataType,t.dims.length),f=j("input_slice_offsets_data",12,1,1),_=[m,f],b=[{name:"output_size",type:"u32"},{name:"batch_dims",type:"u32"},{name:"input_dims",type:"u32",length:a.length},{name:"sizes_from_slice_dims_data",type:"u32",length:r.length},{name:"num_slices_per_batch",type:"u32"},{name:"input_batch_stride",type:"u32"},{name:"num_slice_dims",type:"u32"}];return`
  ${h.registerUniforms(b).declareVariables(..._)}
  ${h.mainStart()}
    ${h.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let batch_idx = global_idx / uniforms.num_slices_per_batch;
    let base_offset = batch_idx * uniforms.input_batch_stride;

    let slice_indices_base_offset = global_idx * uniforms.num_slice_dims;
    var relative_slice_offset = 0;
    for (var dim_idx = 0u; dim_idx < uniforms.num_slice_dims; dim_idx ++) {
      var index = i32(indices_data[dim_idx + slice_indices_base_offset].x);
      let input_dim_idx = uniforms.batch_dims + dim_idx;
      if (index < 0) {
        ${a.length===1?"index += i32(uniforms.input_dims);":"index += i32(uniforms.input_dims[input_dim_idx]);"}
      }
      ${r.length===1?"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data);":"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data[dim_idx]);"}
    }

    input_slice_offsets_data[global_idx] =  base_offset + u32(relative_slice_offset);
  }`};return e.compute({name:"computeSliceOffsets",shaderCache:{hint:`${a.length}_${r.length}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:p,dataType:e.inputs[1].dataType}],dispatchGroup:{x:Math.ceil(n/64)},programUniforms:l}),getShaderSource:d},{inputs:[t],outputs:[-1]})[0]},Bl=(e,t)=>{let r=e.inputs,i=r[0].dims,a=r[0].dataType,n=r[1].dims,s=n[n.length-1],o=M.sizeToDimension(n,n.length-1),u=M.sizeFromDimension(i,t.batchDims+s),l=M.sizeToDimension(i,t.batchDims),p=M.sizeFromDimension(i,t.batchDims),d=o/l,h=new Array(s),m=u;for(let v=0;v<s;++v)h[s-1-v]=m,m*=i[t.batchDims+s-1-v];let f=Rl(e,r[1],h,t.batchDims,i,o,d,p,s),_=t.batchDims+s;if(_>i.length)throw new Error("last dimension of indices must not be larger than rank of input tensor");let b=n.slice(0,-1).concat(i.slice(_)),w=M.size(b),y=[{type:12,data:w},{type:12,data:u},...k(r[0].dims,f.dims,b)],x=v=>{let S=A("data",r[0].dataType,r[0].dims.length),I=A("slice_offsets",12,f.dims.length),O=j("output",r[0].dataType,b.length);return`
          ${v.registerUniform("output_size","u32").registerUniform("slice_size","u32").declareVariables(S,I,O)}
            ${v.mainStart()}
            ${v.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let slice_offset = slice_offsets[global_idx / uniforms.slice_size];
          output[global_idx] = data[u32(slice_offset) + global_idx % uniforms.slice_size];
        }`};e.compute({name:"GatherND",shaderCache:{hint:t.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:b,dataType:a}],dispatchGroup:{x:Math.ceil(w/64)},programUniforms:y}),getShaderSource:x},{inputs:[r[0],f]})},Ml=e=>({batchDims:e.batch_dims,cacheKey:""})}),Dl,Pl,Ul,Nl,gh=C(()=>{"use strict";oe(),ie(),$(),K(),Dl=(e,t)=>{if(e.length<3||e.length>4)throw new Error("GatherBlockQuantized requires 3 or 4 inputs.");let r=M.normalizeAxis(t.quantizeAxis,e[0].dims.length),i=t.blockSize,a=e[0],n=e[2],s=e.length===4?e[3]:void 0;if(n.dims.length!==a.dims.length||!a.dims.map((o,u)=>u===r?Math.ceil(o/i)===n.dims[u]:o===n.dims[u]).reduce((o,u)=>o&&u,!0))throw new Error("Scales must have the same rank as the input tensor and the dims should match except on gatherAxis.");if(s){if(s.dataType!==a.dataType)throw new Error("Zero point must have the same data type as the input tensor.");if(s.dims.length!==n.dims.length||!s.dims.map((o,u)=>o===n.dims[u]).reduce((o,u)=>o&&u,!0))throw new Error("Zero point must have the same rank as the input tensor and the dims should match except on quantizeAxis.")}},Pl=(e,t)=>{let r=e[0].dims,i=e[1].dims,a=r.length,n=M.normalizeAxis(t.gatherAxis,a),s=M.normalizeAxis(t.quantizeAxis,a),o=r.slice(0);o.splice(n,1,...i);let u=M.size(o),l=e[2].dataType,p=e[0].dataType===22,d=[{type:12,data:u},{type:12,data:s},{type:12,data:n},{type:12,data:t.blockSize},...k(...e.map((m,f)=>m.dims),o)],h=m=>{let f=A("data",e[0].dataType,e[0].dims.length),_=A("inputIndices",e[1].dataType,e[1].dims.length),b=A("scales",e[2].dataType,e[2].dims.length),w=e.length>3?A("zeroPoint",e[3].dataType,e[3].dims.length):void 0,y=j("output",l,o.length),x=[f,_,b];w&&x.push(w);let v=[{name:"output_size",type:"u32"},{name:"quantize_axis",type:"u32"},{name:"gather_axis",type:"u32"},{name:"block_size",type:"u32"}];return`
        ${m.registerUniforms(v).declareVariables(...x,y)}
        ${m.mainStart()}
        let output_indices = ${y.offsetToIndices("global_idx")};
        var indices_indices = ${_.type.indices}(0);
        ${i.length>1?`
          for (var i: u32 = 0; i < ${i.length}; i++) {
            let index = ${y.indicesGet("output_indices","uniforms.gather_axis + i")};
            ${_.indicesSet("indices_indices","i","index")};
          }`:`indices_indices = ${y.indicesGet("output_indices","uniforms.gather_axis")};`};
        var data_indices = ${f.type.indices}(0);
        for (var i: u32 = 0; i < uniforms.gather_axis; i++) {
          let index = ${y.indicesGet("output_indices","i")};
          ${f.indicesSet("data_indices","i","index")};
        }
        var index_from_indices = ${_.getByIndices("indices_indices")};
        if (index_from_indices < 0) {
          index_from_indices += ${r[n]};
        }
        ${f.indicesSet("data_indices","uniforms.gather_axis","u32(index_from_indices)")};
        for (var i = uniforms.gather_axis + 1; i < ${o.length}; i++) {
          let index = ${y.indicesGet("output_indices",`i + ${i.length} - 1`)};
          ${f.indicesSet("data_indices","i","index")};
        }
        let data_offset = ${f.indicesToOffset("data_indices")};
        let data_index = data_offset % 8;
        // Convert 4-bit packed data to 8-bit packed data.
        let packed_4bit_quantized_data = ${f.getByOffset("data_offset / 8")};
        let packed_8bit_quantized_data = (packed_4bit_quantized_data >> (4 * (data_index % 2))) & 0x0f0f0f0f;
        let quantized_data_vec = ${p?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_quantized_data));
        let quantized_data = quantized_data_vec[data_index / 2];
        var scale_indices = data_indices;
        let quantize_axis_index = ${b.indicesGet("data_indices","uniforms.quantize_axis")} / uniforms.block_size;
        ${b.indicesSet("scale_indices","uniforms.quantize_axis","quantize_axis_index")};
        var scale = ${b.getByIndices("scale_indices")};
        ${w?`
              let zero_point_indices = scale_indices;
              let zero_point_offset = ${w.indicesToOffset("zero_point_indices")};
              let zero_point_index = zero_point_offset % 8;
              let packed_4bit_zero_points = ${w.getByOffset("zero_point_offset / 8")};
              let packed_8bit_zero_points = (packed_4bit_zero_points >> (4 * (zero_point_index % 2))) & 0x0f0f0f0f;
              let zero_point_vec = ${p?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_zero_points));
              let zero_point = zero_point_vec[zero_point_index / 2];`:"var zero_point = 0"};
        let dequantized_data = ${z(l)}(quantized_data - zero_point) * scale;
        ${y.setByOffset("global_idx","dequantized_data")};
    }`};return{name:"GatherBlockQuantized",shaderCache:{hint:`${t.cacheKey};${e.filter((m,f)=>f!==1).map(m=>m.dims.join("_")).join(";")}`,inputDependencies:Array.from({length:e.length},(m,f)=>"rank")},getRunData:()=>({outputs:[{dims:o,dataType:l}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:d}),getShaderSource:h}},Ul=(e,t)=>{let r=e.inputs;Dl(r,t),e.compute(Pl(e.inputs,t))},Nl=e=>g({blockSize:e.blockSize,gatherAxis:e.gatherAxis,quantizeAxis:e.quantizeAxis})}),Ll,ql,Fl,Vl,yh=C(()=>{"use strict";oe(),ie(),$(),K(),Ll=e=>{if(!e||e.length!==2)throw new Error("GatherElements requires 2 inputs.");if(e[0].dims.length<1)throw new Error("GatherElements requires that the data input be rank >= 1.");if(e[0].dims.length!==e[1].dims.length)throw new Error(`GatherElements requires that the data input and
                     indices input tensors be of same rank.`)},ql=(e,t)=>{let r=e[0].dims,i=e[0].dataType,a=r.length,n=e[1].dims,s=e[1].dataType,o=M.normalizeAxis(t.axis,a),u=r[o],l=n.slice(0),p=M.size(l),d=A("input",i,a),h=A("indicesInput",s,n.length),m=j("output",i,l.length),f=[{type:12,data:p},{type:6,data:u},{type:12,data:o}];return f.push(...k(r,n,l)),{name:"GatherElements",shaderCache:{inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:l,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(p/64)},programUniforms:f}),getShaderSource:_=>`
      ${_.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(d,h,m)}
      ${_.mainStart()}
      ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

      let outputIndices = ${m.offsetToIndices("global_idx")};

      var idx = ${h.getByOffset("global_idx")};
      if (idx < 0) {
        idx = idx + uniforms.axisDimLimit;
      }
      var inputIndices = ${d.type.indices}(outputIndices);
      ${d.indicesSet("inputIndices","uniforms.axis","u32(idx)")};
      let value = ${d.getByIndices("inputIndices")};

      ${m.setByOffset("global_idx","value")};
  }`}},Fl=e=>g({axis:e.axis}),Vl=(e,t)=>{let r=e.inputs;Ll(r),e.compute(ql(e.inputs,t))}}),Gl,Wl,jl,Hl,_h=C(()=>{"use strict";oe(),ie(),K(),Gl=e=>{if(!e)throw new Error("Input is missing");if(e.length<2||e.length>3)throw new Error("Invaid input number.");if(e.length===3&&e[2].dims.length>2)throw new Error("Invalid input shape of C");if(e[0].dataType!==e[1].dataType||e.length===3&&e[0].dataType!==e[2].dataType)throw new Error("Input types are mismatched")},Wl=(e,t)=>{let r=e[0].dims.slice(),i=e[1].dims.slice(),[a,n,s]=ei.getShapeOfGemmResult(r,t.transA,i,t.transB,e.length===3?e[2].dims:void 0),o=[a,n];if(!o)throw new Error("Can't use gemm on the given tensors");let u=16,l=Math.ceil(n/u),p=Math.ceil(a/u),d=!0,h=M.size(o),m=[{type:12,data:d?l:h},{type:12,data:a},{type:12,data:n},{type:12,data:s},{type:1,data:t.alpha},{type:1,data:t.beta}],f=["type","type"];e.length===3&&(m.push(...k(e[2].dims)),f.push("rank")),m.push(...k(o));let _=w=>{let y="";t.transA&&t.transB?y="value += a[k * uniforms.M + m] * b[n * uniforms.K + k];":t.transA&&!t.transB?y="value += a[k * uniforms.M + m] * b[k * uniforms.N + n];":!t.transA&&t.transB?y="value += a[m * uniforms.K + k] * b[n * uniforms.K + k];":!t.transA&&!t.transB&&(y="value += a[m * uniforms.K + k] * b[k * uniforms.N + n];");let x=t.alpha===1?"":"value *= uniforms.alpha;",v=A("a",e[0].dataType,e[0].dims),S=A("b",e[1].dataType,e[1].dims),I=v.type.value,O=null,P=[v,S];e.length===3&&(O=A("c",e[2].dataType,e[2].dims.length),P.push(O));let V=j("output",e[0].dataType,o.length);P.push(V);let Q=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}];return`
  ${w.registerUniforms(Q).declareVariables(...P)}

  ${w.mainStart()}
    ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let m = global_idx / uniforms.N;
    let n = global_idx % uniforms.N;

    var value = ${I}(0);
    for (var k: u32 = 0u; k < uniforms.K; k++) {
      ${y}
    }

    ${x}
    ${O!=null?`let cOffset = ${O.broadcastedIndicesToOffset("vec2(m, n)",V)}; value += ${I}(uniforms.beta) * ${O.getByOffset("cOffset")};`:""}
    output[global_idx] = value;
  }`},b=w=>{let y=A("a",e[0].dataType,e[0].dims),x=A("b",e[1].dataType,e[1].dims),v=null,S=[y,x];e.length===3&&(v=A("c",e[2].dataType,e[2].dims.length),S.push(v));let I=j("output",e[0].dataType,o.length);S.push(I);let O=[{name:"num_tile_n",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}],P="",V="";t.transA&&t.transB?(V=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${y.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${x.type.value}(0);
      }
      `,P="value += tile_a[k][local_id.y] * tile_b[local_id.x][k];"):t.transA&&!t.transB?(V=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${y.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${x.type.value}(0);
      }
      `,P="value += tile_a[k][local_id.y] * tile_b[k][local_id.x];"):!t.transA&&t.transB?(V=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${y.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${x.type.value}(0);
      }
      `,P="value += tile_a[local_id.y][k] * tile_b[local_id.x][k];"):!t.transA&&!t.transB&&(V=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${y.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${x.type.value}(0);
      }
      `,P="value += tile_a[local_id.y][k] * tile_b[k][local_id.x];");let Q=t.alpha===1?"":"value *= uniforms.alpha;";return`
  ${w.registerUniforms(O).declareVariables(...S)}
  var<workgroup> tile_a: array<array<${y.type.storage}, ${u}>, ${u}>;
  var<workgroup> tile_b: array<array<${x.type.storage}, ${u}>, ${u}>;
  ${w.mainStart([u,u,1])}
    let tile_col_start = (workgroup_index % uniforms.num_tile_n) * ${u};
    let tile_row_start = (workgroup_index / uniforms.num_tile_n) * ${u};
    let num_tiles = (uniforms.K - 1) / ${u} + 1;
    var k_start = 0u;
    var value = ${I.type.value}(0);
    for (var t: u32 = 0u; t < num_tiles; t++) {
      ${V}
      k_start = k_start + ${u};
      workgroupBarrier();

      for (var k: u32 = 0u; k < ${u}; k++) {
        ${P}
      }
      workgroupBarrier();
    }

    ${Q}
    let m = tile_row_start + local_id.y;
    let n = tile_col_start + local_id.x;
    ${v!=null?`let cOffset = ${v.broadcastedIndicesToOffset("vec2(m, n)",I)}; value += ${I.type.value}(uniforms.beta) * ${v.getByOffset("cOffset")};`:""}
    if (m < uniforms.M && n < uniforms.N) {
      output[m * uniforms.N + n] = value;
    }
  }`};return d?{name:"GemmShared",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:f},getRunData:()=>({outputs:[{dims:o,dataType:e[0].dataType}],dispatchGroup:{x:l*p},programUniforms:m}),getShaderSource:b}:{name:"Gemm",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:f},getRunData:()=>({outputs:[{dims:o,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(h/64)},programUniforms:m}),getShaderSource:_}},jl=e=>{let t=e.transA,r=e.transB,i=e.alpha,a=e.beta;return{transA:t,transB:r,alpha:i,beta:a,cacheKey:`${e.transA};${e.transB};${e.alpha===1}`}},Hl=(e,t)=>{Gl(e.inputs),e.compute(Wl(e.inputs,t))}}),Vt,Xt,qr,Fr,Kl,Zl,Ql,Xl,Yl,Jl,ed,td,rd,id,wh=C(()=>{"use strict";oe(),ie(),$(),K(),[Vt,Xt,qr,Fr]=[0,1,2,3],Kl=e=>{if(e[0].dims.length!==4)throw new Error("only 4-D tensor is supported.");if(e[0].dims.length!==e[1].dims.length)throw new Error("input dimensions must be equal to grid dimensions");if(e[0].dims.length-2!==e[1].dims[e[1].dims.length-1])throw new Error(`last dimension of grid must be equal to ${e[0].dims.length-2}`);if(e[0].dims[0]!==e[1].dims[0])throw new Error("grid batch size must match input batch size")},Zl=`
  fn gs_get_cubic_coeffs(x: f32) -> vec4<f32> {
    let cubic_alpha = -0.75f;
    let x_abs = abs(x);
    var coeffs: vec4<f32>;
    coeffs[0] = (((cubic_alpha * (x_abs + 1) - 5 * cubic_alpha) * (x_abs + 1) + 8 * cubic_alpha) * (x_abs + 1) - 4 * cubic_alpha);
    coeffs[1] = (((cubic_alpha + 2) * x_abs - (cubic_alpha + 3)) * x_abs * x_abs + 1);
    coeffs[2] = (((cubic_alpha + 2) * (1 - x_abs) - (cubic_alpha + 3)) * (1 - x_abs) * (1 - x_abs) + 1);
    coeffs[3] = (((cubic_alpha * (2 - x_abs) - 5 * cubic_alpha) * (2 - x_abs) + 8 * cubic_alpha) * (2 - x_abs) - 4 * cubic_alpha);
    return coeffs;
  }
`,Ql=e=>`
  fn gs_bicubic_interpolate(p: mat4x4<${e}>, x: f32, y: f32) -> ${e} {
    var v: vec4<f32>;
    var coeffs = gs_get_cubic_coeffs(x);
    for (var i = 0; i < 4; i++) {
      v[i] = coeffs[0] * p[i][0] + coeffs[1] * p[i][1] + coeffs[2] * p[i][2] + coeffs[3] * p[i][3];
    }
    coeffs = gs_get_cubic_coeffs(y);
    let pixel = ${e}(coeffs[0] * v[0] + coeffs[1] * v[1] + coeffs[2] * v[2] + coeffs[3] * v[3]);
    return pixel;
  }
`,Xl=e=>`
  fn gs_denormalize(n: f32, length: i32) -> f32 {
    ${e.alignCorners===0?`
    // alignCorners: false => [-1, 1] to [-0.5, length - 0.5]
    return ((n + 1.0) * f32(length) - 1.0) / 2.0;
    `:`
    // alignCorners: true => [-1, 1] to [0, length - 1]
    return (n + 1.0) / 2.0 * (f32(length - 1));
    `}
  }
`,Yl=e=>`
  ${e.paddingMode==="reflection"?`
      fn gs_reflect(x: i32, x_min: f32, x_max: f32) -> u32 {
        var dx = 0.0;
        var fx = f32(x);
        let range = x_max - x_min;
        if (fx < x_min) {
          dx = x_min - fx;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_min + r;
          } else {
            fx = x_max - r;
          }
        } else if (fx > x_max) {
          dx = fx - x_max;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_max - r;
          } else {
            fx = x_min + r;
          }
        }
        return u32(fx);
      }`:""}
`,Jl=(e,t,r)=>`
  fn pixel_at_grid(r: i32, c: i32, H: i32, W: i32, batch: u32, channel: u32, border: vec4<f32>) -> ${t} {
     var pixel = ${t}(0);
     var indices = vec4<u32>(0);
     indices[${Vt}] = batch;
     indices[${Xt}] = channel;`+(()=>{switch(r.paddingMode){case"zeros":return`
          if (r >= 0 && r < H && c >=0 && c < W) {
            indices[${qr}] = u32(r);
            indices[${Fr}] = u32(c);
          } else {
            return ${t}(0);
          }
        `;case"border":return`
          indices[${qr}] = u32(clamp(r, 0, H - 1));
          indices[${Fr}] = u32(clamp(c, 0, W - 1));
        `;case"reflection":return`
          indices[${qr}] = gs_reflect(r, border[1], border[3]);
          indices[${Fr}] = gs_reflect(c, border[0], border[2]);
        `;default:throw new Error(`padding mode ${r.paddingMode} is not supported`)}})()+`
    return ${e.getByIndices("indices")};
  }
`,ed=(e,t,r)=>(()=>{switch(r.mode){case"nearest":return`
          let result = pixel_at_grid(i32(round(y)), i32(round(x)), H_in, W_in, indices[${Vt}], indices[${Xt}], border);
        `;case"bilinear":return`
          let x1 = i32(floor(x));
          let y1 = i32(floor(y));
          let x2 = x1 + 1;
          let y2 = y1 + 1;

          let p11 = pixel_at_grid(y1, x1, H_in, W_in, indices[${Vt}], indices[${Xt}], border);
          let p12 = pixel_at_grid(y1, x2, H_in, W_in, indices[${Vt}], indices[${Xt}], border);
          let p21 = pixel_at_grid(y2, x1, H_in, W_in, indices[${Vt}], indices[${Xt}], border);
          let p22 = pixel_at_grid(y2, x2, H_in, W_in, indices[${Vt}], indices[${Xt}], border);

          let dx2 = ${t}(f32(x2) - x);
          let dx1 = ${t}(x - f32(x1));
          let dy2 = ${t}(f32(y2) - y);
          let dy1 = ${t}(y - f32(y1));
          let result = dy2 * (dx2 * p11 + dx1 * p12) + dy1 * (dx2 * p21 + dx1 * p22);
        `;case"bicubic":return`
          let x0 = i32(floor(x)) - 1;
          let y0 = i32(floor(y)) - 1;
          var p: mat4x4<${t}>;
          for (var h = 0; h < 4; h++) {
            for (var w = 0; w < 4; w++) {
              p[h][w] = pixel_at_grid(h + y0, w + x0, H_in, W_in, indices[${Vt}], indices[${Xt}], border);
            }
          }

          let dx = x - f32(x0 + 1);
          let dy = y - f32(y0 + 1);
          let result = gs_bicubic_interpolate(p, dx, dy);
        `;default:throw new Error(`mode ${r.mode} is not supported`)}})()+`${e.setByOffset("global_idx","result")}`,td=(e,t)=>{let r=A("x",e[0].dataType,e[0].dims.length),i=[e[1].dims[0],e[1].dims[1],e[1].dims[2]],a=A("grid",e[1].dataType,i.length,2),n=[e[0].dims[0],e[0].dims[1],e[1].dims[1],e[1].dims[2]];t.format==="NHWC"&&(n=[e[0].dims[0],e[1].dims[1],e[1].dims[2],e[0].dims[3]],[Vt,Xt,qr,Fr]=[0,3,1,2]);let s=j("output",e[0].dataType,n.length),o=r.type.value,u=M.size(n),l=[{type:12,data:u},...k(e[0].dims,i,n)],p=d=>`
  ${d.registerUniform("output_size","u32").declareVariables(r,a,s)}
  ${Zl}
  ${Ql(o)}
  ${Xl(t)}
  ${Yl(t)}
  ${Jl(r,o,t)}

  ${d.mainStart()}
    ${d.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let H_in = i32(uniforms.x_shape[${qr}]);
      let W_in = i32(uniforms.x_shape[${Fr}]);

      ${t.alignCorners===0?`
      let x_min = -0.5;
      let x_max = f32(W_in) - 0.5;
      let y_min = -0.5;
      let y_max = f32(H_in) - 0.5;
      `:`
      let x_min = 0.0;
      let x_max = f32(W_in) - 1.0;
      let y_min = 0.0;
      let y_max = f32(H_in) - 1.0;
      `};
      let border = vec4<f32>(x_min, y_min, x_max, y_max);

      let indices = ${s.offsetToIndices("global_idx")};
      var grid_indices = vec3<u32>(indices[${Vt}], indices[${qr}], indices[${Fr}]);
      let nxy = ${a.getByIndices("grid_indices")};
      var x = gs_denormalize(f32(nxy[0]), W_in);
      var y = gs_denormalize(f32(nxy[1]), H_in);

      ${ed(s,o,t)}
  }`;return{name:"GridSample",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:["type","type"]},getRunData:d=>{let h=M.size(n);return{outputs:[{dims:n,dataType:d[0].dataType}],dispatchGroup:{x:Math.ceil(h/64)},programUniforms:l}},getShaderSource:p}},rd=(e,t)=>{Kl(e.inputs),e.compute(td(e.inputs,t))},id=e=>g({alignCorners:e.align_corners,mode:e.mode,paddingMode:e.padding_mode,format:e.format})}),nt,ad,nd,Wn,sd,pa,od,ud=C(()=>{"use strict";oe(),ie(),$(),ai(),yn(),K(),It(),nt=(e,t)=>e.length>t&&e[t].dims.length>0?e[t]:void 0,ad=(e,t)=>{let r=e[0],i=nt(e,1),a=nt(e,2),n=nt(e,3),s=nt(e,4),o=nt(e,5),u=nt(e,6),l=nt(e,7);if(r.dims.length!==3&&r.dims.length!==5)throw new Error("Input query is expected to have 3 or 5 dimensions");let p=r.dims[0],d=r.dims[1],h=r.dims.length===3?r.dims[2]:t.numHeads*r.dims[4],m=d,f=0,_=0,b=Math.floor(h/t.numHeads);if(u&&l&&M.size(u.dims)&&M.size(l.dims)){if(u.dims.length!==4)throw new Error('Input "past_key" is expected to have 4 dimensions');if(u.dims[0]!==p||u.dims[1]!==t.numHeads||u.dims[3]!==b)throw new Error('Input "past_key" shape (batch_size, num_heads, past_sequence_length, head_size)');if(l.dims[0]!==p||l.dims[1]!==t.numHeads||l.dims[3]!==b)throw new Error('Input "past_value" shape (batch_size, num_heads, past_sequence_length, head_size)');if(u.dims[2]!==l.dims[2])throw new Error('Input "past_key" and "past_value" shall have same dim 2 (past_sequence_length)');if(l.dims.length!==4)throw new Error('Input "past_value" is expected to have 4 dimensions');f=u.dims[2],_=u.dims[2]}else if(u&&M.size(u.dims)||l&&M.size(l.dims))throw new Error('Input "past_key" and "past_value" shall be both present or both absent');let w;if(i&&M.size(i.dims)>0){if(r.dims.length!==3)throw new Error('Input "query" is expected to have 3 dimensions when key is given');if(i.dims.length<3||i.dims.length>5)throw new Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(r.dims[0]!==i.dims[0])throw new Error('Input "query" and "key" shall have same dim 0 (batch size)');if(i.dims.length===3){if(i.dims[2]!==r.dims[2])throw new Error('Input "query" and "key" shall have same dim 2 (hidden_size)');w=2,m=i.dims[1]}else if(i.dims.length===5){if(i.dims[2]!==t.numHeads||i.dims[3]!==2||i.dims[4]!==b)throw new Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(a)throw new Error('Expect "value" be none when "key" has packed kv format.');w=5,m=i.dims[1]}else{if(i.dims[1]!==t.numHeads||i.dims[3]!==b)throw new Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');w=0,m=i.dims[2]}}else{if(r.dims.length!==5)throw new Error('Input "query" is expected to have 5 dimensions when key is empty');if(r.dims[2]!==t.numHeads||r.dims[3]!==3)throw new Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');w=3}if(n&&M.size(n.dims)>0){if(n.dims.length!==1)throw new Error('Input "bias" is expected to have 1 dimension');if(i&&i.dims.length===5&&i.dims[3]===2)throw new Error("bias is not allowed for packed kv.")}let y=f+m,x=0;if(s&&M.size(s.dims)>0){x=8;let O=s.dims;throw O.length===1?O[0]===p?x=1:O[0]===3*p+2&&(x=3):O.length===2&&O[0]===p&&O[1]===y&&(x=5),x===8?new Error('Input "key_padding_mask" shape shall be (batch_size) or (batch_size, total_sequence_length)'):new Error("Mask not supported")}let v=!1,S=h;if(a&&M.size(a.dims)>0){if(a.dims.length!==3&&a.dims.length!==4)throw new Error('Input "value" is expected to have 3 or 4 dimensions');if(r.dims[0]!==a.dims[0])throw new Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(a.dims.length===3){if(m!==a.dims[1])throw new Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');S=a.dims[2]}else{if(m!==a.dims[2])throw new Error('Input "key" and "value" shall have the same dim 2 (kv_sequence_length)');S=a.dims[1]*a.dims[3],v=!0}}let I=!1;if(s&&M.size(s.dims)>0)throw new Error("Key padding mask is not supported");if(o&&M.size(o.dims)>0){if(o.dims.length!==4)throw new Error('Input "attention_bias" is expected to have 4 dimensions');if(o.dims[0]!==p||o.dims[1]!==t.numHeads||o.dims[2]!==d||o.dims[3]!==y)throw new Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:p,sequenceLength:d,pastSequenceLength:f,kvSequenceLength:m,totalSequenceLength:y,maxSequenceLength:_,inputHiddenSize:0,hiddenSize:h,vHiddenSize:S,headSize:b,vHeadSize:Math.floor(S/t.numHeads),numHeads:t.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:t.maskFilterValue,maskType:x,scale:t.scale,broadcastResPosBias:I,passPastInKv:v,qkvFormat:w}},nd=e=>g({...e}),Wn=g({perm:[0,2,1,3]}),sd=(e,t,r,i,a,n,s)=>{let o=[i,a,n],u=M.size(o),l=[{type:12,data:u},{type:12,data:s},{type:12,data:n}],p=d=>{let h=j("qkv_with_bias",t.dataType,o),m=A("qkv",t.dataType,o),f=A("bias",r.dataType,o),_=[{name:"output_size",type:"u32"},{name:"bias_offset",type:"u32"},{name:"hidden_size",type:"u32"}];return`
  ${d.registerUniforms(_).declareVariables(m,f,h)}
  ${d.mainStart()}
    ${d.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let bias_offset_idx = (global_idx % uniforms.hidden_size) + uniforms.bias_offset;

    qkv_with_bias[global_idx] = qkv[global_idx] + bias[bias_offset_idx];
  }`};return e.compute({name:"MultiHeadAttentionAddBias",shaderCache:{inputDependencies:["type","type"]},getRunData:()=>({outputs:[{dims:o,dataType:t.dataType,gpuDataType:0}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:l}),getShaderSource:p},{inputs:[t,r],outputs:[-1]})[0]},pa=(e,t,r,i,a,n,s,o)=>{let u=n;if(s&&M.size(s.dims)>0){if(i===1)throw new Error("AddBiasReshape is not implemented. Please export your model with packed QKV or KV");return u=sd(e,n,s,t,i,r*a,o),u=u.reshape([t,i,r,a]),r===1||i===1?u:e.compute(Je(u,Wn.perm),{inputs:[u],outputs:[-1]})[0]}else return n.dims.length===3&&(u=n.reshape([t,i,r,a])),r===1||i===1?u:e.compute(Je(u,Wn.perm),{inputs:[u],outputs:[-1]})[0]},od=(e,t)=>{let r=ad(e.inputs,t),i=e.inputs[0],a=nt(e.inputs,1),n=nt(e.inputs,2),s=nt(e.inputs,3),o=nt(e.inputs,4),u=nt(e.inputs,5),l=nt(e.inputs,6),p=nt(e.inputs,7);if(i.dims.length===5)throw new Error("Packed QKV is not implemented");if(a?.dims.length===5)throw new Error("Packed KV is not implemented");let d=a&&n&&a.dims.length===4&&n.dims.length===4,h=pa(e,r.batchSize,r.numHeads,r.sequenceLength,r.headSize,i,s,0);if(d)return na(e,h,a,n,o,void 0,l,p,u,r);if(!a||!n)throw new Error("key and value must be provided");let m=pa(e,r.batchSize,r.numHeads,r.kvSequenceLength,r.headSize,a,s,r.hiddenSize),f=pa(e,r.batchSize,r.numHeads,r.kvSequenceLength,r.vHeadSize,n,s,2*r.hiddenSize);na(e,h,m,f,o,void 0,l,p,u,r)}}),ld,dd,pd,cd,jn,hd,fd,md=C(()=>{"use strict";oe(),ie(),$(),K(),ld=e=>{if(!e||e.length<1)throw new Error("too few inputs")},dd=(e,t)=>{let r=[],i=t.numOutputs;return e[1].dims[0]>0&&(e[1].getBigInt64Array().forEach(a=>r.push(Number(a))),i=r.length),g({numOutputs:i,axis:t.axis,splitSizes:r})},pd=e=>`
fn calculateOutputIndex(index: u32) -> u32 {
    for (var i: u32 = 0u; i < ${e}u; i += 1u ) {
    if (index < ${D("uniforms.size_in_split_axis","i",e)}) {
        return i;
    }
    }
    return ${e}u;
}`,cd=e=>{let t=e.length,r=[];for(let i=0;i<t;++i){let a=e[i].setByIndices("indices","input[global_idx]");t===1?r.push(a):i===0?r.push(`if (output_number == ${i}u) { ${a} }`):i===t-1?r.push(`else { ${a} }`):r.push(`else if (output_number == ${i}) { ${a} }`)}return`
      fn writeBufferData(output_number: u32, indices: ${e[0].type.indices}, global_idx: u32) {
        ${r.join(`
`)}
      }`},jn=(e,t)=>{let r=e[0].dims,i=M.size(r),a=e[0].dataType,n=M.normalizeAxis(t.axis,r.length),s=new Array(t.numOutputs),o=A("input",a,r.length),u=new Array(t.numOutputs),l=[],p=[],d=0,h=[{type:12,data:i}];for(let f=0;f<t.numOutputs;f++){d+=t.splitSizes[f],u[f]=d;let _=r.slice();_[n]=t.splitSizes[f],p.push(_),s[f]=j(`output${f}`,a,_.length),l.push({dims:p[f],dataType:e[0].dataType})}h.push({type:12,data:u},...k(r,...p));let m=f=>`
  ${f.registerUniform("input_size","u32").registerUniform("size_in_split_axis","u32",u.length).declareVariables(o,...s)}
  ${pd(u.length)}
  ${cd(s)}

  ${f.mainStart()}
    ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.input_size")}

    var indices = ${o.offsetToIndices("global_idx")};
    var index = ${o.indicesGet("indices",n)};
    let output_number = calculateOutputIndex(index);
    if (output_number != 0) {
      index -= ${D("uniforms.size_in_split_axis","output_number - 1u",u.length)};
      ${o.indicesSet("indices",n,"index")};
    }
    writeBufferData(output_number, indices, global_idx);
  }`;return{name:"Split",shaderCache:{hint:t.cacheKey,inputDependencies:["rank"]},getShaderSource:m,getRunData:()=>({outputs:l,dispatchGroup:{x:Math.ceil(i/64)},programUniforms:h})}},hd=(e,t)=>{ld(e.inputs);let r=e.inputs.length===1?t:dd(e.inputs,t);e.compute(jn(e.inputs,r),{inputs:[0]})},fd=e=>{let t=e.axis,r=e.splitSizes,i=e.numOutputs<0?r.length:e.numOutputs;if(i!==r.length)throw new Error("numOutputs and splitSizes length must be equal");return g({axis:t,numOutputs:i,splitSizes:r})}}),gd,Ba,yd,_d=C(()=>{"use strict";oe(),ie(),$(),K(),gd=(e,t)=>{let[r,i,a,n]=e,{numHeads:s,rotaryEmbeddingDim:o}=t;if(r.dims.length!==3&&r.dims.length!==4)throw new Error(`Input 'x' is expected to have 3 or 4 dimensions, got ${r.dims.length}`);if(!M.areEqual(i.dims,[])&&!M.areEqual(i.dims,[1])&&i.dims.length!==2)throw new Error(`Input 'position_ids' is expected to have 0, 1, or 2 dimensions, got ${i.dims.length}`);if(a.dims.length!==2)throw new Error(`Input 'cos_cache' is expected to have 2 dimensions, got ${a.dims.length}`);if(n.dims.length!==2)throw new Error(`Input 'sin_cache' is expected to have 2 dimensions, got ${n.dims.length}`);if(!M.areEqual(a.dims,n.dims))throw new Error("Inputs 'cos_cache' and 'sin_cache' are expected to have the same shape");if(o>0&&s===0)throw new Error("num_heads must be provided if rotary_embedding_dim is specified");let u=r.dims[0],l=r.dims[r.dims.length-2],p=a.dims[0],d=M.sizeFromDimension(r.dims,1)/l,h=o===0?a.dims[1]*2:d/s;if(o>h)throw new Error("rotary_embedding_dim must be less than or equal to head_size");if(i.dims.length===2){if(u!==i.dims[0])throw new Error(`Input 'position_ids' dimension 0 should be of size batch_size, got ${i.dims[0]}`);if(l!==i.dims[1])throw new Error(`Input 'position_ids' dimension 1 should be of size sequence_length, got ${i.dims[1]}`)}if(l>p)throw new Error("Updating cos_cache and sin_cache in RotaryEmbedding is not currently supported");if(h/2!==a.dims[1]&&o/2!==a.dims[1])throw new Error(`Input 'cos_cache' dimension 1 should be same as head_size / 2 or rotary_embedding_dim / 2, got ${a.dims[1]}`)},Ba=(e,t)=>{let{interleaved:r,numHeads:i,rotaryEmbeddingDim:a,scale:n}=t,s=e[0].dims[0],o=M.sizeFromDimension(e[0].dims,1),u=e[0].dims[e[0].dims.length-2],l=o/u,p=e[2].dims[1],d=a===0?p*2:l/i,h=new Array(s,u,l/d,d-p),m=M.computeStrides(h),f=[{type:1,data:n},{type:12,data:h},{type:12,data:m},...e[0].dims.length===3?new Array({type:12,data:[o,l,d,1]}):[],...e[0].dims.length===4?new Array({type:12,data:[o,d,u*d,1]}):[],...k(e[0].dims,e[1].dims,e[2].dims,e[3].dims,e[0].dims)],_=b=>{let w=A("input",e[0].dataType,e[0].dims.length),y=A("position_ids",e[1].dataType,e[1].dims.length),x=A("cos_cache",e[2].dataType,e[2].dims.length),v=A("sin_cache",e[3].dataType,e[3].dims.length),S=j("output",e[0].dataType,e[0].dims.length);return b.registerUniforms([{name:"scale",type:"f32"},{name:"global_shape",type:"u32",length:h.length},{name:"global_strides",type:"u32",length:m.length},{name:"input_output_strides",type:"u32",length:m.length}]),`
        ${b.declareVariables(w,y,x,v,S)}

        ${b.mainStart(E)}
          let half_rotary_emb_dim = uniforms.${x.name}_shape[1];
          let bsnh = global_idx / uniforms.global_strides % uniforms.global_shape;
          let size = uniforms.global_shape[0] * uniforms.global_strides[0];
          ${b.guardAgainstOutOfBoundsWorkgroupSizes("size")}

          if (bsnh[3] < half_rotary_emb_dim) {
            let position_ids_idx =
                ${y.broadcastedIndicesToOffset("bsnh.xy",j("",y.type.tensor,2))};
            let position_id =
                u32(${y.getByOffset("position_ids_idx")}) + select(0, bsnh[1], position_ids_idx == 0);
            let i = dot(bsnh, uniforms.input_output_strides) + select(0, bsnh[3], ${r});
            let j = i + select(half_rotary_emb_dim, 1, ${r});
            let re = ${w.getByOffset("i")} * ${x.get("position_id","bsnh[3]")} -
                ${w.getByOffset("j")} * ${v.get("position_id","bsnh[3]")};
            ${S.setByOffset("i","re")}
            let im = ${w.getByOffset("i")} * ${v.get("position_id","bsnh[3]")} +
                ${w.getByOffset("j")} * ${x.get("position_id","bsnh[3]")};
            ${S.setByOffset("j","im")}
          } else {
            let k = dot(bsnh, uniforms.input_output_strides) + half_rotary_emb_dim;
            ${S.setByOffset("k",w.getByOffset("k"))}
          }
        }`};return{name:"RotaryEmbedding",shaderCache:{hint:g({interleaved:r}).cacheKey,inputDependencies:["rank","rank","rank","rank"]},getShaderSource:_,getRunData:()=>({outputs:[{dims:e[0].dims,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(M.size(h)/E)},programUniforms:f})}},yd=(e,t)=>{gd(e.inputs,t),e.compute(Ba(e.inputs,t))}}),wd,$d,Hn,bd,vd,$h=C(()=>{"use strict";$(),oe(),yn(),ud(),md(),It(),_d(),K(),wd=(e,t)=>{if(t.doRotary&&e.length<=7)throw new Error("cos_cache and sin_cache inputs are required if do_rotary is specified");let r=e[0],i=e[1],a=e[2],n=e[3],s=e[4];if(t.doRotary!==0&&e.length<=7)throw new Error("cos_cast and sin_cache are expected if do_rotary attribute is non-zero");if(t.localWindowSize!==-1)throw new Error("Local attention is not supported");if(t.softcap!==0)throw new Error("Softcap is not supported");if(t.rotaryInterleaved!==0)throw new Error("Rotary interleaved is not supported");if(t.smoothSoftmax)throw new Error("Smooth softmax is not supported");if(r.dims.length!==3&&r.dims.length!==5)throw new Error("Input query is expected to have 3 or 5 dimensions");let o=!1,u=r.dims[0],l=r.dims[1],p=r.dims.length===3?o?r.dims[2]/3:r.dims[2]:t.numHeads*r.dims[4],d=l,h=0,m=!i||i.dims.length===0,f=Math.floor(m?p/(t.numHeads+2*t.kvNumHeads):p/t.numHeads);m&&(p=f*t.numHeads);let _=n&&n.dims.length!==0,b=s&&s.dims.length!==0;if(_&&n.dims.length===4&&n.dims[0]===u&&n.dims[1]!==t.kvNumHeads&&n.dims[2]===t.kvNumHeads&&n.dims[3]===f)throw new Error("BSNH pastKey/pastValue is not supported");if(_&&b){if(n.dims.length!==4)throw new Error('Input "past_key" is expected to have 4 dimensions');if(s.dims.length!==4)throw new Error('Input "past_value" is expected to have 4 dimensions');h=n.dims[2]}else if(_||b)throw new Error('Input "past_key" and "past_value" shall be both present or both absent');let w=1;if(i&&i.dims.length>0){if(r.dims.length!==3)throw new Error('Input "query" is expected to have 3 dimensions when key is given');if(i.dims.length<3||i.dims.length>5)throw new Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(r.dims[0]!==i.dims[0])throw new Error('Input "query" and "key" shall have same dim 0 (batch size)');if(i.dims.length===3){if(r.dims[2]%i.dims[2]!==0)throw new Error('Dimension 2 of "query" should be a multiple of "key"');d=i.dims[1]}else if(i.dims.length===5){if(i.dims[2]!==t.numHeads||i.dims[3]!==2||i.dims[4]!==f)throw new Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(a)throw new Error('Expect "value" be none when "key" has packed kv format.');d=i.dims[1]}else{if(i.dims[1]!==t.numHeads||i.dims[3]!==f)throw new Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');d=i.dims[2]}}else{if(r.dims.length!==3&&r.dims.length!==5)throw new Error('Input "query" is expected to have 3 or 5 dimensions when key is empty');if(r.dims.length===5&&(r.dims[2]!==t.numHeads||r.dims[3]!==3))throw new Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');w=3}let y=0,x=!1,v=t.kvNumHeads?f*t.kvNumHeads:p;if(a&&a.dims.length>0){if(a.dims.length!==3&&a.dims.length!==4)throw new Error('Input "value" is expected to have 3 or 4 dimensions');if(r.dims[0]!==a.dims[0])throw new Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(a.dims.length===3){if(d!==a.dims[1])throw new Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');v=a.dims[2]}else{if(d!==a.dims[2])throw new Error('Input "past_key" and "past_value" shall have the same dim 2 (kv_sequence_length)');v=a.dims[1]*a.dims[3],x=!0}}let S=e.length>4?e[5]:void 0;if(S){if(S.dims.length===0)throw new Error("seqlens_k must be at least 1D, got scalar.");let I=S.dims.reduce((O,P)=>O*P,1);if(I!==u)throw new Error(`seqlens_k must have batch_size (${u}) elements, got ${I}.`);for(let O=0;O<S.dims.length;O++)if(S.dims[O]!==1&&S.dims[O]!==u)throw new Error(`seqlens_k has unexpected shape. Each dimension must be 1 or batch_size (${u}), got dims[${O}] = ${S.dims[O]}.`)}return{batchSize:u,sequenceLength:l,pastSequenceLength:h,kvSequenceLength:d,totalSequenceLength:-1,maxSequenceLength:-1,inputHiddenSize:0,hiddenSize:p,vHiddenSize:v,headSize:f,vHeadSize:Math.floor(v/t.kvNumHeads),numHeads:t.numHeads,kvNumHeads:t.kvNumHeads,nReps:t.numHeads/t.kvNumHeads,pastPresentShareBuffer:!1,maskType:y,scale:t.scale,broadcastResPosBias:!1,passPastInKv:x,qkvFormat:w}},$d=g({perm:[0,2,1,3]}),Hn=(e,t,r)=>{let i=t,a=r.kvNumHeads;return t.dims.length===3&&r.kvSequenceLength!==0&&(i=t.reshape([r.batchSize,r.kvSequenceLength,a,r.headSize]),i=e.compute(Je(i,$d.perm),{inputs:[i],outputs:[-1]})[0]),i},bd=(e,t,r,i)=>{let a=7,n=["type","type"],s=[e*t],o=e*t,u=[{type:12,data:o},{type:12,data:t},{type:12,data:e}],l=p=>{let d=A("seq_lens",r.dataType,r.dims),h=A("total_seq_lens",i.dataType,i.dims),m=j("pos_ids",a,s),f=[{name:"output_size",type:"u32"},{name:"sequence_length",type:"u32"},{name:"batch_size",type:"u32"}];return`
  ${p.registerUniforms(f).declareVariables(d,h,m)}
  ${p.mainStart()}
    ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let total_sequence_length = u32(${h.getByOffset("0")});
    let is_subsequent_prompt = uniforms.sequence_length > 1 && uniforms.sequence_length != total_sequence_length;
    let is_first_prompt = !is_subsequent_prompt && uniforms.sequence_length == total_sequence_length;
    let batch_idx = global_idx / uniforms.sequence_length;
    let sequence_idx = i32(global_idx % uniforms.sequence_length);
    var pos_id: i32 = 0;
    let seqlen = ${d.getByOffset("batch_idx")};
    let total_seqlen = seqlen + 1;
    if (is_first_prompt) {
      if (sequence_idx < total_seqlen) {
        pos_id = sequence_idx;
      } else {
        pos_id = 1;
      }
      ${m.setByOffset("global_idx","pos_id")}
    } else if (is_subsequent_prompt) {
      let past_seqlen = total_seqlen - i32(uniforms.sequence_length);
      if (past_seqlen + sequence_idx < total_seqlen) {
        pos_id = past_seqlen + sequence_idx;
      } else {
        pos_id = 1;
      }
      ${m.setByOffset("global_idx","pos_id")}
    } else if (global_idx < uniforms.batch_size) {
      ${m.setByOffset("global_idx","seqlen")}
    };
  }
  `};return{name:"GeneratePositionIds",shaderCache:{hint:`${e};${t}`,inputDependencies:n},getRunData:()=>({outputs:[{dims:s,dataType:a}],dispatchGroup:{x:Math.ceil(o/64)},programUniforms:u}),getShaderSource:l}},vd=(e,t)=>{if(e.inputs.length>14&&e.inputs[14]||e.inputs.length>15&&e.inputs[15])throw new Error("GroupQueryAttention (JSEP): q_norm_weight / k_norm_weight inputs are not supported. The per-head Q/K RMS normalization prologue is implemented only on the CUDA and native WebGPU EPs.");let r=wd(e.inputs,t);if(e.inputs[0].dims.length===5)throw new Error("Packed QKV is not implemented");if(e.inputs[1]?.dims.length===5)throw new Error("Packed KV is not implemented");let i=e.inputs[0],a=e.inputs[1]&&e.inputs[1].dims.length>0?e.inputs[1]:void 0,n=e.inputs[2]&&e.inputs[2].dims.length>0?e.inputs[2]:void 0,s=e.inputs[3]&&e.inputs[3].dims.length!==0?e.inputs[3]:void 0,o=e.inputs[4]&&e.inputs[4].dims.length!==0?e.inputs[4]:void 0,u=e.inputs.length>4?e.inputs[5]:void 0,l=e.inputs.length>5?e.inputs[6]:void 0,p=r.kvNumHeads?r.kvNumHeads:r.numHeads,d=g({axis:2,numOutputs:3,splitSizes:[r.numHeads*r.headSize,p*r.headSize,p*r.headSize]}),[h,m,f]=!a&&!n?e.compute(jn([i],d),{inputs:[i],outputs:[-1,-1,-1]}):[i,a,n],_,b;if(t.doRotary){let v=e.compute(bd(r.batchSize,r.sequenceLength,u,l),{inputs:[u,l],outputs:[-1]})[0],S=e.inputs[7],I=e.inputs[8],O=g({interleaved:t.rotaryInterleaved!==0,numHeads:r.numHeads,rotaryEmbeddingDim:0,scale:t.scale}),P=[h,v,S,I],V=[-1];_=e.compute(Ba(P,O),{inputs:P,outputs:V})[0],P.splice(0,1,m);let Q=g({interleaved:t.rotaryInterleaved!==0,numHeads:r.kvNumHeads,rotaryEmbeddingDim:0,scale:t.scale});b=e.compute(Ba(P,Q),{inputs:P,outputs:V})[0]}let w=pa(e,r.batchSize,r.numHeads,r.sequenceLength,r.headSize,t.doRotary?_:h,void 0,0),y=Hn(e,t.doRotary?b:m,r),x=Hn(e,f,r);na(e,w,y,x,void 0,void 0,s,o,void 0,r,u,l)}}),Kn,xd,Sd,Td,bh=C(()=>{"use strict";oe(),ie(),It(),K(),Kn=(e,t,r,i,a,n,s,o)=>{let u=R(n),l=u===1?"f32":`vec${u}f`,p=u===1?"vec2f":`mat2x${u}f`,d=a*s,h=64;d===1&&(h=256);let m=[a,s,n/u],f=[a,s,2],_=["rank","type","type"],b=[];b.push(...k(m,f));let w=y=>{let x=A("x",t.dataType,3,u),v=A("scale",r.dataType,r.dims),S=A("bias",i.dataType,i.dims),I=j("output",1,3,2),O=[x,v,S,I];return`
  var<workgroup> workgroup_shared : array<${p}, ${h}>;
  const workgroup_size = ${h}u;
  ${y.declareVariables(...O)}
  ${y.mainStart(h)}
    let batch = workgroup_index / uniforms.x_shape[1];
    let channel = workgroup_index % uniforms.x_shape[1];
    let hight = uniforms.x_shape[2];
    // initialize workgroup memory
    var sum = ${l}(0);
    var squared_sum = ${l}(0);
    for (var h = local_idx; h < hight; h += workgroup_size) {
      let value = ${l}(${x.get("batch","channel","h")});
      sum += value;
      squared_sum += value * value;
    }
    workgroup_shared[local_idx] = ${p}(sum, squared_sum);
    workgroupBarrier();

    for (var currSize = workgroup_size >> 1;  currSize > 0; currSize = currSize >> 1) {
      if (local_idx < currSize) {
        workgroup_shared[local_idx] = workgroup_shared[local_idx] + workgroup_shared[local_idx + currSize];
      }
      workgroupBarrier();
    }
    if (local_idx == 0) {
      let sum_final = ${L("workgroup_shared[0][0]",u)} / f32(hight * ${u});
      let squared_sum_final = ${L("workgroup_shared[0][1]",u)} / f32(hight * ${u});

      let inv_std_dev = inverseSqrt(squared_sum_final - sum_final * sum_final + f32(${o}));
      let channel_scale = inv_std_dev * f32(scale[channel]);
      let channel_shift = f32(bias[channel]) - sum_final * channel_scale;
      output[workgroup_index] = vec2f(channel_scale, channel_shift);
    }
  }`};return e.compute({name:"InstanceNormComputeChannelScaleShift",shaderCache:{hint:`${u};${o};${h}`,inputDependencies:_},getRunData:()=>({outputs:[{dims:f,dataType:1}],dispatchGroup:{x:d},programUniforms:b}),getShaderSource:w},{inputs:[t,r,i],outputs:[-1]})[0]},xd=(e,t,r)=>{let i=t[0].dims,a=i,n=2,s=i[0],o=i[1],u=M.sizeFromDimension(i,n),l=R(u),p=M.size(a)/l,d=Kn(e,t[0],t[1],t[2],s,u,o,r.epsilon),h=[s,o,u/l],m=[s,o],f=["type","none"],_=b=>{let w=A("x",t[0].dataType,h.length,l),y=A("scale_shift",1,m.length,2),x=j("output",t[0].dataType,h.length,l),v=[w,y,x];return`
  ${b.registerUniform("output_size","u32").declareVariables(...v)}
  ${b.mainStart()}
  ${b.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let outputIndices = ${x.offsetToIndices("global_idx")};
      let batch = outputIndices[0];
      let channel = outputIndices[1];
      let scale_shift = ${y.getByIndices("vec2<u32>(batch, channel)")};
      let value = ${w.getByOffset("global_idx")} * ${x.type.value}(scale_shift.x) + ${x.type.value}(scale_shift.y);
      ${x.setByOffset("global_idx","value")};
  }`};e.compute({name:"InstanceNormalization",shaderCache:{hint:`${l}`,inputDependencies:f},getRunData:()=>({outputs:[{dims:a,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(p/64)},programUniforms:[{type:12,data:p},...k(h,m,h)]}),getShaderSource:_},{inputs:[t[0],d]})},Sd=(e,t,r)=>{let i=t[0].dims,a=i,n=i[0],s=i[i.length-1],o=M.sizeFromDimension(i,1)/s,u=R(s),l=M.size(a)/u,p=[{type:12,data:o},{type:12,data:Math.floor(s/u)}],d=["type","type"],h=!1,m=[0,i.length-1];for(let w=0;w<i.length-2;w++)h=h||i[w+1]!==1,m.push(w+1);h=h&&i[i.length-1]!==1;let f=h?e.compute(Je(e.inputs[0],m),{inputs:[e.inputs[0]],outputs:[-1]})[0]:e.inputs[0].reshape(Array.from({length:i.length},(w,y)=>i[m[y]])),_=Kn(e,f,t[1],t[2],n,o,s,r.epsilon),b=w=>{let y=B(t[0].dataType),x=u===1?"vec2f":`mat${u}x2f`,v=O=>{let P=O===0?"x":"y",V=u===1?"f32":`vec${u}f`;switch(u){case 1:return`${y}(${V}(scale.${P}))`;case 2:return`vec2<${y}>(${V}(scale[0].${P}, scale[1].${P}))`;case 4:return`vec4<${y}>(${V}(scale[0].${P}, scale[1].${P}, scale[2].${P}, scale[3].${P}))`;default:throw new Error(`Not supported compoents ${u}`)}},S=A("input",t[0].dataType,t[0].dims,u),I=j("output",t[0].dataType,a,u);return`
  @group(0) @binding(0) var<storage, read> input : array<${S.type.storage}>;
  @group(0) @binding(1) var<storage, read> scale_input : array<${x}>;
  @group(0) @binding(2) var<storage, read_write> output : array<${I.type.storage}>;
  struct Uniforms {H: u32, C : u32};
  @group(0) @binding(3) var<uniform> uniforms: Uniforms;

  ${w.mainStart()}
    let current_image_number = global_idx / (uniforms.C * uniforms.H);
    let current_channel_number = global_idx % uniforms.C;

    let scale_offset = current_image_number * uniforms.C + current_channel_number;
    let scale = scale_input[scale_offset];
    output[global_idx] = fma(input[global_idx], ${v(0)}, ${v(1)});
  }`};e.compute({name:"InstanceNormalizationNHWC",shaderCache:{hint:`${u}`,inputDependencies:d},getRunData:()=>({outputs:[{dims:a,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(l/64)},programUniforms:p}),getShaderSource:b},{inputs:[t[0],_]})},Td=(e,t)=>{t.format==="NHWC"?Sd(e,e.inputs,t):xd(e,e.inputs,t)}}),Ed,kd,Id,vh=C(()=>{"use strict";oe(),ie(),K(),Ed=e=>{if(!e||e.length<2)throw new Error("layerNorm requires at least 2 inputs.")},kd=(e,t,r)=>{let i=t.simplified,a=e[0].dims,n=e[1],s=!i&&e[2],o=a,u=M.normalizeAxis(t.axis,a.length),l=M.sizeToDimension(a,u),p=M.sizeFromDimension(a,u),d=M.size(n.dims),h=s?M.size(s.dims):0;if(d!==p||s&&h!==p)throw new Error(`Size of X.shape()[axis:] == ${p}.
       Size of scale and bias (if provided) must match this.
       Got scale size of ${d} and bias size of ${h}`);let m=[];for(let S=0;S<a.length;++S)S<u?m.push(a[S]):m.push(1);let f=R(p),_=["type","type"],b=[{type:12,data:l},{type:1,data:p},{type:12,data:Math.floor(p/f)},{type:1,data:t.epsilon}];s&&_.push("type");let w=r>1,y=r>2,x=S=>{let I=B(e[0].dataType),O=[A("x",e[0].dataType,e[0].dims,f),A("scale",n.dataType,n.dims,f)];s&&O.push(A("bias",s.dataType,s.dims,f)),O.push(j("output",e[0].dataType,o,f)),w&&O.push(j("mean_data_output",1,m)),y&&O.push(j("inv_std_output",1,m));let P=[{name:"norm_count",type:"u32"},{name:"norm_size",type:"f32"},{name:"norm_size_vectorized",type:"u32"},{name:"epsilon",type:"f32"}];return`
  ${S.registerUniforms(P).declareVariables(...O)}
  ${S.mainStart()}
    ${S.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.norm_count")}
    let offset = global_idx * uniforms.norm_size_vectorized;
    var mean_vector = ${F("f32",f)};
    var mean_square_vector = ${F("f32",f)};

    for (var h: u32 = 0u; h < uniforms.norm_size_vectorized; h++) {
      let value = ${G(I,f,"x[h + offset]")};
      mean_vector += value;
      mean_square_vector += value * value;
    }
    let mean = ${L("mean_vector",f)} / uniforms.norm_size;
    let inv_std_dev = inverseSqrt(${L("mean_square_vector",f)} / uniforms.norm_size ${i?"":"- mean * mean"} + uniforms.epsilon);

    for (var j: u32 = 0; j < uniforms.norm_size_vectorized; j++) {
      let f32input = ${G(I,f,"x[j + offset]")};
      let f32scale = ${G(I,f,"scale[j]")};
      output[j + offset] = ${O[0].type.value}((f32input ${i?"":"- mean"}) * inv_std_dev * f32scale
        ${s?`+ ${G(I,f,"bias[j]")}`:""}
      );
    }

    ${w?"mean_data_output[global_idx] = mean":""};
    ${y?"inv_std_output[global_idx] = inv_std_dev":""};
  }`},v=[{dims:o,dataType:e[0].dataType}];return w&&v.push({dims:m,dataType:1}),y&&v.push({dims:m,dataType:1}),{name:"LayerNormalization",shaderCache:{hint:`${f};${r};${i}`,inputDependencies:_},getRunData:()=>({outputs:v,dispatchGroup:{x:Math.ceil(l/64)},programUniforms:b}),getShaderSource:x}},Id=(e,t)=>{Ed(e.inputs),e.compute(kd(e.inputs,t,e.outputCount))}}),zd,Cd,xh=C(()=>{"use strict";ie(),Tn(),zn(),zd=e=>{if(!e||e.length!==2)throw new Error("MatMul requires 2 inputs.");if(e[0].dims[e[0].dims.length-1]!==e[1].dims[e[1].dims.length-2])throw new Error("shared dimension does not match.")},Cd=e=>{zd(e.inputs);let t=Nt.calcShape(e.inputs[0].dims,e.inputs[1].dims,!0);if(!t)throw new Error("Can't use matmul on the given tensors");let r=t[t.length-1],i=e.inputs[0].dims[e.inputs[0].dims.length-1];if(r<8&&i<8)e.compute(Sn(e.inputs,{activation:""},t));else{let a=t[t.length-2],n=M.size(e.inputs[0].dims.slice(0,-2)),s=M.size(e.inputs[1].dims.slice(0,-2));if(n!==1&&a===1&&s===1){let o=e.inputs[0].reshape([1,n,i]),u=e.inputs[1].reshape([1,i,r]),l=[1,n,r],p=[o,u];e.compute(za(p,{activation:""},t,l),{inputs:p})}else e.compute(za(e.inputs,{activation:""},t))}}}),Ad,Od,Rd,Bd,Md,Sh=C(()=>{"use strict";oe(),ie(),$(),K(),Ad=(e,t)=>{if(e.length<3||e.length>4)throw new Error("MatMulNBits requires 3 or 4 inputs");let r=e[0],i=r.dims.length;if(r.dims[i-1]!==t.k)throw new Error("The last dim of input shape does not match the k value");let a=Math.floor((t.k+t.blockSize-1)/t.blockSize),n=t.blockSize/8*t.bits,s=e[1];if(!M.areEqual(s.dims,[t.n,a,n]))throw new Error("The second inputs must be 3D tensor with shape N X nBlocksPerCol X blobSize");let o=e[2].dims;if(M.size(o)!==t.n*a)throw new Error("scales input size error.");if(e.length===4){let u=e[3].dims,l=t.n*(t.bits===8?a:Math.floor((a*t.bits+7)/8));if(M.size(u)!==l)throw new Error("zeroPoints input size error.")}},Od=(e,t)=>{let r=e[0].dims,i=r.length,a=r[i-2],n=t.k,s=t.n,o=r.slice(0,i-2),u=M.size(o),l=e[1].dims[2]/4,p=e[0].dataType,d=R(t.k),h=R(l),m=R(s),f=o.concat([a,s]),_=a>1&&s/m%2===0?2:1,b=M.size(f)/m/_,w=64,y=[],x=[u,a,n/d],v=M.convertShape(e[1].dims).slice();v.splice(-1,1,l/h),y.push(...k(x)),y.push(...k(v)),y.push(...k(e[2].dims)),e.length===4&&y.push(...k(M.convertShape(e[3].dims)));let S=[u,a,s/m];y.push(...k(S));let I=O=>{let P=x.length,V=A("a",e[0].dataType,P,d),Q=A("b",12,v.length,h),ye=A("scales",e[2].dataType,e[2].dims.length),ae=[V,Q,ye],ne=e.length===4?A("zero_points",12,e[3].dims.length):void 0;ne&&ae.push(ne);let ke=S.length,X=j("output",e[0].dataType,ke,m),ee=B(e[0].dataType),ge=(()=>{switch(d){case 1:return`array<${ee}, 8>`;case 2:return`mat4x2<${ee}>`;case 4:return`mat2x4<${ee}>`;default:throw new Error(`${d}-component is not supported.`)}})(),we=Math.floor(32/t.bits),he=Math.floor(we/8),ve=()=>{let se="";for(let Y=0;Y<he;Y++){let Qe=Y*t.bits*4,dt=Qe+t.bits;se+=`
          // reuse a data (pass ${Y})
            var input_offset${Y>0?Y:""} = ${Y===0?V.indicesToOffset(`${V.type.indices}(batch, row, word_offset)`):"input_offset"};
            var a_data${Y>0?Y:""}: ${ge};
            for (var j${Y>0?Y:""}: u32 = 0; j${Y>0?Y:""} < ${8/d}; j${Y>0?Y:""}++) {
              a_data${Y>0?Y:""}[j${Y>0?Y:""}] = ${V.getByOffset(`input_offset${Y>0?Y:""}`)};
              input_offset${Y>0?Y:""}++;
            }
          `;for(let Le=0;Le<m*_;Le++)se+=`
            b_value = ${h===1?`b${Le}_data`:`b${Le}_data[i]`};
            ${t.bits===2?`{
              let half_word = b_value >> ${Y*16}u;
              let byte_lo = half_word & 0xFFu;
              let byte_hi = (half_word >> 8u) & 0xFFu;
              let spread_word = (byte_lo & 0xFu) | ((byte_lo >> 4u) << 8u) | ((byte_hi & 0xFu) << 16u) | ((byte_hi >> 4u) << 24u);
              b_value_lower = unpack4xU8(spread_word & b_mask);
              b_value_upper = unpack4xU8((spread_word >> 2u) & b_mask);
            }`:`b_value_lower = unpack4xU8((b_value >> ${Qe}u) & b_mask);
            b_value_upper = unpack4xU8((b_value >> ${dt}u) & b_mask);`}
            b_quantized_values = ${ge}(${Array.from({length:4},(pt,Ae)=>`${ee}(b_value_lower[${Ae}]), ${ee}(b_value_upper[${Ae}])`).join(", ")});
            b_dequantized_values = ${d===1?`${ge}(${Array.from({length:8},(pt,Ae)=>`(b_quantized_values[${Ae}] - ${ne?`zero_point${Le}`:"zero_point"}) * scale${Le}`).join(", ")});`:`(b_quantized_values - ${ge}(${Array(8).fill(`${ne?`zero_point${Le}`:"zero_point"}`).join(",")})) * scale${Le};`};
            workgroup_shared[local_id.x * ${_} + ${Math.floor(Le/m)}]${m>1?`[${Le%m}]`:""} += ${Array.from({length:8/d},(pt,Ae)=>`${d===1?`a_data${Y>0?Y:""}[${Ae}] * b_dequantized_values[${Ae}]`:`dot(a_data${Y>0?Y:""}[${Ae}], b_dequantized_values[${Ae}])`}`).join(" + ")};
          `}return se},W=()=>{let se=`
            var col_index = col * ${m};
            ${ne?`
            let zero_point_values_per_byte: u32 = ${Math.floor(8/t.bits)}u;
            let zero_point_bytes_per_col = (nBlocksPerCol + zero_point_values_per_byte - 1u) / zero_point_values_per_byte;
            var zero_point_byte_count: u32;
            var zero_point_word_index: u32;
            var zero_point_byte_offset: u32;
            let zero_point_sub_offset: u32 = block % zero_point_values_per_byte;
            var zero_point_bits_offset: u32;
            var zero_point_word: u32;`:`
            // The default zero point is ${Math.pow(2,t.bits-1)} for unsigned ${t.bits}-bit quantization.
            let zero_point = ${ee}(${Math.pow(2,t.bits-1).toFixed(1)});`}
            `;for(let Y=0;Y<m*_;Y++)se+=`
            let scale${Y} = ${ye.getByOffset("col_index * nBlocksPerCol + block")};
            ${ne?`
            zero_point_byte_count = col_index * zero_point_bytes_per_col + (block / zero_point_values_per_byte);
            zero_point_word_index = zero_point_byte_count >> 0x2u;
            zero_point_byte_offset = zero_point_byte_count & 0x3u;
            zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_sub_offset * ${t.bits}u);
            zero_point_word = ${ne.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point${Y} = ${ee}((zero_point_word) & ${t.bits===2?"0x3u":"0xFu"});`:""}
            col_index += 1;`;return se},pe=()=>{let se=`col_index = col * ${m};`;for(let Y=0;Y<m*_;Y++)se+=`
            let b${Y}_data = ${Q.getByIndices(`${Q.type.indices}(col_index, block, word)`)};
            col_index += 1;`;return se+=`
            var b_value: u32;
            let b_mask: u32 = ${t.bits===2?"0x03030303u":"0x0F0F0F0Fu"};
            var b_value_lower: vec4<u32>;
            var b_value_upper: vec4<u32>;
            var b_quantized_values: ${ge};
            var b_dequantized_values: ${ge};`,se};return`
        var<workgroup> workgroup_shared: array<${X.type.value}, ${_*w}>;
        ${O.declareVariables(...ae,X)}
        ${O.mainStart([w,1,1])}
          let output_indices = ${X.offsetToIndices(`(global_idx / ${w}) * ${_}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let nBlocksPerCol = uniforms.b_shape[1];

          for (var block = local_id.x; block < nBlocksPerCol; block += ${w}) {
            //process one block
            var word_offset: u32 = block * ${t.blockSize/d};
            ${W()}
            for (var word: u32 = 0; word < ${l}; word += ${h}) {
              ${pe()}
              for (var i: u32 = 0; i < ${h}; i++) {
                ${ve()}
                word_offset += ${we/d};
              }
            }
          }
          workgroupBarrier();

          if (local_id.x < ${_}) {
            var output_value: ${X.type.value} = ${X.type.value}(0);
            var workgroup_shared_offset: u32 = local_id.x;
            for (var b: u32 = 0u; b < ${w}u; b++) {
              output_value += workgroup_shared[workgroup_shared_offset];
              workgroup_shared_offset += ${_};
            }
            ${X.setByIndices(`${X.type.indices}(batch, row, col + local_id.x)`,"output_value")};
          }
        }`};return{name:"MatMulNBits",shaderCache:{hint:`${t.blockSize};${t.bits};${d};${h};${m};${_};${w}`,inputDependencies:Array(e.length).fill("rank")},getRunData:()=>({outputs:[{dims:f,dataType:p}],dispatchGroup:{x:b},programUniforms:y}),getShaderSource:I}},Rd=(e,t)=>{let r=e[0].dims,i=r.length,a=r[i-2],n=t.k,s=t.n,o=r.slice(0,i-2),u=M.size(o),l=e[1].dims[2]/4,p=e[0].dataType,d=R(t.k),h=R(l),m=o.concat([a,s]),f=128,_=s%8===0?8:s%4===0?4:1,b=f/_,w=Math.floor(32/t.bits),y=b*h*w,x=y/d,v=y/t.blockSize,S=M.size(m)/_,I=[],O=[u,a,n/d],P=M.convertShape(e[1].dims).slice();P.splice(-1,1,l/h),I.push(...k(O)),I.push(...k(P)),I.push(...k(e[2].dims)),e.length===4&&I.push(...k(M.convertShape(e[3].dims)));let V=[u,a,s];I.push(...k(V));let Q=ye=>{let ae=O.length,ne=A("a",e[0].dataType,ae,d),ke=A("b",12,P.length,h),X=A("scales",e[2].dataType,e[2].dims.length),ee=[ne,ke,X],ge=e.length===4?A("zero_points",12,e[3].dims.length):void 0;ge&&ee.push(ge);let we=V.length,he=j("output",e[0].dataType,we),ve=B(e[0].dataType),W=()=>{switch(d){case 1:return`
          let a_data0 = vec4<${ve}>(sub_a[word_offset], sub_a[word_offset + 1], sub_a[word_offset + 2], sub_a[word_offset + 3]);
          let a_data1 = vec4<${ve}>(sub_a[word_offset + 4], sub_a[word_offset + 5], sub_a[word_offset + 6], sub_a[word_offset + 7]);`;case 2:return`
          let a_data0 = vec4<${ve}>(sub_a[word_offset], sub_a[word_offset + 1]);
          let a_data1 = vec4<${ve}>(sub_a[word_offset + 2], sub_a[word_offset + 3]);`;case 4:return`
          let a_data0 = sub_a[word_offset];
          let a_data1 = sub_a[word_offset + 1];`;default:throw new Error(`${d}-component is not supported.`)}};return`
        var<workgroup> sub_a: array<${ne.type.value}, ${x}>;
        var<workgroup> inter_results: array<array<${he.type.value}, ${b}>, ${_}>;
        ${ye.declareVariables(...ee,he)}
        ${ye.mainStart([b,_,1])}
          let output_indices = ${he.offsetToIndices(`workgroup_index * ${_}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let n_blocks_per_col = uniforms.b_shape[1];
          let num_tiles =  (n_blocks_per_col - 1) / ${v} + 1;

          // Loop over shared dimension.
          for (var tile: u32 = 0; tile < num_tiles; tile += 1) {
            let a_col_start = tile * ${x};
            // load one tile A data into shared memory.
            for (var a_offset = local_idx; a_offset < ${x}; a_offset += ${f})
            {
              let a_col = a_col_start + a_offset;
              if (a_col < uniforms.a_shape[2])
              {
                sub_a[a_offset] = ${ne.getByIndices(`${ne.type.indices}(batch, row, a_col)`)};
              } else {
                sub_a[a_offset] = ${ne.type.value}(0);
              }
            }
            workgroupBarrier();

            // each thread process one block
            let b_row = col + local_id.y;
            let block = tile * ${v} + local_id.x;
            ${ge?`
            let zero_point_values_per_byte: u32 = ${Math.floor(8/t.bits)}u;
            let zero_point_bytes_per_col = (n_blocks_per_col + zero_point_values_per_byte - 1u) / zero_point_values_per_byte;
            let zero_point_byte_count = b_row * zero_point_bytes_per_col + (block / zero_point_values_per_byte);
            let zero_point_word_index = zero_point_byte_count >> 0x2u;
            let zero_point_byte_offset = zero_point_byte_count & 0x3u;
            let zero_point_sub_offset: u32 = block % zero_point_values_per_byte;
            let zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_sub_offset * ${t.bits}u);
            let zero_point_word = ${ge.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point = ${ve}((zero_point_word) & ${t.bits===2?"0x3u":"0xFu"});`:`
            // The default zero point is ${Math.pow(2,t.bits-1)} for unsigned ${t.bits}-bit quantization.
            let zero_point = ${ve}(${Math.pow(2,t.bits-1).toFixed(1)});`}
            let scale = ${X.getByOffset("b_row * n_blocks_per_col + block")};
            let b_data = ${ke.getByIndices(`${ke.type.indices}(b_row, block, 0)`)};
            var word_offset = local_id.x * ${t.blockSize/d};
            for (var i: u32 = 0; i < ${h}; i++) {
              let b_value = ${h===1?"b_data":"b_data[i]"};
              ${(()=>{let pe=Math.floor(w/8),se="";for(let Y=0;Y<pe;Y++){let Qe=Y*t.bits*4,dt=Qe+t.bits;se+=`
              ${W()}
              {${t.bits===2?`
                let half_word = b_value >> ${Y*16}u;
                let byte_lo = half_word & 0xFFu;
                let byte_hi = (half_word >> 8u) & 0xFFu;
                let spread_word = (byte_lo & 0xFu) | ((byte_lo >> 4u) << 8u) | ((byte_hi & 0xFu) << 16u) | ((byte_hi >> 4u) << 24u);
                let b_value_lower = unpack4xU8(spread_word & 0x03030303u);
                let b_value_upper = unpack4xU8((spread_word >> 2u) & 0x03030303u);`:`
                let b_value_lower = unpack4xU8((b_value >> ${Qe}u) & 0x0F0F0F0Fu);
                let b_value_upper = unpack4xU8((b_value >> ${dt}u) & 0x0F0F0F0Fu);`}
                let b_quantized_values = mat2x4<${ve}>(${Array.from({length:4},(Le,pt)=>`${ve}(b_value_lower[${pt}]), ${ve}(b_value_upper[${pt}])`).join(", ")});
                let b_dequantized_values = (b_quantized_values - mat2x4<${ve}>(${Array(8).fill("zero_point").join(",")})) * scale;
                inter_results[local_id.y][local_id.x] += ${Array.from({length:2},(Le,pt)=>`${`dot(a_data${pt}, b_dequantized_values[${pt}])`}`).join(" + ")};
              }
              word_offset += ${8/d};`}return se})()}
            }
            workgroupBarrier();
          }

          if (local_idx < ${_}) {
            var output_value: ${he.type.value} = ${he.type.value}(0);
            for (var b = 0u; b < ${b}; b++) {
              output_value += inter_results[local_idx][b];
            }
            if (col + local_idx < uniforms.output_shape[2])
            {
              ${he.setByIndices(`${he.type.indices}(batch, row, col + local_idx)`,"output_value")}
            }
          }
        }`};return{name:"BlockwiseMatMulNBits32",shaderCache:{hint:`${t.blockSize};${d};${h};${b};${_}`,inputDependencies:Array(e.length).fill("rank")},getRunData:()=>({outputs:[{dims:m,dataType:p}],dispatchGroup:{x:S},programUniforms:I}),getShaderSource:Q}},Bd=(e,t)=>{Ad(e.inputs,t),t.blockSize===32&&e.adapterInfo.isVendor("intel")&&e.adapterInfo.isArchitecture("gen-12lp")?e.compute(Rd(e.inputs,t)):e.compute(Od(e.inputs,t))},Md=e=>g(e)}),Dd,Pd,Ud,Nd,Ld,qd,Fd,Vd,Gd,Th=C(()=>{"use strict";oe(),ie(),K(),Dd=e=>{if(!e||e.length<1)throw new Error("Too few inputs");if(e[0].dataType!==1&&e[0].dataType!==10)throw new Error("Input type must be float or float16.");if(e.length>=2){let t=e[0].dims.length*2===e[1].dims[0];if(e.length===4&&(t=e[3].dims[0]*2===e[1].dims[0]),!t)throw new Error("The pads should be a 1D tensor of shape [2 * input_rank] or [2 * num_axes].")}},Pd=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
            k = i32(${e.indicesGet("indices",a)}) - ${D("uniforms.pads",a,r)};
            if (k < 0) {
              break;
            }
            if (k >= i32(${D("uniforms.x_shape",a,t)})) {
              break;
            }
            offset += k * i32(${D("uniforms.x_strides",a,t)});
        `;return`
          value = ${e.type.value}(uniforms.constant_value);
          for (var i = 0; i < 1; i++) {
            var offset = 0;
            var k = 0;
            ${i}
            value = x[offset];
          }
      `},Ud=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
                k = i32(${e.indicesGet("indices",a)}) - ${D("uniforms.pads",a,r)};
                if (k < 0) {
                  k = -k;
                }
                {
                  let _2n_1 = 2 * (i32(${D("uniforms.x_shape",a,t)}) - 1);
                  k = k % _2n_1;
                  if(k >= i32(${D("uniforms.x_shape",a,t)})) {
                    k = _2n_1 - k;
                  }
                }
                offset += k * i32(${D("uniforms.x_strides",a,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${i}
              value = x[offset];
          `},Nd=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
                k = i32(${e.indicesGet("indices",a)}) - ${D("uniforms.pads",a,r)};
                if (k < 0) {
                  k = 0;
                }
                if (k >= i32(${D("uniforms.x_shape",a,t)})) {
                  k = i32(${D("uniforms.x_shape",a,t)}) - 1;
                }
                offset += k * i32(${D("uniforms.x_strides",a,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${i}
              value = x[offset];
          `},Ld=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
                k = i32(${e.indicesGet("indices",a)}) - ${D("uniforms.pads",a,r)};
                if (k < 0)  {
                  k += i32(${D("uniforms.x_shape",a,t)}]);
                }
                if (k >= i32(${D("uniforms.x_shape",a,t)})) {
                  k -= i32(${D("uniforms.x_shape",a,t)});
                }
                offset += k * i32(${D("uniforms.x_strides",a,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${i}
              value = x[offset];
          `},qd=(e,t,r)=>{switch(r.mode){case 0:return Pd(e,t,r.pads.length);case 1:return Ud(e,t,r.pads.length);case 2:return Nd(e,t,r.pads.length);case 3:return Ld(e,t,r.pads.length);default:throw new Error("Invalid mode")}},Fd=(e,t)=>{let r=M.padShape(e[0].dims.slice(),t.pads),i=e[0].dims,a=M.size(r),n=[{type:12,data:a},{type:6,data:t.pads}],s=e.length>=3&&e[2].data;t.mode===0&&n.push({type:s?e[2].dataType:1,data:t.value}),n.push(...k(e[0].dims,r));let o=["rank"],u=l=>{let p=j("output",e[0].dataType,r.length),d=A("x",e[0].dataType,i.length),h=d.type.value,m=qd(p,i.length,t),f=[{name:"output_size",type:"u32"},{name:"pads",type:"i32",length:t.pads.length}];return t.mode===0&&f.push({name:"constant_value",type:s?h:"f32"}),`
            ${l.registerUniforms(f).declareVariables(d,p)}
            ${l.mainStart()}
            ${l.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

            let indices = ${p.offsetToIndices("global_idx")};

            var value = ${h}(0);
            ${m}
            output[global_idx] = value;
        }`};return{name:"Pad",shaderCache:{hint:`${t.mode}${s}`,inputDependencies:o},getRunData:()=>({outputs:[{dims:r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(M.size(r)/64)},programUniforms:n}),getShaderSource:u}},Vd=(e,t)=>{if(e.length>1){let r=e[1].getBigInt64Array(),i=e.length>=3&&e[2].data?e[2].dataType===10?e[2].getUint16Array()[0]:e[2].getFloat32Array()[0]:0,a=e[0].dims.length,n=new Int32Array(2*a).fill(0);if(e.length>=4){let o=e[3].getBigInt64Array();for(let u=0;u<o.length;u++)n[Number(o[u])]=Number(r[u]),n[Number(o[u])+a]=Number(r[u+o.length])}else r.forEach((o,u)=>n[Number(u)]=Number(o));let s=[];return n.forEach(o=>s.push(o)),{mode:t.mode,value:i,pads:s}}else return t},Gd=(e,t)=>{Dd(e.inputs);let r=Vd(e.inputs,t);e.compute(Fd(e.inputs,r),{inputs:[0]})}}),ca,Zn,Qn,Xn,Yn,Wd,jd,Jn,es,Hd,Kd,ts,Zd,Qd,rs,Xd,Yd,Jd,ep,Eh=C(()=>{"use strict";Ge(),oe(),ie(),K(),ca=e=>{if(de.webgpu.validateInputContent&&(!e||e.length!==1))throw new Error("Pool ops requires 1 input.")},Zn=(e,t,r)=>{let i=t.format==="NHWC",a=e.dims.slice();i&&a.splice(1,0,a.pop());let n=Object.hasOwnProperty.call(t,"dilations"),s=t.kernelShape.slice(),o=t.strides.slice(),u=n?t.dilations.slice():[],l=t.pads.slice();Jt.adjustPoolAttributes(r,a,s,o,u,l);let p=Jt.computePoolOutputShape(r,a,o,u,s,l,t.autoPad,t.ceilMode),d=Object.assign({},t);n?Object.assign(d,{kernelShape:s,strides:o,pads:l,dilations:u,cacheKey:t.cacheKey}):Object.assign(d,{kernelShape:s,strides:o,pads:l,cacheKey:t.cacheKey});let h=p.slice();return h.push(h.splice(1,1)[0]),[d,i?h:p]},Qn=(e,t)=>{let r=t.format==="NHWC",i=M.size(e),a=M.size(t.kernelShape),n=[{type:12,data:i},{type:12,data:a}],s=[{name:"outputSize",type:"u32"},{name:"kernelSize",type:"u32"}];if(t.kernelShape.length<=2){let o=t.kernelShape[t.kernelShape.length-1],u=t.strides[t.strides.length-1],l=t.pads[t.pads.length/2-1],p=t.pads[t.pads.length-1],d=!!(l+p);n.push({type:12,data:o},{type:12,data:u},{type:12,data:l},{type:12,data:p}),s.push({name:"kw",type:"u32"},{name:"sw",type:"u32"},{name:"pwStart",type:"u32"},{name:"pwEnd",type:"u32"});let h=!1;if(t.kernelShape.length===2){let m=t.kernelShape[t.kernelShape.length-2],f=t.strides[t.strides.length-2],_=t.pads[t.pads.length/2-2],b=t.pads[t.pads.length-2];h=!!(_+b),n.push({type:12,data:m},{type:12,data:f},{type:12,data:_},{type:12,data:b}),s.push({name:"kh",type:"u32"},{name:"sh",type:"u32"},{name:"phStart",type:"u32"},{name:"phEnd",type:"u32"})}return[n,s,!0,d,h]}else{if(r)throw new Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let o=M.computeStrides(t.kernelShape);n.push({type:12,data:o},{type:12,data:t.pads},{type:12,data:t.strides}),s.push({name:"kernelStrides",type:"u32",length:o.length},{name:"pads",type:"u32",length:t.pads.length},{name:"strides",type:"u32",length:t.strides.length});let u=t.pads.reduce((l,p)=>l+p);return[n,s,!!u,!1,!1]}},Xn=(e,t,r,i,a,n,s,o,u,l,p,d)=>{let h=a.format==="NHWC",m=t.type.value,f=j("output",t.type.tensor,i);if(a.kernelShape.length<=2){let _="",b="",w="",y=r-(h?2:1);if(p?_=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${y}] = indices[${y}] * uniforms.sw - uniforms.pwStart + i;
                  if (xIndices[${y}] < 0 || xIndices[${y}]
                      >= uniforms.x_shape[${y}]) {
                    pad++;
                    continue;
                  }
                  let x_val = x[${t.indicesToOffset("xIndices")}];
                  ${n}
                }`:_=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${y}] = indices[${y}] * uniforms.sw - uniforms.pwStart + i;
                  let x_val = x[${t.indicesToOffset("xIndices")}];
                  ${n}
                }`,a.kernelShape.length===2){let x=r-(h?3:2);d?b=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${x}] = indices[${x}] * uniforms.sh - uniforms.phStart + j;
                  if (xIndices[${x}] < 0 || xIndices[${x}] >= uniforms.x_shape[${x}]) {
                    pad += i32(uniforms.kw);
                    continue;
                  }
              `:b=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${x}] = indices[${x}] * uniforms.sh - uniforms.phStart + j;
                `,w=`
              }
            `}return`
            ${e.registerUniforms(u).declareVariables(t,f)}

            ${e.mainStart()}
              ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

              let indices = ${f.offsetToIndices("global_idx")};
              var xIndices = ${f.offsetToIndices("global_idx")};

              var value = ${m}(${o});
              var pad = 0;
              ${b}
              ${_}
              ${w}
              ${s}

              output[global_idx] = value;
            }`}else{if(h)throw new Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let _=a.kernelShape.length,b=a.pads.length,w="";return l?w=`
                if (xIndices[j] >= uniforms.x_shape[j]) {
                  pad++;
                  isPad = true;
                  break;
                }
              }
              if (!isPad) {
                let x_val = x[${t.indicesToOffset("xIndices")}];
                ${n}
              }`:w=`
              }
              let x_val = x[${t.indicesToOffset("xIndices")}];
              ${n}
            `,`
            ${e.registerUniforms(u).declareVariables(t,f)}

            ${e.mainStart()}
              ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
              let indices = ${f.offsetToIndices("global_idx")};
              var xIndices = ${f.offsetToIndices("global_idx")};

              var offsets: array<u32, ${_}>;

              var value = ${m}(${o});
              var pad = 0;
              var isPad = false;

              for (var i: u32 = 0u; i < uniforms.kernelSize; i++) {
                var offset = i;
                for (var j = 0u; j < ${_-1}u; j++) {
                  offsets[j] = offset / ${D("uniforms.kernelStrides","j",_)};
                  offset -= offsets[j] * ${D("uniforms.kernelStrides","j",_)};
                }
                offsets[${_-1}] = offset;

                isPad = false;
                for (var j = ${r-_}u; j < ${r}u; j++) {
                  xIndices[j] = indices[j] * ${D("uniforms.strides",`j - ${r-_}u`,_)}
                    + offsets[j - ${r-_}u] - ${D("uniforms.pads","j - 2u",b)};
                  ${w}
              }
              ${s}

              output[global_idx] = value;
            }`}},Yn=e=>`${e.format};${e.ceilMode};${e.autoPad};${e.kernelShape.length}`,Wd=e=>`${Yn(e)};${e.countIncludePad}`,jd=e=>`${Yn(e)};${e.storageOrder};${e.dilations}`,Jn=e=>({format:e.format,autoPad:["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][e.auto_pad],ceilMode:e.ceil_mode,kernelShape:e.kernel_shape,strides:e.strides,pads:e.pads}),es=(e,t,r,i)=>{let[a,n]=Zn(t,i,r),s=A("x",t.dataType,t.dims.length),o=s.type.value,u="value += x_val;",l="";a.countIncludePad?l+=`value /= ${o}(uniforms.kernelSize);`:l+=`value /= ${o}(i32(uniforms.kernelSize) - pad);`;let[p,d,h,m,f]=Qn(n,a);p.push(...k(t.dims,n));let _=["rank"];return{name:e,shaderCache:{hint:`${i.cacheKey};${h};${m};${f}`,inputDependencies:_},getRunData:()=>({outputs:[{dims:n,dataType:t.dataType}],dispatchGroup:{x:Math.ceil(M.size(n)/64)},programUniforms:p}),getShaderSource:b=>Xn(b,s,t.dims.length,n.length,a,u,l,0,d,h,m,f)}},Hd=e=>{let t=e.count_include_pad!==0,r=Jn(e);if(r.ceilMode!==0)throw new Error("ceil_mode output-shape is computed, but ceil_mode kernel execution (padding/divisor) is not yet implemented in the WebGPU AveragePool kernel");let i={countIncludePad:t,...r,cacheKey:""};return{...i,cacheKey:Wd(i)}},Kd=(e,t)=>{ca(e.inputs),e.compute(es("AveragePool",e.inputs[0],!1,t))},ts={autoPad:"",ceilMode:0,countIncludePad:!1,kernelShape:[],strides:[],pads:[],storageOrder:0,dilations:[]},Zd=e=>{let t=e.format;return{format:t,...ts,cacheKey:t}},Qd=(e,t)=>{ca(e.inputs),e.compute(es("GlobalAveragePool",e.inputs[0],!0,t))},rs=(e,t,r,i)=>{let[a,n]=Zn(t,i,r),s=`
      value = max(x_val, value);
    `,o="",u=A("x",t.dataType,t.dims.length),l=["rank"],[p,d,h,m,f]=Qn(n,a);return p.push(...k(t.dims,n)),{name:e,shaderCache:{hint:`${i.cacheKey};${h};${m};${f}`,inputDependencies:l},getRunData:()=>({outputs:[{dims:n,dataType:t.dataType}],dispatchGroup:{x:Math.ceil(M.size(n)/64)},programUniforms:p}),getShaderSource:_=>Xn(_,u,t.dims.length,n.length,a,s,o,t.dataType===10?-65504:-1e5,d,h,m,f)}},Xd=(e,t)=>{ca(e.inputs),e.compute(rs("MaxPool",e.inputs[0],!1,t))},Yd=e=>{let t=e.storage_order,r=e.dilations,i=Jn(e);if(t!==0)throw new Error("column major storage order is not yet supported for MaxPool");if(i.ceilMode!==0)throw new Error("ceil_mode output-shape is computed, but ceil_mode kernel execution (padding) is not yet implemented in the WebGPU MaxPool kernel");let a={storageOrder:t,dilations:r,...i,cacheKey:""};return{...a,cacheKey:jd(a)}},Jd=e=>{let t=e.format;return{format:t,...ts,cacheKey:t}},ep=(e,t)=>{ca(e.inputs),e.compute(rs("GlobalMaxPool",e.inputs[0],!0,t))}}),tp,rp,ip,ap,kh=C(()=>{"use strict";oe(),ie(),$(),K(),tp=(e,t)=>{if(e.length<2||e.length>3)throw new Error("DequantizeLinear requires 2 or 3 inputs.");if(e.length===3&&e[1].dims===e[2].dims)throw new Error("x-scale and x-zero-point must have the same shape.");if(e.length===3&&e[0].dataType!==e[2].dataType)throw new Error("x and x-zero-point must have the same data type.");if(e[1].dims.length!==0&&e[1].dims.length!==1&&e[1].dims.length!==e[0].dims.length)throw new Error("scale input must be a scalar, a 1D tensor, or have the same rank as the input tensor.");if(e.length>2){if(e[0].dataType!==e[2].dataType)throw new Error("x and x-zero-point must have the same data type.");if(e[1].dims.length!==e[2].dims.length)throw new Error("scale and zero-point inputs must have the same rank.");if(!e[1].dims.map((r,i)=>r===e[2].dims[i]).reduce((r,i)=>r&&i,!0))throw new Error("scale and zero-point inputs must have the same shape.")}if(t.blockSize>0){if(e[1].dims.length===0||e[1].dims.length===1&&e[1].dims[0]===1)throw new Error("blockSize must be set only for block quantization.");if(!e[1].dims.map((a,n)=>n===t.axis||a===e[0].dims[n]).reduce((a,n)=>a&&n,!0))throw new Error("For block qunatization, scale input shape to match the input shape except for the axis");if(e[1].dims.length!==e[0].dims.length)throw new Error("For block qunatization the scale input rank must be the same as the x rank.");let r=e[0].dims[t.axis],i=e[1].dims[t.axis];if(t.blockSize<Math.ceil(r/i)||t.blockSize>Math.ceil(r/(i-1)-1))throw new Error("blockSize must be with in the range [ceil(dI / Si), ceil(dI / (Si - 1) - 1)].")}},rp=(e,t)=>{let r=M.normalizeAxis(t.axis,e[0].dims.length),i=e[0].dataType,a=i===3,n=e[0].dims,s=e[1].dataType,o=M.size(n),u=i===3||i===2,l=u?[Math.ceil(M.size(e[0].dims)/4)]:e[0].dims,p=e[1].dims,d=e.length>2?e[2]:void 0,h=d?u?[Math.ceil(M.size(d.dims)/4)]:d.dims:void 0,m=p.length===0||p.length===1&&p[0]===1,f=m===!1&&p.length===1,_=R(o),b=m&&(!u||_===4),w=b?_:1,y=b&&!u?_:1,x=A("input",u?12:i,l.length,y),v=A("scale",s,p.length),S=d?A("zero_point",u?12:i,h.length):void 0,I=j("output",s,n.length,w),O=[x,v];S&&O.push(S);let P=[l,p];d&&P.push(h);let V=[{type:12,data:o/w},{type:12,data:r},{type:12,data:t.blockSize},...k(...P,n)],Q=ye=>{let ae=[{name:"output_size",type:"u32"},{name:"axis",type:"u32"},{name:"block_size",type:"u32"}];return`
      ${ye.registerUniforms(ae).declareVariables(...O,I)}
      ${ye.mainStart()}
          ${ye.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let output_indices = ${I.offsetToIndices("global_idx")};

          // Set input x
          ${u?`
            let input = ${x.getByOffset("global_idx / 4")};
            let x_vec = ${a?"unpack4xI8(input)":"unpack4xU8(input)"};
            let x_value = ${w===1?"x_vec[global_idx % 4]":"x_vec"};`:`let x_value = ${x.getByOffset("global_idx")};`};

          // Set scale input
          ${m?`let scale_value= ${v.getByOffset("0")}`:f?`
            let scale_index = ${I.indicesGet("output_indices","uniforms.axis")};
            let scale_value= ${v.getByOffset("scale_index")};`:`
            var scale_indices: ${v.type.indices} = output_indices;
            let index = ${v.indicesGet("scale_indices","uniforms.axis")} / uniforms.block_size;
            ${v.indicesSet("scale_indices","uniforms.axis","index")};
            let scale_value= ${v.getByIndices("scale_indices")};`};

          // Set zero-point input
          ${S?m?u?`
                let zero_point_input = ${S.getByOffset("0")};
                let zero_point_vec =  ${a?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value= zero_point_vec[0]`:`let zero_point_value = ${S.getByOffset("0")}`:f?u?`
                let zero_point_index = ${I.indicesGet("output_indices","uniforms.axis")};
                let zero_point_input = ${S.getByOffset("zero_point_index / 4")};
                let zero_point_vec =  ${a?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_index % 4]`:`
                let zero_point_index = ${I.indicesGet("output_indices","uniforms.axis")};
                let zero_point_value = ${S.getByOffset("zero_point_index")};`:u?`
                let zero_point_offset = ${v.indicesToOffset("scale_indices")};
                let zero_point_input = ${S.getByOffset("zero_point_offset / 4")};
                let zero_point_vec = ${a?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_offset % 4];`:`let zero_point_value = ${S.getByIndices("scale_indices")};`:`let zero_point_value = ${u?a?"i32":"u32":x.type.value}(0);`};
      // Compute and write output
      ${I.setByOffset("global_idx",`${I.type.value}(x_value - zero_point_value) * scale_value`)};
      }`};return{name:"DequantizeLinear",shaderCache:{hint:t.cacheKey,inputDependencies:S?["rank","rank","rank"]:["rank","rank"]},getShaderSource:Q,getRunData:()=>({outputs:[{dims:n,dataType:s}],dispatchGroup:{x:Math.ceil(o/w/64),y:1,z:1},programUniforms:V})}},ip=(e,t)=>{tp(e.inputs,t),e.compute(rp(e.inputs,t))},ap=e=>g({axis:e.axis,blockSize:e.blockSize})}),np,sp,op,Ih=C(()=>{"use strict";Ge(),oe(),K(),np=(e,t,r)=>{let i=e===t,a=e<t&&r<0,n=e>t&&r>0;if(i||a||n)throw new Error("Range these inputs' contents are invalid.")},sp=(e,t,r,i)=>{let a=Math.abs(Math.ceil((t-e)/r)),n=[a],s=a,o=[{type:12,data:s},{type:i,data:e},{type:i,data:r},...k(n)],u=l=>{let p=j("output",i,n.length),d=p.type.value,h=[{name:"outputSize",type:"u32"},{name:"start",type:d},{name:"delta",type:d}];return`
        ${l.registerUniforms(h).declareVariables(p)}
        ${l.mainStart()}
        ${l.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        output[global_idx] = uniforms.start + ${d}(global_idx) * uniforms.delta;
      }`};return{name:"Range",shaderCache:{hint:`${i}`},getShaderSource:u,getRunData:()=>({outputs:[{dims:n,dataType:i}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:o})}},op=e=>{let t=0,r=0,i=0;e.inputs[0].dataType===6?(t=e.inputs[0].getInt32Array()[0],r=e.inputs[1].getInt32Array()[0],i=e.inputs[2].getInt32Array()[0]):e.inputs[0].dataType===1&&(t=e.inputs[0].getFloat32Array()[0],r=e.inputs[1].getFloat32Array()[0],i=e.inputs[2].getFloat32Array()[0]),de.webgpu.validateInputContent&&np(t,r,i),e.compute(sp(t,r,i,e.inputs[0].dataType),{inputs:[]})}}),up,lp,dp,pp,zh=C(()=>{"use strict";oe(),ie(),$(),K(),up=(e,t,r,i)=>{if(e!=="none"&&i!=="i32"&&i!=="u32"&&i!=="f32")throw new Error(`Input ${i} is not supported with reduction ${e}.`);let a=`{
                var oldValue = 0;
                loop {
                  let newValueF32 =`,n=`;
                  let newValue = bitcast<i32>(newValueF32);
                  let res = atomicCompareExchangeWeak(&${t}, oldValue, newValue);
                  if res.exchanged {
                    break;
                  }
                  oldValue = res.old_value;
                }
              }`;switch(e){case"none":return`${t}=${r};`;case"add":return i==="i32"||i==="u32"?`atomicAdd(&${t}, bitcast<${i}>(${r}));`:`
              ${a}bitcast<${i}>(oldValue) + (${r})${n}`;case"max":return i==="i32"||i==="u32"?`atomicMax(&${t}, bitcast<${i}>(${r}));`:`
                ${a}max(bitcast<f32>(oldValue), (${r}))${n}`;case"min":return i==="i32"||i==="u32"?`atomicMin(&${t}, bitcast<${i}>(${r}));`:`${a}min(bitcast<${i}>(oldValue), (${r}))${n}`;case"mul":return`${a}(bitcast<${i}>(oldValue) * (${r}))${n}`;default:throw new Error(`Reduction ${e} is not supported.`)}},lp=(e,t)=>{let r=e[0].dims,i=e[1].dims,a=r,n=1,s=Math.ceil(M.sizeToDimension(i,i.length-1)/n),o=i[i.length-1],u=M.sizeFromDimension(r,o),l=[{type:12,data:s},{type:12,data:o},{type:12,data:u},...k(e[1].dims,e[2].dims,a)],p=d=>{let h=A("indices",e[1].dataType,e[1].dims.length),m=A("updates",e[2].dataType,e[2].dims.length,n),f=t.reduction!=="none"&&t.reduction!==""?Ce("output",e[0].dataType,a.length):j("output",e[0].dataType,a.length,n);return`
      ${d.registerUniform("output_size","u32").registerUniform("last_index_dimension","u32").registerUniform("num_updates_elements","u32").declareVariables(h,m,f)}
      ${d.mainStart()}
        ${d.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
  var data_offset = 0u;
  let indices_start = uniforms.last_index_dimension * global_idx;
  let indices_end = indices_start + uniforms.last_index_dimension;
  for (var i = indices_start; i < indices_end; i++) {
    var index = i32(indices[i].x);
    ${e[0].dims.length===1?`
    let element_count_dim = uniforms.output_strides;
    let dim_value = uniforms.output_shape;`:`
    let element_count_dim = uniforms.output_strides[i - indices_start];
    let dim_value = uniforms.output_shape[i - indices_start];`}
    if (index >= 0) {
      if (index >= i32(dim_value)) {
        index = i32(dim_value - 1);
      }
    } else {
      if (index < -i32(dim_value)) {
        index = 0;
      } else {
        index += i32(dim_value);
      }
    }
    data_offset += u32((u32(index) * element_count_dim));
  }

  for (var i = 0u; i < uniforms.num_updates_elements; i++) {
    let value = updates[uniforms.num_updates_elements * global_idx + i];
    ${up(t.reduction,"output[data_offset + i]","value",f.type.value)}
  }

      }`};return{name:"ScatterND",shaderCache:{hint:`${t.cacheKey}_${t.reduction}`,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:a,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:l}),getShaderSource:p}},dp=e=>g({reduction:e.reduction}),pp=(e,t)=>{e.compute(lp(e.inputs,t),{inputs:[e.inputs[1],e.inputs[2]],outputs:[]})}}),cp,hp,fp,is,mp,gp,yp,_p,wp,$p,bp,vp,as,xp,Sp,Tp,Ep,kp,Ip,zp,Ch=C(()=>{"use strict";oe(),ie(),$(),K(),cp=(e,t)=>{if(e.every(r=>r>0||(()=>{throw new Error("Resize requires scales input values to be positive")})),e.length>0){if(t.mode==="linear"){if(!(e.length===2||e.length===3||e.length===4&&e[0]===1&&e[1]===1||e.length===4&&e[0]===1&&e[3]===1||e.length===5&&e[0]===1&&e[1]===1))throw new Error(`For linear mode, Resize requires scales to be 2D, 3D, 4D with either two outermost or one innermost and
            one outermost scale values equal to 1, or 5D with two outermost scale values equal to 1`)}else if(t.mode==="cubic"&&!(e.length===2||e.length===4&&e[0]===1&&e[1]===1||e.length===4&&e[0]===1&&e[3]===1))throw new Error("Resize requires scales input size to be 2 or 4 for cubic mode")}},hp=(e,t,r)=>{t.every(a=>a>=0&&a<r||(()=>{throw new Error("Resize requires axes input values to be positive and less than rank")}));let i=new Array(r).fill(1);return t.forEach((a,n)=>i[a]=e[n]),i},fp=(e,t,r,i,a,n)=>{let[s,o,u]=r>10?[1,2,3]:[-1,e.length>1?1:-1,-1],l=e[0].dims.length;if(s>0&&e.length>s&&e[s].dims.length>0)e[s].getFloat32Array().forEach(p=>n.push(p));else if(t.coordinateTransformMode==="tf_crop_and_resize")throw new Error("Resize requires RoI input to be specified when coordinateTransformMode is tfCropAndResize");if(o>0&&e.length>o&&e[o].dims.length===1&&e[o].dims[0]>0){if(e[o].getFloat32Array().forEach(p=>i.push(p)),i.length!==0&&i.length!==l&&r>=18&&i.length!==t.axes.length)throw new Error("Resize requires scales input size to be same as input rank or axes size for opset 18 and up");cp(i,t),t.axes.length>0&&hp(i,t.axes,l).forEach((p,d)=>i[d]=p)}if(u>0&&e.length>u&&e[u].dims.length===1&&e[u].dims[0]>0&&(e[u].getBigInt64Array().forEach(p=>a.push(Number(p))),a.length!==0&&a.length!==l&&r>=18&&a.length!==t.axes.length))throw new Error("Resize requires sizes input size to be same as input rank or axes size for opset 18 and up");if(t.axes.length>0){if(i.length!==0&&i.length!==t.axes.length)throw new Error('Resize requires "scales" input size to be of axes rank when axes attributes is specified');if(a.length!==0&&a.length!==t.axes.length)throw new Error('Resize requires "sizes" input size to be of rank axes rank when axes attributes is specified')}if(typeof i<"u"&&typeof a<"u"&&i.length>0&&a.length>l)throw new Error("Resize requires only of scales or sizes to be specified")},is=(e,t,r,i)=>`
  // The whole part and the fractional part are calculated separately due to inaccuracy of floating
  // point division. As an example, f32(21) / f32(7) may evaluate to 2.99... instead of 3, causing an
  // offset-by-one error later in floor().
  let big = (${e}) * (${t});
  let whole = ${i}(big / (${r}));
  let fract = ${i}(big % (${r})) / ${i}(${r});
  return whole + fract;
`,mp=(e,t)=>`fn getOriginalCoordinateFromResizedCoordinate(xResized: u32, xScale: f32, lengthResized: u32,
     lengthOriginal: u32, roiStart: f32, roiEnd: f32) -> ${t} { `+(()=>{switch(e){case"asymmetric":return`
          if (xScale < 1.0 || floor(xScale) != xScale) {
            return ${t}(xResized) / ${t}(xScale);
          } else {
            ${is("xResized","lengthOriginal","lengthResized",t)}
          }
        `;case"pytorch_half_pixel":return`if (lengthResized > 1) {
                    return (${t}(xResized) + 0.5) / ${t}(xScale) - 0.5;
                  } else {
                    return 0.0;
                  }`;case"tf_half_pixel_for_nn":return`return (${t}(xResized) + 0.5) / ${t}(xScale);`;case"align_corners":return`if (lengthResized == 1) {
                    return 0.0;
                  } else {
                    ${is("xResized","lengthOriginal - 1","lengthResized - 1",t)}
                  }`;case"tf_crop_and_resize":return`if (lengthResized > 1) {
                    return ${t}(roiStart) * ${t}(lengthOriginal - 1) +
                        (${t}(xResized) * ${t}(roiEnd - roiStart) * ${t}(lengthOriginal - 1)) /
                        ${t}(lengthResized - 1);
                  } else {
                    return 0.5 * ${t}(roiStart + roiEnd) * ${t}(lengthOriginal - 1);
                  }`;case"half_pixel_symmetric":return`const outputWidth = ${t}xScale * ${t}(lengthResized);
                  const adjustment = ${t}(lengthResized) / outputWidth;
                  const center = ${t}(lengthOriginal) / 2;
                  const offset = center * (1 - adjustment);
                  return offset + ((${t}(xResized) + 0.5) / ${t}(xScale)) - 0.5;`;case"half_pixel":return`return ((${t}(xResized) + 0.5) / ${t}(xScale)) - 0.5;`;default:throw new Error(`Coordinate transform mode ${e} is not supported`)}})()+"}",gp=(e,t,r)=>`fn getNearestPixelFromOriginal(xOriginal: ${r}, isDownSample: bool) -> ${r} {`+(()=>{switch(e){case"round_prefer_ceil":return"if (fract(xOriginal) == 0.5) {             return ceil(xOriginal);           } else {             return round(xOriginal);           }";case"floor":return"return floor(xOriginal);";case"ceil":return"return ceil(xOriginal);";case"round_prefer_floor":return"if (fract(xOriginal) == 0.5) {                     return floor(xOriginal);                   } else {                     return round(xOriginal);                   }";default:if(t<11)return"if (isDownSample)                     {                       return ceil(xOriginal);                     } else {                       return xOriginal;                     }";throw new Error(`Nearest mode ${e} is not supported`)}})()+"}",yp=(e,t,r)=>{let i=new Array(r).fill(0).concat(new Array(r).fill(1)),a=e.length===0?i:e.slice();return t.length>0?(t.forEach((n,s)=>{i[n]=a[s],i[s+r]=a[t.length+s]}),i):a},_p=(e,t,r,i)=>{let a=[];if(r.length>0)if(i.length>0){if(e.forEach(n=>a.push(n)),Math.max(...i)>e.length)throw new Error("axes is out of bound");i.forEach((n,s)=>a[n]=r[s])}else r.forEach(n=>a.push(n));else{if(t.length===0)throw new Error("Resize requires either scales or sizes.");a=e.map((n,s)=>Math.round(n*t[s]))}return a},wp=(e,t,r)=>{let i=(()=>{switch(r.keepAspectRatioPolicy){case"not_larger":return r.axes.length>0?Math.min(...r.axes.map(n=>t[n]),Number.MAX_VALUE):Math.min(...t,Number.MAX_VALUE);case"not_smaller":return r.axes.length>0?Math.max(...r.axes.map(n=>t[n]),Number.MIN_VALUE):Math.max(...t,Number.MIN_VALUE);default:throw new Error(`Keep aspect ratio policy ${r.keepAspectRatioPolicy} is not supported`)}})();t.fill(1,0,t.length);let a=e.slice();return r.axes.length>0?(r.axes.forEach(n=>t[n]=i),r.axes.forEach(n=>a[n]=Math.round(e[n]*t[n]))):(t.fill(i,0,t.length),a.forEach((n,s)=>a[s]=Math.round(n*t[s]))),a},$p=(e,t,r,i,a)=>`
    fn calculateOriginalIndicesFromOutputIndices(output_indices: ${e.type.indices}) -> array<${e.type.value}, ${r.length}> {
      var original_indices: array<${e.type.value}, ${r.length}>;
      for (var i:u32 = 0; i < ${r.length}; i++) {
        var output_index = ${e.indicesGet("output_indices","i")};
        var scale = ${D("uniforms.scales","i",i)};
        var roi_low = ${D("uniforms.roi","i",a)};
        var roi_hi = ${D("uniforms.roi",`i + ${t.length}`,a)};
        if (scale == 1.0) {
          original_indices[i] = ${e.type.value}(output_index);
        } else {
          var input_shape_i = ${D("uniforms.input_shape","i",t.length)};
          var output_shape_i = ${D("uniforms.output_shape","i",r.length)};
          original_indices[i] = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                           input_shape_i, roi_low, roi_hi);
        }
      }
      return original_indices;
    }`,bp=(e,t,r,i,a,n,s)=>`
    fn calculateInputIndicesFromOutputIndices(output_indices: ${t.type.indices}) -> ${e.type.indices} {
      var input_indices: ${e.type.indices};
      for (var i:u32 = 0; i < ${i.length}; i++) {
        var output_index = ${t.indicesGet("output_indices","i")};
        var input_index: u32;
        var scale = ${D("uniforms.scales","i",a)};
        if (scale == 1.0) {
          input_index = output_index;
        } else {
          var roi_low = ${D("uniforms.roi","i",n)};
          var roi_hi = ${D("uniforms.roi",`i + ${r.length}`,n)};
          var input_shape_i = ${D("uniforms.input_shape","i",r.length)};
          var output_shape_i = ${D("uniforms.output_shape","i",i.length)};
          var original_idx = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                        input_shape_i, roi_low, roi_hi);
          if (!${s} || (original_idx >= 0 && original_idx < ${t.type.value}(input_shape_i))) {
            if (original_idx < 0) {
              input_index = 0;
            } else if (original_idx > ${t.type.value}(input_shape_i - 1)) {
              input_index = input_shape_i - 1;
            } else {
              input_index = u32(getNearestPixelFromOriginal(original_idx, scale < 1));
            }
          } else {
            input_index = u32(original_idx);
          }
        }
        ${e.indicesSet("input_indices","i","input_index")}
      }
      return input_indices;
    }`,vp=(e,t)=>`
    fn checkInputIndices(input_indices: ${e.type.indices}) -> bool {
      for (var i:u32 = 0; i < ${t.length}; i++) {
        var input_index = ${e.indicesGet("input_indices","i")};
        if (input_index < 0 || input_index >= ${D("uniforms.input_shape","i",t.length)}) {
          return false;
        }
      }
      return true;
    }`,as=(e,t,r,i)=>e.rank>i?`
    ${e.indicesSet("input_indices",t,"channel")};
    ${e.indicesSet("input_indices",r,"batch")};
`:"",xp=(e,t,r,i,a)=>{let[n,s,o,u]=r.length===2?[-1,0,1,-1]:[0,2,3,1],l=e.type.value;return`
    fn getInputValue(batch: u32, channel: u32, row: u32, col: u32) -> ${l} {
      var input_indices: ${e.type.indices};
      ${e.indicesSet("input_indices",s,`max(0, min(row, ${r[s]} - 1))`)};
      ${e.indicesSet("input_indices",o,`max(0, min(col, ${r[o]} - 1))`)};
      ${as(e,u,n,2)}
      return ${e.getByIndices("input_indices")};
    }

    fn bilinearInterpolation(output_indices: ${t.type.indices}) -> ${l} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var row:${l} = originalIndices[${s}];
      var col:${l} = originalIndices[${o}];
      ${i?`if (row < 0 || row > (${r[s]} - 1) || col < 0 || col > (${r[o]} - 1)) {
        return ${a};
      }`:""};
      row = max(0, min(row, ${r[s]} - 1));
      col = max(0, min(col, ${r[o]} - 1));
      var row1: u32 = u32(row);
      var col1: u32 = u32(col);
      var row2: u32 = u32(row + 1);
      var col2: u32 = u32(col + 1);
      var channel: u32 = ${r.length>2?`u32(originalIndices[${u}])`:"0"};
      var batch: u32 =  ${r.length>2?`u32(originalIndices[${n}])`:"0"};
      var x11: ${l} = getInputValue(batch, channel, row1, col1);
      var x12: ${l} = getInputValue(batch, channel, row1, col2);
      var x21: ${l} = getInputValue(batch, channel, row2, col1);
      var x22: ${l} = getInputValue(batch, channel, row2, col2);
      var dx1: ${l} = abs(row - ${l}(row1));
      var dx2: ${l} = abs(${l}(row2) - row);
      var dy1: ${l} = abs(col - ${l}(col1));
      var dy2: ${l} = abs(${l}(col2) - col);
      if (row1 == row2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (col1 == col2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      return (x11 * dx2 * dy2 + x12 * dx2 * dy1 + x21 * dx1 * dy2 + x22 * dx1 * dy1);
    }`},Sp=(e,t,r,i,a,n,s,o,u,l)=>{let p=r.length===2,d=!0,[h,m]=p?[0,1]:d?[2,3]:[1,2],f=e.type.value,_=b=>{let w=b===h?"row":"col";return`
      fn ${w}CubicInterpolation(input_indices: ${e.type.indices}, output_indices: ${t.type.indices}) -> ${f} {
        var output_index = ${t.indicesGet("output_indices",b)};
        var originalIdx: ${f} = getOriginalCoordinateFromResizedCoordinate(output_index, ${a[b]},
        ${i[b]}, ${r[b]}, ${n[b]}, ${n[b]} + ${r.length});
        var fractOriginalIdx: ${f} = originalIdx - floor(originalIdx);
        var coefs = getCubicInterpolationCoefs(fractOriginalIdx);

        if (${o} && (originalIdx < 0 || originalIdx > (${r[b]} - 1))) {
          return ${u};
        }
        var data: array<${f}, 4> = array<${f}, 4>(0.0, 0.0, 0.0, 0.0);
        for (var i: i32 = -1; i < 3; i++) {
          var ${w}: ${f} = originalIdx + ${f}(i);
          if (${w} < 0 || ${w} >= ${r[b]}) {
            ${l?`coefs[i + 1] = 0.0;
                        continue;`:o?`return ${u};`:`${w} = max(0, min(${w}, ${r[b]} - 1));`};
          }
        var input_indices_copy: ${e.type.indices} = input_indices;
          ${e.indicesSet("input_indices_copy",b,`u32(${w})`)};
          data[i + 1] = ${b===h?e.getByIndices("input_indices_copy"):"rowCubicInterpolation(input_indices_copy, output_indices)"};
        }
        return cubicInterpolation1D(data, coefs);
      }`};return`
    ${_(h)};
    ${_(m)};
  fn getCubicInterpolationCoefs(s: ${f}) -> array<${f}, 4> {
    var absS = abs(s);
    var coeffs: array<${f}, 4> = array<${f}, 4>(0.0, 0.0, 0.0, 0.0);
    var oneMinusAbsS: ${f} = 1.0 - absS;
    var twoMinusAbsS: ${f} = 2.0 - absS;
    var onePlusAbsS: ${f} = 1.0 + absS;
    coeffs[0] = ((${s} * onePlusAbsS - 5 * ${s}) * onePlusAbsS + 8 * ${s}) * onePlusAbsS - 4 * ${s};
    coeffs[1] = ((${s} + 2) * absS - (${s} + 3)) * absS * absS + 1;
    coeffs[2] = ((${s} + 2) * oneMinusAbsS - (${s} + 3)) * oneMinusAbsS * oneMinusAbsS + 1;
    coeffs[3] = ((${s} * twoMinusAbsS - 5 * ${s}) * twoMinusAbsS + 8 * ${s}) * twoMinusAbsS - 4 * ${s};
    return coeffs;
  }

  fn cubicInterpolation1D(x: array<${f}, 4>, coefs: array<${f}, 4>) -> ${f} {
    var coefsSum: ${f} = coefs[0] + coefs[1] + coefs[2] + coefs[3];
    return (x[0] * coefs[0] + x[1] * coefs[1]+ x[2] * coefs[2]+ x[3] * coefs[3]) / coefsSum;
  }

  fn bicubicInterpolation(output_indices: ${t.type.indices}) -> ${f} {
    var input_indices: ${e.type.indices} = output_indices;
    return colCubicInterpolation(input_indices, output_indices);
  }
    `},Tp=(e,t,r,i,a)=>{let[n,s,o,u,l]=r.length===3?[-1,0,1,2,-1]:[0,2,3,4,1],p=e.type.value;return`
    fn getInputValue(batch: u32, channel: u32, depth:u32, height: u32, width: u32) -> ${p} {
      var input_indices: ${e.type.indices};
      ${e.indicesSet("input_indices",s,`max(0, min(depth, ${r[s]} - 1))`)};
      ${e.indicesSet("input_indices",o,`max(0, min(height, ${r[o]} - 1))`)};
      ${e.indicesSet("input_indices",u,`max(0, min(width, ${r[u]} - 1))`)};
      ${as(e,l,n,3)}
      return ${e.getByIndices("input_indices")};
    }

    fn trilinearInterpolation(output_indices: ${t.type.indices}) -> ${p} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var depth:${p} = originalIndices[${s}];
      var height:${p} = originalIndices[${o}];
      var width:${p} = originalIndices[${u}];
      ${i?`if (depth < 0 || depth > (${r[s]} - 1) || height < 0 || height > (${r[o]} - 1) || width < 0 || (width > ${r[u]} - 1)) {
      return ${a};
        }`:""};

    depth = max(0, min(depth, ${r[s]} - 1));
      height = max(0, min(height, ${r[o]} - 1));
      width = max(0, min(width, ${r[u]} - 1));
      var depth1: u32 = u32(depth);
      var height1: u32 = u32(height);
      var width1: u32 = u32(width);
      var depth2: u32 = u32(depth + 1);
      var height2: u32 = u32(height + 1);
      var width2: u32 = u32(width + 1);
      var channel: u32 = ${r.length>3?`u32(originalIndices[${l}])`:"0"};
      var batch: u32 =  ${r.length>3?`u32(originalIndices[${n}])`:"0"};

      var x111: ${p} = getInputValue(batch, channel, depth1, height1, width1);
      var x112: ${p} = getInputValue(batch, channel, depth1, height1, width2);
      var x121: ${p} = getInputValue(batch, channel, depth1, height2, width1);
      var x122: ${p} = getInputValue(batch, channel, depth1, height2, width2);
      var x211: ${p} = getInputValue(batch, channel, depth2, height1, width1);
      var x212: ${p} = getInputValue(batch, channel, depth2, height1, width2);
      var x221: ${p} = getInputValue(batch, channel, depth2, height2, width1);
      var x222: ${p} = getInputValue(batch, channel, depth2, height2, width2);
      var dx1: ${p} = abs(depth - ${p}(depth1));
      var dx2: ${p} = abs(${p}(depth2) - depth);
      var dy1: ${p} = abs(height - ${p}(height1));
      var dy2: ${p} = abs(${p}(height2) - height);
      var dz1: ${p} = abs(width - ${p}(width1));
      var dz2: ${p} = abs(${p}(width2) - width);
      if (depth1 == depth2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (height1 == height2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      if (width1 == width2) {
        dz1 = 0.5;
        dz2 = 0.5;
      }
      return (x111 * dx2 * dy2 * dz2 + x112 * dx2 * dy2 * dz1 + x121 * dx2 * dy1 *dz2 + x122 * dx2 * dy1 * dz1 +
              x211 * dx1 * dy2 * dz2 + x212 * dx1 * dy2 * dz1 + x221 * dx1 * dy1 *dz2 + x222 * dx1 * dy1 * dz1);
    }`},Ep=(e,t,r,i,a,n)=>{let s=e.dims,o=yp(n,t.axes,s.length),u=_p(s,i,a,t.axes),l=i.slice();i.length===0&&(l=s.map((y,x)=>y===0?1:u[x]/y),t.keepAspectRatioPolicy!=="stretch"&&(u=wp(s,l,t)));let p=j("output",e.dataType,u.length),d=A("input",e.dataType,s.length),h=M.size(u),m=s.length===u.length&&s.every((y,x)=>y===u[x]),f=t.coordinateTransformMode==="tf_crop_and_resize",_=t.extrapolationValue,b=d.type.value,w=y=>`
      ${m?"":`
      ${mp(t.coordinateTransformMode,b)};
      ${(()=>{switch(t.mode){case"nearest":return`
              ${vp(d,s)};
              ${gp(t.nearestMode,r,b)};
              ${bp(d,p,s,u,l.length,o.length,f)};
              `;case"linear":return`
              ${$p(p,s,u,l.length,o.length)};
              ${(()=>{if(s.length===2||s.length===4)return`${xp(d,p,s,f,_)}`;if(s.length===3||s.length===5)return`${Tp(d,p,s,f,_)}`;throw Error("Linear mode only supports input dims 2, 3, 4 and 5 are supported in linear mode.")})()};
            `;case"cubic":return`
            ${(()=>{if(s.length===2||s.length===4)return`${Sp(d,p,s,u,l,o,t.cubicCoeffA,f,t.extrapolationValue,t.excludeOutside)}`;throw Error("Cubic mode only supports input dims 2 and 4 are supported in linear mode.")})()};
            `;default:throw Error("Invalid resize mode")}})()};
      `}
      ${y.registerUniform("output_size","u32").registerUniform("scales","f32",l.length).registerUniform("roi","f32",o.length).declareVariables(d,p)}
      ${y.mainStart()}
        ${y.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
        ${m?"output[global_idx] = input[global_idx];":`
        let output_indices = ${p.offsetToIndices("global_idx")};
        var input_indices: ${d.type.indices};
        ${(()=>{switch(t.mode){case"nearest":return`input_indices = calculateInputIndicesFromOutputIndices(output_indices);
                if (checkInputIndices(input_indices)) {
                  output[global_idx] = ${d.getByIndices("input_indices")};
                } else {
                  output[global_idx] = ${t.extrapolationValue};
                }`;case"linear":return`output[global_idx] = ${s.length===2||s.length===4?"bilinearInterpolation":"trilinearInterpolation"}(output_indices);`;case"cubic":return"output[global_idx] = bicubicInterpolation(output_indices);";default:throw Error(`Unsupported resize mode: ${t.mode}`)}})()};
`}
      }`;return{name:"Resize",shaderCache:{hint:`${t.cacheKey}|${r}|${l.length>0?t.mode==="cubic"?l:l.length:""}|${a.length>0?a:""}|${o.length>0?o:""}|${m}|${t.mode==="nearest"?s.length:s}`,inputDependencies:["rank"]},getShaderSource:w,getRunData:()=>({outputs:[{dims:u,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(h/64)},programUniforms:[{type:12,data:h},{type:1,data:l},{type:1,data:o},...k(s,u)]})}},kp=e=>{let t=e.customDataBuffer;return new Uint32Array(t.buffer,t.byteOffset,1)[0]},Ip=(e,t)=>{let r=[],i=[],a=[],n=kp(e);if(t.antialias!==0)throw Error("Only default value (0) for Antialias attribute is supported");fp(e.inputs,t,n,r,i,a),e.compute(Ep(e.inputs[0],t,n,r,i,a),{inputs:[0]})},zp=e=>{let t=e.antialias,r=e.axes,i=e.coordinateTransformMode,a=e.cubicCoeffA,n=e.excludeOutside!==0,s=e.extrapolationValue,o=e.keepAspectRatioPolicy,u=e.mode,l=e.nearestMode===""?"simple":e.nearestMode;return g({antialias:t,axes:r,coordinateTransformMode:i,cubicCoeffA:a,excludeOutside:n,extrapolationValue:s,keepAspectRatioPolicy:o,mode:u,nearestMode:l})}}),Cp,Ap,Op,Ah=C(()=>{"use strict";oe(),ie(),K(),Cp=e=>{if(!e||e.length<3)throw new Error("layerNorm requires at least 3 inputs.");let t=e[0],r=e[1],i=e[2];if(t.dataType!==r.dataType||t.dataType!==i.dataType)throw new Error("All inputs must have the same data type");if(t.dims.length!==3&&t.dims.length!==2)throw new Error("Input must be 2D or 3D");if(r.dims.length!==3&&r.dims.length!==2)throw new Error("Skip must be 2D or 3D");let a=t.dims[t.dims.length-1],n=t.dims[t.dims.length-2];if(r.dims[r.dims.length-1]!==a)throw new Error("Skip must have the same hidden size as input");if(r.dims[r.dims.length-2]!==n)throw new Error("Skip must have the same sequence length as input");if(i.dims.length!==1)throw new Error("Gamma must be 1D");if(i.dims[i.dims.length-1]!==a)throw new Error("Gamma must have the same hidden size as input");if(e.length>3){let s=e[3];if(s.dims.length!==1)throw new Error("Beta must be 1D");if(s.dims[s.dims.length-1]!==a)throw new Error("Beta must have the same hidden size as input")}if(e.length>4){let s=e[4];if(s.dims.length!==1)throw new Error("Bias must be 1D");if(s.dims[s.dims.length-1]!==a)throw new Error("Bias must have the same hidden size as input")}},Ap=(e,t,r,i)=>{let a=t.simplified,n=e[0].dims,s=M.size(n),o=n,u=s,l=n.slice(-1)[0],p=i?n.slice(0,-1).concat(1):[],d=!a&&e.length>3,h=e.length>4,m=i&&r>1,f=i&&r>2,_=r>3,b=64,w=R(l),y=[{type:12,data:u},{type:12,data:w},{type:12,data:l},{type:1,data:t.epsilon}],x=S=>{let I=[{name:"output_size",type:"u32"},{name:"components",type:"u32"},{name:"hidden_size",type:"u32"},{name:"epsilon",type:"f32"}],O=[A("x",e[0].dataType,e[0].dims,w),A("skip",e[1].dataType,e[1].dims,w),A("gamma",e[2].dataType,e[2].dims,w)];d&&O.push(A("beta",e[3].dataType,e[3].dims,w)),h&&O.push(A("bias",e[4].dataType,e[4].dims,w)),O.push(j("output",e[0].dataType,o,w)),m&&O.push(j("mean_output",1,p)),f&&O.push(j("inv_std_output",1,p)),_&&O.push(j("input_skip_bias_sum",e[0].dataType,o,w));let P=B(e[0].dataType),V=B(1,w);return`

      ${S.registerUniforms(I).declareVariables(...O)}
      var<workgroup> sum_shared : array<${V}, ${b}>;
      var<workgroup> sum_squared_shared : array<${V}, ${b}>;

      ${S.mainStart([b,1,1])}
        let ix = local_id.x;
        let iy = global_id.x / ${b};

        let hidden_size_vectorized: u32 = uniforms.hidden_size / uniforms.components;
        var stride = hidden_size_vectorized / ${b};
        let offset = ix * stride + iy * hidden_size_vectorized;
        let offset1d = stride * ix;
        if (ix == ${b-1}) {
          stride = hidden_size_vectorized - stride * ix;
        }
        for (var i: u32 = 0; i < stride; i++) {
          let skip_value = skip[offset + i];
          let bias_value = ${h?"bias[offset1d + i]":P+"(0.0)"};
          let input_value = x[offset + i];
          let value = input_value + skip_value + bias_value;
          ${_?"input_skip_bias_sum[offset + i] = value;":""}
          output[offset + i] = value;
          let f32_value = ${G(P,w,"value")};
          sum_shared[ix] += f32_value;
          sum_squared_shared[ix] += f32_value * f32_value;
        }
        workgroupBarrier();

        var reduce_size : u32 = ${b};
        for (var curr_size = reduce_size >> 1;  curr_size > 0; curr_size = reduce_size >> 1) {
          reduce_size = curr_size + (reduce_size & 1);
          if (ix < curr_size) {
            sum_shared[ix] += sum_shared[ix + reduce_size];
            sum_squared_shared[ix] += sum_squared_shared[ix + reduce_size];
          }
          workgroupBarrier();
        }

        let sum = sum_shared[0];
        let square_sum = sum_squared_shared[0];
        let mean = ${L("sum",w)} / f32(uniforms.hidden_size);
        let inv_std_dev = inverseSqrt(${L("square_sum",w)} / f32(uniforms.hidden_size) ${a?"":"- mean * mean"} + uniforms.epsilon);
        ${m?"mean_output[global_idx] = mean;":""}
        ${f?"inv_std_output[global_idx] = inv_std_dev;":""}

        for (var i: u32 = 0; i < stride; i++) {
          output[offset + i] = (output[offset + i] ${a?"":`- ${P}(mean)`}) *
            ${P}(inv_std_dev) * gamma[offset1d + i]
            ${d?"+ beta[offset1d + i]":""};
        }
      }`},v=[{dims:o,dataType:e[0].dataType}];return r>1&&v.push({dims:p,dataType:1}),r>2&&v.push({dims:p,dataType:1}),r>3&&v.push({dims:n,dataType:e[0].dataType}),{name:"SkipLayerNormalization",shaderCache:{hint:`${w};${m};${f};${_}`,inputDependencies:e.map((S,I)=>"type")},getShaderSource:x,getRunData:()=>({outputs:v,dispatchGroup:{x:Math.ceil(u/l)},programUniforms:y})}},Op=(e,t)=>{Cp(e.inputs);let r=[0];e.outputCount>1&&r.push(-3),e.outputCount>2&&r.push(-3),e.outputCount>3&&r.push(3),e.compute(Ap(e.inputs,t,e.outputCount,!1),{outputs:r})}}),Rp,ha,Bp,ns,Mp,Dp,Pp,Up,Oh=C(()=>{"use strict";oe(),ie(),$(),K(),Rp=(e,t)=>{if(!e||e.length<1)throw new Error("too few inputs");if(t.axes.length!==0){if(t.axes.length!==t.starts.length||t.axes.length!==t.ends.length)throw new Error("axes, starts and ends must have the same length")}else if(t.starts.length!==t.ends.length)throw new Error("starts and ends must have the same length");e.slice(1).forEach((r,i)=>{if(e[i+1].dataType!==6&&e[i+1].dataType!==7)throw new Error(`Input ${i} must be an array of int32 or int64`)})},ha=(e,t)=>{let r=[];if(e.length>t)if(e[t].dataType===7)e[t].getBigInt64Array().forEach(i=>r.push(Number(i)));else if(e[t].dataType===6)e[t].getInt32Array().forEach(i=>r.push(Number(i)));else throw new Error(`Input ${t} must be an array of int32 or int64`);return r},Bp=(e,t)=>{if(e.length>1){let r=ha(e,1),i=ha(e,2),a=ha(e,3);return a.length===0&&(a=[...Array(e[0].dims.length).keys()]),g({starts:r,ends:i,axes:a})}else return t},ns=(e,t,r,i,a)=>{let n=e;return e<0&&(n+=r[i[t]]),a[t]<0?Math.max(0,Math.min(n,r[i[t]]-1)):Math.max(0,Math.min(n,r[i[t]]))},Mp=(e,t,r)=>`fn calculateInputIndices(output_indices: ${t.type.indices}) -> ${e.type.indices} {
          var input_indices: ${e.type.indices};
          var carry = 0u;
          for (var i = ${r.length-1}; i >= 0; i--) {
            let input_shape_i = ${D("uniforms.input_shape","i",r.length)};
            let steps_i = ${D("uniforms.steps","i",r.length)};
            let signs_i = ${D("uniforms.signs","i",r.length)};
            let starts_i = ${D("uniforms.starts","i",r.length)};
            var output_index = ${t.indicesGet("output_indices","i")};
            var input_index = output_index * steps_i + starts_i + carry;
            carry = input_index / input_shape_i;
            input_index = input_index % input_shape_i;
            if (signs_i < 0) {
              input_index = input_shape_i - input_index - 1u + starts_i;
            }
            ${e.indicesSet("input_indices","i","input_index")};
          }
          return input_indices;
      }`,Dp=(e,t)=>{let r=e[0].dims,i=M.size(r),a=t.axes.length>0?M.normalizeAxes(t.axes,r.length):[...Array(r.length).keys()],n=ha(e,4);n.forEach(w=>w!==0||(()=>{throw new Error("step cannot be 0")})),n.length===0&&(n=Array(a.length).fill(1));let s=t.starts.map((w,y)=>ns(w,y,r,a,n)),o=t.ends.map((w,y)=>ns(w,y,r,a,n));if(a.length!==s.length||a.length!==o.length)throw new Error("start, ends and axes should have the same number of elements");if(a.length!==r.length)for(let w=0;w<r.length;++w)a.includes(w)||(s.splice(w,0,0),o.splice(w,0,r[w]),n.splice(w,0,1));let u=n.map(w=>Math.sign(w));n.forEach((w,y,x)=>{if(w<0){let v=(o[y]-s[y])/w,S=s[y],I=S+v*n[y];s[y]=I,o[y]=S,x[y]=-w}});let l=r.slice(0);a.forEach((w,y)=>{l[w]=Math.ceil((o[w]-s[w])/n[w])});let p={dims:l,dataType:e[0].dataType},d=j("output",e[0].dataType,l.length),h=A("input",e[0].dataType,e[0].dims.length),m=M.size(l),f=[{name:"outputSize",type:"u32"},{name:"starts",type:"u32",length:s.length},{name:"signs",type:"i32",length:u.length},{name:"steps",type:"u32",length:n.length}],_=[{type:12,data:m},{type:12,data:s},{type:6,data:u},{type:12,data:n},...k(e[0].dims,l)],b=w=>`
      ${w.registerUniforms(f).declareVariables(h,d)}
        ${Mp(h,d,r)}
        ${w.mainStart()}
          ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
          let output_indices = ${d.offsetToIndices("global_idx")};
          let input_indices = calculateInputIndices(output_indices);
          ${d.setByOffset("global_idx",h.getByIndices("input_indices"))}
      }`;return{name:"Slice",shaderCache:{hint:`${u.length}_${s.length}_${n.length}`,inputDependencies:["rank"]},getShaderSource:b,getRunData:()=>({outputs:[p],dispatchGroup:{x:Math.ceil(i/64)},programUniforms:_})}},Pp=(e,t)=>{Rp(e.inputs,t);let r=Bp(e.inputs,t);e.compute(Dp(e.inputs,r),{inputs:[0]})},Up=e=>{let t=e.starts,r=e.ends,i=e.axes;return g({starts:t,ends:r,axes:i})}}),Np,Lp,qp,Fp,Rh=C(()=>{"use strict";oe(),ie(),$(),It(),K(),Np=e=>{if(!e||e.length!==1)throw new Error("Softmax op requires 1 input.")},Lp=(e,t)=>{let r=e.inputs[0],i=r.dims,a=M.size(i),n=i.length,s=M.normalizeAxis(t.axis,n),o=s<i.length-1,u,l=[];o?(l=Array.from({length:n},(O,P)=>P),l[s]=n-1,l[n-1]=s,u=e.compute(Je(r,l),{inputs:[r],outputs:[-1]})[0]):u=r;let p=u.dims,d=p[n-1],h=a/d,m=R(d),f=d/m,_=64;h===1&&(_=256);let b=(O,P)=>P===4?`max(max(${O}.x, ${O}.y), max(${O}.z, ${O}.w))`:P===2?`max(${O}.x, ${O}.y)`:P===3?`max(max(${O}.x, ${O}.y), ${O}.z)`:O,w=A("x",u.dataType,u.dims,m),y=j("result",u.dataType,u.dims,m),x=w.type.value,v=B(u.dataType)==="f32"?`var threadMax = ${x}(-3.4028234663852886e+38f);`:`var threadMax = ${x}(-65504.0h);`,S=O=>`
      var<workgroup> rowMaxShared : ${x};
      var<workgroup> rowSumShared : ${x};
      var<workgroup> threadShared : array<${x}, ${_}>;

      fn getValue(row: i32, col: i32, row_stride: i32) -> ${x} {
        let index = row * row_stride + col;
        return x[index];
      }

      fn setValue(row: i32, col: i32, row_stride: i32, value: ${x}) {
        let index = row * row_stride + col;
        result[index] = value;
      }
      ${O.registerUniform("packedCols","i32").declareVariables(w,y)}
      ${O.mainStart(_)}
        let gindex = i32(global_idx);
        let lindex = i32(local_idx);
        const wg = ${_};
        let row = gindex / wg;
        let cols = uniforms.packedCols;
        let row_stride : i32 = uniforms.packedCols;

        // find the rows max
        ${v}
        for (var col = lindex; col < cols; col += wg) {
          let value = getValue(row, col, row_stride);
          threadMax = max(threadMax, value);
        }
        if (lindex < cols) {
          threadShared[lindex] = threadMax;
        }
        workgroupBarrier();

        var reduceSize = min(cols, wg);
        for (var currSize = reduceSize >> 1;  currSize > 0; currSize = reduceSize >> 1) {
          reduceSize = currSize + (reduceSize & 1);
          if (lindex < currSize) {
            threadShared[lindex] = max(threadShared[lindex], threadShared[lindex + reduceSize]);
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowMaxShared = ${x}(${b("threadShared[0]",m)});
        }
        workgroupBarrier();

        // find the rows sum
        var threadSum = ${x}(0.0);
        for (var col = lindex; col < cols; col += wg) {
          let subExp = exp(getValue(row, col, row_stride) - rowMaxShared);
          threadSum += subExp;
        }
        threadShared[lindex] = threadSum;
        workgroupBarrier();

        for (var currSize = wg >> 1;  currSize > 0; currSize = currSize >> 1) {
          if (lindex < currSize) {
            threadShared[lindex] = threadShared[lindex] + threadShared[lindex + currSize];
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowSumShared = ${x}(${L("threadShared[0]",m)});
        }
        workgroupBarrier();

        // calculate final value for each element in the row
        for (var col = lindex; col < cols; col += wg) {
          var value = exp(getValue(row, col, row_stride) - rowMaxShared) / rowSumShared;
          // max operation protects against NaN since all values should be >=0
          value = max(value, ${x}(0.0));
          setValue(row, col, row_stride, value);
        }
      }`,I=e.compute({name:"Softmax",shaderCache:{hint:`${m};${_}`,inputDependencies:["type"]},getRunData:()=>({outputs:[{dims:p,dataType:u.dataType}],dispatchGroup:{x:h},programUniforms:[{type:6,data:f}]}),getShaderSource:S},{inputs:[u],outputs:[o?-1:0]})[0];o&&e.compute(Je(I,l),{inputs:[I]})},qp=(e,t)=>{Np(e.inputs),Lp(e,t)},Fp=e=>g({axis:e.axis})}),ss,Vp,Gp,Wp,jp,Bh=C(()=>{"use strict";oe(),ie(),K(),ss=e=>Array.from(e.getBigInt64Array(),Number),Vp=e=>{if(!e||e.length!==2)throw new Error("Tile requires 2 inputs.");if(e[0].dataType!==1&&e[0].dataType!==10&&e[0].dataType!==6&&e[0].dataType!==12)throw new Error("Tile only support float, float16, int32, and uint32 data types");if(e[1].dataType!==7)throw new Error("Tile `repeats` input should be of int64 data type");if(e[1].dims.length!==1)throw new Error("Tile `repeats` input should be 1-D");if(ss(e[1]).length!==e[0].dims.length)throw new Error("Tile `repeats` input should have same number of elements as rank of input data tensor")},Gp=(e,t)=>{let r=[];for(let i=0;i<e.length;++i)r.push(e[i]*t[i]);return r},Wp=(e,t)=>{let r=e[0].dims,i=t??ss(e[1]),a=Gp(r,i),n=M.size(a),s=e[0].dataType,o=A("input",s,r.length),u=j("output",s,a.length),l=p=>`
      const inputShape = ${o.indices(...r)};
      ${p.registerUniform("output_size","u32").declareVariables(o,u)}
      ${p.mainStart()}
      ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let output_indices = ${u.offsetToIndices("global_idx")};
      var input_indices: ${o.type.indices};
      for (var i = 0; i < ${r.length}; i++) {
        let input_dim_i = ${o.indicesGet("uniforms.input_shape","i")};
        let input_dim_value = ${u.indicesGet("output_indices","i")}  % input_dim_i;

        ${o.indicesSet("input_indices","i","input_dim_value")}
      }
      ${u.setByOffset("global_idx",o.getByIndices("input_indices"))}
    }`;return{name:"Tile",shaderCache:{hint:`${i}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:a,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(n/64)},programUniforms:[{type:12,data:n},...k(e[0].dims,a)]}),getShaderSource:l}},jp=e=>{Vp(e.inputs),e.compute(Wp(e.inputs),{inputs:[0]})}}),Hp,Kp,Zp,Mh=C(()=>{"use strict";oe(),ie(),K(),Hp=(e,t,r,i,a)=>{let n=j("output_data",a,r.length,4),s=A("a_data",t[1].dataType,t[1].dims.length,4),o=A("b_data",t[2].dataType,t[2].dims.length,4),u=A("c_data",t[0].dataType,t[0].dims.length,4),l,p=(d,h,m)=>`select(${h}, ${d}, ${m})`;if(!i)l=n.setByOffset("global_idx",p(s.getByOffset("global_idx"),o.getByOffset("global_idx"),u.getByOffset("global_idx")));else{let d=(h,m,f="")=>{let _=`a_data[index_a${m}][component_a${m}]`,b=`b_data[index_b${m}][component_b${m}]`,w=`bool(c_data[index_c${m}] & (0xffu << (component_c${m} * 8)))`;return`
            let output_indices${m} = ${n.offsetToIndices(`global_idx * 4u + ${m}u`)};
            let offset_a${m} = ${s.broadcastedIndicesToOffset(`output_indices${m}`,n)};
            let offset_b${m} = ${o.broadcastedIndicesToOffset(`output_indices${m}`,n)};
            let offset_c${m} = ${u.broadcastedIndicesToOffset(`output_indices${m}`,n)};
            let index_a${m} = offset_a${m} / 4u;
            let index_b${m} = offset_b${m} / 4u;
            let index_c${m} = offset_c${m} / 4u;
            let component_a${m} = offset_a${m} % 4u;
            let component_b${m} = offset_b${m} % 4u;
            let component_c${m} = offset_c${m} % 4u;
            ${h}[${m}] = ${f}(${p(_,b,w)});
          `};a===9?l=`
            var data = vec4<u32>(0);
            ${d("data",0,"u32")}
            ${d("data",1,"u32")}
            ${d("data",2,"u32")}
            ${d("data",3,"u32")}
            output_data[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:l=`
            ${d("output_data[global_idx]",0)}
            ${d("output_data[global_idx]",1)}
            ${d("output_data[global_idx]",2)}
            ${d("output_data[global_idx]",3)}
          `}return`
        ${e.registerUniform("vec_size","u32").declareVariables(u,s,o,n)}
        ${e.mainStart()}
        ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${l}
      }`},Kp=e=>{let t=e[1].dims,r=e[2].dims,i=e[0].dims,a=e[1].dataType,n=!(M.areEqual(t,r)&&M.areEqual(r,i)),s=t,o=M.size(t);if(n){let l=Nt.calcShape(Nt.calcShape(t,r,!1),i,!1);if(!l)throw new Error("Can't perform where op on the given tensors");s=l,o=M.size(s)}let u=Math.ceil(o/4);return{name:"Where",shaderCache:{inputDependencies:["rank","rank","rank"]},getShaderSource:l=>Hp(l,e,s,n,a),getRunData:()=>({outputs:[{dims:s,dataType:a}],dispatchGroup:{x:Math.ceil(o/64/4)},programUniforms:[{type:12,data:u},...k(i,t,r,s)]})}},Zp=e=>{e.compute(Kp(e.inputs))}}),Qp,Dh=C(()=>{"use strict";Zc(),yn(),Qc(),Xc(),Yc(),Jc(),eh(),nh(),oh(),uh(),lh(),dh(),ph(),ch(),hh(),fh(),mh(),gh(),yh(),_h(),wh(),$h(),bh(),vh(),xh(),Sh(),ud(),Th(),Eh(),kh(),Ih(),zh(),fn(),Ch(),_d(),Ah(),Oh(),Rh(),md(),Bh(),It(),bn(),Mh(),Qp=new Map([["Abs",[bo]],["Acos",[vo]],["Acosh",[xo]],["Add",[pu]],["ArgMax",[no,gn]],["ArgMin",[ao,gn]],["Asin",[So]],["Asinh",[To]],["Atan",[Eo]],["Atanh",[ko]],["Attention",[co]],["AveragePool",[Kd,Hd]],["BatchNormalization",[go]],["BiasAdd",[wo]],["BiasSplitGelu",[uu]],["Cast",[zo,Io]],["Ceil",[Oo]],["Clip",[Ao]],["Concat",[Tu,Eu]],["Conv",[Bn,On]],["ConvTranspose",[Ju,Qu]],["Cos",[Ro]],["Cosh",[Bo]],["CumSum",[tl,rl]],["DepthToSpace",[sl,ol]],["DequantizeLinear",[ip,ap]],["DFT",[fl,ml]],["Div",[cu]],["Einsum",[bl,vl]],["Elu",[Mo,sa]],["Equal",[hu]],["Erf",[Do]],["Exp",[Po]],["Expand",[El]],["FastGelu",[Il]],["Floor",[Uo]],["FusedConv",[Bn,On]],["Gather",[Ol,Al]],["GatherElements",[Vl,Fl]],["GatherBlockQuantized",[Ul,Nl]],["GatherND",[Bl,Ml]],["Gelu",[No]],["Gemm",[Hl,jl]],["GlobalAveragePool",[Qd,Zd]],["GlobalMaxPool",[ep,Jd]],["Greater",[yu]],["GreaterOrEqual",[wu]],["GridSample",[rd,id]],["GroupQueryAttention",[vd]],["HardSigmoid",[Ho,jo]],["HardSwish",[Ko]],["InstanceNormalization",[Td]],["LayerNormalization",[Id]],["LeakyRelu",[Lo,sa]],["Less",[_u]],["LessOrEqual",[$u]],["Log",[ru]],["MatMul",[Cd]],["MatMulNBits",[Bd,Md]],["MaxPool",[Xd,Yd]],["Mul",[fu]],["MultiHeadAttention",[od,nd]],["Neg",[Fo]],["Not",[qo]],["Pad",[Gd]],["Pow",[mu]],["QuickGelu",[nu,sa]],["Range",[op]],["Reciprocal",[Vo]],["ReduceMin",[Js]],["ReduceMean",[Ks]],["ReduceMax",[Ys]],["ReduceSum",[to]],["ReduceProd",[eo]],["ReduceL1",[Zs]],["ReduceL2",[Qs]],["ReduceLogSum",[io]],["ReduceLogSumExp",[Xs]],["ReduceSumSquare",[ro]],["Relu",[Go]],["Resize",[Ip,zp]],["RotaryEmbedding",[yd]],["ScatterND",[pp,dp]],["Sigmoid",[Wo]],["Sin",[Zo]],["Sinh",[Qo]],["Slice",[Pp,Up]],["SkipLayerNormalization",[Op]],["Split",[hd,fd]],["Sqrt",[Xo]],["Softmax",[qp,Fp]],["Sub",[gu]],["Tan",[Yo]],["Tanh",[Jo]],["ThresholdedRelu",[tu,sa]],["Tile",[jp]],["Transpose",[ft,wt]],["Where",[Zp]]])}),Xp,Ph=C(()=>{"use strict";Ge(),ht(),K(),Xp=class{constructor(e){this.backend=e,this.repo=new Map,this.attributesBound=!1}getArtifact(e){return this.repo.get(e)}setArtifact(e,t){this.repo.set(e,t)}run(e,t,r,i,a){je(e.programInfo.name);let n=this.backend.device,s=this.backend.getComputePassEncoder();this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2);let o=[];for(let l of t)o.push({binding:o.length,resource:{buffer:l.buffer}});for(let l of r)o.push({binding:o.length,resource:{buffer:l.buffer}});a&&o.push({binding:o.length,resource:a});let u=n.createBindGroup({layout:e.computePipeline.getBindGroupLayout(0),entries:o,label:e.programInfo.name});if(this.backend.sessionStatus==="capturing"){let l={kernelId:this.backend.currentKernelId,computePipeline:e.computePipeline,bindGroup:u,dispatchGroup:i};this.backend.capturedCommandList.get(this.backend.currentSessionId).push(l)}s.setPipeline(e.computePipeline),s.setBindGroup(0,u),s.dispatchWorkgroups(...i),this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2+1),this.backend.pendingDispatchNumber++,(this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber||this.backend.queryType==="at-passes")&&this.backend.endComputePass(),this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber&&this.backend.flush(),Ve(e.programInfo.name)}dispose(){}build(e,t){je(e.name);let r=this.backend.device,i=[];[{feature:"shader-f16",extension:"f16"},{feature:"subgroups",extension:"subgroups"}].forEach(l=>{r.features.has(l.feature)&&i.push(`enable ${l.extension};`)});let a=be(t,this.backend.device.limits),n=e.getShaderSource(a),s=`${i.join(`
`)}
${a.additionalImplementations}
${n}`,o=r.createShaderModule({code:s,label:e.name});$e("verbose",()=>`[WebGPU] ${e.name} shader code: ${s}`);let u=r.createComputePipeline({compute:{module:o,entryPoint:"main"},layout:"auto",label:e.name});return Ve(e.name),{programInfo:e,computePipeline:u,uniformVariablesInfo:a.variablesInfo}}normalizeDispatchGroupSize(e){let t=typeof e=="number"?e:e.x,r=typeof e=="number"?1:e.y||1,i=typeof e=="number"?1:e.z||1,a=this.backend.device.limits.maxComputeWorkgroupsPerDimension;if(t<=a&&r<=a&&i<=a)return[t,r,i];let n=t*r*i,s=Math.ceil(Math.sqrt(n));if(s>a){if(s=Math.ceil(Math.cbrt(n)),s>a)throw new Error("Total dispatch size exceeds WebGPU maximum.");return[s,s,s]}else return[s,s,1]}}}),Yp={};ue(Yp,{WebGpuBackend:()=>rc});var Jp,ec,tc,rc,Uh=C(()=>{"use strict";Ge(),oe(),ht(),er(),cn(),Dh(),Ph(),Jp=(e,t)=>{if(t.length!==e.length)throw new Error(`inputDependencies length ${t.length} is not equal to inputTensors length ${e.length}.`);let r=[];for(let i=0;i<e.length;++i){let a=e[i].dataType;switch(t[i]){case"none":{r.push("");break}case"type":{r.push(`${a}`);break}case"rank":{let n=e[i].dims.length;r.push(`${a};${n}`);break}case"dims":{let n=e[i].dims.join(",");r.push(`${a};${n}`);break}default:throw new Error(`unsupported input dependency: ${t[i]}`)}}return r.join("|")},ec=(e,t,r)=>{let i=e.name;return e.shaderCache?.hint&&(i+="["+e.shaderCache.hint+"]"),i+=":"+r+`:${Jp(t,e.shaderCache?.inputDependencies??new Array(t.length).fill("dims"))}`,i},tc=class{constructor(e){e&&(this.architecture=e.architecture,this.vendor=e.vendor)}isArchitecture(e){return this.architecture===e}isVendor(e){return this.vendor===e}},rc=class{constructor(){this.currentSessionId=null,this.currentKernelId=null,this.commandEncoder=null,this.computePassEncoder=null,this.maxDispatchNumber=16,this.pendingDispatchNumber=0,this.pendingKernels=[],this.pendingQueries=new Map,this.sessionStatus="default",this.capturedCommandList=new Map,this.capturedPendingKernels=new Map,this.sessionExternalDataMapping=new Map}get currentKernelCustomData(){if(this.currentKernelId===null)throw new Error("currentKernelCustomData(): currentKernelId is null. (should not happen)");let e=this.kernelCustomData.get(this.currentKernelId);return e||(e={},this.kernelCustomData.set(this.currentKernelId,e)),e}async initialize(e,t){this.env=e;let r=[],i={requiredLimits:{maxComputeWorkgroupStorageSize:t.limits.maxComputeWorkgroupStorageSize,maxComputeWorkgroupsPerDimension:t.limits.maxComputeWorkgroupsPerDimension,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize,maxBufferSize:t.limits.maxBufferSize,maxComputeInvocationsPerWorkgroup:t.limits.maxComputeInvocationsPerWorkgroup,maxComputeWorkgroupSizeX:t.limits.maxComputeWorkgroupSizeX,maxComputeWorkgroupSizeY:t.limits.maxComputeWorkgroupSizeY,maxComputeWorkgroupSizeZ:t.limits.maxComputeWorkgroupSizeZ},requiredFeatures:r},a=o=>t.features.has(o)&&r.push(o)&&!0;a("chromium-experimental-timestamp-query-inside-passes")||a("timestamp-query"),a("shader-f16"),a("subgroups"),this.device=await t.requestDevice(i);let n=t,s=t.info??(typeof n.requestAdapterInfo=="function"?await n.requestAdapterInfo():void 0);this.adapterInfo=new tc(s),this.gpuDataManager=va(this),this.programManager=new Xp(this),this.kernels=new Map,this.kernelPersistentData=new Map,this.kernelCustomData=new Map,Xr(e.logLevel,!!e.debug),this.device.onuncapturederror=o=>{o.error instanceof GPUValidationError&&console.error(`An uncaught WebGPU validation error was raised: ${o.error.message}`)},Object.defineProperty(this.env.webgpu,"device",{value:this.device,writable:!1,enumerable:!0,configurable:!0}),Object.defineProperty(this.env.webgpu,"adapter",{value:t,writable:!1,enumerable:!0,configurable:!1}),this.setQueryType()}dispose(){typeof this.querySet<"u"&&this.querySet.destroy(),this.gpuDataManager.dispose(),this.device&&this.env?.webgpu&&this.device.lost.then(()=>{delete this.env.webgpu.device})}getCommandEncoder(){return this.commandEncoder||(this.commandEncoder=this.device.createCommandEncoder()),this.commandEncoder}getComputePassEncoder(){if(!this.computePassEncoder){let e=this.getCommandEncoder(),t={};this.queryType==="at-passes"&&(t.timestampWrites={querySet:this.querySet,beginningOfPassWriteIndex:this.pendingDispatchNumber*2,endOfPassWriteIndex:this.pendingDispatchNumber*2+1}),this.computePassEncoder=e.beginComputePass(t)}return this.computePassEncoder}endComputePass(){this.computePassEncoder&&(this.computePassEncoder.end(),this.computePassEncoder=null)}flush(){if(!this.commandEncoder)return;je(),this.endComputePass();let e;this.queryType!=="none"&&(this.commandEncoder.resolveQuerySet(this.querySet,0,this.pendingDispatchNumber*2,this.queryResolveBuffer,0),e=this.device.createBuffer({size:this.pendingDispatchNumber*2*8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.pendingQueries.set(e,this.pendingKernels),this.pendingKernels=[],this.commandEncoder.copyBufferToBuffer(this.queryResolveBuffer,0,e,0,this.pendingDispatchNumber*2*8)),this.device.queue.submit([this.commandEncoder.finish()]),this.gpuDataManager.refreshPendingBuffers(),this.commandEncoder=null,this.pendingDispatchNumber=0,this.queryType!=="none"&&e.mapAsync(GPUMapMode.READ).then(()=>{let t=new BigUint64Array(e.getMappedRange()),r=this.pendingQueries.get(e);for(let i=0;i<t.length/2;i++){let a=r[i],n=a.kernelId,s=this.kernels.get(n),o=s.kernelType,u=s.kernelName,l=a.programName,p=a.inputTensorViews,d=a.outputTensorViews,h=t[i*2],m=t[i*2+1];typeof this.queryTimeBase>"u"&&(this.queryTimeBase=h);let f=Number(h-this.queryTimeBase),_=Number(m-this.queryTimeBase);if(!Number.isSafeInteger(f)||!Number.isSafeInteger(_))throw new RangeError("incorrect timestamp range");if(this.env.webgpu.profiling?.ondata)this.env.webgpu.profiling.ondata({version:1,inputsMetadata:p.map(b=>({dims:b.dims,dataType:ut(b.dataType)})),outputsMetadata:d.map(b=>({dims:b.dims,dataType:ut(b.dataType)})),kernelId:n,kernelType:o,kernelName:u,programName:l,startTime:f,endTime:_});else{let b="";p.forEach((y,x)=>{b+=`input[${x}]: [${y.dims}] | ${ut(y.dataType)}, `});let w="";d.forEach((y,x)=>{w+=`output[${x}]: [${y.dims}] | ${ut(y.dataType)}, `}),console.log(`[profiling] kernel "${n}|${o}|${u}|${l}" ${b}${w}start time: ${f} ns, execution time: ${_-f} ns`)}Pt("GPU",`${l}::${h}::${m}`)}e.unmap(),this.pendingQueries.delete(e)}),Ve()}run(e,t,r,i,a,n){je(e.name);let s=[];for(let y=0;y<t.length;++y){let x=t[y].data;if(x===0)continue;let v=this.gpuDataManager.get(x);if(!v)throw new Error(`no GPU data for input: ${x}`);s.push(v)}let{outputs:o,dispatchGroup:u,programUniforms:l}=e.getRunData(t),p=r.length===0?o.map((y,x)=>x):r;if(p.length!==o.length)throw new Error(`Output size ${p.length} must be equal to ${o.length}.`);let d=[],h=[];for(let y=0;y<o.length;++y){if(!Number.isInteger(p[y])||p[y]<-3||p[y]>=n)throw new Error(`Invalid output index: ${p[y]}`);if(p[y]===-3)continue;let x=p[y]===-1,v=p[y]===-2,S=x||v?a(o[y].dataType,o[y].dims):i(p[y],o[y].dataType,o[y].dims);if(d.push(S),S.data===0)continue;let I=this.gpuDataManager.get(S.data);if(!I)throw new Error(`no GPU data for output: ${S.data}`);if(x&&this.temporaryData.push(I),v){let O=this.kernelPersistentData.get(this.currentKernelId);O||(O=[],this.kernelPersistentData.set(this.currentKernelId,O)),O.push(I)}h.push(I)}if(s.length!==t.length||h.length!==d.length){if(h.length===0)return Ve(e.name),d;throw new Error(`Program ${e.name} has zero-sized tensor(s) in inputs or outputs. This is not supported now.`)}let m;if(l){let y=0,x=[];l.forEach(O=>{let P=typeof O.data=="number"?[O.data]:O.data;if(P.length===0)return;let V=O.type===10?2:4,Q,ye;O.type===10?(ye=P.length>4?16:P.length>2?8:P.length*V,Q=P.length>4?16:V*P.length):(ye=P.length<=2?P.length*V:16,Q=16),y=Math.ceil(y/ye)*ye,x.push(y);let ae=O.type===10?8:4;y+=P.length>4?Math.ceil(P.length/ae)*Q:P.length*V});let v=16;y=Math.ceil(y/v)*v;let S=new ArrayBuffer(y);l.forEach((O,P)=>{let V=x[P],Q=typeof O.data=="number"?[O.data]:O.data;if(O.type===6)new Int32Array(S,V,Q.length).set(Q);else if(O.type===12)new Uint32Array(S,V,Q.length).set(Q);else if(O.type===10)new Uint16Array(S,V,Q.length).set(Q);else if(O.type===1)new Float32Array(S,V,Q.length).set(Q);else throw new Error(`Unsupported uniform type: ${ut(O.type)}`)});let I=this.gpuDataManager.create(y,GPUBufferUsage.COPY_DST|GPUBufferUsage.UNIFORM);this.device.queue.writeBuffer(I.buffer,0,S,0,y),this.gpuDataManager.release(I.id),m={offset:0,size:y,buffer:I.buffer}}let f=this.programManager.normalizeDispatchGroupSize(u),_=f[1]===1&&f[2]===1,b=ec(e,t,_),w=this.programManager.getArtifact(b);if(w||(w=this.programManager.build(e,f),this.programManager.setArtifact(b,w),$e("info",()=>`[artifact] key: ${b}, programName: ${e.name}`)),l&&w.uniformVariablesInfo){if(l.length!==w.uniformVariablesInfo.length)throw new Error(`Uniform variables count mismatch: expect ${w.uniformVariablesInfo.length}, got ${l.length} in program "${w.programInfo.name}".`);for(let y=0;y<l.length;y++){let x=l[y],v=x.type,S=typeof x.data=="number"?1:x.data.length,[I,O]=w.uniformVariablesInfo[y];if(v!==I||S!==O)throw new Error(`Uniform variable ${y} mismatch: expect type ${I} with size ${O}, got type ${v} with size ${S} in program "${w.programInfo.name}".`)}}if($e("info",()=>`[ProgramManager] run "${e.name}" (key=${b}) with ${f[0]}x${f[1]}x${f[2]}`),this.queryType!=="none"||this.sessionStatus==="capturing"){let y={kernelId:this.currentKernelId,programName:w.programInfo.name,inputTensorViews:t,outputTensorViews:d};this.pendingKernels.push(y),this.sessionStatus==="capturing"&&this.capturedPendingKernels.get(this.currentSessionId).push(y)}return this.programManager.run(w,s,h,f,m),Ve(e.name),d}upload(e,t){this.gpuDataManager.upload(e,t)}memcpy(e,t){this.gpuDataManager.memcpy(e,t)}async download(e,t){await this.gpuDataManager.download(e,t)}alloc(e){return this.gpuDataManager.create(e).id}free(e){return this.gpuDataManager.release(e)}createKernel(e,t,r,i){let a=Qp.get(e);if(!a)throw new Error(`kernel not implemented: ${e}`);let n={kernelType:e,kernelName:i,kernelEntry:a[0],attributes:[a[1],r]};this.kernels.set(t,n)}releaseKernel(e){let t=this.kernelPersistentData.get(e);if(t){for(let r of t)this.gpuDataManager.release(r.id);this.kernelPersistentData.delete(e)}this.kernelCustomData.delete(e),this.kernels.delete(e)}computeKernel(e,t,r){let i=this.kernels.get(e);if(!i)throw new Error(`kernel not created: ${e}`);let a=i.kernelType,n=i.kernelName,s=i.kernelEntry,o=i.attributes;if(this.currentKernelId!==null)throw new Error(`kernel "[${a}] ${n}" is not allowed to be called recursively`);this.currentKernelId=e,o[0]&&(o[1]=o[0](o[1]),o[0]=void 0),$e("info",()=>`[WebGPU] Start to run kernel "[${a}] ${n}"...`);let u=this.env.debug;this.temporaryData=[];try{return u&&this.device.pushErrorScope("validation"),s(t,o[1]),0}catch(l){return r.push(Promise.resolve(`[WebGPU] Kernel "[${a}] ${n}" failed. ${l}`)),1}finally{u&&r.push(this.device.popErrorScope().then(l=>l?`GPU validation error for kernel "[${a}] ${n}": ${l.message}`:null));for(let l of this.temporaryData)this.gpuDataManager.release(l.id);this.temporaryData=[],this.currentKernelId=null}}registerBuffer(e,t,r,i){let a=this.sessionExternalDataMapping.get(e);a||(a=new Map,this.sessionExternalDataMapping.set(e,a));let n=a.get(t),s=this.gpuDataManager.registerExternalBuffer(r,i,n);return a.set(t,[s,r]),s}unregisterBuffers(e){let t=this.sessionExternalDataMapping.get(e);t&&(t.forEach(r=>this.gpuDataManager.unregisterExternalBuffer(r[0])),this.sessionExternalDataMapping.delete(e))}getBuffer(e){let t=this.gpuDataManager.get(e);if(!t)throw new Error(`no GPU data for buffer: ${e}`);return t.buffer}createDownloader(e,t,r){return async()=>{let i=await ta(this,e,t);return Lt(i.buffer,r)}}writeTimestamp(e){this.queryType==="inside-passes"&&this.computePassEncoder.writeTimestamp(this.querySet,e)}setQueryType(){this.queryType="none",(this.env.webgpu.profiling?.mode==="default"||(typeof this.env.trace>"u"?this.env.wasm.trace:this.env.trace))&&(this.device.features.has("chromium-experimental-timestamp-query-inside-passes")?this.queryType="inside-passes":this.device.features.has("timestamp-query")&&(this.queryType="at-passes"),this.queryType!=="none"&&typeof this.querySet>"u"&&(this.querySet=this.device.createQuerySet({type:"timestamp",count:this.maxDispatchNumber*2}),this.queryResolveBuffer=this.device.createBuffer({size:this.maxDispatchNumber*2*8,usage:GPUBufferUsage.COPY_SRC|GPUBufferUsage.QUERY_RESOLVE})))}captureBegin(){$e("info","captureBegin"),this.capturedCommandList.get(this.currentSessionId)||this.capturedCommandList.set(this.currentSessionId,[]),this.capturedPendingKernels.get(this.currentSessionId)||this.capturedPendingKernels.set(this.currentSessionId,[]),this.flush(),this.sessionStatus="capturing"}captureEnd(){$e("info","captureEnd"),this.flush(),this.sessionStatus="default"}replay(){$e("info","replay"),this.sessionStatus="replaying";let e=this.capturedCommandList.get(this.currentSessionId),t=this.capturedPendingKernels.get(this.currentSessionId),r=e.length;this.pendingKernels=[];for(let i=0;i<r;i++){let a=this.getComputePassEncoder(),n=e[i];this.writeTimestamp(this.pendingDispatchNumber*2),a.setPipeline(n.computePipeline),a.setBindGroup(0,n.bindGroup),a.dispatchWorkgroups(...n.dispatchGroup),this.writeTimestamp(this.pendingDispatchNumber*2+1),this.pendingDispatchNumber++,this.queryType!=="none"&&this.pendingKernels.push(t[i]),(this.pendingDispatchNumber>=this.maxDispatchNumber||this.queryType==="at-passes")&&this.endComputePass(),this.pendingDispatchNumber>=this.maxDispatchNumber&&this.flush()}this.flush(),this.sessionStatus="default"}onCreateSession(){this.gpuDataManager.onCreateSession()}onReleaseSession(e){this.unregisterBuffers(e),this.capturedCommandList.has(e)&&this.capturedCommandList.delete(e),this.capturedPendingKernels.has(e)&&this.capturedPendingKernels.delete(e),this.gpuDataManager.onReleaseSession(e)}onRunStart(e){this.currentSessionId=e,this.setQueryType()}}}),ic={};ue(ic,{init:()=>nc});var Ma,ac,nc,Nh=C(()=>{"use strict";oe(),ht(),ie(),ea(),Ma=class zc{constructor(t,r,i,a){this.module=t,this.dataType=r,this.data=i,this.dims=a}getFloat32Array(){if(this.dataType!==1)throw new Error("Invalid data type");let t=M.size(this.dims);return t===0?new Float32Array:new Float32Array(this.module.HEAP8.buffer,this.data,t)}getBigInt64Array(){if(this.dataType!==7)throw new Error("Invalid data type");let t=M.size(this.dims);return t===0?new BigInt64Array:new BigInt64Array(this.module.HEAP8.buffer,this.data,t)}getInt32Array(){if(this.dataType!==6)throw new Error("Invalid data type");let t=M.size(this.dims);return t===0?new Int32Array:new Int32Array(this.module.HEAP8.buffer,this.data,t)}getUint16Array(){if(this.dataType!==10&&this.dataType!==4)throw new Error("Invalid data type");let t=M.size(this.dims);return t===0?new Uint16Array:new Uint16Array(this.module.HEAP8.buffer,this.data,t)}reshape(t){if(M.size(t)!==M.size(this.dims))throw new Error("Invalid new shape");return new zc(this.module,this.dataType,this.data,t)}},ac=class{constructor(e,t,r){this.module=e,this.backend=t,this.customDataOffset=0,this.customDataSize=0,this.adapterInfo=t.adapterInfo;let i=e.PTR_SIZE,a=r/e.PTR_SIZE,n=i===4?"i32":"i64";this.opKernelContext=Number(e.getValue(i*a++,n));let s=Number(e.getValue(i*a++,n));this.outputCount=Number(e.getValue(i*a++,n)),this.customDataOffset=Number(e.getValue(i*a++,"*")),this.customDataSize=Number(e.getValue(i*a++,n));let o=[];for(let u=0;u<s;u++){let l=Number(e.getValue(i*a++,n)),p=Number(e.getValue(i*a++,"*")),d=Number(e.getValue(i*a++,n)),h=[];for(let m=0;m<d;m++)h.push(Number(e.getValue(i*a++,n)));o.push(new Ma(e,l,p,h))}this.inputs=o}get kernelCustomData(){return this.backend.currentKernelCustomData}get customDataBuffer(){return this.module.HEAPU8.subarray(this.customDataOffset,this.customDataOffset+this.customDataSize)}compute(e,t){let r=t?.inputs?.map(s=>typeof s=="number"?this.inputs[s]:s)??this.inputs,i=t?.outputs??[],a=(s,o,u)=>new Ma(this.module,o,this.output(s,u),u),n=(s,o)=>{let u=lt(s,o);if(!u)throw new Error(`Unsupported data type: ${s}`);let l=u>0?this.backend.gpuDataManager.create(u).id:0;return new Ma(this.module,s,l,o)};return this.backend.run(e,r,i,a,n,this.outputCount)}output(e,t){let r=this.module.stackSave();try{let i=this.module.PTR_SIZE,a=i===4?"i32":"i64",n=this.module.stackAlloc((1+t.length)*i);this.module.setValue(n,t.length,a);for(let s=0;s<t.length;s++)this.module.setValue(n+i*(s+1),t[s],a);return this.module._JsepOutput(this.opKernelContext,e,n)}catch(i){throw new Error(`Failed to generate kernel's output[${e}] with dims [${t}]. If you are running with pre-allocated output, please make sure the output type/dims are correct. Error: ${i}`)}finally{this.module.stackRestore(r)}}},nc=async(e,t,r,i)=>{let a=t.jsepInit;if(!a)throw new Error("Failed to initialize JSEP. The WebAssembly module is not built with JSEP support.");if(e==="webgpu"){let n=(Uh(),te(Yp)).WebGpuBackend,s=new n;await s.initialize(r,i),a("webgpu",[s,o=>s.alloc(Number(o)),o=>s.free(o),(o,u,l,p=!1)=>{if(p)$e("verbose",()=>`[WebGPU] jsepCopyGpuToGpu: src=${Number(o)}, dst=${Number(u)}, size=${Number(l)}`),s.memcpy(Number(o),Number(u));else{$e("verbose",()=>`[WebGPU] jsepCopyCpuToGpu: dataOffset=${Number(o)}, gpuDataId=${Number(u)}, size=${Number(l)}`);let d=t.HEAPU8.subarray(Number(o>>>0),Number(o>>>0)+Number(l));s.upload(Number(u),d)}},async(o,u,l)=>{$e("verbose",()=>`[WebGPU] jsepCopyGpuToCpu: gpuDataId=${o}, dataOffset=${u}, size=${l}`),await s.download(Number(o),()=>t.HEAPU8.subarray(Number(u)>>>0,Number(u+l)>>>0))},(o,u,l)=>s.createKernel(o,Number(u),l,t.UTF8ToString(t._JsepGetNodeName(Number(u)))),o=>s.releaseKernel(o),(o,u,l,p)=>{$e("verbose",()=>`[WebGPU] jsepRun: sessionHandle=${l}, kernel=${o}, contextDataOffset=${u}`);let d=new ac(t,s,Number(u));return s.computeKernel(Number(o),d,p)},()=>s.captureBegin(),()=>s.captureEnd(),()=>s.replay()])}else{let n=new Ji(r);a("webnn",[n,()=>n.reserveTensorId(),s=>n.releaseTensorId(s),async(s,o,u,l,p)=>n.ensureTensor(s,o,u,l,p),(s,o)=>{n.uploadTensor(s,o)},async(s,o)=>n.downloadTensor(s,o),(s,o)=>n.registerMLContext(s,o),!!r.trace])}}}),sc,os,us,ar,oc,ls,Da,ds,ps,cs,hs,fs,ms,uc=C(()=>{"use strict";Ge(),dn(),pn(),oe(),st(),Tr(),Hi(),sc=(e,t)=>{le()._OrtInit(e,t)!==0&&re("Can't initialize onnxruntime.")},os=async e=>{sc(e.wasm.numThreads,kr(e.logLevel))},us=async(e,t)=>{le().asyncInit?.();let r=e.webgpu.adapter;if(t==="webgpu"){if(typeof navigator>"u"||!navigator.gpu)throw new Error("WebGPU is not supported in current environment");if(r){if(typeof r.limits!="object"||typeof r.features!="object"||typeof r.requestDevice!="function")throw new Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.")}else{let i=e.webgpu.powerPreference;if(i!==void 0&&i!=="low-power"&&i!=="high-performance")throw new Error(`Invalid powerPreference setting: "${i}"`);let a=e.webgpu.forceFallbackAdapter;if(a!==void 0&&typeof a!="boolean")throw new Error(`Invalid forceFallbackAdapter setting: "${a}"`);if(r=await navigator.gpu.requestAdapter({powerPreference:i,forceFallbackAdapter:a}),!r)throw new Error('Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are using Chrome.')}}if(t==="webnn"&&(typeof navigator>"u"||!navigator.ml))throw new Error("WebNN is not supported in current environment");{let i=(Nh(),te(ic)).init;t==="webgpu"&&await i("webgpu",le(),e,r),t==="webnn"&&await i("webnn",le(),e)}},ar=new Map,oc=e=>{let t=le(),r=t.stackSave();try{let i=t.PTR_SIZE,a=t.stackAlloc(2*i);t._OrtGetInputOutputCount(e,a,a+i)!==0&&re("Can't get session input/output count.");let n=i===4?"i32":"i64";return[Number(t.getValue(a,n)),Number(t.getValue(a+i,n))]}finally{t.stackRestore(r)}},ls=(e,t)=>{let r=le(),i=r.stackSave(),a=0;try{let n=r.PTR_SIZE,s=r.stackAlloc(2*n);r._OrtGetInputOutputMetadata(e,t,s,s+n)!==0&&re("Can't get session input/output metadata.");let o=Number(r.getValue(s,"*"));a=Number(r.getValue(s+n,"*"));let u=r.HEAP32[a/4];if(u===0)return[o,0];let l=r.HEAPU32[a/4+1],p=[];for(let d=0;d<l;d++){let h=Number(r.getValue(a+8+d*n,"*"));p.push(h!==0?r.UTF8ToString(h):Number(r.getValue(a+8+(d+l)*n,"*")))}return[o,u,p]}finally{r.stackRestore(i),a!==0&&r._OrtFree(a)}},Da=e=>{let t=le(),r=t._malloc(e.byteLength);if(r===0)throw new Error(`Can't create a session. failed to allocate a buffer of size ${e.byteLength}.`);return t.HEAPU8.set(e,r),[r,e.byteLength]},ds=async(e,t)=>{let r,i,a=le();Array.isArray(e)?[r,i]=e:e.buffer===a.HEAPU8.buffer?[r,i]=[e.byteOffset,e.byteLength]:[r,i]=Da(e);let n=0,s=0,o=0,u=[],l=[],p=[];try{if([s,u]=await ji(t),t?.externalData&&a.mountExternalData){let v=[];for(let S of t.externalData){let I=typeof S=="string"?S:S.path,O=typeof S=="string"?S:S.data;v.push(Cr(O).then(P=>{a.mountExternalData(I,P)}))}await Promise.all(v)}for(let v of t?.executionProviders??[])if((typeof v=="string"?v:v.name)==="webnn"){if(a.shouldTransferToMLTensor=!1,typeof v!="string"){let S=v,I=S?.context,O=S?.gpuDevice,P=S?.deviceType,V=S?.powerPreference;I?a.currentContext=I:O?a.currentContext=await a.webnnCreateMLContext(O):a.currentContext=await a.webnnCreateMLContext({deviceType:P,powerPreference:V})}else a.currentContext=await a.webnnCreateMLContext();break}n=await a._OrtCreateSession(r,i,s),a.webgpuOnCreateSession?.(n),n===0&&re("Can't create a session."),a.jsepOnCreateSession?.(),a.currentContext&&(a.webnnRegisterMLContext(n,a.currentContext),a.currentContext=void 0,a.shouldTransferToMLTensor=!0);let[d,h]=oc(n),m=!!t?.enableGraphCapture,f=[],_=[],b=[],w=[],y=[];for(let v=0;v<d;v++){let[S,I,O]=ls(n,v);S===0&&re("Can't get an input name."),l.push(S);let P=a.UTF8ToString(S);f.push(P),b.push(I===0?{name:P,isTensor:!1}:{name:P,isTensor:!0,type:ut(I),shape:O})}for(let v=0;v<h;v++){let[S,I,O]=ls(n,v+d);S===0&&re("Can't get an output name."),p.push(S);let P=a.UTF8ToString(S);_.push(P),w.push(I===0?{name:P,isTensor:!1}:{name:P,isTensor:!0,type:ut(I),shape:O});{if(m&&t?.preferredOutputLocation===void 0){y.push("gpu-buffer");continue}let V=typeof t?.preferredOutputLocation=="string"?t.preferredOutputLocation:t?.preferredOutputLocation?.[P]??"cpu",Q=a.webnnIsGraphOutput;if(V==="cpu"&&Q&&Q(n,P)){y.push("ml-tensor-cpu-output");continue}if(V!=="cpu"&&V!=="cpu-pinned"&&V!=="gpu-buffer"&&V!=="ml-tensor")throw new Error(`Not supported preferred output location: ${V}.`);if(m&&V!=="gpu-buffer")throw new Error(`Not supported preferred output location: ${V}. Only 'gpu-buffer' location is supported when enableGraphCapture is true.`);y.push(V)}}let x=null;return y.some(v=>v==="gpu-buffer"||v==="ml-tensor"||v==="ml-tensor-cpu-output")&&(o=a._OrtCreateBinding(n),o===0&&re("Can't create IO binding."),x={handle:o,outputPreferredLocations:y,outputPreferredLocationsEncoded:y.map(v=>v==="ml-tensor-cpu-output"?"ml-tensor":v).map(v=>Kr(v))}),ar.set(n,[n,l,p,x,m,!1]),[n,f,_,b,w]}catch(d){throw l.forEach(h=>a._OrtFree(h)),p.forEach(h=>a._OrtFree(h)),o!==0&&a._OrtReleaseBinding(o)!==0&&re("Can't release IO binding."),n!==0&&a._OrtReleaseSession(n)!==0&&re("Can't release session."),d}finally{a._free(r),s!==0&&a._OrtReleaseSessionOptions(s)!==0&&re("Can't release session options."),u.forEach(d=>a._free(d)),a.unmountExternalData?.()}},ps=e=>{let t=le(),r=ar.get(e);if(!r)throw new Error(`cannot release session. invalid session id: ${e}`);let[i,a,n,s,o]=r;s&&(o&&t._OrtClearBoundOutputs(s.handle)!==0&&re("Can't clear bound outputs."),t._OrtReleaseBinding(s.handle)!==0&&re("Can't release IO binding.")),t.jsepOnReleaseSession?.(e),t.webnnOnReleaseSession?.(e),t.webgpuOnReleaseSession?.(e),a.forEach(u=>t._OrtFree(u)),n.forEach(u=>t._OrtFree(u)),t._OrtReleaseSession(i)!==0&&re("Can't release session."),ar.delete(e)},cs=async(e,t,r,i,a,n,s=!1)=>{if(!e){t.push(0);return}let o=le(),u=o.PTR_SIZE,l=e[0],p=e[1],d=e[3],h=d,m,f;if(l==="string"&&(d==="gpu-buffer"||d==="ml-tensor"))throw new Error("String tensor is not supported on GPU.");if(s&&d!=="gpu-buffer")throw new Error(`External buffer must be provided for input/output index ${n} when enableGraphCapture is true.`);if(d==="gpu-buffer"){let w=e[2].gpuBuffer;f=lt(ot(l),p);{let y=o.jsepRegisterBuffer;if(!y)throw new Error('Tensor location "gpu-buffer" is not supported without using WebGPU.');m=y(i,n,w,f)}}else if(d==="ml-tensor"){let w=e[2].mlTensor;f=lt(ot(l),p);let y=o.webnnRegisterMLTensor;if(!y)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');m=y(i,w,ot(l),p)}else{let w=e[2];if(Array.isArray(w)){f=u*w.length,m=o._malloc(f),r.push(m);for(let y=0;y<w.length;y++){if(typeof w[y]!="string")throw new TypeError(`tensor data at index ${y} is not a string`);o.setValue(m+y*u,De(w[y],r),"*")}}else{let y=o.webnnIsGraphInput,x=o.webnnIsGraphOutput;if(l!=="string"&&y&&x){let v=o.UTF8ToString(a);if(y(i,v)||x(i,v)){let S=ot(l);f=lt(S,p),h="ml-tensor";let I=o.webnnCreateTemporaryTensor,O=o.webnnUploadTensor;if(!I||!O)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');let P=await I(i,S,p);O(P,new Uint8Array(w.buffer,w.byteOffset,w.byteLength)),m=P}else f=w.byteLength,m=o._malloc(f),r.push(m),o.HEAPU8.set(new Uint8Array(w.buffer,w.byteOffset,f),m)}else f=w.byteLength,m=o._malloc(f),r.push(m),o.HEAPU8.set(new Uint8Array(w.buffer,w.byteOffset,f),m)}}let _=o.stackSave(),b=o.stackAlloc(4*p.length);try{p.forEach((y,x)=>o.setValue(b+x*u,y,u===4?"i32":"i64"));let w=o._OrtCreateTensor(ot(l),m,f,b,p.length,Kr(h));w===0&&re(`Can't create tensor for input/output. session=${i}, index=${n}.`),t.push(w)}finally{o.stackRestore(_)}},hs=async(e,t,r,i,a,n)=>{let s=le(),o=s.PTR_SIZE,u=ar.get(e);if(!u)throw new Error(`cannot run inference. invalid session id: ${e}`);let l=u[0],p=u[1],d=u[2],h=u[3],m=u[4],f=u[5],_=t.length,b=i.length,w=0,y=[],x=[],v=[],S=[],I=[],O=s.stackSave(),P=s.stackAlloc(_*o),V=s.stackAlloc(_*o),Q=s.stackAlloc(b*o),ye=s.stackAlloc(b*o);try{[w,y]=qi(n),Xe("wasm prepareInputOutputTensor");for(let X=0;X<_;X++)await cs(r[X],x,S,e,p[t[X]],t[X],m);for(let X=0;X<b;X++)await cs(a[X],v,S,e,d[i[X]],_+i[X],m);Ye("wasm prepareInputOutputTensor");for(let X=0;X<_;X++)s.setValue(P+X*o,x[X],"*"),s.setValue(V+X*o,p[t[X]],"*");for(let X=0;X<b;X++)s.setValue(Q+X*o,v[X],"*"),s.setValue(ye+X*o,d[i[X]],"*");if(h&&!f){let{handle:X,outputPreferredLocations:ee,outputPreferredLocationsEncoded:ge}=h;if(p.length!==_)throw new Error(`input count from feeds (${_}) is expected to be always equal to model's input count (${p.length}).`);Xe("wasm bindInputsOutputs");for(let we=0;we<_;we++){let he=t[we];await s._OrtBindInput(X,p[he],x[we])!==0&&re(`Can't bind input[${we}] for session=${e}.`)}for(let we=0;we<b;we++){let he=i[we];a[we]?.[3]?(I.push(v[we]),s._OrtBindOutput(X,d[he],v[we],0)!==0&&re(`Can't bind pre-allocated output[${we}] for session=${e}.`)):s._OrtBindOutput(X,d[he],0,ge[he])!==0&&re(`Can't bind output[${we}] to ${ee[we]} for session=${e}.`)}Ye("wasm bindInputsOutputs"),ar.set(e,[l,p,d,h,m,!0])}s.jsepOnRunStart?.(l),s.webnnOnRunStart?.(l);let ae;h?ae=await s._OrtRunWithBinding(l,h.handle,b,Q,w):ae=await s._OrtRun(l,V,P,_,ye,b,Q,w),ae!==0&&re("failed to call OrtRun().");let ne=[],ke=[];Xe("wasm ProcessOutputTensor");for(let X=0;X<b;X++){let ee=Number(s.getValue(Q+X*o,"*"));if(ee===v[X]||I.includes(v[X])){ne.push(a[X]),ee!==v[X]&&s._OrtReleaseTensor(ee)!==0&&re("Can't release tensor.");continue}let ge=s.stackSave(),we=s.stackAlloc(4*o),he=!1,ve,W=0;try{s._OrtGetTensorData(ee,we,we+o,we+2*o,we+3*o)!==0&&re(`Can't access output tensor data on index ${X}.`);let pe=o===4?"i32":"i64",se=Number(s.getValue(we,pe));W=s.getValue(we+o,"*");let Y=s.getValue(we+o*2,"*"),Qe=Number(s.getValue(we+o*3,pe)),dt=[];for(let Ae=0;Ae<Qe;Ae++)dt.push(Number(s.getValue(Y+Ae*o,pe)));s._OrtFree(Y)!==0&&re("Can't free memory for tensor dims.");let Le=dt.reduce((Ae,qe)=>Ae*qe,1);ve=ut(se);let pt=h?.outputPreferredLocations[i[X]];if(ve==="string"){if(pt==="gpu-buffer"||pt==="ml-tensor")throw new Error("String tensor is not supported on GPU.");let Ae=[];for(let qe=0;qe<Le;qe++){let Yt=s.getValue(W+qe*o,"*"),Gh=s.getValue(W+(qe+1)*o,"*"),Wh=qe===Le-1?void 0:Gh-Yt;Ae.push(s.UTF8ToString(Yt,Wh))}ne.push([ve,dt,Ae,"cpu"])}else if(pt==="gpu-buffer"&&Le>0){let Ae=s.jsepGetBuffer;if(!Ae)throw new Error('preferredLocation "gpu-buffer" is not supported without using WebGPU.');let qe=Ae(W),Yt=lt(se,Le);if(Yt===void 0||!Ir(ve))throw new Error(`Unsupported data type: ${ve}`);he=!0,ne.push([ve,dt,{gpuBuffer:qe,download:s.jsepCreateDownloader(qe,Yt,ve),dispose:()=>{s._OrtReleaseTensor(ee)!==0&&re("Can't release tensor.")}},"gpu-buffer"])}else if(pt==="ml-tensor"&&Le>0){let Ae=s.webnnEnsureTensor,qe=s.webnnIsGraphInputOutputTypeSupported;if(!Ae||!qe)throw new Error('preferredLocation "ml-tensor" is not supported without using WebNN.');if(lt(se,Le)===void 0||!zr(ve))throw new Error(`Unsupported data type: ${ve}`);if(!qe(e,ve,!1))throw new Error(`preferredLocation "ml-tensor" for ${ve} output is not supported by current WebNN Context.`);let Yt=await Ae(e,W,se,dt,!1);he=!0,ne.push([ve,dt,{mlTensor:Yt,download:s.webnnCreateMLTensorDownloader(W,ve),dispose:()=>{s.webnnReleaseTensorId(W),s._OrtReleaseTensor(ee)}},"ml-tensor"])}else if(pt==="ml-tensor-cpu-output"&&Le>0){let Ae=s.webnnCreateMLTensorDownloader(W,ve)(),qe=ne.length;he=!0,ke.push((async()=>{let Yt=[qe,await Ae];return s.webnnReleaseTensorId(W),s._OrtReleaseTensor(ee),Yt})()),ne.push([ve,dt,[],"cpu"])}else{let Ae=Er(ve),qe=new Ae(Le);new Uint8Array(qe.buffer,qe.byteOffset,qe.byteLength).set(s.HEAPU8.subarray(W,W+qe.byteLength)),ne.push([ve,dt,qe,"cpu"])}}finally{s.stackRestore(ge),ve==="string"&&W&&s._free(W),he||s._OrtReleaseTensor(ee)}}h&&!m&&(s._OrtClearBoundOutputs(h.handle)!==0&&re("Can't clear bound outputs."),ar.set(e,[l,p,d,h,m,!1]));for(let[X,ee]of await Promise.all(ke))ne[X][2]=ee;return Ye("wasm ProcessOutputTensor"),ne}finally{s.webnnOnRunEnd?.(l),s.stackRestore(O),x.forEach(ae=>s._OrtReleaseTensor(ae)),v.forEach(ae=>s._OrtReleaseTensor(ae)),S.forEach(ae=>s._free(ae)),w!==0&&s._OrtReleaseRunOptions(w),y.forEach(ae=>s._free(ae))}},fs=e=>{let t=le(),r=ar.get(e);if(!r)throw new Error("invalid session id");let i=r[0],a=t._OrtEndProfiling(i);a===0&&re("Can't get an profile file name."),t._OrtFree(a)},ms=e=>{let t=[];for(let r of e){let i=r[2];!Array.isArray(i)&&"buffer"in i&&t.push(i.buffer)}return t}}),nr,bt,ci,fa,ma,Pa,gs,Ua,Vr,Gr,lc,dc,pc,cc,hc,fc,mc,gc,yc=C(()=>{"use strict";Ge(),uc(),st(),br(),nr=()=>!!de.wasm.proxy&&typeof document<"u",ci=!1,fa=!1,ma=!1,Ua=new Map,Vr=(e,t)=>{let r=Ua.get(e);r?r.push(t):Ua.set(e,[t])},Gr=()=>{if(ci||!fa||ma||!bt)throw new Error("worker not ready")},lc=e=>{switch(e.data.type){case"init-wasm":ci=!1,e.data.err?(ma=!0,gs[1](e.data.err)):(fa=!0,gs[0]()),Pa&&(URL.revokeObjectURL(Pa),Pa=void 0);break;case"init-ep":case"copy-from":case"create":case"release":case"run":case"end-profiling":{let t=Ua.get(e.data.type);e.data.err?t.shift()[1](e.data.err):t.shift()[0](e.data.out);break}default:}},dc=async()=>{if(!fa){if(ci)throw new Error("multiple calls to 'initWasm()' detected.");if(ma)throw new Error("previous call to 'initWasm()' failed.");if(ci=!0,nr())return new Promise((e,t)=>{bt?.terminate(),Di().then(([r,i])=>{try{bt=i,bt.onerror=n=>t(n),bt.onmessage=lc,gs=[e,t];let a={type:"init-wasm",in:de};if(!a.in.wasm.wasmPaths&&r){let n=yr();n&&(a.in.wasm.wasmPaths=n)}bt.postMessage(a),Pa=r}catch(a){t(a)}},t)});try{await Sr(de.wasm),await os(de),fa=!0}catch(e){throw ma=!0,e}finally{ci=!1}}},pc=async e=>{if(nr())return Gr(),new Promise((t,r)=>{Vr("init-ep",[t,r]);let i={type:"init-ep",in:{epName:e,env:de}};bt.postMessage(i)});await us(de,e)},cc=async e=>nr()?(Gr(),new Promise((t,r)=>{Vr("copy-from",[t,r]);let i={type:"copy-from",in:{buffer:e}};bt.postMessage(i,[e.buffer])})):Da(e),hc=async(e,t)=>{if(nr()){if(t?.preferredOutputLocation)throw new Error('session option "preferredOutputLocation" is not supported for proxy.');return Gr(),new Promise((r,i)=>{Vr("create",[r,i]);let a={type:"create",in:{model:e,options:{...t}}},n=[];e instanceof Uint8Array&&n.push(e.buffer),bt.postMessage(a,n)})}else return ds(e,t)},fc=async e=>{if(nr())return Gr(),new Promise((t,r)=>{Vr("release",[t,r]);let i={type:"release",in:e};bt.postMessage(i)});ps(e)},mc=async(e,t,r,i,a,n)=>{if(nr()){if(r.some(s=>s[3]!=="cpu"))throw new Error("input tensor on GPU is not supported for proxy.");if(a.some(s=>s))throw new Error("pre-allocated output tensor is not supported for proxy.");return Gr(),new Promise((s,o)=>{Vr("run",[s,o]);let u=r,l={type:"run",in:{sessionId:e,inputIndices:t,inputs:u,outputIndices:i,options:n}};bt.postMessage(l,ms(u))})}else return hs(e,t,r,i,a,n)},gc=async e=>{if(nr())return Gr(),new Promise((t,r)=>{Vr("end-profiling",[t,r]);let i={type:"end-profiling",in:e};bt.postMessage(i)});fs(e)}}),ys,_c,wc,Lh=C(()=>{"use strict";Ge(),yc(),oe(),fr(),Hi(),ys=(e,t)=>{switch(e.location){case"cpu":return[e.type,e.dims,e.data,"cpu"];case"gpu-buffer":return[e.type,e.dims,{gpuBuffer:e.gpuBuffer},"gpu-buffer"];case"ml-tensor":return[e.type,e.dims,{mlTensor:e.mlTensor},"ml-tensor"];default:throw new Error(`invalid data location: ${e.location} for ${t()}`)}},_c=e=>{switch(e[3]){case"cpu":return new Me(e[0],e[2],e[1]);case"gpu-buffer":{let t=e[0];if(!Ir(t))throw new Error(`not supported data type: ${t} for deserializing GPU tensor`);let{gpuBuffer:r,download:i,dispose:a}=e[2];return Me.fromGpuBuffer(r,{dataType:t,dims:e[1],download:i,dispose:a})}case"ml-tensor":{let t=e[0];if(!zr(t))throw new Error(`not supported data type: ${t} for deserializing MLTensor tensor`);let{mlTensor:r,download:i,dispose:a}=e[2];return Me.fromMLTensor(r,{dataType:t,dims:e[1],download:i,dispose:a})}default:throw new Error(`invalid data location: ${e[3]}`)}},wc=class{async fetchModelAndCopyToWasmMemory(e){return cc(await Cr(e))}async loadModel(e,t){je();let r;typeof e=="string"?r=await this.fetchModelAndCopyToWasmMemory(e):r=e,[this.sessionId,this.inputNames,this.outputNames,this.inputMetadata,this.outputMetadata]=await hc(r,t),Ve()}async dispose(){return fc(this.sessionId)}async run(e,t,r){je();let i=[],a=[];Object.entries(e).forEach(d=>{let h=d[0],m=d[1],f=this.inputNames.indexOf(h);if(f===-1)throw new Error(`invalid input '${h}'`);i.push(m),a.push(f)});let n=[],s=[];Object.entries(t).forEach(d=>{let h=d[0],m=d[1],f=this.outputNames.indexOf(h);if(f===-1)throw new Error(`invalid output '${h}'`);n.push(m),s.push(f)});let o=i.map((d,h)=>ys(d,()=>`input "${this.inputNames[a[h]]}"`)),u=n.map((d,h)=>d?ys(d,()=>`output "${this.outputNames[s[h]]}"`):null),l=await mc(this.sessionId,a,o,s,u,r),p={};for(let d=0;d<l.length;d++)p[this.outputNames[s[d]]]=n[d]??_c(l[d]);return Ve(),p}startProfiling(){}endProfiling(){gc(this.sessionId)}}}),$c={};ue($c,{OnnxruntimeWebAssemblyBackend:()=>ws,initializeFlags:()=>_s,wasmBackend:()=>bc});var _s,ws,bc,qh=C(()=>{"use strict";Ge(),yc(),Lh(),_s=()=>{(typeof de.wasm.initTimeout!="number"||de.wasm.initTimeout<0)&&(de.wasm.initTimeout=0);let e=de.wasm.simd;if(typeof e!="boolean"&&e!==void 0&&e!=="fixed"&&e!=="relaxed"&&(console.warn(`Property "env.wasm.simd" is set to unknown value "${e}". Reset it to \`false\` and ignore SIMD feature checking.`),de.wasm.simd=!1),typeof de.wasm.proxy!="boolean"&&(de.wasm.proxy=!1),typeof de.wasm.trace!="boolean"&&(de.wasm.trace=!1),typeof de.wasm.numThreads!="number"||!Number.isInteger(de.wasm.numThreads)||de.wasm.numThreads<=0)if(typeof self<"u"&&!self.crossOriginIsolated)de.wasm.numThreads=1;else{let t=typeof navigator>"u"?Z("node:os").cpus().length:navigator.hardwareConcurrency;de.wasm.numThreads=Math.min(4,Math.ceil((t||1)/2))}},ws=class{async init(e){_s(),await dc(),await pc(e)}async createInferenceSessionHandler(e,t){let r=new wc;return await r.loadModel(e,t),r}},bc=new ws}),vc={};ue(vc,{InferenceSession:()=>hr,TRACE:()=>Pt,TRACE_EVENT_BEGIN:()=>Xe,TRACE_EVENT_END:()=>Ye,TRACE_FUNC_BEGIN:()=>je,TRACE_FUNC_END:()=>Ve,Tensor:()=>Me,default:()=>Vh,env:()=>de,registerBackend:()=>ze}),Ge(),Ge(),Ge();var Fh="1.30.0",Vh=Ii;{let e=(qh(),te($c)).wasmBackend;ze("webgpu",e,5),ze("webnn",e,5),ze("cpu",e,10),ze("wasm",e,10)}return Object.defineProperty(de.versions,"web",{value:Fh,enumerable:!0}),te(vc)})();typeof Cc=="object"&&typeof xs=="object"&&(xs.exports=Zh)});var Rc=tt(Oc=>{"use strict";Object.defineProperty(Oc,"__esModule",{value:!0})});var Dc=tt(ja=>{"use strict";var Mc;Object.defineProperty(ja,"__esModule",{value:!0});ja.SileroLegacy=void 0;var Bc=hi(),_a=class{constructor(q,N,H,Z,C){this.ortInstance=q,this._session=N,this._h=H,this._c=Z,this._sr=C,this.reset_state=()=>{let ue=Array(128).fill(0);this._h=new this.ortInstance.Tensor("float32",ue,[2,1,64]),this._c=new this.ortInstance.Tensor("float32",ue,[2,1,64])},this.process=async ue=>{let te={input:new this.ortInstance.Tensor("float32",ue,[1,ue.length]),h:this._h,c:this._c,sr:this._sr},fe=await this._session.run(te);this._h=fe.hn,this._c=fe.cn;let[_e]=fe.output?.data;return{notSpeech:1-_e,isSpeech:_e}},this.release=async()=>{await this._session.release(),this._h.dispose(),this._c.dispose(),this._sr.dispose()}}};ja.SileroLegacy=_a;Mc=_a;_a.new=async(U,q)=>{Bc.log.debug("initializing vad");let N=await q(),H=await U.InferenceSession.create(N),Z=new U.Tensor("int64",[16000n]),C=Array(128).fill(0),ue=new U.Tensor("float32",C,[2,1,64]),Se=new U.Tensor("float32",C,[2,1,64]);return Bc.log.debug("vad is initialized"),new Mc(U,H,ue,Se,Z)}});var Lc=tt(Ha=>{"use strict";var Uc;Object.defineProperty(Ha,"__esModule",{value:!0});Ha.Silero=void 0;var Pc=hi(),wa=64;function Nc(U){let q=Array(256).fill(0);return new U.Tensor("float32",q,[2,1,128])}var $a=class{constructor(q,N,H,Z){this._session=q,this._state=N,this._sr=H,this.ortInstance=Z,this._context=new Float32Array(wa),this.reset_state=()=>{this._state=Nc(this.ortInstance),this._context=new Float32Array(wa)},this.process=async C=>{let ue=new Float32Array(wa+C.length);ue.set(this._context,0),ue.set(C,wa),this._context=C.slice(-wa);let te={input:new this.ortInstance.Tensor("float32",ue,[1,ue.length]),state:this._state,sr:this._sr},fe=await this._session.run(te);if(!fe.stateN)throw new Error("No state from model");if(this._state=fe.stateN,!fe.output?.data)throw new Error("No output from model");let _e=fe.output.data[0];if(typeof _e!="number")throw new Error("Weird output data");return{notSpeech:1-_e,isSpeech:_e}},this.release=async()=>{await this._session.release(),this._state.dispose(),this._sr.dispose()}}};Ha.Silero=$a;Uc=$a;$a.new=async(U,q)=>{Pc.log.debug("Loading VAD...");let N=await q(),H=await U.InferenceSession.create(N),Z=new U.Tensor("int64",[16000n]),C=Nc(U);return Pc.log.debug("...finished loading VAD"),new Uc(H,C,Z,U)}});var Ss=tt(Dt=>{"use strict";var Qh=Dt&&Dt.__createBinding||(Object.create?(function(U,q,N,H){H===void 0&&(H=N);var Z=Object.getOwnPropertyDescriptor(q,N);(!Z||("get"in Z?!q.__esModule:Z.writable||Z.configurable))&&(Z={enumerable:!0,get:function(){return q[N]}}),Object.defineProperty(U,H,Z)}):(function(U,q,N,H){H===void 0&&(H=N),U[H]=q[N]})),Xh=Dt&&Dt.__exportStar||function(U,q){for(var N in U)N!=="default"&&!Object.prototype.hasOwnProperty.call(q,N)&&Qh(q,U,N)};Object.defineProperty(Dt,"__esModule",{value:!0});Dt.Silero=Dt.SileroLegacy=void 0;Xh(Rc(),Dt);var Yh=Dc();Object.defineProperty(Dt,"SileroLegacy",{enumerable:!0,get:function(){return Yh.SileroLegacy}});var Jh=Lc();Object.defineProperty(Dt,"Silero",{enumerable:!0,get:function(){return Jh.Silero}})});var Es=tt(Ka=>{"use strict";Object.defineProperty(Ka,"__esModule",{value:!0});Ka.Resampler=void 0;var ef=hi(),Ts=class{constructor(q){this.options=q,this.process=N=>{let H=[];for(let Z of N)for(this.inputBuffer.push(Z);this.hasEnoughDataForFrame();){let C=this.generateOutputFrame();H.push(C)}return H},q.nativeSampleRate<16e3&&ef.log.error("nativeSampleRate is too low. Should have 16000 = targetSampleRate <= nativeSampleRate"),this.inputBuffer=[]}async*stream(q){for(let N of q)for(this.inputBuffer.push(N);this.hasEnoughDataForFrame();)yield this.generateOutputFrame()}hasEnoughDataForFrame(){return this.inputBuffer.length*this.options.targetSampleRate/this.options.nativeSampleRate>=this.options.targetFrameSize}generateOutputFrame(){let q=new Float32Array(this.options.targetFrameSize),N=0,H=0;for(;N<this.options.targetFrameSize;){let Z=0,C=0;for(;H<Math.min(this.inputBuffer.length,(N+1)*this.options.nativeSampleRate/this.options.targetSampleRate);){let ue=this.inputBuffer[H];ue!==void 0&&(Z+=ue,C++),H++}q[N]=Z/C,N++}return this.inputBuffer=this.inputBuffer.slice(H),q}};Ka.Resampler=Ts});var qc=tt(yt=>{"use strict";var tf=yt&&yt.__createBinding||(Object.create?(function(U,q,N,H){H===void 0&&(H=N);var Z=Object.getOwnPropertyDescriptor(q,N);(!Z||("get"in Z?!q.__esModule:Z.writable||Z.configurable))&&(Z={enumerable:!0,get:function(){return q[N]}}),Object.defineProperty(U,H,Z)}):(function(U,q,N,H){H===void 0&&(H=N),U[H]=q[N]})),rf=yt&&yt.__setModuleDefault||(Object.create?(function(U,q){Object.defineProperty(U,"default",{enumerable:!0,value:q})}):function(U,q){U.default=q}),af=yt&&yt.__importStar||function(U){if(U&&U.__esModule)return U;var q={};if(U!=null)for(var N in U)N!=="default"&&Object.prototype.hasOwnProperty.call(U,N)&&tf(q,U,N);return rf(q,U),q};Object.defineProperty(yt,"__esModule",{value:!0});yt.NonRealTimeVAD=yt.defaultNonRealTimeVADOptions=void 0;var ks=af(Ac()),nf=$s(),sf=qa(),zs=Ga(),Is=ga(),of=Ss(),uf=Es();yt.defaultNonRealTimeVADOptions={...zs.defaultFrameProcessorOptions,modelURL:nf.baseAssetPath+"silero_vad_legacy.onnx",modelFetcher:sf.defaultModelFetcher};var Cs=class{static async new(q={}){let N={...yt.defaultNonRealTimeVADOptions,...q};(0,zs.validateOptions)(N),N.ortConfig!==void 0&&N.ortConfig(ks);let H=()=>N.modelFetcher(N.modelURL),Z=await of.SileroLegacy.new(ks,H),C=new zs.FrameProcessor(Z.process,Z.reset_state,{positiveSpeechThreshold:N.positiveSpeechThreshold,negativeSpeechThreshold:N.negativeSpeechThreshold,redemptionMs:N.redemptionMs,preSpeechPadMs:N.preSpeechPadMs,minSpeechMs:N.minSpeechMs,submitUserSpeechOnPause:N.submitUserSpeechOnPause},1536/16);return C.resume(),new this(H,ks,N,C)}constructor(q,N,H,Z){this.modelFetcher=q,this.ort=N,this.options=H,this.frameProcessor=Z,this.frameSamples=1536}async*run(q,N){let H={nativeSampleRate:N,targetSampleRate:16e3,targetFrameSize:this.frameSamples},Z=new uf.Resampler(H),C=0,ue=0,Se=0;for await(let fe of Z.stream(q)){let _e=[];await this.frameProcessor.process(fe,ze=>{_e.push(ze)});for(let ze of _e)switch(ze.msg){case Is.Message.SpeechStart:C=Se*this.frameSamples/16;break;case Is.Message.SpeechEnd:ue=(Se+1)*this.frameSamples/16,yield{audio:ze.audio,start:C,end:ue};break;default:break}Se++}let te=[];this.frameProcessor.endSegment(fe=>{te.push(fe)});for(let fe of te)fe.msg===Is.Message.SpeechEnd&&(yield{audio:fe.audio,start:C,end:Se*this.frameSamples/16})}};yt.NonRealTimeVAD=Cs});var Fc=tt(Gt=>{"use strict";Object.defineProperty(Gt,"__esModule",{value:!0});Gt.audioFileToArray=Gt.encodeWAV=Gt.arrayBufferToBase64=Gt.minFramesForTargetMS=void 0;function lf(U,q,N=16e3){return Math.ceil(U*N/1e3/q)}Gt.minFramesForTargetMS=lf;function df(U){let q=new Uint8Array(U),N=q.byteLength,H=new Array(N);for(let Z=0;Z<N;Z++){let C=q[Z];if(C===void 0)break;H[Z]=String.fromCharCode(C)}return btoa(H.join(""))}Gt.arrayBufferToBase64=df;function pf(U,q=3,N=16e3,H=1,Z=32){let C=Z/8,ue=H*C,Se=new ArrayBuffer(44+U.length*C),te=new DataView(Se);return Za(te,0,"RIFF"),te.setUint32(4,36+U.length*C,!0),Za(te,8,"WAVE"),Za(te,12,"fmt "),te.setUint32(16,16,!0),te.setUint16(20,q,!0),te.setUint16(22,H,!0),te.setUint32(24,N,!0),te.setUint32(28,N*ue,!0),te.setUint16(32,ue,!0),te.setUint16(34,Z,!0),Za(te,36,"data"),te.setUint32(40,U.length*C,!0),q===1?hf(te,44,U):cf(te,44,U),Se}Gt.encodeWAV=pf;function cf(U,q,N){for(let H=0;H<N.length;H++,q+=4)U.setFloat32(q,N[H],!0)}function hf(U,q,N){for(let H=0;H<N.length;H++,q+=2){let Z=Math.max(-1,Math.min(1,N[H]));U.setInt16(q,Z<0?Z*32768:Z*32767,!0)}}function Za(U,q,N){for(let H=0;H<N.length;H++)U.setUint8(q+H,N.charCodeAt(H))}async function ff(U){let q=new OfflineAudioContext(1,1,44100),N=new FileReader,H=null;if(await new Promise(ue=>{N.addEventListener("loadend",()=>{let Se=N.result;q.decodeAudioData(Se,te=>{H=te,q.startRendering().then(()=>{console.log("Rendering completed successfully"),ue()}).catch(fe=>{console.error("Rendering failed: ",fe)})},te=>{console.log("Error with decoding audio data: ",te)})}),N.readAsArrayBuffer(U)}),H===null)throw Error("some shit");let Z=H,C=new Float32Array(Z.length);for(let ue=0;ue<Z.length;ue++)for(let Se=0;Se<Z.numberOfChannels;Se++){let te=Z.getChannelData(Se)[ue],fe=C[ue];if(te===void 0||fe===void 0)throw new Error("sample or out[i] is undefined");C[ue]=fe+te}return{audio:C,sampleRate:Z.sampleRate}}Gt.audioFileToArray=ff});var Wc=tt((Gc,As)=>{"use strict";var mf=(()=>{var U=Object.defineProperty,q=Object.getOwnPropertyDescriptor,N=Object.getOwnPropertyNames,H=Object.prototype.hasOwnProperty,Z=(c=>typeof ct<"u"?ct:typeof Proxy<"u"?new Proxy(c,{get:(g,$)=>(typeof ct<"u"?ct:g)[$]}):c)(function(c){if(typeof ct<"u")return ct.apply(this,arguments);throw Error('Dynamic require of "'+c+'" is not supported')}),C=(c,g,$)=>()=>{if($)throw $[0];try{return c&&(g=c(c=0)),g}catch(E){throw $=[E],E}},ue=(c,g)=>{for(var $ in g)U(c,$,{get:g[$],enumerable:!0})},Se=(c,g,$,E)=>{if(g&&typeof g=="object"||typeof g=="function")for(let T of N(g))!H.call(c,T)&&T!==$&&U(c,T,{get:()=>g[T],enumerable:!(E=q(g,T))||E.enumerable});return c},te=c=>Se(U({},"__esModule",{value:!0}),c),fe,_e,ze,rt,_t,Ie=C(()=>{"use strict";fe=new Map,_e=[],ze=(c,g,$)=>{if(g&&typeof g.init=="function"&&typeof g.createInferenceSessionHandler=="function"){let E=fe.get(c);if(E===void 0)fe.set(c,{backend:g,priority:$});else{if(E.priority>$)return;if(E.priority===$&&E.backend!==g)throw new Error(`cannot register backend "${c}" using priority ${$}`)}if($>=0){let T=_e.indexOf(c);T!==-1&&_e.splice(T,1);for(let B=0;B<_e.length;B++)if(fe.get(_e[B]).priority<=$){_e.splice(B,0,c);return}_e.push(c)}return}throw new TypeError("not a valid backend")},rt=async c=>{let g=fe.get(c);if(!g)return"backend not found.";if(g.initialized)return g.backend;if(g.aborted)return g.error;{let $=!!g.initPromise;try{return $||(g.initPromise=g.backend.init(c)),await g.initPromise,g.initialized=!0,g.backend}catch(E){return $||(g.error=`${E}`,g.aborted=!0),g.error}finally{delete g.initPromise}}},_t=async c=>{let g=c.executionProviders||[],$=g.map(R=>typeof R=="string"?R:R.name),E=$.length===0?_e:$,T,B=[],z=new Set;for(let R of E){let F=await rt(R);typeof F=="string"?B.push({name:R,err:F}):(T||(T=F),T===F&&z.add(R))}if(!T)throw new Error(`no available backend found. ERR: ${B.map(R=>`[${R.name}] ${R.err}`).join(", ")}`);for(let{name:R,err:F}of B)$.includes(R)&&console.warn(`removing requested execution provider "${R}" from session options because it is not available: ${F}`);let k=g.filter(R=>z.has(typeof R=="string"?R:R.name));return[T,new Proxy(c,{get:(R,F)=>F==="executionProviders"?k:Reflect.get(R,F)})]}}),xt=C(()=>{"use strict";Ie()}),ur,Hr=C(()=>{"use strict";ur="1.30.0"}),lr,Te,fi=C(()=>{"use strict";Hr(),lr="warning",Te={wasm:{},webgl:{},webgpu:{},versions:{common:ur},set logLevel(c){if(c!==void 0){if(typeof c!="string"||["verbose","info","warning","error","fatal"].indexOf(c)===-1)throw new Error(`Unsupported logging level: ${c}`);lr=c}},get logLevel(){return lr}},Object.defineProperty(Te,"logLevel",{enumerable:!0})}),de,Xa=C(()=>{"use strict";fi(),de=Te}),mi,gi,Ya=C(()=>{"use strict";mi=(c,g)=>{let $=typeof document<"u"?document.createElement("canvas"):new OffscreenCanvas(1,1);$.width=c.dims[3],$.height=c.dims[2];let E=$.getContext("2d");if(E!=null){let T,B;g?.tensorLayout!==void 0&&g.tensorLayout==="NHWC"?(T=c.dims[2],B=c.dims[3]):(T=c.dims[3],B=c.dims[2]);let z=g?.format!==void 0?g.format:"RGB",k=g?.norm,R,F;k===void 0||k.mean===void 0?R=[255,255,255,255]:typeof k.mean=="number"?R=[k.mean,k.mean,k.mean,k.mean]:(R=[k.mean[0],k.mean[1],k.mean[2],0],k.mean[3]!==void 0&&(R[3]=k.mean[3])),k===void 0||k.bias===void 0?F=[0,0,0,0]:typeof k.bias=="number"?F=[k.bias,k.bias,k.bias,k.bias]:(F=[k.bias[0],k.bias[1],k.bias[2],0],k.bias[3]!==void 0&&(F[3]=k.bias[3]));let G=B*T,L=0,D=G,J=G*2,A=-1;z==="RGBA"?(L=0,D=G,J=G*2,A=G*3):z==="RGB"?(L=0,D=G,J=G*2):z==="RBG"&&(L=0,J=G,D=G*2);for(let j=0;j<B;j++)for(let Ce=0;Ce<T;Ce++){let ce=(c.data[L++]-F[0])*R[0],me=(c.data[D++]-F[1])*R[1],be=(c.data[J++]-F[2])*R[2],K=A===-1?255:(c.data[A++]-F[3])*R[3];E.fillStyle="rgba("+ce+","+me+","+be+","+K+")",E.fillRect(Ce,j,1,1)}if("toDataURL"in $)return $.toDataURL();throw new Error("toDataURL is not supported")}else throw new Error("Can not access image data")},gi=(c,g)=>{let $=typeof document<"u"?document.createElement("canvas").getContext("2d"):new OffscreenCanvas(1,1).getContext("2d"),E;if($!=null){let T,B,z;g?.tensorLayout!==void 0&&g.tensorLayout==="NHWC"?(T=c.dims[2],B=c.dims[1],z=c.dims[3]):(T=c.dims[3],B=c.dims[2],z=c.dims[1]);let k=g!==void 0&&g.format!==void 0?g.format:"RGB",R=g?.norm,F,G;R===void 0||R.mean===void 0?F=[255,255,255,255]:typeof R.mean=="number"?F=[R.mean,R.mean,R.mean,R.mean]:(F=[R.mean[0],R.mean[1],R.mean[2],255],R.mean[3]!==void 0&&(F[3]=R.mean[3])),R===void 0||R.bias===void 0?G=[0,0,0,0]:typeof R.bias=="number"?G=[R.bias,R.bias,R.bias,R.bias]:(G=[R.bias[0],R.bias[1],R.bias[2],0],R.bias[3]!==void 0&&(G[3]=R.bias[3]));let L=B*T;if(g!==void 0&&(g.format!==void 0&&z===4&&g.format!=="RGBA"||z===3&&g.format!=="RGB"&&g.format!=="BGR"))throw new Error("Tensor format doesn't match input tensor dims");let D=4,J=0,A=1,j=2,Ce=3,ce=0,me=L,be=L*2,K=-1;k==="RGBA"?(ce=0,me=L,be=L*2,K=L*3):k==="RGB"?(ce=0,me=L,be=L*2):k==="RBG"&&(ce=0,be=L,me=L*2),E=$.createImageData(T,B);for(let Pe=0;Pe<B*T;J+=D,A+=D,j+=D,Ce+=D,Pe++)E.data[J]=(c.data[ce++]-G[0])*F[0],E.data[A]=(c.data[me++]-G[1])*F[1],E.data[j]=(c.data[be++]-G[2])*F[2],E.data[Ce]=K===-1?255:(c.data[K++]-G[3])*F[3]}else throw new Error("Can not access image data");return E}}),Wt,yi,_i,wi,$i,bi,Ja=C(()=>{"use strict";pr(),Wt=(c,g)=>{if(c===void 0)throw new Error("Image buffer must be defined");if(g.height===void 0||g.width===void 0)throw new Error("Image height and width must be defined");if(g.tensorLayout==="NHWC")throw new Error("NHWC Tensor layout is not supported yet");let{height:$,width:E}=g,T=g.norm??{mean:255,bias:0},B,z;typeof T.mean=="number"?B=[T.mean,T.mean,T.mean,T.mean]:B=[T.mean[0],T.mean[1],T.mean[2],T.mean[3]??255],typeof T.bias=="number"?z=[T.bias,T.bias,T.bias,T.bias]:z=[T.bias[0],T.bias[1],T.bias[2],T.bias[3]??0];let k=g.format!==void 0?g.format:"RGBA",R=g.tensorFormat!==void 0&&g.tensorFormat!==void 0?g.tensorFormat:"RGB",F=$*E,G=R==="RGBA"?new Float32Array(F*4):new Float32Array(F*3),L=4,D=0,J=1,A=2,j=3,Ce=0,ce=F,me=F*2,be=-1;k==="RGB"&&(L=3,D=0,J=1,A=2,j=-1),R==="RGBA"?be=F*3:R==="RBG"?(Ce=0,me=F,ce=F*2):R==="BGR"&&(me=0,ce=F,Ce=F*2);for(let K=0;K<F;K++,D+=L,A+=L,J+=L,j+=L)G[Ce++]=(c[D]+z[0])/B[0],G[ce++]=(c[J]+z[1])/B[1],G[me++]=(c[A]+z[2])/B[2],be!==-1&&j!==-1&&(G[be++]=(c[j]+z[3])/B[3]);return R==="RGBA"?new Oe("float32",G,[1,4,$,E]):new Oe("float32",G,[1,3,$,E])},yi=async(c,g)=>{let $=typeof HTMLImageElement<"u"&&c instanceof HTMLImageElement,E=typeof ImageData<"u"&&c instanceof ImageData,T=typeof ImageBitmap<"u"&&c instanceof ImageBitmap,B=typeof c=="string",z,k=g??{},R=()=>{if(typeof document<"u")return document.createElement("canvas");if(typeof OffscreenCanvas<"u")return new OffscreenCanvas(1,1);throw new Error("Canvas is not supported")},F=G=>typeof HTMLCanvasElement<"u"&&G instanceof HTMLCanvasElement||G instanceof OffscreenCanvas?G.getContext("2d"):null;if($){let G=R();G.width=c.width,G.height=c.height;let L=F(G);if(L!=null){let D=c.height,J=c.width;if(g!==void 0&&g.resizedHeight!==void 0&&g.resizedWidth!==void 0&&(D=g.resizedHeight,J=g.resizedWidth),g!==void 0){if(k=g,g.tensorFormat!==void 0)throw new Error("Image input config format must be RGBA for HTMLImageElement");k.tensorFormat="RGBA",k.height=D,k.width=J}else k.tensorFormat="RGBA",k.height=D,k.width=J;L.drawImage(c,0,0),z=L.getImageData(0,0,J,D).data}else throw new Error("Can not access image data")}else if(E){let G,L;if(g!==void 0&&g.resizedWidth!==void 0&&g.resizedHeight!==void 0?(G=g.resizedHeight,L=g.resizedWidth):(G=c.height,L=c.width),g!==void 0&&(k=g),k.format="RGBA",k.height=G,k.width=L,g!==void 0){let D=R();D.width=L,D.height=G;let J=F(D);if(J!=null)J.putImageData(c,0,0),z=J.getImageData(0,0,L,G).data;else throw new Error("Can not access image data")}else z=c.data}else if(T){if(g===void 0)throw new Error("Please provide image config with format for Imagebitmap");let G=R();G.width=c.width,G.height=c.height;let L=F(G);if(L!=null){let D=c.height,J=c.width;return L.drawImage(c,0,0,J,D),z=L.getImageData(0,0,J,D).data,k.height=D,k.width=J,Wt(z,k)}else throw new Error("Can not access image data")}else{if(B)return new Promise((G,L)=>{let D=R(),J=F(D);if(!c||!J)return L();let A=new Image;A.crossOrigin="Anonymous",A.src=c,A.onload=()=>{D.width=A.width,D.height=A.height,J.drawImage(A,0,0,D.width,D.height);let j=J.getImageData(0,0,D.width,D.height);k.height=D.height,k.width=D.width,G(Wt(j.data,k))}});throw new Error("Input data provided is not supported - aborted tensor creation")}if(z!==void 0)return Wt(z,k);throw new Error("Input data provided is not supported - aborted tensor creation")},_i=(c,g)=>{let{width:$,height:E,download:T,dispose:B}=g,z=[1,E,$,4];return new Oe({location:"texture",type:"float32",texture:c,dims:z,download:T,dispose:B})},wi=(c,g)=>{let{dataType:$,dims:E,download:T,dispose:B}=g;return new Oe({location:"gpu-buffer",type:$??"float32",gpuBuffer:c,dims:E,download:T,dispose:B})},$i=(c,g)=>{let{dataType:$,dims:E,download:T,dispose:B}=g;return new Oe({location:"ml-tensor",type:$??"float32",mlTensor:c,dims:E,download:T,dispose:B})},bi=(c,g,$)=>new Oe({location:"cpu-pinned",type:c,data:g,dims:$??[g.length]})}),it,St,dr,vi,en=C(()=>{"use strict";it=new Map([["float32",Float32Array],["uint8",Uint8Array],["int8",Int8Array],["uint16",Uint16Array],["int16",Int16Array],["int32",Int32Array],["bool",Uint8Array],["float64",Float64Array],["uint32",Uint32Array],["int4",Uint8Array],["uint4",Uint8Array]]),St=new Map([[Float32Array,"float32"],[Uint8Array,"uint8"],[Int8Array,"int8"],[Uint16Array,"uint16"],[Int16Array,"int16"],[Int32Array,"int32"],[Float64Array,"float64"],[Uint32Array,"uint32"]]),dr=!1,vi=()=>{if(!dr){dr=!0;let c=typeof BigInt64Array<"u"&&BigInt64Array.from,g=typeof BigUint64Array<"u"&&BigUint64Array.from,$=globalThis.Float16Array,E=typeof $<"u"&&$.from;c&&(it.set("int64",BigInt64Array),St.set(BigInt64Array,"int64")),g&&(it.set("uint64",BigUint64Array),St.set(BigUint64Array,"uint64")),E?(it.set("float16",$),St.set($,"float16")):it.set("float16",Uint16Array)}}}),xi,Si,tn=C(()=>{"use strict";pr(),xi=c=>{let g=1;for(let $=0;$<c.length;$++){let E=c[$];if(typeof E!="number"||!Number.isSafeInteger(E))throw new TypeError(`dims[${$}] must be an integer, got: ${E}`);if(E<0)throw new RangeError(`dims[${$}] must be a non-negative integer, got: ${E}`);g*=E}return g},Si=(c,g)=>{switch(c.location){case"cpu":return new Oe(c.type,c.data,g);case"cpu-pinned":return new Oe({location:"cpu-pinned",data:c.data,type:c.type,dims:g});case"texture":return new Oe({location:"texture",texture:c.texture,type:c.type,dims:g});case"gpu-buffer":return new Oe({location:"gpu-buffer",gpuBuffer:c.gpuBuffer,type:c.type,dims:g});case"ml-tensor":return new Oe({location:"ml-tensor",mlTensor:c.mlTensor,type:c.type,dims:g});default:throw new Error(`tensorReshape: tensor location ${c.location} is not supported`)}}}),Oe,pr=C(()=>{"use strict";Ya(),Ja(),en(),tn(),Oe=class{constructor(c,g,$){vi();let E,T;if(typeof c=="object"&&"location"in c)switch(this.dataLocation=c.location,E=c.type,T=c.dims,c.location){case"cpu-pinned":{let z=it.get(E);if(!z)throw new TypeError(`unsupported type "${E}" to create tensor from pinned buffer`);if(!(c.data instanceof z))throw new TypeError(`buffer should be of type ${z.name}`);this.cpuData=c.data;break}case"texture":{if(E!=="float32")throw new TypeError(`unsupported type "${E}" to create tensor from texture`);this.gpuTextureData=c.texture,this.downloader=c.download,this.disposer=c.dispose;break}case"gpu-buffer":{if(E!=="float32"&&E!=="float16"&&E!=="int32"&&E!=="int64"&&E!=="uint32"&&E!=="uint8"&&E!=="bool"&&E!=="uint4"&&E!=="int4")throw new TypeError(`unsupported type "${E}" to create tensor from gpu buffer`);this.gpuBufferData=c.gpuBuffer,this.downloader=c.download,this.disposer=c.dispose;break}case"ml-tensor":{if(E!=="float32"&&E!=="float16"&&E!=="int32"&&E!=="int64"&&E!=="uint32"&&E!=="uint64"&&E!=="int8"&&E!=="uint8"&&E!=="bool"&&E!=="uint4"&&E!=="int4")throw new TypeError(`unsupported type "${E}" to create tensor from MLTensor`);this.mlTensorData=c.mlTensor,this.downloader=c.download,this.disposer=c.dispose;break}default:throw new Error(`Tensor constructor: unsupported location '${this.dataLocation}'`)}else{let z,k;if(typeof c=="string")if(E=c,k=$,c==="string"){if(!Array.isArray(g))throw new TypeError("A string tensor's data must be a string array.");z=g}else{let R=it.get(c);if(R===void 0)throw new TypeError(`Unsupported tensor type: ${c}.`);if(Array.isArray(g)){if(c==="float16"&&R===Uint16Array||c==="uint4"||c==="int4")throw new TypeError(`Creating a ${c} tensor from number array is not supported. Please use ${R.name} as data.`);c==="uint64"||c==="int64"?z=R.from(g,BigInt):z=R.from(g)}else if(g instanceof R)z=g;else if(g instanceof Uint8ClampedArray)if(c==="uint8")z=Uint8Array.from(g);else throw new TypeError("A Uint8ClampedArray tensor's data must be type of uint8");else if(c==="float16"&&g instanceof Uint16Array&&R!==Uint16Array)z=new globalThis.Float16Array(g.buffer,g.byteOffset,g.length);else throw new TypeError(`A ${E} tensor's data must be type of ${R}`)}else if(k=g,Array.isArray(c)){if(c.length===0)throw new TypeError("Tensor type cannot be inferred from an empty array.");let R=typeof c[0];if(R==="string")E="string",z=c;else if(R==="boolean")E="bool",z=Uint8Array.from(c);else throw new TypeError(`Invalid element type of data array: ${R}.`)}else if(c instanceof Uint8ClampedArray)E="uint8",z=Uint8Array.from(c);else{let R=St.get(c.constructor);if(R===void 0)throw new TypeError(`Unsupported type for tensor data: ${c.constructor}.`);E=R,z=c}if(k===void 0)k=[z.length];else if(!Array.isArray(k))throw new TypeError("A tensor's dims must be a number array");T=k,this.cpuData=z,this.dataLocation="cpu"}let B=xi(T);if(this.cpuData&&B!==this.cpuData.length&&!((E==="uint4"||E==="int4")&&Math.ceil(B/2)===this.cpuData.length))throw new Error(`Tensor's size(${B}) does not match data length(${this.cpuData.length}).`);this.type=E,this.dims=T,this.size=B}static async fromImage(c,g){return yi(c,g)}static fromTexture(c,g){return _i(c,g)}static fromGpuBuffer(c,g){return wi(c,g)}static fromMLTensor(c,g){return $i(c,g)}static fromPinnedBuffer(c,g,$){return bi(c,g,$)}toDataURL(c){return mi(this,c)}toImageData(c){return gi(this,c)}get data(){if(this.ensureValid(),!this.cpuData)throw new Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");return this.cpuData}get location(){return this.dataLocation}get texture(){if(this.ensureValid(),!this.gpuTextureData)throw new Error("The data is not stored as a WebGL texture.");return this.gpuTextureData}get gpuBuffer(){if(this.ensureValid(),!this.gpuBufferData)throw new Error("The data is not stored as a WebGPU buffer.");return this.gpuBufferData}get mlTensor(){if(this.ensureValid(),!this.mlTensorData)throw new Error("The data is not stored as a WebNN MLTensor.");return this.mlTensorData}async getData(c){switch(this.ensureValid(),this.dataLocation){case"cpu":case"cpu-pinned":return this.data;case"texture":case"gpu-buffer":case"ml-tensor":{if(!this.downloader)throw new Error("The current tensor is not created with a specified data downloader.");if(this.isDownloading)throw new Error("The current tensor is being downloaded.");try{this.isDownloading=!0;let g=await this.downloader();return this.downloader=void 0,this.dataLocation="cpu",this.cpuData=g,c&&this.disposer&&(this.disposer(),this.disposer=void 0),g}finally{this.isDownloading=!1}}default:throw new Error(`cannot get data from location: ${this.dataLocation}`)}}dispose(){if(this.isDownloading)throw new Error("The current tensor is being downloaded.");this.disposer&&(this.disposer(),this.disposer=void 0),this.cpuData=void 0,this.gpuTextureData=void 0,this.gpuBufferData=void 0,this.mlTensorData=void 0,this.downloader=void 0,this.isDownloading=void 0,this.dataLocation="none"}ensureValid(){if(this.dataLocation==="none")throw new Error("The tensor is disposed.")}reshape(c){if(this.ensureValid(),this.downloader||this.disposer)throw new Error("Cannot reshape a tensor that owns GPU resource.");return Si(this,c)}}}),Me,Ti=C(()=>{"use strict";pr(),Me=Oe}),Pt,cr,je,Ve,Xe,Ye,Ei=C(()=>{"use strict";fi(),Pt=(c,g)=>{(typeof Te.trace>"u"?!Te.wasm.trace:!Te.trace)||console.timeStamp(`${c}::ORT::${g}`)},cr=(c,g)=>{let $=new Error().stack?.split(/\r\n|\r|\n/g)||[],E=!1;for(let T=0;T<$.length;T++){if(E&&!$[T].includes("TRACE_FUNC")){let B=`FUNC_${c}::${$[T].trim().split(" ")[1]}`;g&&(B+=`::${g}`),Pt("CPU",B);return}$[T].includes("TRACE_FUNC")&&(E=!0)}},je=c=>{(typeof Te.trace>"u"?!Te.wasm.trace:!Te.trace)||cr("BEGIN",c)},Ve=c=>{(typeof Te.trace>"u"?!Te.wasm.trace:!Te.trace)||cr("END",c)},Xe=c=>{(typeof Te.trace>"u"?!Te.wasm.trace:!Te.trace)||console.time(`ORT::${c}`)},Ye=c=>{(typeof Te.trace>"u"?!Te.wasm.trace:!Te.trace)||console.timeEnd(`ORT::${c}`)}}),ki,rn=C(()=>{"use strict";Ie(),Ti(),Ei(),ki=class Vc{constructor(g){this.handler=g}async run(g,$,E){je(),Xe("InferenceSession.run");let T={},B={};if(typeof g!="object"||g===null||g instanceof Me||Array.isArray(g))throw new TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");let z=!0;if(typeof $=="object"){if($===null)throw new TypeError("Unexpected argument[1]: cannot be null.");if($ instanceof Me)throw new TypeError("'fetches' cannot be a Tensor");if(Array.isArray($)){if($.length===0)throw new TypeError("'fetches' cannot be an empty array.");z=!1;for(let F of $){if(typeof F!="string")throw new TypeError("'fetches' must be a string array or an object.");if(this.outputNames.indexOf(F)===-1)throw new RangeError(`'fetches' contains invalid output name: ${F}.`);T[F]=null}if(typeof E=="object"&&E!==null)B=E;else if(typeof E<"u")throw new TypeError("'options' must be an object.")}else{let F=!1,G=Object.getOwnPropertyNames($);for(let L of this.outputNames)if(G.indexOf(L)!==-1){let D=$[L];(D===null||D instanceof Me)&&(F=!0,z=!1,T[L]=D)}if(F){if(typeof E=="object"&&E!==null)B=E;else if(typeof E<"u")throw new TypeError("'options' must be an object.")}else B=$}}else if(typeof $<"u")throw new TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");for(let F of this.inputNames)if(typeof g[F]>"u")throw new Error(`input '${F}' is missing in 'feeds'.`);if(z)for(let F of this.outputNames)T[F]=null;let k=await this.handler.run(g,T,B),R={};for(let F in k)if(Object.hasOwnProperty.call(k,F)){let G=k[F];G instanceof Me?R[F]=G:R[F]=new Me(G.type,G.data,G.dims)}return Ye("InferenceSession.run"),Ve(),R}async release(){return this.handler.dispose()}static async create(g,$,E,T){je(),Xe("InferenceSession.create");let B,z={};if(typeof g=="string"){if(B=g,typeof $=="object"&&$!==null)z=$;else if(typeof $<"u")throw new TypeError("'options' must be an object.")}else if(g instanceof Uint8Array){if(B=g,typeof $=="object"&&$!==null)z=$;else if(typeof $<"u")throw new TypeError("'options' must be an object.")}else if(g instanceof ArrayBuffer||typeof SharedArrayBuffer<"u"&&g instanceof SharedArrayBuffer){let G=g,L=0,D=g.byteLength;if(typeof $=="object"&&$!==null)z=$;else if(typeof $=="number"){if(L=$,!Number.isSafeInteger(L))throw new RangeError("'byteOffset' must be an integer.");if(L<0||L>=G.byteLength)throw new RangeError(`'byteOffset' is out of range [0, ${G.byteLength}).`);if(D=g.byteLength-L,typeof E=="number"){if(D=E,!Number.isSafeInteger(D))throw new RangeError("'byteLength' must be an integer.");if(D<=0||L+D>G.byteLength)throw new RangeError(`'byteLength' is out of range (0, ${G.byteLength-L}].`);if(typeof T=="object"&&T!==null)z=T;else if(typeof T<"u")throw new TypeError("'options' must be an object.")}else if(typeof E<"u")throw new TypeError("'byteLength' must be a number.")}else if(typeof $<"u")throw new TypeError("'options' must be an object.");B=new Uint8Array(G,L,D)}else throw new TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");let[k,R]=await _t(z),F=await k.createInferenceSessionHandler(B,R);return Ye("InferenceSession.create"),Ve(),new Vc(F)}startProfiling(){this.handler.startProfiling()}endProfiling(){this.handler.endProfiling()}get inputNames(){return this.handler.inputNames}get outputNames(){return this.handler.outputNames}get inputMetadata(){return this.handler.inputMetadata}get outputMetadata(){return this.handler.outputMetadata}}}),hr,an=C(()=>{"use strict";rn(),hr=ki}),nn=C(()=>{"use strict"}),sn=C(()=>{"use strict"}),on=C(()=>{"use strict"}),un=C(()=>{"use strict"}),Ii={};ue(Ii,{InferenceSession:()=>hr,TRACE:()=>Pt,TRACE_EVENT_BEGIN:()=>Xe,TRACE_EVENT_END:()=>Ye,TRACE_FUNC_BEGIN:()=>je,TRACE_FUNC_END:()=>Ve,Tensor:()=>Me,env:()=>de,registerBackend:()=>ze});var Ge=C(()=>{"use strict";xt(),Xa(),an(),Ti(),nn(),sn(),Ei(),on(),un()}),fr=C(()=>{"use strict"}),zi={};ue(zi,{default:()=>Ci});var mr,gr,Ci,ln=C(()=>{"use strict";Zi(),st(),br(),mr="ort-wasm-proxy-worker",gr=globalThis.self?.name===mr,gr&&(self.onmessage=c=>{let{type:g,in:$}=c.data;try{switch(g){case"init-wasm":Sr($.wasm).then(()=>{Zr($).then(()=>{postMessage({type:g})},E=>{postMessage({type:g,err:E})})},E=>{postMessage({type:g,err:E})});break;case"init-ep":{let{epName:E,env:T}=$;Qr(T,E).then(()=>{postMessage({type:g})},B=>{postMessage({type:g,err:B})});break}case"copy-from":{let{buffer:E}=$,T=$e(E);postMessage({type:g,out:T});break}case"create":{let{model:E,options:T}=$;ht(E,T).then(B=>{postMessage({type:g,out:B})},B=>{postMessage({type:g,err:B})});break}case"release":Jr($),postMessage({type:g});break;case"run":{let{sessionId:E,inputIndices:T,inputs:B,outputIndices:z,options:k}=$;M(E,T,B,z,new Array(z.length).fill(null),k).then(R=>{R.some(F=>F[3]!=="cpu")?postMessage({type:g,err:"Proxy does not support non-cpu tensor location."}):postMessage({type:g,out:R},ei([...B,...R]))},R=>{postMessage({type:g,err:R})});break}case"end-profiling":Jt($),postMessage({type:g});break;default:}}catch(E){postMessage({type:g,err:E})}}),Ci=gr?null:c=>new Worker(c??Re,{type:"classic",name:mr})}),Ai,Oi,Re,yr,jt,Ri,Bi,_r,Mi,wr,Di,$r,Pi,br=C(()=>{"use strict";fr(),Ai=typeof location>"u"?void 0:location.origin,Oi=()=>typeof document<"u"?document.currentScript?.src:typeof self<"u"?self.location?.href:void 0,Re=Oi(),yr=()=>{if(Re&&!Re.startsWith("blob:"))return Re.substring(0,Re.lastIndexOf("/")+1)},jt=(c,g)=>{try{let $=g??Re;return($?new URL(c,$):new URL(c)).origin===Ai}catch{return!1}},Ri=(c,g)=>{let $=g??Re;try{return($?new URL(c,$):new URL(c)).href}catch{return}},Bi=(c,g)=>`${g??"./"}${c}`,_r=async c=>{let g=await(await fetch(c,{credentials:"same-origin"})).blob();return URL.createObjectURL(g)},Mi=async c=>(await import(c)).default,wr=(ln(),te(zi)).default,Di=async()=>{if(!Re)throw new Error("Failed to load proxy worker: cannot determine the script source URL.");if(jt(Re))return[void 0,wr()];let c=await _r(Re);return[c,wr(c)]},$r=void 0,Pi=async(c,g,$,E)=>{let T=$r&&!(c||g);if(T)if(Re)T=jt(Re)||E&&!$;else if(E&&!$)T=!0;else throw new Error("cannot determine the script source URL.");if(T)return[void 0,$r];{let B="ort-wasm-simd-threaded.mjs",z=c??Ri(B,g),k=$&&z&&!jt(z,g),R=k?await _r(z):z??Bi(B,g);return[k?R:void 0,await Mi(R)]}}}),vr,Ht,Tt,xr,Ui,Ni,Li,Sr,le,st=C(()=>{"use strict";br(),Ht=!1,Tt=!1,xr=!1,Ui=()=>{if(typeof SharedArrayBuffer>"u")return!1;try{return typeof MessageChannel<"u"&&new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)),WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,4,1,3,1,1,10,11,1,9,0,65,0,254,16,2,0,26,11]))}catch{return!1}},Ni=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,30,1,28,0,65,0,253,15,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,253,186,1,26,11]))}catch{return!1}},Li=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,19,1,17,0,65,1,253,15,65,2,253,15,65,3,253,15,253,147,2,11]))}catch{return!1}},Sr=async c=>{if(Ht)return Promise.resolve();if(Tt)throw new Error("multiple calls to 'initializeWebAssembly()' detected.");if(xr)throw new Error("previous call to 'initializeWebAssembly()' failed.");Tt=!0;let g=c.initTimeout,$=c.numThreads;if(c.simd!==!1){if(c.simd==="relaxed"){if(!Li())throw new Error("Relaxed WebAssembly SIMD is not supported in the current environment.")}else if(!Ni())throw new Error("WebAssembly SIMD is not supported in the current environment.")}let E=Ui();$>1&&!E&&(typeof self<"u"&&!self.crossOriginIsolated&&console.warn("env.wasm.numThreads is set to "+$+", but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info."),console.warn("WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading."),c.numThreads=$=1);let T=c.wasmPaths,B=typeof T=="string"?T:void 0,z=T?.mjs,k=z?.href??z,R=T?.wasm,F=R?.href??R,G=c.wasmBinary,[L,D]=await Pi(k,B,$>1,!!G||!!F),J=!1,A=[];if(g>0&&A.push(new Promise(j=>{setTimeout(()=>{J=!0,j()},g)})),A.push(new Promise((j,Ce)=>{let ce={numThreads:$};if(G)ce.wasmBinary=G,ce.locateFile=me=>me;else if(F||B)ce.locateFile=me=>F??B+me;else if(k&&k.indexOf("blob:")!==0)ce.locateFile=me=>new URL(me,k).href;else if(L){let me=yr();me&&(ce.locateFile=be=>me+be)}D(ce).then(me=>{Tt=!1,Ht=!0,vr=me,j(),L&&URL.revokeObjectURL(L)},me=>{Tt=!1,xr=!0,Ce(me)})})),await Promise.race(A),J)throw new Error(`WebAssembly backend initializing failed due to timeout: ${g}ms`)},le=()=>{if(Ht&&vr)return vr;throw new Error("WebAssembly is not initialized yet.")}}),De,Kt,re,Tr=C(()=>{"use strict";st(),De=(c,g)=>{let $=le(),E=$.lengthBytesUTF8(c)+1,T=$._malloc(E);return $.stringToUTF8(c,T,E),g.push(T),T},Kt=(c,g,$,E)=>{if(typeof c=="object"&&c!==null){if($.has(c))throw new Error("Circular reference in options");$.add(c)}Object.entries(c).forEach(([T,B])=>{let z=g?g+T:T;if(typeof B=="object")Kt(B,z+".",$,E);else if(typeof B=="string"||typeof B=="number")E(z,B.toString());else if(typeof B=="boolean")E(z,B?"1":"0");else throw new Error(`Can't handle extra config type: ${typeof B}`)})},re=c=>{let g=le(),$=g.stackSave();try{let E=g.PTR_SIZE,T=g.stackAlloc(2*E);g._OrtGetLastError(T,T+E);let B=Number(g.getValue(T,E===4?"i32":"i64")),z=g.getValue(T+E,"*"),k=z?g.UTF8ToString(z):"";throw new Error(`${c} ERROR_CODE: ${B}, ERROR_MESSAGE: ${k}`)}finally{g.stackRestore($)}}}),qi,dn=C(()=>{"use strict";st(),Tr(),qi=c=>{let g=le(),$=0,E=[],T=c||{};try{if(c?.logSeverityLevel===void 0)T.logSeverityLevel=2;else if(typeof c.logSeverityLevel!="number"||!Number.isInteger(c.logSeverityLevel)||c.logSeverityLevel<0||c.logSeverityLevel>4)throw new Error(`log severity level is not valid: ${c.logSeverityLevel}`);if(c?.logVerbosityLevel===void 0)T.logVerbosityLevel=0;else if(typeof c.logVerbosityLevel!="number"||!Number.isInteger(c.logVerbosityLevel))throw new Error(`log verbosity level is not valid: ${c.logVerbosityLevel}`);c?.terminate===void 0&&(T.terminate=!1);let B=0;return c?.tag!==void 0&&(B=De(c.tag,E)),$=g._OrtCreateRunOptions(T.logSeverityLevel,T.logVerbosityLevel,!!T.terminate,B),$===0&&re("Can't create run options."),c?.extra!==void 0&&Kt(c.extra,"",new WeakSet,(z,k)=>{let R=De(z,E),F=De(k,E);g._OrtAddRunConfigEntry($,R,F)!==0&&re(`Can't set a run config entry: ${z} - ${k}.`)}),[$,E]}catch(B){throw $!==0&&g._OrtReleaseRunOptions($),E.forEach(z=>g._free(z)),B}}}),Fi,Vi,Gi,at,Wi,ji,pn=C(()=>{"use strict";st(),Tr(),Fi=c=>{switch(c){case"disabled":return 0;case"basic":return 1;case"extended":return 2;case"layout":return 3;case"all":return 99;default:throw new Error(`unsupported graph optimization level: ${c}`)}},Vi=c=>{switch(c){case"sequential":return 0;case"parallel":return 1;default:throw new Error(`unsupported execution mode: ${c}`)}},Gi=c=>{c.extra||(c.extra={}),c.extra.session||(c.extra.session={});let g=c.extra.session;g.use_ort_model_bytes_directly||(g.use_ort_model_bytes_directly="1"),c.executionProviders&&c.executionProviders.some($=>(typeof $=="string"?$:$.name)==="webgpu")&&(c.enableMemPattern=!1)},at=(c,g,$,E)=>{let T=De(g,E),B=De($,E);le()._OrtAddSessionConfigEntry(c,T,B)!==0&&re(`Can't set a session config entry: ${g} - ${$}.`)},Wi=async(c,g,$)=>{let E=g.executionProviders;for(let T of E){let B=typeof T=="string"?T:T.name,z=[];switch(B){case"webnn":if(B="WEBNN",at(c,"session.disable_quant_qdq","1",$),at(c,"session.disable_qdq_constant_folding","1",$),typeof T!="string"){let L=T?.deviceType;L&&at(c,"deviceType",L,$)}break;case"webgpu":if(B="JS",typeof T!="string"){let L=T;if(L?.preferredLayout){if(L.preferredLayout!=="NCHW"&&L.preferredLayout!=="NHWC")throw new Error(`preferredLayout must be either 'NCHW' or 'NHWC': ${L.preferredLayout}`);at(c,"preferredLayout",L.preferredLayout,$)}}break;case"wasm":case"cpu":continue;default:throw new Error(`not supported execution provider: ${B}`)}let k=De(B,$),R=z.length,F=0,G=0;if(R>0){F=le()._malloc(R*le().PTR_SIZE),$.push(F),G=le()._malloc(R*le().PTR_SIZE),$.push(G);for(let L=0;L<R;L++)le().setValue(F+L*le().PTR_SIZE,z[L][0],"*"),le().setValue(G+L*le().PTR_SIZE,z[L][1],"*")}await le()._OrtAppendExecutionProvider(c,k,F,G,R)!==0&&re(`Can't append execution provider: ${B}.`)}},ji=async c=>{let g=le(),$=0,E=[],T=c||{};Gi(T);try{let B=Fi(T.graphOptimizationLevel??"all"),z=Vi(T.executionMode??"sequential"),k=typeof T.logId=="string"?De(T.logId,E):0,R=T.logSeverityLevel??2;if(!Number.isInteger(R)||R<0||R>4)throw new Error(`log severity level is not valid: ${R}`);let F=T.logVerbosityLevel??0;if(!Number.isInteger(F)||F<0||F>4)throw new Error(`log verbosity level is not valid: ${F}`);let G=typeof T.optimizedModelFilePath=="string"?De(T.optimizedModelFilePath,E):0;if($=g._OrtCreateSessionOptions(B,!!T.enableCpuMemArena,!!T.enableMemPattern,z,!!T.enableProfiling,0,k,R,F,G),$===0&&re("Can't create session options."),T.executionProviders&&await Wi($,T,E),T.enableGraphCapture!==void 0){if(typeof T.enableGraphCapture!="boolean")throw new Error(`enableGraphCapture must be a boolean value: ${T.enableGraphCapture}`);at($,"enableGraphCapture",T.enableGraphCapture.toString(),E)}if(T.freeDimensionOverrides)for(let[L,D]of Object.entries(T.freeDimensionOverrides)){if(typeof L!="string")throw new Error(`free dimension override name must be a string: ${L}`);if(typeof D!="number"||!Number.isInteger(D)||D<0)throw new Error(`free dimension override value must be a non-negative integer: ${D}`);let J=De(L,E);g._OrtAddFreeDimensionOverride($,J,D)!==0&&re(`Can't set a free dimension override: ${L} - ${D}.`)}return T.extra!==void 0&&Kt(T.extra,"",new WeakSet,(L,D)=>{at($,L,D,E)}),[$,E]}catch(B){throw $!==0&&g._OrtReleaseSessionOptions($)!==0&&re("Can't release session options."),E.forEach(z=>g._free(z)),B}}}),ot,ut,lt,Er,kr,Ir,zr,Kr,oe=C(()=>{"use strict";ot=c=>{switch(c){case"int8":return 3;case"uint8":return 2;case"bool":return 9;case"int16":return 5;case"uint16":return 4;case"int32":return 6;case"uint32":return 12;case"float16":return 10;case"float32":return 1;case"float64":return 11;case"string":return 8;case"int64":return 7;case"uint64":return 13;case"int4":return 22;case"uint4":return 21;default:throw new Error(`unsupported data type: ${c}`)}},ut=c=>{switch(c){case 3:return"int8";case 2:return"uint8";case 9:return"bool";case 5:return"int16";case 4:return"uint16";case 6:return"int32";case 12:return"uint32";case 10:return"float16";case 1:return"float32";case 11:return"float64";case 8:return"string";case 7:return"int64";case 13:return"uint64";case 22:return"int4";case 21:return"uint4";default:throw new Error(`unsupported data type: ${c}`)}},lt=(c,g)=>{let $=[-1,4,1,1,2,2,4,8,-1,1,2,8,4,8,-1,-1,-1,-1,-1,-1,-1,.5,.5][c],E=typeof g=="number"?g:g.reduce((T,B)=>T*B,1);return $>0?Math.ceil(E*$):void 0},Er=c=>{switch(c){case"float16":return typeof Float16Array<"u"?Float16Array:Uint16Array;case"float32":return Float32Array;case"uint8":return Uint8Array;case"int8":return Int8Array;case"uint16":return Uint16Array;case"int16":return Int16Array;case"int32":return Int32Array;case"bool":return Uint8Array;case"float64":return Float64Array;case"uint32":return Uint32Array;case"int64":return BigInt64Array;case"uint64":return BigUint64Array;default:throw new Error(`unsupported type: ${c}`)}},kr=c=>{switch(c){case"verbose":return 0;case"info":return 1;case"warning":return 2;case"error":return 3;case"fatal":return 4;default:throw new Error(`unsupported logging level: ${c}`)}},Ir=c=>c==="float32"||c==="float16"||c==="int32"||c==="int64"||c==="uint32"||c==="uint8"||c==="bool"||c==="uint4"||c==="int4",zr=c=>c==="float32"||c==="float16"||c==="int32"||c==="int64"||c==="uint32"||c==="uint64"||c==="int8"||c==="uint8"||c==="bool"||c==="uint4"||c==="int4",Kr=c=>{switch(c){case"none":return 0;case"cpu":return 1;case"cpu-pinned":return 2;case"texture":return 3;case"gpu-buffer":return 4;case"ml-tensor":return 5;default:throw new Error(`unsupported data location: ${c}`)}}}),Cr,Hi=C(()=>{"use strict";fr(),Cr=async c=>{if(typeof c=="string"){let g=await fetch(c);if(!g.ok)throw new Error(`failed to load external data file: ${c}`);let $=g.headers.get("Content-Length"),E=$?parseInt($,10):0;if(E<1073741824)return new Uint8Array(await g.arrayBuffer());{if(!g.body)throw new Error(`failed to load external data file: ${c}, no response body.`);let T=g.body.getReader(),B;try{B=new ArrayBuffer(E)}catch(k){if(k instanceof RangeError){let R=Math.ceil(E/65536);B=new WebAssembly.Memory({initial:R,maximum:R}).buffer}else throw k}let z=0;for(;;){let{done:k,value:R}=await T.read();if(k)break;let F=R.byteLength;new Uint8Array(B,z,F).set(R),z+=F}return new Uint8Array(B,0,E)}}else return c instanceof Blob?new Uint8Array(await c.arrayBuffer()):c instanceof Uint8Array?c:new Uint8Array(c)}}),Ki,Zr,Qr,Ut,Xr,Yr,$e,ht,Jr,Nt,M,Jt,ei,Zi=C(()=>{"use strict";Ge(),dn(),pn(),oe(),st(),Tr(),Hi(),Ki=(c,g)=>{le()._OrtInit(c,g)!==0&&re("Can't initialize onnxruntime.")},Zr=async c=>{Ki(c.wasm.numThreads,kr(c.logLevel))},Qr=async(c,g)=>{le().asyncInit?.();let $=c.webgpu.adapter;if(g==="webgpu"){if(typeof navigator>"u"||!navigator.gpu)throw new Error("WebGPU is not supported in current environment");if($){if(typeof $.limits!="object"||typeof $.features!="object"||typeof $.requestDevice!="function")throw new Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.")}else{let E=c.webgpu.powerPreference;if(E!==void 0&&E!=="low-power"&&E!=="high-performance")throw new Error(`Invalid powerPreference setting: "${E}"`);let T=c.webgpu.forceFallbackAdapter;if(T!==void 0&&typeof T!="boolean")throw new Error(`Invalid forceFallbackAdapter setting: "${T}"`);if($=await navigator.gpu.requestAdapter({powerPreference:E,forceFallbackAdapter:T}),!$)throw new Error('Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are using Chrome.')}}if(g==="webnn"&&(typeof navigator>"u"||!navigator.ml))throw new Error("WebNN is not supported in current environment")},Ut=new Map,Xr=c=>{let g=le(),$=g.stackSave();try{let E=g.PTR_SIZE,T=g.stackAlloc(2*E);g._OrtGetInputOutputCount(c,T,T+E)!==0&&re("Can't get session input/output count.");let B=E===4?"i32":"i64";return[Number(g.getValue(T,B)),Number(g.getValue(T+E,B))]}finally{g.stackRestore($)}},Yr=(c,g)=>{let $=le(),E=$.stackSave(),T=0;try{let B=$.PTR_SIZE,z=$.stackAlloc(2*B);$._OrtGetInputOutputMetadata(c,g,z,z+B)!==0&&re("Can't get session input/output metadata.");let k=Number($.getValue(z,"*"));T=Number($.getValue(z+B,"*"));let R=$.HEAP32[T/4];if(R===0)return[k,0];let F=$.HEAPU32[T/4+1],G=[];for(let L=0;L<F;L++){let D=Number($.getValue(T+8+L*B,"*"));G.push(D!==0?$.UTF8ToString(D):Number($.getValue(T+8+(L+F)*B,"*")))}return[k,R,G]}finally{$.stackRestore(E),T!==0&&$._OrtFree(T)}},$e=c=>{let g=le(),$=g._malloc(c.byteLength);if($===0)throw new Error(`Can't create a session. failed to allocate a buffer of size ${c.byteLength}.`);return g.HEAPU8.set(c,$),[$,c.byteLength]},ht=async(c,g)=>{let $,E,T=le();Array.isArray(c)?[$,E]=c:c.buffer===T.HEAPU8.buffer?[$,E]=[c.byteOffset,c.byteLength]:[$,E]=$e(c);let B=0,z=0,k=0,R=[],F=[],G=[];try{if([z,R]=await ji(g),g?.externalData&&T.mountExternalData){let be=[];for(let K of g.externalData){let Pe=typeof K=="string"?K:K.path,Ze=typeof K=="string"?K:K.data;be.push(Cr(Ze).then(He=>{T.mountExternalData(Pe,He)}))}await Promise.all(be)}for(let be of g?.executionProviders??[])if((typeof be=="string"?be:be.name)==="webnn"){if(T.shouldTransferToMLTensor=!1,typeof be!="string"){let K=be,Pe=K?.context,Ze=K?.gpuDevice,He=K?.deviceType,Ft=K?.powerPreference;Pe?T.currentContext=Pe:Ze?T.currentContext=await T.webnnCreateMLContext(Ze):T.currentContext=await T.webnnCreateMLContext({deviceType:He,powerPreference:Ft})}else T.currentContext=await T.webnnCreateMLContext();break}B=await T._OrtCreateSession($,E,z),T.webgpuOnCreateSession?.(B),B===0&&re("Can't create a session."),T.jsepOnCreateSession?.(),T.currentContext&&(T.webnnRegisterMLContext(B,T.currentContext),T.currentContext=void 0,T.shouldTransferToMLTensor=!0);let[L,D]=Xr(B),J=!!g?.enableGraphCapture,A=[],j=[],Ce=[],ce=[],me=[];for(let be=0;be<L;be++){let[K,Pe,Ze]=Yr(B,be);K===0&&re("Can't get an input name."),F.push(K);let He=T.UTF8ToString(K);A.push(He),Ce.push(Pe===0?{name:He,isTensor:!1}:{name:He,isTensor:!0,type:ut(Pe),shape:Ze})}for(let be=0;be<D;be++){let[K,Pe,Ze]=Yr(B,be+L);K===0&&re("Can't get an output name."),G.push(K);let He=T.UTF8ToString(K);j.push(He),ce.push(Pe===0?{name:He,isTensor:!1}:{name:He,isTensor:!0,type:ut(Pe),shape:Ze})}return Ut.set(B,[B,F,G,null,J,!1]),[B,A,j,Ce,ce]}catch(L){throw F.forEach(D=>T._OrtFree(D)),G.forEach(D=>T._OrtFree(D)),k!==0&&T._OrtReleaseBinding(k)!==0&&re("Can't release IO binding."),B!==0&&T._OrtReleaseSession(B)!==0&&re("Can't release session."),L}finally{T._free($),z!==0&&T._OrtReleaseSessionOptions(z)!==0&&re("Can't release session options."),R.forEach(L=>T._free(L)),T.unmountExternalData?.()}},Jr=c=>{let g=le(),$=Ut.get(c);if(!$)throw new Error(`cannot release session. invalid session id: ${c}`);let[E,T,B,z,k]=$;z&&(k&&g._OrtClearBoundOutputs(z.handle)!==0&&re("Can't clear bound outputs."),g._OrtReleaseBinding(z.handle)!==0&&re("Can't release IO binding.")),g.jsepOnReleaseSession?.(c),g.webnnOnReleaseSession?.(c),g.webgpuOnReleaseSession?.(c),T.forEach(R=>g._OrtFree(R)),B.forEach(R=>g._OrtFree(R)),g._OrtReleaseSession(E)!==0&&re("Can't release session."),Ut.delete(c)},Nt=async(c,g,$,E,T,B,z=!1)=>{if(!c){g.push(0);return}let k=le(),R=k.PTR_SIZE,F=c[0],G=c[1],L=c[3],D=L,J,A;if(F==="string"&&(L==="gpu-buffer"||L==="ml-tensor"))throw new Error("String tensor is not supported on GPU.");if(z&&L!=="gpu-buffer")throw new Error(`External buffer must be provided for input/output index ${B} when enableGraphCapture is true.`);if(L==="gpu-buffer"){let ce=c[2].gpuBuffer;A=lt(ot(F),G);{let me=k.jsepRegisterBuffer;if(!me)throw new Error('Tensor location "gpu-buffer" is not supported without using WebGPU.');J=me(E,B,ce,A)}}else if(L==="ml-tensor"){let ce=c[2].mlTensor;A=lt(ot(F),G);let me=k.webnnRegisterMLTensor;if(!me)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');J=me(E,ce,ot(F),G)}else{let ce=c[2];if(Array.isArray(ce)){A=R*ce.length,J=k._malloc(A),$.push(J);for(let me=0;me<ce.length;me++){if(typeof ce[me]!="string")throw new TypeError(`tensor data at index ${me} is not a string`);k.setValue(J+me*R,De(ce[me],$),"*")}}else{let me=k.webnnIsGraphInput,be=k.webnnIsGraphOutput;if(F!=="string"&&me&&be){let K=k.UTF8ToString(T);if(me(E,K)||be(E,K)){let Pe=ot(F);A=lt(Pe,G),D="ml-tensor";let Ze=k.webnnCreateTemporaryTensor,He=k.webnnUploadTensor;if(!Ze||!He)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');let Ft=await Ze(E,Pe,G);He(Ft,new Uint8Array(ce.buffer,ce.byteOffset,ce.byteLength)),J=Ft}else A=ce.byteLength,J=k._malloc(A),$.push(J),k.HEAPU8.set(new Uint8Array(ce.buffer,ce.byteOffset,A),J)}else A=ce.byteLength,J=k._malloc(A),$.push(J),k.HEAPU8.set(new Uint8Array(ce.buffer,ce.byteOffset,A),J)}}let j=k.stackSave(),Ce=k.stackAlloc(4*G.length);try{G.forEach((me,be)=>k.setValue(Ce+be*R,me,R===4?"i32":"i64"));let ce=k._OrtCreateTensor(ot(F),J,A,Ce,G.length,Kr(D));ce===0&&re(`Can't create tensor for input/output. session=${E}, index=${B}.`),g.push(ce)}finally{k.stackRestore(j)}},M=async(c,g,$,E,T,B)=>{let z=le(),k=z.PTR_SIZE,R=Ut.get(c);if(!R)throw new Error(`cannot run inference. invalid session id: ${c}`);let F=R[0],G=R[1],L=R[2],D=R[3],J=R[4],A=R[5],j=g.length,Ce=E.length,ce=0,me=[],be=[],K=[],Pe=[],Ze=[],He=z.stackSave(),Ft=z.stackAlloc(j*k),ia=z.stackAlloc(j*k),di=z.stackAlloc(Ce*k),Je=z.stackAlloc(Ce*k);try{[ce,me]=qi(B),Xe("wasm prepareInputOutputTensor");for(let xe=0;xe<j;xe++)await Nt($[xe],be,Pe,c,G[g[xe]],g[xe],J);for(let xe=0;xe<Ce;xe++)await Nt(T[xe],K,Pe,c,L[E[xe]],j+E[xe],J);Ye("wasm prepareInputOutputTensor");for(let xe=0;xe<j;xe++)z.setValue(Ft+xe*k,be[xe],"*"),z.setValue(ia+xe*k,G[g[xe]],"*");for(let xe=0;xe<Ce;xe++)z.setValue(di+xe*k,K[xe],"*"),z.setValue(Je+xe*k,L[E[xe]],"*");z.jsepOnRunStart?.(F),z.webnnOnRunStart?.(F);let ft;ft=await z._OrtRun(F,ia,Ft,j,Je,Ce,di,ce),ft!==0&&re("failed to call OrtRun().");let wt=[],It=[];Xe("wasm ProcessOutputTensor");for(let xe=0;xe<Ce;xe++){let mt=Number(z.getValue(di+xe*k,"*"));if(mt===K[xe]||Ze.includes(K[xe])){wt.push(T[xe]),mt!==K[xe]&&z._OrtReleaseTensor(mt)!==0&&re("Can't release tensor.");continue}let xa=z.stackSave(),zt=z.stackAlloc(4*k),Mr=!1,Ue,et=0;try{z._OrtGetTensorData(mt,zt,zt+k,zt+2*k,zt+3*k)!==0&&re(`Can't access output tensor data on index ${xe}.`);let pi=k===4?"i32":"i64",Dr=Number(z.getValue(zt,pi));et=z.getValue(zt+k,"*");let aa=z.getValue(zt+k*2,"*"),gt=Number(z.getValue(zt+k*3,pi)),Ct=[];for(let Ne=0;Ne<gt;Ne++)Ct.push(Number(z.getValue(aa+Ne*k,pi)));z._OrtFree(aa)!==0&&re("Can't free memory for tensor dims.");let At=Ct.reduce((Ne,Be)=>Ne*Be,1);Ue=ut(Dr);let rr=D?.outputPreferredLocations[E[xe]];if(Ue==="string"){if(rr==="gpu-buffer"||rr==="ml-tensor")throw new Error("String tensor is not supported on GPU.");let Ne=[];for(let Be=0;Be<At;Be++){let $t=z.getValue(et+Be*k,"*"),Sa=z.getValue(et+(Be+1)*k,"*"),Ta=Be===At-1?void 0:Sa-$t;Ne.push(z.UTF8ToString($t,Ta))}wt.push([Ue,Ct,Ne,"cpu"])}else if(rr==="gpu-buffer"&&At>0){let Ne=z.jsepGetBuffer;if(!Ne)throw new Error('preferredLocation "gpu-buffer" is not supported without using WebGPU.');let Be=Ne(et),$t=lt(Dr,At);if($t===void 0||!Ir(Ue))throw new Error(`Unsupported data type: ${Ue}`);Mr=!0,wt.push([Ue,Ct,{gpuBuffer:Be,download:z.jsepCreateDownloader(Be,$t,Ue),dispose:()=>{z._OrtReleaseTensor(mt)!==0&&re("Can't release tensor.")}},"gpu-buffer"])}else if(rr==="ml-tensor"&&At>0){let Ne=z.webnnEnsureTensor,Be=z.webnnIsGraphInputOutputTypeSupported;if(!Ne||!Be)throw new Error('preferredLocation "ml-tensor" is not supported without using WebNN.');if(lt(Dr,At)===void 0||!zr(Ue))throw new Error(`Unsupported data type: ${Ue}`);if(!Be(c,Ue,!1))throw new Error(`preferredLocation "ml-tensor" for ${Ue} output is not supported by current WebNN Context.`);let $t=await Ne(c,et,Dr,Ct,!1);Mr=!0,wt.push([Ue,Ct,{mlTensor:$t,download:z.webnnCreateMLTensorDownloader(et,Ue),dispose:()=>{z.webnnReleaseTensorId(et),z._OrtReleaseTensor(mt)}},"ml-tensor"])}else if(rr==="ml-tensor-cpu-output"&&At>0){let Ne=z.webnnCreateMLTensorDownloader(et,Ue)(),Be=wt.length;Mr=!0,It.push((async()=>{let $t=[Be,await Ne];return z.webnnReleaseTensorId(et),z._OrtReleaseTensor(mt),$t})()),wt.push([Ue,Ct,[],"cpu"])}else{let Ne=Er(Ue),Be=new Ne(At);new Uint8Array(Be.buffer,Be.byteOffset,Be.byteLength).set(z.HEAPU8.subarray(et,et+Be.byteLength)),wt.push([Ue,Ct,Be,"cpu"])}}finally{z.stackRestore(xa),Ue==="string"&&et&&z._free(et),Mr||z._OrtReleaseTensor(mt)}}D&&!J&&(z._OrtClearBoundOutputs(D.handle)!==0&&re("Can't clear bound outputs."),Ut.set(c,[F,G,L,D,J,!1]));for(let[xe,mt]of await Promise.all(It))wt[xe][2]=mt;return Ye("wasm ProcessOutputTensor"),wt}finally{z.webnnOnRunEnd?.(F),z.stackRestore(He),be.forEach(ft=>z._OrtReleaseTensor(ft)),K.forEach(ft=>z._OrtReleaseTensor(ft)),Pe.forEach(ft=>z._free(ft)),ce!==0&&z._OrtReleaseRunOptions(ce),me.forEach(ft=>z._free(ft))}},Jt=c=>{let g=le(),$=Ut.get(c);if(!$)throw new Error("invalid session id");let E=$[0],T=g._OrtEndProfiling(E);T===0&&re("Can't get an profile file name."),g._OrtFree(T)},ei=c=>{let g=[];for(let $ of c){let E=$[2];!Array.isArray(E)&&"buffer"in E&&g.push(E.buffer)}return g}}),Et,ie,Lt,er,Zt,Ar,Or,Rr,kt,qt,ti,ri,ii,Qi,Xi,ba,tr,Yi,Ji=C(()=>{"use strict";Ge(),Zi(),st(),br(),Et=()=>!!de.wasm.proxy&&typeof document<"u",Lt=!1,er=!1,Zt=!1,Rr=new Map,kt=(c,g)=>{let $=Rr.get(c);$?$.push(g):Rr.set(c,[g])},qt=()=>{if(Lt||!er||Zt||!ie)throw new Error("worker not ready")},ti=c=>{switch(c.data.type){case"init-wasm":Lt=!1,c.data.err?(Zt=!0,Or[1](c.data.err)):(er=!0,Or[0]()),Ar&&(URL.revokeObjectURL(Ar),Ar=void 0);break;case"init-ep":case"copy-from":case"create":case"release":case"run":case"end-profiling":{let g=Rr.get(c.data.type);c.data.err?g.shift()[1](c.data.err):g.shift()[0](c.data.out);break}default:}},ri=async()=>{if(!er){if(Lt)throw new Error("multiple calls to 'initWasm()' detected.");if(Zt)throw new Error("previous call to 'initWasm()' failed.");if(Lt=!0,Et())return new Promise((c,g)=>{ie?.terminate(),Di().then(([$,E])=>{try{ie=E,ie.onerror=B=>g(B),ie.onmessage=ti,Or=[c,g];let T={type:"init-wasm",in:de};if(!T.in.wasm.wasmPaths&&$){let B=yr();B&&(T.in.wasm.wasmPaths=B)}ie.postMessage(T),Ar=$}catch(T){g(T)}},g)});try{await Sr(de.wasm),await Zr(de),er=!0}catch(c){throw Zt=!0,c}finally{Lt=!1}}},ii=async c=>{if(Et())return qt(),new Promise((g,$)=>{kt("init-ep",[g,$]);let E={type:"init-ep",in:{epName:c,env:de}};ie.postMessage(E)});await Qr(de,c)},Qi=async c=>Et()?(qt(),new Promise((g,$)=>{kt("copy-from",[g,$]);let E={type:"copy-from",in:{buffer:c}};ie.postMessage(E,[c.buffer])})):$e(c),Xi=async(c,g)=>{if(Et()){if(g?.preferredOutputLocation)throw new Error('session option "preferredOutputLocation" is not supported for proxy.');return qt(),new Promise(($,E)=>{kt("create",[$,E]);let T={type:"create",in:{model:c,options:{...g}}},B=[];c instanceof Uint8Array&&B.push(c.buffer),ie.postMessage(T,B)})}else return ht(c,g)},ba=async c=>{if(Et())return qt(),new Promise((g,$)=>{kt("release",[g,$]);let E={type:"release",in:c};ie.postMessage(E)});Jr(c)},tr=async(c,g,$,E,T,B)=>{if(Et()){if($.some(z=>z[3]!=="cpu"))throw new Error("input tensor on GPU is not supported for proxy.");if(T.some(z=>z))throw new Error("pre-allocated output tensor is not supported for proxy.");return qt(),new Promise((z,k)=>{kt("run",[z,k]);let R=$,F={type:"run",in:{sessionId:c,inputIndices:g,inputs:R,outputIndices:E,options:B}};ie.postMessage(F,ei(R))})}else return M(c,g,$,E,T,B)},Yi=async c=>{if(Et())return qt(),new Promise((g,$)=>{kt("end-profiling",[g,$]);let E={type:"end-profiling",in:c};ie.postMessage(E)});Jt(c)}}),ea,ai,ni,si=C(()=>{"use strict";Ge(),Ji(),oe(),fr(),Hi(),ea=(c,g)=>{switch(c.location){case"cpu":return[c.type,c.dims,c.data,"cpu"];case"gpu-buffer":return[c.type,c.dims,{gpuBuffer:c.gpuBuffer},"gpu-buffer"];case"ml-tensor":return[c.type,c.dims,{mlTensor:c.mlTensor},"ml-tensor"];default:throw new Error(`invalid data location: ${c.location} for ${g()}`)}},ai=c=>{switch(c[3]){case"cpu":return new Me(c[0],c[2],c[1]);case"gpu-buffer":{let g=c[0];if(!Ir(g))throw new Error(`not supported data type: ${g} for deserializing GPU tensor`);let{gpuBuffer:$,download:E,dispose:T}=c[2];return Me.fromGpuBuffer($,{dataType:g,dims:c[1],download:E,dispose:T})}case"ml-tensor":{let g=c[0];if(!zr(g))throw new Error(`not supported data type: ${g} for deserializing MLTensor tensor`);let{mlTensor:$,download:E,dispose:T}=c[2];return Me.fromMLTensor($,{dataType:g,dims:c[1],download:E,dispose:T})}default:throw new Error(`invalid data location: ${c[3]}`)}},ni=class{async fetchModelAndCopyToWasmMemory(c){return Qi(await Cr(c))}async loadModel(c,g){je();let $;typeof c=="string"?$=await this.fetchModelAndCopyToWasmMemory(c):$=c,[this.sessionId,this.inputNames,this.outputNames,this.inputMetadata,this.outputMetadata]=await Xi($,g),Ve()}async dispose(){return ba(this.sessionId)}async run(c,g,$){je();let E=[],T=[];Object.entries(c).forEach(L=>{let D=L[0],J=L[1],A=this.inputNames.indexOf(D);if(A===-1)throw new Error(`invalid input '${D}'`);E.push(J),T.push(A)});let B=[],z=[];Object.entries(g).forEach(L=>{let D=L[0],J=L[1],A=this.outputNames.indexOf(D);if(A===-1)throw new Error(`invalid output '${D}'`);B.push(J),z.push(A)});let k=E.map((L,D)=>ea(L,()=>`input "${this.inputNames[T[D]]}"`)),R=B.map((L,D)=>L?ea(L,()=>`output "${this.outputNames[z[D]]}"`):null),F=await tr(this.sessionId,T,k,z,R,$),G={};for(let L=0;L<F.length;L++)G[this.outputNames[z[L]]]=B[L]??ai(F[L]);return Ve(),G}startProfiling(){}endProfiling(){Yi(this.sessionId)}}}),Br={};ue(Br,{OnnxruntimeWebAssemblyBackend:()=>ui,initializeFlags:()=>oi,wasmBackend:()=>li});var oi,ui,li,ta=C(()=>{"use strict";Ge(),Ji(),si(),oi=()=>{(typeof de.wasm.initTimeout!="number"||de.wasm.initTimeout<0)&&(de.wasm.initTimeout=0);let c=de.wasm.simd;if(typeof c!="boolean"&&c!==void 0&&c!=="fixed"&&c!=="relaxed"&&(console.warn(`Property "env.wasm.simd" is set to unknown value "${c}". Reset it to \`false\` and ignore SIMD feature checking.`),de.wasm.simd=!1),typeof de.wasm.proxy!="boolean"&&(de.wasm.proxy=!1),typeof de.wasm.trace!="boolean"&&(de.wasm.trace=!1),typeof de.wasm.numThreads!="number"||!Number.isInteger(de.wasm.numThreads)||de.wasm.numThreads<=0)if(typeof self<"u"&&!self.crossOriginIsolated)de.wasm.numThreads=1;else{let g=typeof navigator>"u"?Z("node:os").cpus().length:navigator.hardwareConcurrency;de.wasm.numThreads=Math.min(4,Math.ceil((g||1)/2))}},ui=class{async init(c){oi(),await ri(),await ii(c)}async createInferenceSessionHandler(c,g){let $=new ni;return await $.loadModel(c,g),$}},li=new ui}),ra={};ue(ra,{InferenceSession:()=>hr,TRACE:()=>Pt,TRACE_EVENT_BEGIN:()=>Xe,TRACE_EVENT_END:()=>Ye,TRACE_FUNC_BEGIN:()=>je,TRACE_FUNC_END:()=>Ve,Tensor:()=>Me,default:()=>cn,env:()=>de,registerBackend:()=>ze}),Ge(),Ge(),Ge();var va="1.30.0",cn=Ii;{let c=(ta(),te(Br)).wasmBackend;ze("cpu",c,10),ze("wasm",c,10)}return Object.defineProperty(de.versions,"web",{value:va,enumerable:!0}),te(ra)})();typeof Gc=="object"&&typeof As=="object"&&(As.exports=mf)});var Hc=tt(Fe=>{"use strict";var gf=Fe&&Fe.__createBinding||(Object.create?(function(U,q,N,H){H===void 0&&(H=N);var Z=Object.getOwnPropertyDescriptor(q,N);(!Z||("get"in Z?!q.__esModule:Z.writable||Z.configurable))&&(Z={enumerable:!0,get:function(){return q[N]}}),Object.defineProperty(U,H,Z)}):(function(U,q,N,H){H===void 0&&(H=N),U[H]=q[N]})),yf=Fe&&Fe.__setModuleDefault||(Object.create?(function(U,q){Object.defineProperty(U,"default",{enumerable:!0,value:q})}):function(U,q){U.default=q}),_f=Fe&&Fe.__importStar||function(U){if(U&&U.__esModule)return U;var q={};if(U!=null)for(var N in U)N!=="default"&&Object.prototype.hasOwnProperty.call(U,N)&&gf(q,U,N);return yf(q,U),q};Object.defineProperty(Fe,"__esModule",{value:!0});Fe.MicVAD=Fe.getDefaultRealTimeVADOptions=Fe.ort=Fe.DEFAULT_MODEL=void 0;var wf=_f(Wc()),$f=qa(),Os=Ga(),vt=hi(),jr=ga(),jc=Ss(),bf=Es();Fe.DEFAULT_MODEL="legacy";Fe.ort=wf;var vf="vad.worklet.bundle.min.js",xf={legacy:"silero_vad_legacy.onnx",v5:"silero_vad_v5.onnx",v6:"silero_vad_v6.onnx"},Sf=U=>({...Os.defaultFrameProcessorOptions,onFrameProcessed:()=>{},onVADMisfire:()=>{vt.log.debug("VAD misfire")},onSpeechStart:()=>{vt.log.debug("Detected speech start")},onSpeechEnd:()=>{vt.log.debug("Detected speech end")},onSpeechRealStart:()=>{vt.log.debug("Detected real speech start")},baseAssetPath:"./",onnxWASMBasePath:"./",model:U,workletOptions:{},getStream:async()=>await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,autoGainControl:!0,noiseSuppression:!0}}),pauseStream:async q=>{q.getTracks().forEach(N=>{N.stop()})},resumeStream:async()=>await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,autoGainControl:!0,noiseSuppression:!0}}),ortConfig:q=>{q.env.logLevel="error"},startOnLoad:!0,processorType:"auto"});Fe.getDefaultRealTimeVADOptions=Sf;var Tf=U=>"audioWorklet"in U&&typeof AudioWorkletNode=="function"?"AudioWorklet":"ScriptProcessor";async function Ef(U,q,N,H,Z){await N.audioWorklet.addModule(U),q.processorOptions={...q.processorOptions??{},frameSamples:H};let C=new AudioWorkletNode(N,"vad-helper-worklet",q);return C.port.onmessage=async ue=>{let Se=ue.data;if(!(typeof Se=="object"&&Se&&"message"in Se)){console.error("Invalid message event",Se);return}switch(Se.message){case jr.Message.AudioFrame:{if(!("data"in Se&&Se.data instanceof ArrayBuffer)){console.log("Audio frame message has no data");return}let te=new Float32Array(Se.data);await Z(te);break}}},C}async function kf(U,q,N){let H=new bf.Resampler({nativeSampleRate:U.sampleRate,targetSampleRate:16e3,targetFrameSize:q});vt.log.debug("using script processor");let C=U.createScriptProcessor(4096,1,1),ue=!1;return C.onaudioprocess=async Se=>{if(!ue){ue=!0;try{let te=Se.inputBuffer.getChannelData(0);Se.outputBuffer.getChannelData(0).fill(0);let _e=H.process(te);for(let ze of _e)await N(ze)}catch(te){console.error("Error processing audio:",te)}finally{ue=!1}}},C.connect(U.destination),C}var Rs=class U{constructor(q,N,H,Z,C=!1,ue=null,Se=null,te=null,fe=null,_e=null,ze=null,rt="uninitialized",_t=!1){this.options=q,this.frameProcessor=N,this.model=H,this.frameSamples=Z,this.listening=C,this.errored=ue,this._stream=Se,this._audioContext=te,this._vadNode=fe,this._mediaStreamAudioSourceNode=_e,this._audioProcessorAdapterType=ze,this.initializationState=rt,this.ownsAudioContext=_t,this.getAudioInstances=()=>{if(this._stream===null||this._audioContext===null||this._vadNode==null||this._mediaStreamAudioSourceNode==null)throw new Error("MicVAD has null stream, audio context, or processor adapter");return{stream:this._stream,audioContext:this._audioContext,vadNode:this._vadNode,mediaStreamAudioSourceNode:this._mediaStreamAudioSourceNode}},this.setErrored=Ie=>{this.initializationState="errored",this.errored=Ie},this.start=async()=>{switch(this.initializationState){case"uninitialized":{vt.log.debug("initializing micVAD"),this.initializationState="initializing",this.frameProcessor.resume();try{this._stream=await this.options.getStream()}catch(Ie){throw Ie instanceof Error?this.setErrored(Ie.message):this.setErrored(String(Ie)),Ie}if(this.options.audioContext?(console.log("using custom audio context"),this._audioContext=this.options.audioContext):(console.log("using default audio context"),this._audioContext=new AudioContext,this.ownsAudioContext=!0),!this._audioContext)throw this.setErrored("Audio context is null"),Error("Audio context is null");switch(this._audioProcessorAdapterType=this.options.processorType=="auto"?Tf(this._audioContext):this.options.processorType,this._audioProcessorAdapterType){case"AudioWorklet":this._vadNode=await Ef(this.options.baseAssetPath+vf,this.options.workletOptions,this._audioContext,this.frameSamples,this.processFrame);break;case"ScriptProcessor":this._vadNode=await kf(this._audioContext,this.frameSamples,this.processFrame);break;default:throw new Error(`Unsupported audio processor adapter type: ${this._audioProcessorAdapterType}`)}this._mediaStreamAudioSourceNode=new MediaStreamAudioSourceNode(this._audioContext,{mediaStream:this._stream}),this._mediaStreamAudioSourceNode.connect(this._vadNode),vt.log.debug("started micVAD"),this.listening=!0,this.initializationState="initialized";break}case"initializing":{vt.log.warn("start called while initializing");break}case"initialized":{if(this.listening)return;this.listening=!0,this.frameProcessor.resume();let{stream:Ie,audioContext:xt,vadNode:ur}=this.getAudioInstances();this._stream=await this.options.resumeStream(Ie);let Hr=new MediaStreamAudioSourceNode(xt,{mediaStream:this._stream});this._mediaStreamAudioSourceNode=Hr,Hr.connect(ur);break}case"destroyed":{vt.log.warn("start called after destroyed");break}case"errored":{vt.log.error("start called after errored");break}default:{vt.log.warn("weird initialization state");break}}},this.pause=async()=>{if(!this.listening)return;this.listening=!1;let{stream:Ie,mediaStreamAudioSourceNode:xt}=this.getAudioInstances();await this.options.pauseStream(Ie),xt.disconnect(),this.frameProcessor.pause(this.handleFrameProcessorEvent)},this.destroy=async()=>{vt.log.debug("destroy called"),this.initializationState="destroyed";let{vadNode:Ie}=this.getAudioInstances();Ie instanceof AudioWorkletNode&&Ie.port.postMessage(jr.Message.SpeechStop),this.listening&&await this.pause(),await this.model.release(),this.ownsAudioContext&&await this._audioContext?.close()},this.setOptions=Ie=>{this.frameProcessor.setOptions(Ie)},this.processFrame=async Ie=>{await this.frameProcessor.process(Ie,this.handleFrameProcessorEvent)},this.handleFrameProcessorEvent=Ie=>{switch(Ie.msg){case jr.Message.FrameProcessed:this.options.onFrameProcessed(Ie.probs,Ie.frame);break;case jr.Message.SpeechStart:this.options.onSpeechStart();break;case jr.Message.SpeechRealStart:this.options.onSpeechRealStart();break;case jr.Message.VADMisfire:this.options.onVADMisfire();break;case jr.Message.SpeechEnd:this.options.onSpeechEnd(Ie.audio);break}}}static async new(q={}){let N={...(0,Fe.getDefaultRealTimeVADOptions)(q.model??Fe.DEFAULT_MODEL),...q};(0,Os.validateOptions)(N),Fe.ort.env.wasm.wasmPaths=N.onnxWASMBasePath,N.ortConfig!==void 0&&N.ortConfig(Fe.ort);let H=N.baseAssetPath+xf[N.model],Z=N.model==="legacy"?jc.SileroLegacy.new:jc.Silero.new,C;try{C=await Z(Fe.ort,()=>(0,$f.defaultModelFetcher)(H))}catch(_e){throw console.error(`Encountered an error while loading model file ${H}`),_e}let ue=N.model==="legacy"?1536:512,Se=ue/16,te=new Os.FrameProcessor(C.process,C.reset_state,{positiveSpeechThreshold:N.positiveSpeechThreshold,negativeSpeechThreshold:N.negativeSpeechThreshold,redemptionMs:N.redemptionMs,preSpeechPadMs:N.preSpeechPadMs,minSpeechMs:N.minSpeechMs,submitUserSpeechOnPause:N.submitUserSpeechOnPause},Se),fe=new U(N,te,C,ue);if(N.startOnLoad)try{await fe.start()}catch(_e){throw console.error("Error starting micVad",_e),_e}return fe}};Fe.MicVAD=Rs});var Rf=tt(We=>{Object.defineProperty(We,"__esModule",{value:!0});We.getDefaultRealTimeVADOptions=We.MicVAD=We.DEFAULT_MODEL=We.utils=We.NonRealTimeVAD=We.Message=We.FrameProcessor=We.defaultModelFetcher=We.baseAssetPath=void 0;var If=$s();Object.defineProperty(We,"baseAssetPath",{enumerable:!0,get:function(){return If.baseAssetPath}});var zf=qa();Object.defineProperty(We,"defaultModelFetcher",{enumerable:!0,get:function(){return zf.defaultModelFetcher}});var Cf=Ga();Object.defineProperty(We,"FrameProcessor",{enumerable:!0,get:function(){return Cf.FrameProcessor}});var Af=ga();Object.defineProperty(We,"Message",{enumerable:!0,get:function(){return Af.Message}});var Of=qc();Object.defineProperty(We,"NonRealTimeVAD",{enumerable:!0,get:function(){return Of.NonRealTimeVAD}});var Qa=Fc();We.utils={audioFileToArray:Qa.audioFileToArray,minFramesForTargetMS:Qa.minFramesForTargetMS,arrayBufferToBase64:Qa.arrayBufferToBase64,encodeWAV:Qa.encodeWAV};var Bs=Hc();Object.defineProperty(We,"DEFAULT_MODEL",{enumerable:!0,get:function(){return Bs.DEFAULT_MODEL}});Object.defineProperty(We,"MicVAD",{enumerable:!0,get:function(){return Bs.MicVAD}});Object.defineProperty(We,"getDefaultRealTimeVADOptions",{enumerable:!0,get:function(){return Bs.getDefaultRealTimeVADOptions}})});return Rf();})();
/*! Bundled license information:

onnxruntime-web/dist/ort.min.js:
  (*!
   * ONNX Runtime Web v1.30.0
   * Copyright (c) Microsoft Corporation. All rights reserved.
   * Licensed under the MIT License.
   *)
  (**
   * @license
   * Copyright 2021 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)
  (**
   * @license
   * Copyright 2020 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)
  (**
   * @license
   * Copyright 2019 Google LLC. All Rights Reserved.
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   * =============================================================================
   *)

onnxruntime-web/dist/ort.wasm.min.js:
  (*!
   * ONNX Runtime Web v1.30.0
   * Copyright (c) Microsoft Corporation. All rights reserved.
   * Licensed under the MIT License.
   *)
*/
