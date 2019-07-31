/** @module jaid-core */

import jaidLogger from "jaid-logger"
import camelCase from "camelcase"
import essentialConfig from "essential-config"
import hasContent from "has-content"
import Sequelize from "sequelize"
import {isString} from "lodash"

/**
 * @typedef {Object} Options
 * @prop {string} name
 * @prop {string|string[]} [folder]
 * @prop {string} version
 * @prop {import("essential-config").Options} configSetup
 * @prop {boolean|string} database
 * @prop {Object<string, *>} sequelizeOptions
 */

/**
 * @class
 */
export default class {

  /**
   * @constructor
   * @param {Options} options
   */
  constructor(options) {
    /**
     * @type {Date}
     */
    this.startTime = new Date()
    options = {
      configSetup: {},
      ...options,
    }
    const hasDatabase = Boolean(options.database)
    /**
     * @type {string}
     */
    this.camelName = options.name |> camelCase
    /**
     * @type {string[]}
     */
    const appPath = [...options.folder || [], options.name]
    /**
     * @type {import("jaid-logger").JaidLogger}
     */
    this.logger = jaidLogger(appPath)
    /**
     * @type {string}
     */
    this.appFolder = this.logger.appFolder
    /**
     * @type {string}
     */
    this.logFolder = this.logger.logFolder
    if (options.configSetup.defaults === undefined) {
      options.configSetup.defaults = {}
    }
    if (options.configSetup.sensitiveKeys === undefined) {
      options.configSetup.sensitiveKeys = []
    }
    if (hasDatabase) {
      Object.assign(options.configSetup.defaults, {
        databaseName: isString(options.database) ? options.database : this.camelName,
        databaseUser: "postgres",
        databaseHost: "localhost",
        databasePort: 5432,
        timezone: "Europe/Berlin",
      })
      options.configSetup.sensitiveKeys.push("databasePassword")
    }
    const configResult = essentialConfig(options.configSetup)
    if (!configResult.config) {
      this.logger.warn("Set up default config at %s, please edit and restart!", configResult.configFile)
      process.exit(2)
    }
    if (configResult.newKeys |> hasContent) {
      this.logger.info("Added new keys to config file %s: %s", configResult.config, configResult.newKeys.join(", "))
    }
    /**
     * @type {string}
     */
    this.configFile = configResult.configFile
    /**
     * @type {Object<string, *>}
     */
    this.config = configResult.config
    if (hasDatabase) {
      this.database = new Sequelize({
        dialect: "postgres",
        host: this.config.databaseHost,
        port: this.config.databasePort,
        database: this.config.databaseName,
        username: this.config.databaseUser,
        password: this.config.databasePassword,
        timezone: this.config.timezone,
        benchmark: true,
        logging: line => {
          this.logger.debug(line)
        },
        ...options.sequelizeOptions,
      })
    }
  }

  async init() {

  }

}