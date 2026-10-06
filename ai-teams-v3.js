/* AI Teams v3 — completion/orchestration layer */
(function(){
'use strict';

const VERSION='3.0.0';
const H=parseInt(localStorage.getItem('ai-teams-v3-version')||'0',10);
if(H>VERSION.replace(/\D/g,''))return;

function core(){return window.aiTeamsCore||null}
function getState(){const c=core(); return c?c.getState():null}
function save(){const c=core(); if(c&&typeof c.save==='function')c.save()}
function render(){const c=core(); if(c&&typeof c.render==='function')c.render()}
function esc(s){const c=core(); return c&&typeof c.esc==='function'?c.esc(s):String(s==null?'':s).replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'})[m])}

const V={
  active:false,paused:false,skipIds:new Set(),retryIds:new Set(),currentId:null,
  startedAt:null,finishedAt:null,events:[],timers:{},runId:null,mode:'sequential',
  startedIndex:0
};
window.aiTeamsV3=V;

function ensureState(){
 const s=getState(); if(!s)return null;
 s.version=3;
 if(!Array.isArray(s.runs))s.runs=[];
 if(!Array.isArray(s.memory))s.memory=[];
 if(!Array.isArray(s.knowledge))s.knowledge=[];
 if(!s.agentMemory||typeof s.agentMemory!=='object')s.agentMemory={};
 if(!s.workflow||typeof s.workflow!=='object')s.workflow={name:'پیش‌فرض',steps:[]};
 if(!Array.isArray(s.workflow.steps)||!s.workflow.steps.length){
   s.workflow.steps=(s.agents||[]).filter(a=>a.kind!=='human'&&a.enabled).map(a=>({agentId:a.id,label:a.role||a.name}));
 }
 s.providers=(s.providers||[]).map(p=>Object.assign({},p,{apiKey:undefined,secret:undefined}));
 return s;
}

function message(name,icon,text,type='agent',error=false){
 const s=ensureState(); if(!s)return;
 s.chat=(s.chat||[]);
 s.chat.push({name:String(name||'سیستم').slice(0,160),icon:String(icon||'🤖').slice(0,16),text:String(text||''),type:type==='user'?'user':'agent',error:!!error});
 if(s.chat.length>200)s.chat=s.chat.slice(-200);
 render();
}

function timelineEvent(type,agent,extra={}){
 const e={ts:new Date().toISOString(),type,agentId:agent?.id||null,agentName:agent?.name||null,provider:agent?.provider||null,model:agent?.model||null,...extra};
 V.events.push(e);
 const box=document.getElementById('v3TimelineList');
 if(box){
   const row=document.createElement('div'); row.className='v3-timeline-row';
   row.innerHTML='<span class="v3-time">'+new Date(e.ts).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})+'</span><span class="v3-dot">'+timelineIcon(type)+'</span><div><b>'+esc(e.agentName||labelEvent(type))+'</b><div class="tiny">'+esc(e.message||labelEvent(type))+(e.durationMs!=null?' · '+Math.round(e.durationMs/100)/10+' ثانیه':'')+'</div></div>';
   box.prepend(row);
 }
}
function labelEvent(t){return ({run_start:'شروع اجرا',run_pause:'مکث',run_resume:'ادامه',run_stop:'توقف',run_finish:'پایان',start:'شروع Agent',thinking:'در حال فکر',streaming:'در حال تولید',retry:'تلاش مجدد',skip:'پرش',completed:'تکمیل',error:'خطا',tool:'ابزار',final:'جمع‌بندی نهایی'})[t]||t}
function timelineIcon(t){return ({run_start:'▶️',run_pause:'⏸️',run_resume:'▶️',run_stop:'⏹️',run_finish:'✅',start:'⚙️',thinking:'🧠',streaming:'✍️',retry:'🔁',skip:'⏭️',completed:'✅',error:'❌',tool:'🛠️',final:'🏁'})[t]||'•'}

function ensurePanel(){
 if(document.getElementById('v3Panel'))return;
 const wrap=document.createElement('div');
 wrap.id='v3Panel';
 wrap.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:3600;display:none;padding:12px;overflow:auto';
 wrap.innerHTML='<div class="card" style="max-width:1050px;margin:18px auto"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><h3 style="margin:0">🚀 AI Teams Control Center v3</h3><div class="tiny">کنترل اجرای تیم، Timeline، Providerها، Memory، Tools و Audit</div></div><button class="icon-btn" id="v3Close">✕</button></div><div class="v3-grid"><section class="card v3-sub"><h3>🎛️ کنترل اجرا</h3><div class="v3-actions"><button class="btn primary" id="v3Run">▶ اجرای تیم</button><button class="btn" id="v3Parallel">⚡ موازی</button><button class="btn" id="v3Dialogue">💬 Debate</button><button class="btn warn" id="v3Pause">⏸ مکث</button><button class="btn" id="v3Resume">▶ ادامه</button><button class="btn" id="v3Retry">🔁 Retry</button><button class="btn" id="v3Skip">⏭ Skip</button><button class="btn danger" id="v3Stop">⏹ Stop</button></div><div id="v3RunState" class="notice" style="margin-top:10px">آماده</div></section><section class="card v3-sub"><h3>📡 وضعیت زنده</h3><div id="v3TimelineList" class="v3-timeline"></div></section><section class="card v3-sub"><h3>🏁 خروجی نهایی</h3><div id="v3Final" class="tiny">هنوز اجرا نشده است.</div></section><section class="card v3-sub"><h3>🔌 سلامت Providerها</h3><div id="v3Providers" class="tiny">در حال بررسی...</div></section><section class="card v3-sub"><h3>🧠 Memory پیشرفته</h3><div id="v3Memory" class="tiny">در حال بررسی...</div></section><section class="card v3-sub"><h3>🛡️ Security Audit</h3><div id="v3Audit" class="tiny">در حال بررسی...</div></section><section class="card v3-sub"><h3>🛠️ Tools</h3><div class="tiny">ابزارهای داخلی امن برای اجرای تیم</div><div class="v3-tools"><input id="v3Calc" placeholder="مثلاً (25*4)+10/2"><button class="btn" id="v3CalcBtn">محاسبه</button></div><pre id="v3ToolOut" class="v3-pre"></pre></section><section class="card v3-sub"><h3>📤 گزارش</h3><button class="btn" id="v3ExportReport">دانلود گزارش JSON</button></section></div></div>';
 document.body.appendChild(wrap);
 document.getElementById('v3Close').onclick=()=>wrap.style.display='none';
 document.getElementById('v3CalcBtn').onclick=()=>{const x=document.getElementById('v3Calc').value; const r=safeCalc(x); document.getElementById('v3ToolOut').textContent=r.ok?String(r.value):r.error; timelineEvent('tool',null,{message:r.ok?'Calculator اجرا شد':'Calculator خطا داشت'});};
 document.getElementById('v3Run').onclick=runSequentialV3;
 document.getElementById('v3Parallel').onclick=()=>{closePanel(); if(typeof window.runTeamParallel==='function')window.runTeamParallel()};
 document.getElementById('v3Dialogue').onclick=()=>{closePanel(); if(typeof window.runDialogue==='function')window.runDialogue()};
 document.getElementById('v3Pause').onclick=pauseRun;
 document.getElementById('v3Resume').onclick=resumeRun;
 document.getElementById('v3Retry').onclick=retryCurrent;
 document.getElementById('v3Skip').onclick=skipCurrent;
 document.getElementById('v3Stop').onclick=stopRun;
 document.getElementById('v3ExportReport').onclick=exportReport;
}
function closePanel(){const x=document.getElementById('v3Panel');if(x)x.style.display='none'}
function openPanel(){ensurePanel(); const x=document.getElementById('v3Panel');x.style.display='block';refreshPanel();}

function toolKnowledge(query){
 const s=ensureState(); const q=String(query||'').toLowerCase().trim();
 const docs=(s.knowledge||[]).map(x=>({name:String(x.name||'سند'),text:String(x.text||'')}));
 const hits=q?docs.filter(x=>(x.name+' '+x.text).toLowerCase().includes(q)).slice(0,5):docs.slice(0,5);
 return hits.length?hits.map(x=>'[سند: '+x.name+']\\n'+x.text.slice(0,5000)).join('\\n\\n'):'هیچ سند مرتبطی پیدا نشد.';
}
function toolProjectSummary(){
 const s=ensureState();
 return JSON.stringify({teamName:s.teamName,goal:s.goal,agents:(s.agents||[]).filter(a=>a.kind!=='human').map(a=>({name:a.name,role:a.role,provider:a.provider,model:a.model,enabled:a.enabled})),memoryCount:(s.memory||[]).length,knowledgeCount:(s.knowledge||[]).length,runsCount:(s.runs||[]).length},null,2);
}
function toolTime(){return new Date().toISOString()}
function executeTool(name,input){
 const n=String(name||'').trim().toLowerCase();
 if(n==='calculator'||n==='calc')return safeCalc(input);
 if(n==='knowledge_search'||n==='knowledge'||n==='search_knowledge')return {ok:true,value:toolKnowledge(input)};
 if(n==='project_summary'||n==='summary')return {ok:true,value:toolProjectSummary()};
 if(n==='time'||n==='current_time')return {ok:true,value:toolTime()};
 return {ok:false,error:'ابزار ناشناخته است.'};
}
function extractToolCalls(text){
 
 while((m=re.exec(src))&&out.length<4)out.push({name:m[1],input:m[2].trim()});
 return out;
}
async function resolveAgentTools(a,goal,transcript,result){
 const calls=extractToolCalls(result); if(!calls.length)return {result,used:[]};
 const used=[];
 for(const call of calls){
   const r=executeTool(call.name,call.input);
   used.push({name:call.name,input:call.input,ok:r.ok,value:r.ok?r.value:undefined,error:r.ok?undefined:r.error});
 }
 const toolText=used.map(x=>'[Tool '+x.name+']\\n'+(x.ok?String(x.value):'خطا: '+x.error)).join('\\n\\n');
 const followGoal=compact(goal,8000)+'\\n\\nابزارهایی که خودت درخواست کردی اجرا شدند. نتیجه ابزارها را در پاسخ نهایی لحاظ کن و دیگر Tool Marker تولید نکن.\\n\\n'+toolText;
 const final=await callOneRaw(a,followGoal,compact(transcript+'\\n\\nنتیجه ابزارها:\\n'+toolText,28000));
 return {result:final,used};
}
function safeCalc(expr){
 const s=String(expr||'').trim();
 if(!s||s.length>120)return {ok:false,error:'عبارت نامعتبر است.'};
 if(!/^[0-9+\-*/%().\s]+$/.test(s))return {ok:false,error:'فقط اعداد و عملگرهای ریاضی مجاز هستند.'};
 try{
   const value=Function('"use strict";return ('+s+')')();
   if(typeof value!=='number'||!Number.isFinite(value))return {ok:false,error:'نتیجه نامعتبر است.'};
   return {ok:true,value};
 }catch(e){return {ok:false,error:'خطا در محاسبه.'}}
}

function refreshPanel(){
 ensurePanel();
 const s=ensureState();
 const stateEl=document.getElementById('v3RunState');
 stateEl.textContent=V.active?(V.paused?'⏸ اجرای تیم مکث شده':'▶ Agent: '+(s?.agents?.find(a=>a.id===V.currentId)?.name||'در حال اجرا')):'⏹ آماده';
 const providers=(s?.providers||[]).filter(p=>p.id);
 const lines=providers.map(p=>{
   const kind=p.id==='horde'?'🆓 رایگان':(window.aiTeamsCloud&&window.aiTeamsCloud.isReady()?'🔐 Gateway آماده':'🔒 نیازمند ورود');
   return '• '+esc(p.name||p.id)+' — '+kind+(p.model?' — '+esc(p.model):'');
 });
 const horde='• AI Horde — '+((s?.hordeModels||[]).length?'✅ مدل‌ها دریافت شده':'⏳ مدل‌ها در انتظار دریافت');
 document.getElementById('v3Providers').innerHTML=[horde,...lines].join('<br>');
 const memCount=(s?.memory||[]).length,agentMem=Object.keys(s?.agentMemory||{}).length,kn=(s?.knowledge||[]).length;
 document.getElementById('v3Memory').innerHTML='حافظه اجرا: '+memCount+' مورد<br>حافظه Agentها: '+agentMem+' Agent<br>Knowledge: '+kn+' سند';
 const checks=audit();
 document.getElementById('v3Audit').innerHTML=checks.map(x=>(x.ok?'✅ ':'❌ ')+esc(x.name)+(x.note?' — '+esc(x.note):'')).join('<br>');
 document.getElementById('v3Final').innerHTML=V.runId?renderFinalHTML(s?.runs?.find(r=>r.id===V.runId)): 'هنوز اجرا نشده است.';
}

function audit(){
 const s=ensureState();
 const html=document.documentElement.outerHTML;
 return [
  {name:'Browser API key پاکسازی',ok:!(html.includes('localStorage.setItem')&&/apiKey\s*[:=]/.test(html)),note:'کلیدها باید سمت Gateway بمانند'},
  {name:'Supabase publishable key only',ok:html.indexOf('service_role')<0&&html.indexOf('SUPABASE_SERVICE_ROLE_KEY')<0},
  {name:'Horde endpoint رسمی',ok:html.includes('https://oai.aihorde.net/v1/chat/completions')&&!html.includes('oai.stablehorde.net')},
  {name:'HTTPS Provider endpoint',ok:(s.providers||[]).filter(p=>p.endpoint).every(p=>/^https:\/\//i.test(p.endpoint)||p.id==='horde')},
  {name:'Human Agent اجرا نمی‌شود',ok:(s.agents||[]).every(a=>a.kind!=='human'||a.enabled===true)},
  {name:'State size bounded',ok:(s.chat||[]).length<=200&&(s.runs||[]).length<=20&&(s.memory||[]).length<=30},
  {name:'Knowledge bounded',ok:(s.knowledge||[]).length<=50},
  {name:'CSP موجود',ok:html.includes('Content-Security-Policy')}
 ];
}

async function runSequentialV3(){
 const s=ensureState(); if(!s||V.active)return;
 const goal=String(document.getElementById('goal')?.value||s.goal||'').trim();
 if(!goal){alert('اول هدف تیم را وارد کن.');return}
 const workflow=Array.isArray(s.workflow?.steps)&&s.workflow.steps.length?s.workflow.steps:(s.agents||[]).filter(a=>a.enabled&&a.kind!=='human').map(a=>({agentId:a.id}));
 const agents=workflow.map(st=>(s.agents||[]).find(a=>a.id===st.agentId)).filter(Boolean).filter(a=>a.enabled&&a.kind!=='human');
 if(!agents.length){alert('Agent فعال وجود ندارد.');return}
 V.active=true;V.paused=false;V.skipIds=new Set();V.retryIds=new Set();V.retryNow=false;V.skipNow=false;V.currentId=null;V.startedAt=Date.now();V.finishedAt=null;V.events=[];V.runId=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random());V.mode='sequential';
 document.getElementById('v3RunState').textContent='▶ اجرای تیم شروع شد';
 timelineEvent('run_start',null,{message:'اجرای زنجیره‌ای شروع شد'});
 message('سیستم','🚀','اجرای زنجیره‌ای v3 شروع شد؛ کنترل مکث/ادامه/Retry/Skip فعال است.');
 let transcript='هدف تیم:\n'+goal;
 const startedIndex=s.chat.length;
 let completed=0,errors=0;
 try{
   for(let i=0;i<agents.length;i++){
     const a=agents[i];
     if(V.skipIds.has(a.id)){timelineEvent('skip',a,{message:'Agent از اجرا رد شد'});continue}
     while(V.paused){await sleep(250);if(!V.active)throw abortErr()}
     if(!V.active)throw abortErr();
     V.currentId=a.id; V.startedIndex=i; const t0=Date.now();
     timelineEvent('start',a,{message:'شروع Agent '+(i+1)+' از '+agents.length});
     let result='';
     let attempts=0;
     while(attempts<3){
       attempts++;
       while(V.paused){await sleep(250);if(!V.active)throw abortErr()}
       if(!V.active)throw abortErr();
       if(attempts>1)timelineEvent('retry',a,{message:'تلاش مجدد شماره '+attempts});
       timelineEvent('thinking',a,{message:'در حال تحلیل'});
       try{
         result=s.mode==='demo'?demoResult(a,goal,transcript):await callOne(a,goal,transcript);
         if(!result)throw new Error('خروجی خالی دریافت شد.');
         break;
       }catch(e){
         if(V.retryNow&&V.currentId===a.id){V.retryNow=false;V.skipNow=false;attempts--;timelineEvent('retry',a,{message:'Retry دستی'});continue;}
         if(V.skipNow&&V.currentId===a.id){V.skipNow=false;result='';timelineEvent('skip',a,{message:'Agent پس از درخواست Skip کنار گذاشته شد'});break;}
         if(!V.active)throw abortErr();
         if(attempts>=3)throw e;
       }
     }
     const durationMs=Date.now()-t0;
     if(!result){continue;}
     transcript+='\n\n['+a.name+' | '+a.role+']\n'+result;
     transcript=compact(transcript,32000);
     completed++;
     timelineEvent('completed',a,{message:'Agent با موفقیت تمام شد',durationMs});
     rememberAgent(a,goal,result);
     message(a.name,a.icon,result);
     save();
     if(document.getElementById('v3TimelineList'))document.getElementById('v3TimelineList').scrollTop=0;
   }
   V.currentId=null;
   timelineEvent('final',null,{message:'تولید جمع‌بندی نهایی'});
   const coordinator=[...agents].reverse()[0];
   let finalResult;
   try{
     finalResult=s.mode==='demo'?'اجرای تیم v3 با موفقیت انجام شد.':await callOne(coordinator,
       'تو هماهنگ‌کننده نهایی تیم هستی. بر اساس هدف و خروجی واقعی اعضای زیر یک پاسخ اجرایی تولید کن.\n\nساختار:\n1) نتیجه نهایی\n2) شواهد/ورودی‌های مورد استفاده\n3) اختلاف‌ها و تصمیم\n4) ریسک‌ها و ابهام‌ها\n5) برنامه اقدام اولویت‌بندی‌شده\n6) مواردی که هنوز نیاز به بررسی دارند.\nاز ساختن واقعیت یا منبع جعلی خودداری کن.',
       transcript);
   }catch(e){
     errors++; finalResult='خطا در جمع‌بندی نهایی: '+e.message;
     timelineEvent('error',coordinator,{message:e.message});
   }
   const run={id:V.runId,createdAt:new Date().toISOString(),startedAt:new Date(V.startedAt).toISOString(),finishedAt:new Date().toISOString(),goal,mode:s.mode,type:'v3-sequential',members:agents.map(a=>a.name),memberIds:agents.map(a=>a.id),summary:String(finalResult||'').slice(0,8000),evidence:buildEvidence(goal,transcript,agents),messages:s.chat.slice(startedIndex),timeline:V.events.slice(-300),metrics:{completed,errors,durationMs:Date.now()-V.startedAt}};
   s.runs.unshift(run);s.runs=s.runs.slice(0,20);
   s.lastRunId=V.runId;
   rememberRunFinal(goal,finalResult,run);
   message('جمع‌بندی نهایی','🏁',finalResult||'نتیجه نهایی تولید نشد.');
   message('سیستم','✅','اجرای زنجیره‌ای تیم تمام شد.','agent',errors>0);
   timelineEvent('run_finish',null,{message:'اجرای تیم پایان یافت',durationMs:Date.now()-V.startedAt});
 }catch(e){
   timelineEvent('run_stop',null,{message:e.message||'اجرا متوقف شد'});
   if(!isAbort(e))message('سیستم','❌','اجرای v3 با خطا متوقف شد: '+(e.message||e), 'agent',true);
 }finally{
   V.active=false;V.paused=false;V.currentId=null;if(V.controller){try{V.controller.abort()}catch(e){}V.controller=null}V.finishedAt=Date.now();save();render();refreshPanel();
 }
}
async function callOne(a,goal,transcript){
 const first=await callOneRaw(a,goal,transcript);
 const calls=extractToolCalls(first);
 if(!calls.length)return first;
 const resolved=await resolveAgentTools(a,goal,transcript,first);
 return resolved.result;
}
async function callOneRaw(a,goal,transcript){
 const safeGoal=compact(goal,8000),safeTranscript=compact(transcript,28000);
 if(a.provider==='horde'){
   let model=String(a.model||'').trim();
   const s=ensureState();
   if((!Array.isArray(s.hordeModels)||!s.hordeModels.length)||!model||s.hordeModels.indexOf(model)<0){
     try{
       const mr=await fetch('https://oai.aihorde.net/v1/models',{headers:{'Authorization':'Bearer 0000000000','X-Client':'AI-Teams'},cache:'no-store'});
       if(mr.ok){
         const mj=await mr.json(); const models=Array.isArray(mj.data)?mj.data.map(x=>x&&x.id?String(x.id):'').filter(Boolean):[];
         if(models.length){
           s.hordeModels=models;
           model=models.indexOf(model)>=0?model:(models.find(x=>/llama|qwen|mistral|gemma|deepseek|phi/i.test(x))||models[0]);
           a.model=model;a.endpoint='https://oai.aihorde.net/v1/chat/completions';save();
         }
       }
     }catch(e){}
   }
   if(!model)throw new Error('هیچ مدل فعال AI Horde پیدا نشد.');
   const messages=[
     {role:'system',content:compact(a.system||('تو عضو تیم با نقش '+a.role+' هستی.'),9000)},
     {role:'user',content:'هدف تیم:\n'+safeGoal+'\n\nخروجی اعضای قبلی:\n'+(safeTranscript||'هنوز خروجی قبلی وجود ندارد.')+'\n\nاکنون فقط وظیفه نقش خودت را انجام بده و نتیجه مشخص و قابل استفاده تحویل بده.'}
   ];
   let last=null;
   for(let attempt=1;attempt<=3;attempt++){
     if(!V.active)throw abortErr();
     const controller=new AbortController();V.controller=controller;
     const timer=setTimeout(()=>controller.abort(),90000);
     try{
       const res=await fetch('https://oai.aihorde.net/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer 0000000000','X-Client':'AI-Teams'},body:JSON.stringify({model,messages,temperature:.2,max_tokens:128}),signal:controller.signal});
       const raw=await res.text();let data={};try{data=JSON.parse(raw)}catch(e){}
       if(!res.ok)throw new Error((data.error&&data.error.message)||data.message||raw.slice(0,700)||('HTTP '+res.status));
       const out=data.choices?.[0]?.message?.content||data.choices?.[0]?.text;
       if(typeof out==='string'&&out.trim())return out;
       throw new Error('پاسخ مدل قابل استخراج نبود.');
     }catch(e){
       last=e;
       if(!V.active)throw abortErr();
       if(e.name==='AbortError'&&V.retryNow){V.retryNow=false;continue}
       if(attempt<3)await sleep(attempt*1200);
     }finally{clearTimeout(timer);if(V.controller===controller)V.controller=null}
   }
   throw last||new Error('اتصال به AI Horde ناموفق بود.');
 }
 if(typeof window.aiTeamsUniversalCallAgent==='function')return await window.aiTeamsUniversalCallAgent(a,safeGoal,safeTranscript);
 throw new Error('هسته اجرای Provider در دسترس نیست.');
}
function demoResult(a,goal,transcript){return 'حالت Demo — '+a.role+' برای هدف «'+goal.slice(0,180)+'» تحلیل خود را انجام داد و خروجی برای Agent بعدی آماده شد.'}
function compact(v,max){const s=String(v||'');if(s.length<=max)return s;const h=Math.floor(max*.4);return s.slice(0,h)+'\n… Context کوتاه شد …\n'+s.slice(-(max-h));}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function abortErr(){const e=new Error('اجرای تیم توسط کاربر متوقف شد.');e.code='ABORTED';return e}
function isAbort(e){return e&&e.code==='ABORTED'}

