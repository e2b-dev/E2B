from e2b import run_code

llm_generated_code = 'print("This code was generated by LLM")'

def main():
  stdout, stderr = run_code('Python3', llm_generated_code) # $HighlightLine
  print(stdout)
  print(stderr)

main()