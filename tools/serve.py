#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本地预览服务器。

和 GitHub Pages 的区别只有一处：多了一个 /api/manifest 接口，每次请求都
重新扫描文件夹。所以本地写作时新增或修改 markdown，刷新页面就能看到，
不必先跑 build.py。

用法：  python tools/serve.py     （或双击根目录的 start.bat）
"""

import json
import os
import socket
import sys
import threading
import urllib.parse
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build  # noqa: E402

ROOT = build.ROOT
START_PORT = 8760


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        path = urllib.parse.unquote(urllib.parse.urlparse(self.path).path)

        if path.rstrip("/") == "/api/manifest":
            try:
                manifest = build.build_manifest(build.load_config())
                body = json.dumps(manifest, ensure_ascii=False).encode("utf-8")
            except Exception as err:  # 配置写坏了也别让页面白屏
                body = json.dumps({"error": str(err)}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        super().do_GET()

    def log_message(self, fmt, *args):
        pass


def free_port(start):
    for port in range(start, start + 60):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return start


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    port = free_port(START_PORT)
    url = "http://127.0.0.1:%d/" % port

    try:
        cfg = build.load_config()
        summary = "  ".join(
            "%s %d 篇" % (c["label"], len(build.scan_collection(c))) for c in cfg["collections"]
        )
    except Exception as err:
        summary = "配置读取失败：%s" % err

    print()
    print("  《谈艺录》原文 · 导读　本地预览")
    print("  " + "-" * 44)
    print("  目录   : %s" % ROOT)
    print("  篇目   : %s" % summary)
    print("  地址   : %s" % url)
    print()
    print("  新增或修改 markdown 后，刷新页面即可看到。")
    print("  关闭这个窗口即停止服务。")
    print()

    threading.Timer(0.9, lambda: webbrowser.open(url)).start()

    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()