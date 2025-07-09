import { test, assert } from 'vitest'

import Sandbox from '../../src/index.js'
import { isIntegrationTest } from '../setup.js'

const integrationTestTemplate = 'en716jw99aj63v1k8ugh'

test.skipIf(!isIntegrationTest)(
  'test python random number generation in same sandbox',
  async () => {
    const sbx = await Sandbox.create(integrationTestTemplate, {
      timeoutMs: 120,
    })
    console.log('sandboxId', sbx.sandboxId)
    const cmd1 = await sbx.commands.run(
      'python -c "import numpy as np; print([np.random.normal(),np.random.normal(),np.random.normal()])"'
    )
    console.log('cmd1 stdout', cmd1.stdout)

    const cmd2 = await sbx.commands.run(
      'python -c "import numpy as np; print([np.random.normal(),np.random.normal(),np.random.normal()])"'
    )
    console.log('cmd2 stdout', cmd2.stdout)

    assert.notEqual(cmd1.stdout, cmd2.stdout)
  }
)

test.skipIf(!isIntegrationTest)(
  'test python random number generation with same template',
  async () => {
    const sbx = await Sandbox.create(integrationTestTemplate, {
      timeoutMs: 120,
    })
    console.log('sandboxId 1', sbx.sandboxId)
    const cmd1 = await sbx.commands.run(
      'python -c "import numpy as np; print([np.random.normal(),np.random.normal(),np.random.normal()])"'
    )
    console.log('cmd1 stdout', cmd1.stdout)
    await sbx.kill()

    const sbx2 = await Sandbox.create(integrationTestTemplate, {
      timeoutMs: 120,
    })
    console.log('sandboxId 2', sbx2.sandboxId)
    const cmd2 = await sbx2.commands.run(
      'python -c "import numpy as np; print([np.random.normal(),np.random.normal(),np.random.normal()])"'
    )
    console.log('cmd2 stdout', cmd2.stdout)

    assert.notEqual(cmd1.stdout, cmd2.stdout)
  }
)
