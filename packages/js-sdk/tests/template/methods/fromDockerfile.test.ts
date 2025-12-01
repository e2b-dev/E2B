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
