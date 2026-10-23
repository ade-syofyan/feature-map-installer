import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {selectArtifact,verifyChecksum,validateArchiveNames,activateAndInstall} from '../lib/installer.mjs';

const entry={url:'https://github.com/ade-syofyan/feature-map-installer/releases/download/v0.21.0-pro.1/pro.tar.gz',sha256:'a'.repeat(64),engine_sha256:'b'.repeat(64),size:100};
const manifest={schema_version:1,version:'0.21.0-pro.1',artifacts:{'darwin-arm64':entry}};

test('only an actually available platform may be selected',()=>{
 assert.equal(selectArtifact(manifest,'darwin','arm64'),entry);
 assert.throws(()=>selectArtifact(manifest,'win32','x64'),/tersedia|platform/i);
});
test('untrusted manifests and unsafe URLs are rejected',()=>{
 for(const patch of [{schema_version:2},{version:'../../escape'}]) assert.throws(()=>selectArtifact({...manifest,...patch},'darwin','arm64'));
 for(const url of ['http://github.com/file','https://evil.example/pro.tar.gz','https://user:pass@github.com/file'])
  assert.throws(()=>selectArtifact({...manifest,artifacts:{'darwin-arm64':{...entry,url}}},'darwin','arm64'));
});
test('download bytes must match the package-pinned checksum',()=>{
 const data=Buffer.from('legitimate artifact');const hash=createHash('sha256').update(data).digest('hex');
 assert.equal(verifyChecksum(data,hash),true);
 assert.throws(()=>verifyChecksum(Buffer.from('modified'),hash),/checksum/i);
});
test('archive names cannot escape the extraction folder',()=>{
 assert.equal(validateArchiveNames('feature-map-pro/\nfeature-map-pro/runtime/engine/binary\n'),true);
 for(const name of ['/tmp/escape','../escape','feature-map-pro/../../escape','other/root','feature-map-pro/evil\\name','feature-map-pro/a\rname'])
  assert.throws(()=>validateArchiveNames(name+'\n'),/arsip|archive/i);
});
test('failed activation never invokes skill installation',()=>{
 let touched=false;
 assert.throws(()=>activateAndInstall(()=>({status:2}),()=>{touched=true;}),/lisensi/i);
 assert.equal(touched,false);
 assert.equal(activateAndInstall(()=>({status:0}),()=>{touched=true;return 'installed';}),'installed');
 assert.equal(touched,true);
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ensurePayload,installSkills} from '../lib/installer.mjs';

test('verified archive is extracted once and altered cached engine is rejected',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fm-installer-test-'));
 try {
  const payload=path.join(temp,'fixture/feature-map-pro/runtime/engine');fs.mkdirSync(payload,{recursive:true});
  const executable=process.platform==='win32'?'feature-map-engine.exe':'feature-map-engine';
  const engine=Buffer.from('#!/bin/sh\nexit 0\n');fs.writeFileSync(path.join(payload,executable),engine,{mode:0o755});
  const archive=path.join(temp,'fixture.tar.gz');
  assert.equal(spawnSync('tar',['-czf',archive,'-C',path.join(temp,'fixture'),'feature-map-pro']).status,0);
  const data=fs.readFileSync(archive);const hash=value=>createHash('sha256').update(value).digest('hex');
  const release={...manifest,artifacts:{[`${process.platform}-${process.arch}`]:{...entry,size:data.length,sha256:hash(data),engine_sha256:hash(engine)}}};
  let fetched=0;const options={home:path.join(temp,'cache'),fetchArtifact:async()=>{fetched++;return data;}};
  const root=await ensurePayload(release,options);assert.ok(fs.existsSync(path.join(root,'runtime/engine',executable)));
  assert.equal(await ensurePayload(release,options),root);assert.equal(fetched,1);
  fs.writeFileSync(path.join(root,'runtime/engine',executable),'tampered');
  await ensurePayload(release,options);assert.equal(fetched,2);
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
test('skill installation preserves existing files in backups outside the skills directory',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fm-skills-test-'));
 try {
  const root=path.join(temp,'payload');const home=path.join(temp,'codex');
  for(const name of ['feature-map','feature-map-pro']) {
   const source=path.join(root,'codex-skill',name);fs.mkdirSync(source,{recursive:true});fs.writeFileSync(path.join(source,'SKILL.md'),'new '+name);
  }
  const core=path.join(home,'skills/feature-map');fs.mkdirSync(core,{recursive:true});fs.writeFileSync(path.join(core,'SKILL.md'),'old Free');
  const backup=installSkills(root,home);
  assert.equal(fs.readFileSync(path.join(backup,'feature-map/SKILL.md'),'utf8'),'old Free');
  assert.ok(!backup.startsWith(path.join(home,'skills')));
  assert.equal(fs.readFileSync(path.join(home,'skills/feature-map-pro/plugin-root.txt'),'utf8'),root+'\n');
  assert.equal(fs.readFileSync(path.join(core,'SKILL.md'),'utf8'),'new feature-map');
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
});
test('incomplete new skills never replace an existing Free installation',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fm-invalid-skills-'));
 try {
  const root=path.join(temp,'payload');const home=path.join(temp,'codex');
  const core=path.join(home,'skills/feature-map');fs.mkdirSync(core,{recursive:true});fs.writeFileSync(path.join(core,'SKILL.md'),'keep Free');
  const source=path.join(root,'codex-skill/feature-map');fs.mkdirSync(source,{recursive:true});fs.writeFileSync(path.join(source,'SKILL.md'),'new');
  assert.throws(()=>installSkills(root,home),/lengkap/i);
  assert.equal(fs.readFileSync(path.join(core,'SKILL.md'),'utf8'),'keep Free');
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
});

test('Windows payload verifies its exe instead of requiring a Unix executable',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fm-win-exe-'));
 try {
  const folder=path.join(temp,'fixture/feature-map-pro/runtime/engine');fs.mkdirSync(folder,{recursive:true});
  const engine=Buffer.from('synthetic PE fixture');fs.writeFileSync(path.join(folder,'feature-map-engine.exe'),engine);
  const archive=path.join(temp,'fixture.tar.gz');
  assert.equal(spawnSync('tar',['-czf',archive,'-C',path.join(temp,'fixture'),'feature-map-pro']).status,0);
  const data=fs.readFileSync(archive);const hash=value=>createHash('sha256').update(value).digest('hex');
  const release={...manifest,artifacts:{'win32-x64':{...entry,size:data.length,sha256:hash(data),engine_sha256:hash(engine)}}};
  const root=await ensurePayload(release,{platform:'win32',arch:'x64',home:path.join(temp,'cache'),fetchArtifact:async()=>data});
  assert.equal(fs.readFileSync(path.join(root,'runtime/engine/feature-map-engine.exe'),'utf8'),'synthetic PE fixture');
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
});

test('Windows tar CRLF listing is accepted while embedded carriage returns are rejected',()=>{
 assert.equal(validateArchiveNames('feature-map-pro/\r\nfeature-map-pro/runtime/engine/feature-map-engine.exe\r\n'),true);
 assert.throws(()=>validateArchiveNames('feature-map-pro/a\rhidden\r\n'),/arsip/i);
});

test('Windows extraction selects the system tar rather than a Git Bash PATH wrapper',async()=>{
 const {tarExecutable}=await import('../lib/installer.mjs');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fm-system-tar-'));
 try {
  const executable=path.join(temp,'System32','tar.exe');fs.mkdirSync(path.dirname(executable));fs.writeFileSync(executable,'native tar fixture');
  assert.equal(tarExecutable('win32',temp),executable);
  assert.throws(()=>tarExecutable('win32',path.join(temp,'absent')),/tar/i);
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
});

import {PassThrough,Writable} from 'node:stream';
function promptTerminal() {
 const input=new PassThrough();input.isTTY=true;input.isRaw=false;
 input.setRawMode=value=>{input.isRaw=value;};
 let text='';const output=new Writable({write(chunk,encoding,done){text+=chunk.toString();done();}});output.isTTY=true;
 return {input,output,text:()=>text};
}
test('license typing and bracketed paste show masked count without revealing the token',async()=>{
 const {readLicense}=await import('../lib/prompts.mjs');const terminal=promptTerminal();
 const result=readLicense(terminal);
 terminal.input.write('FMP1.');
 assert.match(terminal.text(),/••••• \(5 karakter\)/);
 terminal.input.write('\x1b[200~synthetic\ncode\x1b[201~');
 assert.match(terminal.text(),/18 karakter/);
 terminal.input.write('\x7f');terminal.input.write('\r');
 assert.equal(await result,'FMP1.syntheticcod');
 assert.equal(terminal.input.isRaw,false);
 assert.ok(!terminal.text().includes('FMP1.'));assert.ok(!terminal.text().includes('synthetic'));
});
test('empty submit stays in prompt and Ctrl U clears before a new paste',async()=>{
 const {readLicense}=await import('../lib/prompts.mjs');const terminal=promptTerminal();
 const result=readLicense(terminal);terminal.input.write('\r');
 assert.match(terminal.text(),/Masukkan kode lisensi/);assert.equal(terminal.input.isRaw,true);
 terminal.input.write('wrong\x15valid\r');assert.equal(await result,'valid');
 assert.match(terminal.text(),/0 karakter/);
});
test('cancel and EOF restore terminal without exposing typed licenses',async()=>{
 const {readLicense}=await import('../lib/prompts.mjs');
 for(const end of ['cancel','eof']) {
  const terminal=promptTerminal();const result=readLicense(terminal);
  terminal.input.write('private-token');
  if(end==='cancel')terminal.input.write('\x03');else terminal.input.end();
  await assert.rejects(result,/dibatalkan|terputus/i);
  assert.equal(terminal.input.isRaw,false);assert.equal(terminal.input.listenerCount('keypress'),0);
  assert.ok(!terminal.text().includes('private-token'));
 }
});
test('interactive activation pipes the license to the unchanged verifier without argv secrets',async()=>{
 const {activateWithPrompt}=await import('../lib/prompts.mjs');const terminal=promptTerminal();
 let invocation;const result=activateWithPrompt('payload',['--email','buyer@example.com'],{...terminal,run:(root,args,options)=>{invocation={root,args,options};return {status:2};}});
 terminal.input.write('synthetic-token\r');
 assert.equal((await result).status,2);
 assert.deepEqual(invocation.args,['license','activate','--email','buyer@example.com']);
 assert.equal(invocation.options.input,'synthetic-token\n');
 assert.deepEqual(invocation.options.stdio,['pipe','inherit','inherit']);
 assert.match(terminal.text(),/Memeriksa lisensi/);
 assert.ok(!JSON.stringify(invocation.args).includes('synthetic-token'));
});
test('file and non-TTY activation preserve the existing engine input path',async()=>{
 const {activateWithPrompt}=await import('../lib/prompts.mjs');
 for(const args of [[],['--file','buyer.license']]) {
  const input={isTTY:args.length>0};let invocation;
  await activateWithPrompt('payload',args,{input,output:{isTTY:true},run:(...values)=>{invocation=values;return {status:0};}});
  assert.deepEqual(invocation,['payload',['license','activate',...args]]);
 }
});

test('email prompt can be cancelled without starting activation or leaving raw mode', {timeout:2000},async()=>{
 const {activateWithPrompt}=await import('../lib/prompts.mjs');const terminal=promptTerminal();
 let started=false;const result=activateWithPrompt('payload',[],{...terminal,run:()=>{started=true;}});
 terminal.input.write('\x03');
 await assert.rejects(result,/dibatalkan/);assert.equal(started,false);assert.equal(terminal.input.isRaw,false);
});
test('long pasted licenses keep one bounded row and retain their full length',async()=>{
 const {readLicense}=await import('../lib/prompts.mjs');const terminal=promptTerminal();
 const token='X'.repeat(500);const result=readLicense(terminal);terminal.input.write('\x1b[200~'+token+'\x1b[201~');
 const last=terminal.text().split('\r').at(-1);assert.match(last,/500 karakter/);assert.equal((last.match(/•/g)||[]).length,20);
 terminal.input.write('\r');assert.equal(await result,token);
});

test('email EOF settles activation and restores terminal', {timeout:2000},async()=>{
 const {activateWithPrompt}=await import('../lib/prompts.mjs');const terminal=promptTerminal();
 const result=activateWithPrompt('payload',[],{...terminal,run:()=>assert.fail('must not activate')});
 terminal.input.end();await assert.rejects(result,/email terputus/);assert.equal(terminal.input.isRaw,false);
});
test('email then pasted license reaches verifier with both values intact', {timeout:2000},async()=>{
 const {activateWithPrompt}=await import('../lib/prompts.mjs');const terminal=promptTerminal();let invocation;
 const result=activateWithPrompt('payload',[],{...terminal,run:(root,args,options)=>{invocation={args,options};return {status:2};}});
 terminal.input.write('buyer@example.com\r');await new Promise(resolve=>setImmediate(resolve));
 terminal.input.write('synthetic-license\r');await result;
 assert.deepEqual(invocation.args,['license','activate','--email','buyer@example.com']);
 assert.equal(invocation.options.input,'synthetic-license\n');assert.equal(terminal.input.isRaw,false);
});

test('Codex hooks preserve other integrations, upgrade once, and reject malformed config before skills change',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fm-hooks-'));
 try {
  const root=path.join(temp,'payload'),home=path.join(temp,'codex');
  for(const name of ['feature-map','feature-map-pro']) {
   fs.mkdirSync(path.join(root,'codex-skill',name),{recursive:true});
   fs.writeFileSync(path.join(root,'codex-skill',name,'SKILL.md'),'skill');
  }
  fs.mkdirSync(path.join(root,'hooks'),{recursive:true});
  fs.writeFileSync(path.join(root,'hooks','feature_map_pre_edit.py'),'# hook');
  fs.mkdirSync(home,{recursive:true});
  const foreign={matcher:'Bash',hooks:[{type:'command',command:'rtk hook codex'}]};
  fs.writeFileSync(path.join(home,'hooks.json'),JSON.stringify({hooks:{PreToolUse:[foreign]},custom:'retained'}));
  installSkills(root,home);
  let config=JSON.parse(fs.readFileSync(path.join(home,'hooks.json'),'utf8'));
  assert.deepEqual(config.hooks.PreToolUse[0],foreign);
  assert.equal(config.custom,'retained');
  assert.equal(config.hooks.PreToolUse.length,2);
  assert.equal(config.hooks.PreToolUse[1].hooks[0].additionalContextLimit,0);
  assert.match(config.hooks.PreToolUse[1].hooks[0].command,/feature_map_pre_edit\.py.*--client codex/);
  assert.ok(config.hooks.PreCompact.length);
  installSkills(root,home);
  config=JSON.parse(fs.readFileSync(path.join(home,'hooks.json'),'utf8'));
  assert.equal(config.hooks.PreToolUse.length,2);
  fs.writeFileSync(path.join(home,'skills','feature-map','SKILL.md'),'preserve');
  fs.writeFileSync(path.join(home,'hooks.json'),'{broken');
  assert.throws(()=>installSkills(root,home));
  assert.equal(fs.readFileSync(path.join(home,'skills','feature-map','SKILL.md'),'utf8'),'preserve');
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
});

test('concurrent hook changes abort installation and preserve the new foreign configuration',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fm-hook-race-'));
 const rename=fs.renameSync;
 try {
  const root=path.join(temp,'payload'),home=path.join(temp,'codex'),file=path.join(home,'hooks.json');
  for(const name of ['feature-map','feature-map-pro']) {
   fs.mkdirSync(path.join(root,'codex-skill',name),{recursive:true});
   fs.writeFileSync(path.join(root,'codex-skill',name,'SKILL.md'),'new');
   fs.mkdirSync(path.join(home,'skills',name),{recursive:true});
   fs.writeFileSync(path.join(home,'skills',name,'SKILL.md'),'old');
  }
  fs.mkdirSync(path.join(root,'hooks'),{recursive:true});fs.writeFileSync(path.join(root,'hooks/feature_map_pre_edit.py'),'# hook');
  fs.writeFileSync(file,'{}');
  let changed=false;
  fs.renameSync=(from,to)=>{
   rename(from,to);
   if(!changed&&String(from).includes('feature-map-stage')) {changed=true;fs.writeFileSync(file,'{"external":true}');}
  };
  assert.throws(()=>installSkills(root,home),/berubah/);
  assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),{external:true});
  assert.equal(fs.readFileSync(path.join(home,'skills/feature-map/SKILL.md'),'utf8'),'old');
 } finally {fs.renameSync=rename;fs.rmSync(temp,{recursive:true,force:true});}
});
