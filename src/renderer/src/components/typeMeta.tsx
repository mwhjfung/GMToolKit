import {
  Sparkles,
  Skull,
  Package,
  Sword,
  CircleDot,
  GraduationCap,
  GitBranch,
  BadgeCheck,
  Globe2,
  Star,
  BookOpen,
  Wand2,
  Swords,
  type LucideProps
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { ContentType } from '@/types/content'

export interface TypeMeta {
  label: string
  /** Tailwind classes for the type badge. */
  badge: string
  /** Accent text colour for icons/headers of this type. */
  accent: string
  icon: ComponentType<LucideProps>
}

export const TYPE_META: Record<ContentType, TypeMeta> = {
  spell:       { label: 'Spell',       badge: 'bg-sky-500/15     text-sky-700     dark:text-sky-300',     accent: 'text-sky-300',     icon: Sparkles     },
  monster:     { label: 'Monster',     badge: 'bg-red-500/15     text-red-700     dark:text-red-300',     accent: 'text-red-300',     icon: Skull        },
  item:        { label: 'Item',        badge: 'bg-amber-500/15   text-amber-700   dark:text-amber-300',   accent: 'text-amber-300',   icon: Package      },
  weapon:      { label: 'Weapon',      badge: 'bg-orange-500/15  text-orange-700  dark:text-orange-300',  accent: 'text-orange-300',  icon: Sword        },
  condition:   { label: 'Condition',   badge: 'bg-violet-500/15  text-violet-700  dark:text-violet-300',  accent: 'text-violet-300',  icon: CircleDot    },
  class:       { label: 'Class',       badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', accent: 'text-emerald-300', icon: GraduationCap},
  subclass:    { label: 'Subclass',    badge: 'bg-teal-500/15    text-teal-700    dark:text-teal-300',    accent: 'text-teal-300',    icon: GitBranch    },
  proficiency: { label: 'Proficiency', badge: 'bg-lime-500/15    text-lime-700    dark:text-lime-300',    accent: 'text-lime-300',    icon: BadgeCheck   },
  worldentry:  { label: 'World entry', badge: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300', accent: 'text-fuchsia-300', icon: Globe2        },
  feat:        { label: 'Feat',        badge: 'bg-yellow-500/15  text-yellow-700  dark:text-yellow-300',  accent: 'text-yellow-300',  icon: Star         },
  background:  { label: 'Background',  badge: 'bg-cyan-500/15    text-cyan-700    dark:text-cyan-300',    accent: 'text-cyan-300',    icon: BookOpen     },
  homebrew:    { label: 'Homebrew',    badge: 'bg-pink-500/15    text-pink-700    dark:text-pink-300',    accent: 'text-pink-300',    icon: Wand2        },
  action:      { label: 'Action',      badge: 'bg-indigo-500/15  text-indigo-700  dark:text-indigo-300',  accent: 'text-indigo-300',  icon: Swords       }
}
