import {
  Sandbox as SandboxBase,
  SandboxOpts as SandboxOptsBase,
  CommandHandle,
  CommandResult,
  CommandExitError,
  TimeoutError,
} from 'e2b'

import { generateRandomString } from './utils'

interface CursorPosition {
  x: number
  y: number
}

interface ScreenSize {
  width: number
  height: number
}

const MOUSE_BUTTONS = {
  left: 1,
  right: 3,
  middle: 2,
}

const KEYS = {
  alt: 'Alt_L',
  alt_left: 'Alt_L',
  alt_right: 'Alt_R',
  backspace: 'BackSpace',
  break: 'Pause',
  caps_lock: 'Caps_Lock',
  cmd: 'Super_L',
  command: 'Super_L',
  control: 'Control_L',
  control_left: 'Control_L',
  control_right: 'Control_R',
  ctrl: 'Control_L',
  del: 'Delete',
  delete: 'Delete',
  down: 'Down',
  end: 'End',
  enter: 'Return',
  esc: 'Escape',
  escape: 'Escape',
  f1: 'F1',
  f2: 'F2',
  f3: 'F3',
  f4: 'F4',
  f5: 'F5',
  f6: 'F6',
  f7: 'F7',
  f8: 'F8',
  f9: 'F9',
  f10: 'F10',
  f11: 'F11',
  f12: 'F12',
  home: 'Home',
  insert: 'Insert',
  left: 'Left',
  menu: 'Menu',
  meta: 'Meta_L',
  num_lock: 'Num_Lock',
  page_down: 'Page_Down',
  page_up: 'Page_Up',
  pause: 'Pause',
  print: 'Print',
  right: 'Right',
  scroll_lock: 'Scroll_Lock',
  shift: 'Shift_L',
  shift_left: 'Shift_L',
  shift_right: 'Shift_R',
  space: 'space',
  super: 'Super_L',
  super_left: 'Super_L',
  super_right: 'Super_R',
  tab: 'Tab',
  up: 'Up',
  win: 'Super_L',
  windows: 'Super_L',
}

function mapKey(key: string): string {
  const lowerKey = key.toLowerCase()
  if (lowerKey in KEYS) {
    return KEYS[lowerKey as keyof typeof KEYS]
  }
  return lowerKey
}

/**
 * Configuration options for the Sandbox environment.
 * @interface SandboxOpts
 * @extends {SandboxOptsBase}
 */
export interface SandboxOpts extends SandboxOptsBase {
  /**
   * The screen resolution in pixels, specified as [width, height].
   * @type {[number, number]}
   */
  resolution?: [number, number]

  /**
   * Dots per inch (DPI) setting for the display.
   * @type {number}
   */
  dpi?: number

  /**
   * Display identifier.
   * @type {string}
   */
  display?: string
}

export class Sandbox extends SandboxBase {
  protected static override readonly defaultTemplate: string = 'desktop'
  public display: string = ':0'
  public stream: VNCServer = new VNCServer(this)
  private lastXfce4Pid: number | null = null

  /**
   * Use {@link Sandbox.create} to create a new Sandbox instead.
   *
   * @hidden
   * @hide
   * @internal
   * @access protected
   */
  constructor(
    opts: Omit<SandboxOpts, 'timeoutMs' | 'metadata'> & {
      sandboxId: string
      envdVersion: string
    }
  ) {
    super(opts)
  }

