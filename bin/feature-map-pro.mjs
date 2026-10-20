#!/usr/bin/env node
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {activateAndInstall,ensurePayload,installSkills,runEngine} from '../lib/installer.mjs';
import {activateWithPrompt} from '../lib/prompts.mjs';

const manifest=JSON.parse(fs.readFileSync(fileURLToPath(new URL('../release.json',import.meta.url)),'utf8'));
const args=process.argv.slice(2);
if(!args.length||args[0]==='--help'||args[0]==='help') {
 console.log(`Feature Map Pro ${manifest.version}\n\nPemakaian:\n  feature-map-pro install [--email email] [--license-file file] [--activate-only]\n  feature-map-pro license status\n  feature-map-pro <perintah-pro> [opsi]\n\nInstaller gratis; fitur Pro memerlukan lisensi pembelian.\nDukungan platform mengikuti paket yang tersedia pada rilis.`);
} else {
 try {
  const root=await ensurePayload(manifest);
  if(args[0]==='install') {
   const activation=[];let activateOnly=false;
   for(let i=1;i<args.length;i++) {
    if(args[i]==='--activate-only') {activateOnly=true;continue;}
    if(!['--email','--license-file'].includes(args[i])||!args[i+1]) throw new Error('Opsi instalasi tidak dikenal. Gunakan --help.');
    activation.push(args[i]==='--license-file'?'--file':args[i],args[++i]);
   }
   const result=await activateWithPrompt(root,activation);
   activateAndInstall(()=>result,()=>{
    const backup=activateOnly?null:installSkills(root);
    console.log('Pro aktif. Buka sesi baru untuk memuat instruksi Pro.');
    if(backup) console.log('Salinan skill sebelumnya: '+backup);
   });
  } else {
   process.exitCode=runEngine(root,args).status??2;
  }
 } catch(error) {console.error('Gagal: '+error.message);process.exitCode=error.exitCode||2;}
}
