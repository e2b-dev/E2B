import type { MDXRemoteSerializeResult } from 'next-mdx-remote'

// Layout //
export interface Layout {
  type: 'Code'
}

export interface CodeLayout extends Layout {
  props: {
    tabs: {
      path: string
    }[]
  }
}
//////////

// Step //
export interface Step {
  type: 'Intro' | 'Rating' | 'Guide'
  title: string
}

export interface RatingStep extends Step {
  type: 'Rating'
  content: MDXRemoteSerializeResult
}

export interface GuideStep extends Step {
  type: 'Guide'
  layout: Layout | null
  content: MDXRemoteSerializeResult
}
//////////

export interface Intro {
  title: string
  content: MDXRemoteSerializeResult
  tags: string[]
  image: string | null
}

export interface Guide {
  title: string
  environmentID: string
  intro: Intro
  steps: (GuideStep | RatingStep)[]
}
