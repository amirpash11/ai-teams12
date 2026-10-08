
const KEY='ai-teams12-state-v2';
const OLD_KEY='ai-teams12-state-v1';

function uid(){return (crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now()+Math.random())}
function defaults(){
 return {
  version:2,teamName:'تیم هوش مصنوعی من',
  goal:'یک ایده نرم‌افزاری را تحلیل کن، راه‌حل طراحی کن و یک برنامه اجرای مرحله‌ای بده.',
  mode:'real',
  agents:[
   {id:uid(),name:'تحلیل‌گر',role:'تحلیل نیازمندی‌ها',icon:'🧠',provider:'horde',endpoint:'https://oai.aihorde.net/v1/chat/completions',model:'koboldcpp/Kunoichi-DPO-v2-7B-Q8_0-imatrix',system:'تو تحلیل‌گر تیم هستی. هدف را دقیق به نیازمندی‌ها، فرضیات، ریسک‌ها و خروجی‌های قابل اجرا تبدیل کن.',enabled:true},
   {id:uid(),name:'طراح',role:'طراحی راه‌حل',icon:'🎨',provider:'horde',endpoint:'https://oai.aihorde.net/v1/chat/completions',model:'koboldcpp/Kunoichi-DPO-v2-7B-Q8_0-imatrix',system:'تو طراح راه‌حل هستی. با توجه به هدف و تحلیل قبلی، معماری، جریان کار و اجزای لازم را پیشنهاد بده.',enabled:true},
   {id:uid(),name:'برنامه‌نویس',role:'پیاده‌سازی فنی',icon:'💻',provider:'horde',endpoint:'https://oai.aihorde.net/v1/chat/completions',model:'koboldcpp/Kunoichi-DPO-v2-7B-Q8_0-imatrix',system:'تو برنامه‌نویس ارشد تیم هستی. طرح را به مراحل فنی، ساختار فایل‌ها و کد قابل پیاده‌سازی تبدیل کن.',enabled:true},
   {id:uid(),name:'منتقد',role:'بازبینی و کشف ایراد',icon:'🔎',provider:'horde',endpoint:'https://oai.aihorde.net/v1/chat/completions',model:'koboldcpp/Kunoichi-DPO-v2-7B-Q8_0-imatrix',system:'تو منتقد فنی هستی. خروجی تیم را بررسی کن، خطاها، ریسک‌ها و اصلاحات دقیق را فهرست کن.',enabled:true}
  ],
  chat:[],
  runs:[],
   memory:[],
  workflowOrder:[]
 };
}
function load(){
 try{
  const v=JSON.parse(localStorage.getItem(KEY));
  if(v&&v.version===2){
   const looksLikeOldApiSetup=v.agents&&v.agents.length&&v.agents.every(function(a){return a.provider==='openai'&&(!a.apiKey)});
   if(looksLikeOldApiSetup){v.agents.forEach(function(a){a.provider='horde';a.endpoint='https://oai.aihorde.net/v1/chat/completions';a.model='koboldcpp/Kunoichi-DPO-v2-7B-Q8_0-imatrix';});v.mode='real';localStorage.setItem(KEY,JSON.stringify(v));}
   return v;
  }
  const old=JSON.parse(localStorage.getItem(OLD_KEY));
  if(old){
   const d=defaults();
   d.teamName=old.teamName||d.teamName;d.goal=old.goal||d.goal;d.chat=old.chat||[];
   d.agents=(old.agents||d.agents).map((a,i)=>Object.assign({},d.agents[i%d.agents.length],a,{id:a.id||uid()}));
   localStorage.setItem(KEY,JSON.stringify(d));return d;
  }
 }catch(e){}
 return defaults();
}
let state=load();
function stripBrowserSecrets(value){
 const x=(value&&typeof value==='object')?Object.assign({},value):{};
 ['apiKey','apikey','token','accessToken','refreshToken','clientSecret','client_secret','secret','password','authorization'].forEach(function(k){delete x[k]});
 return x;
}
function safeAgentId(value,seen){
 let id=String(value||'').trim();
 if(!/^[A-Za-z0-9_-]{1,120}$/.test(id))id=uid();
 while(seen.has(id))id=uid();
 seen.add(id);
 return id;
}
function normalizeStateShape(){
 const d=defaults();
 if(!state||typeof state!=='object')state=d;
 state.version=2;
 state.teamName=String(state.teamName||d.teamName).slice(0,200);
 state.goal=String(state.goal||d.goal).slice(0,10000);
 state.mode=state.mode==='demo'?'demo':'real';
 state.chat=Array.isArray(state.chat)?state.chat.slice(-200):[];
 state.memory=Array.isArray(state.memory)?state.memory.slice(0,30):[];
 state.runs=Array.isArray(state.runs)?state.runs.slice(0,20):[];
 state.providers=Array.isArray(state.providers)?state.providers.slice(0,50).map(function(p){return Object.assign({},stripBrowserSecrets(p),{id:String(p.id||'').slice(0,80),name:String(p.name||'').slice(0,160),protocol:String(p.protocol||'').slice(0,40),auth:String(p.auth||'').slice(0,40),endpoint:String(p.endpoint||'').slice(0,500),model:String(p.model||'').slice(0,200),header:String(p.header||'').slice(0,100),query:String(p.query||'').slice(0,100),template:String(p.template||'').slice(0,12000),responsePath:String(p.responsePath||'').slice(0,300)});}):[];
 const source=Array.isArray(state.agents)&&state.agents.length?state.agents:d.agents;
 const seenAgentIds=new Set();
 const legacySteps=state.workflow&&Array.isArray(state.workflow.steps)?state.workflow.steps:[];
 const legacyOrder=legacySteps.map(function(s){return String((s&&s.agentId)||(s&&s.id)||'').trim();}).filter(Boolean);
 const rawOrder=Array.isArray(state.workflowOrder)?state.workflowOrder:[];
 const preferredOrder=rawOrder.length?rawOrder:legacyOrder;
 state.agents=source.slice(0,50).map(function(a,i){
   const base=d.agents[i%d.agents.length]||d.agents[0];
   return Object.assign({},base,stripBrowserSecrets(a),{
     id:safeAgentId(a&&a.id,seenAgentIds),
     kind:a&&a.kind==='human'?'human':'ai',
     name:String(a&&a.name||base.name).slice(0,160),
     role:String(a&&a.role||base.role).slice(0,500),
     icon:String(a&&a.icon||base.icon).slice(0,16),
     system:String(a&&a.system||base.system).slice(0,20000),
     provider:String(a&&a.provider||base.provider).slice(0,80),
     endpoint:String(a&&a.endpoint||base.endpoint).slice(0,500),
     model:String(a&&a.model||base.model).slice(0,200),
     enabled:a&&a.enabled!==false
   });
 });
 const validIds=new Set(state.agents.map(function(a){return a.id;}));
 const seenOrder=new Set();
 state.workflowOrder=preferredOrder.filter(function(id){return validIds.has(id)&&!seenOrder.has(id)&&seenOrder.add(id);});
 state.agents.forEach(function(a){if(!seenOrder.has(a.id)){state.workflowOrder.push(a.id);seenOrder.add(a.id);}});
 delete state.workflow;
}
normalizeStateShape();
save();

function sanitizeBrowserSecrets(){
 let changed=false;
 (state.agents||[]).forEach(function(a){if(Object.prototype.hasOwnProperty.call(a,'apiKey')){delete a.apiKey;changed=true;}});
 (state.providers||[]).forEach(function(p){if(Object.prototype.hasOwnProperty.call(p,'apiKey')){delete p.apiKey;changed=true;}});
 if(changed)localStorage.setItem(KEY,JSON.stringify(state));
}
sanitizeBrowserSecrets();
let collapsed=new Set(state.agents.map(function(a){return a.id;}));
let busy=false;
let cancelRequested=false;
const activeAbortControllers=new Set();
function trackAbortController(){const c=new AbortController();activeAbortControllers.add(c);return c;}
function releaseAbortController(c){activeAbortControllers.delete(c);}
function abortAllActiveRequests(){activeAbortControllers.forEach(function(c){try{c.abort();}catch(e){}});}

function save(){
 try{
  state.chat=(state.chat||[]).slice(-200).map(function(m){return {name:String(m.name||'').slice(0,160),icon:String(m.icon||'').slice(0,16),text:String(m.text||'').slice(0,12000),type:m.type==='user'?'user':'agent',error:!!m.error,remoteHumanId:m.remoteHumanId||undefined};});
  state.memory=(state.memory||[]).slice(0,30).map(function(x){return {id:x.id,createdAt:x.createdAt,goal:String(x.goal||'').slice(0,1000),summary:String(x.summary||'').slice(0,5000),members:Array.isArray(x.members)?x.members.slice(0,30):[]};});
  state.runs=(state.runs||[]).slice(0,20).map(function(r){return Object.assign({},r,{goal:String(r.goal||'').slice(0,1000),summary:String(r.summary||'').slice(0,5000),members:Array.isArray(r.members)?r.members.slice(0,30):[],messages:Array.isArray(r.messages)?r.messages.slice(-80).map(function(m){return {name:String(m.name||'').slice(0,160),icon:String(m.icon||'').slice(0,16),text:String(m.text||'').slice(0,6000),type:m.type==='user'?'user':'agent',error:!!m.error};}):[]});});
  localStorage.setItem(KEY,JSON.stringify(state));
 }catch(e){try{console.warn('AI Teams local save failed:',e&&e.message||e)}catch(_){} }
}
function memoryContext(limit,query){
 const items=state.memory||[];
 const q=String(query||'').toLowerCase().split(/\s+/).filter(function(x){return x.length>2}).slice(0,20);
 const scored=items.map(function(x){
  const text=String((x.goal||'')+' '+(x.summary||'')).toLowerCase();
  let score=0;q.forEach(function(k){if(text.indexOf(k)>=0)score++;});
  return {x:x,score:score};
 }).sort(function(a,b){return b.score-a.score||String(b.x.createdAt||'').localeCompare(String(a.x.createdAt||''));});
 return scored.slice(0,limit||10).map(function(v){const x=v.x;return '['+(x.createdAt||'')+'] '+(x.goal||'')+'\nخلاصه: '+(x.summary||'')}).join('\n\n')||'حافظه دائمی تیم هنوز خالی است.';
}
function searchProjectMemory(query,limit){return memoryContext(limit||20,query);}

