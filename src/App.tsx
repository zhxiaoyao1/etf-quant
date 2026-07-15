import { useState } from 'react'
import './App.css'

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
        {activeTab === 'dashboard' && <div>看板</div>}
        {activeTab === 'detail' && <div>详情</div>}
        {activeTab === 'fundpicker' && <div>选基</div>}
        {activeTab === 'factors' && <div>因子</div>}
        {activeTab === 'settings' && <div>设置</div>}
      </div>
      <nav style={{
        display: 'flex',
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border)',
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        maxWidth: 480,
        margin: '0 auto',
        zIndex: 100,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '8px 4px',
              background: activeTab === tab.key ? '#1a2332' : 'transparent',
              border: 'none',
              color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 20 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App
