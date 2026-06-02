# B737 CBTA TRI Walkthrough

A single-file Progressive Web App for B737 NG Type Rating Instructor (TRI) sessions.  
Built by **Cpt Bouchenafa Mohamed Amine**. Standards: QRH Rev55 · FCTM Rev25 · CBTA OACI.

---

## For AI assistants — read this first

**The entire application lives in one file: `index.html` (≈ 4 700 lines).**  
There is no build step, no bundler, no external dependencies, no separate JS/CSS files.  
All HTML, CSS, JavaScript, and data (exercise catalogue, competency definitions) are inline.

Key facts that prevent wasted searching:
- `grep -n "function foo" index.html` is the fastest way to find any function.
- State is a single mutable object (`let state = {...}` at line ~1897). Nothing is persisted mid-session except via `localStorage` (history only, via `saveSessionToHistory()`).
- The UI is a stack of `<div class="screen">` elements; only one has class `active` at a time.
- `window._rapportHTML`, `window._rapportPilot`, `window._rapportDateStr` are globals written by `showRapport()` and consumed by `printRapport()` and `ouvrirRapportSafari()`.
- `window.print()` must **never** be called directly on the main page — layout uses `height:100vh; overflow:hidden` everywhere and will clip. Use the standalone-window approach in `printRapport()` instead.

---

## Architecture

```
index.html
├── <head>  CSS (lines ~1–158)
│   ├── CSS custom properties, resets, layout
│   ├── .screen  →  display:none  (hidden screens)
│   ├── .screen.active  →  display:flex  (visible screen)
│   └── html,body,#app  →  height:100%; overflow:hidden  (full-viewport lock)
│
├── <body>  HTML screens (lines ~159–420)
│   ├── #screen-login
│   ├── #screen-home
│   ├── #screen-briefing
│   ├── #screen-session      (exercise list)
│   ├── #screen-ex           (active exercise)
│   ├── #screen-comp         (competency grading modal)
│   ├── #screen-debrief
│   ├── #screen-rapport      (generated report view)
│   ├── #screen-history      (dashboard / past sessions)
│   └── modals: #modal-add, #modal-confirm, #modal-delete-ex
│
└── <script>  All JavaScript (lines ~420–4664)
    ├── Exercise catalogue  SC[] + NNC[]  →  ALL_SC  (lines ~420–1788)
    ├── COMPETENCIES[]                              (lines 1789–1881)
    ├── Grade/color config  GC, GL, catC            (lines 1883–1886)
    ├── ROOT_CAUSES[]                               (line  1888–1894)
    ├── state {}                                    (lines 1897–1904)
    └── Functions                                   (lines 1907–4664)
```

---

## Screen flow

```
Login → Home → Briefing → Session (exercise list)
                                └→ Exercise view (tabs: Eval / FFA / TEM / CRM / Facilitation)
                                        └→ Competency grading modal
                          Session → Debrief (tabs: Scores / Exercises / TEM / Questionnaire / Conclusion)
                                         └→ Rapport (PDF export, Email)
                          Home → History (Dashboard / Sessions / Pilotes)
```

`showScreen(id)` is the only navigation function — pass the screen id string.

---

## State object

```js
let state = {
  sessionName: "",        // free text
  pilotName:   "",        // CPT name
  foName:      "",        // FO name (empty = solo CPT session)
  currentUser: "",        // logged-in instructor
  instructorName: "",

  exercises:  [],         // array of exercise objects (see below)
  activeIdx:  null,       // index into exercises[] for the open exercise
  activeComp: null,       // competency id currently being graded
  activePilot: "cpt",     // "cpt" | "fo"

  currentExTab:  "eval",   // active tab in exercise view
  currentDebTab: "scores", // active tab in debrief view

  catFilter:   "ALL",
  phaseFilter: "ALL",
  sysFilter:   "ALL",       // exercise-list filter state (not in initial state but set at runtime)

  briefingChecks:   {},     // key → bool
  briefingFacNotes: {},     // index → string

  debRootCauses: {},        // key → bool (root cause toggles in debrief)
  debNotes:      {},        // key → string (free notes per debrief item)
  debConclNotes: "",        // instructor conclusion free text (appears in report)
};
```

### Exercise object shape

```js
{
  sid:       "sc_xxx",   // ALL_SC id
  closed:    false,      // true when marked complete
  notes:     "",         // instructor free-text notes
  startTime: Date.now(), // ms timestamp

  cs:    { KNO:{g:0,obs:[]}, WLM:{...}, ... },  // CPT competency scores
  csfo:  { ... },                                // FO  competency scores (if foName set)

  ffa:   { P:null, F:null, A:null },   // FFA tags CPT
  ffafo: { ... },                      // FFA tags FO

  tem:   { threats:[], errors:[], uas:[], mitigations:{} },  // TEM CPT
  temfo: { ... },                                            // TEM FO

  crm:   { ... },   // CRM ratings
}
```

---

## Key data

### COMPETENCIES (9 items)

