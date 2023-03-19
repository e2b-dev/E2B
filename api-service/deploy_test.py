from session.playground import NodeJSPlayground

playground = NodeJSPlayground([])


code = """
const express = require('express');
var app = express();

app.get('/', (req, res) => {
  res.send('hello world2')
})

"""
# code = """
# console.log('')
# """

playground.write_file("/code/index.js", code)
url = playground.deploy("t1", [])
print(url)
