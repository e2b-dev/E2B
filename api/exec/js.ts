import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code } = req.body
  try {

    const output = await eval(code)
    res.status(200).json({ message: 'OK', output })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}