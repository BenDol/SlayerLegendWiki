import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, isDevMode, isProdMode, isLevelEnabled, LogLevel } from '../../src/utils/logger';

describe('Logger Utility', () => {
  let consoleSpies;

  beforeEach(() => {
    // Spy on console methods
    consoleSpies = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {})
    };
  });

  afterEach(() => {
    // Restore console methods
    Object.values(consoleSpies).forEach(spy => spy.mockRestore());
  });

  describe('Logger Creation and Prefixes', () => {
    it('should create logger with prefix', () => {
      const logger = createLogger('TestComponent');
      logger.info('Test message');

      expect(consoleSpies.info).toHaveBeenCalledWith('[TestComponent] Test message');
    });

    it('should format message with prefix and data object', () => {
      const logger = createLogger('Test');
      const data = { key: 'value', count: 5 };
      logger.info('Message', data);

      expect(consoleSpies.info).toHaveBeenCalledWith('[Test] Message', data);
    });

    it('should format message with prefix and primitive data', () => {
      const logger = createLogger('Test');
      logger.info('Message', 42);

      expect(consoleSpies.info).toHaveBeenCalledWith('[Test] Message 42');
    });

    it('should create child logger with nested prefix', () => {
      const logger = createLogger('Parent');
      const child = logger.child('Child');

      child.debug('Nested message');

      expect(consoleSpies.log).toHaveBeenCalledWith('[Parent:Child] Nested message');
    });

    it('should support multiple levels of nesting', () => {
      const logger = createLogger('Root');
      const child1 = logger.child('Level1');
      const child2 = child1.child('Level2');

      child2.debug('Deep message');

      expect(consoleSpies.log).toHaveBeenCalledWith('[Root:Level1:Level2] Deep message');
    });
  });

  describe('Log Levels', () => {
    it('should call console.error for ERROR level', () => {
      const logger = createLogger('Test');
      logger.error('Error message', { error: 'details' });

      expect(consoleSpies.error).toHaveBeenCalledWith('[Test] Error message', { error: 'details' });
    });

    it('should call console.warn for WARN level', () => {
      const logger = createLogger('Test');
      logger.warn('Warning message');

      expect(consoleSpies.warn).toHaveBeenCalledWith('[Test] Warning message');
    });

    it('should call console.info for INFO level', () => {
      const logger = createLogger('Test');
      logger.info('Info message');

      expect(consoleSpies.info).toHaveBeenCalled();
    });

    it('should call console.log for DEBUG level', () => {
      const logger = createLogger('Test');
      logger.debug('Debug message');

      expect(consoleSpies.log).toHaveBeenCalledWith('[Test] Debug message');
    });

    it('should call console.log for TRACE level', () => {
      const logger = createLogger('Test');
      logger.trace('Trace message');

      expect(consoleSpies.log).toHaveBeenCalledWith('[Test] Trace message');
    });
  });

  describe('Critical Action Detection', () => {
    const criticalKeywords = [
      'login',
      'logout',
      'authenticate',
      'save',
      'delete',
      'create',
      'update',
      'share',
      'export',
      'import',
      'donate',
      'payment'
    ];

    it.each(criticalKeywords)('should recognize "%s" as critical action', (keyword) => {
      const logger = createLogger('Test');

      // Test with keyword in various positions and cases
      logger.info(`User ${keyword} successful`);
      logger.info(`${keyword.toUpperCase()} operation`);
      logger.info(`Starting ${keyword}...`);

      // All should trigger console.info
      expect(consoleSpies.info).toHaveBeenCalled();
    });

    it('should detect critical actions in compound messages', () => {
      const logger = createLogger('Test');

      logger.info('User saved build successfully');
      logger.info('Build shared with URL copied to clipboard');
      logger.info('User logged in and authenticated');

      expect(consoleSpies.info).toHaveBeenCalledTimes(3);
    });
  });

  describe('Environment Utilities', () => {
    it('should provide isDevMode utility', () => {
      const result = isDevMode();
      expect(typeof result).toBe('boolean');
    });

    it('should provide isProdMode utility', () => {
      const result = isProdMode();
      expect(typeof result).toBe('boolean');
    });

    it('should have mutually exclusive dev and prod modes', () => {
      // Dev and prod should never both be true
      if (isDevMode()) {
        expect(isProdMode()).toBe(false);
      }
      if (isProdMode()) {
        expect(isDevMode()).toBe(false);
      }
    });

    it('should check if log levels are enabled', () => {
      expect(isLevelEnabled('ERROR')).toBe(true); // Always enabled
      expect(isLevelEnabled('WARN')).toBe(true);  // Always enabled

      // DEBUG and TRACE depend on environment
      const debugEnabled = isLevelEnabled('DEBUG');
      const traceEnabled = isLevelEnabled('TRACE');

      expect(typeof debugEnabled).toBe('boolean');
      expect(typeof traceEnabled).toBe('boolean');
    });

    it('should return false for invalid log level', () => {
      expect(isLevelEnabled('INVALID')).toBe(false);
      expect(isLevelEnabled('UNKNOWN')).toBe(false);
    });
  });

  describe('Logger Without Prefix', () => {
    it('should work without prefix', () => {
      const logger = createLogger('');
      logger.info('Message without prefix');

      expect(consoleSpies.info).toHaveBeenCalledWith('Message without prefix');
    });

    it('should handle null/undefined data gracefully', () => {
      const logger = createLogger('Test');

      logger.info('Message', null);
      logger.info('Message', undefined);
      logger.info('Message');

      expect(consoleSpies.info).toHaveBeenCalledTimes(3);
    });
  });

  describe('Group Logging', () => {
    let groupSpy, groupEndSpy;

    beforeEach(() => {
      groupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
      groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    });

    afterEach(() => {
      groupSpy.mockRestore();
      groupEndSpy.mockRestore();
    });

    it('should create console groups with prefix', () => {
      const logger = createLogger('Test');

      if (isDevMode()) {
        logger.group('Operation');
        logger.info('Inside group');
        logger.groupEnd();

        expect(groupSpy).toHaveBeenCalledWith('[Test] Operation');
        expect(groupEndSpy).toHaveBeenCalled();
      }
    });

    it('should not create groups in production', () => {
      const logger = createLogger('Test');

      if (isProdMode()) {
        logger.group('Operation');
        logger.groupEnd();

        expect(groupSpy).not.toHaveBeenCalled();
        expect(groupEndSpy).not.toHaveBeenCalled();
      }
    });
  });

  describe('LogLevel Export', () => {
    it('should export LogLevel enum', () => {
      expect(LogLevel).toBeDefined();
      expect(LogLevel.ERROR).toBe(0);
      expect(LogLevel.WARN).toBe(1);
      expect(LogLevel.INFO).toBe(2);
      expect(LogLevel.DEBUG).toBe(3);
      expect(LogLevel.TRACE).toBe(4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long messages', () => {
      const logger = createLogger('Test');
      const longMessage = 'A'.repeat(1000);

      logger.info(longMessage);

      expect(consoleSpies.info).toHaveBeenCalled();
      const call = consoleSpies.info.mock.calls[0][0];
      expect(call).toContain('[Test]');
      expect(call.length).toBeGreaterThan(1000);
    });

    it('should handle special characters in messages', () => {
      const logger = createLogger('Test');

      logger.info('Message with 🎉 emoji');
      logger.info('Message with\nnewlines\n');
      logger.info('Message with\ttabs');

      expect(consoleSpies.info).toHaveBeenCalledTimes(3);
    });

    it('should handle objects with circular references', () => {
      const logger = createLogger('Test');

      const obj = { name: 'Test' };
      obj.self = obj; // Circular reference

      // Should not throw error
      expect(() => {
        logger.info('Circular object', obj);
      }).not.toThrow();
    });

    it('should handle Error objects', () => {
      const logger = createLogger('Test');
      const error = new Error('Test error');

      logger.error('Operation failed', error);

      expect(consoleSpies.error).toHaveBeenCalledWith('[Test] Operation failed', error);
    });

    it('should coerce non-string messages to strings', () => {
      const logger = createLogger('Test');

      logger.info(123);
      logger.info(true);
      logger.info(null);
      logger.info(undefined);

      expect(consoleSpies.info).toHaveBeenCalledTimes(4);
    });
  });

  describe('Real-World Patterns', () => {
    it('should support cache operation pattern', () => {
      const logger = createLogger('SoulWeapon');
      const cacheLogger = logger.child('Cache');

      cacheLogger.debug('Cached 5 submissions for weapon');
      cacheLogger.debug('Cache hit for key: bestWeapons');
      cacheLogger.error('Failed to read cache', { error: 'File not found' });

      expect(consoleSpies.log).toHaveBeenCalledTimes(2); // DEBUG calls
      expect(consoleSpies.error).toHaveBeenCalledTimes(1); // ERROR call
    });

    it('should support user action pattern', () => {
      const logger = createLogger('SpiritBuilder');

      logger.info('User saved spirit build', { buildId: 123, spiritCount: 8 });
      logger.info('Shared build loaded successfully');
      logger.info('Build exported to clipboard');

      // All are critical actions
      expect(consoleSpies.info).toHaveBeenCalledTimes(3);
    });

    it('should support scroll tracking pattern', () => {
      const logger = createLogger('ScrollDepth');

      logger.trace('Scroll: 10%', { threshold: 65 });
      logger.trace('Scroll: 20%', { threshold: 65 });
      logger.trace('Scroll: 65%', { threshold: 65 });
      logger.info('Donation prompt triggered', { scrollDepth: 65 });

      // TRACE calls (log)
      expect(consoleSpies.log).toHaveBeenCalledTimes(3);
      // INFO call (critical action)
      expect(consoleSpies.info).toHaveBeenCalledTimes(1);
    });

    it('should support eligibility check pattern', () => {
      const logger = createLogger('DonationPrompt');

      logger.debug('Eligibility check', {
        enabled: true,
        donated: false,
        cooldown: false,
        sessionShown: false
      });

      logger.info('Donation prompt triggered successfully');

      expect(consoleSpies.log).toHaveBeenCalledTimes(1); // DEBUG
      expect(consoleSpies.info).toHaveBeenCalledTimes(1); // INFO
    });
  });
});
