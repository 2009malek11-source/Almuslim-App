/* =====================================================================
   Service Worker — المسلم (V108)
   - الصفحات والملفات المحلية: stale-while-revalidate (فتح فوري + تحديث بالخلفية).
   - الخطوط (Google Fonts + jsDelivr woff2): تُخزَّن بعد أول تحميل لتعمل بلا إنترنت.
   - الصوت/الفيديو/الـ API الخارجي: لا نتدخل (يمنع مشاكل Range وiOS).
   - الإشعارات: عرض + فتح التطبيق عند النقر + فحص تذكيرات دوري + Web Push.
   - لا تُحذف مخازن muslim-audio / muslim-files / muslim-config (تنزيلات المستخدم وإعداداته).
   ===================================================================== */
const CACHE='muslim-cache-v114';
const FONTS='muslim-fonts-v1';
const CORE=['./','./index.html','./manifest.json','./style.css','./script.js','./prayer-engine.js','./app-config.js','./icon.png','./icon-192.png','./icon-512.png','./splash-program.png'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>Promise.all(CORE.map(u=>c.add(new Request(u,{cache:'reload'})).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.indexOf('muslim-cache')===0&&k!==CACHE).map(k=>caches.delete(k)));
    if(self.registration.navigationPreload)try{await self.registration.navigationPreload.enable()}catch(_){}
    await self.clients.claim();
    const cs=await self.clients.matchAll({type:'window'});cs.forEach(c=>c.postMessage({t:'updated'}));
  })());
});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='skip-waiting')self.skipWaiting()});
function put(cache,req,res){if(res&&res.status===200&&(res.type==='basic'||res.type==='cors')){const c=res.clone();caches.open(cache).then(ca=>ca.put(req,c)).catch(()=>{})}return res}
/* نسخة محفوظة فورًا + تحديث بالخلفية */
function swr(e,cache){
  const req=e.request;
  return caches.match(req,{ignoreSearch:req.mode==='navigate'}).then(hit=>{
    const net=fetch(req).then(r=>put(cache,req,r)).catch(()=>null);
    if(hit){e.waitUntil(net);return hit}
    return net.then(r=>r||(req.mode==='navigate'?caches.match('./index.html'):Response.error()));
  });
}
/* HTML/JS/CSS: الشبكة أولًا بمهلة قصيرة ثم النسخة المحفوظة — فيصلك أحدث إصدار فورًا ويعمل بلا إنترنت */
function netFirst(e){
  const req=e.request;
  return new Promise(res=>{
    let done=false;
    const t=setTimeout(()=>{caches.match(req,{ignoreSearch:req.mode==='navigate'}).then(h=>{if(h&&!done){done=true;res(h)}})},1800);
    fetch(req).then(r=>{clearTimeout(t);put(CACHE,req,r);if(!done){done=true;res(r)}}).catch(()=>{
      clearTimeout(t);if(done)return;
      caches.match(req,{ignoreSearch:req.mode==='navigate'}).then(h=>{done=true;res(h||(req.mode==='navigate'?caches.match('./index.html'):Response.error()))});
    });
  });
}
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  if(req.headers.has('range')||req.destination==='audio'||req.destination==='video')return;
  const url=new URL(req.url);
  if(url.origin===self.location.origin){
    if(url.pathname.endsWith('/sw.js')||url.pathname.endsWith('/service-worker.js'))return;
    const d=req.destination;
    if(req.mode==='navigate'||d==='script'||d==='style'||d==='document'){e.respondWith(netFirst(e));return}
    e.respondWith(swr(e,CACHE));return;
  }
  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'||(url.hostname==='cdn.jsdelivr.net'&&/\.woff2?$/.test(url.pathname))){e.respondWith(swr(e,FONTS))}
});
/* ---------- الإشعارات ---------- */
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const page=(e.notification.data&&e.notification.data.open)||'daily';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    for(const c of cs){if('focus' in c){c.postMessage({type:'open',page});return c.focus()}}
    return self.clients.openWindow('./?open='+encodeURIComponent(page));
  }));
});
/* فحص التذكيرات في الخلفية (Periodic Background Sync — Chrome/Edge للتطبيق المثبّت)
   الأحداث (مواقيت الصلاة + الأعمال) تُحسب لـ 3 أيام وتُجدَّد تلقائيًا بنفس إعدادات المستخدم. */
try{importScripts('./prayer-engine.js')}catch(_){}
const DAYS=3,GRACE=30*60e3;
async function checkReminders(){
  try{
    const c=await caches.open('muslim-config-v1'),r=await c.match('./__events.json');if(!r)return;
    const rec=await r.json(),now=Date.now(),PE=self.PrayerEngine;let changed=false;
    /* مرّت 3 أيام (أو انتهت الأحداث): نعيد حساب الأوقات من نفس الإعدادات المحفوظة */
    if(PE&&rec.cfg&&(now-(rec.computedAt||0)>DAYS*86400e3||!(rec.events||[]).some(e=>e.at>now))){
      rec.events=PE.buildEvents(rec.cfg,now,DAYS);rec.computedAt=now;changed=true;
    }
    const fired=rec.fired||{};
    for(const e of rec.events||[]){
      if(fired[e.id]||e.at>now||now-e.at>GRACE)continue;
      await self.registration.showNotification(e.t,{body:e.b||'',tag:e.id,icon:'./icon-192.png',badge:'./icon-192.png',lang:'ar',dir:'rtl',data:{open:e.open||'daily'}});
      fired[e.id]=now;changed=true;
    }
    if(changed){rec.fired=fired;await c.put('./__events.json',new Response(JSON.stringify(rec),{headers:{'Content-Type':'application/json'}}))}
  }catch(_){}
}
self.addEventListener('periodicsync',e=>{if(e.tag==='muslim-reminders')e.waitUntil(checkReminders())});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='check-reminders')e.waitUntil(checkReminders())});
/* ---------- Web Push ---------- */
self.addEventListener('push',e=>{
  let d={};
  try{d=e.data?e.data.json():{}}catch(_){d={title:e.data?e.data.text():'المسلم'}}
  const title=d.title||'المسلم';
  const opts={body:d.body||'',icon:'./icon-192.png',badge:'./icon-192.png',tag:d.tag||'muslim-push',lang:'ar',dir:'rtl',data:{open:d.open||'daily'}};
  e.waitUntil(self.registration.showNotification(title,opts));
});
