import * as mdxComponents from '@/components/mdx'

export function useMDXComponents(components) {
  return {
    ...components,
    ...mdxComponents
  }
}
