import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Download, Upload, ExternalLink, KeyRound, Eraser, Eye, EyeOff, RefreshCw } from 'lucide-react'

type UpdaterPhase = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'
type UpdaterStatus = { phase: UpdaterPhase; version?: string; percent?: number; message?: string; releaseUrl?: string }
import { Page } from '@/components/Page'
import { TagSelect } from '@/components/TagSelect'
import { TYPE_META } from '@/components/typeMeta'
import { useVoiceStore, type Sensitivity, type SuppressMinutes } from '@/lib/store/voiceStore'
import { useContentStore } from '@/lib/store/contentStore'
import { useSettingsStore, LLM_MODELS } from '@/lib/store/settingsStore'
import { CONTENT_TYPE_LABELS, type ContentType } from '@/types/content'
import { exportCustomContent, importContentFromFile, clearAllContent } from '@/lib/data/exportImport'
import { LearnedCorrectionsModal } from './LearnedCorrectionsModal'
import { cn } from '@/lib/cn'

function Section({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: ReactNode
}): JSX.Element {
  return (
    <section className="panel p-5">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
}): JSX.Element {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded px-3 py-1 text-sm transition-colors',
            value === o.value ? 'bg-accent text-accent-fg' : 'text-ink-muted hover:text-ink'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function MicSection(): JSX.Element {
  const micDeviceId = useVoiceStore((s) => s.settings.micDeviceId)
  const updateSettings = useVoiceStore((s) => s.updateSettings)
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((ds) => setMics(ds.filter((d) => d.kind === 'audioinput')))
      .catch(() => undefined)
  }, [])

  return (
    <Section title="Voice & transcription" description="Transcription runs locally on in-app Whisper (WebGPU). No audio leaves your machine.">
      <Field label="Microphone">
        <select
          className="input"
          value={micDeviceId}
          onChange={(e) => updateSettings({ micDeviceId: e.target.value })}
        >
          <option value="">System default</option>
          {mics.map((m, i) => (
            <option key={m.deviceId} value={m.deviceId}>
              {m.label || `Microphone ${i + 1}`}
            </option>
          ))}
        </select>
        {mics.every((m) => !m.label) && (
          <p className="mt-1 text-xs text-ink-muted">
            Turn the mic on once (top bar) to let macOS reveal device names.
          </p>
        )}
      </Field>
    </Section>
  )
}

