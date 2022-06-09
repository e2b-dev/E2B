import { writeFileSync } from 'fs'
import { Session } from '../dist/cjs/index.js'

const reportSummaryFile = process.env.SUMMARY_FILE

async function spinSession(id) {
  let session
  try {
    const startTime = performance.now()
    session = new Session({
      id,
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
    const timeToSession = await spinSession(process.env.CODE_SNIPPET_ID)
    writeMeasurements({ [`Public session (${process.env.CODE_SNIPPET_ID})`]: `${Math.round(timeToSession)}ms` })

  } catch (e) {
    writeMeasurements({ [`Public session (${process.env.CODE_SNIPPET_ID})`]: e.message })
  }
}

main()
