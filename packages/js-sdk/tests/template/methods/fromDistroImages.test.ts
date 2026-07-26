import { expect, test } from 'vitest'
import { Template } from '../../../src'

test('fromFedoraImage', { timeout: 180000 }, async () => {
  const template = Template().fromFedoraImage('42')

  const dockerfile = Template.toDockerfile(template)

  expect(dockerfile).toBe('FROM fedora:42\n')
})

test('fromFedoraImage with default variant', { timeout: 180000 }, async () => {
  const template = Template().fromFedoraImage()

  const dockerfile = Template.toDockerfile(template)

  expect(dockerfile).toBe('FROM fedora:latest\n')
})

test('fromAlpineImage', { timeout: 180000 }, async () => {
  const template = Template().fromAlpineImage('3.22')

  const dockerfile = Template.toDockerfile(template)

  expect(dockerfile).toBe('FROM alpine:3.22\n')
})

test('fromAlpineImage with default variant', { timeout: 180000 }, async () => {
  const template = Template().fromAlpineImage()

  const dockerfile = Template.toDockerfile(template)

  expect(dockerfile).toBe('FROM alpine:latest\n')
})

test('fromArchImage', { timeout: 180000 }, async () => {
  const template = Template().fromArchImage('base-devel')

  const dockerfile = Template.toDockerfile(template)

  expect(dockerfile).toBe('FROM archlinux:base-devel\n')
})

test('fromArchImage with default variant', { timeout: 180000 }, async () => {
  const template = Template().fromArchImage()

  const dockerfile = Template.toDockerfile(template)

  expect(dockerfile).toBe('FROM archlinux:latest\n')
})
