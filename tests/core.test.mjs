import test from 'node:test';
import assert from 'node:assert/strict';
import {LIMITS,validateProvider,normalizeBase,parseBatch,bindFiles,validateFiles,createSnapshot,snapshotPreview,requestBody,discoverModels,VideoAPI,PollScheduler,TaskQueue,taskRecord,restoreTasks} from '../src/core.js';
import {BUILTIN_PROVIDER} from '../src/presets.js';
import {FakeClock,flush,deferred} from './helpers.mjs';

const provider=validateProvider(BUILTIN_PROVIDER), model=provider.models[0];
const form=(values={})=>({base:'https://example.test/v1/',key:'test-unique-secret',model:model.id,prompt:'一段视频',seconds:5,resolution:'720p',audio:'',images:[],videos:[],extra:'{}',...values});
const snapshot=(values={})=>createSnapshot(form(values),model,provider);
const task=(id='original-id')=>({uid:id,id,base:'https://example.test',key:'old-key',model:model.id,summary:'视频',state:'queued',pollState:'active',sessionStart:null,lastStart:null,createdAt:0,generation:0,statuses:provider.statuses});
const scheduler=(clock,getStatus,limits=LIMITS)=>new PollScheduler({clock,getStatus,limits});

test('base normalization rejects credential/query/protocol confusion',()=>{
  assert.equal(normalizeBase('https://example.test/prefix/v1/'),'https://example.test/prefix');
  for(const base of ['file:///tmp/x','https://user:pass@example.test','https://example.test?k=secret','javascript:alert(1)'])assert.throws(()=>normalizeBase(base));
});
test('provider schema exports an allowlist and preserves capability tri-state',()=>{
  const input=structuredClone(BUILTIN_PROVIDER);input.apiKey='top-secret';input.models[0].apiKey='nested-secret';input.models[0].metadata={token:'secret'};input.models[0].seconds.password='secret';
  const result=validateProvider(input),exported=JSON.stringify(result);
  assert(!exported.includes('secret'));assert.equal(result.models[0].media.image,null);assert.equal(result.models[0].audio,false);
  assert.throws(()=>validateProvider({...input,fields:{audio:'prompt'}}));
  assert.throws(()=>validateProvider({...input,statuses:{running:['queued']}}));
  assert.throws(()=>validateProvider(JSON.parse('{"schemaVersion":1,"models":[],"__proto__":{}}')));
});
test('catalog includes only explicit video endpoints and preserves unknown brands and IDs',()=>{
  const discovered=discoverModels({data:[{model_name:model.id,supported_endpoint_types:['openai-video']},{id:'Future-MODEL.v4',supported_endpoint_types:['openai-video']},{id:'not-video',supported_endpoint_types:['chat']},{id:'sora-guessed'}]},provider);
  assert.deepEqual(discovered.map(x=>x.id),[model.id,'Future-MODEL.v4']);assert.equal(discovered[1].brand,'未分类');assert.equal(discovered[1].audio,null);
});
test('TXT/JSON/CSV parsing: BOM, empty lines, escaped commas/quotes/newlines, exact error rows and 20 limit',()=>{
  assert.deepEqual(parseBatch('\uFEFF一\n\n二').map(x=>x.row),[1,3]);
  assert.equal(parseBatch('["一",{"prompt":"二","images":["a.png"]}]')[1].images[0],'a.png');
  const csv='prompt,seconds,images\r\n"海岸,夜晚",5,a.png|b.png\r\n"换行\n以及""引号""",8,\r\n';
  const rows=parseBatch(csv,'csv');assert.equal(rows[0].prompt,'海岸,夜晚');assert.deepEqual(rows[0].images,['a.png','b.png']);assert.equal(rows[1].prompt,'换行\n以及"引号"');assert.equal(rows[1].row,3);assert.deepEqual(rows[1].images,[]);
  assert.throws(()=>parseBatch('prompt,seconds\n好,5\n错误','csv'),/第 3 行/);
  assert.throws(()=>parseBatch('prompt,seconds\n"未闭合,5','csv'),/第 2 行/);
  assert.equal(parseBatch(Array(20).fill('视频').join('\n')).length,20);
  assert.throws(()=>parseBatch(Array(21).fill('视频').join('\n')),/21/);
  assert.throws(()=>parseBatch('[{"prompt":"视频","model":"bypass"}]'),/不支持/);
});
test('local filename associations detect missing/ambiguous files and preserve requested order',()=>{
  const a=new File(['a'],'a.png',{type:'image/png'}),b=new File(['b'],'b.png',{type:'image/png'});
  assert.deepEqual(bindFiles(['b.png','a.png'],[a,b],4,'图片'),[b,a]);
  assert.throws(()=>bindFiles(['missing.png'],[a],4,'图片'),/第 4 行/);
  assert.throws(()=>bindFiles(['a.png'],[a,a],2,'图片'),/名称重复/);
  assert.throws(()=>validateFiles('image',[a],model),/尚未确认/);
  assert.throws(()=>validateFiles('image',[new File(['x'],'attack.svg',{type:'image/svg+xml'})],model,true),/类型/);
  assert.throws(()=>validateFiles('image',[new File([],'empty.png')],model,true),/为空/);
});
test('CSV empty scalar cells inherit shared settings, media empty cells explicitly select no files',()=>{
  const row=parseBatch('prompt,seconds,resolution,audio,images,videos\n一,,,,,','csv')[0];
  const snap=createSnapshot(form({override:true,seconds:10,resolution:'1080p',audio:true,images:[new File(['a'],'a.png')]}),model,provider,row);
  assert.equal(snap.body.seconds,'10');assert.equal(snap.body.resolution,'1080p');assert.equal(snap.body.generate_audio,true);assert.equal(snap.files.image.length,0);
});
test('confirmation snapshot is frozen across all mutable inputs and FormData appends every file',async()=>{
  const images=[new File(['a'],'a.png',{type:'image/png'}),new File(['b'],'b.png',{type:'image/png'})];
  const videos=[1,2,3].map(n=>new File([`video-${n}`],`v${n}.mp4`,{type:'video/mp4'}));
  const extra={seed:42,options:{camera:'pan'}},fields={...provider.fields};
  const mutableProvider={...provider,fields};
  const input=form({override:true,images,videos,extra,audio:'true',resolution:'future-res'});
  const snap=createSnapshot(input,model,mutableProvider);
  input.base='https://other.test';input.key='changed';input.model='changed';input.prompt='changed';input.seconds=90;input.audio=false;input.resolution='changed';images.shift();videos.reverse();extra.options.camera='changed';fields.image='changed';
  assert.equal(snap.base,'https://example.test');assert.equal(snap.key,'test-unique-secret');assert.equal(snap.body.prompt,'一段视频');assert.equal(snap.body.seconds,'5');assert.equal(snap.body.generate_audio,true);assert.equal(snap.body.resolution,'future-res');assert.equal(snap.body.options.camera,'pan');
  assert.throws(()=>{snap.body.prompt='mutation';},TypeError);
  const body=requestBody(snap);assert(body instanceof FormData);assert.deepEqual(body.getAll('input_reference').map(x=>x.name),['a.png','b.png']);assert.deepEqual(body.getAll('reference_videos').map(x=>x.name),['v1.mp4','v2.mp4','v3.mp4']);assert.equal(await body.getAll('reference_videos')[2].text(),'video-3');
  assert(!JSON.stringify(snapshotPreview(snap)).includes(snap.key));
});
test('preset restrictions and advanced aliases cannot silently override confirmed controls',()=>{
  assert.throws(()=>snapshot({audio:true}),/声音配置不可用/);
  assert.throws(()=>snapshot({seconds:31}),/上限 30/);
  assert.throws(()=>snapshot({resolution:'8k'}),/不在/);
  for(const field of ['model','duration','generate-audio','image_urls','reference_videos','content'])assert.throws(()=>snapshot({override:true,extra:JSON.stringify({[field]:'bypass'})}),/不能覆盖/);
  assert.equal(snapshot({override:true,seconds:90,audio:false,resolution:'8k'}).body.seconds,'90');
  const known={...model,media:{image:true,video:true},maxFiles:{image:1}};
  assert.throws(()=>createSnapshot(form({images:[new File(['x'],'a.png'),new File(['y'],'b.png')]}),known,provider),/最多允许 1/);
});
test('VideoAPI sends snapshot auth/body, disallows redirect, uses same-origin content and redacts errors',async()=>{
  const calls=[],snap=snapshot();const api=new VideoAPI(async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({id:'task/1',status:'queued'}),{headers:{'Content-Type':'application/json'}});});
  await api.submit(snap);await api.status({base:snap.base,id:'task/1'},snap.key);await api.content({base:snap.base,id:'task/1'},snap.key);
  assert.equal(calls[0].options.headers.Authorization,'Bearer '+snap.key);assert.equal(JSON.parse(calls[0].options.body).prompt,snap.body.prompt);assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[2].url,'https://example.test/v1/videos/task%2F1/content');
  const bad=new VideoAPI(async()=>new Response(JSON.stringify({error:{message:snap.key+' rejected'}}),{status:401}));await assert.rejects(bad.submit(snap),error=>error.message.includes('401') && !error.message.includes(snap.key));
});
test('catalog fallback performs at most two GETs, never assumes unlabeled /models entries are video',async()=>{
  const paths=[];const api=new VideoAPI(async(url)=>{paths.push(url);return paths.length===1 ? new Response('no',{status:404}) : Response.json({data:[{id:'sora-guessed'}]});});
  await assert.rejects(api.discover('https://example.test','secret',provider),/刷新失败/);assert.equal(paths.length,2);
});
test('20 submissions are serial, immutable, not replayed on uncertain response, and duplicate snapshots rejected',async()=>{
  const clock=new FakeClock(),releases=[],seen=[];let active=0,max=0;
  const queue=new TaskQueue({clock,api:{submit:async snap=>{active++;max=Math.max(max,active);seen.push(snap.body.prompt);const gate=deferred();releases.push(gate);await gate.promise;active--;if(seen.length===2)throw new Error('connection lost');return{id:'id-'+seen.length,status:'queued'};},status:()=>new Promise(()=>{})}});
  const snaps=Array.from({length:20},(_,i)=>snapshot({prompt:'row-'+i}));queue.enqueue(snaps);assert.equal(seen.length,1);assert.throws(()=>queue.enqueue([snaps[0]]),/重复/);
  for(let i=0;i<20;i++){releases[i].resolve();await flush();}
  assert.equal(max,1);assert.equal(seen.length,20);assert.equal(queue.tasks[1].state,'uncertain');assert.equal(queue.tasks[1].id,null);assert(queue.tasks.every(t=>t.snapshot===null));
  await clock.advance(100000);assert.equal(seen.length,20);queue.close();
  const another=new TaskQueue({clock});assert.throws(()=>another.enqueue([snaps[0],snaps[0]]),/重复/);assert.throws(()=>another.enqueue([...snaps,snapshot()]),/1–20/);another.close();
});
test('stopQueue removes unsent snapshots but cannot undo an in-flight POST',async()=>{
  const gate=deferred();let posts=0;const queue=new TaskQueue({api:{submit:async()=>{posts++;await gate.promise;return{id:'only-one',status:'completed'};}}});
  queue.enqueue([snapshot(),snapshot()]);queue.stopQueue();gate.resolve();await flush();assert.equal(posts,1);assert.equal(queue.tasks[1].state,'needs_files');assert.equal(queue.tasks[1].snapshot,null);queue.close();
});
test('poll budget starts on first query; 360 starts at 0..1795sec, no boundary query, manual resume is GET only',async()=>{
  const clock=new FakeClock(),starts=[];const poll=scheduler(clock,async t=>{starts.push(clock.now());return{status:'queued'};});const t=task();poll.add(t);assert.equal(t.sessionStart,null);
  await clock.advance(1800000);assert.equal(starts.length,360);assert.equal(starts[0],0);assert.equal(starts.at(-1),1795000);assert.equal(t.pollState,'paused');assert.equal(t.pauseReason,'budget');assert.equal(t.state,'queued');
  poll.resume(t);await clock.advance(0);assert.equal(starts.at(-1),1800000);assert.equal(t.sessionStart,1800000);poll.close();
});
test('twenty tasks share 3 slots without starvation; per-slot/per-task starts remain >=5sec',async()=>{
  const clock=new FakeClock(),starts=[];const poll=scheduler(clock,async t=>{starts.push({id:t.id,at:clock.now()});return{status:'in_progress'};});
  for(let i=0;i<20;i++)poll.add(task('t'+i));await clock.advance(35000);
  assert.equal(new Set(starts.map(x=>x.id)).size,20);
  for(let time=0;time<=35000;time+=5000)assert(starts.filter(x=>x.at===time).length<=3);
  for(const id of new Set(starts.map(x=>x.id))){const times=starts.filter(x=>x.id===id).map(x=>x.at);for(let i=1;i<times.length;i++)assert(times[i]-times[i-1]>=5000);}
  poll.close();
});
test('in-flight limit is three, never same-task overlap; timeout releases slot and pauses without retry',async()=>{
  const clock=new FakeClock();let active=0,max=0,calls=0;const running=new Set();
  const poll=scheduler(clock,(t,signal)=>{calls++;assert(!running.has(t.id));running.add(t.id);active++;max=Math.max(max,active);signal.addEventListener('abort',()=>{active--;running.delete(t.id);},{once:true});return new Promise(()=>{});});
  for(let i=0;i<4;i++)poll.add(task('t'+i));await clock.advance(29999);assert.equal(calls,3);assert.equal(max,3);
  await clock.advance(1);assert.equal(calls,4);assert.equal(poll.tasks.filter(t=>t.pauseReason==='error').length,3);
  await clock.advance(60000);assert.equal(calls,4);assert.equal(active,0);poll.close();
});
test('stop and budget expiry abort in-flight GET; late completion cannot restart query or mark completed',async()=>{
  for(const reason of ['manual','budget']){
    const clock=new FakeClock(),gate=deferred();let signal,calls=0;
    const poll=scheduler(clock,(t,s)=>{signal=s;calls++;return gate.promise;},{...LIMITS,session:1000,queryTimeout:30000});const t=task();poll.add(t);await clock.advance(0);
    if(reason==='manual')poll.pause(t,'manual');else await clock.advance(1000);
    assert(signal.aborted);gate.resolve({status:'completed'});await flush();await clock.advance(5000);assert.equal(calls,1);assert.equal(t.pollState,'paused');assert.equal(t.state,'queued');poll.close();
  }
});
test('network, HTTP and unknown status pause; only explicit failed is a generation failure',async()=>{
  for(const response of [new Error('HTTP 401'),new Error('HTTP 503'),new Error('network'),{status:'future-state'},{status:'completed'},{status:'failed'}]){
    const clock=new FakeClock();let calls=0;const poll=scheduler(clock,async()=>{calls++;if(response instanceof Error)throw response;return response;});const t=task();poll.add(t);await clock.advance(60000);
    assert.equal(calls,1);if(['completed','failed'].includes(response.status)){assert.equal(t.state,response.status);assert.equal(t.pollState,'done');}else{assert.equal(t.pollState,'paused');assert.equal(t.state,'queued');}poll.close();
  }
});
test('page suspension does not backfill missed queries',async()=>{
  const clock=new FakeClock(),starts=[];const poll=scheduler(clock,async()=>{starts.push(clock.now());return{status:'queued'};});poll.add(task());await clock.advance(0);
  clock.time=600000;await clock.advance(0);assert.deepEqual(starts,[0,600000]);poll.close();
});
test('refresh retains original budget/last start, does not POST, terminal/manual/error/expired records stay stopped',async()=>{
  const active={...task(),sessionStart:1000,lastStart:5000};const records=[active,{...task('terminal'),state:'completed',pollState:'done'},{...task('manual'),pollState:'paused',pauseReason:'manual'},{...task('err'),pollState:'paused',pauseReason:'error'},{...task('missing')},{...task('expired'),sessionStart:0,lastStart:1000},{...task('pending'),id:null,state:'submitting'}].map(taskRecord);
  const clock=new FakeClock(1800000),calls=[];const queue=new TaskQueue({clock,getKey:()=> 'restored-key',api:{status:async t=>{calls.push(t.id);return{status:'queued'};},submit:()=>{throw new Error('must not POST');}}});queue.restore(records);await clock.advance(0);assert.deepEqual(calls,['original-id']);assert.equal(queue.tasks[0].sessionStart,1000);assert.equal(queue.tasks[4].pauseReason,'restore');assert.equal(queue.tasks[5].pauseReason,'budget');assert.equal(queue.tasks[6].state,'uncertain');
  await clock.advance(1000);assert.equal(queue.tasks[0].pauseReason,'budget');assert.equal(calls.length,1);queue.close();
});
test('refresh waits remaining task interval, missing Key pauses, manual continue uses corrected Key and same ID',async()=>{
  const record=taskRecord({...task(),sessionStart:0,lastStart:5000});const clock=new FakeClock(6000),calls=[];
  const queue=new TaskQueue({clock,getKey:()=> 'new-key',api:{status:async(t,key)=>{calls.push({id:t.id,key,at:clock.now()});return{status:'queued'};}}});queue.restore([record]);await clock.advance(3999);assert.equal(calls.length,0);await clock.advance(1);assert.equal(calls[0].at,10000);assert.equal(queue.tasks[0].sessionStart,0);queue.stopPolling(queue.tasks[0]);queue.tasks[0].key='old-key';queue.resume(queue.tasks[0]);await clock.advance(5000);assert.equal(calls[1].key,'new-key');assert.equal(calls[1].id,'original-id');queue.close();
  const missing=new TaskQueue({clock});missing.restore([record]);assert.equal(missing.tasks[0].pauseReason,'credentials');missing.close();
});
test('serialized task records exclude Key/files/full body/errors and pending submits never restore as POSTs',()=>{
  const snap=snapshot(),t={...task(),snapshot:snap,body:snap.body,key:snap.key,error:snap.key,controller:new AbortController()};const serialized=JSON.stringify(taskRecord(t));assert(!serialized.includes(snap.key));assert(!serialized.includes('snapshot'));assert(!serialized.includes('controller'));
  const restored=restoreTasks([taskRecord({...t,id:null,state:'waiting'})]);assert.equal(restored[0].state,'needs_files');assert.equal(restored[0].pollState,'paused');
  const uncertain=restoreTasks([taskRecord({...t,id:null,state:'uncertain'})])[0];assert.equal(uncertain.state,'uncertain');assert.equal(uncertain.pauseReason,'submit');
});
test('restored different task waits for the latest start even when that other task is terminal',async()=>{
  const clock=new FakeClock(6000),starts=[];
  const queue=new TaskQueue({clock,getKey:()=> 'key',api:{status:async t=>{starts.push({id:t.id,time:clock.now()});return{status:'queued'};}}});
  queue.restore([taskRecord({...task('a'),state:'completed',pollState:'done',sessionStart:0,lastStart:5900}),taskRecord({...task('b'),sessionStart:0,lastStart:0})]);
  await clock.advance(4899);assert.equal(starts.length,0);await clock.advance(1);assert.deepEqual(starts,[{id:'b',time:10900}]);queue.close();
});
test('two page schedulers have independent three-slot budgets and no hidden cross-page claim',async()=>{
  const clock=new FakeClock(),starts=[[],[]],polls=starts.map(records=>scheduler(clock,async t=>{records.push(clock.now());return{status:'queued'};}));
  for(const poll of polls)for(let i=0;i<5;i++)poll.add(task('t'+i));await clock.advance(5000);
  assert.deepEqual(starts.map(records=>records.filter(time=>time===0).length),[3,3]);assert.deepEqual(starts.map(records=>records.filter(time=>time===5000).length),[3,3]);polls.forEach(poll=>poll.close());
});
test('load: twenty active tasks sustain <=3 starts per rolling 5sec window and all exhaust their own budget',async()=>{
  const clock=new FakeClock(),starts=[];const poll=scheduler(clock,async t=>{starts.push({at:clock.now(),id:t.id});return{status:'in_progress'};});
  for(let i=0;i<20;i++)poll.add(task('load-'+i));await clock.advance(1840000);
  for(let i=0;i<starts.length;i++)assert(starts.filter(x=>x.at>=starts[i].at && x.at<starts[i].at+5000).length<=3);
  assert(poll.tasks.every(t=>t.pollState==='paused' && t.pauseReason==='budget'));
  assert.equal(new Set(starts.map(x=>x.id)).size,20);assert(starts.length<=1104);
  console.log(`mock load: 20 tasks, ${starts.length} total status GETs, <=3 starts/5s, all paused by per-task budget`);poll.close();
});
test('HTTP 401/403/422/500/503 and network rejection all leave a single uncertain POST without automatic replay',async()=>{
  for(const code of [401,403,422,500,503,'network']){
    let count=0;const clock=new FakeClock();const api=new VideoAPI(async()=>{count++;if(code==='network')throw new TypeError('Failed to fetch');return Response.json({error:{message:'test-unique-secret rejected'}},{status:code});});const queue=new TaskQueue({api,clock});queue.enqueue([snapshot()]);await flush();await clock.advance(60000);assert.equal(count,1);assert.equal(queue.tasks[0].state,'uncertain');assert.equal(queue.tasks[0].id,null);assert(!queue.tasks[0].error.includes('test-unique-secret'));queue.close();
  }
});
