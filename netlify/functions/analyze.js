export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "POST only" };
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, body: JSON.stringify({ error: "bad_json" }) }; }
  const { filename, mime, base64, hint } = body;
  if (!base64 || !mime) return { statusCode: 400, body: JSON.stringify({ error: "missing_file" }) };
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { statusCode: 500, body: JSON.stringify({ error: "no_key", msg: "GEMINI_API_KEY غير مضبوط في إعدادات الموقع" }) };
  const prompt =
    `أنت مساعد دقيق لاستخراج البيانات من المستندات. المستند المرفق هو ملف مرشح للمنح الدراسية${hint ? " (النوع المعلن: " + hint + ")" : ""}.` +
    ` حلله واستخرج ما هو مكتوب فيه فعلاً فقط. أعِد JSON فقط بدون أي نص آخر بالشكل: ` +
    `{"doc_type":"نوع المستند بالعربية","summary":"وصف عربي من سطر إلى سطرين","fields":{"full_name":null,"birth_date":null,"nationality":null,"passport_number":null,"level":null,"institution":null,"field":null,"gpa":null,"graduation_year":null,"languages":null,"extra":{}}}` +
    ` حيث قيمة أي حقل غير موجود في المستند null، وextra كائن لأي معلومات إضافية مفيدة. المستند:`;
  const model = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }] }] }),
    });
    const j = await r.json();
    const txt = j?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return { statusCode: 502, body: JSON.stringify({ error: "no_json", raw: txt.slice(0, 300) }) };
    return { statusCode: 200, body: m[0] };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: "upstream", msg: String(e).slice(0, 200) }) };
  }
}
