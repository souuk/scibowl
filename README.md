# Science Bowl Practice Moderator

A local, keyboard-first moderator for DOE National Science Bowl PDFs, built with React, TypeScript, Vite, PDF.js, browser storage, and Web Audio. PDFs and match records stay on your computer. No backend, AI, external APIs, cloud upload, or account is needed to play.

## Install and run

Use Node.js 22.13 or newer (Node 24 recommended).

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173 and keep the server running. The fixed port preserves the browser's recovery storage origin. After installation, local parsing and play need no internet. This is not an installed PWA: reopening it requires the local server.

```sh
npm run build
npm run preview
```

Preview uses port 4173 and therefore separate browser storage. PDF.js worker, fonts, character maps, and support assets are served locally. The production build may report a large-chunk advisory because it includes PDF.js.

## Start a match

1. Choose the rule set, school level, event, and format. New rounds default to **DOE 2026 in-person competition**, regional, middle school, round robin. Existing saved simplified rounds keep their original rules.
2. Choose a text-based PDF, enter team names, and select **Parse PDF**. Flags are advisory; you can start without acknowledging or excluding anything. Edit extraction mistakes or inspect the PDF if useful.
3. Start the round. Press **G** to start the match clock before reading. Read the category and press **C**, enabling buzzes. After the whole question and its choices, press **Space** for five seconds.
4. Press **A/D** to record the first physical buzz. Verbally recognize the individual player, then press **R**. Press **B** when the response begins if you want to stop the natural-pause reminder. Judge with **W/S**.
5. On a correct toss-up, read the earned bonus and press **Space**. Only its team's captain may answer. Use **B** when the captain starts, then **W/S** to judge.
6. At completion, select **Export results (.txt)** to download scores, settings, question outcomes, challenge counts, and the ruling/score log. Undone actions are omitted from the log. Records remain available after refresh.

The official answer always remains visible. This is a moderator-only screen: do not project it to players. The application records the moderator's judgments; it does not recognize speech, identify players, or connect to a physical buzzer.

## Keyboard shortcuts

| Key | Action |
|---|---|
| C | Category fully read: enable toss-up buzzes; continue after halftime/tiebreak preparation |
| A / D | Record Team A / Team B's first eligible physical buzz |
| R | Confirm that the buzzing player has been verbally recognized; start the two-second natural-pause reminder |
| B | Record that the response began; stop its response countdown |
| W / S | Correct / incorrect; S also records a moderator-called stall |
| Space | Start/resume the question countdown; advance an expired unanswered toss-up |
| F / J | Team A / B blurt or prohibited toss-up communication |
| G | Start, pause, or resume the match and applicable question clocks; start the halftime break clock |
| V | Toggle 20-second standard / 30-second visual bonus in a national visual round, before timing begins |
| N | Skip the current remaining question as a practice override; next pair in review |
| Backspace | Undo one meaningful action; restore clocks paused |
| P | Review a previous pair without changing scores |
| Escape | Close source view or return from review |
| O | Open/close the current source PDF view |

Buttons invoke the same actions as shortcuts. Held keys and Ctrl/Alt/Meta combinations are ignored. Typing in inputs, editors, and selectors never invokes gameplay shortcuts. A focused button keeps its native Space/Enter behavior. Review disables gameplay and score adjustments. Reviewing or opening source pages pauses both clocks; G resumes clocks afterward, or Space resumes an open question countdown.

Competition buzzes before C are ignored without penalty. A/D after TIME is only for a physical buzz that happened before the time call. After bonus TIME, W is disabled until B confirms that the captain actually began before TIME; B is a moderator correction, not permission for a late answer. The app never automatically judges a stall or spoken answer.

In **Simplified practice**, C/R/B/G and competition fouls are unnecessary: A/D selects a team, W/S judges it, and Space starts the question timer. Incorrect toss-ups end the pair with no rebound or penalty. An absent bonus advances after awarding four points.

## Match formats and school-level differences

