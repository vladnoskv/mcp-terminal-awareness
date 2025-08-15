# Testing MCP Terminal Awareness

This document outlines the testing strategy and how to run tests for the MCP Terminal Awareness project.

## Test Structure

- `tests/unit/` - Unit tests for individual components
- `tests/integration/` - Integration tests that test multiple components working together

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Unit Tests Only
```bash
npm run test:unit
```

### Run Integration Tests Only
```bash
npm run test:integration
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

## Writing Tests

### Unit Tests
Unit tests should be placed in `tests/unit/` and follow the naming convention `*.test.js`.

Example unit test:
```javascript
import { TerminalAwareness } from '../../dist/terminal/terminalAwareness.js';

describe('TerminalAwareness', () => {
  it('should be instantiated with default options', () => {
    const ta = new TerminalAwareness();
    expect(ta).toBeInstanceOf(TerminalAwareness);
  });
});
```

### Integration Tests
Integration tests should be placed in `tests/integration/` and follow the naming convention `*.test.js`.

Example integration test:
```javascript
import { spawn } from 'child_process';
import { expect } from 'chai';

describe('MCP Terminal Awareness Server', () => {
  it('should start the server', async () => {
    // Test server startup and basic functionality
  });
});
```

## Test Dependencies

- Mocha - Test framework
- Chai - Assertion library
- c8 - Code coverage

These will be installed automatically when you run the tests for the first time.
