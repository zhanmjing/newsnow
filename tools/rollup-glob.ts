import path from "node:path"
import { writeFile } from "node:fs/promises"
import type { Plugin } from "rollup"
import glob from "fast-glob"
import type { FilterPattern } from "@rollup/pluginutils"
import { createFilter, normalizePath } from "@rollup/pluginutils"
import { projectDir } from "../shared/dir"

const ID_PREFIX = "glob:"
const root = path.join(projectDir, "server")
type GlobMap = Record<string /* name:pattern */, string[]>

export function RollopGlob(): Plugin {
  const map: GlobMap = {}
  const include: FilterPattern = []
  const exclude: FilterPattern = []
  const filter = createFilter(include, exclude)
  return {
    name: "rollup-glob",
    resolveId(id, src) {
      if (!id.startsWith(ID_PREFIX)) return
      if (!src || !filter(src)) return

      return `${id}:${encodeURIComponent(src)}`
    },
    async load(id) {
      if (!id.startsWith(ID_PREFIX)) return

      const [_, pattern, encodePath] = id.split(":")
      const currentPath = decodeURIComponent(encodePath)

      const files = (
        await glob(pattern, {
          cwd: currentPath ? path.dirname(currentPath) : root,
          absolute: true,
        })
      )
        .map(file => normalizePath(file))
        .filter(file => file !== normalizePath(currentPath))
        .sort()
      map[pattern] = files

      const imports = files
        .map((file, i) => `import * as _m${i} from '${file}'`)
        .join("\n")
      const entries = files
        .map((file, i) => {
          const r = file.replace("/index", "")
          const name = path.basename(r, path.extname(r))
          return `  ${JSON.stringify(name)}: _m${i},`
        })
        .join("\n")
      const contents = `${imports}\n\nexport default {\n${entries}\n}\n`

      await writeTypeDeclaration(map, path.join(root, "glob"))

      return contents
    },
  }
}

async function writeTypeDeclaration(map: GlobMap, filename: string) {
  function relatePath(filepath: string) {
    return normalizePath(path.relative(path.dirname(filename), filepath))
  }

  let declare = `/* eslint-disable */\n\n`

  const sortedEntries = Object.entries(map).sort(([a], [b]) =>
    a.localeCompare(b),
  )

  for (const [_idx, [id, files]] of sortedEntries.entries()) {
    declare += `declare module '${ID_PREFIX}${id}' {\n`
    declare += `  const _default: {\n`
    for (const file of files) {
      const relative = `./${relatePath(file)}`.replace(/\.tsx?$/, "")
      const r = file.replace("/index", "")
      const fileName = path.basename(r, path.extname(r))
      declare += `    ${JSON.stringify(fileName)}: typeof import('${relative}')\n`
    }
    declare += `  }\n`
    declare += `  export default _default\n`
    declare += `}\n`
  }
  await writeFile(`${filename}.d.ts`, declare, "utf-8")
}
