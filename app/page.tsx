'use client'

import { useState } from 'react'
import { Header } from '@/components/header'
import { Sidebar } from '@/components/sidebar'
import { Dashboard } from '@/components/pages/dashboard'
import { EmployeeDirectory } from '@/components/pages/employee-directory'
import { Documents } from '@/components/pages/documents'
import { Profile } from '@/components/pages/profile'

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState('dashboard')

  const handlePageChange = (page: string) => {
    setCurrentPage(page)
    setSidebarOpen(false)
  }

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
    <div className="flex h-screen flex-col">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          currentPage={currentPage}
          onNavigate={handlePageChange}
        />

        <main className="flex-1 overflow-y-auto bg-background">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
