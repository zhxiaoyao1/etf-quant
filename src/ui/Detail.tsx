import { useState, useEffect, useRef, useCallback } from 'react'
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts'
import type { ETFInfo, KLine, Signal } from '../types'
import { DEFAULT_ETF_LIST } from '../config/defaults'
import { getETFList, getKLines, getSignals } from '../data/db'
import { useETFWorker } from '../hooks/useWorker'
import { computeRegime } from '../engine/etf/trendSignal'
import { runBacktest } from '../engine/etf/backtest'
import { signalEmoji, signalLabel, signalColor } from './signalHelpers'
import './Detail.css'

function calcBollinger(
  data: { time: string; value: number }[],
  period: number,
  stdDev: number
): {
  upper: { time: string; value: number }[]
  middle: { time: string; value: number }[]
  lower: { time: string; value: number }[]
} {
  const middle: { time: string; value: number }[] = []
  const upper: { time: string; value: number }[] = []
  const lower: { time: string; value: number }[] = []
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += data[j].value
    const mean = sum / period
    let variance = 0
    for (let j = i - period + 1; j <= i; j++) variance += (data[j].value - mean) ** 2
    const std = Math.sqrt(variance / period)
    const t = data[i].time
    middle.push({ time: t, value: mean })
    upper.push({ time: t, value: mean + stdDev * std })
    lower.push({ time: t, value: mean - stdDev * std })
  }
  return { upper, middle, lower }
}

/** 布林带宽（%）：(上轨-下轨)/中轨×100，衡量波动扩张/收窄 */
function calcBandWidth(bars: KLine[], period = 20, stdDev = 2): { time: string; value: number }[] {
  const width: { time: string; value: number }[] = []
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1)
    const closes = slice.map(b => b.close)
    const mean = closes.reduce((s, v) => s + v, 0) / period
    if (mean <= 0) continue
    const variance = closes.reduce((s, v) => s + (v - mean) ** 2, 0) / period
    const std = Math.sqrt(variance)
    const upper = mean + stdDev * std
    const lower = mean - stdDev * std
    width.push({ time: bars[i].date, value: ((upper - lower) / mean) * 100 })
  }
  return width
}

