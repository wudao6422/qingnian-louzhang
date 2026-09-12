# -*- coding: utf-8 -*-
import io, re
p = r"C:/Users/songting/Desktop/青春楼长行动材料总结/游戏方案/qclz/pixel/index.html"
s = io.open(p, encoding="utf-8").read()
print(sorted(set(re.findall(r'face:"([a-z0-9_]+)"', s))))
