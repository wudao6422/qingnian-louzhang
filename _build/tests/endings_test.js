// 结局收集册逻辑验证：6 种结局解锁 + 渲染计数 + 锁态
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('C:/Users/songting/Desktop/青春楼长行动材料总结/游戏方案/qclz/pixel/index.html', 'utf8');
const script = html.split('<script>').pop().split('</script>')[0];

const store = {};
// 可记录 innerHTML / textContent 的元素注册表
const els = {};
function mkEl(id){
  if (els[id]) return els[id];
  const e = {
    _id: id, _html: '', _text: '',
    style: { setProperty(){}, removeProperty(){} },
    classList: { add(){}, remove(){}, toggle(){return false;}, contains(){return false;} },
    getBoundingClientRect: () => ({left:0,top:0,width:0,height:0}),
    appendChild(){}, removeChild(){}, addEventListener(){}, removeEventListener(){},
    focus(){}, setAttribute(){}, getAttribute(){return null;},
    querySelector: () => mkEl(id+'_q'), querySelectorAll: () => [],
  };
  Object.defineProperty(e, 'innerHTML', { get(){return e._html;}, set(v){e._html=String(v);} });
  Object.defineProperty(e, 'textContent', { get(){return e._text;}, set(v){e._text=String(v);} });
  Object.defineProperty(e, 'src', { get(){return e._src||'';}, set(v){e._src=String(v);} });
  els[id] = e;
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
  // BGM 用到的 Audio：返回带 no-op 方法的桩，避免加载期崩溃
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

  check('baseline empty', getUnlockedEndings().length === 0);

  // 晋升里程碑
  state = { gongyi:9, xinren:4 }; special = {}; promoted = true; curChapter = 'volunteer';
  showEnding();
  check('leader_promo', getUnlockedEndings().includes('leader_promo'));

  // 失格
  curChapter = 'volunteer'; promoted = false; special = { v9:'negative' };
  state = { gongyi:1, xinren:1 }; showEnding();
  check('disqualify', getUnlockedEndings().includes('disqualify'));

  // 留任
  special = {}; state = { gongyi:5, xinren:1 }; showEnding();
  check('retain', getUnlockedEndings().includes('retain'));

  // 功利
  state = { gongyi:2, xinren:1 }; showEnding();
  check('utilitarian', getUnlockedEndings().includes('utilitarian'));

  // 副队长任期
  curChapter = 'deputy'; showEnding();
  check('deputy', getUnlockedEndings().includes('deputy'));

  // 总队长任期
  curChapter = 'director'; showEnding();
  check('director', getUnlockedEndings().includes('director'));

  check('all six', getUnlockedEndings().length === 6);

  // 渲染（全解锁）
  renderEndings();
  check('count 6/6', document.getElementById('endings-count').textContent === '已解锁 6 / 6');
  const grid = document.getElementById('endings-grid').innerHTML;
  check('grid 6 cards', (grid.match(/ending-card/g) || []).length === 6);
  check('grid 0 locked', (grid.match(/ending-card locked/g) || []).length === 0);

  // 清空存档后渲染（全锁）
  localStorage.removeItem('qclz_pixel_endings_v1');
  renderEndings();
  check('fresh count 0/6', document.getElementById('endings-count').textContent === '已解锁 0 / 6');
  const g2 = document.getElementById('endings-grid').innerHTML;
  check('fresh 6 locked', (g2.match(/ending-card locked/g) || []).length === 6);

  // 模拟「读完一个结局再开图鉴」：解锁 1 个时计数应为 1/6
  localStorage.setItem('qclz_pixel_endings_v1', JSON.stringify(['disqualify']));
  renderEndings();
  check('partial count 1/6', document.getElementById('endings-count').textContent === '已解锁 1 / 6');

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
