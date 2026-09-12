// 存档 / 读档健壮性 fuzz：随机开局 + 随机步数 + 随机选项 → 存档 → 打乱 → 读档 → 比对 → 通关
const fs = require('fs');
const html = fs.readFileSync('C:/Users/songting/Desktop/青春楼长行动材料总结/游戏方案/qclz/pixel/index.html', 'utf8');
const script = html.split('<script>').pop().split('</script>')[0];

const store = {};
const styleStub = { setProperty(){}, removeProperty(){}, getPropertyValue(){return '';} };
const mkEl = () => new Proxy({
  style: styleStub,
  classList: { add(){}, remove(){}, toggle(){return false;}, contains(){return false;} },
  getBoundingClientRect: () => ({left:0,top:0,width:0,height:0}),
}, {
  get(t, p) {
    if (p in t) return t[p];
    if (p === 'querySelector') return () => mkEl();
    if (p === 'querySelectorAll') return () => [];
    if (['appendChild','insertAdjacentText','remove','addEventListener','setProperty','focus'].includes(p)) return () => {};
    return '';
  },
  set() { return true; }
});
const sandbox = {
  document: { querySelector: () => mkEl(), querySelectorAll: () => [], getElementById: () => mkEl(), createElement: () => mkEl(), title:'', addEventListener:()=>{} },
  window: { addEventListener: () => {} },
  location: { hash: '' },
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  setTimeout: (f) => { try { f(); } catch(e){} return 0; },
  clearTimeout: () => {},
  console: { log(){}, error(){} }, Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
};
sandbox.globalThis = sandbox; sandbox.self = sandbox;

const driver = `
;(function(){
  const R = { ok:0, fail:0, fails:[] };
  const MAJORS = ['社会工作','公共事业管理','政治学与行政学'];
  const GRADES  = ['大一','大二','大三','大四'];

  function snap(){ return {ch:curChapter, rd:roundNo+"/"+roundTotal, idx, id:STORY[idx] && STORY[idx].id, gongyi:state.gongyi, xinren:state.xinren}; }

  function step(pick){
    const n0 = STORY[idx];
    const n = STORY[idx];
    if (!n || !n.opts || !n.opts.length) return 'BADNODE';
    const o = n.opts[Math.min(pick, n.opts.length-1)];
    if (o.branch) pendingBranch = o.branch;
    for (const k in (o.gain||{})) state[k] = (state[k]||0) + o.gain[k];
    if (n.type === 'special') special[n.id] = o.specialPositive ? 'positive' : (o.specialNegative ? 'negative' : null);
    if (idx < STORY.length - 1){ idx++; renderNode(); saveGame(); return 'STEP'; }
    if (["volunteer","leader","deputy","director"].includes(curChapter) && roundNo < roundTotal){
      roundNo++; nextRound(); renderNode(); saveGame(); return 'STEP';
    }
    if (curChapter === 'branch'){ const t=pendingBranch; pendingBranch=''; clearSave(); startChapter(t); return 'STEP'; }
    if (curChapter === 'volunteer'){
      if (evalPromotion()){ clearSave(); special={}; startChapter('leader'); return 'STEP'; }
      clearSave(); return 'END';
    }
    if (curChapter === 'leader'){ clearSave(); startBranch(); return 'STEP'; }
    clearSave(); return 'END';
  }

  function scramble(){
    curChapter='volunteer'; roundNo=1; roundTotal=1; queueCursor=0; idx=0;
    state={}; ATTR.forEach(a=>state[a.key]=99);
    promoted=true; special={fake:1}; chapterQueue=[]; STORY=[]; pendingBranch=''; lastUnlock='zzz';
  }

  function playToEnd(pickFn){
    let g=0, last;
    while(g++<500){ last = step(pickFn(g)); if(last==='END'||last==='BADNODE') break; }
    return {end:last, steps:g};
  }

  const N = 400;
  for (let t=0; t<N; t++){
    // 随机开局
    profile = { name:'小楼'+(t%7), grade: GRADES[t%4], major: MAJORS[t%3] };
    state = {}; ATTR.forEach(a => state[a.key] = a.hidden ? 0 : 2);
    state.xinren += (t%3===0?1:0); state.goutong += (t%2===0?1:0);
    pendingBonus = Object.assign({}, MAJOR_BONUS[profile.major].after, GRADE_BONUS[profile.grade].after);
    promoted=false; special={}; lastUnlock='';
    startGame();
    if (!hasSave()){ R.fail++; R.fails.push({t, why:'no_save_after_start'}); continue; }

    // 随机跑 k 步
    const k = 1 + (t % 14);
    let bad=false;
    for (let i=0;i<k;i++){ const r = step(t%3); if(r==='END'||r==='BADNODE'){ bad=true; break; } }
    if (bad) { R.ok++; clearSave(); continue; }

    const before = snap();
    const live = JSON.parse(JSON.stringify({ ch:curChapter, rd:roundNo, rt:roundTotal, cursor:queueCursor, idx, id:STORY[idx]&&STORY[idx].id, gongyi:state.gongyi, xinren:state.xinren, state }));

    // 关页面重开
    scramble();
    resumeGame();
    const after = snap();

    const diff = [];
    if (after.ch !== live.ch) diff.push('ch '+after.ch+'!='+live.ch);
    if (parseInt(after.rd) !== live.rd) diff.push('round '+after.rd+'!='+live.rd);
    if (after.idx !== live.idx) diff.push('idx '+after.idx+'!='+live.idx);
    if (after.id !== live.id) diff.push('node '+after.id+'!='+live.id);
    if (after.gongyi !== live.gongyi) diff.push('gongyi '+after.gongyi+'!='+live.gongyi);
    if (after.xinren !== live.xinren) diff.push('xinren '+after.xinren+'!='+live.xinren);
    // 全属性逐一比对
    for (const a of ATTR){ if ((state[a.key]||0) !== (live.state[a.key]||0)) diff.push('attr:'+a.key); }

    if (diff.length){ R.fail++; R.fails.push({t, k, before, after, diff:diff.slice(0,6)}); clearSave(); continue; }

    // 读档后能通关
    const res = playToEnd(x=>t%2);
    if (res.end !== 'END'){ R.fail++; R.fails.push({t, why:'resume_cannot_finish', res}); continue; }
    // 通关后存档应被清掉
    if (hasSave()){ R.fail++; R.fails.push({t, why:'save_not_cleared_at_end'}); continue; }

    R.ok++;
  }
  globalThis.__R = R;
})();
`;
try {
  const fn = new Function(...Object.keys(sandbox), script + driver);
  fn(...Object.values(sandbox));
  const R = sandbox.globalThis.__R;
  console.log('OK=' + R.ok + '  FAIL=' + R.fail);
  if (R.fails.length) console.log(JSON.stringify(R.fails.slice(0,5), null, 2));
} catch (e) {
  console.error('THROW: ' + e.message);
  console.error(e.stack.split('\n').slice(0,8).join('\n'));
}
