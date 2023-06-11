export interface Template {
  title: string
  content: string
}

const templates: { [key: string]: Template } = {
  personalWebsite: {
    title: 'Personal Website',
    content: '# Personal Website\n Build a simple personal website\n ### Tech stack\n Simple HTML and CSS. Use Tailwind CSS for styling. \n ### Design \n Make it dark and clean. Like https://linear.app',
  },
  createReactApp: {
    title: 'React App',
    content: '# A starter react app\nA starter react app based on the latest standards with Typescript.',
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
