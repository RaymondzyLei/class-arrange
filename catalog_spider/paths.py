"""数据目录路径常量。

所有 catalog_spider 数据都落在 catalog_spider/data/ 下：
  - raw/        API 原始响应（断点续爬依据）
  - raw/programs/{id}.json   每个 program 的完整 JSON
  - index/      从 raw 生成的索引（入 git，前端可直接消费）
"""
from pathlib import Path

DATA_ROOT = Path(__file__).parent / "data"
RAW_DIR = DATA_ROOT / "raw"
RAW_PROGRAMS_DIR = RAW_DIR / "programs"
INDEX_DIR = DATA_ROOT / "index"


def ensure_dirs() -> None:
    """首次运行时创建所有需要的目录（幂等）。"""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    RAW_PROGRAMS_DIR.mkdir(parents=True, exist_ok=True)
    INDEX_DIR.mkdir(parents=True, exist_ok=True)