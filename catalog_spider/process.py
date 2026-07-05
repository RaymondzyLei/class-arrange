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