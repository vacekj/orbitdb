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
  const storage = storageParam || await DefaultStorage();

  const put = async (headsInput) => {
    const headsToStore = findHeads(headsInput);
    for (const head of headsToStore) {
      await storage.put(head.hash, head.bytes);
    }
  }

  const set = async (headsToSet) => {
    await storage.clear();
    await put(headsToSet);
  }

  const add = async (head) => {
    const currentHeads = await all()
    if (currentHeads.find(e => Entry.isEqual(e, head))) {
      return
    }
    const newHeads = findHeads([...currentHeads, head])
    await set(newHeads)
    return newHeads
  }

  const remove = async (hash) => {
    const currentHeads = await all()
    const newHeads = currentHeads.filter(e => e.hash !== hash)
    await set(newHeads)
  }

  const iterator = async function* () {
    const it = storage.iterator();
    let count = 0;
    for await (const [, bytes] of it) { // Assuming it yields [key, value] or just value
      count++;
      const head = await Entry.decode(bytes);
      yield head;
    }
  }

  const all = async () => {
    const values = [];
    let entryCount = 0;
    for await (const head of iterator()) {
      entryCount++;
      values.push(head);
    }
    return values;
  }

  const clear = async () => {
    await storage.clear()
  }

  const close = async () => {
    await storage.close()
  }

  await put(headsParam || [])

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
