# Screenshots of the UI and UX review, before and after

Full-page screenshots of the same 17 surfaces, taken by the same script (`shoot.cjs`, kept with the review's scratch files) before any change of the review (2026-09-12, the tree after `docs/15`) and after its last change (2026-09-13, the tree `docs/16` reports on). File names are `<surface>--<width>-<theme>.png`; `before/` and `after/` hold the same 34 names, so a pair can be opened side by side.

| Width | Viewport | Device profile |
|---|---|---|
| `desk` | 1280 × 900 | desk |
| `phone` | 420 × 860 | phone |

Only the light theme at the desk and phone widths is committed (34 files each side, about 3.3 MB). The operatory (1024 × 768) and dark-theme shots were taken and read during the review but are not committed, to keep the repository small; the numbers in `docs/16` cover all three widths and both themes.

| Surface | Route and state |
|---|---|
| `signin` | `#/signin` |
| `frontdesk-board` | `#/frontdesk/board` |
| `biller-money` | `#/biller/money` |
| `hygienist-chairs` | `#/hygienist/chairs` |
| `dentist-exams` | `#/dentist/exams` |
| `owner-close` | `#/owner/close` |
| `compliance-risk` | `#/compliance/risk` |
| `temp-board` | `#/temp/board` (the first-shift rail) |
| `perio` | `#/hygienist/perio/enc-9001` after the keys 3, 4, 5 |
| `encounter` | `#/dentist/encounter/enc-9002` |
| `checkout` | `#/frontdesk/checkout/a-1044` |
| `ledger-rail` | `#/biller/ledger/p-319` |
| `roles` | `#/compliance/roles` with the day-pass form open |
| `phone` | `#/phone/approvals` after Simulate a request |
| `palette-open` | the Board with the search palette open and "mar" typed |
| `pinpad-open` | the perio grid with the author PIN pad open |
| `refusal-gate` | the Money Desk with a write-off refused |

What to look for, pair by pair, is written up in `docs/16-ux-review.md` under Results; the screenshots are the evidence a number describes, not a substitute for it.
