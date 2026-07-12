import { useEffect, useRef, useState, type DragEvent } from 'react'
import { X, FileUp, Loader2, AlertTriangle, Info, Sparkles } from 'lucide-react'
import { extractText } from '@/lib/import/extractText'
import { splitEntries, type SplitStrategy, type ImportType } from '@/lib/import/splitEntries'
import { smartParse, type SmartParseProgress } from '@/lib/import/smartParse'
import { TEMPLATES, CREATABLE_TYPES } from '@/lib/templates/schemas'
import { useUiStore } from '@/lib/store/uiStore'
import { useSettingsStore } from '@/lib/store/settingsStore'
import type { ContentEntry } from '@/types/content'
import { ImportReview } from './ImportReview'
import { JsonBatchReview } from './JsonBatchReview'
import { parseJson } from '@/lib/import/parseJson'
import { cn } from '@/lib/cn'

type Phase = 'pick' | 'parsing' | 'review' | 'json-review' | 'error'
type ImportMode = 'documents' | 'json'

const DOC_EXTENSIONS = ['.docx', '.pdf', '.txt', '.md', '.markdown']

function acceptedExtensions(mode: ImportMode): string[] {
  return mode === 'json' ? ['.json'] : DOC_EXTENSIONS
}

function filterAccepted(list: File[], mode: ImportMode): File[] {
  const exts = acceptedExtensions(mode)
  return list.filter((f) => exts.some((ext) => f.name.toLowerCase().endsWith(ext)))
}

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
  const [mode, setMode] = useState<ImportMode>('documents')
  const [files, setFiles] = useState<File[]>([])
  const [type, setType] = useState<ImportType>('mixed')
  const [strategy, setStrategy] = useState<SplitStrategy>('headings')
  const [useClaude, setUseClaude] = useState(false)
  const [source, setSource] = useState(importDefaultWorld)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isJson = mode === 'json'
  const [drafts, setDrafts] = useState<ContentEntry[]>([])
  const [error, setError] = useState('')
  const [smartProgress, setSmartProgress] = useState<SmartParseProgress | null>(null)

  const switchMode = (m: ImportMode): void => {
    setMode(m)
    setFiles([])
    setPhase('pick')
    setError('')
  }

  // Documents are parsed one at a time (parse() below only reads files[0]),
  // so a drop or multi-select there keeps just the first match; JSON entries
  // merge cleanly across files, so all accepted files are kept.
  const applyFiles = (list: File[]): void => {
    const accepted = filterAccepted(list, mode)
    if (!accepted.length) return
    setFiles(mode === 'json' ? accepted : [accepted[0]])
    setPhase('pick')
    setError('')
  }

  const onDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setIsDragging(false)
    applyFiles(Array.from(e.dataTransfer.files))
  }

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
    setSmartProgress(null)
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
      let result = useClaude
        ? await smartParse(doc.text, setSmartProgress)
        : splitEntries(doc, strategy, type, file.name)
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
          <div className="panel flex max-h-[85vh] w-[520px] max-w-full flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Import</h2>
              <button type="button" className="icon-btn" onClick={closeImport}>
                <X size={16} />
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-1 border-b border-border px-4">
              {(['documents', 'json'] as ImportMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={cn(
                    'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                    mode === m
                      ? 'border-accent text-ink'
                      : 'border-transparent text-ink-muted hover:text-ink'
                  )}
                >
                  {m === 'documents' ? 'Documents' : 'JSON'}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <p className="text-sm text-ink-muted">
                {mode === 'json' ? (
                  <>
                    Bring in one or more <strong className="text-ink">JSON files</strong> from
                    5etools (or a pre-converted export) for bulk import. Nothing leaves your machine.
                  </>
                ) : (
                  <>
                    Bring in a <strong className="text-ink">Word, PDF, text or markdown</strong>{' '}
                    file to parse into individual drafts. Nothing leaves your machine.
                  </>
                )}
              </p>

              <div>
                <label className="label">{mode === 'json' ? 'Files' : 'File'}</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-1 rounded-md border-2 border-dashed p-4 text-center transition-colors',
                    isDragging ? 'border-accent bg-accent/10' : 'border-border hover:border-border-strong'
                  )}
                >
                  <FileUp size={18} className={isDragging ? 'text-accent' : 'text-ink-muted'} />
                  {files.length === 0 ? (
                    <>
                      <div className="text-sm text-ink">
                        Drag {mode === 'json' ? 'JSON files' : 'a file'} here, or click to browse
                      </div>
                      <div className="text-xs text-ink-muted">
                        {mode === 'json'
                          ? 'You can drop multiple .json files at once.'
                          : DOC_EXTENSIONS.join(', ')}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-ink">
                      {files.length === 1 ? files[0].name : `${files.length} files selected`}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={acceptedExtensions(mode).join(',')}
                    multiple={mode === 'json'}
                    onChange={(e) => applyFiles(Array.from(e.target.files ?? []))}
                    onClick={(e) => e.stopPropagation()}
                    className="hidden"
                  />
                </div>
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

              {phase === 'parsing' && useClaude && smartProgress && smartProgress.total > 1 && (
                <div className="flex flex-col gap-1.5">
                  <div className="text-xs text-ink-muted">
                    Large document — parsing part {Math.min(smartProgress.done + 1, smartProgress.total)} of{' '}
                    {smartProgress.total}…
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full bg-accent transition-[width]"
                      style={{ width: `${(smartProgress.done / smartProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3">
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
