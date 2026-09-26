import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export interface Workspace {
  id: string
  name: string
  role: "owner" | "member"
}

interface WorkspaceMembershipRow {
  role: "owner" | "member"
  workspaces: { id: string; name: string } | { id: string; name: string }[] | null
}

async function fetchWorkspaces(): Promise<Workspace[]> {
  const res = await fetch("/api/workspaces")
  if (!res.ok) throw new Error("Failed to load workspaces")
  const { data } = (await res.json()) as { data: WorkspaceMembershipRow[] }
  return data
    .map((row) => {
      const w = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces
      return w ? { id: w.id, name: w.name, role: row.role } : null
    })
    .filter((w): w is Workspace => w !== null)
}

export function useWorkspaces() {
  const queryClient = useQueryClient()

  const query = useQuery({ queryKey: ["workspaces"], queryFn: fetchWorkspaces })

  const create = useMutation({
    mutationFn: async (vars: { name: string; password: string }) => {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to create workspace")
      return body.data as { id: string; name: string }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
  })

  const join = useMutation({
    mutationFn: async (vars: { name: string; password: string }) => {
      const res = await fetch("/api/workspaces/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to join workspace")
      return body.data as { id: string; name: string; role: "owner" | "member" }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
  })

  return { ...query, create, join }
}
