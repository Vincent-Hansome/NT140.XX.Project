const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const variants = require('../controllers/variantController');
const { requireAuth, requireAdmin } = require('../middlewares/authMiddleware');
const { validateIdParam } = require('../middlewares/idValidationMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.get('/', productController.getAll);
router.get('/:id/variants', validateIdParam, variants.list);
router.put('/:id/variants', requireAuth, requireAdmin, validateIdParam, variants.save);
router.get('/:id', validateIdParam, productController.getById);
router.post('/', requireAuth, requireAdmin, upload, productController.create);
router.put('/:id', requireAuth, requireAdmin, validateIdParam, upload, productController.update);
router.delete('/:id', requireAuth, requireAdmin, validateIdParam, productController.remove);

module.exports = router;
