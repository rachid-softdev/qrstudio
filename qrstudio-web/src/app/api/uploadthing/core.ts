import { createUploadthing, type FileRouter } from "uploadthing/next"
import { auth } from "@/server/auth"

const f = createUploadthing()

/**
 * Check if a buffer starts with SVG magic bytes.
 * SVG files typically start with "<svg", "<?xml", or "<!DOCTYPE svg".
 */
function isSvgContent(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 512).toString("utf-8").trimStart()
  return head.startsWith("<svg") || head.startsWith("<?xml") || head.includes("<svg ")
}

export const uploadRouter = {
  logoImageUploader: f({
    image: { maxFileSize: "512KB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await auth()
      if (!session?.user) throw new Error("Non authentifié")
      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // UploadThing's server-side MIME detection is generally reliable, but as
      // defense-in-depth, fetch the file and inspect its magic bytes to catch
      // any files that bypass MIME detection (e.g. polyglot Bypass).
      try {
        const response = await fetch(file.url, { signal: AbortSignal.timeout(5000) })
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer())
          if (isSvgContent(buffer)) {
            throw new Error("Les fichiers SVG ne sont pas autorisés comme logo")
          }
        }
      } catch (err) {
        // Re-throw SVG rejection errors; swallow network failures so that
        // UploadThing's server-side MIME validation is the final authority.
        if (err instanceof Error && err.message === "Les fichiers SVG ne sont pas autorisés comme logo") {
          throw err
        }
        // Network failure when validating — fall through.
      }

      return { uploadedBy: metadata.userId, url: file.url }
    }),

  pdfUploader: f({
    pdf: { maxFileSize: "4MB" },
  })
    .middleware(async () => {
      const session = await auth()
      if (!session?.user) throw new Error("Non authentifié")
      if (session.user.plan === "FREE") throw new Error("Plan FREE ne permet pas l'upload de PDF")
      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Server-side content sniffing for PDF type enforcement
      try {
        const response = await fetch(file.url, { signal: AbortSignal.timeout(5000) })
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer())
          // PDF magic bytes: %PDF at offset 0
          const head = buffer.subarray(0, 4).toString("utf-8")
          if (head !== "%PDF") {
            throw new Error("Le fichier n'est pas un PDF valide")
          }
        }
      } catch (err) {
        // Re-throw PDF validation errors; swallow network failures.
        if (err instanceof Error && err.message === "Le fichier n'est pas un PDF valide") {
          throw err
        }
        // Network failure — fall through to the file.type check.
      }

      if (file.type !== "application/pdf") {
        throw new Error("Seuls les fichiers PDF sont acceptés")
      }
      return { uploadedBy: metadata.userId, url: file.url }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof uploadRouter
export type UploadRouter = typeof uploadRouter
