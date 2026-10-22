/**
 * Removes the query string from the address bar WITHOUT a navigation: the page has read what the
 * link carried (a provider's return parameters, a password-reset key) and keeping it would leave it
 * in the history and in the next screenshot, bookmark or shared URL (sprint 138c).
 */
export function dropQueryString(
  history: Pick<History, 'replaceState' | 'state'> = window.history,
  location: Pick<Location, 'search' | 'pathname'> = window.location,
): void {
  if (location.search === '') {
    return;
  }
  history.replaceState(history.state, '', location.pathname);
}
