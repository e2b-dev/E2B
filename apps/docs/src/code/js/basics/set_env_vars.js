import { Sandbox } from "@e2b/sdk";

const sandbox = await Sandbox.create({
  id: "Nodejs",
  envVars: { FOO: "Hello" }, // $HighlightLine
});

await sandbox.close();
