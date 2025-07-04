/**
 * @namespace Storage-LRU
 * @memberof module:Storage
 * @description
 * LRUStorage stores data in a Least Recently Used (LRU) cache.
 */
import LRU from 'lru'

const defaultSize = 1000000

interface LRUStorageInterface {
  put: (hash: string, data: any) => Promise<void>
  del: (hash: string) => Promise<void>
  get: (hash: string) => Promise<any>
  iterator: () => AsyncGenerator<[string, any], void, unknown>
  merge: (other: LRUStorageInterface | null) => Promise<void>
  clear: () => Promise<void>
  close: () => Promise<void>
}

interface LRUStorageParams {
  size?: number
}

/**
 * Creates an instance of LRUStorage.
 * @function
 * @param {Object} [params={}] One or more parameters for configuring
 * LRUStorage.
 * @param {string} [params.size=defaultSize] The number of elements to store.
 * @return {module:Storage.Storage-LRU} An instance of LRUStorage.
 * @memberof module:Storage
 * @instance
 */
const LRUStorage = async ({ size }: LRUStorageParams = {}): Promise<LRUStorageInterface> => {
  let lru = new LRU(size || defaultSize)

  /**
   * Puts data to the LRU cache.
   * @function
   * @param {string} hash The hash of the data to put.
   * @param {*} data The data to store.
   * @memberof module:Storage.Storage-LRU
   * @instance
   */
  const put = async (hash: string, data: any): Promise<void> => {
    lru.set(hash, data)
  }

  /**
   * Deletes data from the LRU cache.
   * @function
   * @param {string} hash The hash of the data to delete.
   * @memberof module:Storage.Storage-LRU
   * @instance
   */
  const del = async (hash: string): Promise<void> => {
    lru.remove(hash)
  }

  /**
   * Gets data from the LRU cache.
   * @function
   * @param {string} hash The hash of the data to get.
   * @memberof module:Storage.Storage-LRU
   * @instance
   */
  const get = async (hash: string): Promise<any> => {
    return lru.get(hash)
  }

  /**
   * Iterates over records stored in the LRU cache.
   * @function
   * @yields [string, string] The next key/value pair from the LRU cache.
   * @memberof module:Storage.Storage-LRU
   * @instance
   */
  const iterator = async function * (): AsyncGenerator<[string, any], void, unknown> {
    for await (const key of lru.keys) {
      const value = lru.get(key)
      yield [key, value]
    }
  }

  /**
   * Merges data from another source into the LRU cache.
   * @function
   * @param {module:Storage} other Another storage instance.
   * @memberof module:Storage.Storage-LRU
   * @instance
   */
  const merge = async (other: LRUStorageInterface | null): Promise<void> => {
    if (other) {
      for await (const [key, value] of other.iterator()) {
        lru.set(key, value)
      }
    }
  }

  /**
  * Clears the contents of the LRU cache.
  * @function
  * @memberof module:Storage.Storage-LRU
  * @instance
  */
  const clear = async (): Promise<void> => {
    lru = new LRU(size || defaultSize)
  }

  const close = async (): Promise<void> => {}

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

export default LRUStorage