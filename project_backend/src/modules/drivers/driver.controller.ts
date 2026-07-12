import type { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { driverService } from './driver.service';
import { ForbiddenError } from '../../errors/AppError';
import type {
  CreateDriverDto,
  UpdateDriverDto,
  UpdateDriverStatusDto,
  AssignVehicleDto,
  AdjustSafetyScoreDto,
  ListDriversQuery,
} from './driver.types';

// ─── POST /drivers ────────────────────────────────────────────
export async function createDriver(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const driver = await driverService.create(req.body as CreateDriverDto);
    res.status(StatusCodes.CREATED).json({ success: true, data: driver });
  } catch (err) {
    next(err);
  }
}

// ─── GET /drivers ─────────────────────────────────────────────
export async function listDrivers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query  = req.query as unknown as ListDriversQuery;
    const result = await driverService.list(query);
    res.status(StatusCodes.OK).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ─── GET /drivers/stats ───────────────────────────────────────
export async function getDriverStats(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const stats = await driverService.getStats();
    res.status(StatusCodes.OK).json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

// ─── GET /drivers/license-alerts ──────────────────────────────
export async function getLicenseAlerts(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const days   = (req.query as { days?: number }).days ?? 30;
    const alerts = await driverService.getLicenseAlerts(days);
    res.status(StatusCodes.OK).json({ success: true, data: alerts });
  } catch (err) {
    next(err);
  }
}

// ─── GET /drivers/me ──────────────────────────────────────────
// Drivers fetch their own profile via their DB user ID
export async function getMyDriverProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // req.user is guaranteed by requireAuth + syncUser + requireActive
    const driver = await driverService.getByUserId(req.user!.id);
    res.status(StatusCodes.OK).json({ success: true, data: driver });
  } catch (err) {
    next(err);
  }
}

// ─── GET /drivers/:id ─────────────────────────────────────────
export async function getDriverById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const driver = await driverService.getById(req.params['id'] as string);
    res.status(StatusCodes.OK).json({ success: true, data: driver });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /drivers/:id ───────────────────────────────────────
export async function updateDriver(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const driver = await driverService.update(
      req.params['id'] as string,
      req.body as UpdateDriverDto,
    );
    res.status(StatusCodes.OK).json({ success: true, data: driver });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /drivers/:id/status ────────────────────────────────
export async function updateDriverStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const driver = await driverService.updateStatus(
      req.params['id'] as string,
      req.body as UpdateDriverStatusDto,
    );
    res.status(StatusCodes.OK).json({ success: true, data: driver });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /drivers/:id/vehicle ───────────────────────────────
export async function assignVehicle(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const driver = await driverService.assignVehicle(
      req.params['id'] as string,
      req.body as AssignVehicleDto,
    );
    res.status(StatusCodes.OK).json({ success: true, data: driver });
  } catch (err) {
    next(err);
  }
}

// ─── POST /drivers/:id/safety-score ───────────────────────────
// Only SAFETY_OFFICER and SUPER_ADMIN can trigger score events.
// FLEET_MANAGER can see scores but cannot adjust them.
export async function adjustSafetyScore(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const driver = await driverService.adjustSafetyScore(
      req.params['id'] as string,
      req.body as AdjustSafetyScoreDto,
    );
    res.status(StatusCodes.OK).json({ success: true, data: driver });
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /drivers/:id ──────────────────────────────────────
export async function deleteDriver(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await driverService.softDelete(req.params['id'] as string);
    res.status(StatusCodes.NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
}
