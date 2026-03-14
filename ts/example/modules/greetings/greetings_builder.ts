import { ModuleBuilder } from '../../../src/index';
import { HelloInput, HelloOutput, HelloWorld } from './usecases/hello_world';

export function buildGreetingsModule(m: ModuleBuilder): void {
  m.usecase('hello', HelloWorld.fromJson, {
    inputClass: HelloInput,
    outputClass: HelloOutput,
  });
}
