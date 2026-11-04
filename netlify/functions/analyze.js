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
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { headers: CORS, statusCode: 204, body: "" };
  if (event.httpMethod !== "POST") return { headers: CORS, statusCode: 405, body: "POST only" };
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return { headers: CORS, statusCode: 400, body: JSON.stringify({ error: "bad_json" }) }; }
  const { filename, mime, base64, hint } = body;
  if (!base64 || !mime) return { headers: CORS, statusCode: 400, body: JSON.stringify({ error: "missing_file" }) };
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { headers: CORS, statusCode: 500, body: JSON.stringify({ error: "no_key", msg: "GEMINI_API_KEY غير مضبوط في إعدادات الموقع" }) };
  const prompt =
    `أنت مساعد دقيق لاستخراج البيانات من المستندات. المستند المرفق هو ملف مرشح للمنح الدراسية${hint ? " (النوع المعلن: " + hint + ")" : ""}.` +
    ` حلله واستخرج ما هو مكتوب فيه فعلاً فقط. أعِد JSON فقط بدون أي نص آخر بالشكل: ` +
    `{"doc_type":"نوع المستند بالعربية","summary":"وصف عربي من سطر إلى سطرين","fields":{"full_name":null,"birth_date":null,"nationality":null,"passport_number":null,"level":null,"institution":null,"field":null,"gpa":null,"graduation_year":null,"languages":null,"extra":{}}}` +
    ` حيث قيمة أي حقل غير موجود في المستند null، وextra كائن لأي معلومات إضافية مفيدة. المستند:`;
  const contents = [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }] }];
  const { txt, lastErr } = await askGemini(key, modelChain(), contents);
  if (!txt) return { headers: CORS, statusCode: 502, body: JSON.stringify({ error: "ai_unavailable", msg: "خدمة الذكاء الاصطناعي مشغولة حالياً، أعد المحاولة بعد دقيقة", detail: lastErr }) };
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return { headers: CORS, statusCode: 502, body: JSON.stringify({ error: "no_json", raw: txt.slice(0, 300) }) };
  return { headers: CORS, statusCode: 200, body: m[0] };
}
