import type { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { vehicleService } from './vehicle.service';
import type {
  CreateVehicleDto,
  UpdateVehicleDto,
  UpdateVehicleStatusDto,
  UpdateOdometerDto,
  ListVehiclesQuery,
} from './vehicle.types';

// ─── POST /vehicles ───────────────────────────────────────────
export async function createVehicle(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const vehicle = await vehicleService.create(req.body as CreateVehicleDto);
    res.status(StatusCodes.CREATED).json({ success: true, data: vehicle });
  } catch (err) {
    next(err);
  }
}

// ─── GET /vehicles ────────────────────────────────────────────
export async function listVehicles(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // validate() middleware has already parsed and coerced req.query via
    // listVehiclesQuerySchema — page/limit are numbers, enums are validated.
    // Cast to the inferred Zod type instead of the raw query string map.
    const query = req.query as unknown as ListVehiclesQuery;
    const result = await vehicleService.list(query);
    res.status(StatusCodes.OK).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─── GET /vehicles/stats ──────────────────────────────────────
export async function getVehicleStats(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const stats = await vehicleService.getStats();
    res.status(StatusCodes.OK).json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

// ─── GET /vehicles/alerts ─────────────────────────────────────
export async function getExpiryAlerts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // validate() has already coerced req.query.days to a number (or undefined).
    const days = (req.query as { days?: number }).days ?? 30;
    const alerts = await vehicleService.getExpiryAlerts(days);
    res.status(StatusCodes.OK).json({ success: true, data: alerts });
  } catch (err) {
    next(err);
  }
}

// ─── GET /vehicles/:id ────────────────────────────────────────
export async function getVehicleById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const vehicle = await vehicleService.getById(req.params['id'] as string);
    res.status(StatusCodes.OK).json({ success: true, data: vehicle });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /vehicles/:id ──────────────────────────────────────
export async function updateVehicle(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const vehicle = await vehicleService.update(
      req.params['id'] as string,
      req.body as UpdateVehicleDto,
    );
    res.status(StatusCodes.OK).json({ success: true, data: vehicle });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /vehicles/:id/status ───────────────────────────────
export async function updateVehicleStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const vehicle = await vehicleService.updateStatus(
      req.params['id'] as string,
      req.body as UpdateVehicleStatusDto,
    );
    res.status(StatusCodes.OK).json({ success: true, data: vehicle });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /vehicles/:id/odometer ─────────────────────────────
export async function updateVehicleOdometer(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const vehicle = await vehicleService.updateOdometer(
      req.params['id'] as string,
      req.body as UpdateOdometerDto,
    );
    res.status(StatusCodes.OK).json({ success: true, data: vehicle });
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /vehicles/:id ─────────────────────────────────────
export async function deleteVehicle(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await vehicleService.softDelete(req.params['id'] as string);
    res.status(StatusCodes.NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
}
