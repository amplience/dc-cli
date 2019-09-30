module.exports = {
  roots: [
    '<rootDir>/src'
  ],
  transform: {
    '^.+\\.ts?$': 'ts-jest'
  },
  collectCoverage: true,
  preset: 'ts-jest'
};
