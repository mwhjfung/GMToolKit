# Theme Rebrand + UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the app to a logo-derived pink/purple theme (dark + light only) and land 12 approved UX fixes: comma-input bug, deep search, monster V/R/I + spellcasting, modal close rules, paragraph gaps, 640px min width, browser-style party tabs, inline character add/edit, and an action-type dropdown.

**Architecture:** Electron + React 18 + Tailwind (CSS-variable palette) + Zustand stores persisted via IndexedDB helpers. Theme is two static palettes in `index.css` switched by `data-theme`. All library content flows through `ContentEntry` (typed `data` per content type) defined in `types/content.ts`, edited by `EntryForm` via `TEMPLATES` field kinds, displayed by `ContentDetail`. Party characters are `PcUnit` in `pcStore`.

**Tech Stack:** TypeScript, React 18, Tailwind CSS, Zustand, @dnd-kit (already a dependency), electron-vite.

**Spec:** `docs/superpowers/specs/2026-07-10-theme-and-ux-overhaul-design.md`

## Global Constraints

- **No test infrastructure exists** (no test script/runner). Each task gates on `npm run typecheck` (runs tsc for node + web) and a concrete manual check in the running app (`npm run dev`). Do not add a test framework.
- WCAG AA (≥4.5:1) for accent-as-text on surfaces and `--accent-fg` on accent, both modes.
- Escape continues to close modals; backdrop click must NOT close any modal except the ⌘K search palette (`GlobalSearch.tsx`).
- The working tree contains ~600 lines of pre-existing uncommitted changes. **Never `git add -A` / `git add .`** — stage only the files each task touches. Do not revert or "clean up" unrelated working-tree changes.
- Existing UI conventions: `input`, `label`, `chip`, `panel`, `btn-*`, `icon-btn` component classes from `index.css`; lucide-react icons; `cn()` for class merging.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Logo-derived palette, dark/light only (spec items 1–2)

**Files:**
- Modify: `src/renderer/src/index.css:5-90` (palette variables, selection, scrollbars)
- Modify: `src/renderer/src/lib/theme.ts` (gut accent machinery)
- Modify: `src/renderer/src/lib/store/settingsStore.ts` (drop accentColor)
- Modify: `src/renderer/src/features/settings/SettingsPage.tsx:73-122` (AppearanceSection)
- Modify: `tailwind.config.js:3` (darkMode selector)
- Modify: `src/main/index.ts:13` (window backgroundColor)

**Interfaces:**
- Produces: `applyTheme(mode: ThemeMode): void` (single argument — callers updated here). `data-theme` attribute values become `'dark'` / `'light'`.

- [ ] **Step 1: Replace the palettes in `index.css`**

Replace the two theme blocks (lines 5–44) with:

```css
/* ---- colour themes (channels are space-separated RGB for Tailwind alpha) ----
   Palette derived from the GM Toolkit logo: plum #220b1f, pink #ec0a72,
   purple #702074. */
:root,
[data-theme='dark'] {
  color-scheme: dark;
  --bg: 20 10 19;
  --surface: 29 16 28;
  --surface-2: 40 22 38;
  --surface-3: 53 30 50;
  --border: 66 40 62;
  --border-strong: 90 56 84;
  --ink: 243 231 240;
  --ink-muted: 178 153 172;
  --ink-faint: 124 100 118;
  --accent: 255 46 140;
  --accent-strong: 236 10 114;
  --accent-fg: 32 8 22;
  --danger: 255 92 92;
  --danger-strong: 224 62 62;
  --success: 34 226 154;
  --info: 196 130 224;
}
[data-theme='light'] {
  color-scheme: light;
  --bg: 246 238 244;
  --surface: 255 255 255;
  --surface-2: 244 234 242;
  --surface-3: 232 216 229;
  --border: 215 195 210;
  --border-strong: 185 158 180;
  --ink: 34 16 34;
  --ink-muted: 107 86 105;
  --ink-faint: 152 128 148;
  --accent: 199 7 100;
  --accent-strong: 168 6 84;
  --accent-fg: 255 255 255;
  --danger: 200 32 32;
  --danger-strong: 170 24 24;
  --success: 13 148 96;
  --info: 112 32 116;
}
```

