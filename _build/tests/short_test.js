// 节点间短事件 + 章末日志：只记细节、不碰属性、按章汇总
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
  const el = id => document.getElementById(id);

  // ---- 内容池 ----
  check('短事件池 43 条', SHORT_POOL.length === 43);
  check('每条都有 3 个动作', SHORT_POOL.every(s => s.acts && s.acts.length === 3));
  check('每个动作都记隐藏字段', SHORT_POOL.every(s => s.acts.every(a => a.m && a.t)));
  // 副队长不入驻居民网格群（删 k31），总队长不转发（删 k36），各自少一条
  const MIN_SHORT = { volunteer:10, leader:10, deputy:9, director:10 };
  ['volunteer','leader','deputy','director'].forEach(ch => {
    const n = SHORT_POOL.filter(s => s.ch.includes(ch)).length;
    check(ch + ' 章可用短事件 >= ' + MIN_SHORT[ch] + ' 条（实得 ' + n + '）', n >= MIN_SHORT[ch]);
  });
  check('有深夜场景事件', SHORT_POOL.some(s => s.night));
  check('id 无重复', new Set(SHORT_POOL.map(s => s.id)).size === SHORT_POOL.length);

  // ---- 职责口径（2026-09-14 改写后） ----
  check('「转给别人」按阶段分流，且不再说对接人',
    HAND_OFF_WORD.volunteer === '请金老师跟进' && HAND_OFF_WORD.leader === '请网格员去现场看' &&
    HAND_OFF_WORD.director === '请小队长转告' && !/对接人/.test(HAND_OFF_WORD.volunteer + HAND_OFF_WORD.leader + HAND_OFF_WORD.director));
  check('删掉了 k31 / k36', !SHORT_POOL.some(s => s.id === 'k31' || s.id === 'k36'));
  check('招新文案改挂总队长章', (SHORT_POOL.find(s => s.id === 'k19') || {}).ch.join() === 'director');
  check('副队长章不再有居民互动', SHORT_POOL.filter(s => s.ch.includes('deputy')).every(s => s.tag !== '居民互动'));
  check('总队长章不再有转发事件', SHORT_POOL.filter(s => s.ch.includes('director')).every(s => s.tag !== '转发推文'));
  check('k24 改挂群聊标记', SHORT_POOL.find(s => s.id === 'k24').acts.map(a => a.m).join() === 'chat_note,chat_lurk,chat_away');

  // ---- 抽取：1~3 个、不重复 ----
  curChapter = 'volunteer';
  let sizes = new Set();
  for (let i = 0; i < 40; i++){ sizes.add(pickShorts('volunteer').length); }
  const arr = [...sizes].sort();
  check('每次抽 1~3 个（实得 ' + arr.join('/') + '）', arr[0] >= 1 && arr[arr.length-1] <= 3);
  shortSeen = SHORT_POOL.map(s => s.id);
  check('池子抽干后返回空数组', pickShorts('volunteer').length === 0);
  shortSeen = [];

  // ---- 播放：不碰属性 ----
  profile = {name:'小楼', grade:'大一', major:'社会工作'};
  resetState();
  const before = JSON.stringify(state);
  curChapter = 'volunteer';
  let doneFlag = false;
  startShorts(() => { doneFlag = true; });
  check('进入短事件屏', el('scr-short')._clsSet.has('active'));
  check('短事件有文案', el('sh-desc')._text.length > 0);
  check('短事件动作按钮 3 个', (el('sh-acts')._html.match(/sh-act/g) || []).length === 3);

  let guard = 0;
  while (!doneFlag && guard++ < 10){
    if (!curShort) break;
    pickShort(0);
  }
  check('播完执行回调', doneFlag === true);
  check('短事件不改任何属性数值', JSON.stringify(state) === before);
  check('记录了隐藏细节', Object.keys(marks).length > 0);
  check('记了出现次数 done', (marks.done || 0) >= 1);
  check('用过的短事件进了防重复表', shortSeen.length >= 1);

  // ---- 日志生成 ----
  marks = { done:6, fwd_direct:3, fwd_check:1, src_open:1, src_copy:1,
            read_skim:2, read_care:1, back_scroll:1, rep_now:1, rep_none:1,
            night_rep_now:1, hand_off:2, ignore_resident:1, hesitate:2, hesitate_ms:9000 };
  const lines = buildLog();
  check('日志 >= 5 行（实得 ' + lines.length + '）', lines.length >= 5);
  check('日志首行说出场次数', /出现过 6 次/.test(lines[0]));
  check('日志算清没点开过的转发', lines.some(t => /没点开过原文/.test(t)));
  check('日志记下划过去又翻回来', lines.some(t => /又翻回来/.test(t)));
  check('日志记下深夜上报', lines.some(t => /深夜/.test(t)));
  check('日志记下犹豫秒数', lines.some(t => /停了超过 4 秒/.test(t) && /9 秒/.test(t)));

  // 三种收尾语气都可达
  marks = { done:3, fwd_check:2, src_open:2, read_care:2, rep_now:2, hand_off:2 };
  check('认真型收尾语', logSign().indexOf('当成过自己的事') >= 0);
  marks = { done:3, chat_lurk:2, chat_away:2, ignore_resident:2, rep_none:2 };
  check('旁观型收尾语', logSign().indexOf('看着你自己') >= 0);
  marks = { done:3, fwd_direct:2, fwd_skip:2, read_skip:2 };
  check('机械型收尾语（默认语）', logSign().indexOf('不在那个社区里') >= 0);

  // ---- 章末日志屏 ----
  marks = { done:4, fwd_direct:2, fwd_check:1, hand_off:1 };
  let afterLog = false;
  maybeShowLog('volunteer', () => { afterLog = true; });
  check('展示日志屏', el('scr-log')._clsSet.has('active'));
  check('日志标题带月份', el('log-head')._text.indexOf('十月') >= 0);
  check('日志正文逐行淡入', (el('log-body')._html.match(/class="lg"/g) || []).length >= 2);
  check('日志有落款', el('log-sign')._text.indexOf('——') === 0);
  check('日志留存进历史', logHistory.length === 1);
  el('log-next').onclick();
  check('收起日志后执行后续', afterLog === true);
  check('收起日志后本章计数清零', Object.keys(marks).length === 0);
  check('全程累计不清零', Object.keys(marksAll).length > 0);

  // 无记录时不出日志屏，直接往下走
  marks = {};
  let direct = false;
  maybeShowLog('leader', () => { direct = true; });
  check('本月无记录则不出日志', direct === true);

  // ---- 结局摘录 ----
  marksAll = { fwd_direct:5, fwd_check:2, fwd_skip:3, hand_off:4, ignore_resident:2,
               rep_now:2, rep_wait:1, rep_none:2, hesitate:3, inner_doubt:2 };
  const ex = endingExcerpt();
  check('结局摘录非空', ex.length > 0);
  const exLines = ex.split('\\n').filter(t => t && t.indexOf('那些没人记过') < 0);
  check('摘录最多 3 条（实得 ' + exLines.length + '）', exLines.length <= 3 && exLines.length >= 1);
  check('摘录用全程累计而非本章', /一共转发过 10 条/.test(ex));
  marksAll = {};
  check('无记录时摘录为空', endingExcerpt() === '');

  // ---- 存档 ----
  marks = { done:2, fwd_check:1 }; marksAll = { done:2, fwd_check:1 }; shortSeen = ['k01'];
  saveGame();
  const raw = JSON.parse(localStorage.getItem('qclz_pixel_save_v1'));
  check('存档含 marks', !!raw.marks && raw.marks.done === 2);
  check('存档含 marksAll', !!raw.marksAll);
  check('存档含 shortSeen', Array.isArray(raw.shortSeen) && raw.shortSeen[0] === 'k01');
  marks = {}; marksAll = {}; shortSeen = [];
  const d = JSON.parse(localStorage.getItem('qclz_pixel_save_v1'));
  marks = d.marks; marksAll = d.marksAll; shortSeen = d.shortSeen;
  check('读档还原隐藏记录', marks.done === 2 && shortSeen[0] === 'k01');

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
