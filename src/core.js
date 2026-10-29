export const LIMITS = Object.freeze({ batch: 20, slots: 3, interval: 5000, queryTimeout: 30000, session: 1800000, requestTimeout: 120000, importBytes: 2 * 1024 * 1024, fileBytes: 200 * 1024 * 1024, totalBytes: 500 * 1024 * 1024 });
export const REAL_CLOCK = { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: id => clearTimeout(id) };
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor']);
const controlled = new Set(['model', 'prompt', 'seconds', 'duration', 'resolution', 'size', 'generateaudio', 'audio', 'image', 'images', 'imageurl', 'imageurls', 'inputreference', 'referenceimages', 'video', 'videos', 'videourl', 'videourls', 'referencevideos', 'content']);
const normalizeField = key => key.toLowerCase().replace(/[_-]/g, '');
export function safeObject(value, path = '配置') {
  if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
    if (unsafeKeys.has(key)) throw new Error(`${path}.${key}：不允许此字段`);
    safeObject(item, `${path}.${key}`);
  }
  return value;
}
export function parseJSON(text, label = 'JSON') {
  try { return safeObject(JSON.parse(text)); }
  catch (error) {
    const position = /position (\d+)/.exec(error.message);
    const line = position ? text.slice(0, Number(position[1])).split('\n').length : 1;
    throw new Error(`${label} 第 ${line} 行：${error.message}`);
  }
}
export function normalizeBase(value) {
  let url;
  try { url = new URL(String(value).trim()); } catch { throw new Error('API 地址不是有效的 HTTP(S) 地址'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('API 地址只允许 HTTP(S)，不要包含账号、密码、查询参数或 #');
  return url.href.replace(/\/+$/, '').replace(/\/v1$/i, '');
}
export function errorMessage(error, secrets = []) {
  let message = error instanceof Error ? error.message : String(error || '未知错误');
  for (const secret of secrets) if (secret) message = message.split(secret).join('[已隐藏]');
  return message.slice(0, 600);
}
export function validateProvider(input) {
  safeObject(input);
  if (!input || input.schemaVersion !== 1 || !Array.isArray(input.models) || !input.models.length) throw new Error('配置字段 schemaVersion 必须为 1，models 必须是非空数组');
  const fields = { seconds: 'seconds', resolution: 'resolution', audio: 'generate_audio', image: 'input_reference', video: 'reference_videos', ...input.fields };
  const names = Object.values(fields);
  if (Object.keys(fields).some(k => !['seconds', 'resolution', 'audio', 'image', 'video'].includes(k)) || names.some(x => typeof x !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_\-\[\]]{0,63}$/.test(x)) || new Set(names).size !== names.length || names.some(x => ['model','prompt'].includes(x))) throw new Error('配置字段 fields：请求字段必须唯一，不能使用 model 或 prompt');
  const ids = new Set();
  const models = input.models.map((model, index) => {
    const prefix = `models[${index}]`;
    if (!model || typeof model.id !== 'string' || !model.id.trim() || ids.has(model.id)) throw new Error(`${prefix}.id：模型名称不能为空或重复`);
    ids.add(model.id);
    if (model.brand != null && typeof model.brand !== 'string') throw new Error(`${prefix}.brand：必须为文字`);
    if (model.resolutions != null && (!Array.isArray(model.resolutions) || model.resolutions.some(x => typeof x !== 'string' || !x.trim()))) throw new Error(`${prefix}.resolutions：必须是字符串数组`);
    if (model.audio != null && typeof model.audio !== 'boolean') throw new Error(`${prefix}.audio：只能为 true、false 或 null`);
    if (model.seconds != null && (!Number.isInteger(model.seconds.default) || model.seconds.default < 1 || !Number.isInteger(model.seconds.max) || model.seconds.max < model.seconds.default)) throw new Error(`${prefix}.seconds：default 和 max 必须为正整数且 max ≥ default`);
    for (const kind of ['image','video']) {
      const media = model.media?.[kind];
      if (media != null && typeof media !== 'boolean') throw new Error(`${prefix}.media.${kind}：只能为 true、false 或 null`);
      const max = model.maxFiles?.[kind];
      if (max != null && (!Number.isInteger(max) || max < 1)) throw new Error(`${prefix}.maxFiles.${kind}：必须为正整数`);
    }
    if (model.specKeys != null && (!Array.isArray(model.specKeys) || model.specKeys.some(x=>typeof x !== 'string'))) throw new Error(`${prefix}.specKeys：必须为字符串数组`);
    // Export only the documented schema, never arbitrary imported metadata or credentials.
    return { id:model.id, brand:model.brand || '未分类', seconds:model.seconds ? {default:model.seconds.default,max:model.seconds.max} : null, resolutions:model.resolutions || [], audio:model.audio ?? null, media:{image:model.media?.image ?? null,video:model.media?.video ?? null}, maxFiles:{image:model.maxFiles?.image,video:model.maxFiles?.video}, specKeys:model.specKeys || [], source:'本地配置', capabilitySource:typeof model.capabilitySource === 'string' ? model.capabilitySource : '本地配置' };
  });
  const statuses = { queued: ['queued','pending'], running: ['in_progress','processing','running'], completed: ['completed','succeeded','success'], failed: ['failed','error'], ...input.statuses };
  const used = new Set();
  for (const [key, values] of Object.entries(statuses)) {
    if (!['queued','running','completed','failed'].includes(key) || !Array.isArray(values) || values.some(x => typeof x !== 'string' || !x || used.has(x))) throw new Error(`statuses.${key}：状态必须是非重复字符串数组`);
    values.forEach(x => used.add(x));
  }
  return Object.freeze({ schemaVersion: 1, name: String(input.name || '自定义服务'), idempotency: input.idempotency === true, fields, statuses, models });
}
export function discoverModels(data, provider) {
  const rows = Array.isArray(data?.data) ? data.data : [];
  return rows.filter(row => Array.isArray(row.supported_endpoint_types) && row.supported_endpoint_types.includes('openai-video')).map(row => {
    const id = row.model_name || row.id;
    if (typeof id !== 'string' || !id.trim()) return null;
    const known = provider.models.find(model => model.id === id);
    return { id, brand: known?.brand || (typeof row.brand === 'string' ? row.brand : '未分类'), seconds: known?.seconds || null, resolutions: known?.resolutions || [], audio: known?.audio ?? null, media: known?.media || { image:null, video:null }, maxFiles: known?.maxFiles, specKeys: Object.keys(row.video_spec_prices || {}), source: 'API 返回', capabilitySource: known ? '本地预设' : '预设未确认' };
  }).filter(Boolean).filter((model,index,all) => all.findIndex(x => x.id === model.id) === index);
}
export function classifyStatus(data, provider) {
  const status = typeof data?.status === 'string' ? data.status : '';
  for (const [kind, values] of Object.entries(provider.statuses)) if (values.includes(status)) return kind;
  return 'unknown';
}
export function validateFiles(kind, files, model, override = false) {
  if (files.length && !override && model?.media?.[kind] !== true) throw new Error(`${kind === 'image' ? '图片' : '视频'}输入${model?.media?.[kind] === false ? '不受当前模型支持' : '能力尚未确认'}，可勾选自定义配置后尝试`);
  if (!override && model?.maxFiles?.[kind] && files.length > model.maxFiles[kind]) throw new Error(`当前模型最多允许 ${model.maxFiles[kind]} 个${kind === 'image' ? '图片' : '视频'}文件`);
  const extensions = kind === 'image' ? /\.(png|jpe?g|webp|gif|avif)$/i : /\.(mp4|mov|webm|m4v)$/i;
  for (const file of files) {
    if (!extensions.test(file.name) || (file.type && !file.type.startsWith(`${kind}/`))) throw new Error(`文件类型不匹配：${file.name}`);
    if (file.size === 0) throw new Error(`文件为空：${file.name}`);
    if (file.size > LIMITS.fileBytes) throw new Error(`文件超过工具 200 MiB 安全上限：${file.name}`);
  }
}
export function parseBatch(text, format = 'auto') {
  const source = String(text).replace(/^\uFEFF/, '');
  if (!source.trim()) throw new Error('请输入或导入批量任务');
  let rows;
  const type = format === 'auto' ? source.trimStart().startsWith('[') ? 'json' : /^\s*"?prompt"?\s*,/.test(source) ? 'csv' : 'txt' : format;
  if (type === 'json') {
    const items = parseJSON(source, '批量 JSON');
    if (!Array.isArray(items)) throw new Error('批量 JSON 必须为数组');
    rows = items.map((value, index) => ({ ...(typeof value === 'string' ? {prompt:value} : value), row:index + 1 }));
  } else if (type === 'csv') {
    const table = parseCSV(source);
    const headers = table.shift()?.cells.map(x => x.trim());
    if (!headers?.includes('prompt') || new Set(headers).size !== headers.length) throw new Error('CSV 首行必须包含 prompt 且列名不能重复');
    const allowed = ['prompt','seconds','resolution','audio','images','videos'];
    if (headers.some(x => !allowed.includes(x))) throw new Error(`CSV 仅支持列：${allowed.join(', ')}`);
    rows = table.filter(r => r.cells.some(x => x.trim())).map(r => {
      if (r.cells.length !== headers.length) throw new Error(`CSV 第 ${r.line} 行：列数与表头不一致`);
      return { ...Object.fromEntries(headers.map((key,index) => [key,r.cells[index]])), row:r.line };
    });
  } else rows = source.split(/\r?\n/).map((prompt,index) => ({prompt,row:index+1})).filter(x => x.prompt.trim());
  if (!rows.length || rows.length > LIMITS.batch) throw new Error(`每批需为 1–${LIMITS.batch} 条任务，当前 ${rows.length} 条`);
  return rows.map((row,index) => {
    if (!row || typeof row.prompt !== 'string' || !row.prompt.trim()) throw new Error(`第 ${row?.row || index+1} 行：prompt 不能为空`);
    const allowed = ['prompt','seconds','resolution','audio','images','videos','row'];
    if (Object.keys(row).some(k => !allowed.includes(k))) throw new Error(`第 ${row.row} 行：包含不支持的覆盖字段`);
    const result = { ...row, prompt:row.prompt.trim() };
    for (const kind of ['images','videos']) if (typeof result[kind] === 'string') result[kind] = result[kind] ? result[kind].split('|').map(x => x.trim()) : [];
    for (const kind of ['images','videos']) if (result[kind] != null && (!Array.isArray(result[kind]) || result[kind].some(x => typeof x !== 'string'))) throw new Error(`第 ${row.row} 行：${kind} 必须是文件名数组，CSV 使用 | 分隔`);
    return result;
  });
}
export function parseCSV(text) {
  const rows = []; let cells = [], cell = '', quoted = false, closed = false, line = 1, rowLine = 1;
  const finishCell = () => { cells.push(cell); cell = ''; closed = false; };
  const finishRow = () => { finishCell(); rows.push({cells,line:rowLine}); cells = []; rowLine = line + 1; };
  for (let i=0; i<text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i+1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else { cell += char; if (char === '\n') line++; }
    } else if (char === '"' && cell === '' && !closed) quoted = true;
    else if (char === ',') finishCell();
    else if (char === '\n' || (char === '\r' && text[i+1] !== '\n')) { finishRow(); line++; }
    else if (char === '\r' && text[i+1] === '\n') continue;
    else if (closed || char === '"') throw new Error(`CSV 第 ${line} 行：引号后只能为逗号或换行`);
    else cell += char;
  }
  if (quoted) throw new Error(`CSV 第 ${rowLine} 行：引号未闭合`);
  if (cell || cells.length || closed) { finishCell(); rows.push({cells,line:rowLine}); }
  return rows;
}
export function bindFiles(names, selected, row, kind) {
  if (names == null) return [...selected];
  return names.map(name => {
    const matches = selected.filter(file => file.name === name);
    if (matches.length !== 1) throw new Error(`第 ${row} 行：${kind}文件“${name}”${matches.length ? '名称重复，请重命名后重新选择' : '尚未选择，请补选本地文件'}`);
    return matches[0];
  });
}
function deepFreeze(value) {
  if (value && typeof value === 'object' && !(typeof File !== 'undefined' && value instanceof File)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}
export function createSnapshot(form, model, provider, row = null) {
  const base = normalizeBase(form.base);
  const key = String(form.key || '').trim();
  if (!key || /[\r\n]/.test(key)) throw new Error('请填写有效的 API Key');
  const id = String(form.model || '').trim();
  if (!id) throw new Error('请填写与 A6API 完全一致的模型名称');
  const prompt = String(row?.prompt ?? form.prompt ?? '').trim();
  if (!prompt) throw new Error('提示词不能为空');
  const override = form.override === true;
  const body = { model:id, prompt };
  const fields = provider.fields;
  const rowValue = name => row?.[name] === '' || row?.[name] == null ? form[name] : row[name];
  const seconds = rowValue('seconds');
  if (seconds !== '' && seconds != null && (override || model?.seconds)) {
    const number = Number(seconds);
    if (!Number.isInteger(number) || number === 0 || number < (override ? -1 : 1) || (!override && number > model.seconds.max)) throw new Error(`时长无效${!override && model?.seconds ? `，当前模型上限 ${model.seconds.max} 秒` : ''}`);
    body[fields.seconds] = String(number);
  } else if (row?.seconds != null && row.seconds !== '') throw new Error('时长预设未确认，请勾选自定义配置');
  const resolution = rowValue('resolution');
  if (resolution && (override || model?.resolutions?.length)) {
    if (!override && !model.resolutions.includes(resolution)) throw new Error(`分辨率 ${resolution} 不在当前模型预设中`);
    body[fields.resolution] = String(resolution);
  } else if (row?.resolution) throw new Error('分辨率预设未确认，请勾选自定义配置');
  const audio = rowValue('audio');
  if (audio !== '' && audio != null) {
    if (!override && model?.audio !== true) throw new Error('当前模型声音配置不可用，请勾选自定义配置');
    if (![true,false,'true','false'].includes(audio)) throw new Error('声音必须为 true 或 false');
    body[fields.audio] = audio === true || audio === 'true';
  }
  const images = bindFiles(row?.images, form.images || [], row?.row, '图片');
  const videos = bindFiles(row?.videos, form.videos || [], row?.row, '视频');
  validateFiles('image', images, model, override); validateFiles('video', videos, model, override);
  if ([...images,...videos].reduce((sum,file) => sum+file.size,0) > LIMITS.totalBytes) throw new Error('本行素材合计超过工具 500 MiB 安全上限');
  const extra = typeof form.extra === 'string' ? parseJSON(form.extra.trim() || '{}','高级 JSON') : safeObject(form.extra || {});
  if (!extra || Array.isArray(extra) || typeof extra !== 'object') throw new Error('高级 JSON 必须为对象');
  for (const [name, value] of Object.entries(extra)) {
    if (controlled.has(normalizeField(name)) || Object.values(fields).some(field => normalizeField(field) === normalizeField(name))) throw new Error(`高级 JSON 不能覆盖受控字段：${name}`);
    body[name] = structuredClone(value);
  }
  // Price keys constrain known combinations only; "any" is a wildcard, never a capability denial.
  if (!override && model?.specKeys?.length && resolution) {
    const sound = body[fields.audio] === true ? 'on' : body[fields.audio] === false ? 'off' : null;
    if (!model.specKeys.some(spec => { const parts=spec.split('|'); return parts[0] === resolution && (sound === null || parts[1] === 'any' || parts[1] === sound) && (parts[2] === 'any' || parts[2] === (videos.length ? 'yes':'no')); })) throw new Error('当前分辨率、声音与视频输入组合未列入规格预设');
  }
  return deepFreeze({ uid:crypto.randomUUID(), base, key, body, files:{image:images,video:videos}, fields:{...fields}, statuses:structuredClone(provider.statuses), idempotency:provider.idempotency, createdAt:Date.now() });
}
export function snapshotPreview(snapshot) {
  return { api:`${snapshot.base}/v1/videos`, method:'POST', encoding:snapshot.files.image.length || snapshot.files.video.length ? 'multipart/form-data' : 'application/json', fields:snapshot.body, files:Object.fromEntries(['image','video'].filter(kind => snapshot.files[kind].length).map(kind => [snapshot.fields[kind], snapshot.files[kind].map(file => ({name:file.name,bytes:file.size}))])) };
}
export function requestBody(snapshot) {
  if (!snapshot.files.image.length && !snapshot.files.video.length) return JSON.stringify(snapshot.body);
  const data = new FormData();
  for (const [key,value] of Object.entries(snapshot.body)) data.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  for (const kind of ['image','video']) for (const file of snapshot.files[kind]) data.append(snapshot.fields[kind],file,file.name);
  return data;
}
export class VideoAPI {
  constructor(fetcher = (...args) => fetch(...args)) { this.fetcher=fetcher; }
  async request(base, path, key, options = {}) {
    const {timeout=LIMITS.requestTimeout, ...rest}=options;
    const signal = rest.signal ? AbortSignal.any([rest.signal,AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout);
    let response;
    try { response=await this.fetcher(`${base}${path}`,{ ...rest, signal, redirect:'error', credentials:'omit', referrerPolicy:'no-referrer', headers:{...(key ? {Authorization:`Bearer ${key}`} : {}),...rest.headers} }); }
    catch(error) { throw new Error(errorMessage(error.name === 'TimeoutError' ? '请求超时，结果暂未确认' : error.name === 'AbortError' ? '查询已停止' : '网络请求失败：请检查 API 地址、连接和目标服务的 CORS 设置', [key])); }
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try { const raw=await response.json(); message += `：${raw?.error?.message || raw?.message || raw?.error || '接口返回错误'}`; } catch {}
      throw new Error(errorMessage(message,[key]));
    }
    return response;
  }
  async submit(snapshot, signal) {
    const body=requestBody(snapshot);
    const headers=typeof body === 'string' ? {'Content-Type':'application/json'} : {};
    if(snapshot.idempotency) headers['Idempotency-Key']=snapshot.uid;
    const response=await this.request(snapshot.base,'/v1/videos',snapshot.key,{method:'POST',body,headers,signal});
    try { return await response.json(); } catch { throw new Error('接口响应不是有效 JSON，提交结果暂未确认；不会自动重发'); }
  }
  async status(task,key,signal) { return (await this.request(task.base,`/v1/videos/${encodeURIComponent(task.id)}`,key,{signal,timeout:LIMITS.queryTimeout})).json(); }
  async content(task,key,signal) { return (await this.request(task.base,`/v1/videos/${encodeURIComponent(task.id)}/content`,key,{signal})).blob(); }
  async discover(base,key,provider) {
    const errors=[];
    for(const path of ['/api/pricing','/v1/models']) {
      try { const data=await (await this.request(base,path,path === '/api/pricing' ? '' : key,{timeout:LIMITS.queryTimeout})).json(); const models=discoverModels(data,provider); if(models.length) return models; errors.push(`${path} 未返回明确标记视频端点的模型`); }
      catch(error) { errors.push(errorMessage(error,[key])); }
    }
    throw new Error(`目录刷新失败：${errors.join('；')}。可使用标明来源的本地预设或自定义模型。`);
  }
}

export class PollScheduler {
  constructor({ getStatus, onChange=()=>{}, onComplete=()=>{}, clock=REAL_CLOCK, limits=LIMITS }) {
    Object.assign(this,{getStatus,onChange,onComplete,clock,limits});
    this.tasks=[]; this.slots=Array.from({length:limits.slots},()=>({busy:false,nextAt:0,task:null})); this.timer=null; this.closed=false;
  }
  add(task) { if(!this.tasks.includes(task)) this.tasks.push(task); this.wake(); }
  pause(task,reason='manual') {
    task.pollState='paused'; task.pauseReason=reason; task.generation=(task.generation || 0)+1;
    task.controller?.abort(); this.onChange(task); this.wake();
  }
  resume(task) {
    if(['completed','failed'].includes(task.state)) return;
    task.pollState='active'; task.sessionStart=null; task.pauseReason=''; task.error=''; task.generation=(task.generation || 0)+1;
    this.add(task); this.onChange(task);
  }
  wake() {
    if(this.closed) return;
    if(this.timer != null) this.clock.clearTimeout(this.timer);
    this.timer=this.clock.setTimeout(()=>this.tick(),0);
  }
  tick() {
    if(this.closed) return;
    this.timer=null;
    const now=this.clock.now();
    for(const task of this.tasks) if(task.pollState === 'active' && task.sessionStart != null && now-task.sessionStart >= this.limits.session) this.pause(task,'budget');
    const assigned=new Set(this.slots.filter(slot=>slot.busy).map(slot=>slot.task));
    for(const slot of this.slots) {
      if(slot.busy || slot.nextAt>now) continue;
    const task=this.tasks.filter(t=>t.pollState === 'active' && !assigned.has(t) && (t.lastStart == null || now-t.lastStart>=this.limits.interval)).sort((a,b)=>(a.lastStart ?? -Infinity)-(b.lastStart ?? -Infinity))[0];
      if(!task) continue;
      assigned.add(task); this.run(slot,task);
    }
    this.schedule();
  }
  schedule() {
    if(this.closed) return;
    if(this.timer != null) this.clock.clearTimeout(this.timer);
    const now=this.clock.now(), due=[];
    const assigned=new Set(this.slots.filter(slot=>slot.busy).map(slot=>slot.task));
    for(const task of this.tasks) if(task.pollState === 'active') {
      if(task.sessionStart != null) due.push(task.sessionStart+this.limits.session);
      if(!assigned.has(task)) for(const slot of this.slots) if(!slot.busy) due.push(Math.max(slot.nextAt,task.lastStart == null ? now : task.lastStart+this.limits.interval));
    }
    this.timer=due.length ? this.clock.setTimeout(()=>this.tick(),Math.max(0,Math.min(...due)-now)) : null;
  }
  async run(slot,task) {
    const now=this.clock.now();
    slot.busy=true; slot.task=task; slot.nextAt=now+this.limits.interval;
    if(task.sessionStart == null) task.sessionStart=now;
    task.lastStart=now;
    const generation=task.generation || 0, controller=new AbortController(); task.controller=controller;
    const timeout=this.clock.setTimeout(()=>controller.abort(new Error('状态查询超时')),this.limits.queryTimeout);
    this.onChange(task);
    let abortListener;
    const abort=new Promise((_,reject)=>{abortListener=()=>reject(controller.signal.reason || new Error('查询已停止'));controller.signal.addEventListener('abort',abortListener,{once:true});});
    try {
      const data=await Promise.race([this.getStatus(task,controller.signal),abort]);
      if(task.generation !== generation && !(task.generation == null && generation === 0)) return;
      if(task.pollState !== 'active') return;
      if(this.clock.now()-task.sessionStart >= this.limits.session) {this.pause(task,'budget');return;}
      const state=classifyStatus(data,{statuses:task.statuses});
      if(state === 'unknown') { task.error='无法识别的任务状态，结果暂未确认'; this.pause(task,'unknown'); return; }
      task.state=state; task.progress=Math.max(0,Math.min(100,Number(data.progress) || 0));
      if(['completed','failed'].includes(state)) {
        task.pollState='done'; task.pauseReason='';
        if(state === 'completed') task.progress=100;
        if(state === 'failed') task.error=errorMessage(data.error?.message || data.error || '服务端返回生成失败', [task.key]);
        this.onChange(task);
        if(state === 'completed') this.onComplete(task);
      } else this.onChange(task);
    } catch(error) {
      if((task.generation || 0) !== generation || task.pollState !== 'active') return;
      task.error=errorMessage(error,[task.key]); this.pause(task,'error');
    } finally {
      this.clock.clearTimeout(timeout); controller.signal.removeEventListener('abort',abortListener);
      if(task.controller === controller) task.controller=null;
      slot.busy=false; slot.task=null; this.wake();
    }
  }
  close() { this.closed=true; if(this.timer != null) this.clock.clearTimeout(this.timer); for(const task of this.tasks) {task.generation=(task.generation || 0)+1; task.controller?.abort();} }
}

export function taskRecord(task) {
  return { uid:task.uid, id:task.id, base:task.base, model:task.model, summary:task.summary, state:task.state, progress:task.progress, pollState:task.pollState, pauseReason:task.pauseReason, sessionStart:task.sessionStart, lastStart:task.lastStart, createdAt:task.createdAt, statuses:task.statuses };
}
export function restoreTasks(records,now=Date.now()) {
  if(!Array.isArray(records)) return [];
  return records.slice(-200).flatMap(record=>{
    try {
      const task=taskRecord(record); task.base=normalizeBase(task.base);
      if(typeof task.uid !== 'string' || typeof task.model !== 'string' || typeof task.summary !== 'string') return [];
      task.key=''; task.error=''; task.generation=0;
      if(!task.id) { task.state=['submitting','uncertain'].includes(task.state) ? 'uncertain' : 'needs_files'; task.pollState='paused'; task.pauseReason=task.state==='uncertain' ? 'submit' : 'restore'; }
      else if(!['completed','failed'].includes(task.state)) {
        const valid=Number.isFinite(task.sessionStart) && Number.isFinite(task.lastStart) && task.sessionStart<=task.lastStart && task.lastStart<=now;
        if(task.pollState !== 'active' || !valid || now-task.sessionStart>=LIMITS.session) { task.pollState='paused'; task.pauseReason=task.pauseReason || (valid ? 'budget':'restore'); }
      }
      return [task];
    } catch { return []; }
  });
}
export class TaskQueue {
  constructor({api=new VideoAPI(),clock=REAL_CLOCK,onChange=()=>{},onComplete=()=>{},persist=()=>{},getKey=()=>''}={}) {
    Object.assign(this,{api,clock,onChange,onComplete,persist,getKey});this.tasks=[];this.pending=[];this.submitting=false;this.stopped=false;
    this.scheduler=new PollScheduler({clock,getStatus:(task,signal)=>{
      const key=task.key || this.getKey(task.base);
      if(!key) throw new Error('请重新填写对应 API 的 Key，再继续查询');
      task.key=key; return api.status(task,key,signal);
    },onChange:()=>this.changed(),onComplete:task=>this.onComplete(task)});
  }
  changed() { this.persist(this.tasks.map(taskRecord)); this.onChange(this.tasks); }
  enqueue(snapshots) {
    if(!snapshots.length || snapshots.length>LIMITS.batch) throw new Error('本次确认任务数量必须为 1–20 条');
    if(new Set(snapshots.map(snapshot=>snapshot.uid)).size !== snapshots.length) throw new Error('本批包含重复确认，请勿重复提交');
    for(const snapshot of snapshots) {
      if(this.tasks.some(task=>task.uid===snapshot.uid)) throw new Error('这份确认已加入队列，请勿重复提交');
    }
    for(const snapshot of snapshots) {
      const task={uid:snapshot.uid,id:null,base:snapshot.base,key:snapshot.key,model:snapshot.body.model,summary:snapshot.body.prompt.slice(0,80),state:'waiting',progress:0,pollState:'waiting',pauseReason:'',sessionStart:null,lastStart:null,createdAt:this.clock.now(),statuses:snapshot.statuses,snapshot,generation:0,error:''};
      this.tasks.push(task); this.pending.push(task);
    }
    this.stopped=false;this.changed();this.drain();
  }
  async drain() {
    if(this.submitting || this.stopped) return;
    this.submitting=true;
    try {
      while(this.pending.length && !this.stopped) {
        const task=this.pending.shift();task.state='submitting';this.changed();
        try {
          const data=await this.api.submit(task.snapshot);
          const id=data?.id || data?.task_id;
          if(typeof id !== 'string' || !id) throw new Error('接口未返回 task ID，提交结果暂未确认');
          task.id=id;
          const state=classifyStatus(data,{statuses:task.statuses});task.state=state;task.progress=Number(data.progress) || 0;
          if(state === 'completed' || state === 'failed') {
            task.pollState='done'; if(state==='completed'){task.progress=100;this.onComplete(task);} else task.error=errorMessage(data.error?.message || '服务端返回生成失败',[task.key]);
          } else if(state==='unknown') {task.pollState='paused';task.pauseReason='unknown';task.error='提交成功，但任务状态无法识别，请继续查询原任务';}
          else {task.pollState='active';this.scheduler.add(task);}
        } catch(error) {task.state='uncertain';task.pollState='paused';task.pauseReason='submit';task.error=errorMessage(error,[task.key]);}
        finally {task.snapshot=null;this.changed();}
      }
    } finally {this.submitting=false;this.changed();}
  }
  stopQueue() { this.stopped=true; for(const task of this.pending){task.state='needs_files';task.snapshot=null;task.key='';task.pollState='paused';task.pauseReason='manual';} this.pending=[];this.changed(); }
  stopPolling(task) {this.scheduler.pause(task,'manual');}
  resume(task) {
    if(!task.id) throw new Error('没有可查询的 task ID；请先向服务方核实提交结果');
    task.key=this.getKey(task.base) || task.key;
    if(!task.key) throw new Error('请填写该任务原 API 地址对应的 Key');
    this.scheduler.resume(task);
  }
  restore(records) {
    this.tasks=restoreTasks(records,this.clock.now());
    // Slot identity is not persisted: wait conservatively for the latest start
    // across restored tasks, so refresh cannot create an extra five-second burst.
    const recent=this.tasks.map(task=>task.lastStart).filter(time=>Number.isFinite(time) && time<=this.clock.now());
    if(recent.length) for(const slot of this.scheduler.slots) slot.nextAt=Math.max(...recent)+LIMITS.interval;
    for(const task of this.tasks) if(task.pollState==='active') {
      const key=this.getKey(task.base);
      if(key){task.key=key;this.scheduler.add(task);} else {task.pollState='paused';task.pauseReason='credentials';}
    }
    this.changed();
  }
  clearKeys() {this.stopQueue();for(const task of this.tasks){if(task.pollState==='active')this.scheduler.pause(task,'credentials');task.key='';}this.changed();}
  close(){this.scheduler.close();}
}
