export type CompanionMood = 'idle' | 'walk' | 'march' | 'clap' | 'think' | 'read' | 'sit' | 'exercise' | 'excited' | 'happy' | 'surprise' | 'banner';
export type CompanionCommand = 'auto' | 'sit' | 'walk' | 'exercise';

export function resolveCompanionMood({ reading, generating, planning, excited, command, spontaneous, behindSheet = false }: {
  reading: boolean; generating: boolean; planning: boolean; excited: boolean;
  command: CompanionCommand; spontaneous: CompanionMood;
  behindSheet?: boolean;
}): CompanionMood {
  if (generating) return 'happy';
  if (excited && !behindSheet) return 'excited';
  if (behindSheet) return planning ? 'think' : 'idle';
  if (command !== 'auto') return command;
  if (reading) return 'read';
  if (planning) return 'think';
  return spontaneous;
}

// Each choice is independent so the companion doesn't repeat a fixed routine.
export function randomCompanionMood(previous: CompanionMood, random = Math.random): CompanionMood {
  const choices: CompanionMood[] = ['idle', 'sit', 'walk', 'exercise', 'think', 'happy', 'clap', 'surprise'];
  const candidates = choices.filter(mood => mood !== previous);
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}
