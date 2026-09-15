"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { MemberFilterChips } from "@/app/(app)/eventos/member-filter-chips";
import { TaskCompleteDialog } from "./task-complete-dialog";
import { completeTaskInstance, undoCompleteTaskInstance } from "./actions";
import type { TaskInstanceWithDetails } from "@/lib/tasks/queries";
import type { FamilyMember } from "@/lib/supabase/types";
import { addDaysToDateOnly, formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function TasksList({
  initialInstances,
  members,
  today,
}: {
  initialInstances: TaskInstanceWithDetails[];
  members: FamilyMember[];
  today: string;
}) {
  const [instances, setInstances] = useState(initialInstances);
  const [memberFilter, setMemberFilter] = useState<string[]>([]);
  const [showUpcoming, setShowUpcoming] = useState(false);

  const filtered = useMemo(() => {
    if (memberFilter.length === 0) return instances;
    return instances.filter(
      (i) => i.definition.assigned_to === null || memberFilter.includes(i.definition.assigned_to),
    );
  }, [instances, memberFilter]);

  const weekEnd = addDaysToDateOnly(today, 6);

  const overdue = filtered.filter((i) => i.due_date < today).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const thisWeek = filtered
    .filter((i) => i.due_date >= today && i.due_date <= weekEnd)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const upcoming = filtered
    .filter((i) => i.due_date > weekEnd)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  function removeInstance(id: string) {
    setInstances((prev) => prev.filter((i) => i.id !== id));
  }

  function restoreInstance(instance: TaskInstanceWithDetails) {
    setInstances((prev) => [...prev, instance].sort((a, b) => a.due_date.localeCompare(b.due_date)));
  }

  function handleQuickComplete(instance: TaskInstanceWithDetails) {
    removeInstance(instance.id);

    completeTaskInstance(instance.id).then((result) => {
      if (result.error || !result.undo) {
        toast.error(result.error ?? "No se pudo completar la tarea.");
        restoreInstance(instance);
        return;
      }

      const undo = result.undo;
      toast.success("Tarea completada.", {
        action: {
          label: "Deshacer",
          onClick: () => {
            undoCompleteTaskInstance(undo).then((undoResult) => {
              if (undoResult.error) {
                toast.error(undoResult.error);
                return;
              }
              restoreInstance(instance);
            });
          },
        },
      });
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <MemberFilterChips members={members} selected={memberFilter} onChange={setMemberFilter} />

      <TaskGroup
        title="Vencidas"
        instances={overdue}
        today={today}
        emphasize
        emptyLabel={null}
        onQuickComplete={handleQuickComplete}
        onRemove={removeInstance}
      />

      <TaskGroup
        title="Esta semana"
        instances={thisWeek}
        today={today}
        emptyLabel="No tenés tareas esta semana."
        onQuickComplete={handleQuickComplete}
        onRemove={removeInstance}
      />

      {upcoming.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowUpcoming((v) => !v)}
            className="text-left text-sm font-semibold text-muted-foreground"
          >
            Próximas ({upcoming.length}) {showUpcoming ? "▲" : "▼"}
          </button>
          {showUpcoming && (
            <TaskGroup
              title={null}
              instances={upcoming}
              today={today}
              emptyLabel={null}
              onQuickComplete={handleQuickComplete}
              onRemove={removeInstance}
            />
          )}
        </div>
      )}

      {overdue.length === 0 && thisWeek.length === 0 && upcoming.length === 0 && (
        <p className="text-sm text-muted-foreground">No tenés tareas pendientes.</p>
      )}
    </div>
  );
}

function TaskGroup({
  title,
  instances,
  today,
  emphasize,
  emptyLabel,
  onQuickComplete,
  onRemove,
}: {
  title: string | null;
  instances: TaskInstanceWithDetails[];
  today: string;
  emphasize?: boolean;
  emptyLabel: string | null;
  onQuickComplete: (instance: TaskInstanceWithDetails) => void;
  onRemove: (id: string) => void;
}) {
  if (instances.length === 0 && !emptyLabel) return null;

  return (
    <div className="flex flex-col gap-2">
      {title && <p className="px-1 text-sm font-semibold">{title}</p>}
      {instances.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          {instances.map((instance) => (
            <TaskRow
              key={instance.id}
              instance={instance}
              today={today}
              emphasize={emphasize}
              onQuickComplete={onQuickComplete}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  instance,
  today,
  emphasize,
  onQuickComplete,
  onRemove,
}: {
  instance: TaskInstanceWithDetails;
  today: string;
  emphasize?: boolean;
  onQuickComplete: (instance: TaskInstanceWithDetails) => void;
  onRemove: (id: string) => void;
}) {
  const isOverdue = instance.due_date < today;
  const overdueDays = isOverdue
    ? Math.round(
        (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${instance.due_date}T00:00:00Z`)) / 86_400_000,
      )
    : 0;

  return (
    <div className="flex min-h-14 items-stretch border-b last:border-b-0">
      <TaskCompleteDialog
        instance={instance}
        onCompleted={() => onRemove(instance.id)}
        onSkipped={() => onRemove(instance.id)}
        trigger={
          <button type="button" className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-2.5 text-left active:bg-muted">
            <span className="truncate text-base font-medium">{instance.definition.title}</span>
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {instance.asset && <span>{instance.asset.name}</span>}
              {instance.assignedTo && (
                <span className="inline-flex items-center gap-1">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: instance.assignedTo.color }}
                  />
                  {instance.assignedTo.display_name}
                </span>
              )}
              <span className={cn(isOverdue && emphasize && "font-medium text-destructive")}>
                {isOverdue
                  ? `Vencida hace ${overdueDays} día${overdueDays === 1 ? "" : "s"}`
                  : formatDate(instance.due_date)}
              </span>
            </span>
          </button>
        }
      />
      <button
        type="button"
        aria-label="Marcar hecha"
        onClick={(e) => {
          e.stopPropagation();
          onQuickComplete(instance);
        }}
        className="flex w-14 shrink-0 items-center justify-center border-l active:bg-muted"
      >
        <Check className="size-5 text-primary" strokeWidth={3} />
      </button>
    </div>
  );
}
