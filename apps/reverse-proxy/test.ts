const urls = [
    "https://e2b-landing-page.framer.website/",
    "https://e2b-blog.framer.website/",
    "https://e2b-blog.framer.website/blog/ai-agents-in-2024",
  ];
  
async function main() {
    for (const url of urls) {
      console.log(`Fetching text for url ${url}`);
  
      const response = await fetch(url);
      const text = await response.text();
  
      let matches = 0;
  
      console.log(`Replacing links in text from ${url}:`);
      const replacedText = text.replaceAll(
        /href="https:\/\/e2b[^"]*"/g,
        (match) => {
          matches++;
          const modifiedText = match;
          console.log(`- ${match} -> ${modifiedText}`);
  
          return modifiedText;
        },
      );
  
      console.log(
        `Replacing links in text from ${url} finished (${matches} replacements)\n\n`,
      );
    }
    // console.log(replacedText)
  }
  
  main();