# cborg - fast CBOR with a focus on strictness

[CBOR](https://cbor.io/) is "Concise Binary Object Representation", defined by [RFC 8949](https://tools.ietf.org/html/rfc8949).

**cborg** focuses on strictness and deterministic data representations. CBORs flexibility leads to problems where determinism matters, such as in content-addressed data where your data encoding should converge on same-bytes for same-data. **cborg** helps aleviate these challenges.

**cborg** is also fast, and is suitable for the browser and Node.js.

**cborg** supports CBOR tags, but does not ship with them enabled by default. If you want tags, you need to plug them in to the encoder and decoder.

## Example

```js
import { encode, decode } from 'cborg'

const decoded = decode(Buffer.from('a16474686973a26269736543424f522163796179f5', 'hex'))
console.log('decoded:', decoded)
console.log('encoded:', encode(decoded))
```

```
decoded: { this: { is: 'CBOR!', yay: true } }
encoded: Uint8Array(21) [
  161, 100, 116, 104, 105, 115,
  162,  98, 105, 115, 101,  67,
   66,  79,  82,  33,  99, 121,
   97, 121, 245
]
```

## CLI

When installed globally via `npm` (with `npm install cborg --global`), the `cborg` command will be available that provides some handy CBOR CLI utilities. Run with `cborg help` for additional details.

### `cborg json2hex '<json string>'`

Convert a JSON object into CBOR bytes in hexadecimal format.

```
$ cborg json2hex '["a", "b", 1, "😀"]'
84616161620164f09f9880
```

### `cborg hex2json [--pretty] <hex string>`

Convert a hexadecimal string to a JSON format.

```
$ cborg hex2json 84616161620164f09f9880
["a","b",1,"😀"]
$ cborg hex2json --pretty 84616161620164f09f9880
[
  "a",
  "b",
  1,
  "😀"
]
```

### `cborg hex2diag <hex string>`

Convert a hexadecimal string to a CBOR diagnostic output format which explains the byte contents.

```
$ cborg hex2diag 84616161620164f09f9880
84                                                # array(4)
  61                                              #   string(1)
    61                                            #     "a"
  61                                              #   string(1)
    62                                            #     "b"
  01                                              #   uint(1)
  64 f09f                                         #   string(2)
    f09f9880                                      #     "😀"
```

## API

### `encode(object[, options])`

```js
import { encode } from 'cborg'
```

```js
const { encode } = require('cborg')
```

Encode a JavaScript object and return a `Uint8Array` with the CBOR byte representation.

* Objects containing circular references will be rejected.
* JavaScript objects that don't have standard CBOR type representations (without tags) may be rejected or encoded in surprising ways. If you need to encode a `Date` or a `RegExp` or another exotic type, you should either form them into intermediate forms before encoding or enable a tag encoder (see [Type encoders](#type-encoders)).
  * Supported types are: `null`, `undefined`, `number`, `bigint`, `string`, `boolean`, `Array`, `Object`, `Map`, `Buffer`, `ArrayBuffer`, `DataView`, `Uint8Array` and all other `TypedArray`s (their underlying byte array is encoded, so they will all round-trip as a `Uint8Array` since the type information is lost).
* `Number`s will be encoded as integers if they don't have a fractional part (`1` and `1.0` are both considered integers, they are identical in JavaScript). Otherwise they will be encoded as floats.
* Integers will be encoded to their smallest possible representations: compacted (into the type byte), 8-bit, 16-bit, 32-bit or 64-bit.
* Integers larger than `Number.MAX_SAFE_INTEGER` or less than `Number.MIN_SAFE_INTEGER` will be encoded as floats. There is no way to safely determine whether a number has a fractional part outside of this range.
* `BigInt`s are supported by default within the 64-bit unsigned range but will be also be encoded to their smallest possible representation (so will not round-trip as a `BigInt` if they are smaller than `Number.MAX_SAFE_INTEGER`). Larger `BigInt`s require a tag (officially tags 2 and 3).
* Floats will be encoded in their smallest possible representations: 16-bit, 32-bit or 64-bit.
* Object properties are sorted according to the original [RFC 7049](https://tools.ietf.org/html/rfc7049) canonical representation recommended method: length-first and then bytewise. Note that this recommendation has changed in [RFC 8949](https://tools.ietf.org/html/rfc8949) to be a plain bytewise (this is not currently supported but pull requests are welcome).
* The only CBOR major 7 "simple values" supported are `true`, `false`, `undefined` and `null`. "Simple values" outside of this range are intentionally not supported.
* Objects, arrays, strings and bytes are encoded as fixed-length, encoding as indefinite length is intentionally not supported.

#### Options

* `float64` (boolean, default `false`): do not attempt to store floats as their smallest possible form, store all floats as 64-bit
* `typeEncoders` (object): a mapping of type name to function that can encode that type into cborg tokens. See the [Type encoders](#type-encoders) section below for more information.

### `decode(data[, options])`

```js
import { decode } from 'cborg'
```

```js
const { decode } = require('cborg')
```

Decode valid CBOR bytes from a `Uint8Array` (or `Buffer`) and return a JavaScript object.

* Integers (major 0 and 1) that are outside of the safe integer range will be converted to a `BigInt`.
* The only CBOR major 7 "simple values" supported are `true`, `false`, `undefined` and `null`. "Simple values" outside of this range are intentionally not supported.

#### Options

* `allowIndefinite` (boolean, default `true`): when the indefinite length additional information (31) is encountered for any type (arrays, maps, strings, bytes) _or_ a "break" is encountered, an error will be thrown.
* `allowUndefined` (boolean, default `true`): when major 7, minor 23 (`undefined`) is encountered, an error will be thrown.
* `allowBigInt` (boolean, default `true`): when an integer outside of the safe integer range is encountered, an error will be thrown.
* `strict` (boolean, default `false`): when decoding integers, including for lengths (arrays, maps, strings, bytes), values will be checked to see whether they were encoded in their smallest possible form. If not, an error will be thrown.
  * Currently, this form of deterministic strictness cannot be enforced for float representations, or map key ordering (pull requests welcome!).
* `useMaps` (boolean, default `false`): when decoding major 5 (map) entries, use a `Map` rather than a plain `Object`. This will nest for any encountered map.
* `tags` (array): a mapping of tag number to tag decoder function. By default no tags are supported. See [Tag decoders](#tag-decoders).

### Type encoders

The `typeEncoders` property to the `options` argument to `encode()` allows you to add additional functionality to cborg, or override existing functionality.

When converting JavaScript objects, types are differentiated using [@sindresorhus/is](https://github.com/sindresorhus/is) and an internal set of type encoders are used to convert objects to their appropriate CBOR form. Supported types are: `null`, `undefined`, `number`, `bigint`, `string`, `boolean`, `Array`, `Object`, `Map`, `Buffer`, `ArrayBuffer`, `DataView`, `Uint8Array` and all other `TypedArray`s (their underlying byte array is encoded, so they will all round-trip as a `Uint8Array` since the type information is lost). Any object that doesn't match a type in this list will cause an error to be thrown during decode. e.g. `encode(new Date())` will throw an error because there is no internal `Date` type encoder.

The `typeEncoders` option is an object whose property names match to @sindresorhus/is type names. When this option is provided and a property exists for any given object's type, the function provided as the value to that property is called with the object as an argument.

If a type encoder function returns `null`, the default encoder, if any, is used instead.

If a type encoder function returns an array, cborg will expect it to contain zero or more `Token` objects that will be encoded to binary form.

`Token`s map directly to CBOR entities. Each one has a `Type` and a `value`. A type encoder is responsible for turning a JavaScript object into a set of tags.

This example is available from the cborg taglib as `bigIntEncoder` (`import { bigIntEncoder } as taglib from 'cborg/taglib'`) and implements CBOR tags 2 and 3 (bigint and negative bigint). This function would be registered using an options parameter `{ typeEncoders: { bigint: bigIntEncoder } }`. All objects that have a type `bigint` will pass through this function.

```js
import { Token, Type } from './cborg.js'

function bigIntEncoder (obj) {
  // check whether this BigInt could fit within a standard CBOR 64-bit int or less
  if (obj >= -1n * (2n ** 64n) && obj <= (2n ** 64n) - 1n) {
    return null // handle this as a standard int or negint
  }
  // it's larger than a 64-bit int, encode as tag 2 (positive) or 3 (negative)
  return [
    new Token(Type.tag, obj >= 0n ? 2 : 3),
    new Token(Type.bytes, fromBigInt(obj >= 0n ? obj : obj * -1n - 1n))
  ]
}

function fromBigInt (i) { /* returns a Uint8Array, omitted from example */ }
```

This example encoder demonstrates the ability to pass-through to the default encoder, or convert to a series of custom tags. In this case we can put any arbitrarily large `BigInt` into a byte array using the standard CBOR tag 2 and 3 types.

Valid `Token` types for the second argument to `Token()` are:

```js
Type.uint
Type.negint
Type.bytes
Type.string
Type.array
Type.map
Type.tag
Type.float
Type.false
Type.true
Type.null
Type.undefined
Type.break
```

Using type encoders we can:
 * Override the default encoder entirely (always return an array of `Token`s)
 * Override the default encoder for a subset of values (use `null` as a pass-through)
 * Omit an object type entirely from the encode (return an empty array)
 * Convert an object to something else entirely (such as a tag, or make all `number`s into floats)
 * Throw if something should that is supported should be unsupported (e.g. `undefined`)

### Tag decoders

By default cborg does not support decoding of any tags. Where a tag is encountered during decode, an error will be thrown. If tag support is needed, they will need to be supplied as options to the `decode()` function. The `tags` property should contain an array where the indexes correspond to the tags that are encountered during decode, and the values are functions that are able to turn the corresponding section of bytes to a JavaScript object. Each tag token in CBOR is followed by a byte array of arbitrary length. This byte array is supplied to the tag decoder function.

This example is available from the cborg taglib as `bigIntDecoder` and `bigNegIntDecoder` (`import { bigIntDecoder, bigNegIntDecoder } as taglib from 'cborg/taglib'`) and implements CBOR tags 2 and 3 (bigint and negative bigint). This function would be registered using an options parameter:

```js
const tags = []
tags[2] = bigIntDecoder
tags[3] = bigNegIntDecoder

decode(bytes, { tags })
```

Implementation:

```js
function bigIntDecoder (bytes) {
  let bi = 0n
  for (let ii = 0; ii < bytes.length; ii++) {
    bi = (bi << 8n) + BigInt(bytes[ii])
  }
  return bi
}

function bigNegIntDecoder (bytes) {
  return -1n - bigIntDecoder(bytes)
}
```

## Deterministic encoding recommendations

cborg is designed with deterministic encoding forms as a primary feature. It is suitable for use with content addressed systems or other systems where convergence of binary forms is important. The ideal is to have strictly _one way_ of mapping a set of data into a binary form. Unfortunately CBOR has many opportunities for flexibility, including:

* Varying number sizes and no strict requirement for their encoding - e.g. a `1` may be encoded as `0x01`, `0x1801`, `0x190001`, `1a00000001` or `1b0000000000000001`.
* Varying int sizes used as lengths for lengthed objects (maps, arrays, strings, bytes) - e.g. a single entry array could specify its length using any of the above forms for `1`.
* Indefinite length items where the length is omitted from the additional item of the entity token and a "break" is inserted to indicate the end of of the object. This provides two ways to encode the same object.
* Tags that can allow alternative representations of objects - e.g. using the bigint or negative bigint tags to represent standard size integers.
* Map ordering is flexible by default, so a single map can be represented in many different forms by shuffling the keys.
* Many CBOR decoders ignore trailing bytes that are not part of an initial object. This can be helpful to support streaming-CBOR, but opens avenues for byte padding.

By default, cborg will always **encode** objects to the same bytes by applying some strictness rules:

* Using smallest-possible representations for ints, negative ints, floats and lengthed object lengths.
* Always sorting maps using the original recommended [RFC 7049](https://tools.ietf.org/html/rfc7049) map key ordering rules.
* Omitting support for tags (therefore omitting support for exotic object types).
* Applying deterministic rules to `number` differentiation - if a fractional part is missing and it's within the safe integer boundary, it's encoded as an integer, otherwise it's encoded as a float.

By default, cborg allows for some flexibility on **decode** of objects, which will present some challenges if users wish to impose strictness requirements at both serialization _and_ deserialization. Options that can be provided to `decode()` to impose some strictness requirements are:

* `strict: true` to impose strict sizing rules for int, negative ints and lengths of lengthed objects
* `allowIndefinite: false` to disallow indefinite lengthed objects and the "break" tag
* Not providing any tag decoders, or ensuring that tag decoders are strict about their forms (e.g. a bigint decoder could reject bigints that could have fit into a standard major 0 64-bit integer).

Currently, there are two areas that cbor cannot impose strictness requirements (pull requests welcome!):

* Smallest-possible floats, or always-float64 cannot be enforced on decode.
* Map ordering cannot be enforced on decode.

## License and Copyright

Copyright 2020 Rod Vagg

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.