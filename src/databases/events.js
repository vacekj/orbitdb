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

/**
 * Defines an Events database.
 * @return {module:Databases.Databases-Events} A Events function.
 * @memberof module:Databases
 */
const Events = () => async ({ ipfs, identity, address, name, access, directory, meta, headsStorage, entryStorage, indexStorage, referencesCount, syncAutomatically, onUpdate }) => {
  console.log('[events.js] Events DB factory invoked');
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
  const add = async (value) => {
    console.log('[events.js] add() called with:', value);
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
  const get = async (hash) => {
    console.log('[events.js] get() called with hash:', hash);
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
  const iterator = async function* ({ gt, gte, lt, lte, amount } = {}) {
    console.log('[events.js] iterator() invoked with filters:', { gt, gte, lt, lte, amount });
    const it = log.iterator({ gt, gte, lt, lte, amount })
    console.log('[events.js] log.iterator() obtained. Starting for-await loop...');
    let count = 0;
    for await (const event of it) {
      count++;
      console.log(`[events.js] iterator() yielding event #${count}:`, event ? event.hash : 'null/undefined');
      const hash = event.hash
      const value = event.payload.value
      yield { hash, value }
    }
    console.log('[events.js] iterator() for-await loop COMPLETED. Total yielded:', count);
  }

  /**
   * Returns all events.
   * @function
   * @return [][string, string] An array of events as hash/value entries.
   * @memberof module:Databases.Databases-Events
   * @instance
   */
  const all = async () => {
    console.log('[events.js] all() invoked');
    const values = []
    console.log('[events.js] all(): About to start for-await on local iterator()');
    let entryCount = 0;
    for await (const entry of iterator()) {
      entryCount++;
      console.log(`[events.js] all() received entry #${entryCount} from its iterator:`, entry ? entry.hash : 'null/undefined');
      values.unshift(entry)
    }
    console.log('[events.js] all() for-await loop COMPLETED. Total entries from local iterator:', entryCount, 'Returning values array length:', values.length);
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
