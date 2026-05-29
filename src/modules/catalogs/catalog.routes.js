const express = require('express');
const controller = require('./catalog.controller');
const { requireAuth, requireRole } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.get('/', controller.getCatalogItems);
router.get('/:code', controller.getCatalogItem);

router.use(requireAuth);
router.use(requireRole('pengurus'));

router.post('/', controller.createCatalogItem);
router.put('/:code', controller.updateCatalogItem);
router.delete('/:code', controller.deleteCatalogItem);

module.exports = router;