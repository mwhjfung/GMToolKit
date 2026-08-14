import { createHashRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { DashboardPage } from '@/features/board/DashboardPage'
import { LibraryPage } from '@/features/library/LibraryPage'
import { PartyPage } from '@/features/party/PartyPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { PanelWindowApp } from '@/features/panel/PanelWindowApp'

export const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'party', element: <PartyPage /> },
      { path: 'settings', element: <SettingsPage /> }
    ]
  },
  { path: '/panel', element: <PanelWindowApp /> }
])