  /**
   * Create a new sandbox from the default `desktop` sandbox template.
   *
   * @param opts connection options.
   *
   * @returns sandbox instance for the new sandbox.
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create()
   * ```
   * @constructs Sandbox
   */
  static async create<S extends typeof Sandbox>(
    this: S,
    opts?: SandboxOpts
  ): Promise<InstanceType<S>>
  /**
   * Create a new sandbox from the specified sandbox template.
   *
   * @param template sandbox template name or ID.
   * @param opts connection options.
   *
   * @returns sandbox instance for the new sandbox.
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create('<template-name-or-id>')
   * ```
   * @constructs Sandbox
   */
  static async create<S extends typeof Sandbox>(
    this: S,
    template: string,
    opts?: SandboxOpts
  ): Promise<InstanceType<S>>
  static async create<S extends typeof Sandbox>(
    this: S,
    templateOrOpts?: SandboxOpts | string,
    opts?: SandboxOpts
  ): Promise<InstanceType<S>> {
    const { template, sandboxOpts } =
      typeof templateOrOpts === 'string'
        ? { template: templateOrOpts, sandboxOpts: opts }
        : { template: this.defaultTemplate, sandboxOpts: templateOrOpts }

    // Add DISPLAY environment variable if not already set
    const display = opts?.display || ':0'
    const sandboxOptsWithDisplay = {
      ...sandboxOpts,
      envs: {
        ...sandboxOpts?.envs,
        DISPLAY: display,
      },
    }

    const sbx = (await super.create(
      template,
      sandboxOptsWithDisplay
    )) as InstanceType<S>
    await sbx._start(display, sandboxOptsWithDisplay)

    return sbx
  }

  /**
   * Wait for a command to return a specific result.
   * @param cmd - The command to run.
   * @param onResult - The function to check the result of the command.
   * @param timeout - The maximum time to wait for the command to return the result.
   * @param interval - The interval to wait between checks.
   * @returns `true` if the command returned the result within the timeout, otherwise `false`.
   */
  async waitAndVerify(
    cmd: string,
    onResult: (result: CommandResult) => boolean,
    timeout: number = 10,
    interval: number = 0.5
  ): Promise<boolean> {
    let elapsed = 0

    while (elapsed < timeout) {
      try {
        if (onResult(await this.commands.run(cmd))) {
          return true
        }
      } catch (e) {
        if (e instanceof CommandExitError) {
          continue
        }
        throw e
      }

      await new Promise((resolve) => setTimeout(resolve, interval * 1000))
      elapsed += interval
    }

    return false
  }

  /**
   * Take a screenshot and save it to the given name.
   * @param format - The format of the screenshot.
   * @returns A Uint8Array bytes representation of the screenshot.
   */
  async screenshot(): Promise<Uint8Array>
  /**
   * Take a screenshot and save it to the given name.
   * @param format - The format of the screenshot.
   * @returns A Uint8Array bytes representation of the screenshot.
   */
  async screenshot(format: 'bytes'): Promise<Uint8Array>
  /**
   * Take a screenshot and save it to the given name.
   * @returns A Blob representation of the screenshot.
   */
  async screenshot(format: 'blob'): Promise<Blob>
  /**
   * Take a screenshot and save it to the given name.
   * @returns A ReadableStream of bytes representation of the screenshot.
   */
  async screenshot(format: 'stream'): Promise<ReadableStream<Uint8Array>>
  async screenshot(format: 'bytes' | 'blob' | 'stream' = 'bytes') {
    const path = `/tmp/screenshot-${generateRandomString()}.png`
    await this.commands.run(`scrot --pointer ${path}`)

    // @ts-expect-error
    const file = await this.files.read(path, { format })
    this.files.remove(path)
    return file
  }

  /**
   * Left click on the mouse position.
   */
  async leftClick(x?: number, y?: number): Promise<void> {
    if (x && y) {
      await this.moveMouse(x, y)
    }

    await this.commands.run('xdotool click 1')
  }

  /**
   * Double left click on the mouse position.
   */
  async doubleClick(x?: number, y?: number): Promise<void> {
    if (x && y) {
      await this.moveMouse(x, y)
    }

    await this.commands.run('xdotool click --repeat 2 1')
  }

  /**
   * Right click on the mouse position.
   */
  async rightClick(x?: number, y?: number): Promise<void> {
    if (x && y) {
      await this.moveMouse(x, y)
    }

    await this.commands.run('xdotool click 3')
  }

  /**
   * Middle click on the mouse position.
   */
  async middleClick(x?: number, y?: number): Promise<void> {
    if (x && y) {
      await this.moveMouse(x, y)
    }

    await this.commands.run('xdotool click 2')
  }

