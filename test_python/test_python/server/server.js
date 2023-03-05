const express = require('express');
const app = express();
const port = 3001;

app.use(express.json());

app.post('/', (req, res) => {
  if (req.method !== 'POST') {
    res.status(400).send('Invalid request method');
  } else {
    const email = req.body.email;
    const version = require('express/package.json').version;
    res.status(200).json({ email, version });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});