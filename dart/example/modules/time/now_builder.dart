import 'package:modular_api/modular_api.dart';

import 'usecases/now.dart';

void buildTimeModule(ModuleBuilder m) {
  m.usecase(
    'now',
    CurrentTime.fromJson,
    inputExample: TimeInput.example,
    outputExample: TimeOutput.example,
    method: 'GET',
  );
}
