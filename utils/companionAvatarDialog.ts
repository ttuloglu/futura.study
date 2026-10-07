let pending: Promise<void> | undefined;
export function isCompanionAvatarPickerOpen() { return Boolean(pending); }
export function showCompanionAvatarPicker(): Promise<void> {
  if (pending) return pending;
  let finish: () => void;
  pending = new Promise<void>(resolve => { finish = resolve; });
  window.dispatchEvent(new CustomEvent('fortale:companion-avatar-picker', { detail: { close: () => {
    pending = undefined;
    window.dispatchEvent(new Event('fortale:companion-avatar-picker-closed'));
    finish();
  } } }));
  return pending;
}
