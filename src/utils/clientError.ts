const URL_WITH_PRIVATE_SUFFIX = /([a-z][a-z0-9+.-]*:\/\/[^\s?#)]+)[?#][^\s)]*/gi

/** Removes URL query strings/fragments and control characters before diagnostics leave the browser. */
export function sanitizeClientErrorText(value: unknown, maxLength: number): string {
  const text = value instanceof Error ? `${value.name}: ${value.message}` : String(value ?? '')
  const withoutPrivateUrls = text.replace(URL_WITH_PRIVATE_SUFFIX, '$1')
  const withoutControls = [...withoutPrivateUrls]
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)
    })
    .join('')
  return withoutControls.slice(0, maxLength)
}

export function safeClientRoute(location: Pick<Location, 'pathname'>): string {
  return sanitizeClientErrorText(location.pathname || '/', 500) || '/'
}
