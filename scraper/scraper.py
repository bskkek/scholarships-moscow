#!/usr/bin/env python3
"""Scholarships Moscow - daily scraper. Merges live sources with the seed catalog."""
import json, re, sys, urllib.request, html as h
from datetime import date, datetime, timezone

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}
TODAY = date.today().isoformat()

def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")

def clean(s):
    return h.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()

def source_opendoors():
    """Latest headlines from od.globaluni.ru (plain <h1> news blocks)."""
    t = fetch("https://od.globaluni.ru/")
    items = []
    for m in re.finditer(r"<h1[^>]*>(.*?)</h1>", t, re.S):
        txt = clean(m.group(1))
        if len(txt) < 20 or "cookies" in txt.lower():
            continue
        items.append({"id": "od-" + re.sub(r"\W+", "-", txt)[:48],
                      "kind": "news",
                      "title": "Open Doors: " + txt,
                      "org": "Open Doors", "url": "https://od.globaluni.ru/",
                      "city": "روسيا", "levels": ["ماجستير", "دكتوراه", "ما بعد الدكتوراه"],
                      "fields": ["جميع التخصصات"], "funding": "",
                      "deadline": None, "status": "info",
                      "source": "od.globaluni.ru", "found_at": TODAY})
    return items

def source_education_ru():
    """Homepage news blurbs from education-in-russia.com (gov quota portal)."""
    t = fetch("https://education-in-russia.com/")
    items = []
    for m in re.finditer(r"<h[23][^>]*>\s*<a[^>]*href=\"([^\"]+)\"[^>]*>(.*?)</a>", t, re.S):
        url, txt = m.group(1), clean(m.group(2))
        if len(txt) > 20 and ("news" in url or "kvota" in url or "grant" in url):
            items.append({"id": "eir-" + re.sub(r"\W+", "-", url[-60:])[:50],
                          "kind": "news",
                          "title": "بورتال المنحة الحكومية: " + txt,
                          "org": "Education in Russia", "url": url,
                          "city": "روسيا", "levels": ["بكالوريوس", "ماجستير", "دكتوراه"],
                          "fields": ["جميع التخصصات"], "funding": "",
                          "deadline": None, "status": "info",
                          "source": "education-in-russia.com", "found_at": TODAY})
    return items

SOURCES = {"od.globaluni.ru": source_opendoors, "education-in-russia.com": source_education_ru}

def main():
    seed_path = "data/scholarships.json"
    data = json.load(open(seed_path, encoding="utf-8"))
    status = {}
    live = []
    for name, fn in SOURCES.items():
        try:
            got = fn()
            status[name] = {"ok": True, "count": len(got), "at": TODAY}
            live += got
        except Exception as e:
            status[name] = {"ok": False, "error": str(e)[:120], "at": TODAY}
    # merge: seed items always kept; live items dedup by id, cap at 40 newest
    merged = {i["id"]: i for i in live}
    merged.update({i["id"]: i for i in data["items"] if not i["id"].startswith(("od-", "eir-"))})  # seed wins; drop stale news
    items = list(merged.values())[:60]
    data["items"] = items
    data["sources_status"] = status
    data["updated_at"] = datetime.now(timezone.utc).astimezone(timezone.utc).isoformat()
    for p in ("data/scholarships.json", "docs/data/scholarships.json"):
        json.dump(data, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    ok = sum(1 for s in status.values() if s["ok"])
    print(f"done: {len(items)} items, {ok}/{len(status)} sources ok")

if __name__ == "__main__":
    main()
