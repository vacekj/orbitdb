export const posixJoin = (...paths: string[]): string => paths
  .join('/')
  .replace(/((?<=\/)\/+)|(^\.\/)|((?<=\/)\.\/)/g, '') || '.'

export const win32Join = (...paths: string[]): string => paths
  .join('\\')
  .replace(/\//g, '\\')
  .replace(/((?<=\\)\\+)|(^\.\\)|((?<=\\)\.\\)/g, '') || '.'

export const join = posixJoin

export default posixJoin
