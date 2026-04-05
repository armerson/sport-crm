import { useState } from 'react'
import { Button } from '../ui/Button.tsx'
import { ConfirmInline } from '../ui/ConfirmInline.tsx'
import { TextField } from '../ui/TextField.tsx'
import { SelectField } from '../ui/SelectField.tsx'
import type { GroupFormInput, GroupRecord, TeamRecord } from '../../types/club.ts'

interface Props {
  groups: GroupRecord[]
  teams: TeamRecord[]
  isSubmitting: boolean
  onCreate: (input: GroupFormInput, teamIds: string[]) => Promise<unknown>
  onUpdate: (groupId: string, input: GroupFormInput, teamIds: string[]) => Promise<void>
  onDelete: (groupId: string) => Promise<void>
}

function parentOptions(groups: GroupRecord[], editingId?: string) {
  return [
    { label: 'No parent (top level)', value: '' },
    ...groups
      .filter((g) => g.id !== editingId)
      .map((g) => ({ label: g.name, value: g.id })),
  ]
}

/** Multi-select pill list for assigning teams to a group */
function TeamMultiSelect({
  teams,
  selected,
  onChange,
}: {
  teams: TeamRecord[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  if (teams.length === 0) return <p className="text-sm text-slate-400">No teams available.</p>

  return (
    <div className="flex flex-wrap gap-2">
      {teams.map((team) => {
        const active = selected.includes(team.id)
        return (
          <button
            key={team.id}
            type="button"
            onClick={() => toggle(team.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              active
                ? 'bg-[#123524] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {team.name}
          </button>
        )
      })}
    </div>
  )
}

export function GroupsManageSection({ groups, teams, isSubmitting, onCreate, onUpdate, onDelete }: Props) {
  const [newName, setNewName] = useState('')
  const [newParentId, setNewParentId] = useState('')
  const [newTeamIds, setNewTeamIds] = useState<string[]>([])
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Editing state — one group at a time
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editParentId, setEditParentId] = useState('')
  const [editTeamIds, setEditTeamIds] = useState<string[]>([])

  function startEdit(group: GroupRecord) {
    setEditingId(group.id)
    setEditName(group.name)
    setEditParentId(group.parentId ?? '')
    setEditTeamIds([...group.teamIds])
    setLocalError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setLocalError(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLocalError(null)
    if (!newName.trim()) { setLocalError('Group name is required.'); return }
    try {
      await onCreate({ name: newName.trim(), parentId: newParentId || null }, newTeamIds)
      setNewName('')
      setNewParentId('')
      setNewTeamIds([])
      setSuccessMsg('Group created.')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch {
      // hook exposes error
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setLocalError(null)
    if (!editName.trim()) { setLocalError('Group name is required.'); return }
    try {
      await onUpdate(editingId, { name: editName.trim(), parentId: editParentId || null }, editTeamIds)
      setEditingId(null)
      setSuccessMsg('Group updated.')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch {
      // hook exposes error
    }
  }

  // Build a display map of group name by id
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">Club groups</h2>
        <p className="mt-1 text-sm text-slate-500">
          Organise teams into named sections (e.g. Academy, Seniors). Groups can be nested to build a full club tree.
        </p>
      </div>

      {localError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{localError}</div>
      ) : null}
      {successMsg ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{successMsg}</div>
      ) : null}

      {/* Create form */}
      <form className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-5" onSubmit={handleCreate}>
        <p className="text-sm font-semibold text-slate-700">New group</p>
        <TextField
          label="Group name"
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Academy"
          value={newName}
        />
        <SelectField
          label="Parent group (optional)"
          onChange={(e) => setNewParentId(e.target.value)}
          options={parentOptions(groups)}
          value={newParentId}
        />
        {teams.length > 0 ? (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Assign teams</p>
            <TeamMultiSelect teams={teams} selected={newTeamIds} onChange={setNewTeamIds} />
          </div>
        ) : null}
        <Button className="w-full" loading={isSubmitting} type="submit">
          Create group
        </Button>
      </form>

      {/* Existing groups */}
      {groups.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Existing groups</p>
          {groups.map((group) => (
            <div key={group.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              {editingId === group.id ? (
                <form className="space-y-4" onSubmit={handleUpdate}>
                  <TextField
                    label="Name"
                    onChange={(e) => setEditName(e.target.value)}
                    value={editName}
                  />
                  <SelectField
                    label="Parent group"
                    onChange={(e) => setEditParentId(e.target.value)}
                    options={parentOptions(groups, group.id)}
                    value={editParentId}
                  />
                  {teams.length > 0 ? (
                    <div>
                      <p className="mb-2 text-sm font-medium text-slate-700">Assigned teams</p>
                      <TeamMultiSelect teams={teams} selected={editTeamIds} onChange={setEditTeamIds} />
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <Button className="flex-1" loading={isSubmitting} type="submit">Save</Button>
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                      onClick={cancelEdit}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{group.name}</p>
                    {group.parentId ? (
                      <p className="text-xs text-slate-500">In: {groupNameById.get(group.parentId) ?? 'Unknown'}</p>
                    ) : (
                      <p className="text-xs text-slate-500">Top level</p>
                    )}
                    {group.teamIds.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {group.teamIds.map((tid) => {
                          const t = teams.find((x) => x.id === tid)
                          return t ? (
                            <span key={tid} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                              {t.name}
                            </span>
                          ) : null
                        })}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">No teams assigned</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      className="text-xs font-medium text-slate-500 hover:text-[#123524]"
                      onClick={() => startEdit(group)}
                    >
                      Edit
                    </button>
                    <ConfirmInline
                      label="Delete"
                      confirmLabel="Yes, delete"
                      onConfirm={() => void onDelete(group.id)}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          No groups yet. Create one above to start building your club tree.
        </div>
      )}
    </div>
  )
}
