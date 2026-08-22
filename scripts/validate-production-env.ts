import { assertProductionEnvironment } from "../lib/env";

assertProductionEnvironment();
console.log(JSON.stringify({ event: "production_environment_valid" }));
