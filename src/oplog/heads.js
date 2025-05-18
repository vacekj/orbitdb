import MemoryStorage from '../storage/memory.js';
/**
 * @namespace module:Log~Heads
 * @memberof module:Log
 * @description The log's heads.
 * @private
 */
import Entry from './entry.js';

const DefaultStorage = MemoryStorage

const Heads = async ({ storage: storageParam, heads: headsParam }) => {
  console.log(`[oplog/heads.js] Heads factory invoked. Initial heads count: ${headsParam ? headsParam.length : 0}`);
  const storage = storageParam || await DefaultStorage();
  console.log(`[oplog/heads.js] Heads storage type: ${storage ? storage.constructor.name : 'undefined'}`);

  const put = async (headsInput) => {
    console.log(`[oplog/heads.js] put() called. Processing ${headsInput ? headsInput.length : 0} heads.`);
    const headsToStore = findHeads(headsInput);
    console.log(`[oplog/heads.js] put() - after findHeads, ${headsToStore.length} heads to store.`);
    for (const head of headsToStore) {
      console.log(`[oplog/heads.js] put() storing head: ${head.hash}`);
      await storage.put(head.hash, head.bytes);
    }
    console.log("[oplog/heads.js] put() completed.");
  }

  const set = async (headsToSet) => {
    console.log(`[oplog/heads.js] set() called with ${headsToSet ? headsToSet.length : 0} heads.`);
    await storage.clear();
    console.log("[oplog/heads.js] set() storage cleared.");
    await put(headsToSet);
    console.log("[oplog/heads.js] set() completed.");
  }

  const add = async (head) => {
    console.log(`[oplog/heads.js] add() called with head: ${head ? head.hash : 'null/undefined'}`);
    const currentHeads = await all()
    console.log(`[oplog/heads.js] add() current heads count: ${currentHeads.length}`);
    if (currentHeads.find(e => Entry.isEqual(e, head))) {
      console.log(`[oplog/heads.js] add() head ${head.hash} already exists. Returning.`);
      return
    }
    const newHeads = findHeads([...currentHeads, head])
    console.log(`[oplog/heads.js] add() new heads count after findHeads: ${newHeads.length}`);
    await set(newHeads)
    console.log("[oplog/heads.js] add() completed.");
    return newHeads
  }

  const remove = async (hash) => {
    console.log(`[oplog/heads.js] remove() called with hash: ${hash}`);
    const currentHeads = await all()
    const newHeads = currentHeads.filter(e => e.hash !== hash)
    await set(newHeads)
    console.log("[oplog/heads.js] remove() completed.");
  }

  const iterator = async function* () {
    console.log("[oplog/heads.js] iterator() invoked");
    const it = storage.iterator();
    console.log("[oplog/heads.js] storage.iterator() obtained. Starting for-await loop...");
    let count = 0;
    for await (const [, bytes] of it) { // Assuming it yields [key, value] or just value
      count++;
      console.log(`[oplog/heads.js] iterator() received item #${count} from storage iterator.`);
      const head = await Entry.decode(bytes);
      console.log(`[oplog/heads.js] iterator() decoded head: ${head.hash}. Yielding...`);
      yield head;
    }
    console.log("[oplog/heads.js] iterator() for-await loop COMPLETED. Total yielded:", count);
  }

  const all = async () => {
    console.log("[oplog/heads.js] all() invoked");
    const values = [];
    console.log("[oplog/heads.js] all(): About to start for-await on local iterator()");
    let entryCount = 0;
    for await (const head of iterator()) {
      entryCount++;
      console.log(`[oplog/heads.js] all() received head #${entryCount} from its iterator: ${head ? head.hash : 'null/undefined'}`);
      values.push(head);
    }
    console.log("[oplog/heads.js] all() for-await loop COMPLETED. Total heads from local iterator:", entryCount, "Returning values array length:", values.length);
    return values;
  }

  const clear = async () => {
    console.log("[oplog/heads.js] clear() invoked");
    await storage.clear()
    console.log("[oplog/heads.js] clear() completed");
  }

  const close = async () => {
    console.log("[oplog/heads.js] close() invoked");
    await storage.close()
    console.log("[oplog/heads.js] close() completed");
  }

  console.log("[oplog/heads.js] Initializing heads storage by calling put()...");
  await put(headsParam || [])
  console.log("[oplog/heads.js] Heads storage initialized.");

  return {
    put,
    set,
    add,
    remove,
    iterator,
    all,
    clear,
    close
  }
}

/**
 * Find heads from a collection of entries.
 *
 * Finds entries that are the heads of this collection,
 * ie. entries that are not referenced by other entries.
 *
 * This function is private and not exposed in the Log API
 *
 * @param {Array<Entry>} entries Entries to search heads from
 * @return {Array<Entry>}
 * @private
 */
const findHeads = (entriesParam) => {
  const entries = new Set(entriesParam);
  const items = {};
  for (const entry of entries) {
    for (const next of entry.next) {
      items[next] = entry.hash;
    }
  }
  const res = [];
  for (const entry of entries) {
    if (!items[entry.hash]) {
      res.push(entry);
    }
  }
  return res;
}

export default Heads
