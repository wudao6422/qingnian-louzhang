# -*- coding: utf-8 -*-
"""生成 8-bit 风格音效（点击 / 打字 / 颁奖）。

纯程序化合成，不依赖任何外部素材，**无版权风险**（版权归项目作者）。
用 numpy 生成波形，标准库 wave 写出 16-bit 单声道 wav。

采样率取 22050Hz：够低，方波谐波自然混叠出复古"电子"味；
又不至于刺耳。单声道 16-bit，三个文件合计约 25KB。

用法：
    python _build/make_sfx.py
输出：
    assets/audio/sfx_click.wav / sfx_type.wav / sfx_award.wav

调音提示：
    - 想整体更响/更轻：改 _norm 的 peak
    - 想更清脆：提高 _square 的频率
    - 想打字更闷/更脆：调 type_() 里 thud 与 clack 的权重
"""
import os
import wave

import numpy as np

SR = 22050
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "audio")
# 固定随机种子，保证噪声瞬态可复现（每次跑出来的文件完全一致）
RNG = np.random.default_rng(20260912)


def _fade(sig, ms=3.0):
    """首尾各做 ms 线性淡入淡出，消除起止爆音（"啪"声）。"""
    n = int(SR * ms / 1000.0)
    if n * 2 >= len(sig):
        n = max(1, len(sig) // 4)
    ramp = np.linspace(0.0, 1.0, n)
    sig[:n] *= ramp
    sig[-n:] *= ramp[::-1]
    return sig


def _square(freq, n, duty=0.5):
    """方波。duty=0.5 是标准方波，0.25/0.35 更尖锐。"""
    t = np.arange(n) / SR
    ph = (t * freq) % 1.0
    return np.where(ph < duty, 1.0, -1.0)


def _norm(sig, peak=0.7):
    """归一化到指定峰值，留出余量避免削波。"""
    m = np.max(np.abs(sig))
    return sig * (peak / m) if m > 0 else sig


def _write(name, sig):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name)
    pcm = (np.clip(sig, -1.0, 1.0) * 32767.0).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"  {name:16s} {len(sig) / SR * 1000:6.1f} ms   {os.path.getsize(path) / 1024:6.1f} KB")


def make_click():
    """短促清脆的一下，用于按钮 / 选项的点击反馈。"""
    n = int(SR * 0.055)
    t = np.arange(n) / SR
    tone = _square(1180, n, duty=0.5)
    top = _square(2360, n, duty=0.25) * 0.3          # 高频层，加"电子"味
    body = (tone + top) * np.exp(-t / 0.011)         # 约 11ms 时间常数，干脆
    tick = RNG.uniform(-1, 1, n) * np.exp(-t / 0.0016) * 0.35   # 起始瞬态
    # 注意顺序：先淡入淡出再归一化，否则峰值落在起始瞬态上会被淡入压掉（电平偏轻）
    _write("sfx_click.wav", _norm(_fade(body * 0.8 + tick, 1.5)))


def make_type():
    """极短机械敲击，用于打字机逐字音。

    要能每 26ms 密集触发而不刺耳，所以刻意做得很短（约 30ms）且偏闷。
    """
    n = int(SR * 0.030)
    t = np.arange(n) / SR
    tick = RNG.uniform(-1, 1, n) * np.exp(-t / 0.0022) * 0.6    # 噪声"哒"
    clack = _square(1750, n, duty=0.35) * np.exp(-t / 0.0035) * 0.35  # 脆感
    thud = _square(320, n, duty=0.25) * np.exp(-t / 0.007) * 0.28     # 低频"体"
    # 淡入只给 0.8ms：短音效的瞬态是"脆"的来源，淡入太久会发闷
    _write("sfx_type.wav", _norm(_fade(tick + clack + thud, 0.8)))


def make_award():
    """上行琶音 + 长尾音，用于晋升颁奖，明亮有向上的感觉。"""
    seq = [(523.25, 0.085),   # C5
           (659.25, 0.085),   # E5
           (783.99, 0.085),   # G5
           (1046.50, 0.32)]   # C6，末音拉长做收束
    parts = []
    for freq, dur in seq:
        n = int(SR * dur)
        t = np.arange(n) / SR
        tone = _square(freq, n, duty=0.5) + _square(freq * 2, n, duty=0.25) * 0.22
        env = np.exp(-t / (dur * 0.55))
        att = np.minimum(t / 0.004, 1.0)   # 4ms 起音，避免每颗音头"啪"
        parts.append(tone * env * att)
    sig = np.concatenate(parts)
    n = int(SR * 0.05)                     # 尾巴淡出久一点，不要硬切
    sig[-n:] *= np.linspace(1.0, 0.0, n)
    _write("sfx_award.wav", _norm(sig * 0.55))


if __name__ == "__main__":
    print(f"输出目录: {os.path.normpath(OUT_DIR)}")
    make_click()
    make_type()
    make_award()
    print("完成。")
