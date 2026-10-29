import { LIMITS, validateProvider, normalizeBase, errorMessage, parseJSON, parseBatch, validateFiles, createSnapshot, snapshotPreview, VideoAPI, TaskQueue, taskRecord } from './core.js';
import { BUILTIN_PROVIDER } from './presets.js';
import { brandLogoData } from './brand-logos.js';

const $ = id => document.getElementById(id);
const ICONS = {
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.55-2L20 8M4 16l2.35 3A7 7 0 0 0 18 17"/>',
  'circle-alert':'<circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>',
  'file-up':'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6m-3 3 3-3 3 3"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  video:'<rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3"/>',
  play:'<path d="m9 5 11 7-11 7z"/>',
  shield:'<path d="M12 22s9-4 9-11V5l-9-3-9 3v6c0 7 9 11 9 11Z"/><path d="m9 12 2 2 4-4"/>',
  sparkles:'<path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7zM20 2v4m-2-2h4"/>',
  x:'<path d="m6 6 12 12M6 18 18 6"/>'
};
document.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[node.dataset.icon] || ICONS.video}</svg>`; });
const SESSION_TASKS='video-studio.tasks.v1', SESSION_KEY='video-studio.key.v1';
let storageWarning=false;
const session={
  read(key){try{return sessionStorage.getItem(key);}catch{return null;}},
  write(key,value){try{sessionStorage.setItem(key,value);}catch{if(!storageWarning){storageWarning=true;notice('浏览器未允许会话存储；本次仍可使用，刷新后无法恢复任务。');}}},
  remove(key){try{sessionStorage.removeItem(key);}catch{}}
};
let provider=validateProvider(BUILTIN_PROVIDER), models=provider.models, mode='single', files={image:[],video:[]}, batchFormat='auto';
let pendingConfirmation=null, batchReadVersion=0, providerReadVersion=0, currentResult=null, currentResultURL=null, resultVersion=0;
const contentControllers=new Set();
const api=new VideoAPI();
function notice(message,success=false){const node=$('notice');node.textContent=message;node.hidden=!message;node.classList.toggle('success',success);}
function guard(fn){return async(...args)=>{try{await fn(...args);}catch(error){notice(errorMessage(error,[$('api-key').value]));}};}
function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node;}
function prettyBytes(size){return size>=1048576 ? `${(size/1048576).toFixed(1)} MB` : `${Math.ceil(size/1024)} KB`;}
function connection(){return {base:normalizeBase($('api-base').value),key:$('api-key').value.trim()};}
function keyFor(base){try{return connection().base === base ? $('api-key').value.trim() : '';}catch{return '';}}
const queue=new TaskQueue({api,getKey:keyFor,persist:records=>session.write(SESSION_TASKS,JSON.stringify(records)),onChange:()=>renderTasks(),onComplete:task=>{if(!currentResult)void loadResult(task);}});
function saveKey(){
  if($('remember-key').checked && $('api-key').value.trim()) {
    try{session.write(SESSION_KEY,JSON.stringify(connection()));}catch{session.remove(SESSION_KEY);}
  } else session.remove(SESSION_KEY);
}
function currentModel(){return models.find(model=>model.id === $('model').value) || null;}
function renderBrandLogo(node,brand){
  const src=brandLogoData(brand);
  node.replaceChildren();
  if(src){const img=document.createElement('img');img.src=src;img.alt='';img.width=20;img.height=20;if(src.includes('currentColor'))img.className='brand-logo-mono';node.append(img);}
  else node.textContent='◇';
}
function closeBrandPicker(focus=false){$('brand-options').hidden=true;$('brand-trigger').setAttribute('aria-expanded','false');if(focus)$('brand-trigger').focus();}
function syncBrandPicker(){
  closeBrandPicker();
  const brand=$('brand').value;$('brand-selected').textContent=brand;renderBrandLogo($('brand-logo'),brand);
  $('brand-options').replaceChildren(...[...$('brand').options].map((option,index)=>{
    const button=element('button','brand-option');button.type='button';button.role='option';button.tabIndex=-1;button.id=`brand-option-${index}`;button.dataset.brand=option.value;button.setAttribute('aria-selected',String(option.value===brand));
    const logo=element('span','brand-logo');logo.setAttribute('aria-hidden','true');renderBrandLogo(logo,option.value);
    button.append(logo,element('span','brand-option-name',option.textContent),element('span','brand-check',option.value===brand ? '✓':''));
    button.addEventListener('click',()=>{$('brand').value=option.value;$('brand').dispatchEvent(new Event('change'));closeBrandPicker(true);});return button;
  }));
}
function openBrandPicker(edge){
  $('brand-options').hidden=false;$('brand-trigger').setAttribute('aria-expanded','true');
  const options=[...$('brand-options').children];
  const selected=options.findIndex(option=>option.getAttribute('aria-selected')==='true');
  options[edge==='first' ? 0 : edge==='last' ? options.length-1 : Math.max(0,selected)]?.focus();
}
function setBrands(preferred){
  const brands=[...new Set(models.map(model=>model.brand))];
  if(!brands.length)brands.push('自定义');
  $('brand').replaceChildren(...brands.map(brand=>new Option(brand,brand)));
  if(brands.includes(preferred))$('brand').value=preferred;
  syncBrandPicker();
  populateModels();
}
function populateModels(preferred){
  const matching=models.filter(model=>model.brand === $('brand').value);
  $('model').replaceChildren(...matching.map(model=>new Option(model.id,model.id)),new Option('自定义模型…','__custom__'));
  if(matching.some(model=>model.id === preferred) || preferred === '__custom__')$('model').value=preferred;
  applyCapabilities(true);
}
function applyCapabilities(reset=false){
  const model=currentModel(), override=$('override').checked, custom=$('model').value==='__custom__';
  $('custom-model-field').hidden=!custom;
  $('model-name').textContent=custom ? $('custom-model').value || '自定义模型' : model.id;
  renderBrandLogo($('model-monogram'),$('brand').value);
  $('model-source').textContent=custom ? '名称需与 A6API 一致 · 能力待确认' : `模型来源：${model.source} · 能力：${model.capabilitySource || '本地预设'}`;
  $('config-hint').textContent=override ? '已解除工具端预设限制；是否生效由 A6API 与模型接口校验。' : '不支持或尚未确认的配置置灰；勾选自定义配置可解锁。';
  $('seconds').disabled=!override && !model?.seconds;
  $('seconds').min=override ? '-1':'1';
  $('seconds').removeAttribute('max');
  if(!override && model?.seconds)$('seconds').max=String(model.seconds.max);
  if(reset)$('seconds').value=model?.seconds?.default ?? '';
  if(!override && model?.seconds && (!$('seconds').value || Number($('seconds').value)>model.seconds.max || Number($('seconds').value)<1))$('seconds').value=model.seconds.default;
  if(override && !$('seconds').value)$('seconds').value=model?.seconds?.default ?? 5;
  $('seconds-hint').textContent=override ? '自定义时长，由接口校验' : model?.seconds ? `默认 ${model.seconds.default} 秒 · 上限 ${model.seconds.max} 秒` : '时长预设未确认';
  const previous=$('resolution').value || $('custom-resolution').value;
  const all=[...new Set(['480p','720p','1024p','1080p','2k','4k',...(model?.resolutions || [])])];
  $('resolution').replaceChildren(new Option('不设置',''),...all.map(value=>{const option=new Option(value.toUpperCase().replace('P','p'),value);option.disabled=!model?.resolutions?.includes(value);return option;}));
  $('resolution').disabled=!model?.resolutions?.length;
  $('resolution').value=!reset && model?.resolutions?.includes(previous) ? previous : model?.resolutions?.includes('720p') ? '720p' : model?.resolutions?.[0] || '';
  $('resolution').hidden=override;$('custom-resolution').hidden=!override;
  if(reset || (override && !$('custom-resolution').value))$('custom-resolution').value=$('resolution').value || '720p';
  $('resolution-hint').textContent=override ? '可直接输入新档位' : model?.resolutions?.length ? '按当前模型规格预设' : '分辨率预设未确认';
  $('audio').disabled=!override && model?.audio !== true;
  if(reset || $('audio').disabled)$('audio').value='';
  const resolution=override ? $('custom-resolution').value : $('resolution').value;
  for(const option of $('audio').options){
    const sound=option.value==='true' ? 'on':'off';
    option.disabled=!override && option.value!=='' && Boolean(model?.specKeys?.length) && !model.specKeys.some(key=>{const [res,audio,video]=key.split('|');return res===resolution && (audio==='any' || audio===sound) && (video==='any' || video===(files.video.length ? 'yes':'no'));});
  }
  if($('audio').selectedOptions[0]?.disabled)$('audio').value='';
  $('audio-hint').textContent=override ? '由接口校验声音参数' : model?.audio === false ? '当前模型不提供声音配置' : model?.audio === true ? '按规格选择开启或关闭' : '声音预设未确认';
  for(const kind of ['image','video']){
    const support=model?.media?.[kind],disabled=!override && support!==true;
    $(`choose-${kind}`).disabled=disabled;$(`${kind}-files`).disabled=disabled;
    $(`${kind}-drop`).classList.toggle('disabled',disabled);
    $(`${kind}-drop`).setAttribute('aria-disabled',String(disabled));
    $(`${kind}-hint`).textContent=disabled ? support===false ? '该模型不支持此输入' : '上游兼容待确认，可勾选自定义配置尝试' : support===true ? '按模型配置校验数量与文件类型' : '使用兼容字段，最终由上游校验';
    if(disabled)files[kind]=[];
    renderFiles(kind);
  }
}
function renderFiles(kind){
  const list=$(`${kind}-list`);list.replaceChildren();
  files[kind].forEach((file,index)=>{
    const row=element('div','file-row');row.append(element('span','',`${index+1}. ${file.name} · ${prettyBytes(file.size)}`));
    const button=element('button','', '移除');button.type='button';button.setAttribute('aria-label',`移除 ${file.name}`);
    button.addEventListener('click',()=>{files[kind].splice(index,1);renderFiles(kind);updateAudioOptions();});row.append(button);list.append(row);
  });
  $(`clear-${kind}`).hidden=!files[kind].length;
}
function updateAudioOptions(){const value=$('audio').value;applyCapabilities(false);if(!$('audio').disabled && [...$('audio').options].some(option=>option.value===value && !option.disabled))$('audio').value=value;}
function chooseMedia(kind,list){
  if($(`choose-${kind}`).disabled)throw new Error('该输入能力尚未确认；可先勾选自定义配置');
  const candidates=[...files[kind],...Array.from(list || [])];
  validateFiles(kind,candidates,currentModel(),$('override').checked);
  const others=files[kind==='image' ? 'video':'image'];
  if([...candidates,...others].reduce((sum,file)=>sum+file.size,0)>LIMITS.totalBytes)throw new Error('素材总大小超过工具 500 MiB 安全上限');
  files[kind]=candidates;renderFiles(kind);updateAudioOptions();notice('');
}
function formData(){return { ...connection(),model:$('model').value==='__custom__' ? $('custom-model').value : $('model').value,prompt:$('prompt').value,seconds:$('seconds').disabled ? '' : $('seconds').value,resolution:$('override').checked ? $('custom-resolution').value.trim() : $('resolution').disabled ? '' : $('resolution').value,audio:$('audio').disabled ? '' : $('audio').value,override:$('override').checked,images:[...files.image],videos:[...files.video],extra:$('extra').value};}
function prepareConfirmation(){
  const form=formData(), model=currentModel();
  const rows=mode==='batch' ? parseBatch($('batch-input').value,batchFormat) : [null];
  const snapshots=rows.map(row=>{try{return createSnapshot(form,model,provider,row);}catch(error){throw new Error(`${row ? `第 ${row.row} 行：` : ''}${error.message}`);}});
  pendingConfirmation=Object.freeze(snapshots);
  $('confirm-title').textContent=snapshots.length===1 ? '确认生成视频' : `确认生成 ${snapshots.length} 条视频`;
  const summary=element('dl','confirm-summary');
  for(const [label,value] of [['API 地址',`${snapshots[0].base}/v1/videos`],['模型',snapshots[0].body.model],['生成请求',`${snapshots.length} 次 POST · 本页串行提交`],['幂等支持',provider.idempotency ? '按配置发送每行独立 Idempotency-Key' : '目标服务未声明幂等；重复提交由服务端自行负责']])summary.append(element('dt','',label),element('dd','',value));
  $('confirm-summary').replaceChildren(summary);
  $('request-preview').textContent=JSON.stringify(snapshots.map(snapshotPreview),null,2);
  $('confirm-submit').disabled=false;$('confirm-dialog').showModal();
}
function switchMode(next){mode=next;for(const kind of ['single','batch']){const active=kind===mode;$(`${kind}-tab`).classList.toggle('selected',active);$(`${kind}-tab`).setAttribute('aria-selected',String(active));$(`${kind}-panel`).hidden=!active;}$('prepare-label').textContent=mode==='batch' ? '预览批量并生成' : '预览并生成';}
async function readBatch(list){
  const version=++batchReadVersion,selected=Array.from(list || []);
  $('prepare').disabled=false;
  if(selected.length!==1)throw new Error('批量任务文件请一次导入一个');
  const file=selected[0],extension=/\.(txt|json|csv)$/i.exec(file.name)?.[1]?.toLowerCase();
  if(!extension)throw new Error('批量任务文件仅支持 TXT、JSON、CSV');
  if(file.size>LIMITS.importBytes)throw new Error('任务文件超过 2 MiB 安全上限');
  $('prepare').disabled=true;
  try{
    const text=await file.text();if(version!==batchReadVersion)return;
    const rows=parseBatch(text,extension);batchFormat=extension;$('batch-input').value=text;
    $('batch-file-name').textContent=`${file.name} · ${rows.length} 条 · ${prettyBytes(file.size)}`;switchMode('batch');notice('');
  } finally{if(version===batchReadVersion)$('prepare').disabled=false;}
}
function dropzone(id,handler){
  const node=$(id);
  node.addEventListener('dragover',event=>{event.preventDefault();node.classList.add('over');});
  node.addEventListener('dragleave',()=>node.classList.remove('over'));
  node.addEventListener('drop',guard(async event=>{event.preventDefault();node.classList.remove('over');await handler(event.dataTransfer.files);}));
}
const STATE_LABELS={waiting:'等待提交',submitting:'提交中',queued:'排队中',running:'生成中',completed:'已完成',failed:'生成失败',unknown:'状态待确认',uncertain:'提交结果未确认',needs_files:'未提交，需重新确认'};
const PAUSE_LABELS={manual:'已停止查询',budget:'查询已达 30 分钟',error:'查询异常，已暂停',unknown:'状态未知，已暂停',credentials:'等待 Key',restore:'等待手动查询',submit:'请先核实提交结果'};
function renderTasks(){
  $('queue-count').textContent=String(queue.tasks.length);$('stop-queue').disabled=!queue.pending.length;
  const container=$('tasks');if(!queue.tasks.length)return;
  container.replaceChildren();
  for(const task of [...queue.tasks].reverse()){
    const card=element('article','task');card.dataset.taskUid=task.uid;
    const heading=element('div','task-title');heading.append(element('span','task-summary',task.summary || task.model));
    heading.append(element('span',`task-state ${task.state}`,task.pollState==='paused' && task.id ? '查询已暂停' : STATE_LABELS[task.state] || '状态待确认'));card.append(heading);
    card.append(element('p','task-meta',`${task.model} · ${new Date(task.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`));
    if(task.id)card.append(element('code','task-id',task.id));
    if(task.pollState==='paused')card.append(element('p','task-meta',PAUSE_LABELS[task.pauseReason] || '查询已暂停'));
    if(task.error)card.append(element('p','task-error',task.error));
    if(task.pollState==='active') {const track=element('div','progress-track'),fill=element('div','progress-fill');fill.style.width=`${Math.max(3,Math.min(100,task.progress || 0))}%`;track.append(fill);card.append(track);}
    const actions=element('div','task-actions');
    const action=(text,callback)=>{const button=element('button','text-button',text);button.type='button';button.addEventListener('click',guard(callback));actions.append(button);};
    if(task.id && !['completed','failed'].includes(task.state)){
      if(task.pollState==='active')action('停止轮询',()=>queue.stopPolling(task));else action('继续查询',()=>queue.resume(task));
    }
    if(task.state==='completed')action('查看结果',()=>loadResult(task));
    if(['uncertain','needs_files','failed'].includes(task.state))action('重新填写并确认',()=>{if(task.snapshot?.body?.prompt)$('prompt').value=task.snapshot.body.prompt;switchMode('single');$('prompt').focus();notice('请重新核对完整提示词、配置和素材。新的生成会再次提交并可能产生费用。');});
    if(actions.childNodes.length)card.append(actions);container.append(card);
  }
}
async function loadResult(task,force=false){
  if(currentResult===task && currentResultURL && !force)return;
  const key=keyFor(task.base) || task.key;
  if(!key){notice('请填写该结果原 API 地址对应的 Key，再查看结果');return;}
  const version=++resultVersion;currentResult=task;
  for(const controller of contentControllers)controller.abort();contentControllers.clear();
  if(currentResultURL){URL.revokeObjectURL(currentResultURL);currentResultURL=null;}
  $('player').pause();$('player').removeAttribute('src');$('player').hidden=true;$('result-empty').hidden=false;
  $('result-label').textContent='正在获取成片…';$('result-error').hidden=true;$('result-actions').hidden=true;
  const controller=new AbortController();contentControllers.add(controller);
  try{
    const blob=await api.content(task,key,controller.signal);if(version!==resultVersion)return;
    if(!blob.size)throw new Error('视频内容为空，请联系服务方核实');
    currentResultURL=URL.createObjectURL(blob);$('player').src=currentResultURL;$('player').hidden=false;$('result-empty').hidden=true;
    const extension=blob.type.includes('webm') ? 'webm' : blob.type.includes('quicktime') ? 'mov' : 'mp4';
    $('download').href=currentResultURL;$('download').download=`${task.id.replace(/[^a-zA-Z0-9_-]/g,'_')}.${extension}`;
    $('result-actions').hidden=false;$('result-label').textContent=prettyBytes(blob.size);
  }catch(error){if(version!==resultVersion)return;$('result-label').textContent='获取失败';$('result-error').textContent=errorMessage(error,[key]);$('result-error').hidden=false;$('result-actions').hidden=false;$('download').hidden=true;}
  finally{contentControllers.delete(controller);if(version===resultVersion && currentResultURL)$('download').hidden=false;}
}

$('brand').addEventListener('change',()=>{syncBrandPicker();populateModels();});$('model').addEventListener('change',()=>applyCapabilities(true));
$('brand-trigger').addEventListener('click',()=>{$('brand-options').hidden ? openBrandPicker() : closeBrandPicker(true);});
$('brand-trigger').addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();openBrandPicker(event.key==='Home' ? 'first' : event.key==='End' ? 'last' : undefined);}});
$('brand-options').addEventListener('keydown',event=>{
  const options=[...$('brand-options').children],index=options.indexOf(document.activeElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();options[event.key==='Home' ? 0 : event.key==='End' ? options.length-1 : (index+(event.key==='ArrowDown' ? 1:-1)+options.length)%options.length]?.focus();}
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeBrandPicker(true);}
  if(event.key==='Tab')closeBrandPicker();
});
$('brand-picker').addEventListener('focusout',event=>{if(!event.currentTarget.contains(event.relatedTarget))closeBrandPicker();});
document.addEventListener('pointerdown',event=>{if(!$('brand-picker').contains(event.target))closeBrandPicker();});
$('custom-model').addEventListener('input',()=>applyCapabilities(false));$('override').addEventListener('change',()=>applyCapabilities(false));
$('resolution').addEventListener('change',()=>{const selected=$('resolution').value;applyCapabilities(false);if([...$('resolution').options].some(option=>option.value===selected))$('resolution').value=selected;});
$('custom-resolution').addEventListener('input',updateAudioOptions);
$('prompt').addEventListener('input',()=>$('prompt-count').textContent=`${$('prompt').value.length} 字`);
$('single-tab').addEventListener('click',()=>switchMode('single'));$('batch-tab').addEventListener('click',()=>switchMode('batch'));
$('batch-input').addEventListener('input',()=>{batchReadVersion++;$('prepare').disabled=false;batchFormat='auto';$('batch-file-name').textContent='';});
for(const kind of ['image','video']){
  $(`choose-${kind}`).addEventListener('click',()=>$(`${kind}-files`).click());
  $(`${kind}-files`).addEventListener('change',guard(event=>{try{chooseMedia(kind,event.target.files);}finally{event.target.value='';}}));
  $(`clear-${kind}`).addEventListener('click',()=>{files[kind]=[];renderFiles(kind);updateAudioOptions();});
  dropzone(`${kind}-drop`,list=>chooseMedia(kind,list));
}
$('choose-batch').addEventListener('click',()=>$('batch-file').click());
$('batch-file').addEventListener('change',guard(async event=>{const list=Array.from(event.target.files);event.target.value='';await readBatch(list);}));
dropzone('batch-drop',readBatch);
document.addEventListener('dragover',event=>event.preventDefault());document.addEventListener('drop',event=>event.preventDefault());
$('prepare').addEventListener('click',guard(prepareConfirmation));
function cancelConfirm(){pendingConfirmation=null;$('confirm-dialog').close();}
$('cancel-confirm').addEventListener('click',cancelConfirm);$('back-confirm').addEventListener('click',cancelConfirm);
$('confirm-dialog').addEventListener('cancel',()=>{pendingConfirmation=null;});
$('confirm-submit').addEventListener('click',guard(()=>{
  const snapshots=pendingConfirmation;if(!snapshots)return;
  pendingConfirmation=null;$('confirm-submit').disabled=true;$('confirm-dialog').close();saveKey();queue.enqueue(snapshots);notice(`已确认 ${snapshots.length} 条生成任务，正在串行提交。`,true);
}));
$('stop-queue').addEventListener('click',()=>{queue.stopQueue();notice('已停止尚未发出的生成请求。正在提交和已提交的任务不会被撤销。');});
$('api-key').addEventListener('input',saveKey);$('remember-key').addEventListener('change',saveKey);
$('api-base').addEventListener('change',()=>{saveKey();models=provider.models;$('catalog-source').textContent='本地配置';$('catalog-message').textContent='API 地址已变更，请刷新此服务的模型目录或导入对应配置。';setBrands();});
$('clear-key').addEventListener('click',()=>{
  $('api-key').value='';$('remember-key').checked=false;session.remove(SESSION_KEY);pendingConfirmation=null;if($('confirm-dialog').open)$('confirm-dialog').close();
  queue.clearKeys();for(const controller of contentControllers)controller.abort();notice('Key 已从输入框、会话存储和待查询任务中清除；尚未发送的任务已停止。已发出的请求无法撤回。');
});
$('refresh-models').addEventListener('click',guard(async()=>{
  const {base,key}=connection(),currentProvider=provider,brand=$('brand').value,model=$('model').value;
  $('refresh-models').disabled=true;$('catalog-message').textContent='正在读取视频模型目录…';
  try{
    const discovered=await api.discover(base,key,currentProvider);
    if(base!==connection().base || provider!==currentProvider)return;
    models=discovered;setBrands(brand);populateModels(model);$('catalog-source').textContent='API 返回';
    $('catalog-message').textContent=`已读取 ${models.length} 个视频模型 · ${new Date().toLocaleTimeString()}。实际可用性以当前 Key 和接口响应为准。`;notice('模型目录已更新。',true);
  }catch(error){if(base===connection().base && provider===currentProvider){$('catalog-message').textContent=errorMessage(error,[key]);$('catalog-source').textContent='本地配置';models=provider.models;setBrands(brand);populateModels(model);}}
  finally{$('refresh-models').disabled=false;}
}));
$('import-provider').addEventListener('click',()=>$('provider-file').click());
$('provider-file').addEventListener('change',guard(async event=>{
  const file=event.target.files[0],version=++providerReadVersion;event.target.value='';if(!file)return;if(file.size>LIMITS.importBytes)throw new Error('配置文件不能超过 2 MiB');
  const next=validateProvider(parseJSON(await file.text(),'服务配置'));if(version!==providerReadVersion)return;
  provider=next;models=provider.models;$('override').checked=false;setBrands();$('catalog-source').textContent='本地配置';$('catalog-message').textContent=`当前使用 ${provider.name} 配置。`;notice('兼容服务配置已导入。',true);
}));
$('export-provider').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(provider,null,2)],{type:'application/json'}));const link=element('a');link.href=url;link.download='provider-config.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('reset-provider').addEventListener('click',()=>{providerReadVersion++;provider=validateProvider(BUILTIN_PROVIDER);models=provider.models;$('override').checked=false;setBrands();$('catalog-source').textContent='本地配置';$('catalog-message').textContent='已恢复 A6API 2026-10-29 预设。请刷新获取当前模型目录。';notice('已恢复 A6API 预设。',true);});
$('query-task').addEventListener('click',guard(()=>{
  const {base,key}=connection(),id=$('task-id').value.trim();if(!key || !id)throw new Error('请填写 API Key 与 task ID');
  const existing=queue.tasks.find(task=>task.id===id && task.base===base);if(existing){queue.resume(existing);return;}
  const task={uid:crypto.randomUUID(),id,base,key,model:'已有任务',summary:id,state:'unknown',progress:0,pollState:'active',pauseReason:'',sessionStart:null,lastStart:null,createdAt:Date.now(),statuses:structuredClone(provider.statuses),generation:0,error:''};
  queue.tasks.push(task);queue.scheduler.add(task);queue.changed();notice('仅查询已有任务，不发送生成请求。',true);
}));
$('reload-content').addEventListener('click',guard(()=>currentResult && loadResult(currentResult,true)));
$('help-button').addEventListener('click',()=>$('help-dialog').showModal());$('close-help').addEventListener('click',()=>$('help-dialog').close());
document.querySelector('.help-icon').addEventListener('click',event=>event.currentTarget.parentElement.classList.toggle('open'));
document.addEventListener('click',event=>{if(!event.target.closest('.tooltip-wrap'))document.querySelector('.tooltip-wrap').classList.remove('open');});
try{document.documentElement.dataset.theme=localStorage.getItem('video-studio.theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light');}catch{}
$('theme-button').addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='dark' ? 'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('video-studio.theme',theme);}catch{}});
window.addEventListener('pagehide',()=>{queue.close();for(const controller of contentControllers)controller.abort();if(currentResultURL)URL.revokeObjectURL(currentResultURL);});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
try{const saved=parseJSON(session.read(SESSION_KEY) || 'null');if(saved?.base && saved?.key){$('api-base').value=normalizeBase(saved.base);$('api-key').value=String(saved.key);$('remember-key').checked=true;}}catch{session.remove(SESSION_KEY);}
setBrands();
try{queue.restore(parseJSON(session.read(SESSION_TASKS) || '[]'));}catch{notice('历史任务记录无法恢复；不会重新发送任何生成请求。');}
