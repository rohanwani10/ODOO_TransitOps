"use client";

import { FormEvent, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useAvailableVehicles,
  useCreateDriver,
  useCreateExpense,
  useCreateMaintenanceLog,
  useCreateTrip,
  useCreateVehicle,
  useDrivers,
  useTrips,
  useVehicles,
} from "@/lib/api-hooks";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

type OptionVehicle = {
  id: string;
  registrationNo: string;
  make: string;
  model: string;
  fuelType?: string;
  odometerKm?: number;
};

type OptionDriver = {
  id: string;
  licenseNo: string;
  status: string;
  user: { name: string };
};

type OptionTrip = {
  id: string;
  origin: string;
  destination: string;
  status: string;
};

const vehicleTypes = ["BUS", "MINIBUS", "VAN", "TRUCK", "CAR", "MOTORCYCLE"];
const fuelTypes = ["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "CNG"];
const vehicleStatuses = ["AVAILABLE", "IN_USE", "MAINTENANCE", "OUT_OF_SERVICE", "RETIRED"];
const driverStatuses = ["AVAILABLE", "ACTIVE", "INACTIVE", "SUSPENDED"];
const maintenanceTypes = ["SCHEDULED", "UNSCHEDULED", "EMERGENCY"];
const maintenanceStatuses = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const expenseCategories = ["FUEL", "MAINTENANCE", "TOLL", "INSURANCE", "REGISTRATION", "CLEANING", "MISCELLANEOUS"];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function defaultDateTime(offsetHours = 0) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function optionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? Number(text) : undefined;
}

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function getErrorMessage(error: unknown) {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : "Something went wrong";
}

function labelFromEnum(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className ?? "space-y-1.5"}>
      <span className="text-label-md font-medium text-on-surface">{label}</span>
      {children}
    </label>
  );
}

function NativeSelect({
  name,
  defaultValue,
  required,
  children,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      required={required}
      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </select>
  );
}

function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      {children}
    </Button>
  );
}

function FormModal({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="entity-form-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-surface p-5 text-on-surface shadow-xl ring-1 ring-outline-variant"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="entity-form-title" className="font-title-lg text-title-lg text-on-surface">
              {title}
            </h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">{description}</p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormActions({
  pending,
  submitLabel,
  onCancel,
}: {
  pending: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="-mx-5 -mb-5 mt-4 flex flex-col-reverse gap-2 rounded-b-xl border-t border-outline-variant bg-surface-container-low p-4 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
    </div>
  );
}

