export interface Template {
  title: string
  content: string
}

const templates: { [key: string]: Template } = {
  createReactApp: {
    title: 'React App',
    content: '# A starter react app\nA starter react app based on the latest standards.',
  },
  createLaravelApp: {
    title: 'Laravel App',
    content: '',
  },
  createNextApp: {
    title: 'Next.js App',
    content: '',
  },
  createRailsApp: {
    title: 'Rails App',
    content: '',
  },
  createDjangoApp: {
    title: 'Django App',
    content: '',
  },
}

export default templates
