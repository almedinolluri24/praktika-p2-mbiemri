const staffRoles = new Set(['restaurant_manager', 'kitchen_worker', 'pickup_worker'])

export function getPostAuthDestination(role, action) {
  return {
    admin: role === 'administrator',
    staff: staffRoles.has(role),
    orders: role === 'customer' && action === 'login',
  }
}
