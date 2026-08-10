import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Brain,
  CreditCard,
  Wand2,
  Search,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  Sun,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, generateInitials } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { BrandMark, BrandWordmark } from '@/components/shared/BrandLogo'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/documents', icon: FileText, label: 'Documents' },
  { to: '/chat', icon: MessageSquare, label: 'AI Chat' },
  { to: '/quiz', icon: Brain, label: 'Quiz' },
  { to: '/flashcards', icon: CreditCard, label: 'Flashcards' },
  { to: '/summaries', icon: Wand2, label: 'AI Tools' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
]

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuth()
  const { toggleTheme } = useTheme()
  const navigate = useNavigate()

  const sidebarContent = (isMobile: boolean) => {
    const showLabels = !collapsed || isMobile

    return (
      <TooltipProvider delayDuration={0}>
        <div className="nav-sidebar">

          {/* ── Logo ── */}
          <div className="nav-logo-row">
            <div className="nav-logo-inner">
              <div className="nav-logo-icon">
                <BrandMark className="nav-icon" />
              </div>
              {showLabels && (
                <BrandWordmark
                  showText
                  iconClassName="hidden"
                  textClassName="nav-logo-text"
                />
              )}
            </div>
            {isMobile && (
              <button
                aria-label="Close navigation"
                onClick={onMobileClose}
                className="nav-close-btn"
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            )}
          </div>

          {/* ── Navigation ── */}
          <nav className="nav-list">
            {navItems.map(({ to, icon: Icon, label }) => (
              <Tooltip key={to}>
                {/*
                  TooltipTrigger renders its own span wrapper — no asChild —
                  so Radix never touches the NavLink's <a> element at all.
                  The NavLink's className drives its own display:flex via .nav-item.
                */}
                <TooltipTrigger
                  className="block w-full"
                  tabIndex={-1}
                  style={{ background: 'none', border: 'none', padding: 0 }}
                >
                  <NavLink
                    to={to}
                    end={to === '/dashboard'}
                    onClick={isMobile ? onMobileClose : undefined}
                    className={({ isActive }) =>
                      cn('nav-item', isActive ? 'nav-item-active' : 'nav-item-inactive')
                    }
                  >
                    <Icon className="nav-icon" aria-hidden="true" />
                    {showLabels && <span className="nav-label">{label}</span>}
                  </NavLink>
                </TooltipTrigger>
                {collapsed && !isMobile && (
                  <TooltipContent side="right"><p>{label}</p></TooltipContent>
                )}
              </Tooltip>
            ))}
          </nav>

          {/* ── Bottom section ── */}
          <div className="nav-bottom">

            {/* Theme toggle */}
            <button
              aria-label="Toggle theme"
              onClick={toggleTheme}
              className="nav-item nav-item-inactive"
            >
              {document.documentElement.classList.contains('dark')
                ? <Sun className="nav-icon" aria-hidden="true" />
                : <Moon className="nav-icon" aria-hidden="true" />}
              {showLabels && (
                <span className="nav-label">
                  {document.documentElement.classList.contains('dark') ? 'Light Mode' : 'Dark Mode'}
                </span>
              )}
            </button>

            {/* Settings */}
            <NavLink
              to="/settings"
              onClick={isMobile ? onMobileClose : undefined}
              className={({ isActive }) =>
                cn('nav-item', isActive ? 'nav-item-active' : 'nav-item-inactive')
              }
            >
              <Settings className="nav-icon" aria-hidden="true" />
              {showLabels && <span className="nav-label">Settings</span>}
            </NavLink>

            {/* User profile row */}
            <div className="nav-user-row">
              <Avatar
                className="nav-user-avatar"
                onClick={() => {
                  navigate('/profile')
                  if (isMobile) onMobileClose?.()
                }}
              >
                <AvatarImage src={user?.avatar_url || undefined} />
                <AvatarFallback className="nav-user-avatar-fallback">
                  {generateInitials(user?.full_name || user?.username)}
                </AvatarFallback>
              </Avatar>
              {showLabels && (
                <div className="nav-user-info">
                  <p className="nav-user-name">{user?.full_name || user?.username}</p>
                  <p className="nav-user-email">{user?.email}</p>
                </div>
              )}
              {showLabels && (
                <button
                  aria-label="Log out"
                  onClick={() => logout()}
                  className="nav-logout-btn"
                >
                  <LogOut style={{ width: 14, height: 14 }} />
                </button>
              )}
            </div>

          </div>
        </div>
      </TooltipProvider>
    )
  }

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className="relative hidden md:block h-screen shrink-0 overflow-hidden"
        style={{
          width: collapsed ? 64 : 240,
          transition: 'width 0.2s ease-in-out',
        }}
      >
        {sidebarContent(false)}

        {/* Collapse toggle */}
        <button
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed((c) => !c)}
          className="nav-collapse-btn"
        >
          {collapsed
            ? <ChevronRight style={{ width: 12, height: 12 }} />
            : <ChevronLeft style={{ width: 12, height: 12 }} />}
        </button>
      </aside>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={onMobileClose}
          />
          <aside
            role="dialog"
            aria-label="Navigation"
            className="fixed inset-y-0 left-0 z-50 w-64 md:hidden overflow-hidden"
            style={{ animation: 'slideInFromLeft 0.25s ease-in-out' }}
          >
            {sidebarContent(true)}
          </aside>
        </>
      )}
    </>
  )
}
