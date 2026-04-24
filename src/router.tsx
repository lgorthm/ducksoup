import { createBrowserRouter } from 'react-router'
import RootLayout from './layouts/RootLayout.tsx'
import Home from './pages/Home.tsx'
import About from './pages/About.tsx'

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    children: [
      { index: true, Component: Home },
      { path: 'about', Component: About },
    ],
  },
])
