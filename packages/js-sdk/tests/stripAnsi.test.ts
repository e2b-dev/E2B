import { expect, test } from 'vitest'
import { stripAnsi } from '../src/utils'

// Mirrors packages/python-sdk/tests/shared/template/utils/test_strip_ansi_escape_codes.py

test('strips basic SGR color', () => {
  expect(stripAnsi('\x1b[31mred\x1b[0m')).toBe('red')
})

test('strips semicolon-separated params', () => {
  expect(stripAnsi('\x1b[1;31;42mhi\x1b[0m')).toBe('hi')
})

test('strips semicolon 256-color', () => {
  expect(stripAnsi('\x1b[38;5;82mX\x1b[0m')).toBe('X')
})

test('strips colon 256-color', () => {
  expect(stripAnsi('\x1b[38:5:82mX\x1b[0m')).toBe('X')
})

test('strips colon truecolor', () => {
  expect(stripAnsi('\x1b[38:2::255:0:0mRED\x1b[0m')).toBe('RED')
})

test('strips colon curly underline', () => {
  expect(stripAnsi('\x1b[4:3mX\x1b[0m')).toBe('X')
})

test('leaves plain text unchanged', () => {
  expect(stripAnsi('no escape codes here')).toBe('no escape codes here')
})

test('strips OSC hyperlink', () => {
  expect(stripAnsi('\x1b]8;;https://e2b.dev\x07E2B\x1b]8;;\x07')).toBe('E2B')
})

test('strips OSC window title (BEL terminated)', () => {
  expect(stripAnsi('\x1b]0;my title\x07text')).toBe('text')
})

test('strips OSC window title (ESC backslash terminated)', () => {
  expect(stripAnsi('\x1b]0;my title\x1b\\text')).toBe('text')
})

test('strips OSC spanning newlines', () => {
  expect(stripAnsi('\x1b]0;line1\nline2\x07after')).toBe('after')
})

test('strips only to the first OSC terminator', () => {
  expect(stripAnsi('\x1b]0;title\x07middle\x1b]0;other\x07end')).toBe(
    'middleend'
  )
})

test('strips cursor movement', () => {
  expect(stripAnsi('\x1b[2Ax\x1b[1000Dy')).toBe('xy')
})

test('strips erase line', () => {
  expect(stripAnsi('\x1b[2Kdone')).toBe('done')
})
test('strips DCS (ESC backslash terminated)', () => {
  expect(stripAnsi('\x1bPabc\x1b\\done')).toBe('done')
})

test('strips DCS sixel payload', () => {
  expect(stripAnsi('\x1bPq#0;2;0;0;0~~@@\x1b\\image')).toBe('image')
})

test('strips SOS', () => {
  expect(stripAnsi('\x1bXhidden\x1b\\ok')).toBe('ok')
})

test('strips PM', () => {
  expect(stripAnsi('\x1b^private msg\x1b\\ok')).toBe('ok')
})

test('strips APC', () => {
  expect(stripAnsi('\x1b_app command\x07ok')).toBe('ok')
})

test('strips only the intro of an unterminated DCS', () => {
  expect(stripAnsi('\x1bPno terminator here')).toBe('no terminator here')
})
