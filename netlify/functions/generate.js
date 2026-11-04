export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "POST only" };
  let b;
  try { b = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, body: JSON.stringify({ error: "bad_json" }) }; }
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { statusCode: 500, body: JSON.stringify({ error: "no_key", msg: "GEMINI_API_KEY غير مضبوط في إعدادات الموقع" }) };
  const { type, scholarship, profile, docs } = b;
  if (!scholarship) return { statusCode: 400, body: JSON.stringify({ error: "missing_scholarship" }) };
  const P = JSON.stringify(profile || {}, null, 1);
  const S = JSON.stringify(scholarship, null, 1);
  const D = JSON.stringify(docs || [], null, 1);
  let task, fmt;
  if (type === "motivation") {
    task = "اكتب رسالة دافع (Motivation Letter) مخصصة لهذه المنحة تحديداً، بلغة احترافية مشوّقة، من 350 إلى 450 كلمة، تربط خلفية المرشح وتخصصه بأهداف المنحة والبرنامج، تذكر الدافع الحقيقي والأهداف المهنية، بلا مبالغة ولا قوالب عامة.";
    fmt = "نص عربي منسق بعناوين صغيرة اختيارية وفقرات، يبدأ بالتحية ويُختم بالشكر. لا تذكر أي بيانات غير موجودة في الملف، واترك بين معقوفين [] ما يحتاج المرشح إكماله.";
  } else {
    task = "اكتب سيرة ذاتية (CV) مخصصة لهذه المنحة تحديداً، منظم بأقسام: المعلومات الشخصية، الهدف المهني، التعليم، الخبرات والمشاريع، المهارات، اللغات، المستندات المرفقة. ركّز على ما يخدم هذه المنحة.";
    fmt = "نص منسق بعناوين واضحة وقوائم نقطية. لا تذكر أي بيانات غير موجودة في الملف، واترك بين معقوفين [] ما يحتاج المرشح إكماله.";
  }
  const prompt =
    `أنت كاتب ملفات تقديم للمنح الدراسية. بيانات المرشح:\n${P}\n\nالمستندات المتوفرة (ملخصات):\n${D}\n\nالمنحة:\n${S}\n\nالمطلوب: ${task}\nالتنسيق: ${fmt}`;
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const j = await r.json();
    const txt = j?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
    if (!txt) return { statusCode: 502, body: JSON.stringify({ error: "empty", raw: JSON.stringify(j).slice(0, 300) }) };
    return { statusCode: 200, body: JSON.stringify({ text: txt }) };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: "upstream", msg: String(e).slice(0, 200) }) };
  }
}
