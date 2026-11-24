export async function communityRequest(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options,
    ...(options.body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options.body) } : {}),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Сервис недоступен. Попробуйте позже.')
  return data
}
