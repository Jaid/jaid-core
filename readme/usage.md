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