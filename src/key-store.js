/**
* @module KeyStore
* @description
* Provides a local key manager for OrbitDB.
* @example <caption>Create a keystore with defaults.</caption>
* const keystore = await KeyStore()
* @example <caption>Create a keystore with custom storage.</caption>
* const storage = await MemoryStorage()
* const keystore = await KeyStore({ storage })
*/
import { generateKeyPair, privateKeyFromRaw, publicKeyFromRaw } from '@libp2p/crypto/keys';
import { compare as uint8ArrayCompare } from 'uint8arrays/compare';
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';
import LRUStorage from './storage/lru.js';
import MemoryStorage from './storage/memory.js';

const verifySignature = async (signature, publicKey, data) => {
  if (!signature) {
    throw new Error('No signature given')
  }
  if (!publicKey) {
    throw new Error('Given publicKey was undefined')
  }
  if (!data) {
    throw new Error('Given input data was undefined')
  }

  let internalData = data
  if (!(internalData instanceof Uint8Array)) {
    internalData = typeof internalData === 'string' ? uint8ArrayFromString(internalData) : new Uint8Array(internalData)
  }

  const isValid = (key, msg, sig) => key.verify(msg, sig)

  let res = false
  try {
    const pubKey = publicKeyFromRaw(uint8ArrayFromString(publicKey, 'base16'))
    res = await isValid(pubKey, internalData, uint8ArrayFromString(signature, 'base16'))
  } catch (e) {
    // Catch error: sig length wrong
  }

  return Promise.resolve(res)
}

/**
 * Signs data using a key pair.
 * @param {Secp256k1PrivateKey} key The key to use for signing data.
 * @param {string|Uint8Array} data The data to sign.
 * @return {string} A signature.
 * @throws No signing key given if no key is provided.
 * @throws Given input data was undefined if no data is provided.
 * @static
 * @private
 */
const signMessage = async (key, data) => {
  if (!key) {
    throw new Error('No signing key given')
  }

  if (!data) {
    throw new Error('Given input data was undefined')
  }

  let internalData = data
  if (!(internalData instanceof Uint8Array)) {
    internalData = typeof internalData === 'string' ? uint8ArrayFromString(internalData) : new Uint8Array(internalData)
  }

  return uint8ArrayToString(await key.sign(internalData), 'base16')
}

const verifiedCachePromise = LRUStorage({ size: 1000 })

/**
 * Verifies input data against a cached version of the signed message.
 * @param {string} signature The generated signature.
 * @param {string} publicKey The derived public key of the key pair.
 * @param {string} data The data to be verified.
 * @return {boolean} True if the the data and cache match, false otherwise.
 * @static
 * @private
 */
const verifyMessage = async (signature, publicKey, data) => {
  const verifiedCache = await verifiedCachePromise
  const cached = await verifiedCache.get(signature)

  let res = false

  if (!cached) {
    const verified = await verifySignature(signature, publicKey, data)
    res = verified
    if (verified) {
      await verifiedCache.put(signature, { publicKey, data })
    }
  } else {
    const compare = (cached, data) => {
      const match = data instanceof Uint8Array ? uint8ArrayCompare(cached, data) === 0 : cached.toString() === data.toString()
      return match
    }
    res = cached.publicKey === publicKey && compare(cached.data, data)
  }
  return res
}

const defaultPath = './keystore'

/**
 * Creates an instance of KeyStore.
 * @param {Object} params One or more parameters for configuring KeyStore.
 * @param {Object} [params.storage] An instance of a storage class. Can be one
 * of ComposedStorage, IPFSBlockStorage, LevelStorage, etc. Defaults to
 * ComposedStorage.
 * @param {string} [params.path=./keystore] The path to a valid storage.
 * @return {module:KeyStore~KeyStore} An instance of KeyStore.
 * @instance
 */
