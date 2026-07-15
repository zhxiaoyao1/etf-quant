import { useState, useEffect } from 'react'
import './App.css'
import Dashboard from './ui/Dashboard'
import Detail from './ui/Detail'
import FundPicker from './ui/FundPicker'
import Factors from './ui/Factors'
import Settings from './ui/Settings'

type Tab = 'dashboard' | 'detail' | 'fundpicker' | 'factors' | 'settings'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'dashboard', label: '看板', icon: '📊' },
    { key: 'detail', label: '详情', icon: '🔍' },
    { key: 'fundpicker', label: '选基', icon: '🏦' },
    { key: 'factors', label: '因子', icon: '🧠' },
    { key: 'settings', label: '设置', icon: '⚙️' },
  ]

  // 手机端：只显示看板，无底部导航
  if (isMobile) {
    return (
      <div className="app">
        <div className="app-content app-mobile">
          <Dashboard mobile />
        </div>
      </div>
    )
  }

  // 电脑端：完整5 Tab 布局
  return (
    <div className="app">
      <div className="app-content app-desktop">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'detail' && <Detail />}
        {activeTab === 'fundpicker' && <FundPicker />}
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