function rememberRun(goal,summary,members){if(!summary)return;state.memory=state.memory||[];state.memory.unshift({id:uid(),createdAt:new Date().toISOString(),goal:String(goal||'').slice(0,1000),summary:String(summary||'').slice(0,5000),members:Array.isArray(members)?members.slice(0,30):[]});state.memory=state.memory.slice(0,30)}
function openMemoryPanel(){
 let el=document.getElementById('teamMemoryPanel');
 if(!el){el=document.createElement('div');el.id='teamMemoryPanel';el.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:3200;padding:14px;overflow:auto;display:none';el.innerHTML='<div class="card" style="max-width:800px;margin:25px auto;background:#121a2d"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">🧠 حافظه و Knowledge تیم</h3><button class="icon-btn" id="memoryClose">✕</button></div><div class="notice" style="margin:10px 0">حافظه اجرای تیم و اسناد متنی پروژه جداگانه نگهداری می‌شوند.</div><div class="field"><input id="memorySearch" placeholder="جستجو در حافظه و Knowledge..."></div><div id="memoryList"></div><div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:10px"><button class="btn danger" id="memoryClear" style="width:auto">پاک کردن حافظه</button><button class="btn" id="memoryRefresh" style="width:auto">بروزرسانی</button><button class="btn primary" id="knowledgeOpen" style="width:auto" onclick="if(typeof openKnowledgePanel===&quot;function&quot;)openKnowledgePanel()">📚 مدیریت Knowledge</button></div></div>';document.body.appendChild(el);document.getElementById('memoryClose').onclick=function(){el.style.display='none'};document.getElementById('memoryClear').onclick=function(){if(confirm('تمام حافظه اجرای این پروژه پاک شود؟')){state.memory=[];save();renderMemory();}};document.getElementById('memoryRefresh').onclick=renderMemory;document.getElementById('memorySearch').oninput=renderMemory;document.getElementById('knowledgeOpen').onclick=openKnowledgePanel;}
 const memoryClose=document.getElementById('memoryClose');if(memoryClose)memoryClose.onclick=function(){el.style.display='none'};
 renderMemory();el.style.setProperty('display','block','important');
}
function renderMemory(){const box=document.getElementById('memoryList');if(!box)return;const q=(document.getElementById('memorySearch')?.value||'').trim().toLowerCase();const mem=(state.memory||[]).filter(function(x){return !q||String(x.goal||'').toLowerCase().includes(q)||String(x.summary||'').toLowerCase().includes(q)});const kn=(state.knowledge||[]).filter(function(x){return !q||String(x.name||'').toLowerCase().includes(q)||String(x.text||'').toLowerCase().includes(q)});let html=mem.map(function(x){return '<div class="agent-row" style="margin-top:8px"><strong>🧠 '+esc(x.goal||'اجرای تیم')+'</strong><div class="tiny">'+esc(x.summary||'').replace(/\\n/g,'<br>')+'</div></div>'}).join('');html+=kn.map(function(x){return '<div class="agent-row" style="margin-top:8px"><strong>📄 '+esc(x.name||'سند')+'</strong><div class="tiny">'+esc(String(x.text||'').slice(0,500))+'</div></div>'}).join('');box.innerHTML=html||'<div class="empty">موردی پیدا نشد.</div>';}
function knowledgeContext(query,limit){const items=state.knowledge||[],q=String(query||'').toLowerCase().split(/\\s+/).filter(function(x){return x.length>2}).slice(0,30);return items.map(function(x){const t=String((x.name||'')+' '+(x.text||'')).toLowerCase();let score=0;q.forEach(function(k){if(t.indexOf(k)>=0)score++});return {x:x,score:score};}).sort(function(a,b){return b.score-a.score||String(b.x.updatedAt||'').localeCompare(String(a.x.updatedAt||''));}).slice(0,limit||5).map(function(v){return '[سند: '+v.x.name+']\\n'+String(v.x.text||'').slice(0,8000)}).join('\\n\\n')||'Knowledge پروژه خالی است.';}
function openKnowledgePanel(){
 let el=document.getElementById('knowledgePanel');
 if(!el){
  el=document.createElement('div');el.id='knowledgePanel';
  el.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:3400;padding:14px;overflow:auto;display:none';
  el.innerHTML='<div class="card" style="max-width:800px;margin:25px auto;background:#121a2d"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">📚 Knowledge پروژه</h3><button class="icon-btn" id="knowledgeClose" type="button">✕</button></div><div class="notice" style="margin:10px 0">TXT، MD، JSON و CSV تا سقف 300KB قابل افزودن هستند.</div><input id="knowledgeFile" type="file" accept=".txt,.md,.json,.csv,text/plain,text/markdown,application/json,text/csv" style="width:100%;margin:10px 0"><div class="field"><input id="knowledgeName" placeholder="نام سند (اختیاری)"></div><textarea id="knowledgeText" placeholder="یا متن را مستقیم وارد کن..." style="min-height:140px;width:100%"></textarea><div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:10px"><button class="btn primary" id="knowledgeAdd" type="button" style="width:auto">＋ افزودن</button><button class="btn" id="knowledgeClear" type="button" style="width:auto">پاک کردن همه</button></div><div id="knowledgeList" style="margin-top:14px"></div></div>';
  document.body.appendChild(el);
 }
 const ensure=function(id,html){
  if(!el.querySelector('#'+id)){
   const host=el.querySelector('.card')||el;
   host.insertAdjacentHTML('beforeend',html);
  }
 };
 ensure('knowledgeName','<div class="field"><input id="knowledgeName" placeholder="نام سند (اختیاری)"></div>');
 ensure('knowledgeText','<textarea id="knowledgeText" placeholder="یا متن را مستقیم وارد کن..." style="min-height:140px;width:100%"></textarea>');
 ensure('knowledgeAdd','<button class="btn primary" id="knowledgeAdd" type="button" style="width:auto">＋ افزودن</button>');
 ensure('knowledgeClear','<button class="btn" id="knowledgeClear" type="button" style="width:auto">پاک کردن همه</button>');
 ensure('knowledgeList','<div id="knowledgeList" style="margin-top:14px"></div>');
 const close=document.getElementById('knowledgeClose');if(close&&!close.dataset.bound){close.dataset.bound='1';close.onclick=function(){el.style.display='none'};}
 const file=document.getElementById('knowledgeFile');if(file&&!file.dataset.bound){file.dataset.bound='1';file.onchange=async function(){const f=this.files&&this.files[0];if(!f)return;if(f.size>300000)return alert('فایل بزرگ‌تر از 300KB است.');document.getElementById('knowledgeName').value=f.name;document.getElementById('knowledgeText').value=await f.text();};}
 const add=document.getElementById('knowledgeAdd');if(add&&!add.dataset.bound){add.dataset.bound='1';add.onclick=function(){const tv=document.getElementById('knowledgeText').value.trim();if(!tv)return alert('متن سند خالی است.');if(tv.length>300000)return alert('متن بزرگ‌تر از 300KB است.');state.knowledge=state.knowledge||[];state.knowledge.unshift({id:uid(),name:(document.getElementById('knowledgeName').value.trim()||'سند بدون نام').slice(0,160),text:tv,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});state.knowledge=state.knowledge.slice(0,50);save();renderKnowledge();document.getElementById('knowledgeText').value='';};}
 const clear=document.getElementById('knowledgeClear');if(clear&&!clear.dataset.bound){clear.dataset.bound='1';clear.onclick=function(){if(confirm('همه اسناد Knowledge حذف شوند؟')){state.knowledge=[];save();renderKnowledge();}};}
 renderKnowledge();el.style.display='block';
}function renderKnowledge(){const box=document.getElementById('knowledgeList');if(!box)return;const items=state.knowledge||[];box.innerHTML=items.length?items.map(function(x){return '<div class="agent-row" style="margin-top:8px"><div class="agent-head"><strong>📄 '+esc(x.name)+'</strong><button class="btn danger knowledge-delete" data-id="'+esc(x.id)+'" style="width:auto">حذف</button></div><div class="tiny">'+esc(String(x.text||'').slice(0,700))+'</div></div>'}).join(''):'<div class="empty">Knowledge خالی است.</div>';box.querySelectorAll('.knowledge-delete').forEach(function(b){b.onclick=function(){state.knowledge=(state.knowledge||[]).filter(function(x){return x.id!==b.dataset.id});save();renderKnowledge();}});}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]})}
function selectedAgent(id){return state.agents.find(function(a){return a.id===id})}
function agentAiLabel(a){const m=String(a.model||'').toLowerCase();const p=String(a.provider||'').toLowerCase();if(m.includes('deepseek'))return 'DeepSeek';if(m.includes('claude'))return 'Claude';if(m.includes('gemini'))return 'Gemini';if(m.includes('gpt')||p==='openai')return 'GPT / OpenAI';if(m.includes('grok'))return 'Grok';if(m.includes('mistral'))return 'Mistral';if(m.includes('qwen'))return 'Qwen';if(m.includes('llama'))return 'Llama';if(p==='horde')return 'AI Horde';if(p==='openrouter')return 'OpenRouter';if(p==='custom')return 'Custom';return a.model||a.provider||'نامشخص'}
function configuredCount(){return state.agents.filter(function(a){return a.kind!=='human'&&a.enabled&&a.endpoint&&a.model&&(a.provider==='horde'||(window.aiTeamsCloud&&window.aiTeamsCloud.isReady()))}).length}

