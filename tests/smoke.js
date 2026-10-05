const fs=require('fs');
const assert=require('assert');

const html=fs.readFileSync('index.html','utf8');
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
assert(html.includes('function openWorkflowBuilder()'),'Workflow Builder opener missing');
assert(html.includes('function renderWorkflowSteps()'),'Workflow step renderer missing');
assert(html.includes('workflowSteps().map'),'Workflow execution integration missing');

const forbidden=['oai.stablehorde.net','YOUR_SUPABASE_URL','YOUR_SUPABASE_PUBLISHABLE_KEY'];
for(const value of forbidden) assert(!html.includes(value),'forbidden/stale marker in index.html: '+value);

const scripts=['provider-manager.js','cloud-storage.js','github-storage.js','google-drive-storage.js','multiplayer.js','workspace-manager.js'];
for(const file of scripts){const source=fs.readFileSync(file,'utf8');new Function(source);}

const provider=fs.readFileSync('provider-manager.js','utf8');
assert(provider.includes("https://oai.aihorde.net/v1/chat/completions"),'current Horde endpoint missing');
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
