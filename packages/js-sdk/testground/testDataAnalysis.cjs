const e2b = require("../dist/cjs/index")
const fs = require("fs")

async function main() {
  const s = await e2b.DataAnalysis.create({
    apiKey: process.env.E2B_API_KEY,
  })
  const response = await fetch("https://storage.googleapis.com/e2b-examples/netflix.csv")
  const buffer = await response.buffer()

  const path = await s.uploadFile(buffer, "netflix.csv")

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
plt.show()`)

  console.log(result)
  for (const artifact of result.artifacts) {
    const data = await s.downloadFile(artifact.path, 'buffer')
    fs.writeFileSync(artifact.path, data)
  }

  await s.close()


}

main().catch(console.error)
