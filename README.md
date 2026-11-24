# 사주쇼핑 홈페이지·상품 목록

사주쇼핑의 **앱 소개 홈페이지**와 **앱이 받아 가는 상품 목록**입니다. 이 폴더는 **앱 코드와 따로, 공개 GitHub 저장소 하나로** 올리는 것을 전제로 만들었습니다.
(GitHub Pages 무료 배포는 공개 저장소에서만 됩니다. 홈페이지와 상품 목록은 어차피 공개되므로 이 폴더만 공개하고, 앱 코드는 비공개로 두세요.)

```
구글 시트 (편집)  ──매시──▶  GitHub Actions (검증·변환)  ──▶  GitHub Pages  ──▶  앱 (하루 몇 번 확인, 기기에 저장)
site/ (홈페이지) ──────────────────────────────────────▶  (같은 주소에 함께 배포)
```

| 주소 | 내용 | 어디에 쓰나 |
|---|---|---|
| `https://{계정}.github.io/{저장소}/` | 앱 소개 | 쿠팡 파트너스 사이트 주소, 앱스토어 마케팅 URL |
| `…/privacy.html` | 개인정보처리방침 | 앱스토어 심사 필수 |
| `…/support.html` | 자주 묻는 질문·문의 | 앱스토어 지원 URL (필수) |
| `…/invite/?from=이름&lack=수` | 초대 링크 착지 페이지 | 앱이 없는 사람이 공유 링크를 눌렀을 때 |
| `…/products.json` | 상품 목록 | 앱의 `PRODUCT_CATALOG_URL` |

## 상품 고치기

구글 시트(또는 `products.csv`)에서 한 줄이 상품 하나입니다. 저장하면 다음 정각 17분쯤 자동으로 반영되고, 앱은 다음에 켤 때나 몇 시간 뒤 돌아올 때 새 목록을 받습니다. 앱 업데이트나 심사는 필요 없습니다.

| 칸 | 필수 | 설명 | 예 |
|---|---|---|---|
| 사용 | | `N`이면 숨김. 비우면 사용 | `Y` |
| id | ✓ | 영문 소문자·숫자·하이픈. **한 번 정하면 바꾸지 마세요** (본 상품 기록·추천 고정에 쓰임) | `water-tumbler-02` |
| 오행 | ✓ | 목·화·토·금·수 | `수` |
| 카테고리 | ✓ | 같은 날 추천이 한 카테고리로 몰리지 않게 씀 | `생활` |
| 상품명 | ✓ | 앱에 보이는 이름 | `블랙 텀블러` |
| 추천 이유 | ✓ | 앱에 보이는 한 줄 설명 | `검정은 수 기운의 색이에요.` |
| 가격대 | ✓ | `1만원 이하` / `1만원대` / `2~3만원대` / `5만원 이상` | `1만원대` |
| 색상 | | 쉼표로 구분 | `검정, 네이비` |
| 계절 | | 봄·여름·가을·겨울 (쉼표). 비우면 사계절 | `겨울` |
| 로켓배송 | | `Y`면 로켓 표시 | `Y` |
| 검색어 | | 쿠팡 검색어. 비우면 상품명. API 자동 변환에 씀 | `스테인리스 텀블러 블랙` |
| 파트너스 링크 | ✓* | `https://link.coupang.com/…` | |
| 이미지 주소 | | `https://…` (비우면 오행 아이콘) | |
| 아이콘 | | SF Symbols 이름 (비우면 오행 아이콘) | `cup.and.saucer.fill` |
| 메모 | | 앱에는 안 나감 | |

\* 파트너스 링크가 없는 상품은 **배포에서 빠집니다** (수수료가 안 붙는 링크가 앱에 나가지 않게). API 키가 있으면 검색어로 자동으로 만듭니다.

### 상품 목록 배포가 멈추는 경우 (앱과 홈페이지에는 이전 목록이 그대로 남음)

- id가 겹칠 때
- 어떤 오행의 상품이 5개보다 적을 때 (추천이 비지 않게)
- 시트를 읽지 못할 때

형식이 틀린 상품(오행·가격대 오타 등)은 그 줄만 빠지고 나머지는 배포됩니다. 빠진 줄과 이유는 GitHub › Actions › 실행 결과의 Summary에 나옵니다.

## 홈페이지 (site/)

