import { useState, useEffect, useRef } from 'react'
import type { ETFInfo } from '../types'
import { DEFAULT_SIGNAL_THRESHOLDS, DEFAULT_LEARNING_CONFIG, DEFAULT_ETF_LIST } from '../config/defaults'
import { saveSetting, getSetting, exportAllData, importAllData, getETFList, saveETFList } from '../data/db'
import './Settings.css'

export default function Settings() {
  const [buyThreshold, setBuyThreshold] = useState(DEFAULT_SIGNAL_THRESHOLDS.buyThreshold)
  const [sellThreshold, setSellThreshold] = useState(DEFAULT_SIGNAL_THRESHOLDS.sellThreshold)
  const [learningRate, setLearningRate] = useState(DEFAULT_LEARNING_CONFIG.learningRate)
  const [lookbackWindow, setLookbackWindow] = useState(DEFAULT_LEARNING_CONFIG.lookbackWindow)
  const [etfs, setEtfs] = useState<ETFInfo[]>([])
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newMarket, setNewMarket] = useState<'SH' | 'SZ'>('SH')
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      getSetting<number>('buyThreshold'),
      getSetting<number>('sellThreshold'),
      getSetting<number>('learningRate'),
      getSetting<number>('lookbackWindow'),
      getETFList(),
    ]).then(([bt, st, lr, lw, list]) => {
      if (bt != null) setBuyThreshold(bt)
      if (st != null) setSellThreshold(st)
      if (lr != null) setLearningRate(lr)
      if (lw != null) setLookbackWindow(lw)
      if (list.length > 0) setEtfs(list)
      else setEtfs(DEFAULT_ETF_LIST)
    })
  }, [])

  const showMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleSave = async () => {
    await Promise.all([
      saveSetting('buyThreshold', buyThreshold),
      saveSetting('sellThreshold', sellThreshold),
      saveSetting('learningRate', learningRate),
      saveSetting('lookbackWindow', lookbackWindow),
      saveETFList(etfs),
    ])
    showMessage('设置已保存')
  }

  const handleAddETF = () => {
    if (!newCode.trim() || !newName.trim()) return
    if (etfs.some(e => e.code === newCode.trim())) {
      showMessage('该ETF代码已存在')
      return
    }
    setEtfs([...etfs, { code: newCode.trim(), name: newName.trim(), market: newMarket }])
    setNewCode('')
    setNewName('')
    setNewMarket('SH')
  }

  const handleRemoveETF = (code: string) => {
    setEtfs(etfs.filter(e => e.code !== code))
  }

  const handleExport = async () => {
    const data = await exportAllData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `etf-quant-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showMessage('数据已导出')
  }

  const handleImport = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await importAllData(data)
      const list = await getETFList()
      if (list.length > 0) setEtfs(list)
      showMessage('数据已导入')
    } catch {
      showMessage('导入失败，请检查文件格式')
    }
  }

  return (
    <div className="settings">
      <h2>设置</h2>

      {message && <div className="settings-message">{message}</div>}

      <div className="settings-section">
        <h3>信号阈值</h3>
        <div className="setting-row">
          <label>买入阈值</label>
          <input
            type="range"
            min={60}
            max={95}
            value={buyThreshold}
            onChange={e => setBuyThreshold(Number(e.target.value))}
          />
          <span className="setting-value">{buyThreshold}</span>
        </div>
        <div className="setting-row">
          <label>卖出阈值</label>
          <input
            type="range"
            min={10}
            max={50}
            value={sellThreshold}
            onChange={e => setSellThreshold(Number(e.target.value))}
          />
          <span className="setting-value">{sellThreshold}</span>
        </div>
      </div>

      <div className="settings-section">
        <h3>学习参数</h3>
        <div className="setting-row">
          <label>学习率</label>
          <input
            type="range"
            min={0.1}
            max={1.0}
            step={0.05}
            value={learningRate}
            onChange={e => setLearningRate(Number(e.target.value))}
          />
          <span className="setting-value">{learningRate.toFixed(2)}</span>
        </div>
        <div className="setting-row">
          <label>回溯窗口</label>
          <input
            type="range"
            min={5}
            max={50}
            value={lookbackWindow}
            onChange={e => setLookbackWindow(Number(e.target.value))}
          />
          <span className="setting-value">{lookbackWindow}</span>
        </div>
      </div>

      <div className="settings-section">
        <h3>ETF 自选列表</h3>
        <div className="add-etf-form">
          <input
            placeholder="代码 (如 510300)"
            value={newCode}
            onChange={e => setNewCode(e.target.value)}
          />
          <input
            placeholder="名称"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <select value={newMarket} onChange={e => setNewMarket(e.target.value as 'SH' | 'SZ')}>
            <option value="SH">SH</option>
            <option value="SZ">SZ</option>
          </select>
          <button onClick={handleAddETF}>添加</button>
        </div>
        <div className="etf-manage-list">
          {etfs.map(etf => (
            <div key={etf.code} className="etf-manage-item">
              <span>{etf.name}</span>
              <span className="code">{etf.code} ({etf.market})</span>
              <button className="remove-btn" onClick={() => handleRemoveETF(etf.code)}>移除</button>
            </div>
          ))}
          {etfs.length === 0 && (
            <div className="etf-manage-item">
              <span style={{ color: 'var(--text-secondary)' }}>暂无ETF</span>
            </div>
          )}
        </div>
      </div>

      <div className="settings-section">
        <h3>数据备份</h3>
        <div className="backup-buttons">
          <button onClick={handleExport}>导出备份</button>
          <button onClick={() => fileInputRef.current?.click()}>导入恢复</button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
      </div>

      <button className="save-btn" onClick={handleSave}>保存设置</button>
    </div>
  )
}
