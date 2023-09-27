import {writeFileSync} from 'fs'

import {Session} from '../dist/cjs/index.js'

const reportSummaryFile = process.env.SUMMARY_FILE || './test.md'

const codeSnippetIDs = ['5udkAFHBVrGz']
const samplePerID = 15
const upperBoundary = 1000 // 1s


async function spinSession(id) {
  console.log('Creating session...')
  let session
  try {
    const startTime = performance.now()
    session = new Session({
      id,
      // debug: true,
    })
    session.open()

    const endTime = performance.now()
    return endTime - startTime
  } catch (e) {
    console.error(
      `Measuring ${id} failed`,
      e,
    )
  } finally {
    ;(async () => {
      try {
        // await session?.close()
      } catch (e) {
        // Do nothing
      }
    })()
  }

  throw new Error('**Measurement failed**')
}

function createReport(data, time) {
  let template = `# Devbook SDK - Session Performance

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
  const entryName = `Public session (${id})`

  try {
    for (let i = 0; i < size; i++) {
      const timeToSession = await spinSession(id)
      totalTime += timeToSession
    }

    const averageTime = Math.round(totalTime / size)

    return {
      [entryName]: {
        result: `${averageTime}ms ${
          averageTime < upperBoundary ? ':heavy_check_mark:' : ':x:'
        }`,
        size,
      },
    }
  } catch (e) {
    return {
      [entryName]: {
        size,
        result: e.message,
      },
    }
  }
}

async function main() {
  let entries = {}

  for (const id of codeSnippetIDs) {
    const entry = await sample(id, samplePerID)
    entries = {...entries, ...entry}
  }

  // for (const id of codeSnippetIDs) {
  //   // We do only one sample of persistent session because otherview we would get reconnected to the same session
  //   const entry = await sample(id, 1, true)
  //   entries = { ...entries, ...entry }
  // }

  writeMeasurements(entries)
}

main()
