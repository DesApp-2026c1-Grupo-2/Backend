const {Router} = require("express")

const router = Router()

const validateSchema = require("../middlewares/validateSchema");
const { 
    createEquipoSchema, 
    updateEquipoSchema, 
    equipoIdParamSchema, 
    equipoQuerySchema 
} = require("../schemas/equipoSchema");

const {deleteEquipo,
    updateEquipo,
    getEquipoById,
    getEquipos,
    createEquipo } = require('../controllers/equipoControllers');

router.post("/", validateSchema(createEquipoSchema, 'body'), createEquipo);
router.get("/", validateSchema(equipoQuerySchema, 'query'), getEquipos);
router.get("/:id", validateSchema(equipoIdParamSchema, 'params'), getEquipoById);
router.put("/:id", validateSchema(equipoIdParamSchema, 'params'), validateSchema(updateEquipoSchema, 'body'), updateEquipo);
router.delete("/:id", validateSchema(equipoIdParamSchema, 'params'), deleteEquipo);

module.exports = router;