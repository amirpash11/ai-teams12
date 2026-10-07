(function(){
'use strict';

const builtIns = [
 {id:'horde',name:'AI Horde — رایگان بدون کلید',protocol:'openai',endpoint:'https://oai.aihorde.net/v1/chat/completions',auth:'bearer-public',header:'Authorization',model:'koboldcpp/Kunoichi-DPO-v2-7B-Q8_0-imatrix',template:'',responsePath:'choices.0.message.content',builtIn:true},
 {id:'openai',name:'OpenAI',protocol:'openai',endpoint:'https://api.openai.com/v1/chat/completions',auth:'bearer',header:'Authorization',model:'gpt-4o-mini',template:'',responsePath:'choices.0.message.content',builtIn:true},
 {id:'openrouter',name:'OpenRouter',protocol:'openai',endpoint:'https://openrouter.ai/api/v1/chat/completions',auth:'bearer',header:'Authorization',model:'openrouter/free',template:'',responsePath:'choices.0.message.content',builtIn:true},
 {id:'custom',name:'Custom',protocol:'generic',endpoint:'',auth:'bearer',header:'Authorization',model:'',template:'{"model":"{{model}}","messages":[{"role":"system","content":"{{system}}"},{"role":"user","content":"{{prompt}}"}]}',responsePath:'choices.0.message.content',builtIn:true},
 {id:'claude',name:'Claude (Anthropic)',protocol:'anthropic',endpoint:'https://api.anthropic.com/v1/messages',auth:'x-api-key',header:'x-api-key',model:'claude-sonnet-4-5',template:'',responsePath:'content.0.text',anthropicVersion:'2023-06-01',builtIn:true},
 {id:'gemini',name:'Gemini',protocol:'gemini',endpoint:'https://generativelanguage.googleapis.com/v1beta/models/{{model}}:generateContent',auth:'custom-header',header:'x-goog-api-key',model:'gemini-2.5-flash',template:'',responsePath:'candidates.0.content.parts.0.text',builtIn:true}
]

function ensureProviders(){
 if(!state.providers) state.providers=[];
 builtIns.forEach(function(b){if(!state.providers.some(function(p){return p.id===b.id;}))state.providers.push(Object.assign({},b));});
 save();
}
function providerById(id){return state.providers.find(function(p){return p.id===id;});}
function providerOptions(a){
 return state.providers.map(function(p){
  return '<option value="'+esc(p.id)+'" '+(a.provider===p.id?'selected':'')+'>'+esc(p.name)+'</option>';
 }).join('');
}
function decorateProviderSelects(){
 document.querySelectorAll('#editor select[data-k="provider"]').forEach(function(sel){
  const aid=sel.dataset.id, a=state.agents.find(function(x){return x.id===aid;});
  if(!a)return;
  const current=a.provider;
  sel.innerHTML=providerOptions(a);
  sel.value=current;
 });
}
function wrapRender(){
 if(window.__aiTeamsProviderRenderWrapped)return;
 const originalRender=render;
 render=function(){originalRender();decorateProviderSelects();renderProviderMini();};
 window.__aiTeamsProviderRenderWrapped=true;
}
function renderProviderMini(){
 const el=document.getElementById('providerMiniList');
 if(el)el.innerHTML=state.providers.map(function(p){return '• '+esc(p.name);}).join('<br>');
 const modal=document.getElementById('providerList');
 if(modal)modal.innerHTML=state.providers.map(function(p){
  return '<div class="agent-row"><div class="agent-head"><strong>'+esc(p.name)+'</strong><span class="pill">'+esc(p.protocol)+'</span></div><div class="tiny">Endpoint: '+esc(p.endpoint)+'<br>احراز: '+esc(p.auth)+(p.builtIn?' · آماده':'')+'</div></div>';
 }).join('');
}
function makeModal(){
 if(document.getElementById('providerModal2'))return;
 const wrap=document.createElement('div');
 wrap.id='providerModal2';
 wrap.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:999;padding:18px;overflow:auto';
 wrap.innerHTML='<div class="card" style="max-width:760px;margin:35px auto;background:#121a2d">'+
 '<div style="display:flex;justify-content:space-between;align-items:center"><h3>مدیریت و افزودن سرویس</h3><button class="icon-btn" id="pmClose">✕</button></div>'+
 '<div id="providerSecureStatus" class="notice warn" style="margin-bottom:10px">در حال بررسی اتصال امن...</div><div class="notice">یک سرویس را فقط یک‌بار ثبت کن. بعد از آن، از داخل Provider هر Agent همان سرویس را انتخاب می‌کند. سرویس‌های وب‌سایتی که API قابل‌استفاده یا اجازه درخواست از مرورگر ندارند، ممکن است به backend نیاز داشته باشند.</div>'+
 '<div id="providerList" class="editor" style="max-height:220px;margin-top:10px"></div><hr style="border:0;border-top:1px solid var(--line);margin:16px 0">'+
 '<h3>سرویس جدید</h3>'+
 '<div class="two"><div class="field"><label>نام</label><input id="pmName" placeholder="مثلاً DeepSeek"></div><div class="field"><label>شناسه</label><input id="pmId" placeholder="مثلاً deepseek"></div></div>'+
 '<div class="two"><div class="field"><label>پروتکل</label><select id="pmProtocol"><option value="openai">OpenAI-compatible</option><option value="anthropic">Anthropic Messages</option><option value="gemini">Gemini generateContent</option><option value="generic">Custom JSON</option></select></div><div class="field"><label>احراز هویت</label><select id="pmAuth"><option value="none">بدون کلید</option><option value="bearer">Bearer</option><option value="x-api-key">x-api-key</option><option value="custom-header">Header سفارشی</option><option value="query">Query Parameter</option></select></div></div>'+
 '<div class="field"><label>Endpoint</label><input id="pmEndpoint" placeholder="https://api.example.com/..."></div>'+
 '<div class="two"><div class="field"><label>مدل پیش‌فرض</label><input id="pmModel" placeholder="نام مدل"></div><div class="field"><label>API Key</label><input type="password" id="pmKey" autocomplete="new-password" placeholder="فقط برای تنظیم Gateway امن"></div></div><div class="notice warn" style="margin-bottom:10px">برای امنیت، کلید API داخل localStorage ذخیره نمی‌شود و از مرورگر مستقیماً به Providerهای پولی ارسال نمی‌شود. کلید سرویس پولی باید در Gateway امن تنظیم شود.</div>'+
 '<div class="two"><div class="field"><label>Header سفارشی</label><input id="pmHeader" placeholder="X-API-Key"></div><div class="field"><label>Query Parameter</label><input id="pmQuery" placeholder="key"></div></div>'+
 '<div class="field"><label>JSON Template برای Custom JSON</label><textarea id="pmTemplate" placeholder="{&quot;model&quot;:&quot;{{model}}&quot;,&quot;messages&quot;:[{&quot;role&quot;:&quot;user&quot;,&quot;content&quot;:&quot;{{prompt}}&quot;}]}"></textarea></div>'+
 '<div class="field"><label>مسیر پاسخ</label><input id="pmResponse" placeholder="choices.0.message.content"></div>'+
 '<div class="actions"><button class="btn primary" style="width:auto" id="pmAdd">＋ افزودن</button><button class="btn" style="width:auto" id="pmClose2">بستن</button></div></div>';
 document.body.appendChild(wrap);
 document.getElementById('pmClose').onclick=closeModal;
 document.getElementById('pmClose2').onclick=closeModal;
 document.getElementById('pmAdd').onclick=addProvider;
}
function openModal(){makeModal();renderProviderMini();document.getElementById('providerModal2').style.display='block';}
function closeModal(){const el=document.getElementById('providerModal2');if(el)el.style.display='none';}
function addProvider(){
 const name=document.getElementById('pmName').value.trim();
 const id=(document.getElementById('pmId').value.trim()||name.toLowerCase().replace(/[^a-z0-9]+/g,'-')).replace(/^-+|-+$/g,'');
 const protocol=document.getElementById('pmProtocol').value, auth=document.getElementById('pmAuth').value, endpoint=document.getElementById('pmEndpoint').value.trim();
 if(!name||!id||!endpoint)return alert('نام، شناسه و Endpoint را کامل کن.');
 if(!/^https:\/\/[^\s]+$/i.test(endpoint))return alert('Endpoint باید یک آدرس HTTPS معتبر باشد.');
 if(state.providers.some(function(p){return p.id===id}))return alert('این شناسه قبلاً ثبت شده است.');
 state.providers.push({id:id,name:name,protocol:protocol,auth:auth,endpoint:endpoint,header:document.getElementById('pmHeader').value.trim(),query:document.getElementById('pmQuery').value.trim(),model:document.getElementById('pmModel').value.trim(),template:document.getElementById('pmTemplate').value,responsePath:document.getElementById('pmResponse').value.trim()||'choices.0.message.content',builtIn:false});
 save();render();openModal();alert('سرویس اضافه شد. حالا آن را از Provider هر Agent انتخاب کن.');
}

function attachProviderButton(){
 let btn=document.getElementById('providersBtn');
 if(!btn){
  const sidebar=document.querySelector('.sidebar');
  if(!sidebar)return;
  btn=document.createElement('button');btn.id='providersBtn';btn.className='btn';btn.textContent='⚙ مدیریت و افزودن سرویس';sidebar.insertBefore(btn,sidebar.querySelector('.section-title:last-of-type'));
  const mini=document.createElement('div');mini.id='providerMiniList';mini.className='tiny';mini.style.marginTop='8px';sidebar.insertBefore(mini,sidebar.querySelector('.section-title:last-of-type'));
 }
 btn.onclick=openModal;
}
function syncAgentFromProvider(id){
 const a=state.agents.find(function(x){return x.id===id});if(!a)return;
 const p=providerById(a.provider);if(!p)return;
 if(p.endpoint)a.endpoint=p.endpoint;
 if(p.model)a.model=p.model;
 // API keys are intentionally never copied into the browser-side Agent state.
 save();
}
function attachProviderChange(){
 if(window.__aiTeamsProviderChangeAttached)return;
 document.addEventListener('change',function(e){
  if(e.target.matches('#editor select[data-k="provider"]')){
   const id=e.target.dataset.id;
   const a=state.agents.find(function(x){return x.id===id});
   if(a){a.provider=e.target.value;syncAgentFromProvider(id);render();}
  }
 });
 window.__aiTeamsProviderChangeAttached=true;
}

async function universalCallAgent(a,goal,transcript,signal){
 const p=providerById(a.provider)||providerById('horde');
 if(!p)throw new Error('سرویس این Agent پیدا نشد.');
 const prompt='هدف تیم:\\n'+goal+'\\n\\nخروجی اعضای قبلی:\\n'+(transcript||'هنوز خروجی قبلی وجود ندارد.')+'\\n\\nاکنون فقط وظیفه نقش خودت را انجام بده و نتیجه مشخص و قابل استفاده تحویل بده.';
 const messages=[
  {role:'system',content:a.system||('تو عضو تیم با نقش '+a.role+' هستی.')},
  {role:'user',content:prompt}
 ];
 if(p.id!=='horde'){
  if(!window.aiTeamsCloud||!window.aiTeamsCloud.isReady())throw new Error('اتصال امن فعال نیست. برای Providerهای غیررایگان ابتدا وارد حساب ذخیره‌سازی ابری شوید و کلید Provider را در Supabase Edge Function تنظیم کنید.');
  const data=await window.aiTeamsCloud.invokeAI({
   provider:p.id,model:a.model||p.model,messages:messages,system:a.system||('تو عضو تیم با نقش '+a.role+' هستی.'),
   endpoint:p.id==='custom'?(a.endpoint||p.endpoint||''):undefined,temperature:0.2,referer:location.origin
  });
  return data.output;
 }
 const hordeEndpoints=['https://oai.aihorde.net/v1/chat/completions'];
 const hordeDirect='https://aihorde.net/api/v2/generate/text/async';
 const hordeStatus='https://aihorde.net/api/v2/generate/text/status/';
 if(a.endpoint&&hordeEndpoints.indexOf(a.endpoint)<0&&a.endpoint!=='https://aihorde.net/api/v2/generate/text/async')throw new Error('برای AI Horde فقط Endpointهای رسمی مجاز هستند.');
 let models=Array.isArray(state.hordeModels)?state.hordeModels.filter(Boolean):[];
 const modelCacheFresh=Number(state.hordeModelsFetchedAt||0)>0&&(Date.now()-Number(state.hordeModelsFetchedAt||0)<10*60*1000);
 try{
  if(modelCacheFresh&&models.length)throw new Error('cached');
  const mr=await fetch('https://oai.aihorde.net/v1/models',{headers:{'Authorization':'Bearer 0000000000','X-Client':'AI-Teams'},cache:'no-store',signal:signal});
  if(mr.ok){const mj=await mr.json();const live=Array.isArray(mj.data)?mj.data.map(x=>x&&x.id?String(x.id):'').filter(Boolean):[];if(live.length){models=live.slice(0,200);state.hordeModels=models;state.hordeModelsFetchedAt=Date.now();}}
 }catch(e){}
 if(!models.length&&a.model)models=[a.model];
 if(!models.length&&p.model)models=[p.model];
 const candidates=[];if(a.model&&models.indexOf(a.model)>=0)candidates.push(a.model);
 models.forEach(function(m){if(candidates.indexOf(m)<0&&/llama|qwen|mistral|gemma|deepseek|phi|hermes/i.test(m))candidates.push(m)});
 models.forEach(function(m){if(candidates.indexOf(m)<0)candidates.push(m)});
 let lastError=null;
 const headers={'Content-Type':'application/json','Authorization':'Bearer 0000000000','X-Client':'AI-Teams'};
 const hordePrompt=messages.map(function(m){return String(m.role||'user').toUpperCase()+': '+String(m.content||'');}).join('\n\n');
 async function directHorde(model){
   const controller=(window.aiTeamsTrackController?window.aiTeamsTrackController():new AbortController());
   const requestSignal=controller.signal;
   let id='';
   let abortHandler=null;
   const timer=setTimeout(function(){controller.abort()},90000);
   const wait=function(ms){
     return new Promise(function(resolve,reject){
       let done=false;
       const finish=function(fn,value){if(done)return;done=true;clearTimeout(t);if(requestSignal)requestSignal.removeEventListener('abort',onAbort);fn(value);};
       const onAbort=function(){const e=new DOMException('The operation was aborted.','AbortError');finish(reject,e);};
       const t=setTimeout(function(){finish(resolve)},ms);
       if(requestSignal)requestSignal.addEventListener('abort',onAbort,{once:true});
       if(requestSignal.aborted)onAbort();
     });
   };
   try{
     if(signal){
       if(signal.aborted){controller.abort();throw new DOMException('The operation was aborted.','AbortError');}
       abortHandler=function(){controller.abort()};
       signal.addEventListener('abort',abortHandler,{once:true});
     }
     const submit=await fetch(hordeDirect,{method:'POST',headers:{'Content-Type':'application/json','apikey':'0000000000','Client-Agent':'AI-Teams/1.0'},body:JSON.stringify({prompt:hordePrompt,params:{max_context_length:4096,max_length:256,temperature:0.2,top_p:0.95},models:[model]}),signal:requestSignal});
     const raw=await submit.text();let data={};try{data=JSON.parse(raw)}catch(e){}
     if(!submit.ok)throw new Error((data.message||data.error||raw.slice(0,600)||('HTTP '+submit.status)));
     id=String(data.id||'');if(!id)throw new Error('AI Horde شناسه درخواست برنگرداند.');
     const deadline=Date.now()+85000;
     while(Date.now()<deadline){
       await wait(2500);
       const st=await fetch(hordeStatus+encodeURIComponent(id),{headers:{'apikey':'0000000000','Client-Agent':'AI-Teams/1.0'},cache:'no-store',signal:requestSignal});
       const sr=await st.text();let sd={};try{sd=JSON.parse(sr)}catch(e){}
       if(!st.ok)continue;
       if(sd.done){
         const out=sd.generations&&sd.generations[0]&&sd.generations[0].text;
         if(typeof out==='string'&&out.trim())return out;
         throw new Error('AI Horde درخواست را تکمیل کرد اما متن برنگرداند.');
       }
       if(sd.faulted)throw new Error('AI Horde اجرای درخواست را ناموفق اعلام کرد.');
     }
     throw new Error('زمان انتظار AI Horde تمام شد.');
   }finally{
     clearTimeout(timer);
     if(signal&&abortHandler)signal.removeEventListener('abort',abortHandler);
     if(window.aiTeamsReleaseController)window.aiTeamsReleaseController(controller);
     if(id){fetch('https://aihorde.net/api/v2/generate/text/status/'+encodeURIComponent(id),{method:'DELETE',headers:{'apikey':'0000000000','Client-Agent':'AI-Teams/1.0'},keepalive:true}).catch(function(){})}
   }
 }
 for(let attempt=1;attempt<=Math.min(3,candidates.length||1);attempt++){
  const model=String(candidates[attempt-1]||'').trim();if(!model)continue;a.model=model;a.endpoint=hordeDirect;
  try{const out=await directHorde(model);save();return out;}catch(err){lastError=err;if(err.name==='AbortError')throw err;}
 }
 // Last-resort OpenAI-compatible proxy; it is useful when the direct queue is unavailable.
 for(let attempt=1;attempt<=Math.min(2,candidates.length||1);attempt++){
  const model=String(candidates[attempt-1]||'').trim();if(!model)continue;a.model=model;a.endpoint=hordeEndpoints[0];
  const controller=new AbortController();
  let abortHandler=null;
  const timer=setTimeout(function(){controller.abort()},90000);
  try{
   if(signal){
    if(signal.aborted){controller.abort();throw new DOMException('The operation was aborted.','AbortError');}
    abortHandler=function(){controller.abort()};
    signal.addEventListener('abort',abortHandler,{once:true});
   }
   const res=await fetch(hordeEndpoints[0],{method:'POST',headers:headers,body:JSON.stringify({model:model,messages:messages,temperature:0.2}),signal:controller.signal});
   const raw=await res.text();let data={};try{data=JSON.parse(raw)}catch(e){}
   if(!res.ok){lastError=new Error((data.error&&data.error.message)||data.message||raw.slice(0,600)||('HTTP '+res.status));}
   else{const out=data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content;const textOut=data.choices&&data.choices[0]&&data.choices[0].text;if(typeof out==='string'&&out.trim()){save();return out;}if(typeof textOut==='string'&&textOut.trim()){save();return textOut;}lastError=new Error('پاسخ مدل پیدا نشد.');}
  }catch(err){lastError=err.name==='AbortError'?new Error('زمان پاسخ تمام شد.'):err;}
  finally{clearTimeout(timer);if(signal&&abortHandler)signal.removeEventListener('abort',abortHandler)}
 }
 throw lastError||new Error('اتصال به AI Horde ناموفق بود.');
}
function secureProviderStatus(){
 const el=document.getElementById('providerSecureStatus');
 if(!el)return;
 if(window.aiTeamsCloud&&window.aiTeamsCloud.isReady()){
  el.textContent='🔐 اتصال امن فعال است؛ کلید Providerهای پولی از مرورگر ارسال نمی‌شود.';
  el.className='notice';
 }else{
  el.textContent='🔐 برای Providerهای پولی، ورود به حساب ابری و تنظیم کلید در Supabase لازم است. AI Horde همچنان بدون کلید کار می‌کند.';
  el.className='notice warn';
 }
}

ensureProviders();wrapRender();makeModal();attachProviderButton();attachProviderChange();decorateProviderSelects();renderProviderMini();setTimeout(secureProviderStatus,700);
window.aiTeamsUniversalCallAgent=universalCallAgent;
if(typeof window.callAgent!=='function')window.callAgent=universalCallAgent;
window.aiTeamsEnsureProviders=ensureProviders;
window.aiTeamsCore={getState:function(){return state;},save:save,render:render,esc:esc,providerById:providerById,importState:window.aiTeamsImportState};
})();
