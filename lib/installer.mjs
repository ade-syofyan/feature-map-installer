import {createHash,randomUUID} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const MAX_DOWNLOAD=384*1024*1024;
const HEX=/^[a-f0-9]{64}$/;
const VERSION=/^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/;
const DOWNLOAD_HOSTS=new Set(['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com']);

function trustedURL(value) {
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||!DOWNLOAD_HOSTS.has(url.hostname))
  throw new Error('URL unduhan tidak tepercaya.');
 return url;
}
export function selectArtifact(manifest,platform=process.platform,arch=process.arch) {
 if(manifest?.schema_version!==1||!VERSION.test(manifest.version)||!manifest.artifacts)
  throw new Error('Manifest rilis tidak valid.');
 const entry=manifest.artifacts[`${platform}-${arch}`];
 if(!entry) throw new Error(`Paket belum tersedia untuk platform ${platform}-${arch}.`);
 if(!HEX.test(entry.sha256)||!HEX.test(entry.engine_sha256)||!Number.isSafeInteger(entry.size)||entry.size<1||entry.size>MAX_DOWNLOAD)
  throw new Error('Metadata unduhan tidak valid.');
 const url=trustedURL(entry.url);
 if(url.hostname!=='github.com'||!url.pathname.startsWith('/ade-syofyan/feature-map-installer/releases/download/'))
  throw new Error('Lokasi rilis tidak tepercaya.');
 return entry;
}
export function verifyChecksum(data,expected) {
 if(!HEX.test(expected)||createHash('sha256').update(data).digest('hex')!==expected)
  throw new Error('Checksum paket berbeda. Unduhan dibatalkan.');
 return true;
}
export function validateArchiveNames(listing) {
 const names=listing.split(/\r?\n/).filter(Boolean);
 if(!names.length) throw new Error('Arsip kosong.');
 for(const name of names) {
  if(!/^feature-map-pro\/(?:[A-Za-z0-9._+@/-]*)$/.test(name)||name.split('/').some(p=>p==='..'||p==='.'))
   throw new Error('Path arsip tidak aman.');
 }
 return true;
}
export function activateAndInstall(activate,install) {
 const result=activate();
 if(result.status!==0) throw new Error('Aktivasi lisensi gagal. Instalasi skill dihentikan.');
 return install();
}
export async function download(entry) {
 let url=trustedURL(entry.url);
 for(let redirects=0;redirects<=5;redirects++) {
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(180000)});
  if([301,302,303,307,308].includes(response.status)) {
   const location=response.headers.get('location');
   if(!location) throw new Error('Redirect unduhan tidak valid.');
   url=trustedURL(new URL(location,url).href);continue;
  }
  if(!response.ok||!response.body) throw new Error(`Unduhan gagal (${response.status}).`);
  const chunks=[];let size=0;
  for await(const part of response.body) {
   size+=part.byteLength;
   if(size>entry.size||size>MAX_DOWNLOAD) throw new Error('Ukuran unduhan melebihi metadata rilis.');
   chunks.push(Buffer.from(part));
  }
  if(size!==entry.size) throw new Error('Unduhan belum lengkap.');
  const data=Buffer.concat(chunks);verifyChecksum(data,entry.sha256);return data;
 }
 throw new Error('Terlalu banyak redirect unduhan.');
}
export function enginePath(root,platform=process.platform) { return path.join(root,'runtime','engine',platform==='win32'?'feature-map-engine.exe':'feature-map-engine'); }
function engineValid(root,entry,platform) {
 try {
  const file=enginePath(root,platform);
  if(fs.lstatSync(file).isSymbolicLink()||!fs.statSync(file).isFile()) return false;
  verifyChecksum(fs.readFileSync(file),entry.engine_sha256);return true;
 } catch {return false;}
}
export function tarExecutable(platform=process.platform,systemRoot=process.env.SystemRoot||process.env.SYSTEMROOT) {
 if(platform!=='win32') return 'tar';
 const executable=systemRoot&&path.join(systemRoot,'System32','tar.exe');
 if(!executable||!fs.existsSync(executable)) throw new Error('Tar bawaan Windows tidak tersedia. Gunakan Windows 10/11 dengan tar.');
 return executable;
}
function tar(args) {
 const result=spawnSync(tarExecutable(),args,{encoding:'utf8',maxBuffer:8*1024*1024});
 if(result.error||result.status!==0) throw new Error('Paket tidak bisa dibaca. Pastikan tar tersedia.');
 return result.stdout;
}
export async function ensurePayload(manifest,{home=process.env.FEATURE_MAP_PRO_HOME||path.join(os.homedir(),'.local','share','feature-map-pro'),fetchArtifact=download,platform=process.platform,arch=process.arch}={}) {
 const entry=selectArtifact(manifest,platform,arch);
 const base=path.resolve(home,'releases',manifest.version,`${platform}-${arch}`);
 const root=path.join(base,'feature-map-pro');
 const marker=path.join(base,'artifact.sha256');
 if(fs.existsSync(base)&&fs.lstatSync(base).isSymbolicLink()) throw new Error('Folder instalasi tidak boleh berupa symlink.');
 if(fs.existsSync(marker)&&fs.readFileSync(marker,'utf8')===entry.sha256&&engineValid(root,entry,platform)) return root;
 const parent=path.dirname(base);fs.mkdirSync(parent,{recursive:true});
 const staging=fs.mkdtempSync(path.join(parent,'.download-'));
 try {
  console.log('Mengunduh mesin Feature Map Pro…');
  const data=await fetchArtifact(entry);verifyChecksum(data,entry.sha256);
  const archive=path.join(staging,'download.tar.gz');fs.writeFileSync(archive,data,{mode:0o600});
  validateArchiveNames(tar(['-tzf',archive]));
  const types=tar(['-tvzf',archive]).split(/\r?\n/).filter(Boolean);
  if(types.some(line=>!['-','d'].includes(line[0]))) throw new Error('Arsip mengandung link atau file khusus.');
  const extracted=path.join(staging,'extracted');fs.mkdirSync(extracted);
  tar(['-xzf',archive,'-C',extracted,'--no-same-owner']);
  const extractedRoot=path.join(extracted,'feature-map-pro');
  if(!engineValid(extractedRoot,entry,platform)) throw new Error('Mesin Pro tidak cocok dengan rilis.');
  const previous=base+'.previous-'+randomUUID();
  const hadPrevious=fs.existsSync(base);
  if(hadPrevious) fs.renameSync(base,previous);
  try {fs.renameSync(extracted,base);} catch(error) {if(hadPrevious) fs.renameSync(previous,base);throw error;}
  fs.writeFileSync(marker,entry.sha256,{mode:0o600});
  if(hadPrevious) fs.rmSync(previous,{recursive:true,force:true});
  return root;
 } finally {fs.rmSync(staging,{recursive:true,force:true});}
}
const HOOK_OWNER='Feature Map Pro: Cek Sebelum Edit';
function codexHookUpdate(root,codexHome) {
 const script=path.join(root,'hooks','feature_map_pre_edit.py');
 if(!fs.existsSync(script)) return null; // Older payloads retain their existing installation behavior.
 const file=path.join(codexHome,'hooks.json');
 if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink()) throw new Error('hooks.json berupa symlink.');
 const previous=fs.existsSync(file)?fs.readFileSync(file):null;
 const config=previous?JSON.parse(previous.toString('utf8')):{};
 if(!config||Array.isArray(config)||typeof config!=='object') throw new Error('Konfigurasi hook salah.');
 config.hooks??={};
 if(!config.hooks||Array.isArray(config.hooks)||typeof config.hooks!=='object') throw new Error('Konfigurasi hook salah.');
 const quote=value=>process.platform==='win32'?'"'+value.replaceAll('"','\\"')+'"':"'"+value.replaceAll("'","'\\''")+"'";
 const command='python3 '+quote(script)+' --client codex';
 for(const [event,matcher] of Object.entries({PreToolUse:'Edit|Write|MultiEdit|NotebookEdit|Bash|apply_patch|exec_command|shell_command',SessionStart:'',PreCompact:'',PostCompact:'',SessionEnd:'',SubagentStart:''})) {
  const existing=config.hooks[event]??[];
  if(!Array.isArray(existing)) throw new Error('Daftar hook salah.');
  config.hooks[event]=existing.map(group=>{
   if(!group||!Array.isArray(group.hooks)) throw new Error('Entri hook salah.');
   return {...group,hooks:group.hooks.filter(hook=>!(hook.statusMessage===HOOK_OWNER&&/feature_map_pre_edit\.py/.test(hook.command??'')))};
  }).filter(group=>group.hooks.length);
  config.hooks[event].push({matcher,hooks:[{type:'command',command,timeout:event==='SessionEnd'?3:15,statusMessage:HOOK_OWNER,...(event==='PreToolUse'?{additionalContextLimit:0}:{})}]});
 }
 return {file,previous,content:JSON.stringify(config,null,2)+'\n'};
}
function writeHooks(update,backups) {
 if(!update) return;
 if(fs.existsSync(update.file)&&fs.lstatSync(update.file).isSymbolicLink()) throw new Error('hooks.json berubah menjadi symlink.');
 const current=fs.existsSync(update.file)?fs.readFileSync(update.file):null;
 if(current===null?update.previous!==null:update.previous===null||!current.equals(update.previous))
  throw new Error('Konfigurasi hook berubah saat instalasi. Ulangi instalasi.');
 fs.mkdirSync(backups,{recursive:true});
 if(update.previous) fs.writeFileSync(path.join(backups,'hooks.json'),update.previous,{mode:0o600});
 const temporary=update.file+'.feature-map-'+randomUUID();
 try {fs.writeFileSync(temporary,update.content,{mode:0o600});fs.renameSync(temporary,update.file);}
 finally {fs.rmSync(temporary,{force:true});}
}
export function installCodexHooks(root,codexHome=process.env.CODEX_HOME||path.join(os.homedir(),'.codex')) {
 const update=codexHookUpdate(root,codexHome);
 writeHooks(update,path.join(codexHome,'feature-map-backups',randomUUID()));
}
export function installSkills(root,codexHome=process.env.CODEX_HOME||path.join(os.homedir(),'.codex')) {
 const hookUpdate=codexHookUpdate(root,codexHome); // Validate before moving any skill.
 const names=['feature-map','feature-map-pro'];
 const id=randomUUID();const staging=path.join(codexHome,'feature-map-stage',id);
 const backups=path.join(codexHome,'feature-map-backups',id);
 const targets=names.map(name=>path.join(codexHome,'skills',name));
 for(const target of targets) if(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())
  throw new Error('Folder skill berupa symlink. Salin konfigurasi Anda sebelum mengganti instalasi.');
 fs.mkdirSync(staging,{recursive:true});
 const moved=[];const installed=[];
 try {
  for(const name of names) {
   const source=path.join(root,'codex-skill',name);
   if(!fs.existsSync(path.join(source,'SKILL.md'))) throw new Error('Skill tidak lengkap pada paket Pro.');
   fs.cpSync(source,path.join(staging,name),{recursive:true});
   fs.writeFileSync(path.join(staging,name,'plugin-root.txt'),root+'\n');
  }
  fs.mkdirSync(path.join(codexHome,'skills'),{recursive:true});
  for(let i=0;i<names.length;i++) {
   if(fs.existsSync(targets[i])) {
    fs.mkdirSync(backups,{recursive:true});const backup=path.join(backups,names[i]);
    fs.renameSync(targets[i],backup);moved.push([backup,targets[i]]);
   }
   fs.renameSync(path.join(staging,names[i]),targets[i]);installed.push(targets[i]);
  }
  writeHooks(hookUpdate,backups);
 } catch(error) {
  for(const target of installed.reverse()) fs.rmSync(target,{recursive:true,force:true});
  for(const [backup,target] of moved.reverse()) fs.renameSync(backup,target);
  throw error;
 } finally {fs.rmSync(staging,{recursive:true,force:true});}
 return moved.length?backups:null;
}
export function runEngine(root,args,{stdio='inherit',...options}={}) {
 const result=spawnSync(enginePath(root),args,{stdio,...options});
 if(result.error) throw new Error('Mesin Pro tidak bisa dijalankan: '+result.error.message);
 return result;
}
