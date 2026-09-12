# -*- coding: utf-8 -*-
"""subset_font.py — 解压字体 zip，按 index.html 实际用字子集化到 assets/font/。"""
import zipfile, os, sys, subprocess

BASE = r"C:/Users/songting/Desktop/青春楼长行动材料总结/游戏方案"
BUILD = os.path.join(BASE, "qclz/pixel/_build")
FONT_DIR = os.path.join(BASE, "qclz/pixel/assets/font")
os.makedirs(FONT_DIR, exist_ok=True)

z = zipfile.ZipFile(os.path.join(BUILD, "fp12.zip"))
src = None
for n in z.namelist():
    if "zh_hans" in n and n.endswith(".woff2") and "12px" in n:
        src = n; break
if not src:
    for n in z.namelist():
        print("zip item:", n)
    sys.exit("NO_ZH_HANS_FOUND")
print("font in zip:", src)
raw = os.path.join(BUILD, "fusion_full.woff2")
open(raw, "wb").write(z.read(src))
print("raw size KB:", os.path.getsize(raw) // 1024)

# 收集游戏页面所有字符（CJK + ASCII + 标点），另加常用 UI 字
html = open(os.path.join(BASE, "qclz/pixel/index.html"), encoding="utf-8").read()
chars = set(html)
chars |= set("青年楼长成长记青春像素互动叙事社区志愿者普通小队副总日常网格舆情值守宣讲招募特殊事件触发每日登录自动弹窗随机刷新属性收益心理成长督导评语晋升影响你的选择继续下一幕查看结局重新开始第一阶段第二第三年度判定好结局坏★☆···｜：；，。！？、（）【】《》0123456789＋－→←↑↓")
text_file = os.path.join(BUILD, "subset_chars.txt")
open(text_file, "w", encoding="utf-8").write("".join(sorted(chars)))
print("chars:", len(chars))

out = os.path.join(FONT_DIR, "fusion-pixel-12px-proportional-zh_hans.woff2")
subprocess.run([sys.executable, "-m", "fontTools.subset", raw,
                "--text-file=" + text_file, "--flavor=woff2",
                "--layout-features=*",
                "--output-file=" + out], check=True)
print("subset ->", out, os.path.getsize(out) // 1024, "KB")
print("FONT_READY")
