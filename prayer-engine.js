/* =====================================================================
   محرّك مواقيت الصلاة — بدون أي اعتماد خارجي (يعمل في الصفحة وفي الـ Service Worker)
   - حساب فلكي: مواضع الشمس وفق معادلات Meeus «Astronomical Algorithms» (دقة أقل من ثانيتين).
   - طريقة الحساب تُختار تلقائيًا من الدولة (رمز البلد) أو من أقرب بلد معروف عند انعدام الاتصال.
   - يعطي أيضًا الأحداث المطلقة (بالميلي ثانية) لتذكيرات الأيام الثلاثة القادمة.
   ===================================================================== */
(function(root){
'use strict';
var PI=Math.PI,R=PI/180,D=180/PI;
function sin(x){return Math.sin(x*R)}function cos(x){return Math.cos(x*R)}function tan(x){return Math.tan(x*R)}
function asin(x){return Math.asin(x)*D}function acos(x){return Math.acos(x)*D}function atan2(y,x){return Math.atan2(y,x)*D}
function n360(x){x=x%360;return x<0?x+360:x}
function n180(x){x=n360(x);return x>180?x-360:x}

/* ---------- الفلك ---------- */
function julian(y,m,d,h){if(m<=2){y-=1;m+=12}var A=Math.floor(y/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+d+(h||0)/24+B-1524.5}
function solar(jd){
  var T=(jd-2451545)/36525,T2=T*T;
  var L0=n360(280.4664567+36000.76983*T+0.0003032*T2);
  var M=n360(357.52911+35999.05029*T-0.0001537*T2);
  var C=(1.914602-0.004817*T-0.000014*T2)*sin(M)+(0.019993-0.000101*T)*sin(2*M)+0.000289*sin(3*M);
  var om=125.04-1934.136*T;
  var lam=L0+C-0.00569-0.00478*sin(om);
  var eps0=23+(26+(21.448-T*(46.815+T*(0.00059-T*0.001813)))/60)/60;
  var eps=eps0+0.00256*cos(om);
  var dec=asin(sin(eps)*sin(lam));
  var ra=n360(atan2(cos(eps)*sin(lam),cos(lam)));
  /* الزمن النجمي الظاهري عند غرينتش */
  var th=n360(280.46061837+360.98564736629*(jd-2451545)+0.000387933*T2-T2*T/38710000);
  var Lm=218.3165+481267.8813*T;
  var dpsi=(-17.2*sin(om)-1.32*sin(2*L0)-0.23*sin(2*Lm)+0.21*sin(2*om))/3600;
  th=n360(th+dpsi*cos(eps));
  return {dec:dec,ra:ra,th:th};
}
function interp(y2,y1,y3,n){var a=y2-y1,b=y3-y2,c=b-a;return y2+n/2*(a+b+n*c)}
function unwind(a2,a1,a3){var o=[a1,a2,a3];for(var i=0;i<3;i+=2){var d=o[i]-a2;if(d>180)o[i]-=360;else if(d<-180)o[i]+=360}return o}

/* يحسب أحداث يوم شمسي واحد (التاريخ بالتوقيت العالمي UT) ويعيد دقائق/أجزاء يوم بالنسبة لمنتصف ليل UT */
function Day(lat,lng,y,mo,d){
  var jd0=julian(y,mo,d,0);
  var s1=solar(jd0-1),s2=solar(jd0),s3=solar(jd0+1);
  var ra=unwind(s2.ra,s1.ra,s3.ra),Lw=-lng,th0=s2.th;
  function raAt(m){return interp(ra[1],ra[0],ra[2],m)}
  function decAt(m){return interp(s2.dec,s1.dec,s3.dec,m)}
  var m0=((ra[1]+Lw-th0)/360)%1;if(m0<0)m0+=1;
  var transit=m0;
  for(var i=0;i<4;i++){var th=th0+360.985647*transit,H=n180(th-Lw-raAt(transit));transit-=H/360}
  function at(alt,after){
    var dec=s2.dec,c=(sin(alt)-sin(lat)*sin(dec))/(cos(lat)*cos(dec));
    if(c>1||c<-1)return NaN;
    var m=transit+(after?1:-1)*acos(c)/360;
    for(var i=0;i<5;i++){
      var th=th0+360.985647*m,dc=decAt(m),H=n180(th-Lw-raAt(m));
      var h=asin(sin(lat)*sin(dc)+cos(lat)*cos(dc)*cos(H));
      var den=360*cos(dc)*cos(lat)*sin(H);if(!den)break;
      m+=(h-alt)/den;
    }
    return m;
  }
  function asrAlt(f){var dc=s2.dec;return atan2(1,f+tan(Math.abs(lat-dc)))}
  return {transit:transit,at:at,asrAlt:asrAlt,dec:s2.dec};
}
var H0=-0.8333;

/* ---------- طرق الحساب ---------- */
var METHODS={
  ummalqura:{n:'أم القرى (المملكة العربية السعودية)',f:18.5,imin:90,imRam:120,adj:{}},
  egypt:{n:'الهيئة المصرية العامة للمساحة',f:19.5,i:17.5,adj:{dhuhr:1}},
  mwl:{n:'رابطة العالم الإسلامي',f:18,i:17,adj:{dhuhr:1}},
  karachi:{n:'جامعة العلوم الإسلامية — كراتشي',f:18,i:18,adj:{dhuhr:1}},
  isna:{n:'الجمعية الإسلامية لأمريكا الشمالية',f:15,i:15,adj:{dhuhr:1}},
  kuwait:{n:'وزارة الأوقاف — الكويت',f:18,i:17.5,adj:{}},
  qatar:{n:'وزارة الأوقاف — قطر',f:18,imin:90,adj:{}},
  uae:{n:'الهيئة العامة للشؤون الإسلامية — الإمارات',f:18.2,i:18.2,adj:{sunrise:-3,dhuhr:3,asr:3,maghrib:3}},
  singapore:{n:'مجلس العلماء — سنغافورة/جنوب شرق آسيا',f:20,i:18,adj:{dhuhr:1}},
  turkey:{n:'رئاسة الشؤون الدينية — تركيا',f:18,i:17,adj:{sunrise:-7,dhuhr:5,asr:4,maghrib:7}},
  tehran:{n:'معهد الجيوفيزياء — جامعة طهران',f:17.7,i:14,mang:4.5,adj:{}},
  morocco:{n:'وزارة الأوقاف — المغرب',f:19,i:17,adj:{sunrise:-3,dhuhr:5,maghrib:5}},
  algeria:{n:'وزارة الشؤون الدينية — الجزائر',f:18,i:17,adj:{dhuhr:1}},
  tunisia:{n:'وزارة الشؤون الدينية — تونس',f:18,i:18,adj:{dhuhr:1}},
  jordan:{n:'وزارة الأوقاف — الأردن',f:18,i:18,adj:{sunrise:-2,dhuhr:5,maghrib:5}}
};
/* رمز البلد → الطريقة (الباقي: رابطة العالم الإسلامي، وأمريكا الشمالية: ISNA) */
var CC={SA:'ummalqura',BH:'ummalqura',YE:'ummalqura',EG:'egypt',LY:'egypt',SD:'egypt',SS:'egypt',SY:'egypt',LB:'egypt',IQ:'egypt',PS:'egypt',
  PK:'karachi',IN:'karachi',BD:'karachi',AF:'karachi',LK:'karachi',NP:'karachi',US:'isna',CA:'isna',MX:'isna',
  KW:'kuwait',QA:'qatar',AE:'uae',SG:'singapore',MY:'singapore',BN:'singapore',ID:'singapore',TR:'turkey',IR:'tehran',
  MA:'morocco',DZ:'algeria',TN:'tunisia',JO:'jordan'};
/* العصر بظل المثل الواحد (الجمهور) إلا في جنوب ووسط آسيا فبظل المثلين (الحنفية) */
var HANAFI={PK:1,IN:1,BD:1,AF:1,UZ:1,TJ:1,KG:1,TM:1,KZ:1};
/* نقاط تقريبية لاختيار البلد عند انعدام الاتصال */
var CENT=[['SA',24.0,45.0],['AE',24.3,54.4],['QA',25.3,51.2],['KW',29.3,47.6],['BH',26.1,50.5],['OM',21.0,57.0],['YE',15.6,47.6],['EG',26.8,30.0],['LY',27.0,17.5],['SD',15.5,30.0],['TN',34.0,9.5],['DZ',28.0,2.5],['MA',31.8,-6.5],['MR',20.2,-10.5],
 ['JO',31.2,36.5],['PS',31.9,35.2],['LB',33.9,35.9],['SY',35.0,38.5],['IQ',33.2,43.7],['IR',32.4,53.7],['TR',39.0,35.2],['PK',30.4,69.3],['IN',22.0,79.0],['BD',23.7,90.3],['AF',33.9,67.7],['ID',-2.5,118.0],['MY',4.2,102.0],['SG',1.35,103.8],
 ['US',39.0,-98.0],['CA',56.0,-96.0],['GB',54.0,-2.5],['FR',46.5,2.5],['DE',51.0,10.4],['NG',9.1,8.7],['SO',5.1,46.2],['ET',9.1,40.5],['KE',0.0,38.0],['UZ',41.4,64.6],['KZ',48.0,67.0],['RU',60.0,90.0],['CN',35.0,103.0],['AU',-25.0,134.0],['ZA',-29.0,24.0],['BR',-10.0,-52.0],['SN',14.5,-14.5],['ML',17.5,-4.0]];
function nearestCC(lat,lng){var b=null,bd=1e9;CENT.forEach(function(c){var dx=(c[2]-lng)*cos((c[1]+lat)/2),dy=c[1]-lat,dd=dx*dx+dy*dy;if(dd<bd){bd=dd;b=c[0]}});return b}

function pick(lat,lng,cc){
  var guessed=false;
  if(!cc||!/^[A-Za-z]{2}$/.test(cc)){cc=nearestCC(lat,lng);guessed=true}
  cc=String(cc).toUpperCase();
  var id=CC[cc];
  if(!id)id=(cc==='GB'||cc==='IE')?'mwl':'mwl';
  var m=METHODS[id];
  return {id:id,cc:cc,name:m.n,guessed:guessed,hanafi:!!HANAFI[cc]};
}

/* ---------- الحساب الرئيسي ليوم محلي ---------- */
function ymd(d){return [d.getFullYear(),d.getMonth()+1,d.getDate()]}
function isRamadan(date){
  try{var f=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{month:'numeric',timeZone:undefined});var p=f.formatToParts(date).filter(function(x){return x.type==='month'})[0];return p&&+p.value===9}catch(e){return false}
}
/* opts: {lat,lng,cc,methodId?,hanafi?,adjust:{fajr:0,...}}   date: كائن Date يمثل اليوم المحلي المطلوب */
function times(date,opts){
  var lat=+opts.lat,lng=+opts.lng;
  var pk=opts.methodId?{id:opts.methodId,cc:opts.cc||'',hanafi:!!opts.hanafi}:pick(lat,lng,opts.cc);
  var M=METHODS[pk.id]||METHODS.mwl,hanafi=opts.hanafi!==undefined?!!opts.hanafi:pk.hanafi;
  var y=date.getFullYear(),mo=date.getMonth()+1,d=date.getDate();
  var wantKey=y*10000+mo*100+d;
  /* ابحث عن يوم UT الذي يقع ظهره في اليوم المحلي المطلوب */
  var base=Date.UTC(y,mo-1,d),ut=0,dayObj,tr;
  for(var k=0;k<3;k++){
    var u=new Date(base+ut*86400000);dayObj=Day(lat,lng,u.getUTCFullYear(),u.getUTCMonth()+1,u.getUTCDate());
    tr=Date.UTC(u.getUTCFullYear(),u.getUTCMonth(),u.getUTCDate())+dayObj.transit*86400000;
    var t=new Date(tr),key=t.getFullYear()*10000+(t.getMonth()+1)*100+t.getDate();
    if(key===wantKey)break;ut+=key<wantKey?1:-1;
  }
  var uBase=Date.UTC(new Date(base+ut*86400000).getUTCFullYear(),new Date(base+ut*86400000).getUTCMonth(),new Date(base+ut*86400000).getUTCDate());
  var uDate=new Date(uBase);
  var lat2=lat,polar=false;
  function ev(day,alt,after,la){return day.at(alt,after)}
  var ay=uDate.getUTCFullYear(),am=uDate.getUTCMonth()+1,ad=uDate.getUTCDate();
  var next=new Date(uBase+86400000);
  var dN=Day(lat,lng,next.getUTCFullYear(),next.getUTCMonth()+1,next.getUTCDate());
  var sunrise=dayObj.at(H0,false),sunset=dayObj.at(H0,true),sunriseN=dN.at(H0,false);
  /* خطوط العرض القصوى: إن غابت الشمس/لم تشرق نحسب بأقرب عرض 48.5° (طريقة أقرب خط عرض) */
  var useLat=lat;
  if(isNaN(sunrise)||isNaN(sunset)||isNaN(sunriseN)){
    useLat=lat>0?48.5:-48.5;polar=true;
    var d2=Day(useLat,lng,ay,am,ad),dN2=Day(useLat,lng,next.getUTCFullYear(),next.getUTCMonth()+1,next.getUTCDate());
    dayObj=d2;sunrise=d2.at(H0,false);sunset=d2.at(H0,true);sunriseN=dN2.at(H0,false);
  }
  var dh=dayObj.transit;
  var asr=dayObj.at(dayObj.asrAlt(hanafi?2:1),true);
  var fajr=dayObj.at(-M.f,false);
  var maghrib=M.mang?dayObj.at(-M.mang,true):sunset;
  var isha;
  if(M.imin){isha=maghrib+((M.imRam&&isRamadan(date))?M.imRam:M.imin)/1440}else isha=dayObj.at(-M.i,true);
  /* خطوط العرض العالية (>48.5°): ثُبّتت الحدود بسُبع الليل حتى لا يخرج الفجر/العشاء عن المعقول */
  var night=(sunriseN+1)-sunset;
  if(Math.abs(lat)>48.5||polar||isNaN(fajr)||isNaN(isha)){
    var seventh=night/7,sf=sunrise-seventh,si=sunset+seventh;
    if(isNaN(fajr)||fajr<sf)fajr=sf;
    if(!M.imin&&(isNaN(isha)||isha>si))isha=si;
    if(M.imin&&isha>si)isha=si;
  }
  var adj=M.adj||{},u=opts.adjust||{};
  function ms(m,a1,a2){return uBase+Math.round((m*1440+(a1||0)+(a2||0))*1)*60000-0}
  /* نحتفظ بالثواني ثم نقرّب لأقرب دقيقة */
  function rd(m,a1,a2){var t=uBase+m*86400000+((a1||0)+(a2||0))*60000;return Math.round(t/60000)*60000}
  var mid=sunset+night/2,third=sunset+night*2/3;
  var out={
    fajr:rd(fajr,adj.fajr,u.fajr),sunrise:rd(sunrise,adj.sunrise,u.sunrise),dhuhr:rd(dh,adj.dhuhr,u.dhuhr),asr:rd(asr,adj.asr,u.asr),
    maghrib:rd(maghrib,adj.maghrib,u.maghrib),isha:rd(isha,adj.isha,u.isha),midnight:rd(mid,0,0),lastthird:rd(third,0,0)
  };
  /* ترتيب منطقي: العشاء بعد المغرب دائمًا */
  if(out.isha<=out.maghrib)out.isha=out.maghrib+60000*(M.imin||30);
  out.method=pk.id;out.cc=pk.cc;out.hanafi=hanafi;out.polar=polar||Math.abs(lat)>48.5;
  return out;
}

/* اتجاه القبلة (درجات من الشمال الحقيقي) والمسافة إلى الكعبة بالكم */
function qibla(lat,lng){
  var kl=21.422487,kg=39.826206,dl=kg-lng;
  var b=n360(atan2(sin(dl)*cos(kl),cos(lat)*sin(kl)-sin(lat)*cos(kl)*cos(dl)));
  var a=sin((kl-lat)/2)*sin((kl-lat)/2)+cos(lat)*cos(kl)*sin(dl/2)*sin(dl/2);
  var dist=6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  return {deg:b,km:dist};
}

/* ---------- أحداث التذكير المطلقة ---------- */
var PN={fajr:'الفجر',sunrise:'الشروق',dhuhr:'الظهر',asr:'العصر',maghrib:'المغرب',isha:'العشاء'};
var ORDER=['fajr','sunrise','dhuhr','asr','maghrib','isha'];
function hm(ms){var d=new Date(ms);return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)}
function dkey(d){return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
/* وقت عمل مرتبط بالصلاة: a=[الصلاة, دقائق] و clamp اختياري */
function anchorMs(tt,a){
  if(!tt||!a||!tt[a[0]])return null;var t=tt[a[0]]+(a[1]||0)*60000;
  if(a[2]&&tt[a[2]])t=Math.min(t,tt[a[2]]-5*60000);
  return Math.round(t/60000)*60000;
}
/* cfg: {geo:{lat,lng,cc,methodId,hanafi}, pr:{on:{fajr:true,...},at:true,after:{on,min},before:{on,min},adjust:{}}, deeds:[{id,t,b,time,a,days,on,fixed}], master:true}
   يعيد قائمة أحداث مرتبة: {id,k,t,b,at,open} للأيام days القادمة بدءًا من اليوم الحالي */
function buildEvents(cfg,nowMs,days){
  var ev=[],now=new Date(nowMs),geo=cfg.geo,pr=cfg.pr||{};
  for(var i=0;i<(days||3);i++){
    var day=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i,12,0,0),k=dkey(day),tt=null;
    if(geo&&isFinite(geo.lat)&&isFinite(geo.lng)){
      try{tt=times(day,{lat:geo.lat,lng:geo.lng,cc:geo.cc,methodId:geo.methodId,hanafi:geo.hanafi,adjust:pr.adjust})}catch(e){tt=null}
    }
    var dow=day.getDay();
    if(tt&&pr.master!==false){
      ORDER.forEach(function(p){
        var on=pr.on?pr.on[p]:(p!=='sunrise');if(on===undefined)on=(p!=='sunrise');if(!on)return;
        var nm=PN[p],fri=(p==='dhuhr'&&dow===5);
        if(pr.before&&pr.before.on&&pr.before.min>0&&p!=='sunrise')ev.push({id:'b:'+p+':'+k,k:'before',t:'اقترب وقت صلاة '+(fri?'الجمعة':nm),b:'بعد '+pr.before.min+' دقيقة — '+hm(tt[p]),at:tt[p]-pr.before.min*60000,open:'prayer'});
        if(pr.at!==false)ev.push({id:'p:'+p+':'+k,k:'prayer',t:p==='sunrise'?'الشروق — انتهى وقت صلاة الفجر':'حان الآن وقت صلاة '+(fri?'الجمعة':nm),b:hm(tt[p])+(geo.place?' — '+geo.place:''),at:tt[p],open:'prayer'});
        if(pr.after&&pr.after.on&&pr.after.min>0&&p!=='sunrise')ev.push({id:'a:'+p+':'+k,k:'after',t:'بعد صلاة '+(fri?'الجمعة':nm),b:'مرّت '+pr.after.min+' دقيقة — لا تنسَ أذكار ما بعد الصلاة',at:tt[p]+pr.after.min*60000,open:'adhkar'});
      });
    }
    if(cfg.master!==false)(cfg.deeds||[]).forEach(function(d){
      if(!d.on)return;if(d.days&&d.days.indexOf(dow)<0)return;
      var at=null;
      if(!d.fixed&&d.a&&tt)at=anchorMs(tt,d.a);
      if(at==null){var h=(d.time||'').split(':');if(h.length!==2)return;at=new Date(day.getFullYear(),day.getMonth(),day.getDate(),+h[0],+h[1],0).getTime()}
      /* لا نتجاوز منتصف الليل: يبقى العمل في يومه */
      var endDay=new Date(day.getFullYear(),day.getMonth(),day.getDate()+1).getTime();if(at>=endDay)at=endDay-10*60000;
      ev.push({id:'d:'+d.id+':'+k,k:'deed',did:d.id,t:'حان وقت: '+d.t,b:d.b||'',at:at,open:'daily'});
    });
  }
  ev.sort(function(a,b){return a.at-b.at});
  return ev;
}

var API={times:times,pick:pick,qibla:qibla,buildEvents:buildEvents,anchorMs:anchorMs,METHODS:METHODS,PN:PN,ORDER:ORDER,hm:hm,dkey:dkey,solarDay:Day,julian:julian,nearestCC:nearestCC,CC:CC,version:'1.0'};
root.PrayerEngine=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof self!=='undefined'?self:this);
