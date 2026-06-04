# B737 CBTA TRI Companion

Application PWA mono-fichier pour les sessions TRI (Type Rating Instructor) B737 NG.  
Standards : QRH Rev55 · FCTM Rev25 · CBTA OACI.  
**Auteur : Cpt Bouchenafa Mohamed Amine**

---

## Pour les assistants IA — lire en premier

**L'intégralité de l'application est dans un seul fichier : `index.html` (≈ 7 000 lignes).**  
Pas de build, pas de bundler, pas de dépendances externes. Tout le HTML, CSS, JavaScript et les données (catalogue exercices, compétences, scénarios) sont inline.

Points clés pour éviter des recherches inutiles :
- `grep -n "function foo" index.html` est la façon la plus rapide de trouver n'importe quelle fonction.
- L'état est un objet mutable unique (`let state = {...}`). Rien n'est persisté en cours de session sauf via `localStorage` (historique via `saveSessionToHistory()`).
- L'UI est une pile de `<div class="screen">` ; une seule a la classe `active` à la fois.
- `window.print()` **ne doit jamais** être appelé directement sur la page principale — le layout utilise `height:100vh; overflow:hidden` partout. Utiliser l'approche fenêtre-standalone dans `printRapport()`.

---

## Architecture

```
index.html
├── <head>  CSS
│   ├── Variables CSS, resets, layout
│   ├── .screen → display:none (écrans cachés)
│   ├── .screen.active → display:flex (écran visible)
│   └── html,body,#app → height:100%; overflow:hidden (verrouillage viewport)
│
├── <body>  Écrans HTML
│   ├── #screen-login
│   ├── #screen-home          (accueil + formulaire session)
│   ├── #screen-briefing
│   ├── #screen-session       (liste exercices)
│   ├── #screen-ex            (exercice actif)
│   ├── #screen-debrief
│   ├── #screen-rapport       (rapport généré)
│   ├── #screen-history       (dashboard / sessions passées)
│   └── modaux : #modal-add, #modal-confirm, #modal-help, #modal-delete-ex
│
└── <script>  Tout le JavaScript
    ├── Catalogue exercices : SC[] + NNC[] → ALL_SC
    ├── SESSION_SCENARIOS[]   (11 scénarios templates 3h30)
    ├── COMPETENCIES[]        (9 compétences CBTA)
    ├── TRI_CHECK_CRITERIA[]  (grille TRI Check / CdB)
    ├── COMP_RECO{}           (8 recommandations × 9 compétences)
    ├── state {}
    └── Fonctions
```

---

## Flux de navigation

```
Login → Accueil → Briefing → Session (liste exercices)
                                  └→ Exercice (onglets : Eval / FFA / TEM / CRM / Facilitation)
                                         └→ Modal compétence (grading + OB)
                             Session → Débrief (onglets : Scores / Exercices / TEM / Questionnaire / Conclusion)
                                            ├→ Rapport PDF
                                            ├→ Mode Présentation (overlay plein écran)
                                            └→ Recommandations par pilote (modal + PDF)
                             Accueil → Historique (Dashboard / Sessions / Pilotes)
                                            └→ Dossier pilote (évolution multi-sessions)
```

`showScreen(id)` est la seule fonction de navigation.

---

## Objet state

```js
let state = {
  sessionName:      "",        // texte libre
  pilotName:        "",        // nom CPT
  foName:           "",        // nom FO (vide = session solo CPT)
  pilotMatricule:   "",        // matricule CPT (clé dossier)
  foMatricule:      "",        // matricule FO
  compagnie:        "",        // compagnie aérienne
  currentUser:      "",        // instructeur connecté
  instructorName:   "",

  exercises:        [],        // tableau d'objets exercice (voir ci-dessous)
  activeIdx:        null,      // index dans exercises[] de l'exercice ouvert
  activeComp:       null,      // compétence en cours de notation
  activePilot:      "cpt",     // "cpt" | "fo"

  currentExTab:     "eval",    // onglet actif dans la vue exercice
  currentDebTab:    "scores",  // onglet actif dans le débrief

  catFilter: "ALL", phaseFilter: "ALL", sysFilter: "ALL",

  briefingChecks:   {},        // key → bool
  briefingFacNotes: {},        // index → string

  debRootCauses: {},           // key → bool
  debNotes:      {},           // key → string
  debConclNotes: "",           // texte libre conclusion instructeur
};
```

