import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
await import('./build.mjs');
const root=fileURLToPath(new URL('../',import.meta.url));
const port=Number(process.env.PORT || 4186);
const server=createServer(async(req,res)=>{
  const routes={'/':['dist/index.html','text/html; charset=utf-8'],'/index.html':['dist/index.html','text/html; charset=utf-8'],'/provider-config.example.json':['provider-config.example.json','application/json'],'/favicon.ico':null};
  const route=routes[new URL(req.url,'http://localhost').pathname];
  if(!route){res.writeHead(404);res.end();return;}
  try{res.writeHead(200,{'Content-Type':route[1],'Cache-Control':'no-store'});res.end(await readFile(root+route[0]));}catch{res.writeHead(500);res.end('Build not available');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
