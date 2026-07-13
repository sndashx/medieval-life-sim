import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

import { confirmQuit, performQuit } from '../src/ui/quitConfirm.js';

test('confirmQuit: defaults to exit', () => {
  assert.strictEqual(confirmQuit(''), 'exit');
  assert.strictEqual(confirmQuit('n'), 'exit');
  assert.strictEqual(confirmQuit('N'), 'exit');
  assert.strictEqual(confirmQuit('no'), 'exit');
  assert.strictEqual(confirmQuit(undefined), 'exit');
  assert.strictEqual(confirmQuit(null), 'exit');
  assert.strictEqual(confirmQuit('garbage'), 'exit');
  assert.strictEqual(confirmQuit('  '), 'exit');
});

test('confirmQuit: y/Y/yes/save means save', () => {
  assert.strictEqual(confirmQuit('y'), 'save');
  assert.strictEqual(confirmQuit('Y'), 'save');
  assert.strictEqual(confirmQuit('yes'), 'save');
  assert.strictEqual(confirmQuit('YES'), 'save');
  assert.strictEqual(confirmQuit('save'), 'save');
  assert.strictEqual(confirmQuit('Save'), 'save');
  assert.strictEqual(confirmQuit(' y '), 'save');
});

test('confirmQuit: c/C/cancel means cancel', () => {
  assert.strictEqual(confirmQuit('c'), 'cancel');
  assert.strictEqual(confirmQuit('C'), 'cancel');
  assert.strictEqual(confirmQuit('cancel'), 'cancel');
  assert.strictEqual(confirmQuit('CANCEL'), 'cancel');
  assert.strictEqual(confirmQuit('Cancel'), 'cancel');
  assert.strictEqual(confirmQuit(' c '), 'cancel');
});

test('performQuit: save+exit on y, plain exit on n, no exit on c', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uitest-'));
  const prevCwd = process.cwd();
  process.chdir(tmpDir);
  try {
    let exited = null;
    let savedTo = null;
    const fakeUi = {
      rl: {
        question: (_prompt, cb) => cb('y'),
      },
      log(_msg, _type) {},
      save() {
        savedTo = path.join(process.cwd(), 'saves', 'fake.json');
        fs.mkdirSync(path.dirname(savedTo), { recursive: true });
        fs.writeFileSync(savedTo, '{"ok":true}');
      },
      processExit(code) { exited = code; },
    };

    // y -> save+exit
    let r = await performQuit(fakeUi);
    assert.ok(r === 'save-exit' || r === 'exit', `unexpected result for y: ${r}`);
    assert.strictEqual(exited, 0, 'y should exit 0');
    assert.ok(savedTo && fs.existsSync(savedTo), 'y should save');

    // n -> plain exit (no save)
    exited = null; savedTo = null;
    fakeUi.rl.question = (_p, cb) => cb('n');
    r = await performQuit(fakeUi);
    assert.strictEqual(r, 'exit');
    assert.strictEqual(exited, 0, 'n should exit 0');
    assert.strictEqual(savedTo, null, 'n should NOT save');

    // empty -> plain exit (default N)
    exited = null; savedTo = null;
    fakeUi.rl.question = (_p, cb) => cb('');
    r = await performQuit(fakeUi);
    assert.strictEqual(r, 'exit');
    assert.strictEqual(exited, 0);
    assert.strictEqual(savedTo, null);

    // c -> cancel, no exit, no save
    exited = null; savedTo = null;
    fakeUi.rl.question = (_p, cb) => cb('c');
    r = await performQuit(fakeUi);
    assert.strictEqual(r, 'cancel');
    assert.strictEqual(exited, null, 'c should NOT call processExit');
    assert.strictEqual(savedTo, null, 'c should NOT save');
  } finally {
    process.chdir(prevCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
