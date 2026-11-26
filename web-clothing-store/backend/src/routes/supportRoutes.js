const router = require('express').Router();
const controller = require('../controllers/supportController');
const { requireAuth, requireAdmin } = require('../middlewares/authMiddleware');
const { validateIdParam } = require('../middlewares/idValidationMiddleware');

router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.use(requireAuth);
router.post('/tickets', controller.create);
router.get('/tickets', controller.listMine);
router.get('/tickets/:id', validateIdParam, controller.getMine);
router.get('/tickets/:id/messages', validateIdParam, controller.messagesMine);
router.post('/tickets/:id/messages', validateIdParam, controller.replyMine);
router.get('/admin/tickets', requireAdmin, controller.listAdmin);
router.get('/admin/tickets/:id/messages', requireAdmin, validateIdParam, controller.messagesAdmin);
router.patch('/admin/tickets/:id', requireAdmin, validateIdParam, controller.updateAdmin);

module.exports = router;
