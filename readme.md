# jaid-core


<a href="https://raw.githubusercontent.com/jaid/jaid-core/master/license.txt"><img src="https://img.shields.io/github/license/jaid/jaid-core?style=flat-square" alt="License"/></a> <a href="https://github.com/sponsors/jaid"><img src="https://img.shields.io/badge/<3-Sponsor-FF45F1?style=flat-square" alt="Sponsor jaid-core"/></a>
<a href="https://actions-badge.atrox.dev/jaid/jaid-core/goto"><img src="https://img.shields.io/endpoint.svg?style=flat-square&url=https%3A%2F%2Factions-badge.atrox.dev%2Fjaid%2Fjaid-core%2Fbadge" alt="Build status"/></a> <a href="https://github.com/jaid/jaid-core/commits"><img src="https://img.shields.io/github/commits-since/jaid/jaid-core/v7.3.2?style=flat-square&logo=github" alt="Commits since v7.3.2"/></a> <a href="https://github.com/jaid/jaid-core/commits"><img src="https://img.shields.io/github/last-commit/jaid/jaid-core?style=flat-square&logo=github" alt="Last commit"/></a> <a href="https://github.com/jaid/jaid-core/issues"><img src="https://img.shields.io/github/issues/jaid/jaid-core?style=flat-square&logo=github" alt="Issues"/></a>  
<a href="https://npmjs.com/package/jaid-core"><img src="https://img.shields.io/npm/v/jaid-core?style=flat-square&logo=npm&label=latest%20version" alt="Latest version on npm"/></a> <a href="https://github.com/jaid/jaid-core/network/dependents"><img src="https://img.shields.io/librariesio/dependents/npm/jaid-core?style=flat-square&logo=npm" alt="Dependents"/></a> <a href="https://npmjs.com/package/jaid-core"><img src="https://img.shields.io/npm/dm/jaid-core?style=flat-square&logo=npm" alt="Downloads"/></a>

**Simple, opinionated framework that combines koa, got, sequelize, essential-config and jaid-logger.**









## Usage

These optional plugin properties may be called by `jaid-core`:

Name|Parameters|Return value
---|---|---
`constructor`|`JaidCore core`
`setCoreReference`|`JaidCore core`
`getConfigSetup`||`Object additionalConfigSetup`
`preInit`||`boolean shouldRemovePlugin`
`handleConfig`|`Object config`|`boolean shouldRemovePlugin`
`handleKoa`|`Koa koa`
`handleGot`|`Got got`
`collectModels`||`Object<string, {default: Model, schema: Object}>`
`init`||`boolean shouldRemovePlugin`
`postInit`||`boolean shouldRemovePlugin`
`ready`|
`handleLog`|`string level`, `string[] fragments`|

Plugin example:

```js
import {JaidCorePlugin} from "jaid-core"

export default class Plugin extends JaidCorePlugin {

  constructor(options = {}) {
    super()
    this.options = {
      ...options
    }
  }

  ready() {
    this.log("Hello!")
  }

}
```

Sequelize model example:

```js
import Sequelize from "sequelize"

class PluginModel extends Sequelize.Model {

  /**
   * @return {string}
   */
  getTitle() {
    return this.title
  }

}

/**
 * @type {import("sequelize").ModelAttributes}
 */
export const schema = {
  title: {
    type: Sequelize.STRING,
    allowNull: false
  }
}

export default PluginModel
```

Advanced Sequelize model (dynamically generated):

```js
import Sequelize from "sequelize"

/**
 * @param {typeof import("sequelize").Model} Model
 * @param {import("jaid-core").ModelDefinitionContext} context
 * @return {{default, schema}}
 */
export default (Model, {models}) => {

    class AdvancedModel extends Model {

      /**
       * @param {Object<string, import("sequelize").Model>} models
       */
      static associate() {
        AdvancedModel.belongsTo(models.AnotherModel, {
          foreignKey: {
            allowNull: false,
          },
        })
      }

      /**
       * @return {string}
       */
      getTitle() {
        return this.title
      }

  }

  /**
   * @type {import("sequelize").ModelAttributes}
   */
  const schema = {
    title: {
      type: Sequelize.STRING,
      allowNull: false
    }
  }

  return {
    default: AdvancedModel,
    schema,
  }

}
```





## Installation
<a href="https://npmjs.com/package/jaid-core"><img src="https://img.shields.io/badge/npm-jaid--core-C23039?style=flat-square&logo=npm" alt="jaid-core on npm"/></a>
```bash
npm install --save jaid-core@^7.3.2
```
<a href="https://yarnpkg.com/package/jaid-core"><img src="https://img.shields.io/badge/Yarn-jaid--core-2F8CB7?style=flat-square&logo=yarn&logoColor=white" alt="jaid-core on Yarn"/></a>
```bash
yarn add jaid-core@^7.3.2
```







## Development



Setting up:
```bash
git clone git@github.com:jaid/jaid-core.git
cd jaid-core
npm install
```
Testing:
```bash
npm run test:dev
```
Testing in production environment:
```bash
npm run test
```


## License
```text
MIT License

Copyright © 2020, Jaid <jaid.jsx@gmail.com> (github.com/jaid)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
