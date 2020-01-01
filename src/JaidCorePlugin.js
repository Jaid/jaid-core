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

  /**
   * @param {string} message
   */
  log(message) {
    this.logger.info(message)
  }

  /**
   * @param {string} message
   */
  logWarning(message) {
    this.logger.warn(message)
  }

  /**
   * @param {string} message
   */
  logError(message) {
    this.logger.error(message)
  }

  /**
   * @param {string} message
   */
  logDebug(message) {
    this.logger.debug(message)
  }

}