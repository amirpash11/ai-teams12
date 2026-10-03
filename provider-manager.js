(function(){
'use strict';

const builtIns = [
 {id:'claude',name:'Claude (Anthropic)',protocol:'anthropic',endpoint:'https://api.anthropic.com/v1/messages',auth:'x-api-key',header:'x-api-key',model:'claude-sonnet-4-5',template:'',responsePath:'content.0.text',anthropicVersion:'2023-06-01',builtIn:true},
 {id:'gemini',name:'Gemini',protocol:'gemini',endpoint:'https://generativelanguage.googleapis.com/v1beta/models/{{model}}:generateContent',auth:'custom-header',header:'x-goog-api-key',model:'gemini-2.5-flash',template:'',responsePath:'candidates.0.content.parts.0.text',builtIn:true}
];

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