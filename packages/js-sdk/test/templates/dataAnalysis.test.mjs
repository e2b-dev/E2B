import { DataAnalysis } from '../../src'
import { expect, test } from 'vitest'

test('test_data_analysis', async () => {
  const sandbox = await DataAnalysis.create()
  const result = await sandbox.runPython(
    `
import matplotlib.pyplot as plt

plt.plot([1, 2, 3, 4])
plt.ylabel('some numbers')
plt.show()
    `
  )
  await sandbox.close()
  expect(result.artifacts.length).toEqual(1)
}, 15000)


test('test_install_packages', async () => {
  const sandbox = await DataAnalysis.create()
  
  await sandbox.installPythonPackages("pandas")
  await sandbox.installPythonPackages(["pandas"])
  await sandbox.installPythonPackages(" ")
  await sandbox.installPythonPackages([])
  
  await sandbox.installSystemPackages("curl")
  await sandbox.installSystemPackages(["curl"])
  await sandbox.installSystemPackages("")
  await sandbox.installSystemPackages([])
  
  await sandbox.close()
})
