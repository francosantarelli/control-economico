import { describe, it, expect } from 'vitest';
import { loadApp } from './helpers/loadApp.js';

describe('loadApp helper', () => {
  it('exposes app.js globals without throwing and without a real Supabase client', () => {
    const win = loadApp();
    expect(win.sb).toBeNull();
    expect(typeof win.parseMonto).toBe('function');
    expect(typeof win.fmtMonto).toBe('function');
    expect(win.STATE).toBeTruthy();
  });
});
