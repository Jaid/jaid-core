/** @module jaid-core */

import camelCase from "camelcase"
import chalk from "chalk"
import ensureArray from "ensure-array"
import ensureEnd from "ensure-end"
import essentialConfig from "essential-config"
import hasContent, {isEmpty} from "has-content"
import isClass from "is-class"
import jaidLogger from "jaid-logger"
import {isFunction, isString, uniq} from "lodash"
import path from "path"
import pify from "pify"
import preventStart from "prevent-start"
import sortKeys from "sort-keys"
import zahl from "zahl"

import readableMs from "lib/readableMs"

import JaidCorePlugin from "./JaidCorePlugin"

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
 * @prop {string[]|string|false} [databaseExtensions=false]
 * @prop {boolean|Object} [koaSession]
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
 * @prop {string[]|string} koaKeys
 * @prop {string[]|string} disabledPlugins
 */

/**
 * @typedef {Object} SequelizeDefinition
 * @prop {import("sequelize").ModelAttributes} schema
 * @prop {import("sequelize").IndexesOptions[]} indexes
 * @prop {typeof import("sequelize").Model} default
 */

export {JaidCorePlugin}

/**
 * @class
 */
export default class JaidCore {

  /**
   * @constructor
   * @param {Options} options
   */
  constructor(options) {
    /**
     * @type {Date}
     */
    this.startTime = new Date
    /**
     * @type {Set}
     */
    this.unusedPluginEvents = new Set
    /**
     * @type {string}
     */
    this.defaultLogLevel = process.env.JAID_CORE_LOG_LEVEL || "debug"
    this.options = {
      http2: false,
      serverLogLevel: this.defaultLogLevel,
      databaseLogLevel: this.defaultLogLevel,
      gotLogLevel: this.defaultLogLevel,
      configSetup: {},
      useGot: false,
      sqlite: false,
      databaseExtenions: false,
      koaSession: false,
      koaKeys: false,
      ...options,
    }
    /**
     * @type {boolean}
     */
    this.hasDatabase = Boolean(this.options.database || this.options.sqlite)
    /**
     * @type {boolean}
     */
    this.hasInsecureServer = Boolean(this.options.insecurePort)
    /**
     * @type {boolean}
     */
    this.hasSecureServer = Boolean(this.options.securePort)
    /**
     * @type {boolean}
     */
    this.hasServer = this.hasInsecureServer || this.hasSecureServer
    /**
     * @type {string}
     */
    this.camelName = camelCase(this.options.name)
    /**
     * @type {string[]}
     */
    this.appPath = [...ensureArray(this.options.folder), this.options.name]
    /**
     * @type {import("jaid-logger").JaidLogger}
     */
    this.logger = jaidLogger(this.appPath)
    const tempLog = this.logger.log
    this.logger.log = async (...args) => {
      tempLog.apply(this.logger, args)
      if (this.hasPlugins) {
        const [level, ...fragments] = args
        await this.callPlugins("handleLog", level, fragments)
      }
    }
    /**
     * @type {string}
     */
    this.appFolder = this.logger.appFolder
    /**
     * @type {string}
     */
    this.logFolder = this.logger.logFolder
    /**
     * @type {string[]}
     */
    this.databaseExtensions = uniq(ensureArray(this.options.databaseExtensions))
    /**
     * @type {BaseConfig}
     */
    this.config = {}
    /**
     * @type {boolean}
     */
    this.hasPlugins = null
    /**
     * @type {Object}
     */
    this.plugins = {}
    /**
     * @type {import("sequelize").Sequelize}
     */
    this.database = null
    /**
     * @type {import("koa")}
     */
    this.koa = null
    /**
     * @type {import("got").GotInstance}
     */
    this.got = null
    /**
     * @type {require("http2").Http2Server}
     */
    this.insecureServer = null
    /**
     * @type {require("http2").Http2SecureServer}
     */
    this.secureServer = null
    /**
     * @type {import("essential-config").Options}
     */
    this.configSetup = null
  }

