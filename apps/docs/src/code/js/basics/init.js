import { Sandbox } from "@e2b/sdk";

const sandbox = await Sandbox.create({
  id: "Nodejs" // or 'Bash', 'Python3', 'Java', 'Go', 'Rust', 'PHP', 'Perl', 'DotNET'
});

await sandbox.close();
