import { openDB, type IDBPDatabase } from 'idb'
import type { Assistant, ChatMessage } from '@/types/deepseek'

const DB_NAME = 'ducksoup'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('assistants')) {
          db.createObjectStore('assistants', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('messages')) {
          const store = db.createObjectStore('messages', { keyPath: 'id' })
          store.createIndex('assistantId', 'assistantId')
        }
      },
    })
  }
  return dbPromise
}

export async function getAllAssistants(): Promise<Assistant[]> {
  try {
    const db = await getDB()
    return await db.getAll('assistants')
  } catch (err) {
    console.warn('IndexDB: failed to get assistants', err)
    return []
  }
}

export async function addAssistant(assistant: Assistant): Promise<void> {
  try {
    const db = await getDB()
    await db.add('assistants', assistant)
  } catch (err) {
    console.warn('IndexDB: failed to add assistant', err)
  }
}

export async function deleteAssistant(id: string): Promise<void> {
  try {
    const db = await getDB()
    const tx = db.transaction(['assistants', 'messages'], 'readwrite')
    await tx.objectStore('assistants').delete(id)
    const messages = await tx.objectStore('messages').index('assistantId').getAllKeys(id)
    for (const key of messages) {
      await tx.objectStore('messages').delete(key)
    }
    await tx.done
  } catch (err) {
    console.warn('IndexDB: failed to delete assistant', err)
  }
}

export async function getMessages(assistantId: string): Promise<ChatMessage[]> {
  try {
    const db = await getDB()
    return await db.getAllFromIndex('messages', 'assistantId', assistantId)
  } catch (err) {
    console.warn('IndexDB: failed to get messages', err)
    return []
  }
}

export async function saveMessage(message: ChatMessage): Promise<void> {
  try {
    const db = await getDB()
    await db.put('messages', message)
  } catch (err) {
    console.warn('IndexDB: failed to save message', err)
  }
}

export async function deleteMessagesForAssistant(assistantId: string): Promise<void> {
  try {
    const db = await getDB()
    const keys = await db.getAllKeysFromIndex('messages', 'assistantId', assistantId)
    const tx = db.transaction('messages', 'readwrite')
    for (const key of keys) {
      await tx.objectStore('messages').delete(key)
    }
    await tx.done
  } catch (err) {
    console.warn('IndexDB: failed to delete messages', err)
  }
}
