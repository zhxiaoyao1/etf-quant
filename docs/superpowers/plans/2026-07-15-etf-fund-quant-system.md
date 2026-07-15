# 场内 ETF + 场外基金量化分析系统 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建纯手机端 PWA 双引擎量化分析系统，ETF 技术面择时 + 场外基金基本面选基诊断，具备自学习能力。

**Architecture:** React + TypeScript Vite PWA，IndexedDB 本地存储，Web Worker 后台计算。双引擎并行运行——ETF 引擎日频计算四因子技术指标，场外引擎周频计算五因子基本面评分。统一 ≥80 买入 / <40 卖出信号体系。因子权重由各自自学习模块独立优化。

**Tech Stack:** React 18, TypeScript 5, Vite 5, vite-plugin-pwa, Lightweight Charts, IndexedDB (idb wrapper), Web Workers (comlink), Vitest

**Source Spec:** `docs/superpowers/specs/2026-07-15-etf-quant-system-design.md`

**Plan follows Phase 1-4 from spec.** Each phase produces working, testable software.

---

## File Map

```
fund-quant-system/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── public/
│   ├── manifest.json
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── App.css
│   ├── vite-env.d.ts
│   ├── config/
│   │   └── defaults.ts
│   ├── types/
│   │   └── index.ts
│   ├── data/
│   │   ├── db.ts              # IndexedDB schema + helpers
│   │   ├── etfFetcher.ts      # AKShare / EastMoney ETF data
│   │   ├── fundFetcher.ts     # 天天基金 / 好买基金 data
│   │   └── cleaner.ts         # Data cleaning utilities
│   ├── factors/
│   │   └── etf/
│   │       ├── index.ts       # Factor registry
│   │       ├── types.ts       # Factor interface
│   │       ├── trend.ts
│   │       ├── momentum.ts
│   │       ├── volatility.ts
│   │       └── moneyFlow.ts
│   ├── engine/
│   │   └── etf/
│   │       ├── scorer.ts      # Weighted scoring
│   │       └── learner.ts     # Self-learning weight adjustment
│   ├── ui/
│   │   ├── Dashboard.tsx
│   │   ├── Dashboard.css
│   │   ├── Detail.tsx
│   │   ├── Detail.css
│   │   ├── Factors.tsx
│   │   ├── Factors.css
│   │   ├── Settings.tsx
│   │   └── Settings.css
│   ├── hooks/
│   │   ├── useDB.ts
│   │   └── useWorker.ts
│   └── worker/
│       └── etfAnalysis.worker.ts
└── tests/
    ├── setup.ts
    ├── factors/
    │   ├── trend.test.ts
    │   ├── momentum.test.ts
    │   ├── volatility.test.ts
    │   └── moneyFlow.test.ts
    ├── engine/
    │   ├── scorer.test.ts
    │   └── learner.test.ts
    └── data/
        ├── cleaner.test.ts
        └── db.test.ts
```

---

## Phase 1: 核心骨架（MVP — 可用的 ETF 信号看板）

### Task 1: 项目初始化

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.css`, `src/vite-env.d.ts`, `public/manifest.json`, `public/icons/icon-192.png`, `public/icons/icon-512.png`

- [ ] **Step 1: Scaffold Vite + React + TypeScript project**

```bash
cd c:/Users/zhanghang/Desktop/claude/fundquantitativesystem
npm create vite@latest . -- --template react-ts
```

Expected: Vite scaffolds the project. When prompted to overwrite, confirm yes.

- [ ] **Step 2: Install all dependencies**

```bash
npm install
npm install idb comlink lightweight-charts vite-plugin-pwa
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configure vite.config.ts for PWA**

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'ETF量化分析',
        short_name: '量化ETF',
        description: '场内ETF+场外基金双引擎量化分析',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(json|csv)/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'data-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 }
            }
          }
        ]
      }
    })
  ],
  worker: {
    format: 'es'
  }
})
```

- [ ] **Step 4: Create public/manifest.json and placeholder icons**

```bash
mkdir -p public/icons
```

Create a simple 192x192 and 512x512 PNG. For MVP, generate solid-color placeholders:

```bash
# Using a simple approach — create minimal valid PNGs
# (On Windows, we'll create placeholder files; real icons can be added later)
echo "placeholder" > public/icons/icon-192.png
echo "placeholder" > public/icons/icon-512.png
```

- [ ] **Step 5: Update index.html with mobile meta tags**

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#0d1117" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="量化ETF" />
    <link rel="icon" type="image/png" href="/icons/icon-192.png" />
    <title>ETF量化分析</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Set up App.css with base dark theme**

```css
/* src/App.css */
:root {
  --bg-primary: #0d1117;
  --bg-card: #161b22;
  --border: #30363d;
  --text-primary: #f0f6fc;
  --text-secondary: #8b949e;
  --green: #3fb950;
  --yellow: #d2991d;
  --red: #f85149;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

html, body, #root {
  height: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 480px;
  margin: 0 auto;
}

.app-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  padding-bottom: 70px;
}
```

- [ ] **Step 7: Write minimal App.tsx with tab navigation shell**

```tsx
// src/App.tsx
import { useState } from 'react'
import './App.css'

type Tab = 'dashboard' | 'detail' | 'fundpicker' | 'factors' | 'settings'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'dashboard', label: '看板', icon: '📊' },
    { key: 'detail', label: '详情', icon: '🔍' },
    { key: 'fundpicker', label: '选基', icon: '🏦' },
    { key: 'factors', label: '因子', icon: '🧠' },
    { key: 'settings', label: '设置', icon: '⚙️' },
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
```

- [ ] **Step 8: Verify app runs**

```bash
npx vite --host 0.0.0.0 --port 5173
```

Expected: Open browser → see dark themed app with 5-tab bottom navigation. Tabs switch content.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + React + TS + PWA project with dark theme and tab navigation"
```

---

### Task 2: Type definitions

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Write all shared types**

```typescript
// src/types/index.ts

/** 日K线数据 */
export interface KLine {
  date: string          // '2026-07-15'
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** ETF 基本信息 */
export interface ETFInfo {
  code: string          // '510300'
  name: string          // '沪深300ETF'
  market: 'SH' | 'SZ'   // 上海 or 深圳
}

/** 因子评分（单个因子输出） */
export interface FactorScore {
  factorId: string
  name: string
  score: number         // 0-100
}

/** 综合信号 */
export interface Signal {
  id: string
  etfCode: string
  date: string
  compositeScore: number          // 0-100
  signal: 'buy' | 'hold' | 'sell' // 🟢🟡🔴
  factorScores: FactorScore[]
  weights: Record<string, number> // 生成信号时的权重快照
}

/** 自学习权重调整日志 */
export interface LearningLog {
  id: string
  date: string
  engine: 'etf' | 'mutual-fund-screening' | 'mutual-fund-diagnosis'
  oldWeights: Record<string, number>
  newWeights: Record<string, number>
  factorAccuracies: Record<string, number>  // 各因子近期准确率
  sampleCount: number                        // 参与评估的信号数
}

/** 因子接口（所有因子模块需实现） */
export interface Factor {
  id: string
  name: string
  description: string
  calculate(bars: KLine[]): number           // 输出 0-100
  params: Record<string, number>             // 可配置参数
}

/** IndexedDB schema */
export interface DBStore {
  etfList: ETFInfo[]
  klineData: { etfCode: string; bars: KLine[] }[]
  signals: Signal[]
  learningLogs: LearningLog[]
  weights: { engine: string; weights: Record<string, number>; updatedAt: string }[]
  settings: { key: string; value: unknown }[]
}

/** 信号阈值配置 */
export interface SignalThresholds {
  buyThreshold: number     // 默认 80
  sellThreshold: number    // 默认 40
}

/** 自学习配置 */
export interface LearningConfig {
  learningRate: number       // 默认 0.3
  lookbackWindow: number     // 默认 20
  minSamples: number         // 默认 10
  weightMin: number          // 默认 0.10
  weightMax: number          // 默认 0.50
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add shared type definitions for ETF quant system"
```

---

### Task 3: Default configuration

**Files:**
- Create: `src/config/defaults.ts`

- [ ] **Step 1: Write default configuration**

```typescript
// src/config/defaults.ts
import type { SignalThresholds, LearningConfig } from '../types'

export const DEFAULT_SIGNAL_THRESHOLDS: SignalThresholds = {
  buyThreshold: 80,
  sellThreshold: 40,
}

export const DEFAULT_LEARNING_CONFIG: LearningConfig = {
  learningRate: 0.3,
  lookbackWindow: 20,
  minSamples: 10,
  weightMin: 0.10,
  weightMax: 0.50,
}

export const DEFAULT_ETF_WEIGHTS: Record<string, number> = {
  trend: 0.25,
  momentum: 0.25,
  volatility: 0.25,
  moneyFlow: 0.25,
}

/** ETF 因子指标默认参数 */
export const FACTOR_PARAMS = {
  trend: {
    maFast: 5,
    maMid: 20,
    maSlow: 60,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
  },
  momentum: {
    rsiPeriod: 14,
    kdjPeriod: 9,
    kdjSignal: 3,
  },
  volatility: {
    bbPeriod: 20,
    bbStdDev: 2,
    atrPeriod: 14,
  },
  moneyFlow: {
    obvPeriod: 20,
    volChangePeriod: 5,
  },
} as const

/** 预置 ETF 关注列表（A股主流宽基+行业 ETF） */
export const DEFAULT_ETF_LIST = [
  { code: '510300', name: '沪深300ETF', market: 'SH' as const },
  { code: '510050', name: '上证50ETF', market: 'SH' as const },
  { code: '510500', name: '中证500ETF', market: 'SH' as const },
  { code: '159915', name: '创业板ETF', market: 'SZ' as const },
  { code: '588000', name: '科创50ETF', market: 'SH' as const },
  { code: '512480', name: '半导体ETF', market: 'SH' as const },
  { code: '516160', name: '新能源ETF', market: 'SH' as const },
  { code: '512880', name: '证券ETF', market: 'SH' as const },
  { code: '512010', name: '医药ETF', market: 'SH' as const },
  { code: '159869', name: '游戏ETF', market: 'SZ' as const },
]
```

- [ ] **Step 2: Commit**

```bash
git add src/config/defaults.ts
git commit -m "feat: add default config, weights, and ETF watchlist"
```

---

### Task 4: Data cleaning utilities

**Files:**
- Create: `src/data/cleaner.ts`
- Create: `tests/data/cleaner.test.ts`

- [ ] **Step 1: Write failing tests for cleaner**

