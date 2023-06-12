export interface Template {
  title: string
  content: string
}

const templates: { [key: string]: Template } = {
  personalWebsite: {
    title: 'Personal Website',
    content: '# Personal Website\n Build a simple personal website\n ### Tech stack\n- Simple HTML and CSS.\n- Use Tailwind CSS for styling. \n ### Design \n - Make it dark and clean, like https://linear.app',
  },
  createReactApp: {
    title: 'React App',
    content: '# A starter react app\nA starter react app based on the latest standards with Typescript.\n\n ### Requirements\n- Responsive Design: Build a responsive user interface that adapts to different screen sizes and devices, providing an optimal experience for users.\n- Authentication: Implement user authentication using libraries like Firebase Authentication.\n- Deployment: Configure the application for deployment to a hosting platform like Netlify, Vercel, or Firebase.',
  },
  createLaravelApp: {
    title: 'Laravel App',
    content: '# Laravel App\nBuild a robust web application using the Laravel framework.\n\n### Tech stack\n- PHP for server-side scripting\n- Laravel framework for building the application\n- MySQL for the database\n\n### Features\n- User authentication and authorization\n- CRUD operations for managing data\n- RESTful API endpoints\n\n### Design\nCreate an elegant and modern user interface using Bootstrap or a custom CSS framework.\n\n### Testing\nImplement unit tests and functional tests using PHPUnit or another testing framework.',
  },
  createNextApp: {
    title: 'Next.js App',
    content: '# Next.js App\nBuild a modern web application using the Next.js framework.\n\n### Tech stack\n- React for building the user interface\n- Next.js framework for server-side rendering and routing\n- TypeScript for type checking and improved developer experience\n\n### Features\n- Server-side rendering for improved performance and SEO\n- Dynamic routing and code splitting\n- API routes for serverless functions\n- Styling with CSS modules or a CSS-in-JS solution\n\n### Design\nCreate a responsive and visually appealing UI with a CSS framework like Tailwind CSS or styled-components.',
  },
  createRailsApp: {
    title: 'Rails App',
    content: '# Rails App\nBuild a powerful web application using the Ruby on Rails framework.\n\n### Tech stack\n- Ruby for server-side scripting\n- Rails framework for building the application\n- PostgreSQL for the database\n\n### Features\n- MVC architecture for separation of concerns\n- Active Record for database interactions\n- User authentication and authorization.',
  },
  createDjangoApp: {
    title: 'Django App',
    content: '# Django App\nBuild a scalable web application using the Django framework.\n\n### Tech stack\n- Python for server-side scripting\n- Django framework for building the application\n- SQLite, PostgreSQL, or MySQL for the database\n\n### Features\n- MVC architecture for clean code organization\n- URL routing and view functions\n- Django ORM for database operations',
  },
  createWebScraper: {
    title: 'Web Scraper',
    content: '# Web Scraper\nBuild a web scraping tool to extract data from Reddit.\n\n### Tech stack\n- Python with Scrapy for web scraping\n\n### Features\n- Extract specific data from reddit \n- Handle pagination and dynamic content\n- Store scraped data in a structured format in JSON',
  },
  createChromeExtension: {
    title: 'Chrome extension',
    content: '# Website Comment Chrome Extension\n Build a Chrome extension that allows users to add comments to websites, providing a platform for users to save their thoughts, opinions, and feedback directly on web pages.\n\n### Tech Stack\n- HTML: Markup language for creating the extension\'s user interface.\n- CSS: Styling language for customizing the appearance of the comment interface.\n- JavaScript: Programming language for implementing extension functionality and user interaction.\n- Chrome Storage API: Used to store and retrieve comments for specific web pages.'
  }
}

export default templates
