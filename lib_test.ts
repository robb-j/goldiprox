import { assertEquals } from '@std/assert'
import { dot, template, tryUrl } from './lib.ts'

//
// dot
//
Deno.test('#dot returns a value', () => {
  const input = {
    a: 42,
  }
  assertEquals(
    dot(input, ['a']),
    42,
    'It dereference an object to get a value',
  )
})
Deno.test('#dot returns nested values', () => {
  const input = {
    a: { b: { c: 42 } },
  }
  assertEquals(
    dot(input, ['a', 'b', 'c']),
    42,
    'It should navigate through the objects to get a nested value',
  )
})
Deno.test('#dot returns undefiend when not found', () => {
  assertEquals(
    dot({}, ['key']),
    undefined,
    'It should return undefined if a value is not found',
  )
})
Deno.test('#dot returns undefiend when not found with nesting', () => {
  assertEquals(
    dot({ a: { b: 42 } }, ['a', 'c']),
    undefined,
    'It should return undefined if a value is not found',
  )
})

//
// template
//
Deno.test('#template returns the processed string', () => {
  assertEquals(
    template('hello world', {}),
    'hello world',
    'with no values it should return the template string',
  )
})
Deno.test('#template replaces a value in the template', () => {
  assertEquals(
    template('hello {{ name }}', { name: 'geoff' }),
    'hello geoff',
    'with a matching value it should replace it in the string',
  )
})
Deno.test('#template replaces multiple value in the template', () => {
  assertEquals(
    template('hello {{ name }}, you are {{ age }}', { name: 'geoff', age: 42 }),
    'hello geoff, you are 42',
    'with matching values it should replace it in the string',
  )
})
Deno.test('#template replaces nested value in the template', () => {
  assertEquals(
    template('hello {{ user.name }}', { user: { name: 'geoff' } }),
    'hello geoff',
    'with matching values it should replace it in the string',
  )
})
Deno.test('#template replaces missing values with an empty string', () => {
  assertEquals(
    template('hello {{ user.name }}', {}),
    'hello ',
    'with matching values it should replace it in the string',
  )
})

//
// tryUrl
//
Deno.test('#tryUrl should return the parsed URL', () => {
  const result = tryUrl('https://example.com/path/')
  assertEquals(result?.toString(), 'https://example.com/path/')
})
Deno.test('#tryUrl should return null for invalid URLs', () => {
  const result = tryUrl('example.com/path/')
  assertEquals(result, null)
})
