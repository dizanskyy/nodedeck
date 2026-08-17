import http from 'node:http';
import fs from 'node:fs';
const file = 'D:/NodeDeck/reference.html';
http.createServer((req,res)=>{
  res.setHeader('Content-Type','text/html; charset=utf-8');
  fs.createReadStream(file).pipe(res);
}).listen(7788,()=>console.log('serving on 7788'));
