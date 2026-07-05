"""CLI 入口：ustc 培养方案爬虫。

子命令：
  --fetch-tree     抓取 /api/teach/program_tree（秒级）
  --fetch-details  并发抓取所有 program 详情（断点续爬）
  --build-index    从 raw 生成 index/programs.json
  --build-by-term  从 raw 生成 index/by_program_term.json
  --all            按顺序跑完上面 4 个
"""
import argparse

from .paths import ensure_dirs


def cmd_fetch_tree(args) -> int:
    print("not implemented: --fetch-tree")
    return 1


def cmd_fetch_details(args) -> int:
    print("not implemented: --fetch-details")
    return 1


def cmd_build_index(args) -> int:
    print("not implemented: --build-index")
    return 1


def cmd_build_by_term(args) -> int:
    print("not implemented: --build-by-term")
    return 1


def cmd_all(args) -> int:
    print("not implemented: --all")
    return 1


def main() -> int:
    ensure_dirs()
    p = argparse.ArgumentParser(prog="catalog_spider", description="USTC 培养方案爬虫")
    cmds = p.add_subparsers(dest="cmd", required=True)
    cmds.add_parser("--fetch-tree", help="抓取 program_tree")
    cmds.add_parser("--fetch-details", help="并发抓取所有 program 详情（断点续爬）")
    cmds.add_parser("--build-index", help="从 raw 生成 programs.json 索引")
    cmds.add_parser("--build-by-term", help="从 raw 生成 by_program_term.json")
    cmds.add_parser("--all", help="按顺序跑完上面 4 个")
    args = p.parse_args()

    dispatch = {
        "--fetch-tree": cmd_fetch_tree,
        "--fetch-details": cmd_fetch_details,
        "--build-index": cmd_build_index,
        "--build-by-term": cmd_build_by_term,
        "--all": cmd_all,
    }
    return dispatch[args.cmd](args)


if __name__ == "__main__":
    raise SystemExit(main())