import type { PerBlockCleanupStyleId, TranscriptBlock } from 'shared';
import { getPreset } from './cleanup-presets';
import type { LlmClient } from './openrouter';

// Batched cleanup: consecutive blocks go to the LLM in groups (~15 blocks /
// ~3000 chars) so the model sees dialogue context, while results are persisted
// PER BLOCK — that keeps per-block regenerate cheap and resume = re-run only
// batches with pending blocks.
//
// Wire format (both directions): each block is introduced by a marker line
//   <<<BLOCK 12>>>
// followed by the block text. The model echoes the markers unchanged.

export interface CleanupBatch {
  blocks: TranscriptBlock[];
}

export interface CleanedBlock {
  blockId: string;
  cleanedText: string;
}

export interface CleanupRunOptions {
  style: PerBlockCleanupStyleId;
  model: string;
  temperature: number;
  onProgress?: (message: string) => void;
}

export interface CleanupRequest extends CleanupRunOptions {
  blocks: TranscriptBlock[];
}

export interface RegenerateRequest extends CleanupRunOptions {
  block: TranscriptBlock;
}

const MAX_BLOCKS_PER_BATCH = 15;
const MAX_CHARS_PER_BATCH = 3000;

export function buildBatches(blocks: TranscriptBlock[]): CleanupBatch[] {
  const batches: CleanupBatch[] = [];
  let current: TranscriptBlock[] = [];
  let currentChars = 0;
  for (const block of blocks) {
    if (
      current.length > 0 &&
      (current.length >= MAX_BLOCKS_PER_BATCH ||
        currentChars + block.verbatimText.length > MAX_CHARS_PER_BATCH)
    ) {
      batches.push({ blocks: current });
      current = [];
      currentChars = 0;
    }
    current.push(block);
    currentChars += block.verbatimText.length;
  }
  if (current.length > 0) batches.push({ blocks: current });
  return batches;
}

export function formatBatchRequest(blocks: TranscriptBlock[]): string {
  return blocks.map((b) => `<<<BLOCK ${b.orderIndex}>>>\n${b.verbatimText}`).join('\n\n');
}

const MARKER = /<<<BLOCK (\d+)>>>/g;

// Marker-echoing is the model's contract; blocks missing from the response are
// simply absent from the returned map and stay pending (resume retries them).
export function parseBatchResponse(response: string): Map<number, string> {
  const result = new Map<number, string>();
  const matches = [...response.matchAll(MARKER)];
  for (const [i, match] of matches.entries()) {
    const orderIndex = Number(match[1]);
    const start = match.index + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : response.length;
    const text = response.slice(start, end).trim();
    if (text) result.set(orderIndex, text);
  }
  return result;
}

export async function cleanBlocks(client: LlmClient, request: CleanupRequest): Promise<CleanedBlock[]> {
  const log = request.onProgress ?? (() => {});
  const preset = getPreset(request.style);
  const batches = buildBatches(request.blocks);
  const cleaned: CleanedBlock[] = [];

  for (const [i, batch] of batches.entries()) {
    log(`cleanup batch ${i + 1}/${batches.length}: ${batch.blocks.length} block(s)`);
    const response = await client.chat({
      model: request.model,
      temperature: request.temperature,
      messages: [
        { role: 'system', content: preset.systemPrompt },
        { role: 'user', content: formatBatchRequest(batch.blocks) },
      ],
    });
    const parsed = parseBatchResponse(response);
    for (const block of batch.blocks) {
      const text = parsed.get(block.orderIndex);
      if (text) cleaned.push({ blockId: block.id, cleanedText: text });
      else log(`block ${block.orderIndex}: missing from model response — stays pending`);
    }
  }
  return cleaned;
}

// Per-block "↻ regenerate" = a single-block batch (same preset, same protocol).
export async function cleanSingleBlock(
  client: LlmClient,
  request: RegenerateRequest,
): Promise<CleanedBlock | null> {
  const [result] = await cleanBlocks(client, { ...request, blocks: [request.block] });
  return result ?? null;
}
