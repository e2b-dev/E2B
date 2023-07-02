export const smolDeveloperTemplateID = 'SmolDeveloper'

export interface Template {
  title: string
  content: string
}

const templates: { [key: string]: Template } = {
  createReactApp: {
    title: 'React App',
    content: '# A starter react app\nA starter react app based on the latest standards with Typescript.\n\n ### Requirements\n- Authentication: Implement user authentication using libraries like Firebase Authentication',
  },
  createNextApp: {
    title: 'Next.js App',
    content: '# Next.js App\nBuild a modern web application using the Next.js framework.\n\n### Tech stack\n- Next.js framework for server-side rendering and routing\n- TypeScript for type checking and improved developer experience\n\n### Features\n- Server-side rendering for improved performance',
  },
  createDjangoApp: {
    title: 'Django App',
    content: '# Django App\nBuild a simple web backend application using the Django framework.\n\n### Tech stack\n- Django framework for building the application\n- PostgreSQL for the database',
  },
  createLaravelApp: {
    title: 'Laravel App',
    content: '# Laravel App\nBuild a minimal working Laravel web application.\n\n### Tech stack\n- Laravel framework for building the application\n- MySQL for the database',
  },
  personalWebsite: {
    title: 'Personal Website',
    content: '# Personal Website\n Build a simple personal website.\n ### Tech stack\n- Simple HTML and CSS\n- Use Tailwind CSS for styling\n ### Design \n - Make it dark, clean and simple',
  },
  createChromeExtension: {
    title: 'Chrome extension',
    content: '# Website Comment Chrome Extension\n Build a Chrome extension with V3 manifest that allows the user to add comments to websites, providing a platform for users to save their thoughts, opinions, and feedback directly on the web pages.\n\n### Tech Stack\n- HTML: Markup language for creating the extension\'s user interface\n- CSS: Styling language for customizing the appearance of the comment interface\n- JavaScript: Programming language for implementing extension functionality and user interaction\n- Chrome Storage API: Used to store and retrieve comments for specific web pages'
  },
  createWebScraper: {
    title: 'Web Scraper',
    content: '# Web Scraper\nBuild a web scraping tool to extract data from Reddit.\n\n### Tech stack\n- Python with Scrapy for web scraping\n\n### Features\n- Extract specific data from reddit \n- Handle pagination and dynamic content\n- Store scraped data in a structured format in JSON',
  }
}

export default templates
