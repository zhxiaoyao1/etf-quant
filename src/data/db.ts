// src/data/db.ts
import { openDB, type IDBPDatabase } from 'idb'
import type { ETFInfo, KLine, Signal } from '../types'

const DB_NAME = 'etf-quant-db'
const DB_VERSION = 1

let dbInstance: IDBPDatabase | null = null

async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('etfList')) {
        db.createObjectStore('etfList', { keyPath: 'code' })
      }
      if (!db.objectStoreNames.contains('klineData')) {
        db.createObjectStore('klineData', { keyPath: 'etfCode' })
      }
      if (!db.objectStoreNames.contains('signals')) {
        const signalStore = db.createObjectStore('signals', { keyPath: 'id' })
        signalStore.createIndex('etfCode', 'etfCode')
        signalStore.createIndex('date', 'date')
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
    },
  })
  return dbInstance
}

export async function saveETFList(etfs: ETFInfo[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('etfList', 'readwrite')
  await Promise.all([...etfs.map(etf => tx.store.put(etf)), tx.done])
}

export async function getETFList(): Promise<ETFInfo[]> {
  const db = await getDB()
  return db.getAll('etfList')
}

export async function saveKLines(etfCode: string, bars: KLine[]): Promise<void> {
  const db = await getDB()
  await db.put('klineData', { etfCode, bars })
}

export async function getKLines(etfCode: string): Promise<KLine[]> {
  const db = await getDB()
  const record = await db.get('klineData', etfCode)
  return record?.bars ?? []
}

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

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB()
  await db.put('settings', { key, value })
}

export async function getSetting<T>(key: string): Promise<T | null> {
  const db = await getDB()
  const record = await db.get('settings', key)
  return record?.value ?? null
}

export async function exportAllData(): Promise<Record<string, unknown>> {
  const db = await getDB()
  const [etfList, signals, settings] = await Promise.all([
    db.getAll('etfList'),
    db.getAll('signals'),
    db.getAll('settings'),
  ])
  const allKline = await db.getAll('klineData')
  return { etfList, klineData: allKline, signals, settings }
}

export async function importAllData(data: Record<string, unknown[]>): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    ['etfList', 'klineData', 'signals', 'settings'],
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
  for (const item of (data.settings as { key: string; value: unknown }[]) ?? []) {
    await tx.objectStore('settings').put(item)
  }
  await tx.done
}
