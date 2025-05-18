import * as dagCbor from '@ipld/dag-cbor'
import { base58btc } from 'multiformats/bases/base58'
import * as Block from 'multiformats/block'
import { sha256 } from 'multiformats/hashes/sha2'

const codec = dagCbor
const hasher = sha256
const hashStringEncoding = base58btc

/**
 * @typedef {Object} module:Identities~Identity
 * @property {string} id A unique identifer for the identity.
 * @property {object} publicKey A public key.
 * @property {object} signatures A signed identity id and public key.
 * @property {string} type The type of identity provider.
 * @property {function} sign A sign function to sign data using this identity.
 * @property {function} verify A verify function to verify data signed by this identity.
 */
const Identity = async ({ id, publicKey, signatures, type, sign: signFromClosure, verify: verifyFromClosure } = {}) => {
  /**
   * @description The Identity instance. Returned by
   * [Identities.createIdentity()]{@link module:Identities~Identities#createIdentity}.
   */
  if (!id) throw new Error('Identity id is required')
  if (!publicKey) throw new Error('Invalid public key')
  if (!signatures) throw new Error('Signatures object is required')
  if (!signatures.id) throw new Error('Signature of id is required')
  if (!signatures.publicKey) throw new Error('Signature of publicKey+id is required')
  if (!type) throw new Error('Identity type is required')

  // Create a placeholder for the identityInstance that will be fully formed.
  // This is necessary so that the sign/verify methods can close over it.
  const identityInstance = {};

  // Assign core properties first, these might be needed by sign/verify if they access this.publicKey etc.
  // though in this specific case, signFromClosure takes identityInstance as first param.
  Object.assign(identityInstance, {
    id,
    publicKey,
    signatures: Object.assign({}, signatures), // Ensure signatures is a new object
    type
  });

  // Define methods that correctly call the closure functions
  const methods = {
    sign: async (dataToSign) => {
      // signFromClosure expects (identityObject, dataToSign)
      return signFromClosure(identityInstance, dataToSign);
    },
    verify: async (signatureToVerify, dataToVerify) => {
      // verifyFromClosure expects (signature, publicKeyOfSigner, data)
      // We use identityInstance.publicKey as the publicKeyOfSigner
      return verifyFromClosure(signatureToVerify, identityInstance.publicKey, dataToVerify);
    }
  };

  // Add methods to the instance
  Object.assign(identityInstance, methods);

  // Now encode the core part of the identity (without methods, hash, bytes)
  // _encodeIdentity expects an object with id, publicKey, signatures, type
  const coreModelForEncoding = {
    id: identityInstance.id,
    publicKey: identityInstance.publicKey,
    signatures: identityInstance.signatures,
    type: identityInstance.type
  };
  const { hash, bytes } = await _encodeIdentity(coreModelForEncoding);

  // Add hash and bytes to the final instance
  identityInstance.hash = hash;
  identityInstance.bytes = bytes;

  return identityInstance;
}

const _encodeIdentity = async (identityModel) => {
  const { id, publicKey, signatures, type } = identityModel
  const value = { id, publicKey, signatures, type }
  const { cid, bytes } = await Block.encode({ value, codec, hasher })
  const hash = cid.toString(hashStringEncoding)
  return { hash, bytes: Uint8Array.from(bytes) }
}

const decodeIdentity = async (bytes) => {
  const { value } = await Block.decode({ bytes, codec, hasher })
  return Identity({ ...value })
}

/**
 * Verifies whether an identity is valid.
 * @param {Identity} identity The identity to verify.
 * @return {boolean} True if the identity is valid, false otherwise.
 * @static
 * @private
 */
const isIdentity = (identity) => {
  return Boolean(identity.id &&
    identity.hash &&
    identity.bytes &&
    identity.publicKey &&
    identity.signatures &&
    identity.signatures.id &&
    identity.signatures.publicKey &&
    identity.type)
}

/**
 * Evaluates whether two identities are equal.
 * @param {Identity} a First identity.
 * @param {Identity} b Second identity.
 * @return {boolean} True if identity a and b are equal, false otherwise.
 * @static
 * @private
 */
const isEqual = (a, b) => {
  return a.id === b.id &&
    a.hash === b.hash &&
    a.type === b.type &&
    a.publicKey === b.publicKey &&
    a.signatures.id === b.signatures.id &&
    a.signatures.publicKey === b.signatures.publicKey
}

export { decodeIdentity, Identity as default, isEqual, isIdentity }

