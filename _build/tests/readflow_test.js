// 阅读两拍：剧情先出现，点击后内心在剧情下方追加显示（phase-read-event -> phase-read-inner -> phase-choose）
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('C:/Users/songting/Desktop/青春楼长行动材料总结/游戏方案/qclz/pixel/index.html', 'utf8');
const script = html.split('<script>').pop().split('</script>')[0];

const store = {};
const _cache = {};
function mkEl(id){
  if (_cache[id]) return _cache[id];
  const set = new Set();
  const e = {
    _id: id, _html: '', _text: '', value: '', _clsSet: set,
    style: { setProperty(){}, removeProperty(){}, scrollTop:0 },
    classList: {
      add: (...c) => c.forEach(x => set.add(x)),
      remove: (...c) => c.forEach(x => set.delete(x)),
      toggle: (c) => (set.has(c) ? (set.delete(c), false) : (set.add(c), true)),
      contains: (c) => set.has(c),
    },
    getBoundingClientRect: () => ({left:0,top:0,width:0,height:0}),
    appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
    insertAdjacentText(){}, insertAdjacentHTML(){},
    focus(){}, setAttribute(){}, getAttribute(){return null;},
    querySelector: () => mkEl(id+'_q'), querySelectorAll: () => [],
  };
  Object.defineProperty(e, 'innerHTML', { get(){return e._html;}, set(v){e._html=String(v);} });
  Object.defineProperty(e, 'textContent', { get(){return e._text;}, set(v){e._text=String(v);} });
  Object.defineProperty(e, 'src', { get(){return e._src||'';}, set(v){e._src=String(v);} });
  _cache[id] = e;
  return e;
}
const sandbox = {
  document: {
    getElementById: id => mkEl(id),
    querySelector: sel => mkEl('sel:'+sel),
    querySelectorAll: () => [],
    createElement: () => mkEl('new'),
    title: '', addEventListener(){},
  },
  window: { addEventListener(){}, removeEventListener(){} },
  location: { hash: '' },
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  Audio: function(){ return { addEventListener(){}, play(){return null;}, pause(){}, paused:true, readyState:0, loop:false, volume:0, preload:'' }; },
  setTimeout: (f) => { try { f(); } catch(e){} return 0; },
  clearTimeout: () => {},
  console: { log(){}, error(){} },
  Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
};
sandbox.globalThis = sandbox; sandbox.self = sandbox;

const driver = `
;(function(){
  const R = { pass:[], fail:[] };
  const check = (n, c) => (c ? R.pass : R.fail).push(n);
  const cls = () => document.getElementById('scr-story')._clsSet;

  // 准备一个含事件与内心的节点
  profile = {name:'小楼', grade:'大一', major:'社会工作'};
  curChapter = 'volunteer';
  STORY = [{ id:'n1', type:'daily', title:'标题', scene:'s1', face:'hero_v1',
             desc:'这是客观事件描述。', inner:'这是小楼的内心想法。',
             opts:[{t:'选项A', gain:{}}] }];
  idx = 0;

  // 第 1 拍：renderNode 后应处于 event 阅读态
  renderNode(STORY[0]);
  check('第1拍 进入 phase-read-event', cls().has('phase-read-event'));
  check('第1拍 不含 phase-read-inner', !cls().has('phase-read-inner'));
  check('第1拍 不含 phase-choose', !cls().has('phase-choose'));
  check('第1拍 readingStep=event', readingStep==='event');

  // 点击继续：应进入 inner 阅读态
  advanceReading();
  check('第2拍 进入 phase-read-inner', cls().has('phase-read-inner'));
  check('第2拍 退出 phase-read-event', !cls().has('phase-read-event'));
  check('第2拍 不含 phase-choose', !cls().has('phase-choose'));
  check('第2拍 readingStep=inner', readingStep==='inner');

  // 再点击继续：应进入选择态
  advanceReading();
  check('第3拍 进入 phase-choose', cls().has('phase-choose'));
  check('第3拍 清除 phase-read-inner', !cls().has('phase-read-inner'));

  // 无内心节点：event 拍后直接进选择态，不经历 inner 拍
  STORY = [{ id:'n2', type:'daily', title:'标题2', scene:'s1', face:'hero_v1',
             desc:'只有事件没有内心。', inner:'',
             opts:[{t:'选项B', gain:{}}] }];
  idx = 0;
  renderNode(STORY[0]);
  check('无内心-第1拍 event', cls().has('phase-read-event'));
  advanceReading();
  check('无内心-直接进 phase-choose（跳过inner拍）', cls().has('phase-choose'));

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
