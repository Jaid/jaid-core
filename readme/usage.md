Called properties of plugins:

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