  getConfigSetup() {
    /**
     * @type {import("essential-config").Options}
     */
    const configSetup = {
      fields: {},
      defaults: {
        disabledPlugins: [],
      },
      secretKeys: [],
    }
    if (this.hasDatabase) {
      Object.assign(configSetup.defaults, {
        databaseSchemaSync: "sync",
      })
      if (this.options.sqlite) {
        const sqliteName = ensureEnd(isString(this.options.database) ? this.options.database : "database", ".sqlite")
        let databasePath
        if (path.isAbsolute(sqliteName)) {
          databasePath = sqliteName
        } else {
          databasePath = path.join(this.appFolder, sqliteName)
        }
        Object.assign(configSetup.defaults, {
          databasePath,
        })
      } else {
        Object.assign(configSetup.defaults, {
          databaseName: isString(this.options.database) ? this.options.database : this.camelName,
          databaseUser: "postgres",
          databaseDialect: "postgres",
          databaseHost: "localhost",
          databasePort: 5432,
          timezone: "Europe/Berlin",
        })
        configSetup.secretKeys.push("databasePassword")
      }
    }
    if (this.hasInsecureServer) {
      Object.assign(configSetup.defaults, {
        insecurePort: this.options.insecurePort,
      })
    }
    if (this.hasSecureServer) {
      Object.assign(configSetup.defaults, {
        securePort: this.options.securePort,
      })
    }
    if (this.hasServer && this.options.koaSession) {
      configSetup.secretKeys.push("koaKeys")
    }
    return configSetup
  }

  applyConfigSetup(additionalConfigSetup) {
    if (hasContent(additionalConfigSetup?.fields)) {
      Object.assign(this.configSetup.fields, additionalConfigSetup.fields)
    }
    if (hasContent(additionalConfigSetup?.defaults)) {
      Object.assign(this.configSetup.defaults, additionalConfigSetup.defaults)
    }
    if (hasContent(additionalConfigSetup?.secretKeys)) {
      Array.prototype.push.apply(this.configSetup.secretKeys, additionalConfigSetup.secretKeys)
    }
  }

  /**
   * @param {string} modelName
   * @param {SequelizeDefinition} definition
   */
  registerModel(modelName, definition) {
    const schema = sortKeys(definition.schema)
    definition.default.init(schema, {
      modelName,
      sequelize: this.database,
      indexes: definition.indexes,
    })
  }

