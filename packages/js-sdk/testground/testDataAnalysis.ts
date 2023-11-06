import { DataAnalysis } from "../src"
import { writeFileSync } from "fs"

async function main() {
  const s = await DataAnalysis.create({
    apiKey: process.env.E2B_API_KEY
  })
  const response = await fetch('https://storage.googleapis.com/e2b-examples/netflix.csv')
  const buffer = await response.blob()

  const path = await s.uploadFile(buffer, 'netflix.csv')

  const result = await s.runPython(`
print(1)
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

data = pd.read_csv('${path}')
top_countries = data['country'].value_counts().head(10)

plt.figure(figsize=(10, 6))
top_countries.plot(kind='bar', color='skyblue')
plt.title('Number of content')
plt.xlabel('Country')
plt.ylabel('Count')
plt.xticks(rotation=45)
plt.show()`, {
    onArtifact: async (artifact) => {
      await artifact.download()
    }
  })

  console.log(result)
  for (const artifact of result.artifacts) {
    const data = await s.downloadFile(artifact.path, 'buffer')
    if (typeof data === 'string') {
      writeFileSync(artifact.path, data)
    }
  }

  await s.close()


}

main().catch(console.error)
