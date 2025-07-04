import Database from '../database.js'
import { DatabaseParams } from './events.js'

const type = 'documents'

const DefaultOptions = { indexBy: '_id' }

export interface DocumentsOptions {
  indexBy?: string;
}

export interface DocumentEntry {
  hash: string;
  key: string;
  value: any;
}

export interface DocumentIteratorFilters {
  amount?: number;
}

const Documents = ({ indexBy = '_id' }: DocumentsOptions = DefaultOptions) => async (params: DatabaseParams) => {
  const { ipfs, identity, address, name, access, directory, meta, headsStorage, entryStorage, indexStorage, referencesCount, syncAutomatically, onUpdate } = params
  const database = await Database({ ipfs, identity, address, name, access, directory, meta, headsStorage, entryStorage, indexStorage, referencesCount, syncAutomatically, onUpdate })

  const { addOperation, log } = database

  const put = async (doc: any): Promise<string> => {
    const key = doc[indexBy]

    if (!key) { throw new Error(`The provided document doesn't contain field '${indexBy}'`) }

    return addOperation({ op: 'PUT', key, value: doc })
  }

  const del = async (key: string): Promise<string> => {
    if (!await get(key)) { throw new Error(`No document with key '${key}' in the database`) }

    return addOperation({ op: 'DEL', key, value: null })
  }

  const get = async (key: string): Promise<DocumentEntry | undefined> => {
    for await (const doc of iterator()) {
      if (key === doc.key) {
        return doc
      }
    }
  }

  const query = async (findFn: (doc: any) => boolean): Promise<any[]> => {
    const results: any[] = []

    for await (const doc of iterator()) {
      if (findFn(doc.value)) {
        results.push(doc.value)
      }
    }

    return results
  }

  const iterator = async function* (filters: DocumentIteratorFilters = {}): AsyncGenerator<DocumentEntry> {
    const { amount = -1 } = filters
    const keys: { [key: string]: boolean } = {}
    let count = 0
    for await (const entry of log.iterator()) {
      const { op, key, value } = entry.payload
      if (op === 'PUT' && !keys[key]) {
        keys[key] = true
        count++
        const hash = entry.hash
        yield { hash, key, value }
      } else if (op === 'DEL' && !keys[key]) {
        keys[key] = true
      }
      if (amount > 0 && count >= amount) {
        break
      }
    }
  }

  const all = async (): Promise<DocumentEntry[]> => {
    const values: DocumentEntry[] = []
    for await (const entry of iterator()) {
      values.unshift(entry)
    }
    return values
  }

  return {
    ...database,
    type,
    put,
    del,
    get,
    iterator,
    query,
    indexBy,
    all
  }
}

Documents.type = type

export default Documents
