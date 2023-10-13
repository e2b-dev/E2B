const e2b = require("../dist/cjs/index")
const fs = require("fs")

async function main() {
  const s = e2b.DataAnalysis.create({
    apiKey: "e2b_445a7e6449fcc400dfe3b4fbd45afa398359863f"
  })
  const response = await fetch("https://storage.googleapis.com/e2b-examples/netflix.csv")
  const buffer = await response.buffer()

  const path = await s.uploadFile(buffer, "netflix.csv")
  console.log(path)

  const p = await s.process.start({
    cmd: "ls /home/user",
  })
  await p

  console.log(p.output)
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
    const data = await s.downloadFile(artifact.path)
    fs.writeFileSync(artifact.path, data)
  }

  await s.close()


}

main().catch(console.error)
