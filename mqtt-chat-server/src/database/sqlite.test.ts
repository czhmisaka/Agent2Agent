import Database from 'better-sqlite3';

// Mock better-sqlite3
const mockDb = {
  pragma: jest.fn(),
  exec: jest.fn(),
  prepare: jest.fn().mockReturnValue({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn()
  }),
  close: jest.fn()
};

jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => mockDb);
});

// Mock config
jest.mock('../config', () => ({
  config: {
    database: {
      path: './test-data/test.db'
    }
  }
}));

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));

// Mock console.log to keep test output clean
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('Database', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.pragma.mockClear();
    mockDb.exec.mockClear();
    mockDb.prepare.mockClear().mockReturnValue({
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn()
    });
    mockDb.close.mockClear();
  });

  afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('initDatabase', () => {
    it('should enable foreign keys pragma', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();
      expect(mockDb.pragma).toHaveBeenCalledWith('foreign_keys = ON');
    });

    it('should call createTables', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();
      // Should call exec multiple times for creating tables
      expect(mockDb.exec).toHaveBeenCalled();
    });

    it('should run migrations', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();
      // Should create migration tables
      expect(mockDb.exec).toHaveBeenCalled();
    });

    it('should call alterMessagesTable', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();
      // Should add columns via ALTER statements
      expect(mockDb.exec).toHaveBeenCalled();
    });
  });

  describe('getDatabase', () => {
    it('should return database instance when initialized', () => {
      const { initDatabase, getDatabase } = require('./sqlite');
      initDatabase();
      const db = getDatabase();
      expect(db).toBeDefined();
    });

    it('should throw error when database is not initialized', () => {
      // Reset modules to get clean state
      jest.resetModules();
      jest.mock('better-sqlite3', () => jest.fn().mockImplementation(() => mockDb));
      jest.mock('../config', () => ({
        config: {
          database: {
            path: './test-data/test.db'
          }
        }
      }));

      const { getDatabase } = require('./sqlite');
      expect(() => getDatabase()).toThrow('Database not initialized');
    });
  });

  describe('closeDatabase', () => {
    it('should close the database', () => {
      const { initDatabase, closeDatabase } = require('./sqlite');
      initDatabase();
      closeDatabase();
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should set db to null after closing', () => {
      const { initDatabase, closeDatabase, getDatabase } = require('./sqlite');
      initDatabase();
      closeDatabase();
      expect(() => getDatabase()).toThrow('Database not initialized');
    });
  });

  describe('Table Creation', () => {
    it('should create users table', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      const createTableCalls = mockDb.exec.mock.calls.filter(
        call => call[0].includes('CREATE TABLE') && call[0].includes('users')
      );
      expect(createTableCalls.length).toBeGreaterThan(0);
    });

    it('should create groups table', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      const createTableCalls = mockDb.exec.mock.calls.filter(
        call => call[0].includes('CREATE TABLE') && call[0].includes('groups')
      );
      expect(createTableCalls.length).toBeGreaterThan(0);
    });

    it('should create messages table', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      const createTableCalls = mockDb.exec.mock.calls.filter(
        call => call[0].includes('CREATE TABLE') && call[0].includes('messages')
      );
      expect(createTableCalls.length).toBeGreaterThan(0);
    });

    it('should create group_members table', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      const createTableCalls = mockDb.exec.mock.calls.filter(
        call => call[0].includes('CREATE TABLE') && call[0].includes('group_members')
      );
      expect(createTableCalls.length).toBeGreaterThan(0);
    });

    it('should create user_sessions table', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      const createTableCalls = mockDb.exec.mock.calls.filter(
        call => call[0].includes('CREATE TABLE') && call[0].includes('user_sessions')
      );
      expect(createTableCalls.length).toBeGreaterThan(0);
    });

    it('should create indexes', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      const indexCalls = mockDb.exec.mock.calls.filter(
        call => call[0].includes('CREATE INDEX')
      );
      expect(indexCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Migrations', () => {
    it('should create message_reactions table', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      const migrationCalls = mockDb.exec.mock.calls.filter(
        call => call[0].includes('message_reactions')
      );
      expect(migrationCalls.length).toBeGreaterThan(0);
    });

    it('should create message_flags table', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      const migrationCalls = mockDb.exec.mock.calls.filter(
        call => call[0].includes('message_flags')
      );
      expect(migrationCalls.length).toBeGreaterThan(0);
    });

    it('should create message_mentions table', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      const migrationCalls = mockDb.exec.mock.calls.filter(
        call => call[0].includes('message_mentions')
      );
      expect(migrationCalls.length).toBeGreaterThan(0);
    });

    it('should create subscriptions table', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      const migrationCalls = mockDb.exec.mock.calls.filter(
        call => call[0].includes('subscriptions')
      );
      expect(migrationCalls.length).toBeGreaterThan(0);
    });

    it('should create custom_emojis table', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      const migrationCalls = mockDb.exec.mock.calls.filter(
        call => call[0].includes('custom_emojis')
      );
      expect(migrationCalls.length).toBeGreaterThan(0);
    });

    it('should create custom_commands table', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      const migrationCalls = mockDb.exec.mock.calls.filter(
        call => call[0].includes('custom_commands')
      );
      expect(migrationCalls.length).toBeGreaterThan(0);
    });

    it('should create message_stats table', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      const migrationCalls = mockDb.exec.mock.calls.filter(
        call => call[0].includes('message_stats')
      );
      expect(migrationCalls.length).toBeGreaterThan(0);
    });

    it('should create offline_actions table', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      const migrationCalls = mockDb.exec.mock.calls.filter(
        call => call[0].includes('offline_actions')
      );
      expect(migrationCalls.length).toBeGreaterThan(0);
    });

    it('should insert default emojis', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      // Check that prepare was called for emoji insertion
      const prepareCalls = mockDb.prepare.mock.calls.filter(
        call => call[0] && call[0].includes('custom_emojis')
      );
      expect(prepareCalls.length).toBeGreaterThan(0);
    });

    it('should insert default commands', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      // Check that prepare was called for command insertion
      const prepareCalls = mockDb.prepare.mock.calls.filter(
        call => call[0] && call[0].includes('custom_commands')
      );
      expect(prepareCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Table Alterations', () => {
    it('should try to add mentions column to messages', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      const alterCalls = mockDb.exec.mock.calls.filter(
        call => call[0].includes('ALTER TABLE messages ADD COLUMN mentions')
      );
      expect(alterCalls.length).toBeGreaterThan(0);
    });

    it('should try to add is_highlighted column to messages', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      const alterCalls = mockDb.exec.mock.calls.filter(
        call => call[0].includes('ALTER TABLE messages ADD COLUMN is_highlighted')
      );
      expect(alterCalls.length).toBeGreaterThan(0);
    });

    it('should try to add is_pinned column to messages', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      const alterCalls = mockDb.exec.mock.calls.filter(
        call => call[0].includes('ALTER TABLE messages ADD COLUMN is_pinned')
      );
      expect(alterCalls.length).toBeGreaterThan(0);
    });

    it('should try to add is_admin column to users', () => {
      const { initDatabase } = require('./sqlite');
      initDatabase();

      const alterCalls = mockDb.exec.mock.calls.filter(
        call => call[0].includes('ALTER TABLE users ADD COLUMN is_admin')
      );
      expect(alterCalls.length).toBeGreaterThan(0);
    });
  });
});
