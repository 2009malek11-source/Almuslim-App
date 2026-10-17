// Supabase Edge Function: مساعد المسلم (فهم حقيقي للسؤال بنموذج ذكاء اصطناعي)
// النشر:  supabase functions deploy muslim-assistant
// المفتاح: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   (لا تضعه أبدًا داخل index.html)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { question, sections = [], reciters = [] } = await req.json();
    const q = String(question || "").slice(0, 500);
    if (!q) return json({ answer: "اكتب سؤالك." });

    const system = `أنت «مساعد المسلم» داخل تطبيق ويب إسلامي. افهم سؤال المستخدم كاملًا بكل تفاصيله (السورة، نطاق الآيات، القارئ، عدد المرات، القسم المطلوب) ثم أجب بالعربية بإيجاز.
أقسام التطبيق (id: الاسم): ${sections.map((s: any) => `${s.id}: ${s.name}`).join(" | ")}
القرّاء المتاحون: ${reciters.join("، ")}
قواعد صارمة:
- لا تجب عن الفقه أو الفتاوى أو الأحكام؛ اعتذر بلطف واطلب سؤال أهل العلم.
- أجب عن المحادثة العادية والأسئلة العامة بعقلانية وإيجاز (من أنت، كيف حالك، ماذا تفعل…). أنت مساعد آلي ولست إنسانًا.
- إن لم يكن المطلوب موجودًا في التطبيق فاعتذر صراحة، واذكر اسم المصدر الذي يوجد فيه بالتحديد، وأضف action من نوع url برابط حقيقي تعرفه فقط (مثل dorar.net للحديث، quran.com للمصحف، islamweb.net/ar/fatwa للفتاوى، aladhan.com لمواقيت الصلاة، tarteel.ai للتسميع). لا تخترع روابط.
- حاليًا الأقسام التالية مؤجَّلة وغير متاحة في التطبيق: المصحف المكتوب، الأحاديث، تسميع القرآن. قل ذلك صراحة إن سُئلت عنها.
- التكرار في التطبيق بلا نهاية حتى يضغط المستخدم إيقاف.
- لا تخترع قارئًا أو قسمًا غير موجود؛ إن لم يوجد قل ذلك صراحة.
- أخرج JSON فقط بلا أي نص آخر وبهذا الشكل:
{"answer":"نص قصير","actions":[{"type":"section","id":"<id>","label":"..."},{"type":"reciter","name":"<اسم من القائمة>","surah":<1-114 أو 0>,"label":"..."},{"type":"repeat","surah":<1-114>,"from":<رقم>,"to":<رقم>,"reciter":"<اسم أو فارغ>","label":"..."},{"type":"url","url":"https://...","label":"..."}]}
- actions اختيارية (حتى 3).`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-5-5",
        max_tokens: 600,
        system,
        messages: [{ role: "user", content: q }],
      }),
    });
    if (!r.ok) return json({ error: "upstream " + r.status }, 502);
    const data = await r.json();
    const text = (data.content || []).map((c: any) => c.text || "").join("").replace(/```json|```/g, "").trim();
    let out;
    try { out = JSON.parse(text); } catch { out = { answer: text.slice(0, 600) }; }
    return json(out);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
