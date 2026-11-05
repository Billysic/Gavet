import { Router } from 'express';
import { register, login, getMe, deleteAccount } from '../controllers/authController.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', getMe);
router.delete('/account', deleteAccount);

export default router;
