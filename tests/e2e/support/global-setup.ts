import { existsSync } from "node:fs";
import { CORE_LIBRARY, INTERFACE } from "./relay";

/** The tests run what was built; say how to build it rather than test something stale silently. */
export default function globalSetup() {
  if (!existsSync(`${INTERFACE}/index.html`)) {
    throw new Error("The interface is not built: run `npm run build -w @rocinante/ui`.");
  }
  if (!process.env.ROCINANTE_CORE && !existsSync(CORE_LIBRARY)) {
    throw new Error(
      "The core is not built: run `dotnet build src/core/Rocinante.slnx -c Release`.",
    );
  }
}
