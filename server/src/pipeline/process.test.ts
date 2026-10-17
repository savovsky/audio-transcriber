import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase } from '../db/database';
import { BlocksRepo, SessionsRepo, SpeakersRepo, makeBlockId, makeSpeakerId } from '../db/repositories';
import type { LlmClient } from '../llm/openrouter';
import { runProcessing } from './process';

// Synthetic fixture — generic text only (privacy rule).
const EXPORT = {
  language_code: 'bul',
  segments: [
    {
      text: 'Добър ден, започваме.',
      start_time: 0,
      end_time: 5,
      speaker: { id: 'speaker_0', name: 'Speaker 0' },
    },
    {
      text: 'Добър ден, готов съм.',
      start_time: 5.5,
      end_time: 9,
      speaker: { id: 'speaker_1', name: 'Speaker 1' },
    },
    {
      text: '[шум] Моля, продължете.',
      start_time: 9.5,
      end_time: 14,
      speaker: { id: 'speaker_0', name: 'Speaker 0' },
    },
  ],
};

// Fake LLM: echoes the cleanup protocol, returns canned role/summary output.
function makeFakeLlm(calls: string[]): LlmClient {
  return {
    chat: (options) => {
      const system = options.messages[0].content;
      const user = options.messages[1].content;
      calls.push(system.slice(0, 40));
      if (user.includes('<<<BLOCK')) return Promise.resolve(user); // cleanup: echo
      if (user.includes('извадка от репликите'))
        return Promise.resolve('{"role": "Съдия", "reasoning": "води"}');
      return Promise.resolve('СЕСИЙНО РЕЗЮМЕ');
    },
  };
}

describe('runProcessing (end-to-end, fake LLM)', () => {
  let tmp: string;
  let exportPath: string;
  let audioPath: string;

  beforeAll(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'process-test-'));
    exportPath = path.join(tmp, 'export.json');
    audioPath = path.join(tmp, 'recording.mp3');
    await writeFile(exportPath, JSON.stringify(EXPORT), 'utf8');
    await writeFile(audioPath, 'fake-audio', 'utf8');
  });

  afterAll(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('import → persist → clean → roles, all resumable via the DB rows', async () => {
    const calls: string[] = [];
    const result = await runProcessing({
      dataDir: tmp,
      llm: makeFakeLlm(calls),
      exportPath,
      audioPath,
      sessionId: 'session-1',
      style: 'clean-verbatim',
      model: 'google/gemini-2.5-flash',
    });
    expect(result).toEqual({ sessionId: 'session-1', blocksTotal: 3, blocksCleaned: 3, rolesPending: 2 });

    const db = await openDatabase(tmp);
    const session = new SessionsRepo(db).get('session-1');
    expect(session?.status).toBe('ready');
    expect(session?.audioFileName).toBe('recording.mp3');
    expect(session?.durationSec).toBe(14);

    const blocks = new BlocksRepo(db).listBySession('session-1');
    expect(blocks).toHaveLength(3);
    expect(blocks[0].cleanedText).toBe('Добър ден, започваме.');
    expect(blocks[2].cleanedText).toContain('[шум]'); // audio-event tags survive cleanup
    expect(blocks[0].cleanedModel).toBe('google/gemini-2.5-flash');
    expect(blocks[0].cleanedStyle).toBe('clean-verbatim');
    expect(blocks[0].cleanedTemperature).toBe(0.2); // stage default

    const speakers = new SpeakersRepo(db).listBySession('session-1');
    expect(speakers.map((s) => s.suggestedRole)).toEqual(['Съдия', 'Съдия']);
    expect(speakers.every((s) => s.confirmedRole === null)).toBe(true); // never auto-applied
    db.close();

    // RESUME: nothing pending → zero LLM calls.
    const resumeCalls: string[] = [];
    const resumed = await runProcessing({
      dataDir: tmp,
      llm: makeFakeLlm(resumeCalls),
      sessionId: 'session-1',
      style: 'clean-verbatim',
      model: 'google/gemini-2.5-flash',
    });
    expect(resumed.blocksCleaned).toBe(0);
    expect(resumeCalls).toHaveLength(0);
  });

  it('re-runs only the pending rows after a partial failure', async () => {
    const db = await openDatabase(tmp);
    // Simulate a crash: one block lost its cleaned text, one speaker its suggestion.
    db.prepare('UPDATE blocks SET cleaned_text = NULL WHERE id = ?').run(makeBlockId('session-1', 1));
    db.prepare('UPDATE speakers SET suggested_role = NULL WHERE id = ?').run(makeSpeakerId('session-1', 1));
    db.close();

    const calls: string[] = [];
    const result = await runProcessing({
      dataDir: tmp,
      llm: makeFakeLlm(calls),
      sessionId: 'session-1',
      style: 'clean-verbatim',
      model: 'google/gemini-2.5-flash',
    });
    expect(result.blocksCleaned).toBe(1); // only the pending block
    expect(result.rolesPending).toBe(1); // only the pending speaker
    expect(calls).toHaveLength(2);

    const db2 = await openDatabase(tmp);
    expect(new BlocksRepo(db2).listPendingCleanup('session-1')).toHaveLength(0);
    expect(new SpeakersRepo(db2).listPendingRoleSuggestion('session-1')).toHaveLength(0);
    db2.close();
  });

  it('session-level styles write to the session row, not to blocks', async () => {
    const calls: string[] = [];
    await runProcessing({
      dataDir: tmp,
      llm: makeFakeLlm(calls),
      sessionId: 'session-1',
      style: 'summary',
      model: 'google/gemini-2.5-flash',
    });
    const db = await openDatabase(tmp);
    expect(new SessionsRepo(db).get('session-1')?.summaryText).toBe('СЕСИЙНО РЕЗЮМЕ');
    expect(new BlocksRepo(db).listPendingCleanup('session-1')).toHaveLength(0); // untouched
    db.close();
  });
});
