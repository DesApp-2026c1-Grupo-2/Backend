const {Router} = require("express")

const router = Router()

const {deleteEquipo,
    updateEquipo,
    getEquipoById,
    getEquipos,
    createEquipo } = require('../controllers/equipoControllers');

router.post("/", createEquipo);
router.get("/", getEquipos);
router.get("/:id", getEquipoById);
router.put("/:id",updateEquipo);
router.delete("/:id", deleteEquipo);

module.exports = router;