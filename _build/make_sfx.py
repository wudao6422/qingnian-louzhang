# -*- coding: utf-8 -*-
"""生成古典木质敲击风格音效（点击 / 打字 / 颁奖）。

纯程序化合成，不依赖任何外部素材，**无版权风险**（版权归项目作者）。
音色按木制打击乐器（梆子 / 木鱼 / 木琴）的物理特征来造，而不是方波电子音：

  1. 用**非谐分音**（频率比 1 : 2.76 : 5.4 …，而非整数倍 1 : 2 : 3）。
     分音不落在整数倍上，正是听感上"木头"而不是"金属/电子"的根源。
  2. 每个分音**独立指数衰减**，且高次分音衰减更快（木头的高频先散掉）。
  3. 起音处叠一小段**带通噪声**，模拟鼓槌敲击木面的瞬态"嗒"。
  4. 受击瞬间有极短的**向下滑音**，模拟木头受力时张力释放。
  5. 末尾一道**软饱和**，压峰提响度，同时补出偶次泛音让音色更暖。

用 numpy 生成波形，标准库 wave 写出 16-bit 单声道 wav，采样率 22050Hz。
单声道、时长很短，三个文件合计约 25KB。

用法：
    python _build/make_sfx.py
输出：
    assets/audio/sfx_click.wav / sfx_type.wav / sfx_award.wav

调音提示：
    - 想更像木鱼（更闷）：调大 make_click 里 hollow 的频率/权重，调小 strike
    - 想更像梆子（更脆）：调大 strike 的增益、提高 _decay_noise 的中心频率
    - 想整体更响/更轻：改 _norm 的 peak（当前 0.85）
    - 想更"空"：给 _wood 的 ratios 多加一项高次分音
"""
import os
import wave

import numpy as np

SR = 22050
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "audio")
# 固定随机种子，保证噪声瞬态可复现（每次跑出来的文件完全一致）
RNG = np.random.default_rng(20260912)

# 木质敲击的分音比与相对强度：非整数倍是关键，别改成 2/3/4
WOOD_RATIOS = (1.0, 2.76, 5.40)
WOOD_GAINS = (1.0, 0.40, 0.16)


