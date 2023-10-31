from e2b import Session

session = Session.create(id="Nodejs")

file_in_bytes = session.download_file('path/to/remote/file/inside/sandbox') # $HighlightLine
# Save file to local filesystem
with open('path/to/local/file', 'wb') as f: # $HighlightLine
  f.write(file_in_bytes) # $HighlightLine

session.close()
