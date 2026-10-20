import {createInterface,emitKeypressEvents} from 'node:readline';
import {runEngine} from './installer.mjs';

export function readLicense({input=process.stdin,output=process.stdout}={}) {
 return new Promise((resolve,reject)=>{
  let value='',pasting=false,finished=false;
  const wasRaw=Boolean(input.isRaw);
  const draw=(message='')=>output.write('\r\x1b[2KKode lisensi: '+ '•'.repeat(Math.min([...value].length,20))+` (${[...value].length} karakter)`+(message?' — '+message:''));
  function finish(error) {
   if(finished)return;finished=true;
   input.removeListener('keypress',onKey);input.removeListener('end',onEnd);input.removeListener('error',onError);
   input.setRawMode(wasRaw);input.pause();output.write('\x1b[?2004l\n');
   if(error)reject(error);else resolve(value);
   value='';
  }
  const onEnd=()=>finish(new Error('Input lisensi terputus. Coba lagi.'));
  const onError=()=>finish(new Error('Input lisensi tidak bisa dibaca.'));
  function onKey(text,key={}) {
   if(finished)return;
   if(key.name==='paste-start'){pasting=true;return;}
   if(key.name==='paste-end'){pasting=false;draw();return;}
   if(key.ctrl&&key.name==='c')return finish(Object.assign(new Error('Aktivasi dibatalkan.'),{exitCode:130}));
   if(key.ctrl&&key.name==='d')return onEnd();
   if(key.ctrl&&key.name==='u'){value='';draw();return;}
   if(key.name==='return'||key.name==='enter') {
    if(pasting)return;
    if(!value.trim()){draw('Masukkan kode lisensi');return;}
    return finish();
   }
   if(key.name==='backspace'){value=[...value].slice(0,-1).join('');draw();return;}
   if(text&&!key.ctrl&&!key.meta&&!text.includes('\x1b')) {
    value+=(text.replace(/[\x00-\x20\x7f]/g,''));
    if(value.length>16384)return finish(new Error('Kode lisensi terlalu panjang. Cek lagi.'));
    draw();
   }
  }
  emitKeypressEvents(input);input.setRawMode(true);
  input.on('keypress',onKey);input.once('end',onEnd);input.once('error',onError);
  output.write('Tempel kode lisensi, lalu tekan Enter. Ctrl+U hapus; Ctrl+C batal.\n\x1b[?2004h');draw();input.resume();
 });
}

export async function activateWithPrompt(root,args,{input=process.stdin,output=process.stdout,run=runEngine}={}) {
 if(!input.isTTY||!output.isTTY||args.includes('--file'))return run(root,['license','activate',...args]);
 const activation=[...args];
 if(!activation.includes('--email')) {
  const prompt=createInterface({input,output});
  try {
   const email=await new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(error,value)=>{
     if(settled)return;settled=true;
     prompt.removeListener('close',closed);prompt.removeListener('SIGINT',cancelled);input.removeListener('error',failed);
     if(error)reject(error);else resolve(value);
    };
    const closed=()=>finish(new Error('Input email terputus. Coba lagi.'));
    const cancelled=()=>finish(Object.assign(new Error('Aktivasi dibatalkan.'),{exitCode:130}));
    const failed=()=>finish(new Error('Input email tidak bisa dibaca.'));
    prompt.once('close',closed);prompt.once('SIGINT',cancelled);input.once('error',failed);
    prompt.question('Email pembelian: ',value=>finish(null,value));
   });
   activation.push('--email',email);
  } finally {prompt.close();}
 }
 const token=await readLicense({input,output});
 output.write('Memeriksa lisensi…\n');
 return run(root,['license','activate',...activation],{input:token+'\n',stdio:['pipe','inherit','inherit']});
}
