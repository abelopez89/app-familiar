"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import { createFuelLog, type CreateFuelLogResult } from "./actions";
import { formatGuaranies } from "@/lib/format";
import type { Vehicle } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FuelLogForm({
  vehicles,
  defaultVehicleId,
  lastOdometerByVehicle,
}: {
  vehicles: Vehicle[];
  defaultVehicleId: string;
  lastOdometerByVehicle: Record<string, number | null>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  const [vehicleId, setVehicleId] = useState(defaultVehicleId);
  const [isFullTank, setIsFullTank] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const [resetsCalculation, setResetsCalculation] = useState(false);

  const [liters, setLiters] = useState("");
  const [amount, setAmount] = useState("");

  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  const [result, setResult] = useState<CreateFuelLogResult | null>(null);

  const pricePerLiter = useMemo(() => {
    const l = Number(liters);
    const a = Number(amount);
    if (!l || !a || l <= 0) return null;
    return a / l;
  }, [liters, amount]);

  function finish(res: CreateFuelLogResult) {
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setWarnings(null);
    setPendingFormData(null);
    setResult(res);
    toast.success("Carga guardada.");
    formRef.current?.reset();
    setLiters("");
    setAmount("");
    setIsFullTank(true);
    setResetsCalculation(false);
  }

  function handleSubmit(formData: FormData) {
    formData.set("confirmed", "");
    startTransition(async () => {
      const res = await createFuelLog({}, formData);
      if (res.warnings) {
        setWarnings(res.warnings);
        setPendingFormData(formData);
        setResult(null);
        return;
      }
      finish(res);
    });
  }

  function handleConfirm() {
    if (!pendingFormData) return;
    pendingFormData.set("confirmed", "on");
    startTransition(async () => {
      const res = await createFuelLog({}, pendingFormData);
      finish(res);
    });
  }

  function handleCancelWarnings() {
    setWarnings(null);
    setPendingFormData(null);
  }

  const lastOdometer = lastOdometerByVehicle[vehicleId];

  return (
    <div className="flex flex-col gap-4">
      <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
        {vehicles.length > 1 ? (
          <div className="flex flex-col gap-2">
            <Label>Vehículo</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="vehicle_id" value={vehicleId} />
          </div>
        ) : (
          <input type="hidden" name="vehicle_id" value={vehicleId} />
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="odometer">Kilometraje</Label>
          <Input
            id="odometer"
            name="odometer"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            required
            autoFocus
          />
          {lastOdometer != null && (
            <p className="text-xs text-muted-foreground">última carga: {lastOdometer.toLocaleString("es-PY")} km</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="liters">Litros</Label>
          <Input
            id="liters"
            name="liters"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            required
            value={liters}
            onChange={(e) => setLiters(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="total_amount">Monto (Gs.)</Label>
          <Input
            id="total_amount"
            name="total_amount"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {pricePerLiter != null && (
            <p className="text-xs text-muted-foreground">{formatGuaranies(pricePerLiter)} por litro</p>
          )}
        </div>

        <div className="flex flex-col gap-1 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="is_full_tank">Tanque lleno</Label>
            <Switch id="is_full_tank" checked={isFullTank} onCheckedChange={setIsFullTank} />
          </div>
          <input type="hidden" name="is_full_tank" value={isFullTank ? "on" : ""} />
          <p className="text-xs text-muted-foreground">
            El rendimiento solo se calcula entre tanques llenos. Si cargás parcial, dejalo apagado.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="flex items-center gap-1 text-left text-sm font-medium text-muted-foreground"
        >
          {showMore ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          Más datos (opcional)
        </button>

        {showMore && (
          <div className="flex flex-col gap-4 rounded-lg border p-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="station">Estación</Label>
              <Input id="station" name="station" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fuel_grade">Tipo de nafta</Label>
              <Input id="fuel_grade" name="fuel_grade" placeholder="Ej: común, premium" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" name="notes" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="resets_calculation">Me olvidé de registrar una carga anterior</Label>
              <Switch
                id="resets_calculation"
                checked={resetsCalculation}
                onCheckedChange={setResetsCalculation}
              />
            </div>
            <input type="hidden" name="resets_calculation" value={resetsCalculation ? "on" : ""} />
          </div>
        )}

        {warnings && (
          <Card className="border-amber-500">
            <CardContent className="flex flex-col gap-3 pt-4">
              {warnings.map((w, i) => (
                <p key={i} className="text-sm">
                  {w}
                </p>
              ))}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleCancelWarnings} disabled={isPending}>
                  Corregir
                </Button>
                <Button type="button" onClick={handleConfirm} disabled={isPending}>
                  {isPending ? "Guardando…" : "Guardar igual"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!warnings && (
          <Button type="submit" disabled={isPending} className="h-12 text-base">
            {isPending ? "Guardando…" : "Guardar carga"}
          </Button>
        )}
      </form>

      {result?.success && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-4 text-sm">
            {result.interval ? (
              <>
                <p className="font-medium">Rendimiento del tramo: {result.interval.kmPerLiter.toFixed(1)} km/L</p>
                <p className="text-muted-foreground">
                  {result.interval.km.toLocaleString("es-PY")} km · {formatGuaranies(result.interval.costPerKm)} por km
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                Todavía no hay suficiente historial de tanques llenos para calcular el rendimiento.
              </p>
            )}
            {result.dropAlert && (
              <div className="mt-2 rounded-lg bg-amber-100 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <p className="font-medium">Consumo más alto de lo normal</p>
                <p className="mt-1">
                  Este tramo dio {result.dropAlert.last.kmPerLiter.toFixed(1)} km/L, contra un promedio de{" "}
                  {result.dropAlert.averagePrevious.toFixed(1)} km/L en los tramos anteriores. Puede valer la pena
                  revisar la presión de los neumáticos, el filtro de aire, el estilo de manejo, o si hubo un viaje
                  fuera de lo común.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
