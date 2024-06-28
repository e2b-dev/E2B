#!/bin/bash

sed -i '.bak' 's/from\ process\ import/from e2b.envd.process import/g' e2b/envd/process/* e2b/envd/filesystem/*
sed -i '.bak' 's/from\ filesystem\ import/from e2b.envd.filesystem import/g' e2b/envd/process/* e2b/envd/filesystem/*

rm e2b/envd/process/*.bak
rm e2b/envd/filesystem/*.bak
