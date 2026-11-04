# منصة منح موسكو (Scholarships Moscow)

منصة شخصية للبحث عن المنح الدراسية في موسكو وروسيا، مطابقتها مع قاعدة بيانات صاحبها، تتبع التسجيل فيها، وإصدار تقارير.

## المكونات
- `scraper/scraper.py`: باحث يومي يفحص المصادر (Open Doors، بورتال المنحة الحكومية education-in-russia.com) ويحدث البيانات.
- `.github/workflows/update.yml`: تشغيل تلقائي يومياً الساعة 9:00 بتوقيت موسكو (GitHub Actions مجاني).
- `docs/index.html`: لوحة التحكم (تُنشر على GitHub Pages مجاناً). بيانات المستخدم تُخزن في متصفحه فقط.
- `data/scholarships.json`: قاعدة المنح (أصلية + مُحدَّثة يومياً).

## التشغيل اليدوي
python3 scraper/scraper.py
