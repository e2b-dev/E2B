import { app } from './app'

const port = 49160

app.listen(port, () =>
  console.log(`Listening at http://localhost:${port}`)
)