Contrast rationale (verify, don't trust): dark accent `#ff2e8c` on `#1d101c` ≈ 4.9:1; dark `--accent-fg #200816` on `#ff2e8c` ≈ 6.0:1; light accent `#c70764` on white ≈ 5.8:1; white on `#c70764` ≈ 5.8:1. Check with a contrast calculator (e.g. `npx wcag-contrast` or an online checker) and nudge if below 4.5.

Then update the hard-coded cyan/neutral leftovers in the same file:

```css
  ::selection {
    background: rgba(255, 46, 140, 0.35);
  }

  * {
    scrollbar-width: thin;
    scrollbar-color: #42283e transparent;
  }
```

and the webkit scrollbar colours: thumb `#42283e`, thumb hover `#5a3854`.

- [ ] **Step 2: Gut `theme.ts`**

Replace the whole file with:

```ts
export type ThemeMode = 'light' | 'dark'

/** Switch between the two static palettes defined in index.css. */
export function applyTheme(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode
}
```

- [ ] **Step 3: Drop `accentColor` from `settingsStore.ts`**

Remove from the interface: `accentColor: string` and `setAccentColor: (c: string) => void`.
Remove the initial `accentColor: ''`.
In `load()`: delete `getSetting<string>('accentColor')` from the `Promise.all` (and its destructured variable), call `applyTheme(m)`, and remove `accentColor: accent` from the `set({...})`.
`setThemeMode` becomes:

```ts
  setThemeMode: (m) => {
    set({ themeMode: m })
    applyTheme(m)
    void setSetting('themeMode', m)
  },
```

Delete `setAccentColor` entirely. (A stale persisted `accentColor` setting is simply never read again — no migration needed.)

- [ ] **Step 4: Simplify Settings → Appearance**

In `SettingsPage.tsx` `AppearanceSection`: delete the `accentColor`/`setAccentColor` selectors, the whole `<Field label="Primary colour">…</Field>` block, and the `ACCENT_PRESETS` import. Section description becomes `"Light or dark."`. In the `Segmented` component change the active classes `'bg-accent text-black'` → `'bg-accent text-accent-fg'`.

- [ ] **Step 5: Update tailwind + Electron shell**

`tailwind.config.js`: `darkMode: ['selector', '[data-theme="dark"]']`.
`src/main/index.ts`: `backgroundColor: '#140a13'`.

- [ ] **Step 6: Sweep for stragglers**

Run: `grep -rn "cyberpunk\|1fe0ff\|ACCENT_PRESETS\|accentColor\|08070f" src/ tailwind.config.js src/renderer/index.html`
Expected: no hits outside this task's already-edited files. Fix any found (e.g. `index.html` inline background). Also run `grep -rn "text-black" src/renderer/src` and change any usage sitting on an accent background to `text-accent-fg`.

- [ ] **Step 7: Typecheck + visual check**

Run: `npm run typecheck` → passes.
Run: `npm run dev` → app opens in plum/pink dark theme; Settings → Appearance shows only Dark/Light; switching to Light gives white surfaces with dark-pink accent; buttons/active nav readable in both.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/index.css src/renderer/src/lib/theme.ts src/renderer/src/lib/store/settingsStore.ts src/renderer/src/features/settings/SettingsPage.tsx tailwind.config.js src/main/index.ts src/renderer/index.html
git commit -m "feat: logo-derived pink/purple theme, dark/light only"
```

---

### Task 2: Logo in the sidebar (spec item 3)

**Files:**
- Create: `src/renderer/src/assets/logo.png` (copy of `/Users/mfungy/Downloads/GMToolKit-Favicon.png`)
- Modify: `src/renderer/src/app/Sidebar.tsx:52-55`

- [ ] **Step 1: Copy the asset**

```bash
mkdir -p src/renderer/src/assets
cp /Users/mfungy/Downloads/GMToolKit-Favicon.png src/renderer/src/assets/logo.png
```

Check `src/renderer/src/env.d.ts` contains `/// <reference types="vite/client" />` (gives `*.png` module types). If missing, add it.

- [ ] **Step 2: Swap the accent dot for the logo**

In `Sidebar.tsx`, add `import logo from '@/assets/logo.png'` and replace:

```tsx
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span className="text-sm font-semibold tracking-wide text-ink">GM TOOLKIT</span>
              </div>
```

with:

```tsx
              <div className="flex items-center gap-1">
                <img src={logo} alt="" className="h-5 w-5 rounded" />
                <span className="text-sm font-semibold tracking-wide text-ink">GM TOOLKIT</span>
              </div>
```

(`gap-1` = 4px; `h-5` = 20px vs 14px text = slightly larger; `items-center` centres the text on the logo.)

- [ ] **Step 3: Typecheck + visual check**

Run: `npm run typecheck` → passes. In the app: logo sits left of GM TOOLKIT, text vertically centred, 4px gap.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/assets/logo.png src/renderer/src/app/Sidebar.tsx src/renderer/src/env.d.ts
git commit -m "feat: show logo beside GM TOOLKIT in sidebar"
```

---

### Task 3: CommaListInput — typing commas works (spec item 4a)

**Files:**
- Create: `src/renderer/src/components/CommaListInput.tsx`
- Modify: `src/renderer/src/features/library/EntryForm.tsx:399-414` (csv kind), `:588-602` (Tags field)

**Interfaces:**
- Produces: `CommaListInput({ value: string[]; onChange: (v: string[]) => void; placeholder?: string }): JSX.Element`

**Root cause being fixed:** these inputs render `value.join(', ')` and re-parse with `split(',').map(trim).filter(Boolean)` on every keystroke, so a trailing comma is destroyed as you type it.

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useRef, useState } from 'react'

const parse = (raw: string): string[] =>
  raw.split(',').map((s) => s.trim()).filter(Boolean)

/**
 * Text input for comma-separated lists that lets you type commas freely:
 * the raw text lives in local state while the field is focused and the
 * parsed array is emitted on every change. External value changes only
 * overwrite the text when the field is not focused.
 */
export function CommaListInput({
  value,
  onChange,
  placeholder
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}): JSX.Element {
  const [raw, setRaw] = useState(value.join(', '))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setRaw(value.join(', '))
  }, [value])

  return (
    <input
      className="input"
      placeholder={placeholder}
      value={raw}
      onFocus={() => {
        focused.current = true
      }}
      onBlur={(e) => {
        focused.current = false
        setRaw(parse(e.target.value).join(', '))
      }}
      onChange={(e) => {
        setRaw(e.target.value)
        onChange(parse(e.target.value))
      }}
    />
  )
}
```

- [ ] **Step 2: Adopt it in `EntryForm.tsx`**

Add `import { CommaListInput } from '@/components/CommaListInput'`.

Replace the `case 'csv':` body of `FieldRenderer` with:

```tsx
    case 'csv':
      return (
        <CommaListInput
          value={Array.isArray(value) ? (value as string[]) : []}
          placeholder={field.placeholder}
          onChange={onChange}
        />
      )
```

Replace the Tags `<input …/>` (the one using `draft.tags.join(', ')`) with:

```tsx
            <CommaListInput
              value={draft.tags}
              placeholder="comma, separated"
              onChange={(tags) => setDraft((d) => ({ ...d, tags }))}
            />
```

- [ ] **Step 3: Audit for other comma-parsed inputs**

Run: `grep -rn "split(',')" src/renderer/src --include='*.tsx'`
Expected remaining hits: none in live-input `onChange` paths. (`CharacterDialog.tsx` is deleted in Task 10; `open5e.ts`/import parsers are one-shot parsing, not typing.) Convert any other live input found the same way.

- [ ] **Step 4: Typecheck + manual check**

Run: `npm run typecheck` → passes.
In the app: Library → New Spell → type `Wizard, Sorcerer, Druid` into Classes (commas must survive as typed, including `Wizard, ` mid-typing); same for Tags. Save and re-open the entry — values round-trip as three items.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/CommaListInput.tsx src/renderer/src/features/library/EntryForm.tsx
git commit -m "fix: allow typing commas in tag/csv list inputs"
```

---

### Task 4: Search matches multi-value data fields (spec item 4b)

**Files:**
- Modify: `src/renderer/src/lib/db/content.ts:47-64` (`filterContent` + new helper)
- Modify: `src/renderer/src/components/GlobalSearch.tsx:67-68`

**Interfaces:**
- Produces: `entryHaystack(e: ContentEntry): string` exported from `lib/db/content.ts` — lowercase searchable text: name, summary, tags, plus every `string[]` value one level deep in `e.data` (classes, properties, subclasses, connections, …) and `creatureType`. Long prose fields (plain strings like `description`) are deliberately excluded to avoid noise.

- [ ] **Step 1: Add the cached haystack helper in `content.ts`**

Above `filterContent`:

```ts
const haystackCache = new Map<string, { stamp: number; text: string }>()

/** Lowercase searchable text for an entry: name, summary, tags, plus any
 * string-array data values (spell classes, weapon properties, …) and the
 * creature type. Cached per entry so per-keystroke filtering stays fast. */
export function entryHaystack(e: ContentEntry): string {
  const cached = haystackCache.get(e.id)
  if (cached && cached.stamp === e.updatedAt) return cached.text
  const parts: string[] = [e.name, e.summary, ...e.tags]
  const data = e.data as unknown as Record<string, unknown>
  for (const v of Object.values(data)) {
    if (Array.isArray(v)) {
      for (const x of v) if (typeof x === 'string') parts.push(x)
    }
  }
  if (typeof data.creatureType === 'string') parts.push(data.creatureType)
  const text = parts.join('\n').toLowerCase()
  haystackCache.set(e.id, { stamp: e.updatedAt, text })
  return text
}
```

Note: `spellsByLevel`/`features` are arrays of objects, not strings — the `typeof x === 'string'` guard skips them; that's intended.

- [ ] **Step 2: Use it in `filterContent`**

Replace the query filter body with:

```ts
  if (filter.query && filter.query.trim()) {
    const q = filter.query.toLowerCase().trim()
    result = result.filter((i) => entryHaystack(i).includes(q))
  }
```

- [ ] **Step 3: Use it in `GlobalSearch.tsx`**

Import `entryHaystack` from `@/lib/db/content` and change the content filter:

```ts
    const contentResults: Result[] = items
      .filter((i) => entryHaystack(i).includes(term))
      .slice(0, 40)
```

- [ ] **Step 4: Typecheck + manual check**

Run: `npm run typecheck` → passes.
In the app: give a spell classes `Wizard, Sorcerer, Druid`; the Library search box AND ⌘K search must each find it for `wizard`, `sorcerer`, and `druid`. Typing in Library search with the full SRD loaded must stay responsive.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/db/content.ts src/renderer/src/components/GlobalSearch.tsx
git commit -m "feat: search matches classes, properties and other list fields"
```

---

### Task 5: Monster vulnerabilities / resistances / immunities (spec item 5)

**Files:**
- Modify: `src/renderer/src/types/content.ts:61-83` (`MonsterData`)
- Modify: `src/renderer/src/lib/templates/schemas.ts` (monster template + `makeNewEntry`)
- Modify: `src/renderer/src/components/ContentDetail.tsx:240-245` (`MonsterDetail`)
- Modify: `src/renderer/src/lib/api/open5e.ts` (`mapMonster`)

- [ ] **Step 1: Extend `MonsterData`**

After `languages?: string` add:

```ts
  vulnerabilities?: string[]
  resistances?: string[]
  immunities?: string[]
```

- [ ] **Step 2: Extend the monster template**

In `TEMPLATES.monster.fields`, after the `languages` field insert:

```ts
      { key: 'vulnerabilities', label: 'Damage vulnerabilities', kind: 'tags', options: DAMAGE_TYPES },
      { key: 'resistances', label: 'Damage resistances', kind: 'tags', options: DAMAGE_TYPES },
      { key: 'immunities', label: 'Damage immunities', kind: 'tags', options: DAMAGE_TYPES },
```

(The `tags` kind renders `TagSelect multi` which allows free text, so entries like `bludgeoning from nonmagical attacks` work.)

In `makeNewEntry` `case 'monster'` data, add `vulnerabilities: [], resistances: [], immunities: [],`.

- [ ] **Step 3: Show them on the stat block**

In `MonsterDetail` (ContentDetail.tsx), inside the `<div className="space-y-1">` holding Saves/Skills/Senses/Languages, after `Languages` add:

```tsx
        {(d.vulnerabilities?.length ?? 0) > 0 && (
          <Field label="Vulnerabilities">{d.vulnerabilities!.join(', ')}</Field>
        )}
        {(d.resistances?.length ?? 0) > 0 && (
          <Field label="Resistances">{d.resistances!.join(', ')}</Field>
        )}
        {(d.immunities?.length ?? 0) > 0 && (
          <Field label="Immunities">{d.immunities!.join(', ')}</Field>
        )}
```

- [ ] **Step 4: Map from Open5e SRD sync**

In `open5e.ts`, add to the `RawMonster` interface (wherever it's declared in the file):

```ts
  damage_vulnerabilities?: string
  damage_resistances?: string
  damage_immunities?: string
```

Add a helper above `mapMonster`:

```ts
/** Open5e damage lists use ';' between qualifier groups, ',' inside them —
 * e.g. "fire; bludgeoning, piercing, and slashing from nonmagical attacks".
 * Split on ';' always; split a group on ',' only when it has no qualifier. */
function parseDamageList(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw.split(';').flatMap((group) => {
    const g = group.trim()
    if (!g) return []
    if (g.includes(' from ')) return [g]
    return g.split(',').map((s) => s.replace(/^and /, '').trim()).filter(Boolean)
  })
}
```

In `mapMonster`'s returned `data`, after `languages`:

```ts
      vulnerabilities: parseDamageList(r.damage_vulnerabilities),
      resistances: parseDamageList(r.damage_resistances),
      immunities: parseDamageList(r.damage_immunities),
```

- [ ] **Step 5: Typecheck + manual check**

Run: `npm run typecheck` → passes.
In the app: New Monster/NPC → add `Psychic` immunity, `Bludgeoning`+`Piercing` resistance, `Fire` vulnerability → save → detail drawer shows three labelled rows.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/types/content.ts src/renderer/src/lib/templates/schemas.ts src/renderer/src/components/ContentDetail.tsx src/renderer/src/lib/api/open5e.ts
git commit -m "feat: monster vulnerabilities, resistances and immunities"
```

---

### Task 6: Monster/NPC spellcasting (spec item 7)

**Files:**
- Modify: `src/renderer/src/types/content.ts` (`MonsterData`)
- Modify: `src/renderer/src/lib/templates/schemas.ts` (template, `makeNewEntry`, `collectReferences`)
- Modify: `src/renderer/src/components/ContentDetail.tsx` (`MonsterDetail`)

**Interfaces:**
- Consumes: existing `leveledSpells` field kind (renders `LeveledSpellsField` in EntryForm — spell autocomplete from library), existing `LeveledSpells { level: number; spells: string[] }` type, existing `RefList`/`Section`/`Field` in ContentDetail, existing stub-creation flow via `collectReferences`.

- [ ] **Step 1: Extend `MonsterData`**

After the three defense arrays from Task 5, add:

```ts
  spellcastingAbility?: string
  spellSaveDc?: string
  spellAttackBonus?: string
  spellsByLevel?: LeveledSpells[]
```

(`LeveledSpells` is already exported from this file.)

- [ ] **Step 2: Extend the monster template**

In `TEMPLATES.monster.fields`, after the `cr` field insert:

```ts
      { key: 'spellcastingAbility', label: 'Spellcasting ability', kind: 'select', options: ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'] },
      { key: 'spellSaveDc', label: 'Spell save DC', kind: 'text', placeholder: '15' },
      { key: 'spellAttackBonus', label: 'Spell attack bonus', kind: 'text', placeholder: '+7' },
      { key: 'spellsByLevel', label: 'Spells by level', kind: 'leveledSpells' },
```

In `makeNewEntry` `case 'monster'` data add `spellsByLevel: [],`.

- [ ] **Step 3: Create stubs / references for monster spells**

In `collectReferences`, add a case:

```ts
    case 'monster':
      for (const row of entry.data.spellsByLevel ?? [])
        for (const s of row.spells) refs.push({ type: 'spell', name: s })
      break
```

- [ ] **Step 4: Spellcasting section on the stat block**

In `MonsterDetail`, after the Saves/Skills/Senses/Languages/V-R-I block and before Traits:

```tsx
      {(d.spellcastingAbility || (d.spellsByLevel?.length ?? 0) > 0) && (
        <Section title="Spellcasting">
          {(d.spellcastingAbility || d.spellSaveDc || d.spellAttackBonus) && (
            <p className="text-sm text-ink-muted">
              {[
                d.spellcastingAbility && `Ability: ${d.spellcastingAbility}`,
                d.spellSaveDc && `Save DC ${d.spellSaveDc}`,
                d.spellAttackBonus && `${d.spellAttackBonus} to hit`
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          <div className="space-y-1">
            {(d.spellsByLevel ?? []).map((row) => (
              <Field key={row.level} label={row.level === 0 ? 'Cantrips' : `Level ${row.level}`}>
                <RefList
                  names={row.spells}
                  type="spell"
                  allowCreate={entry.source === 'custom'}
                  world={entry.world}
                />
              </Field>
            ))}
          </div>
        </Section>
      )}
```

- [ ] **Step 5: Typecheck + manual check**

Run: `npm run typecheck` → passes.
In the app: edit an NPC → set ability Wisdom, DC 15, +7 → add Cantrips row with `Guidance` and a Level 1 row with `Cure Wounds` (autocomplete offers library spells) → save. Detail shows a Spellcasting section, spell names are clickable links; a made-up spell name creates a stub entry.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/types/content.ts src/renderer/src/lib/templates/schemas.ts src/renderer/src/components/ContentDetail.tsx
git commit -m "feat: monster/NPC spellcasting with leveled spell links"
```

---

### Task 7: Paragraph gaps in plain-text renderers (spec item 8)

**Files:**
- Modify: `src/renderer/src/components/ContentDetail.tsx:118` (StatBlockList) and `:346-351` (class feature desc)
- Modify: `src/renderer/src/features/party/SheetView.tsx:178-180` (PC action description)

- [ ] **Step 1: StatBlockList**

Line ~118, add `whitespace-pre-line`:

```tsx
        <p key={`${e.name}-${i}`} className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">
```

- [ ] **Step 2: Class feature descriptions**

Find the renderer around line 346–351 printing `{f.desc}` (features-by-level list) and add `whitespace-pre-line` to its className the same way.

- [ ] **Step 3: PC action descriptions in SheetView**

```tsx
            {a.description && (
              <p className="mt-1 whitespace-pre-line text-xs leading-snug text-ink-muted">{a.description}</p>
            )}
```

- [ ] **Step 4: Sweep for other collapsed renderers**

Run: `grep -rn "\.desc}\|\.description}" src/renderer/src --include='*.tsx' | grep -v Markdown | grep -v whitespace-pre`
Any hit that renders user-entered multiline text into a plain element gets `whitespace-pre-line`. (Markdown-rendered fields are already fine.)

- [ ] **Step 5: Typecheck + manual check**

Run: `npm run typecheck` → passes.
In the app: edit a monster action description with two paragraphs separated by a blank line → detail view shows the gap. Same for a PC action description.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/ContentDetail.tsx src/renderer/src/features/party/SheetView.tsx
git commit -m "fix: preserve paragraph breaks in stat block and action text"
```

---

### Task 8: Verify modals close only via buttons (spec item 6)

**Files:**
- Modify: only if the audit finds stragglers.

The working tree already removed backdrop `onClick={onClose}` from the dialogs; this task verifies completeness.

- [ ] **Step 1: Audit**

Run: `grep -rn -A3 '"fixed inset-0' src/renderer/src --include='*.tsx' | grep "onClick"`
Expected: backdrop-level `onClick` only in `GlobalSearch.tsx` (the ⌘K palette keeps click-outside by design) — inner-panel `stopPropagation` handlers are harmless leftovers and may stay. Remove any other backdrop `onClick={...close...}` found.

- [ ] **Step 2: Manual check**

In the app, for at least: EntryForm (edit entry), Import dialog, Export dialog, Source dialog, Session dialog, Initiative add-modal — click the dark backdrop → modal stays open; X/Cancel closes; Escape (where wired) still closes. ⌘K palette still dismisses on outside click.

- [ ] **Step 3: Commit (only if changes were needed)**

```bash
git add <changed files>
git commit -m "fix: modals no longer close on backdrop click"
```

---

### Task 9: Minimum window width 640px (spec item 9)

**Files:**
- Modify: `src/main/index.ts:10` (`minWidth`)
- Modify: dialog panels missing `max-w-full` (found by grep below), notably `src/renderer/src/features/library/EntryForm.tsx:546`

- [ ] **Step 1: Lower the floor**

`src/main/index.ts`: `minWidth: 640,`.

- [ ] **Step 2: Make fixed-width panels shrinkable**

Run: `grep -rn "w-\[[4-9][0-9][0-9]px\]" src/renderer/src --include='*.tsx' | grep -v "max-w-full"`
For every dialog/panel hit, append `max-w-full` to the className. Known case — EntryForm root:

```tsx
    <div className="panel flex max-h-[86vh] w-[640px] max-w-full flex-col">
```

- [ ] **Step 3: Manual overflow sweep at 640px**

Run the app, resize to the new minimum (it should stop at 640). Visit Dashboard, Library (grid + filters row), an entry detail drawer, Party sheet (should stack panels — it already breaks at `lg`), Settings, Initiative tracker. Fix any horizontal scrollbar/clipped control found (typical fixes: `flex-wrap`, `min-w-0`, `overflow-x-auto` on toolbars).

- [ ] **Step 4: Typecheck + commit**

Run: `npm run typecheck` → passes.

```bash
git add src/main/index.ts <other touched files>
git commit -m "feat: allow window down to 640px wide"
```

---

### Task 10: Party header buttons + inline add (spec item 11, part 1)

**Files:**
- Modify: `src/renderer/src/lib/store/pcStore.ts` (`addPc` returns id)
- Modify: `src/renderer/src/features/party/PartyPage.tsx` (buttons, editing state, remove CharacterDialog)
- Delete: `src/renderer/src/features/party/CharacterDialog.tsx`

**Interfaces:**
- Consumes: `ImportCharactersDialog({ onClose, onDone })` (already exists and handles D&D Beyond + JSON file).
- Produces: `addPc(pc: Omit<PcUnit,'id'>): string` (now returns the new id); `PartyPage` passes `editing: boolean` and `onToggleEdit: () => void` to `CharacterSheet` (implemented in Task 11 — do Tasks 10 and 11 together before running the app).

- [ ] **Step 1: `addPc` returns the new id**

In `pcStore.ts` interface: `addPc: (pc: Omit<PcUnit, 'id'>) => string`. In the implementation (line ~264), capture the generated id and return it after `persist()` (keep the existing id-generation exactly as-is — only add the return).

- [ ] **Step 2: Rework `PartyPage`**

Replace the dialog state and header actions. Key changes (whole relevant sections):

```tsx
import { useEffect, useState } from 'react'
import { Plus, Users, Download, Upload } from 'lucide-react'
import { Page } from '@/components/Page'
import { EmptyState } from '@/components/EmptyState'
import { usePcStore, newPc } from '@/lib/store/pcStore'
import { useUiStore } from '@/lib/store/uiStore'
import { exportCharacters } from '@/lib/data/partyData'
import { CharacterSheet } from './CharacterSheet'
import { ImportCharactersDialog } from './ImportCharactersDialog'
import { cn } from '@/lib/cn'
```

State: replace `const [dialog, setDialog] = useState<DialogState>(null)` (and the `DialogState` type) with:

```tsx
  const [importOpen, setImportOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
```

Add-character handler inside the component:

```tsx
  const addPc = usePcStore((s) => s.addPc)
  const handleAdd = (): void => {
    const id = addPc(newPc())
    setSelectedId(id)
    setEditingId(id)
  }
```

Header `actions` become:

```tsx
        <>
          {pcs.length > 0 && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                exportCharacters()
                setStatus('Exported characters.')
              }}
            >
              <Download size={15} />
              Export
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={() => setImportOpen(true)}>
            <Upload size={15} />
            Import
          </button>
          <button type="button" className="btn-accent" onClick={handleAdd}>
            <Plus size={15} />
            Add character
          </button>
        </>
```

The EmptyState button also calls `handleAdd`. The sheet render becomes:

```tsx
              {selected && (
                <CharacterSheet
                  key={selected.id}
                  pc={selected}
                  editing={editingId === selected.id}
                  onToggleEdit={() =>
                    setEditingId((cur) => (cur === selected.id ? null : selected.id))
                  }
                />
              )}
```

And the dialog block at the bottom becomes:

```tsx
      {importOpen && (
        <ImportCharactersDialog onClose={() => setImportOpen(false)} onDone={(m) => setStatus(m)} />
      )}
```

- [ ] **Step 3: Delete `CharacterDialog.tsx`**

```bash
git rm src/renderer/src/features/party/CharacterDialog.tsx
```

Run: `grep -rn "CharacterDialog" src/renderer/src` → only `ImportCharactersDialog` remains.

- [ ] **Step 4: Typecheck**

`npm run typecheck` will fail until Task 11 adds the `editing`/`onToggleEdit` props to `CharacterSheet` — proceed straight to Task 11, then run it.

---

### Task 11: Inline edit mode on the character sheet + action-type dropdown (spec items 11 part 2 + 12)

**Files:**
- Modify: `src/renderer/src/features/party/CharacterSheet.tsx` (edit-mode header, prop changes)
- Modify: `src/renderer/src/features/party/SheetView.tsx` (editable abilities/saves/skills/AC/speed/maxHP/slot maxes; action-type select)

**Interfaces:**
- Consumes: `updatePc(id, patch)`, `usePcStore`, `TagSelect`, `ActionType` union `'action' | 'bonus' | 'reaction' | 'other'`, D5E race/class preset lists (moved here from the deleted CharacterDialog).
- Produces: `CharacterSheet({ pc, editing, onToggleEdit }): JSX.Element`; `SheetView({ pc, editing }): JSX.Element`.

- [ ] **Step 1: CharacterSheet — props + editable header**

Signature becomes:

```tsx
export function CharacterSheet({
  pc,
  editing,
  onToggleEdit
}: {
  pc: PcUnit
  editing: boolean
  onToggleEdit: () => void
}): JSX.Element {
```

Add imports: `Check` from lucide-react, `usePcStore`, `TagSelect`. Move the `D5E_RACES` and `D5E_CLASSES` constants from the old CharacterDialog into this file (same values). Add inside the component:

```tsx
  const updatePc = usePcStore((s) => s.updatePc)
  const classValues = pc.charClass.split('/').map((s) => s.trim()).filter(Boolean)
```

Replace the identity header block: when `editing` is false keep the current rendering, but the button becomes:

```tsx
          <button type="button" className="btn-ghost shrink-0 text-xs" onClick={onToggleEdit}>
            <Pencil size={13} />
            Edit sheet
          </button>
```

When `editing` is true render inputs instead (replacing the name/subtitle block):

```tsx
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 lg:grid-cols-4">
            <div>
              <label className="label">Name</label>
              <input className="input" autoFocus value={pc.name}
                onChange={(e) => updatePc(pc.id, { name: e.target.value })} />
            </div>
            <div>
              <label className="label">Alias</label>
              <input className="input" value={pc.alias ?? ''}
                onChange={(e) => updatePc(pc.id, { alias: e.target.value || undefined })} />
            </div>
            <div>
              <label className="label">Player</label>
              <input className="input" value={pc.playerName ?? ''}
                onChange={(e) => updatePc(pc.id, { playerName: e.target.value || undefined })} />
            </div>
            <div>
              <label className="label">Level</label>
              <input className="input" type="number" min={1} max={20} value={pc.level}
                onChange={(e) => updatePc(pc.id, { level: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
            <div className="col-span-2">
              <label className="label">Race</label>
              <TagSelect value={pc.race} options={D5E_RACES} placeholder="Bugbear, Elf…"
                onChange={(v) => updatePc(pc.id, { race: Array.isArray(v) ? (v[0] ?? '') : (v as string) })} />
            </div>
            <div className="col-span-2">
              <label className="label">Class(es)</label>
              <TagSelect multi value={classValues} options={D5E_CLASSES} placeholder="Rogue, Barbarian…"
                onChange={(v) => updatePc(pc.id, { charClass: (v as string[]).join(' / ') })} />
            </div>
          </div>
          <button type="button" className="btn-accent shrink-0 text-xs" onClick={onToggleEdit}>
            <Check size={13} />
            Done
          </button>
```

Edits write straight to the store (the sheet already autosaves everything else the same way — no draft/cancel semantics).

Pass editing down: `{active === 'sheet' && <SheetView pc={pc} editing={editing} />}` (other tabs unchanged).

- [ ] **Step 2: SheetView — accept `editing` and make gated fields editable**

Signature: `export function SheetView({ pc, editing }: { pc: PcUnit; editing?: boolean }): JSX.Element`.

**Ability scores** (in the `ABILITIES.map` panel): when editing, the score badge becomes an input and a save toggle appears:

```tsx
                <div key={a.key} className="flex flex-col items-center rounded-md border border-border bg-surface py-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-ink-muted">{a.label}</div>
                  <div className="text-xl font-bold text-ink">{fmtMod(mod)}</div>
                  {editing ? (
                    <>
                      <input
                        type="number"
                        className="mt-0.5 w-12 rounded border border-border bg-surface-2 px-1 py-0.5 text-center text-xs text-ink focus:border-accent focus:outline-none"
                        value={score}
                        onChange={(e) =>
                          updatePc(pc.id, { abilities: { ...pc.abilities, [a.key]: Number(e.target.value) } })
                        }
                      />
                      <label className="mt-1 flex cursor-pointer items-center gap-1 text-[9px] text-ink-muted">
                        <input
                          type="checkbox"
                          checked={pc.saveProf.includes(a.key)}
                          onChange={() =>
                            updatePc(pc.id, {
                              saveProf: pc.saveProf.includes(a.key)
                                ? pc.saveProf.filter((x) => x !== a.key)
                                : [...pc.saveProf, a.key]
                            })
                          }
                        />
                        save
                      </label>
                    </>
                  ) : (
                    <div className="mt-0.5 rounded-full border border-border px-2 text-xs text-ink-muted">{score}</div>
                  )}
                </div>
```

**Skills** (center panel rows): when editing, each row becomes a button toggling proficiency:

```tsx
          {SKILLS.map((sk) => {
            const prof = pc.skillProf.includes(sk.key)
            const row = (
              <>
                <span className={cn('h-2 w-2 shrink-0 rounded-full border', prof ? 'border-accent bg-accent' : 'border-border-strong')} />
                <span className="w-6 shrink-0 font-semibold uppercase text-ink-muted">{sk.ability}</span>
                <span className={cn('flex-1 truncate text-left', prof ? 'font-medium text-ink' : 'text-ink-muted')}>{sk.label}</span>
                <span className="w-6 text-right font-medium text-ink">{fmtMod(skillMod(pc.abilities, sk, prof, pc.level))}</span>
              </>
            )
            return editing ? (
              <button
                key={sk.key}
                type="button"
                title="Toggle proficiency"
                className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-surface-3"
                onClick={() =>
                  updatePc(pc.id, {
                    skillProf: prof ? pc.skillProf.filter((k) => k !== sk.key) : [...pc.skillProf, sk.key]
                  })
                }
              >
                {row}
              </button>
            ) : (
              <div key={sk.key} className="flex items-center gap-1.5 text-xs">{row}</div>
            )
          })}
```

**AC / Speed tiles** (top combat stats): when editing, AC and Speed tiles show a number input for the base value (`pc.ac`, `pc.speed`) instead of the computed display; Initiative and Proficiency stay read-only. Replace the mapped tiles with explicit tiles so the two editable ones can differ:

```tsx
        <div className="grid grid-cols-4 gap-2">
          <StatTile label="AC" value={ac} editing={editing} raw={pc.ac}
            onChange={(n) => updatePc(pc.id, { ac: n })} />
          <StatTile label="Initiative" value={fmtMod(initiative)} />
          <StatTile label="Speed" value={`${speed} ft`} editing={editing} raw={pc.speed}
            onChange={(n) => updatePc(pc.id, { speed: n })} />
          <StatTile label="Proficiency" value={fmtMod(pb)} />
        </div>
```

with this helper component added near `Panel` in the same file:

```tsx
function StatTile({
  label,
  value,
  editing,
  raw,
  onChange
}: {
  label: string
  value: string | number
  editing?: boolean
  raw?: number
  onChange?: (n: number) => void
}): JSX.Element {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-surface-2 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
      {editing && onChange ? (
        <input
          type="number"
          className="w-14 rounded bg-surface px-1 py-0.5 text-center text-xl font-bold text-ink focus:outline-none"
          value={raw}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      ) : (
        <div className="text-xl font-bold text-ink">{value}</div>
      )}
    </div>
  )
}
```

**Spell slot maxes**: in the Spell slots panel, when editing show all 9 levels with a max input; otherwise the existing pips. Replace the panel body:

```tsx
        {(editing || activeLevels.length > 0) && (
          <Panel>
            <SectionLabel>Spell slots</SectionLabel>
            {editing ? (
              <div className="grid grid-cols-3 gap-2">
                {pc.slots.map((s) => (
                  <label key={s.level} className="flex items-center gap-2 text-sm">
                    <span className="w-7 text-xs text-ink-muted">L{s.level}</span>
                    <input
                      className="input w-14 px-1 text-center"
                      type="number"
                      min={0}
                      max={9}
                      value={s.max}
                      onChange={(e) => {
                        const max = Math.max(0, Math.min(Number(e.target.value), 9))
                        updatePc(pc.id, {
                          slots: pc.slots.map((sl) =>
                            sl.level === s.level ? { ...sl, max, current: Math.min(sl.current, max) } : sl
                          )
                        })
                      }}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {activeLevels.map((s) => (
                  <SlotPips key={s.level} pc={pc} level={s.level} />
                ))}
              </div>
            )}
          </Panel>
        )}
```

- [ ] **Step 3: Action-type pill becomes a dropdown (item 12)**

In `ActionsBlock`, replace `<span className="chip shrink-0 capitalize">{a.type}</span>` with:

```tsx
              <select
                value={a.type}
                onChange={(e) => patch(a.id, { type: e.target.value as ActionType })}
                title="Action type"
                className="chip shrink-0 cursor-pointer appearance-none bg-surface-2 pr-4 capitalize focus:border-accent focus:outline-none"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 4px center'
                }}
              >
                <option value="action">Action</option>
                <option value="bonus">Bonus action</option>
                <option value="reaction">Reaction</option>
                <option value="other">Other</option>
              </select>
```

(Keeps the `chip` pill shape; always available, matching the always-editable Actions block.)

- [ ] **Step 4: Typecheck + manual check (covers Tasks 10 + 11)**

Run: `npm run typecheck` → passes (this also closes out Task 10's deferred check).
In the app:
1. Party → **Add character** → new "Unnamed" tab appears selected, sheet in edit mode (inputs in header) — no modal.
2. Rename, set race/classes/level, ability scores, toggle a save + skills, set AC/speed, set L1 slots to 3 → **Done** → sheet reads back correctly; relaunch app → values persisted.
3. **Import** button opens the D&D Beyond/JSON dialog.
4. On an action row, click the type pill → dropdown offers Action/Bonus action/Reaction/Other; changing it re-buckets the action under the filter tabs.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/store/pcStore.ts src/renderer/src/features/party/PartyPage.tsx src/renderer/src/features/party/CharacterSheet.tsx src/renderer/src/features/party/SheetView.tsx
git rm --cached --ignore-unmatch src/renderer/src/features/party/CharacterDialog.tsx 2>/dev/null; true
git commit -m "feat: inline character add/edit, action type dropdown"
```

(If `git rm` in Task 10 already staged the deletion, the second line is a no-op.)

---

### Task 12: Browser-style party tabs — drag to reorder, X to delete (spec item 10)

**Files:**
- Modify: `src/renderer/src/lib/store/pcStore.ts` (`reorderPcs`)
- Modify: `src/renderer/src/features/party/PartyPage.tsx` (sortable tabs)

**Interfaces:**
- Consumes: `@dnd-kit/core` + `@dnd-kit/sortable` (already dependencies; see `EntryForm.tsx:3-17` for the established usage pattern), `removePc(id)`.
- Produces: `reorderPcs(from: number, to: number): void` in `pcStore`.

- [ ] **Step 1: Add `reorderPcs` to the store**

Interface: `reorderPcs: (from: number, to: number) => void`. Implementation next to the other actions (uses the store's existing `persist()` helper):

```ts
    reorderPcs: (from, to) => {
      set((s) => {
        const pcs = [...s.pcs]
        const [moved] = pcs.splice(from, 1)
        pcs.splice(to, 0, moved)
        return { pcs }
      })
      persist()
    },
```

- [ ] **Step 2: Sortable tabs in `PartyPage`**

Add imports:

```tsx
import { X } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

Add a tab component in the same file:

```tsx
function PcTab({
  pc,
  active,
  onSelect,
  onClose
}: {
  pc: PcUnit
  active: boolean
  onSelect: () => void
  onClose: () => void
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pc.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 pl-5 pr-2 text-sm font-medium transition-colors',
        isDragging && 'opacity-60',
        active ? 'border-accent text-ink' : 'border-transparent text-ink-muted hover:text-ink'
      )}
    >
      <button type="button" className="cursor-pointer py-2.5" onClick={onSelect} {...attributes} {...listeners}>
        {pc.name || 'Unnamed'}
      </button>
      <button
        type="button"
        title={`Delete ${pc.name || 'character'}`}
        className="rounded p-0.5 text-ink-faint opacity-0 transition-opacity hover:bg-danger/15 hover:text-danger group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        <X size={13} />
      </button>
    </div>
  )
}
```

(`PcUnit` is already imported via `usePcStore` module — add `type PcUnit` to that import.)

Replace the tab strip in the page body:

```tsx
            <div className="flex shrink-0 overflow-x-auto border-b border-border">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onTabDragEnd}
              >
                <SortableContext items={pcs.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
                  {pcs.map((pc) => (
                    <PcTab
                      key={pc.id}
                      pc={pc}
                      active={selected?.id === pc.id}
                      onSelect={() => setSelectedId(pc.id)}
                      onClose={() => {
                        if (window.confirm(`Delete "${pc.name || 'this character'}"? This can't be undone.`)) {
                          removePc(pc.id)
                          if (selectedId === pc.id) setSelectedId(null)
                          if (editingId === pc.id) setEditingId(null)
                        }
                      }}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
```

with, inside the component:

```tsx
  const removePc = usePcStore((s) => s.removePc)
  const reorderPcs = usePcStore((s) => s.reorderPcs)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const onTabDragEnd = (e: DragEndEvent): void => {
    const { active, over } = e
    if (over && active.id !== over.id) {
      reorderPcs(
        pcs.findIndex((p) => p.id === active.id),
        pcs.findIndex((p) => p.id === over.id)
      )
    }
  }
```

Note: the 5px `activationConstraint` distance is what lets plain clicks still fire `onSelect` — don't remove it.

- [ ] **Step 3: Typecheck + manual check**

Run: `npm run typecheck` → passes.
In the app: with 3+ characters, drag a tab to a new position (order persists after relaunch); click still selects; hover shows the X; X → confirm → character gone, selection falls back sensibly.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/lib/store/pcStore.ts src/renderer/src/features/party/PartyPage.tsx
git commit -m "feat: draggable, closable party character tabs"
```

---

### Task 13: Final verification sweep

**Files:** none (fixes only if something fails).

- [ ] **Step 1: Full typecheck + build**

Run: `npm run typecheck` → passes. Run: `npm run build` → completes without errors.

- [ ] **Step 2: Walk the spec's verification list in the running app**

`npm run dev`, then confirm each:
1. Settings shows only Dark/Light; both modes readable, pink accent, no cyan anywhere.
2. Sidebar shows logo + GM TOOLKIT.
3. Type commas freely in Tags/Classes; spell with 3 classes found by each class via Library search and ⌘K.
4. Monster with V/R/I and spellcasting displays both sections; spell links open.
5. Backdrop clicks don't close modals (except ⌘K); Esc still works where wired.
6. Two-paragraph action description shows the gap.
7. Window resizes down to 640px without horizontal overflow on main pages.
8. Party tabs drag/reorder/delete; Add character and Edit sheet are inline; Import opens dialog; action type pill is a dropdown.

- [ ] **Step 3: Report results to the user** (any failures get fixed before claiming done).
