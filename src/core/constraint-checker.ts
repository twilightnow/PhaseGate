export interface ConstraintViolation {
  file: string;
  rule: string;
  detail: string;
}

export interface ConstraintReport {
  passed: boolean;
  violations: ConstraintViolation[];
}

export interface IConstraintChecker {
  check(projectRoot: string): ConstraintReport;
}

/**
 * Phase 2 stub implementation.
 * Always returns passed: true.
 * Real constraint checks (line count, circular deps, test coverage) are Phase 3.
 */
export class ConstraintChecker implements IConstraintChecker {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  check(_projectRoot: string): ConstraintReport {
    return { passed: true, violations: [] };
  }
}
