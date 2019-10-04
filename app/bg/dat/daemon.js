import HyperdriveDaemon from 'hyperdrive-daemon'
import { createMetadata } from 'hyperdrive-daemon/lib/metadata'
import constants from 'hyperdrive-daemon-client/lib/constants'
import { HyperdriveClient } from 'hyperdrive-daemon-client'
import datEncoding from 'dat-encoding'
import * as pda from 'pauls-dat-api2'

const SETUP_RETRIES = 10

// typedefs
// =

/**
* @typedef {Object} DaemonDatArchive
* @prop {number} sessionId
* @prop {Buffer} key
* @prop {string} url
* @prop {string} domain
* @prop {boolean} writable
* @prop {Object} session
* @prop {Object} session.drive
* @prop {function(): Promise<void>} session.close
* @prop {function(): Promise<void>} session.publish
* @prop {function(): Promise<void>} session.unpublish
* @prop {function(): Promise<Object>} getInfo
* @prop {DaemonDatArchivePDA} pda
*
* @typedef {Object} DaemonDatArchivePDA
* @prop {function(string): Promise<Object>} stat
* @prop {function(string, Object=): Promise<any>} readFile
* @prop {function(string, Object=): Promise<Array<Object>>} readdir
* @prop {function(string): Promise<number>} readSize
* @prop {function(string, any, Object=): Promise<void>} writeFile
* @prop {function(string): Promise<void>} mkdir
* @prop {function(string, string): Promise<void>} copy
* @prop {function(string, string): Promise<void>} rename
* @prop {function(string): Promise<void>} unlink
* @prop {function(string, Object=): Promise<void>} rmdir
* @prop {function(string, string|Buffer): Promise<void>} mount
* @prop {function(string): Promise<void>} unmount
* @prop {function(string=): Promise<void>} download
* @prop {function(string=): NodeJS.ReadableStream} watch
* @prop {function(): NodeJS.ReadableStream} createNetworkActivityStream
* @prop {function(): Promise<Object>} readManifest
* @prop {function(Object): Promise<void>} writeManifest
* @prop {function(Object): Promise<void>} updateManifest
*/

// globals
// =

var client // client object created by hyperdrive-daemon-client

// exported apis
// =

export const setup = async function () {
  // instantiate the daemon
  // TODO the daemon should be managed in an external process
  await createMetadata(`localhost:${constants.port}`)
  var daemon = new HyperdriveDaemon()
  await daemon.start()
  process.on('exit', () => daemon.stop())

  for (let i = 0; i < SETUP_RETRIES; i++) {
    try {
      client = new HyperdriveClient()
      await client.ready()
    } catch (e) {
      console.log('Failed to connect to daemon, retrying', e)
    }
  }

  // attach to the process for debugging
  process.hyperdriveDaemon = daemon
  process.hyperdriveDaemonClient = client
}

/**
 * Creates a dat-archive interface to the daemon for the given key
 *
 * @param {Object} opts
 * @param {Buffer} opts.key
 * @param {number} [opts.version]
 * @param {Buffer} [opts.hash]
 * @param {boolean} [opts.writable]
 * @returns {Promise<DaemonDatArchive>}
 */
export const createDatArchiveSession = async function (opts) {
  const drive = await client.drive.get(opts)
  const key = datEncoding.toStr(drive.key)
  var datArchive = {
    key: datEncoding.toBuf(key),
    url: `dat://${key}`,
    writable: drive.writable,
    domain: undefined,

    session: {
      drive,
      async close () {
        return drive.close()
      },
      async publish () {
        return drive.publish()
      },
      async unpublish () {
        return drive.unpublish()
      }
    },

    async getInfo () {
      var [version, stats] = await Promise.all([
        drive.version(),
        drive.stats()
      ])
      return {
        version,
        peers: stats[0].metadata.peers,
        networkStats: {
          uploadTotal: stats[0].metadata.uploadedBytes + stats[0].content.uploadedBytes,
          downloadTotal: stats[0].metadata.downloadedBytes + stats[0].content.downloadedBytes
        }
      }
    },

    pda: createDatArchiveSessionPDA(drive)
  }
  return /** @type DaemonDatArchive */(datArchive)
}

// internal methods
// =

/**
 * Provides a pauls-dat-api2 object for the given archive
 * @param {Object} datArchive
 * @returns {DaemonDatArchivePDA}
 */
function createDatArchiveSessionPDA (datArchive) {
  var obj = {}
  for (let k in pda) {
    if (typeof pda[k] === 'function') {
      obj[k] = pda[k].bind(pda, datArchive)
    }
  }
  return obj
}