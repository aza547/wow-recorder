module.exports = {
  transform: {
    '\\.(ts|tsx|js|jsx)$': 'ts-jest',
  },
  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    '^noobs$': '<rootDir>/src/__mocks__/noobs.ts',
  },
};
