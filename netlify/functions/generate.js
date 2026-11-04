const CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS"};
async function askGemini(key, models, contents) {
  let lastErr = "unknown";
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      });
      const j = await r.json();
      const txt = j?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
      if (txt) return { txt, model };
      lastErr = (j?.error?.status || j?.error?.message || ("HTTP " + r.status)) + " [" + model + "]";
    } catch (e) { lastErr = String(e).slice(0, 160) + " [" + model + "]"; }
  }
  return { txt: "", lastErr };
}
function modelChain() {
  const primary = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
  return primary === "gemini-3.5-flash" ? [primary] : [primary, "gemini-3.5-flash"];
}
const RULES = (langName) => `قواعد صارمة (تُطبَّق حرفياً):
1) النص كله باللغة ${langName} الأكاديمية الفصحى، من أول كلمة إلى آخرها؛ لا تكتب أي كلمة بالعربية في الناتج (باستثناء أسماء علم ضرورية مثل اسم المرشح أو جامعته إذا لزم).
2) ممنوع تماماً: الأقواس المعقوفة []، الفراغات «...»، خطوط التعبئة ___، عبارات «اكتب هنا/أدخل هنا/[الاسم]» أو أي عنصر ناقص. كل جملة مكتملة وجاهزة للتقديم كما هي بدون أي تعديل من المرشح.
3) ابنِ كل محتوى من بيانات المرشح ومستنداته المرفقة أدناه. إن نقصت معلومة فرعية فصُغ عبارة عامة صحيحة ومعقولة دون اختراع أرقام أو مؤهلات أو جوائز أو تواريخ غير موجودة.
4) البيانات الحرفية للمرشح (الاسم، تاريخ الميلاد، الجنسية، رقم الجواز، GPA، الجامعة، اللغات) تُذكر كما وردت حرفياً دون تغيير.
5) إن وُجدت روابط في profile.links (منشورات أو أعمال) فاذكرها في المكان المناسب بصيغتها الفعلية كاملة.
6) لا تضف أي ملاحظات أو تعليقات بالعربية قبل أو بعد النص؛ أخرج النص النهائي فقط.`;
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { headers: CORS, statusCode: 204, body: "" };
  if (event.httpMethod !== "POST") return { headers: CORS, statusCode: 405, body: "POST only" };
  let b;
  try { b = JSON.parse(event.body || "{}"); } catch { return { headers: CORS, statusCode: 400, body: JSON.stringify({ error: "bad_json" }) }; }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { headers: CORS, statusCode: 500, body: JSON.stringify({ error: "no_key", msg: "GEMINI_API_KEY غير مضبوط في إعدادات الموقع" }) };
  const { type, scholarship, profile, docs } = b;
  if (!scholarship) return { headers: CORS, statusCode: 400, body: JSON.stringify({ error: "missing_scholarship" }) };
  let lang = b.lang || "ru";
  if (!["ru", "en"].includes(lang)) {
    const blob = JSON.stringify(scholarship);
    lang = (blob.includes("روسيا") || blob.includes("Russia") || blob.includes("Moscow") || blob.includes("موسكو")) ? "ru" : "en";
  }
  const langName = lang === "en" ? "الإنجليزية" : "الروسية";
  const P = JSON.stringify(profile || {}, null, 1);
  const S = JSON.stringify(scholarship, null, 1);
  const D = JSON.stringify(docs || [], null, 1);
  let task;
  if (type === "motivation") {
    task = `اكتب رسالة دافع (Motivation Letter) مخصصة لهذه المنحة تحديداً، من 400 إلى 550 كلمة، تربط خلفية المرشح وتخصصه وأهدافه بأهداف هذه المنحة والبرنامج، بتدرج منطقي: مقدمة شخصية، الدافع الحقيقي لاختيار التخصص والمنحة، الأكاديمي والبحثي (اذكر المنشورات والروابط إن وُجدت)، الأهداف المهنية بعد التخرج، وخاتمة قوية. بلا مبالغة ولا قوالب عامة، وبنبرة أكاديمية رسمية تليق بالتقديم الجامعي.`;
  } else {
    task = `اكتب سيرة ذاتية (CV/Resume) مخصصة لهذه المنحة تحديداً، منظمة بالأقسام التالية: معلومات الاتصال (كاملة من بيانات المرشح)، الهدف المهني (2-3 جمل)، التعليم، الخبرات والمشاريع البحثية (بما يناسب المنحة)، المهارات التقنية، اللغات، المنشورات والروابط (من profile.links إن وُجدت)، المستندات المتوفرة. استخدم عناوين وقوائم نقطية واضحة.`;
  }
  const prompt =
    `أنت كاتب ملفات تقديم للمنح الدراسية بمستوى محترف. بيانات المرشح:\n${P}\n\nالمستندات المتوفرة (ملخصات مستخرجة):\n${D}\n\nالمنحة المستهدفة:\n${S}\n\nالمطلوب: ${task}\n\n${RULES(langName)}`;
  const contents = [{ parts: [{ text: prompt }] }];
  const { txt, lastErr } = await askGemini(key, modelChain(), contents);
  if (!txt) return { headers: CORS, statusCode: 502, body: JSON.stringify({ error: "ai_unavailable", msg: "خدمة الذكاء الاصطناعي مشغولة حالياً، أعد المحاولة بعد دقيقة", detail: lastErr }) };
  return { headers: CORS, statusCode: 200, body: JSON.stringify({ text: txt }) };
}
