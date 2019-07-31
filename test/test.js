// @ts-check

import path from "path"

const indexModule = (process.env.MAIN ? path.resolve(process.env.MAIN) : path.join(__dirname, "..", "src")) |> require

/**
 * @type { import("../src") }
 */
const {default: JaidCore} = indexModule

it("should run", () => {
  const result = new JaidCore({
    name: 2,
  })
  expect(result).toBeGreaterThan(1549410770)
})