import MemoryStorage from '../storage/memory.js';
import Entry from './entry.js';

const DefaultStorage = MemoryStorage

export interface HeadsParams {
  storage?: any;
  heads?: any[];
}

const Heads = async ({ storage: storageParam, heads: headsParam }: HeadsParams) => {
  const storage = storageParam || await DefaultStorage();

  const put = async (headsInput: any[]): Promise<void> => {
    const headsToStore = findHeads(headsInput);
    for (const head of headsToStore) {
      await storage.put(head.hash, head.bytes);
    }
  }

  const set = async (headsToSet: any[]): Promise<void> => {
    await storage.clear();
    await put(headsToSet);
  }

  const add = async (head: any): Promise<any[] | undefined> => {
    const currentHeads = await all()
    if (currentHeads.find(e => Entry.isEqual(e, head))) {
      return
    }
    const newHeads = findHeads([...currentHeads, head])
    await set(newHeads)
    return newHeads
  }

  const remove = async (hash: string): Promise<void> => {
    const currentHeads = await all()
    const newHeads = currentHeads.filter(e => e.hash !== hash)
    await set(newHeads)
  }

  const iterator = async function* (): AsyncGenerator<any> {
    const it = storage.iterator();
    let count = 0;
    for await (const [, bytes] of it) {
      count++;
      const head = await Entry.decode(bytes);
      yield head;
    }
  }

  const all = async (): Promise<any[]> => {
    const values: any[] = [];
    let entryCount = 0;
    for await (const head of iterator()) {
      entryCount++;
      values.push(head);
    }
    return values;
  }

  const clear = async (): Promise<void> => {
    await storage.clear()
  }

  const close = async (): Promise<void> => {
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

const findHeads = (entriesParam: any[]): any[] => {
  const entries = new Set(entriesParam);
  const items: { [key: string]: string } = {};
  for (const entry of Array.from(entries)) {
    for (const next of entry.next) {
      items[next] = entry.hash;
    }
  }
  const res: any[] = [];
  for (const entry of Array.from(entries)) {
    if (!items[entry.hash]) {
      res.push(entry);
    }
  }
  return res;
}

export default Heads
