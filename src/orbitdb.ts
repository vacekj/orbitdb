import type { Helia } from "helia";
import { getAccessController } from "./access-controllers/index.js";
import IPFSAccessController from "./access-controllers/ipfs.js";
import OrbitDBAddressFactory, { isValidAddress } from "./address.js";
/**
 * @module OrbitDB
 * @description Provides an interface for users to interact with OrbitDB.
 */
import { getDatabaseType as getDatabaseTypeInternal } from "./databases/index.js";
import IdentitiesFactory from "./identities/identities.js";
import KeyStoreFactory from "./key-store.js";
import ManifestStoreFactory from "./manifest-store.js";
import { createId } from "./utils/index.js";
import pathJoin from "./utils/path-join.js";

console.log(
  "[orbitdb/src/orbitdb.ts] OrbitDB module loaded, factory function starting..."
); // VERY EARLY LOG

// Define DatabaseType based on known OrbitDB types + string for extensibility
export type DatabaseType =
  | "events"
  | "documents"
  | "keyvalue"
  | "keyvalue-indexed"
  | string;

// Interface for the instance returned by OrbitDBAddressFactory
export interface OrbitDBAddressInstance {
  protocol: string;
  path: string;
  hash: string;
  toString: () => string;
  // Add other properties/methods if present
}

// Interface for the instance returned by KeyStore factory
interface KeyStoreInstance {
  close: () => Promise<void>;
  hasKey: (id: string) => Promise<boolean>;
  createKey: (id: string) => Promise<any>; // Should be specific crypto key type
  getKey: (id: string) => Promise<any>; // Should be specific crypto key type
  getPublic: (keys: any, options?: any) => string;
  addKey: (id: string, key: { privateKey: Uint8Array }) => Promise<void>; // More specific key
  verify: (
    signature: string,
    publicKey: string,
    data: any,
    Caching?: boolean
  ) => Promise<boolean>;
  // Add other KeyStore methods and properties from key-store.js if needed
}

interface Manifest {
  name: string;
  type: DatabaseType; // Use defined DatabaseType
  accessController: string; // This is an address string
  hash?: string;
  meta?: any;
}

// Interface for the instance returned by ManifestStore factory
interface ManifestStoreInstance {
  get: (hash: string) => Promise<any>; // TODO: Refine to Promise<Manifest> when manifest-store.js is typed
  create: (params: {
    name: string;
    type: DatabaseType;
    accessController: string; // Address string
    meta: any;
  }) => Promise<{ manifest: any; hash: string }>; // TODO: Refine manifest to Manifest
  close: () => Promise<void>;
}

// Interface for Identity object (returned by IdentityFactory)
export interface Identity {
  id: string;
  publicKey: string; // Typically a hex string or similar
  signatures: {
    id: string; // Signature of the id
    publicKey: string; // Signature of publicKey + id
  };
  type: string; // Provider type
  sign: (identity: Identity, data: any) => Promise<string>; // Adapted from Identities.sign
  verify: (signature: string, publicKey: string, data: any) => Promise<boolean>; // Adapted from Identities.verify
  hash: string; // CID string
  bytes: Uint8Array;
  provider?: any; // Optional: if identity object carries its provider instance
}

// Interface for the instance returned by IdentitiesFactory
export interface IdentitiesInstance {
  keystore: KeyStoreInstance;
  createIdentity: (options: any) => Promise<Identity>;
  getIdentity: (hash: string) => Promise<Identity | undefined>;
  verifyIdentity: (identity: Identity) => Promise<boolean>;
  sign: (identity: Identity, data: any) => Promise<string>;
  verify: (signature: string, publicKey: string, data: any) => Promise<boolean>;
  // Add other methods if available
}

// Placeholder for a generic Database instance
interface DatabaseInstance {
  address: OrbitDBAddressInstance | string;
  events: any;
  close: () => Promise<void>;
  name?: string;
  access?: AccessControllerInstance;
  meta?: any;
  syncAutomatically?: boolean;
  type?: DatabaseType;
  // Add other common database methods/properties
}

