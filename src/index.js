/** @module jaid-core */

import jaidLogger from "jaid-logger"
import camelCase from "camelcase"
import essentialConfig from "essential-config"
import hasContent from "has-content"
import {isString} from "lodash"
import ensureArray from "ensure-array"
import sortKeys from "sort-keys"
import {SyncHook, AsyncParallelHook} from "tapable"
import pify from "pify"
import isClass from "is-class"
import mapObject from "map-obj"

import hookMapping from "./hooks.yml"

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
 * @prop {"error"|"warn"|"info"|"debug"|"silly"} [serverLogLevel="debug"]
 * @prop {"error"|"warn"|"info"|"debug"|"silly"} [databaseLogLevel="debug"]
 * @prop {"error"|"warn"|"info"|"debug"|"silly"} [gotLogLevel="debug"]
 * @prop {boolean} [useGot=true]
 */

/**
 * @typedef {Object<string, *>} BaseConfig
 * @prop {string} databaseName
 * @prop {string} databaseUser
 * @prop {string} databaseHost
 * @prop {number} databasePort
 * @prop {"alter"|"sync"|"force"|false} databaseSchemaSync
 * @prop {string} timezone
 * @prop {number} insecurePort
 * @prop {number} securePort
 */

/**
 * @typedef {Object} SequelizeDefinition
 * @prop {import("sequelize").ModelAttributes} schema
 * @prop {import("sequelize").IndexesOptions[]} indexes
 * @prop {typeof import("sequelize").Model} default
 */

