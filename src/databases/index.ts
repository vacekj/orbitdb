/**
 * @module Databases
 * @description
 * Provides various database structures for storing data.
 */
import Documents from './documents.js'
import Events from './events.js'
import KeyValue from './keyvalue.js'
import KeyValueIndexed from './keyvalue-indexed.js'

export interface DatabaseType {
  type: string;
  [key: string]: any;
}

const databaseTypes: { [key: string]: DatabaseType } = {}

/**
 * Add a new database type.
 * @example
 * import { useDatabaseType } from 'orbitdb'
 * const CustomDBTypeModule = async (params) => {
 *   const database = await Database(...params)
 *   ...
 * }
 * useDatabaseType(CustomDBTypeModule)
 * @function useDatabaseType
 * @param {DatabaseType} database A Database-compatible module.
 * @throws Database type does not contain required field 'type'.
 * @throws Database type '${store.type}' already added.
 * @memberof module:Databases
 */
const useDatabaseType = (database: DatabaseType): void => {
  if (!database.type) {
    throw new Error('Database type does not contain required field \'type\'')
  }

  databaseTypes[database.type] = database
}

const getDatabaseType = (type: string): DatabaseType => {
  if (!type) {
    throw new Error('Type not specified')
  }

  if (!databaseTypes[type]) {
    throw new Error(`Unsupported database type: '${type}'`)
  }

  return databaseTypes[type]
}

useDatabaseType(Events)
useDatabaseType(Documents)
useDatabaseType(KeyValue)

export { useDatabaseType, getDatabaseType, Documents, Events, KeyValue, KeyValueIndexed }
