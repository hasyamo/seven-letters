"""
作業用: 指定週の記事のコメントを取得してサンプルJSONに追加する
Usage: python scripts/fetch_comments.py [YYYY-MM-DD]
"""

import json
import sys
import time
from datetime import datetime, timezone, timedelta
from urllib.request import Request, urlopen
from urllib.error import HTTPError

JST = timezone(timedelta(hours=9))
CREATOR = "hasyamo"
DATA_DIR = "data/hasyamo/letters"
ARTICLES_CSV = f"../note-data-collector/data/{CREATOR}/articles.csv"

SLEEP = 0.5


def fetch_json(url):
    req = Request(url)
    req.add_header("Accept", "application/json")
    req.add_header("User-Agent", "Mozilla/5.0")
    req.add_header("Referer", "https://note.com/")
    with urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode("utf-8"))


def parse_comment_body(comment_obj):
    """構造化コメントからプレーンテキストを抽出"""
    if isinstance(comment_obj, str):
        return comment_obj
    texts = []
    def walk(node):
        if isinstance(node, dict):
            if node.get("type") == "text":
                texts.append(node.get("value", ""))
            for child in node.get("children", []):
                walk(child)
        elif isinstance(node, list):
            for item in node:
                walk(item)
    walk(comment_obj)
    return "".join(texts)


def week_start_end(target_date):
    d = target_date
    if d.hour < 5:
        d -= timedelta(days=1)
    d = d.date() if isinstance(d, datetime) else d
    weekday = d.weekday()
    monday = d - timedelta(days=weekday)
    sunday = monday + timedelta(days=6)
    start = datetime(monday.year, monday.month, monday.day, 5, 0, 0, tzinfo=JST)
    end = datetime(sunday.year, sunday.month, sunday.day, 5, 0, 0, tzinfo=JST) + timedelta(days=1) - timedelta(seconds=1)
    return monday, sunday, start, end


def load_week_articles(start, end):
    """articles.csvから対象週の記事を取得"""
    import csv
    articles = []
    with open(ARTICLES_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            pub = row["published_at"].strip()
            if "." in pub:
                pub = pub[:pub.index(".")] + pub[pub.index("+"):]
            pub_dt = datetime.fromisoformat(pub).astimezone(JST)
            if start <= pub_dt <= end and int(row["comment_count"]) > 0:
                articles.append({
                    "key": row["key"],
                    "title": row["title"],
                    "comment_count": int(row["comment_count"]),
                    "published_at": row["published_at"],
                })
    return articles


def fetch_comments(note_key):
    """記事のコメントを全ページ取得（自分のコメントは除外）"""
    comments = []
    page = 1
    while True:
        url = f"https://note.com/api/v3/notes/{note_key}/note_comments?per_page=10&page={page}"
        print(f"    Fetching page {page}...")
        resp = fetch_json(url)
        for c in resp.get("data", []):
            user = c.get("user", {})
            if user.get("urlname") == CREATOR:
                continue  # 自分のコメントは除外
            comments.append({
                "key": c.get("key", ""),
                "user_name": user.get("nickname", ""),
                "user_urlname": user.get("urlname", ""),
                "user_icon": user.get("profile_image_url", ""),
                "body": parse_comment_body(c.get("comment", "")),
                "created_at": c.get("created_at", ""),
                "article_title": None,  # 後で設定
                "note_key": note_key,
            })
        if resp.get("next_page") is None:
            break
        page += 1
        time.sleep(SLEEP)
    return comments


def main():
    if len(sys.argv) > 1:
        target = datetime.strptime(sys.argv[1], "%Y-%m-%d").replace(tzinfo=JST)
    else:
        now = datetime.now(JST)
        target = now - timedelta(days=now.weekday() + 7)  # 先週の月曜

    monday, sunday, start, end = week_start_end(target)
    print(f"Week: {monday} ~ {sunday}")

    articles = load_week_articles(start, end)
    print(f"Articles with comments: {len(articles)}")

    all_comments = []
    for art in articles:
        print(f"  {art['title']} ({art['comment_count']} comments)")
        comments = fetch_comments(art["key"])
        for c in comments:
            c["article_title"] = art["title"]
        all_comments.extend(comments)
        time.sleep(SLEEP)

    print(f"\nTotal comments (excl. self): {len(all_comments)}")

    # JSONに出力
    out_path = "scripts/comments_sample.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_comments, f, ensure_ascii=False, indent=2)
    print(f"Saved to {out_path}")


if __name__ == "__main__":
    main()
