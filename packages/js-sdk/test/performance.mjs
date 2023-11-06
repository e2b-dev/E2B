import { writeFileSync } from 'fs'

import { Sandbox } from '../dist/index.js'

const reportSummaryFile = process.env.SUMMARY_FILE || './test.md'

const codeSnippetIDs = ['5udkAFHBVrGz']
const samplePerID = 15
const upperBoundary = 1000 // 1s

async function spinSandbox(id) {
  console.log('Creating sandbox...')
  let sandbox
  try {
    const startTime = performance.now()
    sandbox = new Sandbox({
      id
      // debug: true,
    })
    sandbox.open()

    const endTime = performance.now()
    return endTime - startTime
  } catch (e) {
    console.error(`Measuring ${id} failed`, e)
  } finally {
    ;(async () => {
      try {
        // await sandbox?.close()
      } catch (e) {
        // Do nothing
      }
    })()
  }

  throw new Error('**Measurement failed**')
}

function createReport(data, time) {
  let template = `# E2B SDK - Sandbox Performance

*${time}*

## Results

| Test | Samples | Result |
| ------------- | ------------- | ------------- |`

  const createRow = (key, value) => {
    template = template + `\n| ${key} | ${value.size} | ${value.result} |`
  }

  Object.entries(data).forEach(e => createRow(e[0], e[1]))

  return template
}

function writeMeasurements(data) {
  const time = new Date(Date.now())

  const report = createReport(data, time)
  writeFileSync(reportSummaryFile, report)
}

async function sample(id, size) {
  let totalTime = 0
  const entryName = `Public sandbox (${id})`

  try {
    for (let i = 0; i < size; i++) {
      const timeToSandbox = await spinSandbox(id)
      totalTime += timeToSandbox
    }

    const averageTime = Math.round(totalTime / size)

    return {
      [entryName]: {
        result: `${averageTime}ms ${averageTime < upperBoundary ? ':heavy_check_mark:' : ':x:'
        }`,
        size
      }
    }
  } catch (e) {
    return {
      [entryName]: {
        size,
        result: e.message
      }
    }
  }
}

async function main() {
  let entries = {}

  for (const id of codeSnippetIDs) {
    const entry = await sample(id, samplePerID)
    entries = { ...entries, ...entry }
  }

  // for (const id of codeSnippetIDs) {
  //   // We do only one sample of persistent sandbox because otherview we would get reconnected to the same sandbox
  //   const entry = await sample(id, 1, true)
  //   entries = { ...entries, ...entry }
  // }

  writeMeasurements(entries)
}

main()
