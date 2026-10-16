import * as migration_20261012_105725_initial from './20261012_105725_initial';

export const migrations = [
  {
    up: migration_20261012_105725_initial.up,
    down: migration_20261012_105725_initial.down,
    name: '20261012_105725_initial'
  },
];
