(function(){
'use strict';

const builtIns = [
 {id:'horde',name:'AI Horde — رایگان بدون کلید',protocol:'openai',endpoint:'https://oai.stablehorde.net/v1/chat/completions',auth:'bearer-public',header:'Authorization',model:'koboldcpp/Kunoichi-DPO-v2-7B-Q8_0-imatrix',template:'',responsePath:'choices.0.message.content',builtIn:true},
 {id:'openai',name:'OpenAI',protocol:'openai',endpoint:'https://api.openai.com/v1/chat/completions',auth:'bearer',header:'Authorization',model:'gpt-4o-mini',template:'',responsePath:'choices.0.message.content',builtIn:true},
 {id:'openrouter',name:'OpenRouter',protocol:'openai',endpoint:'https://openrouter.ai/api/v1/chat/completions',auth:'bearer',header:'Authorization',model:'openai/gpt-4o-mini',template:'',responsePath:'choices.0.message.content',builtIn:true},
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
 '<div class="notice">یک سرویس را فقط یک‌بار ثبت کن. بعد از آن، از داخل Provider هر Agent همان سرویس را انتخاب می‌کند. سرویس‌های وب‌سایتی که API قابل‌استفاده یا اجازه درخواست از مرورگر ندارند، ممکن است به backend نیاز داشته باشند.</div>'+
 '<div id="providerList" class="editor" style="max-height:220px;margin-top:10px"></div><hr style="border:0;border-top:1px solid var(--line);margin:16px 0">'+
 '<h3>سرویس جدید</h3>'+
 '<div class="two"><div class="field"><label>نام</label><input id="pmName" placeholder="مثلاً DeepSeek"></div><div class="field"><label>شناسه</label><input id="pmId" placeholder="مثلاً deepseek"></div></div>'+
 '<div class="two"><div class="field"><label>پروتکل</label><select id="pmProtocol"><option value="openai">OpenAI-compatible</option><option value="anthropic">Anthropic Messages</option><option value="gemini">Gemini generateContent</option><option value="generic">Custom JSON</option></select></div><div class="field"><label>احراز هویت</label><select id="pmAuth"><option value="none">بدون کلید</option><option value="bearer">Bearer</option><option value="x-api-key">x-api-key</option><option value="custom-header">Header سفارشی</option><option value="query">Query Parameter</option></select></div></div>'+
 '<div class="field"><label>Endpoint</label><input id="pmEndpoint" placeholder="https://api.example.com/..."></div>'+
 '<div class="two"><div class="field"><label>مدل پیش‌فرض</label><input id="pmModel" placeholder="نام مدل"></div><div class="field"><label>API Key</label><input type="password" id="pmKey" placeholder="در صورت نیاز"></div></div>'+
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
 if(state.providers.some(function(p){return p.id===id}))return alert('این شناسه قبلاً ثبت شده است.');
 state.providers.push({id:id,name:name,protocol:protocol,auth:auth,endpoint:endpoint,header:document.getElementById('pmHeader').value.trim(),query:document.getElementById('pmQuery').value.trim(),model:document.getElementById('pmModel').value.trim(),apiKey:document.getElementById('pmKey').value,template:document.getElementById('pmTemplate').value,responsePath:document.getElementById('pmResponse').value.trim()||'choices.0.message.content',builtIn:false});
 save();render();openModal();alert('سرویس اضافه شد. حالا آن را از Provider هر Agent انتخاب کن.');
}
function renderProviderMini(){
 const list=document.getElementById('providerList');
 if(list)list.innerHTML=state.providers.map(function(p){return '<div class="agent-row"><div class="agent-head"><strong>'+esc(p.name)+'</strong><span class="pill">'+esc(p.protocol)+'</span></div><div class="tiny">Endpoint: '+esc(p.endpoint)+'<br>احراز: '+esc(p.auth)+(p.builtIn?' · آماده':'')+'</div></div>';}).join('');
 const mini=document.getElementById('providerMiniList');if(mini)mini.innerHTML=state.providers.map(function(p){return '• '+esc(p.name);}).join('<br>');
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
 if(p.apiKey)a.apiKey=p.apiKey;
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

async function universalCallAgent(a,goal,transcript){
 const p=providerById(a.provider)||providerById('horde');
 if(!p)throw new Error('سرویس این Agent پیدا نشد.');
 const prompt='هدف تیم:\\n'+goal+'\\n\\nخروجی اعضای قبلی:\\n'+(transcript||'هنوز خروجی قبلی وجود ندارد.')+'\\n\\nاکنون فقط وظیفه نقش خودت را انجام بده و نتیجه مشخص و قابل استفاده تحویل بده.';
 let endpoint=(a.endpoint||p.endpoint||'').replace(/\\{\\{model\\}\\}/g,encodeURIComponent(a.model||p.model||''));
 let body={},headers={'Content-Type':'application/json'};
 if(p.protocol==='anthropic'){
  body={model:a.model||p.model,max_tokens:1200,system:a.system||('تو عضو تیم با نقش '+a.role+' هستی.'),messages:[{role:'user',content:prompt}]};
  headers['anthropic-version']=p.anthropicVersion||'2023-06-01';
 }else if(p.protocol==='gemini'){
  body={contents:[{parts:[{text:(a.system||('تو عضو تیم با نقش '+a.role+' هستی.'))+'\\n\\n'+prompt}]}]};
 }else if(p.protocol==='generic'){
  let raw=p.template||'{"model":"{{model}}","messages":[{"role":"system","content":"{{system}}"},{"role":"user","content":"{{prompt}}"}]}';
  raw=raw.replace(/\\{\\{model\\}\\}/g,a.model||p.model||'').replace(/\\{\\{system\\}\\}/g,(a.system||'').replace(/\\\\/g,'\\\\\\\\').replace(/"/g,'\\\\&quot;')).replace(/\\{\\{prompt\\}\\}/g,prompt.replace(/\\\\/g,'\\\\\\\\').replace(/"/g,'\\\\&quot;'));
  try{body=JSON.parse(raw.replace(/\\\\&quot;/g,'\\"'));}catch(e){throw new Error('JSON Template سرویس نامعتبر است.');}
 }else{
  body={model:a.model||p.model,messages:[{role:'system',content:a.system||('تو عضو تیم با نقش '+a.role+' هستی.')},{role:'user',content:prompt}],temperature:0.2};
 }
 const key=a.apiKey||p.apiKey||'';
 if(p.auth==='bearer'||p.auth==='bearer-public')headers['Authorization']='Bearer '+(p.auth==='bearer-public'?'0000000000':key);
 else if(p.auth==='x-api-key')headers['x-api-key']=key;
 else if(p.auth==='custom-header'&&p.header)headers[p.header]=key;
 else if(p.auth==='query'&&p.query)endpoint+=(endpoint.indexOf('?')>=0?'&':'?')+encodeURIComponent(p.query)+'='+encodeURIComponent(key);
 if(p.id==='openrouter')headers['HTTP-Referer']=location.origin;
 const controller=new AbortController(),timer=setTimeout(function(){controller.abort()},90000);
 try{
  const res=await fetch(endpoint,{method:'POST',headers:headers,body:JSON.stringify(body),signal:controller.signal});
  const raw=await res.text();let data={};try{data=JSON.parse(raw)}catch(e){}
  if(!res.ok)throw new Error((data.error&&data.error.message)||data.message||raw.slice(0,600)||('HTTP '+res.status));
  const path=p.responsePath||'choices.0.message.content';let out=data;path.split('.').forEach(function(k){if(out!=null)out=out[k]});
  if(Array.isArray(out))out=out.map(function(x){return typeof x==='string'?x:(x&&x.text)||''}).join('\\n');
  if(!out||typeof out!=='string')throw new Error('پاسخ مدل پیدا نشد؛ مسیر پاسخ را بررسی کن: '+path);
  return out;
 }catch(e){if(e.name==='AbortError')throw new Error('زمان پاسخ تمام شد.');throw e}finally{clearTimeout(timer)}
}

ensureProviders();wrapRender();makeModal();attachProviderButton();attachProviderChange();decorateProviderSelects();renderProviderMini();
window.callAgent=universalCallAgent;
})();
/* Live AI catalog: searchable online models + AI Horde free models. */
(function(){
'use strict';
const aliases=[
 ['کلاد','claude'],['کلود','claude'],['چت جی پی تی','gpt'],['چت‌جی‌پی‌تی','gpt'],['جمینای','gemini'],['جمنای','gemini'],
 ['گروک','grok'],['دیپ سیک','deepseek'],['دیپ‌سیک','deepseek'],['میسترال','mistral'],['لاما','llama'],['کویین','qwen'],['کیوئن','qwen'],
 ['کیمای','kimi'],['کیمی','kimi'],['کوپایلوت','copilot'],['کوهِر','cohere'],['کوهیر','cohere'],['لئاندرو','llama']
];
function norm(q){let x=(q||'').trim().toLowerCase();aliases.forEach(function(a){x=x.split(a[0]).join(a[1]);});return x;}
function ensureCatalogButton(){
 if(document.getElementById('aiCatalogBtn'))return;
 const p=document.getElementById('providersBtn');
 if(!p)return;
 const b=document.createElement('button');b.id='aiCatalogBtn';b.className='btn';b.textContent='🔎 جستجوی هوش مصنوعی';
 p.parentNode.insertBefore(b,p.nextSibling);
 b.onclick=openCatalog;
}
function ensureCatalogModal(){
 if(document.getElementById('aiCatalogModal'))return;
 const el=document.createElement('div');el.id='aiCatalogModal';
 el.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.74);z-index:1000;padding:16px;overflow:auto';
 el.innerHTML='<div class="card" style="max-width:900px;margin:25px auto;background:#121a2d">'+
  '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0">🔎 جستجوی هوش مصنوعی</h3><button class="icon-btn" id="aiCatClose">✕</button></div>'+
  '<div class="notice" style="margin-top:10px">فهرست آنلاین است و هنگام باز کردن از منابع زنده خوانده می‌شود. OpenRouter صدها مدل از ده‌ها ارائه‌دهنده را فهرست می‌کند؛ AI Horde نیز مدل‌های فعال رایگان را نشان می‌دهد.</div>'+
  '<div style="display:flex;gap:8px;margin-top:12px"><input id="aiCatSearch" placeholder="مثلاً Claude، Gemini، GPT، Grok، DeepSeek یا نام مدل..." style="flex:1"><button class="btn primary" style="width:auto;margin:0" id="aiCatRefresh">↻ به‌روزرسانی</button></div>'+
  '<div class="stats" id="aiCatStats"></div><div id="aiCatResults" class="editor" style="max-height:60vh;margin-top:10px"></div>'+
  '<div class="actions" style="margin-top:12px"><button class="btn" style="width:auto" id="aiCatClose2">بستن</button></div></div>';
 document.body.appendChild(el);
 document.getElementById('aiCatClose').onclick=closeCatalog;document.getElementById('aiCatClose2').onclick=closeCatalog;
 document.getElementById('aiCatSearch').oninput=filterCatalog;document.getElementById('aiCatRefresh').onclick=loadCatalog;
}
let catalog=[];
function openCatalog(){ensureCatalogModal();document.getElementById('aiCatalogModal').style.display='block';loadCatalog();}
function closeCatalog(){const x=document.getElementById('aiCatalogModal');if(x)x.style.display='none';}
async function loadCatalog(){
 const box=document.getElementById('aiCatResults'),stats=document.getElementById('aiCatStats');
 if(!box)return;box.innerHTML='<div class="empty">در حال دریافت فهرست زنده...</div>';stats.innerHTML='';
 const results=[];
 try{
  const r=await fetch('https://openrouter.ai/api/v1/models',{headers:{Accept:'application/json'}});
  if(r.ok){
   const j=await r.json();
   (j.data||[]).forEach(function(m){results.push({source:'OpenRouter',kind:'model',id:m.id,name:m.name||m.id,desc:m.description||'',model:m.id,context:m.context_length||0,free:String(m.pricing&&m.pricing.prompt)==='0'&&String(m.pricing&&m.pricing.completion)==='0',provider:'openrouter'});});
  }
 }catch(e){}
 try{
  const r=await fetch('https://aihorde.net/api/v2/status/models',{headers:{Accept:'application/json'}});
  if(r.ok){
   const arr=await r.json();
   (Array.isArray(arr)?arr:[]).forEach(function(m){results.push({source:'AI Horde',kind:'free-model',id:'horde:'+m.name,name:m.name,desc:'مدل فعال در AI Horde',model:m.name,context:0,free:true,provider:'horde'});});
  }
 }catch(e){}
 if(!results.length){box.innerHTML='<div class="empty">فهرست آنلاین دریافت نشد. اتصال اینترنت مرورگر را بررسی کن.</div>';return;}
 const seen=new Set();catalog=results.filter(function(x){if(seen.has(x.id))return false;seen.add(x.id);return true;});
 stats.innerHTML='<span class="pill">'+catalog.length+' مورد پیدا شد</span><span class="pill">OpenRouter + AI Horde</span>';
 filterCatalog();
}
function filterCatalog(){
 const q=norm(document.getElementById('aiCatSearch')?.value||'');
 const box=document.getElementById('aiCatResults');if(!box)return;
 let list=catalog.filter(function(x){const hay=norm([x.name,x.id,x.desc,x.source].join(' '));return !q||hay.includes(q);}).slice(0,120);
 if(!list.length){box.innerHTML='<div class="empty">موردی پیدا نشد.</div>';return;}
 box.innerHTML=list.map(function(x){
  const safe=encodeURIComponent(JSON.stringify({id:x.id,name:x.name,model:x.model,provider:x.provider,free:x.free}));
  return '<div class="agent-row"><div class="agent-head"><strong>'+esc(x.name)+'</strong><span class="pill">'+(x.free?'رایگان':'آنلاین')+' · '+esc(x.source)+'</span></div>'+
   '<div class="tiny">'+esc(x.id)+(x.context?' · context '+Number(x.context).toLocaleString():'')+'<br>'+esc((x.desc||'').slice(0,260))+'</div>'+
   '<button class="btn primary" style="margin-top:8px" data-ai-add="'+safe+'">＋ افزودن به تیم</button></div>';
 }).join('');
 box.querySelectorAll('[data-ai-add]').forEach(function(b){b.onclick=function(){addCatalogAgent(JSON.parse(decodeURIComponent(b.dataset.aiAdd)));};});
}
function addCatalogAgent(x){
 const p=providerById(x.provider);
 if(!p){alert('Provider این سرویس در پروژه موجود نیست.');return;}
 const agent={
  id:uid(),name:x.name,role:'عامل هوش مصنوعی',icon:x.provider==='horde'?'🆓':'🤖',
  provider:x.provider,endpoint:p.endpoint,model:x.model,apiKey:p.apiKey||'',
  system:'تو یک عامل متخصص در تیم AI Teams هستی. نقش خودت را دقیق انجام بده و خروجی قابل استفاده به عامل بعدی تحویل بده.',enabled:true
 };
 state.agents.push(agent);save();render();renderProviderMini();
 alert(x.name+' به تیم اضافه شد.');
}
ensureCatalogButton();ensureCatalogModal();
})();
