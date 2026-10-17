const CACHE='muslim-cache-v108';
const CORE=['./','./index.html','./manifest.json','./style.css','./script.js','./app-config.js','./icon.png','./icon-192.png','./icon-512.png','./qr.png','./diag.html'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>Promise.all(CORE.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.indexOf('muslim-cache')===0).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
    .then(()=>self.clients.matchAll({type:'window'}))
    .then(cs=>cs.forEach(c=>c.postMessage({t:'updated'})))
  );
});
/* شبكة أولًا (مهلة 3.5 ثانية) ثم النسخة المحفوظة: التحديثات تصل فورًا ويعمل التطبيق بلا إنترنت */
function netFirst(req){
  return new Promise(res=>{
    let done=false;
    const t=setTimeout(()=>{caches.match(req).then(h=>{if(h&&!done){done=true;res(h)}})},3500);
    fetch(req).then(r=>{
      clearTimeout(t);
      if(r&&r.status===200&&r.type==='basic'){const c=r.clone();caches.open(CACHE).then(ca=>ca.put(req,c)).catch(()=>{})}
      if(!done){done=true;res(r)}
    }).catch(()=>{
      clearTimeout(t);if(done)return;
      caches.match(req).then(h=>{done=true;res(h||(req.mode==='navigate'?caches.match('./index.html'):Response.error()))});
    });
  });
}
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  if(req.headers.has('range')||req.destination==='audio'||req.destination==='video')return;
  const url=new URL(req.url);
  /* لا نتدخل في الطلبات الخارجية (الصوت، الخرائط، القرّاء…) حتى لا يتعطل التشغيل على iOS */
  if(url.origin!==self.location.origin)return;
  e.respondWith(netFirst(req));
});
