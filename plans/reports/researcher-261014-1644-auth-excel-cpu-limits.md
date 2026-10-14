# Research: auth CPU limits, Excel import/export, VN search normalization (2026-10-14)

## 1. Auth
- PBKDF2 100k: workerd caps iterations (checkPbkdfLimits); 100k believed max, unverified. Write test deriving 100000 vs 100001 on deployed Worker.
- Free plan CPU 10ms/request; PBKDF2 100k likely >10ms (unmeasured). wrangler dev does NOT enforce CPU limit -> deploy `/__bench` early, check cpuTime via `wrangler tail`. If exceeded -> Workers Paid ($5, 30s CPU default). Spec forbids lowering iterations.
- Compare hashes with `crypto.subtle.timingSafeEqual` (equal lengths required).
- Token: getRandomValues(32 bytes) base64url; store SHA-256 hex. Hono `setCookie(c,'sid',tok,{httpOnly,secure,sameSite:'Strict',path:'/',maxAge:28800})`; refresh maxAge when last_seen_at updated (sliding). Consider `__Host-` prefix.
- CSRF: Hono `csrf` middleware ignores application/json -> write custom middleware: non-GET/HEAD/OPTIONS require Origin === request origin else 403.
- Rate limit: 1 free WAF rate-limit rule on POST /api/auth/login (IP, 10s) — requires custom proxied domain (not *.workers.dev). D1 lockout (5 fails/15m) is primary control. Skip Rate Limiting binding (YAGNI).

## 2. Excel (browser)
- Recommend SheetJS 0.20.3 from CDN tarball: `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (npm registry stuck at 0.18.5 w/ CVEs; mockup uses 0.18.5). Only lib covering xlsx+xls+csv read + write 2-sheet template. Lazy `import('xlsx')` on F04 page.
- Alternatives: read-excel-file+write-excel-file (no .xls), exceljs (heavy, stale) — reject.
- Read: `XLSX.read(buf,{type:'array',cellDates:true})`, `sheet_to_json(ws,{header:1,raw:false,defval:''})` first sheet. Keep Mã cán bộ as text. CSV encoding: decode UTF-8, warn if garbled.

## 3. VN normalization
- `s.normalize('NFC').toLowerCase().replace(/\s+/g,' ').trim()` in shared module (FE+BE). Do NOT strip diacritics (spec).
- Store normalized `*_search` columns; `LIKE ? ESCAPE '\'` with escaped `\ % _`; always bind params.
- Leading-wildcard LIKE = full scan; 50k rows/search vs 5M reads/day free. Mitigate: filters first, min 2 chars, debounce; FTS5 later if needed. awards has no *_search column for collective names/decision numbers -> design needed.
- D1 LIKE pattern length limit ~50 bytes (from memory, unverified) -> truncate/test.

## Unresolved
1. Real CPU ms PBKDF2 100k on free plan; actual cap value.
2. Custom proxied domain? (WAF rule needs it)
3. .xls support mandatory?
4. Accent-insensitive search later?
5. SheetJS 0.20.3 tarball licence (Apache-2.0 expected).
