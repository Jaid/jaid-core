/**
 * @class
 */
export default class JaidCorePlugin {

  /**
   * @type {boolean}
   */
  isManagedByJaidCore = true

  /**
   * @type {import("./").default}
   */
  core = null

  /**
   * @type {import("jaid-logger").JaidLogger}
   */
  logger = null

}