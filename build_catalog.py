#!/usr/bin/env python3
"""상품 시트(CSV) → 앱이 받아 가는 products.json.

표준 라이브러리만 쓴다 (GitHub Actions에서 설치 없이 실행).

사용 예:
  # 로컬 CSV로 만들기 (파트너스 링크가 없는 상품은 빠짐)
  python3 build_catalog.py --csv products.csv --out dist/products.json

  # 구글 시트 '웹에 게시' CSV 주소로 만들기 (환경 변수 SHEET_CSV_URL도 됨)
  python3 build_catalog.py --csv-url "https://docs.google.com/.../pub?output=csv" --out dist/products.json

  # 앱 번들용 스냅샷 (링크가 없는 상품은 쿠팡 검색 주소로 임시 채움 — 개발용)
  python3 build_catalog.py --csv products.csv --allow-placeholder --out ../SajuShopping/Resources/products.json

파트너스 링크 채우는 순서:
  1. 시트의 '파트너스 링크' 칸
  2. --link-cache 파일 (이전에 API로 바꾼 링크)
  3. 쿠팡 파트너스 API (COUPANG_ACCESS_KEY, COUPANG_SECRET_KEY 환경 변수가 있을 때) — '검색어'의 쿠팡 검색 주소를 변환
  4. --allow-placeholder 면 쿠팡 검색 주소 (수수료 없음, 개발용)
  5. 그래도 없으면 그 상품은 빼고 경고
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import hmac
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

SCHEMA = 1

ELEMENTS = {
    "목": "목", "木": "목", "나무": "목", "wood": "목",
    "화": "화", "火": "화", "불": "화", "fire": "화",
    "토": "토", "土": "토", "흙": "토", "earth": "토",
    "금": "금", "金": "금", "쇠": "금", "metal": "금",
    "수": "수", "水": "수", "물": "수", "water": "수",
}
PRICE_TIERS = ["1만원 이하", "1만원대", "2~3만원대", "5만원 이상"]
SEASONS = {"봄", "여름", "가을", "겨울"}
ALL_SEASON_WORDS = {"", "all", "전체", "사계절", "상시"}
# 성별: 비우면 누구나. 한쪽 성별 전용 상품만 적는다.
GENDERS = {"여성": "female", "여": "female", "female": "female", "f": "female",
           "남성": "male", "남": "male", "male": "male", "m": "male"}
ANY_GENDER_WORDS = {"", "공용", "누구나", "전체", "남녀", "남녀공용", "all", "any"}
# 연령대: 비우면 모든 나이. 10 = 10대 이하, 60 = 60대 이상.
AGE_BANDS = {10, 20, 30, 40, 50, 60}
ALL_AGE_WORDS = {"", "전체", "모든 나이", "누구나", "all"}
PARTNER_HOSTS = {"link.coupang.com", "coupa.ng"}
ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{1,63}$")

# 시트 머리글 → 필드 이름. 영어 머리글도 받는다.
HEADERS = {
    "사용": "active", "active": "active",
    "id": "id", "아이디": "id",
    "오행": "element", "element": "element",
    "카테고리": "category", "category": "category",
    "상품명": "title", "title": "title",
    "추천 이유": "reason", "reason": "reason",
    "가격대": "priceRange", "pricerange": "priceRange",
    "색상": "colors", "colors": "colors",
    "계절": "season", "season": "season",
    "성별": "gender", "gender": "gender",
    "연령대": "ages", "ages": "ages", "나이대": "ages",
    "로켓배송": "rocket", "rocket": "rocket",
    "검색어": "keyword", "keyword": "keyword",
    "파트너스 링크": "partnerUrl", "partnerurl": "partnerUrl",
    "이미지 주소": "imageUrl", "imageurl": "imageUrl",
    "아이콘": "symbol", "symbol": "symbol",
    "메모": "memo", "memo": "memo",
}
REQUIRED = ["id", "element", "category", "title", "reason", "priceRange"]

YES = {"y", "yes", "o", "true", "1", "예", "네", "ㅇ", "사용", "✓", "✔"}
NO = {"n", "no", "x", "false", "0", "아니오", "아니요", "ㄴ", "숨김", "미사용"}


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []    # 행을 뺀 이유
        self.warnings: list[str] = []  # 행은 넣었지만 확인할 것
        self.fatal: list[str] = []     # 배포를 막는 문제
        self.missing_links = 0         # 파트너스 링크가 없어 뺀 행 수
        self.coverage_fatal = 0        # 오행별 개수 부족으로 막힌 수

    @property
    def problem(self) -> str:
        """none / links-only (링크를 아직 덜 채운 것뿐) / errors."""
        if not self.fatal:
            return "none"
        only_coverage = self.coverage_fatal == len(self.fatal)
        only_links = self.missing_links == len(self.errors)
        return "links-only" if only_coverage and only_links else "errors"

    def row(self, line: int, ident: str, message: str) -> None:
        self.errors.append(f"{line}행 ({ident or 'id 없음'}): {message}")


def read_csv_text(path: str | None, url: str | None) -> str:
    if url:
        req = urllib.request.Request(url, headers={"User-Agent": "saju-catalog-builder"})
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.read().decode("utf-8-sig")
    if not path:
        raise SystemExit("--csv 또는 --csv-url(SHEET_CSV_URL)이 필요해요.")
    with open(path, encoding="utf-8-sig") as f:
        return f.read()


def split_list(value: str) -> list[str]:
    return [v.strip() for v in re.split(r"[,/·|]", value) if v.strip()]


def parse_bool(value: str, default: bool) -> bool | None:
    v = value.strip().lower()
    if not v:
        return default
    if v in YES:
        return True
    if v in NO:
        return False
    return None


def search_url(keyword: str) -> str:
    return "https://www.coupang.com/np/search?q=" + urllib.parse.quote(keyword)


def is_partner_url(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    return parsed.scheme == "https" and parsed.hostname in PARTNER_HOSTS


def parse_rows(text: str, report: Report) -> list[dict]:
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        report.fatal.append("시트가 비어 있어요.")
        return []
    header = [HEADERS.get(h.strip().lower(), HEADERS.get(h.strip())) for h in rows[0]]
    missing = [k for k in REQUIRED if k not in header]
    if missing:
        report.fatal.append(f"머리글에 필요한 칸이 없어요: {', '.join(missing)}")
        return []

    products: list[dict] = []
    seen: dict[str, int] = {}
    for line, cells in enumerate(rows[1:], start=2):
        raw = {header[i]: (cells[i].strip() if i < len(cells) else "")
               for i in range(len(header)) if header[i]}
        if not any(raw.values()):
            continue  # 빈 줄
        ident = raw.get("id", "")

        active = parse_bool(raw.get("active", ""), default=True)
        if active is None:
            report.row(line, ident, f"'사용' 값을 알 수 없어요: {raw.get('active')} (Y 또는 N)")
            continue
        if not active:
            continue

        problems = []
        for key in REQUIRED:
            if not raw.get(key):
                problems.append(f"'{key}' 칸이 비어 있어요")
        if ident and not ID_PATTERN.match(ident):
            problems.append("id는 영문 소문자·숫자·하이픈만 (예: water-tumbler-01)")
        element = ELEMENTS.get(raw.get("element", "").strip().lower(), ELEMENTS.get(raw.get("element", "")))
        if raw.get("element") and not element:
            problems.append(f"오행은 목·화·토·금·수 중 하나: {raw.get('element')}")
        price = raw.get("priceRange", "").replace(" ", "")
        price = next((p for p in PRICE_TIERS if p.replace(" ", "") == price), None)
        if raw.get("priceRange") and not price:
            problems.append(f"가격대는 {' / '.join(PRICE_TIERS)} 중 하나: {raw.get('priceRange')}")

        season_raw = raw.get("season", "")
        if season_raw.strip().lower() in ALL_SEASON_WORDS:
            season = ["all"]
        else:
            season = split_list(season_raw)
            bad = [s for s in season if s not in SEASONS]
            if bad:
                problems.append(f"계절은 봄·여름·가을·겨울 (비우면 사계절): {', '.join(bad)}")

        gender_raw = raw.get("gender", "").strip()
        gender = None
        if gender_raw.lower() not in ANY_GENDER_WORDS:
            gender = GENDERS.get(gender_raw.lower())
            if not gender:
                problems.append(f"성별은 여성·남성 중 하나 (누구나면 비워 두기): {gender_raw}")

        ages_raw = raw.get("ages", "").strip()
        ages: list[int] = []
        if ages_raw.lower() not in ALL_AGE_WORDS:
            for part in split_list(ages_raw):
                digits = re.sub(r"[^0-9]", "", part)
                band = int(digits) if digits else -1
                if band in AGE_BANDS:
                    ages.append(band)
                else:
                    problems.append(f"연령대는 10대·20대·30대·40대·50대·60대 (모든 나이면 비워 두기): {part}")
            ages = sorted(set(ages))

        rocket = parse_bool(raw.get("rocket", ""), default=False)
        if rocket is None:
            problems.append(f"'로켓배송' 값을 알 수 없어요: {raw.get('rocket')}")

        link = raw.get("partnerUrl", "")
        if link and not is_partner_url(link):
            problems.append("파트너스 링크는 https://link.coupang.com/… 주소여야 해요 (일반 쿠팡 주소는 수수료가 안 붙어요)")
        image = raw.get("imageUrl", "")
        if image and not image.startswith("https://"):
            problems.append("이미지 주소는 https:// 로 시작해야 해요")

        if problems:
            report.row(line, ident, "; ".join(problems))
            continue
        if ident in seen:
            report.fatal.append(f"id가 겹쳐요: {ident} ({seen[ident]}행, {line}행)")
            continue
        seen[ident] = line

        product = {
            "id": ident,
            "title": raw["title"],
            "element": element,
            "category": raw["category"],
            "colors": split_list(raw.get("colors", "")),
            "priceRange": price,
            "reason": raw["reason"],
            "season": season,
            "partnerUrl": link,
            "rocket": bool(rocket),
        }
        if image:
            product["imageUrl"] = image
        if raw.get("symbol"):
            product["symbol"] = raw["symbol"]
        if gender:
            product["gender"] = gender
        if ages:
            product["ages"] = ages
        product["_keyword"] = raw.get("keyword") or raw["title"]
        product["_line"] = line
        products.append(product)
    return products


# MARK: - 쿠팡 파트너스 API (딥링크 변환)

API_DOMAIN = "https://api-gateway.coupang.com"
DEEPLINK_PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink"


def _authorization(method: str, path: str, query: str, access_key: str, secret_key: str) -> str:
    signed_date = time.strftime("%y%m%dT%H%M%SZ", time.gmtime())
    message = signed_date + method + path + query
    signature = hmac.new(secret_key.encode(), message.encode(), hashlib.sha256).hexdigest()
    return (f"CEA algorithm=HmacSHA256, access-key={access_key}, "
            f"signed-date={signed_date}, signature={signature}")


def convert_with_api(urls: list[str], access_key: str, secret_key: str, sub_id: str | None,
                     report: Report) -> dict[str, str]:
    """쿠팡 주소 → 파트너스 단축 링크. 실패한 주소는 결과에 없다."""
    result: dict[str, str] = {}
    for start in range(0, len(urls), 20):
        batch = urls[start:start + 20]
        body: dict = {"coupangUrls": batch}
        if sub_id:
            body["subId"] = sub_id
        req = urllib.request.Request(
            API_DOMAIN + DEEPLINK_PATH,
            data=json.dumps(body).encode(),
            method="POST",
            headers={
                "Authorization": _authorization("POST", DEEPLINK_PATH, "", access_key, secret_key),
                "Content-Type": "application/json;charset=UTF-8",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                payload = json.loads(res.read().decode())
        except urllib.error.HTTPError as e:
            report.warnings.append(f"파트너스 API 오류 {e.code}: {e.read().decode(errors='replace')[:200]}")
            break
        except Exception as e:  # noqa: BLE001 — 네트워크 오류는 경고로만
            report.warnings.append(f"파트너스 API 호출 실패: {e}")
            break
        if str(payload.get("rCode")) != "0":
            report.warnings.append(f"파트너스 API 응답 오류: {payload.get('rCode')} {payload.get('rMessage')}")
            break
        for item in payload.get("data") or []:
            original, short = item.get("originalUrl"), item.get("shortenUrl")
            if original and short and is_partner_url(short):
                result[original] = short
        time.sleep(1.2)  # 호출 한도 여유
    return result


# MARK: - 링크 채우기

def fill_links(products: list[dict], cache: dict[str, str], allow_placeholder: bool,
               report: Report) -> list[dict]:
    access = os.environ.get("COUPANG_ACCESS_KEY", "").strip()
    secret = os.environ.get("COUPANG_SECRET_KEY", "").strip()
    sub_id = os.environ.get("COUPANG_SUB_ID", "").strip() or None

    need = [p for p in products if not p["partnerUrl"]]
    for p in need:
        cached = cache.get(search_url(p["_keyword"]))
        if cached:
            p["partnerUrl"] = cached

    still = [p for p in need if not p["partnerUrl"]]
    if still and access and secret:
        urls = sorted({search_url(p["_keyword"]) for p in still})
        converted = convert_with_api(urls, access, secret, sub_id, report)
        cache.update(converted)
        for p in still:
            p["partnerUrl"] = converted.get(search_url(p["_keyword"]), "")

    kept = []
    for p in products:
        if not p["partnerUrl"]:
            if allow_placeholder:
                p["partnerUrl"] = search_url(p["_keyword"])
            else:
                report.row(p["_line"], p["id"], "파트너스 링크가 없어 이번 배포에서 뺐어요")
                report.missing_links += 1
                continue
        kept.append(p)
    return kept


def check_coverage(products: list[dict], minimum: int, report: Report) -> dict[str, int]:
    counts = {e: 0 for e in ["목", "화", "토", "금", "수"]}
    for p in products:
        counts[p["element"]] += 1
    for element, n in counts.items():
        if n < minimum:
            report.fatal.append(f"{element} 오행 상품이 {n}개뿐이에요 (최소 {minimum}개). 앱 추천이 비지 않게 배포를 멈췄어요.")
            report.coverage_fatal += 1
    return counts


def load_previous(url: str | None) -> dict | None:
    if not url:
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "saju-catalog-builder", "Cache-Control": "no-cache"})
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode())
    except Exception:  # noqa: BLE001 — 첫 배포면 없다
        return None


def keep_previous(previous: dict | None, out: str) -> bool:
    """문제가 있을 때 지금 배포된 목록을 그대로 다시 내보낸다 (사이트를 다시 배포해도 목록이 사라지지 않게)."""
    if not previous:
        return False
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(previous, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return True


def write_outputs(changed: bool, count: int, problem: str = "none") -> None:
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a") as f:
            f.write(f"changed={'true' if changed else 'false'}\ncount={count}\nproblem={problem}\n")


def write_summary(report: Report, counts: dict[str, int], changed: bool, version: int) -> None:
    lines = ["## 상품 목록 빌드", ""]
    lines.append(f"- 배포할 상품: **{sum(counts.values())}개** (" +
                 ", ".join(f"{k} {v}" for k, v in counts.items()) + ")")
    status = ("배포 중단 (지금 배포된 목록 유지)" if report.fatal
              else ("변경 있음, 배포" if changed else "변경 없음, 배포 생략"))
    lines.append(f"- 버전: `{version}` — {status}")
    if report.fatal:
        lines += ["", "### 배포를 멈춘 문제", *[f"- {m}" for m in report.fatal]]
    if report.errors:
        lines += ["", f"### 빠진 상품 {len(report.errors)}개", *[f"- {m}" for m in report.errors]]
    if report.warnings:
        lines += ["", "### 경고", *[f"- {m}" for m in report.warnings]]
    text = "\n".join(lines) + "\n"
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a") as f:
            f.write(text)
    print(text)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", help="로컬 CSV 경로")
    ap.add_argument("--csv-url", default=os.environ.get("SHEET_CSV_URL") or None,
                    help="구글 시트 '웹에 게시' CSV 주소 (있으면 --csv보다 우선)")
    ap.add_argument("--out", required=True, help="만들 products.json 경로")
    ap.add_argument("--previous", help="지금 배포된 products.json 주소 (내용이 같으면 버전 유지)")
    ap.add_argument("--link-cache", help="API로 바꾼 링크를 저장해 두는 JSON 파일")
    ap.add_argument("--allow-placeholder", action="store_true",
                    help="링크가 없으면 쿠팡 검색 주소로 채움 (개발용, 수수료 없음)")
    ap.add_argument("--min-per-element", type=int, default=5, help="오행별 최소 상품 수")
    ap.add_argument("--version", type=int, help="버전을 직접 지정")
    args = ap.parse_args(argv)

    report = Report()
    try:
        text = read_csv_text(args.csv, args.csv_url)
    except Exception as e:  # noqa: BLE001
        report.fatal.append(f"시트를 읽지 못했어요: {e}")
        keep_previous(load_previous(args.previous), args.out)
        write_summary(report, {}, False, 0)
        write_outputs(False, 0, "errors")
        return 1

    products = parse_rows(text, report)

    cache: dict[str, str] = {}
    if args.link_cache and os.path.exists(args.link_cache):
        with open(args.link_cache, encoding="utf-8") as f:
            cache = json.load(f)
    products = fill_links(products, cache, args.allow_placeholder, report)
    if args.link_cache and cache:
        with open(args.link_cache, "w", encoding="utf-8") as f:
            json.dump(dict(sorted(cache.items())), f, ensure_ascii=False, indent=2)
            f.write("\n")

    counts = check_coverage(products, args.min_per_element, report)
    for p in products:
        p.pop("_keyword", None)
        p.pop("_line", None)

    previous = load_previous(args.previous)
    unchanged = previous is not None and previous.get("products") == products
    if args.version:
        version = args.version
    elif unchanged:
        version = int(previous.get("version", 0))
    else:
        version = int(datetime.now(timezone.utc).strftime("%Y%m%d%H%M"))
    changed = not unchanged

    if report.fatal:
        keep_previous(previous, args.out)
        write_summary(report, counts, False, version)
        write_outputs(False, len(products), report.problem)
        return 1

    doc = {
        "schema": SCHEMA,
        "version": version,
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if changed
        else previous.get("updatedAt"),
        "products": products,
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")

    write_summary(report, counts, changed, version)
    write_outputs(changed, len(products))
    return 0


if __name__ == "__main__":
    sys.exit(main())