| id | label | full name |
|----|-------|-----------|
| KNO | KNO | Application of Knowledge |
| WLM | WLM | Workload Management |
| SA  | SA  | Situation Awareness |
| PSD | PSD | Problem Solving & Decision Making |
| LTW | LTW | Leadership & Teamwork |
| FPM | FPM | Flight Path Mgmt Manual |
| FPA | FPA | Flight Path Mgmt Automation |
| COM | COM | Communication |
| PRO | PRO | Application of Procedures |

### Grade scale (1–5)

| Value | Label | Color |
|-------|-------|-------|
| 1 | INACCEPTABLE | #EF4444 |
| 2 | SOUS-STANDARD | #F97316 |
| 3 | STANDARD | #F59E0B |
| 4 | AU-DESSUS DU STANDARD | #10B981 |
| 5 | EXEMPLAIRE | #3B82F6 |

### Exercise catalogue

- `SC[]` — Normal / maneuver / flight-pattern exercises
- `NNC[]` — Non-Normal Checklists
- `ALL_SC = SC.concat(NNC)` — full catalogue used everywhere

Each entry: `{ id, title, page, cat, pri, phase, system, condition, items[] }`

---

## Function reference

### Navigation & session lifecycle

| Function | Line | Purpose |
|----------|------|---------|
| `showScreen(id)` | 1907 | Switch active screen |
| `startSession()` | 1913 | Read home-form inputs → state, go to session |
| `startSessionFromBriefing()` | 2034 | Same but from briefing screen |
| `endSession()` | 3847 | Prompt confirm |
| `doEndSession()` | 3850 | Save to history, reset state, go home |
| `saveSessionToHistory()` | 3869 | Persist session to `localStorage.cbta_history` |
| `doReset()` | 2766 | Clear exercises[], re-render list |

### Exercise list & view

| Function | Line | Purpose |
|----------|------|---------|
| `renderExList()` | 2040 | Render `#screen-session` content |
| `exStats(ex)` | 2091 | Compute avg score for an exercise |
| `openEx(i)` | 2100 | Set `state.activeIdx`, navigate to `#screen-ex` |
| `toggleCloseEx()` | 2111 | Mark/unmark exercise closed |
| `exTab(tab,el)` | 2122 | Switch exercise view tab |
| `renderExView()` | 2129 | Re-render topbar + content of `#screen-ex` |
| `renderExContent()` | 2175 | Delegate to the right tab renderer |
| `addExercise(sid)` | 2756 | Push new exercise object to `state.exercises` |
| `deleteEx()` | 2850 | Remove `state.exercises[state.activeIdx]` |

### Competency grading

| Function | Line | Purpose |
|----------|------|---------|
| `renderEvalTab(ex,sc,el)` | 2188 | Render Eval tab (competency grid) |
| `openComp(cid)` | 2537 | Open `#screen-comp` for a competency |
| `renderCompContent(comp)` | 2570 | Render grading UI in #screen-comp |
| `setGrade(n)` | 2618 | Set grade on current competency |
| `toggleOB(id,text,sign)` | 2630 | Toggle an observable behaviour (+/-) |
| `saveComp()` | 2656 | Write back to state, close modal |
| `setPilot(p)` | 2249 | Switch `state.activePilot` ("cpt"/"fo") |

### TEM / FFA / CRM

| Function | Line | Purpose |
|----------|------|---------|
| `renderFFATab(ex,sc,el)` | 2258 | FFA (Fly-Focus-Act) tab |
| `setFFA(tag,val)` | 2312 | Set FFA tag value |
| `renderTEMTab(ex,sc,el)` | 2320 | TEM tab |
| `addTEM(key,text)` | 2429 | Add threat/error/UAS entry |
| `removeTEM(key,i)` | 2445 | Remove entry |
| `renderCRMTab(ex,sc,el)` | 2452 | CRM tab |
| `setCRM(key,val)` | 2493 | Set CRM value |

### Debrief

| Function | Line | Purpose |
|----------|------|---------|
| `showDebrief()` | 2859 | Build debrief data, navigate to debrief |
| `debTab(tab,el)` | 3257 | Switch debrief tab |
| `renderDebContent()` | 3264 | Delegate to the right debrief renderer |
| `renderDebScores(el)` | 3432 | Scores tab (radar + bars) |
| `renderDebExercises(el)` | 3443 | Exercise summary tab |
| `renderDebTEM(el)` | 3326 | TEM statistics tab |
| `renderDebQuestionnaire(el)` | 3498 | Facilitation questions tab |
| `renderDebConclusion(el)` | 3589 | Conclusion / recommendations tab |
| `buildRadar(avgs,color)` | 3274 | Returns SVG radar chart string |
| `buildScoreSection(...)` | 3289 | Returns HTML score-bar block |

### Report & export

