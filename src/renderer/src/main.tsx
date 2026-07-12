import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/app/router'
import '@/index.css'

// Without this, dropping a file anywhere outside a designated drop zone
// (e.g. the import dialog's) makes Electron navigate the whole window away
// to that file instead of ignoring it.
window.addEventListener('dragover', (e) => e.preventDefault())
window.addEventListener('drop', (e) => e.preventDefault())

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <RouterProvider router={router} />
)
