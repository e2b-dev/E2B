---
"@e2b/python-sdk": patch
---

fix(python-sdk): strip uppercase AS stage alias from base image in from_dockerfile

`from_dockerfile` now removes the stage alias from a `FROM <image> AS <name>`
line case-insensitively, matching the JavaScript SDK. The Docker `AS` keyword is
case-insensitive, but the parser only matched a lowercase `as`, so a canonical
`FROM python:3.11 AS builder` leaked the alias and produced the base image
`"python:3.11 AS builder"` instead of `"python:3.11"`.
