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
  hasKey: (id: any) => Promise<boolean>;
  createKey: (id: any) => Promise<any>;
  getKey: (id: any) => Promise<any>;
  getPublic: (keys: any, options?: any) => any;
  addKey: (id: any, key: any) => Promise<void>;
  verify: (signature: any, publicKey: any, data: any) => Promise<boolean>;
  clear?: () => Promise<void>;
}

export interface IdentitiesInstance {
  keystore: any;
  createIdentity: (options?: any) => Promise<any>;
  verifyIdentity: (identity: any) => Promise<boolean>;
  getIdentity: (hash: any) => Promise<any>;
  sign: (identity: any, data: any) => Promise<any>;
  verify: (signature: any, publicKey: any, data: any) => Promise<any>;
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