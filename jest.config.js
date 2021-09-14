module.exports = {
  testEnvironment: "node",
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.ts?$': 'ts-jest'
  },
  preset: 'ts-jest',
  coveragePathIgnorePatterns: [
    '^.+\\.mocks\.ts?$'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.global.js']
};