function KeywordFeedSection(): JSX.Element {
  const settings = useVoiceStore((s) => s.settings)
  const update = useVoiceStore((s) => s.updateSettings)

  const toggleType = (t: ContentType): void => {
    const has = settings.enabledTypes.includes(t)
    update({
      enabledTypes: has
        ? settings.enabledTypes.filter((x) => x !== t)
        : [...settings.enabledTypes, t]
    })
  }

  return (
    <Section title="Keyword feed" description="How spoken words are matched to your library and surfaced as cards.">
      <Field label="Sensitivity">
        <Segmented<Sensitivity>
          value={settings.sensitivity}
          onChange={(v) => update({ sensitivity: v })}
          options={[
            { value: 'exact', label: 'Strict' },
            { value: 'balanced', label: 'Balanced' },
            { value: 'loose', label: 'Loose' }
          ]}
        />
        <p className="mt-1 text-xs text-ink-muted">
          Strict = exact only · Balanced = catches light mis-hearings · Loose = catches more, risks
          false hits.
        </p>
      </Field>

      <Field label="Suppress repeats">
        <Segmented<SuppressMinutes>
          value={settings.suppressMinutes}
          onChange={(v) => update({ suppressMinutes: v })}
          options={[
            { value: 0, label: 'Off' },
            { value: 1, label: '1 min' },
            { value: 5, label: '5 min' },
            { value: 10, label: '10 min' }
          ]}
        />
      </Field>

      <Field label="Surface these types">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((t) => {
            const on = settings.enabledTypes.includes(t)
            const meta = TYPE_META[t]
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                title={on ? 'Enabled — click to hide' : 'Hidden — click to enable'}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  on
                    ? cn('border-transparent', meta.badge)
                    : 'border-border text-ink-muted opacity-60 hover:opacity-100'
                )}
              >
                {CONTENT_TYPE_LABELS[t]}
                {on ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="Ignore list">
        <TagSelect
          multi
          value={settings.ignoreList}
          options={[]}
          placeholder="Add a word to never surface…"
          onChange={(v) => update({ ignoreList: v as string[] })}
        />
        <p className="mt-1 text-xs text-ink-muted">
          Terms here never trigger a card — handy for PC names that keep coming up.
        </p>
      </Field>
    </Section>
  )
}

function LearnedCorrectionsSection(): JSX.Element {
  const aliases = useVoiceStore((s) => s.aliases)
  const [open, setOpen] = useState(false)
  const total = Object.keys(aliases).length
  const entryCount = new Set(Object.values(aliases)).size

  return (
    <Section title="Learned corrections" description="Mis-hearings you've taught the app to recognise. Remove any that turned out wrong.">
      {total === 0 ? (
        <p className="text-sm text-ink-muted">None yet. Correct a word in the transcript to teach one.</p>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-muted">
            {total} correction{total === 1 ? '' : 's'} across {entryCount} entr
            {entryCount === 1 ? 'y' : 'ies'}.
          </p>
          <button type="button" className="btn-outline" onClick={() => setOpen(true)}>
            Manage
          </button>
        </div>
      )}
      {open && <LearnedCorrectionsModal onClose={() => setOpen(false)} />}
    </Section>
  )
}

function LlmSection(): JSX.Element {
  const { hasKey, keyPreview, llmModel, llmTemperature, setKey, clearKey, setLlmModel, setLlmTemperature } =
    useSettingsStore()
  const [draftKey, setDraftKey] = useState('')

  return (
    <Section
      title="AI (smart import)"
      description="Optional. Only the “smart parse with Claude” import option uses this — everything else works without a key."
    >
      <Field label="Anthropic API key">
        {hasKey ? (
          <div className="flex items-center gap-2">
            <span className="chip">
              <KeyRound size={12} />
              {keyPreview}
            </span>
            <button type="button" className="btn-ghost" onClick={() => void clearKey()}>
              Remove
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="password"
              className="input font-mono"
              placeholder="sk-ant-…"
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
            />
            <button
              type="button"
              className="btn-accent shrink-0"
              disabled={!draftKey.trim()}
              onClick={() => {
                void setKey(draftKey.trim())
                setDraftKey('')
              }}
            >
              Save
            </button>
          </div>
        )}
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-ink-muted hover:text-accent"
        >
          Get a key (pay-as-you-go, ~pennies per summary)
          <ExternalLink size={11} />
        </a>
      </Field>

      <Field label="Model">
        <select className="input" value={llmModel} onChange={(e) => setLlmModel(e.target.value)}>
          {LLM_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label={`Temperature — ${llmTemperature.toFixed(1)}`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={llmTemperature}
          onChange={(e) => setLlmTemperature(Number(e.target.value))}
          className="w-full accent-accent"
        />
        <p className="mt-1 text-xs text-ink-muted">Lower = focused and consistent · higher = more creative.</p>
      </Field>
    </Section>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-surface-3'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
          checked ? 'left-[18px]' : 'left-0.5'
        )}
      />
    </button>
  )
}

function ContentSharingSection(): JSX.Element {
  const share = useSettingsStore((s) => s.shareCustomContent)
  const setShare = useSettingsStore((s) => s.setShareCustomContent)
  return (
    <Section
      title="Campaigns & content"
      description="Custom content belongs to the campaign it was created in and doesn't carry over to others."
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-ink">Share custom content across campaigns</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Adds a campaign picker to each source (in its Add/Edit dialog) so you can choose which
            campaigns it shows up in.
          </p>
        </div>
        <Switch checked={share} onChange={setShare} />
      </div>
    </Section>
  )
}

function DataSection(): JSX.Element {
  const loadContent = useContentStore((s) => s.load)
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState('')

  const onExport = async (): Promise<void> => {
    const n = await exportCustomContent()
    setStatus(`Exported ${n} custom entries.`)
  }

  const onImport = async (file: File): Promise<void> => {
    try {
      const n = await importContentFromFile(file)
      await loadContent()
      setStatus(`Imported ${n} entries.`)
    } catch (err) {
      setStatus(String(err))
    }
  }

  const onClear = async (): Promise<void> => {
    if (!window.confirm('Delete ALL content (SRD and custom) and the board? This cannot be undone.')) {
      return
    }
    await clearAllContent()
    await loadContent()
    setStatus('All content cleared.')
  }

  return (
    <Section title="Data" description="Back up your custom content, restore it, or wipe the library.">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-outline" onClick={() => void onExport()}>
          <Download size={15} />
          Export custom content
        </button>
        <button type="button" className="btn-outline" onClick={() => fileRef.current?.click()}>
          <Upload size={15} />
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onImport(f)
            e.target.value = ''
          }}
        />
        <button type="button" className="btn-danger" onClick={() => void onClear()}>
          <Eraser size={15} />
          Clear all content
        </button>
      </div>
      {status && <p className="text-xs text-ink-muted">{status}</p>}
    </Section>
  )
}