```typescript
// tests/data/cleaner.test.ts
import { describe, it, expect } from 'vitest'
import { cleanKLines, removeDuplicates, fillMissingDates } from '../../src/data/cleaner'
import type { KLine } from '../../src/types'

describe('cleanKLines', () => {
  it('removes bars with invalid OHLCV', () => {
    const bars: KLine[] = [
      { date: '2026-07-10', open: 0, high: 1, low: 1, close: 1, volume: 100 },
      { date: '2026-07-11', open: 1, high: 1, low: 1, close: 1, volume: -1 },
      { date: '2026-07-12', open: 1, high: 2, low: 0.5, close: 1.5, volume: 200 },
    ]
    const result = cleanKLines(bars)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-07-12')
  })

  it('sorts by date ascending', () => {
    const bars: KLine[] = [
      { date: '2026-07-12', open: 1, high: 2, low: 1, close: 1.5, volume: 200 },
      { date: '2026-07-10', open: 1, high: 2, low: 1, close: 1.5, volume: 200 },
    ]
    const result = cleanKLines(bars)
    expect(result[0].date).toBe('2026-07-10')
    expect(result[1].date).toBe('2026-07-12')
  })
})

describe('removeDuplicates', () => {
  it('keeps only the first occurrence of each date', () => {
    const bars: KLine[] = [
      { date: '2026-07-10', open: 1, high: 2, low: 1, close: 1.5, volume: 100 },
      { date: '2026-07-10', open: 2, high: 3, low: 2, close: 2.5, volume: 200 },
      { date: '2026-07-11', open: 1, high: 2, low: 1, close: 1.5, volume: 150 },
    ]
    const result = removeDuplicates(bars)
    expect(result).toHaveLength(2)
    expect(result[0].open).toBe(1) // keeps first occurrence
  })
})

describe('fillMissingDates', () => {
  it('does not modify complete daily data', () => {
    const bars: KLine[] = [
      { date: '2026-07-10', open: 1, high: 2, low: 1, close: 1.5, volume: 100 },
      { date: '2026-07-13', open: 1, high: 2, low: 1, close: 1.5, volume: 100 },
    ]
    // 7/10 Fri -> 7/13 Mon, no trading days in between = no fill needed
    const result = fillMissingDates(bars)
    expect(result).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Verify tests fail**

```bash
npx vitest run tests/data/cleaner.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement cleaner.ts**

```typescript
// src/data/cleaner.ts
import type { KLine } from '../types'

/** 过滤无效数据：open/high/low/close 必须为正数，volume 必须 >= 0 */
export function cleanKLines(bars: KLine[]): KLine[] {
  return bars
    .filter(bar =>
      bar.open > 0 && bar.high > 0 && bar.low > 0 && bar.close > 0 && bar.volume >= 0
    )
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** 去重：相同日期保留第一条 */
export function removeDuplicates(bars: KLine[]): KLine[] {
  const seen = new Set<string>()
  return bars.filter(bar => {
    if (seen.has(bar.date)) return false
    seen.add(bar.date)
    return true
  })
}

/** 前值填充周末/节假日缺口（仅填充非交易日，不修改已有数据） */
export function fillMissingDates(bars: KLine[]): KLine[] {
  if (bars.length < 2) return bars
  const result: KLine[] = [bars[0]]
  for (let i = 1; i < bars.length; i++) {
    const prev = new Date(bars[i - 1].date)
    const curr = new Date(bars[i].date)
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    // If gap is > 1 day but <= 4 days (weekend), fill
    if (diffDays > 1 && diffDays <= 4) {
      for (let d = 1; d < diffDays; d++) {
        const fillDate = new Date(prev.getTime() + d * 86400000)
        result.push({
          date: fillDate.toISOString().slice(0, 10),
          open: bars[i - 1].close,
          high: bars[i - 1].close,
          low: bars[i - 1].close,
          close: bars[i - 1].close,
          volume: 0,
        })
      }
    }
    result.push(bars[i])
  }
  return result
}

/** 清洗管线：去重 → 过滤 → 排序 → 填充 */
export function processKLines(bars: KLine[]): KLine[] {
  return fillMissingDates(cleanKLines(removeDuplicates(bars)))
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/data/cleaner.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/cleaner.ts tests/data/cleaner.test.ts
git commit -m "feat: add K-line data cleaning utilities with tests"
```

---

### Task 5: IndexedDB database layer

**Files:**
- Create: `src/data/db.ts`
- Create: `tests/data/db.test.ts`

- [ ] **Step 1: Write db.ts with idb wrapper**

```typescript
// src/data/db.ts
import { openDB, type IDBPDatabase } from 'idb'
import type { ETFInfo, KLine, Signal, LearningLog } from '../types'

const DB_NAME = 'etf-quant-db'
const DB_VERSION = 1

let dbInstance: IDBPDatabase | null = null

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // ETF 列表
      if (!db.objectStoreNames.contains('etfList')) {
        db.createObjectStore('etfList', { keyPath: 'code' })
      }
      // K线数据: key = etfCode
      if (!db.objectStoreNames.contains('klineData')) {
        db.createObjectStore('klineData', { keyPath: 'etfCode' })
      }
      // 信号记录: auto-increment id
      if (!db.objectStoreNames.contains('signals')) {
        const signalStore = db.createObjectStore('signals', { keyPath: 'id' })
        signalStore.createIndex('etfCode', 'etfCode')
        signalStore.createIndex('date', 'date')
      }
      // 自学习日志: auto-increment id
      if (!db.objectStoreNames.contains('learningLogs')) {
        const logStore = db.createObjectStore('learningLogs', { keyPath: 'id' })
        logStore.createIndex('engine', 'engine')
        logStore.createIndex('date', 'date')
      }
      // 权重: key = engine name
      if (!db.objectStoreNames.contains('weights')) {
        db.createObjectStore('weights', { keyPath: 'engine' })
      }
      // 用户设置: key-value
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
    },
  })

  return dbInstance
}

// --- ETF List ---

export async function saveETFList(etfs: ETFInfo[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('etfList', 'readwrite')
  await Promise.all([
    ...etfs.map(etf => tx.store.put(etf)),
    tx.done,
  ])
}

export async function getETFList(): Promise<ETFInfo[]> {
  const db = await getDB()
  return db.getAll('etfList')
}

// --- K-line Data ---

export async function saveKLines(etfCode: string, bars: KLine[]): Promise<void> {
  const db = await getDB()
  await db.put('klineData', { etfCode, bars })
}

export async function getKLines(etfCode: string): Promise<KLine[]> {
  const db = await getDB()
  const record = await db.get('klineData', etfCode)
  return record?.bars ?? []
}

// --- Signals ---

export async function saveSignal(signal: Signal): Promise<void> {
  const db = await getDB()
  await db.put('signals', signal)
}

export async function getSignals(params: {
  etfCode?: string
  limit?: number
}): Promise<Signal[]> {
  const db = await getDB()
  if (params.etfCode) {
    const index = db.transaction('signals').store.index('etfCode')
    let cursor = await index.openCursor(params.etfCode, 'prev')
    const results: Signal[] = []
    while (cursor && results.length < (params.limit ?? 50)) {
      results.push(cursor.value)
      cursor = await cursor.continue()
    }
    return results
  }
  return db.getAllFromIndex('signals', 'date')
}

// --- Weights ---

export async function saveWeights(
  engine: string,
  weights: Record<string, number>
): Promise<void> {
  const db = await getDB()
  await db.put('weights', { engine, weights, updatedAt: new Date().toISOString() })
}

export async function getWeights(
  engine: string
): Promise<Record<string, number> | null> {
  const db = await getDB()
  const record = await db.get('weights', engine)
  return record?.weights ?? null
}

// --- Learning Logs ---

export async function saveLearningLog(log: LearningLog): Promise<void> {
  const db = await getDB()
  await db.put('learningLogs', log)
}

export async function getLearningLogs(
  engine: string,
  limit = 20
): Promise<LearningLog[]> {
  const db = await getDB()
  const index = db.transaction('learningLogs').store.index('engine')
  let cursor = await index.openCursor(engine, 'prev')
  const results: LearningLog[] = []
  while (cursor && results.length < limit) {
    results.push(cursor.value)
    cursor = await cursor.continue()
  }
  return results
}

// --- Settings ---

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB()
  await db.put('settings', { key, value })
}

export async function getSetting<T>(key: string): Promise<T | null> {
  const db = await getDB()
  const record = await db.get('settings', key)
  return record?.value ?? null
}

// --- Export/Import ---

export async function exportAllData(): Promise<Record<string, unknown>> {
  const db = await getDB()
  const [etfList, signals, learningLogs, weights, settings] = await Promise.all([
    db.getAll('etfList'),
    db.getAll('signals'),
    db.getAll('learningLogs'),
    db.getAll('weights'),
    db.getAll('settings'),
  ])
  // Fetch all kline data
  const allKline = await db.getAll('klineData')
  return { etfList, klineData: allKline, signals, learningLogs, weights, settings }
}

export async function importAllData(data: Record<string, unknown[]>): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    ['etfList', 'klineData', 'signals', 'learningLogs', 'weights', 'settings'],
    'readwrite'
  )
  for (const item of (data.etfList as ETFInfo[]) ?? []) {
    await tx.objectStore('etfList').put(item)
  }
  for (const item of (data.klineData as { etfCode: string; bars: KLine[] }[]) ?? []) {
    await tx.objectStore('klineData').put(item)
  }
  for (const item of (data.signals as Signal[]) ?? []) {
    await tx.objectStore('signals').put(item)
  }
  for (const item of (data.learningLogs as LearningLog[]) ?? []) {
    await tx.objectStore('learningLogs').put(item)
  }
  for (const item of (data.weights as { engine: string; weights: Record<string, number>; updatedAt: string }[]) ?? []) {
    await tx.objectStore('weights').put(item)
  }
  for (const item of (data.settings as { key: string; value: unknown }[]) ?? []) {
    await tx.objectStore('settings').put(item)
  }
  await tx.done
}
```

- [ ] **Step 2: Write DB tests (mock IndexedDB with fake-indexeddb or test in jsdom)**

Since IndexedDB testing requires a browser-like environment, write a smoke test:

```typescript
// tests/data/db.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { saveETFList, getETFList, saveKLines, getKLines, saveSignal, getSignals } from '../../src/data/db'
import type { ETFInfo, KLine, Signal } from '../../src/types'

beforeEach(() => {
  // Reset IndexedDB between tests
  indexedDB = new IDBFactory()
})

describe('ETF List CRUD', () => {
  it('saves and retrieves ETF list', async () => {
    const etfs: ETFInfo[] = [
      { code: '510300', name: '沪深300ETF', market: 'SH' },
      { code: '159915', name: '创业板ETF', market: 'SZ' },
    ]
    await saveETFList(etfs)
    const result = await getETFList()
    expect(result).toHaveLength(2)
    expect(result[0].code).toBe('510300')
  })
})

describe('K-line Data CRUD', () => {
  it('saves and retrieves K-line data', async () => {
    const bars: KLine[] = [
      { date: '2026-07-10', open: 1, high: 2, low: 1, close: 1.5, volume: 100 },
    ]
    await saveKLines('510300', bars)
    const result = await getKLines('510300')
    expect(result).toHaveLength(1)
  })

  it('returns empty array for unknown ETF', async () => {
    const result = await getKLines('999999')
    expect(result).toEqual([])
  })
})

describe('Signal CRUD', () => {
  it('saves and retrieves signals', async () => {
    const signal: Signal = {
      id: 'test-1',
      etfCode: '510300',
      date: '2026-07-15',
      compositeScore: 82,
      signal: 'buy',
      factorScores: [
        { factorId: 'trend', name: '趋势', score: 85 },
      ],
      weights: { trend: 1.0 },
    }
    await saveSignal(signal)
    const results = await getSignals({ etfCode: '510300', limit: 10 })
    expect(results).toHaveLength(1)
    expect(results[0].signal).toBe('buy')
  })
})
```

- [ ] **Step 3: Install fake-indexeddb**

```bash
npm install -D fake-indexeddb
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/data/db.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/db.ts tests/data/db.test.ts
git commit -m "feat: add IndexedDB database layer with CRUD operations"
```

---

### Task 6: ETF data fetcher

**Files:**
- Create: `src/data/etfFetcher.ts`

- [ ] **Step 1: Implement ETF data fetcher using EastMoney public API**

