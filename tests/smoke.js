const fs=require('fs');
const assert=require('assert');
const vm=require('vm');

const html=fs.readFileSync('index.html','utf8');
const core=fs.readFileSync('app-core.js','utf8');
const inlineBlocks=[...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi)];
inlineBlocks.forEach((m,i)=>new vm.Script(m[1],{filename:'index-inline-'+i+'.js'}));
const requiredIds=['chat','adminChatInput','adminChatBtn','teamName','goal','onlineTeamBtn'];
for(const id of requiredIds) assert(html.includes('id="'+id+'"')||html.includes("id='"+id+"'"),'missing UI id: '+id);
assert(html.includes('id="addAgentBtn"')||html.includes("id='addAgentBtn'"),'Agent Builder trigger missing');

assert(html.includes('id=\"agentBuilderModal\"'),'Agent Builder modal missing');
assert(html.includes('id=\"agentBuilderProvider\"'),'Agent Builder provider selector missing');
assert(html.includes('id=\"agentBuilderModel\"'),'per-agent model selector missing');
assert(html.includes('function agentBuilderModels(providerId)'),'Agent model catalog missing');
assert(html.includes('function openAgentBuilder()'),'Agent Builder opener missing');

assert(html.includes('id="workflowBuilderBtn"'),'Workflow Builder trigger missing');
assert(html.includes('id="workflowBuilderModal"'),'Workflow Builder modal missing');
assert(core.includes('function openWorkflowBuilder()'),'Workflow Builder opener missing');
assert((core.match(/function openWorkflowBuilder\(\)/g)||[]).length===1,'Workflow Builder must have exactly one implementation');
assert(core.includes('function getWorkflowAgents()'),'Workflow agent ordering helper missing');
assert(core.includes('function applyWorkflowOrder()'),'Workflow order persistence missing');
assert(core.includes('state.workflowOrder'),'Workflow order state missing');
assert(core.includes('const legacySteps=state.workflow&&Array.isArray(state.workflow.steps)?state.workflow.steps:[]'),'Legacy workflow migration missing');
assert(core.includes('delete state.workflow;'),'Legacy workflow state must be normalized away');
assert(!core.includes('function renderWorkflowSteps()'),'Legacy Workflow step renderer must be removed');
assert(!core.includes('state.workflow=state.workflow||{name:\'پیش\u200cفرض\',steps:[]}'),'Legacy workflow initialization must be removed');

const forbidden=['oai.stablehorde.net','YOUR_SUPABASE_URL','YOUR_SUPABASE_PUBLISHABLE_KEY'];
for(const value of forbidden) assert(!html.includes(value),'forbidden/stale marker in index.html: '+value);

const scripts=['app-core.js','provider-manager.js','cloud-storage.js','github-storage.js','google-drive-storage.js','multiplayer.js','workspace-manager.js','ai-teams-v3.js'];
for(const file of scripts){const source=fs.readFileSync(file,'utf8');new Function(source);}

const provider=fs.readFileSync('provider-manager.js','utf8');
assert(provider.includes("https://oai.aihorde.net/v1/chat/completions"),'current Horde endpoint missing');
assert(provider.includes("https://aihorde.net/api/v2/generate/text/async"),'Horde direct async endpoint missing');
assert(provider.includes("const headers={'Content-Type':'application/json','Authorization':'Bearer 0000000000','X-Client':'AI-Teams'}"),'Horde fallback headers missing');
assert(provider.includes('async function universalCallAgent(a,goal,transcript,signal)'),'AI Horde universal runtime must accept cancellation signal');
assert(provider.includes('const requestSignal=controller.signal'),'AI Horde must use the controller signal for every request');
assert(provider.includes('signal.addEventListener(\'abort\',abortHandler,{once:true})'),'AI Horde must bridge external AbortSignal to its timeout controller');
assert(provider.includes('window.aiTeamsTrackController?window.aiTeamsTrackController():new AbortController()'),'AI Horde must register its controller with the team-wide cancellation manager');
assert(provider.includes('window.aiTeamsReleaseController(controller)'),'AI Horde must release its controller after completion');
assert(provider.includes("const requestSignal=controller.signal"),'AI Horde must use its own timeout controller signal');
assert(provider.includes('signal&&abortHandler)signal.removeEventListener(\'abort\',abortHandler)'),'AI Horde must remove abort listeners after each request');
assert(html.includes("window.aiTeamsUniversalCallAgent==='function'"),'index must delegate Horde to robust provider runtime');
assert(html.includes("window.aiTeamsUniversalCallAgent(a,goal,transcript,signal)"),'index callAgent must delegate Horde to the universal provider runtime with cancellation signal');
assert(!provider.includes('oai.stablehorde.net'),'stale Horde endpoint remains');
assert((provider.match(/oai\.aihorde\.net\/v1\/chat\/completions/g)||[]).length===2,'Horde endpoint should have one catalog and one runtime reference');

const cloud=fs.readFileSync('cloud-storage.js','utf8');
assert(cloud.includes('saveQueued'),'cloud save race guard missing');
assert(cloud.includes('streamAIGateway(payload,onDelta,signal)'),'stream abort signal missing');

