/**
 * Загрузка документов базы знаний в портал (этап 1 задания по ассистенту).
 *
 *   pnpm seed:content <каталог с docx> [manifest.json]
 *
 * manifest.json — массив записей:
 *   { "file": "Регламент адаптации.docx", "title": "Регламент адаптации", "category": "policies",
 *     "version": "1.2", "access": "public", "ragStatus": "actual" }
 * Без манифеста берутся все *.docx каталога: название — имя файла, версия 1.0,
 * access = public, ragStatus = draft (в индекс ассистента документ попадёт только
 * после явной публикации в /admin/assistant).
 *
 * Версии и статусы 14 документов СНАРК нужно перенести в манифест из реестра
 * `Реестр_источников_RAG_*.xlsm` (у двух документов версия 1.2).
 *
 * Файлы кладутся в S3/MinIO (если заданы S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY),
 * иначе — в локальный каталог RAG_LOCAL_STORAGE_DIR (dev без MinIO; тот же каталог
 * указывается сервису ассистента при RAG_STORAGE=local).
 * Повторный запуск обновляет документ с тем же названием, а не создаёт дубль.
 */
import { config } from "dotenv"
config({ path: ".env.local" })
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, extname, join, resolve } from "node:path"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { z } from "zod"
import { documents } from "@/lib/db/schema"

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

const entrySchema = z.object({
  file: z.string().min(1),
  title: z.string().min(1).optional(),
  category: z.string().min(1).default("policies"),
  version: z.string().min(1).default("1.0"),
  access: z.enum(["public", "department"]).default("public"),
  departmentId: z.string().uuid().optional(),
  ragStatus: z.enum(["draft", "actual", "archived", "excluded"]).default("draft"),
})

type Entry = z.infer<typeof entrySchema>

function loadEntries(dir: string, manifestPath?: string): Entry[] {
  if (manifestPath) {
    return z.array(entrySchema).parse(JSON.parse(readFileSync(manifestPath, "utf8")))
  }
  return readdirSync(dir)
    .filter((name) => extname(name).toLowerCase() === ".docx" && !name.startsWith("~$"))
    .sort()
    .map((file) => entrySchema.parse({ file }))
}

function s3Configured(): boolean {
  const key = process.env.S3_ACCESS_KEY_ID
  return Boolean(key && key !== "mock" && key !== "replace-with-s3-access-key")
}

async function storeFile(key: string, data: Buffer): Promise<string> {
  if (s3Configured()) {
    const client = new S3Client({
      endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
      region: process.env.S3_REGION ?? "ru-central-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
      },
    })
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET ?? "snark-portal",
        Key: key,
        Body: data,
        ContentType: DOCX_TYPE,
      })
    )
    return "s3"
  }
  const root = process.env.RAG_LOCAL_STORAGE_DIR
  if (!root) {
    throw new Error("Не настроено хранилище: задайте S3_* или RAG_LOCAL_STORAGE_DIR в .env.local")
  }
  const target = join(resolve(root), key)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, data)
  return "local"
}

async function main() {
  const [dirArg, manifestArg] = process.argv.slice(2)
  if (!dirArg) {
    throw new Error("Использование: pnpm seed:content <каталог с docx> [manifest.json]")
  }
  const dir = resolve(dirArg)
  const entries = loadEntries(dir, manifestArg ? resolve(manifestArg) : undefined)
  if (entries.length === 0) throw new Error(`В каталоге ${dir} нет файлов .docx`)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const db = drizzle(pool)
  let created = 0
  let updated = 0

  try {
    for (const entry of entries) {
      const path = join(dir, entry.file)
      const data = readFileSync(path)
      const title = entry.title ?? basename(entry.file, extname(entry.file))
      const values = {
        title,
        category: entry.category,
        version: entry.version,
        fileName: basename(entry.file),
        contentType: DOCX_TYPE,
        sizeBytes: statSync(path).size,
        access: entry.access,
        departmentId: entry.departmentId ?? null,
        ragStatus: entry.ragStatus,
        updatedAt: new Date(),
      }

      const [existing] = await db
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.title, title))
      const id = existing
        ? existing.id
        : (await db.insert(documents).values(values).returning({ id: documents.id }))[0].id

      const key = `documents/knowledge/${id}/${entry.version}.docx`
      const storage = await storeFile(key, data)
      await db
        .update(documents)
        .set({ ...values, filePath: key })
        .where(eq(documents.id, id))

      if (existing) updated += 1
      else created += 1
      process.stdout.write(`${existing ? "обновлён" : "создан"}: ${title} v${entry.version} [${entry.ragStatus}] → ${storage}\n`)
    }
  } finally {
    await pool.end()
  }

  process.stdout.write(`Итого: создано ${created}, обновлено ${updated}\n`)
  process.stdout.write(
    "Документы со статусом actual будут проиндексированы при следующей сверке ассистента " +
      "или кнопкой «Переиндексировать» в /admin/assistant.\n"
  )
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
