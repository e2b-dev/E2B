import { app } from './app'

const port = 9001

app.listen(port, () =>
  console.log(`Listening at http://localhost:${port}`)
)
