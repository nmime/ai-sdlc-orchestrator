const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('../../../../tsconfig.base.json');

module.exports = {
  displayName: 'feature-agent-registry',
  preset: '../../../../jest.preset.js',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/../../../../' }),
};
