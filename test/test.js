import path from "path"

import Sequelize from "sequelize"
import ms from "ms.macro"

const indexModule = (process.env.MAIN ? path.resolve(process.env.MAIN) : path.join(__dirname, "..", "src")) |> require

/**
 * @type { import("../src") }
 */
const {default: JaidCore} = indexModule

const port = 15183

it("should run", async () => {
  const core = new JaidCore({
    name: _PKG_TITLE,
    folder: ["Jaid", _PKG_TITLE, "test", new Date().toISOString()],
    insecurePort: port,
    version: _PKG_VERSION,
    serverLogLevel: "info",
    databaseLogLevel: "info",
    gotLogLevel: "info",
    database: true,
    useGot: true,
    sqlite: true,
  })
  expect(core.got).toBeTruthy()
  expect(typeof core.got.get === "function").toBeTruthy()
  let requestReceived = false
  core.koa.use(async context => {
    requestReceived = true
    context.body = "hi"
  })
  let pluginCalled = false
  let modelCalled = false
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
  const pluginClass = class {

    async init() {
      pluginCalled = true
    }

    collectModels() {
      return {
        Cat: modelDefinition,
      }
    }

  }
  await core.init({main: pluginClass})
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
  await core.close()
}, ms`10 seconds`)