import OpenAI from 'openai'
import * as e2b from '../dist/cjs/index.js'
import fs from 'node:fs'

const systemPrompt =
  "You're a helpful Python data analyst. Users ask you to solve data analysis problems and you solve them with running Python code. You can use popular python data analysis libraries such as numpy, pandas, and matplotlib."
const history = [
  {
    role: 'system',
    content: systemPrompt,
  },
  {
    role: 'user',
    content:
      'I uploaded a CSV file here "/home/user/data.csv". What can you tell me about the data in this csv file?',
  },
  {
    role: 'assistant',
    content:
      "Let's start by loading the data and then we can explore its general characteristics such as the number of rows and columns, column names and types, missing values, and basic statistics.",
  },
  {
    role: 'assistant',
    content: `import pandas as pd

# Load the data
file_path = '/home/user/data.csv'
csv_data = pd.read_csv(file_path)

# Basic information about the data
basic_info = csv_data.info()

# Displaying the first few rows of the dataframe
head_data = csv_data.head()

# Basic statistical details
desc_stats = csv_data.describe(include='all')

print(basic_info)
print(head_data)
print(desc_stats)
`,
    name: 'run_python_code',
  },
]

const desc = `Run Python code in a sandboxed environment. You have access to the internet and can load and save files from the "/home/user" directory. The following packages are installed:
NumPy - Used for numerical computing in Python. It provides support for arrays (including multidimensional arrays), as well as an assortment of mathematical functions to operate on these arrays.
Pandas - A data analysis and manipulation library for Python. It provides data structures for efficiently storing large datasets and tools for reshaping, aggregating, and filtering data.
Matplotlib - A plotting library for creating static, interactive, and animated visualizations in Python.
SciPy - Used for scientific computing in Python. It builds on NumPy and provides a large number of functions that operate on numpy arrays and are useful for different types of scientific and engineering applications.
Scikit-learn - A machine learning library that provides simple and efficient tools for data analysis and modeling. It integrates well with other scientific libraries in the Python ecosystem.
NLTK (Natural Language Toolkit) - A library for working with human language data. It provides easy-to-use interfaces to over 50 corpora and lexical resources.
Flask - A micro web framework written in Python. It provides tools to create and run web applications.
Django - A high-level web framework that encourages rapid development and clean, pragmatic design.
Requests - A library for making HTTP requests in Python. It abstracts many of the complexities of making requests behind a simple API.
Beautiful Soup - Used for web scraping purposes to pull the data out of HTML and XML documents.
SQLAlchemy - A SQL toolkit and Object-Relational Mapping (ORM) library for Python. It provides a set of high-level API to connect to relational databases.`

const functions = [
  {
    name: 'run_python_code',
    description: desc,
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The Python code to run.',
        },
      },
    },
    required: ['code'],
  },
]

let s
const openai = new OpenAI()
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: history,
  functions,
})

async function startSession() {
  s = await e2b.DataAnalysis.create()

  const localFile = fs.readFileSync('/Users/mlejva/Downloads/netflix.csv')
  const remotePath = await s.uploadFile(localFile, 'netflix.csv')
}

async function runPython(code) {
  const { artifacts } = await s.runPython(code, {
    onStdout: console.log,
    onStderr: console.error,
  })
  for (const artifact of artifacts) {
    console.log('ARTIFACT')
    console.log(artifact)
    // const data = await s.downloadFile(artifact.path, 'buffer')
    // fs.writeFileSync(artifact.path, data)
  }
}

await s.close()