```typescript
// src/data/etfFetcher.ts
import type { KLine, ETFInfo } from '../types'
import { processKLines } from './cleaner'

/** 东方财富日K线API（公开，无需密钥） */
function buildKLineUrl(code: string, market: 'SH' | 'SZ'): string {
  // 上海: 1.510300, 深圳: 0.159915
  const secid = market === 'SH' ? `1.${code}` : `0.${code}`
  return `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=1&end=20500101&lmt=365`
}

/** 解析东方财富返回的K线数据 */
function parseEastMoneyKLine(raw: unknown): KLine[] {
  const data = raw as {
    data?: {
      klines?: string[]
    }
  }
  if (!data?.data?.klines) return []

  return data.data.klines.map((line: string) => {
    const parts = line.split(',')
    return {
      date: parts[0],
      open: parseFloat(parts[1]),
      close: parseFloat(parts[2]),
      high: parseFloat(parts[3]),
      low: parseFloat(parts[4]),
      volume: parseInt(parts[5], 10),
    }
  })
}

/** 获取单只ETF的历史日K线数据 */
export async function fetchETFKLines(
  code: string,
  market: 'SH' | 'SZ'
): Promise<KLine[]> {
  const url = buildKLineUrl(code, market)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch K-lines for ${code}: ${response.status}`)
  }
  const raw = await response.json()
  const bars = parseEastMoneyKLine(raw)
  return processKLines(bars)
}

/** 批量获取多只ETF的K线数据 */
export async function fetchAllETFs(etfs: ETFInfo[]): Promise<Map<string, KLine[]>> {
  const results = new Map<string, KLine[]>()
  // 串行获取以避免请求过于密集
  for (const etf of etfs) {
    try {
      const bars = await fetchETFKLines(etf.code, etf.market)
      results.set(etf.code, bars)
    } catch (err) {
      console.error(`Failed to fetch ${etf.code}:`, err)
      results.set(etf.code, [])
    }
  }
  return results
}

/** 检测是否需要更新（对比最新日期） */
export function needsUpdate(
  existingBars: KLine[],
  fetchedBars: KLine[]
): boolean {
  if (existingBars.length === 0) return true
  const latestExisting = existingBars[existingBars.length - 1].date
  const latestFetched = fetchedBars[fetchedBars.length - 1].date
  return latestFetched > latestExisting
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/data/etfFetcher.ts
git commit -m "feat: add ETF data fetcher using EastMoney public API"
```

---

### Task 7: ETF factors — trend and momentum

**Files:**
- Create: `src/factors/etf/types.ts`, `src/factors/etf/trend.ts`, `src/factors/etf/momentum.ts`
- Create: `tests/factors/trend.test.ts`, `tests/factors/momentum.test.ts`

- [ ] **Step 1: Write factor interface and trend factor test**

```typescript
// tests/factors/trend.test.ts
import { describe, it, expect } from 'vitest'
import { trendFactor } from '../../src/factors/etf/trend'
import type { KLine } from '../../src/types'

function makeBar(date: string, close: number): KLine {
  return { date, open: close, high: close, low: close, close, volume: 1000 }
}

describe('trendFactor', () => {
  it('returns high score for uptrend (MA5 > MA20 > MA60)', () => {
    const bars: KLine[] = []
    // Generate upward trending data: prices slowly rising
    for (let i = 0; i < 100; i++) {
      bars.push(makeBar(`2026-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`, 3 + i * 0.05))
    }
    // Fix dates to be sequential
    bars.forEach((b, i) => {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      b.date = d.toISOString().slice(0, 10)
    })
    const score = trendFactor.calculate(bars)
    expect(score).toBeGreaterThanOrEqual(70)
  })

  it('returns low score for downtrend (MA5 < MA20 < MA60)', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 100; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push({ ...makeBar(d.toISOString().slice(0, 10), 10 - i * 0.05) })
    }
    const score = trendFactor.calculate(bars)
    expect(score).toBeLessThanOrEqual(30)
  })

  it('returns score in 0-100 range', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 60; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push({ ...makeBar(d.toISOString().slice(0, 10), 5 + Math.sin(i * 0.3) * 2) })
    }
    const score = trendFactor.calculate(bars)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
```

- [ ] **Step 2: Implement trend factor**

```typescript
// src/factors/etf/types.ts
import type { Factor } from '../../types'

export type { Factor }
```

```typescript
// src/factors/etf/trend.ts
import type { Factor, KLine } from '../../types'
import { FACTOR_PARAMS } from '../../config/defaults'

/** 计算简单移动平均 */
function sma(bars: KLine[], period: number, field: 'close' = 'close'): number[] {
  const result: number[] = []
  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += bars[j][field]
    }
    result.push(sum / period)
  }
  return result
}

