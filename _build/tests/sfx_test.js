// 音效（点击/颁奖/打字）接线与节流验证
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('C:/Users/songting/Desktop/青春楼长行动材料总结/游戏方案/qclz/pixel/index.html', 'utf8');
const script = html.split('<script>').pop().split('</script>')[0];

const store = {};
const els = {};
function mkEl(id){
  if (els[id]) return els[id];
  const e = {
    _id: id, _html: '', _text: '', value: '', src: '',
    style: { setProperty(){}, removeProperty(){} },
    classList: { add(){}, remove(){}, toggle(){return false;}, contains(){return false;} },
    getBoundingClientRect: () => ({left:0,top:0,width:0,height:0}),
    appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
    insertAdjacentText(){}, insertAdjacentHTML(){},
    focus(){}, setAttribute(){}, getAttribute(){return null;},
    querySelector: () => mkEl(id+'_q'), querySelectorAll: () => [],
  };
  Object.defineProperty(e, 'innerHTML', { get(){return e._html;}, set(v){e._html=String(v);} });
  Object.defineProperty(e, 'textContent', { get(){return e._text;}, set(v){e._text=String(v);} });
  els[id] = e;
  return e;
}

// 可控时钟，用于打字节流判定（放在 sandbox 上，让 FakeDate 能读到）
class FakeDate extends Date { static now(){ return sandbox.CLOCK; } }

function AudioStub(){
  const inst = { _plays:0, _t:0, addEventListener(){}, pause(){}, paused:true, readyState:0, loop:false, volume:0, preload:'' };
  Object.defineProperty(inst, 'currentTime', { get(){return inst._t;}, set(v){inst._t=v;} });
  inst.play = function(){
    inst._plays++;
    const o = {};
    o.then = (cb) => { if (cb) { try { cb(); } catch(e){} } return o; };
    o.catch = () => o;
    return o;
  };
  return inst;
}

const sandbox = {
  document: {
    getElementById: id => mkEl(id),
    querySelector: sel => mkEl('sel:'+sel),
    querySelectorAll: () => [],
    createElement: () => mkEl('new'),
    title: '', addEventListener(){}, removeEventListener(){},
  },
  window: { addEventListener(){}, removeEventListener(){} },
  location: { hash: '' },
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  Audio: AudioStub,
  Date: FakeDate,
  setTimeout: (f) => { try { f(); } catch(e){} return 0; },
  clearTimeout: () => {},
  console: { log(){}, error(){} },
  Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
};
sandbox.globalThis = sandbox; sandbox.self = sandbox;
sandbox.CLOCK = 1000;

const driver = `
;(function(){
  const R = { pass:[], fail:[] };
  const check = (n, c) => (c ? R.pass : R.fail).push(n);

  // 1. 初始化后三个音效对象就位
  initSfx();
  check('initSfx 后三个音效对象就位', !!sfxClick && !!sfxAward && !!sfxType);

  // 2. 点击音：开启时触发一次
  sfxClick._plays = 0;
  playSfx('click');
  check('点击音 开启时播放', sfxClick._plays === 1);

  // 3. 颁奖音：showAward 触发
  sfxAward._plays = 0;
  showAward('leader');
  check('颁奖屏 触发颁奖音效', sfxAward._plays === 1);

  // 4. 打字音：节流（跟随打字速度，按 _typeSpeed 动态判定；此处默认 26ms）
  sfxType._plays = 0; _lastTypeSfx = 0; CLOCK = 1000; _typeSpeed = 26;
  playSfx('type');                       // 第1声
  CLOCK = 1020; playSfx('type');         // 距上次 20ms < 26ms -> 节流
  CLOCK = 1100; playSfx('type');         // 距上次 100ms -> 再响
  check('打字音 随打字速度节流', sfxType._plays === 2);

  // 5. 静音后所有音效不播放
  sfxOn = true; toggleSfx();             // 切到关闭
  check('toggleSfx 切到关闭', sfxOn === false);
  sfxClick._plays = 0; sfxAward._plays = 0;
  playSfx('click'); playSfx('award');
  check('静音后 点击/颁奖不响', sfxClick._plays === 0 && sfxAward._plays === 0);
  // 重新开启
  toggleSfx();
  check('toggleSfx 重新开启', sfxOn === true);

  // 6. 偏好持久化
  check('音效偏好已写入 localStorage', localStorage.getItem('qclz_pixel_sfx_v1') === '1');

  globalThis.__RESULT__ = R;
})();
`;

try {
  vm.runInNewContext(script + driver, sandbox, { filename: 'index.html' });
} catch (e) {
  console.error('RUN ERROR:', e && e.stack ? e.stack : e);
  process.exit(1);
}
const R = sandbox.__RESULT__ || { pass: [], fail: [] };
console.log('PASS(' + R.pass.length + '):', R.pass.join(' | '));
if (R.fail.length) { console.log('FAIL(' + R.fail.length + '):', R.fail.join(' | ')); process.exit(1); }
console.log('ALL GREEN');
