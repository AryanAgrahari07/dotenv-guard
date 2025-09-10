// vitest.setup.js
const { webcrypto } = require('crypto')

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto
}
