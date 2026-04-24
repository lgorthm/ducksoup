import { Link, Outlet } from 'react-router'

export default function RootLayout() {
  return (
    <div id="app">
      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </nav>

      <Outlet />

      <footer>
        <small>Powered by Vite+</small>
      </footer>
    </div>
  )
}
