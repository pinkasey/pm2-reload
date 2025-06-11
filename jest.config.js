module.exports = {
  testEnvironment: 'node',
  preset: 'ts-jest',
  testRegex: '(/tests/.*|(\\.|/))(test|spec)\\.[jt]s?$',
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
};
