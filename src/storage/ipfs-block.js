import drain from 'it-drain'
import { base58btc } from 'multiformats/bases/base58'
/**
 * @namespace Storage-IPFS
 * @memberof module:Storage
 * @description
 * IPFSBlockStorage uses IPFS to store data as raw blocks.
 */
import { CID } from 'multiformats/cid'
import { TimeoutController } from 'timeout-abort-controller'

const DefaultTimeout = 30000 // 30 seconds

/**
 * Creates an instance of IPFSBlockStorage.
 * @function
 * @param {Object} params One or more parameters for configuring
 * IPFSBlockStorage.
 * @param {IPFS} params.ipfs An IPFS instance.
 * @param {boolean} [params.pin=false] True, if the block should be pinned,
 * false otherwise.
 * @param {number} [params.timeout=defaultTimeout] A timeout in ms.
 * @return {module:Storage.Storage-IPFS} An instance of IPFSBlockStorage.
 * @memberof module:Storage
 * @throw An instance of ipfs is required if params.ipfs is not specified.
 * @instance
 */
const IPFSBlockStorage = async ({ ipfs, pin, timeout } = {}) => {
  if (!ipfs) throw new Error('An instance of ipfs is required.')

  /**
   * Puts data to an IPFS block.
   * @function
   * @param {string} hash The hash of the block to put.
   * @param {*} data The data to store in the IPFS block.
   * @memberof module:Storage.Storage-IPFS
   * @instance
   */
  const put = async (hash, data) => {
    const cid = CID.parse(hash, base58btc)
    const { signal } = new TimeoutController(timeout || DefaultTimeout)
    await ipfs.blockstore.put(cid, data, { signal })

    if (pin && !(await ipfs.pins.isPinned(cid))) {
      await drain(ipfs.pins.add(cid))
    }
  }

  const del = async (hash) => { }

  /**
   * Gets data from an IPFS block.
   * @function
   * @param {string} hash The hash of the block to get.
   * @return {Uint8Array} The block.
   * @memberof module:Storage.Storage-IPFS
   * @instance
   */
  const get = async (hash) => {
    console.log('[orbitdb/src/storage/ipfs-block.js] get() received hash:', hash);
    console.log('[orbitdb/src/storage/ipfs-block.js] typeof base58btc:', typeof base58btc);
    try {
      console.log('[orbitdb/src/storage/ipfs-block.js] base58btc keys:', base58btc ? JSON.stringify(Object.keys(base58btc)) : String(base58btc));
    } catch (e) {
      console.log('[orbitdb/src/storage/ipfs-block.js] error stringifying base58btc keys:', e.message);
    }
    const cid = CID.parse(hash, base58btc)
    const { signal } = new TimeoutController(timeout || DefaultTimeout)
    const block = await ipfs.blockstore.get(cid, { signal })
    if (block) {
      return block
    }
  }

  const iterator = async function* () { }

  const merge = async (other) => { }

  const clear = async () => { }

  const close = async () => { }

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

export default IPFSBlockStorage
