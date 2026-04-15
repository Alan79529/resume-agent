import { describe, expect, it } from 'vitest'
import { createSingleRunLock } from '../../../../src/main/services/agent/run-lock'

describe('single run lock', () => {
  it('allows only one active run at a time', () => {
    const lock = createSingleRunLock()

    expect(lock.tryAcquire('run-1')).toBe(true)
    expect(lock.tryAcquire('run-2')).toBe(false)
    expect(lock.isBusy()).toBe(true)

    lock.release('wrong-run')
    expect(lock.isBusy()).toBe(true)

    lock.release('run-1')
    expect(lock.isBusy()).toBe(false)
    expect(lock.tryAcquire('run-3')).toBe(true)
  })
})
