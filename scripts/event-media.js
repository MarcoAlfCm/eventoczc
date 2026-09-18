#!/usr/bin/env node

require('dotenv').config()

const eventMediaService = require('../src/services/event-media.service')
const { pool } = require('../src/config/database')

function parseArgs(argv) {
  const result = { _: [] }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]

    if (!value.startsWith('--')) {
      result._.push(value)
      continue
    }

    const key = value.slice(2)
    const next = argv[index + 1]

    if (!next || next.startsWith('--')) {
      result[key] = true
      continue
    }

    result[key] = next
    index += 1
  }

  return result
}

function usage() {
  console.log(`
MiEventoCzC · Multimedia de evento

Agregar/reemplazar hero:
  node scripts/event-media.js add --event SLUG --type hero --file /ruta/foto.jpg

Agregar a galería:
  node scripts/event-media.js add --event SLUG --type gallery --file /ruta/foto.jpg

Agregar/reemplazar música:
  node scripts/event-media.js add --event SLUG --type music --file /ruta/cancion.mp3 --title "Título" --artist "Artista"

Listar multimedia activa:
  node scripts/event-media.js list --event SLUG

Eliminar un medio:
  node scripts/event-media.js remove --id ID
`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const command = args._[0]

  if (!command || args.help) {
    usage()
    return
  }

  if (command === 'add') {
    if (!args.event || !args.type || !args.file) {
      usage()
      throw new Error('Faltan --event, --type o --file.')
    }

    const result = await eventMediaService.importMedia({
      slug: args.event,
      type: args.type,
      filePath: args.file,
      title: args.title,
      artist: args.artist
    })

    console.log(JSON.stringify(result, null, 2))
    return
  }

  if (command === 'list') {
    if (!args.event) {
      usage()
      throw new Error('Falta --event.')
    }

    const result = await eventMediaService.listForEvent(args.event)
    console.log(JSON.stringify(result, null, 2))
    return
  }

  if (command === 'remove') {
    const id = Number(args.id)
    if (!Number.isInteger(id) || id <= 0) {
      usage()
      throw new Error('Debes indicar un --id válido.')
    }

    const result = await eventMediaService.removeById(id)
    console.log(JSON.stringify(result, null, 2))
    return
  }

  usage()
  throw new Error(`Comando desconocido: ${command}`)
}

main()
  .catch((error) => {
    console.error(`ERROR: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
