import { ModuleBuilder } from '../../../src/index';
import { TimeInput, TimeOutput, CurrentTime } from './usecases/current_time';

export function buildTimeModule(m: ModuleBuilder): void {
  m.usecase('now', CurrentTime.fromJson, {
    inputClass: TimeInput,
    outputClass: TimeOutput,
    method: 'GET',
  });
}
