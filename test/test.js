import path from "path"

import ms from "ms.macro"

const indexModule = (process.env.MAIN ? path.resolve(process.env.MAIN) : path.join(__dirname, "..", "src")) |> require

/**
 * @type { import("../src") }
 */
const {default: JaidCore} = indexModule

it("should run", async () => {
  const core = new JaidCore({
    name: "jaid-core-test",
    folder: "Jaid",
    insecurePort: 13333,
    version: _PKG_VERSION,
    serverLogLevel: "info",
    databaseLogLevel: "info",
    gotLogLevel: "info",
    database: true,
    sqlite: true,
    configSetup: {
      databaseDialect: "sqlite",
    },
  })
  expect(core.got).toBeTruthy()
  expect(typeof core.got.get === "function").toBeTruthy()
  let requestReceived = false
  core.koa.use(async context => {
    requestReceived = true
    context.body = "hi"
  })
  await core.init()
  const response = await core.got("http://localhost:13333")
  expect(requestReceived).toBeTruthy()
  expect(response.statusCode).toBe(200)
  expect(response.statusMessage).toBe("OK")
  expect(response.headers["x-response-time"]).toBeTruthy()
  expect(response.body).toBe("hi")
  await core.close()
}, ms`5 seconds`)