// Placeholder for AccessController instance
// This is what a specific AC like IPFSAccessController or a custom one would implement/return
export interface AccessControllerInstance {
  address: string; // Its own OrbitDB address or identifier
  type?: string;
  canAppend: (
    entry: any,
    identityProvider: any,
    identities: IdentitiesInstance
  ) => Promise<boolean>;
  close?: () => Promise<void>;
  load?: (address: string) => Promise<void>;
  save?: () => Promise<{ address: string }>;
  // IPFSAccessController specific, or common AC methods
  get write(): string[];
  grant: (capability: string, key: string) => Promise<void>;
  revoke: (capability: string, key: string) => Promise<void>;
}

// Options for opening a database
interface OpenDbOptions {
  type?: DatabaseType;
  meta?: any;
  sync?: boolean;
  Database?: any; // Constructor type for a Database: new (...args: any[]) => Promise<DatabaseInstance> or similar
  AccessController?: any; // Constructor type: new (...args: any[]) => Promise<AccessControllerInstance>
  headsStorage?: any;
  entryStorage?: any;
  indexStorage?: any;
  referencesCount?: number;
}

const DefaultDatabaseType: DatabaseType = "events";

// DefaultAccessController is likely a factory function that returns an AccessController constructor or instance factory
const DefaultAccessController = IPFSAccessController; // This is a direct constructor/factory

interface OrbitDBParams {
  ipfs: Helia;
  id?: string;
  identity?: Identity | { provider: any; [key: string]: any };
  identities?: IdentitiesInstance; // Use instance type
  directory?: string;
}

export interface OrbitDBInstance {
  id: string;
  open: (address: string, options?: OpenDbOptions) => Promise<DatabaseInstance>;
  stop: () => Promise<void>;
  ipfs: Helia;
  directory: string;
  keystore: KeyStoreInstance;
  identities: IdentitiesInstance; // Use instance type
  identity: Identity; // Use instance type
  peerId: any;
}

/**
 * Creates an instance of OrbitDB.
 * @function createOrbitDB
 * @param {Object} params One or more parameters for configuring OrbitDB.
 * @param {Helia} params.ipfs An IPFS instance.
 * @param {string} [params.id] The id of the identity to use for this OrbitDB instance.
 * @param {module:Identity|Object} [params.identity] An identity instance or an object containing an Identity Provider instance and any additional params required to create the identity using the specified provider.
 * @param {Function} [params.identity.provider] An initialized identity provider.
 * @param {module:Identities} [params.identities] An Identities system instance.
 * @param {string} [params.directory] A location for storing OrbitDB data.
 * @return {module:OrbitDB~OrbitDB} An instance of OrbitDB.
 * @throws "IPFS instance is required argument" if no IPFS instance is provided.
 * @instance
 */
