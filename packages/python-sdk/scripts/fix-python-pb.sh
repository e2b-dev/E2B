#!/bin/bash

rm -rf e2b/envd/__pycache__
rm -rf e2b/envd/filesystem/__pycache__
rm -rf e2b/envd/process/__pycache__

sed -i.bak 's/from\ process\ import/from e2b.envd.process import/g' e2b/envd/process/* e2b/envd/filesystem/*
sed -i.bak 's/from\ filesystem\ import/from e2b.envd.filesystem import/g' e2b/envd/process/* e2b/envd/filesystem/*

rm -f e2b/envd/process/*.bak
rm -f e2b/envd/filesystem/*.bak
