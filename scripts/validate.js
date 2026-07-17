import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 検証対象。deck を追加したらここに足す
const FILES = [
  "public/questions-saa.json",
  "public/questions-dva.json",
  "public/questions-dea.json",
  "public/questions-owasp.json",
];

// quiz.js が q/o/oe/e を innerHTML で描画するため、許可した修飾タグ（属性なし）以外の
// タグ状文字列はエラーにする。生の < > を表示したい場合は &lt; &gt; と書く
const ALLOWED_TAG = /^<\/?(strong|code|em|b|i|u|mark|small|kbd|var|sub|sup)>$|^<br\s*\/?>$/;
const TAG_LIKE = /<\/?[a-zA-Z][^>]*>?/g;

function badHtml(str) {
  return (str.match(TAG_LIKE) ?? []).filter(tag => !ALLOWED_TAG.test(tag));
}

let grandTotal = 0;
let hadError = false;

for (const file of FILES) {
  const path = __dirname + "/../" + file;
  const questions = JSON.parse(fs.readFileSync(path, "utf8"));
  const errors = [];

  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push("非空の配列である必要がある");
  }

  const seenKeys = new Set(); // d|t 一意チェックはファイル単位
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
    if (x.f !== undefined && typeof x.f !== "boolean") {
      errors.push(`${at}: f は boolean である必要がある`);
    }
    for (const [field, value] of Object.entries(x)) {
      const strs = Array.isArray(value) ? value : [value];
      strs.forEach(s => {
        if (typeof s !== "string") return;
        badHtml(s).forEach(tag => errors.push(`${at}: フィールド ${field} に許可されていない HTML "${tag}"`));
      });
    }
    const key = x.d + "|" + x.t;
    if (seenKeys.has(key)) errors.push(`${at}: 学習統計キー "${key}" が他の問題と重複`);
    seenKeys.add(key);
  });

  if (errors.length) {
    errors.forEach(e => console.error(`NG [${file}]:`, e));
    hadError = true;
  } else {
    console.log(`OK [${file}]: ${questions.length} 問すべて構造チェックに合格`);
    grandTotal += questions.length;
  }
}

if (hadError) process.exit(1);
console.log(`合計 ${grandTotal} 問`);
