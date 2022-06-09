import { writeFileSync } from 'fs'
import { Session } from '../dist/cjs/index.js'

const reportSummaryFile = process.env.SUMMARY_FILE

async function spinSession() {
  let session
  try {
    const startTime = performance.now()
    session = new Session({
      id: process.env.CODE_SNIPPET_ID,
      codeSnippet: {
        onStateChange(state) {
          console.log(state)
        },
        onStderr(stderr) {
          console.log(stderr)
        },
        onStdout(stdout) {
          console.log(stdout)
        },
      },
      editEnabled: true,
    })
    await session.open()

    const endTime = performance.now()
    return endTime - startTime
  } catch (e) {
    console.error(e)
  } finally {
    await session?.close()
  }
}

function createReport(data, time) {
  let template = `
  Devbook SDK - session performance

  Date: ${time}

| Test  | Result |
| ------------- | ------------- |`

  const createRow = (key, value) => {
    template = template + `\n| ${key} | ${value}`
  }

  Object.entries(data).forEach(e => createRow(e[0], e[1]))
  return template
}


function writeMeasurements(data) {
  const time = new Date(Date.now())

  const report = createReport(data, time)

  writeFileSync(reportSummaryFile, report)
}

async function main() {
  try {
    const timeToSession = await spinSession()
    writeMeasurements({ timeToSession })

  } catch (e) {
    writeMeasurements({ timeToSessionError: e.message })
  }
}

main()