/** 计算 EMA */
function ema(bars: KLine[], period: number): number[] {
  const result: number[] = []
  const k = 2 / (period + 1)
  // First value is SMA
  let prev = bars.slice(0, period).reduce((s, b) => s + b.close, 0) / period
  result.push(prev)
  for (let i = period; i < bars.length; i++) {
    prev = bars[i].close * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

/** 计算MACD */
function macd(
  bars: KLine[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { dif: number[]; dea: number[]; histogram: number[] } {
  const emaFast = ema(bars, fastPeriod)
  const emaSlow = ema(bars, slowPeriod)
  // Align lengths: emaFast and emaSlow differ by slowPeriod - fastPeriod
  const offset = slowPeriod - fastPeriod
  const dif: number[] = []
  for (let i = 0; i < emaFast.length; i++) {
    dif.push(emaFast[i] - (emaSlow[i + offset] ?? emaSlow[emaSlow.length - 1]))
  }
  // DEA = EMA of DIF
  const deaValues: number[] = []
  const k = 2 / (signalPeriod + 1)
  let deaPrev = dif.slice(0, signalPeriod).reduce((s, v) => s + v, 0) / signalPeriod
  deaValues.push(deaPrev)
  for (let i = signalPeriod; i < dif.length; i++) {
    deaPrev = dif[i] * k + deaPrev * (1 - k)
    deaValues.push(deaPrev)
  }
  const histogram = dif.slice(signalPeriod - 1).map((d, i) => d - deaValues[i])
  return { dif, dea: deaValues, histogram }
}

export const trendFactor: Factor = {
  id: 'trend',
  name: '趋势',
  description: '基于均线多头/空头排列和MACD判断趋势方向',
  params: FACTOR_PARAMS.trend,

  calculate(bars: KLine[]): number {
    if (bars.length < 60) return 50 // 不够数据，返回中性

    const p = this.params
    const closes = bars.map(b => b.close)

    // 计算均线（用 SMA 简化）
    const ma5 = sma(bars, p.maFast)
    const ma20 = sma(bars, p.maMid)
    const ma60 = sma(bars, p.maSlow)

    const latest5 = ma5[ma5.length - 1]
    const latest20 = ma20[ma20.length - 1]
    const latest60 = ma60[ma60.length - 1]

    // 均线排列评分 (0-60)
    let alignmentScore = 0
    if (latest5 > latest20 && latest20 > latest60) {
      alignmentScore = 60 // 多头排列
    } else if (latest5 < latest20 && latest20 < latest60) {
      alignmentScore = 0  // 空头排列
    } else if (latest5 > latest60) {
      alignmentScore = 40 // 短多长空（可能反转）
    } else {
      alignmentScore = 20 // 短空长多（回调中）
    }

    // MACD 评分 (0-40)
    const { dif, dea, histogram } = macd(bars, p.macdFast, p.macdSlow, p.macdSignal)
    const latestHist = histogram[histogram.length - 1]
    const prevHist = histogram[histogram.length - 2] ?? 0
    const latestDIF = dif[dif.length - 1]

    let macdScore = 20 // 中性
    if (latestHist > 0 && latestHist > prevHist) {
      macdScore = 40 // 红柱放大，强势
    } else if (latestHist > 0 && latestHist < prevHist) {
      macdScore = 30 // 红柱缩小，趋势减弱
    } else if (latestHist < 0 && latestHist > prevHist) {
      macdScore = 15 // 绿柱缩小，可能反转
    } else if (latestHist < 0 && latestHist < prevHist) {
      macdScore = 0  // 绿柱放大，弱势
    }

    // DIF 零轴加分
    if (latestDIF > 0) macdScore = Math.min(40, macdScore + 5)

    return Math.round(alignmentScore + macdScore)
  },
}
```

- [ ] **Step 3: Run trend tests**

```bash
npx vitest run tests/factors/trend.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 4: Implement momentum factor with test**

```typescript
// tests/factors/momentum.test.ts
import { describe, it, expect } from 'vitest'
import { momentumFactor } from '../../src/factors/etf/momentum'
import type { KLine } from '../../src/types'

function makeBar(date: string, close: number, high = close, low = close): KLine {
  return { date, open: close, high, low, close, volume: 1000 }
}

describe('momentumFactor', () => {
  it('returns high score when RSI is oversold (30-50)', () => {
    const bars: KLine[] = []
    // Create data where price dropped then flattened at low level
    for (let i = 0; i < 50; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      // Sharp drop first 10 days, then flat
      const price = i < 10 ? 20 - i : 10
      bars.push(makeBar(d.toISOString().slice(0, 10), price))
    }
    const score = momentumFactor.calculate(bars)
    expect(score).toBeGreaterThanOrEqual(50) // RSI should be low, giving high score
  })

  it('returns score in 0-100 range', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 10 + Math.sin(i * 0.5) * 3))
    }
    const score = momentumFactor.calculate(bars)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
```

```typescript
// src/factors/etf/momentum.ts
import type { Factor, KLine } from '../../types'
import { FACTOR_PARAMS } from '../../config/defaults'

/** 计算 RSI */
function rsi(bars: KLine[], period: number): number {
  if (bars.length < period + 1) return 50
  let gains = 0
  let losses = 0
  for (let i = bars.length - period; i < bars.length; i++) {
    const change = bars[i].close - bars[i - 1].close
    if (change > 0) gains += change
    else losses += Math.abs(change)
  }
  if (losses === 0) return 100
  const rs = gains / losses
  return 100 - 100 / (1 + rs)
}

/** 计算KDJ中的K值 */
function kdj(
  bars: KLine[],
  period: number,
  signalPeriod: number
): { k: number; d: number; j: number } {
  if (bars.length < period) return { k: 50, d: 50, j: 50 }

  const idx = bars.length - 1
  const highestHigh = Math.max(...bars.slice(idx - period + 1, idx + 1).map(b => b.high))
  const lowestLow = Math.min(...bars.slice(idx - period + 1, idx + 1).map(b => b.low))
  const rsv = ((bars[idx].close - lowestLow) / (highestHigh - lowestLow || 1)) * 100
  // 简化：直接用 RSV 作为 K 值（实际需要递归计算，但首次近似合理）
  const k = rsv
  const d = k // 简化 D = K
  const j = 3 * k - 2 * d
  return { k: Math.max(0, Math.min(100, k)), d: Math.max(0, Math.min(100, d)), j: Math.max(0, Math.min(100, j)) }
}

export const momentumFactor: Factor = {
  id: 'momentum',
  name: '动量',
  description: '基于RSI和KDJ判断买卖力道',
  params: FACTOR_PARAMS.momentum,

  calculate(bars: KLine[]): number {
    if (bars.length < 20) return 50

    const rsiValue = rsi(bars, this.params.rsiPeriod)
    const { k: kValue } = kdj(bars, this.params.kdjPeriod, this.params.kdjSignal)

    // RSI 评分 (0-60): 超卖区间(30-50)得分高，超买(>70)得分低
    let rsiScore = 0
    if (rsiValue >= 30 && rsiValue <= 50) {
      rsiScore = 60 // 最佳买点区域
    } else if (rsiValue > 50 && rsiValue <= 65) {
      rsiScore = 40
    } else if (rsiValue > 20 && rsiValue < 30) {
      rsiScore = 30 // 弱势，但可能超跌反弹
    } else if (rsiValue >= 65 && rsiValue <= 80) {
      rsiScore = 15 // 接近超买
    } else if (rsiValue > 80) {
      rsiScore = 0  // 严重超买
    } else {
      rsiScore = 10 // RSI < 20，极度弱势
    }

    // KDJ 评分 (0-40): K值低分高买
    let kdjScore = 0
    if (kValue >= 20 && kValue <= 50) {
      kdjScore = 40
    } else if (kValue > 50 && kValue <= 70) {
      kdjScore = 25
    } else if (kValue < 20) {
      kdjScore = 20
    } else {
      kdjScore = 0 // K > 80，超买
    }

    return Math.round(rsiScore + kdjScore)
  },
}
```

- [ ] **Step 5: Run momentum tests**

```bash
npx vitest run tests/factors/momentum.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/factors/etf/types.ts src/factors/etf/trend.ts src/factors/etf/momentum.ts tests/factors/trend.test.ts tests/factors/momentum.test.ts
git commit -m "feat: add trend and momentum ETF factors with tests"
```

---

### Task 8: ETF factors — volatility and moneyFlow

**Files:**
- Create: `src/factors/etf/volatility.ts`, `src/factors/etf/moneyFlow.ts`
- Create: `tests/factors/volatility.test.ts`, `tests/factors/moneyFlow.test.ts`

- [ ] **Step 1: Implement volatility factor with test**

```typescript
// tests/factors/volatility.test.ts
import { describe, it, expect } from 'vitest'
import { volatilityFactor } from '../../src/factors/etf/volatility'
import type { KLine } from '../../src/types'

function makeBar(date: string, close: number): KLine {
  return { date, open: close, high: close * 1.02, low: close * 0.98, close, volume: 1000 }
}

describe('volatilityFactor', () => {
  it('returns high score when price near lower Bollinger band', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      // Steadily dropping price
      bars.push(makeBar(d.toISOString().slice(0, 10), 20 - i * 0.3))
    }
    const score = volatilityFactor.calculate(bars)
    expect(score).toBeGreaterThanOrEqual(50) // Near lower band
  })

  it('returns score in 0-100 range', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 10 + Math.sin(i * 0.3) * 3))
    }
    const score = volatilityFactor.calculate(bars)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
```

```typescript
// src/factors/etf/volatility.ts
import type { Factor, KLine } from '../../types'
import { FACTOR_PARAMS } from '../../config/defaults'

/** 计算布林带 */
function bollingerBands(bars: KLine[], period: number, stdDev: number) {
  if (bars.length < period) return { upper: 0, middle: 0, lower: 0, width: 0 }
  const slice = bars.slice(-period)
  const closes = slice.map(b => b.close)
  const mean = closes.reduce((s, v) => s + v, 0) / period
  const variance = closes.reduce((s, v) => s + (v - mean) ** 2, 0) / period
  const std = Math.sqrt(variance)
  return {
    upper: mean + stdDev * std,
    middle: mean,
    lower: mean - stdDev * std,
    width: (2 * stdDev * std) / mean, // 带宽（归一化）
  }
}

/** 计算 ATR */
function atr(bars: KLine[], period: number): number {
  if (bars.length < period + 1) return 0
  const slice = bars.slice(-period)
  let sum = 0
  for (let i = 1; i < slice.length; i++) {
    const high = slice[i].high
    const low = slice[i].low
    const prevClose = slice[i - 1].close
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    sum += tr
  }
  return sum / period
}

export const volatilityFactor: Factor = {
  id: 'volatility',
  name: '波动率',
  description: '基于布林带位置和ATR判断价格位置安全度',
  params: FACTOR_PARAMS.volatility,

  calculate(bars: KLine[]): number {
    if (bars.length < 25) return 50

    const { upper, middle, lower, width } = bollingerBands(
      bars,
      this.params.bbPeriod,
      this.params.bbStdDev
    )
    const currentPrice = bars[bars.length - 1].close
    const atrValue = atr(bars, this.params.atrPeriod)
    const atrRatio = atrValue / currentPrice

    // 布林带位置评分 (0-70)
    let bbScore = 0
    const position = (currentPrice - lower) / (upper - lower || 0.001)
    if (position <= 0.2) {
      bbScore = 70 // 接近下轨
    } else if (position <= 0.4) {
      bbScore = 55
    } else if (position <= 0.6) {
      bbScore = 35 // 中轨附近
    } else if (position <= 0.8) {
      bbScore = 15
    } else {
      bbScore = 0  // 接近上轨
    }

    // ATR 风险惩罚 (0-30)
    let atrPenalty = 0
    if (atrRatio > 0.05) {
      atrPenalty = 30 // 高波动，大幅扣分
    } else if (atrRatio > 0.03) {
      atrPenalty = 15
    }
    // else: 低波动，不扣分

    return Math.round(Math.max(0, bbScore - atrPenalty))
  },
}
```

- [ ] **Step 2: Implement moneyFlow factor with test**

```typescript
// tests/factors/moneyFlow.test.ts
import { describe, it, expect } from 'vitest'
import { moneyFlowFactor } from '../../src/factors/etf/moneyFlow'
import type { KLine } from '../../src/types'

describe('moneyFlowFactor', () => {
  it('returns high score on volume-backed price rise', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push({
        date: d.toISOString().slice(0, 10),
        open: 10 + i * 0.1,
        high: 10 + i * 0.15,
        low: 10 + i * 0.05,
        close: 10 + i * 0.12,
        volume: 1000 + i * 100, // Increasing volume
      })
    }
    const score = moneyFlowFactor.calculate(bars)
    expect(score).toBeGreaterThanOrEqual(60)
  })

  it('returns low score on volume-backed price drop', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push({
        date: d.toISOString().slice(0, 10),
        open: 20 - i * 0.1,
        high: 20 - i * 0.05,
        low: 20 - i * 0.15,
        close: 20 - i * 0.12,
        volume: 1000 + i * 100, // Increasing volume on drop
      })
    }
    const score = moneyFlowFactor.calculate(bars)
    expect(score).toBeLessThanOrEqual(40)
  })

  it('returns score in 0-100 range', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push({
        date: d.toISOString().slice(0, 10),
        open: 10 + Math.sin(i * 0.5) * 2,
        high: 10 + Math.sin(i * 0.5) * 2 + 0.3,
        low: 10 + Math.sin(i * 0.5) * 2 - 0.3,
        close: 10 + Math.sin(i * 0.5) * 2 + 0.1,
        volume: 500 + Math.floor(Math.random() * 500),
      })
    }
    const score = moneyFlowFactor.calculate(bars)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
```

```typescript
// src/factors/etf/moneyFlow.ts
import type { Factor, KLine } from '../../types'
import { FACTOR_PARAMS } from '../../config/defaults'

export const moneyFlowFactor: Factor = {
  id: 'moneyFlow',
  name: '资金流',
  description: '基于成交量和OBV趋势判断资金态度',
  params: FACTOR_PARAMS.moneyFlow,

  calculate(bars: KLine[]): number {
    if (bars.length < 10) return 50

    const period = this.params.volChangePeriod as number
    const recent = bars.slice(-period)

    // 计算量价关系
    let upVolume = 0
    let downVolume = 0
    for (let i = 1; i < recent.length; i++) {
      const priceChange = recent[i].close - recent[i - 1].close
      if (priceChange > 0) {
        upVolume += recent[i].volume
      } else {
        downVolume += recent[i].volume
      }
    }
    const totalVolume = upVolume + downVolume

    // OBV 趋势
    let obv = 0
    const obvValues: number[] = []
    for (let i = 1; i < bars.length; i++) {
      if (bars[i].close > bars[i - 1].close) {
        obv += bars[i].volume
      } else if (bars[i].close < bars[i - 1].close) {
        obv -= bars[i].volume
      }
      obvValues.push(obv)
    }
    // OBV 近期趋势（最后5个值的方向）
    const recentObv = obvValues.slice(-5)
    const obvTrend = recentObv[recentObv.length - 1] - recentObv[0]

    // 量价关系评分 (0-60)
    let volumeScore = 30
    if (totalVolume > 0) {
      const upRatio = upVolume / totalVolume
      if (upRatio > 0.65) {
        volumeScore = 60 // 放量上涨
      } else if (upRatio > 0.5) {
        volumeScore = 45
      } else if (upRatio < 0.35) {
        volumeScore = 0 // 放量下跌
      } else {
        volumeScore = 15
      }
    }

    // OBV 趋势评分 (0-40)
    let obvScore = 20
    const avgPrice = bars.slice(-5).reduce((s, b) => s + b.close, 0) / 5
    const obvMagnitude = avgPrice > 0 ? Math.abs(obvTrend) / avgPrice / 1e6 : 0

    if (obvTrend > 0 && obvMagnitude > 0.1) {
      obvScore = 40 // OBV 强劲上升
    } else if (obvTrend > 0) {
      obvScore = 30
    } else if (obvTrend < 0 && obvMagnitude > 0.1) {
      obvScore = 0  // OBV 强劲下降
    } else {
      obvScore = 10
    }

    return Math.round(volumeScore + obvScore)
  },
}
```

- [ ] **Step 3: Run all factor tests**

```bash
npx vitest run tests/factors/
```

Expected: 10 tests PASS.

- [ ] **Step 4: Create factor registry**

```typescript
// src/factors/etf/index.ts
import type { Factor } from '../../types'
import { trendFactor } from './trend'
import { momentumFactor } from './momentum'
import { volatilityFactor } from './volatility'
import { moneyFlowFactor } from './moneyFlow'

export const etfFactors: Factor[] = [
  trendFactor,
  momentumFactor,
  volatilityFactor,
  moneyFlowFactor,
]

export function getFactorById(id: string): Factor | undefined {
  return etfFactors.find(f => f.id === id)
}
```

- [ ] **Step 5: Commit**

```bash
git add src/factors/etf/volatility.ts src/factors/etf/moneyFlow.ts src/factors/etf/index.ts tests/factors/volatility.test.ts tests/factors/moneyFlow.test.ts
git commit -m "feat: add volatility and moneyFlow ETF factors with tests and registry"
```

---

### Task 9: ETF scoring engine

**Files:**
- Create: `src/engine/etf/scorer.ts`
- Create: `tests/engine/scorer.test.ts`

- [ ] **Step 1: Write scorer test**

```typescript
// tests/engine/scorer.test.ts
import { describe, it, expect } from 'vitest'
import { scoreETF } from '../../src/engine/etf/scorer'
import type { KLine } from '../../src/types'

function makeBar(date: string, close: number, volume = 1000): KLine {
  return { date, open: close, high: close * 1.01, low: close * 0.99, close, volume }
}

describe('scoreETF', () => {
  it('returns buy signal for strong uptrend with default weights', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 100; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 10 + i * 0.1, 1000 + i * 50))
    }
    const weights = { trend: 0.25, momentum: 0.25, volatility: 0.25, moneyFlow: 0.25 }
    const result = scoreETF(bars, weights)
    expect(result.compositeScore).toBeGreaterThanOrEqual(50)
    expect(['buy', 'hold', 'sell']).toContain(result.signal)
    expect(result.factorScores).toHaveLength(4)
  })

  it('returns signal based on threshold (default buy≥80, sell<40)', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 80; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 10))
    }
    const weights = { trend: 0.25, momentum: 0.25, volatility: 0.25, moneyFlow: 0.25 }
    const result = scoreETF(bars, weights)
    // Flat price should give a middle-ish score (hold)
    expect(result.signal).toBe('hold')
  })

  it('uses custom thresholds', () => {
    const bars: KLine[] = []
    for (let i = 0; i < 80; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      bars.push(makeBar(d.toISOString().slice(0, 10), 10))
    }
    const weights = { trend: 0.25, momentum: 0.25, volatility: 0.25, moneyFlow: 0.25 }
    const result = scoreETF(bars, weights, { buyThreshold: 50, sellThreshold: 30 })
    // With a very low buy threshold, flat price might trigger buy
    expect(result.compositeScore).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Implement scorer**

```typescript
// src/engine/etf/scorer.ts
import type { KLine, FactorScore, SignalThresholds } from '../../types'
import { etfFactors } from '../../factors/etf'
import { DEFAULT_SIGNAL_THRESHOLDS } from '../../config/defaults'

export interface ScoringResult {
  compositeScore: number
  signal: 'buy' | 'hold' | 'sell'
  factorScores: FactorScore[]
  weights: Record<string, number>
}

/**
 * 计算 ETF 综合评分
 * @param bars K线数据
 * @param weights 因子权重 { trend: 0.25, momentum: 0.25, ... }
 * @param thresholds 信号阈值，默认 ≥80 买入 / <40 卖出
 */
export function scoreETF(
  bars: KLine[],
  weights: Record<string, number>,
  thresholds: SignalThresholds = DEFAULT_SIGNAL_THRESHOLDS
): ScoringResult {
  // 各因子计算打分
  const factorScores: FactorScore[] = etfFactors.map(factor => ({
    factorId: factor.id,
    name: factor.name,
    score: factor.calculate(bars),
  }))

  // 加权求和
  let compositeScore = 0
  for (const fs of factorScores) {
    const w = weights[fs.factorId] ?? 0.25
    compositeScore += fs.score * w
  }
  compositeScore = Math.round(compositeScore)

  // 判定信号
  let signal: 'buy' | 'hold' | 'sell'
  if (compositeScore >= thresholds.buyThreshold) {
    signal = 'buy'
  } else if (compositeScore < thresholds.sellThreshold) {
    signal = 'sell'
  } else {
    signal = 'hold'
  }

  return { compositeScore, signal, factorScores, weights: { ...weights } }
}
```

- [ ] **Step 3: Run scorer tests**

```bash
npx vitest run tests/engine/scorer.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/engine/etf/scorer.ts tests/engine/scorer.test.ts
git commit -m "feat: add ETF scoring engine with weighted multi-factor scoring"
```

---

### Task 10: ETF self-learning engine

**Files:**
- Create: `src/engine/etf/learner.ts`
- Create: `tests/engine/learner.test.ts`

- [ ] **Step 1: Write learner test**

```typescript
// tests/engine/learner.test.ts
import { describe, it, expect } from 'vitest'
import { adjustWeights } from '../../src/engine/etf/learner'
import type { Signal, KLine } from '../../src/types'

describe('adjustWeights', () => {
  it('adjusts weights based on factor accuracy', () => {
    const signals: Signal[] = [
      {
        id: 's1', etfCode: '510300', date: '2026-06-01',
        compositeScore: 75, signal: 'hold',
        factorScores: [
          { factorId: 'trend', name: '趋势', score: 80 },
          { factorId: 'momentum', name: '动量', score: 60 },
        ],
        weights: { trend: 0.5, momentum: 0.5 },
      },
      {
        id: 's2', etfCode: '510300', date: '2026-06-02',
        compositeScore: 60, signal: 'hold',
        factorScores: [
          { factorId: 'trend', name: '趋势', score: 40 },
          { factorId: 'momentum', name: '动量', score: 80 },
        ],
        weights: { trend: 0.5, momentum: 0.5 },
      },
    ]

    // trend.score=80(>50) & price up => trend correct
    // trend.score=40(<50) & price up => trend wrong
    // momentum.score=60(>50) & price up => momentum correct (x2)
    // accuracy: trend=0.5, momentum=1.0
    // new weights: trend=0.5/1.5=0.33, momentum=1.0/1.5=0.67

    const oldWeights = { trend: 0.5, momentum: 0.5 }
    const result = adjustWeights(signals, 'up', oldWeights, {
      learningRate: 1.0, // Use full new weights (no smoothing)
      lookbackWindow: 20,
      minSamples: 1,
      weightMin: 0.1,
      weightMax: 0.9,
    })

    expect(result.newWeights.momentum).toBeGreaterThan(result.newWeights.trend)
    expect(result.factorAccuracies.momentum).toBeGreaterThan(
      result.factorAccuracies.trend
    )
  })

  it('returns old weights when not enough samples', () => {
    const oldWeights = { trend: 0.5, momentum: 0.5 }
    const result = adjustWeights([], 'up', oldWeights, {
      learningRate: 0.3,
      lookbackWindow: 20,
      minSamples: 10,
      weightMin: 0.1,
      weightMax: 0.5,
    })
    expect(result.newWeights).toEqual(oldWeights)
  })

  it('clamps weights to min/max bounds', () => {
    const signals: Signal[] = []
    // Create signals where only trend is always correct
    for (let i = 0; i < 20; i++) {
      signals.push({
        id: `s${i}`, etfCode: '510300', date: `2026-06-${String(i + 1).padStart(2, '0')}`,
        compositeScore: 60, signal: 'hold',
        factorScores: [
          { factorId: 'trend', name: '趋势', score: 80 },
          { factorId: 'momentum', name: '动量', score: 20 },
        ],
        weights: { trend: 0.5, momentum: 0.5 },
      })
    }

    const result = adjustWeights(signals, 'up', { trend: 0.9, momentum: 0.1 }, {
      learningRate: 1.0,
      lookbackWindow: 20,
      minSamples: 1,
      weightMin: 0.1,
      weightMax: 0.5,
    })

    // All weights should be within [0.1, 0.5] and sum to 1.0
    expect(result.newWeights.trend).toBeLessThanOrEqual(0.5)
    expect(result.newWeights.momentum).toBeLessThanOrEqual(0.5)
    expect(result.newWeights.momentum).toBeGreaterThanOrEqual(0.1)

    const totalWeight = Object.values(result.newWeights).reduce((s, w) => s + w, 0)
    expect(totalWeight).toBeCloseTo(1.0, 2)
  })
})
```

- [ ] **Step 2: Implement learner**

```typescript
// src/engine/etf/learner.ts
import type { Signal, LearningConfig } from '../../types'
import { DEFAULT_LEARNING_CONFIG } from '../../config/defaults'

export interface AdjustmentResult {
  newWeights: Record<string, number>
  factorAccuracies: Record<string, number>
  sampleCount: number
}

/**
 * 根据历史信号和实际走势，调整因子权重
 *
 * @param signals 历史信号记录
 * @param actualOutcome 'up' 表示后续涨了, 'down' 表示后续跌了
 * @param oldWeights 当前使用的权重
 * @param config 学习参数
 */
export function adjustWeights(
  signals: Signal[],
  actualOutcome: 'up' | 'down',
  oldWeights: Record<string, number>,
  config: LearningConfig = DEFAULT_LEARNING_CONFIG
): AdjustmentResult {
  // 样本不足，不调整
  if (signals.length < config.minSamples) {
    return {
      newWeights: { ...oldWeights },
      factorAccuracies: {},
      sampleCount: signals.length,
    }
  }

  // 提取所有因子ID
  const factorIds = Object.keys(oldWeights)
  if (factorIds.length === 0) {
    return {
      newWeights: { ...oldWeights },
      factorAccuracies: {},
      sampleCount: signals.length,
    }
  }

  // 计算各因子准确率
  const correctCount: Record<string, number> = {}
  const totalCount: Record<string, number> = {}

  for (const id of factorIds) {
    correctCount[id] = 0
    totalCount[id] = 0
  }

  for (const signal of signals.slice(-config.lookbackWindow)) {
    for (const fs of signal.factorScores) {
      totalCount[fs.factorId] = (totalCount[fs.factorId] ?? 0) + 1
      const predictedUp = fs.score > 50
      const actualUp = actualOutcome === 'up'
      if (predictedUp === actualUp) {
        correctCount[fs.factorId] = (correctCount[fs.factorId] ?? 0) + 1
      }
    }
  }

  // 计算准确率
  const accuracies: Record<string, number> = {}
  for (const id of factorIds) {
    accuracies[id] = totalCount[id] > 0
      ? correctCount[id] / totalCount[id]
      : 0.5 // 无数据默认 50%
  }

  // 按准确率重分配
  const totalAccuracy = Object.values(accuracies).reduce((s, a) => s + a, 0)
  const rawNewWeights: Record<string, number> = {}
  for (const id of factorIds) {
    rawNewWeights[id] = totalAccuracy > 0
      ? accuracies[id] / totalAccuracy
      : 1 / factorIds.length
  }

  // 平滑合并新旧权重
  const alpha = config.learningRate
  const merged: Record<string, number> = {}
  for (const id of factorIds) {
    merged[id] = oldWeights[id] * (1 - alpha) + rawNewWeights[id] * alpha
  }

  // 边界裁剪 + 重新归一化
  const clamped: Record<string, number> = {}
  for (const id of factorIds) {
    clamped[id] = Math.max(config.weightMin, Math.min(config.weightMax, merged[id]))
  }

  // 归一化
  const clampedSum = Object.values(clamped).reduce((s, w) => s + w, 0)
  const normalized: Record<string, number> = {}
  for (const id of factorIds) {
    normalized[id] = clampedSum > 0
      ? parseFloat((clamped[id] / clampedSum).toFixed(4))
      : 1 / factorIds.length
  }

  return {
    newWeights: normalized,
    factorAccuracies: accuracies,
    sampleCount: signals.length,
  }
}
```

- [ ] **Step 3: Run learner tests**

```bash
npx vitest run tests/engine/learner.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/engine/etf/learner.ts tests/engine/learner.test.ts
git commit -m "feat: add ETF self-learning weight adjustment engine"
```

---

### Task 11: Web Worker for ETF analysis

**Files:**
- Create: `src/worker/etfAnalysis.worker.ts`
- Create: `src/hooks/useWorker.ts`

- [ ] **Step 1: Implement the ETF analysis worker**

```typescript
// src/worker/etfAnalysis.worker.ts
import type { KLine, Signal, ETFInfo, SignalThresholds, LearningConfig, LearningLog } from '../types'
import { scoreETF } from '../engine/etf/scorer'
import { adjustWeights } from '../engine/etf/learner'
import { fetchAllETFs } from '../data/etfFetcher'
import { getKLines, saveKLines, saveSignal, getSignals, getWeights, saveWeights, saveLearningLog } from '../data/db'
import { DEFAULT_ETF_WEIGHTS, DEFAULT_SIGNAL_THRESHOLDS, DEFAULT_LEARNING_CONFIG } from '../config/defaults'

// Worker 消息类型
type WorkerMessage =
  | { type: 'analyze'; etfs: ETFInfo[]; thresholds?: SignalThresholds }
  | { type: 'learn'; etfCode: string; config?: LearningConfig }
  | { type: 'fetchAndStore'; etfs: ETFInfo[] }

type WorkerResponse =
  | { type: 'analysisComplete'; signals: Signal[] }
  | { type: 'learnComplete'; log: LearningLog }
  | { type: 'fetchComplete'; count: number }
  | { type: 'error'; message: string }

// @ts-ignore — comlink-style message handler
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data

  try {
    switch (msg.type) {
      case 'analyze': {
        const { etfs, thresholds } = msg
        const signals: Signal[] = []

        for (const etf of etfs) {
          // 从 IndexedDB 读取 K 线
          let bars = await getKLines(etf.code)

          // 如果本地没有，尝试获取
          if (bars.length === 0) {
            // 这里不触网，等待主线程 fetchAndStore
            continue
          }

          // 读取当前权重
          let weights = await getWeights('etf')
          if (!weights) {
            weights = { ...DEFAULT_ETF_WEIGHTS }
            await saveWeights('etf', weights)
          }

          // 评分
          const result = scoreETF(bars, weights, thresholds ?? DEFAULT_SIGNAL_THRESHOLDS)

          const signal: Signal = {
            id: `etf-${etf.code}-${new Date().toISOString().slice(0, 10)}`,
            etfCode: etf.code,
            date: new Date().toISOString().slice(0, 10),
            compositeScore: result.compositeScore,
            signal: result.signal,
            factorScores: result.factorScores,
            weights: result.weights,
          }

          await saveSignal(signal)
          signals.push(signal)
        }

        const response: WorkerResponse = { type: 'analysisComplete', signals }
        // @ts-ignore
        self.postMessage(response)
        break
      }

      case 'learn': {
        const { etfCode, config } = msg
        const cfg = config ?? DEFAULT_LEARNING_CONFIG

        // 读取历史信号
        const signals = await getSignals({ etfCode, limit: cfg.lookbackWindow })
        const oldWeights = await getWeights('etf') ?? { ...DEFAULT_ETF_WEIGHTS }

        // 获取最新K线判断涨跌
        const bars = await getKLines(etfCode)
        if (bars.length < 2) {
          const response: WorkerResponse = { type: 'error', message: 'Not enough K-line data for learning' }
          // @ts-ignore
          self.postMessage(response)
          break
        }

        // 判断近期走势（最近5天 vs 前5天）
        const recent5 = bars.slice(-5)
        const prev5 = bars.slice(-10, -5)
        const recentAvg = recent5.reduce((s, b) => s + b.close, 0) / recent5.length
        const prevAvg = prev5.reduce((s, b) => s + b.close, 0) / prev5.length
        const actualOutcome = recentAvg > prevAvg ? 'up' : 'down'

        // 调整权重
        const result = adjustWeights(signals, actualOutcome, oldWeights, cfg)

        // 保存新权重
        await saveWeights('etf', result.newWeights)

        // 记录日志
        const log: LearningLog = {
          id: `learn-etf-${etfCode}-${new Date().toISOString().slice(0, 10)}`,
          date: new Date().toISOString().slice(0, 10),
          engine: 'etf',
          oldWeights: { ...oldWeights },
          newWeights: { ...result.newWeights },
          factorAccuracies: { ...result.factorAccuracies },
          sampleCount: result.sampleCount,
        }
        await saveLearningLog(log)

        const response: WorkerResponse = { type: 'learnComplete', log }
        // @ts-ignore
        self.postMessage(response)
        break
      }

      case 'fetchAndStore': {
        const { etfs } = msg
        const data = await fetchAllETFs(etfs)
        let count = 0
        for (const [code, bars] of data) {
          if (bars.length > 0) {
            await saveKLines(code, bars)
            count++
          }
        }
        const response: WorkerResponse = { type: 'fetchComplete', count }
        // @ts-ignore
        self.postMessage(response)
        break
      }
    }
  } catch (err) {
    const response: WorkerResponse = {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    }
    // @ts-ignore
    self.postMessage(response)
  }
}
```

- [ ] **Step 2: Create useWorker hook**

```typescript
// src/hooks/useWorker.ts
import { useRef, useCallback, useState } from 'react'
import type { ETFInfo, Signal, LearningLog } from '../types'

export function useETFWorker() {
  const workerRef = useRef<Worker | null>(null)
  const [loading, setLoading] = useState(false)

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../worker/etfAnalysis.worker.ts', import.meta.url),
        { type: 'module' }
      )
    }
    return workerRef.current
  }, [])

  const fetchAndStore = useCallback(
    (etfs: ETFInfo[]): Promise<number> => {
      return new Promise((resolve, reject) => {
        const worker = getWorker()
        setLoading(true)
        worker.onmessage = (e) => {
          setLoading(false)
          if (e.data.type === 'fetchComplete') resolve(e.data.count)
          else if (e.data.type === 'error') reject(new Error(e.data.message))
        }
        worker.onerror = (err) => {
          setLoading(false)
          reject(err)
        }
        worker.postMessage({ type: 'fetchAndStore', etfs })
      })
    },
    [getWorker]
  )

  const analyze = useCallback(
    (etfs: ETFInfo[]): Promise<Signal[]> => {
      return new Promise((resolve, reject) => {
        const worker = getWorker()
        setLoading(true)
        worker.onmessage = (e) => {
          setLoading(false)
          if (e.data.type === 'analysisComplete') resolve(e.data.signals)
          else if (e.data.type === 'error') reject(new Error(e.data.message))
        }
        worker.onerror = (err) => {
          setLoading(false)
          reject(err)
        }
        worker.postMessage({ type: 'analyze', etfs })
      })
    },
    [getWorker]
  )

  const learn = useCallback(
    (etfCode: string): Promise<LearningLog> => {
      return new Promise((resolve, reject) => {
        const worker = getWorker()
        setLoading(true)
        worker.onmessage = (e) => {
          setLoading(false)
          if (e.data.type === 'learnComplete') resolve(e.data.log)
          else if (e.data.type === 'error') reject(new Error(e.data.message))
        }
        worker.onerror = (err) => {
          setLoading(false)
          reject(err)
        }
        worker.postMessage({ type: 'learn', etfCode })
      })
    },
    [getWorker]
  )

  return { fetchAndStore, analyze, learn, loading }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/worker/etfAnalysis.worker.ts src/hooks/useWorker.ts
