import type { CompanionCommand } from './companionBehavior';

type CompanionActivity = {
  planning: boolean;
  generating: boolean;
  composerOpen: boolean;
  modalOpen: boolean;
  completedBooks: number;
  excited: boolean;
  command: CompanionCommand;
  hidden: boolean;
};

function readHidden() {
  try { return localStorage.getItem('fortale-companion-hidden') === 'true'; } catch { return false; }
}
let activity: CompanionActivity = { planning: false, generating: false, composerOpen: false, modalOpen: false, completedBooks: 0, excited: false, command: 'auto', hidden: readHidden() };
const listeners = new Set<() => void>();
let excitementTimer: ReturnType<typeof setTimeout>;
let commandTimer: ReturnType<typeof setTimeout>;
const publish = () => listeners.forEach(listener => listener());

export const getCompanionActivity = () => activity;
export const subscribeCompanionActivity = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

// Presentation only: these signals never control or change a generation job.
export function setCompanionActivity(field: 'planning' | 'generating' | 'composerOpen' | 'modalOpen', value: boolean) {
  if (activity[field] === value) return;
  activity = { ...activity, [field]: value };
  listeners.forEach(listener => listener());
}

export function celebrateCompletedBook() {
  activity = { ...activity, completedBooks: activity.completedBooks + 1 };
  listeners.forEach(listener => listener());
}

export function exciteCompanion() {
  clearTimeout(excitementTimer);
  activity = { ...activity, excited: true };
  publish();
  excitementTimer = setTimeout(() => { activity = { ...activity, excited: false }; publish(); }, 3200);
}

export function setCompanionCommand(command: CompanionCommand) {
  clearTimeout(commandTimer);
  activity = { ...activity, command };
  publish();
  if (command !== 'auto') commandTimer = setTimeout(() => {
    activity = { ...activity, command: 'auto' }; publish();
  }, 14000);
}

export function setCompanionHidden(hidden: boolean) {
  activity = { ...activity, hidden };
  try { localStorage.setItem('fortale-companion-hidden', String(hidden)); } catch { /* Session still works without storage. */ }
  publish();
}
