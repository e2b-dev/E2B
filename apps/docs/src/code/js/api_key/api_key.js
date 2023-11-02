import { Sandbox } from "@e2b/sdk";

const explicitAPIKey = await Sandbox.create({
  id: "base",
  apiKey: "YOUR_API_KEY"
});
await explicitAPIKey.close();
