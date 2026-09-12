# -*- coding: utf-8 -*-
"""下载 Fusion Pixel 字体（12px zh_hans woff2）到 assets/font/。"""
import json, urllib.request, zipfile, io, os, sys

OUT = r"C:/Users/songting/Desktop/青春楼长行动材料总结/游戏方案/qclz/pixel/assets/font"
os.makedirs(OUT, exist_ok=True)

rel = json.load(urllib.request.urlopen(
    "https://api.github.com/repos/TakWolf/fusion-pixel-font/releases/latest", timeout=30))
print("release:", rel["tag_name"])
cands = []
for a in rel["assets"]:
    n = a["name"].lower()
    if "12px" in n and "zh_hans" in n and ("woff2" in n or n.endswith(".zip")):
        cands.append((a["name"], a["browser_download_url"]))
for n, u in cands:
    print("cand:", n)
# 优先 proportional（阅读更自然），其次 monospaced
pick = None
for n, u in cands:
    if "proportional" in n:
        pick = (n, u); break
if not pick and cands:
    pick = cands[0]
if not pick:
    print("NO_ASSET_FOUND"); sys.exit(1)
name, url = pick
print("downloading:", name)
data = urllib.request.urlopen(url, timeout=120).read()
print("bytes:", len(data))
if name.endswith(".zip"):
    z = zipfile.ZipFile(io.BytesIO(data))
    for info in z.namelist():
        if info.endswith(".woff2") and "12px" in info:
            fn = os.path.basename(info)
            open(os.path.join(OUT, fn), "wb").write(z.read(info))
            print("extracted:", fn)
else:
    open(os.path.join(OUT, name), "wb").write(data)
    print("saved:", name)
print("FONT_OK")
