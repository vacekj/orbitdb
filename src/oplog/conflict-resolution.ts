import { compareClocks } from './clock.js'

export interface Entry {
  clock: {
    id: string;
    time: number;
  };
  [key: string]: any;
}

type ConflictResolver = (a: Entry, b: Entry) => number;

/**
 * Sort two entries as Last-Write-Wins (LWW).
 *
 * Last Write Wins is a conflict resolution strategy for sorting elements
 * where the element with a greater clock (latest) is chosen as the winner.
 *
 * @param {Entry} a First entry
 * @param {Entry} b Second entry
 * @return {number} 1 if a is latest, -1 if b is latest
 * @private
 */
function LastWriteWins (a: Entry, b: Entry): number {
  // Ultimate conflict resolution (take the first/left arg)
  const First = (a: Entry, b: Entry): number => 1
  // Sort two entries by their clock id, if the same always take the first
  const sortById = (a: Entry, b: Entry): number => SortByClockId(a, b, First)
  // Sort two entries by their clock time, if concurrent,
  // determine sorting using provided conflict resolution function
  const sortByEntryClocks = (a: Entry, b: Entry): number => SortByClocks(a, b, sortById)
  // Sort entries by clock time as the primary sort criteria
  return sortByEntryClocks(a, b)
}

/**
 * Sort two entries by their clock time.
 * @param {Entry} a First entry to compare
 * @param {Entry} b Second entry to compare
 * @param {function(a, b)} resolveConflict A function to call if entries are
 * concurrent (happened at the same time). The function should take in two
 * entries and return 1 if the first entry should be chosen and -1 if the
 * second entry should be chosen.
 * @return {number} 1 if a is greater, -1 if b is greater
 * @private
 */
function SortByClocks (a: Entry, b: Entry, resolveConflict: ConflictResolver): number {
  // Compare the clocks
  const diff = compareClocks(a.clock, b.clock)
  // If the clocks are concurrent, use the provided
  // conflict resolution function to determine which comes first
  return diff === 0 ? resolveConflict(a, b) : diff
}

/**
 * Sort two entries by their clock id.
 * @param {Entry} a First entry to compare
 * @param {Entry} b Second entry to compare
 * @param {function(a, b)} resolveConflict A function to call if the clocks ids
 * are the same. The function should take in two entries and return 1 if the
 * first entry should be chosen and -1 if the second entry should be chosen.
 * @return {number} 1 if a is greater, -1 if b is greater
 * @private
 */
function SortByClockId (a: Entry, b: Entry, resolveConflict: ConflictResolver): number {
  // Sort by ID if clocks are concurrent,
  // take the entry with a "greater" clock id
  return a.clock.id === b.clock.id
    ? resolveConflict(a, b)
    : a.clock.id < b.clock.id ? -1 : 1
}

/**
 * A wrapper function to throw an error if the results of a passed function
 * return zero
 * @param {function(a, b)} [tiebreaker] The tiebreaker function to validate.
 * @return {function(a, b)} 1 if a is greater, -1 if b is greater
 * @throws {Error} if func ever returns 0
 * @private
 */
function NoZeroes (func: ConflictResolver): ConflictResolver {
  const msg = `Your log's tiebreaker function, ${func.name}, has returned zero and therefore cannot be`

  const comparator = (a: Entry, b: Entry): number => {
    // Validate by calling the function
    const result = func(a, b)
    if (result === 0) { throw Error(msg) }
    return result
  }

  return comparator
}

export default {
  SortByClocks,
  SortByClockId,
  LastWriteWins,
  NoZeroes
}