const OrbitDB = async (
  {
    ipfs,
    id,
    identity: providedIdentity,
    identities: providedIdentities,
    directory,
  }: OrbitDBParams = {} as OrbitDBParams
) => {
  /**
   * @namespace module:OrbitDB~OrbitDB
   * @description The instance returned by {@link module:OrbitDB}.
   */

  if (ipfs == null) {
    throw new Error("IPFS instance is a required argument.");
  }

  const internalId: string = id ?? (await createId());
  const peerId = (ipfs as any).libp2p.peerId;
  const internalDirectory: string = directory ?? "./orbitdb";

  let keystore: KeyStoreInstance;
  let identities: IdentitiesInstance;

  if (providedIdentities) {
    identities = providedIdentities;
    keystore = providedIdentities.keystore;
  } else {
    keystore = await KeyStoreFactory({
      path: pathJoin(internalDirectory, "./keystore"),
    });
    identities = await IdentitiesFactory({ ipfs, keystore });
  }

  let currentIdentity: Identity;

  if (providedIdentity) {
    if ((providedIdentity as { provider: any }).provider) {
      currentIdentity = await identities.createIdentity({
        ...(providedIdentity as { provider: any; [key: string]: any }),
      });
    } else {
      currentIdentity = providedIdentity as Identity;
    }
  } else {
    currentIdentity = await identities.createIdentity({ id: internalId });
  }

  const manifestStore: ManifestStoreInstance = await ManifestStoreFactory({
    ipfs,
  });

  let databases: { [key: string]: DatabaseInstance } = {};

  const open = async (
    addressOrName: string,
    {
      type: dbType,
      meta: dbMeta,
      sync: syncAutomatically = true,
      Database: CustomDB,
      AccessController: CustomAC,
      headsStorage,
      entryStorage,
      indexStorage,
      referencesCount,
    }: OpenDbOptions = {}
  ): Promise<DatabaseInstance> => {
    let name: string;
    let manifest: Manifest;
    let accessController: AccessControllerInstance;
    let dbAddress: OrbitDBAddressInstance | string = addressOrName;

    if (databases[addressOrName]) {
      return databases[addressOrName];
    }

    if (isValidAddress(addressOrName)) {
      console.log(
        "[orbitdb/src/orbitdb.ts] open() received addressOrName:",
        addressOrName
      );
      const addr = OrbitDBAddressFactory(addressOrName);
      console.log(
        "[orbitdb/src/orbitdb.ts] addr from OrbitDBAddressFactory:",
        addr ? JSON.stringify(addr) : addr
      );
      console.log(
        "[orbitdb/src/orbitdb.ts] addr.hash to be used:",
        addr ? addr.hash : undefined
      );
      dbAddress = addr;
      manifest = await manifestStore.get(addr.hash);
      const acType = manifest.accessController.split("/", 2).pop() as string;

      const ACFactoryRetrieved = getAccessController(acType);
      const SpecificACObjectFactory = ACFactoryRetrieved();

      accessController = await SpecificACObjectFactory({
        orbitdb: { open, identity: currentIdentity, ipfs },
        identities,
        address: manifest.accessController,
      });
      name = manifest.name;
      dbType = dbType ?? manifest.type;
      dbMeta = manifest.meta;
    } else {
      name = addressOrName;
      dbType = dbType ?? DefaultDatabaseType;

      const ACFactoryToUse = CustomAC ?? DefaultAccessController;
      const SpecificACObjectFactory = ACFactoryToUse();

      accessController = await SpecificACObjectFactory({
        orbitdb: { open, identity: currentIdentity, ipfs },
        identities,
        name,
      });
      const m = await manifestStore.create({
        name,
        type: dbType,
        accessController: accessController.address,
        meta: dbMeta,
      });
      manifest = m.manifest;
      dbAddress = OrbitDBAddressFactory(m.hash);
      dbMeta = manifest.meta;

      if (databases[dbAddress.toString()]) {
        return databases[dbAddress.toString()];
      }
    }

    const DBFactory =
      CustomDB ?? getDatabaseTypeInternal(dbType as DatabaseType);
    const DBConstructor = DBFactory();

    if (!DBConstructor) {
      throw new Error(`Unsupported database type: '${dbType}'`);
    }

    const resolvedAddress = dbAddress.toString();

    const db: DatabaseInstance = await DBConstructor({
      ipfs,
      identity: currentIdentity,
      address: resolvedAddress,
      name,
      access: accessController,
      directory: internalDirectory,
      meta: dbMeta,
      syncAutomatically,
      headsStorage,
      entryStorage,
      indexStorage,
      referencesCount,
    });

    db.events.on("close", onDatabaseClosed(resolvedAddress));
    databases[resolvedAddress] = db;
    return db;
  };

  const onDatabaseClosed = (addressString: string) => () => {
    delete databases[addressString];
  };

  /**
   * Stops OrbitDB, closing the underlying keystore and manifest store.
   * @function stop
   * @memberof module:OrbitDB~OrbitDB
   * @instance
   * @async
   */
  const stop = async () => {
    for (const db of Object.values(databases)) {
      await db.close();
    }
    if (keystore) {
      await keystore.close();
    }
    if (manifestStore) {
      await manifestStore.close();
    }
    databases = {};
  };

  return {
    id: internalId,
    open,
    stop,
    ipfs,
    directory: internalDirectory,
    keystore,
    identities,
    identity: currentIdentity,
    peerId,
  };
};

export { OrbitDB as default, OrbitDBAddressFactory as OrbitDBAddress };
