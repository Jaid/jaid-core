import path from "path"

import got from "got"
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
  })
  core.koa.use(async context => {
    context.body = "hi"
  })
  await core.init()
  const response = await got("http://localhost:13333")
  expect(response.statusCode).toBe(200)
  expect(response.statusMessage).toBe("OK")
  expect(response.headers["x-response-time"]).toBeTruthy()
  expect(response.body).toBe("hi")
  await core.close()
}, ms`5 seconds`)