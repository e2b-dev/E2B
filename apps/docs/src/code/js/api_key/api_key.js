import { Sandbox } from "@e2b/sdk";

const explicitAPIKey = await Sandbox.create({
  id: "Nodejs",
  apiKey: "YOUR_API_KEY"
});
await explicitAPIKey.close();
