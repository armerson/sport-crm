import assert from 'node:assert/strict'
import test from 'node:test'
import { reloadWhenAppUpdates } from '../src/registerAppUpdates.ts'

test('an activated app release reloads the open shell once', () => {
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  let controllerChange: (() => void) | undefined
  let reloads = 0

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serviceWorker: {
        addEventListener: (name: string, listener: () => void) => {
          if (name === 'controllerchange') controllerChange = listener
        },
      },
    },
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { reload: () => { reloads += 1 } } },
  })

  try {
    reloadWhenAppUpdates()
    assert.ok(controllerChange)
    controllerChange()
    controllerChange()
    assert.equal(reloads, 1)
  } finally {
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator)
    else Reflect.deleteProperty(globalThis, 'navigator')
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})
