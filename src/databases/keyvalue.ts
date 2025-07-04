import Database from '../database.js'
import { DatabaseParams } from './events.js'

const type = 'keyvalue'

export interface KeyValueEntry {
  key: string;
  value: any;
  hash: string;
}

export interface KeyValueIteratorFilters {
  amount?: number;
}

const KeyValue = () => async (params: DatabaseParams) => {
  const { ipfs, identity, address, name, access, directory, meta, headsStorage, entryStorage, indexStorage, referencesCount, syncAutomatically, onUpdate } = params
  const database = await Database({ ipfs, identity, address, name, access, directory, meta, headsStorage, entryStorage, indexStorage, referencesCount, syncAutomatically, onUpdate })

  const { addOperation, log } = database

  const put = async (key: string, value: any): Promise<string> => {
    return addOperation({ op: 'PUT', key, value })
  }

  const del = async (key: string): Promise<string> => {
    return addOperation({ op: 'DEL', key, value: null })
  }

  const get = async (key: string): Promise<any> => {
    for await (const entry of log.traverse()) {
      const { op, key: k, value } = entry.payload
      if (op === 'PUT' && k === key) {
        return value
      } else if (op === 'DEL' && k === key) {
        return
      }
    }
  }

  const iterator = async function* (filters: KeyValueIteratorFilters = {}): AsyncGenerator<KeyValueEntry> {
    const { amount = -1 } = filters
    const keys: { [key: string]: boolean } = {}
    let count = 0
    for await (const entry of log.traverse()) {
      const { op, key, value } = entry.payload
      if (op === 'PUT' && !keys[key]) {
        keys[key] = true
        count++
        const hash = entry.hash
        yield { key, value, hash }
      } else if (op === 'DEL' && !keys[key]) {
        keys[key] = true
      }
      if (amount > 0 && count >= amount) {
        break
      }
    }
  }

  const all = async (): Promise<KeyValueEntry[]> => {
    const values: KeyValueEntry[] = []
    for await (const entry of iterator()) {
      values.unshift(entry)
    }
    return values
  }

  return {
    ...database,
    type,
    put,
    set: put,
    del,
    get,
    iterator,
    all
  }
}

KeyValue.type = type

export default KeyValue
