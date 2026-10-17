import type { TranscriptBlock } from 'shared';
import { describe, expect, it } from 'vitest';
import { buildBatches, cleanBlocks, formatBatchRequest, parseBatchResponse } from './cleanup';
import { CLEANUP_PRESETS } from './cleanup-presets';
import type { LlmClient } from './openrouter';

function block(orderIndex: number, text: string): TranscriptBlock {
  return {
    id: `job/b${String(orderIndex).padStart(5, '0')}`,
    sessionId: 'job',
    speakerId: 'job/s0',
    orderIndex,
    startSec: orderIndex * 10,
    endSec: orderIndex * 10 + 9,
    verbatimText: text,
    cleanedText: null,
    cleanedModel: null,
    cleanedStyle: null,
    cleanedTemperature: null,
  };
}

describe('buildBatches', () => {
  it('groups up to 15 blocks per batch', () => {
    const blocks = Array.from({ length: 33 }, (_, i) => block(i, `текст ${i}`));
    const batches = buildBatches(blocks);
    expect(batches.map((b) => b.blocks.length)).toEqual([15, 15, 3]);
  });

  it('splits on the character budget', () => {
    const blocks = Array.from({ length: 4 }, (_, i) => block(i, 'x'.repeat(1200)));
    const batches = buildBatches(blocks);
    expect(batches.map((b) => b.blocks.length)).toEqual([2, 2]);
  });

  it('keeps consecutive order', () => {
    const blocks = Array.from({ length: 20 }, (_, i) => block(i, `текст ${i}`));
    const flat = buildBatches(blocks).flatMap((b) => b.blocks.map((x) => x.orderIndex));
    expect(flat).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });
});

describe('formatBatchRequest / parseBatchResponse', () => {
  it('round-trips through the marker protocol', () => {
    const blocks = [block(3, 'първи'), block(4, 'втори [шум] със скоби'), block(7, 'трети')];
    const request = formatBatchRequest(blocks);
    expect(request).toContain('<<<BLOCK 3>>>');
    const parsed = parseBatchResponse(request);
    expect(parsed.get(3)).toBe('първи');
    expect(parsed.get(4)).toBe('втори [шум] със скоби');
    expect(parsed.get(7)).toBe('трети');
  });

  it('tolerates preamble text and missing blocks', () => {
    const parsed = parseBatchResponse(
      'Ето резултата:\n\n<<<BLOCK 1>>>\nедно\n\n<<<BLOCK 2>>>\n\n<<<BLOCK 4>>>\nчетири',
    );
    expect(parsed.get(1)).toBe('едно');
    expect(parsed.has(2)).toBe(false); // empty text = treated as missing
    expect(parsed.get(4)).toBe('четири');
    expect(parsed.has(3)).toBe(false);
  });
});

describe('cleanBlocks', () => {
  it('sends batched requests and echoes per-block results; missing blocks stay pending', async () => {
    const calls: string[] = [];
    const fakeClient: LlmClient = {
      chat: (options) => {
        const user = options.messages[1].content;
        calls.push(user);
        // Echo the protocol back, but drop BLOCK 1 on purpose.
        return Promise.resolve(user.replaceAll(/<<<BLOCK 1>>>\n[^\n]+\n\n/g, ''));
      },
    };
    const blocks = Array.from({ length: 17 }, (_, i) => block(i, `текст ${i}`));
    const cleaned = await cleanBlocks(fakeClient, {
      blocks,
      style: 'clean-verbatim',
      model: 'm',
      temperature: 0.2,
    });
    expect(calls).toHaveLength(2); // 15 + 2
    expect(cleaned).toHaveLength(16);
    expect(cleaned.find((c) => c.blockId === block(1, '').id)).toBeUndefined();
    expect(cleaned.find((c) => c.blockId === block(16, '').id)?.cleanedText).toBe('текст 16');
  });
});

describe('cleanup presets', () => {
  it('5 presets: 3 per-block + 2 session-level, all with Bulgarian prompts', () => {
    const values = Object.values(CLEANUP_PRESETS);
    expect(values).toHaveLength(5);
    expect(values.filter((p) => p.scope === 'per-block').map((p) => p.id)).toEqual([
      'clean-verbatim',
      'light-clean',
      'formal-style',
    ]);
    expect(values.filter((p) => p.scope === 'session').map((p) => p.id)).toEqual(['summary', 'key-facts']);
    for (const preset of values) {
      expect(preset.systemPrompt.length).toBeGreaterThan(50);
      expect(preset.displayName).toBeTruthy();
    }
  });
});