def _fade(sig, ms=3.0):
    """首尾各做 ms 线性淡入淡出，消除起止爆音（"啪"声）。

    注意：短音效的淡入要短（0.5ms 级），淡入太久会把打击瞬态磨钝、听起来发闷。
    """
    n = int(SR * ms / 1000.0)
    if n * 2 >= len(sig):
        n = max(1, len(sig) // 4)
    ramp = np.linspace(0.0, 1.0, n)
    sig[:n] *= ramp
    sig[-n:] *= ramp[::-1]
    return sig


def _biquad_bp(sig, fc, q):
    """双二阶带通滤波（RBJ 公式）。

    用途：把白噪声整成"敲在木头上"的瞬态。白噪直接当打击声会像电流声/嘶声，
    带通到木头的共振区后才像鼓槌击木。样本数很少（几千），纯 Python 循环够快。
    """
    w0 = 2.0 * np.pi * fc / SR
    alpha = np.sin(w0) / (2.0 * q)
    cw = np.cos(w0)
    b0, b1, b2 = alpha, 0.0, -alpha
    a0, a1, a2 = 1.0 + alpha, -2.0 * cw, 1.0 - alpha
    b0, b1, b2, a1, a2 = b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0
    y = np.zeros_like(sig)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(len(sig)):
        x = sig[i]
        v = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1 = x1, x
        y2, y1 = y1, v
        y[i] = v
    return y


def _strike(n, tau, fc, q, gain):
    """鼓槌击木的瞬态：带通噪声 × 极快指数衰减。"""
    t = np.arange(n) / SR
    return _biquad_bp(RNG.uniform(-1.0, 1.0, n), fc, q) * np.exp(-t / tau) * gain


def _wood(freq, n, tau, ratios=WOOD_RATIOS, gains=WOOD_GAINS, bend=-0.03, bend_tau=0.012):
    """木制敲击的音体：非谐分音叠加，各分音按次数独立加速衰减。

    bend 为受击瞬间的向下滑音幅度（负数=降），稍纵即逝，是"木头"的细节来源。
    """
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for r, g in zip(ratios, gains):
        f = freq * r
        # 瞬时频率 = f * (1 + bend*e^(-t/bend_tau))，相位取其积分，保证连续无爆音
        phase = 2.0 * np.pi * f * (t + bend * bend_tau * (1.0 - np.exp(-t / bend_tau)))
        # 高次分音衰减更快（r**0.7），所以敲击音头亮、尾巴只剩基音，像真木头
        sig += g * np.sin(phase) * np.exp(-t / (tau / (r ** 0.7)))
    return sig


def _hollow(freq, n, tau, gain):
    """空腔低音"体"：木鱼/梆子内部空腔的共鸣，给敲击一点厚度。"""
    t = np.arange(n) / SR
    return np.sin(2.0 * np.pi * freq * t) * np.exp(-t / tau) * gain


def _soft(sig, drive=1.5):
    """轻微软饱和：压掉峰值尖角、提高整体响度，同时添偶次泛音让音色更暖。

    纯正弦叠加的波峰很尖（波峰因数高），听感会偏轻；过一道 tanh 后
    峰值被压平、能量密度上去了，同样峰值下更响，也更像木质而非电子。
    """
    return np.tanh(sig * drive) / np.tanh(drive)


def _norm(sig, peak=0.85):
    """归一化到指定峰值。留出余量，绝不削波。"""
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
    d = sig.astype(float)
    rms = float(np.sqrt(np.mean(d ** 2)))
    print(f"  {name:16s} {len(sig) / SR * 1000:6.1f} ms   {os.path.getsize(path) / 1024:6.1f} KB   "
          f"peak={np.max(np.abs(d)):.3f}  rms={rms:.3f}")


def make_click():
    """一声古典木质敲击（梆子/拍板），用于按钮、选项、菜单的点击反馈。"""
    n = int(SR * 0.075)
    body = _wood(1020, n, 0.017)                       # 主音体：非谐分音
    hollow = _hollow(470, n, 0.020, 0.30)              # 空腔"体"，给厚度
    strike = _strike(n, 0.0013, 2300, 1.1, 0.55)       # 槌击瞬态
    sig = _fade(body + hollow + strike, 0.5)
    _write("sfx_click.wav", _norm(_soft(sig, 1.5), 0.85))


def make_type():
    """极短木质轻点，用于打字机逐字音。

    会被每 26ms 密集重触发，所以刻意做得很短（30ms）且偏闷：
    若尾巴拖长，连续打字会糊成一片噪音。tau 取 6.5ms，26ms 后已衰减到 2%。
    """
    n = int(SR * 0.030)
    body = _wood(1480, n, 0.0065, ratios=(1.0, 2.76), gains=(1.0, 0.30))
    thud = _hollow(520, n, 0.009, 0.38)                # 低频"体"，打字声不至于太尖
    strike = _strike(n, 0.0016, 3000, 1.0, 0.60)       # 瞬态是"脆"的来源
    sig = _fade(body + thud + strike, 0.5)
    _write("sfx_type.wav", _norm(_soft(sig, 1.6), 0.85))


def make_award():
    """木琴式上行琶音 + 长尾，用于晋升颁奖：明亮、向上、有仪式感。"""
    seq = [(523.25, 0.11),    # C5
           (659.25, 0.11),    # E5
           (783.99, 0.11),    # G5
           (1046.50, 0.52)]   # C6，末音拉长做收束
    parts = []
    for freq, dur in seq:
        n = int(SR * dur)
        t = np.arange(n) / SR
        # 木琴音条的分音偏高（1 : 3.9 : 9.2），比梆子的 2.76 更"亮"
        body = _wood(freq, n, dur * 0.55, ratios=(1.0, 3.9, 9.2), gains=(1.0, 0.26, 0.09),
                     bend=-0.018)
        low = _hollow(freq * 0.5, n, dur * 0.30, 0.16)     # 低八度共鸣，垫底不空
        mallet = _strike(n, 0.0012, freq * 4.0, 1.2, 0.20)  # 每颗音的木槌击打感
        att = np.minimum(t / 0.003, 1.0)                   # 3ms 起音，避免音头"啪"
        parts.append((body + low + mallet) * att)
    sig = np.concatenate(parts)
    n = int(SR * 0.09)                                     # 尾巴淡出久一点，别硬切
    sig[-n:] *= np.linspace(1.0, 0.0, n)
    _write("sfx_award.wav", _norm(_soft(_fade(sig, 3.0), 1.5), 0.85))


if __name__ == "__main__":
    print(f"输出目录: {os.path.normpath(OUT_DIR)}")
    make_click()
    make_type()
    make_award()
    print("完成。")
