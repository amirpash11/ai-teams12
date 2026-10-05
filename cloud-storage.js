/* AI Teams Cloud Storage - Supabase */
(function(){
'use strict';

const CONFIG_KEY = 'ai-teams-supabase-config-v1';
const CONFIG = {
  url: 'YOUR_SUPABASE_PROJECT_URL',
  publishableKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY'
};
function readConfig(){
  try{
    const x=JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}');
    if(x.url&&x.publishableKey){CONFIG.url=String(x.url).trim().replace(/\/$/,'');CONFIG.publishableKey=String(x.publishableKey).trim();}
  }catch(e){}
}
const CONFIG_VERSION = 1;
const MAX_PROJECT_NAME = 200;
function saveConfig(url,key){
  const cleanUrl=String(url||'').trim().replace(/\/$/,'');
  const cleanKey=String(key||'').trim();
  if(!/^https:\/\/[^\s/]+(?:\.[^\s/]+)+(?:\/[^\s]*)?$/.test(cleanUrl))throw new Error('Project URL باید یک HTTPS URL معتبر باشد.');
  if(!cleanKey||cleanKey.length<20)throw new Error('Publishable Key معتبر وارد کن.');
  CONFIG.url=cleanUrl;CONFIG.publishableKey=cleanKey;
  localStorage.setItem(CONFIG_KEY,JSON.stringify({version:CONFIG_VERSION,url:CONFIG.url,publishableKey:CONFIG.publishableKey}));
}
readConfig();
const SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const TABLE = 'ai_teams_projects';
const LOCAL_KEY = 'ai-teams12-cloud-project-id-v1';

let supabase = null;
let cloudReady = false;
let cloudUser = null;
let saving = false;
let applyingRemote = false;
let originalSave = null;

function configured(){
  return CONFIG.url.indexOf('YOUR_') !== 0 &&
         CONFIG.publishableKey.indexOf('YOUR_') !== 0;
}

function loadScript(){
  return new Promise(function(resolve,reject){
    if(window.supabase){resolve();return;}
    const s=document.createElement('script');
    s.src=SCRIPT_SRC;
    s.onload=resolve;
    s.onerror=function(){reject(new Error('کتابخانه ذخیره‌سازی ابری بارگذاری نشد.'))};
    document.head.appendChild(s);
  });
}

function projectId(){
  let id=localStorage.getItem(LOCAL_KEY);
  if(!id){
    id=(crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+'-'+Math.random();
    localStorage.setItem(LOCAL_KEY,id);
  }
  return id;
}

function panel(){
  if(document.getElementById('cloudStoragePanel'))return;
  const el=document.createElement('div');
  el.id='cloudStoragePanel';
  el.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:3000;padding:16px;overflow:auto;display:none';
  el.innerHTML='<div class="card" style="max-width:620px;margin:30px auto;background:#121a2d">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0">☁ ذخیره‌سازی ابری</h3><button class="icon-btn" id="cloudClose">✕</button></div>'+
    '<div id="cloudStatus" class="notice" style="margin-top:12px">در حال بررسی اتصال...</div>'+
    '<div id="cloudAuth" style="margin-top:12px">'+
      '<div class="notice">برای راه‌اندازی، Project URL و Publishable Key پروژه Supabase را وارد کن. این دو مقدار محرمانه نیستند؛ Secretهای Gateway فقط داخل Supabase نگهداری می‌شوند.</div>'+
      '<div class="field"><label>Supabase Project URL</label><input id="cloudProjectUrl" placeholder="https://xxxx.supabase.co"></div>'+
      '<div class="field"><label>Supabase Publishable Key</label><input id="cloudPublishableKey" type="password" placeholder="sb_publishable_..."></div>'+
      '<div class="actions"><button class="btn" style="width:auto" id="cloudSaveConfig">ذخیره تنظیمات Supabase</button></div>'+
      '<div class="field"><label>ایمیل</label><input id="cloudEmail" type="email" placeholder="ایمیل حساب"></div>'+
      '<div class="field"><label>رمز عبور</label><input id="cloudPassword" type="password" placeholder="حداقل رمز امن"></div>'+
      '<div class="actions"><button class="btn primary" style="width:auto" id="cloudSignIn">ورود</button><button class="btn" style="width:auto" id="cloudSignUp">ساخت حساب</button></div>'+
    '</div>'+
    '<div id="cloudUserBox" style="display:none;margin-top:12px">'+
      '<div class="tiny" id="cloudUserText"></div>'+
      '<div class="actions"><button class="btn primary" style="width:auto" id="cloudSync">☁ همگام‌سازی الآن</button><button class="btn" style="width:auto" id="cloudSignOut">خروج</button></div>'+
    '</div>'+
    '<div class="notice" style="margin-top:12px">اطلاعات پروژه در پایگاه‌داده ابری ذخیره می‌شود. این برنامه برای پروژه‌ها سیاست حذف خودکار ندارد؛ حذف داده باید از پنل مدیریت پایگاه‌داده انجام شود.</div>'+
    '<div class="actions" style="margin-top:12px"><button class="btn" style="width:auto" id="cloudClose2">بستن</button></div>'+
  '</div>';
  document.body.appendChild(el);
  document.getElementById('cloudClose').onclick=closePanel;
  document.getElementById('cloudClose2').onclick=closePanel;
  document.getElementById('cloudSignIn').onclick=signIn;
  document.getElementById('cloudSignUp').onclick=signUp;
  document.getElementById('cloudSignOut').onclick=signOut;
  document.getElementById('cloudSaveConfig').onclick=async function(){
    const u=document.getElementById('cloudProjectUrl').value.trim(),k=document.getElementById('cloudPublishableKey').value.trim();
    try{saveConfig(u,k);location.reload();}catch(e){alert(e.message);}
  };
  document.getElementById('cloudSync').onclick=function(){syncNow(true)};
}
function status(t,good){
  const x=document.getElementById('cloudStatus');
  if(x){x.textContent=t;x.className='notice'+(good?'':' warn');}
}
function openPanel(){panel();document.getElementById('cloudStoragePanel').style.display='block';refreshAuthUI();}
function closePanel(){const x=document.getElementById('cloudStoragePanel');if(x)x.style.display='none';}

async function init(){
  panel();
  const btn=document.createElement('button');
  btn.id='cloudStorageBtn';btn.className='btn';btn.textContent='☁ ذخیره‌سازی ابری';
  const sidebar=document.querySelector('.sidebar');
  if(sidebar){
    const reset=document.getElementById('resetBtn');
    if(reset)sidebar.insertBefore(btn,reset);
    else sidebar.appendChild(btn);
    btn.onclick=openPanel;
  }
  if(!configured()){
    status('ذخیره‌سازی ابری آماده نصب است؛ Project URL و Publishable Key را از همین پنجره وارد کن.',false);
    return;
  }
  try{
    await loadScript();
    supabase=window.supabase.createClient(CONFIG.url,CONFIG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    cloudReady=true;
    const result=await supabase.auth.getUser();
    cloudUser=result.data&&result.data.user||null;
    refreshAuthUI();
    if(cloudUser)await syncFromCloud();
  }catch(e){status('اتصال ابری آماده نشد: '+e.message,false);}
}

function refreshAuthUI(){
  const cu=document.getElementById('cloudProjectUrl'),ck=document.getElementById('cloudPublishableKey');
  if(cu)cu.value=CONFIG.url.indexOf('YOUR_')===0?'':CONFIG.url;
  if(ck)ck.value=CONFIG.publishableKey.indexOf('YOUR_')===0?'':CONFIG.publishableKey;
  if(!cloudReady){
    status('اتصال ابری نیاز به تنظیم Supabase دارد.',false);return;
  }
  const auth=document.getElementById('cloudAuth'),box=document.getElementById('cloudUserBox');
  if(!auth||!box)return;
  if(cloudUser){
    auth.style.display='none';box.style.display='block';
    document.getElementById('cloudUserText').textContent='وارد شده: '+cloudUser.email;
    status('ذخیره‌سازی ابری فعال است. پروژه به‌صورت خودکار همگام می‌شود.',true);
  }else{
    auth.style.display='block';box.style.display='none';
    status('برای ذخیره دائمی ابری، وارد حساب خودت شو.',false);
  }
}
async function signUp(){
  if(!cloudReady)return;
  const email=document.getElementById('cloudEmail').value.trim(),password=document.getElementById('cloudPassword').value;
  if(!email||password.length<8)return alert('ایمیل و رمز عبور حداقل ۸ کاراکتری وارد کن.');
  try{
    const r=await supabase.auth.signUp({email:email,password:password});
    if(r.error)return alert('ساخت حساب ناموفق بود: '+r.error.message);
    cloudUser=r.data.session?.user||r.data.user||null;refreshAuthUI();
    alert(cloudUser?'حساب ساخته و وارد شدی.':'حساب ساخته شد؛ اگر تأیید ایمیل فعال باشد، ایمیل تأیید را باز کن و سپس وارد شو.');
  }catch(e){alert('ساخت حساب ناموفق بود: '+e.message)}
}
async function signIn(){
  if(!cloudReady)return;
  const email=document.getElementById('cloudEmail').value.trim(),password=document.getElementById('cloudPassword').value;
  try{
    const r=await supabase.auth.signInWithPassword({email:email,password:password});
    if(r.error)return alert('ورود ناموفق بود: '+r.error.message);
    cloudUser=r.data.user||null;refreshAuthUI();await syncFromCloud();
  }catch(e){alert('ورود ناموفق بود: '+e.message)}
}
async function signOut(){
  if(!cloudReady)return;
  const r=await supabase.auth.signOut();
  if(r.error)return alert('خروج ناموفق بود: '+r.error.message);
  cloudUser=null;refreshAuthUI();
}
function payload(){
  const core=window.aiTeamsCore;
  if(!core)return null;
  return {user_id:cloudUser.id,project_id:projectId(),name:String(core.getState().teamName||'AI Teams').slice(0,MAX_PROJECT_NAME),state:core.getState(),updated_at:new Date().toISOString()};
}
async function syncNow(manual){
  if(!cloudReady||!cloudUser||applyingRemote)return;
  const row=payload();if(!row)return;
  if(saving)return;saving=true;
  try{
    const r=await supabase.from(TABLE).upsert(row,{onConflict:'user_id,project_id'});
    if(r.error)throw r.error;
    status('آخرین ذخیره ابری: '+new Date().toLocaleTimeString('fa-IR'),true);
    if(manual)alert('پروژه با موفقیت در فضای ابری ذخیره شد.');
  }catch(e){
    status('ذخیره ابری ناموفق بود: '+e.message,false);
    if(manual)alert('ذخیره ابری ناموفق بود: '+e.message);
  }finally{saving=false;}
}
async function syncFromCloud(){
  if(!cloudReady||!cloudUser)return;
  try{
    const r=await supabase.from(TABLE).select('state,updated_at').eq('project_id',projectId()).maybeSingle();
    if(r.error)throw r.error;
    if(r.data&&r.data.state){
      const core=window.aiTeamsCore;
      if(core){
        applyingRemote=true;
        const remote=(r.data.state&&typeof r.data.state==='object')?r.data.state:{};
        if(typeof core.importState!=='function')throw new Error('هسته بازیابی پروژه آماده نیست.');
        core.importState(remote);
        applyingRemote=false;
        status('نسخه ابری پروژه بازیابی شد و اعتبارسنجی شد.',true);
      }
    }else{
      await syncNow(false);
    }
  }catch(e){applyingRemote=false;status('دریافت پروژه ابری ناموفق بود: '+e.message,false);}
}

function wrapSave(){
  const core=window.aiTeamsCore;
  if(!core||core.__cloudSaveWrapped)return;
  originalSave=core.save;
  core.save=function(){
    originalSave();
    if(cloudReady&&cloudUser&&!applyingRemote)clearTimeout(core.__cloudTimer),core.__cloudTimer=setTimeout(function(){syncNow(false)},700);
  };
  core.__cloudSaveWrapped=true;
}

async function boot(){
  await init();
  wrapSave();
  if(cloudReady) supabase.auth.onAuthStateChange(function(event,session){
    cloudUser=session&&session.user||null;refreshAuthUI();
    if(cloudUser)syncFromCloud();
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
async function invokeAIGateway(payload){
  if(!cloudReady||!cloudUser)throw new Error('برای اتصال امن مدل، ابتدا وارد ذخیره‌سازی ابری شوید.');
  const r=await supabase.functions.invoke('ai-gateway',{body:payload});
  if(r.error)throw new Error(r.error.message||'AI Gateway در دسترس نیست.');
  if(r.data&&r.data.error)throw new Error(r.data.error);
  return r.data;
}
async function listProjects(){
  if(!cloudReady||!cloudUser)throw new Error('ابتدا وارد حساب ابری شوید.');
  const r=await supabase.from(TABLE).select('project_id,name,updated_at').order('updated_at',{ascending:false}).limit(50);
  if(r.error)throw r.error; return r.data||[];
}
async function switchProject(id){
  if(!cloudReady||!cloudUser)throw new Error('ابتدا وارد حساب ابری شوید.');
  localStorage.setItem(LOCAL_KEY,String(id));
  await syncFromCloud();
  return id;
}
async function newProject(name){
  if(!cloudReady||!cloudUser)throw new Error('ابتدا وارد حساب ابری شوید.');
  const id=(crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+'-'+Math.random();
  localStorage.setItem(LOCAL_KEY,id);
  const core=window.aiTeamsCore;
  if(core){
    const s=core.getState();
    s.teamName=name||'تیم جدید';s.goal='';s.chat=[];s.runs=[];
    core.save();core.render();
  }
  await syncNow(false); return id;
}
window.aiTeamsCloud={open:openPanel,sync:function(){return syncNow(true)},isReady:function(){return cloudReady&&!!cloudUser},invokeAI:invokeAIGateway,listProjects:listProjects,switchProject:switchProject,newProject:newProject,getConfig:function(){return {url:CONFIG.url,configured:configured(),user:cloudUser}}};
})();