(function(){
'use strict';
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]})}
function modal(){
 if(document.getElementById('workspaceModal'))return;
 const el=document.createElement('div');el.id='workspaceModal';
 el.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:2500;padding:12px;overflow:auto';
 el.innerHTML='<div class="card" style="max-width:820px;margin:35px auto;background:#121a2d"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">🗂 پروژه‌ها و تاریخچه اجرا</h3><button class="icon-btn" id="wsClose">✕</button></div><div id="wsStatus" class="notice" style="margin-top:10px">در حال بارگذاری...</div><div class="two" style="margin-top:10px"><div><h3>پروژه‌های ابری</h3><div id="wsProjects" class="editor" style="max-height:300px"></div><div class="actions" style="margin-top:8px"><button class="btn primary" id="wsNew" style="width:auto">＋ پروژه جدید</button><button class="btn" id="wsRefresh" style="width:auto">↻ به‌روزرسانی</button></div></div><div><h3>آخرین اجراهای این پروژه</h3><div id="wsRuns" class="editor" style="max-height:350px"></div></div></div></div>';
 document.body.appendChild(el);
 document.getElementById('wsClose').onclick=close;
 document.getElementById('wsRefresh').onclick=refresh;
 document.getElementById('wsNew').onclick=newProject;
}
function open(){modal();document.getElementById('workspaceModal').style.display='block';refresh()}
function close(){const x=document.getElementById('workspaceModal');if(x)x.style.display='none'}
function status(t,good){const x=document.getElementById('wsStatus');if(x){x.textContent=t;x.className='notice'+(good?'':' warn')}}
async function refresh(){
 modal();
 const p=document.getElementById('wsProjects'),r=document.getElementById('wsRuns');
 const core=window.aiTeamsCore;
 const st=core&&core.getState();
 r.innerHTML=((st&&st.runs)||[]).slice(0,20).map(function(x){return '<div class="agent-row"><div class="agent-head"><strong>'+esc(x.goal||'اجرای تیم')+'</strong><span class="pill">'+esc(x.mode||'')+'</span></div><div class="tiny">'+esc(new Date(x.createdAt||Date.now()).toLocaleString('fa-IR'))+'<br>اعضا: '+esc((x.members||[]).join('، '))+'<br>'+esc(String(x.summary||'').slice(0,700))+'</div></div>'}).join('')||'<div class="empty">هنوز اجرای ثبت‌شده‌ای وجود ندارد.</div>';
 if(!window.aiTeamsCloud||!window.aiTeamsCloud.isReady()){p.innerHTML='<div class="notice warn">برای مدیریت پروژه‌های ابری وارد حساب شوید. تاریخچه همین پروژه در مرورگر قابل مشاهده است.</div>';status('حساب ابری وارد نشده است.',false);return}
 try{
  const list=await window.aiTeamsCloud.listProjects();
  const current=localStorage.getItem('ai-teams12-cloud-project-id-v1');
  p.innerHTML=list.map(function(x){return '<div class="agent-row"><div class="agent-head"><strong>'+esc(x.name||'AI Teams')+'</strong><div style="display:flex;gap:5px;flex-wrap:wrap"><button class="btn '+(x.project_id===current?'primary':'')+'" data-project="'+esc(x.project_id)+'" style="width:auto;margin:0">'+(x.project_id===current?'فعال':'باز کردن')+'</button><button class="btn" data-rename="'+esc(x.project_id)+'" style="width:auto;margin:0">تغییرنام</button><button class="btn" data-copy="'+esc(x.project_id)+'" style="width:auto;margin:0">تکثیر</button><button class="btn danger" data-delete="'+esc(x.project_id)+'" style="width:auto;margin:0">حذف</button></div></div><div class="tiny">'+esc(new Date(x.updated_at||Date.now()).toLocaleString('fa-IR'))+'</div></div>'}).join('')||'<div class="empty">هنوز پروژه‌ای ساخته نشده است.</div>';
  p.onclick=async function(e){
   const b=e.target.closest('[data-project],[data-rename],[data-copy],[data-delete]');if(!b)return;
   try{
    if(b.dataset.project){status('در حال باز کردن پروژه...',true);await window.aiTeamsCloud.switchProject(b.dataset.project);location.reload();return}
    if(b.dataset.rename){const n=prompt('نام جدید پروژه:');if(!n)return;await window.aiTeamsCloud.renameProject(b.dataset.rename,n);await refresh();return}
    if(b.dataset.copy){const n=prompt('نام پروژه کپی:');if(!n)return;const id=await window.aiTeamsCloud.duplicateProject(b.dataset.copy,n);await window.aiTeamsCloud.switchProject(id);location.reload();return}
    if(b.dataset.delete){if(!confirm('این پروژه از فضای ابری حذف شود؟'))return;await window.aiTeamsCloud.deleteProject(b.dataset.delete);await refresh();return}
   }catch(err){status(err.message,false)}
  };
  status('پروژه‌ها و تاریخچه آماده‌اند.',true);
 }catch(e){status(e.message,false)}
}
async function newProject(){
 const name=prompt('نام پروژه جدید را وارد کن:','پروژه جدید');if(!name)return;
 try{await window.aiTeamsCloud.newProject(name);location.reload()}catch(e){alert(e.message)}
}
function mount(){
 modal();
 const sidebar=document.querySelector('.sidebar');if(!sidebar||document.getElementById('workspaceBtn'))return;
 const b=document.createElement('button');b.id='workspaceBtn';b.className='btn';b.textContent='🗂 پروژه‌ها و تاریخچه';b.onclick=open;
 sidebar.appendChild(b);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
window.aiTeamsWorkspace={open:open,refresh:refresh};
})();