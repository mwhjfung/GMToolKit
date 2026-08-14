import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useUiStore } from '@/lib/store/uiStore'

// react-markdown's default urlTransform sanitizes any URL scheme it doesn't
// recognize (http/https/irc(s)/mailto/xmpp) down to an empty string — our
// custom `content:` scheme would otherwise be stripped before the `a`
// component override below ever sees it.
function urlTransform(url: string): string {
  return url.startsWith('content:') ? url : defaultUrlTransform(url)
}

export function Markdown({ children }: { children: string }): JSX.Element {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={urlTransform}
        components={{
          a: ({ href, children: linkChildren }) => {
            if (href?.startsWith('content:')) {
              const id = href.slice('content:'.length)
              return (
                <button
                  type="button"
                  className="text-accent underline underline-offset-2 hover:no-underline"
                  onClick={() => void useUiStore.getState().openDrawer(id)}
                >
                  {linkChildren}
                </button>
              )
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {linkChildren}
              </a>
            )
          }
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
