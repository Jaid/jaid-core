# jaid-core


Simple, opinionated framework that combines koa, got, sequelize, essential-config and jaid-logger.

<a href="https://raw.githubusercontent.com/Jaid/jaid-core/master/license.txt"><img src="https://img.shields.io/github/license/Jaid/jaid-core?style=flat-square&color=success" alt="License"/></a>  
<a href="https://github.com/Jaid/jaid-core/commits"><img src="https://img.shields.io/github/commits-since/Jaid/jaid-core/v7.0.0?style=flat-square&logo=github&color=success" alt="Commits since v7.0.0"/></a> <a href="https://github.com/Jaid/jaid-core/commits"><img src="https://img.shields.io/github/last-commit/Jaid/jaid-core?style=flat-square&logo=github&color=red" alt="Last commit"/></a> <a href="https://github.com/Jaid/jaid-core/issues"><img src="https://img.shields.io/github/issues/Jaid/jaid-core?style=flat-square&logo=github&color=red" alt="Issues"/></a>  
<a href="https://npmjs.com/package/jaid-core"><img src="https://img.shields.io/npm/v/jaid-core?style=flat-square&logo=npm&label=latest%20version&color=success" alt="Latest version on npm"/></a> <a href="https://github.com/Jaid/jaid-core/network/dependents"><img src="https://img.shields.io/librariesio/dependents/npm/jaid-core?style=flat-square&logo=npm&color=red" alt="Dependents"/></a> <a href="https://npmjs.com/package/jaid-core"><img src="https://img.shields.io/npm/dm/jaid-core?style=flat-square&logo=npm&color=red" alt="Downloads"/></a>





## Usage

These optional plugin properties may be called by `jaid-core`:

Name|Parameters|Return value
---|---|---
`setCoreReference`|`JaidCore core`|
`getConfigSetup`||`Object additionalConfigSetup`
`preInit`||`boolean shouldRemovePlugin`
`handleConfig`|`Object config`|`boolean shouldRemovePlugin`
`handleKoa`|`Koa koa`
`handleGot`|`Got got`
`collectModels`||`Object sequelizeModels`
`init`||`boolean shouldRemovePlugin`
`postInit`||`boolean shouldRemovePlugin`
`ready`|
`handleLog`|`string level`, `string[] fragments`|

Plugin example:

```js
export default class JaidCorePlugin {

  constructor(options = {}) {
    this.options = {
      ...options
    }
  }

  ready() {
    console.log("Hello!")
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



## Installation
<a href="https://npmjs.com/package/jaid-core"><img src="https://img.shields.io/badge/npm-jaid--core-C23039?style=flat-square&logo=npm" alt="jaid-core on npm"/></a>
```bash
npm install --save jaid-core@^7.0.0
```
<a href="https://yarnpkg.com/package/jaid-core"><img src="https://img.shields.io/badge/Yarn-jaid--core-2F8CB7?style=flat-square&logo=yarn&logoColor=white" alt="jaid-core on Yarn"/></a>
```bash
yarn add jaid-core@^7.0.0
```









## License
```text
MIT License

Copyright © 2019, Jaid <jaid.jsx@gmail.com> (github.com/jaid)

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