The reference is the [DOE 2026 in-person rules, revision January 29, 2026](https://science.osti.gov/-/media/wdts/nsb/pdf/NSB-Resources/Rules2026.pdf), as linked by the [DOE regional resources page](https://science.osti.gov/wdts/nsb/Regional-Competitions/Resources) when checked October 1, 2026. The complete official document controls if this guide disagrees. Virtual competition has separate rules and is not implemented. These presets are explicitly for 2026, not an assertion about future editions.

| Setting | Behavior |
|---|---|
| Regional | Two 8-minute halves, 2-minute break |
| National | Two 10-minute halves, 2-minute break |
| National visual round | Two 12-minute halves; individually mark visual bonuses with V for 30 seconds |
| National elimination round 10/11 option | 5-minute break |
| Round robin | A match can finish tied |
| Elimination | A tied match continues with full five-toss-up sets until untied |
| Two-team tiebreak only | Start directly in five-toss-up sets; no bonuses or match clock |
| Multi-team qualifying tiebreak | One team per room, entered as Team A; five fully read toss-ups; +1 correct, -1 incorrect, zero for unanswered/blurt/communication; no interrupt penalties |
| Untimed competition practice | Rebounds, penalties, recognition, and bonus rules, without the match clock |

Middle and high school share ordinary match rules. At **national division advancement**, middle school uses head-to-head records, then two-team or separate-room multi-team tiebreakers; high school uses **Division Team Challenge rankings**. The setup explains that distinction. Tournament officials manage division standings, brackets, DTC rankings, and comparisons across rooms outside this two-team moderator. A multi-team room finishes after five questions; officials decide which tied teams require another set.

## Rules guide

This section covers all sections of the official in-person rulebook, including the human-administered rules. It is a practical paraphrase; use the linked official rules for exact eligibility dates, event logistics, and disputes.

### Teams and competition structure (Rules 1-2)

A team has four or five students, with exactly four playing at once. Students attend the same school; community/club teams are not accepted. Home-school teams must provide qualifying documentation and meet regional geography requirements. Middle school is grades 6-8, with at most three years of participation; high school is grades 9-12, with at most four. A student cannot compete in both levels in one year. The 2026 birth-date ranges are September 1, 2010-April 30, 2016 for middle school and May 5, 2006-April 30, 2016 for high school.

Each student and school competes in only one regional; a student plays on only one team. The school approves a coach aged at least 21. Regions decide whether multiple teams from a school may enter, up to three. Students enrolled at two participating schools compete for their neighborhood school. National qualification normally comes through the assigned region; participating outside it does not confer eligibility to advance. Coaches, supporters, and students attend their own regional, with the specified student-officiating exception.

An eligible regional winner is invited to nationals; if it cannot field four eligible attendees, the invitation passes to the next eligible team. Nationals players must have competed with that team at regionals. Officials check all registration deadlines, travel commitments, attendance, school eligibility, and documentation. The 2026 rules specify April 30-May 4 finals, notification within two weeks of regionals or March 19 (whichever comes first), required participation in all events, and consequences for withdrawing after tickets are bought. Parents/legal guardians are the permitted academic-event guests under that edition. The app does not certify eligibility or manage travel.

Regions may use round robin, elimination, or a combination. Round-robin standings award two points per win, one per tie, zero per loss. Match point totals cannot eliminate teams from advancement; they may be used for seeding when all tied teams already advance. National preliminary competition uses eight divisions and advances four teams per division into a 32-team double-elimination bracket.

### Questions and accepted answers (Rule 3)

Toss-ups are worth four points; bonuses are worth ten. Biology, Chemistry, Earth and Space Science, Energy, Mathematics, and Physics are the categories for both levels. Any active player may answer a toss-up after buzzing first and being recognized. Each team has only one attempt. Only the team earning the toss-up gets the bonus, and only its captain's response counts. Ignore responses from other bonus players.

Multiple-choice responses can be the letter W/X/Y/Z or the exact choice wording. Conventional equivalent spoken mathematical expressions are permitted. If a player gives both letter and wording, both must be correct. If several choices are equally correct, any is acceptable. If none is correct, officials discard the question and its scoring and obtain a replacement when necessary.

Only the first response counts. Prefaces, repetition, and other delaying remarks count as an incorrect answer; a brief vocal stumble may be excused. The moderator may stop an answer once it is clearly wrong. A fully read question is not reread. After a wrong answer to a fully read toss-up, the remaining team gets a new five-second buzz window immediately.

Buzzing before the category is finished has no penalty; the player remains eligible. If physical buzzer failure makes the first buzz indeterminable while both teams are eligible, pause, repair the system, and replace the question. If the disputed players are on the same team, officials choose whom to recognize.

If an official accidentally judges a non-captain's bonus answer or responds before the captain starts, replace the bonus for that team and restore the lost game time. The Moderator rulings panel supports replacement text and clock corrections.

### Recognition, communication, distractions (Rules 3-10 and 4)

The buzzing player must be verbally recognized by a player designation before speaking. Speaking before recognition is a **blurt**: the team loses its attempt, and the moderator does not reveal whether its answer was correct. Involuntary sounds are ignored. Quiet nonverbal communication is permitted on toss-ups; audible speech/signals, mouthing words, and answering without buzzing disqualify the team from that toss-up. Bonuses permit team discussion.

If the other eligible team communicates while a player is answering, disqualify the communicating team without displacing the legitimate buzzing player. If it was already ineligible, apply distraction rules. Wrong recognition does not take away the actual buzzer's opportunity; an incorrectly recognized responder's speech is handled as communication or distraction according to team and eligibility.

A nonplaying team's distraction awards the eligible opponent the current question: four points plus bonus opportunity on a toss-up, or ten on a bonus. The affected team may elect a 20-second toss-up or 40-second bonus match-clock runoff. Each team gets one excused accidental ineligible buzz per round; it does not extend the answering time. Later accidental buzzes count as distractions, as do deliberate interfering buzzes. Use the dedicated accidental/distraction controls; the runoff checkbox applies to the explicit distraction control. After a second accidental buzz, use a negative clock correction if the opponent elects runoff.

If the moderator reveals a toss-up answer before any attempt, replace it with the next toss-up for both teams. If it happens after one team has lost its chance, give the next toss-up only to the remaining team. **Answer revealed** retains that eligibility. At the end of a packet, append a reserve PDF; do not reuse a question the teams have already heard.

### Timing and scoring (Rules 5-6)

The match clock runs through reading, thinking, answering, and ordinary transitions. Pause only for an official interruption. Each half starts with a toss-up. At the half deadline, finish any question whose category was fully read before expiration, including its earned bonus; no new toss-up may start. The app uses C to record that boundary. If the packet is exhausted first, the match ends after earned bonuses.

Toss-ups allow five seconds after the complete reading. The recognized player may take a natural pause up to two seconds; the moderator decides whether a stall occurred. The two-second reminder never automatically marks an answer wrong.

Standard bonuses allow twenty seconds after the complete reading; national visual bonuses allow thirty. Announce five seconds remaining and TIME. A captain who began before TIME may complete the answer without stalling; an answer first begun after TIME does not count. The app provides visual/audio signals and B to record a timely start.

| Event | Scoring and next step |
|---|---|
| Correct toss-up | Answering team +4, then its bonus |
| Incorrect fully read toss-up | No point penalty; other eligible team gets a fresh five seconds |
| Incorrect interrupted toss-up | Opponent +4; if eligible, reread from the beginning for it |
| Buzzing interrupting team's blurt/communication | Same +4 opponent penalty; remaining team gets the reread |
| Communication without a buzz | Lose eligibility; no interrupt points merely for speaking |
| Both teams interrupt and fail | Each receives the other's four-point penalty; no bonus |
| Correct / incorrect bonus | +10 / +0; never pass a bonus to the opponent |

Interrupt penalties **add points to the opponent**, rather than subtracting points from the offender. A team receiving an interrupt penalty can then earn another four on the rebound and ten on the bonus: eighteen total.

Elimination ties use complete sets of five toss-ups, with normal toss-up rules and interrupt penalties, no bonuses, and no match clock. Never stop early merely because one team leads. Repeat full sets if tied. Substitutions are allowed at set boundaries. The app requests reserve questions when needed.

### Challenges and corrections (Rule 7)

Active players may challenge scientific correctness or rules administration between questions, before the next category starts; after the final question of a half, the limit is three seconds. They may not challenge while a question is still being played. Coaches, substitutes, and supporters must not initiate or discuss challenges. Improper outside involvement causes the challenge to be ruled against that team. Officials' decisions are final.

Judgment calls cannot be challenged: buzz timing, interruption, recognition, stalling, pronunciation, exact wording, distractions, first response, communication, malfunction judgments, and similar calls. Each team has at most two unsuccessful scientific challenges per round, including overtime. Successful challenges and rules-administration challenges do not consume that allowance. The app tracks the unsuccessful scientific count and pauses the clocks; officials determine timeliness and whether a challenge is legitimate.

A team contesting its rejected toss-up answer must wait until the other team's toss-up opportunity ends, then challenge before the bonus or next toss-up begins. If upheld, disregard the later team's answer and scoring, restore the lost time, and award the first team its toss-up and bonus. If a previously accepted toss-up is successfully challenged, treat that attempt as incorrect (including any interrupt penalty) and give the other eligible team a fresh replacement toss-up. Resolve competing challenges in answer order.

For corrections, use **Undo** to restore the disputed answering state, apply the corrected W/S judgment, and restore game time as directed. For an accepted-to-rejected correction, use **Answer revealed** after S if another team is eligible. Undo rolls back subsequent scores, outcomes, clocks, and records together. Re-enter any later challenge counts that remain applicable, then record the successful challenge after the corrected state is reached. Manual score and clock corrections are also available. This is an official-guided workflow, not automatic adjudication of scientific disputes.

Scoring and clock-management errors may be raised by anyone in the room until three seconds after the final question, even if subsequent questions have begun. The app leaves final scores editable/exportable; the official enforces finality.

### Conduct, equipment, and substitutions (Rule 8 and Code of Conduct)

Change players or captains only at the start of a half or tiebreak set. Coaches introduce themselves and sit together toward the rear. No brought-in notes; distribute scratch paper at the start, collect it at halftime and the end, and do not write before the clock starts. Players may not use calculators, electronics, reference tables, or prohibited aids; violations can disqualify the team.

Audiences may not communicate with players. An answer shouted by an identifiable team supporter forfeits that team's match. An unaffiliated shout requires clearing the room as directed, replacing the affected question, and restoring time; national final-round exceptions apply. Use the forfeit control for the recorded match result, or replacement and clock controls for a spoiled question.

Nonplayers must not transcribe or record questions or use transmitting/recording devices. Coaches may use the authorized individual score sheet. Phones and electronics are prohibited during play and the break; audible devices can cause removal and confiscation. This practice app is not permission to use a computer as a player in an official event.

Sportsmanship and respectful conduct are required. Tournament officials handle warnings, removals, disqualification, and sanctions. The national Code of Conduct also governs alcohol/drugs/tobacco, explicit material, room visitation, authorized transport, required clothing and badges, property care, furniture, attendance, and electronic-device use. Misconduct by one participant can affect the whole team. Consult the official edition for venue-specific requirements; the software cannot enforce physical conduct.

### Advancement ties (Rules 9-10)

Regional round-robin ties for advancing places first use head-to-head records among the tied teams, reapplied within any smaller separated group. Once tiebreak matches start, head-to-head no longer applies. Two tied teams play standard five-toss-up sets. More than two play the same five questions in separate rooms: +1 correct, -1 incorrect, zero for unanswered/blurt/communication, no interrupt penalties. Repeat the appropriate procedure for remaining ties. Do not eliminate teams using raw match scores.

At nationals, middle-school division ties use that head-to-head/tiebreak process; high-school division ties use Division Team Challenge rankings. The app's multi-team setting runs one room's five questions and exports its results; officials coordinate identical question sets, standings, and advancement.

### Answer conventions (Appendix)

Unless the question overrides them:

- Assume near-Earth gravity 9.8 m/s² or 32 ft/s² and ignore unspecified friction/air resistance. Use light speed 300,000,000 m/s or 186,000 mi/s; sound speed 340 m/s or 1125 ft/s; absolute zero −273°C or −460°F; vacuum permeability 4π × 10⁻⁷ H/m.
- Numbers are base ten. Geometry is Euclidean and at most three-dimensional. Trigonometric arguments are radians. Logarithm bases are specified unless irrelevant. Coins/dice/cards are standard and fair: two-sided coins, six-sided dice, 52-card decks, J/Q/K face cards.
- Functions have their largest possible real domain and corresponding smallest real range. Specified separate objects are distinct. Visual figures need not be to scale.
- Numerical short answers are exact and simplest: integers as integers, fractions/ratios reduced, radicals simplified and rationalized, no negative exponents, irrational quantities exact. Improper or mixed fractions are allowed. Do not use scientific notation unless requested, or repeating decimals in place of fractions.
- Angles use 0 ≤ θ < 2π or 0° ≤ θ < 360°. Complex numbers use a + bi; requested polar magnitude is positive. Vectors use i/j/k components, omitting zero terms if desired. Expand polynomials into standard descending-degree/alphabetical-variable form unless factoring is requested; then factor fully over integers. Solve equations over the reals.
- Read decimals digit by digit; the leading zero may be omitted. Other-base numerals may be read digit by digit, with the alternative pronunciation described in the official appendix also accepted. Required significant figures use integer or decimal notation.
- Balance chemical equations with integer coefficients having no common factor. Chemical names/formulas must be unambiguous: accept appropriate IUPAC names and formulas where isomers do not introduce ambiguity. Biological taxa may use synonymous common or scientific names.
- Give multiple requested answers in the requested order or explicitly identify each. For numbered short-answer lists, names, numbers, or other unambiguous positional references are acceptable, including “all” or “none.”
- A named law, principle, equation, or constant requires its name rather than merely a description or value. A person's surname suffices; any supplied first name must be right.
- Units may be omitted, but supplied units must be correct and equivalent to those requested. Unspecified physical units default to SI. Given measurements are treated as exact; requested rounding specifies the nearest integer multiple of the stated unit.

The full answer block, including ACCEPT / DO NOT ACCEPT instructions and moderator notes, is authoritative for the supplied packet. Human judges apply scientific knowledge, conventions, and challenges; the application does not compare typed strings or invent missing math symbols.

## Recovery, source fidelity, and limits

Both clocks use deadlines, so background tabs continue counting. Review, source view, Undo, and refresh recovery pause clocks. Up to 100 immutable pre-action snapshots preserve scores, eligibility, interrupted status, ownership, outcomes, and clock durations. Automatic ticks/warnings and review navigation do not consume Undo entries. Old saved simplified rounds remain usable.

Storage uses the versioned key `science-bowl-practice:v1`. Meaningful changes save immediately; running clocks checkpoint about once a second. A crash can recover roughly one extra second. Storage errors are visible and nonfatal; quota failures retry without history. Reset requires confirmation and retains questions/team names. One active browser tab per match is supported.

PDF bytes are not stored. After reload, reselect the original PDF via O; its SHA-256 must match. Math and suspicious notation automatically display the original source crop when available. Raised/lowered numerals are preserved where geometry permits. You can inspect extracted text, but arbitrary fractions, radicals, figures, and layouts are not guaranteed to extract faithfully. Edited questions use your edited text. Scanned PDFs need separate OCR; encrypted PDFs are unsupported. Imported text is rendered as text, without injected HTML or PDF scripts.

Missing fields remain visible and flags do not block starting. In competition mode, a missing earned bonus holds for a moderator-supplied replacement; skipping it with N is a practice override. Append reserve PDFs without losing scores/history; they use extracted text and do not share the original PDF source viewer, so check reserve math separately. Reserve import pauses clocks. Appended questions become available at the end of the current packet; use a separate reserve packet only when needed so regulation does not unintentionally include it.

Manual controls support exceptional rulings, but this is a practice moderator, not DOE-certified tournament administration. Officials still enforce roster eligibility, speech, exact time calls, challenge deadlines, substitutions, conduct, bracket standings, and the validity of replacement questions. The interface deliberately allows clock/score corrections and practice skips.

## Tests and regression fixtures

```sh
npm test
npx playwright install chromium firefox
npm run test:e2e
# One browser:
npm run test:e2e -- --project=chromium
```

Browser installation needs internet once; automated tests use checked-in DOE fixtures without internet. Unit tests cover parser behavior, legal/illegal scoring, rebounds, penalties, clocks, tiebreaks, recovery, and export. Browser tests cover real PDF extraction, complete keyboard rounds, focus, refresh, source math, and downloaded results.

On the original Windows development machine, Firefox could not launch because of a missing `mozglue` side-by-side assembly. Chromium is verified; Firefox is configured but remains unverified there. No system runtime settings were changed to bypass this issue.

See [fixture sources and checksums](tests/fixtures/README.md). Add a minimal public PDF with its URL/hash and manually established expectations, a browser extraction regression, and a small pure-parser case where appropriate. Do not derive expected answers from the parser being tested.

Parsing lives in `src/parser`, pure competition/legacy reducers and history in `src/game`, browser adapters in `src/browser`, and React screens in `src/components`. Keep rule decisions out of keyboard handlers. When DOE publishes a new edition, review the entire rulebook before changing the explicitly versioned competition preset.