function render(){
 document.getElementById('teamTitle').textContent=state.teamName||'تیم هوش مصنوعی من';
 document.getElementById('teamName').value=state.teamName||'';
 document.getElementById('goal').value=state.goal||'';
 document.getElementById('countPill').textContent=state.agents.length+' عضو';
 document.getElementById('configuredPill').textContent=configuredCount()+' اتصال آماده';
 document.getElementById('demoModeBtn').classList.toggle('active',state.mode==='demo');
 document.getElementById('realModeBtn').classList.toggle('active',state.mode==='real');
 document.getElementById('realNotice').textContent='حالت واقعی فعال است. AI Horde مستقیم و بدون کلید کار می‌کند؛ Providerهای دیگر از Gateway امن استفاده می‌کنند و کلیدشان نباید داخل مرورگر باشد.';
 document.getElementById('realNotice').style.display=state.mode==='real'?'block':'none';
 document.getElementById('modeNotice').style.display=state.mode==='demo'?'block':'none';

 document.getElementById('agentList').innerHTML=state.agents.map(function(a){
  return '<div class="agent-card"><div class="avatar">'+esc(a.icon)+'</div><div class="agent-identity"><div class="agent-name"><b class="agent-name-text">'+esc(a.name)+'</b></div><div class="agent-meta"><span class="role-pill">🎯 '+esc(a.role)+'</span><span class="ai-pill">🤖 '+esc(agentAiLabel(a))+'</span></div></div><span class="dot '+(a.enabled?'':'off')+'"></span></div>';
 }).join('');

 document.getElementById('editor').innerHTML=state.agents.map(function(a,index){
  const closed=collapsed.has(a.id);
  return '<div class="agent-row" id="agent-'+a.id+'">'+
   '<div class="agent-head"><div class="agent-identity"><div class="agent-name"><strong class="agent-name-text">'+esc(a.icon)+' '+esc(a.name)+'</strong></div><div class="agent-meta"><span class="role-pill">🎯 '+esc(a.role)+'</span><span class="ai-pill">🤖 '+esc(agentAiLabel(a))+'</span></div><div class="model-line">مدل: '+esc(a.model||'نامشخص')+'</div></div><div class="head-actions">'+
   '<button class="icon-btn" title="باز و بسته کردن" onclick="toggleAgent(\''+a.id+'\')">'+(closed?'＋':'−')+'</button>'+
   '<button class="icon-btn" title="حذف" onclick="removeAgent(\''+a.id+'\')">🗑</button></div></div>'+
   (closed?'':'<div class="field"><label>نام</label><input data-id="'+a.id+'" data-k="name" value="'+esc(a.name)+'"></div>'+
   '<div class="field"><label>نقش</label><input data-id="'+a.id+'" data-k="role" value="'+esc(a.role)+'"></div>'+
   '<div class="field"><label>پرامپت سیستم</label><textarea data-id="'+a.id+'" data-k="system">'+esc(a.system)+'</textarea></div>'+
   '<div class="two"><div class="field"><label>Provider</label><select data-id="'+a.id+'" data-k="provider"><option value="horde" '+(a.provider==='horde'?'selected':'')+'>AI Horde — رایگان بدون کلید</option><option value="openai" '+(a.provider==='openai'?'selected':'')+'>OpenAI-compatible</option><option value="openrouter" '+(a.provider==='openrouter'?'selected':'')+'>OpenRouter</option><option value="claude" '+(a.provider==='claude'?'selected':'')+'>Claude / Anthropic</option><option value="gemini" '+(a.provider==='gemini'?'selected':'')+'>Gemini</option><option value="custom" '+(a.provider==='custom'?'selected':'')+'>Custom</option></select></div><div class="field"><label>Model</label><input data-id="'+a.id+'" data-k="model" value="'+esc(a.model)+'" placeholder="نام مدل"></div></div>'+
   '<div class="field"><label>Endpoint</label><input data-id="'+a.id+'" data-k="endpoint" value="'+esc(a.endpoint)+'" placeholder="https://.../v1/chat/completions"></div>'+
   '<div class="field"><label>وضعیت عضو</label><select data-id="'+a.id+'" data-k="enabled"><option value="true" '+(a.enabled?'selected':'')+'>فعال</option><option value="false" '+(!a.enabled?'selected':'')+'>غیرفعال</option></select></div></div>'+
   '<button class="btn" style="margin-top:2px" onclick="testAgent(\''+a.id+'\')">اتصال آزمایشی</button>')
   +'</div>';
 }).join('');

 document.querySelectorAll('#editor [data-k]').forEach(function(el){
  el.addEventListener('input',updateAgent);
  el.addEventListener('change',updateAgent);
 });
 renderChat();
}
function renderChat(){
 const box=document.getElementById('chat');
 if(!state.chat.length){box.innerHTML='<div class="empty">هدف را وارد کن و «اجرای تیم» را بزن.</div>';return}
 box.innerHTML=state.chat.map(function(m){
  return '<div class="msg '+(m.type==='user'?'user':'')+'"><div class="avatar">'+esc(m.icon||'🤖')+'</div><div class="bubble '+(m.error?'error':'')+'"><div class="name">'+esc(m.name||'عضو تیم')+'</div>'+esc(m.text||'').replace(/\\n/g,'<br>')+'</div></div>';
 }).join('');
 box.scrollTop=box.scrollHeight;
}
function renderSidebarOnly(){
 document.getElementById('agentList').innerHTML=state.agents.map(function(a){
  return '<div class="agent-card"><div class="avatar">'+esc(a.icon)+'</div><div class="agent-identity"><div class="agent-name"><b class="agent-name-text">'+esc(a.name)+'</b></div><div class="agent-meta"><span class="role-pill">🎯 '+esc(a.role)+'</span><span class="ai-pill">🤖 '+esc(agentAiLabel(a))+'</span></div></div><span class="dot '+(a.enabled?'':'off')+'"></span></div>';
 }).join('');
 document.getElementById('countPill').textContent=state.agents.length+' عضو';
 document.getElementById('configuredPill').textContent=configuredCount()+' اتصال آماده';
}
function updateAgent(e){
 const a=selectedAgent(e.target.dataset.id);if(!a)return;
 const k=e.target.dataset.k;let v=e.target.value;if(k==='enabled')v=v==='true';
 a[k]=v;
 if(k==='provider'&&v==='horde'){a.endpoint='https://oai.aihorde.net/v1/chat/completions';a.model='koboldcpp/Kunoichi-DPO-v2-7B-Q8_0-imatrix';delete a.apiKey;}else if(k==='endpoint'&&v&&!/^https:\/\/[^\s]+$/i.test(v)){alert('Endpoint باید یک آدرس HTTPS معتبر باشد.');e.target.value=a.endpoint||'';return;}
 save();renderSidebarOnly();if((k==='provider'||k==='model')&&e.type==='change')render();
}
function toggleAgent(id){if(collapsed.has(id))collapsed.delete(id);else collapsed.add(id);render()}
function removeAgent(id){if(state.agents.length<=1)return alert('حداقل یک عضو باید باقی بماند.');state.agents=state.agents.filter(function(a){return a.id!==id});save();render()}
function agentBuilderModels(providerId){
 const p=(state.providers||[]).find(function(x){return x.id===providerId});
 const defaults={horde:['koboldcpp/Kunoichi-DPO-v2-7B-Q8_0-imatrix','Llama-3.3-70B-Instruct','Qwen2.5-72B-Instruct','Mistral-Small-24B-Instruct-2501'],openai:['gpt-4o-mini','gpt-4o','gpt-5'],openrouter:['openrouter/free','deepseek/deepseek-chat-v3-0324:free','google/gemini-2.0-flash-exp:free'],claude:['claude-sonnet-4-5','claude-3-5-haiku'],gemini:['gemini-2.5-flash','gemini-2.5-pro'],custom:[]};
 const list=(defaults[providerId]||[]).slice();if(p&&p.model&&list.indexOf(p.model)<0)list.unshift(p.model);return list;
}
async function refreshHordeModels(){try{const r=await fetch('https://oai.aihorde.net/v1/models',{headers:{'Authorization':'Bearer 0000000000','X-Client':'AI-Teams'},cache:'no-store'});if(!r.ok)return [];const j=await r.json();const models=(j.data||[]).map(function(x){return x&&x.id?String(x.id):''}).filter(Boolean);if(models.length){state.hordeModels=models;save();}return models;}catch(e){return [];}}
function agentBuilderRefreshModels(){
 const provider=document.getElementById('agentBuilderProvider'),input=document.getElementById('agentBuilderModel'),list=document.getElementById('agentBuilderModels');if(!provider||!input||!list)return;
 let models=agentBuilderModels(provider.value);if(provider.value==='horde'&&Array.isArray(state.hordeModels)&&state.hordeModels.length)models=state.hordeModels.slice(0,100);list.innerHTML=models.map(function(m){return '<option value="'+esc(m)+'"></option>'}).join('');if(!input.value&&models[0])input.value=models[0];
}
function workflowSteps(){return getWorkflowAgents().map(function(a,i){return {id:a.id,agentId:a.id,order:i+1};})}
function openAgentBuilder(){
 refreshHordeModels().then(function(){agentBuilderRefreshModels();});
 let modal=document.getElementById('agentBuilderModal');
 if(!modal){
  modal=document.createElement('div');modal.id='agentBuilderModal';modal.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.74);z-index:2000;padding:12px;overflow:auto';
  modal.innerHTML='<div class="card" style="width:min(720px,100%);margin:30px auto;padding:18px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div><h3 style="margin:0">ساخت Agent جدید</h3><div class="tiny">نقش، مدل و رفتار Agent را قبل از افزودن تنظیم کن.</div></div><button class="icon-btn" id="agentBuilderClose">✕</button></div>'+
  '<div class="two" style="margin-top:14px"><div class="field"><label>نام Agent</label><input id="agentBuilderName" placeholder="مثلاً تحلیل‌گر بازار"></div><div class="field"><label>قالب نقش</label><select id="agentBuilderTemplate"><option value="analyst">تحلیل‌گر</option><option value="researcher">پژوهشگر</option><option value="critic">منتقد</option><option value="writer">نویسنده</option><option value="custom">سفارشی</option></select></div></div>'+
  '<div class="two"><div class="field"><label>Provider</label><select id="agentBuilderProvider"></select></div><div class="field"><label>مدل اختصاصی این Agent</label><input id="agentBuilderModel" list="agentBuilderModels" placeholder="مدل موردنظر"><datalist id="agentBuilderModels"></datalist></div></div>'+
  '<div class="field"><label>نقش دقیق</label><input id="agentBuilderRole" placeholder="مثلاً تحلیل‌گر فنی"></div><div class="field"><label>System Prompt</label><textarea id="agentBuilderSystem" style="min-height:150px" placeholder="دستورالعمل دقیق Agent..."></textarea></div>'+
  '<div class="mode-row"><label class="mode"><input type="checkbox" id="agentBuilderEnabled" checked style="width:auto;margin-left:5px"> فعال</label></div><div class="notice" style="margin-top:10px">مدل انتخابی فقط به همین Agent اختصاص داده می‌شود.</div>'+
  '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn primary" id="agentBuilderCreate" style="width:auto">＋ ساخت Agent</button><button class="btn" id="agentBuilderCancel" style="width:auto">انصراف</button></div></div>';
  document.body.appendChild(modal);
  document.getElementById('agentBuilderClose').onclick=function(){modal.style.display='none'};document.getElementById('agentBuilderCancel').onclick=function(){modal.style.display='none'};
  document.getElementById('agentBuilderProvider').onchange=agentBuilderRefreshModels;
  document.getElementById('agentBuilderTemplate').onchange=function(){const presets={analyst:['تحلیل‌گر جدید','تحلیل‌گر متخصص','تو یک تحلیل‌گر دقیق هستی. شواهد را بررسی کن، فرضیات را جدا کن و نتیجه روشن بده.'],researcher:['پژوهشگر جدید','پژوهشگر اطلاعات','تو یک پژوهشگر دقیق هستی. اطلاعات را ساختاربندی کن و تناقض‌ها را مشخص کن.'],critic:['منتقد جدید','منتقد و کنترل کیفیت','تو منتقد تیم هستی. خطاها، ریسک‌ها و اصلاحات خروجی قبلی را مشخص کن.'],writer:['نویسنده نهایی','نویسنده','تو نویسنده نهایی تیم هستی. ورودی اعضای قبلی را ترکیب و خروجی دقیق تولید کن.'],custom:['Agent جدید','عامل هوش مصنوعی','تو یک عامل متخصص در تیم AI Teams هستی. نقش خودت را دقیق انجام بده و خروجی قابل استفاده تحویل بده.']};const p=presets[this.value]||presets.custom;document.getElementById('agentBuilderName').value=p[0];document.getElementById('agentBuilderRole').value=p[1];document.getElementById('agentBuilderSystem').value=p[2];};
  document.getElementById('agentBuilderCreate').onclick=function(){const name=document.getElementById('agentBuilderName').value.trim(),provider=document.getElementById('agentBuilderProvider').value,model=document.getElementById('agentBuilderModel').value.trim();if(!name||!provider||!model)return alert('نام، Provider و مدل را کامل کن.');const p=(state.providers||[]).find(function(x){return x.id===provider});state.agents.push({id:uid(),kind:'ai',name:name.slice(0,120),role:document.getElementById('agentBuilderRole').value.trim().slice(0,180)||'عامل هوش مصنوعی',icon:'🤖',provider:provider,endpoint:(p&&p.endpoint)||'',model:model.slice(0,200),system:document.getElementById('agentBuilderSystem').value.trim().slice(0,12000),enabled:document.getElementById('agentBuilderEnabled').checked});save();render();modal.style.display='none';};
 }
 const ps=document.getElementById('agentBuilderProvider');ps.innerHTML=(state.providers||[]).filter(function(p){return p.id!=='custom'||p.endpoint}).map(function(p){return '<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>'}).join('');
 const first=(state.providers||[]).find(function(p){return p.id==='horde'})||(state.providers||[])[0];if(first)ps.value=first.id;
 document.getElementById('agentBuilderName').value='تحلیل‌گر جدید';document.getElementById('agentBuilderRole').value='عامل هوش مصنوعی';document.getElementById('agentBuilderSystem').value='تو یک عامل متخصص در تیم AI Teams هستی. نقش خودت را دقیق انجام بده و خروجی قابل استفاده تحویل بده.';document.getElementById('agentBuilderEnabled').checked=true;document.getElementById('agentBuilderTemplate').value='custom';agentBuilderRefreshModels();document.getElementById('agentBuilderModal').style.display='block';
}
function addAgent(){openAgentBuilder()}
function fillDemo(){ state=defaults();collapsed=new Set(state.agents.map(function(a){return a.id;}));save();render();alert('تنظیمات نمونه برگشت داده شد.'); }
function setMode(m){state.mode=m;save();render()}
function msg(name,icon,text,type,error){state.chat.push({name:name,icon:icon,text:text,type:type||'agent',error:!!error});renderChat();save()}

