# DOE regression fixtures

These public DOE sample packets are test inputs, not a promise that old scientific answers remain current. The app displays the packet's official answer unchanged; the moderator adjudicates it.

Expected counts were checked against the printed numbering and final toss-up/bonus in each packet, independently of parser output.

| Local file | Source | Pages | Toss-ups / bonuses | SHA-256 |
|---|---|---:|---:|---|
| hs-old.pdf | https://science.osti.gov/-/media/wdts/nsb/pdf/HS-Sample-Questions/Sample-Set-1/round1.pdf | 13 | 25 / 25 | e0e9e6492d737209b1042a59e3131054638cf4f8698dc60fde61ef82870181db |
| hs-new.pdf | https://science.osti.gov/-/media/wdts/nsb/pdf/HS-Sample-Questions/Sample-Set-17/2022-HS-1.pdf | 18 | 18 / 18 | d5271d566b56745fa4b5943f3fde425f616ca6d302779906cef111580ce72531 |
| ms-old.pdf | https://science.osti.gov/-/media/wdts/nsb/pdf/MS-Sample-Questions/Sample-Set-1/m_round01.pdf | 13 | 25 / 25 | 0dfb91905a5a32c8bbb67418d110e9ba80f2d204be1aa1f15b29edfa69181156 |
| ms-new.pdf | https://science.osti.gov/-/media/wdts/nsb/pdf/MS-Sample-Questions/Sample-Set-16/2022-MS-1.pdf | 18 | 18 / 18 | 8a23b1600f8bc33644d8ca15596680ac3dfa93eca0ddae46caed9b51b9975f53 |

Representative expectations:

- HS old: toss-up 7 accepts POLARIS; bonus 4 has a fraction/exponents needing source review.
- HS new: toss-up 1 is SEMICIRCULAR CANALS with accepted SEMICIRCULAR DUCTS; bonus 9 rejects neutron star; toss-up 3 has W) Tropical depression.
- MS old: toss-up 1 is NUCLEUS; bonus 14 has raised fraction glyphs that can extract before the numbered header.
- MS new: toss-up 15 has Y) Magnetic field.

To add a regression, keep the smallest suitable public PDF here, record its source/checksum and manually verified expectations, add a browser extraction case, and add a small text-only parser case when possible. Do not derive expected answers from the parser itself. Tests do not fetch DOE resources at runtime.
