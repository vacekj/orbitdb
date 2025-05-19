import { base58btc } from "multiformats/bases/base58";
/**
 * @module Address
 * @description OrbitDB database address verification.
 */
import { CID } from "multiformats/cid";
import { posixJoin } from "./utils/path-join.js";

/**
 * Validates an OrbitDB database address.
 * @function
 * @param {module:Address~OrbitDBAddress|string} address An OrbitDB database address.
 * @return {boolean} True if the address is a valid OrbitDB database address,
 * false otherwise.
 * @static
 */
const isValidAddress = (addressInput) => {
  const addressStr = addressInput.toString();
  if (!addressStr.startsWith("/orbitdb") && !addressStr.startsWith("\\orbitdb")) {
    return false;
  }
  let path = addressStr.replaceAll("/orbitdb/", "").replaceAll("\\orbitdb\\", "");
  path = path.replaceAll("/", "").replaceAll("\\", "");
  try {
    CID.parse(path, base58btc);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Parses an OrbitDB database address.
 * @function
 * @param {module:Address~OrbitDBAddress|string} address An OrbitDB database address.
 * @return {module:Address~OrbitDBAddress} An OrbitDB database address.
 * @throws Invalid OrbitDB address if the address is not valid.
 * @static
 */
const OrbitDBAddress = (address) => {
  const rawAddress = address.toString();
  const protocol = "orbitdb";
  let hash;

  if (
    rawAddress.startsWith("/orbitdb/") ||
    rawAddress.startsWith("\\orbitdb\\")
  ) {
    // It's a full path, extract the hash
    if (!isValidAddress(rawAddress)) {
      // Validate if it claims to be full
      throw new Error(`Invalid OrbitDB address ${rawAddress}`);
    }
    hash = rawAddress.substring(rawAddress.lastIndexOf("/") + 1);
  } else {
    // Assume it's a bare CID or a name (though names are usually handled before this specific constructor)
    // For now, let's try to parse it as a CID directly.
    // If it's not a CID, CID.parse will throw, and that's an issue with the input.
    try {
      CID.parse(rawAddress, base58btc); // Just validate it's a CID
      hash = rawAddress; // The raw address IS the hash if it's a bare CID
    } catch (e) {
      // This case should ideally be handled before OrbitDBAddress is called with a simple name.
      // When OrbitDB creates a new DB, it calls this with the manifest hash (a bare CID).
      console.warn(
        `[orbitdb/src/address.js] Address input '${rawAddress}' is not a full OrbitDB path nor a bare CID. This might be an issue if it's not a DB name being resolved elsewhere.`,
      );
      // For robust internal handling, if it's not a CID, it might be a name.
      // However, the call stack shows this is hit after a manifest hash is created.
      // So, if it's not a CID here, it IS an error.
      throw new Error(
        `Cannot parse '${rawAddress}' as OrbitDB address or CID.`,
      );
    }
  }

  const toStringFn = () => {
    return posixJoin("/", protocol, hash);
  };

  return {
    protocol,
    hash,
    address: toStringFn(), // The full address string
    toString: toStringFn,
  };
};

export {
  OrbitDBAddress as default,
  isValidAddress,
  OrbitDBAddress as parseAddress
};