function UpdateSection(): JSX.Element {
  const [status, setStatus] = useState<UpdaterStatus>({ phase: 'idle' })

  useEffect(() => {
    return window.dmc.updater.onStatus(setStatus)
  }, [])

  const isMac = window.dmc.platform === 'darwin'

  const statusText: Record<UpdaterPhase, string> = {
    idle: 'You are on the latest version.',
    checking: 'Checking for updates…',
    available: `v${status.version} is available.`,
    downloading: `Downloading… ${status.percent ?? 0}%`,
    ready: `v${status.version} downloaded — restart to apply.`,
    error: `Update check failed: ${status.message ?? 'unknown error'}`
  }

  return (
    <Section title="Updates" description={`Current version: v${__APP_VERSION__}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-outline"
          disabled={status.phase === 'checking' || status.phase === 'downloading'}
          onClick={() => void window.dmc.updater.check()}
        >
          <RefreshCw size={15} />
          Check for updates
        </button>

        {status.phase === 'available' && !isMac && (
          <button
            type="button"
            className="btn-accent"
            onClick={() => void window.dmc.updater.download()}
          >
            <Download size={15} />
            Download v{status.version}
          </button>
        )}

        {status.phase === 'available' && isMac && status.releaseUrl && (
          <button
            type="button"
            className="btn-accent"
            onClick={() => void window.dmc.updater.install(status.releaseUrl)}
          >
            <ExternalLink size={15} />
            Download v{status.version}
          </button>
        )}

        {status.phase === 'ready' && (
          <button
            type="button"
            className="btn-accent"
            onClick={() => void window.dmc.updater.install()}
          >
            Restart &amp; install
          </button>
        )}
      </div>
      <p className={cn('text-xs', status.phase === 'error' ? 'text-red-400' : 'text-ink-muted')}>
        {statusText[status.phase]}
        {status.phase === 'available' && isMac && (
          <span className="ml-1">(Downloads the installer — re-open to complete.)</span>
        )}
      </p>
    </Section>
  )
}

export function SettingsPage(): JSX.Element {
  return (
    <Page title="Settings" subtitle="Voice, keyword feed, AI and data">
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <UpdateSection />
        <MicSection />
        <KeywordFeedSection />
        <LearnedCorrectionsSection />
        <ContentSharingSection />
        <LlmSection />
        <DataSection />
      </div>
    </Page>
  )
}