- 공개 전에 `privacy.html`과 `support.html`의 `{운영자 이름}`, `{문의 이메일}`을 채우세요.
- 앱이 출시되면 `index.html`과 `invite/index.html`의 "App Store 출시 예정" 버튼을 앱스토어 링크로 바꾸세요.
- 저장소에 올리면(push) 바로 배포됩니다. 상품 목록에 문제가 있어도 홈페이지는 배포되고, 상품 목록은 이전 것을 유지합니다.
- **초대 링크는 사용자 지정 도메인이 필요합니다.** 앱은 `https://{도메인}/invite`를 인식하는데, `{계정}.github.io/{저장소}/invite`처럼 저장소 이름이 붙은 경로는 인식하지 못합니다. 유니버설 링크용 `/.well-known/apple-app-site-association`도 도메인 맨 앞에 있어야 합니다. 도메인을 사서 Settings › Pages › Custom domain에 연결하고, 앱의 `SHARE_LINK_DOMAIN`을 그 도메인으로 바꾸세요.

## 배포 규칙

- 저장소에 올리거나(push) Actions에서 직접 실행: 홈페이지와 상품 목록을 배포
- 매시 자동 실행: 상품 목록이 바뀌었을 때만 배포
- 상품 목록에 문제가 있으면: 지금 배포된 목록을 유지. 직접 실행·push 때는 실패(메일 알림)로, 매시 자동 실행 때는 경고로만 표시

## 처음 설정

1. `site/privacy.html`, `site/support.html`의 `{운영자 이름}`, `{문의 이메일}`을 채웁니다.
2. 이 폴더를 공개 저장소(예: `sajushopping-web`)로 올립니다.
3. Settings › Pages › Build and deployment › Source를 **GitHub Actions**로 바꾸고, Actions › 홈페이지·상품 목록 배포 › Run workflow로 한 번 실행합니다. 이때부터 홈페이지가 열립니다 (파트너스 링크가 아직 없으면 상품 목록은 실패로 표시되고 홈페이지만 배포됨).
4. 구글 시트를 만듭니다: 새 시트 › 파일 › 가져오기 › `products.csv` 업로드.
5. 시트 › 공유 › 일반 액세스를 **링크가 있는 모든 사용자 · 뷰어**로 바꿉니다. CSV 주소는 `https://docs.google.com/spreadsheets/d/{시트 ID}/export?format=csv`입니다 (첫 번째 탭). 파일 › 공유 › **웹에 게시** › CSV로 나온 주소를 써도 됩니다.
   링크를 아는 사람은 시트 전체(메모 칸 포함)를 볼 수 있으니, 메모에는 남에게 보여도 되는 것만 적으세요.
6. 저장소 Settings › Secrets and variables › Actions › Variables에 `SHEET_CSV_URL`로 그 주소를 넣습니다.
7. 시트에 파트너스 링크를 채우면 다음 정각 17분쯤 상품 목록이 배포됩니다.
8. 배포 주소 `https://{계정}.github.io/{저장소}/products.json`을 앱의 `project.yml` › `PRODUCT_CATALOG_URL`에 넣습니다.

`SHEET_CSV_URL`이 없으면 저장소의 `products.csv`를 씁니다 (GitHub 웹에서 직접 고쳐도 됨).

## 쿠팡 파트너스 API (승인 후)

키가 생기면 저장소 Settings › Secrets and variables › Actions › Secrets에 `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`를 넣으세요.
그 뒤로는 '파트너스 링크' 칸이 빈 상품을 '검색어'의 쿠팡 검색 주소로 자동 변환해 넣고, 변환한 링크는 `links.json`에 저장해 다시 호출하지 않습니다.
앱 사용량을 따로 보고 싶으면 파트너스에서 채널 아이디를 만들어 Variables의 `COUPANG_SUB_ID`에 넣으세요.

## 로컬에서 확인

```bash
python3 build_catalog.py --csv products.csv --out dist/products.json
```

앱 번들용 스냅샷 (링크 없는 상품은 쿠팡 검색 주소로 임시 채움 — 개발용):

```bash
python3 build_catalog.py --csv products.csv --allow-placeholder --version 1 --out ../SajuShopping/Resources/products.json
```

출시 빌드에는 배포된 목록을 그대로 받아 넣으세요 (앱 폴더에서):

```bash
curl -fsSL "https://{계정}.github.io/{저장소}/products.json" -o SajuShopping/Resources/products.json
```
