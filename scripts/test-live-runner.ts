import * as assert from 'assert';
import * as path from 'path';
import { createRunner } from '../src/core/ai-runner';

const repoRoot = path.resolve(__dirname, '..');
const LIVE_TEST_FLAG = 'PHASEGATE_LIVE';
const EXPECTED_TOKEN = 'LIVE_OK';

async function main(): Promise<void> {
  if (process.env[LIVE_TEST_FLAG] !== '1') {
    console.log(
      `SKIP test:live (set ${LIVE_TEST_FLAG}=1 to run the real AI smoke test)`
    );
    return;
  }

  const runner = await createRunner(repoRoot);
  const prompt = [
    'This is a live connectivity smoke test.',
    `Reply with exactly ${EXPECTED_TOKEN}.`,
    'Do not add any extra words, punctuation, or formatting.',
  ].join(' ');

  const result = (await runner.run([], prompt)).trim();
  assert.strictEqual(
    result,
    EXPECTED_TOKEN,
    `Expected "${EXPECTED_TOKEN}" but received "${result}"`
  );

  console.log(`PASS test:live (${EXPECTED_TOKEN})`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
