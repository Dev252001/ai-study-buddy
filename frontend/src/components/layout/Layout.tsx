import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header onMobileMenuToggle={() => setMobileOpen((o) => !o)} />
        <motion.main
          className="flex-1 overflow-y-auto scrollbar-thin"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="container mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-6">
            <Outlet />
          </div>
        </motion.main>
      </div>
    </div>
  )
}
