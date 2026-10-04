import { withSupabase } from "npm:@supabase/server@1";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js/cors";

const GITHUB_CLIENT_ID=Deno.env.get("GITHUB_CLIENT_ID")||"";
const GITHUB_CLIENT_SECRET=Deno.env.get("GITHUB_CLIENT_SECRET")||"";
const APP_URL=Deno.env.get("AI_TEAMS_APP_URL")||"https://amirpash11.github.io/ai-teams12/";
const APP_ORIGIN=new URL(APP_URL).origin;
const ENC_KEY=Deno.env.get("GITHUB_TOKEN_ENCRYPTION_KEY")||"";
const TABLE="github_connections";
const STATE_TABLE="github_oauth_states";
function adminKey(){try{const x=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");return x.default||"";}catch(_){return "";}}
function adminClient(){return createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SECRET_KEY")||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||adminKey());}

function json(x,status=200,extraHeaders={}){return new Response(JSON.stringify(x),{status,headers:{...corsHeaders,"Content-Type":"application/json",...extraHeaders}});}
function hexToBytes(h){if(!/^[0-9a-fA-F]{64}$/.test(h))throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY must be exactly 32 bytes of hex");return new Uint8Array(h.match(/.{1,2}/g).map(x=>parseInt(x,16)));}
async function key(){if(!ENC_KEY)throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY is not configured");return crypto.subtle.importKey("raw",hexToBytes(ENC_KEY),"AES-GCM",false,["encrypt","decrypt"]);}
async function enc(s){const iv=crypto.getRandomValues(new Uint8Array(12));const k=await key();const b=new TextEncoder().encode(s);const c=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},k,b));const out=new Uint8Array(iv.length+c.length);out.set(iv);out.set(c,iv.length);return btoa(String.fromCharCode(...out));}
async function dec(s){const a=Uint8Array.from(atob(s),c=>c.charCodeAt(0)),iv=a.slice(0,12),c=a.slice(12);const k=await key();const p=await crypto.subtle.decrypt({name:"AES-GCM",iv},k,c);return new TextDecoder().decode(p);}
async function gh(token,url,init={}){const r=await fetch(url,{...init,headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,"X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json",...(init.headers||{})}});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||"GitHub API error");return j;}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="GET" && req.method!=="POST")return json({error:"Method not allowed"},405,{Allow:"GET, POST, OPTIONS"});
  const u=new URL(req.url), action=u.searchParams.get("action");
  const origin=req.headers.get("origin");
  if(origin && origin!==APP_ORIGIN)return json({error:"Origin not allowed"},403);
  try{
    if(action==="oauth-start"){
      if(!GITHUB_CLIENT_ID)throw new Error("GITHUB_CLIENT_ID is not configured");
      const {data:ctx,error}=await (await import("npm:@supabase/server@1")).createSupabaseContext(req,{auth:"user"});
      if(error)return json({error:error.message},error.status);
      const requestedReturn=u.searchParams.get("return_to")||APP_URL;
      const ret=new URL(requestedReturn,APP_URL).origin===APP_ORIGIN?requestedReturn:APP_URL;
      const state=crypto.randomUUID();
      const admin=ctx.supabaseAdmin;
      await admin.from(STATE_TABLE).delete().lt("expires_at",new Date().toISOString());
      await admin.from(STATE_TABLE).insert({state,user_id:ctx.userClaims.id,return_to:ret,expires_at:new Date(Date.now()+10*60*1000).toISOString()});
      const cb=u.origin+u.pathname+"?action=oauth-callback";
      const auth="https://github.com/login/oauth/authorize?client_id="+encodeURIComponent(GITHUB_CLIENT_ID)+"&redirect_uri="+encodeURIComponent(cb)+"&scope="+encodeURIComponent("repo read:user user:email offline_access")+"&state="+encodeURIComponent(state);
      return json({url:auth});
    }
    if(action==="oauth-callback"){
      if(!GITHUB_CLIENT_ID||!GITHUB_CLIENT_SECRET)throw new Error("GitHub OAuth secrets are not configured");
      const code=u.searchParams.get("code"),state=u.searchParams.get("state")||"";
      if(!code||!state)throw new Error("GitHub authorization data missing");
      const admin=adminClient();
      const {data:st}=await admin.from(STATE_TABLE).select("*").eq("state",state).maybeSingle();
      if(!st||new Date(st.expires_at).getTime()<Date.now())throw new Error("OAuth state expired");
      await admin.from(STATE_TABLE).delete().eq("state",state);
      const cb=u.origin+u.pathname+"?action=oauth-callback";
      const tokenResp=await fetch("https://github.com/login/oauth/access_token",{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json"},body:JSON.stringify({client_id:GITHUB_CLIENT_ID,client_secret:GITHUB_CLIENT_SECRET,code,redirect_uri:cb})});
      const tok=await tokenResp.json();if(!tok.access_token)throw new Error(tok.error_description||"GitHub token exchange failed");
      const me=await gh(tok.access_token,"https://api.github.com/user");
      await admin.from(TABLE).upsert({user_id:st.user_id,github_user_id:me.id,github_login:me.login,access_token_enc:await enc(tok.access_token),refresh_token_enc:tok.refresh_token?await enc(tok.refresh_token):null,expires_at:tok.expires_in?new Date(Date.now()+Number(tok.expires_in)*1000).toISOString():null,scopes:tok.scope||"",updated_at:new Date().toISOString()});
      const ret=new URL(st.return_to||APP_URL,APP_URL).origin===APP_ORIGIN?(st.return_to||APP_URL):APP_URL;
      return Response.redirect(ret+(ret.includes("?")?"&":"?")+"github=connected",302);
    }
    const {data:ctx,error}=await (await import("npm:@supabase/server@1")).createSupabaseContext(req,{auth:"user"});
    if(error)return json({error:error.message},error.status);
    const uid=ctx.userClaims.id;
    const admin=ctx.supabaseAdmin;
    const {data:conn}=await admin.from(TABLE).select("*").eq("user_id",uid).maybeSingle();
    if(action==="status")return json({connected:!!conn,login:conn?.github_login||null});
    if(action==="disconnect"){await admin.from(TABLE).delete().eq("user_id",uid);return json({ok:true});}
    if(!conn)return json({error:"GitHub is not connected"},400);
    const token=await dec(conn.access_token_enc);
    if(action==="repos"){const j=await gh(token,"https://api.github.com/user/repos?per_page=100&sort=updated");return json({repos:j.map((x:any)=>({full_name:x.full_name,private:x.private}))});}
    if(action==="put-file"||action==="get-file"){
      const body=await req.json();const repo=String(body.repo||""),path=String(body.path||"");if(!/^[^/]+\/[^/]+$/.test(repo)||!path||path.length>500)throw new Error("Invalid repository or path");
      const url="https://api.github.com/repos/"+repo+"/contents/"+path.split("/").map(encodeURIComponent).join("/");
      if(action==="get-file"){const j=await gh(token,url);const encoded=String(j.content||"").replace(/\n/g,"");if(encoded.length>2800000)throw new Error("File is too large");const raw=atob(encoded);const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));const decoded=new TextDecoder().decode(bytes);return json({content:decoded,sha:j.sha});}
      const old=await gh(token,url).catch(()=>null);const source=String(body.content||"");if(source.length>2000000)throw new Error("File content is too large");const content=btoa(unescape(encodeURIComponent(source)));const payload:any={message:String(body.message||"AI Teams backup").slice(0,200),content};if(old?.sha)payload.sha=old.sha;const j=await gh(token,url,{method:"PUT",body:JSON.stringify(payload)});return json({ok:true,sha:j.content?.sha||null});
    }
    return json({error:"Unknown action"},400);
  }catch(e){return json({error:e instanceof Error?e.message:String(e)},500);}
});