/* a: number=単一選択 / array=複数選択（完全一致で正解）
   oe: 各選択肢（o と同順）の解説。正解選択肢=なぜ正しいか / 不正解=なぜ違うか

   資格ごとの設定は HTML 側で window.QUIZ_CONFIG に定義する:
   { code, data, practiceN, exam:{enabled,n,minutes,passPct} } */
const CFG = window.QUIZ_CONFIG || {};
const EXAM = CFG.exam || { enabled: false };
const EXAM_N = EXAM.n || 65, EXAM_MIN = EXAM.minutes || 130, PASS_PCT = EXAM.passPct || 0.72;
const PRACTICE_N = CFG.practiceN || 10;
const DATA_FILE = CFG.data || "questions.json";

let ALL = [];

const RING_C = 439.8;
let session = [];
let current = 0;
let selected = [];
let answered = false;
let results = [];
let reviewMode = false;
let examMode = false;
let timerId = null, examEndsAt = 0;

const el = id => document.getElementById(id);
const KEYS = ["A","B","C","D","E"];

/* SAA は既存ユーザーの統計を維持するため旧キー名を使う。他資格は資格コード別 */
const LS_KEY = CFG.code === "SAA" ? "saaQuizStats_v1" : "quizStats_" + (CFG.code || "X") + "_v1";
const LS_HIST = CFG.code === "SAA" ? "saaQuizHistory_v1" : "quizHistory_" + (CFG.code || "X") + "_v1";
function loadLS(k, def){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch(e){ return def; } }
function saveLS(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
let STATS = loadLS(LS_KEY, {});
const keyOf = q => q.d + "|" + q.t;

function recordAnswer(q, correct){
  const k = keyOf(q);
  const s = STATS[k] || {seen:0, correct:0, wrong:0, lastWrong:0, lastSeen:0};
  s.seen++;
  if (correct) s.correct++; else { s.wrong++; s.lastWrong = Date.now(); }
  s.lastSeen = Date.now();
  STATS[k] = s;
  saveLS(LS_KEY, STATS);
}

function pickWeak(n){
  const scored = ALL.map(q=>{
    const s = STATS[keyOf(q)];
    let p, last = 0;
    if (!s || s.seen===0){ p = 1; }
    else {
      last = s.lastWrong || 0;
      const acc = s.correct / s.seen;
      if (s.correct === 0) p = 3;
      else if (acc < 0.5) p = 2.5;
      else if (acc < 1) p = 1.5;
      else p = 0.2;
    }
    return {q, p, last};
  });
  scored.sort((a,b)=> b.p - a.p || b.last - a.last);
  const poolSize = Math.min(scored.length, Math.max(n, n*2));
  return shuffle(scored.slice(0, poolSize).map(x=>x.q)).slice(0, n);
}

function renderLifetime(){
  const lt = el("lifetime");
  const keys = Object.keys(STATS);
  if (keys.length === 0){ lt.hidden = true; return; }
  let seen=0, correct=0;
  keys.forEach(k=>{ seen += STATS[k].seen; correct += STATS[k].correct; });
  const hist = loadLS(LS_HIST, []);
  const acc = seen ? Math.round(correct/seen*100) : 0;
  lt.hidden = false;
  lt.innerHTML = '学習済み <b>'+keys.length+'</b>/'+ALL.length+'問 · 通算正答率 <b>'+acc+'%</b> · <b>'+hist.length+'</b>セッション';
}

function renderStats(){
  renderLifetime();
  const box = el("statsbox");
  const keys = Object.keys(STATS);
  if (keys.length === 0){ box.innerHTML = ""; return; }
  const dom = {};
  keys.forEach(k=>{ const s=STATS[k]; const d=k.split("|")[0];
    dom[d] = dom[d] || {seen:0, correct:0};
    dom[d].seen += s.seen; dom[d].correct += s.correct; });
  const domRows = Object.keys(dom).map(d=>({d, a: Math.round(dom[d].correct/dom[d].seen*100)})).sort((x,y)=> x.a - y.a);
  let html = historyChartSVG() + '<h3 class="stats-h">分野別 通算正答率</h3><div class="dom-bars">';
  domRows.forEach(r=>{
    const col = r.a>=80?'var(--good)': r.a>=50?'var(--accent)':'var(--bad)';
    html += '<div class="dom-row"><span class="dom-name">'+r.d+'</span><span class="dom-track"><span class="dom-fill" style="width:'+r.a+'%;background:'+col+'"></span></span><span class="dom-pct">'+r.a+'%</span></div>';
  });
  html += '</div>';
  const weak = keys.map(k=>{ const s=STATS[k]; return {k, acc:s.correct/s.seen, wrong:s.wrong, last:s.lastWrong||0}; })
    .filter(x=> x.wrong>0)
    .sort((a,b)=> a.acc-b.acc || b.last-a.last)
    .slice(0, 8);
  if (weak.length){
    html += '<h3 class="stats-h">苦手トピック（要復習）</h3><div class="weak-list">';
    weak.forEach(x=>{
      const parts = x.k.split("|");
      html += '<div class="weak-row"><span class="weak-name">'+parts[0]+' / '+parts[1]+'</span><span class="weak-pct">'+Math.round(x.acc*100)+'%</span></div>';
    });
    html += '</div>';
  }
  box.innerHTML = html;
}

function historyChartSVG(){
  const hist = loadLS(LS_HIST, []);
  if (hist.length < 2) return "";
  const data = hist.slice(-30).map(h=>({ pct: h.total?Math.round(h.score/h.total*100):0, mode:h.mode }));
  const n = data.length, W=320, H=120, pad=8;
  const X = i => pad + (n===1?0:i/(n-1)*(W-2*pad));
  const Y = pct => pad + (1-pct/100)*(H-2*pad);
  const pts = data.map((d,i)=>({x:X(i), y:Y(d.pct), d}));
  const line = pts.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
  const area = 'M'+pts[0].x.toFixed(1)+' '+(H-pad)+' '+pts.map(p=>'L'+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ')+' L'+pts[n-1].x.toFixed(1)+' '+(H-pad)+' Z';
  const y72 = Y(72).toFixed(1);
  const dots = pts.map(p=>{
    const col = p.d.mode==='exam' ? (p.d.pct>=72?'var(--good)':'var(--bad)') : 'var(--accent)';
    return '<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3" fill="'+col+'"/>';
  }).join('');
  return '<h3 class="stats-h">成績の推移（直近'+n+'回）</h3>'+
    '<div class="chart-wrap"><svg viewBox="0 0 '+W+' '+H+'" class="chart" role="img" aria-label="成績推移">'+
      '<path d="'+area+'" class="chart-area"/>'+
      '<line x1="'+pad+'" y1="'+y72+'" x2="'+(W-pad)+'" y2="'+y72+'" class="chart-pass"/>'+
      '<path d="'+line+'" class="chart-line"/>'+dots+
    '</svg><div class="chart-legend"><span class="lg-pass">┄ 合格72%</span><span class="lg-p">● 腕試し/苦手</span><span class="lg-e">● 本番</span></div></div>';
}

function renderHomeStats(){
  const keys = Object.keys(STATS);
  const box = el("homestats");
  if (keys.length === 0){
    box.innerHTML = '<p class="home-empty">まだ学習履歴はありません。まずは腕試しから始めよう。</p>';
    if (el("startWeak")) el("startWeak").hidden = true;
    if (el("homereset")) el("homereset").hidden = true;
    return;
  }
  if (el("startWeak")) el("startWeak").hidden = false;
  if (el("homereset")) el("homereset").hidden = false;
  let seen=0, correct=0;
  keys.forEach(k=>{ seen += STATS[k].seen; correct += STATS[k].correct; });
  const hist = loadLS(LS_HIST, []);
  const acc = seen ? Math.round(correct/seen*100) : 0;
  let html = '<p class="home-life">学習済み <b>'+keys.length+'</b>/'+ALL.length+'問 · 通算正答率 <b>'+acc+'%</b> · <b>'+hist.length+'</b>セッション</p>';
  const dom = {};
  keys.forEach(k=>{ const s=STATS[k]; const d=k.split("|")[0];
    dom[d] = dom[d] || {seen:0, correct:0};
    dom[d].seen += s.seen; dom[d].correct += s.correct; });
  const domRows = Object.keys(dom).map(d=>({d, a: Math.round(dom[d].correct/dom[d].seen*100)})).sort((x,y)=> x.a - y.a);
  html += historyChartSVG();
  html += '<h3 class="stats-h">分野別 通算正答率</h3><div class="dom-bars">';
  domRows.forEach(r=>{
    const col = r.a>=80?'var(--good)': r.a>=50?'var(--accent)':'var(--bad)';
    html += '<div class="dom-row"><span class="dom-name">'+r.d+'</span><span class="dom-track"><span class="dom-fill" style="width:'+r.a+'%;background:'+col+'"></span></span><span class="dom-pct">'+r.a+'%</span></div>';
  });
  html += '</div>';
  const weak = keys.map(k=>{ const s=STATS[k]; return {k, acc:s.correct/s.seen, wrong:s.wrong, last:s.lastWrong||0}; })
    .filter(x=> x.wrong>0)
    .sort((a,b)=> a.acc-b.acc || b.last-a.last)
    .slice(0, 8);
  if (weak.length){
    html += '<h3 class="stats-h">苦手トピック（要復習）</h3><div class="weak-list">';
    weak.forEach(x=>{
      const parts = x.k.split("|");
      html += '<div class="weak-row"><span class="weak-name">'+parts[0]+' / '+parts[1]+'</span><span class="weak-pct">'+Math.round(x.acc*100)+'%</span></div>';
    });
    html += '</div>';
  }
  box.innerHTML = html;
}

function shuffle(arr){
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
const isMulti = q => Array.isArray(q.a);
let cur = null;
function shuffledQuestion(q){
  const order = shuffle(q.o.map((_,i)=>i));
  const o = order.map(i=>q.o[i]);
  const oe = q.oe ? order.map(i=>q.oe[i]) : q.oe;
  let a;
  if (Array.isArray(q.a)) a = q.a.map(x=>order.indexOf(x)).sort((m,n)=>m-n);
  else a = order.indexOf(q.a);
  return Object.assign({}, q, {o, oe, a});
}

function startSession(questions, modeLabel){
  examMode = false;
  stopTimer();
  session = questions;
  current = 0;
  results = [];
  el("home").hidden = true;
  el("progress").hidden = false;
  renderLifetime();
  const mt = el("modetag");
  if (modeLabel){ mt.textContent = modeLabel; mt.classList.add("on"); }
  else mt.classList.remove("on");
  el("result").hidden = true;
  el("quiz").hidden = false;
  el("ring").style.transition = "none";
  el("ring").style.strokeDashoffset = RING_C;
  render();
}

function startExam(){
  startSession(shuffle(ALL).slice(0, EXAM_N), "本番モード（"+EXAM_N+"問）");
  examMode = true;
  startTimer();
}

function fmtTime(sec){
  const m = Math.floor(sec/60), s = sec%60;
  return String(m).padStart(2,"0") + ":" + String(s).padStart(2,"0");
}
function tick(){
  const remain = Math.max(0, Math.round((examEndsAt - Date.now())/1000));
  const t = el("timer");
  t.hidden = false;
  t.textContent = "残り " + fmtTime(remain);
  t.classList.toggle("warn", remain <= 300);
  if (remain <= 0){ stopTimer(); showResult(); }
}
function startTimer(){
  examEndsAt = Date.now() + EXAM_MIN*60000;
  tick();
  timerId = setInterval(tick, 1000);
}
function stopTimer(){
  if (timerId){ clearInterval(timerId); timerId = null; }
  const t = el("timer");
  t.hidden = true;
  t.classList.remove("warn");
}
function showHome(){
  examMode = false;
  stopTimer();
  el("home").hidden = false;
  el("quiz").hidden = true;
  el("result").hidden = true;
  el("progress").hidden = true;
  el("lifetime").hidden = true;
  el("modetag").classList.remove("on");
  renderHomeStats();
}

function render(){
  const item = cur = shuffledQuestion(session[current]);
  selected = [];
  answered = false;

  el("domain").textContent = item.d;
  el("multibadge").hidden = !isMulti(item);
  el("qtext").innerHTML = item.q;
  const total = session.length;
  el("counter").textContent = String(current+1).padStart(2,"0") + " / " + String(total).padStart(2,"0");
  el("barfill").style.width = (current/total*100) + "%";

  const opts = el("opts");
  opts.innerHTML = "";
  item.o.forEach((text,i)=>{
    const row = document.createElement("div");
    row.className = "opt-row";
    const b = document.createElement("button");
    b.className = "opt";
    b.innerHTML = '<span class="key">'+KEYS[i]+'</span><span>'+text+'</span>';
    b.onclick = () => toggle(i);
    const exp = document.createElement("div");
    exp.className = "opt-exp";
    exp.hidden = true;
    row.appendChild(b);
    row.appendChild(exp);
    opts.appendChild(row);
  });

  el("explain").hidden = true;
  const action = el("action");
  action.textContent = "回答する";
  action.disabled = true;
}

function toggle(i){
  if (answered) return;
  const item = cur;
  if (isMulti(item)){
    const at = selected.indexOf(i);
    if (at>=0) selected.splice(at,1); else selected.push(i);
  } else {
    selected = [i];
  }
  el("opts").querySelectorAll(".opt").forEach((b,idx)=>{
    b.classList.toggle("selected", selected.includes(idx));
  });
  el("action").disabled = selected.length === 0;
}

function grade(){
  const item = cur;
  const correctSet = isMulti(item) ? item.a.slice() : [item.a];
  const sel = selected.slice().sort((x,y)=>x-y);
  const cor = correctSet.slice().sort((x,y)=>x-y);
  const isRight = sel.length===cor.length && sel.every((v,k)=>v===cor[k]);

  answered = true;
  const rows = el("opts").querySelectorAll(".opt-row");
  rows.forEach((row,i)=>{
    const b = row.querySelector(".opt");
    const exp = row.querySelector(".opt-exp");
    b.disabled = true;
    b.classList.remove("selected");
    const isCorrectOpt = correctSet.includes(i);
    if (isCorrectOpt) b.classList.add("correct");
    else if (selected.includes(i)) b.classList.add("wrong");
    else b.classList.add("dimmed");

    // 各選択肢の解説
    if (item.oe && item.oe[i]){
      exp.hidden = false;
      exp.className = "opt-exp " + (isCorrectOpt ? "ok" : "ng");
      const tag = isCorrectOpt ? "正解" : "不正解";
      exp.innerHTML = '<span class="tag">'+tag+'</span>'+item.oe[i];
    }
  });

  results.push({ q:item, topic:item.t, correct:isRight });
  recordAnswer(item, isRight);

  const ex = el("explain");
  ex.hidden = false;
  ex.className = "explain " + (isRight?"ok":"ng");
  const correctLabels = correctSet.map(i=>KEYS[i]).join("・");
  el("verdict").textContent = isRight ? "✓ 正解" : "✕ 不正解 — 正解は " + correctLabels;
  el("expltext").innerHTML = item.e;

  const action = el("action");
  action.disabled = false;
  action.textContent = (current === session.length-1) ? "結果を見る →" : "次へ →";
}

el("action").onclick = () => {
  if (!answered){ grade(); return; }
  if (current === session.length-1){ showResult(); }
  else { current++; render(); }
};

function showResult(){
  stopTimer();
  el("quiz").hidden = true;
  el("result").hidden = false;
  el("barfill").style.width = "100%";
  const total = session.length;
  el("counter").textContent = total + " / " + total;

  const score = results.filter(r=>r.correct).length;
  el("scorenum").textContent = score;
  el("scoredenom").textContent = "/ " + total;

  const offset = RING_C * (1 - score/total);
  requestAnimationFrame(()=>{
    el("ring").style.transition = "stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1)";
    el("ring").style.strokeDashoffset = offset;
  });

  const pct = score/total;
  let v,d,c;
  if (examMode){
    const pctInt = Math.round(pct*100);
    if (pct>=PASS_PCT){ v="合格 — "+pctInt+"%"; d="合格ライン（720/1000点 ≒ 72%）を超えています。この調子で本番へ。"; c="#3DD68C"; }
    else { v="不合格 — "+pctInt+"%"; d="合格ラインは 720/1000点（≒72%）。間違えた分野を復習して再挑戦しよう。"; c="#F2565B"; }
  }
  else if (pct>=0.9){ v="合格圏 — 文句なし"; d="本番でも通用するレベル。苦手分野だけ仕上げよう。"; c="#3DD68C"; }
  else if (pct>=0.7){ v="合格ライン上 — あと一歩"; d="基礎は固い。間違えた分野を復習すれば十分狙える。"; c="#F0A132"; }
  else if (pct>=0.5){ v="あと少し — 弱点を潰そう"; d="主要サービスの使い分けを重点的に復習しよう。"; c="#F0A132"; }
  else { v="基礎固めから"; d="各サービスが「何のためのものか」を一つずつ押さえよう。"; c="#F2565B"; }
  el("ring").setAttribute("stroke", c);
  el("rverdict").textContent = v;
  el("rverdict").style.color = c;
  el("rdesc").textContent = d;

  const bd = el("breakdown");
  bd.innerHTML = "";
  results.forEach((r,i)=>{
    const row = document.createElement("div");
    row.className = "brow";
    row.innerHTML =
      '<span class="dot '+(r.correct?"ok":"ng")+'"></span>'+
      '<span class="topic">Q'+(i+1)+'　'+r.q.d+' / '+r.topic+'</span>'+
      '<span class="mark '+(r.correct?"ok":"ng")+'">'+(r.correct?"正解":"不正解")+'</span>';
    bd.appendChild(row);
  });

  const wrong = results.filter(r=>!r.correct).map(r=>r.q);
  const reviewBtn = el("review");
  if (wrong.length>0){
    reviewBtn.hidden = false;
    reviewBtn.textContent = "間違えた " + wrong.length + " 問を復習";
    reviewBtn.onclick = () => startSession(shuffle(wrong), "弱点復習モード");
  } else {
    reviewBtn.hidden = true;
  }

  const hist = loadLS(LS_HIST, []);
  hist.push({ d: Date.now(), score: score, total: total, mode: examMode ? "exam" : "practice" });
  saveLS(LS_HIST, hist);
  renderStats();
  el("weak").hidden = false;
  el("weak").onclick = () => startSession(pickWeak(PRACTICE_N), "苦手中心モード");
  el("resetstats").hidden = false;
  const exambtn = el("exambtn");
  if (exambtn){
    if (EXAM.enabled){ exambtn.hidden = false; exambtn.onclick = () => startExam(); }
    else exambtn.hidden = true;
  }
  el("tohome").onclick = () => showHome();
}

el("retry").onclick = () => startSession(shuffle(ALL).slice(0, PRACTICE_N), "");
if (el("startTest")) el("startTest").onclick = () => startSession(shuffle(ALL).slice(0, PRACTICE_N), "");
if (el("startExam")) el("startExam").onclick = () => startExam();
if (el("startWeak")) el("startWeak").onclick = () => startSession(pickWeak(PRACTICE_N), "苦手中心モード");
function resetAll(){
  if (confirm("これまでの学習データ（成績・苦手記録）を消去します。よろしいですか？")){
    STATS = {}; saveLS(LS_KEY, STATS); saveLS(LS_HIST, []);
    renderStats(); renderLifetime(); renderHomeStats();
  }
}
el("resetstats").onclick = resetAll;
if (el("homereset")) el("homereset").onclick = resetAll;

document.addEventListener("keydown", (e)=>{
  if (el("quiz").hidden || !cur) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  let idx = ["a","b","c","d","e"].indexOf(k);
  if (idx < 0) idx = ["1","2","3","4","5"].indexOf(k);
  if (idx >= 0 && idx < cur.o.length && !answered){ e.preventDefault(); toggle(idx); return; }
  if (e.key === "Enter" || e.key === " "){
    const action = el("action");
    if (!action.disabled){ e.preventDefault(); action.onclick(); }
  }
});

async function boot(){
  const res = await fetch(DATA_FILE);
  ALL = await res.json();
  renderLifetime();
  showHome();
}
boot();
