export async function confirm(text: string, defaultAnwser = false) {
  const inquirer = await import('inquirer')
  const confirmAnswers = await inquirer.default.prompt([
    {
      name: 'confirm',
      type: 'confirm',
      default: defaultAnwser,
      message: text,
    },
  ])

  return confirmAnswers['confirm'] as boolean
}
