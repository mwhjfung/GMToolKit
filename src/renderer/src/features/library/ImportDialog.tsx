import { useEffect, useState } from 'react'
import { X, FileUp, Loader2, AlertTriangle, Info, Sparkles } from 'lucide-react'
import { extractText } from '@/lib/import/extractText'
import { splitEntries, type SplitStrategy, type ImportType } from '@/lib/import/splitEntries'
import { smartParse } from '@/lib/import/smartParse'
import { TEMPLATES, CREATABLE_TYPES } from '@/lib/templates/schemas'
import { useUiStore } from '@/lib/store/uiStore'
import { useSettingsStore } from '@/lib/store/settingsStore'
import type { ContentEntry } from '@/types/content'
import { ImportReview } from './ImportReview'
import { JsonBatchReview } from './JsonBatchReview'
import { parseJson } from '@/lib/import/parseJson'
import { cn } from '@/lib/cn'

type Phase = 'pick' | 'parsing' | 'review' | 'json-review' | 'error'

const STRATEGIES: Array<{ value: SplitStrategy; label: string; desc: string }> = [
  {
    value: 'table',
    label: 'Table',
    desc: 'Each row is an entry; the first row gives the column labels. Word & markdown tables only.'
  },
  { value: 'headings', label: 'Headings', desc: 'Each heading starts a new entry. Best for bestiaries.' },
  { value: 'paragraphs', label: 'Paragraphs', desc: 'Each blank-line block is an entry; its first line is the name.' },
  { value: 'single', label: 'One entry', desc: 'Import the whole file as a single draft.' }
]

