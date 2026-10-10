/* AI Teams - Google Drive cloud storage */
(function(){
'use strict';
const CONFIG_KEY='ai-teams-google-drive-config-v1'; const CONFIG={clientId:'YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com'}; try{const saved=JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}');if(saved.clientId)CONFIG.clientId=String(saved.clientId).trim();}catch(_){}
const DRIVE_API='https://www.googleapis.com/drive/v3';
const TOKEN_SCOPE='https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME='ai-teams-project.json';
let tokenClient=null,accessToken='',tokenExpiresAt=0,initialized=false;

function configured(){return CONFIG.clientId.indexOf('YOUR_')!==0;}
function loadGIS(){return new Promise(function(resolve,reject){
  if(window.google&&google.accounts&&google.accounts.oauth2){resolve();return;}
  const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';
  s.onload=resolve;s.onerror=function(){reject(new Error('کتابخانه Google Identity Services بارگذاری نشد.'));};
  document.head.appendChild(s);
});}
function panel(){
 if(document.getElementById('googleDrivePanel'))return;
 const el=document.createElement('div');el.id='googleDrivePanel';
 el.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:3000;padding:16px;overflow:auto;display:none';
 el.innerHTML='<div class="card" style="max-width:650px;margin:30px auto;background:#121a2d">'+
 '<div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">☁️ Google Drive</h3><button class="icon-btn" id="gdriveClose">✕</button></div>'+
 '<div id="gdriveStatus" class="notice" style="margin-top:12px">در حال بررسی اتصال...</div>'+ '<div class="field" style="margin-top:12px"><label>Google OAuth Client ID</label><input id="gdriveClientId" placeholder="123...apps.googleusercontent.com" autocomplete="off"><div class="tiny">این شناسه محرمانه نیست و فقط برای شروع OAuth در مرورگر استفاده می‌شود.</div></div>'+
 '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">'+
 '<button class="btn primary" style="width:auto" id="gdriveConnect">🔐 اتصال Google Drive</button>'+
 '<button class="btn" style="width:auto;display:none" id="gdriveSave">☁️ ذخیره پروژه</button>'+
 '<button class="btn" style="width:auto;display:none" id="gdriveLoad">📥 بازیابی پروژه</button>'+
 '<button class="btn" style="width:auto;display:none" id="gdriveDisconnect">قطع اتصال</button></div>'+
 '<div class="notice" style="margin-top:12px">AI Teams فقط به فضای اختصاصی همین برنامه در Google Drive یعنی appDataFolder دسترسی می‌گیرد. رمز Google داخل برنامه ذخیره نمی‌شود.</div>'+
 '<div style="margin-top:12px"><button class="btn" style="width:auto" id="gdriveClose2">بستن</button></div></div>';
 document.body.appendChild(el);
 document.getElementById('gdriveClientId').value=CONFIG.clientId.indexOf('YOUR_')===0?'':CONFIG.clientId;document.getElementById('gdriveClientId').onchange=function(){const v=String(this.value||'').trim();if(v){CONFIG.clientId=v;localStorage.setItem(CONFIG_KEY,JSON.stringify({version:1,clientId:v}));initialized=false;init().catch(function(){})}};document.getElementById('gdriveClose').onclick=closePanel;document.getElementById('gdriveClose2').onclick=closePanel;
 document.getElementById('gdriveConnect').onclick=connect;document.getElementById('gdriveSave').onclick=function(){saveToDrive(true)};
 document.getElementById('gdriveLoad').onclick=function(){loadFromDrive(true)};document.getElementById('gdriveDisconnect').onclick=disconnect;
}
function status(msg,good){const x=document.getElementById('gdriveStatus');if(x){x.textContent=msg;x.className='notice'+(good?'':' warn');}}
function openPanel(){panel();document.getElementById('googleDrivePanel').style.display='block';updateUI();}
function closePanel(){const x=document.getElementById('googleDrivePanel');if(x)x.style.display='none';}
function updateUI(){
 const c=document.getElementById('gdriveConnect'),s=document.getElementById('gdriveSave'),l=document.getElementById('gdriveLoad'),d=document.getElementById('gdriveDisconnect');if(!c)return;
 const connected=!!accessToken;c.style.display=connected?'none':'inline-block';s.style.display=connected?'inline-block':'none';l.style.display=connected?'inline-block':'none';d.style.display=connected?'inline-block':'none';
 if(!configured())status('برای فعال‌سازی، Google OAuth Client ID را در google-drive-storage.js قرار بده.',false);
 else if(!initialized)status('آماده اتصال به Google Drive.',false);
 else if(connected)status('Google Drive متصل است و پروژه می‌تواند خودکار ذخیره شود.',true);
 else status('برای ذخیره ابری، اتصال Google را تأیید کن.',false);
}
async function init(){
 panel();
 const btn=document.createElement('button');btn.id='googleDriveBtn';btn.className='btn';btn.textContent='☁️ اتصال Google Drive';
 const sidebar=document.querySelector('.sidebar');if(sidebar){const reset=document.getElementById('resetBtn');if(reset)sidebar.insertBefore(btn,reset);else sidebar.appendChild(btn);btn.onclick=openPanel;}
 if(!configured()){updateUI();return;}
 try{await loadGIS();tokenClient=google.accounts.oauth2.initTokenClient({client_id:CONFIG.clientId,scope:TOKEN_SCOPE,callback:handleToken});initialized=true;updateUI();}
 catch(e){status('Google Drive آماده نشد: '+e.message,false);}
}
function handleToken(response){if(response.error){status('اتصال Google ناموفق بود: '+(response.error_description||response.error),false);return;}accessToken=response.access_token||'';tokenExpiresAt=Date.now()+Number(response.expires_in||3600)*1000-60000;updateUI();syncAfterConnect();}
function connect(){if(!initialized||!tokenClient)return alert('اتصال Google هنوز آماده نشده است.');tokenClient.requestAccessToken({prompt:'consent'});}
function ensureToken(){
 if(accessToken&&Date.now()<tokenExpiresAt)return Promise.resolve(accessToken);
 return new Promise(function(resolve,reject){if(!tokenClient)return reject(new Error('Google Identity Services آماده نیست.'));
  const old=tokenClient.callback;tokenClient.callback=function(response){tokenClient.callback=old;if(response.error)return reject(new Error(response.error_description||response.error));accessToken=response.access_token||'';tokenExpiresAt=Date.now()+Number(response.expires_in||3600)*1000-60000;updateUI();resolve(accessToken);};tokenClient.requestAccessToken({prompt:''});
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
  const core=window.aiTeamsCore;if(!core)throw new Error('هسته برنامه آماده نیست.');if(typeof core.getState!=='function'||typeof core.importState!=='function')throw new Error('هسته بازیابی پروژه آماده نیست.');const localState=core.getState();if(JSON.stringify(localState)!==JSON.stringify(data.project))saveLocalRecoverySnapshot(localState);core.__gdriveApplyingRemote=true;try{core.importState(data.project)}finally{core.__gdriveApplyingRemote=false}status('نسخه ابری پروژه بازیابی شد؛ نسخه قبلی مرورگر در پشتیبان بازیابی نگه‌داری شد.',true);if(manual)alert('پروژه از Google Drive بازیابی شد.');
 }catch(e){status('بازیابی از Google Drive ناموفق بود: '+e.message,false);if(manual)alert('بازیابی ناموفق بود: '+e.message);}
}
async function syncAfterConnect(){try{const file=await findFile();if(file)await loadFromDrive(false);else await saveToDrive(false);}catch(e){status('همگام‌سازی اولیه ناموفق بود: '+e.message,false);}}
function disconnect(){try{if(accessToken&&google&&google.accounts&&google.accounts.oauth2)google.accounts.oauth2.revoke(accessToken,()=>{});}catch(e){}accessToken='';tokenExpiresAt=0;updateUI();}
function wrapSave(){const core=window.aiTeamsCore;if(!core||core.__gdriveSaveWrapped)return;const original=core.save;core.save=function(){original();if(accessToken&&!core.__gdriveApplyingRemote){clearTimeout(core.__gdriveTimer);core.__gdriveTimer=setTimeout(function(){saveToDrive(false)},1200)}};core.__gdriveSaveWrapped=true;}
async function boot(){await init();wrapSave();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.aiTeamsDrive={open:openPanel,save:function(){return saveToDrive(true)},load:function(){return loadFromDrive(true)},isConnected:function(){return !!accessToken}};
})();