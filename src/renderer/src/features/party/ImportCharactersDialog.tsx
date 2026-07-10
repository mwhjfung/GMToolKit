import { useRef, useState } from 'react'
import { X, Loader2, Upload, AlertTriangle, Sparkles } from 'lucide-react'
import { usePcStore } from '@/lib/store/pcStore'
import { useContentStore } from '@/lib/store/contentStore'
import { importFromDndBeyond } from '@/lib/import/ddb'
import { parseCharactersFromFile } from '@/lib/data/partyData'
import { getAllContent } from '@/lib/db/content'
import { autoLinkAndSeed } from '@/lib/import/autoLink'

export function ImportCharactersDialog({
  onClose,
  onDone
}: {
  onClose: () => void
  onDone: (msg: string) => void
}): JSX.Element {
  const addPc = usePcStore((s) => s.addPc)
  const bulkImport = useContentStore((s) => s.bulkImport)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const importDdb = async (): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      const raw = await importFromDndBeyond(url)
      const allContent = await getAllContent()
      const { pc, newEntries } = autoLinkAndSeed(raw, allContent, `${raw.name || 'PC'} (imported)`)
      if (newEntries.length) await bulkImport(newEntries)
      addPc(pc)
      const linked = pc.inventory.filter((i) => i.contentId).length
        + pc.spells.filter((s) => s.contentId).length
        + pc.features.filter((f) => f.contentId).length
        + pc.actions.filter((a) => a.contentId).length
        + (pc.backgroundContentId ? 1 : 0)
      const created = newEntries.length
      const detail =
        linked > 0
          ? created > 0
            ? ` — linked ${linked} and created ${created} library entries`
            : ` — linked ${linked} library entr${linked === 1 ? 'y' : 'ies'}`
          : ''
      onDone(
        `Imported ${pc.name || 'character'} from D&D Beyond${detail}. Double-check AC, HP and spell slots.`
      )
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const importFile = async (file: File): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      const pcs = await parseCharactersFromFile(file)
      if (!pcs.length) throw new Error('No characters found in that file.')

      // Load library once; grow it in-place as stubs are added per character
      const allContent = await getAllContent()
      let totalLinked = 0
      let totalCreated = 0

      for (const raw of pcs) {
        const { pc, newEntries } = autoLinkAndSeed(
          raw,
          allContent,
          `${raw.name || 'PC'} (imported)`
        )
        if (newEntries.length) {
          await bulkImport(newEntries)
          allContent.push(...newEntries) // visible to subsequent characters
          totalCreated += newEntries.length
        }
        totalLinked +=
          pc.inventory.filter((i) => i.contentId).length +
          pc.spells.filter((s) => s.contentId).length +
          pc.features.filter((f) => f.contentId).length +
          pc.actions.filter((a) => a.contentId).length +
          (pc.backgroundContentId ? 1 : 0)
        addPc(pc)
      }

      const n = pcs.length
      const detail =
        totalLinked > 0
          ? totalCreated > 0
            ? ` — linked ${totalLinked} and created ${totalCreated} library entries`
            : ` — linked ${totalLinked} library entr${totalLinked === 1 ? 'y' : 'ies'}`
          : ''
      onDone(`Imported ${n} character${n === 1 ? '' : 's'} from file${detail}.`)
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-8">
      <div className="panel mt-[10vh] w-[480px] max-w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Import character</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <label className="label flex items-center gap-1.5">
              <Sparkles size={13} className="text-accent" />
              From D&amp;D Beyond
            </label>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="dndbeyond.com/characters/… or character id"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !busy && void importDdb()}
              />
              <button
                type="button"
                className="btn-accent shrink-0"
                disabled={busy || !url.trim()}
                onClick={() => void importDdb()}
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                Import
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              The character's D&amp;D Beyond sharing must be set to Public. Weapons, feats and
              background are auto-linked to your library (or created if missing). AC, HP and spell
              slots are re-derived and worth a quick check.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          <div>
            <label className="label">From a JSON file</label>
            <button
              type="button"
              className="btn-outline"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={15} />
              Choose file…
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importFile(f)
                e.target.value = ''
              }}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-2.5 text-sm text-danger">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