/**
 * @typedef {Object<string, *>} Hooks
 * @prop {import("tapable").AsyncParallelHook} init
 * @prop {import("tapable").SyncHook} addModels
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
      databaseLogLevel: "debug",
      configSetup: {},
      useGot: true,
      ...options,
    }
    /**
     * @type {boolean}
     */
    this.hasDatabase = Boolean(options.database)
    /**
     * @type {boolean}
     */
    this.hasInsecureServer = Boolean(options.insecurePort)
    /**
     * @type {boolean}
     */
    this.hasSecureServer = Boolean(options.securePort)
    /**
     * @type {boolean}
     */
    this.hasServer = this.hasInsecureServer || this.hasSecureServer
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
    if (this.hasDatabase) {
      Object.assign(options.configSetup.defaults, {
        databaseName: isString(options.database) ? options.database : this.camelName,
        databaseUser: "postgres",
        databaseHost: "localhost",
        databasePort: 5432,
        databaseSchemaSync: "alter",
        timezone: "Europe/Berlin",
      })
      options.configSetup.sensitiveKeys.push("databasePassword")
    }
    if (this.hasInsecureServer) {
      Object.assign(options.configSetup.defaults, {
        insecurePort: options.insecurePort,
      })
    }
    if (this.hasSecureServer) {
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
    if (this.hasDatabase) {
      const Sequelize = __non_webpack_require__("sequelize")
      /**
       * @type {import("sequelize").Sequelize}
       */
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
          this.logger.log(options.databaseLogLevel, line)
        },
        ...options.sequelizeOptions,
      })
    }
    if (this.hasServer) {
      const Koa = __non_webpack_require__("koa")
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
    if (options.useGot) {
      /**
       * @type {import("got")}
       */
      const got = __non_webpack_require__("got")
      /**
       * @type {import("got").GotInstance}
       */
      this.got = got.extend({
        headers: {
          "User-Agent": `${this.camelName}/${options.version}`,
        },
        hooks: {
          afterResponse: [
            response => {
              this.logger.log(options.gotLogLevel, `Requested ${response.request.gotOptions.method} ${response.requestUrl} -> ${response.statusCode} ${response.statusMessage} in ${response.timings.phases.total}`)
              return response
            },
          ],
        },
      })
    }
    if (this.hasInsecureServer) {
      const {createServer} = __non_webpack_require__(options.http2 ? "http2" : "http")
      /**
       * @type {require("http2").Http2Server}
       */
      this.insecureServer = createServer(this.koa.callback())
    }
    if (this.hasSecureServer) {
      const {createSecureServer} = __non_webpack_require__(options.http2 ? "http2" : "https")
      /**
       * @type {require("http2").Http2SecureServer}
       */
      this.secureServer = createSecureServer(this.koa.callback())
    }
    /**
     * @type {Hooks}
     */
    this.hooks = {
      init: new AsyncParallelHook(["core"]),
    }
    if (this.hasDatabase) {
      this.hooks.addModels = new SyncHook(["registerModel"])
    }
  }

  /**
   * @param {string} modelName
   * @param {SequelizeDefinition} definition
   */
  registerModel(modelName, definition) {
    definition.default.init(definition.schema |> sortKeys, {
      modelName,
      sequelize: this.database,
      indexes: definition.indexes,
    })
  }

  /**
   * @returns {Promise<void>}
   */
  async close() {
    const closeJobs = []
    if (this.hasInsecureServer) {
      const close = pify(this.insecureServer.close.bind(this.insecureServer))
      closeJobs.push(close())
    }
    if (this.hasSecureServer) {
      const close = pify(this.secureServer.close.bind(this.secureServer))
      closeJobs.push(close())
    }
    if (this.hasDatabase) {
      closeJobs.push(this.database.close())
    }
    await Promise.all(closeJobs)
  }

  /**
   * @param {Object<string, Object>} [plugins={}]
   * @returns {Promise<void>}
   */
  async init(plugins = {}) {
    try {
      /**
       * @type {Object<string, Object>}
       */
      this.plugins = mapObject(plugins, (key, value) => {
        return [key, isClass(value) ? new value(this) : value]
      })
      /**
       * @type {boolean}
       */
      this.hasPlugins = Object.keys(this.plugins).length > 0
      for (const [pluginName, plugin] of Object.entries(this.plugins)) {
        for (const {hookName, tapFunction} of hookMapping) {
          if (plugin[hookName]) {
            this.hooks[hookName][tapFunction](pluginName, plugin[hookName])
          }
        }
      }
      if (this.hasDatabase) {
        this.hooks.addModels.call(this.registerModel.bind(this))
        const models = Object.values(this.database.models)
        if (models.length === 0) {
          this.logger.warn("No models have been registered")
          await this.database.authenticate()
        } else {
          this.logger.info("%s plugins added %s models to the database", this.hooks.addModels.taps.length, models.length)
          await this.database.authenticate()
          const modelsWithAssociate = models.filter(model => model.associate)
          if (modelsWithAssociate.length > 0) {
            for (const model of modelsWithAssociate) {
              model.associate(this.database.models)
            }
            this.logger.debug("Called associate on %s models", modelsWithAssociate.length)
          }
          if (this.config.databaseSchemaSync === "sync") {
            await this.database.sync()
          }
          if (this.config.databaseSchemaSync === "force") {
            await this.database.sync({
              force: true,
            })
          }
          if (this.config.databaseSchemaSync === "alter") {
            await this.database.sync({
              alter: true,
            })
          }
        }
      }
      const initTapCount = this.hooks.init.taps?.length || 0
      if (initTapCount > 0) {
        const startTime = Date.now()
        await this.hooks.init.promise(this)
        this.logger.info("Executed init tap for %s plugins in %s ms", initTapCount, Date.now() - startTime)
      }
      if (this.hasInsecureServer) {
        this.insecureServer.listen(this.config.insecurePort)
        this.logger.info("Started insecure server on port %s", this.config.insecurePort)
      }
      if (this.hasSecureServer) {
        this.secureServer.listen(this.config.securePort)
        this.logger.info("Started secure server on port %s", this.config.securePort)
      }
      if (this.database) {
        const modelsWithStart = Object.values(this.database.models).filter(model => model.start)
        if (modelsWithStart.length > 0) {
          const startTime = Date.now()
          const startJobs = modelsWithStart.map(async model => {
            await model.start()
          })
          await Promise.all(startJobs)
          this.logger.debug("Called start on %s models in %s ms", modelsWithStart.length, Date.now() - startTime)
        }
      }
      this.logger.info("Ready after %s ms", Date.now() - this.startTime.getTime())
    } catch (error) {
      this.logger.error("Could not initialize: %s", error)
      throw error
    }
  }

}