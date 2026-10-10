/* AI Teams Cloud Storage - Supabase */
(function(){
'use strict';

const CONFIG_KEY='ai-teams-supabase-config-v1';
const LOCAL_KEY='ai-teams12-cloud-project-id-v1';
const TABLE='ai_teams_projects';
const SCRIPT_SRC='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2';
const MAX_STATE_BYTES=900000;
const MAX_PROJECT_NAME=200;
const CONFIG={url:'https://gqymrljvbkxlgyvoykpv.supabase.co',publishableKey:"sb_publishable_qjQu9JBbYue3gIA7WiRulA_8dSxjQbY"};

function normalizeUrl(value){
  try{const u=new URL(String(value||'').trim());if(u.protocol!=='https:')return '';return u.origin;}catch(e){return '';}
}
function readConfig(){
  try{
    const x=JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}');
    const u=normalizeUrl(x.url),k=String(x.publishableKey||'').trim();
    if(u&&k){CONFIG.url=u;CONFIG.publishableKey=k;}
  }catch(e){}
}
function saveConfig(url,key){
  const u=normalizeUrl(url),k=String(key||'').trim();
  if(!u||!k||k.length>2000)throw new Error('Project URL یا Publishable Key معتبر نیست.');
  CONFIG.url=u;CONFIG.publishableKey=k;
  localStorage.setItem(CONFIG_KEY,JSON.stringify({version:2,url:u,publishableKey:k}));
}
function configured(){return !!normalizeUrl(CONFIG.url)&&!!CONFIG.publishableKey&&CONFIG.publishableKey.indexOf('YOUR_')!==0;}
function createProjectId(){
  const c=window.crypto;
  if(c&&typeof c.randomUUID==='function')return c.randomUUID();
  return 'project-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,16);
}
function projectId(){
  let id=String(localStorage.getItem(LOCAL_KEY)||'');
  if(!/^[A-Za-z0-9_-]{8,120}$/.test(id)){
    id=createProjectId();
    localStorage.setItem(LOCAL_KEY,id);
  }
  return id;
}
const RECOVERY_KEY='ai-teams-recovery-snapshots-v1';
function saveRecoverySnapshot(source,state){
  const snapshot={source:String(source||'unknown'),savedAt:new Date().toISOString(),projectId:projectId(),state:JSON.parse(JSON.stringify(state))};
  let history=[];
  try{history=JSON.parse(localStorage.getItem(RECOVERY_KEY)||'[]');if(!Array.isArray(history))history=[];}catch(_){history=[];}
  history.unshift(snapshot);history=history.slice(0,5);
  try{localStorage.setItem(RECOVERY_KEY,JSON.stringify(history));}
  catch(e){throw new Error('برای جلوگیری از ازدست‌رفتن اطلاعات، بازیابی ابری متوقف شد؛ فضای ذخیره مرورگر کافی نیست.');}
}
function validateState(s){
  if(!s||typeof s!=='object'||Array.isArray(s))throw new Error('ساختار پروژه معتبر نیست.');
  const copy=JSON.parse(JSON.stringify(s));
  if(!Array.isArray(copy.agents)||copy.agents.length>50)throw new Error('تعداد اعضای پروژه نامعتبر است.');
  if(JSON.stringify(copy).length>MAX_STATE_BYTES)throw new Error('حجم پروژه برای ذخیره ابری بیش از حد مجاز است.');
  return copy;
}
let supabase=null,cloudReady=false,cloudUser=null,saving=false,saveQueued=false,applyingRemote=false;

function loadScript(){
  return new Promise(function(resolve,reject){
    if(window.supabase){resolve();return;}
    const s=document.createElement('script');s.src=SCRIPT_SRC;
    s.onload=resolve;s.onerror=function(){reject(new Error('کتابخانه ذخیره‌سازی ابری بارگذاری نشد.'));};
    document.head.appendChild(s);
  });
}
function panel(){
  if(document.getElementById('cloudStoragePanel'))return;
  const el=document.createElement('div');el.id='cloudStoragePanel';
  el.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:3000;padding:16px;overflow:auto;display:none';
  el.innerHTML='<div class="card" style="max-width:620px;margin:30px auto;background:#121a2d">'+
  '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0">☁ ذخیره‌سازی ابری</h3><button class="icon-btn" id="cloudClose">✕</button></div>'+
  '<div id="cloudStatus" class="notice" style="margin-top:12px">در حال بررسی اتصال...</div>'+
  '<div id="cloudAuth" style="margin-top:12px">'+
  '<div class="notice">Project URL و Publishable Key محرمانه نیستند و فقط تنظیم اتصال هستند. Secretهای Gateway هرگز در مرورگر ذخیره نمی‌شوند.</div>'+
  '<div class="field"><label>Supabase Project URL</label><input id="cloudProjectUrl" placeholder="https://xxxx.supabase.co"></div>'+
  '<div class="field"><label>Supabase Publishable Key</label><input id="cloudPublishableKey" type="password" placeholder="sb_publishable_..."></div>'+
  '<div class="actions"><button class="btn" style="width:auto" id="cloudSaveConfig">ذخیره تنظیمات Supabase</button></div>'+
  '<div class="field"><label>ایمیل</label><input id="cloudEmail" type="email" autocomplete="email" placeholder="ایمیل حساب"></div>'+
  '<div class="field"><label>رمز عبور</label><input id="cloudPassword" type="password" autocomplete="current-password" placeholder="حداقل ۸ کاراکتر"></div>'+
  '<div class="actions"><button class="btn primary" style="width:auto" id="cloudSignIn">ورود</button><button class="btn" style="width:auto" id="cloudGoogleSignIn">🔵 ورود با Google</button><button class="btn" style="width:auto" id="cloudSignUp">ساخت حساب</button></div><div class="actions" style="margin-top:6px"><button class="btn" style="width:auto" id="cloudResend">ارسال مجدد تأیید ایمیل</button><button class="btn" style="width:auto" id="cloudReset">بازیابی رمز</button></div></div>'+
  '<div id="cloudUserBox" style="display:none;margin-top:12px"><div class="tiny" id="cloudUserText"></div>'+
  '<div class="actions"><button class="btn primary" style="width:auto" id="cloudSync">☁ همگام‌سازی الآن</button><button class="btn" style="width:auto" id="cloudSignOut">خروج</button></div></div>'+
  '<div class="notice" style="margin-top:12px">هر حساب فقط به پروژه‌های خودش دسترسی دارد. پروژه‌های ابری حذف خودکار نمی‌شوند.</div>'+
  '<div class="actions" style="margin-top:12px"><button class="btn" style="width:auto" id="cloudClose2">بستن</button></div></div>';
  document.body.appendChild(el);
  document.getElementById('cloudClose').onclick=closePanel;
  document.getElementById('cloudClose2').onclick=closePanel;
  document.getElementById('cloudSignIn').onclick=signIn;
  document.getElementById('cloudGoogleSignIn').onclick=signInWithGoogle;
  document.getElementById('cloudSignUp').onclick=signUp;
  document.getElementById('cloudResend').onclick=resendConfirmation;
  document.getElementById('cloudReset').onclick=resetPassword;
  document.getElementById('cloudSignOut').onclick=function(){signOut().catch(function(e){alert('خروج ناموفق بود: '+e.message);});};
  document.getElementById('cloudSaveConfig').onclick=function(){
    const u=document.getElementById('cloudProjectUrl').value.trim(),k=document.getElementById('cloudPublishableKey').value.trim();
    try{saveConfig(u,k);location.reload();}catch(e){alert(e.message);}
  };
  document.getElementById('cloudSync').onclick=function(){syncNow(true);};
}
function status(t,good){
  const x=document.getElementById('cloudStatus');if(x){x.textContent=t;x.className='notice'+(good?'':' warn');}
}
function openPanel(){panel();const el=document.getElementById('cloudStoragePanel');if(el)el.style.setProperty('display','block','important');refreshAuthUI();}
function closePanel(){const x=document.getElementById('cloudStoragePanel');if(x)x.style.display='none';}
function refreshAuthUI(){
  const cu=document.getElementById('cloudProjectUrl'),ck=document.getElementById('cloudPublishableKey');
  if(cu)cu.value=configured()?CONFIG.url:'';
  if(ck)ck.value=configured()?CONFIG.publishableKey:'';
  const auth=document.getElementById('cloudAuth'),box=document.getElementById('cloudUserBox');
  if(!cloudReady){status(configured()?'در حال آماده‌سازی اتصال Supabase...':'اتصال ابری نیاز به تنظیم Supabase دارد.',false);return;}
  if(cloudUser){auth.style.display='none';box.style.display='block';document.getElementById('cloudUserText').textContent='وارد شده: '+(cloudUser.email||cloudUser.id);status('ذخیره‌سازی ابری فعال است.',true);}
  else{auth.style.display='block';box.style.display='none';status('برای ذخیره دائمی ابری، وارد حساب شو.',false);}
}
async function init(){
  panel();
  if(!document.getElementById('cloudStorageBtn')){
    const btn=document.createElement('button');btn.id='cloudStorageBtn';btn.className='btn';btn.textContent='☁ ذخیره‌سازی ابری';
    const sidebar=document.querySelector('.sidebar');if(sidebar){const reset=document.getElementById('resetBtn');if(reset)sidebar.insertBefore(btn,reset);else sidebar.appendChild(btn);btn.onclick=function(e){if(e)e.preventDefault();openPanel();};btn.addEventListener('click',openPanel);}
  }
  if(!configured()){refreshAuthUI();return;}
  try{
    await loadScript();
    supabase=window.supabase.createClient(CONFIG.url,CONFIG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    cloudReady=true;
    const session=await supabase.auth.getSession();
    cloudUser=session.data&&session.data.session&&session.data.session.user||null;
    emitGoogleDriveToken(session.data&&session.data.session);
    refreshAuthUI();
    if(cloudUser)await syncFromCloud();
  }catch(e){cloudReady=false;cloudUser=null;status('اتصال ابری آماده نشد: '+e.message,false);}
}
async function signUp(){
  if(!cloudReady)return;
  const email=document.getElementById('cloudEmail').value.trim(),password=document.getElementById('cloudPassword').value;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<8)return alert('ایمیل معتبر و رمز عبور حداقل ۸ کاراکتری وارد کن.');
  try{
    const r=await supabase.auth.signUp({email:email,password:password});
    if(r.error)throw r.error;
    cloudUser=r.data&&r.data.session&&r.data.session.user||null;refreshAuthUI();
    if(cloudUser)await syncFromCloud();
    else alert('حساب ساخته شد؛ اگر تأیید ایمیل فعال باشد، ایمیل تأیید را باز کن و سپس وارد شو.');
  }catch(e){alert('ساخت حساب ناموفق بود: '+e.message);}
}
async function resendConfirmation(){
  if(!cloudReady)return;
  const email=document.getElementById('cloudEmail').value.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return alert('ابتدا ایمیل معتبر را وارد کن.');
  try{
    const r=await supabase.auth.resend({type:'signup',email:email});
    if(r.error)throw r.error;
    alert('اگر حساب تأییدنشده‌ای با این ایمیل وجود داشته باشد، ایمیل تأیید دوباره ارسال شد.');
  }catch(e){alert('ارسال ایمیل تأیید ناموفق بود: '+e.message);}
}
async function resetPassword(){
  if(!cloudReady)return;
  const email=document.getElementById('cloudEmail').value.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return alert('ابتدا ایمیل معتبر را وارد کن.');
  try{
    const r=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
    if(r.error)throw r.error;
    alert('اگر این ایمیل در سیستم ثبت شده باشد، لینک بازیابی رمز ارسال می‌شود.');
  }catch(e){alert('درخواست بازیابی رمز ناموفق بود: '+e.message);}
}
function emitGoogleDriveToken(session){
  const token=session&&session.provider_token;
  if(token&&typeof token==='string')window.dispatchEvent(new CustomEvent('ai-teams-google-drive-token',{detail:{token:token}}));
}
async function signInWithGoogle(){
  if(!cloudReady)return;
  try{
    const r=await supabase.auth.signInWithOAuth({provider:'google',options:{
      redirectTo:location.origin+location.pathname,
      scopes:'openid email profile https://www.googleapis.com/auth/drive.appdata',
      queryParams:{access_type:'offline',prompt:'consent'}
    }});
    if(r.error)throw r.error;
  }catch(e){alert('ورود با Google ناموفق بود: '+e.message+'\nاگر Google در Supabase فعال نشده باشد، ابتدا آن را فعال کن.');}
}
async function connectGoogleDrive(){
  if(!cloudReady)throw new Error('اتصال ابری Supabase آماده نیست.');
  const sessionResult=await supabase.auth.getSession();
  const session=sessionResult.data&&sessionResult.data.session;
  if(session&&session.provider_token){
    emitGoogleDriveToken(session);
    return true;
  }
  await signInWithGoogle();
  return false;
}
async function getGoogleDriveToken(){
  if(!cloudReady)throw new Error('ابتدا اتصال ابری را آماده کن.');
  const r=await supabase.auth.getSession();
  const session=r.data&&r.data.session;
  if(session&&session.provider_token)return session.provider_token;
  return '';
}
async function signIn(){
  if(!cloudReady)return;
  const email=document.getElementById('cloudEmail').value.trim(),password=document.getElementById('cloudPassword').value;
  try{
    const r=await supabase.auth.signInWithPassword({email:email,password:password});
    if(r.error)throw r.error;
    cloudUser=r.data&&r.data.user||null;refreshAuthUI();await syncFromCloud();
  }catch(e){alert('ورود ناموفق بود: '+e.message);}
}
async function signOut(){
  if(!cloudReady)return;
  const r=await supabase.auth.signOut();if(r.error)throw r.error;
  cloudUser=null;refreshAuthUI();
}
function payload(){
  const core=window.aiTeamsCore;if(!core||!cloudUser)return null;
  const state=validateState(core.getState());
  return {user_id:cloudUser.id,project_id:projectId(),name:String(state.teamName||'AI Teams').slice(0,MAX_PROJECT_NAME),state:state,updated_at:new Date().toISOString()};
}
async function syncNow(manual){
  if(!cloudReady||!cloudUser||applyingRemote)return;
  if(saving){saveQueued=true;return;}
  const row=payload();if(!row)return;
  saving=true;
  try{
    const r=await supabase.from(TABLE).upsert(row,{onConflict:'user_id,project_id'}).select('project_id,updated_at').single();
    if(r.error)throw r.error;
    status('آخرین ذخیره ابری: '+new Date().toLocaleTimeString('fa-IR'),true);
    if(manual)alert('پروژه با موفقیت در فضای ابری ذخیره شد.');
  }catch(e){status('ذخیره ابری ناموفق بود: '+e.message,false);if(manual)alert('ذخیره ابری ناموفق بود: '+e.message);}
  finally{
    saving=false;
    if(saveQueued){
      saveQueued=false;
      if(cloudReady&&cloudUser&&!applyingRemote)setTimeout(function(){syncNow(false);},0);
    }
  }
}
async function syncFromCloud(){
  if(!cloudReady||!cloudUser)return;
  try{
    const r=await supabase.from(TABLE).select('state,updated_at').eq('user_id',cloudUser.id).eq('project_id',projectId()).maybeSingle();
    if(r.error)throw r.error;
    if(r.data&&r.data.state){
      const core=window.aiTeamsCore;if(!core||typeof core.importState!=='function')throw new Error('هسته بازیابی پروژه آماده نیست.');
      const localState=validateState(core.getState());
      const remoteState=validateState(r.data.state);
      if(JSON.stringify(localState)!==JSON.stringify(remoteState)){
        saveRecoverySnapshot('before-supabase-restore-local',localState);
        saveRecoverySnapshot('before-supabase-restore-cloud',remoteState);
        if(!confirm('نسخه ابری با نسخه فعلی این مرورگر متفاوت است. قبل از جایگزینی، هر دو نسخه در پشتیبان بازیابی نگه‌داری می‌شوند. نسخه ابری بارگذاری شود؟')){
          status('نسخه فعلی مرورگر حفظ شد؛ نسخه ابری بدون تغییر باقی ماند.',true);
          return;
        }
      }
      applyingRemote=true;try{core.importState(remoteState);}finally{applyingRemote=false;}
      status('نسخه ابری پروژه بازیابی شد؛ نسخه قبلی نیز در پشتیبان بازیابی نگه‌داری شد.',true);
    }else await syncNow(false);
  }catch(e){applyingRemote=false;status('دریافت پروژه ابری ناموفق بود: '+e.message,false);}
}
function wrapSave(){
  const core=window.aiTeamsCore;if(!core||core.__cloudSaveWrapped)return;
  const original=core.save;
  core.save=function(){original();if(cloudReady&&cloudUser&&!applyingRemote){clearTimeout(core.__cloudTimer);core.__cloudTimer=setTimeout(function(){syncNow(false);},700);}};
  core.__cloudSaveWrapped=true;
}
async function streamAIGateway(payload,onDelta,signal){
  if(!cloudReady||!cloudUser)throw new Error('برای اتصال امن مدل، ابتدا وارد حساب ابری شو.');
  const sessionResult=await supabase.auth.getSession();
  const session=sessionResult.data&&sessionResult.data.session;
  if(!session||!session.access_token)throw new Error('نشست ورود معتبر نیست.');
  const response=await fetch(CONFIG.url+'/functions/v1/ai-gateway',{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':CONFIG.publishableKey,'Authorization':'Bearer '+session.access_token},
    body:JSON.stringify(Object.assign({},payload,{stream:true})),
    signal:signal
  });
  if(!response.ok){
    const raw=await response.text();let data={};try{data=JSON.parse(raw)}catch(e){}
    throw new Error(data.error||raw.slice(0,600)||('HTTP '+response.status));
  }
  if(!response.body)throw new Error('پاسخ Streaming در مرورگر در دسترس نیست.');
  const reader=response.body.getReader(),decoder=new TextDecoder(),parts=[],bufferState={text:''};
  while(true){
    const chunk=await reader.read();if(chunk.done)break;
    bufferState.text+=decoder.decode(chunk.value,{stream:true});
    const lines=bufferState.text.split(/\\r?\\n/);bufferState.text=lines.pop()||'';
    for(const line of lines){
      const value=line.replace(/^data:\s?/,'').trim();if(!value||value==='[DONE]')continue;
      let json=null;try{json=JSON.parse(value)}catch(e){continue}
      const delta=json.choices&&json.choices[0]&&json.choices[0].delta&&json.choices[0].delta.content;
      if(typeof delta==='string'&&delta){parts.push(delta);if(onDelta)onDelta(delta);}
    }
  }
  return parts.join('');
}
async function invokeAIGateway(payload){
  if(!cloudReady||!cloudUser)throw new Error('برای اتصال امن مدل، ابتدا وارد حساب ابری شو.');
  const r=await supabase.functions.invoke('ai-gateway',{body:payload});
  if(r.error)throw new Error(r.error.message||'AI Gateway در دسترس نیست.');
  if(r.data&&r.data.error)throw new Error(r.data.error);
  return r.data;
}
async function listProjects(){
  if(!cloudReady||!cloudUser)throw new Error('ابتدا وارد حساب ابری شو.');
  const r=await supabase.from(TABLE).select('project_id,name,updated_at').eq('user_id',cloudUser.id).order('updated_at',{ascending:false}).limit(50);
  if(r.error)throw r.error;return r.data||[];
}
async function switchProject(id){
  if(!cloudReady||!cloudUser||!/^[A-Za-z0-9_-]{8,120}$/.test(String(id||'')))throw new Error('شناسه پروژه نامعتبر است.');
  localStorage.setItem(LOCAL_KEY,String(id));await syncFromCloud();return id;
}
async function renameProject(id,name){
  if(!cloudReady||!cloudUser)throw new Error('ابتدا وارد حساب ابری شوید.');
  const clean=String(name||'').trim().slice(0,MAX_PROJECT_NAME);
  if(!clean)throw new Error('نام پروژه نمی‌تواند خالی باشد.');
  const row=await supabase.from(TABLE).select('state').eq('user_id',cloudUser.id).eq('project_id',String(id)).maybeSingle();
  if(row.error)throw row.error;
  if(!row.data)throw new Error('پروژه پیدا نشد.');
  const nextState=Object.assign({},row.data.state||{},{teamName:clean});
  const r=await supabase.from(TABLE).update({name:clean,state:nextState,updated_at:new Date().toISOString()}).eq('user_id',cloudUser.id).eq('project_id',String(id));
  if(r.error)throw r.error;
  if(String(id)===projectId()){
    const core=window.aiTeamsCore;
    if(core&&typeof core.getState==='function'){
      core.getState().teamName=clean;
      core.save();
      core.render();
    }
  }
  return true;
}
async function duplicateProject(id,name){
  if(!cloudReady||!cloudUser)throw new Error('ابتدا وارد حساب ابری شوید.');
  const source=await supabase.from(TABLE).select('state,name').eq('user_id',cloudUser.id).eq('project_id',String(id)).maybeSingle();
  if(source.error)throw source.error;
  if(!source.data)throw new Error('پروژه پیدا نشد.');
  const newId=createProjectId();
  const clean=String(name||((source.data.name||'AI Teams')+' - کپی')).trim().slice(0,MAX_PROJECT_NAME);
  const r=await supabase.from(TABLE).insert({user_id:cloudUser.id,project_id:newId,name:clean,state:source.data.state,updated_at:new Date().toISOString()});
  if(r.error)throw r.error;
  return newId;
}
async function deleteProject(id){
  if(!cloudReady||!cloudUser)throw new Error('ابتدا وارد حساب ابری شوید.');
  if(String(id)===projectId())throw new Error('پروژه فعال را ابتدا به پروژه دیگری تغییر بده.');
  const r=await supabase.from(TABLE).delete().eq('user_id',cloudUser.id).eq('project_id',String(id));
  if(r.error)throw r.error;
  return true;
}
async function newProject(name){
  if(!cloudReady||!cloudUser)throw new Error('ابتدا وارد حساب ابری شو.');
  const id=createProjectId();localStorage.setItem(LOCAL_KEY,id);
  const core=window.aiTeamsCore;
  if(core){const s=core.getState();s.teamName=String(name||'تیم جدید').slice(0,MAX_PROJECT_NAME);s.goal='';s.chat=[];s.runs=[];core.save();core.render();}
  await syncNow(false);return id;
}
function boot(){
  init().then(function(){wrapSave();if(cloudReady)supabase.auth.onAuthStateChange(function(event,session){cloudUser=session&&session.user||null;emitGoogleDriveToken(session);refreshAuthUI();if(cloudUser&&event!=='INITIAL_SESSION')syncFromCloud();});});
}
readConfig();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
document.addEventListener('click',function(e){const b=e.target&&e.target.closest?e.target.closest('#cloudStorageBtn'):null;if(b){e.preventDefault();openPanel();}},true);
window.aiTeamsCloud={open:openPanel,sync:function(){return syncNow(true);},isReady:function(){return cloudReady&&!!cloudUser;},connectGoogleDrive:connectGoogleDrive,getGoogleDriveToken:getGoogleDriveToken,invokeAI:invokeAIGateway,streamAI:streamAIGateway,listProjects:listProjects,switchProject:switchProject,newProject:newProject,renameProject:renameProject,deleteProject:deleteProject,duplicateProject:duplicateProject,getConfig:function(){return {url:CONFIG.url,publishableKey:CONFIG.publishableKey,configured:configured(),user:cloudUser};}};
})();