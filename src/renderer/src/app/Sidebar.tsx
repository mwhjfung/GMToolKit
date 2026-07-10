import { NavLink } from 'react-router-dom'
import {
  LayoutGrid,
  Library,
  Users,
  Settings,
  AudioLines,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Eye,
  EyeOff
} from 'lucide-react'
import { CampaignSwitcher } from './CampaignSwitcher'
import { GlobalSearch } from '@/components/GlobalSearch'
import { useUiStore } from '@/lib/store/uiStore'
import { useVoiceStore } from '@/lib/store/voiceStore'
import { cn } from '@/lib/cn'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/library', label: 'Library', icon: Library, end: false },
  { to: '/party', label: 'Party', icon: Users, end: false }
] as const

const itemBase =
  'flex items-center rounded-md py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset'

export function Sidebar(): JSX.Element {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggle = useUiStore((s) => s.toggleSidebar)
  const feedOpen = useUiStore((s) => s.feedOpen)
  const toggleFeed = useUiStore((s) => s.toggleFeed)
  const listening = useVoiceStore((s) => s.status === 'listening')
  const openSearch = useUiStore((s) => s.openSearch)

  return (
    <>
      <aside
        className={cn(
          'flex h-full shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-150',
          collapsed ? 'w-14' : 'w-52'
        )}
      >
        <div className={cn('flex h-12 items-center', collapsed ? 'justify-center' : 'justify-between px-4')}>
          {collapsed ? (
            <button type="button" className="icon-btn" onClick={toggle} title="Expand sidebar">
              <PanelLeftOpen size={18} />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span className="text-sm font-semibold tracking-wide text-ink">GM TOOLKIT</span>
              </div>
              <button type="button" className="icon-btn" onClick={toggle} title="Collapse sidebar">
                <PanelLeftClose size={16} />
              </button>
            </>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-2 py-2">
          {/* Search — first nav item */}
          <button
            type="button"
            onClick={openSearch}
            title="Search"
            className={cn(
              itemBase,
              collapsed ? 'justify-center px-0' : 'gap-3 px-3',
              'text-ink-muted hover:bg-surface-3 hover:text-ink'
            )}
          >
            <Search size={17} strokeWidth={2} />
            {!collapsed && (
              <span className="flex flex-1 items-center justify-between">
                Search
                <kbd className="rounded bg-surface-3 px-1 py-0.5 text-[10px] font-mono text-ink-faint">⌘K</kbd>
              </span>
            )}
          </button>

          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              className={({ isActive }) =>
                cn(
                  itemBase,
                  collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-ink-muted hover:bg-surface-3 hover:text-ink'
                )
              }
            >
              <Icon size={17} strokeWidth={2} />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

        {/* Transcribe + Settings sit just above the campaign switcher. */}
        <div className="flex flex-col gap-0.5 border-t border-border px-2 py-2">
          <button
            type="button"
            onClick={toggleFeed}
            title={feedOpen ? 'Hide voice feed' : 'Show voice feed'}
            className={cn(
              itemBase,
              collapsed ? 'justify-center px-0' : 'gap-3 px-3',
              'text-ink-muted hover:bg-surface-3 hover:text-ink'
            )}
          >
            <AudioLines size={17} className={listening ? 'text-accent' : ''} />
            {!collapsed && (
              <span className="flex flex-1 items-center justify-between">
                Transcribe
                <span className="flex items-center gap-1.5">
                  {listening && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  )}
                  {feedOpen ? (
                    <Eye size={14} className="text-ink-muted" />
                  ) : (
                    <EyeOff size={14} className="text-ink-muted" />
                  )}
                </span>
              </span>
            )}
          </button>

          <NavLink
            to="/settings"
            title="Settings"
            className={({ isActive }) =>
              cn(
                itemBase,
                collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                isActive
                  ? 'bg-accent/15 text-accent'
                  : 'text-ink-muted hover:bg-surface-3 hover:text-ink'
              )
            }
          >
            <Settings size={17} strokeWidth={2} />
            {!collapsed && 'Settings'}
          </NavLink>
        </div>

        <CampaignSwitcher />
      </aside>

      <GlobalSearch />
    </>
  )
}
