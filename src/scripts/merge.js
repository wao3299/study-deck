/* ログイン時にローカル統計とクラウド統計を突き合わせる純関数。
   Firebase に依存させず bun test で検証できるよう sync.js から分離している */
export function mergeDeckData(local, cloud){
  const ls = local.stats || {}, cs = cloud.stats || {};
  const stats = {};
  new Set([...Object.keys(ls), ...Object.keys(cs)]).forEach(k=>{
    const l = ls[k], c = cs[k];
    if (!l || !c){ stats[k] = l || c; return; }
    stats[k] = {
      seen: l.seen + c.seen,
      correct: l.correct + c.correct,
      wrong: l.wrong + c.wrong,
      lastWrong: Math.max(l.lastWrong || 0, c.lastWrong || 0),
      lastSeen: Math.max(l.lastSeen || 0, c.lastSeen || 0),
    };
  });
  const seen = new Set();
  const hist = [...(local.hist || []), ...(cloud.hist || [])]
    .filter(h=>{
      const key = h.d + "|" + h.score + "|" + h.total + "|" + h.mode;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a,b)=> a.d - b.d);
  return { stats, hist };
}
