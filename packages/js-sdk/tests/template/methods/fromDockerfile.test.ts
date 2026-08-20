import { buildTemplateTest } from '../../setup'
import { Template } from '../../../src'
import { InstructionType } from '../../../src/template/types'
import { assert } from 'vitest'

buildTemplateTest('fromDockerfile', async () => {
  const dockerfile = `FROM node:24
WORKDIR /app
COPY package.json .
RUN npm install
ENTRYPOINT ["sleep", "20"]`

  const template = Template().fromDockerfile(dockerfile)

  assert.equal(
    // @ts-expect-error - baseImage is not a property of TemplateBuilder
    template.baseImage,
    'node:24'
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[1].type,
    InstructionType.WORKDIR
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[1].args[0],
    '/'
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[2].type,
    InstructionType.WORKDIR
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[2].args[0],
    '/app'
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[3].type,
    InstructionType.COPY
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[3].args[0],
    'package.json'
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[3].args[1],
    '.'
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[4].type,
    InstructionType.RUN
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[4].args[0],
    'npm install'
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[5].type,
    InstructionType.USER
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[5].args[0],
    'user'
  )
  assert.equal(
    // @ts-expect-error - startCmd is not a property of TemplateBuilder
    template.startCmd,
    'sleep 20'
  )
})

buildTemplateTest('fromDockerfile with default user and workdir', () => {
  const dockerfile = 'FROM node:24'
  const template = Template().fromDockerfile(dockerfile)

  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[template.instructions.length - 2].type,
    InstructionType.USER
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[template.instructions.length - 2].args[0],
    'user'
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[template.instructions.length - 1].type,
    InstructionType.WORKDIR
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[template.instructions.length - 1].args[0],
    '/home/user'
  )
})

buildTemplateTest('fromDockerfile with custom user and workdir', () => {
  const dockerfile = 'FROM node:24\nUSER mish\nWORKDIR /home/mish'
  const template = Template().fromDockerfile(dockerfile)

  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[template.instructions.length - 2].type,
    InstructionType.USER
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[template.instructions.length - 2].args[0],
    'mish'
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[template.instructions.length - 1].type,
    InstructionType.WORKDIR
  )
  assert.equal(
    // @ts-expect-error - instructions is not a property of TemplateBuilder
    template.instructions[template.instructions.length - 1].args[0],
    '/home/mish'
  )
})

buildTemplateTest('fromDockerfile with multi-source COPY', () => {
  const dockerfile = `FROM node:24
COPY file1.txt file2.txt file3.txt /dest/`

  const template = Template().fromDockerfile(dockerfile)

  // After initial USER root and WORKDIR /, the multi-source COPY should
  // expand into one COPY instruction per source.
  // @ts-expect-error - instructions is not a property of TemplateBuilder
  const copyInstructions = template.instructions.filter(
    (i: { type: InstructionType }) => i.type === InstructionType.COPY
  )

  assert.equal(copyInstructions.length, 3)
  assert.equal(copyInstructions[0].args[0], 'file1.txt')
  assert.equal(copyInstructions[0].args[1], '/dest/')
  assert.equal(copyInstructions[1].args[0], 'file2.txt')
  assert.equal(copyInstructions[1].args[1], '/dest/')
  assert.equal(copyInstructions[2].args[0], 'file3.txt')
  assert.equal(copyInstructions[2].args[1], '/dest/')
})

buildTemplateTest('fromDockerfile with multi-source COPY --chown', () => {
  const dockerfile = `FROM node:24
COPY --chown=myuser:mygroup pkg.json pkg-lock.json /app/`

  const template = Template().fromDockerfile(dockerfile)

  // @ts-expect-error - instructions is not a property of TemplateBuilder
  const copyInstructions = template.instructions.filter(
    (i: { type: InstructionType }) => i.type === InstructionType.COPY
  )

  assert.equal(copyInstructions.length, 2)
  assert.equal(copyInstructions[0].args[0], 'pkg.json')
  assert.equal(copyInstructions[0].args[1], '/app/')
  assert.equal(copyInstructions[0].args[2], 'myuser:mygroup')
  assert.equal(copyInstructions[1].args[0], 'pkg-lock.json')
  assert.equal(copyInstructions[1].args[1], '/app/')
  assert.equal(copyInstructions[1].args[2], 'myuser:mygroup')
})

buildTemplateTest('fromDockerfile with COPY --chown', () => {
  const dockerfile = `FROM node:24
COPY --chown=myuser:mygroup app.js /app/
COPY --chown=anotheruser config.json /config/`

  const template = Template().fromDockerfile(dockerfile)

  // First COPY instruction (after initial USER root and WORKDIR /)
  // @ts-expect-error - instructions is not a property of TemplateBuilder
  const copyInstruction1 = template.instructions[2]
  assert.equal(copyInstruction1.type, InstructionType.COPY)
  assert.equal(copyInstruction1.args[0], 'app.js')
  assert.equal(copyInstruction1.args[1], '/app/')
  assert.equal(copyInstruction1.args[2], 'myuser:mygroup') // user from --chown

  // Second COPY instruction
  // @ts-expect-error - instructions is not a property of TemplateBuilder
  const copyInstruction2 = template.instructions[3]
  assert.equal(copyInstruction2.type, InstructionType.COPY)
  assert.equal(copyInstruction2.args[0], 'config.json')
  assert.equal(copyInstruction2.args[1], '/config/')
  assert.equal(copyInstruction2.args[2], 'anotheruser') // user from --chown (without group)
})
