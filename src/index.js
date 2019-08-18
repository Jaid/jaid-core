/** @module jaid-core */

import path from "path"

import jaidLogger from "jaid-logger"
import camelCase from "camelcase"
import essentialConfig from "essential-config"
import hasContent from "has-content"
import {isString} from "lodash"
import ensureArray from "ensure-array"
import sortKeys from "sort-keys"
import pify from "pify"
import isClass from "is-class"
import mapObject from "map-obj"
import readableMs from "readable-ms"
import plural from "pluralize-inclusive"
import ensureEnd from "ensure-end"

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
 * @prop {boolean} [sqlite=false]
 */

/**
 * @typedef {Object} BaseConfig
 * @prop {string} databaseDialect
 * @prop {string} databaseName
 * @prop {string} databaseUser
 * @prop {string} databaseHost
 * @prop {number} databasePort
 * @prop {"alter"|"sync"|"force"|false} databaseSchemaSync
 * @prop {string} timezone
 * @prop {number} insecurePort
 * @prop {number} securePort
 * @prop {string} databasePath
 */

/**
 * @typedef {Object} SequelizeDefinition
 * @prop {import("sequelize").ModelAttributes} schema
 * @prop {import("sequelize").IndexesOptions[]} indexes
 * @prop {typeof import("sequelize").Model} default
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
      gotLogLevel: "debug",
      configSetup: {},
      useGot: false,
      sqlite: false,
      ...options,
    }
    /**
     * @type {boolean}
     */
    this.hasDatabase = Boolean(options.database || options.sqlite)
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
    if (options.configSetup.secretKeys === undefined) {
      options.configSetup.secretKeys = []
    }
    if (this.hasDatabase) {
      Object.assign(options.configSetup.defaults, {
        databaseSchemaSync: "alter",
      })
      if (options.sqlite) {
        const sqliteName = ensureEnd(isString(options.sqlite) ? options.database : "database", ".sqlite")
        const databasePath = path.join(this.appFolder, sqliteName)
        Object.assign(options.configSetup.defaults, {
          databasePath,
        })
      } else {
        Object.assign(options.configSetup.defaults, {
          databaseName: isString(options.database) ? options.database : this.camelName,
          databaseUser: "postgres",
          databaseDialect: "postgres",
          databaseHost: "localhost",
          databasePort: 5432,
          timezone: "Europe/Berlin",
        })
        options.configSetup.secretKeys.push("databasePassword")
      }
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
    /**
     * @type {import("essential-config").Result}
     */
    const configResult = essentialConfig(this.appPath, options.configSetup)
    if (configResult.newKeys |> hasContent) {
      this.logger.info("Added %s to config: %s", plural("new entry", configResult.newKeys.length), configResult.newKeys.join(", "))
    }
    if (configResult.deprecatedKeys |> hasContent) {
      this.logger.warn("Config contains %s: %s", plural("no longer needed entry", configResult.deprecatedKeys.length), configResult.deprecatedKeys.join(", "))
    }
    /**
     * @type {BaseConfig}
     */
    this.config = configResult.config
    if (this.hasDatabase) {
      const Sequelize = __non_webpack_require__("sequelize")
      const sequelizeOptions = {}
      if (options.sqlite) {
        Object.assign(sequelizeOptions, {
          dialect: "sqlite",
          storage: this.config.databasePath,
        })
      } else {
        Object.assign(sequelizeOptions, {
          dialect: this.config.databaseDialect,
          host: this.config.databaseHost,
          port: this.config.databasePort,
          database: this.config.databaseName,
          username: this.config.databaseUser,
          password: this.config.databasePassword,
          timezone: this.config.timezone,
        })
      }
      /**
       * @type {import("sequelize").Sequelize}
       */
      this.database = new Sequelize({
        benchmark: true,
        logging: line => {
          this.logger.log(options.databaseLogLevel, line)
        },
        ...sequelizeOptions,
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
        this.logger.log(options.serverLogLevel, "[%s %s in %s] ◀︎ %s %s", context.status, context.message, readableMs(responseTime), context.method, context.url)
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
              this.logger.log(options.gotLogLevel, `[${response.statusCode} ${response.statusMessage} in ${readableMs(response.timings.phases.total)}] ▶︎ ${response.request.gotOptions.method} ${response.requestUrl}`)
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
    await this.callPlugins("close")
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
   * @param {string} memberName
   * @param {...*} args
   * @return {Promise<Object>}
   */
  async callPlugins(memberName, ...args) {
    const pluginEntries = Object.entries(this.plugins)
    const filteredEntries = pluginEntries.filter(entry => {
      const instance = entry[1]
      return instance[memberName] !== undefined
    })
    if (filteredEntries.length === 0) {
      return {}
    }
    const startTime = Date.now()
    const results = {}
    const jobs = filteredEntries.map(async ([name, instance]) => {
      const member = instance[memberName]
      const result = typeof member === "function" ? member.apply(instance, args) : member
      results[name] = await result
    })
    await Promise.all(jobs)
    this.logger.info("Called %s in %s on: %s", memberName, readableMs(Date.now() - startTime), filteredEntries.map(([name]) => name).join(", "))
    return results
  }

  /**
   * @param {string} memberName
   * @param {...*} args
   * @return {Promise<void>}
   */
  async callAndRemovePlugins(memberName, ...args) {
    const results = await this.callPlugins(memberName, ...args)
    const entriesToRemove = Object.entries(results).filter(entry => {
      const result = entry[1]
      if (result === false) {
        return true
      }
      return false
    })
    if (entriesToRemove.length === 0) {
      return
    }
    for (const [name] of entriesToRemove) {
      delete this.plugins[name]
    }
    this.logger.info("%s wanted to be removed", plural("plugin", entriesToRemove.length))
  }

  /**
   * @param {Object} [plugins={}]
   * @returns {Promise<void>}
   */
  async init(plugins = {}) {
    try {
      /**
       * @type {boolean}
       */
      this.hasPlugins = Object.keys(plugins).length > 0
      /**
       * @type {Object}
       */
      this.plugins = mapObject(plugins, (key, value) => {
        return [key, isClass(value) ? new value(this) : value]
      })
      await this.callAndRemovePlugins("preInit")
      if (this.hasDatabase) {
        if (this.database.options.dialect === "postgres") {
          try {
            const {create} = __non_webpack_require__("pg-create-drop-db")
            await create({
              user: this.database.options.username,
              pass: this.database.options.password,
              host: this.database.options.host,
              port: this.database.options.port,
              name: this.database.options.database,
            })
            this.logger.info("Ensured existence of database %s at %s:%s", this.database.options.database, this.database.options.host, this.database.options.port)
          } catch (error) {
            this.logger.error("Could not create database %s: %s", this.database.options.database, error)
          }
        }
        await this.database.authenticate()
        const modelMaps = await this.callPlugins("collectModels")
        if (modelMaps) {
          const modelDefinitions = {}
          Object.assign(modelDefinitions, ...Object.values(modelMaps))
          for (const [name, modelDefinition] of Object.entries(modelDefinitions |> sortKeys)) {
            this.registerModel(name, modelDefinition)
          }
        }
        const models = Object.values(this.database.models)
        if (models.length === 0) {
          this.logger.warn("No models have been registered, that's weird")
        } else {
          const modelsWithAssociate = models.filter(model => model.associate)
          if (modelsWithAssociate.length > 0) {
            for (const model of modelsWithAssociate) {
              model.associate(this.database.models)
            }
            this.logger.debug("Called associate on %s", plural("model", modelsWithAssociate.length))
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
      await this.callPlugins("init")
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
          this.logger.debug("Called start on %s in %s", plural("model", modelsWithStart.length), readableMs(Date.now() - startTime))
        }
      }
      await this.callAndRemovePlugins("postInit")
      await this.callPlugins("ready")
      this.logger.info("Ready after %s", readableMs(Date.now() - this.startTime.getTime()))
    } catch (error) {
      this.logger.error("Could not initialize: %s", error)
      throw error
    }
  }

}