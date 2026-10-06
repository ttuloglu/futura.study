export function composerViewport(layoutHeight: number, viewportHeight: number, viewportTop: number, keyboard?: { visible: boolean; top: number }) {
  const isKeyboard = Boolean(keyboard?.visible) || layoutHeight - viewportHeight > 120;
  const rawHeight = keyboard?.visible && keyboard.top > 0
    ? keyboard.top
    : (viewportHeight || layoutHeight);
  const height = Math.min(layoutHeight, Math.max(280, rawHeight));
  return { top: 0, height, keyboard: isKeyboard };
}