export function AddVehicleDialog() {
  const [open, setOpen] = useState(false);
  const createVehicle = useCreateVehicle();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await createVehicle.mutateAsync({
        registrationNumber: form.get("registrationNumber"),
        make: form.get("make"),
        model: form.get("model"),
        year: form.get("year"),
        type: form.get("type"),
        fuelType: form.get("fuelType"),
        status: form.get("status"),
        odometerKm: optionalNumber(form.get("odometerKm")),
        seatingCapacity: optionalNumber(form.get("seatingCapacity")),
        payloadCapacityKg: optionalNumber(form.get("payloadCapacityKg")),
        insurancePolicyNo: optionalString(form.get("insurancePolicyNo")),
        insuranceExpiry: optionalString(form.get("insuranceExpiry")),
        registrationExpiry: optionalString(form.get("registrationExpiry")),
        region: optionalString(form.get("region")),
      });
      toast.success("Vehicle added");
      setOpen(false);
      event.currentTarget.reset();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-primary text-on-primary hover:bg-primary-container shadow-none h-10 rounded-lg">
        <Plus className="w-4 h-4 mr-2" /> Add Vehicle
      </Button>
      <FormModal open={open} title="Add Vehicle" description="Create a fleet vehicle record." onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Registration No"><Input name="registrationNumber" required placeholder="MH12AB1234" /></Field>
            <Field label="Region"><Input name="region" placeholder="Pune" /></Field>
            <Field label="Make"><Input name="make" required placeholder="Tata" /></Field>
            <Field label="Model"><Input name="model" required placeholder="Starbus Ultra" /></Field>
            <Field label="Year"><Input name="year" type="number" min="1900" defaultValue={new Date().getFullYear()} required /></Field>
            <Field label="Type">
              <NativeSelect name="type" defaultValue="BUS" required>
                {vehicleTypes.map((type) => <option key={type} value={type}>{labelFromEnum(type)}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Fuel Type">
              <NativeSelect name="fuelType" defaultValue="DIESEL" required>
                {fuelTypes.map((type) => <option key={type} value={type}>{labelFromEnum(type)}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Status">
              <NativeSelect name="status" defaultValue="AVAILABLE" required>
                {vehicleStatuses.map((status) => <option key={status} value={status}>{labelFromEnum(status)}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Odometer Km"><Input name="odometerKm" type="number" min="0" defaultValue="0" /></Field>
            <Field label="Seating Capacity"><Input name="seatingCapacity" type="number" min="1" /></Field>
            <Field label="Payload Kg"><Input name="payloadCapacityKg" type="number" min="1" /></Field>
            <Field label="Insurance Policy"><Input name="insurancePolicyNo" /></Field>
            <Field label="Insurance Expiry"><Input name="insuranceExpiry" type="date" /></Field>
            <Field label="Registration Expiry"><Input name="registrationExpiry" type="date" /></Field>
          </div>
          <FormActions pending={createVehicle.isPending} submitLabel="Save Vehicle" onCancel={() => setOpen(false)} />
        </form>
      </FormModal>
    </>
  );
}

export function AddDriverDialog() {
  const [open, setOpen] = useState(false);
  const createDriver = useCreateDriver();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await createDriver.mutateAsync({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        licenseNumber: form.get("licenseNumber"),
        licenseExpiry: form.get("licenseExpiry"),
        phone: form.get("phone"),
        address: optionalString(form.get("address")),
        status: form.get("status"),
        emergencyName: optionalString(form.get("emergencyName")),
        emergencyPhone: optionalString(form.get("emergencyPhone")),
        hiredAt: optionalString(form.get("hiredAt")),
      });
      toast.success("Driver added");
      setOpen(false);
      event.currentTarget.reset();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-primary text-on-primary hover:bg-primary-container shadow-none h-10 rounded-lg">
        <Plus className="w-4 h-4 mr-2" /> Add Driver
      </Button>
      <FormModal open={open} title="Add Driver" description="Create the driver and their login user together." onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><Input name="name" required placeholder="Rajesh Kumar" /></Field>
            <Field label="Email"><Input name="email" type="email" required placeholder="driver@transitops.com" /></Field>
            <Field label="Temporary Password"><Input name="password" type="password" minLength={6} required /></Field>
            <Field label="Phone"><Input name="phone" required placeholder="+91-9876543210" /></Field>
            <Field label="License No"><Input name="licenseNumber" required /></Field>
            <Field label="License Expiry"><Input name="licenseExpiry" type="date" required /></Field>
            <Field label="Status">
              <NativeSelect name="status" defaultValue="AVAILABLE" required>
                {driverStatuses.map((status) => <option key={status} value={status}>{labelFromEnum(status)}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Hired At"><Input name="hiredAt" type="date" defaultValue={todayDate()} /></Field>
            <Field label="Emergency Name"><Input name="emergencyName" /></Field>
            <Field label="Emergency Phone"><Input name="emergencyPhone" /></Field>
            <Field label="Address" className="space-y-1.5 sm:col-span-2"><Textarea name="address" /></Field>
          </div>
          <FormActions pending={createDriver.isPending} submitLabel="Save Driver" onCancel={() => setOpen(false)} />
        </form>
      </FormModal>
    </>
  );
}

export function AddTripDialog() {
  const [open, setOpen] = useState(false);
  const createTrip = useCreateTrip();
  const { data: vehicleResponse } = useAvailableVehicles();
  const { data: driverResponse } = useDrivers({ limit: "100" });
  const vehicles: OptionVehicle[] = vehicleResponse?.data ?? [];
  const drivers: OptionDriver[] = driverResponse?.data ?? [];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await createTrip.mutateAsync({
        vehicleId: form.get("vehicleId"),
        driverId: form.get("driverId"),
        origin: form.get("origin"),
        destination: form.get("destination"),
        scheduledStart: form.get("scheduledStart"),
        scheduledEnd: form.get("scheduledEnd"),
        cargoWeightKg: optionalNumber(form.get("cargoWeightKg")),
        distanceKm: optionalNumber(form.get("distanceKm")),
        purpose: optionalString(form.get("purpose")),
        notes: optionalString(form.get("notes")),
        status: "DRAFT",
      });
      toast.success("Trip created");
      setOpen(false);
      event.currentTarget.reset();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-primary text-on-primary hover:bg-primary-container shadow-none h-10 rounded-lg">
        <Plus className="w-4 h-4 mr-2" /> Create Trip
      </Button>
      <FormModal open={open} title="Create Trip" description="Schedule a draft trip for dispatch." onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vehicle">
              <NativeSelect name="vehicleId" required>
                <option value="">Select vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registrationNo} - {vehicle.make} {vehicle.model}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Driver">
              <NativeSelect name="driverId" required>
                <option value="">Select driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.user.name} - {labelFromEnum(driver.status)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Origin"><Input name="origin" required /></Field>
            <Field label="Destination"><Input name="destination" required /></Field>
            <Field label="Scheduled Start"><Input name="scheduledStart" type="datetime-local" required defaultValue={defaultDateTime(1)} /></Field>
            <Field label="Scheduled End"><Input name="scheduledEnd" type="datetime-local" required defaultValue={defaultDateTime(4)} /></Field>
            <Field label="Cargo Weight Kg"><Input name="cargoWeightKg" type="number" min="1" required /></Field>
            <Field label="Distance Km"><Input name="distanceKm" type="number" min="0" /></Field>
            <Field label="Purpose" className="space-y-1.5 sm:col-span-2"><Input name="purpose" /></Field>
            <Field label="Notes" className="space-y-1.5 sm:col-span-2"><Textarea name="notes" /></Field>
          </div>
          <FormActions pending={createTrip.isPending} submitLabel="Save Trip" onCancel={() => setOpen(false)} />
        </form>
      </FormModal>
    </>
  );
}

export function AddMaintenanceDialog() {
  const [open, setOpen] = useState(false);
  const createMaintenance = useCreateMaintenanceLog();
  const { data: vehicleResponse } = useVehicles({ limit: "100" });
  const vehicles: OptionVehicle[] = vehicleResponse?.data ?? [];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await createMaintenance.mutateAsync({
        vehicleId: form.get("vehicleId"),
        type: form.get("type"),
        status: form.get("status"),
        title: form.get("title"),
        description: optionalString(form.get("description")),
        vendor: optionalString(form.get("vendor")),
        odometerKm: optionalNumber(form.get("odometerKm")),
        scheduledAt: form.get("scheduledAt"),
        completedAt: optionalString(form.get("completedAt")),
        cost: optionalNumber(form.get("cost")),
      });
      toast.success("Maintenance logged");
      setOpen(false);
      event.currentTarget.reset();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-primary text-on-primary hover:bg-primary-container shadow-none h-10 rounded-lg">
        <Plus className="w-4 h-4 mr-2" /> Log Maintenance
      </Button>
      <FormModal open={open} title="Log Maintenance" description="Add a service or repair record." onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vehicle">
              <NativeSelect name="vehicleId" required>
                <option value="">Select vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registrationNo} - {vehicle.make} {vehicle.model}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Type">
              <NativeSelect name="type" defaultValue="SCHEDULED" required>
                {maintenanceTypes.map((type) => <option key={type} value={type}>{labelFromEnum(type)}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Status">
              <NativeSelect name="status" defaultValue="SCHEDULED" required>
                {maintenanceStatuses.map((status) => <option key={status} value={status}>{labelFromEnum(status)}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Scheduled At"><Input name="scheduledAt" type="datetime-local" required defaultValue={defaultDateTime(1)} /></Field>
            <Field label="Title"><Input name="title" required placeholder="Oil service" /></Field>
            <Field label="Vendor"><Input name="vendor" /></Field>
            <Field label="Odometer Km"><Input name="odometerKm" type="number" min="0" /></Field>
            <Field label="Cost"><Input name="cost" type="number" min="0.01" step="0.01" /></Field>
            <Field label="Completed At"><Input name="completedAt" type="datetime-local" /></Field>
            <Field label="Description" className="space-y-1.5 sm:col-span-2"><Textarea name="description" /></Field>
          </div>
          <FormActions pending={createMaintenance.isPending} submitLabel="Save Log" onCancel={() => setOpen(false)} />
        </form>
      </FormModal>
    </>
  );
}

export function AddExpenseDialog() {
  const [open, setOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const createExpense = useCreateExpense();
  const { data: vehicleResponse } = useVehicles({ limit: "100" });
  const { data: tripResponse } = useTrips({ limit: "100" });
  const vehicles: OptionVehicle[] = vehicleResponse?.data ?? [];
  const activeTrips: OptionTrip[] = (tripResponse?.data ?? []).filter((trip: OptionTrip) => trip.status !== "CANCELLED");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user?.id) {
      toast.error("Sign in again before recording an expense");
      return;
    }

    const form = new FormData(event.currentTarget);

    try {
      await createExpense.mutateAsync({
        vehicleId: form.get("vehicleId"),
        tripId: optionalString(form.get("tripId")),
        submittedById: user.id,
        category: form.get("category"),
        amount: form.get("amount"),
        description: form.get("description"),
        receiptUrl: optionalString(form.get("receiptUrl")),
        incurredAt: form.get("incurredAt"),
      });
      toast.success("Expense recorded");
      setOpen(false);
      event.currentTarget.reset();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-primary text-on-primary hover:bg-primary-container shadow-none h-10 rounded-lg">
        <Plus className="w-4 h-4 mr-2" /> Record Expense
      </Button>
      <FormModal open={open} title="Record Expense" description="Add a fleet cost for review." onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vehicle">
              <NativeSelect name="vehicleId" required>
                <option value="">Select vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registrationNo} - {vehicle.make} {vehicle.model}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Trip">
              <NativeSelect name="tripId">
                <option value="">No trip</option>
                {activeTrips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.origin} to {trip.destination}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Category">
              <NativeSelect name="category" defaultValue="FUEL" required>
                {expenseCategories.map((category) => <option key={category} value={category}>{labelFromEnum(category)}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Amount"><Input name="amount" type="number" min="0.01" step="0.01" required /></Field>
            <Field label="Incurred At"><Input name="incurredAt" type="date" max={todayDate()} defaultValue={todayDate()} required /></Field>
            <Field label="Receipt URL"><Input name="receiptUrl" type="url" /></Field>
            <Field label="Description" className="space-y-1.5 sm:col-span-2"><Textarea name="description" required /></Field>
          </div>
          <FormActions pending={createExpense.isPending} submitLabel="Save Expense" onCancel={() => setOpen(false)} />
        </form>
      </FormModal>
    </>
  );
}
