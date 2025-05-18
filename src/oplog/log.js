/**
 * @module Log
 * @description
 * Log is a verifiable, append-only log CRDT.
 *
 * Implemented as a Merkle-CRDT as per the paper
 * ["Merkle-CRDTs: Merkle-DAGs meet CRDTs"]{@link https://arxiv.org/abs/2004.00107}
 */
import LRU from 'lru'
import PQueue from 'p-queue'
import MemoryStorage from '../storage/memory.js'
import Clock, { tickClock } from './clock.js'
import ConflictResolution from './conflict-resolution.js'
import Entry from './entry.js'
import Heads from './heads.js'

const { LastWriteWins, NoZeroes } = ConflictResolution

const randomId = () => new Date().getTime().toString()
const maxClockTimeReducer = (res, acc) => Math.max(res, acc.clock.time)

// Default storage for storing the Log and its entries. Default: Memory. Options: Memory, LRU, IPFS.
const DefaultStorage = MemoryStorage

// Default AccessController for the Log.
// Default policy is that anyone can write to the Log.
// Signature of an entry will always be verified regardless of AccessController policy.
// Any object that implements the function `canAppend()` that returns true|false can be
// used as an AccessController.
const DefaultAccessController = async () => {
  // An AccessController may do any async initialization stuff here...
  return {
    canAppend: async (entry) => true
  }
}

/**
 * Create a new Log instance

 * @function
 * @param {IPFS} ipfs An IPFS instance
 * @param {Object} identity Identity.
 * @param {Object} options
 * @param {string} options.logId ID of the log
 * @param {Array<Entry>} options.logHeads Set the heads of the log
 * @param {Object} options.access AccessController (./default-access-controller)
 * @param {Array<Entry>} options.entries An Array of Entries from which to create the log
 * @param {module:Storage} [options.entryStorage] A compatible storage instance
 * for storing log entries. Defaults to MemoryStorage.
 * @param {module:Storage} [options.headsStorage] A compatible storage
 * instance for storing log heads. Defaults to MemoryStorage.
 * @param {module:Storage} [options.indexStorage] A compatible storage
 * instance for storing an index of log entries. Defaults to MemoryStorage.
 * @param {Function} options.sortFn The sort function - by default LastWriteWins
 * @return {module:Log~Log} sync An instance of Log
 * @memberof module:Log
 * @instance
 */
