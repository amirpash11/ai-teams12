/* AI Teams - GitHub cloud workspace */
(function(){
'use strict';
const CONFIG_KEY='ai-teams-supabase-config-v1';
const CONFIG={supabaseUrl:'',publishableKey:''};
function readConfig(){
  try{
    const x=JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}');
    if(x.url&&x.publishableKey){CONFIG.supabaseUrl=String(x.url).trim();CONFIG.publishableKey=String(x.publishableKey).trim();}
  }catch(e){}
}
readConfig();
try{
  if((!CONFIG.supabaseUrl||!CONFIG.publishableKey)&&window.aiTeamsCloud&&typeof window.aiTeamsCloud.getConfig==='function'){
    const c=window.aiTeamsCloud.getConfig();
    if(c&&c.url&&c.publishableKey){CONFIG.supabaseUrl=String(c.url).trim();CONFIG.publishableKey=String(c.publishableKey).trim();}
  }
}catch(e){}
const FN='github-gateway';
let client=null,ready=false;
const RETRY_DELAYS=[500,1000,2000];
function configured(){return !CONFIG.supabaseUrl.includes('YOUR_')&&!CONFIG.publishableKey.includes('YOUR_');}
function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)});}
function transientStatus(status){return status===408||status===425||status===429||status>=500;}
async function fetchWithRetry(url,init){
  let lastError=null;
  for(let attempt=0;attempt<=RETRY_DELAYS.length;attempt++){
    try{
      const r=await fetch(url,init);
      if(!transientStatus(r.status)||attempt===RETRY_DELAYS.length)return r;
      lastError=new Error('GitHub Gateway transient HTTP '+r.status);
    }catch(e){
      lastError=e;
      if(attempt===RETRY_DELAYS.length)throw e;
    }
    await sleep(RETRY_DELAYS[attempt]);
  }
  throw lastError||new Error('GitHub network request failed');
}
function loadScript(){return new Promise((resolve,reject)=>{if(window.supabase)return resolve();const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2';s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
function panel(){if(document.getElementById('githubCloudPanel'))return;const e=document.createElement('div');e.id='githubCloudPanel';e.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:3100;padding:16px;overflow:auto;display:none';e.innerHTML='<div class="card" style="max-width:760px;margin:25px auto;background:#121a2d"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">🐙 GitHub Cloud</h3><button class="icon-btn" id="ghClose">✕</button></div><div id="ghStatus" class="notice" style="margin-top:12px">در حال بررسی...</div><div id="ghBody" style="margin-top:12px"></div></div>';document.body.appendChild(e);document.getElementById('ghClose').onclick=()=>e.style.display='none';}
function status(t,good){const e=document.getElementById('ghStatus');if(e){e.textContent=t;e.className='notice'+(good?'':' warn');}}
async function init(){panel();const b=document.createElement('button');b.id='githubCloudBtn';b.className='btn';b.textContent='🐙 اتصال GitHub / فضای فایل';const s=document.querySelector('.sidebar');const reset=document.getElementById('resetBtn');if(s){if(reset)s.insertBefore(b,reset);else s.appendChild(b);b.onclick=open;}if(!configured()){status('GitHub آماده اتصال است، اما ابتدا Supabase را تنظیم کن. این بخش توکن GitHub را داخل مرورگر ذخیره نمی‌کند.',false);return;}await loadScript();client=window.supabase.createClient(CONFIG.supabaseUrl,CONFIG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true}});ready=true;await refresh();}
async function api(body){if(!ready)throw new Error('Supabase تنظیم نشده است.');const {data:{session}}=await client.auth.getSession();if(!session)throw new Error('ابتدا وارد حساب AI Teams شو.');const r=await fetchWithRetry(CONFIG.supabaseUrl+'/functions/v1/'+FN,{method:'POST',headers:{'Content-Type':'application/json','apikey':CONFIG.publishableKey,'Authorization':'Bearer '+session.access_token},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||'خطای GitHub');return j;}
async function refresh(){try{const j=await api({action:'status'});render(j);}catch(e){render({connected:false});status(e.message,false);}}
function render(j){const b=document.getElementById('ghBody');if(!b)return;if(!j.connected){b.innerHTML='<div class="notice">برای اتصال امن، دکمه زیر را بزن. صفحه GitHub باز می‌شود و بعد از تأیید به AI Teams برمی‌گردی.</div><button class="btn primary" id="ghConnect">🐙 اتصال به GitHub</button>';document.getElementById('ghConnect').onclick=connect;return;}b.innerHTML='<div class="notice">متصل به GitHub با حساب <b>'+esc(j.login||'')+'</b></div><div class="field" style="margin-top:10px"><label>مخزن</label><select id="ghRepo"></select></div><div class="field"><label>مسیر فایل پشتیبان</label><input id="ghPath" value="ai-teams/ai-teams-project.json"></div><div class="actions"><button class="btn primary" style="width:auto" id="ghSave">☁ ذخیره پروژه در GitHub</button><button class="btn" style="width:auto" id="ghLoad">↙ بازیابی از GitHub</button><button class="btn danger" style="width:auto" id="ghDisconnect">قطع اتصال</button></div>';loadRepos();document.getElementById('ghSave').onclick=saveProject;document.getElementById('ghLoad').onclick=loadProject;document.getElementById('ghDisconnect').onclick=disconnect;}
async function loadRepos(){try{const j=await api({action:'repos'});const s=document.getElementById('ghRepo');if(s)s.innerHTML=(j.repos||[]).map(x=>'<option value="'+esc(x.full_name)+'">'+esc(x.full_name)+'</option>').join('');}catch(e){status(e.message,false);}}
async function connect(){try{if(!ready){status('ابتدا Supabase را تنظیم کن.',false);return;}const {data:{session}}=await client.auth.getSession();if(!session)throw new Error('ابتدا وارد حساب AI Teams شو.');const r=await fetchWithRetry(CONFIG.supabaseUrl+'/functions/v1/'+FN+'?action=oauth-start&return_to='+encodeURIComponent(location.href.split('?')[0]),{headers:{apikey:CONFIG.publishableKey,Authorization:'Bearer '+session.access_token}});const j=await r.json();if(!r.ok||j.error)throw new Error(j.error||'شروع اتصال GitHub ناموفق بود');location.href=j.url;}catch(e){status(e.message,false);}}
async function saveProject(){try{const repo=document.getElementById('ghRepo').value,path=document.getElementById('ghPath').value.trim();const core=window.aiTeamsCore;if(!core)throw new Error('هسته برنامه آماده نیست.');const content=JSON.stringify({version:1,exportedAt:new Date().toISOString(),project:core.getState()},null,2);await api({action:'put-file',repo,path,content,message:'AI Teams cloud backup'});status('پروژه در GitHub ذخیره شد.',true);}catch(e){status(e.message,false);}}
async function loadProject(){try{const repo=document.getElementById('ghRepo').value,path=document.getElementById('ghPath').value.trim();const j=await api({action:'get-file',repo,path});const x=JSON.parse(j.content);if(!x.project||typeof x.project!=='object')throw new Error('فایل پشتیبان معتبر نیست.');const core=window.aiTeamsCore;if(!core)throw new Error('هسته برنامه آماده نیست.');if(typeof core.importState!=='function')throw new Error('هسته بازیابی پروژه آماده نیست.');core.importState(x.project);status('پروژه از GitHub بازیابی شد.',true);}catch(e){status(e.message,false);}}
async function disconnect(){try{await api({action:'disconnect'});status('اتصال GitHub قطع شد.',true);render({connected:false});}catch(e){status(e.message,false);}}
function esc(s){return String(s||'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}
function open(){panel();document.getElementById('githubCloudPanel').style.display='block';refresh();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.aiTeamsGitHub={open};
})();