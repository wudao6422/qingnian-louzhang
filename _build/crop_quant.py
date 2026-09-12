# -*- coding: utf-8 -*-
"""
crop_quant.py — 按 cells.json 裁格，降采样 + 32 色量化 + 背景透明化，输出游戏素材。
头像 64×64（人物顶部取方形）、立绘高 96 等比、图标 32×32、徽章 32×32、
状态栏 16×16、场景 160×120（不透明）。
"""
from PIL import Image
import numpy as np
import os, json
from collections import deque

BASE = r"C:/Users/songting/Desktop/青春楼长行动材料总结/游戏方案"
IMG_DIR = os.path.join(BASE, "img")
OUT = os.path.join(BASE, "qclz/pixel/assets/img")
CELLS = os.path.join(BASE, "qclz/pixel/assets/cells.json")

PALETTE_RGB = [
    (0xe8,0x50,0x3a),(0xb5,0x36,0x2a),(0xff,0x8a,0x6b),(0xf2,0x88,0x4b),
    (0xff,0xcb,0x47),(0xe0,0xa0,0x20),(0xff,0xf1,0xcf),(0xf2,0xc1,0x4e),
    (0x5b,0xbf,0x6a),(0x3a,0x8f,0x4e),(0xa8,0xe0,0xa0),(0x8a,0x6f,0xb0),
    (0x4a,0x90,0xc2),(0x2f,0x6b,0x94),(0x8f,0xc7,0xe8),
    (0xf0,0xc9,0xa0),(0xd4,0x9a,0x72),(0xff,0xe0,0xc0),(0x3a,0x2e,0x2a),
    (0x6f,0xae,0x54),(0x4e,0x8a,0x3c),
    (0xf7,0xf0,0xe4),(0xef,0xe6,0xd6),(0xe3,0xd8,0xc6),(0xff,0xff,0xff),
    (0xd8,0xcf,0xc4),(0xb3,0xa8,0x9c),(0x8c,0x81,0x75),(0x6b,0x61,0x57),
    (0x2b,0x26,0x22),(0x5a,0x4f,0x47),(0x1c,0x18,0x15),
]

def quantize(im):
    pal = Image.new("P", (1, 1))
    flat = [v for rgb in PALETTE_RGB for v in rgb]
    flat += [0] * (768 - len(flat))
    pal.putpalette(flat)
    return im.quantize(palette=pal, dither=Image.NONE).convert("RGB")

def alpha_from_big(im, dist_thr=60):
    """在原始大图（裁切后、降采样前）上算 alpha：与四边连通且接近背景色的区域为透明。
    返回与 im 同尺寸的 0-255 uint8 mask（255=前景）。"""
    arr = np.array(im).astype(int)
    h, w, _ = arr.shape
    corners = np.array([arr[3, 3], arr[3, w - 4], arr[h - 4, 3], arr[h - 4, w - 4]])
    bg = np.median(corners, axis=0)
    dist = np.sqrt(((arr - bg) ** 2).sum(axis=2))
    near = dist < dist_thr
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    return np.where(seen, 0, 255).astype(np.uint8)

def finish_rgba(rgb_big, mask, size):
    """RGB 与 alpha 分别降采样（mask 双线性得到自然半透明边缘），RGB 量化后合成 RGBA。"""
    rgb = rgb_big.resize(size, Image.LANCZOS)
    a = Image.fromarray(mask).resize(size, Image.BILINEAR)
    q = quantize(rgb)
    rgba = q.convert("RGBA")
    rgba.putalpha(a)
    return rgba

def square_top(im):
    """从顶部取正方形（头像用）"""
    w, h = im.size
    s = min(w, h)
    return im.crop((0, 0, s, s))