### Forme d'un objet exercice

```js
{
  sid:       "sc_xxx",   // id dans ALL_SC
  closed:    false,      // true quand marqué terminé
  notes:     "",         // notes libres instructeur
  startTime: Date.now(),

  cs:    { KNO:{g:0,obs:[]}, WLM:{...}, ... },  // scores CPT
  csfo:  { ... },                                 // scores FO

  ffa:   { P:null, F:null, A:null },   // tags FFA CPT
  ffafo: { ... },                      // tags FFA FO

  tem:   { threats:[], errors:[], uas:[], mitigations:{} },  // TEM CPT
  temfo: { ... },                                             // TEM FO

  crm:   { ... },   // évaluations CRM
}
```

---

## Données clés

### COMPETENCIES (9 compétences)

| id  | Nom complet |
|-----|-------------|
| KNO | Application of Knowledge |
| WLM | Workload Management |
| SA  | Situation Awareness |
| PSD | Problem Solving & Decision Making |
| LTW | Leadership & Teamwork |
| FPM | Flight Path Mgmt Manual |
| FPA | Flight Path Mgmt Automation |
| COM | Communication |
| PRO | Application of Procedures |

### Échelle de notes (1–5)

| Valeur | Label | Couleur |
|--------|-------|---------|
| 1 | INACCEPTABLE | #EF4444 |
| 2 | SOUS-STANDARD | #F97316 |
| 3 | STANDARD | #F59E0B |
| 4 | AU-DESSUS DU STANDARD | #10B981 |
| 5 | EXEMPLAIRE | #3B82F6 |

### SESSION_SCENARIOS (11 scénarios)

Templates précalibrés sur 3h30 (préparation sol = 30 min déduite sur 4h totales). Chaque scénario a un nom, une couleur neon, une durée et une liste d'exercices recommandés.

### COMP_RECO (recommandations par compétence)

Objet avec 9 clés (une par compétence), chacune contenant 8 recommandations :
- Items 0-3 : niveau standard (score 2.5–3.4)
- Items 4-7 : consolidation intensive (score < 2.5)

---

## Référence des fonctions principales

### Navigation & cycle de vie session

| Fonction | But |
|----------|-----|
| `showScreen(id)` | Changer l'écran actif |
| `startSession()` | Lire le formulaire → state, aller à la session |
| `lookupPilotByMat(mat, seat)` | Auto-lookup pilote par matricule |
| `updatePilotDB(session)` | Sauvegarder/mettre à jour un pilote dans la base |
| `endSession()` / `doEndSession()` | Confirmation + sauvegarde + retour accueil |
| `saveSessionToHistory()` | Persister la session dans `localStorage.cbta_history` |

### Liste exercices & vue exercice

| Fonction | But |
|----------|-----|
| `renderExList()` | Rendre `#screen-session` |
| `exStats(ex)` | Calculer le score moyen d'un exercice |
| `openEx(i)` | Ouvrir un exercice (`state.activeIdx`) |
| `toggleCloseEx()` | Marquer/démarquer exercice clôturé |
| `addExercise(sid)` | Ajouter un exercice dans `state.exercises` |
| `deleteEx()` | Supprimer `state.exercises[state.activeIdx]` |

### Notation compétences

| Fonction | But |
|----------|-----|
| `renderEvalTab(ex,sc,el)` | Rendu onglet Eval (grille compétences) |
| `openComp(cid)` | Ouvrir `#screen-comp` pour une compétence |
| `setGrade(n)` | Définir la note sur la compétence active |
| `toggleOB(id,text,sign)` | Activer/désactiver un observable (+/-) |
| `saveComp()` | Écrire dans state, fermer le modal |

### Débrief

| Fonction | But |
|----------|-----|
| `showDebrief()` | Construire les données débrief, naviguer |
| `renderDebConclusion(el)` | Onglet Conclusion (recommandations + Prof Check) |
| `generateRecommendations(csKey,name,closed)` | Générer les recommandations HTML |
| `showRecoModal(who)` | Ouvrir la modale recommandations par pilote ('cpt'|'fo') |
| `printRecoModal(who)` | Ouvrir fenêtre print PDF des recommandations |
| `showPresentation()` | Mode présentation plein écran (overlay) |

