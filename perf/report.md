# Performance comparison

**previous** 2026-07-23T11:38:17.891Z · `6872a84` · `main`  
**current** 2026-08-02T01:35:39.828Z · `e8bb0f8` · `main`

## Bundle

| chunk                            |    prev raw |     cur raw |               Δ raw |    prev gzip |     cur gzip |              Δ gzip |
| -------------------------------- | ----------: | ----------: | ------------------: | -----------: | -----------: | ------------------: |
| index-\*.js                      |    904.7 KB |    313.6 KB | ▼ 591.0 KB (-65.3%) |     283.9 KB |      97.1 KB | ▼ 186.8 KB (-65.8%) |
| markdown-renderer-\*.js          |         0 B |    258.6 KB |          ▲ 258.6 KB |          0 B |      80.6 KB |           ▲ 80.6 KB |
| framework-\*.js                  |         0 B |    185.4 KB |          ▲ 185.4 KB |          0 B |      57.6 KB |           ▲ 57.6 KB |
| base-ui-\*.js                    |         0 B |    148.1 KB |          ▲ 148.1 KB |          0 B |      48.7 KB |           ▲ 48.7 KB |
| index-B-\*.css                   |         0 B |     71.0 KB |           ▲ 71.0 KB |          0 B |      12.2 KB |           ▲ 12.2 KB |
| inter-latin-wght-normal-\*.woff2 |     47.1 KB |     47.1 KB |                   0 |      47.1 KB |      47.1 KB |                   0 |
| duck-\*.svg                      |     35.6 KB |     35.6 KB |                   0 |      12.6 KB |      12.6 KB |                   0 |
| logo-\*.svg                      |     34.4 KB |     34.4 KB |                   0 |      12.6 KB |      12.6 KB |                   0 |
| sentry-\*.js                     |         0 B |     25.5 KB |           ▲ 25.5 KB |          0 B |       9.0 KB |            ▲ 9.0 KB |
| settings-dialog-\*.js            |     15.7 KB |     15.8 KB |      ▲ 76 B (+0.5%) |       5.4 KB |       5.4 KB |      ▲ 35 B (+0.6%) |
| rolldown-runtime-\*.js           |         0 B |       694 B |             ▲ 694 B |          0 B |        422 B |             ▲ 422 B |
| index-\*.css                     |     70.7 KB |         0 B | ▼ 70.7 KB (-100.0%) |      12.2 KB |          0 B | ▼ 12.2 KB (-100.0%) |
| **TOTAL**                        | **1.08 MB** | **1.11 MB** |   ▲ 27.6 KB (+2.5%) | **373.8 KB** | **383.3 KB** |    ▲ 9.5 KB (+2.5%) |

_Lighthouse data missing on one or both runs — skipping runtime comparison._
