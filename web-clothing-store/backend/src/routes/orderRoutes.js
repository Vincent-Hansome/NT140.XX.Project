const express = require('express');
const router = express.Router();

const orderController = require('../controllers/orderController');
const commerce = require('../controllers/orderCommerceController');
const {
  requireAuth,
  requireAdmin
} = require('../middlewares/authMiddleware');
const { validateIdParam } = require('../middlewares/idValidationMiddleware');

// Admin: xem tất cả đơn hàng
router.get(
  '/admin/all',
  requireAuth,
  requireAdmin,
  orderController.getAllOrdersAdmin
);

router.get('/admin/coupons', requireAuth, requireAdmin, commerce.coupons);
router.post('/admin/coupons', requireAuth, requireAdmin, commerce.createCoupon);
router.patch('/admin/coupons/:id', requireAuth, requireAdmin, validateIdParam, commerce.setCouponActive);
router.get('/admin/returns', requireAuth, requireAdmin, commerce.listReturns);
router.patch('/admin/returns/:id', requireAuth, requireAdmin, validateIdParam, commerce.decideReturn);
router.patch('/admin/:id/status', requireAuth, requireAdmin, validateIdParam, commerce.advance);
router.post('/coupon-preview', requireAuth, commerce.preview);
router.get('/:id/activity', requireAuth, validateIdParam, commerce.activity);
router.post('/:id/returns', requireAuth, validateIdParam, commerce.requestReturn);

// Khách hàng: tạo và xem đơn của chính mình
router.post('/', requireAuth, orderController.createOrder);
router.get('/', requireAuth, orderController.getMyOrders);
router.get('/:id', requireAuth, validateIdParam, orderController.getOrderDetail);

module.exports = router;