def square_center(im):
    w, h = im.size
    s = max(w, h)
    canvas = Image.new("RGB", (s, s), im.getpixel((2, 2)))
    canvas.paste(im, ((s - w) // 2, (s - h) // 2))
    return canvas

def proc_avatar(src, name):
    mask_full = alpha_from_big(src)
    head = square_top(src)
    head_mask = mask_full[:head.size[1], :head.size[0]]
    a = finish_rgba(head, head_mask, (64, 64))
    a.save(os.path.join(OUT, "avatars", name + ".png"))
    # 立绘：高 96 等比
    w, h = src.size
    pw = max(1, round(w * 96 / h))
    p = finish_rgba(src, mask_full, (pw, 96))
    p.save(os.path.join(OUT, "portraits", name + ".png"))
    return a

def proc_icon(src, name, size):
    mask_full = alpha_from_big(src)
    sq = square_center(src)
    # square_center 可能在四周补了背景色边，对应 mask 也补 0（透明）
    w0, h0 = src.size
    s = max(w0, h0)
    pad_l, pad_t = (s - w0) // 2, (s - h0) // 2
    sq_mask = np.zeros((s, s), np.uint8)
    sq_mask[pad_t:pad_t + h0, pad_l:pad_l + w0] = mask_full
    i = finish_rgba(sq, sq_mask, (size, size))
    sub = "badges" if name.startswith("badge") else "icons"
    i.save(os.path.join(OUT, sub, name + ".png"))
    return i

def proc_scene(fname, name):
    im = Image.open(os.path.join(IMG_DIR, fname)).convert("RGB")
    s = im.resize((160, 120), Image.LANCZOS)
    s = quantize(s).convert("RGB")
    s.save(os.path.join(OUT, "scenes", name + ".png"))
    return s

def main():
    for d in ("avatars", "portraits", "icons", "badges", "scenes"):
        os.makedirs(os.path.join(OUT, d), exist_ok=True)
    cells = json.load(open(CELLS, encoding="utf-8"))
    thumbs = []
    for fname, info in cells.items():
        im = Image.open(os.path.join(IMG_DIR, fname)).convert("RGB")
        for cell in info["cells"]:
            x0, y0, x1, y1 = cell["bbox"]
            pad = 14
            crop = im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))
            name = cell["name"]
            if info["kind"] == "avatar":
                t = proc_avatar(crop, name)
            else:
                size = 16 if name.startswith("icon_signal") or name.startswith("icon_wifi") or name.startswith("icon_battery") else 32
                t = proc_icon(crop, name, size)
            thumbs.append((name, t))
    for fname, name in [("S1 网格微信群.png", "s1_groupchat"), ("S2 社区线下现场.jpg", "s2_square"),
                        ("S3 楼道楼栋.jpg", "s3_corridor"), ("S4 会议室与线上例会.png", "s4_meeting"),
                        ("S5 封面主视觉.jpg", "s5_cover")]:
        t = proc_scene(fname, name)
        thumbs.append((name, t))
    # contact sheet：深色底，每个素材放大 2 倍平铺
    cell_w, cell_h = 340, 260
    cols = 4
    rows = (len(thumbs) + cols - 1) // cols
    from PIL import ImageDraw
    sheet = Image.new("RGB", (cell_w * cols, cell_h * rows), (43, 38, 34))
    d = ImageDraw.Draw(sheet)
    for i, (name, t) in enumerate(thumbs):
        x = (i % cols) * cell_w
        y = (i // cols) * cell_h
        disp = t.copy()
        scale = min(200 / disp.width, 200 / disp.height, 4)
        disp = disp.resize((max(1, int(disp.width * scale)), max(1, int(disp.height * scale))), Image.NEAREST)
        if disp.mode == "RGBA":
            bgim = Image.new("RGB", disp.size, (43, 38, 34))
            bgim.paste(disp, (0, 0), disp)
            disp = bgim
        sheet.paste(disp, (x + 8, y + 28))
        d.text((x + 8, y + 8), name, fill=(255, 255, 255))
    sheet_path = os.path.join(OUT, "_result_sheet.png")
    sheet.save(sheet_path)
    print("assets ->", OUT)
    print("sheet ->", sheet_path)

if __name__ == "__main__":
    main()
