/**
 * The custom service worker activates releases immediately. Reload the open
 * shell when its controller changes so an installed app cannot keep rendering
 * JavaScript and styles from the previous release.
 */
export function reloadWhenAppUpdates() {
  if (!('serviceWorker' in navigator)) return

  let isReloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isReloading) return
    isReloading = true
    window.location.reload()
  })
}
