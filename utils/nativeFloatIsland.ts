import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type NativeFloatIslandAction = 'home' | 'books' | 'settings' | 'create';

export interface NativeFloatIslandState {
  active: NativeFloatIslandAction;
  visible: boolean;
  unreadCount?: number;
  labels: {
    home: string;
    books: string;
    settings: string;
    create: string;
    navigation: string;
  };
}

export interface NativeKeyboardState { visible: boolean; top: number }

interface NativeFloatIslandPlugin {
  show(options: NativeFloatIslandState): Promise<void>;
  update(options: NativeFloatIslandState): Promise<void>;
  hide(): Promise<void>;
  getKeyboardState(): Promise<NativeKeyboardState>;
  addListener(eventName: 'action', listener: (event: { action: NativeFloatIslandAction }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'keyboardGeometry', listener: (event: NativeKeyboardState) => void): Promise<PluginListenerHandle>;
}

const NativeFloatIsland = registerPlugin<NativeFloatIslandPlugin>('NativeFloatIsland');

export const supportsNativeFloatIsland = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

export { NativeFloatIsland };
