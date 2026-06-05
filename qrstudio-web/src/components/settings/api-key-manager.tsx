"use client"

import { useState } from "react"
import { toast } from "sonner"
import { KeyIcon, Trash2Icon, PlusIcon, Loader2Icon } from "lucide-react"
import { api } from "@/lib/trpc/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { EmptyState } from "@/components/shared/empty-state"
import { formatDate } from "@/lib/utils"
import { ApiKeyModal } from "./api-key-modal"

export function ApiKeyManager() {
  const [keyName, setKeyName] = useState("")
  const [newKey, setNewKey] = useState<string | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)

  const utils = api.useUtils()
  const { data: keys, isLoading, isError } = api.apiKey.list.useQuery()

  const generateMutation = api.apiKey.generate.useMutation({
    onSuccess: (data) => {
      setNewKey(data.key)
      setKeyName("")
      utils.apiKey.list.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  const revokeMutation = api.apiKey.revoke.useMutation({
    onSuccess: () => {
      toast.success("Clé API révoquée")
      utils.apiKey.list.invalidate()
    },
    onError: (err) => toast.error(err.message),
  })

  function handleGenerate() {
    if (!keyName.trim()) {
      toast.error("Veuillez donner un nom à la clé")
      return
    }
    generateMutation.mutate({ name: keyName.trim() })
  }

  function handleCopy(key: string) {
    navigator.clipboard.writeText(key)
    toast.success("Clé copiée dans le presse-papier")
  }

  function handleCloseDialog() {
    setShowGenerate(false)
    setNewKey(null)
    setKeyName("")
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-destructive">
            Erreur lors du chargement des clés API
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Les clés API permettent d&apos;intégrer QR Studio à vos outils.
          </p>
          <Button
            size="sm"
            onClick={() => setShowGenerate(true)}
          >
            <PlusIcon className="size-4" />
            Nouvelle clé
          </Button>
          <ApiKeyModal
            open={showGenerate}
            onOpenChange={setShowGenerate}
            newKey={newKey}
            keyName={keyName}
            onKeyNameChange={setKeyName}
            onGenerate={handleGenerate}
            onCopy={handleCopy}
            onClose={handleCloseDialog}
            isPending={generateMutation.isPending}
          />
        </div>

        {keys && keys.length > 0 ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Préfixe</TableHead>
                  <TableHead>Créée le</TableHead>
                  <TableHead>Dernier usage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">
                      {key.name}
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        {key.keyPrefix}...
                      </code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(new Date(key.createdAt))}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {key.lastUsedAt
                        ? formatDate(new Date(key.lastUsedAt))
                        : "Jamais"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        aria-label="Révoquer cette clé API"
                        onClick={() =>
                          revokeMutation.mutate({ id: key.id })
                        }
                        disabled={revokeMutation.isPending}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState
            icon={KeyIcon}
            title="Aucune clé API"
            description="Générez votre première clé pour accéder à l'API"
          />
        )}
      </CardContent>
    </Card>
  )
}
