const apiHeaders = { Accept: 'application/json' }

export function readCsrfCookie() {
  const cookie = document.cookie.split('; ').find((item) => item.startsWith('XSRF-TOKEN='))
  return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : ''
}

export async function prepareCsrf() {
  const response = await fetch('/api/csrf-cookie', {
    credentials: 'include',
    headers: apiHeaders,
  })

  if (!response.ok || !readCsrfCookie()) {
    throw new Error('Could not start a secure login session. Please try again.')
  }
}

export async function login({ email, password, remember }) {
  await prepareCsrf()

  const response = await fetch('/api/login', {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...apiHeaders,
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': readCsrfCookie(),
    },
    body: JSON.stringify({ email, password, remember }),
  })
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.errors?.email?.[0] || result.message || 'Login failed. Please try again.')
  }

  return result.user
}

export async function register({ name, email, password, passwordConfirmation }) {
  await prepareCsrf()
  const response = await fetch('/api/register', {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...apiHeaders,
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': readCsrfCookie(),
    },
    body: JSON.stringify({ name, email, password, password_confirmation: passwordConfirmation }),
  })
  const result = await response.json()
  if (!response.ok) {
    const error = new Error(Object.values(result.errors || {}).flat()[0] || result.message || 'Registration failed. Please try again.')
    error.status = response.status
    throw error
  }
  return result.user
}

export async function getAuthenticatedUser() {
  const response = await fetch('/api/user', {
    credentials: 'include',
    headers: apiHeaders,
  })

  if (response.status === 401) return null
  if (!response.ok) throw new Error('Could not check the login session.')

  const result = await response.json()
  return result.user
}

export async function resetPassword({ email, password, passwordConfirmation }) {
  await prepareCsrf()
  const response = await fetch('/api/reset-password', {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...apiHeaders,
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': readCsrfCookie(),
    },
    body: JSON.stringify({ email, password, password_confirmation: passwordConfirmation }),
  })
  const result = await response.json()
  if (!response.ok) {
    const error = new Error(Object.values(result.errors || {}).flat()[0] || result.message || 'Rivendosja e fjalëkalimit dështoi.')
    error.status = response.status
    throw error
  }
  return result
}

export async function logout() {
  await prepareCsrf()

  const response = await fetch('/api/logout', {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...apiHeaders,
      'X-XSRF-TOKEN': readCsrfCookie(),
    },
  })

  if (!response.ok) throw new Error('Could not log out. Please try again.')
}
