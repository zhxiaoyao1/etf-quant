import { useState, useEffect, useRef, useCallback } from 'react'
import { createChart, CrosshairMode } from 'lightweight-charts'
import type { ETFInfo, KLine, Signal } from '../types'
import { DEFAULT_ETF_LIST, DEFAULT_ETF_WEIGHTS } from '../config/defaults'
import { getETFList, getKLines, getSignals, getWeights } from '../data/db'
import { runBacktest, type BacktestResult } from '../engine/etf/backtest'
import { useETFWorker } from '../hooks/useWorker'
import './Detail.css'

function calcMA(data: { time: string; value: number }[], period: number): { time: string; value: number }[] {
  const result: { time: string; value: number }[] = []
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].value
    }
    result.push({ time: data[i].time, value: sum / period })
  }
  return result
}

export default function Detail() {
  const [etfs, setEtfs] = useState<ETFInfo[]>(DEFAULT_ETF_LIST)
  const [selectedETF, setSelectedETF] = useState<ETFInfo>(etfs[0])
  const [bars, setBars] = useState<KLine[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const { analyze, loading } = useETFWorker()
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null)
  const [backtesting, setBacktesting] = useState(false)

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null)

  useEffect(() => {
    getETFList().then(list => {
      if (list.length > 0) { setEtfs(list); setSelectedETF(list[0]) }
    })
  }, [])

  useEffect(() => {
    if (!selectedETF) return
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
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#30363d',
      },
      width: container.clientWidth,
      height: 300,
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

    // Build close-price series for MA calculation
    const closeSeries = bars.map(bar => ({
      time: bar.date,
      value: bar.close,
    }))

    // MA5 (yellow)
    if (bars.length >= 5) {
      const ma5Data = calcMA(closeSeries, 5)
      const ma5Series = chart.addLineSeries({
        color: '#e5c73c',
        lineWidth: 1,
      })
      ma5Series.setData(ma5Data)
    }

    // MA20 (blue)
    if (bars.length >= 20) {
      const ma20Data = calcMA(closeSeries, 20)
      const ma20Series = chart.addLineSeries({
        color: '#58a6ff',
        lineWidth: 1,
      })
      ma20Series.setData(ma20Data)
    }

    // MA60 (purple)
    if (bars.length >= 60) {
      const ma60Data = calcMA(closeSeries, 60)
      const ma60Series = chart.addLineSeries({
        color: '#bc8cff',
        lineWidth: 1,
      })
      ma60Series.setData(ma60Data)
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

  const handleAnalyze = async () => {
    if (!selectedETF) return
    const newSignals = await analyze([selectedETF])
    if (newSignals.length > 0) {
      setSignals(prev => [newSignals[0], ...prev].slice(0, 20))
    }
  }

  const handleBacktest = async () => {
    if (!selectedETF || bars.length < 80) return
    setBacktesting(true)
    try {
      const weights = await getWeights('etf') ?? DEFAULT_ETF_WEIGHTS
      const result = runBacktest(bars, weights)
      setBacktestResult(result)
    } finally {
      setBacktesting(false)
    }
  }

  const latestSignal = signals[0]
  const signalEmoji = (s: string) => s === 'buy' ? '\u{1F7E2}' : s === 'sell' ? '\u{1F534}' : '\u{1F7E1}'

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
            <div className="signal-text">{latestSignal.signal === 'buy' ? '买入' : latestSignal.signal === 'sell' ? '卖出' : '观望'}</div>
            <div className="signal-date">{latestSignal.date}</div>
          </div>
          <div className="signal-score-det">{latestSignal.compositeScore}</div>
        </div>
      )}

      {latestSignal && (
        <div className="factor-grid">
          {latestSignal.factorScores.map(fs => (
            <div key={fs.factorId} className="factor-item">
              <div className="factor-name">{fs.name}</div>
              <div className="factor-value" style={{
                color: fs.score >= 70 ? 'var(--green)' : fs.score < 40 ? 'var(--red)' : 'var(--yellow)'
              }}>{fs.score}</div>
            </div>
          ))}
        </div>
      )}

      {bars.length > 0 ? (
        <div ref={chartContainerRef} className="chart-container" />
      ) : (
        <div className="chart-placeholder">
          <p>{'\u{1F4C8}'} K线图区域</p>
          <p className="sub">数据点数: {bars.length}</p>
        </div>
      )}

      <h3 style={{ marginTop: 16, marginBottom: 8 }}>信号历史</h3>
      <div className="signal-history">
        {signals.slice(0, 10).map(sig => (
          <div key={sig.id} className="history-item">
            <span>{sig.date}</span>
            <span>{signalEmoji(sig.signal)}</span>
            <span style={{ color: sig.signal === 'buy' ? 'var(--green)' : sig.signal === 'sell' ? 'var(--red)' : 'var(--yellow)' }}>{sig.compositeScore}</span>
          </div>
        ))}
        {signals.length === 0 && <div className="history-item"><span style={{color: 'var(--text-secondary)'}}>暂无信号记录</span></div>}
      </div>

      {backtestResult && (
        <div className="backtest-results">
          <h3 style={{ marginTop: 16, marginBottom: 8 }}>回测结果</h3>
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

      <button className="backtest-btn" onClick={handleBacktest} disabled={backtesting || bars.length < 80}>
        {backtesting ? '回测中...' : '\u{1F4CA} 回测'}
      </button>
    </div>
  )
}
