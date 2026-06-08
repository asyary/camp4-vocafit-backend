const express = require('express');
const controller = require('./catalog.controller');
const { requireAuth, requireRole } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.get('/', controller.getCatalogItems);
router.get('/membership', controller.getMembershipCatalog);
router.get('/trainer', controller.getTrainerCatalog);

router.use(requireAuth);
router.use(requireRole('pengurus'));

router.post('/', controller.createCatalogItem);
router.patch('/reorder', controller.reorderCatalogItems);
router.put('/:code', controller.updateCatalogItem);
router.delete('/:code', controller.deleteCatalogItem);

module.exports = router;