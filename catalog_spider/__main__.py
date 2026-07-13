"""CLI 入口：USTC 培养方案爬虫。

子命令：
  fetch-tree     抓取 /api/teach/program/tree（秒级）
  fetch-details  并发抓取所有 program 详情（断点续爬）
  build-index    从 raw 生成 index/programs.json
  build-by-term  从 raw 生成 index/by_program_term.json
  sync-lessons   在可见浏览器登录后同步指定学期开课
  build-lessons  从本地 raw JSON 重建指定学期开课
  validate-lessons 校验可部署的学期开课 JSON
  all            按顺序跑完上面 4 个
"""
import argparse
from pathlib import Path

from .client import auto_retry_get
from .details import fetch_all
from .lesson_sync import (
    SyncError,
    authenticated_request_context,
    build_requested_semesters,
    sync_requested_semesters,
    validate_published_catalogs,
)
from .paths import (
    BROWSER_PROFILE_DIR,
    INDEX_DIR,
    PUBLIC_SEMESTERS_DIR,
    RAW_DIR,
    RAW_LESSONS_DIR,
    RAW_PROGRAMS_DIR,
    ensure_dirs,
)
from .process import build_by_program_term, build_programs_index


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
    """从 raw/programs/*.json 生成 index/by_program_term.json。"""
    ensure_dirs()
    out = INDEX_DIR / "by_program_term.json"
    n = build_by_program_term(RAW_PROGRAMS_DIR, out)
    print(f"wrote {out} ({n} programs)")
    return 0


def cmd_all(_args) -> int:
    """按顺序跑完 fetch-tree → fetch-details → build-index → build-by-term。"""
    rc = 0
    for cmd in (cmd_fetch_tree, cmd_fetch_details, cmd_build_index, cmd_build_by_term):
        if cmd(_args) != 0:
            rc = 1
    return rc


def cmd_sync_lessons(args) -> int:
    """Open an authenticated browser context and synchronize requested terms."""

    profile_dir = args.profile_dir or BROWSER_PROFILE_DIR
    try:
        with authenticated_request_context(profile_dir) as request:
            catalogs = sync_requested_semesters(
                request,
                args.semesters,
                activate=args.activate,
            )
    except (SyncError, ValueError, OSError) as error:
        print(f"failed: {error}")
        return 1

    for catalog in catalogs:
        print(
            "synced "
            f"{catalog['semester']['key']}: courses={len(catalog['courses'])}"
        )
    return 0


def cmd_validate_lessons(args) -> int:
    """Validate one or every deployable semester catalog and print coverage."""

    try:
        statistics = validate_published_catalogs(
            PUBLIC_SEMESTERS_DIR,
            all_semesters=args.all,
            semester_key_value=args.semester_key,
        )
    except (SyncError, ValueError, OSError) as error:
        print(f"failed: {error}")
        return 1

    for stats in statistics:
        labels = ",".join(stats["gradingLabels"]) or "-"
        print(
            f"semester={stats['semesterKey']} "
            f"courses={stats['courseCount']} "
            f"raw_schedule_non_empty={stats['rawScheduleNonEmptyCount']} "
            f"scheduled_courses={stats['scheduledCourseCount']} "
            f"clock_time_courses={stats['clockTimeCourseCount']} "
            f"grading_non_empty={stats['gradingNonEmptyCount']} "
            f"grading_labels={labels} "
            f"textbooks={stats['structuredTextbookCount']} "
            f"materials={stats['structuredMaterialCount']} "
            "reference_books_non_empty="
            f"{stats['referenceBookNonEmptyCount']}"
        )
    return 0


def cmd_build_lessons(args) -> int:
    """Rebuild deployable semester catalogs from saved raw JSON only."""

    try:
        catalogs = build_requested_semesters(
            args.semester_keys,
            activate=args.activate,
            raw_lessons_dir=RAW_LESSONS_DIR,
            public_semesters_dir=PUBLIC_SEMESTERS_DIR,
        )
    except (SyncError, ValueError, OSError) as error:
        print(f"failed: {error}")
        return 1

    for catalog in catalogs:
        print(
            f"built {catalog['semester']['key']}: "
            f"courses={len(catalog['courses'])}"
        )
    return 0


def main(argv: list[str] | None = None) -> int:
    ensure_dirs()
    p = argparse.ArgumentParser(prog="catalog_spider", description="USTC 培养方案爬虫")
    cmds = p.add_subparsers(dest="cmd", required=True)
    cmds.add_parser("fetch-tree", help="抓取 program_tree")
    cmds.add_parser("fetch-details", help="并发抓取所有 program 详情（断点续爬）")
    cmds.add_parser("build-index", help="从 raw 生成 programs.json 索引")
    cmds.add_parser("build-by-term", help="从 raw 生成 by_program_term.json")
    cmds.add_parser("all", help="按顺序跑完上面 4 个")
    sync = cmds.add_parser("sync-lessons", help="登录后同步指定学期开课和课堂详情")
    sync.add_argument("--semester", action="append", required=True, dest="semesters")
    sync.add_argument("--activate")
    sync.add_argument("--profile-dir", type=Path)

    build_lessons = cmds.add_parser(
        "build-lessons",
        help="从已保存的 raw JSON 重建指定学期开课（不访问网络）",
    )
    build_lessons.add_argument(
        "--semester-key",
        action="append",
        required=True,
        dest="semester_keys",
    )
    build_lessons.add_argument("--activate")

    validate = cmds.add_parser("validate-lessons", help="校验已生成的学期开课文件")
    target = validate.add_mutually_exclusive_group(required=True)
    target.add_argument("--all", action="store_true")
    target.add_argument("--semester-key")

    args = p.parse_args(argv)
    if (
        args.cmd == "sync-lessons"
        and args.activate is not None
        and args.activate not in args.semesters
    ):
        p.error("--activate must exactly match one of --semester")
    if (
        args.cmd == "build-lessons"
        and args.activate is not None
        and args.activate not in args.semester_keys
    ):
        p.error("--activate must exactly match one of --semester-key")

    dispatch = {
        "fetch-tree": cmd_fetch_tree,
        "fetch-details": cmd_fetch_details,
        "build-index": cmd_build_index,
        "build-by-term": cmd_build_by_term,
        "all": cmd_all,
        "sync-lessons": cmd_sync_lessons,
        "build-lessons": cmd_build_lessons,
        "validate-lessons": cmd_validate_lessons,
    }
    return dispatch[args.cmd](args)


if __name__ == "__main__":
    raise SystemExit(main())
