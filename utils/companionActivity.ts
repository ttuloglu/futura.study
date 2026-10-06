type CompanionActivity = {
  planning: boolean;
  generating: boolean;
  composerOpen: boolean;
  modalOpen: boolean;
  completedBooks: number;
};

let activity: CompanionActivity = { planning: false, generating: false, composerOpen: false, modalOpen: false, completedBooks: 0 };
const listeners = new Set<() => void>();

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
