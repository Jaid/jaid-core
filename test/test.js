import cleanStack from "clean-stack"
import delay from "delay"
import {router} from "fast-koa-router"
import moment from "moment"
import ms from "ms.macro"
import path from "path"
import readFileString from "read-file-string"
import Sequelize from "sequelize"
import socketIo from "socket.io"
import socketIoClient from "socket.io-client"

const indexModule = (process.env.MAIN ? path.resolve(process.env.MAIN) : path.join(__dirname, "..", "src")) |> require

/**
 * @type { import("../src") }
 */
const {default: JaidCore, JaidCorePlugin} = indexModule

const port = 15183

it("should run", async () => {
  const core = new JaidCore({
    name: _PKG_TITLE,
    folder: ["Jaid", _PKG_TITLE, "test", new Date().toISOString(), "1"],
    insecurePort: port,
    version: _PKG_VERSION,
    serverLogLevel: "info",
    databaseLogLevel: "info",
    gotLogLevel: "info",
    database: true,
    useGot: true,
    sqlite: true,
  })
  let requestReceived = false
  let pluginCalled = false
  let modelCalled = false
  let receivedKey = null
  const modelDefinition = {
    default: class extends Sequelize.Model {

      static start() {
        modelCalled = true
      }

    },
    schema: {
      color: Sequelize.STRING,
      name: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      birthDay: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    },
  }
  const removePluginClass = class {

    async preInit() {
      return false
    }

  }
  const mainPluginClass = class {

    async init() {
      pluginCalled = true
    }

    collectModels() {
      return {
        Cat: modelDefinition,
      }
    }

  }
  const socketPluginClass = class extends JaidCorePlugin {

    async init() {
      this.socketServer = socketIo(core.insecureServer)
      this.socketServer.on("connection", client => {
        receivedKey = client.handshake.query.key
        this.logger.info("Client has connected!")
        this.client = client
      })
    }

    close() {
      if (this.client) {
        this.client.disconnect()
      }
    }

  }
  await core.init({
    main: mainPluginClass,
    removeMe: removePluginClass,
    socketServer: socketPluginClass,
  })
  core.koa.use(router({
    get: {
      "/": async context => {
        requestReceived = true
        context.body = "hi"
      },
    },
  }))
  expect(core.got).toBeTruthy()
  expect(typeof core.got.get === "function").toBeTruthy()
  expect(Object.keys(core.plugins).length).toBe(2)
  expect(pluginCalled).toBe(true)
  expect(modelCalled).toBe(true)
  core.logger.info("App folder: %s", core.appFolder)
  const response = await core.got(`http://localhost:${port}`)
  expect(requestReceived).toBeTruthy()
  expect(response.statusCode).toBe(200)
  expect(response.statusMessage).toBe("OK")
  expect(response.headers["x-response-time"]).toBeTruthy()
  expect(response.body).toBe("hi")
  await core.database.models.Cat.bulkCreate([
    {
      name: "Mia",
      color: "grey",
      birthDay: new Date("2013-03-16T14:00:00"),
    },
    {
      name: "Aki",
      color: "grey",
      birthDay: new Date("2011-09-23T09:00:00"),
    },
  ])
  const aki = await core.database.models.Cat.findOne({
    where: {
      name: "Aki",
    },
    attributes: ["color"],
  })
  expect(aki.color).toBe("grey")
  const socketClient = socketIoClient(`http://localhost:${port}`, {
    query: {
      key: "mykey",
    },
  })
  await delay(ms`1 second`)
  expect(socketClient.connected).toBe(true)
  expect(receivedKey).toBe("mykey")
  socketClient.close()
  await core.close()
  const dateString = moment().format("YYYY-MM-DD")
  const logFile = path.join(core.logger.logFolder, "debug", `${dateString}.txt`)
  const content = await readFileString(logFile)
  expect(content).toMatch("3 plugins: main (self-managed), removeMe (self-managed), socketServer (auto-managed)")
}, ms`10 seconds`)

it("should log error", async () => {
  let catchedError = false
  const core = new JaidCore({
    name: _PKG_TITLE,
    folder: ["Jaid", _PKG_TITLE, "test", new Date().toISOString(), "2"],
    version: _PKG_VERSION,
  })
  const mainPluginClass = class {

    async init() {
      const emptyObject = {}
      emptyObject.a.this_should_throw_an_error_so_do_not_worry_about_this_error_stack = 0 // Should throw an Error
    }

  }
  try {
    await core.init({
      main: mainPluginClass,
    })
  } catch (error) {
    catchedError = error
  }
  expect(catchedError).toBeTruthy()
  expect(catchedError.stack).toBeTruthy()
  const errorMessagePattern = /Cannot set property 'b' of undefined/
  expect(cleanStack(catchedError.stack, {pretty: true})).toMatch(errorMessagePattern)
  const logFolder = path.join(core.appFolder, "log", "error")
}, ms`5 seconds`)