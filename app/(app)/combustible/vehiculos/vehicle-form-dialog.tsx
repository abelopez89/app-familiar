"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createVehicle, updateVehicle, type ActionResult } from "./actions";
import { FUEL_TYPES } from "@/lib/fuel/constants";
import type { Asset, FuelType, Vehicle } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type AssetMode = "none" | "existing" | "new";

export function VehicleFormDialog({
  vehicle,
  linkableAssets,
  trigger,
}: {
  vehicle?: Vehicle;
  linkableAssets: Asset[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [fuelType, setFuelType] = useState<FuelType>(vehicle?.fuel_type ?? "nafta");
  const [assetMode, setAssetMode] = useState<AssetMode>(vehicle?.asset_id ? "existing" : "none");
  const [assetId, setAssetId] = useState(vehicle?.asset_id ?? "");

  const action = vehicle ? updateVehicle : createVehicle;
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action, {});

  useEffect(() => {
    if (state.success) {
      toast.success(vehicle ? "Vehículo actualizado." : "Vehículo creado.");
      setOpen(false);
    }
    if (state.error) toast.error(state.error);
  }, [state, vehicle]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="icon" className="size-14 rounded-full shadow-lg">
            <Plus className="size-6" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Editar vehículo" : "Nuevo vehículo"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {vehicle && <input type="hidden" name="id" value={vehicle.id} />}
          <input type="hidden" name="asset_mode" value={assetMode} />
          {assetMode === "existing" && <input type="hidden" name="asset_id" value={assetId} />}

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" placeholder="Ej: Corolla de Ana" defaultValue={vehicle?.name} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="plate">Chapa (opcional)</Label>
            <Input id="plate" name="plate" defaultValue={vehicle?.plate ?? ""} />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label>Combustible</Label>
              <Select value={fuelType} onValueChange={(v) => setFuelType(v as FuelType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FUEL_TYPES) as FuelType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {FUEL_TYPES[type].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="fuel_type" value={fuelType} />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="tank_capacity">Tanque (L, opcional)</Label>
              <Input
                id="tank_capacity"
                name="tank_capacity"
                type="number"
                min="0"
                step="0.1"
                defaultValue={vehicle?.tank_capacity ?? ""}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="initial_odometer">Odómetro inicial (opcional)</Label>
            <Input
              id="initial_odometer"
              name="initial_odometer"
              type="number"
              min="0"
              step="0.1"
              defaultValue={vehicle?.initial_odometer ?? ""}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Activo vinculado (opcional)</Label>
            <p className="text-xs text-muted-foreground">
              Vincula este vehículo a un activo del hogar para ver sus tareas de mantenimiento en el
              detalle.
            </p>
            <Select value={assetMode} onValueChange={(v) => setAssetMode(v as AssetMode)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguno</SelectItem>
                <SelectItem value="existing">Vincular activo existente</SelectItem>
                <SelectItem value="new">Crear activo nuevo</SelectItem>
              </SelectContent>
            </Select>

            {assetMode === "existing" && (
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elegí un activo" />
                </SelectTrigger>
                <SelectContent>
                  {linkableAssets.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No hay activos de tipo vehículo disponibles.
                    </div>
                  ) : (
                    linkableAssets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}

            {assetMode === "new" && (
              <p className="text-xs text-muted-foreground">
                Se crea un activo nuevo de tipo vehículo con el mismo nombre.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
