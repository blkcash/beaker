/* globals customElements */
import { LitElement, html, css } from '../vendor/lit-element/lit-element'
import _get from 'lodash.get'
import buttonsCSS from './buttons.css'
import * as bg from './bg-process-rpc'

class CreatePagePrompt extends LitElement {
  static get properties () {
    return {
      url: {type: String}
    }
  }

  static get styles () {
    return [buttonsCSS, css`
      .wrapper {
        overflow: hidden;
        padding: 10px 16px;
      }
    `]
  }

  constructor () {
    super()
    this.reset()
  }

  reset () {
  }

  async init (params) {
    this.url = params.url
    await this.requestUpdate()
  }

  // rendering
  // =

  render () {
    return html`
      <link rel="stylesheet" href="beaker://assets/font-awesome.css">
      <div class="wrapper">
        Create a new page here using
        <button @click=${e => this.onClickCreate(e, 'md')}>Markdown</button>
        or
        <button @click=${e => this.onClickCreate(e, 'html')}>HTML</button>
      </div>
    `
  }

  // events
  // =

  async onClickCreate (e, ext) {
    var urlp = new URL(this.url)
    var path = urlp.pathname

    // figure out a path that works for the given ext
    if (!path || path.endsWith('/')) {
      path = `${path}index.${ext}`
    } else if (path.endsWith(`.${ext}`)) {
      // path = path (noop)
    } else if (/.(md|html)$/i.test(path)) {
      path = `${path.replace(/.(md|html)$/i, '')}.${ext}`
    } else {
      path = `${path}.${ext}`
    }

    // ensure the parent directory exists
    var pathParts = path.split('/').filter(Boolean).slice(0, -1)
    var pathAgg = []
    for (let pathPart of pathParts) {
      try {
        pathAgg.push(pathPart)
        await bg.hyperdrive.mkdir(urlp.hostname, pathAgg.join('/'))
      } catch (e) {
        // ignore, dir already exists (probably)
      }
    }

    // create the file
    await bg.hyperdrive.writeFile(urlp.hostname, path, '')
    let newUrl = `${urlp.origin}${path}`
    bg.prompts.executeSidebarCommand('show-panel', 'editor-app')
    bg.prompts.executeSidebarCommand('set-context', 'editor-app', newUrl)
    bg.prompts.loadURL(newUrl)
  }
}

customElements.define('create-page-prompt', CreatePagePrompt)