  /**
   * @param {string} modelName
   * @param {(superClass, classGenerationContext) => SequelizeDefinition} generateDefinition
   */
  registerModelDynamic(modelName, generateDefinition, Sequelize) {
    const superClass = Sequelize.Model
    const classGenerationContext = {
      core: this,
    }
    const definition = generateDefinition.default(superClass, classGenerationContext)
    const schema = sortKeys(definition.schema)
    definition.default.init(schema, {
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
    if (this.unusedPluginEvents.has(memberName)) {
      return {}
    }
    const pluginEntries = Object.entries(this.plugins)
    const filteredEntries = pluginEntries.filter(entry => {
      const instance = entry[1]
      return instance[memberName] !== undefined
    })
    if (filteredEntries.length === 0) {
      this.unusedPluginEvents.add(memberName)
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
    const pluginsString = filteredEntries.map(([pluginId, plugin]) => this.formatPluginName(pluginId, plugin)).join(", ")
    this.logger.info("Called %s in %s on: %s", memberName, readableMs(Date.now() - startTime), pluginsString)
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
    const pluginsString = entriesToRemove.map(([pluginId, plugin]) => this.formatPluginName(pluginId, plugin)).join(", ")
    this.logger.info("%s wanted to be removed: %s", zahl(entriesToRemove, "plugin"), pluginsString)
  }

  /**
   * @param {Function} job
   */
  doForManagedPluginsSync(job) {
    for (const [pluginId, plugin] of Object.entries(this.plugins)) {
      if (plugin.isManagedByJaidCore !== true) {
        continue
      }
      job(plugin, pluginId)
    }
  }

  /**
   * @param {Function} job
   * @return {Promise<void>}
   */
  async doForManagedPlugins(job) {
    for (const [pluginId, plugin] of Object.entries(this.plugins)) {
      if (plugin.isManagedByJaidCore !== true) {
        continue
      }
      await job(plugin, pluginId)
    }
  }

  async gatherConfigSetups() {
    const configSetups = await this.callPlugins("getConfigSetup")
    if (configSetups) {
      for (const additionalConfigSetup of Object.values(configSetups)) {
        this.applyConfigSetup(additionalConfigSetup)
      }
    }
  }

  /**
   * @param {string} pluginId
   * @return {string}
   */
  formatPluginName(pluginId) {
    return chalk.magenta(pluginId)
  }

  /**
   * @param {string} pluginId
   * @param {Object} plugin
   * @return {string}
   */
  formatPluginNameDetailed(pluginId, plugin) {
    let text = this.formatPluginName(pluginId)
    text += " "
    if (plugin.isManagedByJaidCore === true) {
      text += chalk.gray("(auto-managed)")
    } else {
      text += chalk.gray("(self-managed)")
    }
    return text
  }

  /**
   * @param {Object} [plugins={}]
   * @returns {Promise<void>}
   */
  async init(plugins = {}) {
    try {
      this.configSetup = this.getConfigSetup()
      this.applyConfigSetup(this.options.configSetup)
      const pluginEntries = Object.entries(plugins)
      this.hasPlugins = pluginEntries.length > 0
      for (const [pluginId, value] of pluginEntries) {
        let plugin
        if (isClass(value)) {
          plugin = new value(this)
        } else {
          plugin = value
        }
        this.plugins[pluginId] = plugin
      }
      if (hasContent(this.plugins)) {
        this.logger.info(`${zahl(this.plugins, "plugin")}: ${Object.entries(this.plugins).map(([pluginId, plugin]) => this.formatPluginNameDetailed(pluginId, plugin)).join(", ")}`)
      }
      await this.callPlugins("setCoreReference", this)
      this.doForManagedPluginsSync(plugin => {
        plugin.core = this
        plugin.logger = this.logger
      })
      await this.gatherConfigSetups()
      await this.callAndRemovePlugins("preInit")
      /**
       * @type {import("essential-config").Result}
       */
      const configResult = essentialConfig(this.appPath, this.configSetup)
      if (configResult.newKeys |> hasContent) {
        this.logger.info("Added %s to config: %s", zahl(configResult.newKeys, "new entry"), configResult.newKeys.join(", "))
      }
      if (configResult.deprecatedKeys |> hasContent) {
        this.logger.warn("Config contains %s: %s", zahl(configResult.deprecatedKeys, "no longer needed entry"), configResult.deprecatedKeys.join(", "))
      }
      Object.assign(this.config, configResult.config)
      if (hasContent(this.config.disabledPlugins)) {
        const successfullyDisabledPlugins = []
        for (const disabledPlugin of ensureArray(this.config.disabledPlugins)) {
          if (this.plugins[disabledPlugin]) {
            delete this.plugins[disabledPlugin]
            successfullyDisabledPlugins.push(disabledPlugin)
          } else {
            this.logger.warn(`${disabledPlugin} is listed in config.disabledPlugins, but was not intended to be loaded at all`)
          }
        }
        if (hasContent(successfullyDisabledPlugins)) {
          this.logger.info(`${zahl(successfullyDisabledPlugins, "plugin")} will be skipped because of config.disabledPlugins: ${successfullyDisabledPlugins.join(", ")}`)
        }
      }
      await this.callAndRemovePlugins("handleConfig", this.config)
      let Sequelize
      if (this.hasDatabase) {
        Sequelize = __non_webpack_require__("sequelize")
        const sequelizeOptions = {}
        if (this.options.sqlite) {
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
        this.database = new Sequelize({
          benchmark: true,
          logging: line => {
            this.logger.log(this.options.databaseLogLevel, line)
          },
          ...sequelizeOptions,
          ...this.options.sequelizeOptions,
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
          this.logger.log(this.options.serverLogLevel, "[%s %s in %s] ◀︎ %s %s", context.status, context.message, readableMs(responseTime), context.method, context.url)
        })
        this.koa.use(async (context, next) => {
          const startTime = Date.now()
          await next()
          context.set("X-Response-Time", Date.now() - startTime)
        })
        if (this.koaSession) {
          if (isEmpty(this.config.koaKeys)) {
            throw new Error("config.koaKeys is not set")
          }
          this.koa.keys = ensureArray(this.config.koaKeys)
          const sessionConfig = {
            ...this.options.koaSession || {},
            signed: true,
          }
          const koaSession = __non_webpack_require__("koa-session")
          this.koa.use(koaSession(sessionConfig, this.koa))
        }
        await this.callPlugins("handleKoa", this.koa)
      }
      if (this.options.useGot) {
        /**
         * @type {import("got")}
         */
        const got = __non_webpack_require__("got")
        this.got = got.extend({
          headers: {
            "User-Agent": `${this.camelName}/${this.options.version}`,
          },
          hooks: {
            afterResponse: [
              response => {
                let displayedUrl = preventStart(response.requestUrl, "https://")
                if (displayedUrl.length > 160) {
                  displayedUrl = `${displayedUrl.slice(0, 159)}…`
                }
                this.logger.log(this.options.gotLogLevel, `[${response.statusCode} ${response.statusMessage} in ${readableMs(response.timings.phases.total)}] ▶︎ ${response.request.options.method} ${chalk.yellow(response.requestUrl)}`)
                return response
              },
            ],
          },
        })
        await this.callPlugins("handleGot", this.got)
      }
      if (this.hasInsecureServer) {
        const {createServer} = __non_webpack_require__(this.options.http2 ? "http2" : "http")
        this.insecureServer = createServer(this.koa.callback())
      }
      if (this.hasSecureServer) {
        const {createSecureServer} = __non_webpack_require__(this.options.http2 ? "http2" : "https")
        this.secureServer = createSecureServer(this.koa.callback())
      }
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
          if (this.databaseExtensions |> hasContent) {
            const query = this.databaseExtensions.map(extension => `CREATE EXTENSION IF NOT EXISTS ${extension};`).join(" ")
            await this.database.query(query)
            this.logger.info("Ensured existence of %s", zahl(this.databaseExtensions, "database extension"))
          }
        }
        await this.database.authenticate()
        const modelMaps = await this.callPlugins("collectModels")
        const staticModelNames = []
        const dynamicModelNames = []
        if (modelMaps) {
          const modelDefinitions = {}
          Object.assign(modelDefinitions, ...Object.values(modelMaps))
          for (const [name, modelDefinition] of Object.entries(modelDefinitions |> sortKeys)) {
            if (modelDefinition.schema) {
              this.registerModel(name, modelDefinition)
              staticModelNames.push(name)
            } else if (isFunction(modelDefinition)) {
              this.registerModelDynamic(name, modelDefinition, Sequelize)
              dynamicModelNames.push(name)
            } else if (isFunction(modelDefinition.default)) {
              this.registerModelDynamic(name, modelDefinition.default, Sequelize)
              dynamicModelNames.push(name)
            } else {
              throw new Error(`Not sure what to do with given Sequelize model definition ${name}`)
            }
          }
        }
        const models = Object.values(this.database.models)
        if (models.length === 0) {
          this.logger.warn("No models have been registered, that's weird")
        } else {
          if (staticModelNames) {
            this.logger.info(`${zahl(staticModelNames, "static model definition")} loaded: ${staticModelNames.join(", ")}`)
          }
          if (dynamicModelNames) {
            this.logger.info(`${zahl(dynamicModelNames, "dynamic model definition")} generated: ${dynamicModelNames.join(", ")}`)
          }
          const modelsWithAssociate = models.filter(model => model.associate)
          if (modelsWithAssociate.length > 0) {
            for (const model of modelsWithAssociate) {
              model.associate(this.database.models)
            }
            this.logger.debug("Called associate on %s", zahl(modelsWithAssociate, "model"))
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
      await this.callAndRemovePlugins("init")
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
          this.logger.debug("Called start on %s in %s", zahl(modelsWithStart, "model"), readableMs(Date.now() - startTime))
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