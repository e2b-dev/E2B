// Just a hack so express is available when running eval
const express = require('express')
console.log(express.name)

async function handler(req, res) {
  const { code } = req.body
  try {

    const output = await eval(code)
    res.status(200).json({ message: output })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

module.exports = handler