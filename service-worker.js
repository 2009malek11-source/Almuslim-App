const CACHE='muslim-cache-v106';
const CORE=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./splash-program.png','./app-config.js'];
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
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  /* الصوت والفيديو وطلبات Range تذهب مباشرة للشبكة (لا تُخزَّن) */
  if(req.headers.has('range')||req.destination==='audio'||req.destination==='video')return;
  const url=new URL(req.url);
  if(url.origin===self.location.origin){
    /* ملفات التطبيق: من الذاكرة فورًا + تحديث في الخلفية (يخفّف الحمل على الخادم ويفتح الموقع لحظيًا) */
    e.respondWith(caches.match(req).then(hit=>{
      const net=fetch(req).then(r=>{
        if(r&&r.status===200&&r.type==='basic'){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{})}
        return r;
      }).catch(()=>null);
      if(hit){e.waitUntil(net);return hit}
      return net.then(r=>r||(req.mode==='navigate'?caches.match('./index.html'):Response.error()));
    }));
    return;
  }
  /* الطلبات الخارجية (APIs): الشبكة أولًا ثم آخر نسخة محفوظة */
  e.respondWith(
    fetch(req).then(r=>{
      if(r&&r.status===200&&(r.type==='cors')){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{})}
      return r;
    }).catch(()=>caches.match(req).then(x=>x||Response.error()))
  );
});