git commit -m "feat: add ETF analysis Web Worker and React hook"
```

---

### Task 12: Dashboard UI

**Files:**
- Create: `src/ui/Dashboard.tsx`, `src/ui/Dashboard.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the Dashboard component**

```typescript
// src/ui/Dashboard.tsx
import { useState, useEffect } from 'react'
import type { ETFInfo, Signal } from '../types'
import { DEFAULT_ETF_LIST } from '../config/defaults'
import { useETFWorker } from '../hooks/useWorker'
import { getETFList, saveETFList, getSignals } from '../data/db'
import './Dashboard.css'

export default function Dashboard() {
  const [etfs, setEtfs] = useState<ETFInfo[]>([])
  const [signals, setSignals] = useState<Map<string, Signal>>(new Map())
  const { fetchAndStore, analyze, loading } = useETFWorker()

  useEffect(() => {
    // 初始化 ETF 列表
    getETFList().then(list => {
      if (list.length === 0) {
        saveETFList(DEFAULT_ETF_LIST)
        setEtfs(DEFAULT_ETF_LIST)
      } else {
        setEtfs(list)
      }
    })

    // 加载已有信号
    getSignals({ limit: 50 }).then(existing => {
      const map = new Map<string, Signal>()
      for (const s of existing) {
        const existing = map.get(s.etfCode)
        if (!existing || s.date > existing.date) {
          map.set(s.etfCode, s)
        }
      }
      setSignals(map)
    })
  }, [])

  const handleRefresh = async () => {
    if (etfs.length === 0) return
    // 1. 获取最新K线数据
    await fetchAndStore(etfs)
    // 2. 跑分析
    const newSignals = await analyze(etfs)
    // 3. 更新UI
    const map = new Map(signals)
    for (const s of newSignals) {
      map.set(s.etfCode, s)
    }
    setSignals(new Map(map))
  }

  const signalEmoji = (s: string) => s === 'buy' ? '🟢' : s === 'sell' ? '🔴' : '🟡'
  const signalLabel = (s: string) => s === 'buy' ? '买入' : s === 'sell' ? '卖出' : '观望'
  const scoreColor = (s: string) =>
    s === 'buy' ? 'var(--green)' : s === 'sell' ? 'var(--red)' : 'var(--yellow)'

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>📊 看板</h2>
        <button
          className="refresh-btn"
          onClick={handleRefresh}
          disabled={loading}
        >
          {loading ? '更新中...' : '🔄 刷新'}
        </button>
      </div>

      {etfs.length === 0 && (
        <div className="empty-state">
          <p>暂无 ETF 关注列表</p>
          <p className="sub">请在设置中添加</p>
        </div>
      )}

      <div className="etf-list">
        {etfs.map(etf => {
          const sig = signals.get(etf.code)
          return (
            <div key={etf.code} className="etf-card">
              <div className="etf-info">
                <div className="etf-name">{etf.name}</div>
                <div className="etf-code">
                  {etf.code}.{etf.market}
                </div>
              </div>
              <div className="etf-signal">
                <span className="signal-emoji">
                  {sig ? signalEmoji(sig.signal) : '⚪'}
                </span>
                <div className="signal-label">
                  {sig ? signalLabel(sig.signal) : '待分析'}
                </div>
              </div>
              <div className="etf-score">
                {sig ? (
                  <span style={{ color: scoreColor(sig.signal), fontWeight: 700, fontSize: 22 }}>
                    {sig.compositeScore}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-secondary)' }}>--</span>
                )}
                <div className="score-label">综合评分</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

```css
/* src/ui/Dashboard.css */
.dashboard { padding-bottom: 20px; }

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.dashboard-header h2 {
  font-size: 20px;
  color: var(--text-primary);
}

