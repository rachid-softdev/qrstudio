import { prisma } from "@/server/db"

export async function hasEventBeenProcessed(eventId: string): Promise<boolean> {
  const existing = await prisma.webhookEvent.findUnique({
    where: { id: eventId },
  })
  return existing !== null
}

export async function markEventProcessed(eventId: string, type: string): Promise<void> {
  await prisma.webhookEvent.create({
    data: { id: eventId, type },
  })
}
