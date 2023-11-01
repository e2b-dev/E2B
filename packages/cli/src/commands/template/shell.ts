import * as e2b from "@e2b/sdk";
import * as commander from "commander";

import { ensureAPIKey } from "src/api";
import { spawnConnectedTerminal } from "src/terminal";
import { asBold, asFormattedSandboxTemplate } from "src/utils/format";

export const shellCommand = new commander.Command("shell")
  .description("Connect terminal to sandbox")
  .argument("<id>", `Connect to sandbox specified by ${asBold("<id>")}`)
  .alias("sh")
  .action(async (id: string) => {
    try {
      const apiKey = ensureAPIKey();

      const template: Pick<e2b.components["schemas"]["Environment"], "envID"> =
        {
          envID: id,
        };

      await connectSandbox({ apiKey, template: template });
      // We explicitly call exit because the session is keeping the program alive.
      // We also don't want to call session.close because that would disconnect other users from the edit session.
      process.exit(0);
    } catch (err: any) {
      console.error(err);
      process.exit(1);
    }
  });

async function connectSandbox({
  apiKey,
  template,
}: {
  apiKey: string;
  template: Pick<e2b.components["schemas"]["Environment"], "envID">;
}) {
  const session = new e2b.Session({
    apiKey,
    id: template.envID,
  });

  await session.open({});

  if (session.terminal) {
    const { exited } = await spawnConnectedTerminal(
      session.terminal,
      `Terminal connected to sandbox ${asFormattedSandboxTemplate(
        template,
      )}\nwith session URL ${asBold(`https://${session.getHostname()}`)}`,
      `Disconnecting terminal from sandbox ${asFormattedSandboxTemplate(
        template,
      )}`,
    );

    await exited;
    console.log(
      `Closing terminal connection to sandbox ${asFormattedSandboxTemplate(
        template,
      )}`,
    );
  } else {
    throw new Error("Cannot start terminal - no session");
  }
}
