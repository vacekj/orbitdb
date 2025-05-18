/**
 * @namespace Storage-Level
 * @memberof module:Storage
 * @description
 * LevelStorage stores data to a Level-compatible database.
 *
 * To learn more about Level, see {@link https://github.com/Level/level}.
 */
import { Level } from 'level';

const defaultPath = './level'
const defaultValueEncoding = 'view'

/**
 * Creates an instance of LevelStorage.
 * @function
 * @param {Object} [params={}] One or more parameters for configuring
 * LevelStorage.
 * @param {string} [params.path=defaultPath] The Level path.
 * @param {string} [params.valueEncoding=defaultValueEncoding] Value encoding.
 * @return {module:Storage.Storage-Level} An instance of LevelStorage.
 * @memberof module:Storage
 * @instance
 */
const LevelStorage = async ({ path, valueEncoding } = {}) => {
  const storagePath = path || defaultPath;
  const effectiveValueEncoding = valueEncoding || defaultValueEncoding;
  console.log(`[LevelStorage] Creating Level DB at path: ${storagePath} with encoding: ${effectiveValueEncoding}`);

  const db = new Level(storagePath, { valueEncoding: effectiveValueEncoding, passive: true })
  try {
    console.log(`[LevelStorage] Attempting to open DB at: ${storagePath}`);
    await db.open()
    console.log(`[LevelStorage] DB opened successfully at: ${storagePath}`);
  } catch (e) {
    console.error(`[LevelStorage] Error opening DB at: ${storagePath}:`, e.message, e.stack);
    throw e; // Re-throw to ensure failure is propagated
  }

  /**
   * Puts data to Level.
   * @function
   * @param {string} hash The hash of the data to put.
   * @param {*} data The data to store.
   * @memberof module:Storage.Storage-Level
   * @instance
   */
  const put = async (hash, value) => {
    console.log(`[LevelStorage] put() hash: ${hash} in DB: ${storagePath}`);
    await db.put(hash, value)
    console.log(`[LevelStorage] put() hash: ${hash} COMPLETED in DB: ${storagePath}`);
  }

  /**
   * Deletes data from Level.
   * @function
   * @param {string} hash The hash of the data to delete.
   * @param {*} data The data to store.
   * @memberof module:Storage.Storage-Level
   * @instance
   */
  const del = async (hash) => {
    console.log(`[LevelStorage] del() hash: ${hash} from DB: ${storagePath}`);
    await db.del(hash)
    console.log(`[LevelStorage] del() hash: ${hash} COMPLETED from DB: ${storagePath}`);
  }

  /**
   * Gets data from Level.
   * @function
   * @param {string} hash The hash of the data to get.
   * @memberof module:Storage.Storage-Level
   * @instance
   */
  const get = async (hash) => {
    console.log(`[LevelStorage] get() hash: ${hash} from DB: ${storagePath}`);
    try {
      const value = await db.get(hash)
      if (value) {
        console.log(`[LevelStorage] get() hash: ${hash} FOUND in DB: ${storagePath}`);
        return value
      }
      // If value is null/undefined but no error, it means key existed with no value or Level returned undefined.
      console.log(`[LevelStorage] get() hash: ${hash} NOT FOUND (but no error or value is undefined) in DB: ${storagePath}`);
    } catch (e) {
      // LEVEL_NOT_FOUND (ie. key not found)
      console.log(`[LevelStorage] get() hash: ${hash} ERRORED (likely not found) in DB: ${storagePath}:`, e.message);
    }
    return undefined; // Explicitly return undefined if not found or error
  }

  /**
   * Iterates over records stored in Level.
   * @function
   * @yields [string, string] The next key/value pair from Level.
   * @memberof module:Storage.Storage-Level
   * @instance
   */
  const iterator = async function* ({ amount, reverse } = {}) {
    const iteratorOptions = { limit: amount || -1, reverse: reverse || false };
    console.log(`[LevelStorage] iterator() invoked for DB: ${storagePath} with options:`, iteratorOptions);
    let count = 0;
    try {
      console.log(`[LevelStorage] iterator() starting for-await loop on db.iterator() for DB: ${storagePath}`);
      for await (const [key, value] of db.iterator(iteratorOptions)) {
        count++;
        console.log(`[LevelStorage] iterator() received item #${count} from LevelDB iterator for DB: ${storagePath}. Key: ${key}`);
        yield [key, value]
      }
      console.log(`[LevelStorage] iterator() for-await loop COMPLETED for DB: ${storagePath}. Total yielded: ${count}`);
    } catch (e) {
      console.error(`[LevelStorage] iterator() ERRORED during for-await loop for DB: ${storagePath}:`, e.message, e.stack);
      throw e; // Re-throw to ensure callers are aware of iteration failure
    }
  }
  const merge = async (other) => {
    console.log(`[LevelStorage] merge() called for DB: ${storagePath}. NO-OP.`);
  }

  /**
  * Clears the contents of the Level db.
  * @function
  * @memberof module:Storage.Storage-Level
  * @instance
  */
  const clear = async () => {
    console.log(`[LevelStorage] clear() called for DB: ${storagePath}`);
    await db.clear()
    console.log(`[LevelStorage] clear() COMPLETED for DB: ${storagePath}`);
  }

  /**
  * Closes the Level db.
  * @function
  * @memberof module:Storage.Storage-Level
  * @instance
  */
  const close = async () => {
    console.log(`[LevelStorage] close() called for DB: ${storagePath}`);
    if (db.status === 'open') { // Check if db is open before trying to close
      await db.close();
      console.log(`[LevelStorage] close() COMPLETED for DB: ${storagePath}`);
    } else {
      console.log(`[LevelStorage] close() DB not open, skipping close for DB: ${storagePath}. Status: ${db.status}`);
    }
  }

  return {
    put,
    del,
    get,
    iterator,
    merge,
    clear,
    close
  }
}

export default LevelStorage
