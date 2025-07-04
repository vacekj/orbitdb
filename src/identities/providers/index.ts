import PublicKeyIdentityProvider from './publickey.js'

interface IdentityProvider {
  type: string
  verifyIdentity: (identity: any) => Promise<boolean>
  (params: any): () => Promise<any>
}

const identityProviders: Record<string, IdentityProvider> = {}

const isProviderSupported = (type: string): boolean => {
  return Object.keys(identityProviders).includes(type)
}

const getIdentityProvider = (type: string): IdentityProvider => {
  if (!isProviderSupported(type)) {
    throw new Error(`IdentityProvider type '${type}' is not supported`)
  }

  return identityProviders[type]
}

/**
  * Adds an identity provider.
  * @param {IdentityProvider} identityProvider The identity provider to add.
  * @throws Given IdentityProvider doesn\'t have a field \'type\'.
  * @throws Given IdentityProvider doesn\'t have a function \'verifyIdentity\'.
  * @throws IdentityProvider ${IdentityProvider.type} already added.
  * @static
  * @memberof module:Identities
  */
const useIdentityProvider = (identityProvider: IdentityProvider): void => {
  if (!identityProvider.type ||
     typeof identityProvider.type !== 'string') {
    throw new Error('Given IdentityProvider doesn\'t have a field \'type\'.')
  }

  if (!identityProvider.verifyIdentity) {
    throw new Error('Given IdentityProvider doesn\'t have a function \'verifyIdentity\'.')
  }

  identityProviders[identityProvider.type] = identityProvider
}

useIdentityProvider(PublicKeyIdentityProvider)

export { useIdentityProvider, getIdentityProvider, PublicKeyIdentityProvider }