  /**
   * Scroll the mouse wheel by the given amount.
   * @param direction - The direction to scroll. Can be "up" or "down".
   * @param amount - The amount to scroll.
   */
  async scroll(
    direction: 'up' | 'down' = 'down',
    amount: number = 1
  ): Promise<void> {
    const button = direction === 'up' ? '4' : '5'
    await this.commands.run(`xdotool click --repeat ${amount} ${button}`)
  }

  /**
   * Move the mouse to the given coordinates.
   * @param x - The x coordinate.
   * @param y - The y coordinate.
   */
  async moveMouse(x: number, y: number): Promise<void> {
    await this.commands.run(`xdotool mousemove --sync ${x} ${y}`)
  }

  /**
   * Press the mouse button.
   */
  async mousePress(
    button: 'left' | 'right' | 'middle' = 'left'
  ): Promise<void> {
    await this.commands.run(`xdotool mousedown ${MOUSE_BUTTONS[button]}`)
  }

  /**
   * Release the mouse button.
   */
  async mouseRelease(
    button: 'left' | 'right' | 'middle' = 'left'
  ): Promise<void> {
    await this.commands.run(`xdotool mouseup ${MOUSE_BUTTONS[button]}`)
  }

  /**
   * Get the current cursor position.
   * @returns A object with the x and y coordinates
   * @throws Error if cursor position cannot be determined
   */
  async getCursorPosition(): Promise<CursorPosition> {
    const result = await this.commands.run('xdotool getmouselocation')

    const match = result.stdout.match(/x:(\d+)\s+y:(\d+)/)
    if (!match) {
      throw new Error(
        `Failed to parse cursor position from output: ${result.stdout}`
      )
    }

    const [, x, y] = match
    if (!x || !y) {
      throw new Error(`Invalid cursor position values: x=${x}, y=${y}`)
    }

    return { x: parseInt(x), y: parseInt(y) }
  }

  /**
   * Get the current screen size.
   * @returns An {@link ScreenSize} object
   * @throws Error if screen size cannot be determined
   */
  async getScreenSize(): Promise<ScreenSize> {
    const result = await this.commands.run('xrandr')

    const match = result.stdout.match(/(\d+x\d+)/)
    if (!match) {
      throw new Error(
        `Failed to parse screen size from output: ${result.stdout}`
      )
    }

    try {
      const [width, height] = match[1].split('x').map((val) => parseInt(val))
      return { width, height }
    } catch (error) {
      throw new Error(`Invalid screen size format: ${match[1]}`)
    }
  }

  /**
   * Write the given text at the current cursor position.
   * @param text - The text to write.
   * @param options - An object containing the chunk size and delay between each chunk of text.
   * @param options.chunkSize - The size of each chunk of text to write. Default is 25 characters.
   * @param options.delayInMs - The delay between each chunk of text. Default is 75 ms.
   */
  async write(
    text: string,
    options: { chunkSize: number; delayInMs: number } = {
      chunkSize: 25,
      delayInMs: 75,
    }
  ): Promise<void> {
    const chunks = this.breakIntoChunks(text, options.chunkSize)

    for (const chunk of chunks) {
      await this.commands.run(
        `xdotool type --delay ${options.delayInMs} -- ${this.quoteString(
          chunk
        )}`
      )
    }
  }

  /**
   * Press a key.
   * @param key - The key to press (e.g. "enter", "space", "backspace", etc.). Can be a single key or an array of keys.
   */
  async press(key: string | string[]): Promise<void> {
    if (Array.isArray(key)) {
      key = key.map(mapKey).join('+')
    } else {
      key = mapKey(key)
    }

    await this.commands.run(`xdotool key ${key}`)
  }

  /**
   * Drag the mouse from the given position to the given position.
   * @param from - The starting position.
   * @param to - The ending position.
   */
  async drag(
    [x1, y1]: [number, number],
    [x2, y2]: [number, number]
  ): Promise<void> {
    await this.moveMouse(x1, y1)
    await this.mousePress()
    await this.moveMouse(x2, y2)
    await this.mouseRelease()
  }

  /**
   * Wait for the given amount of time.
   * @param ms - The amount of time to wait in milliseconds.
   */
  async wait(ms: number): Promise<void> {
    await this.commands.run(`sleep ${ms / 1000}`)
  }

