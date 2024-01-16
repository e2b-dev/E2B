"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.middleware = void 0;
var server_1 = require("next/server");
function middleware(req) {
    return __awaiter(this, void 0, void 0, function () {
        var url, res, htmlBody, modifiedHtmlBody;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (req.method !== 'GET')
                        return [2 /*return*/, server_1.NextResponse.next()];
                    url = new URL(req.nextUrl.toString());
                    url.protocol = 'https';
                    url.port = '';
                    if (url.pathname === '' || url.pathname === '/') {
                        url.hostname = 'e2b-landing-page.framer.website';
                    }
                    if (url.pathname === '/blog' || url.pathname === '/blog/') {
                        url.pathname = '/';
                        url.hostname = 'e2b-blog.framer.website';
                    }
                    if (url.pathname.startsWith('/blog')) {
                        url.hostname = 'e2b-blog.framer.website';
                    }
                    if (url.pathname === '/changelog' || url.pathname === '/changelog/') {
                        url.pathname = '/';
                        url.hostname = 'e2b-changelog.framer.website';
                    }
                    if (url.pathname.startsWith('/changelog')) {
                        url.hostname = 'e2b-changelog.framer.website';
                    }
                    return [4 /*yield*/, fetch(url.toString(), __assign({}, req))];
                case 1:
                    res = _a.sent();
                    return [4 /*yield*/, res.text()
                        // // !!! NOTE: Replace has intentionally not completed quotes to catch the rest of the path !!!
                        // const modifiedHtmlBody = htmlBody
                        //   .replaceAll('href="https://e2b-landing-page.framer.website', 'href="https://e2b.dev')
                        //   .replaceAll(
                        //     'href="https://e2b-blog.framer.website',
                        //     // The default url on framer does not have /blog in the path but the custom domain does,
                        //     // so we need to handle this explicitly.
                        //     url.pathname === '/' ? 'href="https://e2b.dev/blog' : 'href="https://e2b.dev',
                        //   )
                        //   .replaceAll(
                        //     'href="https://e2b-changelog.framer.website',
                        //     // The default url on framer does not have /changelog in the path but the custom domain does,
                        //     // so we need to handle this explicitly.
                        //     url.pathname === '/' ? 'href="https://e2b.dev/changelog' : 'href="https://e2b.dev',
                        //   )
                    ];
                case 2:
                    htmlBody = _a.sent();
                    modifiedHtmlBody = htmlBody
                        .replaceAll('href="https://e2b-landing-page.framer.website', 'href="https://e2b.dev')
                        .replaceAll('href="https://e2b-blog.framer.website/', 'href="https://e2b.dev/blog')
                        .replaceAll('href="https://e2b-blog.framer.website', url.pathname === '/' ? 'href="https://e2b.dev/blog' : 'href="https://e2b.dev')
                        .replaceAll('href="https://e2b-changelog.framer.website', url.pathname === '/' ? 'href="https://e2b.dev/changelog' : 'href="https://e2b.dev')
                        .replaceAll('href="https://e2b-blog.framer.website/"', 'href="https://e2b.dev/blog');
                    console.log(modifiedHtmlBody);
                    return [2 /*return*/, new server_1.NextResponse(modifiedHtmlBody, {
                            status: res.status,
                            statusText: res.statusText,
                            headers: res.headers,
                            url: req.url,
                        })];
            }
        });
    });
}
exports.middleware = middleware;
// We should probably filter all /, /blog and /changelog paths here and decide what to do with them in the middleware body.
exports.config = {
    matcher: ['/', '/blog/:path*', '/changelog/:path*'],
};
// const htmlBody = '<link rel="canonical" href="https://e2b.dev/blog/">'
// // !!! NOTE: Replace has intentionally not completed quotes to catch the rest of the path !!!
//   const modifiedHtmlBody = htmlBody
//     .replaceAll('href="https://e2b-landing-page.framer.website', 'href="https://e2b.dev')
//     // add one more condition that replaces this version "https://e2b-blog.framer.website/ with "https://e2b.dev/blog too
//     .replaceAll('href="https://e2b-blog.framer.website/', 'href="https://e2b.dev/blog')
//     .replaceAll(
//       'href="https://e2b-blog.framer.website',
//       // The default url on framer does not have /blog in the path but the custom domain does,
//       // so we need to handle this explicitly.
//       '/' === '/' ? 'href="https://e2b.dev/blog' : 'href="https://e2b.dev',
//     )
//     .replaceAll(
//       'href="https://e2b-changelog.framer.website',
//       // The default url on framer does not have /changelog in the path but the custom domain does,
//       // so we need to handle this explicitly.
//       '/' === '/' ? 'href="https://e2b.dev/changelog' : 'href="https://e2b.dev',
//     )
// console.log(modifiedHtmlBody)
