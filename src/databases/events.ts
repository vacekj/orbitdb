/**
 * @namespace Databases-Events
 * @memberof module:Databases
 * @description
 * Events database is an immutable, append-only event log database.
 *
 * @augments module:Databases~Database
 */
import Database from '../database.js';

const type = 'events'

export interface DatabaseParams {
  ipfs: any;
  identity: any;
  address: string;
  name: string;
  access: any;
  directory: string;
  meta: any;
  headsStorage?: any;
  entryStorage?: any;
  indexStorage?: any;
  referencesCount?: number;
  syncAutomatically?: boolean;
  onUpdate?: (log: any, entry: any) => void;
}

export interface EventEntry {
  hash: string;
  value: any;
}

export interface IteratorFilters {
  gt?: string;
  gte?: string;
  lt?: string;
  lte?: string;
  amount?: number;
}

export interface LogIteratorFilters {
  gt?: string;
  gte?: string;
  lt?: string;
  lte?: string;
  amount?: number;
}

/**
 * Defines an Events database.
 * @return {Function} A Events function.
 * @memberof module:Databases
 */
const Events = () => async (params: DatabaseParams) => {
  const { ipfs, identity, address, name, access, directory, meta, headsStorage, entryStorage, indexStorage, referencesCount, syncAutomatically, onUpdate } = params
  const database = await Database({ ipfs, identity, address, name, access, directory, meta, headsStorage, entryStorage, indexStorage, referencesCount, syncAutomatically, onUpdate })

  const { addOperation, log } = database

  /**
   * Adds an event to the store.
   * @function
   * @param {*} value The event to be added.
   * @return {string} The hash of the new oplog entry.
   * @memberof module:Databases.Databases-Events
   * @instance
   */
  const add = async (value: any): Promise<string> => {
    return addOperation({ op: 'ADD', key: null, value })
  }

  /**
   * Gets an event from the store by hash.
   * @function
   * @param {string} hash The hash of the event to get.
   * @return {*} The value corresponding to hash or null.
   * @memberof module:Databases.Databases-Events
   * @instance
   */
  const get = async (hash: string): Promise<any> => {
    const entry = await log.get(hash)
    return entry.payload.value
  }

  /**
   * Iterates over events.
   * @function
   * @param {Object} [filters={}] Various filters to apply to the iterator.
   * @param {string} [filters.gt] All events which are greater than the
   * given hash.
   * @param {string} [filters.gte] All events which are greater than or equal
   * to the given hash.
   * @param {string} [filters.lt] All events which are less than the given
   * hash.
   * @param {string} [filters.lte] All events which are less than or equal to
   * the given hash.
   * @param {string} [filters.amount=-1] The number of results to fetch.
   * @yields [string, string] The next event as hash/value.
   * @memberof module:Databases.Databases-Events
   * @instance
   */
  const iterator = async function* (filters: IteratorFilters = {}): AsyncGenerator<EventEntry> {
    const { gt, gte, lt, lte, amount } = filters
    const it = log.iterator({ gt, gte, lt, lte, amount } as LogIteratorFilters)
    let count = 0;
    for await (const event of it) {
      count++;
      const hash = event.hash
      const value = event.payload.value
      yield { hash, value }
    }
  }

  /**
   * Returns all events.
   * @function
   * @return {EventEntry[]} An array of events as hash/value entries.
   * @memberof module:Databases.Databases-Events
   * @instance
   */
  const all = async (): Promise<EventEntry[]> => {
    const values: EventEntry[] = []
    let entryCount = 0;
    for await (const entry of iterator()) {
      entryCount++;
      values.unshift(entry)
    }
    return values
  }

  return {
    ...database,
    type,
    add,
    get,
    iterator,
    all
  }
}

Events.type = type

export default Events