  /**
   * Open a file or a URL in the default application.
   * @param fileOrUrl - The file or URL to open.
   */
  async open(fileOrUrl: string): Promise<void> {
    const handle = await this.commands.run(`xdg-open ${fileOrUrl}`, {
      background: true,
    })
    await handle.disconnect()
  }

  /**
   * Get the current window ID.
   * @returns The ID of the current window.
   */
  async getCurrentWindowId(): Promise<string> {
    const result = await this.commands.run('xdotool getwindowfocus')
    return result.stdout.trim()
  }

  /**
   * Get the window ID of the window with the given title.
   * @param title - The title of the window.
   * @returns The ID of the window.
   */
  async getApplicationWindows(application: string): Promise<string[]> {
    const result = await this.commands.run(
      `xdotool search --onlyvisible --class ${application}`
    )

    return result.stdout.trim().split('\n')
  }

  /**
   * Get the title of the window with the given ID.
   * @param windowId - The ID of the window.
   * @returns The title of the window.
   */
  async getWindowTitle(windowId: string): Promise<string> {
    const result = await this.commands.run(`xdotool getwindowname ${windowId}`)

    return result.stdout.trim()
  }

  /**
   * Launch an application.
   * @param application - The application to launch.
   * @param uri - The URI to open in the application.
   */
  async launch(application: string, uri?: string): Promise<void> {
    const handle = await this.commands.run(
      `gtk-launch ${application} ${uri ?? ''}`,
      {
        background: true,
        timeoutMs: 0,
      }
    )
    await handle.disconnect()
  }

  protected async _start(display: string, opts?: SandboxOpts): Promise<void> {
    this.display = display
    this.lastXfce4Pid = null
    this.stream = new VNCServer(this)

    const [width, height] = opts?.resolution ?? [1024, 768]
    const xvfbHandle = await this.commands.run(
      `Xvfb ${display} -ac -screen 0 ${width}x${height}x24 ` +
        `-retro -dpi ${opts?.dpi ?? 96} -nolisten tcp -nolisten unix`,
      { background: true, timeoutMs: 0 }
    )
    await xvfbHandle.disconnect()

    const hasStarted = await this.waitAndVerify(
      `xdpyinfo -display ${display}`,
      (r: CommandResult) => r.exitCode === 0
    )
    if (!hasStarted) {
      throw new TimeoutError('Could not start Xvfb')
    }

    await this.startXfce4()
  }

  /**
   * Start xfce4 session if logged out or not running.
   */
  private async startXfce4(): Promise<void> {
    if (
      this.lastXfce4Pid === null ||
      (
        await this.commands.run(
          `ps aux | grep ${this.lastXfce4Pid} | grep -v grep | head -n 1`
        )
      ).stdout
        .trim()
        .includes('[xfce4-session] <defunct>')
    ) {
      const result = await this.commands.run('startxfce4', {
        background: true,
        timeoutMs: 0,
      })
      this.lastXfce4Pid = result.pid
      await result.disconnect()
    }
  }

  private *breakIntoChunks(text: string, n: number): Generator<string> {
    for (let i = 0; i < text.length; i += n) {
      yield text.slice(i, i + n)
    }
  }

  private quoteString(s: string): string {
    if (!s) {
      return "''"
    }

    if (!/[^\w@%+=:,./-]/.test(s)) {
      return s
    }

    // use single quotes, and put single quotes into double quotes
    // the string $'b is then quoted as '$'"'"'b'
    return "'" + s.replace(/'/g, "'\"'\"'") + "'"
  }
}

interface VNCServerOptions {
  vncPort?: number
  port?: number
  requireAuth?: boolean
  windowId?: string
}

interface UrlOptions {
  autoConnect?: boolean
  viewOnly?: boolean
  resize?: 'off' | 'scale' | 'remote'
  authKey?: string
}

// Modified VNCServer class
class VNCServer {
  private vncPort: number = 5900
  private port: number = 6080
  private novncAuthEnabled: boolean = false
  private url: URL | null = null
  private novncHandle: CommandHandle | null = null
  private password: string | undefined
  private readonly novncCommand: string
  private readonly desktop: Sandbox

