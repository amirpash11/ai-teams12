/* AI Teams - Google Drive cloud storage */
(function(){
'use strict';
const DRIVE_API='https://www.googleapis.com/drive/v3';
const FILE_NAME='ai-teams-project.json';
let accessToken='',tokenExpiresAt=0,initialized=false;
function panel(){
 if(document.getElementById('googleDrivePanel'))return;
 const el=document.createElement('div');el.id='googleDrivePanel';
 el.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:3000;padding:16px;overflow:auto;display:none';
 el.innerHTML='<div class="card" style="max-width:650px;margin:30px auto;background:#121a2d">'+
 '<div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">☁️ Google Drive</h3><button class="icon-btn" id="gdriveClose">✕</button></div>'+
 '<div id="gdriveStatus" class="notice" style="margin-top:12px">برای اتصال، با حساب Gmail وارد شو.</div>'+
 '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">'+
 '<button class="btn primary" style="width:auto" id="gdriveConnect">📧 اتصال با Gmail</button>'+
 '<button class="btn" style="width:auto;display:none" id="gdriveSave">☁️ ذخیره پروژه</button>'+
 '<button class="btn" style="width:auto;display:none" id="gdriveLoad">📥 بازیابی پروژه</button>'+
 '<button class="btn" style="width:auto;display:none" id="gdriveDisconnect">قطع اتصال</button></div>'+
 '<div class="notice" style="margin-top:12px">AI Teams فقط به فضای اختصاصی همین برنامه در Google Drive یعنی appDataFolder دسترسی می‌گیرد. رمز Google داخل برنامه ذخیره نمی‌شود.</div>'+
 '<div style="margin-top:12px"><button class="btn" style="width:auto" id="gdriveClose2">بستن</button></div></div>';
 document.body.appendChild(el);
 document.getElementById('gdriveClose').onclick=closePanel;document.getElementById('gdriveClose2').onclick=closePanel;
 document.getElementById('gdriveConnect').onclick=connect;document.getElementById('gdriveSave').onclick=function(){saveToDrive(true)};
 document.getElementById('gdriveLoad').onclick=function(){loadFromDrive(true)};document.getElementById('gdriveDisconnect').onclick=disconnect;
}
function status(msg,good){const x=document.getElementById('gdriveStatus');if(x){x.textContent=msg;x.className='notice'+(good?'':' warn');}}
function openPanel(){panel();document.getElementById('googleDrivePanel').style.display='block';updateUI();}
function closePanel(){const x=document.getElementById('googleDrivePanel');if(x)x.style.display='none';}
function updateUI(){
 const c=document.getElementById('gdriveConnect'),s=document.getElementById('gdriveSave'),l=document.getElementById('gdriveLoad'),d=document.getElementById('gdriveDisconnect');if(!c)return;
 const connected=!!accessToken;c.style.display=connected?'none':'inline-block';s.style.display=connected?'inline-block':'none';l.style.display=connected?'inline-block':'none';d.style.display=connected?'inline-block':'none';
 if(connected)status('Google Drive از طریق حساب Gmail متصل است.',true);
 else if(initialized)status('برای اتصال، دکمه «اتصال با Gmail» را بزن.',false);
 else status('در حال آماده‌سازی ورود با Gmail…',false);
}
async function init(){
 panel();
 const btn=document.createElement('button');btn.id='googleDriveBtn';btn.className='btn';btn.textContent='📧 اتصال Google Drive با Gmail';
 const sidebar=document.querySelector('.sidebar');if(sidebar){const reset=document.getElementById('resetBtn');if(reset)sidebar.insertBefore(btn,reset);else sidebar.appendChild(btn);btn.onclick=openPanel;}
 initialized=!!(window.aiTeamsCloud&&typeof window.aiTeamsCloud.connectGoogleDrive==='function');
 window.addEventListener('ai-teams-google-drive-token',function(event){
  const token=event.detail&&event.detail.token;if(!token)return;
  accessToken=token;tokenExpiresAt=Date.now()+45*60*1000;initialized=true;updateUI();syncAfterConnect();
 });
 try{
  if(window.aiTeamsCloud&&typeof window.aiTeamsCloud.getGoogleDriveToken==='function'){
   const token=await window.aiTeamsCloud.getGoogleDriveToken();
   if(token){accessToken=token;tokenExpiresAt=Date.now()+45*60*1000;}
  }
 }catch(_){}
 updateUI();
}
function connect(){
 if(!window.aiTeamsCloud||typeof window.aiTeamsCloud.connectGoogleDrive!=='function'){
  status('ابتدا اتصال ابری برنامه را آماده کن.',false);return;
 }
 window.aiTeamsCloud.connectGoogleDrive().then(function(ok){
  if(ok){status('حساب Gmail شناسایی شد؛ Google Drive آماده است.',true);}
 }).catch(function(e){status('اتصال Gmail ناموفق بود: '+e.message,false);alert('اتصال با Gmail ناموفق بود: '+e.message);});
}
function ensureToken(){
 if(accessToken&&Date.now()<tokenExpiresAt)return Promise.resolve(accessToken);
 accessToken='';tokenExpiresAt=0;
 if(!window.aiTeamsCloud||typeof window.aiTeamsCloud.getGoogleDriveToken!=='function')return Promise.reject(new Error('ابتدا وارد حساب Gmail شو.'));
 return window.aiTeamsCloud.getGoogleDriveToken().then(function(token){
  if(token){accessToken=token;tokenExpiresAt=Date.now()+45*60*1000;updateUI();return token;}
  if(typeof window.aiTeamsCloud.connectGoogleDrive==='function')window.aiTeamsCloud.connectGoogleDrive().catch(function(){});
  throw new Error('برای ادامه، یک بار ورود با Gmail و اجازه دسترسی Google Drive را تأیید کن.');
 });
}
async function driveFetch(url,options){
 const t=await ensureToken(),opts=Object.assign({},options||{});opts.headers=Object.assign({'Authorization':'Bearer '+t},opts.headers||{});
 let r=await fetch(url,opts);if(r.status===401){accessToken='';tokenExpiresAt=0;const nt=await ensureToken();opts.headers.Authorization='Bearer '+nt;r=await fetch(url,opts);}
 if(!r.ok){let msg='';try{const j=await r.json();msg=j.error&&j.error.message||'';}catch(e){}throw new Error(msg||('Google Drive HTTP '+r.status));}return r;
}
async function findFile(){
 const q="name='"+FILE_NAME.replace(/'/g,"\\'")+"' and trashed=false";
 const r=await driveFetch(DRIVE_API+'/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&pageSize=10&q='+encodeURIComponent(q));const j=await r.json();return (j.files||[])[0]||null;
}
function saveLocalRecoverySnapshot(state){
 const key='ai-teams-recovery-snapshots-v1';let history=[];
 try{history=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(history))history=[];}catch(_){}
 history.unshift({source:'before-google-drive-restore',savedAt:new Date().toISOString(),state:JSON.parse(JSON.stringify(state))});
 history=history.slice(0,5);
 try{localStorage.setItem(key,JSON.stringify(history));}
 catch(e){throw new Error('بازیابی متوقف شد تا نسخه فعلی پروژه حفظ شود؛ فضای ذخیره مرورگر کافی نیست.');}
}
function payload(){const core=window.aiTeamsCore;if(!core)throw new Error('هسته برنامه آماده نیست.');const project=core.getState();const serialized=JSON.stringify(project);if(serialized.length>900000)throw new Error('حجم پروژه برای ذخیره Google Drive بیش از حد مجاز است.');return {version:1,exportedAt:new Date().toISOString(),project:project};}
async function saveToDrive(manual){
 try{const data=payload(),existing=await findFile();let r;
  if(existing){
   r=await driveFetch(DRIVE_API+'/files/'+encodeURIComponent(existing.id)+'?uploadType=media',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  }else{
   const boundary='aitb'+Date.now(),meta=JSON.stringify({name:FILE_NAME,parents:['appDataFolder'],mimeType:'application/json'});
   const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+meta+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+JSON.stringify(data)+'\r\n--'+boundary+'--';
   r=await driveFetch(DRIVE_API+'/files?uploadType=multipart',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body:body});
  }
  status('پروژه در Google Drive ذخیره شد.',true);if(manual)alert('پروژه با موفقیت در Google Drive ذخیره شد.');
 }catch(e){status('ذخیره در Google Drive ناموفق بود: '+e.message,false);if(manual)alert('ذخیره ناموفق بود: '+e.message);}
}
async function loadFromDrive(manual){
 try{const file=await findFile();if(!file){status('هنوز نسخه‌ای از پروژه در Google Drive وجود ندارد.',false);if(manual)alert('فایل پروژه پیدا نشد.');return;}
  const r=await driveFetch(DRIVE_API+'/files/'+encodeURIComponent(file.id)+'?alt=media'),data=await r.json();if(!data.project)throw new Error('ساختار فایل پروژه معتبر نیست.');
  const core=window.aiTeamsCore;if(!core)throw new Error('هسته برنامه آماده نیست.');if(typeof core.getState!=='function'||typeof core.importState!=='function')throw new Error('هسته بازیابی پروژه آماده نیست.');const localState=core.getState();if(JSON.stringify(localState)!==JSON.stringify(data.project)){saveLocalRecoverySnapshot(localState);saveLocalRecoverySnapshot(data.project);if(!confirm('نسخه Google Drive با پروژه فعلی مرورگر متفاوت است. نسخه فعلی مرورگر پشتیبان‌گیری شده است. نسخه Google Drive جایگزین شود؟')){status('پروژه فعلی مرورگر حفظ شد؛ فایل Google Drive تغییر نکرد.',true);return;}}core.__gdriveApplyingRemote=true;try{core.importState(data.project)}finally{core.__gdriveApplyingRemote=false}status('نسخه Google Drive بازیابی شد؛ نسخه قبلی در پشتیبان بازیابی نگه‌داری شد.',true);if(manual)alert('پروژه از Google Drive بازیابی شد.');
 }catch(e){status('بازیابی از Google Drive ناموفق بود: '+e.message,false);if(manual)alert('بازیابی ناموفق بود: '+e.message);}
}
async function syncAfterConnect(){try{const file=await findFile();if(file)await loadFromDrive(false);else await saveToDrive(false);}catch(e){status('همگام‌سازی اولیه ناموفق بود: '+e.message,false);}}
function disconnect(){accessToken='';tokenExpiresAt=0;updateUI();}
function wrapSave(){const core=window.aiTeamsCore;if(!core||core.__gdriveSaveWrapped)return;const original=core.save;core.save=function(){original();if(accessToken&&!core.__gdriveApplyingRemote){clearTimeout(core.__gdriveTimer);core.__gdriveTimer=setTimeout(function(){saveToDrive(false)},1200)}};core.__gdriveSaveWrapped=true;}
async function boot(){await init();wrapSave();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.aiTeamsDrive={open:openPanel,save:function(){return saveToDrive(true)},load:function(){return loadFromDrive(true)},isConnected:function(){return !!accessToken}};
})();