.refresh-btn {
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.refresh-btn:disabled {
  opacity: 0.5;
}

.etf-list { display: flex; flex-direction: column; gap: 8px; }

.etf-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
}

.etf-name { font-size: 16px; font-weight: 600; color: var(--text-primary); }
.etf-code { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

.etf-signal { text-align: center; }
.signal-emoji { font-size: 24px; }
.signal-label { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }

.etf-score { text-align: right; }
.score-label { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }

.empty-state { text-align: center; padding: 40px 0; color: var(--text-secondary); }
.empty-state .sub { font-size: 13px; margin-top: 4px; }
```

- [ ] **Step 2: Wire Dashboard into App.tsx**

Update `src/App.tsx` — replace the placeholder div with the real Dashboard import:

```tsx
// src/App.tsx — update imports at top
import Dashboard from './ui/Dashboard'

// In the JSX, replace:
// {activeTab === 'dashboard' && <div>看板</div>}
// with:
// {activeTab === 'dashboard' && <Dashboard />}
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit && npx vite build
```

Expected: No TypeScript errors. Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/ui/Dashboard.tsx src/ui/Dashboard.css src/App.tsx
git commit -m "feat: add Dashboard UI with ETF signal display and refresh"
```

---

### Task 13: Setup Vitest config

**Files:**
- Modify: `vite.config.ts` (add test config)
- Create: `tests/setup.ts`

- [ ] **Step 1: Update vite.config.ts with vitest configuration**

Add to the existing `vite.config.ts`:

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
// ... existing imports ...

export default defineConfig({
  // ... existing plugins ...
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
})
```

- [ ] **Step 2: Create test setup file**

```typescript
// tests/setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Run all tests to verify full Phase 1**

```bash
npx vitest run
```

Expected: All tests PASS (~20+ tests across factors, engine, data modules).

- [ ] **Step 4: Final Phase 1 verification**

```bash
npx tsc --noEmit
npx vite build
```

Expected: TypeScript clean, production build succeeds with PWA service worker generated.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts tests/setup.ts
git commit -m "chore: configure vitest and verify Phase 1 MVP"
```

---

## Phase 2: ETF 完善（详情页 + 设置 + 因子仪表盘）

### Task 14: ETF Detail page

**Files:**
- Create: `src/ui/Detail.tsx`, `src/ui/Detail.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement Detail page with K-line chart and factor scores**

```typescript
// src/ui/Detail.tsx
import { useState, useEffect } from 'react'
import type { ETFInfo, KLine, Signal } from '../types'
import { DEFAULT_ETF_LIST } from '../config/defaults'
import { getETFList } from '../data/db'
import { getKLines, getSignals } from '../data/db'
import { useETFWorker } from '../hooks/useWorker'
import './Detail.css'

export default function Detail() {
  const [etfs, setEtfs] = useState<ETFInfo[]>(DEFAULT_ETF_LIST)
  const [selectedETF, setSelectedETF] = useState<ETFInfo>(etfs[0])
  const [bars, setBars] = useState<KLine[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const { analyze, loading } = useETFWorker()

  useEffect(() => {
    getETFList().then(list => {
      if (list.length > 0) {
        setEtfs(list)
        setSelectedETF(list[0])
      }
    })
  }, [])

  useEffect(() => {
    if (!selectedETF) return
    getKLines(selectedETF.code).then(setBars)
    getSignals({ etfCode: selectedETF.code, limit: 20 }).then(setSignals)
  }, [selectedETF])

  const handleAnalyze = async () => {
    if (!selectedETF) return
    const newSignals = await analyze([selectedETF])
    if (newSignals.length > 0) {
      setSignals(prev => [newSignals[0], ...prev].slice(0, 20))
    }
  }

  const latestSignal = signals[0]
  const signalEmoji = (s: string) => s === 'buy' ? '🟢' : s === 'sell' ? '🔴' : '🟡'

  return (
    <div className="detail">
      {/* ETF 选择器 */}
      <select
        className="etf-selector"
        value={selectedETF?.code ?? ''}
        onChange={e => {
          const etf = etfs.find(x => x.code === e.target.value)
          if (etf) setSelectedETF(etf)
        }}
      >
        {etfs.map(etf => (
          <option key={etf.code} value={etf.code}>
            {etf.name} ({etf.code})
          </option>
        ))}
      </select>

      {/* 最新信号 */}
      {latestSignal && (
        <div className={`signal-banner signal-${latestSignal.signal}`}>
          <span className="signal-emoji-large">{signalEmoji(latestSignal.signal)}</span>
          <div>
            <div className="signal-text">
              {latestSignal.signal === 'buy' ? '买入' : latestSignal.signal === 'sell' ? '卖出' : '观望'}
            </div>
            <div className="signal-date">{latestSignal.date}</div>
          </div>
          <div className="signal-score">{latestSignal.compositeScore}</div>
        </div>
      )}

      {/* 因子得分 */}
      {latestSignal && (
        <div className="factor-grid">
          {latestSignal.factorScores.map(fs => (
            <div key={fs.factorId} className="factor-item">
              <div className="factor-name">{fs.name}</div>
              <div
                className="factor-value"
                style={{
                  color: fs.score >= 70 ? 'var(--green)' : fs.score < 40 ? 'var(--red)' : 'var(--yellow)'
                }}
              >
                {fs.score}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 图表占位（Phase 4 集成 Lightweight Charts） */}
      <div className="chart-placeholder">
        <p>📈 K线图区域</p>
        <p className="sub">数据点数: {bars.length}</p>
      </div>

      {/* 历史信号 */}
      <h3 style={{ marginTop: 16, marginBottom: 8 }}>信号历史</h3>
      <div className="signal-history">
        {signals.slice(0, 10).map(sig => (
          <div key={sig.id} className="history-item">
            <span>{sig.date}</span>
            <span>{signalEmoji(sig.signal)}</span>
            <span style={{ color: sig.signal === 'buy' ? 'var(--green)' : sig.signal === 'sell' ? 'var(--red)' : 'var(--yellow)' }}>
              {sig.compositeScore}
            </span>
          </div>
        ))}
      </div>

      <button className="analyze-btn" onClick={handleAnalyze} disabled={loading}>
        {loading ? '分析中...' : '🔍 分析此ETF'}
      </button>
    </div>
  )
}
```

```css
/* src/ui/Detail.css */
.detail { padding-bottom: 20px; }

.etf-selector {
  width: 100%;
  padding: 10px;
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 12px;
}

.signal-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 10px;
  margin-bottom: 12px;
}
.signal-buy { background: #0d3320; border: 1px solid #1a4d30; }
.signal-hold { background: #332a0d; border: 1px solid #4d401a; }
.signal-sell { background: #330d0d; border: 1px solid #4d1a1a; }

.signal-emoji-large { font-size: 36px; }
.signal-text { font-size: 18px; font-weight: 700; }
.signal-date { font-size: 12px; color: var(--text-secondary); }
.signal-score { font-size: 28px; font-weight: 700; margin-left: auto; }

.factor-grid { display: flex; gap: 8px; margin-bottom: 12px; }
.factor-item {
  flex: 1;
  text-align: center;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px;
}
.factor-name { font-size: 11px; color: var(--text-secondary); }
.factor-value { font-size: 20px; font-weight: 700; }

.chart-placeholder {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  color: var(--text-secondary);
}
.chart-placeholder .sub { font-size: 12px; margin-top: 4px; }

.signal-history { display: flex; flex-direction: column; gap: 4px; }
.history-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-card);
  border-radius: 6px;
  font-size: 13px;
}

.analyze-btn {
  width: 100%;
  margin-top: 16px;
  padding: 12px;
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
}
.analyze-btn:disabled { opacity: 0.5; }
```

- [ ] **Step 2: Wire into App.tsx**

```tsx
// Add import
import Detail from './ui/Detail'

// Replace placeholder:
// {activeTab === 'detail' && <div>详情</div>}
// with:
// {activeTab === 'detail' && <Detail />}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/Detail.tsx src/ui/Detail.css src/App.tsx
git commit -m "feat: add ETF Detail page with factor scores and signal history"
```

---

### Task 15: Settings page

**Files:**
- Create: `src/ui/Settings.tsx`, `src/ui/Settings.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement Settings with configurable parameters**

```typescript
// src/ui/Settings.tsx
import { useState, useEffect } from 'react'
import { saveSetting, getSetting, exportAllData, importAllData, getETFList, saveETFList } from '../data/db'
import { DEFAULT_SIGNAL_THRESHOLDS, DEFAULT_LEARNING_CONFIG, DEFAULT_ETF_LIST } from '../config/defaults'
import type { ETFInfo } from '../types'
import './Settings.css'

export default function Settings() {
  const [buyThreshold, setBuyThreshold] = useState(DEFAULT_SIGNAL_THRESHOLDS.buyThreshold)
  const [sellThreshold, setSellThreshold] = useState(DEFAULT_SIGNAL_THRESHOLDS.sellThreshold)
  const [learningRate, setLearningRate] = useState(DEFAULT_LEARNING_CONFIG.learningRate)
  const [lookbackWindow, setLookbackWindow] = useState(DEFAULT_LEARNING_CONFIG.lookbackWindow)
  const [etfs, setEtfs] = useState<ETFInfo[]>([])
  const [newETFCode, setNewETFCode] = useState('')
  const [newETFName, setNewETFName] = useState('')
  const [newETFMarket, setNewETFMarket] = useState<'SH' | 'SZ'>('SH')
  const [message, setMessage] = useState('')

  useEffect(() => {
    getETFList().then(list => setEtfs(list.length > 0 ? list : DEFAULT_ETF_LIST))
    getSetting<number>('buyThreshold').then(v => { if (v) setBuyThreshold(v) })
    getSetting<number>('sellThreshold').then(v => { if (v) setSellThreshold(v) })
    getSetting<number>('learningRate').then(v => { if (v) setLearningRate(v) })
    getSetting<number>('lookbackWindow').then(v => { if (v) setLookbackWindow(v) })
  }, [])

  const showMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 2000)
  }

  const handleSave = async () => {
    await saveSetting('buyThreshold', buyThreshold)
    await saveSetting('sellThreshold', sellThreshold)
    await saveSetting('learningRate', learningRate)
    await saveSetting('lookbackWindow', lookbackWindow)
    showMessage('✅ 设置已保存')
  }

  const handleAddETF = async () => {
    if (!newETFCode || !newETFName) return
    const newETF: ETFInfo = { code: newETFCode, name: newETFName, market: newETFMarket }
    // 去重
    if (etfs.some(e => e.code === newETF.code)) {
      showMessage('⚠️ 该ETF已在列表中')
      return
    }
    const updated = [...etfs, newETF]
    await saveETFList(updated)
    setEtfs(updated)
    setNewETFCode('')
    setNewETFName('')
    showMessage('✅ 已添加')
  }

  const handleRemoveETF = async (code: string) => {
    const updated = etfs.filter(e => e.code !== code)
    await saveETFList(updated)
    setEtfs(updated)
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
    showMessage('✅ 数据已导出')
  }

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      const data = JSON.parse(text)
      await importAllData(data)
      // Refresh ETF list
      getETFList().then(list => setEtfs(list))
      showMessage('✅ 数据已导入')
    }
    input.click()
  }

  return (
    <div className="settings">
      <h2>⚙️ 设置</h2>

      {message && <div className="settings-message">{message}</div>}

      {/* 信号阈值 */}
      <section className="settings-section">
        <h3>信号阈值</h3>
        <div className="setting-row">
          <label>买入阈值 (≥此分数显示买入)</label>
          <input type="range" min={60} max={95} value={buyThreshold} onChange={e => setBuyThreshold(Number(e.target.value))} />
          <span className="setting-value">{buyThreshold}</span>
        </div>
        <div className="setting-row">
          <label>卖出阈值 (&lt;此分数显示卖出)</label>
          <input type="range" min={10} max={50} value={sellThreshold} onChange={e => setSellThreshold(Number(e.target.value))} />
          <span className="setting-value">{sellThreshold}</span>
        </div>
      </section>

      {/* 自学习参数 */}
      <section className="settings-section">
        <h3>自学习参数</h3>
        <div className="setting-row">
          <label>学习率 (0-1，越大权重变化越快)</label>
          <input type="range" min={0.1} max={1.0} step={0.1} value={learningRate} onChange={e => setLearningRate(Number(e.target.value))} />
          <span className="setting-value">{learningRate}</span>
        </div>
        <div className="setting-row">
          <label>回看窗口 (参与评估的信号数量)</label>
          <input type="range" min={5} max={50} value={lookbackWindow} onChange={e => setLookbackWindow(Number(e.target.value))} />
          <span className="setting-value">{lookbackWindow}</span>
        </div>
      </section>

      <button className="save-btn" onClick={handleSave}>💾 保存设置</button>

      {/* ETF 关注列表管理 */}
      <section className="settings-section">
        <h3>ETF 关注列表</h3>
        <div className="add-etf-form">
          <input placeholder="代码 (如510300)" value={newETFCode} onChange={e => setNewETFCode(e.target.value)} />
          <input placeholder="名称" value={newETFName} onChange={e => setNewETFName(e.target.value)} />
          <select value={newETFMarket} onChange={e => setNewETFMarket(e.target.value as 'SH' | 'SZ')}>
            <option value="SH">上海</option>
            <option value="SZ">深圳</option>
          </select>
          <button onClick={handleAddETF}>添加</button>
        </div>
        <div className="etf-manage-list">
          {etfs.map(etf => (
            <div key={etf.code} className="etf-manage-item">
              <span>{etf.name}</span>
              <span className="code">{etf.code}.{etf.market}</span>
              <button className="remove-btn" onClick={() => handleRemoveETF(etf.code)}>✕</button>
            </div>
          ))}
        </div>
      </section>

      {/* 数据备份 */}
      <section className="settings-section">
        <h3>数据管理</h3>
        <div className="backup-buttons">
          <button onClick={handleExport}>📤 导出备份</button>
          <button onClick={handleImport}>📥 导入恢复</button>
        </div>
      </section>
    </div>
  )
}
```

```css
/* src/ui/Settings.css */
.settings { padding-bottom: 20px; }
.settings h2 { font-size: 20px; margin-bottom: 16px; }

