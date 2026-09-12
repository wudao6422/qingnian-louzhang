# -*- coding: utf-8 -*-
"""
detect_cells.py — 自动检测 AI 生图网格中每格的前景 bbox，输出标注预览和 cells.json。
原理：背景接近纯色（米白），与背景色差大的像素判前景；
行/列投影找空隙切格；每格内取前景包围盒。
右下角 AI 水印区域预先清零。
"""
from PIL import Image, ImageDraw
import numpy as np
import os, json, io, sys

BASE = r"C:/Users/songting/Desktop/青春楼长行动材料总结/游戏方案"
IMG_DIR = os.path.join(BASE, "img")
OUT_DIR = os.path.join(BASE, "qclz/pixel/assets")
PREVIEW = os.path.join(OUT_DIR, "_detect_preview.png")

# 每张图的配置：预期网格 (rows, cols)，每格命名（按从左到右、从上到下）
CONFIG = [
    ("C1 主角四阶段.jpg", 2, 2, ["hero_v1", "hero_v2", "hero_v3", "hero_v4"], "avatar"),
    ("C2 金老师.png", 1, 1, ["jin"], "avatar"),
    ("C3 小队长 NPC.jpeg", 1, 1, ["xiaodui"], "avatar"),
    ("C4 四位居民.jpeg", 2, 2, ["zhangshu", "liayi", "chenlaoshi", "nainai"], "avatar"),
    ("C5 网格员与组员.jpg", 1, 2, ["wanggeyuan", "zuyuan"], "avatar"),
    ("新志愿者与两位通用居民.jpeg", 1, 3, ["xinvol", "resident_m", "resident_f"], "avatar"),
    ("G1 属性图标八个.png", 2, 4, ["icon_info", "icon_judge", "icon_comm", "icon_trust",
                                   "icon_plan", "icon_org", "icon_liaison", "icon_seed"], "icon"),
    ("G2 菜单图标四个.jpeg", 2, 2, ["icon_menu", "icon_sound", "icon_save", "icon_font"], "icon"),
    ("G3 手机状态栏图标三个.jpeg", 1, 3, ["icon_signal", "icon_wifi", "icon_battery"], "icon"),
    ("G4 群消息类型图标四个.png", 2, 2, ["icon_link", "icon_photo", "icon_voice", "icon_at"], "icon"),
    ("G5 晋升徽章四个.jpeg", 1, 4, ["badge_1", "badge_2", "badge_3", "badge_4"], "icon"),
]

def foreground_mask(arr):
    """与四角背景色差异 > 阈值的像素为前景"""
    h, w, _ = arr.shape
    corners = np.array([arr[5, 5], arr[5, w - 6], arr[h - 6, 5], arr[h - 6, w - 6]])
    bg = np.median(corners, axis=0)
    diff = np.abs(arr.astype(int) - bg).sum(axis=2)
    mask = diff > 60
    # 清掉右下角水印区（x>82% 且 y>90%）
    mask[int(h * 0.90):, int(w * 0.82):] = False
    return mask

def split_gaps(proj, min_gap_frac=0.01):
    """投影数组 -> 前景段列表 [(start,end),...]，空隙宽度需 >= min_gap_frac*len"""
    thr = max(2, proj.max() * 0.02)
    occupied = proj > thr
    segs, i, n = [], 0, len(occupied)
    min_gap = max(4, int(n * min_gap_frac))
    while i < n:
        if occupied[i]:
            j = i
            while j < n and occupied[j]:
                j += 1
            segs.append((i, j))
            i = j
        else:
            i += 1
    # 合并间距过小的相邻段（段内小空隙不切开）
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < min_gap:
            merged[-1] = (merged[-1][0], s[1])
        else:
            merged.append(list(s))
    return merged

def detect(fname, rows, cols):
    im = Image.open(os.path.join(IMG_DIR, fname)).convert("RGB")
    arr = np.array(im)
    mask = foreground_mask(arr)
    col_segs = split_gaps(mask.sum(axis=0))
    row_segs = split_gaps(mask.sum(axis=1))
    # 若检测到的段数 != 预期，退化为均分
    if len(col_segs) != cols:
        w = arr.shape[1]
        col_segs = [[int(w * i / cols), int(w * (i + 1) / cols)] for i in range(cols)]
    if len(row_segs) != rows:
        h = arr.shape[0]
        row_segs = [[int(h * i / rows), int(h * (i + 1) / rows)] for i in range(rows)]
    cells = []
    for r, (y0, y1) in enumerate(row_segs):
        for c, (x0, x1) in enumerate(col_segs):
            sub = mask[y0:y1, x0:x1]
            ys, xs = np.where(sub)
            if len(xs) == 0:
                bbox = (x0, y0, x1, y1)
            else:
                pad = 6
                bx0 = max(x0, x0 + xs.min() - pad); by0 = max(y0, y0 + ys.min() - pad)
                bx1 = min(x1, x0 + xs.max() + pad); by1 = min(y1, y0 + ys.max() + pad)
                bbox = (int(bx0), int(by0), int(bx1), int(by1))
            cells.append({"row": r, "col": c, "bbox": bbox})
    return im, cells

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    result = {}
    thumbs = []
    for fname, rows, cols, names, kind in CONFIG:
        im, cells = detect(fname, rows, cols)
        for cell, name in zip(cells, names):
            cell["name"] = name
        result[fname] = {"kind": kind, "cells": cells}
        # 标注预览
        ann = im.copy()
        d = ImageDraw.Draw(ann)
        for cell in cells:
            x0, y0, x1, y1 = cell["bbox"]
            d.rectangle([x0, y0, x1, y1], outline=(232, 80, 58), width=6)
            d.text((x0 + 8, y0 + 8), cell["name"], fill=(232, 80, 58))
        ann.thumbnail((420, 420))
        thumbs.append((fname, ann))
        print(fname, "->", [c["name"] for c in cells])
    # 拼 contact sheet
    tw = max(t.width for _, t in thumbs) + 8
    th = max(t.height for _, t in thumbs) + 24
    cols_sheet = 3
    rows_sheet = (len(thumbs) + cols_sheet - 1) // cols_sheet
    sheet = Image.new("RGB", (tw * cols_sheet, th * rows_sheet), (43, 38, 34))
    d = ImageDraw.Draw(sheet)
    for i, (fname, t) in enumerate(thumbs):
        x = (i % cols_sheet) * tw
        y = (i // cols_sheet) * th
        sheet.paste(t, (x + 4, y + 20))
        d.text((x + 6, y + 4), fname, fill=(255, 255, 255))
    sheet.save(PREVIEW)
    with open(os.path.join(OUT_DIR, "cells.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print("preview ->", PREVIEW)

if __name__ == "__main__":
    main()
