import { callClaude } from '@/lib/api/anthropic'
import { TEMPLATES, CREATABLE_TYPES, makeNewEntry, recomputeSummary } from '@/lib/templates/schemas'
import type { ContentEntry, ContentType } from '@/types/content'

/** A compact description of each type's data fields, kept in sync with TEMPLATES. */
function schemaGuide(): string {
  return CREATABLE_TYPES.map((t) => `- ${t}: ${TEMPLATES[t].fields.map((f) => f.key).join(', ')}`).join(
    '\n'
  )
}

const SYSTEM = `You are a precise data extractor for a Dungeons & Dragons 5e toolkit. You are given the text of a document the user owns. Extract every distinct game element from it — spells, monsters/NPCs, items, weapons, conditions, classes, subclasses, or world entries.

Output ONLY a JSON array (no prose, no markdown code fences). Each element:
{ "type": <one of: ${CREATABLE_TYPES.join(', ')}>, "name": string, "summary": one short line, "tags": string[], "data": { type-specific fields } }

Type-specific "data" fields:
${schemaGuide()}

Rules:
- "abilities" is an object {str,dex,con,int,wis,cha} of numbers.
- "traits", "actions", "reactions", "legendaryActions" are arrays of {name, desc}.
- "properties", "classes", "connections", "subclasses" are string arrays.
- "level" is a number (0 = cantrip); "concentration", "ritual", "attunement" are booleans.
- Put descriptive prose in the type's description (or "lore" for monsters) field.
- Omit any field you are unsure about. Do not invent content that is not in the document.`

function extractJsonArray(raw: string): unknown[] {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw
  const parsed = JSON.parse(slice)
  if (!Array.isArray(parsed)) throw new Error('Claude did not return a list of entries.')
  return parsed
}

// A single call caps out around ~15k input tokens worth of document text, so
// a full book has to be split into chunks or everything past the first one
// gets silently dropped. Chunk boundaries prefer a blank line near the target
// size so an entry's description isn't cut in half.
const MAX_CHUNK_CHARS = 45000

function chunkText(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text]
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + MAX_CHUNK_CHARS, text.length)
    if (end < text.length) {
      const breakAt = text.lastIndexOf('\n\n', end)
      if (breakAt > start + MAX_CHUNK_CHARS * 0.5) end = breakAt
    }
    chunks.push(text.slice(start, end))
    start = end
  }
  return chunks
}

function toEntry(obj: unknown): ContentEntry | null {
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  const type = o.type as ContentType
  if (!CREATABLE_TYPES.includes(type) || !o.name) return null

  const entry = makeNewEntry(type)
  entry.name = String(o.name)
  if (Array.isArray(o.tags)) entry.tags = o.tags.map(String)
  if (o.world) entry.world = String(o.world)
  if (o.notes) entry.notes = String(o.notes)
  if (o.data && typeof o.data === 'object') {
    Object.assign(entry.data as unknown as Record<string, unknown>, o.data)
  }
  if (entry.type === 'spell') {
    entry.data.levelText = entry.data.level === 0 ? 'Cantrip' : `Level ${entry.data.level}`
  }
  entry.summary = o.summary ? String(o.summary) : recomputeSummary(entry)
  return entry
}

export interface SmartParseProgress {
  done: number
  total: number
}

/**
 * Ask Claude to read a document and return structured content entries. Long
 * documents (a whole rulebook, not just a few pages) are split into chunks
 * and parsed one at a time so nothing past the first chunk gets dropped;
 * entries are deduped by type+name in case one spans a chunk boundary and
 * gets picked up on both sides.
 */
export async function smartParse(
  docText: string,
  onProgress?: (p: SmartParseProgress) => void
): Promise<ContentEntry[]> {
  const chunks = chunkText(docText)
  const all: ContentEntry[] = []
  const seen = new Set<string>()

  for (let i = 0; i < chunks.length; i += 1) {
    onProgress?.({ done: i, total: chunks.length })
    try {
      const raw = await callClaude({
        system: SYSTEM,
        prompt:
          chunks.length > 1
            ? `Document, part ${i + 1} of ${chunks.length}:\n\n${chunks[i]}`
            : `Document:\n\n${chunks[i]}`,
        maxTokens: 16000
      })
      const entries = extractJsonArray(raw)
        .map(toEntry)
        .filter((e): e is ContentEntry => e !== null)
      for (const e of entries) {
        const key = `${e.type}:${e.name.toLowerCase()}`
        if (seen.has(key)) continue
        seen.add(key)
        all.push(e)
      }
    } catch (error) {
      // One malformed chunk shouldn't lose everything already parsed.
      console.error(`Smart parse failed on chunk ${i + 1}/${chunks.length}:`, error)
    }
  }
  onProgress?.({ done: chunks.length, total: chunks.length })
  return all
}
