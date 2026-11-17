import assert from 'node:assert/strict'
import test from 'node:test'
import { getPostAuthDestination } from './authDestination.js'

test('administrator login opens only the admin panel', () => {
  assert.deepEqual(getPostAuthDestination('administrator', 'login'), {
    admin: true,
    staff: false,
    orders: false,
  })
})

for (const role of ['restaurant_manager', 'kitchen_worker', 'pickup_worker']) {
  test(`${role} login opens the staff dashboard only`, () => {
    assert.deepEqual(getPostAuthDestination(role, 'login'), {
      admin: false,
      staff: true,
      orders: false,
    })
  })
}

test('customer login opens order history', () => {
  assert.deepEqual(getPostAuthDestination('customer', 'login'), {
    admin: false,
    staff: false,
    orders: true,
  })
})

test('customer registration leaves the storefront open', () => {
  assert.deepEqual(getPostAuthDestination('customer', 'register'), {
    admin: false,
    staff: false,
    orders: false,
  })
})

test('unknown roles never open privileged panels', () => {
  assert.deepEqual(getPostAuthDestination('visitor', 'login'), {
    admin: false,
    staff: false,
    orders: false,
  })
})
