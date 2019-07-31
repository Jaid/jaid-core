/** @module jaid-core */

import jaidLogger from "jaid-logger"
import camelCase from "camelcase"
import essentialConfig from "essential-config"
import hasContent from "has-content"
import {isString} from "lodash"
import ensureArray from "ensure-array"

/**
 * @typedef {Object} Options
 * @prop {string} name
 * @prop {string|string[]} [folder]
 * @prop {string} version
 * @prop {import("essential-config").Options} configSetup
 * @prop {boolean|string} database
 * @prop {import("sequelize").Options} sequelizeOptions
 * @prop {number} insecurePort
 * @prop {number} securePort
 * @prop {boolean} [http2=false]
 * @prop {string} [serverLogLevel="debug"]
 */

/**
 * @typedef {Object<string, *>} BaseConfig
 * @prop {string} databaseName
 * @prop {string} databaseUser
 * @prop {string} databaseHost
 * @prop {number} databasePort
 * @prop {string} timezone
 * @prop {number} insecurePort
 * @prop {number} securePort
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
      http2: false,
      serverLogLevel: "debug",
      configSetup: {},
      ...options,
    }
    const hasDatabase = Boolean(options.database)
    const hasInsecureServer = Boolean(options.insecurePort)
    const hasSecureServer = Boolean(options.securePort)
    /**
     * @type {string}
     */
    this.camelName = options.name |> camelCase
    /**
     * @type {string[]}
     */
    this.appPath = [...ensureArray(options.folder), options.name]
    /**
     * @type {import("jaid-logger").JaidLogger}
     */
    this.logger = jaidLogger(this.appPath)
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
    if (hasInsecureServer) {
      Object.assign(options.configSetup.defaults, {
        insecurePort: options.insecurePort,
      })
    }
    if (hasSecureServer) {
      Object.assign(options.configSetup.defaults, {
        securePort: options.securePort,
      })
    }
    const configResult = essentialConfig(this.appPath, options.configSetup)
    if (!configResult.config) {
      this.logger.warn("Set up default config at %s, please edit and restart!", configResult.configFile)
      process.exit(2)
    }
    if (configResult.newKeys |> hasContent) {
      this.logger.info("Added new keys to config file %s: %s", configResult.configFile, configResult.newKeys.join(", "))
    }
    /**
     * @type {string}
     */
    this.configFile = configResult.configFile
    /**
     * @type {BaseConfig}
     */
    this.config = configResult.config
    if (hasDatabase) {
      const Sequelize = require("sequelize")
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
    if (hasInsecureServer || hasSecureServer) {
      const Koa = require("koa")
      /**
       * @type {import("koa")}
       */
      this.koa = new Koa()
      this.koa.use(async (context, next) => {
        await next()
        const responseTime = context.response.get("X-Response-Time")
        this.logger.log(options.serverLogLevel, "[%s %s in %sms] %s %s", context.status, context.message, responseTime, context.method, context.url)
      })
      this.koa.use(async (context, next) => {
        const startTime = Date.now()
        await next()
        context.set("X-Response-Time", Date.now() - startTime)
      })
    }
    if (hasInsecureServer) {
      const {createServer} = require(options.http2 ? "http2" : "http")
      /**
       * @type {require("http2").Http2Server}
       */
      this.insecureServer = createServer(this.koa.callback())
    }
    if (hasSecureServer) {
      const {createSecureServer} = require(options.http2 ? "http2" : "https")
      /**
       * @type {require("http2").Http2SecureServer}
       */
      this.secureServer = createSecureServer(this.koa.callback())
    }
  }

  async init() {
    if (this.insecureServer !== undefined) {
      this.insecureServer.listen(this.config.insecurePort)
      this.logger.info("Started insecure server on port %s", this.config.insecurePort)
    }
    if (this.secureServer !== undefined) {
      this.secureServer.listen(this.config.securePort)
      this.logger.info("Started secure server on port %s", this.config.securePort)
    }
  }

}