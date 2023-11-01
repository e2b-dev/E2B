import { Sandbox } from "@e2b/sdk";

const sandbox = await Sandbox.create({ id: "Nodejs" });

const url = sandbox.getHostname(); // $HighlightLine
console.log("https://" + url);

await sandbox.close();
