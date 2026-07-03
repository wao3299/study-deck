const fs = require("fs");

const questions = JSON.parse(fs.readFileSync(__dirname + "/../questions.json", "utf8"));
const errors = [];

if (!Array.isArray(questions) || questions.length === 0) {
  errors.push("questions.json は非空の配列である必要がある");
}

const seenKeys = new Set();
questions.forEach((x, i) => {
  const at = `[${i}] ${x.d ?? "?"}|${x.t ?? "?"}`;
  for (const field of ["d", "t", "q", "o", "oe", "e", "a"]) {
    if (x[field] === undefined) errors.push(`${at}: フィールド ${field} がない`);
  }
  if (!Array.isArray(x.o) || !Array.isArray(x.oe)) return;
  if (x.o.length !== x.oe.length) {
    errors.push(`${at}: 選択肢 ${x.o.length} 件に対し解説が ${x.oe.length} 件`);
  }
  const answers = Array.isArray(x.a) ? x.a : [x.a];
  answers.forEach(a => {
    if (!Number.isInteger(a) || a < 0 || a >= x.o.length) {
      errors.push(`${at}: 正解インデックス ${a} が範囲外`);
    }
  });
  if (Array.isArray(x.a)) {
    if (new Set(x.a).size !== x.a.length) errors.push(`${at}: 正解インデックスが重複`);
    if (x.a.length < 2) errors.push(`${at}: 複数選択なのに正解が ${x.a.length} 件`);
  }
  const key = x.d + "|" + x.t;
  if (seenKeys.has(key)) errors.push(`${at}: 学習統計キー "${key}" が他の問題と重複`);
  seenKeys.add(key);
});

if (errors.length) {
  errors.forEach(e => console.error("NG:", e));
  process.exit(1);
}
console.log(`OK: ${questions.length} 問すべて構造チェックに合格`);