const KeyStore = async ({ path: keystorePath, storage: store } = {}) => {

  // If no store is provided, default to MemoryStorage here as well for consistency, 
  // as LevelStorage is problematic in RN.
  store = store || await MemoryStorage();


  const keyCache = await LRUStorage({ size: 1000 });

  /**
   * Closes the KeyStore's underlying storage.
   * @memberof module:KeyStore~KeyStore
   * @async
   * @instance
   */
  const close = async () => {
    await store.close()
    await keyCache.close()
  }

  /**
   * Clears the KeyStore's underlying storage.
   * @memberof module:KeyStore~KeyStore
   * @async
   * @instance
   */
  const clear = async () => {
    await store.clear()
    await keyCache.clear()
  }

  /**
   * Checks if a key exists in the key store .
   * @param {string} id The id of an [Identity]{@link module:Identities~Identity} to check the key for.
   * @return {boolean} True if the key exists, false otherwise.
   * @throws id needed to check a key if no id is specified.
   * @memberof module:KeyStore~KeyStore
   * @async
   * @instance
   */
  const hasKey = async (id) => {
    if (!id) {
      throw new Error('id needed to check a key')
    }

    let hasKey = false
    let key = await keyCache.get(id)
    if (key) {
      hasKey = true
    } else {
      try {
        key = await store.get(`private_${id}`)
        hasKey = key !== undefined && key !== null
      } catch (e) {
        // Catches 'Error: ENOENT: no such file or directory, open <path>'
        console.error('Error: ENOENT: no such file or directory')
      }
    }

    return hasKey
  }

  /**
   * Adds a private key to the keystore.
   * @param {string} id An id of the [Identity]{@link module:Identities~Identity} to whom the key belongs to.
   * @param {Uint8Array} key The private key to store.
   * @memberof module:KeyStore~KeyStore
   * @async
   * @instance
   */
  const addKey = async (id, key) => {

    const { privateKey } = key;
    await store.put(`private_${id}`, privateKey);
    const unmarshaledPrivateKey = privateKeyFromRaw(privateKey);
    await keyCache.put(id, unmarshaledPrivateKey);

  }

  /**
   * Creates a key pair and stores it to the keystore.
   * @param {string} id An id of the [Identity]{@link module:Identities~Identity} to generate the key pair for.
   * @throws id needed to create a key if no id is specified.
   * @memberof module:KeyStore~KeyStore
   * @async
   * @instance
   */
  const createKey = async (id) => {

    if (!id) {
      console.error("[key-store.js] createKey() received undefined or null id.");
      throw new Error('id needed to create a key');
    }
    const keyPair = await generateKeyPair('secp256k1');
    const key = {
      publicKey: keyPair.publicKey.raw,
      privateKey: keyPair.raw
    };
    await addKey(id, key);

    return keyPair;
  }

  /**
   * Gets a key from keystore.
   * @param {string} id An id of the [Identity]{@link module:Identities~Identity} whose key to retrieve.
   * @return {Uint8Array} The key specified by id.
   * @throws id needed to get a key if no id is specified.
   * @memberof module:KeyStore~KeyStore
   * @async
   * @instance
   */
  const getKey = async (id) => {

    if (!id) {
      console.error("[key-store.js] getKey() received undefined or null id.");
      throw new Error('id needed to get a key');
    }
    let key = await keyCache.get(id);
    if (key) {

    } else {

      let storedKey;
      try {
        storedKey = await store.get(`private_${id}`);

      } catch (e) {
        console.error(`[key-store.js] getKey() error from store.get for 'private_${id}':`, e.message);
      }
      if (!storedKey) {

        return undefined;
      }
      key = privateKeyFromRaw(storedKey);
      await keyCache.put(id, key);

    }

    return key;
  }

  /**
   * Gets the serialized public key from a key pair.
   * @param {*} keys A key pair.
   * @param {Object} options One or more options.
   * @param {Object} [options.format=hex] The format the public key should be
   * returned in.
   * @return {Uint8Array|String} The public key.
   * @throws Supported formats are `hex` and `buffer` if an invalid format is
   * passed in options.
   * @memberof module:KeyStore~KeyStore
   * @async
   * @instance
   */
  const getPublic = (keys, options = {}) => {
    const formats = ['hex', 'buffer']
    const format = options.format || 'hex'
    if (formats.indexOf(format) === -1) {
      throw new Error('Supported formats are `hex` and `buffer`')
    }

    const pubKey = keys.publicKey.raw;

    return format === 'buffer' ? pubKey : uint8ArrayToString(pubKey, 'base16')
  }

  return {
    clear,
    close,
    hasKey,
    addKey,
    createKey,
    getKey,
    getPublic
  }
}

export {
  KeyStore as default, signMessage, verifyMessage
};

