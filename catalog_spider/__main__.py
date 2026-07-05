"""CLI 入口：USTC 培养方案爬虫。

子命令：
  --fetch-tree     抓取 /api/teach/program/tree（秒级）
  --fetch-details  并发抓取所有 program 详情（断点续爬）
  --build-index    从 raw 生成 index/programs.json
  --build-by-term  从 raw 生成 index/by_program_term.json
  --all            按顺序跑完上面 4 个
"""
import argparse

from .client import auto_retry_get
from .details import fetch_all
from .paths import INDEX_DIR, RAW_DIR, RAW_PROGRAMS_DIR, ensure_dirs
from .process import build_programs_index


def cmd_fetch_tree(_args) -> int:
    """抓取 program_tree.json（秒级，每次重跑即可）。"""
    ensure_dirs()
    out = RAW_DIR / "program_tree.json"
    resp = auto_retry_get("/api/teach/program/tree")
    if resp is None or resp.status_code != 200:
        status = resp.status_code if resp else "no response"
        print(f"failed: {status}")
        return 1
    out.write_bytes(resp.content)
    print(f"wrote {out} ({len(resp.content)} bytes)")
    return 0


def cmd_fetch_details(_args) -> int:
    """并发抓取所有 program 详情（断点续爬）。"""
    ensure_dirs()
    tree_path = RAW_DIR / "program_tree.json"
    if not tree_path.exists():
        print(f"missing {tree_path}, run `fetch-tree` first")
        return 1
    summary = fetch_all(tree_path, RAW_PROGRAMS_DIR)
    print(f"summary: {summary}")
    return 0


def cmd_build_index(_args) -> int:
    """从 raw/programs/*.json 生成 index/programs.json。"""
    ensure_dirs()
    out = INDEX_DIR / "programs.json"
    n = build_programs_index(RAW_PROGRAMS_DIR, out)
    print(f"wrote {out} ({n} rows)")
    return 0


def cmd_build_by_term(_args) -> int:
    print("not implemented: --build-by-term")
    return 1


def cmd_all(_args) -> int:
    print("not implemented: --all")
    return 1


def main() -> int:
    ensure_dirs()
    p = argparse.ArgumentParser(prog="catalog_spider", description="USTC 培养方案爬虫")
    cmds = p.add_subparsers(dest="cmd", required=True)
    cmds.add_parser("fetch-tree", help="抓取 program_tree")
    cmds.add_parser("fetch-details", help="并发抓取所有 program 详情（断点续爬）")
    cmds.add_parser("build-index", help="从 raw 生成 programs.json 索引")
    cmds.add_parser("build-by-term", help="从 raw 生成 by_program_term.json")
    cmds.add_parser("all", help="按顺序跑完上面 4 个")
    args = p.parse_args()

    dispatch = {
        "fetch-tree": cmd_fetch_tree,
        "fetch-details": cmd_fetch_details,
        "build-index": cmd_build_index,
        "build-by-term": cmd_build_by_term,
        "all": cmd_all,
    }
    return dispatch[args.cmd](args)


if __name__ == "__main__":
    raise SystemExit(main())