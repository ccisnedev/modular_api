import 'package:modular_api/modular_api.dart';

import 'usecases/hello_world.dart';

void buildGreetingsModule(ModuleBuilder m) {
  m.usecase(
    'hello',
    HelloWorld.fromJson,
    inputExample: HelloInput.example,
    outputExample: HelloOutput.example,
  );
}