export function ImportDialog(): JSX.Element {
  const closeImport = useUiStore((s) => s.closeImport)
  const importDefaultWorld = useUiStore((s) => s.importDefaultWorld)
  const hasKey = useSettingsStore((s) => s.hasKey)
  const [phase, setPhase] = useState<Phase>('pick')
  const [files, setFiles] = useState<File[]>([])
  const [type, setType] = useState<ImportType>('mixed')
  const [strategy, setStrategy] = useState<SplitStrategy>('headings')
  const [useClaude, setUseClaude] = useState(false)
  const [source, setSource] = useState(importDefaultWorld)

  const isJson = files.length > 0 && files.every((f) => f.name.toLowerCase().endsWith('.json'))
  const [drafts, setDrafts] = useState<ContentEntry[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && phase !== 'review') closeImport()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, closeImport])

  const parse = async (): Promise<void> => {
    if (!files.length) return
    setPhase('parsing')
    setError('')
    try {
      if (isJson) {
        const src = source.trim()
        const all: ContentEntry[] = []
        for (const f of files) {
          const result = await parseJson(f, src)
          all.push(...result)
        }
        // Dedupe by id — last file wins on collision
        const seen = new Map<string, ContentEntry>()
        for (const e of all) seen.set(e.id, e)
        setDrafts([...seen.values()])
        setPhase('json-review')
        return
      }
      const file = files[0]
      const doc = await extractText(file)
      let result = useClaude ? await smartParse(doc.text) : splitEntries(doc, strategy, type, file.name)
      const src = source.trim()
      if (src) result = result.map((e) => ({ ...e, world: src }))
      if (!result.length) {
        setError(
          useClaude
            ? 'Claude returned no entries — the document may be empty or not recognised.'
            : strategy === 'table'
              ? 'No table rows found — make sure the file has a table with a header row (Word or markdown), or pick a different split.'
              : 'No entries found — try a different split, or check the file has text in it.'
        )
        setPhase('error')
        return
      }
      setDrafts(result)
      setPhase('review')
    } catch (err) {
      setError(isJson ? String(err) : `Couldn't read that file: ${String(err)}`)
      setPhase('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-8"
    >
      <div className="mt-[4vh]" onClick={(e) => e.stopPropagation()}>
        {phase === 'review' ? (
          <ImportReview drafts={drafts} onClose={closeImport} />
        ) : phase === 'json-review' ? (
          <JsonBatchReview drafts={drafts} sourceName={source} onClose={closeImport} />
        ) : (
          <div className="panel w-[520px]">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Import</h2>
              <button type="button" className="icon-btn" onClick={closeImport}>
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <p className="text-sm text-ink-muted">
                Bring in a <strong className="text-ink">JSON file</strong> from 5etools (or a
                pre-converted export) for bulk import, or a{' '}
                <strong className="text-ink">Word, PDF, text or markdown</strong> file to parse
                into individual drafts. Nothing leaves your machine.
              </p>

              <div>
                <label className="label">File</label>
                <input
                  type="file"
                  accept=".docx,.pdf,.txt,.md,.markdown,.json"
                  multiple
                  onChange={(e) => {
                    setFiles(Array.from(e.target.files ?? []))
                    setPhase('pick')
                  }}
                  className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-sm file:text-ink hover:file:bg-border-strong"
                />
              </div>

              {!isJson && (
                <>
                  <label
                    className={cn(
                      'flex items-start gap-2 rounded-md border p-2.5',
                      useClaude ? 'border-accent/60 bg-accent/10' : 'border-border',
                      !hasKey && 'opacity-60'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={useClaude}
                      disabled={!hasKey}
                      onChange={(e) => setUseClaude(e.target.checked)}
                    />
                    <div>
                      <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
                        <Sparkles size={14} className="text-accent" />
                        Smart parse with Claude
                      </div>
                      <div className="text-xs text-ink-muted">
                        {hasKey
                          ? 'Claude reads the whole document and extracts correctly-typed entries — best for messy PDFs. Costs a few cents.'
                          : 'Add an Anthropic key in Settings → AI to enable this.'}
                      </div>
                    </div>
                  </label>

                  {!useClaude && (
                    <>
                      <div>
                        <label className="label">These entries are…</label>
                        <select
                          className="input"
                          value={type}
                          onChange={(e) => setType(e.target.value as ImportType)}
                        >
                          <option value="mixed">Mixed — best guess per entry</option>
                          {CREATABLE_TYPES.map((t) => (
                            <option key={t} value={t}>
                              All {TEMPLATES[t].label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="label">Split into entries by</label>
                        <div className="space-y-1.5">
                          {STRATEGIES.map((opt) => (
                            <label
                              key={opt.value}
                              className={cn(
                                'flex cursor-pointer gap-2 rounded-md border p-2 text-sm',
                                strategy === opt.value
                                  ? 'border-accent/60 bg-accent/10'
                                  : 'border-border hover:border-border-strong'
                              )}
                            >
                              <input
                                type="radio"
                                name="strategy"
                                checked={strategy === opt.value}
                                onChange={() => setStrategy(opt.value)}
                                className="mt-0.5"
                              />
                              <div>
                                <div className="font-medium text-ink">{opt.label}</div>
                                <div className="text-xs text-ink-muted">{opt.desc}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      {strategy === 'table' && (
                        <div className="flex items-start gap-2 rounded-md border border-info/40 bg-info/10 p-2.5 text-xs text-info">
                          <Info size={14} className="mt-0.5 shrink-0" />
                          Table mode reads Word (.docx) and markdown tables only — a PDF is just
                          positioned text with no real table structure, so use Headings or Paragraphs for
                          those.
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {isJson && (
                <p className="rounded-md border border-border bg-surface-2 p-2.5 text-xs text-ink-muted">
                  JSON files are parsed directly — no splitting needed.
                </p>
              )}

              <div>
                <label className="label">Source / World (optional)</label>
                <input
                  className="input"
                  placeholder="e.g. Modern Magic — tags every entry so you can filter to them"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </div>

              {phase === 'error' && (
                <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-2.5 text-sm text-danger">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
              <button type="button" className="btn-ghost" onClick={closeImport}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-accent"
                disabled={files.length === 0 || phase === 'parsing'}
                onClick={() => void parse()}
              >
                {phase === 'parsing' ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <FileUp size={15} />
                )}
                Parse &amp; review
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
