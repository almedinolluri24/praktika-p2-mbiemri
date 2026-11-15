import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { prepareCsrf, readCsrfCookie } from './auth.js'

let echoPromise

async function getEcho() {
  const key = import.meta.env.VITE_REVERB_APP_KEY
  if (!key) return null
  if (echoPromise) return echoPromise

  echoPromise = (async () => {
    await prepareCsrf()
    window.Pusher = Pusher
    return new Echo({
      broadcaster: 'reverb',
      key,
      wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
      wsPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
      wssPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
      forceTLS: (import.meta.env.VITE_REVERB_SCHEME || 'http') === 'https',
      enabledTransports: ['ws', 'wss'],
      authEndpoint: '/broadcasting/auth',
      auth: { headers: { 'X-XSRF-TOKEN': readCsrfCookie() } },
      withCredentials: true,
    })
  })().catch(() => {
    echoPromise = null
    return null
  })

  return echoPromise
}

export async function subscribeToOrderUpdates(user, onUpdate, onConnection) {
  const echo = await getEcho()
  if (!echo) {
    onConnection('unavailable')
    return () => {}
  }

  const channels = user.role === 'customer'
    ? [`orders.customer.${user.id}`]
    : (user.branch_ids || []).map((branchId) => `branches.${branchId}`)

  channels.forEach((channel) => echo.private(channel).listen('.order.updated', onUpdate))
  const connection = echo.connector.pusher.connection
  const stateChange = ({ current }) => {
    onConnection(current)
    if (current === 'connected') onUpdate()
  }
  connection.bind('state_change', stateChange)
  onConnection(connection.state || 'connecting')

  return () => {
    connection.unbind('state_change', stateChange)
    channels.forEach((channel) => echo.leave(channel))
  }
}
