"use strict";
// Generate a Robots file
// Add a robots.js or robots.ts file that returns a Robots object.
Object.defineProperty(exports, "__esModule", { value: true });
function robots() {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: '/private/',
        },
        sitemap: 'https://e2b.dev/sitemap.xml',
    };
}
exports.default = robots;
// Guide to creating robots.txt file: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
