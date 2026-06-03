"use client"

import { KeyIcon, CopyIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface ApiKeyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  newKey: string | null
  keyName: string
  onKeyNameChange: (name: string) => void
  onGenerate: () => void
  onCopy: (key: string) => void
  onClose: () => void
  isPending: boolean
}

export function ApiKeyModal({
  open,
  onOpenChange,
  newKey,
  keyName,
  onKeyNameChange,
  onGenerate,
  onCopy,
  onClose,
  isPending,
}: ApiKeyModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {newKey ? "Clé générée" : "Générer une clé API"}
          </DialogTitle>
          <DialogDescription>
            {newKey
              ? "Copiez votre clé maintenant — elle ne sera plus jamais affichée."
              : "Donnez un nom à votre clé pour la retrouver facilement."}
          </DialogDescription>
        </DialogHeader>

        {newKey ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border bg-muted p-3">
              <code className="flex-1 break-all text-sm font-mono">
                {newKey}
              </code>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Copier la clé"
                onClick={() => onCopy(newKey)}
              >
                <CopyIcon className="size-4" />
              </Button>
            </div>
            <Button
              className="w-full"
              variant="outline"
              onClick={onClose}
            >
              Fermer
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="keyName"
                className="text-sm font-medium"
              >
                Nom de la clé
              </label>
              <Input
                id="keyName"
                placeholder="Ex: CI/CD, Développement..."
                value={keyName}
                onChange={(e) => onKeyNameChange(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={onGenerate}
                disabled={isPending || !keyName.trim()}
              >
                {isPending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <KeyIcon className="size-4" />
                )}
                Générer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
