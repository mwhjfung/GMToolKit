# Theme rebrand + UX overhaul — design spec

Date: 2026-07-10
Status: approved by user (this document reflects the approved design)

Twelve changes across theming, library editing, monsters/NPCs, modals, window
sizing and the party page. Existing uncommitted work in the tree stays as-is;
these changes layer on top.

## 1. Remove colour-theme choice (dark/light only)

- Delete `ACCENT_PRESETS` from `src/renderer/src/lib/theme.ts` and the
  "Primary colour" swatches + custom colour picker from Settings → Appearance.
- Drop `accentColor` from the settings store (stale persisted values are
  simply ignored).
- `applyTheme(mode)` takes only the mode and sets `data-theme`; all the
  accent/base blending machinery goes away. The palettes live statically in
  `index.css`.
- Settings → Appearance keeps only the Dark/Light segmented control.

## 2. Logo-derived palette (pink primary, purple secondary)

Sampled logo colours: background `#220b1f`, pink `#ec0a72`, purple `#702074`.

Replace the cyan "cyberpunk" variables in `src/renderer/src/index.css`:

- **Dark**: plum-tinted neutrals from `bg ≈ #140a13` up to
  `surface-3 ≈ #321b30`; borders/inks tinted to match. Accent pink
  `≈ #ff2e8c` (hover/strong `#ec0a72`); `--info`/secondary purple
  `≈ #b06ab8`. Danger moves from pink-red to a true red so it reads
  differently from the accent.
- **Light**: white surfaces over a soft plum-tinted background
  (`bg ≈ #f6eef4`); accent darkened pink `≈ #d40868`; purple secondary
  `#702074`; ink dark plum.
- Verify WCAG AA (≥4.5:1) for accent-as-text on surfaces and
  `--accent-fg` on accent in both modes; nudge values as needed.
- Also update: hard-coded cyan `::selection`, Electron `backgroundColor`
  in `src/main/index.ts`, scrollbar tints, and any `text-black`-on-accent
  usages (use `text-accent-fg`).

## 3. Logo in the sidebar

- Copy `GMToolKit-Favicon.png` to `src/renderer/src/assets/logo.png`.
- In `Sidebar.tsx`, replace the 8px accent dot with
  `<img>` ~20px tall (text is 14px → "slightly larger"), 4px gap
  (`gap-1`), `items-center` so the text is vertically centred, slight
  corner rounding.

## 4. Comma-separated inputs + search coverage

**Bug**: `EntryForm` Tags and `csv`-kind fields round-trip
`join(', ')` ⟷ `split(',').map(trim).filter(Boolean)` per keystroke, so a
typed comma is destroyed immediately.

**Fix**: new `CommaListInput` component — keeps the raw string in local
state while focused, emits the parsed `string[]` upward on change, and
re-syncs from props only when not focused. Use it for:
- the entry Tags field in `EntryForm`
- the `csv` field kind (spell classes, class subclasses, world connections)
- audit all other comma-parsed inputs (BulkActionBar tag inputs, etc.) and
  apply the same treatment where the same bug exists.

**Search**: `filterContent` (`lib/db/content.ts`) and `GlobalSearch` match
only name/summary/tags. Extend matching to entry data: include all string
and string-array values one level deep in `entry.data` (spell classes,
weapon properties, creature type, …). Cache the haystack per entry
(keyed by id + updatedAt) so per-keystroke filtering stays fast. A spell
with classes wizard/sorcerer/druid must match a search or filter for any
of the three.

## 5. Monster/NPC vulnerabilities, resistances, immunities

- `MonsterData` gains `vulnerabilities: string[]`, `resistances: string[]`,
  `immunities: string[]`.
- Monster template gains three `tags`-kind fields with `DAMAGE_TYPES`
  presets; custom values allowed (e.g. "bludgeoning from nonmagical
  attacks").
- Shown as rows in `MonsterDetail` alongside saves/skills/senses.
- Mapped from Open5e SRD sync where the API provides them.

## 6. Modals close only via buttons (Esc still works)

- Backdrop click-to-close: already removed in the working tree for most
  dialogs — verify every modal (18 backdrops found) has no backdrop
  `onClick` close.
- Escape continues to close modals (deliberate keyboard action).
- Exception: the ⌘K search palette keeps click-outside dismiss (transient
  overlay, nothing to lose).

## 7. Monster/NPC spellcasting

Monster template gains:
- `spellcastingAbility` (select: STR/DEX/CON/INT/WIS/CHA)
- `spellSaveDc` (text), `spellAttackBonus` (text)
- `spellsByLevel` reusing the existing `leveledSpells` field kind (same
  editor classes use — autocompletes from library spells; unknown names
  auto-create stub entries via the existing `collectReferences` flow).

`MonsterDetail` shows a "Spellcasting" section: ability/DC/attack line,
then per-level spell lists rendered as clickable library links
(`RefList`).

## 8. Paragraph gaps in long text areas

Plain-text renderers collapse newlines today. Add `whitespace-pre-line`
to:
- `StatBlockList` descriptions (monster traits/actions/etc.)
- class feature descriptions in `ContentDetail`
- PC action descriptions in `SheetView`
Spells already work (Markdown). Sweep for other plain `<p>{desc}</p>`
renderers of user-entered multiline text.

## 9. Minimum window width → 640px

- `minWidth: 640` in `src/main/index.ts` (half a 1280px laptop screen).
- Fix layout at 640px: fixed-width dialogs get `max-w-full`; library grid
  and party sheet reflow (sheet already stacks below `lg`); sweep for
  horizontal overflow.

## 10. Party tabs behave like browser tabs

- Drag to reorder (dnd-kit horizontal sortable — already a dependency);
  new `reorderPcs` action in `pcStore`; order persists.
- Trailing X on each tab deletes the character after a confirm prompt.

## 11. No modal for add/edit character

- Party header buttons next to Export: **Import** (opens the existing
  import dialog: D&D Beyond URL / JSON file) and **Add character**
  (creates a blank character immediately, selects its tab, opens edit
  mode — no dialog).
- **Edit sheet** toggles the sheet between read-only and editable in
  place: header identity fields (name, alias, player, race, classes,
  level), ability scores + save proficiencies, skill proficiencies,
  AC/speed/max HP, spell-slot maximums. Button reads **Done** while
  editing.
- `CharacterDialog` is removed; delete moves to the tab X (item 10).

## 12. Action type pill → dropdown

The static type chip on each PC action in `SheetView` becomes a
pill-styled `<select>` (same shape/colours, small chevron) over the
existing `ActionType` union: Action / Bonus action / Reaction / Other.
Existing filter tabs keep working unchanged.

## Sequencing

1. Theme + logo (items 1–3)
2. Bug fixes (4, 6, 8, 9)
3. Features (5, 7, 10, 11, 12)

## Verification

- Typecheck (`npm run typecheck`) after each stage.
- Launch the app and exercise: theme in both modes, comma entry in
  tags/classes then search for one value, monster with V/R/I + spells,
  modal backdrop clicks, paragraph gaps in an action description,
  640px window, tab drag/delete, inline add/edit character, action type
  dropdown.
