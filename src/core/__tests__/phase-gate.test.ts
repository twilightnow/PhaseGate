import * as os from 'os';
import * as path from 'path';
import * as fse from 'fs-extra';
import { checkPhase0Gate } from '../phase-gate';

describe('checkPhase0Gate', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await fse.mkdtemp(path.join(os.tmpdir(), 'phasegate-gate-'));
    await fse.ensureDir(path.join(cwd, '.phasegate', 'requirements'));
  });

  afterEach(async () => {
    await fse.remove(cwd);
  });

  it('accepts mixed localized section headings for the same requirement', async () => {
    await fse.writeFile(
      path.join(cwd, '.phasegate', 'requirements', 'feature.md'),
      `# Feature

## 描述
新增一篇文章

## スコープ
- 仅新增内容

## Acceptance Criteria
- [ ] article is visible
`,
      'utf-8'
    );

    const result = await checkPhase0Gate(cwd, 'feature');
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
