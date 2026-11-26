// 웹 사주 계산(site/assets/saju.js)을 앱(SajuKit) 결과와 비교한다.
// 사용: node tests/compare_saju.js <saju.js 절대 경로> <기준.json> <products.json>
// 기준.json은 앱 폴더의 tools/saju-web-reference로 만든다.
const path = process.argv[2], refPath = process.argv[3];
const S = require(path);
const ref = require(refPath);
let fail = 0, checked = 0;
const failures = {};
function bad(kind, info) { fail++; (failures[kind] = failures[kind] || []).push(info); }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 절기
let maxTermDiff = 0;
for (const [year, list] of Object.entries(ref.terms)) {
  list.forEach((sec, i) => {
    const ms = S.solarTermMomentMs(i, Number(year));
    maxTermDiff = Math.max(maxTermDiff, Math.abs(ms / 1000 - sec));
  });
}
console.log("절기 최대 차이(초):", maxTermDiff);

// 음력 달
for (const [year, months] of Object.entries(ref.lunar)) {
  const y = Number(year);
  // lunarMonths는 내보내지 않았으니 양력→음력, 음력→양력으로 비교
  for (const [num, leap, jdn, count] of months) {
    const first = S.solarFromLunar(y, num, 1, leap === 1);
    const last = S.solarFromLunar(y, num, count, leap === 1);
    const beyond = S.solarFromLunar(y, num, count + 1, leap === 1);
    checked++;
    const jdnOf = d => { const a = Math.trunc((14 - d.month) / 12), yy = d.year + 4800 - a, mm = d.month + 12 * a - 3;
      return d.day + Math.trunc((153 * mm + 2) / 5) + 365 * yy + Math.trunc(yy / 4) - Math.trunc(yy / 100) + Math.trunc(yy / 400) - 32045; };
    if (!first || jdnOf(first) !== jdn || !last || jdnOf(last) !== jdn + count - 1 || beyond) bad("lunar", [y, num, leap]);
  }
  const leapRef = months.find(m => m[1] === 1);
  if ((S.lunarLeapMonth(y) || null) !== (leapRef ? leapRef[0] : null)) bad("leap", y);
}

// 원국
for (const c of ref.cases) {
  const [year, month, day, calendar, hour, minute, longitude, gender] = c.in;
  const [ziHourRule, appliesSolarTimeCorrection] = c.opt;
  checked++;
  let r;
  try {
    r = S.chart({ year, month, day, calendar, hour, minute, longitude, gender }, { ziHourRule, appliesSolarTimeCorrection });
  } catch (e) {
    if (!c.err) bad("threw", { in: c.in, e: e.message });
    continue;
  }
  if (c.err) { bad("noThrow", { in: c.in, err: c.err }); continue; }
  const o = c.out;
  const p = [r.year, r.month, r.day, r.hour].map(x => x ? [x.stem, x.branch] : null);
  const kind = !appliesSolarTimeCorrection ? "pillarsNoCorr" : "pillars";
  if (!same(p, o.p)) bad(kind, { in: c.in, opt: c.opt, web: p, app: o.p });
  if (Math.abs(r.birthInstantMs / 1000 - o.instant) > 0.001) bad("instant", { in: c.in, web: r.birthInstantMs / 1000, app: o.instant });
  if (r.correctionMinutes !== o.corr && appliesSolarTimeCorrection) bad("corr", { in: c.in, web: r.correctionMinutes, app: o.corr });
  const ct = r.correctedTime ? [r.correctedTime.hour, r.correctedTime.minute] : null;
  if (!same(ct, o.ct) && appliesSolarTimeCorrection) bad("ct", { in: c.in, web: ct, app: o.ct });
  if (!same([r.solarBirthDate.year, r.solarBirthDate.month, r.solarBirthDate.day], o.solar)) bad("solar", c.in);
  const l = r.lunarBirthDate ? [r.lunarBirthDate.year, r.lunarBirthDate.month, r.lunarBirthDate.day, r.lunarBirthDate.isLeapMonth ? 1 : 0] : null;
  if (!same(l, o.lunar)) bad("lunarDate", { in: c.in, web: l, app: o.lunar });
  if (!same(r.analysis.lacking, o.lack) || !same(r.analysis.dominant, o.dom) || r.analysis.balanceScore !== o.bal) bad("analysis", c.in);
  for (const d of o.daily) {
    const f = S.daily(r, { year: d.d[0], month: d.d[1], day: d.d[2] });
    if (f.focusElement !== d.focus || f.strongElement !== d.strong || f.headline !== d.head || f.detail !== d.detail) bad("daily", { in: c.in, d: d.d });
  }
  const t = S.chartType(r);
  if (!same([t.name, t.summary, t.subtitle], o.type)) bad("type", { in: c.in, web: [t.name, t.summary, t.subtitle], app: o.type });
  for (const y of o.years || []) {
    const a = S.yearAhead(r, y.y);
    if (a.focusElement !== y.focus || a.strongElement !== y.strong || a.title !== y.title || a.summary !== y.summary || a.detail !== y.detail) {
      bad("yearAhead", { in: c.in, y: y.y, web: [a.focusElement, a.strongElement, a.detail], app: [y.focus, y.strong, y.detail] });
    }
  }
}

// 미리 볼 해
for (const [sec, year] of ref.previews || []) {
  checked++;
  const web = S.previewYear(sec * 1000);
  if (web !== year) bad("previewYear", { sec, web, app: year });
}

// 해시
for (const h of ref.hashes) {
  checked++;
  if (S.stableHash(h.s).toString(16) !== h.h || S.unit(h.s) !== h.u) bad("hash", h.s);
}

// 추천
const products = require(process.argv[4]).products.filter(S.isUsableProduct);
for (const p of ref.picks) {
  checked++;
  const audience = p.aud ? { gender: p.aud[0], ageBand: p.aud[1] } : null;
  const date = { year: p.d[0], month: p.d[1], day: p.d[2] };
  const life = S.lifetimePicks(products, p.el, p.id, audience).map(x => x.id);
  const daily = S.dailyPicks(products, p.el, date, p.id, audience).map(x => x.id);
  if (!same(life, p.life)) bad("lifetime", { id: p.id, web: life, app: p.life });
  if (!same(daily, p.daily)) bad("dailyPicks", { id: p.id, web: daily, app: p.daily });
  if (p.year) {
    const yearIDs = S.yearPicks(products, p.el, 2027 + ref.picks.indexOf(p) % 3, p.id, audience).map(x => x.id);
    if (!same(yearIDs, p.year)) bad("yearPicks", { id: p.id, web: yearIDs, app: p.year });
  }
}

console.log("비교", checked, "틀림", fail);
for (const [k, v] of Object.entries(failures)) {
  console.log(k, v.length, JSON.stringify(v.slice(0, 3)));
}
process.exit(fail ? 1 : 0);
