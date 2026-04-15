const express = require('express');
const controller = require('./pengurus.controller');
const { requireAuth, requireRole } = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/upload.middleware');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('pengurus'));

router.get('/users', controller.getUsers);
router.put('/users/:id', controller.updateUser);
router.patch('/users/:id/image', upload.single('image'), controller.updateUserImage);

module.exports = router;