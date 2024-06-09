async function* iter() {
  try {

    for (let i = 0; i < 10; i++) {
      console.log(i)
      yield i
    }
  } finally {
    console.log('done')
  }
}


async function main() {
  for await (const a of iter()) {
    console.log(a)
    throw new Error('test')
  }
}

main()