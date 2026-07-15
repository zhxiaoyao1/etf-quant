import { useState } from 'react'
import './App.css'
import Dashboard from './ui/Dashboard'
import Detail from './ui/Detail'
import Factors from './ui/Factors'
import Settings from './ui/Settings'

type Tab = 'dashboard' | 'detail' | 'fundpicker' | 'factors' | 'settings'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'dashboard', label: '看板', icon: '\u{1F4CA}' },
    { key: 'detail', label: '详情', icon: '\u{1F50D}' },
    { key: 'fundpicker', label: '选基', icon: '\u{1F3E6}' },
    { key: 'factors', label: '因子', icon: '\u{1F9E0}' },
    { key: 'settings', label: '设置', icon: '\u{2699}\u{FE0F}' },
  ]

  return (
    <div className="app">
      <div className="app-content">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'detail' && <Detail />}
        {activeTab === 'fundpicker' && <div>选基</div>}
        {activeTab === 'factors' && <Factors />}
        {activeTab === 'settings' && <Settings />}
      </div>
      <nav className="nav">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`nav-btn${activeTab === tab.key ? ' active' : ''}`}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App
