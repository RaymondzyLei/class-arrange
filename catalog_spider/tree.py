"""解析 program_tree.json。

API 返回 dept → majors → programs 的三层嵌套，本模块扁平化为 list[dict]，
每个 program 附带 dept/major 上下文（方便筛选与展示）。
"""
import json
from pathlib import Path


def load_tree(path: str | Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_programs(tree_path: str | Path) -> list[dict]:
    """扁平化 program_tree.json → [{id, nameZh, nameEn, grade, trainType, department, major, ...}, ...]"""
    tree = load_tree(tree_path)
    out: list[dict] = []
    for _, dept in tree.items():
        for _, major in dept.get("majors", {}).items():
            for p in major.get("programs", []):
                out.append({
                    "id": int(p["id"]),
                    "nameZh": p.get("nameZh"),
                    "nameEn": p.get("nameEn"),
                    "grade": p.get("grade"),
                    "trainType": p.get("trainType"),
                    "department": dept.get("nameZh"),
                    "department_code": dept.get("code"),
                    "major": major.get("nameZh"),
                    "major_code": major.get("code"),
                })
    return out


def program_ids(programs: list[dict]) -> list[int]:
    """去重并按升序返回 program id 列表。"""
    seen: set[int] = set()
    out: list[int] = []
    for p in programs:
        pid = p["id"]
        if pid not in seen:
            seen.add(pid)
            out.append(pid)
    return sorted(out)


def filter_by_min_grade(programs: list[dict], min_grade: int) -> list[dict]:
    """仅保留 grade >= min_grade 的 program；grade 缺失或非数字的也丢弃。"""
    out: list[dict] = []
    for p in programs:
        g = p.get("grade")
        try:
            if g is not None and int(g) >= min_grade:
                out.append(p)
        except (TypeError, ValueError):
            continue
    return out