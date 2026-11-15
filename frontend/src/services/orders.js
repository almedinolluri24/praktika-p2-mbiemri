import { prepareCsrf, readCsrfCookie } from './auth.js'

export async function createPickupOrder({ branchId, items, scheduleType = 'asap', pickupAt = null, expectedTotal = null, customerNote = null }) {
  await prepareCsrf()
  const response = await fetch('/api/orders', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': readCsrfCookie(),
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      branch_id: branchId,
      schedule_type: scheduleType,
      ...(scheduleType === 'scheduled' ? { pickup_at: pickupAt } : {}),
      payment_method: 'cash_at_pickup',
      expected_total: Number(expectedTotal).toFixed(2),
      customer_note: customerNote ? customerNote.trim() : null,
      items: items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        options: item.selectedOptions,
      })),
    }),
  })
  const result = await response.json()
  if (!response.ok) {
    const message = Object.values(result.errors || {}).flat()[0]
    const error = new Error(message || result.message || 'Could not place your pickup order.')
    error.status = response.status
    error.payload = result
    throw error
  }
  return result
}
