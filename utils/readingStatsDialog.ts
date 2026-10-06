let open = false;
export function isReadingStatsOpen() { return open; }
export function showReadingStats(): Promise<void> {
  if (open) return Promise.resolve();
  open = true;
  return new Promise(resolve => {
    window.dispatchEvent(new CustomEvent('fortale:reading-stats', { detail: { close: () => { open=false; window.dispatchEvent(new Event('fortale:reading-stats-closed')); resolve(); } } }));
  });
}
