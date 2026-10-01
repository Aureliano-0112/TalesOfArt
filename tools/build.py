#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""构建静态站点。

做两件事：
  1. 扫描 site.config.json 里声明的每个文件夹，把篇目清单写成 data/manifest.json；
  2. 把网页真正需要的文件复制到 _site/，供 GitHub Pages 直接发布。

清单里带上了每篇的标题和提要，所以网页不用先读完所有 markdown 就能
画出目录——打开页面只加载当前这一篇，其余在后台悄悄预取。

用法：  python tools/build.py
"""

import json
import os
import re
import shutil
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, "site.config.json")
MANIFEST = os.path.join(ROOT, "data", "manifest.json")
OUT = os.path.join(ROOT, "_site")

# 发布时需要带上这些（其余留在仓库里，不进站点）
SITE_ITEMS = ["index.html", "assets", "data", "site.config.json", "content", "interpretation"]
EXTRA_FILES = {".nojekyll": ""}

CN = {"零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5,
      "六": 6, "七": 7, "八": 8, "九": 9}

LEAD_MAX = 46


def cn2num(s):
    if s == "十":
        return 10
    m = re.fullmatch(r"十([一二三四五六七八九])", s)
    if m:
        return 10 + CN[m.group(1)]
    m = re.fullmatch(r"([一二三四五六七八九])十([一二三四五六七八九])?", s)
    if m:
        return CN[m.group(1)] * 10 + (CN[m.group(2)] if m.group(2) else 0)
    return CN.get(s)


def section_label(name):
    m = re.search(r"第([一二三四五六七八九十百]+)节", name)
    return "第%s节" % m.group(1) if m else os.path.splitext(name)[0]


def section_order(name):
    m = re.search(r"第([一二三四五六七八九十百]+)节", name)
    return cn2num(m.group(1)) if m else None


def parse_meta(text, lead_kind):
    """取出首行标题，以及目录里显示的提要。"""
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")

    title, h1 = "", -1
    for i, line in enumerate(lines):
        m = re.match(r"^#\s+(.*)$", line)
        if m:
            title, h1 = m.group(1).strip(), i
            break

    lead = ""
    if h1 > -1:
        rest = lines[h1 + 1:]
        if lead_kind == "quote":
            for line in rest:
                if line.strip() == "":
                    continue
                if line.lstrip().startswith(">"):
                    buf = []
                    for l in rest[rest.index(line):]:
                        if not l.lstrip().startswith(">"):
                            break
                        buf.append(l.lstrip()[1:].strip())
                    lead = " ".join(x for x in buf if x)
                break
        else:
            for line in rest:
                t = line.strip()
                if not t:
                    continue
                if t.startswith(("#", ">", "|", "-", "*", "+", "【")):
                    continue
                if re.match(r"^\d+\.\s", t) or re.fullmatch(r"-{3,}", t):
                    continue
                lead = t
                break

    lead = re.sub(r"\s+", " ", lead).strip()
    if len(lead) > LEAD_MAX:
        lead = lead[:LEAD_MAX].rstrip() + "…"
    return title, lead


def scan_collection(cfg):
    folder = os.path.join(ROOT, cfg["dir"])
    items = []
    if not os.path.isdir(folder):
        return items
    for name in sorted(os.listdir(folder)):
        if not name.lower().endswith(".md"):
            continue
        path = os.path.join(folder, name)
        if not os.path.isfile(path):
            continue
        try:
            with open(path, "r", encoding="utf-8") as fh:
                text = fh.read()
        except OSError as err:
            print("  ! 读不了 %s：%s" % (name, err))
            continue
        title, lead = parse_meta(text, cfg.get("lead", "para"))
        items.append({
            "name": name,
            "label": section_label(name),
            "order": section_order(name),
            "title": title or os.path.splitext(name)[0],
            "lead": lead,
            "bytes": len(text.encode("utf-8")),
        })
    items.sort(key=lambda x: (x["order"] is None, x["order"] or 0, x["name"]))
    return items


def load_config():
    with open(CONFIG, "r", encoding="utf-8") as fh:
        return json.load(fh)


def build_manifest(cfg):
    return {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "collections": {c["id"]: scan_collection(c) for c in cfg["collections"]},
    }


def assemble():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    for item in SITE_ITEMS:
        src = os.path.join(ROOT, item)
        if not os.path.exists(src):
            continue
        dst = os.path.join(OUT, item)
        if os.path.isdir(src):
            shutil.copytree(src, dst, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        else:
            shutil.copy2(src, dst)
    for name, content in EXTRA_FILES.items():
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
            fh.write(content)


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    cfg = load_config()
    manifest = build_manifest(cfg)

    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print("篇目清单")
    for c in cfg["collections"]:
        items = manifest["collections"][c["id"]]
        total = sum(i["bytes"] for i in items)
        print("  %-4s %-16s %2d 篇  %6.1f KB" % (c["label"], c["dir"], len(items), total / 1024))
        for i in items[:2]:
            print("       · %s  %s" % (i["label"], i["lead"][:32]))

    assemble()
    print("\n已写出 %s" % os.path.relpath(MANIFEST, ROOT))
    print("已组装 %s/（可直接发布）" % os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()