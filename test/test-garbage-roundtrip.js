/* eslint-env mocha */

import garbage from 'garbage'
import { decode, encode } from '../cborg.js'
import chai from 'chai'

const { assert } = chai

describe('Garbage round-trip', () => {
  it('random objects', () => {
    for (let i = 0; i < 10000; i++) {
      const obj = garbage()
      const byts = encode(obj)
      const decoded = decode(byts)
      assert.deepEqual(decoded, obj)
    }
  })
})
