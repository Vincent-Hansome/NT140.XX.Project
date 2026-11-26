const router = require('express').Router();
const { requireAuth } = require('../middlewares/authMiddleware');
const { validateIdParam } = require('../middlewares/idValidationMiddleware');
const controller = require('../controllers/engagementController');

router.get('/wishlist', requireAuth, controller.wishlist);
router.put('/wishlist/:id', requireAuth, validateIdParam, controller.save);
router.delete('/wishlist/:id', requireAuth, validateIdParam, controller.remove);
router.get('/products/:id/reviews', validateIdParam, controller.reviews);
router.get('/products/:id/reviews/eligibility', requireAuth, validateIdParam, controller.eligibility);
router.post('/products/:id/reviews', requireAuth, validateIdParam, controller.review);
module.exports = router;
