'use client'

import { useState, useCallback } from 'react'
import { Header } from '@/components/header'
import { Sidebar } from '@/components/sidebar'
import { Dashboard } from '@/components/pages/dashboard'
import { EmployeeDirectory } from '@/components/pages/employee-directory'
import { Documents } from '@/components/pages/documents'
import { Profile } from '@/components/pages/profile'

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState('dashboard')

  const handlePageChange = useCallback((page: string) => {
    console.log('[v0] handlePageChange called with page:', page)
    setCurrentPage(page)
    setSidebarOpen(false)
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  const renderPage = () => {
    switch (currentPage) {
      case 'employees':
        return <EmployeeDirectory />
      case 'documents':
        return <Documents />
      case 'profile':
        return <Profile />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header onMenuClick={toggleSidebar} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={closeSidebar}
          currentPage={currentPage}
          onNavigate={handlePageChange}
        />

        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