| Function | Line | Purpose |
|----------|------|---------|
| `showRapport()` | 2999 | Generate full report HTML → `#rapport-content`; stores globals `window._rapportHTML`, `window._rapportPilot`, `window._rapportDateStr` |
| `printRapport()` | 3203 | **PDF export** — opens standalone page in new tab; falls back to `data:` URI on iOS PWA |
| `ouvrirRapportSafari()` | 3239 | Navigate current tab to `data:` URI of the report (iOS Safari PWA workaround) |
| `partagerRapport()` | 2865 | Share report via Web Share API or clipboard fallback |
| `envoyerRapportEmailActuel()` | 2930 | Send full-HTML report by email (`mailto:`) |
| `envoyerRapportEmail(idx)` | 4166 | Send report for a history session by email |

### History / Dashboard

| Function | Line | Purpose |
|----------|------|---------|
| `showHistory()` | 3958 | Navigate to `#screen-history`, render content |
| `renderHistContent()` | 3965 | Delegate to the right history tab |
| `renderDashboard()` | 3974 | Aggregate stats across all saved sessions |
| `renderSessionsList()` | 4044 | List of past sessions |
| `renderPilotesList()` | 4083 | Pilot progress table |
| `showComparaisonPilote(name)` | 4116 | Show trends for a specific pilot |

### Utility

| Function | Line | Purpose |
|----------|------|---------|
| `cc(v)` | 3971 | Grade value → CSS color string |
| `cl(v)` | 3972 | Grade value → French label string |
| `levelInfo(avg)` | 3033 | `{l, c}` — label + color for an average |
| `bc(avg)` | 3040 | Color for competency bar |
| `generateRecommendations(csKey,name,closed)` | 4305 | Auto-generate text recommendations |
| `toggleDarkMode()` | 2770 | Toggle dark/light mode + `body.light-mode` class |
| `toggleLock()` | 2779 | Instructor lock/unlock UI |
| `doLogin()` | 4663 | Login screen handler |
| `envoyerEmail(sujet,corps)` | 4218 | Open `mailto:` with subject + body |
| `exportSession()` | 4449 | Build email report for current session (HTML version) |

---

## CSS conventions

- Dark theme by default. `body.light-mode` toggles to light.
- CSS variables on `:root`: `--bg`, `--text`, `--mut`, `--card`, `--border`, `--blue`, `--green`, `--red`, `--orange`, `--yellow`, `--purple`, `--fs`, `--fss`, `--fsxs`, `--fsl`, `--fsxl`.
- **Never** change `html, body { height:100%; overflow:hidden }` or `#app { height:100vh; overflow:hidden }` — the whole layout depends on these.
- Scrollable areas use the `.scroll` class (`flex:1; overflow-y:auto`).
- Screens are hidden/shown only via `showScreen()` (adds/removes `.active`).

---

## Print / PDF rules

- **Do not** call `window.print()` on the main page. The `overflow:hidden` layout clips output.
- `printRapport()` opens a fresh window with no constraints, then auto-triggers `window.print()`.
- The standalone print page reads `window._rapportHTML` — so `showRapport()` must have been called first.
- On iOS PWA, `window.open()` is blocked; the function falls back to `window.location.href = 'data:text/html;...'`.

---

## localStorage

| Key | Contents |
|-----|----------|
| `cbta_history` | JSON array of completed session snapshots (written by `saveSessionToHistory()`) |
| `cbta_user` | Logged-in instructor name |
| `cbta_dark` | Dark mode preference (`"1"` / `"0"`) |
| `cbta_lang` | Language (`"fr"` / `"en"`) |
| `cbta_lock` | Lock state |

---

## Common tasks

**Add a new exercise to the catalogue**  
Find the `SC` array (~line 160) or `NNC` array (~line 980). Copy an existing entry and give it a unique `id`.

**Add a new competency observable behaviour**  
Find the relevant competency in `COMPETENCIES[]` (~line 1789) and push a new `{id, text}` to its `obs` array. Keep the id unique within that competency.

**Change the report layout**  
Edit `showRapport()` (~line 2999). The HTML is built as a template-literal string; `pilotBlock()` (~line 3045) generates per-pilot sections.

**Add a section to the PDF report**  
Add HTML to the `html` template-literal inside `showRapport()` before line 3169 (the closing `</div>`). The PDF is generated from `window._rapportHTML` which is set at line 3196.

**Change navigation behaviour**  
Edit `showScreen()` (~line 1907).

**Add a new debrief tab**  
1. Add a `<button class="tab">` in `#screen-debrief` (~line 325–342).  
2. Add a branch to `renderDebContent()` (~line 3264).  
3. Write the renderer function.

**Fix a print/PDF issue**  
See the `printRapport()` function (~line 3203). The standalone-page approach must be preserved. Do not revert to `window.print()` on the main document.

---

## Branch naming

Active development branch: `claude/debrief-pdf-export-complete-6UHKd`  
Push all changes to that branch unless instructed otherwise.

---

## No build step

```bash
# Development: open directly in browser
open index.html

# Or serve locally (avoids some browser security restrictions)
python3 -m http.server 8080
# → http://localhost:8080
```

There is no `package.json`, no `node_modules`, no compilation. Any tool that expects a build step must be configured to treat `index.html` as the output artifact.
