import { NextApiRequest, NextApiResponse } from 'next'
import vm from 'vm'

// Just a hack so express is available when running eval
const express = require('express')
console.log(express.name)

async function postExecJS(req: NextApiRequest, res: NextApiResponse) {
  const { code } = req.body
  try {
    const context = {}
    vm.createContext(context)
    const output = vm.runInNewContext(code, context)
    res.status(200).json({ message: output })
  } catch (err: any) {
    // It's a still valid response of evaluating code (that's why status 200),
    // we just want to communicate the error.
    res.status(200).json({ message: err.message })
  }
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'POST') {
    await postExecJS(req, res)
    return
  }

  res.setHeader('Allow', 'POST')
  res.status(405).json({ statusCode: 405, message: 'Method Not Allowed' })
  return
}

export default handler