function mockResponse(a,goal,history){
 const lower=(a.name||'').toLowerCase();
 if(lower.indexOf('تحلیل')>=0)return 'هدف: «'+goal+'»\\n\\n۱) مسئله و نیازمندی‌های اصلی را استخراج می‌کنم.\\n۲) فرضیات و ابهام‌های مهم را مشخص می‌کنم.\\n۳) معیار موفقیت و خروجی قابل تحویل را تعریف می‌کنم.';
 if(lower.indexOf('طراح')>=0)return 'بر اساس هدف و تحلیل مرحله قبل، راه‌حل را به ماژول‌ها تقسیم می‌کنم: رابط کاربر، هسته اجرای تیم، مدیریت اعضا، لایه مدل و مدیریت خطا. هر بخش باید مستقل و قابل توسعه باشد.';
 if(lower.indexOf('برنامه')>=0)return 'طرح فنی پیشنهادی:\\n۱) مدل داده برای اعضا و اجراها.\\n۲) اجرای ترتیبی یا موازی بر اساس نوع وظیفه.\\n۳) عبور دادن خروجی هر عامل به عامل بعدی.\\n۴) مدیریت timeout، خطا و ثبت رویدادها.';
 if(lower.indexOf('منتقد')>=0)return 'بازبینی انجام شد. مواردی که باید کنترل شوند: وابستگی به سرویس مدل، هزینه و محدودیت مصرف، مدیریت خطا، امنیت اعتبارنامه‌ها و امکان تکرار یک مرحله بدون اجرای کل تیم.';
 return 'در نقش «'+a.role+'»، هدف را بررسی کردم و یک خروجی مرحله‌ای برای ادامه کار پیشنهاد می‌دهم.';
}

async function refreshHordeModels(){
  if(state.hordeModelsFetchedAt&&Date.now()-state.hordeModelsFetchedAt<10*60*1000)return state.hordeModels||[];
  const endpoint='https://oai.aihorde.net/v1/models';
  const controller=new AbortController(),timer=setTimeout(function(){controller.abort()},15000);
  try{
    const res=await fetch(endpoint,{headers:{'Authorization':'Bearer 0000000000','X-Client':'AI-Teams'},cache:'no-store',signal:controller.signal});
    if(!res.ok)throw new Error('HTTP '+res.status);
    const data=await res.json();
    const models=Array.isArray(data.data)?data.data:[];
    const usable=models.map(function(x){return x&&x.id?String(x.id):''}).filter(Boolean);
    if(!usable.length)return [];
    state.hordeModels=usable.slice(0,100);
    state.hordeModelsFetchedAt=Date.now();
    const active=(state.agents||[]).filter(function(a){return a.provider==='horde'&&a.enabled&&a.kind!=='human'});
    active.forEach(function(a){
      if(!a.model||usable.indexOf(a.model)<0){
        const preferred=usable.find(function(m){return /llama|qwen|mistral|gemma|deepseek|phi/i.test(m)})||usable[0];
        a.model=preferred;
      }
      a.endpoint='https://oai.aihorde.net/v1/chat/completions';
    });
    save();render();
    return usable;
  }catch(e){return [];}
}
async function ensureHordeModel(a){
  if(a.provider!=='horde')return [];
  const cached=Array.isArray(state.hordeModels)?state.hordeModels:[];
  if(cached.length&&a.model&&cached.indexOf(a.model)>=0)return cached;
  try{
    const res=await fetch('https://oai.aihorde.net/v1/models',{headers:{'Authorization':'Bearer 0000000000','X-Client':'AI-Teams'},cache:'no-store'});
    if(!res.ok)throw new Error('AI Horde model list HTTP '+res.status);
    const data=await res.json();
    const models=Array.isArray(data.data)?data.data.map(function(x){return x&&x.id?String(x.id):''}).filter(Boolean):[];
    if(!models.length)throw new Error('AI Horde هیچ مدل فعالی برنگرداند.');
    state.hordeModels=models;
    const preferred=models.find(function(m){return /llama|qwen|mistral|gemma|deepseek|phi/i.test(m)});
    if(!a.model||models.indexOf(a.model)<0){
      a.model=preferred||models[0];
      a.endpoint='https://oai.aihorde.net/v1/chat/completions';
      save();
    }
    return models;
  }catch(e){
    if(cached.length)return cached;
    throw e;
  }
}

function compactContext(value,max){
 const s=String(value||'');
 if(s.length<=max)return s;
 const head=Math.max(1000,Math.floor(max*0.35));
 const tail=Math.max(1000,max-head);
 return s.slice(0,head)+'\\n\\n… بخش میانی برای کنترل حجم Context کوتاه شد …\\n\\n'+s.slice(-tail);
}
async function callAgent(a,goal,transcript,signal){
 if(cancelRequested)throw new Error('اجرای تیم توسط کاربر متوقف شد.');
 if(a.provider==='horde'&&typeof window.aiTeamsUniversalCallAgent==='function'){
  return window.aiTeamsUniversalCallAgent(a,goal,transcript,signal);
 }
 if(!a||a.kind==='human')throw new Error('عضو انسانی نمی‌تواند به‌عنوان Provider هوش مصنوعی اجرا شود.');
 const provider=a.provider||'horde';
 if(provider==='horde'&&typeof window.aiTeamsUniversalCallAgent==='function')return window.aiTeamsUniversalCallAgent(a,goal,transcript);
 const system=a.system||('تو عضو تیم با نقش '+a.role+' هستی.');
 const safeGoal=compactContext(goal,7000);
 const safeTranscript=compactContext(transcript,11000);
 const messages=[
  {role:'system',content:compactContext(system,10000)},
  {role:'user',content:'هدف تیم:\n'+safeGoal+'\n\nخروجی اعضای قبلی:\n'+(safeTranscript||'هنوز خروجی قبلی وجود ندارد.')+'\n\nاکنون فقط وظیفه نقش خودت را انجام بده و نتیجه مشخص و قابل استفاده تحویل بده.'}
 ];
 if(provider!=='horde'){
  if(!window.aiTeamsCloud||!window.aiTeamsCloud.isReady())throw new Error('برای Providerهای غیررایگان، ابتدا وارد حساب ابری شو و Gateway امن را فعال کن.');
  let lastError=null;
  for(let attempt=1;attempt<=3;attempt++){
   try{
    const data=await window.aiTeamsCloud.invokeAI({provider:provider,model:a.model,messages:messages,system:system,endpoint:provider==='custom'?(a.endpoint||''):undefined,temperature:0.2,referer:location.origin});
    if(!data||typeof data.output!=='string'||!data.output.trim())throw new Error('Gateway پاسخ متنی معتبری برنگرداند.');
    return data.output;
   }catch(e){
    lastError=e;
    if(attempt<3)await new Promise(function(resolve){setTimeout(resolve,attempt*1200)});
   }
  }
  throw lastError||new Error('Gateway در دسترس نیست.');
 }
 const endpoints=['https://oai.aihorde.net/v1/chat/completions'];
 if(a.endpoint&&endpoints.indexOf(a.endpoint)<0)throw new Error('برای AI Horde فقط Endpoint رسمی و امن مجاز است.');
 let models=[];try{models=await ensureHordeModel(a);}catch(e){throw new Error('AI Horde در دسترس نیست: '+(e.message||e));}
 const candidates=[];if(a.model&&models.indexOf(a.model)>=0)candidates.push(a.model);
 models.forEach(function(m){if(candidates.indexOf(m)<0&&/llama|qwen|mistral|gemma|deepseek|phi/i.test(m))candidates.push(m)});
 models.forEach(function(m){if(candidates.indexOf(m)<0)candidates.push(m)});if(!candidates.length&&a.model)candidates.push(a.model);
 const headers={'Content-Type':'application/json','Authorization':'Bearer 0000000000','X-Client':'AI-Teams'};let lastError=null;
 for(let attempt=1;attempt<=Math.min(3,candidates.length||1);attempt++){
  const model=String(candidates[attempt-1]||'').trim();if(!model)continue;a.model=model;a.endpoint=endpoints[0];
  const controller=trackAbortController(),timer=setTimeout(function(){controller.abort()},90000);
  try{
   const res=await fetch(endpoints[0],{method:'POST',headers:headers,body:JSON.stringify({model:model,messages:messages,temperature:0.2}),signal:controller.signal});
   const raw=await res.text();let data={};try{data=JSON.parse(raw)}catch(e){}
   if(!res.ok){lastError=new Error((data.error&&data.error.message)||data.message||raw.slice(0,500)||('HTTP '+res.status));if(res.status!==408&&res.status!==425&&res.status!==429&&res.status<500)throw lastError;}
   else{const out=data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content;const textOut=data.choices&&data.choices[0]&&data.choices[0].text;if(typeof out==='string'&&out.trim()){save();return out;}if(typeof textOut==='string'&&textOut.trim()){save();return textOut;}lastError=new Error('پاسخ مدل قابل استخراج نبود.');}
  }catch(err){lastError=err.name==='AbortError'?new Error('زمان پاسخ AI Horde تمام شد.'):err;if(err.name==='AbortError'&&cancelRequested)throw err;}
  finally{clearTimeout(timer);releaseAbortController(controller)}
  if(attempt<Math.min(3,candidates.length||1))await new Promise(function(resolve){setTimeout(resolve,attempt*1200)});
 }
 throw lastError||new Error('اتصال به AI Horde ناموفق بود.');
 }
 async function callAgentStreaming(a,goal,transcript,onDelta){
 if(typeof onDelta!=='function'||a.provider==='horde'||!window.aiTeamsCloud||!window.aiTeamsCloud.streamAI)return callAgent(a,goal,transcript);
 const system=a.system||('تو عضو تیم با نقش '+a.role+' هستی.');
 const messages=[
  {role:'system',content:compactContext(system,10000)},
  {role:'user',content:'هدف تیم:\n'+compactContext(goal,7000)+'\n\nخروجی اعضای قبلی:\n'+(compactContext(transcript,11000)||'هنوز خروجی قبلی وجود ندارد.')+'\n\nاکنون فقط وظیفه نقش خودت را انجام بده و نتیجه مشخص و قابل استفاده تحویل بده.'}
 ];
 const data=await window.aiTeamsCloud.streamAI({provider:a.provider,model:a.model,messages:messages,system:system,temperature:0.2,referer:location.origin},onDelta);
 if(!data.trim())throw new Error('Streaming پاسخ متنی برنگرداند.');
 return data;
}
async function callAgentResilient(a,goal,transcript,onDelta){
 let lastError=null;
 for(let attempt=1;attempt<=3;attempt++){
  try{return await callAgentStreaming(a,goal,transcript,onDelta);}
  catch(e){lastError=e;if(cancelRequested||e.name==='AbortError')throw e;if(attempt<3)await new Promise(function(resolve){setTimeout(resolve,attempt*1000);});}
 }
 if(a.provider!=='horde'){
  const horde=Object.assign({},a,{provider:'horde',endpoint:'https://oai.aihorde.net/v1/chat/completions',model:(state.hordeModels&&state.hordeModels[0])||'koboldcpp/Kunoichi-DPO-v2-7B-Q8_0-imatrix'});
  try{return await callAgent(horde,goal,transcript);}
  catch(e){lastError=new Error((lastError&&lastError.message||'Provider اصلی شکست خورد.')+' | Fallback AI Horde: '+e.message);}
 }
 throw lastError||new Error('اجرای Agent ناموفق بود.');
}
async function reviewTeamOutputs(active,goal,transcript){
 const reviewers=active.filter(function(a){return a.enabled&&a.kind!=='human'}).slice(0,Math.min(3,active.length));
 if(!reviewers.length||!transcript)return '';
 const prompt='هدف تیم:\n'+goal+'\n\nخروجی اعضا:\n'+compactContext(transcript,18000)+'\n\nنکته مهم: تو فقط منتقد هستی و نباید صرفاً از پاسخ خودت دفاع کنی. همه خروجی‌ها را با یک معیار یکسان مقایسه کن. برای هر خروجی، صحت، ارتباط با هدف، کامل بودن، استدلال، قابلیت اجرا و نقاط ضعف را بررسی کن؛ امتیاز ۰ تا ۱۰ بده؛ سپس بهترین گزینه را مشخص کن. اگر اطلاعات کافی نیست صریح بگو و از ساختن واقعیت جدید خودداری کن.';
 const reviews=await Promise.all(reviewers.map(async function(a){
  try{return {name:a.name,text:await callAgentResilient(a,prompt,'')};}
  catch(e){return {name:a.name,text:'خطای منتقد: '+e.message};}
 }));
 return reviews.map(function(x){return '[منتقد '+x.name+']\n'+x.text;}).join('\n\n');
}
async function testAgent(id){
 const a=selectedAgent(id);if(!a)return;
 if(!a.endpoint||!a.model)return alert('Endpoint و Model را کامل کن.');
 if(a.provider!=='horde'&&(!window.aiTeamsCloud||!window.aiTeamsCloud.isReady()))return alert('برای تست امن این Provider ابتدا وارد حساب ابری شو و کلید Provider را در Supabase تنظیم کن.');
 try{
  alert('در حال آزمایش اتصال...');
  const out=await callAgentResilient(a,'فقط یک جمله بنویس که اتصال برقرار شده است.','');
  alert('اتصال موفق است:\\n\\n'+out.slice(0,300));
 }catch(e){alert('اتصال ناموفق بود:\\n\\n'+e.message)}
}

