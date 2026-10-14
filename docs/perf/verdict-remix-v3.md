# Verdict

App script bytes exclude `static.cloudflareinsights.com` on both sides; the excluded bytes are the Third-party script bytes column.

The committed baseline host-filtered re-extraction is covered by a regression test reproducing every bytesScript median byte for byte.

Every scored cell must pass. Narrow timing misses remain FAIL; re-collect once with 9 runs, then use the final medians.

| form factor | page / flow | metric | before | after | delta | result |
|---|---|---|---|---|---|---|
| desktop | /experience | FCP ms | 670.1955 | 717.4300000000001 | 47.234500000000025 | PASS |
| desktop | /experience | LCP ms | 981.864 | 717.4300000000001 | -264.43399999999997 | PASS |
| desktop | /experience | TBT ms | 0 | 0 | 0 | PASS |
| desktop | /experience | CLS | 0 | 0 | 0 | PASS |
| desktop | /experience | App script bytes | 141921 | 88671 | -53250 | PASS |
| desktop | /experience | TTFB ms | 105.034 | 264.698 | 159.664 | REPORTED |
| desktop | /experience | SI ms | 706.198926746129 | 717.4300000000001 | 11.231073253871045 | REPORTED |
| desktop | /experience | TTI ms | 981.864 | 717.4300000000001 | -264.43399999999997 | REPORTED |
| desktop | /experience | Lighthouse score | 0.99 | 0.99 | 0 | REPORTED |
| desktop | /experience | Total bytes | 224853 | 158122 | -66731 | REPORTED |
| desktop | /experience | Document bytes | 1264 | 1012 | -252 | REPORTED |
| desktop | /experience | Third-party script bytes | 0 | 10438 | 10438 | REPORTED |
| desktop | / | FCP ms | 677.9205000000001 | 675.816 | -2.10450000000003 | PASS |
| desktop | / | LCP ms | 987.0135000000001 | 692.808 | -294.20550000000014 | PASS |
| desktop | / | TBT ms | 0 | 0 | 0 | PASS |
| desktop | / | CLS | 0 | 0 | 0 | PASS |
| desktop | / | App script bytes | 140093 | 88670 | -51423 | PASS |
| desktop | / | TTFB ms | 100.53 | 258.394 | 157.864 | REPORTED |
| desktop | / | SI ms | 695.7191963131382 | 675.816 | -19.90319631313821 | REPORTED |
| desktop | / | TTI ms | 987.0135000000002 | 692.808 | -294.20550000000026 | REPORTED |
| desktop | / | Lighthouse score | 0.99 | 1 | 0.010000000000000009 | REPORTED |
| desktop | / | Total bytes | 222970 | 158073 | -64897 | REPORTED |
| desktop | / | Document bytes | 1263 | 1018 | -245 | REPORTED |
| desktop | / | Third-party script bytes | 0 | 10438 | 10438 | REPORTED |
| desktop | /resume | FCP ms | 631.973 | 754.03 | 122.05700000000002 | FAIL (narrow timing miss; re-collect once with 9 runs) |
| desktop | /resume | LCP ms | 1068.595 | 754.03 | -314.56500000000005 | PASS |
| desktop | /resume | TBT ms | 0 | 0 | 0 | PASS |
| desktop | /resume | CLS | 0.00102743133992937 | 0 | -0.00102743133992937 | PASS |
| desktop | /resume | App script bytes | 412240 | 88680 | -323560 | PASS |
| desktop | /resume | TTFB ms | 95.82800000000002 | 234.36100000000002 | 138.53300000000002 | REPORTED |
| desktop | /resume | SI ms | 692.7754783698781 | 754.03 | 61.25452163012187 | REPORTED |
| desktop | /resume | TTI ms | 1068.8950000000002 | 754.03 | -314.86500000000024 | REPORTED |
| desktop | /resume | Lighthouse score | 0.98 | 0.99 | 0.010000000000000009 | REPORTED |
| desktop | /resume | Total bytes | 495117 | 158111 | -337006 | REPORTED |
| desktop | /resume | Document bytes | 1263 | 1015 | -248 | REPORTED |
| desktop | /resume | Third-party script bytes | 0 | 10438 | 10438 | REPORTED |
| desktop | /summary | FCP ms | 649.9025000000001 | 674.348 | 24.44549999999981 | PASS |
| desktop | /summary | LCP ms | 958.2425000000002 | 674.348 | -283.8945000000002 | PASS |
| desktop | /summary | TBT ms | 0 | 0 | 0 | PASS |
| desktop | /summary | CLS | 0 | 0 | 0 | PASS |
| desktop | /summary | App script bytes | 139407 | 88671 | -50736 | PASS |
| desktop | /summary | TTFB ms | 98.83800000000001 | 235.46200000000002 | 136.62400000000002 | REPORTED |
| desktop | /summary | SI ms | 649.9025000000001 | 674.348 | 24.44549999999981 | REPORTED |
| desktop | /summary | TTI ms | 958.2425000000002 | 674.348 | -283.8945000000002 | REPORTED |
| desktop | /summary | Lighthouse score | 0.99 | 1 | 0.010000000000000009 | REPORTED |
| desktop | /summary | Total bytes | 222281 | 158071 | -64210 | REPORTED |
| desktop | /summary | Document bytes | 1264 | 1018 | -246 | REPORTED |
| desktop | /summary | Third-party script bytes | 0 | 10438 | 10438 | REPORTED |
| mobile | /experience | FCP ms | 1788.5839999999998 | 2082.1969999999997 | 293.61299999999983 | FAIL (narrow timing miss; re-collect once with 9 runs) |
| mobile | /experience | LCP ms | 2995.3135 | 2531.5299999999997 | -463.78350000000046 | PASS |
| mobile | /experience | TBT ms | 0 | 125 | 125 | FAIL |
| mobile | /experience | CLS | 0 | 0 | 0 | PASS |
| mobile | /experience | App script bytes | 142089 | 88683 | -53406 | PASS |
| mobile | /experience | TTFB ms | 119.94 | 234.561 | 114.62100000000001 | REPORTED |
| mobile | /experience | SI ms | 1861.9091237027571 | 2850.8300499870656 | 988.9209262843085 | REPORTED |
| mobile | /experience | TTI ms | 2995.3135 | 2818.057 | -177.25650000000041 | REPORTED |
| mobile | /experience | Lighthouse score | 0.94 | 0.93 | -0.009999999999999898 | REPORTED |
| mobile | /experience | Total bytes | 225048 | 158087 | -66961 | REPORTED |
| mobile | /experience | Document bytes | 1271 | 1018 | -253 | REPORTED |
| mobile | /experience | Third-party script bytes | 0 | 10438 | 10438 | REPORTED |
| mobile | / | FCP ms | 2862.914 | 2016.4269999999997 | -846.4870000000005 | PASS |
| mobile | / | LCP ms | 2881.534999999999 | 2377.7209999999995 | -503.8139999999994 | PASS |
| mobile | / | TBT ms | 0 | 49 | 49 | PASS |
| mobile | / | CLS | 0 | 0 | 0 | PASS |
| mobile | / | App script bytes | 140090 | 88674 | -51416 | PASS |
| mobile | / | TTFB ms | 120.149 | 265.346 | 145.197 | REPORTED |
| mobile | / | SI ms | 3043.5212000123497 | 2016.4269999999997 | -1027.09420001235 | REPORTED |
| mobile | / | TTI ms | 2881.534999999999 | 2606.3770000000004 | -275.15799999999854 | REPORTED |
| mobile | / | Lighthouse score | 0.9 | 0.96 | 0.05999999999999994 | REPORTED |
| mobile | / | Total bytes | 223030 | 158090 | -64940 | REPORTED |
| mobile | / | Document bytes | 1264 | 1016 | -248 | REPORTED |
| mobile | / | Third-party script bytes | 0 | 10438 | 10438 | REPORTED |
| mobile | /resume | FCP ms | 1759.5949999999998 | 2023.443 | 263.8480000000002 | FAIL (narrow timing miss; re-collect once with 9 runs) |
| mobile | /resume | LCP ms | 4363.684 | 2393.0969999999998 | -1970.5870000000004 | PASS |
| mobile | /resume | TBT ms | 0 | 50 | 50 | PASS |
| mobile | /resume | CLS | 0.003213880357894079 | 0 | -0.003213880357894079 | PASS |
| mobile | /resume | App script bytes | 412297 | 88670 | -323627 | PASS |
| mobile | /resume | TTFB ms | 100.945 | 239.42900000000003 | 138.48400000000004 | REPORTED |
| mobile | /resume | SI ms | 2429.94638429098 | 2023.443 | -406.50338429097997 | REPORTED |
| mobile | /resume | TTI ms | 4364.984 | 2676.924 | -1688.0600000000004 | REPORTED |
| mobile | /resume | Lighthouse score | 0.84 | 0.96 | 0.12 | REPORTED |
| mobile | /resume | Total bytes | 495221 | 158077 | -337144 | REPORTED |
| mobile | /resume | Document bytes | 1264 | 1020 | -244 | REPORTED |
| mobile | /resume | Third-party script bytes | 0 | 10438 | 10438 | REPORTED |
| mobile | /summary | FCP ms | 1780.7205 | 2150.2799999999997 | 369.55949999999984 | FAIL |
| mobile | /summary | LCP ms | 2868.2404999999994 | 2332.8579999999997 | -535.3824999999997 | PASS |
| mobile | /summary | TBT ms | 0 | 62 | 62 | FAIL (narrow timing miss; re-collect once with 9 runs) |
| mobile | /summary | CLS | 0 | 0 | 0 | PASS |
| mobile | /summary | App script bytes | 139435 | 88671 | -50764 | PASS |
| mobile | /summary | TTFB ms | 98.59499999999998 | 298.6 | 200.00500000000005 | REPORTED |
| mobile | /summary | SI ms | 1780.7205 | 2187.3300000000004 | 406.6095000000005 | REPORTED |
| mobile | /summary | TTI ms | 2868.2405 | 2663.2660000000005 | -204.97449999999935 | REPORTED |
| mobile | /summary | Lighthouse score | 0.94 | 0.96 | 0.020000000000000018 | REPORTED |
| mobile | /summary | Total bytes | 222243 | 158076 | -64167 | REPORTED |
| mobile | /summary | Document bytes | 1263 | 1018 | -245 | REPORTED |
| mobile | /summary | Third-party script bytes | 0 | 10438 | 10438 | REPORTED |
| desktop | /summary seeded, ai=mock | FCP ms | 574.3157 | 458.1428 | -116.17289999999997 | PASS |
| desktop | /summary seeded, ai=mock | LCP ms | 836.3922500000001 | 678.2142000000001 | -158.17804999999998 | PASS |
| desktop | /summary seeded, ai=mock | TBT ms | 0 | 0 | 0 | PASS |
| desktop | /summary seeded, ai=mock | CLS | 0 | 0 | 0 | PASS |
| desktop | /summary seeded, ai=mock | Lighthouse score | 0.99 | 1 | 0.010000000000000009 | REPORTED |
| desktop | /summary seeded, ai=mock | SI ms | 716.8577134102218 | 458.1428 | -258.71491341022175 | REPORTED |
| desktop | /resume seeded (warm: storage not reset) | FCP ms | 252.92299515991212 | 377.2496 | 124.32660484008787 | FAIL (narrow timing miss; re-collect once with 9 runs) |
| desktop | /resume seeded (warm: storage not reset) | LCP ms | 489.53582548217776 | 377.2496 | -112.28622548217777 | PASS |
| desktop | /resume seeded (warm: storage not reset) | TBT ms | 0 | 0 | 0 | PASS |
| desktop | /resume seeded (warm: storage not reset) | CLS | 0.0444654583661676 | 0 | -0.0444654583661676 | PASS |
| desktop | /resume seeded (warm: storage not reset) | Lighthouse score | 1 | 1 | 0 | REPORTED |
| desktop | /resume seeded (warm: storage not reset) | SI ms | 478.84083183139074 | 377.2496 | -101.59123183139076 | REPORTED |
| desktop | /resume typing in Lexical editor | Editor INP ms | 26.569 | 27.003 | 0.43400000000000105 | PASS |
| desktop | /resume typing in Lexical editor | TBT ms | 0 | 0 | 0 | PASS |
| desktop | /resume typing in Lexical editor | CLS | 0 | 0.01480851063829787 | 0.01480851063829787 | PASS |
| desktop | /resume typing in Lexical editor | Lighthouse score | 1 | 1 | 0 | REPORTED |
| mobile | /summary seeded, ai=mock | FCP ms | 1630.0056 | 1717.0813 | 87.0757000000001 | PASS |
| mobile | /summary seeded, ai=mock | LCP ms | 3155.9260999999997 | 2472.6219499999997 | -683.3041499999999 | PASS |
| mobile | /summary seeded, ai=mock | TBT ms | 0 | 72 | 72 | FAIL (narrow timing miss; re-collect once with 9 runs) |
| mobile | /summary seeded, ai=mock | CLS | 0.24494539781881974 | 0 | -0.24494539781881974 | PASS |
| mobile | /summary seeded, ai=mock | Lighthouse score | 0.79 | 0.96 | 0.16999999999999993 | REPORTED |
| mobile | /summary seeded, ai=mock | SI ms | 1630.0056 | 1717.0813 | 87.0757000000001 | REPORTED |
| mobile | /resume seeded (warm: storage not reset) | FCP ms | 804.6169 | 1285.5596 | 480.94270000000006 | FAIL |
| mobile | /resume seeded (warm: storage not reset) | LCP ms | 2180.6169 | 1285.5596 | -895.0572999999999 | PASS |
| mobile | /resume seeded (warm: storage not reset) | TBT ms | 56 | 71 | 15 | PASS |
| mobile | /resume seeded (warm: storage not reset) | CLS | 0.1481799289662721 | 0 | -0.1481799289662721 | PASS |
| mobile | /resume seeded (warm: storage not reset) | Lighthouse score | 0.93 | 0.99 | 0.05999999999999994 | REPORTED |
| mobile | /resume seeded (warm: storage not reset) | SI ms | 1138.606264830817 | 1285.5596 | 146.953335169183 | REPORTED |
| mobile | /resume typing in Lexical editor | Editor INP ms | 21.161 | 22.336 | 1.1749999999999972 | PASS |
| mobile | /resume typing in Lexical editor | TBT ms | 0 | 0 | 0 | PASS |
| mobile | /resume typing in Lexical editor | CLS | 0.01272743407439333 | 0 | -0.01272743407439333 | PASS |
| mobile | /resume typing in Lexical editor | Lighthouse score | 1 | 1 | 0 | REPORTED |
| API | POST /api/summaries | Stubbed API p50 ms | 3 | 4 | 1 | PASS |
| API | POST /api/summaries | api.live | 5510 | unavailable | unavailable | REPORTED |

## Reported-only appendix

### bundle

Before:
```json
{
  "js": {
    "bytes": 1801481,
    "gzipBytes": 543286
  },
  "css": {
    "bytes": 26231,
    "gzipBytes": 5751
  },
  "fileCount": 72
}
```
After:
```json
{
  "js": {
    "bytes": 1476451,
    "gzipBytes": 434939
  },
  "css": {
    "bytes": 25404,
    "gzipBytes": 5765
  },
  "fileCount": 8
}
```

### workerBundle

Before:
```json
"unavailable"
```
After:
```json
"unavailable"
```

### fieldData

Before:
```json
"unavailable"
```
After:
```json
"unavailable"
```

Overall: FAIL
