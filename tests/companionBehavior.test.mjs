import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../utils/companionBehavior.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
const {resolveCompanionMood, randomCompanionMood} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const idle = {reading: false, generating: false, planning: false, excited: false, command: 'auto', spontaneous: 'sit'};
test('production clicks excite the companion, and active generation keeps it happy', () => {
  assert.equal(resolveCompanionMood({...idle, generating: true, command: 'exercise'}), 'happy');
  assert.equal(resolveCompanionMood({...idle, excited: true}), 'excited');
  assert.equal(resolveCompanionMood({...idle, generating: true, excited: true}), 'happy');
});
test('opening or editing the production sheet keeps the companion peeking until generation actually starts', () => {
  assert.equal(resolveCompanionMood({...idle, behindSheet: true, excited: true, spontaneous: 'happy'}), 'idle');
  assert.equal(resolveCompanionMood({...idle, behindSheet: true, planning: true, excited: true}), 'think');
  assert.equal(resolveCompanionMood({...idle, behindSheet: true, command: 'exercise'}), 'idle');
  assert.equal(resolveCompanionMood({...idle, behindSheet: true, generating: true, excited: true}), 'happy');
});
test('reading defaults to the seated reading pose, and menu actions temporarily override it', () => {
  assert.equal(resolveCompanionMood({...idle, reading: true}), 'read');
  for (const command of ['sit', 'walk', 'exercise']) assert.equal(resolveCompanionMood({...idle, reading: true, command}), command);
  assert.equal(resolveCompanionMood({...idle, planning: true}), 'think');
});
test('automatic activities include sitting, wandering, exercise and emotions without immediately repeating', () => {
  const choices = Array.from({length: 7}, (_, index) => randomCompanionMood('idle', () => index / 7));
  assert.deepEqual(choices, ['sit', 'walk', 'exercise', 'think', 'happy', 'clap', 'surprise']);
  for (const previous of choices) assert.notEqual(randomCompanionMood(previous, () => 0), previous);
});

test('new reactions cancel old timers and hiding is remembered without changing book jobs', async () => {
  const realSetTimeout = globalThis.setTimeout, realClearTimeout = globalThis.clearTimeout;
  const realStorage = globalThis.localStorage;
  const timers = new Map();
  const storage = new Map();
  let nextTimer = 0;
  globalThis.setTimeout = fn => { const id = ++nextTimer; timers.set(id, fn); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  globalThis.localStorage = {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)};
  try {
    const activitySource = fs.readFileSync(new URL('../utils/companionActivity.ts', import.meta.url), 'utf8');
    const activityCompiled = ts.transpileModule(activitySource, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
    const store = await import(`data:text/javascript;base64,${Buffer.from(activityCompiled).toString('base64')}`);
    store.setCompanionActivity('generating', true);
    store.exciteCompanion();
    store.exciteCompanion();
    assert.equal(timers.size, 1);
    assert.equal(store.getCompanionActivity().excited, true);
    [...timers.values()][0](); timers.clear();
    assert.equal(store.getCompanionActivity().excited, false);
    assert.equal(store.getCompanionActivity().generating, true);
    store.setCompanionCommand('sit');
    store.setCompanionCommand('exercise');
    assert.equal(timers.size, 1);
    assert.equal(store.getCompanionActivity().command, 'exercise');
    [...timers.values()][0](); timers.clear();
    assert.equal(store.getCompanionActivity().command, 'auto');
    store.setCompanionHidden(true);
    assert.equal(store.getCompanionActivity().hidden, true);
    assert.equal(storage.get('fortale-companion-hidden'), 'true');
    store.setCompanionHidden(false);
    assert.equal(store.getCompanionActivity().hidden, false);
    assert.equal(store.getCompanionActivity().generating, true);
  } finally {
    globalThis.setTimeout = realSetTimeout; globalThis.clearTimeout = realClearTimeout;
    if (realStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = realStorage;
  }
});
