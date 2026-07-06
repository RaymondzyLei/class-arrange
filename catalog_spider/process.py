"""把 raw/programs/{id}.json 转成 index/programs.json。

提供两个函数：
  - count_modules_and_courses: 递归统计 program 的 module/course 数量
  - build_index_row: 单个 program 转成索引行
  - build_programs_index: 批量生成 programs.json
"""
import json
from pathlib import Path


def _walk(node: dict, modules: list, courses: int) -> int:
    """递归遍历 moduleTree 节点，累积 modules 列表与 courses 计数。"""
    self_ = node.get("self", {})
    modules.append(self_)
    courses += len(self_.get("courses", []))
    for child in node.get("children", []):
        courses = _walk(child, modules, courses)
    return courses


def count_modules_and_courses(raw: dict) -> tuple[int, int]:
    """返回 (module 总数, course 总数)。"""
    modules: list = []
    courses = 0
    for root in raw.get("moduleTree", []):
        courses = _walk(root, modules, courses)
    return len(modules), courses


def build_index_row(pid: int, raw: dict) -> dict:
    """单个 program → 索引行。"""
    m, c = count_modules_and_courses(raw)
    edu = raw.get("education") or {}
    stu = raw.get("studentType") or {}
    dept = raw.get("department") or {}
    major = raw.get("major") or {}
    return {
        "id": pid,
        "grade": raw.get("grade"),
        "trainType": raw.get("trainType"),
        "education": edu.get("nameZh"),
        "studentType": stu.get("nameZh"),
        "department": dept.get("nameZh"),
        "major": major.get("nameZh"),
        "majorDirection": raw.get("majorDirection"),
        "awardDegree": raw.get("awardDegree"),
        "beginSemester": raw.get("beginSemester"),
        "moduleCount": m,
        "courseCount": c,
    }


def build_programs_index(raw_dir: Path, out_path: Path) -> int:
    """遍历 raw_dir 下所有 {id}.json，生成 index/programs.json，返回行数。"""
    rows: list[dict] = []
    for f in sorted(raw_dir.glob("*.json")):
        # 只取 {id}.json，跳过 .failed.json
        if not f.stem.isdigit():
            continue
        pid = int(f.stem)
        raw = json.loads(f.read_text(encoding="utf-8"))
        rows.append(build_index_row(pid, raw))
    out_path.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return len(rows)


def _walk_with_path(node: dict, path: list[str], buckets: dict[str, list]) -> None:
    """递归遍历 moduleTree，沿途把 module.type 累加到 modulePath，按 term 分桶。"""
    self_ = node.get("self", {})
    type_label = self_.get("type") or self_.get("typeEn") or ""
    new_path = path + [type_label] if type_label else path
    for co in self_.get("courses", []):
        course = co.get("course") or {}
        for term in co.get("terms") or ["未指定学期"]:
            buckets.setdefault(term, []).append({
                "code": course.get("code"),
                "name": course.get("nameZh"),
                "credits": course.get("credits"),
                "compulsory": bool(co.get("compulsory", False)),
                "modulePath": list(new_path),
            })
    for child in node.get("children", []):
        _walk_with_path(child, new_path, buckets)


def _term_sort_key(t: str) -> tuple:
    """学期 key 排序：1秋 < 1春 < 2秋 < 2春 < ...，无法解析的放最后。"""
    if t and t[0].isdigit():
        year = int(t[0])
        season = t[1:]
        return (year, 0 if season == "秋" else 1)
    return (99, t)


def group_by_term(raw: dict) -> dict[str, list]:
    """单个 program → {term: [courses]}，按 1秋 < 1春 < 2秋 ... 排序。"""
    buckets: dict[str, list] = {}
    for root in raw.get("moduleTree", []):
        _walk_with_path(root, [], buckets)
    return dict(sorted(buckets.items(), key=lambda kv: _term_sort_key(kv[0])))


def build_by_program_term(raw_dir: Path, out_path: Path) -> int:
    """遍历 raw_dir 下所有 {id}.json，生成 index/by_program_term.json，返回 program 数。"""
    out: dict[str, dict[str, list]] = {}
    for f in sorted(raw_dir.glob("*.json")):
        if not f.stem.isdigit():
            continue
        pid = int(f.stem)
        raw = json.loads(f.read_text(encoding="utf-8"))
        out[str(pid)] = group_by_term(raw)
    out_path.write_text(
        json.dumps(out, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return len(out)