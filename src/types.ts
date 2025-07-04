import type { Helia } from 'helia'

export interface StorageInstance {
  get: (key: string) => Promise<Uint8Array>;
  put: (key: string, value: Uint8Array) => Promise<void>;
  close: () => Promise<void>;
  clear?: () => Promise<void>;
  iterator?: () => AsyncIterableIterator<[string, Uint8Array]>;
}

export interface Identity {
  id: string;
  publicKey: string;
  signatures: Record<string, string>;
  type: string;
  sign: (identity: Identity, data: Uint8Array) => Promise<string>;
  verify: (signature: string, publicKey: string, data: Uint8Array) => Promise<boolean>;
  hash: string;
  bytes: Uint8Array;
}

export interface KeyStoreInstance {
  close: () => Promise<void>;
  hasKey: (id: string) => Promise<boolean>;
  createKey: (id: string) => Promise<CryptoKey>;
  getKey: (id: string) => Promise<CryptoKey>;
  getPublic: (keys: CryptoKey, options?: Record<string, unknown>) => string;
  addKey: (id: string, key: { privateKey: Uint8Array }) => Promise<void>;
  verify: (signature: string, publicKey: string, data: Uint8Array) => Promise<boolean>;
}

export interface IdentitiesInstance {
  keystore: KeyStoreInstance;
  createIdentity: (options?: Record<string, unknown>) => Promise<Identity>;
  verifyIdentity: (identity: Identity) => Promise<boolean>;
  getIdentity: (hash: string) => Promise<Identity | undefined>;
  sign: (identity: Identity, data: Uint8Array) => Promise<string>;
  verify: (signature: string, publicKey: string, data: Uint8Array) => Promise<boolean>;
}

export interface OrbitDBInstance {
  ipfs: Helia;
  identity: Identity;
  open: (address: string, options?: Record<string, unknown>) => Promise<DatabaseInstance>;
}

export interface DatabaseInstance {
  address: string;
  events: EventEmitter;
  close: () => Promise<void>;
  name?: string;
  type?: string;
  iterator?: () => AsyncIterableIterator<LogEntry>;
  get?: (key: string) => Promise<unknown>;
  put?: (key: string, value: unknown) => Promise<string>;
  del?: (key: string) => Promise<string>;
  drop?: () => Promise<void>;
  access?: AccessControllerInstance;
}

export interface AccessControllerInstance {
  address: string;
  type: string;
  canAppend: (entry: LogEntry) => Promise<boolean>;
  write?: string[];
  admin?: string[];
}

export interface LogEntry {
  hash: string;
  payload: {
    op: string;
    key: string | null;
    value: unknown;
  };
  next: string[];
  refs: string[];
  clock: Clock;
  v: number;
  key: string;
  identity: string;
  sig: string;
}

export interface Clock {
  id: string;
  time: number;
}

export interface EventEmitter {
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  emit: (event: string, ...args: unknown[]) => boolean;
}