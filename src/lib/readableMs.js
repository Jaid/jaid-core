import chalk from "chalk"
import readableMs from "readable-ms"

export default ms => chalk.blueBright(readableMs(ms))