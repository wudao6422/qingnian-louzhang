# -*- coding: utf-8 -*-
"""生成 10 个 32×32 功能图标，调色板与 crop_quant.py 的 PALETTE_RGB 对齐。
设计在 16×16 逻辑网格，NEAREST ×2 放大到 32×32 保持像素硬边。
输出到 qclz/pixel/assets/img/icons/。"""
import os
from PIL import Image, ImageDraw

OUT = r"C:/Users/songting/Desktop/青春楼长行动材料总结/游戏方案/qclz/pixel/assets/img/icons"

# 调色板取色（与游戏 32 色一致）
RED=(0xe8,0x50,0x3a); REDD=(0xb5,0x36,0x2a)
GOLD=(0xff,0xcb,0x47); GOLDD=(0xe0,0xa0,0x20)
GRN=(0x5b,0xbf,0x6a); GRND=(0x3a,0x8f,0x4e)
BLU=(0x4a,0x90,0xc2); BLUD=(0x2f,0x6b,0x94); BLUL=(0x8f,0xc7,0xe8)
PUR=(0x8a,0x6f,0xb0)
SKN=(0xf0,0xc9,0xa0); SKND=(0xd4,0x9a,0x72)
CRE=(0xff,0xf1,0xcf); PAP=(0xf7,0xf0,0xe4); PAP2=(0xef,0xe6,0xd6)
INK=(0x2b,0x26,0x22); INK2=(0x5a,0x4f,0x47); INK3=(0x1c,0x18,0x15)
WHT=(0xff,0xff,0xff); GRY=(0xb3,0xa8,0x9c); GRYD=(0x8c,0x81,0x75)

def canvas():
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)

def rect(d, x, y, w, h, c):
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)

def save(im, name):
    big = im.resize((32, 32), Image.NEAREST)
    big.save(os.path.join(OUT, name + ".png"))
    print("wrote", name + ".png", big.size)

def icon_chat():
    im, d = canvas()
    rect(d, 2, 2, 11, 8, RED)
    rect(d, 3, 10, 2, 2, RED)          # 气泡尾巴
    rect(d, 2, 2, 11, 1, REDD)         # 顶边暗描
    rect(d, 5, 5, 1, 1, CRE); rect(d, 7, 5, 1, 1, CRE); rect(d, 9, 5, 1, 1, CRE)
    save(im, "icon_chat")

def icon_dm():
    im, d = canvas()
    rect(d, 2, 2, 8, 6, BLU)           # 私聊气泡
    rect(d, 3, 8, 2, 2, BLU)
    rect(d, 10, 3, 4, 4, SKN)          # 对方头
    rect(d, 9, 7, 6, 6, SKN)           # 对方身
    rect(d, 9, 7, 6, 1, SKND)
    save(im, "icon_dm")

def icon_bell():
    im, d = canvas()
    rect(d, 5, 3, 6, 5, GOLD)          # 铃身
    rect(d, 4, 8, 8, 2, GOLD)
    rect(d, 4, 8, 8, 1, GOLDD)
    rect(d, 7, 10, 2, 2, GOLDD)        # 铃舌
    rect(d, 5, 2, 6, 1, GOLDD)         # 顶钮
    save(im, "icon_bell")

def icon_log():
    im, d = canvas()
    rect(d, 3, 2, 10, 12, PAP)         # 本子
    rect(d, 3, 2, 10, 12, None)
    rect(d, 3, 2, 10, 12, PAP)
    for y in (5, 7, 9, 11):
        rect(d, 5, y, 6, 1, INK2)      # 横线
    rect(d, 10, 2, 2, 5, RED)          # 书签
    rect(d, 2, 2, 1, 12, INK3)         # 装订边
    save(im, "icon_log")

def icon_keyboard():
    im, d = canvas()
    rect(d, 2, 4, 12, 8, INK)          # 键盘底
    keys = [(3,5),(5,5),(7,5),(9,5),(11,5),
            (3,7),(5,7),(7,7),(9,7),(11,7),
            (6,9),(8,9)]
    for c, r in keys:
        rect(d, c, r, 1, 1, CRE)
    save(im, "icon_keyboard")

def icon_hand():
    im, d = canvas()
    # 食指竖直
    rect(d, 7, 2, 2, 7, SKN)
    # 中指/无名指/小指并拢
    rect(d, 6, 6, 6, 3, SKN)
    rect(d, 6, 9, 6, 2, SKN)
    # 拇指弯出
    rect(d, 4, 7, 2, 2, SKN)
    rect(d, 3, 9, 3, 2, SKN)
    # 指节暗线
    rect(d, 7, 4, 2, 1, SKND)
    save(im, "icon_hand")

def icon_phone():
    im, d = canvas()
    rect(d, 4, 2, 8, 12, INK)          # 机身
    rect(d, 5, 4, 6, 8, BLUL)          # 屏
    rect(d, 7, 12, 2, 1, GRY)          # Home 键
    save(im, "icon_phone")

def icon_speaker():
    im, d = canvas()
    rect(d, 3, 6, 3, 4, RED)           # 喇叭体
    rect(d, 6, 4, 2, 8, RED)           # 锥
    rect(d, 8, 3, 3, 10, RED)          # 外扩
    rect(d, 12, 5, 1, 6, BLUL)         # 声波
    rect(d, 13, 4, 1, 8, BLUL)
    save(im, "icon_speaker")

def icon_file():
    im, d = canvas()
    rect(d, 4, 2, 8, 12, PAP)          # 纸
    rect(d, 10, 2, 2, 2, PAP2)         # 折角
    for y in (5, 7, 9, 11):
        rect(d, 5, y, 6, 1, INK2)
    rect(d, 4, 2, 8, 1, INK3)
    save(im, "icon_file")

def icon_heart():
    im, d = canvas()
    rect(d, 5, 4, 2, 2, RED); rect(d, 9, 4, 2, 2, RED)
    rect(d, 4, 5, 8, 3, RED)
    rect(d, 5, 8, 6, 2, RED)
    rect(d, 6, 10, 4, 1, RED)
    rect(d, 7, 11, 2, 1, RED)
    rect(d, 5, 4, 2, 1, REDD); rect(d, 9, 4, 2, 1, REDD)
    save(im, "icon_heart")

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    icon_chat(); icon_dm(); icon_bell(); icon_log(); icon_keyboard()
    icon_hand(); icon_phone(); icon_speaker(); icon_file(); icon_heart()
    print("done")
