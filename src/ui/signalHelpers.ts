export const signalEmoji = (s: string) => s === 'buy' ? '🟢' : s === 'sell' ? '🔴' : '🟡'
export const signalLabel = (s: string) => s === 'buy' ? '买入' : s === 'sell' ? '卖出' : '观望'
export const signalColor = (s: string) => s === 'buy' ? 'var(--green)' : s === 'sell' ? 'var(--red)' : 'var(--yellow)'
