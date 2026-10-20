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
