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

interface LevelStorageInterface {
  put: (hash: string, data: any) => Promise<void>
  del: (hash: string) => Promise<void>
  get: (hash: string) => Promise<any>
  iterator: (options?: { amount?: number, reverse?: boolean }) => AsyncGenerator<[string, any], void, unknown>
  merge: (other: LevelStorageInterface | null) => Promise<void>
  clear: () => Promise<void>
  close: () => Promise<void>
}

interface LevelStorageParams {
  path?: string
  valueEncoding?: string
}

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
const LevelStorage = async ({ path, valueEncoding }: LevelStorageParams = {}): Promise<LevelStorageInterface> => {
  const storagePath = path || defaultPath;
  const effectiveValueEncoding = valueEncoding || defaultValueEncoding;

  const db = new Level(storagePath, { valueEncoding: effectiveValueEncoding } as any)
  try {
    await db.open()
  } catch (e: any) {
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
  const put = async (hash: string, value: any): Promise<void> => {
    await db.put(hash, value)
  }

  /**
   * Deletes data from Level.
   * @function
   * @param {string} hash The hash of the data to delete.
   * @param {*} data The data to store.
   * @memberof module:Storage.Storage-Level
   * @instance
   */
  const del = async (hash: string): Promise<void> => {
    await db.del(hash)
  }

  /**
   * Gets data from Level.
   * @function
   * @param {string} hash The hash of the data to get.
   * @memberof module:Storage.Storage-Level
   * @instance
   */
  const get = async (hash: string): Promise<any> => {
    try {
      const value = await db.get(hash)
      if (value) {
        return value
      }
      // If value is null/undefined but no error, it means key existed with no value or Level returned undefined.
    } catch (e) {
      // LEVEL_NOT_FOUND (ie. key not found)
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
  const iterator = async function* ({ amount, reverse }: { amount?: number, reverse?: boolean } = {}): AsyncGenerator<[string, any], void, unknown> {
    const iteratorOptions = { limit: amount || -1, reverse: reverse || false };
    let count = 0;
    try {
      for await (const [key, value] of db.iterator(iteratorOptions)) {
        count++;
        yield [key, value]
      }
    } catch (e: any) {
      console.error(`[LevelStorage] iterator() ERRORED during for-await loop for DB: ${storagePath}:`, e.message, e.stack);
      throw e; // Re-throw to ensure callers are aware of iteration failure
    }
  }
  const merge = async (other: LevelStorageInterface | null): Promise<void> => {
  }

  /**
  * Clears the contents of the Level db.
  * @function
  * @memberof module:Storage.Storage-Level
  * @instance
  */
  const clear = async (): Promise<void> => {
    await db.clear()
  }

  /**
  * Closes the Level db.
  * @function
  * @memberof module:Storage.Storage-Level
  * @instance
  */
  const close = async (): Promise<void> => {
    if (db.status === 'open') { // Check if db is open before trying to close
      await db.close();
    } else {
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