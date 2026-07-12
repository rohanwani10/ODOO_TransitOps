import { Router } from 'express';
import healthRouter   from './health.route';
import authRouter     from '../modules/auth/auth.route';
import vehiclesRouter from '../modules/vehicles/vehicle.route';
import driversRouter  from '../modules/drivers/driver.route';

const router = Router();

// ─── Auth ─────────────────────────────────────────────────────
router.use('/auth', authRouter);

// ─── Core domain ──────────────────────────────────────────────
router.use('/vehicles', vehiclesRouter);
router.use('/drivers',  driversRouter);

// ─── Health ───────────────────────────────────────────────────
router.use('/health', healthRouter);

// ─── Remaining modules (uncomment as built) ───────────────────
// import tripsRouter       from '../modules/trips/trip.route';
// import maintenanceRouter from '../modules/maintenance/maintenance.route';
// import fuelRouter        from '../modules/fuel/fuel.route';
// import expensesRouter    from '../modules/expenses/expense.route';

// router.use('/trips',       tripsRouter);
// router.use('/maintenance', maintenanceRouter);
// router.use('/fuel',        fuelRouter);
// router.use('/expenses',    expensesRouter);

export default router;