.settings-message {
  background: #0d3320;
  color: var(--green);
  padding: 10px;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 14px;
}

.settings-section {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 12px;
}
.settings-section h3 {
  font-size: 15px;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.setting-row label { flex: 1; font-size: 13px; color: var(--text-secondary); }
.setting-row input[type="range"] { flex: 1; }
.setting-value {
  min-width: 30px;
  text-align: right;
  font-weight: 700;
  color: var(--text-primary);
}

.save-btn {
  width: 100%;
  padding: 12px;
  background: #1a3a1a;
  color: var(--green);
  border: 1px solid #1a4d30;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
  margin-bottom: 12px;
}

.add-etf-form {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.add-etf-form input, .add-etf-form select {
  flex: 1;
  padding: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 12px;
}
.add-etf-form button {
  padding: 8px 12px;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
}

.etf-manage-list { display: flex; flex-direction: column; gap: 4px; }
.etf-manage-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--bg-primary);
  border-radius: 6px;
  font-size: 13px;
}
.etf-manage-item .code { color: var(--text-secondary); font-size: 11px; flex: 1; }
.remove-btn {
  background: none;
  border: none;
  color: var(--red);
  cursor: pointer;
  font-size: 14px;
}

.backup-buttons { display: flex; gap: 10px; }
.backup-buttons button {
  flex: 1;
  padding: 10px;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
```

- [ ] **Step 2: Wire into App.tsx**

```tsx
// Add import
import Settings from './ui/Settings'

// Replace placeholder:
// {activeTab === 'settings' && <div>设置</div>}
// with:
// {activeTab === 'settings' && <Settings />}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/Settings.tsx src/ui/Settings.css src/App.tsx
git commit -m "feat: add Settings page with thresholds, ETF management, and backup"
```

---

### Task 16: Factor dashboard (weights visualization)

**Files:**
- Create: `src/ui/Factors.tsx`, `src/ui/Factors.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement Factors page**

```typescript
// src/ui/Factors.tsx
import { useState, useEffect } from 'react'
import type { LearningLog } from '../types'
import { getWeights, getLearningLogs } from '../data/db'
import { DEFAULT_ETF_WEIGHTS } from '../config/defaults'
import './Factors.css'

export default function Factors() {
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT_ETF_WEIGHTS)
  const [logs, setLogs] = useState<LearningLog[]>([])

  useEffect(() => {
    getWeights('etf').then(w => { if (w) setWeights(w) })
    getLearningLogs('etf', 20).then(setLogs)
  }, [])

  const factorNames: Record<string, string> = {
    trend: '趋势',
    momentum: '动量',
    volatility: '波动率',
    moneyFlow: '资金流',
  }

  return (
    <div className="factors">
      <h2>🧠 因子仪表盘</h2>

      {/* 当前权重条 */}
      <section className="factors-section">
        <h3>当前权重分配</h3>
        <div className="weight-bars">
          {Object.entries(weights).map(([id, w]) => (
            <div key={id} className="weight-bar-row">
              <span className="weight-label">{factorNames[id] ?? id}</span>
              <div className="weight-bar-track">
                <div
                  className="weight-bar-fill"
                  style={{ width: `${w * 100}%` }}
                />
              </div>
              <span className="weight-pct">{(w * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </section>

      {/* 调整日志 */}
      <section className="factors-section">
        <h3>权重调整日志</h3>
        {logs.length === 0 && (
          <p className="empty-log">暂无调整记录，积累足够信号后系统会自动学习</p>
        )}
        <div className="log-list">
          {logs.map(log => (
            <div key={log.id} className="log-item">
              <div className="log-date">{log.date}</div>
              <div className="log-changes">
                {Object.entries(log.newWeights).map(([id, newW]) => {
                  const oldW = log.oldWeights[id] ?? newW
                  const diff = newW - oldW
                  const arrow = diff > 0.01 ? '↑' : diff < -0.01 ? '↓' : '→'
                  const color = diff > 0.01 ? 'var(--green)' : diff < -0.01 ? 'var(--red)' : 'var(--text-secondary)'
                  return (
                    <div key={id} className="log-change" style={{ color }}>
                      {factorNames[id] ?? id}: {(oldW * 100).toFixed(0)}% → {(newW * 100).toFixed(0)}% {arrow}
                    </div>
                  )
                })}
              </div>
              <div className="log-meta">
                基于 {log.sampleCount} 条信号
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
```

```css
/* src/ui/Factors.css */
.factors { padding-bottom: 20px; }
.factors h2 { font-size: 20px; margin-bottom: 16px; }

.factors-section {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 12px;
}
.factors-section h3 { font-size: 15px; margin-bottom: 12px; }

.weight-bars { display: flex; flex-direction: column; gap: 10px; }
.weight-bar-row { display: flex; align-items: center; gap: 10px; }
.weight-label { width: 50px; font-size: 13px; color: var(--text-secondary); }
.weight-bar-track {
  flex: 1;
  height: 16px;
  background: var(--bg-primary);
  border-radius: 8px;
  overflow: hidden;
}
.weight-bar-fill {
  height: 100%;
  background: #58a6ff;
  border-radius: 8px;
  transition: width 0.3s ease;
}
.weight-pct { width: 40px; text-align: right; font-weight: 700; font-size: 13px; }

.empty-log { color: var(--text-secondary); font-size: 13px; padding: 10px 0; }

.log-list { display: flex; flex-direction: column; gap: 8px; }
.log-item { padding: 10px; background: var(--bg-primary); border-radius: 6px; }
.log-date { font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
.log-changes { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; }
.log-meta { font-size: 11px; color: var(--text-secondary); margin-top: 6px; }
```

- [ ] **Step 2: Wire into App.tsx**

```tsx
// Add import
import Factors from './ui/Factors'

// Replace placeholder:
// {activeTab === 'factors' && <div>因子</div>}
// with:
// {activeTab === 'factors' && <Factors />}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/Factors.tsx src/ui/Factors.css src/App.tsx
git commit -m "feat: add Factor dashboard with weight bars and learning log"
```

---

## Phase 3: 场外基金

### Task 17: Mutual fund types and fetcher

**Files:**
- Modify: `src/types/index.ts` (add mutual fund types)
- Create: `src/data/fundFetcher.ts`

- [ ] **Step 1: Extend types for mutual funds**

Add to `src/types/index.ts`:

```typescript
/** 场外基金基本信息 */
export interface FundInfo {
  code: string          // '110020'
  name: string          // '易方达沪深300ETF联接A'
  type: string           // '股票指数' | '混合' | '债券' | ...
  inPortfolio: boolean   // 是否已持有
  holdAmount?: number    // 持有金额
  holdDate?: string      // 买入日期
}

/** 场外基金净值数据 */
export interface FundNAV {
  date: string
  nav: number            // 单位净值
  accumulatedNav: number // 累计净值
  dailyReturn: number    // 日收益率
}

/** 场外基金选基信号 */
export interface FundScreeningSignal {
  id: string
  fundCode: string
  date: string
  compositeScore: number
  signal: 'buy' | 'hold' | 'sell'
  factorScores: FactorScore[]
  weights: Record<string, number>
}

/** 场外基金诊断信号 */
export interface FundDiagnosisSignal {
  id: string
  fundCode: string
  date: string
  healthScore: number
  signal: 'buy' | 'hold' | 'sell'  // buy=继续持有, hold=减仓观察, sell=建议换基
  dimensionScores: FactorScore[]
  alerts: string[]         // 预警信息列表
}
```

- [ ] **Step 2: Implement mutual fund data fetcher**

```typescript
// src/data/fundFetcher.ts
import type { FundInfo, FundNAV } from '../types'

/** 天天基金净值API（公开） */
function buildFundNAVUrl(fundCode: string, pageSize = 365): string {
  return `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${fundCode}&pageIndex=1&pageSize=${pageSize}`
}

/** 解析天天基金净值数据 */
function parseFundNAV(raw: unknown): FundNAV[] {
  const data = raw as {
    Data?: {
      LSJZList?: Array<{
        FSRQ: string    // 净值日期
        DWJZ: string    // 单位净值
        LJJZ: string    // 累计净值
        JZZZL: string   // 日增长率
      }>
    }
  }
  if (!data?.Data?.LSJZList) return []

  return data.Data.LSJZList.map(item => ({
    date: item.FSRQ,
    nav: parseFloat(item.DWJZ),
    accumulatedNav: parseFloat(item.LJJZ),
    dailyReturn: parseFloat(item.JZZZL) / 100,
  })).sort((a, b) => a.date.localeCompare(b.date))
}

export async function fetchFundNAV(fundCode: string): Promise<FundNAV[]> {
  const url = buildFundNAVUrl(fundCode)
  const response = await fetch(url, {
    headers: { 'Referer': 'https://fund.eastmoney.com/' }
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch fund NAV for ${fundCode}: ${response.status}`)
  }
  const raw = await response.json()
  return parseFundNAV(raw)
}

