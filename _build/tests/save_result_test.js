// 专项：结算页（已选完、待推进）存档 → 读档应回到同一结算页，且能续接通关
const fs = require('fs');
const html = fs.readFileSync('C:/Users/songting/Desktop/青春楼长行动材料总结/游戏方案/qclz/pixel/index.html', 'utf8');
const script = html.split('<script>').pop().split('</script>')[0];

const store = {};
const styleStub = { setProperty(){}, removeProperty(){}, getPropertyValue(){return '';} };
const mkEl = () => new Proxy({
  style: styleStub,
  classList: { add(){}, remove(){}, toggle(){return false;}, contains(){return false;} },
  getBoundingClientRect: () => ({left:0,top:0,width:0,height:0}),
  scrollTop: 0,
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
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k,v)=>{store[k]=String(v);}, removeItem: k => { delete store[k]; } },
  setTimeout: (f)=>{try{f();}catch(e){} return 0;}, clearTimeout: ()=>{},
  console: { log(){}, error(){} }, Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
};
sandbox.globalThis = sandbox; sandbox.self = sandbox;

const driver = `
;(function(){
  const R = { ok:0, fail:0, fails:[] };
  const GRADES=['大一','大二','大三','大四'];
  const MAJORS=['社会工作','公共事业管理','政治学与行政学'];

  function scramble(){
    curChapter='volunteer'; roundNo=1; roundTotal=1; queueCursor=0; idx=0;
    state={}; ATTR.forEach(a=>state[a.key]=99);
    promoted=true; special={fake:1}; chapterQueue=[]; STORY=[]; pendingBranch=''; lastUnlock='zzz';
    onResult=false; lastPick=-1;
  }
  // 走一步：choose 只设态，nextNode 推进
  function chooseStep(pick){
    const n = STORY[idx];
    if (!n || !n.opts || !n.opts.length) return 'BADNODE';
    choose(Math.min(pick, n.opts.length-1));   // 内部会 saveGame（onResult=true）
    return 'OK';
  }
  function advance(){
    // 结算页 → 下一条
    nextNode();                                // 内部会复位 onResult 并 saveGame
    return (["volunteer","leader","deputy","director"].includes(curChapter) && roundNo < roundTotal) ? 'OK' : 'OK';
  }

  const N = 300;
  for (let t=0;t<N;t++){
    profile = { name:'小楼', grade: GRADES[t%4], major: MAJORS[t%3] };
    state={}; ATTR.forEach(a=>state[a.key]=a.hidden?0:2);
    pendingBonus = Object.assign({}, MAJOR_BONUS[profile.major].after, GRADE_BONUS[profile.grade].after);
    promoted=false; special={}; lastUnlock='';
    startGame();

    // 随机走 k 步（choose + 大部分情况 advance），使状态停在结算页
    const k = 1 + (t % 10);
    let broke=false;
    for (let i=0;i<k;i++){
      if (chooseStep(t%3)==='BADNODE'){ broke=true; break; }
      // 有时停在结算页（不 advance），有时推进
      if (i < k-1) nextNode();
    }
    if (broke){ R.ok++; clearSave(); continue; }

    // 此刻应停在结算页
    const expect = {
      ch: curChapter, rd: roundNo+'/'+roundTotal, idx,
      id: STORY[idx] && STORY[idx].id,
      gongyi: state.gongyi, xinren: state.xinren,
      onResult, lastPick,
    };
    if (!expect.onResult){ R.fail++; R.fails.push({t, why:'not_on_result', expect}); clearSave(); continue; }

    scramble();
    resumeGame();

    const got = { ch: curChapter, rd: roundNo+'/'+roundTotal, idx, id: STORY[idx]&&STORY[idx].id, gongyi:state.gongyi, xinren:state.xinren, onResult, lastPick };
    const diff=[];
    for (const key of Object.keys(expect)) if (String(expect[key]) !== String(got[key])) diff.push(key+':'+expect[key]+'!='+got[key]);
    if (diff.length){ R.fail++; R.fails.push({t, expect, got, diff:diff.slice(0,6)}); clearSave(); continue; }

    // 读档后从结算页继续 → 应能通关（模拟真实 UI 点击循环）
    let guard = 0;
    while (guard++ < 800){
      if (!hasSave()) break;                      // 已通关（结局清档）
      if (typeof awardNext === 'function' && awardNext){
        const f = awardNext; awardNext = null; f(); saveGame(); continue;
      }
      if (curChapter === 'branch'){
        if (onResult) { nextNode(); }             // 结算页 → 触发颁奖
        else { chooseStep(0); }                   // 分支节点选一个方向
        continue;
      }
      if (onResult){ nextNode(); continue; }      // 结算页 → 下一条
      chooseStep(0);                              // 剧情页 → 选第一个选项
    }
    if (hasSave()){ R.fail++; R.fails.push({t, why:'not_finished', ch:curChapter, rd:roundNo+'/'+roundTotal, idx, guard}); clearSave(); continue; }
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
  if (R.fails.length) console.log(JSON.stringify(R.fails.slice(0,4), null, 2));
} catch (e) {
  console.error('THROW: ' + e.message);
  console.error(e.stack.split('\n').slice(0,6).join('\n'));
}