function buildTeamRoster(active){
 const members=active.map(function(a){
  return '• '+a.name+' | نوع: هوش مصنوعی | نقش: '+(a.role||'بدون نقش')+' | مدل: '+(a.model||'نامشخص')+' | سرویس: '+(a.provider||'نامشخص');
 }).join('\\n');
 const online=(window.aiTeamsOnlineRosterText&&window.aiTeamsOnlineRosterText())||'';
 return 'شناسه اعضای گروه:\\n• شما | نوع: انسان/کاربر | مدیر و عضو انسانی گفتگو\\n'+(members||'• هیچ عضو هوش مصنوعی فعالی وجود ندارد.')+online+'\\n\\nقانون: هر پیام را با توجه به هویت فرستنده تفسیر کن؛ «شما» و انسان‌های آنلاین انسان هستند و اعضای نام‌برده هوش مصنوعی هستند. در پاسخ به پیام انسان، مثل یک عضو گفتگو پاسخ بده؛ درباره هویت یا نقش خودت و دیگر اعضا اشتباه نکن.';
}

async function runAdminTurn(){
 cancelRequested=false;document.getElementById('stopBtn').disabled=false;
 if(busy)return;
 const input=document.getElementById('adminChatInput');
 const userText=input.value.trim();
 if(!userText)return;
 let active=getWorkflowAgents().filter(function(a){return a.enabled&&a.kind!=='human'});
 if(!active.length)return alert('حداقل یک عضو فعال لازم است.');
 state.teamName=document.getElementById('teamName').value.trim()||'تیم هوش مصنوعی من';
 state.goal=document.getElementById('goal').value.trim();
 input.value='';
 busy=true;
 document.getElementById('adminChatBtn').disabled=true;
 document.getElementById('dialogueBtn').disabled=true;
 document.getElementById('runBtn').disabled=true;
 document.getElementById('parallelBtn').disabled=true;
 let turnHadError=false;
 try{
  msg('شما','👤',userText,'user',false);
  let transcript=buildTeamRoster(active)+'\\n\\nسابقه گفتگو:\\n'+state.chat.map(function(m){return '['+(m.type==='user'?'شما (انسان)':'عضو هوش مصنوعی: '+(m.name||'تیم'))+']\\n'+m.text}).join('\\n\\n');
  for(const a of active){
   const placeholder={name:a.name,icon:a.icon,text:'در حال پاسخ...',type:'agent',error:false};
   state.chat.push(placeholder);
   renderChat();
   try{
    let result;
    if(state.mode==='demo'){
     result='دستور ادمین دریافت شد. در نقش «'+a.role+'» آن را بررسی کردم و برای ادامه کار اقدام/پیشنهاد لازم را ارائه می‌دهم.\\n\\nپیام ادمین: '+userText;
    }else{
     const adminGoal=buildTeamRoster(active)+'\\n\\nهدف فعلی تیم:\\n'+(state.goal||'هدف هنوز مشخص نشده است')+
       '\\n\\nپیام/دستور مستقیم ادمین:\\n'+userText+
       '\\n\\nقواعد: پیام ادمین را در اولویت قرار بده. اگر دستور مستقیماً یک عضو خاص را خطاب قرار داده، از نقش خودت فقط در همان محدوده استفاده کن. اگر دستور خطاب به کل تیم است، با نقش خودت پاسخ بده. پاسخ اعضای قبلی همین نوبت و سابقه گفتگو را بررسی کن، تکرار را کم کن و اگر نیاز به اصلاح داری دقیق و عملی توضیح بده.';
     result=await callAgentResilient(a,adminGoal,transcript);
    }
    placeholder.text=result;
    placeholder.error=false;
    transcript+='\\n\\n['+a.name+' در پاسخ به ادمین]\\n'+result;
   transcript=compactContext(transcript,30000);
   }catch(e){
    turnHadError=true;
    placeholder.text='خطا: '+e.message;
    placeholder.error=true;
    transcript+='\\n\\n['+a.name+' - خطا در پاسخ به ادمین]\\n'+e.message;
    transcript=compactContext(transcript,30000);
   }
   renderChat();
   save();
  }
  msg('سیستم','💬',turnHadError?'پاسخ این نوبت با یک یا چند خطا همراه بود؛ پاسخ‌های موفق همچنان ثبت شدند.':'اعضای فعال به پیام شما پاسخ دادند. می‌توانی مثل یک گفت‌وگوی عادی پیام بعدی را بفرستی.','agent',turnHadError);
 }catch(e){
  msg('سیستم','⚠️','اجرای دستور متوقف شد: '+e.message,'agent',true);
 }finally{
  activeAbortControllers.clear();
  busy=false;
  document.getElementById('adminChatBtn').disabled=false;
  document.getElementById('dialogueBtn').disabled=false;
  document.getElementById('runBtn').disabled=false;
  document.getElementById('parallelBtn').disabled=false;
  document.getElementById('stopBtn').disabled=true;
  cancelRequested=false;
  finishLiveRun();
  save();
 }
}

