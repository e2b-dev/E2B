from session.playground import NodeJSPlayground
from session.deploy import Deployment

playground = NodeJSPlayground([])
deployment = Deployment(playground.session)


code = """
const express = require('express');
var app = express();

app.get('/', (req, res) => {
  res.send('hello world')
})

app.listen(3000, () =>
  console.log(`Example app listening at 3000`)
)
"""
# code = """
# console.log('')
# """

deployment.new("te-ddx", code, [])
