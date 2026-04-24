export async function confirm(text: string, defaultAnswer = false) {
  const inquirer = await import('inquirer')
  const confirmAnswers = await inquirer.default.prompt([
    {
      name: 'confirm',
      type: 'confirm',
      default: defaultAnswer,
      message: text,
    },
  ])

  return confirmAnswers['confirm'] as boolean
}
