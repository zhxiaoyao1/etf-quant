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
      if (!db.objectStoreNames.contains('learningLogs')) {
        const logStore = db.createObjectStore('learningLogs', { keyPath: 'id' })
        logStore.createIndex('engine', 'engine')
        logStore.createIndex('date', 'date')
      }
      if (!db.objectStoreNames.contains('weights')) {
        db.createObjectStore('weights', { keyPath: 'engine' })
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
  const [etfList, signals, learningLogs, weights, settings] = await Promise.all([
    db.getAll('etfList'),
    db.getAll('signals'),
    db.getAll('learningLogs'),
    db.getAll('weights'),
    db.getAll('settings'),
  ])
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
