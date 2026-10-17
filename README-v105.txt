AL-MUSLIM v105 — هيكل المشروع (مسطّح، بلا مجلدات)
index.html  الواجهة والأقسام      | style.css  تنسيقات الإضافات (أيقونات SVG، صفحة التثبيت، Cairo، التركيز)
script.js   منطق الإضافات: تسجيل sw.js، التثبيت والمشاركة وQR، الأيقونات، المساعد، حجم الخط، تشخيص الأعطال
manifest.json  standalone + display_override [standalone, fullscreen] + icon.png (192/512)
sw.js       عمل بلا إنترنت (service-worker.js مجرد تحويل إليه للأجهزة القديمة)
icon.png  qr.png  splash-*.png (صور بدء التشغيل للآيفون)  diag.html (فحص الاتصال والصوت)

الحماية: CSP في index.html (يمنع سكربتات من مصادر غير مصرّح بها، والإضافات القديمة object، وتغيير base/form)، لا eval،
تعقيم المدخلات بـ esc()، rel="noopener noreferrer" لكل رابط خارجي.
ملاحظة: لم أشفّر localStorage عمدًا — مفتاح التشفير سيبقى في نفس الصفحة فلا يضيف حماية فعلية.

ما يلزمك: ضع صورة QR الخاصة بك باسم qr.png (الحالي يفتح https://2009malek11-source.github.io/Muslim/).
supabase-config.js قالب فارغ — لا تستبدل به ملفك الحقيقي إن كان موقعك يعمل بمفاتيحه.
muslim-assistant.ts دالة Supabase اختيارية للمساعد (انشرها كـ Edge Function باسم muslim-assistant).