const Log = async (identity, { logId, logHeads, access, entryStorage, headsStorage, indexStorage, sortFn } = {}) => {
  console.log(`[oplog/log.js] Log factory invoked for ID: ${logId || 'generated'}`);
  /**
   * @namespace Log
   * @description The instance returned by {@link module:Log}
   */

  if (identity == null) {
    throw new Error('Identity is required')
  }
  if (logHeads != null && !Array.isArray(logHeads)) {
    throw new Error('\'logHeads\' argument must be an array')
  }
  // Set Log's id
  const id = logId || randomId()
  // Access Controller
  access = access || await DefaultAccessController()
  // Oplog entry storage
  const _entries = entryStorage || await DefaultStorage()
  // Entry index for keeping track which entries are already in the log
  const _index = indexStorage || await DefaultStorage()
  // Heads storage
  headsStorage = headsStorage || await DefaultStorage()
  // Add heads to the state storage, ie. init the log state
  const _heads = await Heads({ storage: headsStorage, heads: logHeads })
  // Conflict-resolution sorting function
  sortFn = NoZeroes(sortFn || LastWriteWins)
  // Internal queues for processing appends and joins in their call-order
  const appendQueue = new PQueue({ concurrency: 1 })
  const joinQueue = new PQueue({ concurrency: 1 })

  /**
   * Returns the clock of the log.
   * @return {module:Clock}
   * @memberof module:Log~Log
   * @instance
   */
  const clock = async () => {
    // Find the latest clock from the heads
    const maxTime = Math.max(0, (await heads()).reduce(maxClockTimeReducer, 0))
    return Clock(identity.publicKey, maxTime)
  }

  /**
   * Returns the current heads of the log
   *
   * @return {Array<module:Log~Entry>}
   * @memberof module:Log~Log
   * @instance
   */
  const heads = async () => {
    console.log(`[oplog/log.js] heads() invoked for log ID: ${id}`);
    const res = await _heads.all()
    console.log(`[oplog/log.js] heads() _heads.all() returned ${res.length} heads for log ID: ${id}`);
    return res.sort(sortFn).reverse()
  }

  /**
   * Returns all entries in the log
   *
   * @return {Array<module:Log~Entry>}
   * @memberof module:Log~Log
   * @instance
   */
  const values = async () => {
    const values = []
    for await (const entry of traverse()) {
      values.unshift(entry)
    }
    return values
  }

  /**
   * Retrieve an entry
   *
   * @param {string} hash The hash of the entry to retrieve
   * @return {module:Log~Entry}
   * @memberof module:Log~Log
   * @instance
   */
  const get = async (hash) => {
    const bytes = await _entries.get(hash)
    if (bytes) {
      const entry = await Entry.decode(bytes)
      return entry
    }
  }

  const has = async (hash) => {
    const entry = await _index.get(hash)
    return entry != null
  }

  /**
   * Append an new entry to the log
   *
   * @param {data} data Payload to add to the entry
   * @param {Object} options
   * @param {number} options.referencesCount TODO
   * @return {module:Log~Entry} Entry that was appended
   * @memberof module:Log~Log
   * @instance
   */
  const append = async (data, options = { referencesCount: 0 }) => {
    const task = async () => {
      try {
        const heads_ = await heads();

        const nexts = heads_.map(entry => entry.hash);
        const refs = await getReferences(heads_, options.referencesCount + heads_.length);

        const currentClock = await clock();
        const tickedClock = tickClock(currentClock);

        const entry = await Entry.create(
          identity,
          id,
          data,
          tickedClock,
          nexts,
          refs
        );

        const canAppend = await access.canAppend(entry);
        if (!canAppend) {
          throw new Error(`Could not append entry:\nKey "${identity.hash}" is not allowed to write to the log`);
        }

        await _heads.set([entry]);
        await _entries.put(entry.hash, entry.bytes);
        await _index.put(entry.hash, true);
        return entry;
      } catch (e) {
        console.error('[Log.append] Error in append task:', e);
        if (e && e.stack) console.error('[Log.append] Append task error stack:', e.stack);
        throw e;
      }
    };
    return appendQueue.add(task);
  }

  /**
   * Join two logs.
   *
   * Joins another log into this one.
   *
   * @param {module:Log~Log} log Log to join with this Log
   *
   * @example
   *
   * await log1.join(log2)
   *
   * @memberof module:Log~Log
   * @instance
   */
  const join = async (log) => {
    if (!log) {
      throw new Error('Log instance not defined')
    }
    if (!isLog(log)) {
      throw new Error('Given argument is not an instance of Log')
    }
    if (_entries.merge) {
      await _entries.merge(log.storage)
    }
    const heads = await log.heads()
    for (const entry of heads) {
      await joinEntry(entry)
    }
  }

  /**
   * Join an entry into a log.
   *
   * @param {module:Log~Entry} entry Entry to join with this Log
   *
   * @example
   *
   * await log.joinEntry(entry)
   *
   * @memberof module:Log~Log
   * @instance
   */
  const joinEntry = async (entry) => {
    const task = async () => {
      /* 1. Check if the entry is already in the log and return early if it is */
      const isAlreadyInTheLog = await has(entry.hash)
      if (isAlreadyInTheLog) {
        return false
      }

      const verifyEntry = async (entry) => {
        // Check that the Entry belongs to this Log
        if (entry.id !== id) {
          throw new Error(`Entry's id (${entry.id}) doesn't match the log's id (${id}).`)
        }
        // Verify if entry is allowed to be added to the log
        const canAppend = await access.canAppend(entry)
        if (!canAppend) {
          throw new Error(`Could not append entry:\nKey "${entry.identity}" is not allowed to write to the log`)
        }
        // Verify signature for the entry
        const isValid = await Entry.verify(identity, entry)
        if (!isValid) {
          throw new Error(`Could not validate signature for entry "${entry.hash}"`)
        }
      }

      /* 2. Verify the entry */
      await verifyEntry(entry)

      /* 3. Find missing entries and connections (=path in the DAG) to the current heads */
      const headsHashes = (await heads()).map(e => e.hash)
      const hashesToAdd = new Set([entry.hash])
      const hashesToGet = new Set([...entry.next, ...entry.refs])
      const connectedHeads = new Set()

      const traverseAndVerify = async () => {
        const getEntries = Array.from(hashesToGet.values()).filter(has).map(get)
        const entries = await Promise.all(getEntries)

        for (const e of entries) {
          hashesToGet.delete(e.hash)

          await verifyEntry(e)

          hashesToAdd.add(e.hash)

          for (const hash of [...e.next, ...e.refs]) {
            const isInTheLog = await has(hash)

            if (!isInTheLog && !hashesToAdd.has(hash)) {
              hashesToGet.add(hash)
            } else if (headsHashes.includes(hash)) {
              connectedHeads.add(hash)
            }
          }
        }

        if (hashesToGet.size > 0) {
          await traverseAndVerify()
        }
      }

      await traverseAndVerify()

      /* 4. Add missing entries to the index (=to the log) */
      for (const hash of hashesToAdd.values()) {
        await _index.put(hash, true)
      }

      /* 5. Remove heads which new entries are connect to */
      for (const hash of connectedHeads.values()) {
        await _heads.remove(hash)
      }

      /* 6. Add new entry to entries (for pinning) */
      await _entries.put(entry.hash, entry.bytes)

      /* 6. Add the new entry to heads (=union with current heads) */
      await _heads.add(entry)

      return true
    }

    return joinQueue.add(task)
  }

  /**
   * TODO
   * @memberof module:Log~Log
   * @instance
   */
  const traverse = async function* (rootEntries, shouldStopFn) {
    console.log(`[oplog/log.js] traverse() invoked for log ID: ${id}. rootEntries count: ${rootEntries ? rootEntries.length : 'undefined (will use heads)'}`);
    const defaultStopFn = () => false
    shouldStopFn = shouldStopFn || defaultStopFn
    rootEntries = rootEntries || (await heads())
    console.log(`[oplog/log.js] traverse() actual rootEntries count: ${rootEntries.length} for log ID: ${id}`);
    let stack = rootEntries.sort(sortFn)
    const traversed = {}
    let toFetch = []
    const fetched = {}
    const notIndexed = (hash) => !(traversed[hash] || fetched[hash])
    let entry
    let iterationCount = 0;

    console.log(`[oplog/log.js] traverse() starting while loop. Initial stack size: ${stack.length} for log ID: ${id}`);
    while (stack.length > 0) {
      iterationCount++;
      console.log(`[oplog/log.js] traverse() loop #${iterationCount}, stack size: ${stack.length} for log ID: ${id}`);
      stack = stack.sort(sortFn)
      entry = stack.pop()
      if (entry) {
        const { hash, next } = entry
        if (!traversed[hash]) {
          console.log(`[oplog/log.js] traverse() yielding entry: ${hash} for log ID: ${id}`);
          yield entry
          const done = await shouldStopFn(entry)
          if (done === true) {
            console.log(`[oplog/log.js] traverse() shouldStopFn returned true. Breaking loop for log ID: ${id}`);
            break
          }
          traversed[hash] = true
          fetched[hash] = true
          toFetch = [...toFetch, ...next].filter(notIndexed)
          const fetchEntries = (h) => {
            if (!traversed[h] && !fetched[h]) {
              fetched[h] = true
              console.log(`[oplog/log.js] traverse() fetching entry: ${h} for log ID: ${id}`);
              return get(h) // get() is from the Log scope
            }
            return Promise.resolve(null); // Ensure it's a promise if already fetched/traversed
          }
          const nexts = await Promise.all(toFetch.map(fetchEntries))
          console.log(`[oplog/log.js] traverse() fetched ${nexts.filter(n => n).length} next entries for log ID: ${id}`);
          toFetch = nexts
            .filter(e => e !== null && e !== undefined)
            .reduce((r, acc) => Array.from(new Set([...r, ...acc.next])), [])
            .filter(notIndexed)
          stack = [...nexts.filter(n => n), ...stack] // Filter out nulls from nexts before adding to stack
        } else {
          console.log(`[oplog/log.js] traverse() entry ${hash} already traversed for log ID: ${id}`);
        }
      } else {
        console.log(`[oplog/log.js] traverse() popped a null/undefined entry from stack for log ID: ${id}`);
      }
    }
    console.log(`[oplog/log.js] traverse() while loop COMPLETED for log ID: ${id}. Total iterations: ${iterationCount}`);
  }

  /**
   * Async iterator over the log entries
   *
   * @param {Object} options
   * @param {amount} options.amount Number of entried to return. Default: return all entries.
   * @param {string} options.gt Beginning hash of the iterator, non-inclusive
   * @param {string} options.gte Beginning hash of the iterator, inclusive
   * @param {string} options.lt Ending hash of the iterator, non-inclusive
   * @param {string} options.lte Ending hash of the iterator, inclusive
   * @return {Symbol.asyncIterator} Iterator object of log entries
   *
   * @examples
   *
   * (async () => {
   *   log = await Log(testIdentity, { logId: 'X' })
   *
   *   for (let i = 0; i <= 100; i++) {
   *     await log.append('entry' + i)
   *   }
   *
   *   let it = log.iterator({
   *     lte: 'zdpuApFd5XAPkCTmSx7qWQmQzvtdJPtx2K5p9to6ytCS79bfk',
   *     amount: 10
   *   })
   *
   *   for await (let entry of it) {
   *     console.log(entry.payload) // 'entry100', 'entry99', ..., 'entry91'
   *   }
   * })()
   *
   * @memberof module:Log~Log
   * @instance
   */
  const iterator = async function* ({ amount = -1, gt, gte, lt, lte } = {}) {
    console.log(`[oplog/log.js] iterator() invoked for log ID: ${id} with filters:`, { amount, gt, gte, lt, lte });
    if (amount === 0) {
      console.log(`[oplog/log.js] iterator() amount is 0, returning early for log ID: ${id}`);
      return
    }
    if (typeof lte === 'string') { lte = [await get(lte)] }
    if (typeof lt === 'string') { const entry = await get(lt); const nexts = await Promise.all(entry.next.map(n => get(n))); lt = nexts }
    if (lt != null && !Array.isArray(lt)) throw new Error('lt must be a string or an array of Entries')
    if (lte != null && !Array.isArray(lte)) throw new Error('lte must be a string or an array of Entries')

    const start = (lt || (lte || await heads())).filter(i => i != null)
    console.log(`[oplog/log.js] iterator() start entries count: ${start.length} for log ID: ${id}`);
    const end = (gt || gte) ? await get(gt || gte) : null
    const amountToIterate = (end || amount === -1) ? -1 : amount
    let count = 0
    const shouldStopTraversal = async (entry) => {
      count++
      if (!entry) return false
      if (count >= amountToIterate && amountToIterate !== -1) return true
      if (end && Entry.isEqual(entry, end)) return true
      return false
    }
    const useBuffer = end && amount !== -1 && !lt && !lte
    const buffer = useBuffer ? new LRU(amount + 2) : null
    let index = 0
    console.log(`[oplog/log.js] iterator() calling traverse() for log ID: ${id}`);
    const it = traverse(start, shouldStopTraversal)
    let yieldedCount = 0;
    for await (const entry of it) {
      yieldedCount++;
      console.log(`[oplog/log.js] iterator() received entry #${yieldedCount} from traverse(): ${entry.hash} for log ID: ${id}`);
      const skipFirst = (lt && Entry.isEqual(entry, start))
      const skipLast = (gt && Entry.isEqual(entry, end))
      const skip = skipFirst || skipLast
      if (!skip) {
        if (useBuffer) { buffer.set(index++, entry.hash) }
        else {
          console.log(`[oplog/log.js] iterator() yielding entry: ${entry.hash} for log ID: ${id}`);
          yield entry
        }
      }
    }
    console.log(`[oplog/log.js] iterator() traverse() loop COMPLETED for log ID: ${id}. Total received from traverse: ${yieldedCount}`);
    if (useBuffer) {
      console.log(`[oplog/log.js] iterator() processing buffer for log ID: ${id}`);
      const endIndex = buffer.keys.length
      const startIndex = endIndex > amount ? endIndex - amount : 0
      const keys = buffer.keys.slice(startIndex, endIndex)
      for (const key of keys) {
        const hash = buffer.get(key)
        const entry = await get(hash)
        console.log(`[oplog/log.js] iterator() yielding buffered entry: ${entry.hash} for log ID: ${id}`);
        yield entry
      }
    }
    console.log(`[oplog/log.js] iterator() COMPLETED for log ID: ${id}`);
  }

  /**
   * Clear all entries from the log and the underlying storages
   * @memberof module:Log~Log
   * @instance
   */
  const clear = async () => {
    await _index.clear()
    await _heads.clear()
    await _entries.clear()
  }

  /**
   * Close the log and underlying storages
   * @memberof module:Log~Log
   * @instance
   */
  const close = async () => {
    await _index.close()
    await _heads.close()
    await _entries.close()
  }

  /**
   * Check if an object is a Log.
   * @param {Log} obj
   * @return {boolean}
   * @memberof module:Log~Log
   * @instance
   */
  const isLog = (obj) => {
    return obj && obj.id !== undefined &&
      obj.clock !== undefined &&
      obj.heads !== undefined &&
      obj.values !== undefined &&
      obj.access !== undefined &&
      obj.identity !== undefined &&
      obj.storage !== undefined
  }

  /**
   * Get an array of references to multiple entries in the past.
   * @param {Array<Entry>} heads An array of Log heads starting rom which the references are collected from.
   * @param {number} amount The number of references to return.
   * @return {Array<string>}
   * @private
   */
  const getReferences = async (heads, amount = 0) => {
    let refs = []
    const shouldStopTraversal = async (entry) => {
      return refs.length >= amount && amount !== -1
    }
    for await (const { hash } of traverse(heads, shouldStopTraversal)) {
      refs.push(hash)
    }
    refs = refs.slice(heads.length + 1, amount)
    return refs
  }

  return {
    id,
    clock,
    heads,
    values,
    all: values, // Alias for values()
    get,
    has,
    append,
    join,
    joinEntry,
    traverse,
    iterator,
    clear,
    close,
    access,
    identity,
    storage: _entries
  }
}

export { Clock, Log as default, DefaultAccessController }

