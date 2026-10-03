import { withSupabase } from "npm:@supabase/server@1";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js/cors";

const GITHUB_CLIENT_ID=Deno.env.get("GITHUB_CLIENT_ID")||"";
const GITHUB_CLIENT_SECRET=Deno.env.get("GITHUB_CLIENT_SECRET")||"";
const APP_URL=Deno.env.get("AI_TEAMS_APP_URL")||"https://amirpash11.github.io/ai-teams12/";
const ENC_KEY=Deno.env.get("GITHUB_TOKEN_ENCRYPTION_KEY")||"";
const TABLE="github_connections";

function json(x,status=200){return new Response(JSON.stringify(x),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});}
function hexToBytes(h){return new Uint8Array(h.match(/.{1,2}/g).map(x=>parseInt(x,16)));}
async function key(){if(!ENC_KEY)throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY is not configured");return crypto.subtle.importKey("raw",hexToBytes(ENC_KEY),"AES-GCM",false,["encrypt","decrypt"]);}
async function enc(s){const iv=crypto.getRandomValues(new Uint8Array(12));const k=await key();const b=new TextEncoder().encode(s);const c=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},k,b));const out=new Uint8Array(iv.length+c.length);out.set(iv);out.set(c,iv.length);return btoa(String.fromCharCode(...out));}
async function dec(s){const a=Uint8Array.from(atob(s),c=>c.charCodeAt(0)),iv=a.slice(0,12),c=a.slice(12);const k=await key();const p=await crypto.subtle.decrypt({name:"AES-GCM",iv},k,c);return new TextDecoder().decode(p);}
async function gh(token,url,init={}){const r=await fetch(url,{...init,headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,"X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json",...(init.headers||{})}});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||"GitHub API error");return j;}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  const u=new URL(req.url), action=u.searchParams.get("action");
  try{
    if(action==="oauth-start"){
      if(!GITHUB_CLIENT_ID)throw new Error("GITHUB_CLIENT_ID is not configured");
      const ret=u.searchParams.get("return_to")||APP_URL;
      const state=btoa(JSON.stringify({return_to:ret,nonce:crypto.randomUUID()}));
      const cb=u.origin+u.pathname+"?action=oauth-callback";
      const auth="https://github.com/login/oauth/authorize?client_id="+encodeURIComponent(GITHUB_CLIENT_ID)+"&redirect_uri="+encodeURIComponent(cb)+"&scope="+encodeURIComponent("repo read:user user:email")+"&state="+encodeURIComponent(state);
      return Response.redirect(auth,302);
    }
    if(action==="oauth-callback"){
      if(!GITHUB_CLIENT_ID||!GITHUB_CLIENT_SECRET)throw new Error("GitHub OAuth secrets are not configured");
      const code=u.searchParams.get("code"),state=u.searchParams.get("state")||"";
      if(!code)throw new Error("GitHub authorization code missing");
      const tokenResp=await fetch("https://github.com/login/oauth/access_token",{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json"},body:JSON.stringify({client_id:GITHUB_CLIENT_ID,client_secret:GITHUB_CLIENT_SECRET,code,redirect_uri:u.origin+u.pathname+"?action=oauth-callback"})});
      const tok=await tokenResp.json();if(!tok.access_token)throw new Error(tok.error_description||"GitHub token exchange failed");
      const me=await gh(tok.access_token,"https://api.github.com/user");
      const authHeader=req.headers.get("Authorization");
      if(!authHeader) {
        const st=JSON.parse(atob(state)); const redirect=(st.return_to||APP_URL)+"?github=connected";
        const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SECRET_KEY")||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const {data:users}=await admin.auth.admin.listUsers({page:1,perPage:1});
        void users;
        return Response.redirect(redirect,302);
      }
      return json({error:"callback must be completed by an authenticated flow"},400);
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
    if(action==="get-file"){const repo=String((await req.json()).repo),path=String((await req.json()).path);void repo;void path;return json({error:"invalid request"},400);}
    if(action==="put-file"||action==="get-file"){
      const body=await req.clone().json();const repo=String(body.repo||""),path=String(body.path||"");if(!/^[^/]+\/[^/]+$/.test(repo)||!path)throw new Error("Invalid repository or path");
      const url="https://api.github.com/repos/"+repo+"/contents/"+path.split("/").map(encodeURIComponent).join("/");
      if(action==="get-file"){const j=await gh(token,url);const raw=atob(String(j.content||"").replace(/\n/g,""));return json({content:raw,sha:j.sha});}
      const old=await gh(token,url).catch(()=>null);const content=btoa(unescape(encodeURIComponent(String(body.content||""))));const payload:any={message:String(body.message||"AI Teams backup"),content};if(old?.sha)payload.sha=old.sha;const j=await gh(token,url,{method:"PUT",body:JSON.stringify(payload)});return json({ok:true,sha:j.content?.sha||null});
    }
    return json({error:"Unknown action"},400);
  }catch(e){return json({error:e instanceof Error?e.message:String(e)},500);}
});