import { readFile, writeFile } from 'node:fs/promises';
import { rolldown } from 'rolldown';
const width = 18, height = 10;
const terrain = Array(width * height).fill(0);
const decor = [...terrain];
const put = (a,x,y,id) => { a[y*width+x] = id+1; };
for(let x=0;x<width;x++) {
  if(x<7 || x>10) {
    put(terrain,x,6,x===6?38:x===11?37:36);
    for(let y=7;y<height;y++) put(terrain,x,y,x===6?35:x===11?34:33);
  } else {
    put(terrain,x,8,63); put(terrain,x,9,62);
  }
}
for(const [x,y,id] of [[1,5,8],[3,5,71],[5,5,26],[12,5,27],[16,5,12],[2,5,20],[14,5,8],[7,4,10],[8,4,10],[9,4,10],[10,4,10]]) put(decor,x,y,id);
const layer=(id,name,data)=>({id,name,type:'tilelayer',x:0,y:0,width,height,opacity:1,visible:true,data});
const map={type:'map',version:'1.10',tiledversion:'1.12.2',orientation:'orthogonal',renderorder:'right-down',width,height,tilewidth:128,tileheight:128,infinite:false,backgroundcolor:'#b8e1eb',nextlayerid:4,nextobjectid:1,layers:[layer(1,'Terrain',terrain),layer(2,'Details',decor),layer(3,'Bridge',Array(width*height).fill(0))],tilesets:[{firstgid:1,name:'platformer',image:'platformer.png',imagewidth:1320,imageheight:1056,tilewidth:128,tileheight:128,tilecount:80,columns:10,margin:2,spacing:4}]};
await writeFile(new URL('./level.tmj',import.meta.url),JSON.stringify(map,null,2));
const bundle=await rolldown({input:new URL('./main.ts',import.meta.url).pathname.slice(1),platform:'browser'});
await bundle.write({dir:new URL('.',import.meta.url).pathname.slice(1),entryFileNames:'bundle.js',format:'es'});
await bundle.close();
