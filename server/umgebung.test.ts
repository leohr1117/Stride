import { afterEach, describe, expect, it } from 'vitest';
import { strideVariable } from './umgebung.ts';

const NAME = 'UMGEBUNG_PROBE';

afterEach(() => {
  delete process.env[`STRIDE_${NAME}`];
  delete process.env[`ASCEND_${NAME}`];
});

describe('strideVariable', () => {
  it('liest STRIDE_ vor dem alten Namen', () => {
    process.env[`STRIDE_${NAME}`] = 'neu';
    process.env[`ASCEND_${NAME}`] = 'alt';
    expect(strideVariable(NAME)).toBe('neu');
  });

  it('nimmt den alten Namen, wenn STRIDE_ fehlt', () => {
    process.env[`ASCEND_${NAME}`] = 'alt';
    expect(strideVariable(NAME)).toBe('alt');
  });

  it('ist leer, wenn keiner gesetzt ist', () => {
    expect(strideVariable(NAME)).toBeUndefined();
  });

  it('liest die übergebene Umgebung', () => {
    expect(strideVariable(NAME, { [`STRIDE_${NAME}`]: 'aus-env', [`ASCEND_${NAME}`]: 'alt' })).toBe('aus-env');
    expect(strideVariable(NAME, { [`ASCEND_${NAME}`]: 'alt' })).toBe('alt');
  });
});