async function runDialogue(){
 cancelRequested=false;document.getElementById('stopBtn').disabled=false;
 if(busy)return;
 const goal=document.getElementById('goal').value.trim();
 state.teamName=document.getElementById('teamName').value.trim()||'تیم هوش مصنوعی من';
 state.goal=goal;
 if(!goal)return alert('اول کار یا موضوع مشخصی را که اعضا باید درباره انجام آن بحث کنند وارد کن.');
 const active=getWorkflowAgents().filter(function(a){return a.enabled&&a.kind!=='human'});
 if(!active.length)return alert('حداقل یک عضو هوش مصنوعی فعال لازم است.');
 const rounds=Math.max(1,Math.min(3,Number(document.getElementById('dialogueRounds').value)||2));
 busy=true;
 document.getElementById('runBtn').disabled=true;
 document.getElementById('dialogueBtn').disabled=true;
 document.getElementById('adminChatBtn').disabled=true;
 const runId=(crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now());
 state.runs=state.runs||[];
 state.chat=[];
 let dialogueHadError=false;
 try{
  msg('مدیر پروژه','👤','موضوع بحث و کار موردنظر:\\n'+goal+'\\n\\nاعضا باید درباره بهترین روش انجام این کار بحث کنند.','user',false);
  let transcript=buildTeamRoster(active)+'\\n\\nحافظه دائمی پروژه:\\n'+memoryContext(8)+'\\n\\nشروع بحث:\\n';
  for(let round=1;round<=rounds;round++){
   msg('مدیر پروژه','🧩','دور '+round+' از '+rounds+' — هر عضو نظر قبلی را بررسی می‌کند و درباره همان کار پاسخ می‌دهد.','agent',false);
   for(const a of active){
    const placeholder={name:a.name,icon:a.icon,text:'دور '+round+' — در حال بررسی دیدگاه اعضا و ارائه نظر خود...',type:'agent',error:false};
    state.chat.push(placeholder);
    renderChat();
    try{
     let result;
     if(state.mode==='demo'){
      result='دور '+round+' — '+mockResponse(a,goal,transcript);
      if(round>1)result+='\\n\\nدر این دور، دیدگاه اعضای قبلی را بررسی کردم؛ موارد قابل اصلاح را نقد و پیشنهاد خودم را برای انجام این کار به‌روزرسانی کردم.';
     }else{
      const dialogueGoal=buildTeamRoster(active)+'\\n\\nکار/موضوعی که تیم باید درباره آن بحث کند:\\n'+goal+
        '\\n\\nاین دور '+round+' از '+rounds+' است. تو یکی از اعضای یک تیم چندعاملی هستی. دیدگاه و خروجی اعضای قبلی را دقیق بررسی کن. '+
        (round===1?'نظر اولیه و راه‌حل خودت را برای انجام این کار ارائه بده.':'اگر با نظر اعضای قبلی موافق نیستی، دقیقاً بگو کدام بخش را قبول نداری و دلیل فنی/منطقی بیاور؛ سپس راه‌حل خودت را اصلاح یا تکمیل کن.')+
        '\\n\\nقواعد بحث: فقط درباره همین کار صحبت کن؛ به خروجی قبلی‌ها ارجاع بده؛ نکات تکراری را کوتاه کن؛ اختلاف‌نظرها را شفاف کن؛ در پایان پیشنهاد عملی خودت را ارائه بده.';
      result=await callAgentResilient(a,dialogueGoal,transcript);
     }
     placeholder.text=result;
     placeholder.error=false;
     transcript+=(transcript?'\\n\\n':'')+'[دور '+round+' | '+a.name+']\\n'+result;
   transcript=compactContext(transcript,30000);
    }catch(e){
     dialogueHadError=true;
     placeholder.text='خطا: '+e.message;
     placeholder.error=true;
     transcript+=(transcript?'\\n\\n':'')+'[دور '+round+' | '+a.name+' - خطا]\\n'+e.message;
     transcript=compactContext(transcript,30000);
    }
    renderChat();
    save();
   }
  }

  const coordinator=active[active.length-1];
  let dialogueVotes=[];
  msg('داور تیم','🗳️','مرحله رأی‌گیری: هر عضو بهترین پیشنهاد را انتخاب می‌کند...','agent',false);
  for(const voter of active){
    try{
      let voteText;
      if(state.mode==='demo'){
        voteText=JSON.stringify({vote_for:coordinator.name,reason:'در حالت نمایشی، رأی برای تست جریان به هماهنگ‌کننده داده شد.'});
      }else{
        const voteGoal=buildTeamRoster(active)+'\\n\\nهدف تیم:\\n'+goal+
          '\\n\\nمتن کامل بحث و خروجی اعضا:\\n'+compactContext(transcript,26000)+
          '\\n\\nتو داور مستقل هستی. فقط بهترین پیشنهاد را از بین اعضا انتخاب کن. پاسخ را دقیقاً در یک JSON با دو کلید بده: vote_for (نام دقیق یکی از اعضا) و reason (دلیل کوتاه). نامی خارج از roster انتخاب نکن.';
        voteText=await callAgentResilient(voter,voteGoal,transcript);
      }
      let parsed=null;
      try{parsed=JSON.parse(String(voteText).replace(/\`/g,'').trim())}catch(e){
        const name=(active.find(a=>String(voteText).includes(a.name))||coordinator).name;
        parsed={vote_for:name,reason:String(voteText).slice(0,500)};
      }
      const target=active.find(a=>a.name===parsed.vote_for)||coordinator;
      dialogueVotes.push({voter:voter.name,vote_for:target.name,reason:String(parsed.reason||'').slice(0,800)});
    }catch(e){
      dialogueHadError=true;
      dialogueVotes.push({voter:voter.name,vote_for:null,reason:'رأی‌گیری این عضو ناموفق بود: '+e.message});
    }
  }
  const voteCounts={};
  dialogueVotes.forEach(v=>{if(v.vote_for)voteCounts[v.vote_for]=(voteCounts[v.vote_for]||0)+1});
  const voteLeader=Object.entries(voteCounts).sort((a,b)=>b[1]-a[1])[0]||null;
  msg('جمع‌بندی نهایی تیم','🧠','در حال تحلیل همه دورها و تولید تصمیم نهایی...','agent',false);
  const finalIndex=state.chat.length-1;
  let finalResult='';
  try{
   if(state.mode==='demo'){
    finalResult='جمع‌بندی نهایی برای «'+goal+'» آماده شد. دیدگاه اعضا در '+rounds+' دور بررسی شد و اختلاف‌ها برای تصمیم اجرایی نهایی در نظر گرفته شدند.';
   }else{
    const finalGoal=buildTeamRoster(active)+'\\n\\nموضوع/هدف تیم:\\n'+goal+
      '\\n\\nآرای مستقل اعضا:\\n'+JSON.stringify(dialogueVotes)+'\\n\\nنتیجه شمارش آرا:\\n'+JSON.stringify(voteCounts)+'\\n\\nبرنده اولیه رأی‌گیری: '+(voteLeader?voteLeader[0]+' ('+voteLeader[1]+' رأی)':'بدون برنده')+'\\n\\nتو هماهنگ‌کننده نهایی تیم هستی. کل بحث و خروجی همه اعضا و همه دورها را که در متن ورودی آمده بررسی کن. پاسخ نهایی باید یک تصمیم/راه‌حل قابل اجرا باشد، نه صرفاً تکرار بحث.\\n'+
      '\\nساختار اجباری خروجی:\\n1) نتیجه نهایی و پیشنهاد اصلی\\n2) دلایل و شواهد مهم از بحث\\n3) اختلاف‌نظرها و اینکه کدام دیدگاه پذیرفته شد و چرا\\n4) ریسک‌ها، ابهام‌ها و مواردی که هنوز نیاز به بررسی دارند\\n5) مراحل اجرایی بعدی به ترتیب اولویت\\n\\nفقط بر اساس اطلاعات موجود تصمیم‌گیری کن؛ اگر اطلاعات کافی نیست صریحاً بگو چه چیزی کم است و آن را به‌عنوان واقعیت قطعی نساز.';
    finalResult=await callAgentResilient(coordinator,finalGoal,transcript);
   }
   state.chat[finalIndex].text=finalResult;
   state.chat[finalIndex].error=false;
   transcript+='\\n\\n[جمع‌بندی نهایی | '+coordinator.name+']\\n'+finalResult;
   renderChat();
   save();
  }catch(e){
   dialogueHadError=true;
   state.chat[finalIndex].text='خطا در جمع‌بندی نهایی: '+e.message;
   state.chat[finalIndex].error=true;
   renderChat();
   save();
  }

  const dialogueSummary=String(finalResult||'').slice(0,5000);
  state.runs.unshift({
   id:runId,
   createdAt:new Date().toISOString(),
   goal:goal,
   mode:state.mode,
   type:'dialogue',
   rounds:rounds,
   members:active.map(function(a){return a.name}),
   summary:dialogueSummary,
   votes:dialogueVotes,
   voteCounts:voteCounts,
   messages:state.chat.slice()
  });
  state.runs=state.runs.slice(0,20);
  rememberRun(goal,dialogueSummary,active.map(function(a){return a.name}));
  msg('سیستم','✅',dialogueHadError?'بحث چندعاملی پایان یافت، اما یک یا چند مرحله خطا داشت؛ خروجی‌های موفق و خطاها حفظ شدند.':'بحث چندعاملی پایان یافت؛ همه دورها بررسی و یک جمع‌بندی نهایی اجرایی تولید شد.','agent',dialogueHadError);
 }catch(e){
  msg('سیستم','⚠️','اجرای گفت‌وگوی تیم با خطای غیرمنتظره متوقف شد: '+e.message,'agent',true);
 }finally{
  busy=false;
  document.getElementById('runBtn').disabled=false;
  document.getElementById('parallelBtn').disabled=false;
  document.getElementById('dialogueBtn').disabled=false;
  document.getElementById('adminChatBtn').disabled=false;
  document.getElementById('stopBtn').disabled=true;
  cancelRequested=false;
  save();
 }
}

function getWorkflowAgents(){
 const order=Array.isArray(state.workflowOrder)?state.workflowOrder:[],byId={};state.agents.forEach(function(a){byId[a.id]=a});
 return order.map(function(id){return byId[id]}).filter(Boolean).concat(state.agents.filter(function(a){return order.indexOf(a.id)<0}));
}
function applyWorkflowOrder(){state.workflowOrder=getWorkflowAgents().map(function(a){return a.id});save();render();}
function moveWorkflowAgent(id,delta){const list=getWorkflowAgents(),i=list.findIndex(function(a){return a.id===id}),j=i+delta;if(i<0||j<0||j>=list.length)return;[list[i],list[j]]=[list[j],list[i]];state.workflowOrder=list.map(function(a){return a.id});save();}
function openWorkflowBuilder(){
 let modal=document.getElementById('workflowBuilderModal');
 if(!modal){modal=document.createElement('div');modal.id='workflowBuilderModal';modal.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.74);z-index:2100;padding:12px;overflow:auto';modal.innerHTML='<div class="card" style="width:min(760px,100%);margin:30px auto;padding:18px"><div style="display:flex;justify-content:space-between;align-items:center"><div><h3 style="margin:0">Workflow Builder</h3><div class="tiny">ترتیب اجرای Agentها را تعیین کن.</div></div><button class="icon-btn" id="workflowClose">✕</button></div><div id="workflowList" style="margin-top:14px"></div><div class="notice" style="margin-top:12px">Agentهای غیرفعال یا انسانی در اجرای AI نادیده گرفته می‌شوند.</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn primary" id="workflowSave" style="width:auto">ذخیره Workflow</button><button class="btn" id="workflowReset" style="width:auto">بازنشانی</button></div></div>';document.body.appendChild(modal);
  document.getElementById('workflowClose').onclick=function(){modal.style.display='none'};document.getElementById('workflowSave').onclick=function(){applyWorkflowOrder();modal.style.display='none'};document.getElementById('workflowReset').onclick=function(){state.workflowOrder=state.agents.map(function(a){return a.id});save();renderWorkflowBuilder()};
 }
 function renderWorkflowBuilder(){const list=document.getElementById('workflowList'),agents=getWorkflowAgents();list.innerHTML=agents.length?agents.map(function(a,i){return '<div class="card" style="display:flex;align-items:center;gap:10px;margin:7px 0;padding:10px"><b>'+String(i+1)+'</b><div style="flex:1"><b>'+esc(a.name)+'</b><div class="tiny">'+esc(a.role||'عامل')+' · '+esc(a.model||'مدل پیش‌فرض')+'</div></div><button class="btn workflow-up" data-id="'+esc(a.id)+'" style="width:auto" '+(i?'':'disabled')+'>↑</button><button class="btn workflow-down" data-id="'+esc(a.id)+'" style="width:auto" '+(i===agents.length-1?'disabled':'')+'>↓</button></div>'}).join(''):'<div class="notice">هنوز Agentی ساخته نشده است.</div>';list.querySelectorAll('.workflow-up').forEach(function(b){b.onclick=function(){moveWorkflowAgent(b.dataset.id,-1);renderWorkflowBuilder()}});list.querySelectorAll('.workflow-down').forEach(function(b){b.onclick=function(){moveWorkflowAgent(b.dataset.id,1);renderWorkflowBuilder()}});}
 renderWorkflowBuilder();modal.style.display='block';
}
async function runTeamParallel(){
 cancelRequested=false;document.getElementById('stopBtn').disabled=false;
 if(busy)return;
 const goal=document.getElementById('goal').value.trim();
 state.teamName=document.getElementById('teamName').value.trim()||'تیم هوش مصنوعی من';
 state.goal=goal;
 if(!goal)return alert('اول هدف تیم را وارد کن.');
 const active=getWorkflowAgents().filter(function(a){return a.enabled&&a.kind!=='human'});
 if(!active.length)return alert('حداقل یک عضو هوش مصنوعی فعال لازم است.');
 busy=true;
 document.getElementById('runBtn').disabled=true;
 document.getElementById('parallelBtn').disabled=true;
 document.getElementById('dialogueBtn').disabled=true;
 document.getElementById('adminChatBtn').disabled=true;
 const runId=(crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now());
 state.runs=state.runs||[];
 state.chat=[];
 let parallelHadError=false;
 try{
  msg('شما','👤','هدف: '+goal,'user',false);
  msg('سیستم','⚡','اجرای موازی شروع شد؛ همه اعضای فعال مستقل روی یک زمینه مشترک کار می‌کنند.','agent',false);
  const baseContext=buildTeamRoster(active)+'\n\nهدف تیم:\n'+goal+'\n\nحافظه مرتبط پروژه:\n'+memoryContext(8,goal)+'\n\nقانون اجرای موازی: خروجی سایر اعضا هنوز در دسترس نیست؛ مستقل تحلیل کن و نتیجه تخصصی خودت را ارائه بده.';
  const results=await Promise.all(active.map(async function(a){
   const placeholder={name:a.name,icon:a.icon,text:'در حال اجرای موازی...',type:'agent',error:false};
   state.chat.push(placeholder);
   renderChat();
   try{
    const result=state.mode==='demo'?mockResponse(a,goal,state.chat):await callAgentResilient(a,baseContext,'',function(delta){placeholder.text=(placeholder.text||'').replace(/^در حال اجرای موازی\.\.\.$/,'')+delta;renderChat();});
    placeholder.text=result;
    placeholder.error=false;
    return {agent:a,result:result,error:null};
   }catch(e){
    parallelHadError=true;
    placeholder.text='خطا: '+e.message;
    placeholder.error=true;
    return {agent:a,result:'',error:e.message};
   }finally{renderChat();save();}
  }));
  if(cancelRequested)throw new Error('اجرای تیم توسط کاربر متوقف شد.');
  const successful=results.filter(function(x){return x.result});
  const transcript=compactContext(successful.map(function(x){return '[عضو '+x.agent.name+']\n'+x.result}).join('\n\n'),30000);
  let reviewTranscript='';
  if(state.mode!=='demo'){try{reviewTranscript=await reviewTeamOutputs(active,goal,transcript);}catch(e){reviewTranscript='خطای مرحله نقد: '+e.message;}}
  const coordinator=active[active.length-1];
  msg('جمع‌بندی تیم','🧠','خروجی‌های موازی آماده شد؛ در حال جمع‌بندی و حل اختلاف‌ها...','agent',false);
  const finalIndex=state.chat.length-1;
  let finalResult='';
  try{
   if(state.mode==='demo'){
    finalResult='اجرای موازی برای هدف «'+goal+'» انجام شد و خروجی اعضا برای جمع‌بندی در اختیار هماهنگ‌کننده قرار گرفت.';
   }else{
    const finalGoal=buildTeamRoster(active)+'\n\nهدف تیم:\n'+goal+
     '\n\nنقد مستقل و امتیازدهی:\n'+(reviewTranscript||'نقدی دریافت نشد.')+
     '\n\nوظیفه تو: به‌عنوان هماهنگ‌کننده نهایی، خروجی مستقل اعضا را مقایسه کن، اختلاف‌ها را مشخص کن، ادعاهای ضعیف یا بدون پشتوانه را علامت بزن و یک نتیجه اجرایی تولید کن.\n'+
     '\nساختار اجباری:\n1) نتیجه نهایی\n2) مهم‌ترین دلایل و شواهد\n3) اختلاف‌نظرها و تصمیم درباره آن‌ها\n4) ریسک‌ها و موارد نیازمند بررسی\n5) قدم‌های بعدی\n6) رأی‌گیری تحلیلی: برای هر خروجی موفق یک امتیاز 0 تا 10 از نظر صحت، ارتباط، قابلیت اجرا و پوشش مسئله بده و بر اساس مجموع امتیازها پیشنهاد برتر را انتخاب کن.\n7) نقد نهایی: حداقل دو ایراد یا فرضیه‌ای را که ممکن است نتیجه را ضعیف کند بررسی کن.\n\nفقط بر اساس اطلاعات ارائه‌شده تصمیم بگیر و کمبود اطلاعات را صریح اعلام کن.';
    finalResult=await callAgentResilient(coordinator,finalGoal,transcript?'خروجی اعضا:\n'+transcript:'هیچ خروجی موفقی دریافت نشد.');
   }
   state.chat[finalIndex].text=finalResult;
   state.chat[finalIndex].error=false;
  }catch(e){
   parallelHadError=true;
   state.chat[finalIndex].text='خطا در جمع‌بندی نهایی: '+e.message;
   state.chat[finalIndex].error=true;
  }
  renderChat();
  const summary=String(finalResult||'').slice(0,5000);
  state.runs.unshift({id:runId,createdAt:new Date().toISOString(),goal:goal,mode:state.mode,type:'parallel',members:active.map(function(a){return a.name}),summary:summary,messages:state.chat.slice()});
  state.runs=state.runs.slice(0,20);
  rememberRun(goal,summary,active.map(function(a){return a.name}));
  msg('سیستم','✅',parallelHadError?'اجرای موازی پایان یافت، اما یک یا چند عضو یا مرحله جمع‌بندی با خطا روبه‌رو شد.':'اجرای موازی پایان یافت. خروجی مستقل اعضا توسط هماهنگ‌کننده نهایی بررسی شد.','agent',parallelHadError);
 }catch(e){
  msg('سیستم','⚠️','اجرای موازی با خطای غیرمنتظره متوقف شد: '+e.message,'agent',true);
 }finally{
  busy=false;
  document.getElementById('runBtn').disabled=false;
  document.getElementById('parallelBtn').disabled=false;
  document.getElementById('dialogueBtn').disabled=false;
  document.getElementById('adminChatBtn').disabled=false;
  document.getElementById('stopBtn').disabled=true;
  cancelRequested=false;
  save();
 }
}
async function runTeam(){
 state.workflow=state.workflow||{name:'پیش‌فرض',steps:[]};

 cancelRequested=false;document.getElementById('stopBtn').disabled=false;
 if(busy)return;
 const goal=document.getElementById('goal').value.trim();
 state.teamName=document.getElementById('teamName').value.trim()||'تیم هوش مصنوعی من';
 state.goal=goal;
 if(!goal)return alert('اول هدف تیم را وارد کن.');
 const active=getWorkflowAgents().filter(function(a){return a.enabled&&a.kind!=='human'});
 const previousMemory=(state.chat||[]).slice(-12).map(function(m){return '['+(m.name||'عضو')+'] '+String(m.text||'').slice(0,1200)}).join('\\n');
 const relevantMemory=memoryContext(8,goal);
 if(!active.length)return alert('حداقل یک عضو هوش مصنوعی فعال لازم است.');
 busy=true;document.getElementById('runBtn').disabled=true;document.getElementById('parallelBtn').disabled=true;document.getElementById('dialogueBtn').disabled=true;document.getElementById('adminChatBtn').disabled=true;
 const runId=(crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now());
 state.runs=state.runs||[];
 state.chat=[];
 timelineReset(runId);
 timelineEvent('run',null,'اجرای زنجیره‌ای تیم شروع شد.',{agents:active.length});
 resetLiveRun(active);
 let teamHadError=false;
 msg('شما','👤','هدف: '+goal,'user',false);
 let transcript=buildTeamRoster(active)+'\\n\\nحافظه اخیر تیم:\\n'+(previousMemory||'موردی وجود ندارد.')+'\\n\\nشروع اجرای زنجیره‌ای تیم:\\n';
 try{ for(let i=0;i<active.length;i++){
  const a=active[i];
  timelineEvent('start',a,'شروع مرحله '+(i+1)+' از '+active.length+'.');
  const stageMessage={name:a.name,icon:a.icon,text:(i===0?'مرحله ۱ — در حال تحلیل اولیه...':'مرحله '+(i+1)+' — در حال بررسی خروجی اعضای قبلی...'),kind:'agent',error:false}; state.chat.push(stageMessage); renderChat();
  setLiveAgent(a,'running','');
  try{
   const knowledge=knowledgeContext(goal,5);
   const context=buildTeamRoster(active)+'\\n\\nهدف تیم:\\n'+goal+
    '\\n\\nدانش مرتبط پروژه:\\n'+knowledge+
    '\\n\\nتو عضو شماره '+(i+1)+' از '+active.length+' هستی و نقش تو «'+(a.role||'عضو تیم')+'» است.'+
    '\\nاین یک اجرای زنجیره‌ای است: خروجی اعضای قبلی را بررسی کن، خطاها یا کمبودهای آن‌ها را اصلاح کن و سپس خروجی خودت را به‌عنوان ورودی مرحله بعد کامل‌تر کن.'+
    '\\nاگر عضو قبلی راه‌حل ناقص یا اشتباهی داده، بدون تعارف آن بخش را مشخص و اصلاح کن.';
   setLiveAgent(a,'thinking','');
   timelineEvent('thinking',a,'Agent در حال تحلیل و تولید پاسخ است.');
   const result=state.mode==='demo'?mockResponse(a,goal,state.chat):await callAgentResilient(a,context,transcript,function(delta){stageMessage.text=(stageMessage.text||'').replace(/^مرحله [^—]+— در حال[^\n]*\.\.\.$/,'')+delta;liveDelta(a,delta);renderChat();});
   stageMessage.text=result;stageMessage.error=false;setLiveAgent(a,'completed',result);timelineEvent('complete',a,'مرحله با موفقیت تکمیل شد.',{outputLength:String(result||'').length});
   transcript+=(transcript?'\\n\\n':'')+'[مرحله '+(i+1)+' | '+a.name+']\\n'+result;
   transcript=compactContext(transcript,30000);
   renderChat();save();
  }catch(e){
   teamHadError=true;
   setLiveAgent(a,(cancelRequested||e.name==='AbortError')?'cancelled':'error',undefined,e.message);
   timelineEvent((cancelRequested||e.name==='AbortError')?'cancel':'error',a,(cancelRequested||e.name==='AbortError')?'مرحله لغو شد.':'مرحله با خطا پایان یافت.',{error:String(e.message||'')});
   stageMessage.text=(cancelRequested||e.name==='AbortError')?'⏹️ لغو شد: '+e.message:'خطا: '+e.message;stageMessage.error=true;
   renderChat();save();
   transcript+='\\n\\n[مرحله '+(i+1)+' | '+a.name+' - خطا]\\n'+e.message;
   transcript=compactContext(transcript,30000);
  }
 }
 const coordinator=active[active.length-1];
 let reviewTranscript='';
 timelineEvent('review',coordinator,'شروع نقد و بررسی خروجی‌های تیم.');
 if(state.mode!=='demo'){try{reviewTranscript=await reviewTeamOutputs(active,goal,transcript);}catch(e){reviewTranscript='خطای مرحله نقد: '+e.message;}}
 const finalMessage={name:'جمع‌بندی تیم',icon:'🧠',text:'در حال جمع‌بندی خروجی همه اعضا...',kind:'agent',error:false}; state.chat.push(finalMessage); renderChat();
 let finalResult='';
 try{
  if(state.mode==='demo'){
   finalResult='خلاصه اجرای تیم برای هدف «'+goal+'» آماده شد.\\n\\nخروجی اعضا به‌ترتیب بررسی و تکمیل شدند و آخرین عضو تیم نقش جمع‌بندی‌کننده را بر عهده گرفت.';
  }else{
   const finalGoal=buildTeamRoster(active)+'\\n\\nهدف تیم:\\n'+goal+
    '\\n\\nخروجی کامل مراحل زنجیره‌ای:\\n'+compactContext(transcript,24000)+
    '\\n\\nنقد مستقل اعضای منتخب:\\n'+(reviewTranscript||'نقد مستقلی دریافت نشد.')+
    '\\n\\nوظیفه نهایی: به‌عنوان هماهنگ‌کننده و داور نهایی، خروجی مراحل زنجیره‌ای و نقد مستقل را با هم بررسی کن. پاسخ نهایی باید یک تصمیم/راه‌حل اجرایی باشد، نه تکرار ساده خروجی اعضا. نقدها را جدی بگیر و اگر با نتیجه اعضا اختلاف دارند، اختلاف را توضیح بده و بر اساس شواهد تصمیم بگیر.'+
    '\\n\\nساختار اجباری خروجی:\\n۱) نتیجه نهایی و پیشنهاد اصلی\\n۲) مهم‌ترین دلایل و شواهد\\n۳) اختلاف‌نظرها و تصمیم درباره هر اختلاف\\n۴) نقدها و ایرادهای مهمی که پذیرفته یا رد شده‌اند\\n۵) ریسک‌ها، فرضیات و موارد نیازمند بررسی\\n۶) قدم‌های اجرایی بعدی به ترتیب اولویت\\n\\nفقط بر اساس اطلاعات موجود تصمیم‌گیری کن و چیزی را که در ورودی نیست به‌عنوان واقعیت قطعی نساز.';
   finalResult=await callAgentResilient(coordinator,finalGoal,transcript);
  }
  finalMessage.text=finalResult;finalMessage.error=false;
  timelineEvent('final',coordinator,'جمع‌بندی نهایی تولید شد.',{outputLength:String(finalResult||'').length});
  transcript+='\\n\\n[جمع‌بندی نهایی | '+coordinator.name+']\\n'+finalResult;
  renderChat();save();
 }catch(e){
  teamHadError=true;
  timelineEvent('error',coordinator,'جمع‌بندی نهایی با خطا مواجه شد.',{error:String(e.message||'')});
  finalMessage.text='خطا در جمع‌بندی نهایی: '+e.message;finalMessage.error=true;
  renderChat();save();
 }
 msg('سیستم','✅',teamHadError?'اجرای زنجیره‌ای تیم پایان یافت، اما یک یا چند مرحله یا جمع‌بندی با خطا روبه‌رو شد.':'اجرای زنجیره‌ای تیم تمام شد؛ خروجی هر عضو به مرحله بعد منتقل شد و جمع‌بندی نهایی تولید شد.','agent',teamHadError);
 const finalSummary=String(finalResult||'').slice(0,5000);
  rememberRun(goal,finalSummary,active.map(function(a){return a.name}));
  state.runs.unshift({id:runId,createdAt:new Date().toISOString(),goal:goal,mode:state.mode,type:'team',members:active.map(function(a){return a.name}),summary:finalSummary,messages:state.chat.slice()});
 state.runs=state.runs.slice(0,20);
 save();
 }catch(e){
  msg('سیستم','⚠️','اجرای زنجیره‌ای تیم با خطای غیرمنتظره متوقف شد: '+e.message,'agent',true);
  save();
 }finally{
  busy=false;
  document.getElementById('runBtn').disabled=false;
  document.getElementById('parallelBtn').disabled=false;
  document.getElementById('dialogueBtn').disabled=false;
  document.getElementById('adminChatBtn').disabled=false;
  document.getElementById('stopBtn').disabled=true;
  cancelRequested=false;
  finishLiveRun();
  save();
 }
}
function ensureTimeline(){if(!window.__aiTeamsTimeline)window.__aiTeamsTimeline={runId:null,startedAt:null,events:[],seq:0};return window.__aiTeamsTimeline;}
function timelineReset(runId){const t=ensureTimeline();t.runId=String(runId||'');t.startedAt=Date.now();t.events=[];t.seq=0;renderTimeline();}
function timelineEvent(type,agent,text,meta){const t=ensureTimeline();const now=Date.now();t.events.push({id:++t.seq,at:new Date(now).toISOString(),elapsed:t.startedAt?now-t.startedAt:0,type:String(type||'info'),agentId:agent&&agent.id||null,agentName:agent&&agent.name||'سیستم',text:String(text||''),meta:meta||null});if(t.events.length>200)t.events=t.events.slice(-200);renderTimeline();}
function timelineIcon(type){return ({run:'🚀',start:'▶️',thinking:'🧠',stream:'✍️',complete:'✅',error:'❌',cancel:'⏹️',retry:'🔁',skip:'⏭️',review:'🔎',final:'🏁',info:'ℹ️'})[type]||'•';}
function renderTimeline(){
 let el=document.getElementById('teamTimelinePanel');
 if(!el){el=document.createElement('div');el.id='teamTimelinePanel';el.className='card wide';el.style.marginTop='12px';const host=document.querySelector('.main .grid');if(host)host.appendChild(el);else return;}
 const t=ensureTimeline(),events=t.events||[];
 const rows=events.slice().reverse().map(function(e){const sec=Math.max(0,Math.floor(Number(e.elapsed||0)/1000));const mm=String(Math.floor(sec/60)).padStart(2,'0'),ss=String(sec%60).padStart(2,'0');return '<div style="display:grid;grid-template-columns:auto auto minmax(0,1fr);gap:8px;align-items:start;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span>'+timelineIcon(e.type)+'</span><span class="pill">'+mm+':'+ss+'</span><div><b style="font-size:10px">'+esc(e.agentName)+'</b><div class="tiny">'+esc(e.text)+'</div></div></div>';}).join('');
 el.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><h3 style="margin:0">🕒 Timeline اجرای تیم</h3><div class="tiny">'+(t.startedAt?'زمان سپری‌شده و رویدادهای اجرای فعلی':'هنوز اجرایی شروع نشده است.')+'</div></div><button class="btn" type="button" style="width:auto" onclick="timelineReset(ensureTimeline().runId)">پاک‌سازی</button></div><div style="margin-top:8px;max-height:260px;overflow:auto">'+(rows||'<div class="empty" style="min-height:100px">پس از اجرای تیم، Timeline اینجا نمایش داده می‌شود.</div>')+'</div>';
}
function ensureLiveRun(){if(!window.__aiTeamsLive)window.__aiTeamsLive={active:false,currentAgentId:null,statuses:{},outputs:{},errors:{},throttles:{}};return window.__aiTeamsLive;}
function liveStatusLabel(s){return ({waiting:'در انتظار',running:'در حال اجرا',thinking:'در حال فکر کردن',streaming:'در حال تولید',completed:'تکمیل شد',error:'خطا',cancelled:'لغو شد'})[s]||s;}
function liveStatusIcon(s){return ({waiting:'⏳',running:'⚙️',thinking:'🧠',streaming:'✍️',completed:'✅',error:'❌',cancelled:'⏹️'})[s]||'•';}
function setLiveAgent(a,status,output,error){const l=ensureLiveRun();if(!a)return;l.statuses[a.id]=status;l.currentAgentId=(status==='running'||status==='thinking'||status==='streaming')?a.id:l.currentAgentId;if(output!==undefined)l.outputs[a.id]=String(output||'').slice(-6000);if(error)l.errors[a.id]=String(error).slice(0,1000);renderLivePanel();}
function resetLiveRun(agents){const l=ensureLiveRun();l.active=true;l.currentAgentId=null;l.statuses={};l.outputs={};l.errors={};l.throttles={};(agents||[]).forEach(function(a){l.statuses[a.id]='waiting';l.outputs[a.id]='';});renderLivePanel();}
function finishLiveRun(){const l=ensureLiveRun();l.active=false;l.currentAgentId=null;renderLivePanel();}
function liveDelta(a,delta){const l=ensureLiveRun(),now=Date.now();l.outputs[a.id]=(l.outputs[a.id]||'')+String(delta||'');l.outputs[a.id]=l.outputs[a.id].slice(-6000);l.statuses[a.id]='streaming';l.currentAgentId=a.id;if(!l.throttles[a.id]||now-l.throttles[a.id]>120){l.throttles[a.id]=now;renderLivePanel();}}
function renderLivePanel(){
 let el=document.getElementById('liveAgentPanel');
 if(!el){el=document.createElement('div');el.id='liveAgentPanel';el.className='card wide';el.style.marginTop='12px';const host=document.querySelector('.main .grid');if(host)host.appendChild(el);else return;}
 const l=ensureLiveRun();
 const rows=(state.agents||[]).filter(function(a){return a.kind!=='human'}).map(function(a){
  const st=l.statuses[a.id]||'waiting'; const out=String(l.outputs[a.id]||'');
  return '<div style="padding:9px 0;border-top:1px solid rgba(255,255,255,.08)"><b>'+esc(a.icon||'🤖')+' '+esc(a.name)+'</b> <span class="role-pill">'+liveStatusIcon(st)+' '+liveStatusLabel(st)+'</span>'+
   (out?'<div class="tiny" style="margin-top:5px;white-space:pre-wrap;max-height:120px;overflow:auto">'+esc(out.slice(-1800))+'</div>':'')+
   (l.errors[a.id]?'<div class="tiny">⚠️ '+esc(l.errors[a.id])+'</div>':'')+'</div>';
 }).join('');
 el.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">📡 وضعیت زنده تیم</h3><span class="pill">'+(l.active?'● در حال اجرا':'آماده')+'</span></div><div class="tiny" style="margin:6px 0 10px">وضعیت لحظه‌ای Agentها و بخشی از خروجی زنده نمایش داده می‌شود.</div>'+rows;
}
function clearChat(){state.chat=[];save();renderChat()}
function exportConfig(){
 const safe=JSON.parse(JSON.stringify(state));safe.agents=safe.agents.map(function(a){return stripBrowserSecrets(a)});safe.providers=(safe.providers||[]).map(function(p){return stripBrowserSecrets(p)});
 const blob=new Blob([JSON.stringify(safe,null,2)],{type:'application/json;charset=utf-8'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ai-teams12-config.json';a.click();setTimeout(function(){URL.revokeObjectURL(a.href)},1000);
}

const __rightMembersState={key:'ai-teams-right-members-collapsed-v1'};
function applyRightMembers(){
 const b=document.getElementById('rightTeamMembersBody'),t=document.getElementById('rightTeamMembersBtn');
 if(!b||!t)return;
 b.style.setProperty('display','block','important');
 t.textContent='−';t.title='اعضای تیم';
}
function toggleRightMembers(){applyRightMembers()}
document.getElementById('rightTeamMembersToggle').onclick=toggleRightMembers;
applyRightMembers();
document.getElementById('addAgentBtn').onclick=addAgent;
const workflowBuilderBtn=document.getElementById('workflowBuilderBtn');if(workflowBuilderBtn)workflowBuilderBtn.onclick=openWorkflowBuilder;
document.getElementById('workflowBuilderBtn').onclick=openWorkflowBuilder;
document.getElementById('demoModeBtn').onclick=function(){setMode('demo')};
document.getElementById('realModeBtn').onclick=function(){setMode('real')};
document.getElementById('runBtn').onclick=runTeam;
document.getElementById('stopBtn').onclick=function(){if(!busy)return;cancelRequested=true;abortAllActiveRequests();msg('سیستم','■','درخواست توقف ثبت شد؛ درخواست‌های جاری لغو می‌شوند و Retry جدید شروع نخواهد شد.','agent',false);save();};
document.getElementById('parallelBtn').onclick=runTeamParallel;
document.getElementById('dialogueBtn').onclick=runDialogue;
document.getElementById('adminChatBtn').onclick=runAdminTurn;
document.getElementById('adminChatInput').addEventListener('keydown',function(ev){if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();runAdminTurn();}});
document.getElementById('clearChatBtn').onclick=clearChat;
document.getElementById('exportBtn').onclick=exportConfig;
document.getElementById('collapseBtn').onclick=function(){
 if(collapsed.size===state.agents.length)collapsed.clear();else state.agents.forEach(function(a){collapsed.add(a.id)});
 render();
};
document.getElementById('teamName').addEventListener('input',function(e){state.teamName=e.target.value;save();document.getElementById('teamTitle').textContent=state.teamName||'تیم هوش مصنوعی من'});
document.getElementById('goal').addEventListener('input',function(e){state.goal=e.target.value;save()});
render();
const __drawerState={key:'ai-teams-drawer-hidden-v1'};const __leftDrawerState={key:'ai-teams-left-drawer-hidden-v1'};
function applyDrawer(){var h=localStorage.getItem(__drawerState.key)==='1';document.querySelector('.app').classList.toggle('drawer-hidden',h);document.documentElement.classList.remove('boot-right-hidden');var b=document.getElementById('drawerToggle');if(b){b.textContent=h?'▶':'◀';b.title=h?'نمایش کشوی سمت راست':'مخفی کردن کشوی سمت راست';}}
function applyLeftDrawer(){var h=localStorage.getItem(__leftDrawerState.key)!=='0',s=document.getElementById('leftSidebar');document.querySelector('.app').classList.toggle('left-drawer-hidden',h);if(s)s.classList.toggle('open',!h);document.documentElement.classList.remove('boot-left-hidden');var b=document.getElementById('leftDrawerToggle');if(b){b.textContent=h?'◀':'▶';b.title=h?'نمایش کشوی سمت چپ':'مخفی کردن کشوی سمت چپ';}}
(function(){
  var r=document.getElementById('drawerToggle'),l=document.getElementById('leftDrawerToggle');
  function sync(){applyDrawer();applyLeftDrawer();}
  function openRight(){
    var hidden=localStorage.getItem(__drawerState.key)==='1';
    localStorage.setItem(__drawerState.key,hidden?'0':'1');
    if(hidden)localStorage.setItem(__leftDrawerState.key,'1');
    sync();
  }
  function openLeft(){
    var hidden=localStorage.getItem(__leftDrawerState.key)==='1';
    localStorage.setItem(__leftDrawerState.key,hidden?'0':'1');
    if(hidden)localStorage.setItem(__drawerState.key,'1');
    sync();
  }
  if(r)r.onclick=openRight;
  if(l)l.onclick=openLeft;
  sync();
  window.addEventListener('pageshow',sync);
})();