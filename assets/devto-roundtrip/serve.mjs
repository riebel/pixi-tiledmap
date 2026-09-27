import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
createServer(async(req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const path=resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!path.startsWith(root)){res.writeHead(403).end();return;}
  try{const data=await readFile(path);res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.tmj':'application/json','.png':'image/png'})[extname(path)]??'text/plain');res.end(data);}catch{res.writeHead(404).end();}
}).listen(4178,'127.0.0.1',()=>console.log('Round trip demo: http://127.0.0.1:4178'));
