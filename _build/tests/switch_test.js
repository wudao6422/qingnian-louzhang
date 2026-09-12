// 换个岗位再来一次：支线解锁、创建页起点选择器、直达基线
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('C:/Users/songting/Desktop/青春楼长行动材料总结/游戏方案/qclz/pixel/index.html', 'utf8');
const script = html.split('<script>').pop().split('</script>')[0];

const store = {};
const els = {};
function mkEl(id){
  if (els[id]) return els[id];
  const e = {
    _id: id, _html: '', _text: '', value: '',
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

  // 1. markUnlocked 只翻转"另一条"支线
  unlocked.deputy=false; unlocked.director=false;
  markUnlocked('deputy');
  check('markUnlocked deputy -> 解锁director', unlocked.director===true && unlocked.deputy===false);
  markUnlocked('director');
  check('markUnlocked director -> 解锁deputy', unlocked.deputy===true && unlocked.director===true);
  check('unlock 已持久化', JSON.parse(localStorage.getItem('qclz_pixel_unlocked_v1')).deputy===true);

  // 2. 走完副队长结局：解锁总队长线 + 显示"换个岗位"按钮
  unlocked.deputy=false; unlocked.director=false;
  profile={name:'小楼',grade:'大一',major:'社会工作'};
  special={}; promoted=false; curChapter='deputy';
  showEnding();
  check('副队长结局解锁总队长线', unlocked.director===true);
  check('副队长结局不解锁自身', unlocked.deputy===false);
  check('换岗按钮可见', document.getElementById('btn-switch').style.display==='block');
  check('换岗按钮文案指向总队长', /总队长/.test(document.getElementById('btn-switch').textContent));
  // 志愿者阶段结局不应显示换岗按钮
  unlocked.deputy=false; unlocked.director=false;
  curChapter='volunteer'; promoted=false; special={}; state={gongyi:1,xinren:1};
  showEnding();
  check('志愿者结局隐藏换岗按钮', document.getElementById('btn-switch').style.display==='none');

  // 3. 创建页"起点"选择器
  unlocked.deputy=true; unlocked.director=true; startPoint='full';
  renderProfile();
  check('起点选择器可见', document.getElementById('p-start-wrap').style.display==='block');
  const sp = document.getElementById('p-start').innerHTML;
  check('含全程项', /全程/.test(sp));
  check('含副队长直达', /直达 · 副队长线/.test(sp));
  check('含总队长直达', /直达 · 总队长线/.test(sp));
  // 未解锁时隐藏
  unlocked.deputy=false; unlocked.director=false;
  renderProfile();
  check('未解锁时隐藏选择器', document.getElementById('p-start-wrap').style.display==='none');

  // 4. startDirect 直达基线
  unlocked.deputy=true;
  profile={name:'测试',grade:'大一',major:'社会工作'};
  resetState();
  const nb = Object.assign({}, MAJOR_BONUS['社会工作'].now, GRADE_BONUS['大一'].now);
  for (const k in nb) state[k] += nb[k];
  pendingBonus = Object.assign({}, MAJOR_BONUS['社会工作'].after, GRADE_BONUS['大一'].after);
  startPoint='director';
  startDirect('director');
  check('直达已晋升', promoted===true);
  check('直达章节为director', curChapter==='director');
  check('晋升加成已发放并清零', Object.keys(pendingBonus).length===0);
  check('属性基线非全2', Object.values(state).some(v => v>2));
  check('可见属性8项(管理解锁)', visibleAttr().length===8);
  check('章节队列已建', chapterQueue.length>0 && STORY.length>0);

  // 5. confirmProfile 按起点分流
  startPoint='deputy';
  confirmProfile();
  check('选副队长直达 -> 进deputy', curChapter==='deputy' && promoted===true);

  // 6. goCreate 保留/重置起点
  startPoint='director'; goCreate(true);
  check('goCreate(true) 保留起点', startPoint==='director');
  goCreate(false);
  check('goCreate(false) 重置起点', startPoint==='full');

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
