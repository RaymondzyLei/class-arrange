"""并发抓取所有 program 详情（断点续爬）。

8 进程 ProcessPoolExecutor，只爬取 grade >= MIN_GRADE 的 program。
已存在的 raw/programs/{id}.json 跳过（断点续爬）。
失败 ID 写 raw/programs/{id}.failed.json，下次重跑仍尝试重抓。
"""
import json
from collections import Counter
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from tqdm import tqdm

from .client import auto_retry_get
from .tree import extract_programs, filter_by_min_grade, program_ids

PROCESS_MAX = 8
MIN_GRADE = 2023  # 仅爬取 2023 年及之后的培养方案（用户明确：仓库不宜过大）


def process_one(pid: int, raw_dir: Path) -> tuple[str, int]:
    """抓单个 program。返回 (status, pid)。"""
    out = raw_dir / f"{pid}.json"
    if out.exists():
        return ("skip", pid)
    resp = auto_retry_get(f"/api/teach/program/info/{pid}")
    if resp is None or resp.status_code != 200:
        failed = raw_dir / f"{pid}.failed.json"
        failed.write_text(
            json.dumps({"status": resp.status_code if resp else None}, ensure_ascii=False),
            encoding="utf-8",
        )
        return ("failed", pid)
    out.write_bytes(resp.content)
    return ("ok", pid)


def fetch_all(tree_path: Path, raw_dir: Path, max_workers: int = PROCESS_MAX) -> dict:
    """并发抓取 tree 中所有 grade>=MIN_GRADE 的 program。"""
    progs = extract_programs(tree_path)
    progs_recent = filter_by_min_grade(progs, MIN_GRADE)
    ids = program_ids(progs_recent)
    print(f"total programs: {len(progs)}, after grade>={MIN_GRADE}: {len(ids)}")
    results: list[tuple[str, int]] = []
    with ProcessPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(process_one, pid, raw_dir): pid for pid in ids}
        for fut in tqdm(as_completed(futures), total=len(futures), desc="programs"):
            results.append(fut.result())
    return summarize(results)


def summarize(results: list[tuple[str, int]]) -> dict:
    return dict(Counter(r[0] for r in results))