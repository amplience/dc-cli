module.exports = {
  testEnvironment: "node",
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.ts?$': 'ts-jest'
  },
  preset: 'ts-jest'
};