  constructor(desktop: Sandbox) {
    this.desktop = desktop
    this.novncCommand =
      `cd /opt/noVNC/utils && ./novnc_proxy --vnc localhost:${this.vncPort} ` +
      `--listen ${this.port} --web /opt/noVNC > /tmp/novnc.log 2>&1`
  }

  public getAuthKey(): string {
    if (!this.password) {
      throw new Error(
        'Unable to retrieve stream auth key, check if requireAuth is enabled'
      )
    }

    return this.password
  }

  /**
   * Get the URL to a web page with a stream of the desktop sandbox.
   * @param autoConnect - Whether to automatically connect to the server after opening the URL.
   * @param viewOnly - Whether to prevent user interaction through the client.
   * @param resize - Whether to resize the view when the window resizes.
   * @param authKey - The password to use to connect to the server.
   * @returns The URL to connect to the VNC server.
   */
  public getUrl({
    autoConnect = true,
    viewOnly = false,
    resize = 'scale',
    authKey,
  }: UrlOptions = {}): string {
    if (this.url === null) {
      throw new Error('Server is not running')
    }

    const url = new URL(this.url)
    if (autoConnect) {
      url.searchParams.set('autoconnect', 'true')
    }
    if (viewOnly) {
      url.searchParams.set('view_only', 'true')
    }
    if (resize) {
      url.searchParams.set('resize', resize)
    }
    if (authKey) {
      url.searchParams.set('password', authKey)
    }
    return url.toString()
  }

  /**
   * Start the VNC server.
   */
  public async start(opts: VNCServerOptions = {}): Promise<void> {
    // If stream is already running, throw an error.
    if (await this.checkVNCRunning()) {
      throw new Error('Stream is already running')
    }

    this.vncPort = opts.vncPort ?? this.vncPort
    this.port = opts.port ?? this.port
    this.novncAuthEnabled = opts.requireAuth ?? this.novncAuthEnabled
    this.password = this.novncAuthEnabled ? generateRandomString() : undefined
    this.url = new URL(`https://${this.desktop.getHost(this.port)}/vnc.html`)

    const vncCommand = await this.getVNCCommand(opts.windowId)
    await this.desktop.commands.run(vncCommand)

    this.novncHandle = await this.desktop.commands.run(this.novncCommand, {
      background: true,
      timeoutMs: 0,
    })
    if (!(await this.waitForPort(this.port))) {
      throw new Error('Could not start noVNC server')
    }
  }

  /**
   * Stop the VNC server.
   */
  public async stop(): Promise<void> {
    if (await this.checkVNCRunning()) {
      await this.desktop.commands.run('pkill x11vnc')
    }

    if (this.novncHandle) {
      await this.novncHandle.kill()
      this.novncHandle = null
    }
  }

  /**
   * Set the VNC command to start the VNC server.
   */
  private async getVNCCommand(windowId?: string): Promise<string> {
    let pwdFlag = '-nopw'
    if (this.novncAuthEnabled) {
      // Create .vnc directory if it doesn't exist
      await this.desktop.commands.run('mkdir -p ~/.vnc')
      await this.desktop.commands.run(
        `x11vnc -storepasswd ${this.password} ~/.vnc/passwd`
      )
      pwdFlag = '-usepw'
    }

    return (
      `x11vnc -bg -display ${this.desktop.display} -forever -wait 50 -shared ` +
      `-rfbport ${this.vncPort} ${pwdFlag} 2>/tmp/x11vnc_stderr.log` +
      (windowId ? ` -id ${windowId}` : '')
    )
  }

  private async waitForPort(port: number): Promise<boolean> {
    return await this.desktop.waitAndVerify(
      `netstat -tuln | grep ":${port} "`,
      (r: CommandResult) => r.stdout.trim() !== ''
    )
  }

  /**
   * Check if the VNC server is running.
   * @returns Whether the VNC server is running.
   */
  private async checkVNCRunning(): Promise<boolean> {
    try {
      const result = await this.desktop.commands.run('pgrep -x x11vnc')
      return result.stdout.trim() !== ''
    } catch (error) {
      return false
    }
  }
}
