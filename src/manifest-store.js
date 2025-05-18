import * as dagCbor from '@ipld/dag-cbor'
import { base58btc } from 'multiformats/bases/base58'
import * as Block from 'multiformats/block'
import { sha256 } from 'multiformats/hashes/sha2'
import { ComposedStorage, IPFSBlockStorage, LRUStorage } from './storage/index.js'

console.log('[orbitdb/src/manifest-store.js] ManifestStore module loaded, factory function starting...'); // VERY EARLY LOG

const codec = dagCbor
const hasher = sha256
const hashStringEncoding = base58btc

const ManifestStore = async ({ ipfs, storage } = {}) => {
  /**
   * @namespace module:Manifest~Manifest
   * @description The instance returned by {@link module:Manifest~Manifest}.
   * @private
   */

  storage = storage || await ComposedStorage(
    await LRUStorage({ size: 100000 }),
    await IPFSBlockStorage({ ipfs, pin: true })
  )

  const get = async (address) => {
    console.log('[orbitdb/src/manifest-store.js] get() received address (should be hash):', address);
    const bytes = await storage.get(address)
    const { value } = await Block.decode({ bytes, codec, hasher })
    if (value) {
      // Write to storage to make sure it gets pinned on IPFS
      await storage.put(address, bytes)
    }
    return value
  }

  const create = async ({ name, type, accessController, meta }) => {
    if (!name) throw new Error('name is required')
    if (!type) throw new Error('type is required')
    if (!accessController) throw new Error('accessController is required')

    const manifest = Object.assign(
      {
        name,
        type,
        accessController
      },
      // meta field is only added to manifest if meta parameter is defined
      meta !== undefined ? { meta } : {}
    )

    const { cid, bytes } = await Block.encode({ value: manifest, codec, hasher })
    const hash = cid.toString(hashStringEncoding)
    await storage.put(hash, bytes)

    return {
      hash,
      manifest
    }
  }

  const close = async () => {
    await storage.close()
  }

  return {
    get,
    create,
    close
  }
}

export default ManifestStore