### Rapport & export

| Fonction | But |
|----------|-----|
| `showRapport()` | Générer le rapport HTML complet |
| `printRapport()` | Export PDF — ouvre fenêtre standalone |
| `printRapportFromHistory(idx)` | PDF d'une session de l'historique |
| `exportJSON()` | Exporter sessions + pilotdb en JSON |
| `importJSON(file)` | Importer avec fusion ou remplacement |

### Historique & dossier pilote

| Fonction | But |
|----------|-----|
| `showHistory()` | Naviguer vers `#screen-history` |
| `renderDashboard()` | Statistiques agrégées toutes sessions |
| `renderPilotesList()` | Liste des pilotes avec scores et badges |
| `showComparaisonPilote(key, name)` | Dossier complet d'un pilote (par matricule) |

---

## localStorage

| Clé | Contenu |
|-----|---------|
| `cbta_history` | JSON array des sessions terminées |
| `cbta_pilotdb` | JSON objet `{matricule → {name, compagnie, sessions[]}}` |
| `cbta_darkmode` | Préférence dark/light (`"1"` / `"0"`) |
| `cbta_fs` | Taille police (`"s"` / `"m"` / `"l"` / `"xl"`) |
| `cbta_user` | Nom de l'instructeur connecté |

---

## Règles CSS

- Thème sombre par défaut. `body.light-mode` passe en clair.
- Variables CSS sur `:root` : `--bg`, `--text`, `--card`, `--border`, `--blue`, `--green`, `--red`, `--orange`, `--yellow`, `--purple`, `--fs`, etc.
- **Ne jamais** modifier `html, body { height:100%; overflow:hidden }` — tout le layout en dépend.
- Les zones scrollables utilisent la classe `.scroll` (`flex:1; overflow-y:auto`).
- Les écrans sont cachés/affichés uniquement via `showScreen()`.

---

## Règles PDF / impression

- Ne **jamais** appeler `window.print()` sur la page principale.
- `printRapport()` ouvre une fenêtre vierge sans contraintes, puis déclenche `window.print()`.
- `printRecoModal(who)` fonctionne de la même façon pour les recommandations.
- Sur iOS PWA, `window.open()` est bloqué — fallback vers `window.location.href = 'data:text/html;...'`.

---

## Overlay `#pres-overlay`

Utilisé par deux fonctionnalités :
1. **Mode Présentation** (`showPresentation()`) — affichage grand écran, `display:block`, clic pour fermer.
2. **Modal Recommandations** (`showRecoModal()`) — overlay centré flex, bouton ✕ pour fermer.

Les deux fonctions écrivent `innerHTML` et `style` directement sur cet élément. Pas de conflit possible (non simultanés).

---

## Tâches courantes

**Ajouter un exercice au catalogue**  
Trouver le tableau `SC[]` ou `NNC[]`. Copier une entrée existante, donner un `id` unique.

**Ajouter un observable comportemental**  
Trouver la compétence dans `COMPETENCIES[]`, ajouter `{id, text}` dans son tableau `obs`. L'id doit être unique dans la compétence.

**Modifier les recommandations**  
Éditer l'objet `COMP_RECO` — 8 items par compétence. Items 0-3 = niveau standard, items 4-7 = niveau critique.

**Modifier le rapport PDF**  
Éditer `showRapport()`. Le HTML est construit en template-literal ; `pilotBlock()` génère les sections par pilote.

**Ajouter un onglet débrief**  
1. Ajouter `<button class="tab">` dans `#screen-debrief`.  
2. Ajouter une branche dans `renderDebContent()`.  
3. Écrire la fonction de rendu.

---

## Développement

```bash
# Ouvrir directement dans le navigateur
open index.html

# Ou servir localement
python3 -m http.server 8080
# → http://localhost:8080
```

Aucun `package.json`, aucun `node_modules`, aucune compilation. `index.html` est directement l'artefact final.

---

## Branche active

Toutes les modifications vont sur la branche : `claude/debrief-pdf-export-complete-6UHKd`
