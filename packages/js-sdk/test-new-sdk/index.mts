import { Sandbox } from './src'

const sbx = await Sandbox.create()

sbx.files

const cmd = await sbx.commands.run('echo', {
})




