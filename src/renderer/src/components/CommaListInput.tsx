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