/** 基金搜索（天天基金） */
export async function searchFunds(keyword: string): Promise<FundInfo[]> {
  const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(keyword)}`
  const response = await fetch(url)
  if (!response.ok) return []
  const raw = await response.json()
  const datas = raw?.Datas ?? []
  return datas.map((d: { CODE: string; NAME: string; FundType: string }) => ({
    code: d.CODE,
    name: d.NAME,
    type: d.FundType,
    inPortfolio: false,
  }))
}
```

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/data/fundFetcher.ts
git commit -m "feat: add mutual fund types and data fetcher"
```

---

## Phase 4: 打磨

*Phase 4 tasks are outlined for completeness. Full implementation details will be added when Phase 3 completes.*

### Task 18: FundPicker page
### Task 19: Backtest module
### Task 20: K-line chart integration (Lightweight Charts)
### Task 21: Performance optimization and offline polish

---

## Self-Review

**1. Spec coverage:**
- ✅ Architecture (Task 1)
- ✅ Types (Task 2)
- ✅ Configuration (Task 3)
- ✅ Data cleaning (Task 4)
- ✅ IndexedDB (Task 5)
- ✅ ETF data fetching (Task 6)
- ✅ ETF 4 factors (Tasks 7-8)
- ✅ Scoring engine (Task 9)
- ✅ Self-learning (Task 10)
- ✅ Web Worker (Task 11)
- ✅ Dashboard UI (Task 12)
- ✅ Detail page (Task 14)
- ✅ Settings page (Task 15)
- ✅ Factor dashboard (Task 16)
- ✅ Signal thresholds ≥80 (Task 15 Settings, defaults in Task 3)
- ✅ Fund types/fetcher (Task 17)
- ⬜ FundPicker/Diagnosis (Task 18 — outlined)
- ⬜ Backtest (Task 19 — outlined)
- ⬜ Charts (Task 20 — outlined)

**2. Placeholder scan:** No TODOs, TBDs, or "implement later" in completed tasks. Phase 4 tasks are explicitly marked as outlines.

**3. Type consistency:**
- `Signal`, `FactorScore`, `KLine`, `ETFInfo` used consistently across all tasks
- `LearningLog`, `LearningConfig` match between learner.ts and db.ts
- Worker message types match the hook interface
- Component props align with data types
