import { describe, expect, it } from 'vitest'
import { FakeStorage } from '../test/fakeStorage'
import { browserStorage, createKv } from './kv'

describe('kv.get', () => {
  it.each([
    ['missing key', {}, undefined],
    ['JSON string', { k: '"light"' }, 'light'],
    ['JSON array', { k: '[1,2]' }, [1, 2]],
    ['JSON null', { k: 'null' }, null],
    ['broken JSON', { k: '{oops' }, undefined],
    ['empty text', { k: '' }, undefined],
  ])('%s', (_, items: Record<string, string>, expected) => {
    expect(createKv(() => new FakeStorage(items)).get('k')).toEqual(expected)
  })

  it('throwing storage → no value', () => {
    const kv = createKv(() => new FakeStorage({ k: '1' }, { throwOnRead: true }))
    expect(kv.get('k')).toBeUndefined()
  })

  it('no storage at all → no value', () => {
    expect(createKv(() => null).get('k')).toBeUndefined()
  })
})

describe('kv.set', () => {
  it('writes JSON.stringify text', () => {
    const fake = new FakeStorage()
    const kv = createKv(() => fake)
    kv.set('a', 'kids')
    kv.set('b', { order: [2, 1], ans: { 1: true } })
    kv.set('c', null)
    expect(fake.snapshot()).toEqual({
      a: '"kids"',
      b: '{"order":[2,1],"ans":{"1":true}}',
      c: 'null',
    })
  })

  it.each([
    ['write throws', { throwOnWrite: true }],
    ['read and write throw', { throwOnRead: true, throwOnWrite: true }],
  ])('%s → value kept in memory for the session', (_, options) => {
    const fake = new FakeStorage({ k: '"old"' }, options)
    const kv = createKv(() => fake)
    expect(() => {
      kv.set('k', 'new')
    }).not.toThrow()
    expect(kv.get('k')).toBe('new')
    expect(kv.has('k')).toBe(true)
    expect(fake.items.get('k')).toBe('"old"')
  })

  it('memory value is a copy: changing the written object does not change what is read', () => {
    const kv = createKv(() => null)
    const value = { order: [1] }
    kv.set('k', value)
    value.order.push(2)
    expect(kv.get('k')).toEqual({ order: [1] })
  })

  it('a later successful write replaces the memory value', () => {
    let fail = true
    const fake = new FakeStorage()
    const kv = createKv(() => ({
      getItem: (key) => fake.getItem(key),
      setItem: (key, value) => {
        if (fail) throw new Error('quota')
        fake.setItem(key, value)
      },
    }))
    kv.set('k', 1)
    fail = false
    kv.set('k', 2)
    fake.items.set('k', '3')
    expect(kv.get('k')).toBe(3)
  })
})

describe('kv.has', () => {
  it.each([
    ['missing', {}, false],
    ['any text, even broken JSON', { k: '{oops' }, true],
    ['"null" text', { k: 'null' }, true],
  ])('%s', (_, items: Record<string, string>, expected) => {
    expect(createKv(() => new FakeStorage(items)).has('k')).toBe(expected)
  })

  it('throwing storage → no', () => {
    expect(createKv(() => new FakeStorage({ k: '1' }, { throwOnRead: true })).has('k')).toBe(false)
  })
})

describe('browserStorage', () => {
  it('is the page localStorage', () => {
    expect(browserStorage()).toBe(globalThis.localStorage)
  })
})
