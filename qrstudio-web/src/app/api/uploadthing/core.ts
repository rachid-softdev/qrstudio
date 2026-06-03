import { createUploadthing, type FileRouter } from "uploadthing/next"
import { auth } from "@/server/auth"

const f = createUploadthing()

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
      return { uploadedBy: metadata.userId, url: file.url }
    }),

  pdfUploader: f({
    "application/pdf": { maxFileSize: "8MB", maxFileCount: 1 },
    blob: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await auth()
      if (!session?.user) throw new Error("Non authentifié")
      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.url }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof uploadRouter
export type UploadRouter = typeof uploadRouter
