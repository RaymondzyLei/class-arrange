"""HTTP 客户端。

调用方用 `from catalog_spider.client import auto_retry_get`，每次调用最多 10 次重试。

注意：与 icourse_spider/spider.py 不同，**不**做 `requests.get` 全局 monkey-patch——
那个写法让单元测试无法拦截 `_original_get`，不利于验证。
"""
import requests

BASE_URL = "https://catalog.ustc.edu.cn"
# USTC 教务系统对默认 python-requests UA 返回 502；模拟浏览器 UA 才能稳定拿数据。
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}


def auto_retry_get(path: str, **kwargs):
    """Get with up to 10 retries on exception. Returns response or None after 10 fails."""
    url = path if path.startswith("http") else BASE_URL + path
    kwargs.setdefault("timeout", 30)
    headers = dict(kwargs.pop("headers", None) or {})
    headers.setdefault("User-Agent", DEFAULT_HEADERS["User-Agent"])
    kwargs["headers"] = headers
    for attempt in range(1, 11):
        try:
            return requests.get(url, **kwargs)
        except Exception as e:  # noqa: BLE001 - 跟 icourse_spider 同款全捕获
            print(f"{url} attempt {attempt} failed: {e}")
            if attempt == 10:
                print(f"{url} giving up")
                return None