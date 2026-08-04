import { describe, expect, it, vi } from 'vitest';
import { pool } from '../database/db';

describe('Database Pool Configuration', () => {
  it('should have an error listener registered', () => {
    expect(pool.listenerCount('error')).toBeGreaterThanOrEqual(1);
  });

  it('should not throw when an error is emitted', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Test DB Error');
    
    // The pool should have the listener, so it should not throw
    expect(() => pool.emit('error', error)).not.toThrow();
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