export default function Detail({ initialEtf }: { initialEtf?: ETFInfo | null }) {
  const [etfs, setEtfs] = useState<ETFInfo[]>(DEFAULT_ETF_LIST)
  const [selectedETF, setSelectedETF] = useState<ETFInfo>(initialEtf ?? etfs[0])
  const [bars, setBars] = useState<KLine[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const { refresh, loading } = useETFWorker()
  const [backtestResult, setBacktestResult] = useState<any>(null)
  const [backtesting, setBacktesting] = useState(false)
  const [btError, setBtError] = useState('')

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null)
  const candleSeriesRef = useRef<any>(null)
  const bandContainerRef = useRef<HTMLDivElement>(null)
  const bandChartRef = useRef<ReturnType<typeof createChart> | null>(null)

  useEffect(() => {
    getETFList().then(list => {
      if (list.length > 0) {
        setEtfs(list)
        if (!initialEtf) setSelectedETF(list[0])
      }
    })
  }, [initialEtf])

  // 看板点击卡片 → 切换到对应 ETF
  useEffect(() => {
    if (initialEtf) setSelectedETF(initialEtf)
  }, [initialEtf?.code])

  useEffect(() => {
    if (!selectedETF) return
    setBars([])
    setSignals([])
    setBacktestResult(null)
    getKLines(selectedETF.code).then(setBars)
    getSignals({ etfCode: selectedETF.code, limit: 20 }).then(setSignals)
  }, [selectedETF])

  const renderChart = useCallback(() => {
    const container = chartContainerRef.current
    if (!container || bars.length === 0) return

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const chart = createChart(container, {
      layout: {
        background: { color: '#0d1117' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { color: '#21262d' },
        horzLines: { color: '#21262d' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        borderColor: '#30363d',
        timeVisible: false,
        secondsVisible: false,
        rightOffset: 0,
        fixLeftEdge: true,
        fixRightEdge: true,
        lockVisibleTimeRangeOnResize: true,
      },
      rightPriceScale: {
        borderColor: '#30363d',
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      leftPriceScale: {
        visible: false,
      },
      handleScroll: { vertTouchDrag: false },
      width: container.clientWidth,
      height: 280,
    })

    // Candlestick series
    const candleData = bars.map(bar => ({
      time: bar.date,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }))

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a641',
      downColor: '#ef4147',
      borderUpColor: '#26a641',
      borderDownColor: '#ef4147',
      wickUpColor: '#26a641',
      wickDownColor: '#ef4147',
    })
    candleSeries.setData(candleData)
    candleSeriesRef.current = candleSeries

    // Build close-price series for MA calculation
    const closeSeries = bars.map(bar => ({
      time: bar.date,
      value: bar.close,
    }))

    // BOLL(20,2) 布林带：中轨（实线）+ 上/下轨（虚线）
    if (bars.length >= 20) {
      const { upper, middle, lower } = calcBollinger(closeSeries, 20, 2)
      const midSeries = chart.addLineSeries({ color: '#58a6ff', lineWidth: 1 })
      midSeries.setData(middle)
      const upperSeries = chart.addLineSeries({ color: '#bc8cff', lineWidth: 1, lineStyle: LineStyle.Dashed })
      upperSeries.setData(upper)
      const lowerSeries = chart.addLineSeries({ color: '#bc8cff', lineWidth: 1, lineStyle: LineStyle.Dashed })
      lowerSeries.setData(lower)
    }

    chart.timeScale().fitContent()

    // ResizeObserver
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        chart.applyOptions({ width, height })
      }
    })
    resizeObserver.observe(container)

    chartRef.current = chart

    return () => {
      resizeObserver.disconnect()
    }
  }, [bars])

  useEffect(() => {
    const cleanup = renderChart()
    return () => {
      cleanup?.()
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [renderChart])

  // 布林带宽指示器：独立展示带宽收窄/扩张（不参与策略）
  useEffect(() => {
    const container = bandContainerRef.current
    if (!container || bars.length < 20) return
    if (bandChartRef.current) {
      bandChartRef.current.remove()
      bandChartRef.current = null
    }
    const widthData = calcBandWidth(bars)
    if (widthData.length === 0) return

    const chart = createChart(container, {
      layout: { background: { color: '#0d1117' }, textColor: '#8b949e' },
      grid: { vertLines: { color: '#21262d' }, horzLines: { color: '#21262d' } },
      timeScale: {
        borderColor: '#30363d', timeVisible: false, secondsVisible: false,
        rightOffset: 0, fixLeftEdge: true, fixRightEdge: true, lockVisibleTimeRangeOnResize: true,
      },
      rightPriceScale: { borderColor: '#30363d', scaleMargins: { top: 0.15, bottom: 0.15 } },
      leftPriceScale: { visible: false },
      handleScroll: { vertTouchDrag: false },
      width: container.clientWidth,
      height: 70,
    })

    const wSeries = chart.addLineSeries({ color: '#58a6ff', lineWidth: 1 })
    wSeries.setData(widthData)

    // 20日平均带宽（虚线参考线）
    if (widthData.length >= 20) {
      const avgData = widthData.slice(19).map((p, idx) => {
        const win = widthData.slice(idx, idx + 20)
        return { time: p.time, value: win.reduce((s, w) => s + w.value, 0) / win.length }
      })
      const avgSeries = chart.addLineSeries({ color: '#bc8cff', lineWidth: 1, lineStyle: LineStyle.Dashed })
      avgSeries.setData(avgData)
    }

    chart.timeScale().fitContent()
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    resizeObserver.observe(container)
    bandChartRef.current = chart

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      if (bandChartRef.current === chart) bandChartRef.current = null
    }
  }, [bars])

  // 回测结果 → K线图上标注买卖点
  useEffect(() => {
    const series = candleSeriesRef.current
    if (!series || !backtestResult || backtestResult.trades.length === 0) return

    const markers: any[] = []
    for (const trade of backtestResult.trades) {
      markers.push({
        time: trade.buyDate,
        position: 'belowBar',
        color: '#3fb950',
        shape: 'arrowUp',
        text: '买',
        size: 2,
      })
      if (trade.sellDate) {
        markers.push({
          time: trade.sellDate,
          position: 'aboveBar',
          color: '#f85149',
          shape: 'arrowDown',
          text: '卖',
          size: 2,
        })
      }
    }
    series.setMarkers(markers)
  }, [backtestResult])

  // 确保数据足够，不够就自动拉取
  const ensureData = async (): Promise<boolean> => {
    if (!selectedETF) return false
    if (bars.length >= 40) return true
    setBtError('K线数据不足，正在自动拉取...')
    try {
      await refresh([selectedETF])
      const fresh = await getKLines(selectedETF.code)
      setBars(fresh)
      if (fresh.length < 40) {
        setBtError(`数据不足：仅${fresh.length}天K线（需≥40天）。请先点上方「刷新」按钮拉取数据。`)
        return false
      }
      setBtError('')
      return true
    } catch {
      setBtError('数据拉取失败，请检查网络后重试')
      return false
    }
  }

  const handleAnalyze = async () => {
    if (!selectedETF) return
    const newSignals = await refresh([selectedETF])
    if (newSignals.length > 0) {
      setSignals(prev => [newSignals[0], ...prev].slice(0, 20))
    }
  }

  const handleBacktest = async () => {
    if (!selectedETF) return
    setBtError('')
    setBacktesting(true)
    const ok = await ensureData()
    if (!ok) { setBacktesting(false); return }
    try {
      // 主线程直接算（runBacktest 很轻量，无需 Worker，省去 Worker 创建延迟）
      const fresh = await getKLines(selectedETF.code)
      const result = runBacktest(fresh)
      setBacktestResult(result)
      setTimeout(() => {
        document.querySelector('.backtest-results')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (err: any) {
      setBtError(err?.message || '回测失败，请重试')
    } finally {
      setBacktesting(false)
    }
  }

  const latestSignal = signals[0]

  // 市场状态（效率比率）：近20日趋势/震荡
  const regime = bars.length >= 21 ? computeRegime(bars) : null

  // 当前带宽状态：当前带宽 vs 近20日均值 → 扩张/收窄
  const widthData = calcBandWidth(bars)
  const curWidth = widthData.length > 0 ? widthData[widthData.length - 1].value : null
  const avgWidth = widthData.length >= 20
    ? widthData.slice(-20).reduce((s, w) => s + w.value, 0) / 20
    : curWidth
  const bandExpanding = curWidth != null && avgWidth != null && curWidth > avgWidth

  return (
    <div className="detail">
      <select className="etf-selector" value={selectedETF?.code ?? ''} onChange={e => {
        const etf = etfs.find(x => x.code === e.target.value)
        if (etf) setSelectedETF(etf)
      }}>
        {etfs.map(etf => (
          <option key={etf.code} value={etf.code}>{etf.name} ({etf.code})</option>
        ))}
      </select>

      {latestSignal && (
        <div className={`signal-banner signal-${latestSignal.signal}`}>
          <span className="signal-emoji-large">{signalEmoji(latestSignal.signal)}</span>
          <div>
            <div className="signal-text">{signalLabel(latestSignal.signal)}</div>
            <div className="signal-date">{latestSignal.date}</div>
          </div>
          <div className="signal-score-det">{latestSignal.score}</div>
        </div>
      )}

      {regime && (
        <div className="regime-tag">
          <span className="regime-label">市场状态：</span>
          <span className="regime-value" style={{ color: regime.regime === 'trend' ? 'var(--green)' : regime.regime === 'range' ? 'var(--yellow)' : 'var(--text-secondary)' }}>
            {regime.regime === 'trend' ? '📈 趋势市' : regime.regime === 'range' ? '🌀 震荡市' : '中性'}
          </span>
          <span className="regime-er">ER {regime.er.toFixed(2)}</span>
        </div>
      )}

      {bars.length > 0 ? (
        <>
          <div ref={chartContainerRef} className="chart-container" />
          <div className="ma-legend">
            <span className="ma-legend-item"><span className="ma-dot" style={{background:'#58a6ff'}} /> 中轨(20)</span>
            <span className="ma-legend-item"><span className="ma-dot" style={{background:'#bc8cff'}} /> 上/下轨</span>
            {backtestResult && backtestResult.totalTrades > 0 && (
              <>
                <span className="ma-legend-item"><span className="ma-dot" style={{background:'var(--green)'}} /> 买点</span>
                <span className="ma-legend-item"><span className="ma-dot" style={{background:'var(--red)'}} /> 卖点</span>
              </>
            )}
          </div>
          {bars.length >= 20 && (
            <>
              <div ref={bandContainerRef} className="band-chart-container" />
              <div className="ma-legend">
                <span className="band-state" style={{ color: bandExpanding ? 'var(--green)' : 'var(--yellow)', fontWeight: 700 }}>
                  带宽 {curWidth != null ? curWidth.toFixed(2) : '--'}% {bandExpanding ? '↑扩张' : '↓收窄'}
                </span>
                <span className="ma-legend-item"><span className="ma-dot" style={{background:'#58a6ff'}} /> 带宽</span>
                <span className="ma-legend-item"><span className="ma-dot" style={{background:'#bc8cff'}} /> 20日均值</span>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="chart-placeholder">
          <p>{'\u{1F4C8}'} K线图区域</p>
          <p className="sub">数据点数: {bars.length}</p>
        </div>
      )}

      <h3 className="section-title">信号历史</h3>
      <div className="signal-history">
        {signals.slice(0, 10).map(sig => (
          <div key={sig.id} className="history-item">
            <span>{sig.date}</span>
            <span>{signalEmoji(sig.signal)}</span>
            <span style={{ color: signalColor(sig.signal) }}>{sig.score}</span>
          </div>
        ))}
        {signals.length === 0 && <div className="history-item"><span style={{color: 'var(--text-secondary)'}}>暂无信号记录</span></div>}
      </div>

      {backtestResult && backtestResult.equityCurve.length > 0 && (
        <div className="backtest-results">
          <h3 className="section-title-sm">📊 回测结果 - {selectedETF?.name}</h3>
          <div className="backtest-period">
            {selectedETF?.code}.{selectedETF?.market} · 回测区间：{backtestResult.equityCurve[0].date} ~ {backtestResult.equityCurve[backtestResult.equityCurve.length - 1].date}
            · 共 {backtestResult.equityCurve.length} 个交易日
          </div>
          <div className="backtest-params">
            收盘价&gt;MA20买入 · &lt;MA20卖出
          </div>
          <div className="backtest-metrics">
            <div className="backtest-metric">
              <div className="metric-label">总收益率</div>
              <div className="metric-value" style={{ color: backtestResult.totalReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {(backtestResult.totalReturn * 100).toFixed(2)}%
              </div>
            </div>
            <div className="backtest-metric">
              <div className="metric-label">年化收益</div>
              <div className="metric-value" style={{ color: backtestResult.annualizedReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {(backtestResult.annualizedReturn * 100).toFixed(2)}%
              </div>
            </div>
            <div className="backtest-metric">
              <div className="metric-label">最大回撤</div>
              <div className="metric-value" style={{ color: 'var(--red)' }}>
                {(backtestResult.maxDrawdown * 100).toFixed(2)}%
              </div>
            </div>
            <div className="backtest-metric">
              <div className="metric-label">夏普比率</div>
              <div className="metric-value" style={{ color: backtestResult.sharpeRatio >= 1 ? 'var(--green)' : backtestResult.sharpeRatio >= 0 ? 'var(--yellow)' : 'var(--red)' }}>
                {backtestResult.sharpeRatio.toFixed(2)}
              </div>
            </div>
            <div className="backtest-metric">
              <div className="metric-label">胜率</div>
              <div className="metric-value" style={{ color: backtestResult.winRate >= 0.5 ? 'var(--green)' : 'var(--red)' }}>
                {(backtestResult.winRate * 100).toFixed(1)}%
              </div>
            </div>
            <div className="backtest-metric">
              <div className="metric-label">交易次数</div>
              <div className="metric-value">{backtestResult.totalTrades}</div>
            </div>
          </div>
          <div className="backtest-comparison">
            <div className="comparison-row">
              <span>策略收益</span>
              <span style={{ color: backtestResult.totalReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {(backtestResult.totalReturn * 100).toFixed(2)}%
              </span>
            </div>
            <div className="comparison-row">
              <span>买入持有</span>
              <span style={{ color: backtestResult.buyAndHoldReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {(backtestResult.buyAndHoldReturn * 100).toFixed(2)}%
              </span>
            </div>
          </div>

        </div>
      )}

      <button className="analyze-btn" onClick={handleAnalyze} disabled={loading}>
        {loading ? '分析中...' : '\u{1F50D} 分析此ETF'}
      </button>

      {btError && (
        <div className="backtest-hint">{btError}</div>
      )}
      <div className="bt-buttons">
        <button
          className={`backtest-btn${backtesting ? ' loading' : ''}`}
          onClick={handleBacktest}
          disabled={backtesting}
        >
          {backtesting ? '⏳ 计算中...' : '📊 回测'}
        </button>
      </div>
    </div>
  )
}