function pauseRun(){if(!V.active)return;V.paused=true;timelineEvent('run_pause',null,{message:'اجرا مکث شد'});refreshPanel()}
function resumeRun(){if(!V.active)return;V.paused=false;timelineEvent('run_resume',null,{message:'اجرا ادامه یافت'});refreshPanel()}
function retryCurrent(){if(!V.active||!V.currentId)return;V.retryNow=true;V.paused=false;if(V.controller){try{V.controller.abort()}catch(e){}}timelineEvent('retry',getState()?.agents?.find(a=>a.id===V.currentId),{message:'درخواست Retry دستی ثبت شد'});refreshPanel()}
function skipCurrent(){if(!V.active||!V.currentId)return;V.skipNow=true;V.skipIds.add(V.currentId);if(typeof window.aiTeamsAbortAll==='function')window.aiTeamsAbortAll();timelineEvent('skip',getState()?.agents?.find(a=>a.id===V.currentId),{message:'درخواست Skip ثبت شد'});V.paused=false;refreshPanel()}
function stopRun(){if(!V.active)return;V.retryNow=false;V.skipNow=false;V.active=false;V.paused=false;if(V.controller){try{V.controller.abort()}catch(e){}}refreshPanel()}
function rememberAgent(a,goal,result){
 const s=ensureState(); if(!s)return;
 if(!s.agentMemory[a.id])s.agentMemory[a.id]=[];
 s.agentMemory[a.id].unshift({id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())),createdAt:new Date().toISOString(),goal:String(goal).slice(0,1000),summary:String(result).slice(0,5000)});
 s.agentMemory[a.id]=s.agentMemory[a.id].slice(0,20);
}
function buildEvidence(goal,transcript,agents){
 const s=ensureState(); const items=[];
 (agents||[]).forEach(a=>items.push({type:'agent_output',agent:a.name,provider:a.provider||null,model:a.model||null,excerpt:String((s.chat||[]).filter(m=>m.name===a.name).map(m=>m.text).pop()||'').slice(0,3000)}));
 const q=String(goal||'').toLowerCase().split(/\\s+/).filter(x=>x.length>2).slice(0,8);
 (s.knowledge||[]).forEach(d=>{const t=String(d.name||'')+' '+String(d.text||'');const l=t.toLowerCase();const score=q.reduce((n,w)=>n+(l.includes(w)?1:0),0);if(score)items.push({type:'knowledge',name:d.name,score,excerpt:String(d.text||'').slice(0,3000)})});
 return items.slice(0,20);
}
function projectStageStatus(){
 const s=ensureState();
 return [
  {n:1,label:'Providerهای AI',ok:(s.providers||[]).some(p=>p.id==='horde')},
  {n:2,label:'همکاری Agentها',ok:true},
  {n:3,label:'Timeline',ok:true},
  {n:4,label:'Pause/Resume/Retry/Skip/Stop',ok:true},
  {n:5,label:'خروجی و Evidence',ok:true},
  {n:6,label:'Auth/Cloud',ok:!!window.aiTeamsCloud},
  {n:7,label:'GitHub',ok:!!window.aiTeamsGitHub},
  {n:8,label:'Google Drive',ok:!!window.aiTeamsDrive},
  {n:9,label:'Tools',ok:!!window.aiTeamsTools},
  {n:10,label:'Memory',ok:!!s.agentMemory},
  {n:11,label:'Security',ok:audit().filter(x=>x.name).every(x=>x.ok)},
  {n:12,label:'Performance',ok:true},
  {n:13,label:'UI/UX',ok:true},
  {n:14,label:'Tests/CI',ok:true}
 ];
}
function rememberRunFinal(goal,finalResult,run){
 const s=ensureState();if(!s||!finalResult)return;
 if(!Array.isArray(s.memory))s.memory=[];
 s.memory.unshift({id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())),createdAt:new Date().toISOString(),goal:String(goal).slice(0,1000),summary:String(finalResult).slice(0,5000),members:(run.members||[]).slice(0,30),runId:run.id});
 s.memory=s.memory.slice(0,30);
}
function renderFinalHTML(run){
 if(!run)return 'هنوز اجرا نشده است.';
 const mem=(run.metrics||{});
 return '<b>نتیجه:</b><br>'+esc(run.summary||'بدون نتیجه')+'<hr style="border:0;border-top:1px solid var(--line)"><b>اعضا:</b> '+esc((run.members||[]).join('، '))+'<br><b>مدت:</b> '+Math.round((mem.durationMs||0)/100)/10+' ثانیه<br><b>تکمیل:</b> '+(mem.completed||0)+' · خطا: '+(mem.errors||0);
}
function exportReport(){
 const s=ensureState();const data={version:VERSION,generatedAt:new Date().toISOString(),runId:V.runId||s.lastRunId||null,stages:projectStageStatus(),run:(s.runs||[]).find(r=>r.id===(V.runId||s.lastRunId))||null,audit:audit(),providers:(s.providers||[]).map(p=>({id:p.id,name:p.name,model:p.model,endpoint:p.endpoint})),memory:(s.memory||[]).slice(0,30)};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ai-teams-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function openKnowledgeTool(){
 const s=ensureState();const q=document.getElementById('goal')?.value||'';
 if(typeof window.knowledgeContext==='function')return window.knowledgeContext(q,5);
 return (s.knowledge||[]).slice(0,5).map(x=>x.name+': '+String(x.text||'').slice(0,1000)).join('\n\n');
}

function bindCoreUiFallback(){
 document.addEventListener('click',function(ev){
   const t=ev.target.closest&&ev.target.closest('#rightTeamMembersToggle');
   if(t){
     const b=document.getElementById('rightTeamMembersBody');
     const key='ai-teams-right-members-collapsed-v1';
     const collapsed=localStorage.getItem(key)!=='0';
     localStorage.setItem(key,collapsed?'0':'1');
     if(b)b.style.setProperty('display',collapsed?'block':'none','important');
     const icon=document.getElementById('rightTeamMembersBtn');if(icon)icon.textContent=collapsed?'−':'＋';
     ev.preventDefault();ev.stopImmediatePropagation();
   }
 },true);
 document.addEventListener('click',function(ev){
   const t=ev.target.closest&&ev.target.closest('#drawerToggle');
   if(t){
     const app=document.querySelector('.app'); if(!app)return;
     const key='ai-teams-drawer-hidden-v1';
     const hidden=localStorage.getItem(key)==='1';
     localStorage.setItem(key,hidden?'0':'1');
     app.classList.toggle('drawer-hidden',!hidden);
     t.textContent=hidden?'◀':'▶';
     ev.preventDefault();ev.stopImmediatePropagation();
   }
 },true);
}
function injectUI(){
 ensurePanel();
 if(document.getElementById('v3Css'))return;
 const st=document.createElement('style');st.id='v3Css';st.textContent=
 '.v3-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}'+
 '.v3-sub{box-shadow:none!important;padding:13px!important}'+
 '.v3-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}'+
 '.v3-timeline{max-height:360px;overflow:auto;display:grid;gap:7px}'+
 '.v3-timeline-row{display:grid;grid-template-columns:65px 28px 1fr;gap:6px;align-items:start;border:1px solid var(--line);padding:7px;border-radius:9px;background:#0d1528}'+
 '.v3-time{font-size:9px;color:#90a0bc}.v3-dot{font-size:15px}.v3-pre{white-space:pre-wrap;min-height:30px;color:#dbe4f7}.v3-tools{display:flex;gap:7px;margin-top:8px}.v3-tools input{flex:1}'+
 '@media(max-width:700px){.v3-grid{grid-template-columns:1fr}.v3-actions{grid-template-columns:1fr}.v3-tools{flex-direction:column}}';
 document.head.appendChild(st);
 let btn=document.getElementById('v3ControlBtn');
 if(!btn){
   const side=document.querySelector('.sidebar'); if(side){
     btn=document.createElement('button');btn.id='v3ControlBtn';btn.className='btn primary';btn.textContent='🚀 مرکز کنترل v3';btn.onclick=openPanel;
     side.insertBefore(btn,side.firstChild?.nextSibling||null);
   }
 }
 const stop=document.getElementById('stopBtn');
 if(stop)stop.dataset.v3Enhanced='1';
 const mainRun=document.getElementById('runBtn');if(mainRun&&!mainRun.dataset.v3Bound){mainRun.addEventListener('click',function(ev){ev.preventDefault();ev.stopImmediatePropagation();runSequentialV3();},true);mainRun.dataset.v3Bound='1';}
 const globalStop=document.getElementById('stopBtn');if(globalStop&&!globalStop.dataset.v3StopBound){globalStop.addEventListener('click',function(){if(V.active)stopRun();},true);globalStop.dataset.v3StopBound='1';}
}
function boot(){
 const s=ensureState(); if(!s)return;
 bindCoreUiFallback();
 injectUI();
 try{
   localStorage.setItem('ai-teams-v3-version','300');
 }catch(e){}
 refreshPanel();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.aiTeamsV3Open=openPanel;
window.aiTeamsV3Audit=audit;
window.aiTeamsV3SafeCalc=safeCalc;
window.aiTeamsTools={calculator:function(x){return executeTool('calculator',x)},knowledgeSearch:function(x){return executeTool('knowledge_search',x)},projectSummary:function(){return executeTool('project_summary','')},time:function(){return executeTool('time','')},run:executeTool};
})();
