# Performance comparison

**previous** 2026-06-22T12:50:33.628Z · `ae62438` · `main`  
**current** 2026-07-23T11:38:17.891Z · `6872a84` · `main`

## Bundle

| chunk                            |     prev raw |     cur raw |                Δ raw |    prev gzip |     cur gzip |              Δ gzip |
| -------------------------------- | -----------: | ----------: | -------------------: | -----------: | -----------: | ------------------: |
| index-\*.js                      |     551.7 KB |    904.7 KB |  ▲ 352.9 KB (+64.0%) |     172.5 KB |     283.9 KB | ▲ 111.4 KB (+64.6%) |
| index-\*.css                     |      64.5 KB |     70.7 KB |     ▲ 6.2 KB (+9.5%) |      11.3 KB |      12.2 KB |     ▲ 918 B (+7.9%) |
| inter-latin-wght-normal-\*.woff2 |      47.1 KB |     47.1 KB |                    0 |      47.1 KB |      47.1 KB |                   0 |
| duck-\*.svg                      |      35.0 KB |     35.6 KB |      ▲ 605 B (+1.7%) |      12.5 KB |      12.6 KB |      ▲ 92 B (+0.7%) |
| logo-\*.svg                      |      33.8 KB |     34.4 KB |      ▲ 604 B (+1.7%) |      12.5 KB |      12.6 KB |      ▲ 62 B (+0.5%) |
| settings-dialog-\*.js            |       8.0 KB |     15.7 KB |    ▲ 7.7 KB (+95.7%) |       3.3 KB |       5.4 KB |   ▲ 2.1 KB (+64.8%) |
| markdown-renderer-\*.js          |     257.7 KB |         0 B | ▼ 257.7 KB (-100.0%) |      80.3 KB |          0 B | ▼ 80.3 KB (-100.0%) |
| check-\*.js                      |        113 B |         0 B |    ▼ 113 B (-100.0%) |        130 B |          0 B |   ▼ 130 B (-100.0%) |
| **TOTAL**                        | **998.1 KB** | **1.08 MB** |  ▲ 110.1 KB (+11.0%) | **339.6 KB** | **373.8 KB** |  ▲ 34.2 KB (+10.1%) |

_Lighthouse data missing on one or both runs — skipping runtime comparison._
