export { ShellLex, isSpace } from './lexer'
export type { ShellLexOptions } from './lexer'
export {
  DockerfileSyntaxError,
  chompHeredocContent,
  parseDockerfileAst,
  parseHeredoc,
  parseWords,
} from './syntax'
export type {
  DockerfileAst,
  DockerfileHeredoc,
  DockerfileInstruction,
  DockerfileWarning,
} from './syntax'
export { PatternMatcher } from './dockerignore'
export type { PatternMatcherOptions } from './dockerignore'
