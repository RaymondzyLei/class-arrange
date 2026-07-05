# -*- coding: utf-8 -*-
"""把 icourse_spider/course_rating.json 转换为前端可用的 TS 数据文件。

匹配 key（沿用 icourse_spider/lesson_match.py 的算法）:
    key = courseName + '#' + ','.join(sorted(teachers))
本地 CourseSection.teacher 是单字符串，多老师用 ,，、/ 分隔。
匹配在 section（课堂号）维度进行 —— 同时间不同老师各有各评分。

用法:
    uv run python scripts/ratings_to_ts.py
输出:
    src/data/icourseRatings.ts  Record<课堂号, { score, icourseId, url }>
"""
from __future__ import annotations

import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COURSE_TS = os.path.join(ROOT, "src", "data", "courses.ts")
RATING_JSON = os.path.join(ROOT, "icourse_spider", "course_rating.json")
OUT_TS = os.path.join(ROOT, "src", "data", "icourseRatings.ts")

# 沿用 lesson_match.py 的逻辑：评分数据有误/重复的课程 icourse-id
TO_ABANDON_ICOURSE_IDS = {"955"}  # 力学 (刘斌) 重复课程

# 评分以 "暂无评分" 标记的会被原爬虫保留在 JSON 里；lesson_match.py 直接跳过
NO_SCORE_SENTINEL = "暂无评分"

# 本地 teacher 字段多老师分隔符（与 CourseSection.teacher 实际数据一致）
TEACHER_SEP_RE = re.compile(r"[,，、/]")
FETCH_COUNTS = os.environ.get("ICOURSE_FETCH_COUNTS") == "1"
COUNT_RE = re.compile(r'<meta\s+name="description"[^>]*content="[^"]*?[0-9.]+[^0-9]+([0-9]+)')


def split_teachers(raw: str) -> list[str]:
    """拆分 section.teacher 字段为有序、不重的老师列表。"""
    if not raw:
        return []
    parts = [p.strip() for p in TEACHER_SEP_RE.split(raw)]
    out: list[str] = []
    seen = set()
    for p in parts:
        if p and p not in seen:
            seen.add(p)
            out.append(p)
    return out


def load_courses_ts(path: str) -> list[dict]:
    """从 src/data/courses.ts 中正则提取 JSON 数组（与 excel_to_ts.py 同款思路）。"""
    with open(path, encoding="utf-8") as f:
        txt = f.read()
    m = re.search(r"export const courses[^=]*=\s*(\[.*?\]);\s*$", txt, re.S)
    if not m:
        raise RuntimeError(f"无法从 {path} 解析 courses 数组")
    return json.loads(m.group(1))


def load_icourse_ratings(path: str) -> dict[str, dict[str, str]]:
    """读 icourse_spider/course_rating.json，返回 (name + '#' + sorted(teachers)) -> rating info。"""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    mapping: dict[str, dict[str, str]] = {}
    for c in data:
        score = c.get("score", "")
        if score == NO_SCORE_SENTINEL:
            continue
        icourse_id = str(c.get("icourse-id", ""))
        if icourse_id in TO_ABANDON_ICOURSE_IDS:
            continue
        teachers = c.get("teachers", [])
        key = c["name"] + "#" + ",".join(sorted(teachers))
        mapping[key] = {
            "score": score,
            "icourseId": icourse_id,
            "url": f"https://www.icourse.club/course/{icourse_id}/",
        }  # 后写覆盖，重复 key 时取最后一个
        count = c.get("ratingCount") or c.get("rating_count") or c.get("count")
        if isinstance(count, int):
            mapping[key]["ratingCount"] = count
    return mapping


def fetch_rating_count(icourse_id: str) -> int | None:
    url = f"https://www.icourse.club/course/{icourse_id}/"
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urlopen(request, timeout=5) as response:
            html = response.read().decode("utf-8", errors="ignore")
    except Exception:
        return None
    m = COUNT_RE.search(html)
    if not m:
        return None
    return int(m.group(1))


def fill_rating_counts(result: dict[str, dict[str, str]]) -> None:
    ids = sorted({
        str(rating["icourseId"])
        for rating in result.values()
        if rating.get("icourseId") and "ratingCount" not in rating
    })
    if not ids:
        return
    counts: dict[str, int] = {}
    with ThreadPoolExecutor(max_workers=24) as pool:
        futures = {pool.submit(fetch_rating_count, icourse_id): icourse_id for icourse_id in ids}
        for done, future in enumerate(as_completed(futures), start=1):
            icourse_id = futures[future]
            count = future.result()
            if count is not None:
                counts[icourse_id] = count
            if done % 100 == 0:
                print(f"已读取评分人数: {done}/{len(ids)}", file=sys.stderr)
    for rating in result.values():
        count = counts.get(str(rating.get("icourseId", "")))
        if count is not None:
            rating["ratingCount"] = count


def match_sections(sections: list[dict], ic_map: dict[str, dict[str, str]]) -> dict[str, dict[str, str]]:
    """对每个 section 用 (courseName + '#' + sorted(teachers)) 查 ic_map。"""
    result: dict[str, dict[str, str]] = {}
    for sec in sections:
        teachers = sorted(split_teachers(sec["teacher"]))
        key = sec["courseName"] + "#" + ",".join(teachers)
        rating = ic_map.get(key)
        if rating is not None:
            result[sec["id"]] = dict(rating)
    if FETCH_COUNTS:
        fill_rating_counts(result)
    return result


def main():
    if not os.path.exists(RATING_JSON):
        print(f"错误: 找不到 {RATING_JSON}，请先跑 icourse_spider/spider.py", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(COURSE_TS):
        print(f"错误: 找不到 {COURSE_TS}", file=sys.stderr)
        sys.exit(1)

    sections = load_courses_ts(COURSE_TS)
    ic_map = load_icourse_ratings(RATING_JSON)
    matched = match_sections(sections, ic_map)

    # 写 TS：用 Record 字面量保持顺序、按 section.id 排序以便人眼对比
    sorted_items = sorted(matched.items())
    os.makedirs(os.path.dirname(OUT_TS), exist_ok=True)
    with open(OUT_TS, "w", encoding="utf-8") as f:
        f.write("// AUTO-GENERATED by scripts/ratings_to_ts.py — do not edit by hand.\n")
        f.write("// 数据源: icourse_spider/course_rating.json（爬自 https://icourse.club/ ）\n")
        f.write("// 匹配维度: section（课堂号），key = courseName + '#' + sorted(teachers)\n")
        f.write("export interface IcourseRatingRecord { score: string; icourseId: string; url: string; ratingCount?: number }\n")
        f.write("export const icourseRatings: Record<string, IcourseRatingRecord> = ")
        f.write(json.dumps(dict(sorted_items), ensure_ascii=False, indent=2))
        f.write(";\n")

    print(f"读取: {COURSE_TS} ({len(sections)} sections)")
    print(f"读取: {RATING_JSON} ({len(ic_map)} scored entries)")
    print(f"命中: {len(matched)} / {len(sections)} = {len(matched)/len(sections)*100:.1f}%")
    print(f"输出: {OUT_TS}")


if __name__ == "__main__":
    main()
