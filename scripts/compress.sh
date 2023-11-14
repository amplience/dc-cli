#!/bin/sh
for i in ./packages/*
do
  [ -f "$i" ] && zip -r "$i.zip" "$i" && rm "$i"
done
