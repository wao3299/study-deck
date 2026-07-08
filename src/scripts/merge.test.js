import { test, expect } from "bun:test";
import { mergeDeckData } from "./merge.js";

const S = (seen, correct, wrong, lastWrong, lastSeen) => ({ seen, correct, wrong, lastWrong, lastSeen });

test("両方に存在するトピックは回数を加算し日時は新しい方を取る", () => {
  const local = { stats: { "EC2|AMI": S(4, 3, 1, 100, 200) }, hist: [] };
  const cloud = { stats: { "EC2|AMI": S(2, 1, 1, 300, 150) }, hist: [] };
  const out = mergeDeckData(local, cloud);
  expect(out.stats["EC2|AMI"]).toEqual(S(6, 4, 2, 300, 200));
});

test("片方にしかないトピックはそのまま残る", () => {
  const local = { stats: { "A|x": S(1, 1, 0, 0, 10) }, hist: [] };
  const cloud = { stats: { "B|y": S(2, 0, 2, 20, 20) }, hist: [] };
  const out = mergeDeckData(local, cloud);
  expect(out.stats["A|x"]).toEqual(S(1, 1, 0, 0, 10));
  expect(out.stats["B|y"]).toEqual(S(2, 0, 2, 20, 20));
});

test("履歴は連結して重複排除し時系列でソートされる", () => {
  const h1 = { d: 100, score: 5, total: 10, mode: "practice" };
  const h2 = { d: 200, score: 8, total: 10, mode: "exam" };
  const h3 = { d: 150, score: 6, total: 10, mode: "practice" };
  const local = { stats: {}, hist: [h1, h2] };
  const cloud = { stats: {}, hist: [h1, h3] }; // h1 が重複
  const out = mergeDeckData(local, cloud);
  expect(out.hist).toEqual([h1, h3, h2]);
});

test("stats や hist が欠けていても空として扱う", () => {
  const out = mergeDeckData({}, { stats: { "A|x": S(1, 0, 1, 5, 5) } });
  expect(out.stats["A|x"]).toEqual(S(1, 0, 1, 5, 5));
  expect(out.hist).toEqual([]);
});
