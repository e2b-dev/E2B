import { Sandbox } from "@e2b/sdk";

const sandbox = await Sandbox.create({
  id: "Nodejs",
});

const dirContent = await sandbox.filesystem.list("/"); // $HighlightLine
dirContent.forEach((item) => {
  console.log(item.name);
});

await sandbox.close();
