/*
 * 사주쇼핑 — 사주(만세력) 계산.
 * 앱의 SajuKit(Swift)을 그대로 옮겼다. 결과가 앱과 같아야 하므로 공식·순서를 바꾸지 말 것.
 * 입력한 생년월일은 이 브라우저 안에서만 계산하고 아무 데도 보내지 않는다.
 *
 * 브라우저: window.Saju, Node(테스트): require("./saju.js")
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Saju = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // MARK: - 기본 수학

  function idiv(a, b) { return Math.trunc(a / b); }
  function mod(a, n) { return ((a % n) + n) % n; }
  /** Swift `.rounded()`: 0.5는 0에서 먼 쪽으로. */
  function roundHalfAway(x) { return x < 0 ? -Math.round(-x) : Math.round(x); }
  function rad(d) { return d * Math.PI / 180; }
  function normalizeDegrees(d) { var r = d % 360; return r < 0 ? r + 360 : r; }
  function signedAngleDifference(d) { var r = normalizeDegrees(d); if (r > 180) r -= 360; return r; }

  // MARK: - 오행·천간·지지

  /** 0 목 · 1 화 · 2 토 · 3 금 · 4 수 (상생 순서). */
  var ELEMENT_KOREAN = ["목", "화", "토", "금", "수"];
  var ELEMENT_HANJA = ["木", "火", "土", "金", "水"];
  var ELEMENT_KEYS = ["wood", "fire", "earth", "metal", "water"];

  var Element = {
    WOOD: 0, FIRE: 1, EARTH: 2, METAL: 3, WATER: 4,
    all: [0, 1, 2, 3, 4],
    korean: function (e) { return ELEMENT_KOREAN[e]; },
    hanja: function (e) { return ELEMENT_HANJA[e]; },
    key: function (e) { return ELEMENT_KEYS[e]; },
    label: function (e) { return ELEMENT_KOREAN[e] + "(" + ELEMENT_HANJA[e] + ")"; },
    /** "목", "木", "wood" 모두 허용. 모르면 null. */
    fromName: function (name) {
      var s = String(name == null ? "" : name).trim().toLowerCase();
      for (var i = 0; i < 5; i++) {
        if (s === ELEMENT_KOREAN[i] || s === ELEMENT_HANJA[i] || s === ELEMENT_KEYS[i]) return i;
      }
      return null;
    },
    generates: function (e) { return (e + 1) % 5; },
    generatedBy: function (e) { return (e + 4) % 5; },
    controls: function (e) { return (e + 2) % 5; },
    controlledBy: function (e) { return (e + 3) % 5; },
    /** 계절(월령) 기준 왕상휴수사. 4 왕 · 3 상 · 2 휴 · 1 수 · 0 사. */
    seasonalStrength: function (e, season) {
      if (e === season) return 4;
      if (Element.generates(season) === e) return 3;
      if (Element.generates(e) === season) return 2;
      if (Element.controls(e) === season) return 1;
      return 0;
    }
  };

  var STEM_KOREAN = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
  var STEM_HANJA = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
  var BRANCH_KOREAN = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
  var BRANCH_HANJA = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  var BRANCH_ANIMAL = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"];
  var BRANCH_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
  /** 지지의 정기(본기) 천간. */
  var BRANCH_MAIN_STEM = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8];

  var Stem = {
    korean: function (s) { return STEM_KOREAN[s]; },
    hanja: function (s) { return STEM_HANJA[s]; },
    element: function (s) { return idiv(s, 2); },
    isYang: function (s) { return s % 2 === 0; }
  };

  var Branch = {
    korean: function (b) { return BRANCH_KOREAN[b]; },
    hanja: function (b) { return BRANCH_HANJA[b]; },
    animal: function (b) { return BRANCH_ANIMAL[b]; },
    element: function (b) { return BRANCH_ELEMENT[b]; },
    isYang: function (b) { return b % 2 === 0; },
    mainStem: function (b) { return BRANCH_MAIN_STEM[b]; }
  };

  function pillarFromIndex(i) {
    i = mod(i, 60);
    return makePillar(i % 10, i % 12);
  }

  function makePillar(stem, branch) {
    return {
      stem: stem,
      branch: branch,
      korean: STEM_KOREAN[stem] + BRANCH_KOREAN[branch],
      hanja: STEM_HANJA[stem] + BRANCH_HANJA[branch],
      index: mod(6 * stem - 5 * branch, 60)
    };
  }

  // MARK: - 십신

  var TEN_GODS = [
    { key: "companion", korean: "비견", group: "비겁" },
    { key: "robWealth", korean: "겁재", group: "비겁" },
    { key: "eatingGod", korean: "식신", group: "식상" },
    { key: "hurtingOfficer", korean: "상관", group: "식상" },
    { key: "indirectWealth", korean: "편재", group: "재성" },
    { key: "directWealth", korean: "정재", group: "재성" },
    { key: "sevenKillings", korean: "편관", group: "관성" },
    { key: "directOfficer", korean: "정관", group: "관성" },
    { key: "indirectResource", korean: "편인", group: "인성" },
    { key: "directResource", korean: "정인", group: "인성" }
  ];

  function tenGodOf(element, isYang, dayMaster) {
    var me = Stem.element(dayMaster);
    var same = isYang === Stem.isYang(dayMaster);
    var i;
    if (element === me) i = same ? 0 : 1;
    else if (Element.generates(me) === element) i = same ? 2 : 3;
    else if (Element.controls(me) === element) i = same ? 4 : 5;
    else if (Element.controls(element) === me) i = same ? 6 : 7;
    else i = same ? 8 : 9;
    return TEN_GODS[i];
  }
  function tenGodOfStem(stem, dayMaster) { return tenGodOf(Stem.element(stem), Stem.isYang(stem), dayMaster); }
  /** 지지는 정기(본기) 천간으로 판단한다. */
  function tenGodOfBranch(branch, dayMaster) { return tenGodOfStem(Branch.mainStem(branch), dayMaster); }

  // MARK: - 양력 날짜 (율리우스 적일)

  function isLeapYear(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function daysInMonth(y, m) {
    if (m === 2) return isLeapYear(y) ? 29 : 28;
    return [4, 6, 9, 11].indexOf(m) >= 0 ? 30 : (m >= 1 && m <= 12 ? 31 : 0);
  }
  function isValidDate(y, m, d) { return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m); }

  function jdnOf(y, m, d) {
    var a = idiv(14 - m, 12);
    var yy = y + 4800 - a;
    var mm = m + 12 * a - 3;
    return d + idiv(153 * mm + 2, 5) + 365 * yy + idiv(yy, 4) - idiv(yy, 100) + idiv(yy, 400) - 32045;
  }

  function dateFromJDN(jdn) {
    var l = jdn + 68569;
    var n = idiv(4 * l, 146097);
    l = l - idiv(146097 * n + 3, 4);
    var i = idiv(4000 * (l + 1), 1461001);
    l = l - idiv(1461 * i, 4) + 31;
    var j = idiv(80 * l, 2447);
    var d = l - idiv(2447 * j, 80);
    l = idiv(j, 11);
    var m = j + 2 - 12 * l;
    var y = 100 * (n - 49) + i + l;
    return { year: y, month: m, day: d };
  }

  function civil(y, m, d) { return { year: y, month: m, day: d }; }
  function addDays(date, n) { return dateFromJDN(jdnOf(date.year, date.month, date.day) + n); }
  function dateString(date) {
    return date.year + "-" + (date.month < 10 ? "0" : "") + date.month + "-" + (date.day < 10 ? "0" : "") + date.day;
  }

  // MARK: - 율리우스일·ΔT

  var J2000 = 2451545.0;
  function julianDayFromMs(ms) { return ms / 86400000 + 2440587.5; }
  function msFromJulianDay(jd) { return (jd - 2440587.5) * 86400000; }

  /** ΔT = TT − UT (초). Espenak & Meeus (NASA, 2006). */
  function deltaT(jd) {
    var y = 2000.0 + (jd - J2000) / 365.25;
    var t, u;
    if (y < 1860) {
      t = y - 1800;
      return 13.72 - 0.332447 * t + 0.0068612 * t * t + 0.0041116 * Math.pow(t, 3)
        - 0.00037436 * Math.pow(t, 4) + 0.0000121272 * Math.pow(t, 5) - 0.0000001699 * Math.pow(t, 6)
        + 0.000000000875 * Math.pow(t, 7);
    }
    if (y < 1900) {
      t = y - 1860;
      return 7.62 + 0.5737 * t - 0.251754 * t * t + 0.01680668 * Math.pow(t, 3)
        - 0.0004473624 * Math.pow(t, 4) + Math.pow(t, 5) / 233174;
    }
    if (y < 1920) {
      t = y - 1900;
      return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * Math.pow(t, 3) - 0.000197 * Math.pow(t, 4);
    }
    if (y < 1941) {
      t = y - 1920;
      return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * Math.pow(t, 3);
    }
    if (y < 1961) {
      t = y - 1950;
      return 29.07 + 0.407 * t - t * t / 233 + Math.pow(t, 3) / 2547;
    }
    if (y < 1986) {
      t = y - 1975;
      return 45.45 + 1.067 * t - t * t / 260 - Math.pow(t, 3) / 718;
    }
    if (y < 2005) {
      t = y - 2000;
      return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * Math.pow(t, 3)
        + 0.000651814 * Math.pow(t, 4) + 0.00002373599 * Math.pow(t, 5);
    }
    if (y < 2050) {
      t = y - 2000;
      return 62.92 + 0.32217 * t + 0.005589 * t * t;
    }
    if (y < 2150) {
      u = (y - 1820) / 100;
      return -20 + 32 * u * u - 0.5628 * (2150 - y);
    }
    u = (y - 1820) / 100;
    return -20 + 32 * u * u;
  }
  function ephemerisFromUT(jd) { return jd + deltaT(jd) / 86400.0; }
  function universalFromTT(jde) { return jde - deltaT(jde) / 86400.0; }

  // MARK: - 태양 황경 (VSOP87 축약, Meeus 32장)

  // 지구 일심 황경 L (1e-8 rad)
  var L0 = [[175347046,0,0], [3341656,4.6692568,6283.0758500], [34894,4.62610,12566.15170], [3497,2.7441,5753.3849], [3418,2.8289,3.5231], [3136,3.6277,77713.7715], [2676,4.4181,7860.4194], [2343,6.1352,3930.2097], [1324,0.7425,11506.7698], [1273,2.0371,529.6910], [1199,1.1096,1577.3435], [990,5.233,5884.927], [902,2.045,26.298], [857,3.508,398.149], [780,1.179,5223.694], [753,2.533,5507.553], [505,4.583,18849.228], [492,4.205,775.523], [357,2.920,0.067], [317,5.849,11790.629], [284,1.899,796.298], [271,0.315,10977.079], [243,0.345,5486.778], [206,4.806,2544.314], [205,1.869,5573.143], [202,2.458,6069.777], [156,0.833,213.299], [132,3.411,2942.463], [126,1.083,20.775], [115,0.645,0.980], [103,0.636,4694.003], [102,0.976,15720.839], [102,4.267,7.114], [99,6.21,2146.17], [98,0.68,155.42], [86,5.98,161000.69], [85,1.30,6275.96], [85,3.67,71430.70], [80,1.81,17260.15], [79,3.04,12036.46], [75,1.76,5088.63], [74,3.50,3154.69], [74,4.68,801.82], [70,0.83,9437.76], [62,3.98,8827.39], [61,1.82,7084.90], [57,2.78,6286.60], [56,4.39,14143.50], [56,3.47,6279.55], [52,0.19,12139.55], [52,1.33,1748.02], [51,0.28,5856.48], [49,0.49,1194.45], [41,5.37,8429.24], [41,2.40,19651.05], [39,6.17,10447.39], [37,6.04,10213.29], [37,2.57,1059.38], [36,1.71,2352.87], [36,1.78,6812.77], [33,0.59,17789.85], [30,0.44,83996.85], [30,2.74,1349.87], [25,3.16,4690.48]];
  var L1 = [[628331966747,0,0], [206059,2.678235,6283.075850], [4303,2.6351,12566.1517], [425,1.590,3.523], [119,5.796,26.298], [109,2.966,1577.344], [93,2.59,18849.23], [72,1.14,529.69], [68,1.87,398.15], [67,4.41,5507.55], [59,2.89,5223.69], [56,2.17,155.42], [45,0.40,796.30], [36,0.47,775.52], [29,2.65,7.11], [21,5.34,0.98], [19,1.85,5486.78], [19,4.97,213.30], [17,2.99,6275.96], [16,0.03,2544.31], [16,1.43,2146.17], [15,1.21,10977.08], [12,2.83,1748.02], [12,3.26,5088.63], [12,5.27,1194.45], [12,2.08,4694.00], [11,0.77,553.57], [10,1.30,6286.60], [10,4.24,1349.87], [9,2.70,242.73], [9,5.64,951.72], [8,5.30,2352.87], [6,2.65,9437.76], [6,4.67,4690.48]];
  var L2 = [[52919,0,0], [8720,1.0721,6283.0758], [309,0.867,12566.152], [27,0.05,3.52], [16,5.19,26.30], [16,3.68,155.42], [10,0.76,18849.23], [9,2.06,77713.77], [7,0.83,775.52], [5,4.66,1577.34], [4,1.03,7.11], [4,3.44,5573.14], [3,5.14,796.30], [3,6.05,5507.55], [3,1.19,242.73], [3,6.12,529.69], [3,0.31,398.15], [3,2.28,553.57], [2,4.38,5223.69], [2,3.75,0.98]];
  var L3 = [[289,5.844,6283.076], [35,0,0], [17,5.49,12566.15], [3,5.20,155.42], [1,4.72,3.52], [1,5.30,18849.23], [1,5.97,242.73]];
  var L4 = [[114,3.142,0], [8,4.13,6283.08], [1,3.84,12566.15]];
  var L5 = [[1,3.14,0]];
  // 동경 반지름 R (1e-8 AU)
  var R0 = [[100013989,0,0], [1670700,3.0984635,6283.0758500], [13956,3.05525,12566.15170], [3084,5.1985,77713.7715], [1628,1.1739,5753.3849], [1576,2.8469,7860.4194], [925,5.453,11506.770], [542,4.564,3930.210], [472,3.661,5884.927]];
  var R1 = [[103019,1.107490,6283.075850], [1721,1.0644,12566.1517], [702,3.142,0]];
  var R2 = [[4359,5.7846,6283.0758], [124,5.579,12566.152]];
  var R3 = [[145,4.273,6283.076]];

  function sumTerms(terms, tau) {
    var s = 0.0;
    for (var i = 0; i < terms.length; i++) s += terms[i][0] * Math.cos(terms[i][1] + terms[i][2] * tau);
    return s;
  }

  /** 태양의 겉보기 지심 황경 (도). jde는 TT 기준. */
  function apparentLongitude(jde) {
    var tau = (jde - J2000) / 365250.0;
    var t = tau * 10;
    var lRad = (sumTerms(L0, tau)
      + sumTerms(L1, tau) * tau
      + sumTerms(L2, tau) * tau * tau
      + sumTerms(L3, tau) * Math.pow(tau, 3)
      + sumTerms(L4, tau) * Math.pow(tau, 4)
      + sumTerms(L5, tau) * Math.pow(tau, 5)) / 1e8;
    var r = (sumTerms(R0, tau) + sumTerms(R1, tau) * tau + sumTerms(R2, tau) * tau * tau
      + sumTerms(R3, tau) * Math.pow(tau, 3)) / 1e8;
    var lon = lRad * 180 / Math.PI + 180;
    lon -= 0.09033 / 3600;
    var omega = rad(125.04452 - 1934.136261 * t);
    var ls = rad(280.4665 + 36000.7698 * t);
    var lm = rad(218.3165 + 481267.8813 * t);
    var dPsi = (-17.20 * Math.sin(omega) - 1.32 * Math.sin(2 * ls) - 0.23 * Math.sin(2 * lm)
      + 0.21 * Math.sin(2 * omega)) / 3600;
    lon += dPsi;
    lon -= 20.4898 / 3600 / r;
    return normalizeDegrees(lon);
  }

  /** 태양 황경이 target도가 되는 순간 (UT 기준 JD). */
  function julianDayWhenLongitudeIs(target, guessUT) {
    var jd = guessUT;
    for (var i = 0; i < 12; i++) {
      var lon = apparentLongitude(ephemerisFromUT(jd));
      var diff = signedAngleDifference(target - lon);
      jd += diff * 365.2422 / 360.0;
      if (Math.abs(diff) < 1e-8) break;
    }
    return jd;
  }

  // MARK: - 24절기 (소한 0 … 동지 23)

  var TERM_NAMES = ["소한", "대한", "입춘", "우수", "경칩", "춘분", "청명", "곡우", "입하", "소만", "망종", "하지",
    "소서", "대서", "입추", "처서", "백로", "추분", "한로", "상강", "입동", "소설", "대설", "동지"];
  var SPRING_BEGINS = 2;
  var WINTER_SOLSTICE = 23;
  var termCache = {};

  /** 그 해 24절기의 순간 (UT 기준 JD). */
  function solarTermJulianDays(year) {
    if (termCache[year]) return termCache[year];
    var jan1 = jdnOf(year, 1, 1) - 0.5;
    var result = [];
    for (var i = 0; i < 24; i++) {
      var guess = jan1 + 5.0 + i * 15.2184;
      result.push(julianDayWhenLongitudeIs((285 + 15 * i) % 360, guess));
    }
    termCache[year] = result;
    return result;
  }
  function termMomentMs(term, year) { return msFromJulianDay(solarTermJulianDays(year)[term]); }
  /** 절(節)로 시작하는 사주 월의 지지. */
  function termMonthBranch(term) { return mod(idiv(term, 2) + 1, 12); }

  // MARK: - 합삭 (Meeus 49장)

  var SYNODIC = 29.530588861;
  var PLANETARY = [
    [0.000325, 299.77, 0.107408], [0.000165, 251.88, 0.016321], [0.000164, 251.83, 26.651886],
    [0.000126, 349.42, 36.412478], [0.000110, 84.66, 18.206239], [0.000062, 141.74, 53.303771],
    [0.000060, 207.14, 2.453732], [0.000056, 154.84, 7.306860], [0.000047, 34.52, 27.261239],
    [0.000042, 207.19, 0.121824], [0.000040, 291.34, 1.844379], [0.000037, 161.72, 24.198154],
    [0.000035, 239.56, 25.513099], [0.000023, 331.55, 3.592518]
  ];

  function newMoonJDE(k) {
    var t = k / 1236.85;
    var t2 = t * t, t3 = t2 * t, t4 = t3 * t;
    var jde = 2451550.09766 + SYNODIC * k + 0.00015437 * t2 - 0.000000150 * t3 + 0.00000000073 * t4;
    var e = 1 - 0.002516 * t - 0.0000074 * t2;
    var m = rad(2.5534 + 29.10535670 * k - 0.0000014 * t2 - 0.00000011 * t3);
    var mp = rad(201.5643 + 385.81693528 * k + 0.0107582 * t2 + 0.00001238 * t3 - 0.000000058 * t4);
    var f = rad(160.7108 + 390.67050284 * k - 0.0016118 * t2 - 0.00000227 * t3 + 0.000000011 * t4);
    var om = rad(124.7746 - 1.56375588 * k + 0.0020672 * t2 + 0.00000215 * t3);
    var sin = Math.sin;
    var c = 0.0;
    c += -0.40720 * sin(mp);
    c += 0.17241 * e * sin(m);
    c += 0.01608 * sin(2 * mp);
    c += 0.01039 * sin(2 * f);
    c += 0.00739 * e * sin(mp - m);
    c += -0.00514 * e * sin(mp + m);
    c += 0.00208 * e * e * sin(2 * m);
    c += -0.00111 * sin(mp - 2 * f);
    c += -0.00057 * sin(mp + 2 * f);
    c += 0.00056 * e * sin(2 * mp + m);
    c += -0.00042 * sin(3 * mp);
    c += 0.00042 * e * sin(m + 2 * f);
    c += 0.00038 * e * sin(m - 2 * f);
    c += -0.00024 * e * sin(2 * mp - m);
    c += -0.00017 * sin(om);
    c += -0.00007 * sin(mp + 2 * m);
    c += 0.00004 * sin(2 * mp - 2 * f);
    c += 0.00004 * sin(3 * m);
    c += 0.00003 * sin(mp + m - 2 * f);
    c += 0.00003 * sin(2 * mp + 2 * f);
    c += -0.00003 * sin(mp + m + 2 * f);
    c += 0.00003 * sin(mp - m + 2 * f);
    c += -0.00002 * sin(mp - m - 2 * f);
    c += -0.00002 * sin(3 * mp + m);
    c += 0.00002 * sin(4 * mp);
    jde += c;
    for (var i = 0; i < PLANETARY.length; i++) {
      var arg = PLANETARY[i][1] + PLANETARY[i][2] * k;
      if (i === 0) arg -= 0.009173 * t2;
      jde += PLANETARY[i][0] * Math.sin(rad(arg));
    }
    return jde;
  }

  /** startUT 이상 endUT 미만의 합삭 (UT 기준 JD). */
  function newMoons(startUT, endUT) {
    var k = Math.floor((startUT - 2451550.09766) / SYNODIC) - 1;
    var result = [];
    for (;;) {
      var jd = universalFromTT(newMoonJDE(k));
      if (jd >= endUT) break;
      if (jd >= startUT) result.push(jd);
      k += 1;
    }
    return result;
  }

  // MARK: - 한국 음력

  var JDN_1912 = jdnOf(1912, 1, 1);
  var JDN_1954 = jdnOf(1954, 3, 21);
  var JDN_1961 = jdnOf(1961, 8, 10);

  /** 그 순간의 한국 표준시 (시간, 서머타임 제외). */
  function standardOffsetHours(jd) {
    var approxDay = Math.floor(jd + 0.5 + 9.0 / 24.0);
    if (approxDay < JDN_1912) return 8.5;
    if (approxDay < JDN_1954) return 9;
    if (approxDay < JDN_1961) return 8.5;
    return 9;
  }
  function localDayNumber(jd) { return Math.floor(jd + standardOffsetHours(jd) / 24.0 + 0.5); }

  var cycleCache = {};
  var lunarYearCache = {};

  /** (y−1)년 동지가 든 달(11월)부터 y년 동지가 든 달 직전까지. */
  function lunarCycle(year) {
    if (cycleCache[year]) return cycleCache[year];
    var ws1 = solarTermJulianDays(year - 1)[WINTER_SOLSTICE];
    var ws2 = solarTermJulianDays(year)[WINTER_SOLSTICE];
    var d1 = localDayNumber(ws1);
    var d2 = localDayNumber(ws2);
    var moons = newMoons(ws1 - 45, ws2 + 45).map(localDayNumber);
    var i1 = -1, i2 = -1, i;
    for (i = 0; i < moons.length; i++) {
      if (moons[i] <= d1) i1 = i;
      if (moons[i] <= d2) i2 = i;
    }
    if (i1 < 0 || i2 < 0 || i2 + 1 >= moons.length) { cycleCache[year] = []; return []; }

    var principal = [];
    [year - 1, year].forEach(function (y) {
      var jds = solarTermJulianDays(y);
      for (var t = 1; t < 24; t += 2) principal.push(localDayNumber(jds[t]));
    });

    var count = i2 - i1;
    var leapOffset = null;
    if (count === 13) {
      for (var j = 1; j < count; j++) {
        var s = moons[i1 + j], e = moons[i1 + j + 1];
        var has = principal.some(function (p) { return p >= s && p < e; });
        if (!has) { leapOffset = j; break; }
      }
    }

    var result = [];
    var number = 11;
    for (var jj = 0; jj < count; jj++) {
      var isLeap = false;
      if (jj > 0) {
        if (jj === leapOffset) isLeap = true;
        else number = number % 12 + 1;
      }
      result.push({ number: number, isLeap: isLeap, start: moons[i1 + jj], end: moons[i1 + jj + 1] });
    }
    cycleCache[year] = result;
    return result;
  }

  /** 음력 한 해의 달들 (1월부터, 윤달 포함). */
  function lunarMonths(year) {
    if (lunarYearCache[year]) return lunarYearCache[year];
    var current = lunarCycle(year);
    var next = lunarCycle(year + 1);
    var months = [];
    var first = -1;
    for (var i = 0; i < current.length; i++) {
      if (current[i].number === 1 && !current[i].isLeap) { first = i; break; }
    }
    function push(m) {
      months.push({ year: year, number: m.number, isLeap: m.isLeap, firstDayJDN: m.start, dayCount: m.end - m.start });
    }
    if (first >= 0) for (var a = first; a < current.length; a++) push(current[a]);
    for (var b = 0; b < next.length; b++) {
      if (next[b].number === 1 && !next[b].isLeap) break;
      push(next[b]);
    }
    lunarYearCache[year] = months;
    return months;
  }

  function lunarFromSolar(date) {
    var jdn = jdnOf(date.year, date.month, date.day);
    var years = [date.year, date.year - 1];
    for (var y = 0; y < years.length; y++) {
      var months = lunarMonths(years[y]);
      for (var i = 0; i < months.length; i++) {
        var m = months[i];
        if (jdn >= m.firstDayJDN && jdn < m.firstDayJDN + m.dayCount) {
          return { year: m.year, month: m.number, day: jdn - m.firstDayJDN + 1, isLeapMonth: m.isLeap };
        }
      }
    }
    return null;
  }

  function solarFromLunar(year, month, day, isLeap) {
    var months = lunarMonths(year);
    for (var i = 0; i < months.length; i++) {
      var m = months[i];
      if (m.number === month && m.isLeap === !!isLeap) {
        if (day < 1 || day > m.dayCount) return null;
        return dateFromJDN(m.firstDayJDN + day - 1);
      }
    }
    return null;
  }

  function lunarLeapMonth(year) {
    var months = lunarMonths(year);
    for (var i = 0; i < months.length; i++) if (months[i].isLeap) return months[i].number;
    return null;
  }

  // MARK: - 한국 시간대 (Asia/Seoul, 서머타임·옛 표준시 포함)

  var seoulFormatter = null;
  /** 그 순간 한국 시계의 UTC 오프셋 (초). 브라우저의 IANA 시간대 데이터를 쓴다. */
  function seoulOffsetSeconds(ms) {
    if (!seoulFormatter) {
      seoulFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Seoul", hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
        hour: "numeric", minute: "numeric", second: "numeric", era: "short"
      });
    }
    var whole = Math.floor(ms / 1000) * 1000;
    var parts = {};
    seoulFormatter.formatToParts(new Date(whole)).forEach(function (p) { parts[p.type] = p.value; });
    var year = parseInt(parts.year, 10);
    if (parts.era && /^B/.test(parts.era)) year = 1 - year;
    var hour = parseInt(parts.hour, 10) % 24;
    var local = Date.UTC(year, parseInt(parts.month, 10) - 1, parseInt(parts.day, 10), hour,
      parseInt(parts.minute, 10), parseInt(parts.second, 10));
    return Math.round((local - whole) / 1000);
  }

  /** 한국 시계로 y-m-d h:mi 인 순간 (ms). 겹치는 시각은 앞의 것, 없는 시각(서머타임 시작)은 바뀌기 전 오프셋으로. */
  function seoulWallTimeToMs(y, m, d, h, mi) {
    var wall = Date.UTC(y, m - 1, d, h, mi);
    var offsets = {};
    [-36, -12, 0, 12, 36].forEach(function (hours) {
      offsets[seoulOffsetSeconds(wall - 9 * 3600000 + hours * 3600000)] = true;
    });
    var candidates = [];
    Object.keys(offsets).forEach(function (k) {
      var o = parseInt(k, 10);
      var ms = wall - o * 1000;
      if (seoulOffsetSeconds(ms) === o) candidates.push(ms);
    });
    if (candidates.length) return Math.min.apply(null, candidates);
    // 없는 시각: 바뀌기 직전 오프셋으로 계산 (시계를 앞으로 민 결과)
    var before = seoulOffsetSeconds(wall - 9 * 3600000 - 6 * 3600000);
    return wall - before * 1000;
  }

  function kstDateOf(ms) {
    var d = new Date(Math.floor(ms) + 9 * 3600000);
    return civil(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  /** 한국 날짜로 오늘. */
  function todayInKorea(nowMs) {
    return kstDateOf(nowMs == null ? Date.now() : nowMs);
  }

  // MARK: - 사주 계산

  var BIRTH_CALENDARS = { solar: "양력", lunar: "음력", lunarLeap: "음력(윤달)" };
  var SEOUL_LONGITUDE = 126.978;

  function SajuError(code, message) {
    this.code = code;
    this.message = message;
  }
  SajuError.prototype = Object.create(Error.prototype);
  SajuError.prototype.name = "SajuError";

  function sajuYear(ms) {
    var y = kstDateOf(ms).year;
    return ms < termMomentMs(SPRING_BEGINS, y) ? y - 1 : y;
  }
  function yearPillarAt(ms) { return pillarFromIndex(sajuYear(ms) - 4); }
  function yearPillarOf(year) { return pillarFromIndex(year - 4); }

  function currentMonthBoundaryTerm(ms) {
    var y = kstDateOf(ms).year;
    var best = null;
    [y - 1, y].forEach(function (year) {
      for (var t = 0; t < 24; t += 2) {
        var m = termMomentMs(t, year);
        if (m <= ms && (best === null || m > best.ms)) best = { term: t, ms: m };
      }
    });
    return best;
  }

  /** 년상기월법. */
  function monthPillarOf(branch, yearStem) {
    var yinStem = mod(yearStem * 2 + 2, 10);
    var offset = mod(branch - 2, 12);
    return makePillar((yinStem + offset) % 10, branch);
  }
  function monthPillarAt(ms) {
    var branch = termMonthBranch(currentMonthBoundaryTerm(ms).term);
    return monthPillarOf(branch, yearPillarAt(ms).stem);
  }

  /** 날짜의 일진. (JDN − 11) mod 60. */
  function dayPillarOf(date) { return pillarFromIndex(jdnOf(date.year, date.month, date.day) - 11); }

  /** 일상기시법. */
  function hourPillarOf(branch, dayStem) {
    var ziStem = (dayStem * 2) % 10;
    return makePillar((ziStem + branch) % 10, branch);
  }

  /** 일주·시주용 현지 시각. 보정 켬: UTC + 경도×4분. 끔: 표준시 (서머타임만 뺀 값, 근사). */
  function effectiveLocalTime(ms, longitude, appliesCorrection) {
    var offset;
    if (appliesCorrection) {
      offset = longitude * 240.0;
    } else {
      // 서머타임이면 한 시간을 뺀다 (한국 서머타임은 모두 +1시간).
      var clock = seoulOffsetSeconds(ms);
      var standard = standardOffsetHours(julianDayFromMs(ms)) * 3600;
      offset = clock - standard >= 3600 ? clock - 3600 : clock;
    }
    var shifted = new Date(Math.floor(ms + offset * 1000));
    return {
      date: civil(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate()),
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
      offsetSeconds: offset
    };
  }

  function countElements(pillars) {
    var counts = [0, 0, 0, 0, 0];
    pillars.forEach(function (p) {
      counts[Stem.element(p.stem)] += 1;
      counts[Branch.element(p.branch)] += 1;
    });
    return counts;
  }

  /** 오행 분석 (MVP: 글자 수 세기). */
  function analyzeElements(counts, season) {
    var min = Math.min.apply(null, counts);
    var max = Math.max.apply(null, counts);
    var lacking = Element.all.filter(function (e) { return counts[e] === min; })
      .sort(function (a, b) { return Element.seasonalStrength(a, season) - Element.seasonalStrength(b, season); });
    var dominant = Element.all.filter(function (e) { return counts[e] === max; })
      .sort(function (a, b) { return Element.seasonalStrength(b, season) - Element.seasonalStrength(a, season); });
    var total = counts.reduce(function (s, c) { return s + c; }, 0);
    var balance = 0;
    if (total > 0) {
      var mean = total / 5;
      var variance = counts.reduce(function (s, c) { return s + Math.pow(c - mean, 2); }, 0) / 5;
      balance = roundHalfAway((1 - variance / (mean * mean * 4)) * 100);
    }
    return {
      counts: counts,
      season: season,
      lacking: lacking,
      missing: Element.all.filter(function (e) { return counts[e] === 0; }),
      dominant: dominant,
      primaryLacking: lacking[0],
      primaryDominant: dominant[0],
      balanceScore: balance
    };
  }

  /**
   * 사주 원국.
   * input: { year, month, day, calendar: "solar"|"lunar"|"lunarLeap", hour: 0~23|null, minute, gender: "female"|"male", longitude }
   * options: { ziHourRule: "dayChangesAtZi"|"splitNightZi", appliesSolarTimeCorrection: true }
   */
  function chart(input, options) {
    options = options || {};
    var ziRule = options.ziHourRule || "dayChangesAtZi";
    var correction = options.appliesSolarTimeCorrection !== false;
    var longitude = typeof input.longitude === "number" ? input.longitude : SEOUL_LONGITUDE;
    var calendar = input.calendar || "solar";
    var hour = input.hour == null ? null : input.hour;
    var minute = input.minute == null ? null : input.minute;

    if (!(input.year >= 1900 && input.year <= 2100)) {
      throw new SajuError("unsupportedYear", input.year + "년은 지원 범위(1900~2100년) 밖이에요.");
    }
    var solar;
    if (calendar === "solar") {
      if (!isValidDate(input.year, input.month, input.day)) throw new SajuError("invalidDate", "존재하지 않는 날짜예요.");
      solar = civil(input.year, input.month, input.day);
    } else {
      solar = solarFromLunar(input.year, input.month, input.day, calendar === "lunarLeap");
      if (!solar) throw new SajuError("lunarDateNotFound", "해당 음력 날짜가 없어요. 윤달·작은달 여부를 확인해 주세요.");
    }
    if (hour !== null && !(hour >= 0 && hour <= 23)) throw new SajuError("invalidDate", "존재하지 않는 날짜예요.");
    if (minute !== null && !(minute >= 0 && minute <= 59)) throw new SajuError("invalidDate", "존재하지 않는 날짜예요.");

    var clockHour = hour === null ? 12 : hour;
    var clockMinute = hour === null ? 0 : (minute || 0);
    var instant = seoulWallTimeToMs(solar.year, solar.month, solar.day, clockHour, clockMinute);

    var effective = effectiveLocalTime(instant, longitude, correction);
    var clockSeconds = seoulOffsetSeconds(instant);
    var correctionMinutes = roundHalfAway((effective.offsetSeconds - clockSeconds) / 60);

    var yearP = yearPillarAt(instant);
    var monthP = monthPillarAt(instant);

    var dayP, hourP = null, corrected = null;
    if (hour === null) {
      dayP = dayPillarOf(effective.date);
    } else {
      corrected = { hour: effective.hour, minute: effective.minute };
      var branch = mod(idiv(effective.hour + 1, 2), 12);
      var isLateZi = effective.hour >= 23;
      if (ziRule === "splitNightZi") {
        dayP = dayPillarOf(effective.date);
        var stemDay = isLateZi ? dayPillarOf(addDays(effective.date, 1)) : dayP;
        hourP = hourPillarOf(branch, stemDay.stem);
      } else {
        dayP = dayPillarOf(isLateZi ? addDays(effective.date, 1) : effective.date);
        hourP = hourPillarOf(branch, dayP.stem);
      }
    }

    var lunar = calendar === "solar" ? lunarFromSolar(solar)
      : { year: input.year, month: input.month, day: input.day, isLeapMonth: calendar === "lunarLeap" };

    var pillars = [yearP, monthP, dayP].concat(hourP ? [hourP] : []);
    var counts = countElements(pillars);
    var season = Branch.element(monthP.branch);

    return {
      input: {
        year: input.year, month: input.month, day: input.day, calendar: calendar,
        hour: hour, minute: hour === null ? null : (minute || 0), gender: input.gender || "female", longitude: longitude
      },
      options: { ziHourRule: ziRule, appliesSolarTimeCorrection: correction },
      solarBirthDate: solar,
      lunarBirthDate: lunar,
      birthInstantMs: instant,
      correctedTime: corrected,
      correctionMinutes: correctionMinutes,
      year: yearP,
      month: monthP,
      day: dayP,
      hour: hourP,
      dayMaster: dayP.stem,
      zodiacAnimal: Branch.animal(yearP.branch),
      isTimeKnown: hourP !== null,
      counts: counts,
      seasonElement: season,
      analysis: analyzeElements(counts, season)
    };
  }

  // MARK: - 오늘의 기운

  var DAILY_HEADLINES = {
    companion: "나와 같은 기운이 들어오는 날. 자신감은 오르고, 고집은 살짝 내려놓기.",
    robWealth: "경쟁심이 올라오는 날. 충동 소비와 감정 소모를 조심해요.",
    eatingGod: "표현력과 먹는 즐거움이 커지는 날. 맛있는 걸로 나를 채워요.",
    hurtingOfficer: "아이디어와 말이 날카로워지는 날. 표현은 부드럽게.",
    indirectWealth: "활동적인 재물 기운. 뜻밖의 기회를 잡기 좋은 날.",
    directWealth: "꼼꼼한 재물 기운. 계획한 소비가 잘 맞는 날.",
    sevenKillings: "책임감과 압박이 느껴지는 날. 무리하지 말고 페이스 조절.",
    directOfficer: "규칙과 신뢰의 날. 약속을 지키면 평가가 오르는 날.",
    indirectResource: "직감과 영감이 살아나는 날. 혼자만의 시간이 힘이 돼요.",
    directResource: "도움과 배움의 날. 주변의 조언에 귀 기울이면 좋아요."
  };

  function daily(c, date) {
    var pillar = dayPillarOf(date);
    var noon = seoulWallTimeToMs(date.year, date.month, date.day, 12, 0);
    var todaySeason = Branch.element(monthPillarAt(noon).branch);
    var base = c.analysis;
    var combined = c.counts.slice();
    var se = Stem.element(pillar.stem), be = Branch.element(pillar.branch);
    combined[se] += 1;
    combined[be] += 1;
    function inToday(e) { return e === se || e === be; }

    var min = Math.min.apply(null, combined);
    var focus = Element.all.filter(function (e) { return combined[e] === min; }).sort(function (a, b) {
      var ta = inToday(a), tb = inToday(b);
      if (ta !== tb) return ta ? 1 : -1;
      var la = base.lacking.indexOf(a) >= 0, lb = base.lacking.indexOf(b) >= 0;
      if (la !== lb) return la ? -1 : 1;
      return Element.seasonalStrength(a, todaySeason) - Element.seasonalStrength(b, todaySeason);
    })[0];
    var max = Math.max.apply(null, combined);
    var strong = Element.all.filter(function (e) { return combined[e] === max; }).sort(function (a, b) {
      var ta = inToday(a), tb = inToday(b);
      if (ta !== tb) return ta ? -1 : 1;
      return Element.seasonalStrength(b, todaySeason) - Element.seasonalStrength(a, todaySeason);
    })[0];

    var supplies = inToday(base.primaryLacking);
    var stemGod = tenGodOfStem(pillar.stem, c.dayMaster);
    var branchGod = tenGodOfBranch(pillar.branch, c.dayMaster);
    var K = ELEMENT_KOREAN;

    var detail = "오늘 일진은 " + pillar.korean + "(" + pillar.hanja + ")일. ";
    detail += K[se] + "·" + K[be] + " 기운이 들어와 " + K[strong] + " 기운이 강해져요. ";
    if (supplies && focus !== base.primaryLacking) {
      detail += "평소 부족한 " + K[base.primaryLacking] + " 기운이 일진으로 채워지는 날이라, 오늘은 " + K[focus] + " 기운을 더해 균형을 맞춰 보세요.";
    } else if (supplies) {
      detail += "일진이 부족한 " + K[focus] + " 기운을 조금 채워 주지만 여전히 가장 적어요. " + K[focus] + " 기운을 더 챙겨 보세요.";
    } else {
      detail += K[focus] + " 기운을 채우면 하루의 균형이 좋아져요.";
    }

    return {
      date: date,
      dayPillar: pillar,
      lunarDate: lunarFromSolar(date),
      stemTenGod: stemGod,
      branchTenGod: branchGod,
      combinedCounts: combined,
      focusElement: focus,
      strongElement: strong,
      suppliesLifetimeLack: supplies,
      headline: DAILY_HEADLINES[stemGod.key],
      detail: detail
    };
  }

  // MARK: - 오행 해설 (앱의 ElementContent와 같은 문구)

  var CONTENT = [
    {
      keywords: "성장 · 시작 · 기획",
      lackDescription: "목(木)은 봄의 새싹처럼 뻗어 나가는 힘이에요. 이 기운이 적으면 새로운 일을 시작하거나 계획을 끝까지 밀고 나가는 추진력이 약해지기 쉬워요. 초록색, 식물, 원목·종이 소재로 성장의 기운을 채워 보세요.",
      fillHint: "초록색 · 식물 · 원목 소재 · 신맛",
      shortHint: "초록 소품과 식물로 성장 기운 채우기"
    },
    {
      keywords: "열정 · 표현 · 활력",
      lackDescription: "화(火)는 여름 햇볕처럼 밝게 드러나는 힘이에요. 이 기운이 적으면 의욕이 쉽게 식거나 나를 표현하는 데 망설이게 돼요. 빨강·주황 컬러, 따뜻한 조명과 캔들로 활력을 더해 보세요.",
      fillHint: "빨강 · 주황 · 조명 · 캔들 · 쓴맛",
      shortHint: "따뜻한 빛과 붉은 컬러로 활력 채우기"
    },
    {
      keywords: "안정 · 신뢰 · 중심",
      lackDescription: "토(土)는 모든 것을 받쳐 주는 땅의 힘이에요. 이 기운이 적으면 마음이 붕 뜨거나 생활 리듬이 흔들리기 쉬워요. 베이지·브라운 컬러, 도자기와 흙 소재, 달콤한 간식으로 중심을 잡아 보세요.",
      fillHint: "베이지 · 브라운 · 도자기 · 단맛",
      shortHint: "도자기·베이지 톤으로 안정감 채우기"
    },
    {
      keywords: "결단 · 정리 · 원칙",
      lackDescription: "금(金)은 가을 서리처럼 단단하게 맺고 끊는 힘이에요. 이 기운이 적으면 결정을 미루거나 정리정돈이 어려워질 수 있어요. 흰색·실버 컬러, 메탈·스테인리스 소재, 액세서리로 단단함을 더해 보세요.",
      fillHint: "흰색 · 실버 · 메탈 소재 · 매운맛",
      shortHint: "메탈·화이트 아이템으로 결단력 채우기"
    },
    {
      keywords: "지혜 · 유연 · 휴식",
      lackDescription: "수(水)는 겨울 물처럼 깊이 스며드는 힘이에요. 이 기운이 적으면 쉬지 못하고 긴장하거나 생각이 굳어지기 쉬워요. 검정·네이비 컬러, 유리와 물 관련 아이템, 충분한 수분으로 유연함을 채워 보세요.",
      fillHint: "검정 · 네이비 · 유리 · 물 · 짠맛",
      shortHint: "물·유리·네이비 톤으로 유연함 채우기"
    }
  ];

  // MARK: - 상품 추천 (앱의 Recommender와 같은 방식)

  var PRICE_TIERS = ["1만원 이하", "1만원대", "2~3만원대", "5만원 이상"];
  var SEASON_KOREAN = ["봄", "여름", "가을", "겨울"];

  function seasonOfMonth(month) {
    if (month >= 3 && month <= 5) return "봄";
    if (month >= 6 && month <= 8) return "여름";
    if (month >= 9 && month <= 11) return "가을";
    return "겨울";
  }

  var FNV_OFFSET = typeof BigInt === "function" ? BigInt("0xcbf29ce484222325") : null;
  var FNV_PRIME = typeof BigInt === "function" ? BigInt("0x100000001b3") : null;
  var MASK64 = typeof BigInt === "function" ? BigInt("0xffffffffffffffff") : null;
  var encoder = typeof TextEncoder === "function" ? new TextEncoder() : null;

  /** FNV-1a 64비트 (앱의 StableHash와 같다). */
  function stableHash(str) {
    var h = FNV_OFFSET;
    var bytes = encoder.encode(str);
    for (var i = 0; i < bytes.length; i++) {
      h ^= BigInt(bytes[i]);
      h = (h * FNV_PRIME) & MASK64;
    }
    return h;
  }
  /** 시드 문자열 → [0, 1). */
  function unit(str) { return Number(stableHash(str) >> BigInt(11)) / 9007199254740992; }
  function drawKey(str, weight) { return -Math.log(1 - unit(str)) / Math.max(weight, 0.0001); }

  function popularityFactor(p) {
    switch (p.popularity) {
      case 1: return 0.5;
      case 2: return 0.75;
      case 4: return 1.5;
      case 5: return 2.5;
      default: return 1;
    }
  }

  /** audience: { gender: "female"|"male", ageBand: 10~60 } */
  function makeAudience(gender, birthYear, today) {
    var band = Math.min(Math.max(idiv(today.year - birthYear, 10) * 10, 10), 60);
    return { gender: gender, ageBand: band };
  }
  function suits(p, audience) { return !audience || !p.gender || p.gender === audience.gender; }
  function weight(p, audience) {
    var w = popularityFactor(p);
    if (!audience) return w;
    if (p.gender && p.gender === audience.gender) w *= 1.5;
    if (p.ages && p.ages.length) {
      var distance = Math.min.apply(null, p.ages.map(function (a) { return idiv(Math.abs(a - audience.ageBand), 10); }));
      if (distance === 0) w *= 3;
      else if (distance > 1) w *= 0.3;
    }
    return w;
  }

  function isUsableProduct(p) {
    return p && p.id && p.title && Element.fromName(p.element) !== null && /^https:\/\//.test(p.partnerUrl || "");
  }

  function priceMatches(filter, priceRange) {
    var tier = PRICE_TIERS.indexOf(priceRange) >= 0 ? priceRange : "1만원대";
    if (filter === "small") return tier === "1만원 이하";
    if (filter === "gift") return tier !== "1만원 이하";
    return true;
  }

  function candidates(products, element, filter, season) {
    return products.filter(function (p) {
      return Element.fromName(p.element) === element && priceMatches(filter || "all", p.priceRange) &&
        (!season || (p.season || []).indexOf("all") >= 0 || (p.season || []).indexOf(season) >= 0);
    });
  }

  /**
   * opts: { count, seed, filter, season, audience, recentlyViewed: [ids], avoiding: [ids] }
   */
  function pick(products, element, opts) {
    var count = opts.count;
    var pool = candidates(products, element, opts.filter, opts.season);
    if (pool.length < count) {
      pool = candidates(products, element, opts.filter);
      if (pool.length < count) pool = candidates(products, element);
    }
    var avoid = opts.avoiding || [];
    var recent = opts.recentlyViewed || [];
    var audience = opts.audience || null;
    var ordered = pool
      .filter(function (p) { return avoid.indexOf(p.id) < 0; })
      .map(function (p) { return { p: p, k: drawKey(opts.seed + p.id, weight(p, audience)) }; })
      .sort(function (a, b) { return a.k - b.k; })
      .map(function (x) { return x.p; });
    var suited = ordered.filter(function (p) { return suits(p, audience); });
    var unsuited = ordered.filter(function (p) { return !suits(p, audience); });
    var isRecent = function (p) { return recent.indexOf(p.id) >= 0; };
    var fresh = suited.filter(function (p) { return !isRecent(p); });
    var seen = suited.filter(isRecent);
    var fallback = unsuited.filter(function (p) { return !isRecent(p); }).concat(unsuited.filter(isRecent));

    var result = [];
    var used = {};
    fresh.forEach(function (p) {
      if (result.length < count && !used[p.category]) { result.push(p); used[p.category] = true; }
    });
    fresh.concat(seen, fallback).forEach(function (p) {
      if (result.length < count && result.indexOf(p) < 0) result.push(p);
    });
    return result;
  }

  /** 평생 보완템. */
  function lifetimePicks(products, element, personID, audience, count) {
    return pick(products, element, { count: count || 6, seed: "lifetime-" + personID, audience: audience });
  }
  /** 그날의 보완템. */
  function dailyPicks(products, element, date, personID, audience, count, avoiding) {
    return pick(products, element, {
      count: count || 3, seed: "daily-" + dateString(date) + "-" + personID,
      season: seasonOfMonth(date.month), audience: audience, avoiding: avoiding
    });
  }

  // MARK: - 내보내기

  return {
    Element: Element,
    Stem: Stem,
    Branch: Branch,
    SajuError: SajuError,
    BIRTH_CALENDARS: BIRTH_CALENDARS,
    SEOUL_LONGITUDE: SEOUL_LONGITUDE,
    TERM_NAMES: TERM_NAMES,
    content: function (e) { return CONTENT[e]; },
    chart: chart,
    daily: daily,
    tenGodOfStem: tenGodOfStem,
    tenGodOfBranch: tenGodOfBranch,
    dayPillarOf: dayPillarOf,
    monthPillarAt: monthPillarAt,
    yearPillarOf: yearPillarOf,
    solarTermMomentMs: termMomentMs,
    lunarFromSolar: lunarFromSolar,
    solarFromLunar: solarFromLunar,
    lunarLeapMonth: lunarLeapMonth,
    isValidDate: isValidDate,
    daysInMonth: daysInMonth,
    addDays: addDays,
    dateString: dateString,
    todayInKorea: todayInKorea,
    seoulWallTimeToMs: seoulWallTimeToMs,
    seoulOffsetSeconds: seoulOffsetSeconds,
    stableHash: stableHash,
    unit: unit,
    seasonOfMonth: seasonOfMonth,
    makeAudience: makeAudience,
    isUsableProduct: isUsableProduct,
    pick: pick,
    lifetimePicks: lifetimePicks,
    dailyPicks: dailyPicks
  };
});
