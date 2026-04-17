import * as fc from 'fast-check';

describe('Monorepo setup verification', () => {
  it('should run a basic Jest test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should run a basic fast-check property test', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a);
      }),
      { numRuns: 100 },
    );
  });
});
