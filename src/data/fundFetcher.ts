import type { FundNAV } from '../types'

function buildFundNAVUrl(fundCode: string, pageSize = 365): string {
  return `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${fundCode}&pageIndex=1&pageSize=${pageSize}`
}

function parseFundNAV(raw: unknown): FundNAV[] {
  const data = raw as {
    Data?: {
      LSJZList?: Array<{
        FSRQ: string
        DWJZ: string
        LJJZ: string
        JZZZL: string
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
