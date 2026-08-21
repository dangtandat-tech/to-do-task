import { NavLink, Outlet } from 'react-router-dom'
import { Icon } from '../Icon'
import type { IconName } from '../Icon'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Planner', icon: 'calendar' },
  { to: '/projects', label: 'Projects', icon: 'box' },
  { to: '/settings', label: 'Settings', icon: 'gear' },
]

export function AppShell() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `bottom-nav__item${isActive ? ' bottom-nav__item--on' : ''}`
            }
          >
            <Icon name={t.icon} size={20} />
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