const multi=fs.readFileSync('multiplayer.js','utf8');
assert(multi.includes('MAX_HUMANS=8'),'collaboration capacity guard missing');
assert(multi.includes('MAX_MESSAGE_LENGTH=4000'),'collaboration message limit missing');
assert(multi.includes('roster.size>=MAX_HUMANS-1'),'room capacity must include the host in the human limit');
assert(multi.includes("people:[{id:'host-'+roomCode"),'guest roster must include the host');

const drive=fs.readFileSync('google-drive-storage.js','utf8');
assert(drive.includes('appDataFolder'),'Drive scope/storage isolation missing');
assert(drive.includes('__gdriveApplyingRemote'),'Drive remote-apply guard missing');

const aiGateway=fs.readFileSync('supabase/functions/ai-gateway/index.ts','utf8');
assert(aiGateway.includes('consume_ai_gateway_rate_limit'),'Gateway rate limit missing');
assert(aiGateway.includes('https://oai.aihorde.net/v1/chat/completions'),'Gateway Horde endpoint missing');
assert(!aiGateway.includes('oai.stablehorde.net'),'stale Gateway Horde endpoint remains');

const ghGateway=fs.readFileSync('supabase/functions/github-gateway/index.ts','utf8');
assert(ghGateway.includes('GITHUB_TOKEN_ENCRYPTION_KEY'),'GitHub token encryption missing');
assert(ghGateway.includes('oauth-callback'),'GitHub OAuth callback missing');

console.log('AI Teams smoke test: PASS');

assert(html.includes('function openKnowledgePanel()'),'Knowledge panel missing');
assert(html.includes('function ensureTimeline()'),'Execution timeline state missing');
assert(html.includes("timelineEvent('start',a"),'Timeline Agent start event missing');
assert(html.includes("timelineEvent('complete',a"),'Timeline Agent completion event missing');
assert(html.includes('id=\"teamTimelinePanel\"'),'Timeline panel renderer missing');\nassert(html.includes('function knowledgeContext(query,limit)'),'Knowledge search missing');
assert(html.includes('id="knowledgeFile"'),'Knowledge file input missing');
assert(html.includes('state.knowledge'),'Knowledge state missing');

assert(html.includes('async function refreshHordeModels()'),'dynamic free Horde model refresh missing');
assert(html.includes("provider.value==='horde'"),'Agent Builder should use refreshed Horde models');

assert(fs.existsSync('ai-teams-v3.js'),'v3 orchestration layer missing');
const v3=fs.readFileSync('ai-teams-v3.js','utf8');
assert(v3.includes('function buildEvidence('),'Evidence builder missing');
assert(v3.includes('function renderFinalHTML('),'Final output renderer missing');
assert(v3.includes('function exportReport('),'Final report export missing');
assert(v3.includes('function pauseRun()')&&v3.includes('function resumeRun()'),'Pause/resume controls missing');
assert(v3.includes('function retryCurrent()')&&v3.includes('function skipCurrent()')&&v3.includes('function stopRun()'),'Run control functions missing');
for(const needle of ['runSequentialV3','pauseRun','resumeRun','retryCurrent','skipCurrent','stopRun','safeCalc','aiTeamsV3Audit','v3TimelineList','agentMemory']) assert(v3.includes(needle),'v3 invariant missing: '+needle);
assert(v3.includes('function runtimePerformance()'),'runtime performance health check missing');
assert(v3.includes('function safeCalc(expr){'),'safe calculator missing');
assert(!/function safeCalc[\\s\\S]{0,1800}Function\\(/.test(v3),'safe calculator must not use dynamic Function evaluation');
assert(v3.includes("if((op==='/'||op==='%')&&rhs===0)throw new Error('zero')"),'safe calculator zero-division guard missing');
assert(v3.includes('if(i!==s.length||!Number.isFinite(value))throw new Error(\'invalid\')'),'safe calculator trailing-token guard missing');
assert(v3.includes('function runtimeUIHealth()'),'runtime UI health check missing');
assert(v3.includes('function runtimeTestHealth()'),'runtime test health check missing');
assert(v3.includes("{n:12,label:'Performance',ok:perf.ok"),'Performance stage must use measured health');
assert(v3.includes("{n:13,label:'UI/UX',ok:ui.ok"),'UI/UX stage must use measured health');
assert(v3.includes("{n:14,label:'Tests/CI',ok:tests.ok"),'Tests/CI stage must use runtime health');
console.log('AI Teams v3 smoke invariants: PASS');

(function(){
 const fs=require('fs'); const v3=fs.readFileSync('ai-teams-v3.js','utf8');
 if(!v3.includes('const src=String(text||\'\');')) throw new Error('v3 tool parser source guard missing');
 if(!v3.includes('new AbortController()')) throw new Error('v3 AbortController missing');
 if(!v3.includes('window.aiTeamsAbortAll')) throw new Error('v3 global abort integration missing');
 console.log('v3 tool parser/abort invariants PASS');
})();
