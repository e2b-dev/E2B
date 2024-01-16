var url = new URL("https://e2b-landing-page.framer.website/");
var htmlBody = url.toString();
htmlBody = htmlBody
    .replaceAll('href="https://e2b-landing-page.framer.website', 'href="https://e2b.dev')
    .replace('href="https://e2b-blog.framer.website', url.pathname === '/' ? 'href="https://e2b.dev/blog' : 'href="https://e2b.dev')
    .replace('href="https://e2b-changelog.framer.website', url.pathname === '/' ? 'href="https://e2b.dev/changelog' : 'href="https://e2b.dev')
    .replace('href="https://e2b-blog.framer.website/"', 'href="https://e2b.dev/blog')
    .replace('href="https://e2b-changelog.framer.website/"', 'href="https://e2b.dev/changelog')
    .replace(/\/$/, ""); // Remove trailing slash
console.log(htmlBody);
